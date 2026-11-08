/**
 * Sprint 156 (#694, review round 2, P1 and P2): the welcome's ChatGPT sign-in, end to end on the host, with VS Code
 * stubbed and the real `CodexRuntime` login poll.
 *
 * - P2: the welcome waits through the wait Home's card shares (`waitForCodexSignIn`). A login Codex reports as failed
 *   says "didn't finish"; a poll stopped elsewhere (a sign-out) puts the card back with no line; a poll that went quiet
 *   gives up after the same 2 minutes with the timeout line; the AI sheet's restart of the poll no longer silences it.
 *   So the card never stays on "Signing in…".
 * - P1: "Open the page again" is never silent: a page that doesn't open says so in the waiting card's line, in the
 *   words Home's card uses.
 *
 * Run: npx tsx src/welcome/welcomeSignIn.test.ts
 */

import assert from 'node:assert/strict';
import * as fs from 'fs';
import Module from 'node:module';
import { mock } from 'node:test';
import * as os from 'os';
import * as path from 'path';

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
type Uri = { fsPath: string; path: string; scheme: string; toString(): string };
const uri = (value: string): Uri => ({ fsPath: value.replace(/^file:\/\//, ''), path: value, scheme: value.split(':')[0], toString: () => value });

// The welcome's panel: what it posts, and its message listener
const posted: Array<{ type: string; state?: { providers: Array<{ id: string; phase: string; reason: string | null }> } }> = [];
let onMessage: ((raw: unknown) => void) | null = null;
const panel = {
  webview: {
    html: '',
    options: {},
    cspSource: 'vscode-resource:',
    asWebviewUri: (value: Uri) => value,
    postMessage: async (message: (typeof posted)[number]) => { posted.push(message); return true; },
    onDidReceiveMessage: (listener: (raw: unknown) => void) => { onMessage = listener; return { dispose() {} }; },
  },
  iconPath: undefined as unknown,
  onDidDispose: none,
  reveal() {},
  dispose() {},
};
const opened: string[] = [];
let openWorks = true;
const vscodeStub = {
  EventEmitter,
  Uri: { parse: uri, file: (fsPath: string) => uri(`file://${fsPath}`), joinPath: (base: Uri, ...parts: string[]) => uri(`${base.toString()}/${parts.join('/')}`) },
  ViewColumn: { One: 1 },
  ConfigurationTarget: { Global: 1 },
  TabInputTerminal: class {}, TabInputText: class {}, TabInputCustom: class {}, TabInputWebview: class {},
  workspace: {
    workspaceFolders: undefined,
    getConfiguration: () => ({ get: (_key: string, fallback?: unknown) => fallback, inspect: () => undefined, update: async () => undefined }),
    onDidChangeConfiguration: none,
  },
  window: {
    createWebviewPanel: () => panel,
    registerWebviewPanelSerializer: none,
    tabGroups: { all: [], activeTabGroup: { activeTab: undefined }, onDidChangeTabs: none, onDidChangeTabGroups: none },
    showInformationMessage: async () => undefined,
    showWarningMessage: async () => undefined,
  },
  commands: { executeCommand: async () => undefined, registerCommand: none },
  env: { openExternal: async (target: Uri) => { opened.push(target.toString()); return openWorks; } },
  extensions: { getExtension: () => undefined },
};
const load = (Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown })._load;
(Module as unknown as { _load: unknown })._load = (request: string, ...rest: unknown[]) => (request === 'vscode' ? vscodeStub : load(request, ...rest));

const flush = async () => { for (let i = 0; i < 12; i++) await new Promise((resolve) => setImmediate(resolve)); };

async function main(): Promise<void> {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1_000_000 });
  const { registerWelcome } = await import('./welcomeHost');
  const { CodexRuntime } = await import('../codex/CodexRuntime');

  // ChatGPT signed out; its login as the AI's sheet runs it (`UnifiedViewProvider.startCodexSignIn`), on the real poller
  let chatgptReady = false;
  const codex = new CodexRuntime();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (codex as any).getCodexSidebarStatus = async () => ({ state: chatgptReady ? 'ready' : codex.isLoginInProgress() ? 'auth-in-progress' : 'needs-auth' });
  let starts = 0;
  const aiSheet = {
    runtimeAvailability: async (id: string) => (id === 'codex'
      ? { state: chatgptReady ? 'ready' as const : 'needs-auth' as const, usable: chatgptReady, detail: null }
      : { state: 'disabled' as const, usable: false, detail: null }),
    startCodexSignIn: async (onStatus: (state: string) => void, onEnd?: (end: 'ready' | 'failed' | 'gave-up' | 'stopped') => void) => {
      starts += 1;
      codex.setLoginInProgress(true);
      codex.startLoginPolling(() => {});
      codex.listenToLoginPoll((next) => onStatus(next.state), onEnd);
      return 'https://auth.openai.com/sign-in';
    },
    stopCodexSignIn: async () => { codex.stopLoginPolling(); codex.setLoginInProgress(false); },
    verifyCodexSignIn: async () => true,
    openLandingChat: async () => undefined,
  };

  const storage = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-welcome-signin-'));
  // A ChatGPT home of the run's own, with no sign-in ever made, so this computer's own sign-in plays no part
  process.env.CODEX_HOME = storage;
  const state = new Map<string, unknown>();
  const context = {
    subscriptions: [] as Array<{ dispose(): void }>,
    globalState: { get: <T>(key: string, fallback?: T) => (state.has(key) ? state.get(key) as T : fallback), update: async (key: string, value: unknown) => { state.set(key, value); }, keys: () => [...state.keys()] },
    secrets: { get: async () => undefined, store: async () => undefined, onDidChange: none },
    extensionUri: uri('file:///ext'),
    globalStorageUri: uri(`file://${storage}`),
    extension: { packageJSON: { version: '2.2.0' } },
  };
  registerWelcome(context as never, 'fresh', aiSheet as never);
  await flush();
  assert.ok(onMessage, 'the welcome opened on a window with no folder');
  const chatgpt = () => {
    const last = [...posted].reverse().find((message) => message.type === 'welcome/state');
    const view = last?.state?.providers.find((provider) => provider.id === 'chatgpt');
    assert.ok(view);
    return view;
  };
  const send = async (raw: unknown) => { onMessage!(raw); await flush(); };
  const signIn = async () => {
    await send({ type: 'welcome/sign-in', provider: 'chatgpt' });
    assert.equal(chatgpt().phase, 'signing-in', 'the welcome waits for ChatGPT');
  };

  // ── P2: a login Codex reports as failed says "didn't finish" at once ──
  await signIn();
  assert.equal(starts, 1);
  codex.stopLoginPolling('failed'); // what `loginComplete` with success false does
  await flush();
  assert.equal(chatgpt().phase, 'sign-in');
  assert.equal(chatgpt().reason, 'The sign-in to ChatGPT didn’t finish. Sign in again when you’re ready.');

  // ── P2: a poll stopped elsewhere (a sign-out on the AI's sheet): back to Sign in, with no line ──
  await signIn();
  assert.equal(chatgpt().reason, null, 'a new try starts with no line');
  codex.stopLoginPolling();
  await flush();
  assert.equal(chatgpt().phase, 'sign-in', 'never left on "Signing in…"');
  assert.equal(chatgpt().reason, null);

  // ── P1: "Open the page again" that opens nothing says so, in the waiting card's line ──
  await signIn();
  openWorks = false;
  await send({ type: 'welcome/reopen-sign-in', provider: 'chatgpt' });
  openWorks = true;
  assert.equal(opened[opened.length - 1], 'https://auth.openai.com/sign-in', 'it tried the page');
  assert.equal(chatgpt().phase, 'signing-in', 'still waiting');
  assert.equal(chatgpt().reason, 'ChatGPT’s sign-in page didn’t open. Sign in again to open it.', 'never silent');
  await send({ type: 'welcome/reopen-sign-in', provider: 'chatgpt' });
  assert.equal(chatgpt().reason, null, 'a page that opened takes the line away');

  // ── P2: the AI sheet restarts the poll; it then goes quiet: the welcome gives up after the same 2 minutes ──
  codex.startLoginPolling(() => {}); // the sheet's `login-started` listener
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (codex as any)._clearLoginPoll(); // a poll that will never say so
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (codex as any)._loginPollListeners.clear();
  mock.timers.tick(120_000);
  await flush();
  assert.equal(chatgpt().phase, 'sign-in');
  assert.equal(chatgpt().reason, 'The sign-in page wasn’t finished in time. Sign in again when you’re ready.', 'the welcome\'s timeout line');

  // ── Through the sheet's restart, a finished sign-in still reaches the welcome ──
  await signIn();
  codex.startLoginPolling(() => {}); // the sheet's restart keeps the welcome's listener
  chatgptReady = true;
  mock.timers.tick(2000);
  await flush();
  assert.equal(chatgpt().phase, 'ready', 'signed in');

  for (const disposable of context.subscriptions) disposable.dispose();
  codex.stopLoginPolling();
  mock.timers.reset();
  fs.rmSync(storage, { recursive: true, force: true });
  console.log('welcomeSignIn.test.ts: all assertions passed');
}

main().then(() => process.exit(0), (error) => {
  console.error(error);
  process.exit(1);
});
