/**
 * Sprint 156 (#694, the review's findings 1, 2, 4–7 and 11): Home's sign-in from the card, end to end on the host,
 * with the AIs, ChatGPT's login poll and Claude's login faked and VS Code stubbed.
 *
 * - The card with no AI ready leads with ChatGPT, and Ask with is the host's every AI, in order, the lead included.
 * - A press signs in; the card waits; a sign-in that finishes settles the card into the ready request, makes that AI
 *   the AI for new chats and the last one ready, and sends nothing. It settles even when the AI's sheet restarted the
 *   login's poll (the real `CodexRuntime` poller) and when a finished login stopped the poll (status events only).
 * - Home's own give-up after 2 minutes shows the welcome's timeout line; the next press takes it away; Cancel puts the
 *   card back with no line; a ChatGPT already signed in is never asked to sign in again.
 * - Claude: a login that fails says "didn't finish", one that can't start says "couldn't start"; "Open the page
 *   again" with no page says so.
 * - With an AI ready, Ask with's sign-in leaves the ready request as it is; a failure line shows only on the card that
 *   names that AI.
 * - Round 2: a login Codex reports as failed says "didn't finish" at once, and a stopped poll puts the card back; a
 *   card naming a ready AI drops an old failure line for good; the sample's line shows only on the ready request;
 *   Cancel acts on the AI the card names; Home asks a running Claude login for the page it missed.
 * - PR B, the counts: `ai_signin_started` when Claude's login starts, ChatGPT's page opens or OpenCode's keys are saved,
 *   `from: 'home_card'` for the card's press and `'home_menu'` for Ask with; `ai_signin_finished` once, when that
 *   sign-in settles ready (OpenCode: when it reads ready after the save), whatever a later read says. A failure, a
 *   timeout and a Cancel send no finished; a declined "open the website?" and a login that can't start aren't starts;
 *   an AI already ready sends neither, and a sign-in made elsewhere isn't Home's. Only provider and from.
 *
 * Run: npx tsx src/guidance/GuidanceHost.test.ts
 */

import assert from 'node:assert/strict';
import * as fs from 'fs';
import Module from 'node:module';
import { mock } from 'node:test';
import * as os from 'os';
import * as path from 'path';

// ── VS Code, stubbed: what the host calls is recorded ──

class EventEmitter<T> {
  private listeners: Array<(value: T) => void> = [];
  event = (listener: (value: T) => void) => {
    this.listeners.push(listener);
    return { dispose: () => { this.listeners = this.listeners.filter((l) => l !== listener); } };
  };
  fire(value: T): void { for (const l of [...this.listeners]) l(value); }
  dispose(): void { this.listeners = []; }
}
const none = () => ({ dispose() {} });
const opened: string[] = [];
const commands: string[] = [];
const settings = new Map<string, unknown>();
let openWorks = true;
const vscodeStub = {
  EventEmitter,
  Uri: { parse: (value: string) => ({ toString: () => value }), file: (fsPath: string) => ({ fsPath, toString: () => `file://${fsPath}` }) },
  RelativePattern: class { constructor(public base: unknown, public pattern: string) {} },
  TabInputText: class {}, TabInputCustom: class {}, TabInputWebview: class {},
  ConfigurationTarget: { Global: 1 },
  StatusBarAlignment: { Left: 1, Right: 2 },
  workspace: {
    getConfiguration: (section: string) => ({
      get: (key: string, fallback?: unknown) => settings.get(`${section}.${key}`) ?? fallback,
      update: async (key: string, value: unknown) => { settings.set(`${section}.${key}`, value); },
    }),
    onDidSaveTextDocument: none,
    onDidChangeTextDocument: none,
    onDidChangeConfiguration: none,
    createFileSystemWatcher: () => ({ dispose() {}, onDidCreate: none, onDidDelete: none, onDidChange: none }),
    textDocuments: [],
  },
  window: {
    tabGroups: { onDidChangeTabs: none, onDidChangeTabGroups: none, activeTabGroup: { activeTab: undefined } },
    createStatusBarItem: () => ({ show() {}, hide() {}, dispose() {} }),
    showInformationMessage: async () => undefined,
    showWarningMessage: async () => undefined,
  },
  commands: { executeCommand: async (id: string) => { commands.push(id); }, registerCommand: none },
  env: { openExternal: async (uri: { toString(): string }) => { opened.push(uri.toString()); return openWorks; } },
  extensions: { getExtension: () => undefined },
};
// The usage counts the host hands to the consent gate, recorded (the gate's yes, no and holding: consent.test.ts)
const counts: Array<{ event: string; held: boolean } & Record<string, unknown>> = [];
const load = (Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown })._load;
(Module as unknown as { _load: unknown })._load = (request: string, ...rest: unknown[]) => {
  if (request === 'vscode') return vscodeStub;
  const loaded = load(request, ...rest);
  if (!/[\\/]analytics[\\/]posthog$/.test(request)) return loaded;
  return {
    ...(loaded as object),
    __esModule: true,
    trackEvent: async (event: string, properties: Record<string, unknown>) => { counts.push({ ...properties, event, held: false }); return false; },
    trackWelcomeEvent: async (event: string, properties: Record<string, unknown>) => { counts.push({ ...properties, event, held: true }); },
  };
};
/** The sign-in counts sent since the last look. */
const signInCounts = () => counts.splice(0).filter((count) => count.event.startsWith('ai_signin_'));
const started = (provider: string, from: string) => ({ event: 'ai_signin_started', provider, from, held: false });
const finished = (provider: string, from: string) => ({ event: 'ai_signin_finished', provider, from, held: false });

type Ai = 'claude-code' | 'codex' | 'opencode';
const flush = async () => { for (let i = 0; i < 12; i++) await new Promise((resolve) => setImmediate(resolve)); };

async function main(): Promise<void> {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1_000_000 });
  const { GuidanceHost } = await import('./GuidanceHost');
  const { CodexRuntime } = await import('../codex/CodexRuntime');
  const { emitCodexStatusInvalidated } = await import('../codex/codexStatusEvents');
  const { emitClaudeStatusInvalidated } = await import('../agent/claudeStatusEvents');
  const { readLastReadyAi, noteLastReadyAi } = await import('./guidanceStore');

  // The AIs: ready or not; OpenCode with no key
  const usable: Record<Ai, boolean> = { 'claude-code': false, codex: false, opencode: false };
  const availability = async (id: Ai) => ({
    state: usable[id] ? 'ready' as const : id === 'opencode' ? 'needs-configuration' as const : 'needs-auth' as const,
    usable: usable[id],
    detail: null,
  });

  // ChatGPT's login, the way the AI's sheet runs it (`UnifiedViewProvider.startCodexSignIn`), on the real poller
  const codex = new CodexRuntime();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (codex as any).getCodexSidebarStatus = async () => ({ state: usable.codex ? 'ready' : codex.isLoginInProgress() ? 'auth-in-progress' : 'needs-auth' });
  let codexStarts = 0;
  let codexStops = 0;
  const startCodexSignIn = async (onStatus: (state: string) => void, onEnd?: (end: 'ready' | 'failed' | 'gave-up' | 'stopped') => void) => {
    codexStarts += 1;
    codex.setLoginInProgress(true);
    codex.startLoginPolling(() => {});
    codex.listenToLoginPoll((next) => onStatus(next.state), onEnd);
    return 'https://auth.openai.com/sign-in';
  };
  // A poll that went quiet: no tick, no end, nobody told (what the AI sheet's restart used to leave behind)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quietPoll = () => { (codex as any)._clearLoginPoll(); (codex as any)._loginPollListeners.clear(); };
  const stopCodexSignIn = async () => {
    codexStops += 1;
    codex.stopLoginPolling();
    codex.setLoginInProgress(false);
  };

  // Claude's login, faked: each begin is recorded with its callbacks
  type ClaudeCalls = { onUrl?(url: string): void; onComplete?(): void; onError?(error: string): void; onTimeout?(): void; onCancel?(): void; replayUrl?: boolean };
  let claudeLogin: ClaudeCalls | null = null;
  let claudeBegin: (options: ClaudeCalls) => 'started' | 'already-running' | 'failed-to-start' = (options) => { claudeLogin = options; return 'started'; };
  const claudeSignIn = {
    setupStatus: async () => ({ runnable: true, binaryPath: '/bin/claude', authenticated: usable['claude-code'] }),
    begin: ((_path: string, options: ClaudeCalls) => claudeBegin(options)) as never,
    cancel: () => { const login = claudeLogin; claudeLogin = null; login?.onCancel?.(); return Boolean(login); },
  };

  const state = new Map<string, unknown>();
  const secrets = new Map<string, string>();
  const globalState = { get: <T>(key: string) => state.get(key) as T | undefined, update: async (key: string, value: unknown) => { state.set(key, value); } };
  const chats: unknown[] = [];
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-guidance-host-'));
  fs.writeFileSync(path.join(folder, 'Brief.docx'), 'x');
  const host = new GuidanceHost({
    context: {
      extension: { packageJSON: { version: '2.2.0' } },
      globalState,
      secrets: { onDidChange: none, get: async (key: string) => secrets.get(key), store: async (key: string, value: string) => { secrets.set(key, value); } },
      globalStorageUri: { fsPath: folder },
    } as never,
    folder: undefined,
    runtimeAvailability: availability as never,
    startChat: async (request) => { chats.push(request); },
    startCodexSignIn,
    stopCodexSignIn,
    give: async () => null,
    hasWorkingTurn: () => false,
    setStartingPlace: () => {},
    onTurnAccepted: none,
    onChatOrigin: none,
    claudeSignIn,
  });
  const input = {
    folderUri: `file://${folder}`, folderPath: folder, projectName: 'Training work', empty: false, whatMoved: false,
    foundBy: 'opened' as const, chatIndex: [], handoffs: [], skipAtRoot: new Set<string>(),
  };
  const card = async () => {
    const guidance = await host.homeGuidance(input);
    assert.ok(guidance && guidance.card === 'ready-request');
    return guidance;
  };
  const press = async () => { await host.pressReadyRequest(input); await flush(); };
  const TIMED_OUT = 'The sign-in page wasn’t finished in time. Sign in again when you’re ready.';

  // ── No AI ready: ChatGPT leads, and Ask with is the host's every AI in today's order, the lead included ──
  let shown = await card();
  assert.equal(shown.ai, 'codex');
  assert.equal(shown.aiName, 'ChatGPT');
  assert.equal(shown.aiReady, false);
  assert.equal(shown.button, 'Sign in with ChatGPT');
  assert.equal(shown.note, 'Any plan works, free included.');
  assert.equal(shown.signingIn, null);
  assert.deepEqual(shown.ais, [
    { id: 'claude-code', name: 'Claude', state: 'sign-in' },
    { id: 'codex', name: 'ChatGPT', state: 'sign-in' },
    { id: 'opencode', name: 'OpenCode', state: 'set-up' },
  ], 'Ask with is unchanged: every AI, the leading one too, each with its state (answer 5)');

  // ── Press → sign-in; the AI's sheet restarts the poll; the sign-in finishes; Home settles (finding 1) ──
  await press();
  assert.equal(codexStarts, 1, 'the press starts ChatGPT\'s sign-in');
  assert.deepEqual(opened, ['https://auth.openai.com/sign-in'], 'and opens its page');
  assert.deepEqual(signInCounts(), [started('chatgpt', 'home_card')], 'PR B: started once, from the card, with only provider and from');
  shown = await card();
  assert.equal(shown.signingIn, 'waiting', 'the card waits');
  assert.equal(shown.ais.find((ai) => ai.id === 'codex')?.state, 'signing-in');
  codex.startLoginPolling(() => {}); // the sheet's `login-started` listener restarts the poll with its own callback
  usable.codex = true;
  mock.timers.tick(2000);
  await flush();
  shown = await card();
  assert.equal(shown.aiReady, true, 'the poll\'s ready reaches Home through the sheet\'s restart');
  assert.equal(shown.ai, 'codex');
  assert.equal(shown.button, 'Ask ChatGPT what it can do here', 'the same card is the ready request');
  assert.equal(shown.signingIn, null);
  assert.equal(settings.get('ritemark.ai.selectedAgent'), 'codex', 'answer 8: the AI for new chats');
  assert.equal(readLastReadyAi(globalState), 'codex', 'and the AI last seen ready');
  assert.deepEqual(chats, [], 'nothing is sent until the person presses the request');
  assert.deepEqual(signInCounts(), [finished('chatgpt', 'home_card')], 'PR B: finished once, when ChatGPT reads ready');

  // ── A login that finished stops the poll: Home settles from the status event alone ──
  usable.codex = false;
  settings.delete('ritemark.ai.selectedAgent');
  emitCodexStatusInvalidated('logout');
  await flush();
  await press();
  assert.equal(codexStarts, 2);
  quietPoll();
  usable.codex = true;
  emitCodexStatusInvalidated('login-finished');
  await flush();
  shown = await card();
  assert.equal(shown.aiReady, true, 'the status event settles Home\'s sign-in, as the welcome\'s recheck does');
  assert.equal(settings.get('ritemark.ai.selectedAgent'), 'codex');
  assert.deepEqual(chats, []);
  assert.deepEqual(signInCounts(), [started('chatgpt', 'home_card'), finished('chatgpt', 'home_card')], 'PR B: a status event\'s ready finishes it too');
  emitCodexStatusInvalidated('login-finished');
  await flush();
  assert.deepEqual(signInCounts(), [], 'PR B: exactly once: a later status event finishes nothing');

  // ── Home's own give-up: the welcome's 2 minutes and its timeout line; the next press takes it away ──
  usable.codex = false;
  emitCodexStatusInvalidated('logout');
  await flush();
  await press();
  quietPoll(); // a poll that will never say so
  mock.timers.tick(120_000);
  await flush();
  shown = await card();
  assert.equal(shown.signingIn, null, 'given up after 2 minutes');
  assert.equal(shown.button, 'Sign in with ChatGPT', 'back as it was');
  assert.equal(shown.problem, TIMED_OUT, 'with the welcome\'s reason on the problem line');
  assert.deepEqual(signInCounts(), [started('chatgpt', 'home_card')], 'PR B: a timeout sends no finished');
  await press();
  shown = await card();
  assert.equal(shown.signingIn, 'waiting', 'pressing again is the retry');
  assert.equal(shown.problem, null, 'the press takes the line away (the Experience lead, f85e188)');
  assert.deepEqual(signInCounts(), [started('chatgpt', 'home_card')], 'PR B: the retry is a sign-in of its own');

  // ── Round 2, N6: a login Codex reports as failed (`loginComplete` false) says "didn't finish" at once ──
  await host.cancelSignIn();
  await flush();
  await press();
  assert.equal((await card()).signingIn, 'waiting');
  codex.stopLoginPolling('failed'); // what `loginComplete` with success false does
  await flush();
  shown = await card();
  assert.equal(shown.signingIn, null, 'no 2-minute wait');
  assert.equal(shown.problem, 'The sign-in to ChatGPT didn’t finish. Sign in again when you’re ready.');
  assert.deepEqual(signInCounts(), [started('chatgpt', 'home_card')], 'PR B: Cancel, then a failed login: no finished for either');
  // A poll stopped elsewhere (a sign-out on the AI's sheet): back as it was, with no line
  await press();
  codex.stopLoginPolling();
  await flush();
  shown = await card();
  assert.equal(shown.signingIn, null, 'a stopped poll never leaves the card on "Signing in…"');
  assert.equal(shown.problem, null);
  await press();
  assert.equal((await card()).signingIn, 'waiting', 'the card shows the sign-in its Cancel stops');

  // ── Cancel: back as it was, with no line ──
  const stopsBefore = codexStops;
  await host.cancelSignIn();
  await flush();
  shown = await card();
  assert.equal(codexStops, stopsBefore + 1, 'Cancel stops ChatGPT\'s login');
  assert.equal(shown.signingIn, null);
  assert.equal(shown.problem, null);
  assert.deepEqual(signInCounts(), [started('chatgpt', 'home_card'), started('chatgpt', 'home_card')], 'PR B: a poll stopped elsewhere and a Cancel: no finished');

  // ── "Open the website?" declined: back as it was, with no line ──
  openWorks = false;
  await press();
  openWorks = true;
  shown = await card();
  assert.equal(shown.signingIn, null);
  assert.equal(shown.problem, null);
  assert.deepEqual(signInCounts(), [], 'PR B: a declined "open the website?" isn\'t a start, so it sends neither (#690)');

  // ── ChatGPT signed in elsewhere, with the card's AIs not read again yet: the press doesn't start a second sign-in ──
  await card(); // reads the AIs: ChatGPT signs in
  usable.codex = true; // signed in on the AI's sheet, no event yet
  const startsBefore = codexStarts;
  await press();
  assert.equal(codexStarts, startsBefore, 'the readiness check before ChatGPT\'s login');
  shown = await card();
  assert.equal(shown.aiReady, true);
  assert.deepEqual(chats, []);
  assert.deepEqual(signInCounts(), [], 'PR B: an AI found ready before anything started sends neither count');

  // ── Claude, lapsed, leads; a failed login and one that can't start ──
  usable.codex = false;
  await noteLastReadyAi(globalState, 'claude-code');
  emitCodexStatusInvalidated('logout');
  await flush();
  shown = await card();
  assert.equal(shown.ai, 'claude-code', 'the last ready AI, lapsed, leads');
  assert.equal(shown.button, 'Sign in with Claude');
  await press();
  shown = await card();
  assert.equal(shown.signingIn, 'waiting');
  assert.equal((claudeLogin as ClaudeCalls | null)?.replayUrl, true, 'Home asks a running login for the page it missed (round 2, N4)');
  assert.deepEqual(signInCounts(), [started('claude', 'home_card')], 'PR B: Claude\'s login started');
  // "Open the page again" before Claude's CLI printed its page: never silent (finding 6)
  await host.reopenSignIn();
  shown = await card();
  assert.equal(shown.problem, 'Claude’s sign-in page didn’t open. Cancel, then sign in again.');
  (claudeLogin as ClaudeCalls | null)?.onUrl?.('https://claude.com/cai/oauth/authorize?x=1');
  await host.reopenSignIn();
  assert.equal(opened[opened.length - 1], 'https://claude.com/cai/oauth/authorize?x=1', 'with its page, it opens it again');
  shown = await card();
  assert.equal(shown.problem, null);
  (claudeLogin as ClaudeCalls | null)?.onError?.('exit 1');
  await flush();
  shown = await card();
  assert.equal(shown.problem, 'The sign-in to Claude didn’t finish. Sign in again when you’re ready.');
  claudeBegin = (options) => { options.onError?.('spawn failed'); return 'failed-to-start'; };
  await press();
  shown = await card();
  assert.equal(shown.problem, 'Claude’s sign-in couldn’t start. Try again in a moment.', 'the specific reason wins (finding 5)');
  assert.deepEqual(signInCounts(), [], 'PR B: a failed login sends no finished, and a login that can\'t start no started');
  claudeBegin = (options) => { claudeLogin = options; return 'started'; };

  // ── A failure line belongs to the card that names that AI (finding 2) ──
  usable['claude-code'] = true; // Claude signed in elsewhere
  emitClaudeStatusInvalidated('login-finished');
  await flush();
  shown = await card();
  assert.equal(shown.aiReady, true);
  assert.equal(shown.ai, 'claude-code');
  assert.equal(shown.problem, null, 'no old failure under the ready request');
  assert.deepEqual(signInCounts(), [], 'PR B: a sign-in made elsewhere isn\'t Home\'s to count');

  // ── With an AI ready, Ask with's sign-in leaves the ready request as it is (finding 4) ──
  await host.signIn(input.folderUri, 'codex', 'home_menu');
  await flush();
  assert.deepEqual(signInCounts(), [started('chatgpt', 'home_menu')], 'PR B: Ask with\'s sign-in is from the menu');
  shown = await card();
  assert.equal(shown.aiReady, true, 'the ready request stays usable');
  assert.equal(shown.ai, 'claude-code');
  assert.equal(shown.signingIn, null);
  assert.equal(shown.ais.find((ai) => ai.id === 'codex')?.state, 'signing-in', 'Ask with shows it signing in, as before');
  codex.stopLoginPolling();
  await flush();

  // ── Round 2, N1: a card naming a ready AI drops an old failure line; it doesn't come back with no new try ──
  usable['claude-code'] = false;
  await noteLastReadyAi(globalState, 'codex');
  emitClaudeStatusInvalidated('logout');
  await flush();
  await press(); // ChatGPT leads
  codex.stopLoginPolling('failed');
  await flush();
  assert.equal((await card()).problem, 'The sign-in to ChatGPT didn’t finish. Sign in again when you’re ready.');
  usable.opencode = true; // another AI becomes ready
  emitCodexStatusInvalidated('status-refresh');
  await flush();
  shown = await card();
  assert.equal(shown.aiReady, true);
  assert.equal(shown.problem, null);
  usable.opencode = false; // and not ready again
  emitCodexStatusInvalidated('status-refresh');
  await flush();
  shown = await card();
  assert.equal(shown.ai, 'codex');
  assert.equal(shown.problem, null, 'the old line doesn\'t return without a new try');

  // ── Round 2, N2: the sample's line belongs to the ready request; a sign-in start clears it ──
  const sample = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-guidance-sample-'));
  fs.mkdirSync(path.join(sample, '.ritemark', 'tasks'), { recursive: true });
  fs.writeFileSync(path.join(sample, '.ritemark', 'tasks', 'm4d7r2.md'), '---\nstage: todo\n---\nDraft Module 4\n');
  fs.writeFileSync(path.join(sample, 'Brief.md'), 'x');
  const sampleInput = { ...input, folderUri: `file://${sample}`, folderPath: sample, projectName: 'Leadership programme' };
  const sampleCard = async () => {
    const guidance = await host.homeGuidance(sampleInput);
    assert.ok(guidance && guidance.card === 'ready-request');
    return guidance;
  };
  usable['claude-code'] = true;
  emitClaudeStatusInvalidated('login-finished');
  await flush();
  await host.pressReadyRequest(sampleInput); // no board in this window: the hand-over can't start
  await flush();
  shown = await sampleCard();
  assert.equal(shown.kind, 'sample');
  assert.match(shown.problem ?? '', /task board is not open/, 'the sample\'s line on its ready request');
  usable['claude-code'] = false;
  emitClaudeStatusInvalidated('logout');
  await flush();
  shown = await sampleCard();
  assert.equal(shown.aiReady, false);
  assert.equal(shown.problem, null, 'not on the card that signs in');
  await host.pressReadyRequest(sampleInput);
  await flush();
  shown = await sampleCard();
  assert.equal(shown.signingIn, 'waiting');
  assert.equal(shown.problem, null, 'and not under "Signing in…"');
  codex.stopLoginPolling();
  await flush();
  usable['claude-code'] = true;
  emitClaudeStatusInvalidated('login-finished');
  await flush();
  assert.equal((await sampleCard()).problem, null, 'the sign-in\'s start cleared it');
  fs.rmSync(sample, { recursive: true, force: true });

  // ── Round 2, N3: with two sign-ins running, Cancel acts on the AI the card names ──
  usable.opencode = true; // an AI ready: Ask with's sign-ins run beside the ready request
  usable['claude-code'] = false;
  emitClaudeStatusInvalidated('logout');
  await flush();
  claudeLogin = null;
  await host.signIn(input.folderUri, 'claude-code', 'home_menu'); // started first
  await host.signIn(input.folderUri, 'codex', 'home_menu');
  await flush();
  usable.opencode = false; // no AI ready now: the card names ChatGPT, the lead, waiting
  emitCodexStatusInvalidated('status-refresh');
  await flush();
  shown = await card();
  assert.equal(shown.ai, 'codex');
  assert.equal(shown.signingIn, 'waiting');
  const stops = codexStops;
  await host.cancelSignIn();
  await flush();
  assert.equal(codexStops, stops + 1, 'Cancel stopped ChatGPT\'s sign-in, the one the card named');
  assert.ok(claudeLogin, 'and left Claude\'s running');
  shown = await card();
  assert.equal(shown.ai, 'claude-code', 'the card now names the sign-in still running');
  assert.equal(shown.signingIn, 'waiting');
  await host.cancelSignIn();
  await flush();
  assert.equal(claudeLogin, null, 'Cancel on that card stops Claude\'s');
  assert.deepEqual(signInCounts().filter((count) => count.event === 'ai_signin_finished'), [], 'PR B: none of those finished');

  // ── PR B: Ask with's sign-in that finishes: once, from the menu ──
  await host.signIn(input.folderUri, 'claude-code', 'home_menu');
  await flush();
  assert.deepEqual(signInCounts(), [started('claude', 'home_menu')]);
  usable['claude-code'] = true;
  (claudeLogin as ClaudeCalls | null)?.onComplete?.();
  emitClaudeStatusInvalidated('login-finished'); // the login's own status event, right after
  await flush();
  assert.equal((await card()).aiReady, true);
  assert.deepEqual(signInCounts(), [finished('claude', 'home_menu')], 'finished once, though the callback and the status event both said so');

  // ── PR B: finished follows the sign-in's own ready, not a later read of the AI ──
  usable['claude-code'] = false;
  emitClaudeStatusInvalidated('logout');
  await flush();
  signInCounts();
  await host.signIn(input.folderUri, 'claude-code', 'home_card');
  await flush();
  assert.deepEqual(signInCounts(), [started('claude', 'home_card')]);
  (claudeLogin as ClaudeCalls | null)?.onComplete?.(); // the login says it finished; Claude doesn't read usable yet
  await flush();
  assert.deepEqual(signInCounts(), [finished('claude', 'home_card')], 'finished on the login\'s ready settle');
  assert.equal((await card()).aiReady, false, 'though the card waits for Claude to read ready');

  // ── PR B: OpenCode is set up, not signed in: its keys saved from Home are the start ──
  usable['claude-code'] = false;
  emitClaudeStatusInvalidated('logout');
  await flush();
  signInCounts();
  assert.deepEqual(await host.saveKeys(input.folderUri, { 'openai-api-key': '  ' }, 'home_card'), { ok: false, message: 'Add at least one key to use OpenCode.' });
  assert.deepEqual(signInCounts(), [], 'a Save with no key starts nothing');
  await host.saveKeys(input.folderUri, { 'openrouter-api-key': 'test-key-value' }, 'home_menu');
  assert.deepEqual(signInCounts(), [started('opencode', 'home_menu')], 'saved, and OpenCode not ready: started, never finished');
  usable.opencode = true;
  await host.saveKeys(input.folderUri, { 'openrouter-api-key': 'test-key-value' }, 'home_card');
  assert.deepEqual(signInCounts(), [started('opencode', 'home_card'), finished('opencode', 'home_card')], 'saved from the card\'s Set up OpenCode, and ready');
  assert.deepEqual(await host.saveKeys(input.folderUri, {}, 'home_card'), { ok: true, message: null }, 'a Save with the keys already there is taken');
  assert.deepEqual(signInCounts(), [], 'but it stored no key, so it starts nothing and finishes nothing');
  assert.ok(counts.every((count) => !count.held), 'Home\'s counts are never held: they go only after a yes');

  assert.deepEqual(chats, [], 'no sign-in ever sent a message');
  host.dispose();
  mock.timers.reset();
  fs.rmSync(folder, { recursive: true, force: true });
  console.log('GuidanceHost.test.ts: all assertions passed');
}

main().then(() => process.exit(0), (error) => {
  console.error(error);
  process.exit(1);
});
