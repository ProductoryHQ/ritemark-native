/**
 * Sprint 134 (R9, S31, S33): the question before a switch, in words.
 * Run: npx tsx src/projects/switchProject.test.ts
 */

import assert from 'node:assert/strict';
import Module from 'node:module';

// switchProject.ts imports vscode for its glue: a small stand-in records what the switcher runs and answers its question.
const calls: unknown[][] = [];
let answer: string | undefined;
class FakeUri {
  constructor(private readonly value: string) {}
  static parse(value: string): FakeUri { return new FakeUri(value); }
  toString(): string { return this.value; }
}
const vscodeStub = {
  Uri: FakeUri,
  commands: { executeCommand: async (...args: unknown[]) => { calls.push(args); } },
  window: {
    showWarningMessage: async (title: unknown, _options: unknown, ...items: { title: string; isCloseAffordance?: boolean }[]) => {
      calls.push(['ask', title, items.map((item) => `${item.title}${item.isCloseAffordance ? ' (close)' : ''}`)]);
      return items.find((item) => item.title === answer);
    },
  },
};
const load = (Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown })._load;
(Module as unknown as { _load: unknown })._load = (request: string, ...rest: unknown[]) => (request === 'vscode' ? vscodeStub : load(request, ...rest));

async function main(): Promise<void> {
  const { switchQuestion, ProjectSwitcher, SWITCHED_FROM_KEY, LANDING_KEY } = await import('./switchProject');

  // S31: one AI, the other project known: three buttons, Open in a new window the default.
  const one = switchQuestion(['claude-code'], 'Leadership programme', 'Sales proposal Q4');
  assert.equal(one.title, 'Claude is still working in Leadership programme');
  assert.equal(one.detail, 'Switching projects stops it. Open Sales proposal Q4 in a new window to let Claude finish.');
  assert.deepEqual(one.buttons.map((button) => button.choice), ['new-window', 'switch-and-stop'], 'the first is the default; Cancel is the dialog’s own');

  // ChatGPT, never Codex (R22).
  assert.equal(switchQuestion(['codex'], 'A', 'B').title, 'ChatGPT is still working in A');

  // Two AIs at once.
  const two = switchQuestion(['claude-code', 'codex', 'claude-code'], 'A', 'B');
  assert.equal(two.title, 'Claude and ChatGPT are still working in A');
  assert.equal(two.detail, 'Switching projects stops them. Open B in a new window to let them finish.');

  // S33: VS Code's Open Folder… — the folder isn't known, so no new window to offer.
  const unknown = switchQuestion(['opencode'], 'A', null);
  assert.equal(unknown.title, 'OpenCode is still working in A');
  assert.equal(unknown.detail, 'Switching projects stops it.');
  assert.deepEqual(unknown.buttons.map((button) => button.choice), ['cancel', 'switch-and-stop'], 'Cancel first: the default');

  // A runtime Ritemark can't name.
  assert.equal(switchQuestion([null], 'A', 'B').title, 'The AI is still working in A');

  // The switcher (R9, S30–S33). A fake chat list and global state.
  const state = new Map<string, unknown>();
  let working: { conversationId: string; runtimeId: string | null }[] = [];
  let stopped = 0;
  const switcher = new ProjectSwitcher({
    context: { globalState: { get: (key: string) => state.get(key), update: async (key: string, value: unknown) => { state.set(key, value); } } } as never,
    hereName: () => 'Leadership programme',
    hereUri: () => 'file:///p/lead',
    nameOf: () => 'Sales proposal Q4',
    workingChats: () => working,
    stopWorkingChats: async () => { stopped += 1; working = []; },
  });
  const sales = vscodeStub.Uri.parse('file:///p/sales') as never;
  const reset = () => { calls.length = 0; state.clear(); stopped = 0; };

  // Nothing working: no question, the window switches and remembers where it was.
  reset();
  assert.equal(await switcher.switchTo(sales), 'switched');
  assert.deepEqual(calls.map((call) => call[0]), ['vscode.openFolder']);
  assert.deepEqual((state.get(SWITCHED_FROM_KEY) as { name: string }).name, 'Leadership programme');
  // ... and the reload it starts is not asked about again, even with a chat working by then.
  working = [{ conversationId: 'c1', runtimeId: 'claude-code' }];
  assert.equal(await switcher.beforeReload('file:///p/sales'), false);
  assert.ok(!calls.some((call) => call[0] === 'ask'));

  // Working: Cancel changes nothing.
  const fresh = () => new ProjectSwitcher({
    context: { globalState: { get: (key: string) => state.get(key), update: async (key: string, value: unknown) => { state.set(key, value); } } } as never,
    hereName: () => 'Leadership programme', hereUri: () => 'file:///p/lead', nameOf: () => 'Sales proposal Q4',
    workingChats: () => working, stopWorkingChats: async () => { stopped += 1; working = []; },
  });
  reset(); working = [{ conversationId: 'c1', runtimeId: 'claude-code' }]; answer = 'Cancel';
  assert.equal(await fresh().switchTo(sales), 'cancel');
  assert.deepEqual(calls.map((call) => call[0]), ['ask']);
  // Open in a new window: the other project opens apart, this window and its turn go on.
  reset(); answer = 'Open in a new window';
  assert.equal(await fresh().switchTo(sales), 'new-window');
  assert.deepEqual(calls[1], ['vscode.openFolder', sales, { forceNewWindow: true }]);
  assert.equal(stopped, 0);
  // Switch and stop: the turns stop first, then the window switches.
  reset(); answer = 'Switch and stop';
  assert.equal(await fresh().switchTo(sales), 'switched');
  assert.equal(stopped, 1);
  assert.deepEqual(calls[1], ['vscode.openFolder', sales, { forceReuseWindow: true }]);

  // VS Code's own routes (S33): Cancel stops the reload; no target, no new window offered.
  reset(); working = [{ conversationId: 'c1', runtimeId: 'claude-code' }]; answer = 'Cancel';
  assert.equal(await fresh().beforeReload(undefined), true);
  assert.deepEqual(calls[0][2], ['Cancel (close)', 'Switch and stop'], 'no target: Cancel is the default and the close button');
  reset(); answer = 'Switch and stop';
  assert.equal(await fresh().beforeReload(undefined), false);
  assert.equal(stopped, 1);
  reset(); working = [];
  assert.equal(await fresh().beforeReload('file:///p/sales'), false, 'nothing working never asks');
  assert.ok(!calls.some((call) => call[0] === 'ask'));

  // Go back (S32): the window returns and leaves no note of its own on the project it returns to.
  reset(); state.set(SWITCHED_FROM_KEY, { folderUri: 'file:///p/old', name: 'Old', at: Date.now() });
  assert.equal(await fresh().switchTo(sales, { goingBack: true }), 'switched');
  assert.equal(state.get(SWITCHED_FROM_KEY), undefined);
  // The note is taken once, only right after a switch, and never about the project itself.
  state.set(SWITCHED_FROM_KEY, { folderUri: 'file:///p/lead', name: 'Leadership programme', at: Date.now() });
  const context = { globalState: { get: (key: string) => state.get(key), update: async (key: string, value: unknown) => { state.set(key, value); } } } as never;
  assert.deepEqual(ProjectSwitcher.takeSwitchedFrom(context, 'file:///p/sales')?.name, 'Leadership programme');
  assert.equal(ProjectSwitcher.takeSwitchedFrom(context, 'file:///p/sales'), null, 'once');
  state.set(SWITCHED_FROM_KEY, { folderUri: 'file:///p/sales', name: 'Sales', at: Date.now() });
  assert.equal(ProjectSwitcher.takeSwitchedFrom(context, 'file:///p/sales'), null, 'not about itself');

  // R9, S30: every switch in place lands on Home in the next window, Go back and Open Recent included; once, only in
  // the folder it opened (any other folder when the window did not know it), only right after the switch.
  reset(); working = [];
  await fresh().switchTo(sales, { goingBack: true });
  assert.equal(ProjectSwitcher.takeLanding(context, 'file:///p/sales/'), true, 'Go back lands on Home too');
  assert.equal(ProjectSwitcher.takeLanding(context, 'file:///p/sales'), false, 'once');
  await fresh().switchTo(sales);
  assert.equal(ProjectSwitcher.takeLanding(context, 'file:///p/other'), false, 'not in another folder');
  await fresh().beforeReload('file:///p/sales');
  assert.equal(ProjectSwitcher.takeLanding(context, 'file:///p/sales'), true, 'Open Recent');
  await fresh().beforeReload(undefined);
  assert.equal(ProjectSwitcher.takeLanding(context, 'file:///p/lead'), false, 'Open Folder… back into the same folder is no switch');
  await fresh().beforeReload(undefined);
  assert.equal(ProjectSwitcher.takeLanding(context, 'file:///p/elsewhere'), true, 'Open Folder… into another folder');
  state.set(LANDING_KEY, { from: 'file:///p/lead', target: 'file:///p/sales', at: Date.now() - 3 * 60 * 1000 });
  assert.equal(ProjectSwitcher.takeLanding(context, 'file:///p/sales'), false, 'too late');

  console.log('projects/switchProject: all assertions passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
