/**
 * The first day's guidance in one window (Sprint 140; experience 35, 29 and
 * 34): Home's one guidance card (What moved, the ready request or the feedback
 * card), the ready request's Ask with, its sign-ins and its press, the empty
 * sheet's starting place, the saved days, and the day-one counts.
 *
 * Everything it remembers is in this computer's global state
 * (`guidanceStore.ts`), never in the project's folder (E2). The rules are pure
 * modules beside it; this file wires them to VS Code, the AI's sheet and the
 * board.
 */

import { promises as fsp } from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { AgentId } from '../agent/types';
import { beginClaudeLogin } from '../agent/claudeLogin';
import { getSetupStatus } from '../agent/setup';
import { trackEvent } from '../analytics/posthog';
import type { WelcomeProvider } from '../analytics/events';
import { normalizeProjectUri, resolveProjectScope } from '../conversations/projectScope';
import { FEEDBACK_COPY } from '../feedback/feedbackCopy';
import { sendWeekLine, showBriefToast } from '../feedback/feedbackSheet';
import { composeReport, narrowReportContext, REPORT_RECIPIENT, reportSubject } from '../reporting/composeReport';
import { openReportMail } from '../reporting/reportTransport';
import type { HomeAi, HomeGuidance, HomeKeyName } from '../projects/protocol';
import type { ChatIndexEntry } from '../projects/waiting';
import type { RuntimeAvailability } from '../runtime/availability';
import type { CardHandoffRecordV1 } from '../taskBoard/CardTaskStore';
import type { AcceptedTurn, ChatOrigin, ChatStartRequest } from '../views/UnifiedViewProvider';
import { countsLine, listFileNames } from './folderCounts';
import { feedbackDue, guidanceCard, localDay } from './guidanceState';
import { GuidanceStore } from './guidanceStore';
import { madeSomething } from './madeSomething';
import { AI_NAMES, AI_ORDER, cardAi, READY_REQUEST_CURSOR_EMPTY, READY_REQUEST_TEXT, readyGoneNow, readyKindOf, readyRequestDue, readyRequestWords, SAMPLE_CARD_ID, type AiState, type ReadyKind } from './readyRequest';
import { startingPlaceOf, wordCount, type FrontEditor } from './startingPlace';

const PROVIDER: Record<AgentId, WelcomeProvider> = { 'claude-code': 'claude', codex: 'chatgpt', opencode: 'opencode' };
const KEY_NAMES: readonly HomeKeyName[] = ['google-ai-key', 'openai-api-key', 'anthropic-api-key', 'openrouter-api-key'];
const AI_CACHE_MS = 15_000;
const SKIP_DIRS = /[\\/](\.git|node_modules|\.ritemark)[\\/]/;

export interface GuidanceDependencies {
  context: vscode.ExtensionContext;
  folder: vscode.WorkspaceFolder | undefined;
  runtimeAvailability(runtimeId: AgentId): Promise<RuntimeAvailability>;
  startChat(request: ChatStartRequest): Promise<void>;
  startCodexSignIn(onStatus: (state: string) => void): Promise<string | null>;
  stopCodexSignIn(): Promise<void>;
  /** The board's Give, for the sample's card; null without a board. */
  give(cardId: string, runtimeId: AgentId): Promise<{ ok: boolean; message?: string } | null>;
  hasWorkingTurn(): boolean;
  setStartingPlace(place: string, hasAbout: boolean): void;
  onTurnAccepted(listener: (turn: AcceptedTurn) => void): vscode.Disposable;
  onChatOrigin(listener: (origin: ChatOrigin) => void): vscode.Disposable;
}

/** What Home's host read for its own state, passed in so nothing is read twice. */
export interface HomeGuidanceInput {
  folderUri: string;
  folderPath: string;
  projectName: string;
  empty: boolean;
  whatMoved: boolean;
  foundBy: 'opened' | 'recent' | 'chats' | null;
  chatIndex: ChatIndexEntry[] | undefined;
  handoffs: readonly CardHandoffRecordV1[];
  /** Root-level files the counts leave out: Ritemark's pointer CLAUDE.md. */
  skipAtRoot: ReadonlySet<string>;
}

export class GuidanceHost implements vscode.Disposable {
  private readonly store: GuidanceStore;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly changed = new vscode.EventEmitter<void>();
  /** Fires when Home's card may have changed: a sign-in, a press, a send. */
  readonly onDidChange = this.changed.event;
  private readonly origins = new Map<string, ChatOrigin>();
  private readonly signingIn = new Set<AgentId>();
  private aiCache: { at: number; states: Partial<Record<AgentId, AiState>> } | null = null;
  private readyProblem: string | null = null;
  private feedback: { sending: boolean; problem: string | null } = { sending: false, problem: null };
  private placeTimer: ReturnType<typeof setTimeout> | undefined;
  /** The counts line per folder, listed once and listed again only after a file is created or deleted there (QA). */
  private readonly counts = new Map<string, Promise<string>>();

  constructor(private readonly deps: GuidanceDependencies) {
    const version = String(deps.context.extension.packageJSON.version ?? '0.0.0');
    this.store = new GuidanceStore(deps.context.globalState, version);
    madeSomething.setSink((how, afterReadyRequest) => {
      void trackEvent('made_something', { how, after_ready_request: afterReadyRequest });
    });
    this.disposables.push(
      deps.onTurnAccepted((turn) => void this.turnAccepted(turn)),
      deps.onChatOrigin((origin) => this.origins.set(origin.conversationId, origin)),
      // R14: a day with a saved document; R15: a new document's first save
      vscode.workspace.onDidSaveTextDocument((document) => {
        if (document.uri.scheme !== 'file') return;
        void this.store.noteSavedDay(localDay(new Date()));
        madeSomething.noteSaved(document.uri.fsPath);
      }),
      vscode.window.tabGroups.onDidChangeTabs(() => this.schedulePlace()),
      vscode.window.tabGroups.onDidChangeTabGroups(() => this.schedulePlace()),
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document === this.frontDocument()) this.schedulePlace(600);
      }),
    );
    if (deps.folder) {
      // R15: a file the AI wrote during a turn in this window is something made; a sync client's file is not.
      const files = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(deps.folder, '**/*'));
      this.disposables.push(files, files.onDidCreate((uri) => {
        if (SKIP_DIRS.test(uri.fsPath) || path.basename(uri.fsPath).startsWith('.')) return;
        this.counts.clear();
        if (deps.hasWorkingTurn()) madeSomething.note('new_document');
        this.schedulePlace();
      }), files.onDidDelete(() => {
        this.counts.clear();
        this.schedulePlace();
      }));
    }
    this.schedulePlace(0);
  }

  // ── Home's card (R2–R6, R14) ─────────────────────────────────────────────

  async homeGuidance(input: HomeGuidanceInput): Promise<HomeGuidance | null> {
    // Home redraws on board changes too: the sample's starting points follow its card (experience 35, The build checked)
    this.schedulePlace();
    const key = normalizeProjectUri(input.folderUri);
    let record = this.store.project(key);
    const sample = await isSample(input.folderPath);
    const kind = readyKindOf({ empty: input.empty, sample });
    const scopeId = resolveProjectScope({ folderUris: [input.folderUri] }).scopeId;
    const taskChats = new Set(input.handoffs.flatMap((handoff) => (handoff.conversationId ? [handoff.conversationId] : [])));
    const ownChats = (input.chatIndex ?? []).filter((entry) => entry.scopeId === scopeId && entry.conversationId !== record.chatId && !taskChats.has(entry.conversationId)).length;
    if (input.foundBy === 'opened' && !record.gone) {
      const gone = readyGoneNow({
        kind,
        ownChats,
        requestAnswered: record.chatId ? await this.answered(record.chatId) : false,
        // The sample's card goes when its task shows in Doing (experience 35, The build checked): it left To do
        sampleLeftToDo: kind === 'sample' && !(await sampleCardWaits(input.folderPath)),
      });
      if (gone) record = await this.store.updateProject(key, (current) => ({ ...current, gone }));
    }
    const today = localDay(new Date());
    const release = this.store.release();
    const card = guidanceCard({
      whatMoved: input.whatMoved,
      readyRequest: readyRequestDue({ foundBy: input.foundBy, record, ownChats }),
      feedback: feedbackDue({ savedDays: release.savedDays, answered: release.feedback !== undefined }) || this.feedback.sending || this.feedback.problem !== null,
      today,
      readyShownOn: this.store.read().readyShownOn,
    });
    if (card === 'what-moved') return { card };
    if (card === 'feedback') {
      return { card, heading: FEEDBACK_COPY.card.heading, lede: FEEDBACK_COPY.card.lede, placeholder: FEEDBACK_COPY.card.placeholder, sending: this.feedback.sending, problem: this.feedback.problem };
    }
    if (card !== 'ready-request') return null;
    await this.store.noteReadyShown(today);
    const states = await this.aiStates();
    const chosen = cardAi({ chosen: record.ai, sheetAi: sheetAi(), states });
    const counts = kind === 'files' ? await this.countsOf(input.folderPath, input.skipAtRoot) : null;
    const words = readyRequestWords(kind, AI_NAMES[chosen.ai], input.projectName, counts);
    const ais: HomeAi[] = AI_ORDER.filter((id) => states[id] !== undefined).map((id) => ({ id, name: AI_NAMES[id], state: states[id]! }));
    return {
      card,
      kind,
      ...words,
      ai: chosen.ai,
      aiReady: chosen.ready,
      ais,
      keysSet: await this.keysSet(),
      problem: this.readyProblem,
    };
  }

  /** The card's main part (R5): a new chat in front, sent or filled; the sample's card through the board's Give. */
  async pressReadyRequest(input: HomeGuidanceInput): Promise<void> {
    const key = normalizeProjectUri(input.folderUri);
    const record = this.store.project(key);
    const kind: ReadyKind = readyKindOf({ empty: input.empty, sample: await isSample(input.folderPath) });
    const states = await this.aiStates();
    const chosen = cardAi({ chosen: record.ai, sheetAi: sheetAi(), states });
    if (!chosen.ready) return; // Ask with opens instead (D3), on the page
    this.readyProblem = null;
    const provider = PROVIDER[chosen.ai];
    if (kind === 'sample') {
      const answer = await this.deps.give(SAMPLE_CARD_ID, chosen.ai);
      if (!answer?.ok) {
        this.readyProblem = answer?.message ?? 'The task board is not open in this window, so Ritemark could not hand the task over.';
        this.changed.fire();
        return;
      }
      madeSomething.noteReadyRequestUsed();
      void trackEvent('ready_request_used', { kind: 'module_4', provider });
      this.changed.fire();
      return;
    }
    if (kind === 'files') {
      madeSomething.noteReadyRequestUsed();
      void trackEvent('ready_request_used', { kind: 'what_is_here', provider });
      await this.deps.startChat({ runtimeId: chosen.ai, text: READY_REQUEST_TEXT.files, send: true, origin: 'what_is_here' });
      return;
    }
    // The empty project's request waits for the person's words; it counts when they send it (R15).
    await this.deps.startChat({ runtimeId: chosen.ai, text: READY_REQUEST_TEXT.empty, cursor: READY_REQUEST_CURSOR_EMPTY, send: false, origin: 'what_for' });
  }

  async chooseAi(folderUri: string, ai: AgentId): Promise<void> {
    const states = await this.aiStates();
    if (states[ai] !== 'ready') return;
    await this.store.updateProject(normalizeProjectUri(folderUri), (record) => ({ ...record, ai }));
    this.changed.fire();
  }

  async hide(folderUri: string): Promise<void> {
    await this.store.updateProject(normalizeProjectUri(folderUri), (record) => ({ ...record, gone: 'hidden' }));
    this.changed.fire();
  }

  /** Sign in (Claude, ChatGPT) through the welcome's own entry points; the AI is chosen once it is ready (R4). */
  async signIn(folderUri: string, ai: AgentId): Promise<void> {
    if (this.signingIn.has(ai)) return;
    const done = (ready: boolean) => {
      this.signingIn.delete(ai);
      this.aiCache = null;
      if (ready) void this.chooseAi(folderUri, ai);
      this.changed.fire();
    };
    if (ai === 'claude-code') {
      const status = await getSetupStatus({ refresh: true });
      if (!status.runnable || !status.binaryPath) {
        await vscode.commands.executeCommand('ritemark.aiSettings');
        return;
      }
      if (status.authenticated) return done(true);
      this.signingIn.add(ai);
      this.changed.fire();
      const started = beginClaudeLogin(status.binaryPath, {
        onComplete: () => done(true),
        onError: () => done(false),
        onTimeout: () => done(false),
        onCancel: () => done(false),
      });
      if (started === 'failed-to-start') done(false);
      return;
    }
    if (ai === 'codex') {
      this.signingIn.add(ai);
      this.changed.fire();
      try {
        const page = await this.deps.startCodexSignIn((state) => {
          if (!this.signingIn.has('codex')) return;
          if (state === 'ready') done(true);
          else if (state === 'needs-auth') done(false);
        });
        if (!page) {
          done(false);
          await vscode.commands.executeCommand('ritemark.aiSettings');
          return;
        }
        if (!(await vscode.env.openExternal(vscode.Uri.parse(page)))) {
          await this.deps.stopCodexSignIn();
          done(false);
        }
      } catch {
        done(false);
      }
      return;
    }
    // OpenCode's Set up is the welcome's small sheet, drawn on Home; a missing or broken install goes to Settings.
    await vscode.commands.executeCommand('ritemark.aiSettings');
  }

  /** OpenCode's keys from the shared sheet: stored as the welcome and Settings store them (secrets only). */
  async saveKeys(folderUri: string, keys: Partial<Record<HomeKeyName, string>>): Promise<{ ok: boolean; message: string | null }> {
    const entries = Object.entries(keys).map(([name, value]) => [name, (value ?? '').trim()] as const).filter(([, value]) => value);
    if (entries.length === 0 && !Object.values(await this.keysSet()).some(Boolean)) return { ok: false, message: 'Add at least one key to use OpenCode.' };
    for (const [name, value] of entries) await this.deps.context.secrets.store(name, value);
    this.aiCache = null;
    const availability = await this.deps.runtimeAvailability('opencode').catch(() => null);
    if (availability?.usable) await this.chooseAi(folderUri, 'opencode');
    this.changed.fire();
    return { ok: true, message: null };
  }

  // ── The feedback card (R14) ──────────────────────────────────────────────

  async sendFeedbackLine(text: string): Promise<void> {
    this.feedback = { sending: true, problem: null };
    this.changed.fire();
    const sent = await sendWeekLine(text).catch(() => false);
    if (sent) {
      await this.store.answerFeedback('sent');
      this.feedback = { sending: false, problem: null };
      void showBriefToast(FEEDBACK_COPY.toast.accepted);
    } else {
      this.feedback = { sending: false, problem: FEEDBACK_COPY.card.failed };
    }
    this.changed.fire();
  }

  /** The card's line, after a send that did not go, handed to the person's own e-mail app (R13's e-mail route). */
  async mailFeedbackLine(text: string): Promise<void> {
    const context = narrowReportContext({ appVersion: this.store.version, platform: process.platform, occurredAt: new Date().toISOString() });
    const outcome = await openReportMail(
      { recipient: REPORT_RECIPIENT, subject: reportSubject(context, 'feedback'), body: composeReport(context, text) },
      { openExternal: (url) => vscode.env.openExternal(vscode.Uri.parse(url, true)) },
    );
    if (outcome !== 'opened') {
      this.feedback = { sending: false, problem: outcome === 'too-long' ? FEEDBACK_COPY.handoff.tooLong.lede : FEEDBACK_COPY.handoff.noHandler.lede };
      this.changed.fire();
      return;
    }
    // Handed over: the question has its answer for this release; the mail is the person's to send.
    await this.store.answerFeedback('sent');
    this.feedback = { sending: false, problem: null };
    void showBriefToast(`${FEEDBACK_COPY.handoff.opened.title}. ${FEEDBACK_COPY.handoff.opened.message}`);
    this.changed.fire();
  }

  async feedbackNotNow(): Promise<void> {
    await this.store.answerFeedback('not-now');
    this.feedback = { sending: false, problem: null };
    this.changed.fire();
  }

  // ── Turns and origins (R6, R15) ──────────────────────────────────────────

  private async turnAccepted(turn: AcceptedTurn): Promise<void> {
    const origin = this.origins.get(turn.clientConversationId);
    if (!origin || turn.fromTask) {
      this.changed.fire();
      return;
    }
    this.origins.delete(turn.clientConversationId);
    const provider = PROVIDER[turn.runtimeId];
    if (origin.readyRequest && this.deps.folder) {
      await this.store.updateProject(normalizeProjectUri(this.deps.folder.uri.toString()), (record) => ({ ...record, chatId: turn.conversationId }));
      if (origin.readyRequest === 'what_for') {
        madeSomething.noteReadyRequestUsed();
        void trackEvent('ready_request_used', { kind: 'what_for', provider });
      }
    }
    if (origin.startingPoint) {
      void trackEvent('starting_point_used', {
        place: origin.startingPoint.place,
        edited: turn.text.trim() !== origin.startingPoint.text.trim(),
        provider,
      });
    }
    this.changed.fire();
  }

  // ── The empty sheet's starting place (R8) ────────────────────────────────

  private schedulePlace(delay = 150): void {
    if (this.placeTimer) clearTimeout(this.placeTimer);
    this.placeTimer = setTimeout(() => {
      this.placeTimer = undefined;
      void this.pushPlace();
    }, delay);
  }

  private frontDocument(): vscode.TextDocument | undefined {
    const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
    const uri = input instanceof vscode.TabInputText || input instanceof vscode.TabInputCustom ? input.uri : undefined;
    return uri ? vscode.workspace.textDocuments.find((document) => document.uri.toString() === uri.toString()) : undefined;
  }

  private frontEditor(): FrontEditor | null {
    const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
    const input = tab?.input;
    if (!tab || !input) return null;
    // Home and the Task board are the project itself: nothing open (R8)
    if (input instanceof vscode.TabInputWebview && /ritemark\.(home|taskBoard)$/.test(input.viewType)) return null;
    if (input instanceof vscode.TabInputCustom || input instanceof vscode.TabInputText) {
      const document = this.frontDocument();
      return {
        viewType: input instanceof vscode.TabInputCustom ? input.viewType : undefined,
        fileName: path.basename(input.uri.fsPath),
        ...(document ? { words: wordCount(document.getText()) } : {}),
      };
    }
    return { viewType: 'other', fileName: tab.label };
  }

  private async pushPlace(): Promise<void> {
    const folder = this.deps.folder;
    if (!folder) return;
    const root = folder.uri.fsPath;
    const [sample, listed, hasAbout] = await Promise.all([
      sampleCardWaits(root),
      listFileNames(root, { limit: 0 }),
      fsp.access(path.join(root, 'AGENTS.md')).then(() => true, () => false),
    ]);
    const kind = readyKindOf({ empty: listed.names.length === 0, sample });
    this.deps.setStartingPlace(startingPlaceOf(this.frontEditor(), kind), hasAbout);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async aiStates(): Promise<Partial<Record<AgentId, AiState>>> {
    if (this.aiCache && Date.now() - this.aiCache.at < AI_CACHE_MS && this.signingIn.size === 0) return this.aiCache.states;
    const states: Partial<Record<AgentId, AiState>> = {};
    await Promise.all(AI_ORDER.map(async (id) => {
      const availability = await this.deps.runtimeAvailability(id).catch(() => null);
      if (!availability || availability.state === 'disabled') return;
      states[id] = availability.usable ? 'ready'
        : this.signingIn.has(id) || availability.state === 'auth-in-progress' ? 'signing-in'
        : availability.state === 'checking' ? 'checking'
        : id === 'opencode' || availability.state !== 'needs-auth' ? 'set-up'
        : 'sign-in';
    }));
    this.aiCache = { at: Date.now(), states };
    return states;
  }

  private async keysSet(): Promise<Record<HomeKeyName, boolean>> {
    const entries = await Promise.all(KEY_NAMES.map(async (name) => [name, Boolean(await this.deps.context.secrets.get(name))] as const));
    return Object.fromEntries(entries) as Record<HomeKeyName, boolean>;
  }

  /** The request's chat has a completed answer: the AI's reply finished, neither refused nor failed (R6). */
  private async answered(conversationId: string): Promise<boolean> {
    const file = path.join(this.deps.context.globalStorageUri.fsPath, 'conversations', 'v1', 'records', `${conversationId}.json`);
    try {
      const record = JSON.parse(await fsp.readFile(file, 'utf8')) as { events?: Array<{ kind?: string; terminalStatus?: string }> };
      return (record.events ?? []).some((event) => event.kind === 'assistant-message' && event.terminalStatus === 'completed');
    } catch {
      return false;
    }
  }

  /**
   * The counts line, from names alone (never a file's contents, never a fetch of an online-only file), listed once
   * per folder and kept until the folder's watcher sees a file created or deleted, so a large synced folder is not
   * walked on every Home redraw.
   */
  private countsOf(root: string, skipAtRoot: ReadonlySet<string>): Promise<string> {
    const key = `${root}\n${[...skipAtRoot].sort().join('\n')}`;
    let line = this.counts.get(key);
    if (!line) {
      line = listFileNames(root, { skipAtRoot }).then((listed) => countsLine(listed.names, listed.more));
      line.catch(() => this.counts.delete(key));
      this.counts.set(key, line);
    }
    return line;
  }

  dispose(): void {
    if (this.placeTimer) clearTimeout(this.placeTimer);
    madeSomething.setSink(null);
    this.changed.dispose();
    this.disposables.forEach((disposable) => disposable.dispose());
  }
}

/** The sample: the project holding the sample's card `m4d7r2` (R3); read by name, never opened. */
async function isSample(folderPath: string): Promise<boolean> {
  try {
    const names = await fsp.readdir(path.join(folderPath, '.ritemark', 'tasks'));
    return names.some((name) => name === `${SAMPLE_CARD_ID}.md` || name.startsWith(`${SAMPLE_CARD_ID}-`));
  } catch {
    return false;
  }
}

/**
 * The sample's starting points while its card `m4d7r2` still waits in To do; once it has run (Doing, Review, Done),
 * the sample is a project like any other (experience 35, The build checked, 26 October). Read from the card's
 * front matter only.
 */
async function sampleCardWaits(folderPath: string): Promise<boolean> {
  try {
    const dir = path.join(folderPath, '.ritemark', 'tasks');
    const name = (await fsp.readdir(dir)).find((entry) => entry === `${SAMPLE_CARD_ID}.md` || entry.startsWith(`${SAMPLE_CARD_ID}-`));
    if (!name) return false;
    const head = (await fsp.readFile(path.join(dir, name), 'utf8')).slice(0, 2048);
    return /^stage:\s*['"]?todo['"]?\s*$/m.test(head);
  } catch {
    return false;
  }
}

/** The AI the sheet uses for new chats (R4). */
function sheetAi(): AgentId | undefined {
  const value = vscode.workspace.getConfiguration('ritemark.ai').get<string>('selectedAgent');
  return value === 'claude-code' || value === 'codex' || value === 'opencode' ? value : undefined;
}
