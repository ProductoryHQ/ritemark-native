/**
 * BoardController — the task board's rules (Sprint 130, #119).
 *
 * Both board surfaces and the agents' board tools go through this class. It
 * owns the rules that make the board useful in the long-horizon era:
 *   - who moves next is derived, never stored: an agent while its turn is in
 *     flight, the user when something waits on them, nobody otherwise;
 *   - Your calls lists what waits on the user (blocked agents, decisions,
 *     results to review, failures), longest-waiting first within each kind;
 *   - Give to agent never starts a second agent on a file another card's agent
 *     is changing (the conflict guard) and respects the Doing limit;
 *   - a card that waits (for another card, for room in Doing, for room in the
 *     AI sidebar) starts by itself when the reason goes away;
 *   - agents cannot finish or delete a card.
 *
 * No `vscode` import: the store, the handoff ledger (W4) and everything about
 * the host are injected, so the rules are tested in Node.
 *
 * Contract: docs/development/releases/v1.14.0/sprint-130-task-board/
 *   spec.md (R3, R5, R7), technical-plan.md (W2)
 */

import type { AgentId } from '../agent/types';
import {
  RUNTIME_LABELS,
  messageForRuntimeAvailability,
  recoveryForRuntimeAvailability,
  type RuntimeAvailabilities,
  type RuntimeAvailability,
} from '../runtime/availability';
import { BoardStoreError, type BoardEntry, type BoardStore } from './BoardStore';
import {
  CARD_LIMITS,
  checkDoneWhen,
  checkFiles,
  checkTitle,
  clip,
  compareCards,
  rankBetween,
  type Card,
  type CardStage,
} from './cardFile';
import {
  ACTIVE_HANDOFF_STATES,
  BOARD_AGENTS,
  TERMINAL_HANDOFF_STATES,
  WIP_LIMIT_DEFAULT,
  WIP_LIMIT_MAX,
  type BoardAnswer,
  type BoardCall,
  type BoardCardView,
  type BoardErrorCode,
  type BoardSnapshot,
  type CallKind,
  type CardHandoffView,
  type HandoffState,
  type WaitReason,
  type WhoMoves,
} from './protocol';

/** Who is acting: the user through the board, or an agent through its tools. */
export type BoardActor = 'you' | 'claude' | 'codex' | 'opencode';

export const ACTOR_OF_RUNTIME: Record<AgentId, BoardActor> = {
  'claude-code': 'claude',
  codex: 'codex',
  opencode: 'opencode',
};

const RUNTIME_OF_ACTOR: Partial<Record<string, AgentId>> = {
  claude: 'claude-code',
  codex: 'codex',
  opencode: 'opencode',
};

export interface StartTurn {
  card: Card;
  runtimeId: AgentId;
  /** `give`: the card's first turn or another one; `follow-up` / `answer`: the
   *  user's words or decision in the same conversation; `retry`: the last turn
   *  again. */
  kind: 'give' | 'follow-up' | 'answer' | 'retry';
  text?: string;
}

export type StartOutcome =
  | { ok: true }
  | { ok: false; code: 'capacity' | 'runtime-unavailable' | 'sidebar-unreachable' | 'no-conversation' | 'failed'; message: string };

/**
 * The machine-local side of Give to agent (W4: `CardTaskStore` plus the AI
 * sidebar). One handoff per card: the latest one, in any state.
 */
export interface HandoffLedger {
  list(): ReadonlyMap<string, CardHandoffView>;
  start(turn: StartTurn): Promise<StartOutcome>;
  wait(cardId: string, runtimeId: AgentId, reason: WaitReason): Promise<void>;
  unwait(cardId: string): Promise<void>;
  stop(cardId: string): Promise<void>;
  openConversation(cardId: string): Promise<boolean>;
  /** Whether the AI sidebar has room for another working conversation (P1). */
  canAttach(cardId: string): Promise<boolean>;
  onDidChange(listener: (event: { cardId: string; previous: HandoffState | null; next: HandoffState }) => void): () => void;
}

/** Per-project settings on this computer (`workspaceState`). */
export interface BoardSettings {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): Promise<void>;
}

export interface BoardControllerDependencies {
  store: BoardStore;
  ledger: HandoffLedger;
  folderName: string;
  settings: BoardSettings;
  /** Last known availability of each agent, for the buttons (cheap, cached). */
  runtimes: () => RuntimeAvailabilities;
  /** The authoritative check right before agent work starts (may probe). */
  checkRuntime?: (runtimeId: AgentId) => Promise<RuntimeAvailability>;
  enabled: () => boolean;
  fileExists: (relativePath: string) => Promise<boolean>;
  setBadge?: (count: number) => void;
  now?: () => Date;
}

export const WIP_LIMIT_KEY = 'ritemark.taskBoard.wipLimit';
export const DEFAULT_RUNTIME_KEY = 'ritemark.taskBoard.runtime';

const STAGE_WORDS: Record<CardStage, string> = { idea: 'Ideas', todo: 'To do', doing: 'Doing', done: 'Done' };
const CALL_ORDER: Record<CallKind, number> = { 'needs-you': 0, decision: 1, review: 2, failed: 3 };

function answerError(code: BoardErrorCode, message: string): BoardAnswer {
  return { ok: false, code, message };
}

function fromStoreError(error: unknown): BoardAnswer {
  if (error instanceof BoardStoreError) return answerError(error.code, error.message);
  throw error;
}

/** A card title or the user's words inside a history line: one line, cut at a word. */
function shortTitle(title: string): string {
  return clip(title, 40);
}

/** Progress of a card's own checkboxes ("2 of 5"). */
export function countCheckboxes(description: string): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const line of description.split('\n')) {
    const match = /^\s*[-*+]\s+\[([ xX])\]\s/.exec(line);
    if (!match) continue;
    total += 1;
    if (match[1] !== ' ') done += 1;
  }
  return { done, total };
}

/**
 * Who moves next and which call, if any, a card is. Order of precedence:
 * agent work in flight; an agent blocked in its conversation; a decision the
 * agent left; a failed handoff; a result waiting in Doing.
 */
export function deriveWho(card: Card, handoff: CardHandoffView | null): { move: WhoMoves; call: CallKind | null; since: string | null } {
  const state = handoff?.state;
  if (state === 'needs-user') return { move: 'you', call: 'needs-you', since: handoff!.since };
  if (state && ACTIVE_HANDOFF_STATES.has(state)) return { move: 'agent', call: null, since: null };
  if (card.stage === 'done') return { move: null, call: null, since: null };
  if (card.ask) return { move: 'you', call: 'decision', since: card.ask.at };
  if (state === 'failed' || state === 'interrupted' || state === 'conversation-gone') {
    return { move: 'you', call: 'failed', since: handoff!.since };
  }
  if (state === 'waiting') return { move: 'agent', call: null, since: null };
  if (card.result && card.stage === 'doing') return { move: 'you', call: 'review', since: card.result.at };
  if (state === 'cancelled') return { move: 'you', call: null, since: null };
  return { move: null, call: null, since: null };
}

export class BoardController {
  private readonly store: BoardStore;
  private readonly ledger: HandoffLedger;
  private readonly now: () => Date;
  private readonly listeners = new Set<(snapshot: BoardSnapshot) => void>();
  private readonly disposers: Array<() => void> = [];
  /** Auto-starts run one at a time, so two finishing turns cannot both start
   *  the same waiting card. */
  private autoTail: Promise<void> = Promise.resolve();
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  /** Cards between "start this" and the ledger recording it: a second Give to
   *  (a double click, an auto-start racing the user) is refused as busy. */
  private readonly starting = new Set<string>();

  constructor(private readonly deps: BoardControllerDependencies) {
    this.store = deps.store;
    this.ledger = deps.ledger;
    this.now = deps.now ?? (() => new Date());
    this.disposers.push(
      this.store.onDidChange(() => {
        this.scheduleRefresh();
        this.queueAuto(() => this.afterBoardChange());
      }),
      this.ledger.onDidChange((event) => {
        this.scheduleRefresh();
        this.queueAuto(() => this.afterHandoffChange(event.cardId, event.next));
      }),
    );
  }

  dispose(): void {
    for (const dispose of this.disposers.splice(0)) dispose();
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.listeners.clear();
  }

  /** Surfaces subscribe to snapshots; the first one arrives at once. */
  subscribe(listener: (snapshot: BoardSnapshot) => void): () => void {
    this.listeners.add(listener);
    void this.snapshot().then((snapshot) => {
      if (this.listeners.has(listener)) listener(snapshot);
    });
    return () => this.listeners.delete(listener);
  }

  /** Waits until queued auto-starts have run (tests, and the host on dispose). */
  settled(): Promise<void> {
    return this.autoTail;
  }

  // ── Snapshot ──────────────────────────────────────────────────────────────

  async snapshot(): Promise<BoardSnapshot> {
    const entries = await this.store.list();
    const handoffs = this.ledger.list();
    const cards = entries.flatMap((entry) => (entry.kind === 'card' ? [entry] : []));
    const unreadable = entries.flatMap((entry) =>
      entry.kind === 'unreadable' ? [{ fileName: entry.fileName, message: entry.message }] : [],
    );
    const nextUp = this.nextUpId(cards.map((entry) => entry.card), handoffs);
    const exists = new Map<string, boolean>();
    await Promise.all(
      [...new Set(cards.flatMap((entry) => entry.card.files))].map(async (file) => {
        exists.set(file, await this.deps.fileExists(file).catch(() => false));
      }),
    );
    const views: BoardCardView[] = [];
    const calls: BoardCall[] = [];
    for (const entry of cards) {
      const { card } = entry;
      const handoff = handoffs.get(card.id) ?? null;
      const who = deriveWho(card, handoff);
      if (who.call && who.since) calls.push({ cardId: card.id, kind: who.call, since: who.since });
      views.push({
        id: card.id,
        title: card.title,
        doneWhen: card.doneWhen ?? null,
        stage: card.stage,
        rank: card.rank,
        description: card.description,
        files: card.files.map((path) => ({ path, exists: exists.get(path) ?? false })),
        created: card.created ?? null,
        updated: card.updated ?? null,
        result: card.result ?? null,
        ask: card.ask ?? null,
        review: card.review ?? null,
        dropped: card.dropped === true,
        history: card.history,
        copiedFrom: entry.copiedFrom ?? null,
        handoff,
        move: who.move,
        call: who.call,
        nextUp: card.id === nextUp,
        locked: Boolean(handoff && ACTIVE_HANDOFF_STATES.has(handoff.state)),
        checkboxes: countCheckboxes(card.description),
      });
    }
    calls.sort((a, b) => CALL_ORDER[a.kind] - CALL_ORDER[b.kind] || (a.since < b.since ? -1 : a.since > b.since ? 1 : 0));
    const oldest = calls.reduce<string | null>((min, call) => (min === null || call.since < min ? call.since : min), null);
    const runtimes = this.deps.runtimes();
    return {
      folder: this.deps.folderName,
      enabled: this.deps.enabled(),
      cards: views,
      unreadable,
      calls,
      attention: { count: calls.length, oldestSince: oldest, blocked: calls.filter((call) => call.kind === 'needs-you').length },
      doing: { count: cards.filter((entry) => entry.card.stage === 'doing').length, limit: this.wipLimit() },
      runtimes: BOARD_AGENTS.map((id) => {
        const availability = runtimes[id];
        return {
          id,
          label: RUNTIME_LABELS[id],
          usable: availability.usable,
          state: availability.state,
          message: availability.usable ? null : messageForRuntimeAvailability(id, availability),
          recovery: recoveryForRuntimeAvailability(availability.state),
        };
      }),
      defaultRuntime: this.defaultRuntime(),
    };
  }

  /** Push a fresh snapshot to every surface; several changes in one tick
   *  become one push. */
  scheduleRefresh(): void {
    if (this.refreshTimer) return;
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      void this.refresh();
    }, 0);
  }

  async refresh(): Promise<BoardSnapshot> {
    const snapshot = await this.snapshot();
    this.deps.setBadge?.(snapshot.attention.count);
    for (const listener of this.listeners) listener(snapshot);
    return snapshot;
  }

  // ── Settings ──────────────────────────────────────────────────────────────

  wipLimit(): number | null {
    const stored = this.deps.settings.get<number | null>(WIP_LIMIT_KEY);
    if (stored === null) return null;
    if (typeof stored === 'number' && Number.isSafeInteger(stored) && stored >= 1 && stored <= WIP_LIMIT_MAX) return stored;
    return WIP_LIMIT_DEFAULT;
  }

  async setWipLimit(limit: number | null): Promise<BoardAnswer> {
    if (limit !== null && (!Number.isSafeInteger(limit) || limit < 1 || limit > WIP_LIMIT_MAX)) {
      return answerError('invalid', `The Doing limit is 1–${WIP_LIMIT_MAX}, or no limit.`);
    }
    await this.deps.settings.update(WIP_LIMIT_KEY, limit);
    this.scheduleRefresh();
    this.queueAuto(() => this.fillSlots());
    return { ok: true };
  }

  /** The agent the board's buttons name: the last one the user chose, else the
   *  first that is ready. */
  defaultRuntime(): AgentId {
    const stored = this.deps.settings.get<string>(DEFAULT_RUNTIME_KEY);
    if (stored && (BOARD_AGENTS as readonly string[]).includes(stored)) return stored as AgentId;
    const runtimes = this.deps.runtimes();
    return BOARD_AGENTS.find((id) => runtimes[id].usable) ?? 'claude-code';
  }

  private async rememberRuntime(runtimeId: AgentId): Promise<void> {
    if (this.deps.settings.get<string>(DEFAULT_RUNTIME_KEY) !== runtimeId) {
      await this.deps.settings.update(DEFAULT_RUNTIME_KEY, runtimeId);
    }
  }

  // ── Card operations ───────────────────────────────────────────────────────

  async add(
    input: { title: string; stage: CardStage; doneWhen?: string; description?: string; files?: string[] },
    actor: BoardActor = 'you',
  ): Promise<BoardAnswer> {
    if (actor !== 'you' && input.stage !== 'idea' && input.stage !== 'todo') {
      return answerError('not-allowed', 'Agents add cards to Ideas or To do.');
    }
    const title = checkTitle(input.title);
    if (!title.ok) return answerError('invalid', title.message);
    const doneWhen = checkDoneWhen(input.doneWhen ?? '');
    if (!doneWhen.ok) return answerError('invalid', doneWhen.message);
    const files = checkFiles(input.files ?? []);
    if (!files.ok) return answerError('invalid', files.message);
    if (actor !== 'you' && Buffer.byteLength(input.description ?? '', 'utf8') > CARD_LIMITS.toolDescriptionBytes) {
      return answerError('invalid', 'A description from an agent can be at most 16 KB.');
    }
    try {
      const card = await this.store.create({
        title: title.value,
        stage: input.stage,
        by: actor,
        ...(doneWhen.value ? { doneWhen: doneWhen.value } : {}),
        ...(input.description ? { description: input.description } : {}),
        files: files.value,
      });
      return { ok: true, cardId: card.id };
    } catch (error) {
      return fromStoreError(error);
    }
  }

  async update(
    cardId: string,
    fields: { title?: string; doneWhen?: string; description?: string; files?: string[] },
    actor: BoardActor = 'you',
  ): Promise<BoardAnswer> {
    const title = fields.title === undefined ? null : checkTitle(fields.title);
    if (title && !title.ok) return answerError('invalid', title.message);
    const doneWhen = fields.doneWhen === undefined ? null : checkDoneWhen(fields.doneWhen);
    if (doneWhen && !doneWhen.ok) return answerError('invalid', doneWhen.message);
    const files = fields.files === undefined ? null : checkFiles(fields.files);
    if (files && !files.ok) return answerError('invalid', files.message);
    if (
      actor !== 'you' &&
      fields.description !== undefined &&
      Buffer.byteLength(fields.description, 'utf8') > CARD_LIMITS.toolDescriptionBytes
    ) {
      return answerError('invalid', 'A description from an agent can be at most 16 KB.');
    }
    const changed: string[] = [];
    if (title) changed.push('title');
    if (doneWhen) changed.push('Done when');
    if (fields.description !== undefined) changed.push('description');
    if (files) changed.push('files');
    if (changed.length === 0) return { ok: true, cardId };
    try {
      await this.store.mutate(cardId, { by: actor, what: `Edited ${changed.join(', ')}` }, (card) => {
        const next: Card = { ...card };
        if (title?.ok) next.title = title.value;
        if (doneWhen?.ok) {
          if (doneWhen.value) next.doneWhen = doneWhen.value;
          else delete next.doneWhen;
        }
        if (fields.description !== undefined) next.description = fields.description;
        if (files?.ok) next.files = files.value;
        return next;
      });
      return { ok: true, cardId };
    } catch (error) {
      return fromStoreError(error);
    }
  }

  /**
   * Move a card to a stage: on top by default, before `beforeCardId`, or at the
   * end. A card an agent is working on stays in Doing. Agents cannot move a
   * card to Done or into a full Doing.
   */
  async move(
    cardId: string,
    stage: CardStage,
    position: { beforeCardId?: string; atEnd?: boolean } = {},
    actor: BoardActor = 'you',
  ): Promise<BoardAnswer> {
    if (actor !== 'you' && stage === 'done') return answerError('not-allowed', 'Only the user marks a card done.');
    const entries = await this.store.list();
    const card = this.cardOf(entries, cardId);
    if (!card) return answerError('not-found', 'That card is no longer on the board.');
    if (card.stage !== stage && this.isLocked(cardId)) {
      return answerError('busy', 'The agent is still working on this card. Stop it first, or wait until it finishes.');
    }
    if (actor !== 'you' && stage === 'doing' && card.stage !== 'doing') {
      const limit = this.wipLimit();
      const count = this.cardsIn(entries, 'doing').length;
      if (limit !== null && count >= limit) {
        return answerError('not-allowed', `Doing is full (${count} of ${limit}). Leave the card in To do.`);
      }
    }
    const rank = await this.rankFor(stage, cardId, position);
    if (rank === null) return answerError('not-found', 'The card to place it before is no longer in that stage.');
    const what =
      card.stage === stage
        ? null
        : card.stage === 'done'
          ? 'Reopened'
          : stage === 'done'
            ? 'Marked done'
            : `Moved to ${STAGE_WORDS[stage]}`;
    try {
      await this.store.mutate(cardId, what ? { by: actor, what } : null, (current) => {
        const next: Card = { ...current, stage, rank };
        if (stage === 'done') delete next.ask;
        return next;
      });
      // A card put away no longer waits to start.
      if ((stage === 'done' || stage === 'idea') && this.ledger.list().get(cardId)?.state === 'waiting') {
        await this.ledger.unwait(cardId);
      }
      return { ok: true, cardId };
    } catch (error) {
      return fromStoreError(error);
    }
  }

  markDone(cardId: string): Promise<BoardAnswer> {
    return this.move(cardId, 'done');
  }

  async remove(cardId: string): Promise<BoardAnswer> {
    if (this.isLocked(cardId)) {
      return answerError('busy', 'The agent is still working on this card. Stop it first.');
    }
    try {
      await this.ledger.unwait(cardId);
      await this.store.remove(cardId);
      return { ok: true };
    } catch (error) {
      return fromStoreError(error);
    }
  }

  async setDropped(cardId: string, dropped: boolean): Promise<BoardAnswer> {
    const card = await this.store.get(cardId);
    if (!card) return answerError('not-found', 'That card is no longer on the board.');
    if (card.stage !== 'idea') return answerError('invalid', 'Only ideas can be dropped.');
    if (Boolean(card.dropped) === dropped) return { ok: true, cardId };
    try {
      await this.store.mutate(cardId, { by: 'you', what: dropped ? 'Dropped' : 'Brought back' }, (current) => {
        const next: Card = { ...current };
        if (dropped) next.dropped = true;
        else delete next.dropped;
        return next;
      });
      return { ok: true, cardId };
    } catch (error) {
      return fromStoreError(error);
    }
  }

  // ── Give to agent ─────────────────────────────────────────────────────────

  /**
   * Hand a card to an agent. In order: the agent must be ready; the conflict
   * guard (unless `force`); the Doing limit for a card outside Doing (unless
   * `overLimit`); room in the AI sidebar (else the card waits for it).
   */
  async give(cardId: string, runtimeId: AgentId, options: { force?: boolean; overLimit?: boolean } = {}): Promise<BoardAnswer> {
    await this.rememberRuntime(runtimeId);
    return this.tryStart(cardId, runtimeId, { ...options, why: null });
  }

  /** Doing is full: keep the card in To do and start it when Doing has room. */
  async queue(cardId: string, runtimeId: AgentId): Promise<BoardAnswer> {
    return this.recordWait(cardId, runtimeId, { kind: 'slot' });
  }

  /** Conflict: keep the card in To do and start it when the other card's turn ends. */
  async wait(cardId: string, runtimeId: AgentId): Promise<BoardAnswer> {
    const entries = await this.store.list();
    const card = this.cardOf(entries, cardId);
    if (!card) return answerError('not-found', 'That card is no longer on the board.');
    const conflict = this.findConflict(entries, card);
    if (!conflict) return this.give(cardId, runtimeId);
    return this.recordWait(cardId, runtimeId, { kind: 'conflict', cardId: conflict.card.id });
  }

  async unwait(cardId: string): Promise<BoardAnswer> {
    await this.ledger.unwait(cardId);
    this.scheduleRefresh();
    return { ok: true, cardId };
  }

  /** Ask for changes…, or Something else… when a decision is waiting: the
   *  user's own words as a new turn in the card's conversation. */
  async followUp(cardId: string, text: string, runtimeId?: AgentId): Promise<BoardAnswer> {
    const words = text.trim();
    const card = await this.store.get(cardId);
    if (!card) return answerError('not-found', 'That card is no longer on the board.');
    if (!words) return answerError('invalid', card.ask ? 'Write your answer first.' : 'Write what the agent should change.');
    if (card.ask) {
      const runtime = runtimeId ?? RUNTIME_OF_ACTOR[card.ask.by] ?? this.ledger.list().get(cardId)?.runtimeId ?? this.defaultRuntime();
      return this.answerWith(card, runtime, words);
    }
    if (this.isLocked(cardId)) return answerError('busy', 'The agent is still working on this card.');
    const runtime = runtimeId ?? this.ledger.list().get(cardId)?.runtimeId ?? this.defaultRuntime();
    if (runtimeId) await this.rememberRuntime(runtimeId);
    const gate = await this.availability(runtime);
    if (gate) return gate;
    return this.startTurn(card, runtime, { kind: 'follow-up', text: words }, { by: 'you', what: `Asked for changes: ${shortTitle(words)}` });
  }

  /** Answer a decision an agent left on the card with one of its options. */
  async answer(cardId: string, optionIndex: number): Promise<BoardAnswer> {
    const card = await this.store.get(cardId);
    if (!card) return answerError('not-found', 'That card is no longer on the board.');
    if (!card.ask) return answerError('invalid', 'There is no decision waiting on this card.');
    const option = card.ask.options[optionIndex];
    if (option === undefined) return answerError('invalid', 'That option is not on the card.');
    const runtime = RUNTIME_OF_ACTOR[card.ask.by] ?? this.ledger.list().get(cardId)?.runtimeId ?? this.defaultRuntime();
    return this.answerWith(card, runtime, option);
  }

  async retry(cardId: string, runtimeId?: AgentId): Promise<BoardAnswer> {
    const card = await this.store.get(cardId);
    if (!card) return answerError('not-found', 'That card is no longer on the board.');
    if (this.isLocked(cardId)) return answerError('busy', 'The agent is still working on this card.');
    const runtime = runtimeId ?? this.ledger.list().get(cardId)?.runtimeId ?? this.defaultRuntime();
    if (runtimeId) await this.rememberRuntime(runtimeId);
    const gate = await this.availability(runtime);
    if (gate) return gate;
    return this.startTurn(card, runtime, { kind: 'retry' }, { by: 'you', what: `Retried with ${RUNTIME_LABELS[runtime]}` });
  }

  // ── For agents (the board tools, W5) ──────────────────────────────────────

  /**
   * report_result: an agent's own account of its work on a card, with up to
   * three things the user should check. The card then waits on the user for
   * review (when it is in Doing). During a card's own turn the ledger adds the
   * "Finished" history line and the changed files when the turn ends.
   */
  async reportResult(cardId: string, actor: BoardActor, input: { summary: string; check?: string[] }): Promise<BoardAnswer> {
    const summary = input.summary.replace(/\s+/g, ' ').trim();
    if (!summary) return answerError('invalid', 'The summary is empty. Say in a sentence or two what you did.');
    const items = (input.check ?? []).map((item) => item.replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (items.length > CARD_LIMITS.check) return answerError('invalid', `List at most ${CARD_LIMITS.check} things to check.`);
    const inTurn = this.isLocked(cardId);
    const at = this.now().toISOString();
    try {
      await this.store.mutate(cardId, inTurn ? null : { by: actor, what: `Reported: ${shortTitle(summary)}` }, (card) => ({
        ...card,
        result: {
          by: actor,
          at,
          summary: clip(summary, CARD_LIMITS.summary),
          files: card.result?.files ?? [],
          check: items.map((item) => clip(item, CARD_LIMITS.checkItem)),
        },
      }));
      return { ok: true, cardId };
    } catch (error) {
      return fromStoreError(error);
    }
  }

  /** ask_user: leave a decision on the card; the answer comes back as a turn. */
  async askUser(cardId: string, actor: BoardActor, input: { question: string; options: string[] }): Promise<BoardAnswer> {
    const question = input.question.replace(/\s+/g, ' ').trim();
    if (!question) return answerError('invalid', 'The question is empty.');
    if (question.length > CARD_LIMITS.question) return answerError('invalid', `A question can be at most ${CARD_LIMITS.question} characters.`);
    const options = input.options.map((option) => option.replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (options.length < CARD_LIMITS.optionsMin || options.length > CARD_LIMITS.optionsMax) {
      return answerError('invalid', `Give ${CARD_LIMITS.optionsMin} to ${CARD_LIMITS.optionsMax} options.`);
    }
    if (options.some((option) => option.length > CARD_LIMITS.option)) {
      return answerError('invalid', `Each option can be at most ${CARD_LIMITS.option} characters.`);
    }
    const at = this.now().toISOString();
    try {
      await this.store.mutate(cardId, { by: actor, what: `Asked: ${shortTitle(question)}` }, (card) => ({
        ...card,
        ask: { by: actor, at, question, options },
      }));
      return { ok: true, cardId };
    } catch (error) {
      return fromStoreError(error);
    }
  }

  async stop(cardId: string): Promise<BoardAnswer> {
    await this.ledger.stop(cardId);
    return { ok: true, cardId };
  }

  async openConversation(cardId: string): Promise<BoardAnswer> {
    const opened = await this.ledger.openConversation(cardId);
    return opened
      ? { ok: true, cardId }
      : answerError('no-conversation', "This card's conversation is not on this computer.");
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private async answerWith(card: Card, runtime: AgentId, choice: string): Promise<BoardAnswer> {
    if (this.isLocked(card.id)) return answerError('busy', 'The agent is still working on this card.');
    const gate = await this.availability(runtime);
    if (gate) return gate;
    try {
      await this.store.mutate(card.id, { by: 'you', what: `You chose: ${shortTitle(choice)}` }, (current) => {
        const next: Card = { ...current };
        delete next.ask;
        return next;
      });
    } catch (error) {
      return fromStoreError(error);
    }
    const fresh = (await this.store.get(card.id)) ?? card;
    return this.startTurn(fresh, runtime, { kind: 'answer', text: `I choose: ${choice}` }, null);
  }

  private async tryStart(
    cardId: string,
    runtimeId: AgentId,
    options: { force?: boolean; overLimit?: boolean; why: string | null },
  ): Promise<BoardAnswer> {
    const entries = await this.store.list();
    const card = this.cardOf(entries, cardId);
    if (!card) return answerError('not-found', 'That card is no longer on the board.');
    if (card.stage === 'done') return answerError('invalid', 'Reopen the card before giving it to an agent.');
    if (this.isLocked(cardId)) return answerError('busy', 'An agent is already working on this card.');
    const gate = await this.availability(runtimeId);
    if (gate) return gate;
    if (!options.force) {
      const conflict = this.findConflict(entries, card);
      if (conflict) {
        return {
          ok: false,
          code: 'conflict',
          message: `“${shortTitle(conflict.card.title)}” is working on ${conflict.file} right now. Two agents changing the same file can overwrite each other’s work.`,
          withCardId: conflict.card.id,
          withTitle: conflict.card.title,
          file: conflict.file,
        };
      }
    }
    if (!options.overLimit && card.stage !== 'doing') {
      const limit = this.wipLimit();
      const count = this.cardsIn(entries, 'doing').length;
      if (limit !== null && count >= limit) {
        return { ok: false, code: 'doing-full', message: `Doing is full: ${count} of ${limit}.`, count, limit };
      }
    }
    if (!(await this.ledger.canAttach(cardId))) {
      await this.ledger.wait(cardId, runtimeId, { kind: 'capacity' });
      this.scheduleRefresh();
      return { ok: true, cardId, waiting: { kind: 'capacity' } };
    }
    const what = options.why ?? `Gave it to ${RUNTIME_LABELS[runtimeId]}`;
    return this.startTurn(card, runtimeId, { kind: 'give' }, { by: 'you', what });
  }

  /** Move the card into Doing (with its history line), then start the turn. A
   *  turn that cannot start for lack of room in the AI sidebar waits. */
  private async startTurn(
    card: Card,
    runtimeId: AgentId,
    turn: { kind: StartTurn['kind']; text?: string },
    history: { by: BoardActor; what: string } | null,
  ): Promise<BoardAnswer> {
    if (this.starting.has(card.id)) return answerError('busy', 'An agent is already working on this card.');
    this.starting.add(card.id);
    try {
      return await this.startTurnOnce(card, runtimeId, turn, history);
    } finally {
      this.starting.delete(card.id);
    }
  }

  private async startTurnOnce(
    card: Card,
    runtimeId: AgentId,
    turn: { kind: StartTurn['kind']; text?: string },
    history: { by: BoardActor; what: string } | null,
  ): Promise<BoardAnswer> {
    let current = card;
    try {
      const rank = card.stage === 'doing' ? card.rank : await this.rankFor('doing', card.id, {});
      current = await this.store.mutate(card.id, history, (fresh) => ({
        ...fresh,
        stage: 'doing',
        rank: fresh.stage === 'doing' ? fresh.rank : rank ?? fresh.rank,
      }));
    } catch (error) {
      return fromStoreError(error);
    }
    const outcome = await this.ledger.start({ card: current, runtimeId, kind: turn.kind, ...(turn.text ? { text: turn.text } : {}) });
    if (outcome.ok) return { ok: true, cardId: card.id };
    if (outcome.code === 'capacity') {
      await this.ledger.wait(card.id, runtimeId, { kind: 'capacity' });
      this.scheduleRefresh();
      return { ok: true, cardId: card.id, waiting: { kind: 'capacity' } };
    }
    return answerError(
      outcome.code === 'failed' ? 'write-failed' : outcome.code,
      outcome.message,
    );
  }

  private async recordWait(cardId: string, runtimeId: AgentId, reason: WaitReason): Promise<BoardAnswer> {
    const card = await this.store.get(cardId);
    if (!card) return answerError('not-found', 'That card is no longer on the board.');
    if (this.isLocked(cardId)) return answerError('busy', 'An agent is already working on this card.');
    const gate = await this.availability(runtimeId);
    if (gate) return gate;
    await this.rememberRuntime(runtimeId);
    await this.ledger.wait(cardId, runtimeId, reason);
    this.scheduleRefresh();
    this.queueAuto(() => (reason.kind === 'slot' ? this.fillSlots() : Promise.resolve()));
    return { ok: true, cardId, waiting: reason };
  }

  private async availability(runtimeId: AgentId): Promise<BoardAnswer | null> {
    const availability = this.deps.checkRuntime
      ? await this.deps.checkRuntime(runtimeId)
      : this.deps.runtimes()[runtimeId];
    if (availability.usable) return null;
    return {
      ok: false,
      code: 'runtime-unavailable',
      message: messageForRuntimeAvailability(runtimeId, availability),
      recovery: recoveryForRuntimeAvailability(availability.state),
    };
  }

  /** Another card whose agent is at work now and names one of the same files. */
  private findConflict(entries: BoardEntry[], card: Card): { card: Card; file: string } | null {
    if (card.files.length === 0) return null;
    const handoffs = this.ledger.list();
    for (const entry of entries) {
      if (entry.kind !== 'card' || entry.card.id === card.id) continue;
      const handoff = handoffs.get(entry.card.id);
      if (!handoff || !ACTIVE_HANDOFF_STATES.has(handoff.state)) continue;
      const shared = card.files.find((file) => entry.card.files.includes(file));
      if (shared) return { card: entry.card, file: shared };
    }
    return null;
  }

  private isLocked(cardId: string): boolean {
    if (this.starting.has(cardId)) return true;
    const handoff = this.ledger.list().get(cardId);
    return Boolean(handoff && ACTIVE_HANDOFF_STATES.has(handoff.state));
  }

  private cardOf(entries: BoardEntry[], cardId: string): Card | null {
    for (const entry of entries) if (entry.kind === 'card' && entry.card.id === cardId) return entry.card;
    return null;
  }

  private cardsIn(entries: BoardEntry[], stage: CardStage): Card[] {
    return entries
      .flatMap((entry) => (entry.kind === 'card' && entry.card.stage === stage ? [entry.card] : []))
      .sort(compareCards);
  }

  private nextUpId(cards: Card[], handoffs: ReadonlyMap<string, CardHandoffView>): string | null {
    const todo = cards.filter((card) => card.stage === 'todo').sort(compareCards);
    // The top card that is ready to give: no agent work in flight or waiting,
    // and nothing on it waits on the user (a decision is a call, not Next up).
    const next = todo.find((card) => {
      const handoff = handoffs.get(card.id) ?? null;
      const who = deriveWho(card, handoff);
      return who.move !== 'agent' && who.call === null;
    });
    return next?.id ?? null;
  }

  /** The rank that puts `cardId` where asked in `stage`; spreads the stage once
   *  when hand-edited ranks leave no room. Null when `beforeCardId` is not in
   *  the stage. */
  private async rankFor(
    stage: CardStage,
    cardId: string,
    position: { beforeCardId?: string; atEnd?: boolean },
  ): Promise<string | null> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const others = this.cardsIn(await this.store.list(), stage).filter((card) => card.id !== cardId);
      let before: string | undefined;
      let after: string | undefined;
      if (position.beforeCardId) {
        const index = others.findIndex((card) => card.id === position.beforeCardId);
        if (index < 0) return null;
        before = others[index - 1]?.rank;
        after = others[index].rank;
      } else if (position.atEnd) {
        before = others[others.length - 1]?.rank;
      } else {
        after = others[0]?.rank;
      }
      const rank = rankBetween(before, after);
      if (rank !== null) return rank;
      if (attempt === 0) await this.store.rebalance(stage);
    }
    return null;
  }

  // ── Cards that start by themselves ─────────────────────────────────────────

  private queueAuto(work: () => Promise<void>): void {
    this.autoTail = this.autoTail.then(work, work).catch(() => undefined);
  }

  private async afterHandoffChange(cardId: string, next: HandoffState): Promise<void> {
    if (!TERMINAL_HANDOFF_STATES.has(next)) return;
    const handoffs = this.ledger.list();
    const entries = await this.store.list();
    const finished = this.cardOf(entries, cardId);
    for (const [waitingId, handoff] of handoffs) {
      if (handoff.state !== 'waiting') continue;
      if (handoff.waitFor?.kind === 'conflict' && handoff.waitFor.cardId === cardId) {
        await this.autoStart(waitingId, handoff.runtimeId, `Started after “${shortTitle(finished?.title ?? 'the other card')}” finished`);
      } else if (handoff.waitFor?.kind === 'capacity') {
        await this.autoStart(waitingId, handoff.runtimeId, 'Started when the AI sidebar had room');
      }
    }
    await this.fillSlots();
  }

  /** Any change to the cards: a card that left Doing frees a slot, and a card
   *  that went away frees the cards waiting for it. Both checks are cheap
   *  (the store serves a cache) and do nothing when nothing waits. */
  private async afterBoardChange(): Promise<void> {
    const entries = await this.store.list();
    const handoffs = this.ledger.list();
    for (const [waitingId, handoff] of handoffs) {
      if (handoff.state === 'waiting' && handoff.waitFor?.kind === 'conflict' && !this.cardOf(entries, handoff.waitFor.cardId)) {
        await this.autoStart(waitingId, handoff.runtimeId, 'Started: the card it waited for is gone');
      }
    }
    await this.fillSlots();
  }

  /** Start cards queued for a Doing slot, in To do order, while there is room. */
  private async fillSlots(): Promise<void> {
    for (;;) {
      const entries = await this.store.list();
      const limit = this.wipLimit();
      if (limit !== null && this.cardsIn(entries, 'doing').length >= limit) return;
      const handoffs = this.ledger.list();
      const queued = this.cardsIn(entries, 'todo').find((card) => {
        const handoff = handoffs.get(card.id);
        return handoff?.state === 'waiting' && handoff.waitFor?.kind === 'slot';
      });
      if (!queued) return;
      const before = handoffs.get(queued.id)!;
      await this.autoStart(queued.id, before.runtimeId, 'Started when Doing had room');
      const after = this.ledger.list().get(queued.id);
      // Still waiting for a slot means it could not start; stop rather than spin.
      if (after?.state === 'waiting' && after.waitFor?.kind === 'slot') return;
    }
  }

  /** Start a waiting card through the normal path (which re-checks conflicts
   *  and the Doing limit); if it must wait again, it waits for the new reason. */
  private async autoStart(cardId: string, runtimeId: AgentId, why: string): Promise<void> {
    const answer = await this.tryStart(cardId, runtimeId, { why });
    if (answer.ok) return;
    if (answer.code === 'conflict') {
      await this.ledger.wait(cardId, runtimeId, { kind: 'conflict', cardId: answer.withCardId });
    } else if (answer.code === 'doing-full') {
      await this.ledger.wait(cardId, runtimeId, { kind: 'slot' });
    } else if (answer.code === 'not-found') {
      await this.ledger.unwait(cardId);
    } else {
      // The agent is no longer ready, or the card is busy: leave the card in To
      // do with nothing pending, so the user sees it and decides.
      await this.ledger.unwait(cardId);
    }
    this.scheduleRefresh();
  }
}

