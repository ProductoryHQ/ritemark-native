/**
 * The first day's guidance in one window (Sprint 140; experience 35, 29 and
 * 34): Home's one guidance card (What moved, the ready request or the feedback
 * card), the ready request's Ask with, its sign-ins and its press, the empty
 * sheet's starting place, the saved days, and the day-one counts.
 *
 * Sprint 156 (experience 35, "With no AI ready"): with no AI ready the card's
 * press signs in, through the welcome's own flows, and the card waits while it
 * runs (the welcome's frame 2 in the card's parts). Home redraws when Claude's
 * or ChatGPT's status or a key changes, so a sign-in made on the AI's sheet or
 * in Settings shows here too.
 *
 * Everything it remembers is in this computer's global state
 * (`guidanceStore.ts`), never in the project's folder (E2). The rules are pure
 * modules beside it; this file wires them to VS Code, the AI's sheet and the
 * board.
 */

import { promises as fsp } from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { AgentId, SetupStatus } from '../agent/types';
import { beginClaudeLogin, cancelClaudeLogin } from '../agent/claudeLogin';
import { onClaudeStatusInvalidated } from '../agent/claudeStatusEvents';
import { getSetupStatus } from '../agent/setup';
import { onCodexStatusInvalidated, waitForCodexSignIn, type CodexSignInWait, type LoginPollEnd } from '../codex/codexStatusEvents';
import { trackEvent } from '../analytics/posthog';
import type { SignInFrom, WelcomeProvider } from '../analytics/events';
import { normalizeProjectUri, resolveProjectScope } from '../conversations/projectScope';
import { FEEDBACK_COPY } from '../feedback/feedbackCopy';
import { sendWeekLine, showBriefToast } from '../feedback/feedbackSheet';
import { composeReport, narrowReportContext, REPORT_RECIPIENT, reportSubject } from '../reporting/composeReport';
import { openReportMail } from '../reporting/reportTransport';
import type { HomeAi, HomeGuidance, HomeKeyName } from '../projects/protocol';
import type { ChatIndexEntry } from '../projects/waiting';
import type { RuntimeAvailability } from '../runtime/availability';
import type { CardHandoffRecordV1 } from '../taskBoard/CardTaskStore';
import { readAgentRuntimePreference } from '../utils/bundledAgentRuntime';
import type { AcceptedTurn, ChatOrigin, ChatStartRequest } from '../views/UnifiedViewProvider';
import { saveAiForNewChats } from '../welcome/welcomeHost';
import { homeReopenNotOpened, signInProblem, type SignInProblem } from '../welcome/words';
import { countsLine, listFileNames } from './folderCounts';
import { feedbackDue, guidanceCard, localDay } from './guidanceState';
import { GuidanceStore, noteLastReadyAi, readLastReadyAi, seedLastReadyAiForTest } from './guidanceStore';
import { madeSomething } from './madeSomething';
import { AI_NAMES, AI_ORDER, canSignInHere, cardAi, READY_REQUEST_CURSOR_EMPTY, READY_REQUEST_TEXT, readyGoneNow, readyKindOf, readyPressAction, readyRequestDue, readyRequestWords, SAMPLE_CARD_ID, type AiState, type ReadyKind, type ReadyRecord } from './readyRequest';
import { startingPlaceOf, wordCount, type FrontEditor } from './startingPlace';

const PROVIDER: Record<AgentId, WelcomeProvider> = { 'claude-code': 'claude', codex: 'chatgpt', opencode: 'opencode' };
const KEY_NAMES: readonly HomeKeyName[] = ['google-ai-key', 'openai-api-key', 'anthropic-api-key', 'openrouter-api-key'];
const AI_CACHE_MS = 15_000;
const SKIP_DIRS = /[\\/](\.git|node_modules|\.ritemark)[\\/]/;

/** How Home's sign-in ended: ready, stopped by the person (no line), or one of the welcome's reasons. */
type SignInOutcome = 'ready' | 'stopped' | SignInProblem;

/** Sprint 156 (PR B): a sign-in's two counts: its AI, where on Home it was pressed, and whether it has started. */
interface SignInCount {
  ai: AgentId;
  /** The card's main part (`home_card`) or Ask with (`home_menu`). */
  from: SignInFrom;
  /**
   * `ai_signin_started` was sent: Claude's login started, ChatGPT's page opened, or OpenCode's keys were saved. Only then
   * does the sign-in's ready send `ai_signin_finished`; an AI found ready before anything started sends neither.
   */
  started: boolean;
}

/** Sprint 156: a sign-in Home runs (one per AI), and how it settles. */
interface HomeSignIn extends SignInCount {
  /** `starting` until its page is open (ChatGPT: after VS Code's "open the website?" question), then `waiting`. */
  phase: 'starting' | 'waiting';
  settle(outcome: SignInOutcome): void;
  /** ChatGPT: the wait the welcome shares (`waitForCodexSignIn`), with Home's own give-up after 2 minutes. */
  wait?: CodexSignInWait;
}

/** The welcome's Claude sign-in, as Home uses it; a test passes its own. */
export interface ClaudeSignIn {
  setupStatus(): Promise<Pick<SetupStatus, 'runnable' | 'binaryPath' | 'authenticated'>>;
  begin: typeof beginClaudeLogin;
  cancel: typeof cancelClaudeLogin;
}

const CLAUDE_SIGN_IN: ClaudeSignIn = {
  setupStatus: () => getSetupStatus({ refresh: true }),
  begin: beginClaudeLogin,
  cancel: cancelClaudeLogin,
};

export interface GuidanceDependencies {
  context: vscode.ExtensionContext;
  folder: vscode.WorkspaceFolder | undefined;
  runtimeAvailability(runtimeId: AgentId): Promise<RuntimeAvailability>;
  startChat(request: ChatStartRequest): Promise<void>;
  startCodexSignIn(onStatus: (state: string) => void, onEnd?: (end: LoginPollEnd) => void): Promise<string | null>;
  stopCodexSignIn(): Promise<void>;
  /** The board's Give, for the sample's card; null without a board. */
  give(cardId: string, runtimeId: AgentId): Promise<{ ok: boolean; message?: string } | null>;
  hasWorkingTurn(): boolean;
  setStartingPlace(place: string, hasAbout: boolean): void;
  onTurnAccepted(listener: (turn: AcceptedTurn) => void): vscode.Disposable;
  onChatOrigin(listener: (origin: ChatOrigin) => void): vscode.Disposable;
  /** Sprint 142 (R5b): open a chat on the AI's sheet by its id. */
  openConversation?(conversationId: string): Promise<void>;
  /** Sprint 156: Claude's sign-in, the welcome's own functions unless a test passes its own. */
  claudeSignIn?: ClaudeSignIn;
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
  /** Sprint 156: the sign-ins running from Home (the card's press or Ask with), by AI. */
  private readonly signings = new Map<AgentId, HomeSignIn>();
  /** Each AI's sign-in page, kept for "Open the page again", as the welcome keeps it. */
  private readonly signInPages: Partial<Record<AgentId, string>> = {};
  /** Sprint 156: "Open the page again" had no page to open, or it didn't open: the welcome's line, while it waits. */
  private reopenProblem: string | null = null;
  /** Sprint 156: the AI the card last named while it waited, so its Cancel and "Open the page again" act on that one. */
  private cardSigningAi: AgentId | null = null;
  private aiCache: { at: number; states: Partial<Record<AgentId, AiState>> } | null = null;
  private readyProblem: string | null = null;
  /**
   * Sprint 156: why Home's last sign-in to an AI ended (the welcome's reason). On the card's problem line while the card
   * names that AI and asks it to sign in; the next press, or a sign-in that makes it ready, takes it away (the Experience
   * lead, ritemark-dev f85e188).
   */
  private signInFailure: { ai: AgentId; line: string } | null = null;
  /** Sprint 142 (R5b): when the folder's request was last sent from Home. */
  private filesPressedAt: number | null = null;
  private feedback: { sending: boolean; problem: string | null } = { sending: false, problem: null };
  private placeTimer: ReturnType<typeof setTimeout> | undefined;
  /** The counts line per folder, listed once and listed again only after a file is created or deleted there (QA). */
  private readonly counts = new Map<string, Promise<string>>();

  constructor(private readonly deps: GuidanceDependencies) {
    const version = String(deps.context.extension.packageJSON.version ?? '0.0.0');
    this.store = new GuidanceStore(deps.context.globalState, version);
    // Sprint 156: a test launch can stage a lapsed sign-in (test channel only; no effect anywhere else)
    void seedLastReadyAiForTest(deps.context.globalState);
    // Sprint 156: a sign-in or sign-out anywhere (the AI's sheet, Settings, a terminal) or an AI's key saved: Home's
    // card reads the AIs again, so it never offers a second sign-in. A sign-in Home runs settles here too when its AI
    // reads usable, as the welcome's recheck does: the login's poll can be restarted by the AI's sheet, and a finished
    // ChatGPT login stops it, so the poll alone can't be relied on (#694)
    const statusChanged = (ai: AgentId) => (event: { reason: string }) => {
      this.aiCache = null;
      if (event.reason !== 'login-started') void this.settleIfReady(ai, event.reason === 'login-finished');
      this.changed.fire();
    };
    const offClaude = onClaudeStatusInvalidated(statusChanged('claude-code'));
    const offCodex = onCodexStatusInvalidated(statusChanged('codex'));
    this.disposables.push({ dispose: offClaude }, { dispose: offCodex }, deps.context.secrets.onDidChange((event) => {
      if (!KEY_NAMES.includes(event.key as HomeKeyName)) return;
      this.aiCache = null;
      this.changed.fire();
    }));
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
    const chosen = this.cardAiOf(record, states);
    // The card waits only for a sign-in to the AI it names, with no AI ready (answer 1); with one ready it stays usable
    const signing = chosen.ready ? undefined : this.signings.get(chosen.ai);
    this.cardSigningAi = signing ? chosen.ai : null;
    // A failure line belongs to the card that asks an AI to sign in; a card naming a ready AI has no use for it, and it
    // doesn't come back if that AI stops being ready (round 2, N1)
    if (chosen.ready) this.signInFailure = null;
    const counts = kind === 'files' ? await this.countsOf(input.folderPath, input.skipAtRoot) : null;
    const words = readyRequestWords(kind, AI_NAMES[chosen.ai], input.projectName, counts, chosen.ready);
    // Ask with keeps every AI in today's order, the leading one too, each with its state (the Experience lead, answer 5)
    const ais: HomeAi[] = AI_ORDER.filter((id) => states[id] !== undefined).map((id) => ({ id, name: AI_NAMES[id], state: states[id]! }));
    return {
      card,
      kind,
      ...words,
      ai: chosen.ai,
      aiName: AI_NAMES[chosen.ai],
      aiReady: chosen.ready,
      signingIn: signing?.phase ?? null,
      ais,
      keysSet: await this.keysSet(),
      // The sample's hand-over line belongs to the ready request; a card that signs in shows only its sign-in's line
      problem: chosen.ready ? this.readyProblem
        : signing ? (signing.phase === 'waiting' ? this.reopenProblem : null)
        : this.signInFailure?.ai === chosen.ai ? this.signInFailure.line : null,
    };
  }

  /**
   * The AI the card names (R4): `cardAi`, which with no AI ready is the AI the card signs in to (Sprint 156,
   * `leadAi`); with no AI ready and Home signing in to one (the card's press or Ask with), that one.
   */
  private cardAiOf(record: ReadyRecord, states: Partial<Record<AgentId, AiState>>): { ai: AgentId; ready: boolean } {
    const named = cardAi({
      chosen: record.ai,
      sheetAi: sheetAi(),
      states,
      lastReady: readLastReadyAi(this.deps.context.globalState),
      canSignIn: canSignInHere(states, readAgentRuntimePreference()),
    });
    if (named.ready) return named;
    const signing = this.signings.has(named.ai) ? named.ai : this.signings.keys().next().value;
    return signing ? { ai: signing, ready: false } : named;
  }

  /**
   * The card's main part (R5): a new chat in front, sent or filled; the sample's card through the board's Give.
   * Sprint 156: with no AI ready it signs in to the card's AI, through the welcome's own flows; when that finishes the
   * same card is the ready request, and nothing is sent until it is pressed again.
   */
  async pressReadyRequest(input: HomeGuidanceInput): Promise<void> {
    const key = normalizeProjectUri(input.folderUri);
    const record = this.store.project(key);
    const kind: ReadyKind = readyKindOf({ empty: input.empty, sample: await isSample(input.folderPath) });
    const states = await this.aiStates();
    const chosen = this.cardAiOf(record, states);
    // The press is the retry: the last failure's line goes with it, and comes back only if this try fails too
    this.signInFailure = null;
    if (!chosen.ready) {
      // OpenCode's Set up opens its key sheet on the page, as Ask with does; a press that reaches here goes to Settings
      await this.signIn(input.folderUri, chosen.ai, 'home_card');
      return;
    }
    this.readyProblem = null;
    const provider = PROVIDER[chosen.ai];
    // Sprint 142 (R5b): a second press opens the chat the first one started; the button is never disabled for it
    const press = readyPressAction({
      kind,
      sentChat: kind === 'files' && record.chatId ? { id: record.chatId, answered: await this.answered(record.chatId) } : null,
      sinceLastPressMs: this.filesPressedAt === null ? null : Date.now() - this.filesPressedAt,
      pendingChat: kind === 'files' ? this.newestOrigin('what_is_here') : null,
      filledChat: this.newestOrigin('what_for'),
    });
    if (press.action === 'open') {
      await this.deps.openConversation?.(press.conversationId);
      return;
    }
    if (press.action === 'reveal') {
      // QA N5: the chat the first press sent comes forward on the AI's sheet, its box focused; nothing is sent again.
      // The sheet reopens a chat by its own id and writes nothing into it without `fill`.
      if (press.conversationId) await this.deps.startChat({ runtimeId: chosen.ai, text: '', send: false, conversationId: press.conversationId });
      else await vscode.commands.executeCommand('ritemark.unifiedView.focus');
      return;
    }
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
      this.filesPressedAt = Date.now();
      madeSomething.noteReadyRequestUsed();
      void trackEvent('ready_request_used', { kind: 'what_is_here', provider });
      await this.deps.startChat({ runtimeId: chosen.ai, text: READY_REQUEST_TEXT.files, send: true, origin: 'what_is_here' });
      return;
    }
    // The empty project's request waits for the person's words; it counts when they send it (R15). A second press
    // opens the same chat, putting the request back only into an empty box (Sprint 142, R5b).
    const reopen = press.action === 'fill' ? press.conversationId : null;
    await this.deps.startChat({
      runtimeId: chosen.ai,
      text: READY_REQUEST_TEXT.empty,
      cursor: READY_REQUEST_CURSOR_EMPTY,
      send: false,
      origin: 'what_for',
      ...(reopen ? { conversationId: reopen, fill: 'if-empty' as const } : {}),
    });
  }

  /** Sprint 142 (R5b): the sheet's own id of the newest chat this ready request filled and that hasn't been sent. */
  private newestOrigin(readyRequest: 'what_is_here' | 'what_for'): string | null {
    let newest: string | null = null;
    for (const origin of this.origins.values()) if (origin.readyRequest === readyRequest) newest = origin.conversationId;
    return newest;
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

  /**
   * Sign in (Claude, ChatGPT) through the welcome's own entry points; the AI is chosen once it is ready (R4).
   * Sprint 156: one sign-in per AI, from the card's press or Ask with. With no AI ready the card waits while it runs;
   * Cancel, or a declined "open the website?", puts it back as it was; a failure or a timeout puts it back with the
   * welcome's reason on its problem line, and pressing again retries. It settles from the login's own callbacks, from
   * the AI's status events when the AI reads usable, or from Home's own give-up timer, whichever comes first.
   * Sprint 156 (PR B): `from` says where it was pressed (the card's main part, or Ask with) for its two counts.
   */
  async signIn(folderUri: string, ai: AgentId, from: SignInFrom): Promise<void> {
    if (ai === 'opencode') {
      // OpenCode's Set up is the welcome's small sheet, drawn on Home; a missing or broken install goes to Settings.
      await vscode.commands.executeCommand('ritemark.aiSettings');
      return;
    }
    if (this.signings.has(ai)) return;
    const signing: HomeSignIn = {
      ai,
      from,
      started: false,
      phase: 'starting',
      settle: (outcome) => {
        if (this.signings.get(ai) !== signing) return;
        this.signings.delete(ai);
        signing.wait?.cancel();
        this.reopenProblem = null;
        this.aiCache = null;
        if (outcome === 'ready') {
          // Sprint 156 (PR B): the sign-in settled ready, once (this settle runs once): its finish, if it started
          this.countFinished(signing);
          void this.readyFromHome(folderUri, ai);
          return;
        }
        if (outcome !== 'stopped') this.signInFailure = { ai, line: signInProblem(PROVIDER[ai], outcome) };
        this.changed.fire();
      },
    };
    this.signings.set(ai, signing);
    // A new try: the last failure's line goes with it (the Experience lead, f85e188), and the sample's, as before
    this.signInFailure = null;
    this.readyProblem = null;
    this.reopenProblem = null;
    delete this.signInPages[ai];
    this.changed.fire();
    const current = () => this.signings.get(ai) === signing;
    const toSettings = async () => {
      signing.settle('stopped');
      await vscode.commands.executeCommand('ritemark.aiSettings');
    };
    if (ai === 'claude-code') {
      const claude = this.deps.claudeSignIn ?? CLAUDE_SIGN_IN;
      const status = await claude.setupStatus().catch(() => null);
      if (!current()) return;
      if (!status?.runnable || !status.binaryPath) return toSettings();
      if (status.authenticated) return signing.settle('ready');
      // Claude's own CLI opens the browser: the card waits at once, as the welcome's does
      signing.phase = 'waiting';
      this.changed.fire();
      // A login that can't start reports its error before it returns: that is "couldn't start", not "didn't finish"
      let launching = true;
      const started = claude.begin(status.binaryPath, {
        // Joining a login already running (Settings', the sheet's), Home asks for the page it missed
        replayUrl: true,
        onUrl: (url) => { this.signInPages[ai] = url; },
        onComplete: () => signing.settle('ready'),
        onError: () => { if (!launching) signing.settle('failed'); },
        onTimeout: () => signing.settle('timed-out'),
        onCancel: () => signing.settle('stopped'),
      });
      launching = false;
      if (started === 'failed-to-start') return signing.settle('could-not-start');
      // Claude's login has started (or Home joined one already running): the sign-in counts as started
      this.countStarted(signing);
      return;
    }
    try {
      // Signed in already (on the AI's sheet, in Settings, in another window): nothing to start, the card just redraws
      const availability = await this.deps.runtimeAvailability('codex').catch(() => null);
      if (!current()) return;
      if (availability?.usable) return signing.settle('ready');
      // The welcome's wait, shared: the poll's ready, its end (a failed login says "didn't finish" at once, round 2 N6;
      // the give-up; a stop), or Home's own give-up after 2 minutes for a poll the sheet restarted
      const wait = waitForCodexSignIn((outcome) => signing.settle(outcome));
      signing.wait = wait;
      const page = await this.deps.startCodexSignIn(wait.onStatus, wait.onEnd);
      if (!current()) return;
      if (!page) return toSettings();
      this.signInPages[ai] = page;
      wait.arm();
      if (!(await vscode.env.openExternal(vscode.Uri.parse(page)))) {
        // The "open the website?" question was answered with Cancel, or nothing could open the page: stop Codex's
        // listener, and the card is back as it was, with no line (the Experience lead, answer 2). Not a start (#690)
        if (!current()) return;
        await this.deps.stopCodexSignIn().catch(() => undefined);
        return signing.settle('stopped');
      }
      // A sign-in that ended while the question was open (ready elsewhere, a sign-out) isn't Home's: neither count
      if (!current()) return;
      // ChatGPT's page opened: the sign-in counts as started
      this.countStarted(signing);
      signing.phase = 'waiting';
      this.changed.fire();
    } catch {
      signing.settle('could-not-start');
    }
  }

  /**
   * Sprint 156 (#694): a sign-in Home runs is ready once its AI reads usable, however the news came. Right after a
   * ChatGPT login finishes its runtime restarts, so a read that misses it is made once more.
   */
  private async settleIfReady(ai: AgentId, readAgain: boolean): Promise<void> {
    const signing = this.signings.get(ai);
    if (!signing) return;
    const usable = async () => (await this.deps.runtimeAvailability(ai).catch(() => null))?.usable === true;
    if (await usable()) return signing.settle('ready');
    if (!readAgain) return;
    setTimeout(() => {
      void (async () => {
        if (this.signings.get(ai) === signing && await usable()) signing.settle('ready');
      })();
    }, 1500);
  }

  /** Sprint 156 (PR B): a sign-in from Home has really started: `ai_signin_started`, with where it was pressed. */
  private countStarted(count: SignInCount): void {
    count.started = true;
    void trackEvent('ai_signin_started', { provider: PROVIDER[count.ai], from: count.from });
  }

  /** Sprint 156 (PR B): a sign-in from Home ended ready: `ai_signin_finished`, only when it sent its start. */
  private countFinished(count: SignInCount): void {
    if (!count.started) return;
    void trackEvent('ai_signin_finished', { provider: PROVIDER[count.ai], from: count.from });
  }

  /** The sign-in the card shows: the one to the AI it names (round 2, N3). */
  private cardSigning(): HomeSignIn | undefined {
    return this.cardSigningAi ? this.signings.get(this.cardSigningAi) : undefined;
  }

  /** Sprint 156: the card's Cancel stops waiting, as the welcome's does; the card is back as it was, with no line. */
  async cancelSignIn(): Promise<void> {
    const signing = this.cardSigning();
    if (!signing) return;
    if (signing.ai === 'claude-code') {
      if (!(this.deps.claudeSignIn ?? CLAUDE_SIGN_IN).cancel()) signing.settle('stopped');
      return;
    }
    await this.deps.stopCodexSignIn().catch(() => undefined);
    signing.settle('stopped');
  }

  /**
   * Sprint 156: "Open the page again" opens the sign-in's page again, as the welcome's does. Never silent (#694): with
   * no page to open, or a page that didn't open, the welcome's line says so under the row.
   */
  async reopenSignIn(): Promise<void> {
    const signing = this.cardSigning();
    if (!signing) return;
    const page = this.signInPages[signing.ai];
    const opened = page ? await Promise.resolve(vscode.env.openExternal(vscode.Uri.parse(page))).catch(() => false) : false;
    if (this.cardSigning() !== signing) return;
    this.reopenProblem = opened ? null : homeReopenNotOpened(PROVIDER[signing.ai]);
    this.changed.fire();
  }

  /**
   * Sprint 156: an AI made ready from Home is chosen on the card (R4), is the AI last seen ready, and becomes the AI
   * for new chats, as the welcome's choice does, so the status bar names it; a chat that is open keeps its AI (the
   * Experience lead, answer 8). Any failure line has done its job. Says whether the AI read ready (OpenCode's finish).
   */
  private async readyFromHome(folderUri: string, ai: AgentId): Promise<boolean> {
    this.signInFailure = null;
    this.aiCache = null;
    let states = await this.aiStates();
    if (states[ai] !== 'ready' && ai === 'codex') {
      // A ChatGPT login that just finished restarts its runtime; read once more before giving up on it
      await new Promise((resolve) => setTimeout(resolve, 1500));
      this.aiCache = null;
      states = await this.aiStates();
    }
    const ready = states[ai] === 'ready';
    if (ready) {
      await noteLastReadyAi(this.deps.context.globalState, ai);
      await saveAiForNewChats(ai);
      await this.chooseAi(folderUri, ai);
    }
    this.changed.fire();
    return ready;
  }

  /**
   * OpenCode's keys from the shared sheet: stored as the welcome and Settings store them (secrets only). Sprint 156
   * (PR B): `from` is where the sheet was opened, the card's main part (Set up OpenCode leading) or Ask with.
   */
  async saveKeys(folderUri: string, keys: Partial<Record<HomeKeyName, string>>, from: SignInFrom): Promise<{ ok: boolean; message: string | null }> {
    const entries = Object.entries(keys).map(([name, value]) => [name, (value ?? '').trim()] as const).filter(([, value]) => value);
    if (entries.length === 0 && !Object.values(await this.keysSet()).some(Boolean)) return { ok: false, message: 'Add at least one key to use OpenCode.' };
    for (const [name, value] of entries) await this.deps.context.secrets.store(name, value);
    // OpenCode is set up, not signed in: keys saved from Home are its sign-in's start (a Save that stored none isn't),
    // and OpenCode reading ready after the save is its finish (it has no login to settle)
    const count: SignInCount = { ai: 'opencode', from, started: false };
    if (entries.length > 0) this.countStarted(count);
    // OpenCode set up from Home is ready from Home, as a sign-in is (Sprint 156)
    if (await this.readyFromHome(folderUri, 'opencode')) this.countFinished(count);
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
    if (this.aiCache && Date.now() - this.aiCache.at < AI_CACHE_MS && this.signings.size === 0) return this.aiCache.states;
    const states: Partial<Record<AgentId, AiState>> = {};
    await Promise.all(AI_ORDER.map(async (id) => {
      const availability = await this.deps.runtimeAvailability(id).catch(() => null);
      if (!availability || availability.state === 'disabled') return;
      states[id] = availability.usable ? 'ready'
        : this.signings.has(id) || availability.state === 'auth-in-progress' ? 'signing-in'
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
    for (const signing of this.signings.values()) signing.wait?.cancel();
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
