/**
 * Sprint 156 (PR B; experience 35, "With no AI ready"): the welcome's `welcome_ai_skipped`, on the host, with VS Code
 * stubbed and what the welcome hands to the consent gate recorded (the gate's holding, yes and no: consent.test.ts).
 *
 * - Skip for now on the fresh welcome's step 1 counts once, `how: 'button'`, through the held path; a second press on
 *   step 2 counts nothing.
 * - Start a new project while step 1 is open (S25) counts once, `how: 'new_project'`.
 * - `ai_ready` is the welcome's own answer: false with no AI ready, true with one; a check still running is waited for
 *   (each answers within 20 s), so a quick skip isn't counted as "no AI" before the welcome knows.
 * - The welcome closing before then drops it, as it drops the welcome's other held events; leaving for a project
 *   counts it at once, before the yes, so it goes with that yes.
 * - The update welcome has no skip: nothing is counted.
 *
 * Run: npx tsx src/welcome/welcomeSkip.test.ts
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

// Each welcome gets a panel of its own: its message listener, and its close
let onMessage: ((raw: unknown) => void) | null = null;
let closePanel: (() => void) | null = null;
const createWebviewPanel = () => {
  const closed: Array<() => void> = [];
  const panel = {
    webview: {
      html: '',
      options: {},
      cspSource: 'vscode-resource:',
      asWebviewUri: (value: Uri) => value,
      postMessage: async () => true,
      onDidReceiveMessage: (listener: (raw: unknown) => void) => { onMessage = listener; return { dispose() {} }; },
    },
    iconPath: undefined as unknown,
    onDidDispose: (listener: () => void) => { closed.push(listener); return { dispose() {} }; },
    reveal() {},
    dispose() { for (const listener of closed.splice(0)) listener(); },
  };
  closePanel = () => panel.dispose();
  return panel;
};
const registered = new Map<string, () => unknown>();
let workspaceFolders: Array<{ uri: Uri }> | undefined;
const vscodeStub = {
  EventEmitter,
  Uri: { parse: uri, file: (fsPath: string) => uri(`file://${fsPath}`), joinPath: (base: Uri, ...parts: string[]) => uri(`${base.toString()}/${parts.join('/')}`) },
  ViewColumn: { One: 1 },
  ConfigurationTarget: { Global: 1 },
  TabInputTerminal: class {}, TabInputText: class {}, TabInputCustom: class {}, TabInputWebview: class {}, TabInputNotebook: class {}, TabInputTextDiff: class {},
  workspace: {
    get workspaceFolders() { return workspaceFolders; },
    getConfiguration: () => ({ get: (_key: string, fallback?: unknown) => fallback, inspect: () => undefined, update: async () => undefined }),
    onDidChangeConfiguration: none,
  },
  window: {
    createWebviewPanel,
    registerWebviewPanelSerializer: none,
    tabGroups: { all: [], activeTabGroup: { activeTab: undefined }, onDidChangeTabs: none, onDidChangeTabGroups: none },
    showInformationMessage: async () => undefined,
    showWarningMessage: async () => undefined,
    showOpenDialog: async () => [uri(`file://${os.tmpdir()}`)],
  },
  commands: { executeCommand: async () => undefined, registerCommand: (id: string, run: () => unknown) => { registered.set(id, run); return { dispose() {} }; } },
  env: { openExternal: async () => true },
  extensions: { getExtension: () => undefined },
};

// What the welcome hands to analytics, in order: its counts, and the usage answer it gives on leaving
const counts: Array<{ event: string; held?: boolean } & Record<string, unknown>> = [];
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
    setUsageData: async (on: boolean) => { counts.push({ event: `usage-data:${on ? 'yes' : 'no'}` }); },
  };
};
/** The skips counted since the last look (and the usage answer, to see what came first). */
const skips = () => counts.splice(0).filter((count) => count.event === 'welcome_ai_skipped' || count.event.startsWith('usage-data:'));
const skipped = (how: string, aiReady: boolean) => ({ event: 'welcome_ai_skipped', how, ai_ready: aiReady, held: true });

const flush = async () => { for (let i = 0; i < 12; i++) await new Promise((resolve) => setImmediate(resolve)); };

type Availability = { state: 'ready' | 'needs-auth' | 'needs-configuration' | 'disabled'; usable: boolean; detail: null };
const READY: Availability = { state: 'ready', usable: true, detail: null };
const SIGNED_OUT: Availability = { state: 'needs-auth', usable: false, detail: null };

async function main(): Promise<void> {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1_000_000 });
  const { registerWelcome } = await import('./welcomeHost');
  const storage = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-welcome-skip-'));
  // A ChatGPT home of the run's own, with no sign-in ever made, so this computer's own plays no part
  process.env.CODEX_HOME = storage;

  /**
   * One welcome, its AIs answering as given; `held` AIs don't answer until `answer()` is called. Claude is never made
   * ready here: its ready check reads this computer's own Claude (`getSetupStatus`).
   */
  const welcome = (options: { kind?: 'fresh' | 'update'; ready?: 'codex' | 'opencode'; held?: string[] } = {}) => {
    const waiting = new Map<string, () => void>();
    const answerOf = (id: string): Availability => (id === options.ready ? READY : id === 'opencode' ? { state: 'needs-configuration', usable: false, detail: null } : SIGNED_OUT);
    const aiSheet = {
      runtimeAvailability: (id: string) => (options.held?.includes(id)
        ? new Promise<Availability>((resolve) => waiting.set(id, () => resolve(answerOf(id))))
        : Promise.resolve(answerOf(id))),
      startCodexSignIn: async () => null,
      stopCodexSignIn: async () => undefined,
      verifyCodexSignIn: async () => true,
      openLandingChat: async () => undefined,
    };
    const state = new Map<string, unknown>();
    const context = {
      subscriptions: [] as Array<{ dispose(): void }>,
      globalState: { get: <T>(key: string, fallback?: T) => (state.has(key) ? state.get(key) as T : fallback), update: async (key: string, value: unknown) => { state.set(key, value); }, keys: () => [...state.keys()] },
      secrets: { get: async () => undefined, store: async () => undefined, onDidChange: none },
      extensionUri: uri('file:///ext'),
      extensionPath: '/ext',
      globalStorageUri: uri(`file://${storage}`),
      extension: { packageJSON: { version: '2.2.0' } },
    };
    onMessage = null;
    registerWelcome(context as never, options.kind === 'update' ? 'update' : 'fresh', aiSheet as never);
    return {
      send: async (raw: unknown) => { assert.ok(onMessage, 'the welcome is open'); onMessage(raw); await flush(); },
      answer: async (id: string) => { waiting.get(id)?.(); await flush(); },
      dispose: () => { for (const disposable of context.subscriptions) disposable.dispose(); },
    };
  };

  // ── Skip for now with no AI ready: once, through the held path ──
  {
    const w = welcome();
    await flush();
    counts.splice(0);
    await w.send({ type: 'welcome/skip' });
    assert.deepEqual(skips(), [skipped('button', false)], 'one held skip, with no AI ready, and only how and ai_ready');
    await w.send({ type: 'welcome/skip' }); // step 2 has no skip
    assert.deepEqual(skips(), [], 'once per skip: a second press on step 2 counts nothing');
    assert.ok(!counts.some((count) => count.event === 'welcome_ai_skipped'));
    w.dispose();
  }

  // ── With an AI the welcome found ready: ai_ready ──
  {
    const w = welcome({ ready: 'codex' });
    await flush();
    counts.splice(0);
    await w.send({ type: 'welcome/skip' });
    assert.deepEqual(skips(), [skipped('button', true)], 'ChatGPT was ready, and the person skipped anyway');
    w.dispose();
  }
  {
    const w = welcome({ ready: 'opencode' });
    await flush();
    counts.splice(0);
    await w.send({ type: 'welcome/skip' });
    assert.deepEqual(skips(), [skipped('button', true)], 'OpenCode set up counts as ready');
    w.dispose();
  }

  // ── A quick skip, before the welcome knows: it waits for the checks, then counts their answer ──
  {
    const w = welcome({ ready: 'codex', held: ['codex'] });
    await flush();
    counts.splice(0);
    await w.send({ type: 'welcome/skip' });
    assert.deepEqual(skips(), [], 'not "no AI" while ChatGPT\'s check still runs');
    await w.answer('codex');
    assert.deepEqual(skips(), [skipped('button', true)], 'counted once ChatGPT\'s check said ready');
    w.dispose();
  }
  {
    // A check that never answers: the welcome's own 20 s timeout is its answer (not ready)
    const w = welcome({ held: ['claude-code'] });
    await flush();
    counts.splice(0);
    await w.send({ type: 'welcome/skip' });
    assert.deepEqual(skips(), []);
    mock.timers.tick(20_000);
    await flush();
    assert.deepEqual(skips(), [skipped('button', false)], 'counted when the check timed out');
    w.dispose();
  }

  // ── The welcome closes before the checks answer: dropped, as its other held events are ──
  {
    const w = welcome({ ready: 'codex', held: ['codex'] });
    await flush();
    await w.send({ type: 'welcome/skip' });
    closePanel?.();
    await w.answer('codex');
    mock.timers.tick(20_000);
    await flush();
    assert.deepEqual(skips(), [], 'never counted after the welcome closed');
    w.dispose();
  }

  // ── Leaving for a project before the checks answer: counted at once, before the yes, so it goes with it ──
  {
    const w = welcome({ ready: 'codex', held: ['codex'] });
    await flush();
    counts.splice(0);
    await w.send({ type: 'welcome/skip' });
    await w.send({ type: 'welcome/open-folder' });
    assert.deepEqual(skips(), [skipped('button', false), { event: 'usage-data:yes' }], 'the skip, with what the welcome knew, then the yes');
    await w.answer('codex');
    assert.deepEqual(skips(), [], 'and only once');
    w.dispose();
  }

  // ── Start a new project from the projects list while step 1 is open (S25): how 'new_project' ──
  {
    const w = welcome();
    await flush();
    counts.splice(0);
    await registered.get('ritemark.welcome.newProject')?.();
    await flush();
    assert.deepEqual(skips(), [skipped('new_project', false)], 'the implicit skip, once');
    await registered.get('ritemark.welcome.newProject')?.();
    await flush();
    assert.deepEqual(skips(), [], 'already on step 2: nothing more');
    w.dispose();
  }
  {
    // In a project window the welcome isn't open yet: its checks run when it opens, and the skip waits for them
    workspaceFolders = [{ uri: uri(`file://${storage}`) }];
    const w = welcome({ ready: 'codex' });
    await flush();
    assert.equal(onMessage, null, 'no welcome at start in a window with a folder');
    counts.splice(0);
    await registered.get('ritemark.welcome.newProject')?.();
    await flush();
    assert.deepEqual(skips(), [skipped('new_project', true)], 'ChatGPT ready, by the checks the opened welcome ran');
    w.dispose();
    workspaceFolders = undefined;
  }

  // ── The update welcome has no skip ──
  {
    const w = welcome({ kind: 'update' });
    await flush();
    counts.splice(0);
    await w.send({ type: 'welcome/skip' });
    await registered.get('ritemark.welcome.newProject')?.();
    await flush();
    assert.deepEqual(skips(), [], 'nothing on the update sheet');
    w.dispose();
  }

  mock.timers.reset();
  fs.rmSync(storage, { recursive: true, force: true });
  console.log('welcomeSkip.test.ts: all assertions passed');
}

main().then(() => process.exit(0), (error) => {
  console.error(error);
  process.exit(1);
});
