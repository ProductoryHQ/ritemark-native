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
const load = (Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown })._load;
(Module as unknown as { _load: unknown })._load = (request: string, ...rest: unknown[]) => (request === 'vscode' ? vscodeStub : load(request, ...rest));

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
  const startCodexSignIn = async (onStatus: (state: string) => void) => {
    codexStarts += 1;
    codex.setLoginInProgress(true);
    codex.startLoginPolling(() => {});
    codex.listenToLoginPoll((next) => onStatus(next.state));
    return 'https://auth.openai.com/sign-in';
  };
  const stopCodexSignIn = async () => {
    codexStops += 1;
    codex.stopLoginPolling();
    codex.setLoginInProgress(false);
  };

  // Claude's login, faked: each begin is recorded with its callbacks
  type ClaudeCalls = { onUrl?(url: string): void; onComplete?(): void; onError?(error: string): void; onTimeout?(): void; onCancel?(): void };
  let claudeLogin: ClaudeCalls | null = null;
  let claudeBegin: (options: ClaudeCalls) => 'started' | 'already-running' | 'failed-to-start' = (options) => { claudeLogin = options; return 'started'; };
  const claudeSignIn = {
    setupStatus: async () => ({ runnable: true, binaryPath: '/bin/claude', authenticated: usable['claude-code'] }),
    begin: ((_path: string, options: ClaudeCalls) => claudeBegin(options)) as never,
    cancel: () => { const login = claudeLogin; claudeLogin = null; login?.onCancel?.(); return Boolean(login); },
  };

  const state = new Map<string, unknown>();
  const globalState = { get: <T>(key: string) => state.get(key) as T | undefined, update: async (key: string, value: unknown) => { state.set(key, value); } };
  const chats: unknown[] = [];
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-guidance-host-'));
  fs.writeFileSync(path.join(folder, 'Brief.docx'), 'x');
  const host = new GuidanceHost({
    context: {
      extension: { packageJSON: { version: '2.2.0' } },
      globalState,
      secrets: { onDidChange: none, get: async () => undefined, store: async () => undefined },
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

  // ── A login that finished stops the poll: Home settles from the status event alone ──
  usable.codex = false;
  settings.delete('ritemark.ai.selectedAgent');
  emitCodexStatusInvalidated('logout');
  await flush();
  await press();
  assert.equal(codexStarts, 2);
  codex.stopLoginPolling(); // `loginComplete`: the poll stops, no callback runs
  usable.codex = true;
  emitCodexStatusInvalidated('login-finished');
  await flush();
  shown = await card();
  assert.equal(shown.aiReady, true, 'the status event settles Home\'s sign-in, as the welcome\'s recheck does');
  assert.equal(settings.get('ritemark.ai.selectedAgent'), 'codex');
  assert.deepEqual(chats, []);

  // ── Home's own give-up: the welcome's 2 minutes and its timeout line; the next press takes it away ──
  usable.codex = false;
  emitCodexStatusInvalidated('logout');
  await flush();
  await press();
  codex.stopLoginPolling(); // a poll that will never say so
  mock.timers.tick(120_000);
  await flush();
  shown = await card();
  assert.equal(shown.signingIn, null, 'given up after 2 minutes');
  assert.equal(shown.button, 'Sign in with ChatGPT', 'back as it was');
  assert.equal(shown.problem, TIMED_OUT, 'with the welcome\'s reason on the problem line');
  await press();
  shown = await card();
  assert.equal(shown.signingIn, 'waiting', 'pressing again is the retry');
  assert.equal(shown.problem, null, 'the press takes the line away (the Experience lead, f85e188)');

  // ── Cancel: back as it was, with no line ──
  const stopsBefore = codexStops;
  await host.cancelSignIn();
  await flush();
  shown = await card();
  assert.equal(codexStops, stopsBefore + 1, 'Cancel stops ChatGPT\'s login');
  assert.equal(shown.signingIn, null);
  assert.equal(shown.problem, null);

  // ── "Open the website?" declined: back as it was, with no line ──
  openWorks = false;
  await press();
  openWorks = true;
  shown = await card();
  assert.equal(shown.signingIn, null);
  assert.equal(shown.problem, null);

  // ── ChatGPT signed in elsewhere, with the card's AIs not read again yet: the press doesn't start a second sign-in ──
  await card(); // reads the AIs: ChatGPT signs in
  usable.codex = true; // signed in on the AI's sheet, no event yet
  const startsBefore = codexStarts;
  await press();
  assert.equal(codexStarts, startsBefore, 'the readiness check before ChatGPT\'s login');
  shown = await card();
  assert.equal(shown.aiReady, true);
  assert.deepEqual(chats, []);

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
  // "Open the page again" before Claude's CLI printed its page: never silent (finding 6)
  await host.reopenSignIn();
  shown = await card();
  assert.equal(shown.problem, 'Claude’s sign-in page didn’t open. Sign in again to open it.');
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
  claudeBegin = (options) => { claudeLogin = options; return 'started'; };

  // ── A failure line belongs to the card that names that AI (finding 2) ──
  usable['claude-code'] = true; // Claude signed in elsewhere
  emitClaudeStatusInvalidated('login-finished');
  await flush();
  shown = await card();
  assert.equal(shown.aiReady, true);
  assert.equal(shown.ai, 'claude-code');
  assert.equal(shown.problem, null, 'no old failure under the ready request');

  // ── With an AI ready, Ask with's sign-in leaves the ready request as it is (finding 4) ──
  await host.signIn(input.folderUri, 'codex');
  await flush();
  shown = await card();
  assert.equal(shown.aiReady, true, 'the ready request stays usable');
  assert.equal(shown.ai, 'claude-code');
  assert.equal(shown.signingIn, null);
  assert.equal(shown.ais.find((ai) => ai.id === 'codex')?.state, 'signing-in', 'Ask with shows it signing in, as before');
  await host.cancelSignIn();
  await flush();

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
