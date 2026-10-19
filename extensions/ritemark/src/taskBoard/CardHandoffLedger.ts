/**
 * CardHandoffLedger — Give to agent, the machine-local half (Sprint 130, W4).
 *
 * The board controller decides WHETHER a card starts (agent ready, conflict
 * guard, Doing limit). This ledger makes it happen and follows it:
 *   - records the handoff before the sidebar hears of it (a crash leaves an
 *     honest `interrupted`, never a card that says "working" forever);
 *   - queues the turn in the card's own conversation (a new one on the first
 *     handoff, titled after the card, never the open one, never taking focus);
 *   - follows the turn by its host-minted turn id, the Sprint 117 way, and
 *     puts the result back on the card: the agent's report (or the summary of
 *     its last message), the files it changed, how long it took.
 *
 * It hears turn events as one of the AI sidebar's task listeners (G1), next to
 * the comment-task controller; turns it does not own are ignored.
 *
 * Contract: docs/development/releases/v1.14.0/sprint-130-task-board/
 *   technical-plan.md (W4)
 */

import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { AgentId } from '../agent/types';
import { summarizeTerminalText } from '../commentTasks/CommentTaskController';
import type { CommentTaskRuntimeSettings } from '../commentTasks/CommentTaskController';
import type { CommentTaskEnqueueMessage, CommentTaskEnqueueOutcome } from '../commentTasks/protocol';
import { safeFailureMessage } from '../commentTasks/types';
import type { AgentTaskListener, AgentTaskTerminalOutcome } from '../views/UnifiedViewProvider';
import { ACTOR_OF_RUNTIME, type HandoffLedger, type StartOutcome, type StartTurn } from './BoardController';
import type { BoardStore } from './BoardStore';
import { buildCardTurn } from './boardPrompt';
import { CARD_LIMITS, clip, withHistory, type Card } from './cardFile';
import { handoffViewOf, type CardHandoffRecordV1, type CardTaskStore } from './CardTaskStore';
import { ACTIVE_HANDOFF_STATES, TERMINAL_HANDOFF_STATES, type CardHandoffView, type HandoffState, type WaitReason } from './protocol';

/** What the ledger needs from the sidebar side of the host (UnifiedViewProvider). */
export interface CardTaskSidebar {
  areDurableConversationsEnabled(): Promise<boolean>;
  runtimeSettings(runtimeId: string): CommentTaskRuntimeSettings;
  /** Queue a turn; for `newConversation`, the answer names the new conversation. */
  enqueue(message: CommentTaskEnqueueMessage): Promise<{ outcome: CommentTaskEnqueueOutcome; conversationId?: string }>;
  /** Take a task's prompt out of its conversation's queue if it has not started. */
  dropQueued(taskId: string): Promise<void>;
  canAttach(conversationId: string | null): Promise<boolean>;
  revealConversation(conversationId: string): Promise<void>;
  cancelTurn(conversationId: string, conversationTurnId: string): Promise<void>;
  conversationExists(conversationId: string): Promise<boolean>;
  conversationTitle(conversationId: string): Promise<string | null>;
  setConversationTitle(conversationId: string, title: string): Promise<void>;
}

export interface CardHandoffLedgerDependencies {
  store: CardTaskStore;
  board: BoardStore;
  sidebar: CardTaskSidebar;
  /** The project folder, to turn changed files into project paths. */
  folderPath: string;
  /** Whether a runtime gets the board tools (W5): the prompt then names the card. */
  hasBoardTools?: (runtimeId: AgentId) => boolean;
  now?: () => Date;
  randomId?: () => string;
}

type ChangeListener = (event: { cardId: string; previous: HandoffState | null; next: HandoffState }) => void;

const ATTENTION: Record<'approval' | 'question' | 'plan-review', CardHandoffRecordV1['needs']> = {
  approval: 'approval',
  question: 'question',
  'plan-review': 'plan',
};

export class CardHandoffLedger implements HandoffLedger, AgentTaskListener {
  private readonly listeners = new Set<ChangeListener>();
  private readonly now: () => Date;
  private readonly randomId: () => string;

  constructor(private readonly deps: CardHandoffLedgerDependencies) {
    this.now = deps.now ?? (() => new Date());
    this.randomId = deps.randomId ?? randomUUID;
  }

  /**
   * Startup: read the records, forget cards that are gone from the board, and
   * turn work a quit or crash left in flight into `interrupted` (with Retry).
   * Call after the controller subscribed, so cards waiting on that work hear it.
   * Pass `forgetMissing: false` when the board could not read every card file:
   * a card it can't read right now (a cloud drive still fetching it) or that
   * doesn't parse is not gone, and its record holds the link to its conversation.
   */
  async recover(existingCardIds: ReadonlySet<string>, options: { forgetMissing?: boolean } = {}): Promise<void> {
    const forgetMissing = options.forgetMissing ?? true;
    const records = await this.deps.store.load();
    for (const record of records) {
      if (forgetMissing && !existingCardIds.has(record.cardId)) {
        await this.deps.store.remove(record.cardId);
        continue;
      }
      if (ACTIVE_HANDOFF_STATES.has(record.state)) {
        await this.transition(record.cardId, { state: 'interrupted' });
      }
    }
  }

  // ── HandoffLedger ─────────────────────────────────────────────────────────

  list(): ReadonlyMap<string, CardHandoffView> {
    const views = new Map<string, CardHandoffView>();
    for (const record of this.deps.store.all()) views.set(record.cardId, handoffViewOf(record));
    return views;
  }

  async start(turn: StartTurn): Promise<StartOutcome> {
    const { card, runtimeId } = turn;
    const previous = this.deps.store.get(card.id);
    if (previous && ACTIVE_HANDOFF_STATES.has(previous.state)) {
      return { ok: false, code: 'failed', message: 'An agent is already working on this card.' };
    }
    if (!(await this.deps.sidebar.areDurableConversationsEnabled())) {
      return this.fail(card.id, runtimeId, previous, 'Agent conversations are unavailable right now.', 'failed');
    }

    // Retry repeats what the last turn asked; anything else asks anew.
    const ask = turn.kind === 'retry' ? previous?.lastTurn ?? { kind: 'give' as const } : { kind: turn.kind, ...(turn.text ? { text: turn.text } : {}) };

    // The card's conversation, if it still exists on this computer. Retry after
    // a deleted conversation starts a new one; anything else says it is gone.
    let conversationId = previous?.conversationId ?? null;
    if (conversationId && !(await this.deps.sidebar.conversationExists(conversationId))) {
      if (turn.kind !== 'retry') {
        await this.transition(card.id, { state: 'conversation-gone', runtimeId }, previous);
        return { ok: false, code: 'no-conversation', message: 'This card’s conversation is no longer available. Retry starts a new one.' };
      }
      conversationId = null;
    }
    if (!(await this.deps.sidebar.canAttach(conversationId))) {
      return { ok: false, code: 'capacity', message: 'Five conversations are already working or waiting for you.' };
    }

    const texts = buildCardTurn(card, ask, { boardTools: this.deps.hasBoardTools?.(runtimeId) ?? false });
    const settings = this.deps.sidebar.runtimeSettings(runtimeId);
    const at = this.timestamp();
    const record: CardHandoffRecordV1 = {
      schemaVersion: 1,
      cardId: card.id,
      taskId: this.randomId(),
      runtimeId,
      conversationId,
      conversationTitle: conversationId ? previous?.conversationTitle ?? null : card.title,
      turnId: this.randomId(),
      state: 'accepting',
      since: at,
      lastTurn: ask,
      ...(conversationId ? {} : { titlePending: card.title }),
      createdAt: previous?.createdAt ?? at,
      updatedAt: at,
    };
    // Recorded before the sidebar hears of it.
    await this.put(record, previous?.state ?? null);

    const answer = await this.deps.sidebar.enqueue({
      type: 'comment-task/enqueue',
      taskId: record.taskId,
      conversationId: conversationId ?? '',
      conversationTurnId: record.turnId!,
      runtimeId,
      prompt: texts.prompt,
      displayText: texts.displayText,
      modelId: settings.modelId,
      autonomy: settings.approvalMode,
      thinkingEffort: settings.thinkingEffort,
      sourceDisplayPath: '',
      sourceKind: 'card',
      ...(conversationId ? {} : { newConversation: { title: card.title } }),
    });
    const current = this.deps.store.get(card.id);
    if (!current || current.taskId !== record.taskId) return { ok: true };
    if (answer.outcome === 'queued') {
      // A turn that already started (fast queue) is not moved back.
      if (current.state === 'accepting') {
        await this.transition(card.id, {
          state: 'queued',
          ...(answer.conversationId && !current.conversationId ? { conversationId: answer.conversationId } : {}),
        });
      }
      return { ok: true };
    }
    if (answer.outcome === 'no-conversation' && conversationId) {
      await this.transition(card.id, { state: 'conversation-gone' });
      return { ok: false, code: 'no-conversation', message: 'This card’s conversation is no longer available. Retry starts a new one.' };
    }
    const message =
      answer.outcome === 'full'
        ? 'That conversation already has ten prompts waiting.'
        : 'The AI sidebar did not answer. Try again.';
    await this.transition(card.id, { state: 'failed', failure: message });
    return { ok: false, code: answer.outcome === 'full' ? 'failed' : 'sidebar-unreachable', message };
  }

  async wait(cardId: string, runtimeId: AgentId, reason: WaitReason): Promise<void> {
    const previous = this.deps.store.get(cardId);
    if (previous && ACTIVE_HANDOFF_STATES.has(previous.state)) return;
    const at = this.timestamp();
    await this.put(
      {
        schemaVersion: 1,
        cardId,
        taskId: previous?.taskId ?? this.randomId(),
        runtimeId,
        conversationId: previous?.conversationId ?? null,
        conversationTitle: previous?.conversationTitle ?? null,
        turnId: null,
        state: 'waiting',
        since: at,
        waitFor: reason,
        ...(previous?.lastTurn ? { lastTurn: previous.lastTurn } : {}),
        createdAt: previous?.createdAt ?? at,
        updatedAt: at,
      },
      previous?.state ?? null,
    );
  }

  async unwait(cardId: string): Promise<void> {
    const record = this.deps.store.get(cardId);
    if (!record || record.state !== 'waiting') return;
    if (record.conversationId) {
      // Keep the conversation binding; the card simply has nothing pending.
      await this.transition(cardId, { state: 'cancelled', waitFor: undefined });
    } else {
      await this.deps.store.remove(cardId);
      this.emit(cardId, 'waiting', 'cancelled');
    }
  }

  async stop(cardId: string): Promise<void> {
    const record = this.deps.store.get(cardId);
    if (!record) return;
    if (record.state === 'accepting' || record.state === 'queued') {
      // Not running yet: the sidebar drops the queued prompt (W13), or a later
      // Give would run it too, untracked. Should it start anyway, the turn is
      // stopped when it does (applyTurnStarted).
      await this.transition(cardId, { state: 'cancelled' });
      await this.deps.sidebar.dropQueued(record.taskId).catch(() => undefined);
      return;
    }
    if ((record.state === 'running' || record.state === 'needs-user') && record.conversationId && record.turnId) {
      await this.deps.sidebar.cancelTurn(record.conversationId, record.turnId);
    }
  }

  async openConversation(cardId: string): Promise<boolean> {
    const record = this.deps.store.get(cardId);
    if (!record?.conversationId || record.state === 'conversation-gone') return false;
    if (!(await this.deps.sidebar.conversationExists(record.conversationId))) {
      await this.transition(cardId, { state: 'conversation-gone' });
      return false;
    }
    await this.deps.sidebar.revealConversation(record.conversationId);
    return true;
  }

  canAttach(cardId: string): Promise<boolean> {
    return this.deps.sidebar.canAttach(this.deps.store.get(cardId)?.conversationId ?? null);
  }

  onDidChange(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ── AgentTaskListener (turn events from the AI sidebar) ───────────────────

  async applyEnqueueOutcome(taskId: string, outcome: CommentTaskEnqueueOutcome): Promise<void> {
    if (outcome === 'queued') return;
    const record = this.deps.store.findByTask(taskId);
    if (!record || (record.state !== 'accepting' && record.state !== 'queued')) return;
    await this.transition(record.cardId, {
      state: 'failed',
      failure: outcome === 'full' ? 'That conversation already has ten prompts waiting.' : 'That conversation is no longer available.',
    });
  }

  async applyDequeued(taskId: string): Promise<void> {
    const record = this.deps.store.findByTask(taskId);
    if (!record || record.state !== 'queued') return;
    await this.transition(record.cardId, { state: 'cancelled' });
  }

  async applyDispatchFailed(taskId: string, message: string): Promise<void> {
    const record = this.deps.store.findByTask(taskId);
    if (!record || TERMINAL_HANDOFF_STATES.has(record.state)) return;
    await this.transition(record.cardId, { state: 'failed', failure: safeFailureMessage(message) });
  }

  async applyTurnStarted(conversationId: string, conversationTurnId: string): Promise<void> {
    const record = this.deps.store.findByTurn(conversationTurnId);
    if (!record) return;
    if (record.state === 'cancelled') {
      // Stopped while it waited in the queue: the turn starts anyway when the
      // queue drains, so stop it at once.
      await this.deps.sidebar.cancelTurn(conversationId, conversationTurnId).catch(() => undefined);
      return;
    }
    // A late start for a turn that already ended is old news.
    if (TERMINAL_HANDOFF_STATES.has(record.state) || record.state === 'waiting') return;
    await this.bindConversation(record, conversationId);
    await this.transition(record.cardId, {
      state: 'running',
      needs: undefined,
      ...(record.startedAt && record.state !== 'accepting' && record.state !== 'queued' ? {} : { startedAt: this.timestamp() }),
    });
  }

  async applyTurnAttention(
    conversationId: string,
    conversationTurnId: string,
    attentionKind: 'approval' | 'question' | 'plan-review',
  ): Promise<void> {
    const record = this.deps.store.findByTurn(conversationTurnId);
    if (!record || TERMINAL_HANDOFF_STATES.has(record.state)) return;
    await this.bindConversation(record, conversationId);
    await this.transition(record.cardId, { state: 'needs-user', needs: ATTENTION[attentionKind] });
  }

  async applyTurnTerminal(conversationId: string, conversationTurnId: string, outcome: AgentTaskTerminalOutcome): Promise<void> {
    const record = this.deps.store.findByTurn(conversationTurnId);
    if (!record || TERMINAL_HANDOFF_STATES.has(record.state)) return;
    await this.bindConversation(record, conversationId);
    const actor = ACTOR_OF_RUNTIME[record.runtimeId];
    const at = this.timestamp();
    if (outcome.status === 'completed') {
      const seconds = record.startedAt ? Math.max(0, Math.round((Date.parse(at) - Date.parse(record.startedAt)) / 1000)) : undefined;
      const files = this.projectFiles(outcome.filesModified);
      try {
        await this.deps.board.mutate(record.cardId, null, (card) => this.withResult(card, record, actor, at, seconds, files, outcome.text ?? ''));
      } catch {
        // The card is gone or unreadable: the handoff still ends honestly.
      }
      await this.transition(record.cardId, { state: 'completed' });
      return;
    }
    if (outcome.status === 'cancelled') {
      await this.historyLine(record.cardId, 'you', 'Stopped');
      await this.transition(record.cardId, { state: 'cancelled' });
      return;
    }
    if (outcome.status === 'interrupted') {
      await this.transition(record.cardId, { state: 'interrupted' });
      return;
    }
    const failure = safeFailureMessage(outcome.error);
    await this.historyLine(record.cardId, actor, `Failed: ${clip(failure, 120)}`);
    await this.transition(record.cardId, { state: 'failed', failure: clip(failure, 160) });
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  /**
   * The result on the card. If the agent reported with `report_result` during
   * this turn (W5), its words stay and only the length and files are added;
   * otherwise the summary of its last message is the result.
   */
  private withResult(card: Card, record: CardHandoffRecordV1, actor: string, at: string, seconds: number | undefined, files: string[], text: string): Card {
    const reportedThisTurn = Boolean(card.result && record.startedAt && card.result.at >= record.startedAt);
    const summary = reportedThisTurn ? card.result!.summary : clip(summarizeTerminalText(text), CARD_LIMITS.summary);
    const next: Card = {
      ...card,
      result: {
        by: actor,
        at,
        ...(seconds !== undefined ? { seconds } : {}),
        summary,
        files: files.length ? files : reportedThisTurn ? card.result!.files : [],
        check: reportedThisTurn ? card.result!.check : [],
      },
    };
    return withHistory(next, { at, by: actor, what: `Finished: ${clip(summary, 120)}` });
  }

  private async historyLine(cardId: string, by: string, what: string): Promise<void> {
    try {
      await this.deps.board.mutate(cardId, { by, what }, (card) => card);
    } catch {
      // A card that is gone or unreadable keeps no history.
    }
  }

  /**
   * Changed files as project paths; files outside the project are left out.
   * Paths are also compared resolved, because an agent may report the real
   * path of a project opened through a symlink (macOS: /var → /private/var).
   */
  private projectFiles(files: string[] | undefined): string[] {
    const inside = (root: string, file: string): string | null => {
      const relative = path.relative(root, file);
      return !relative || relative.startsWith('..') || path.isAbsolute(relative) ? null : relative.split(path.sep).join('/');
    };
    const real = (target: string): string => {
      try {
        return fs.realpathSync(target);
      } catch {
        return target;
      }
    };
    const folder = this.deps.folderPath;
    const realFolder = real(folder);
    const out: string[] = [];
    for (const file of files ?? []) {
      const absolute = path.isAbsolute(file) ? file : path.join(folder, file);
      const project = inside(folder, absolute) ?? inside(realFolder, real(absolute)) ?? inside(realFolder, absolute);
      if (!project) continue;
      if (!out.includes(project)) out.push(project);
      if (out.length >= CARD_LIMITS.resultFiles) break;
    }
    return out;
  }

  /**
   * A new conversation gets its canonical id at its first turn; follow it, and
   * give it the card's title then (a rename needs the stored record).
   */
  private async bindConversation(record: CardHandoffRecordV1, conversationId: string): Promise<void> {
    if (!conversationId) return;
    if (record.conversationId !== conversationId) {
      await this.transition(record.cardId, { conversationId }, undefined, true);
    }
    const current = this.deps.store.get(record.cardId);
    if (current?.titlePending) {
      const title = current.titlePending;
      try {
        await this.deps.sidebar.setConversationTitle(conversationId, title);
        await this.transition(record.cardId, { titlePending: undefined, conversationTitle: title }, undefined, true);
      } catch {
        // The record may not exist yet; the next turn event tries again.
      }
    }
  }

  private async fail(
    cardId: string,
    runtimeId: AgentId,
    previous: CardHandoffRecordV1 | null,
    message: string,
    code: 'failed' | 'sidebar-unreachable',
  ): Promise<StartOutcome> {
    const at = this.timestamp();
    await this.put(
      {
        schemaVersion: 1,
        cardId,
        taskId: this.randomId(),
        runtimeId,
        conversationId: previous?.conversationId ?? null,
        conversationTitle: previous?.conversationTitle ?? null,
        turnId: null,
        state: 'failed',
        since: at,
        failure: message,
        ...(previous?.lastTurn ? { lastTurn: previous.lastTurn } : {}),
        createdAt: previous?.createdAt ?? at,
        updatedAt: at,
      },
      previous?.state ?? null,
    );
    return { ok: false, code, message };
  }

  /** Change a record's fields; a state change is announced. `quiet` changes no state. */
  private async transition(
    cardId: string,
    change: Partial<Omit<CardHandoffRecordV1, 'cardId' | 'schemaVersion'>>,
    base?: CardHandoffRecordV1 | null,
    quiet = false,
  ): Promise<void> {
    const current = base ?? this.deps.store.get(cardId);
    if (!current) return;
    const at = this.timestamp();
    const next: CardHandoffRecordV1 = { ...current, ...change, updatedAt: at };
    for (const [key, value] of Object.entries(change)) {
      if (value === undefined) delete (next as unknown as Record<string, unknown>)[key];
    }
    if (change.state && change.state !== current.state) {
      next.since = at;
      if (change.state !== 'needs-user') delete next.needs;
      if (change.state !== 'waiting') delete next.waitFor;
      if (change.state !== 'failed') delete next.failure;
    }
    await this.put(next, current.state, !quiet);
  }

  /** Store a record; announce it when its state changed (or it is new). */
  private async put(record: CardHandoffRecordV1, previous: HandoffState | null, announce = true): Promise<void> {
    await this.deps.store.put(record);
    if (announce && previous !== record.state) this.emit(record.cardId, previous, record.state);
  }

  private emit(cardId: string, previous: HandoffState | null, next: HandoffState): void {
    for (const listener of this.listeners) {
      try {
        listener({ cardId, previous, next });
      } catch {
        // A listener's failure is its own.
      }
    }
  }

  private timestamp(): string {
    return this.now().toISOString();
  }
}

