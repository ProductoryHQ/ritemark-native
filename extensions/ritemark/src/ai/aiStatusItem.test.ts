/**
 * The status bar's AI item follows the person (Sprint 144, P3): it names the default AI before the sheet reports a
 * chat, then the open chat's AI; it re-reads an AI's state when that AI's status changes, an OpenCode key changes, or
 * the default AI changes; it probes only the AI in question when that AI is ready, and the others cheapest first when
 * it isn't; a sign-in or repair that has only started re-reads nothing; "ready" waits for the internet's first answer;
 * and it is one item, its words only (no dot in 2.1).
 *
 * Time is mocked (node:test's mock timers), so the 300 ms debounce and the 15 s reuse are stepped exactly.
 *
 * Run: npx tsx src/ai/aiStatusItem.test.ts
 */

import assert from 'node:assert/strict';
import Module from 'node:module';
import { mock } from 'node:test';

type Listener<T> = (value: T) => void;
class EventEmitter<T> {
  private listeners: Listener<T>[] = [];
  event = (listener: Listener<T>) => {
    this.listeners.push(listener);
    return { dispose: () => { this.listeners = this.listeners.filter((l) => l !== listener); } };
  };
  fire(value: T): void { for (const l of [...this.listeners]) l(value); }
  dispose(): void { this.listeners = []; }
}

interface FakeItem { id: string; text: string; tooltip?: string; color?: { id: string }; command?: string; shown: boolean; accessibilityInformation?: { label: string; role?: string } }
const items: FakeItem[] = [];
const commands = new Map<string, () => unknown>();
const executed: string[] = [];
let selectedAgent = 'claude-code';
const configListeners: Listener<{ affectsConfiguration: (key: string) => boolean }>[] = [];
const secretListeners: Listener<unknown>[] = [];

const vscodeStub = {
  EventEmitter,
  ThemeColor: class { constructor(public id: string) {} },
  StatusBarAlignment: { Left: 1, Right: 2 },
  window: {
    createStatusBarItem: (id: string) => {
      const item: FakeItem & { show(): void; hide(): void; dispose(): void } = {
        id, text: '', shown: false,
        show() { this.shown = true; }, hide() { this.shown = false; }, dispose() {},
      };
      items.push(item);
      return item;
    },
  },
  workspace: {
    getConfiguration: () => ({ get: () => selectedAgent }),
    onDidChangeConfiguration: (listener: Listener<{ affectsConfiguration: (key: string) => boolean }>) => {
      configListeners.push(listener);
      return { dispose() {} };
    },
  },
  commands: {
    registerCommand: (id: string, run: () => unknown) => { commands.set(id, run); return { dispose() {} }; },
    executeCommand: (id: string) => { executed.push(id); return Promise.resolve(); },
  },
};
const load = (Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown })._load;
(Module as unknown as { _load: unknown })._load = (request: string, ...rest: unknown[]) => (request === 'vscode' ? vscodeStub : load(request, ...rest));

// The debounce runs on mocked time; a probe's answer is a resolved promise, so a few turns of the real event loop
// (setImmediate is not mocked) let the item finish drawing.
const DEBOUNCE_MS = 300;
async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await new Promise((resolve) => setImmediate(resolve));
}
async function settle(): Promise<void> {
  await flush();
  mock.timers.tick(DEBOUNCE_MS);
  await flush();
}

async function main(): Promise<void> {
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 });
  const { initAiStatusItem } = await import('./aiStatusItem');
  const { emitClaudeStatusInvalidated } = await import('../agent/claudeStatusEvents');
  const { emitCodexStatusInvalidated } = await import('../codex/codexStatusEvents');

  const usable: Record<string, boolean> = { 'claude-code': true, codex: true, opencode: false };
  const probes: string[] = [];
  let openChat: { agentId: 'claude-code' | 'codex' | 'opencode'; signInEnded: boolean } | null = null;
  const openChatListeners: Array<() => void> = [];
  const modelListeners: Array<() => void> = [];
  const internetListeners: Array<() => void> = [];
  const internet = { online: true, answered: false };
  const internetChanged = () => { for (const l of internetListeners) l(); };

  initAiStatusItem(
    { subscriptions: [], secrets: { onDidChange: (l: Listener<unknown>) => { secretListeners.push(l); return { dispose() {} }; } } } as never,
    {
      runtimeAvailability: async (id) => {
        probes.push(id);
        return { state: usable[id] ? 'ready' : 'needs-auth', usable: usable[id], detail: null };
      },
      openChat: () => openChat,
      onDidChangeOpenChat: (listener) => { openChatListeners.push(listener); return { dispose() {} }; },
      onDidUpdateModels: (listener) => { modelListeners.push(listener); return { dispose() {} }; },
      internet: {
        isOnline: () => internet.online,
        hasAnswered: () => internet.answered,
        onDidChange: (listener) => { internetListeners.push(listener); return { dispose() {} }; },
        whenFirstRound: () => Promise.resolve(),
      },
    },
  );
  assert.equal(items.length, 1, 'one item, its words only: no dot in 2.1');
  const [words] = items;
  assert.equal(words.id, 'ritemark.aiStatus');
  assert.equal(words.command, 'ritemark.aiStatus.open');

  // An offline start: the first round failed, so connectivity still guesses online, and Claude is signed in. The item
  // claims nothing until the internet answers.
  await flush();
  assert.equal(words.shown, false, 'no "Claude ready" before the internet has answered once');
  assert.deepEqual(probes, ['claude-code'], 'a ready AI: only it is probed');

  // The internet answers.
  internet.answered = true;
  internetChanged();
  await settle();
  assert.equal(words.text, 'Claude ready', 'before the sheet reports a chat, the default AI');
  assert.equal(words.shown, true);
  assert.equal(words.accessibilityInformation?.label, 'Claude ready', 'one screen-reader name');
  assert.equal(words.color, undefined, 'the words stay in body ink');
  assert.deepEqual(probes, ['claude-code'], 'the 15 s reuse: no second probe for the same AI');

  // The sheet reports a chat on ChatGPT; the debounce holds the answer back for 300 ms, not a moment less.
  openChat = { agentId: 'codex', signInEnded: false };
  for (const l of openChatListeners) l();
  await flush();
  mock.timers.tick(DEBOUNCE_MS - 1);
  await flush();
  assert.equal(words.text, 'Claude ready', 'still debouncing at 299 ms');
  mock.timers.tick(1);
  await flush();
  assert.equal(words.text, 'ChatGPT ready', 'the open chat names its AI');

  // Its last turn failed on sign-in.
  openChat = { agentId: 'codex', signInEnded: true };
  for (const l of openChatListeners) l();
  await settle();
  assert.equal(words.text, 'ChatGPT: sign in again');

  // A ChatGPT sign-in or repair that has only started re-reads nothing.
  probes.length = 0;
  mock.timers.tick(15_000); // past the reuse window, so any re-read would probe
  emitCodexStatusInvalidated('login-started');
  emitCodexStatusInvalidated('repair-started');
  await settle();
  assert.deepEqual(probes, [], 'login-started and repair-started are not re-read');

  // Claude, still the default, signs out while ChatGPT is ready: "Claude: sign in", not "again". The others are
  // probed cheapest first (OpenCode, then ChatGPT), stopping at the first that can take a turn.
  openChat = null;
  usable['claude-code'] = false;
  for (const l of openChatListeners) l();
  emitClaudeStatusInvalidated('logout');
  await settle();
  assert.equal(words.text, 'Claude: sign in');
  assert.equal(words.tooltip, 'Sign in to Claude to work with it here');
  assert.deepEqual(probes, ['claude-code', 'opencode', 'codex'], 'the target, then the others cheapest first');

  // ChatGPT signs out too: nothing is ready.
  usable.codex = false;
  emitCodexStatusInvalidated('logout');
  await settle();
  assert.equal(words.text, 'No AI yet');
  assert.equal(words.tooltip, 'Sign in to an AI to work with it here');

  // The internet goes: Offline comes first; and back.
  internet.online = false;
  internetChanged();
  await settle();
  assert.equal(words.text, 'Offline');
  internet.online = true;
  internetChanged();
  await settle();
  assert.equal(words.text, 'No AI yet');

  // An OpenCode key is saved and OpenCode becomes the default.
  usable.opencode = true;
  selectedAgent = 'opencode';
  for (const l of secretListeners) l({ key: 'byok' });
  for (const l of configListeners) l({ affectsConfiguration: (key) => key === 'ritemark.ai.selectedAgent' });
  await settle();
  assert.equal(words.text, 'OpenCode ready');

  // OpenCode's model list changes: OpenCode is probed again, once even when two changes arrive together.
  usable.opencode = false;
  probes.length = 0;
  for (const l of modelListeners) l();
  for (const l of modelListeners) l();
  await settle();
  assert.equal(words.text, 'No AI yet', 'the new list is read');
  assert.equal(probes.filter((id) => id === 'opencode').length, 1, 'one probe for one burst');

  // The click opens the AI's sheet.
  await commands.get('ritemark.aiStatus.open')?.();
  assert.deepEqual(executed, ['ritemark.showAIPanel']);

  mock.timers.reset();
  console.log('aiStatusItem.test.ts passed');
}

void main().catch((error) => { console.error(error); process.exit(1); });
