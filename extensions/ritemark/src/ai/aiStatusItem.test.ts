/**
 * The status bar's AI item follows the person (Sprint 144, P3): it names the default AI before the sheet reports a
 * chat, then the open chat's AI; it re-reads an AI's state when that AI's status changes, an OpenCode key changes, or
 * the default AI changes; it probes only the AI in question when that AI is ready; and the dot is hidden when the
 * state has none.
 *
 * Run: npx tsx src/ai/aiStatusItem.test.ts
 */

import assert from 'node:assert/strict';
import Module from 'node:module';

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const { initAiStatusItem } = await import('./aiStatusItem');
  const { emitClaudeStatusInvalidated } = await import('../agent/claudeStatusEvents');
  const { emitCodexStatusInvalidated } = await import('../codex/codexStatusEvents');

  const usable: Record<string, boolean> = { 'claude-code': true, codex: true, opencode: false };
  const probes: string[] = [];
  let openChat: { agentId: 'claude-code' | 'codex' | 'opencode'; signInEnded: boolean } | null = null;
  const openChatListeners: Array<() => void> = [];
  const modelListeners: Array<() => void> = [];

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
    },
  );
  const [dot, words] = items;
  assert.equal(dot.id, 'ritemark.aiStatus.dot');
  assert.equal(dot.command, undefined, 'the dot takes no click, so the words carry the one hover and click');
  assert.equal(dot.accessibilityInformation?.label, '', 'the dot is hidden from screen readers');
  assert.equal(words.command, 'ritemark.aiStatus.open');

  await sleep(50);
  assert.equal(words.text, 'Claude ready', 'before the sheet reports a chat, the default AI');
  assert.equal(words.accessibilityInformation?.label, 'Claude ready', 'one screen-reader name');
  assert.equal(dot.shown, true);
  assert.equal(dot.color?.id, 'testing.iconPassed');
  assert.deepEqual(probes, ['claude-code'], 'a ready AI: only it is probed');

  // The sheet reports a chat on ChatGPT.
  openChat = { agentId: 'codex', signInEnded: false };
  for (const l of openChatListeners) l();
  await sleep(400);
  assert.equal(words.text, 'ChatGPT ready', 'the open chat names its AI');

  // Its last turn failed on sign-in.
  openChat = { agentId: 'codex', signInEnded: true };
  for (const l of openChatListeners) l();
  await sleep(400);
  assert.equal(words.text, 'ChatGPT: sign in again');
  assert.equal(dot.shown, false, 'no dot for a state that has none');

  // Claude, still the default, signs out while ChatGPT is ready: "Claude: sign in", not "again".
  openChat = null;
  usable['claude-code'] = false;
  for (const l of openChatListeners) l();
  emitClaudeStatusInvalidated('logout');
  await sleep(400);
  assert.equal(words.text, 'Claude: sign in');
  assert.equal(words.tooltip, 'Sign in to Claude to work with it here');

  // ChatGPT signs out too: nothing is ready.
  usable.codex = false;
  emitCodexStatusInvalidated('logout');
  await sleep(400);
  assert.equal(words.text, 'No AI yet');
  assert.equal(words.tooltip, 'Sign in to an AI to work with it here');

  // An OpenCode key is saved and OpenCode becomes the default.
  usable.opencode = true;
  selectedAgent = 'opencode';
  for (const l of secretListeners) l({ key: 'byok' });
  for (const l of configListeners) l({ affectsConfiguration: (key) => key === 'ritemark.ai.selectedAgent' });
  await sleep(400);
  assert.equal(words.text, 'OpenCode ready');

  // OpenCode's model list changes: OpenCode is probed again, once even when two changes arrive together.
  usable.opencode = false;
  probes.length = 0;
  for (const l of modelListeners) l();
  for (const l of modelListeners) l();
  await sleep(400);
  assert.equal(words.text, 'No AI yet', 'the new list is read');
  assert.equal(probes.filter((id) => id === 'opencode').length, 1, 'one probe for one burst');

  // The click opens the AI's sheet.
  await commands.get('ritemark.aiStatus.open')?.();
  assert.deepEqual(executed, ['ritemark.showAIPanel']);

  console.log('aiStatusItem.test.ts passed');
}

void main().catch((error) => { console.error(error); process.exit(1); });
