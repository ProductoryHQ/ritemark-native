/**
 * Sprint 134 (R9, S31, S33): the question before a switch, in words; and its notes for the next window, written only
 * as the window goes and read before they are taken (#623).
 * Run: npx tsx src/projects/switchProject.test.ts
 */

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import Module from 'node:module';
import os from 'node:os';
import path from 'node:path';

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
  const { switchQuestion, ProjectSwitcher, SWITCHED_FROM_FILE, LANDING_FILE, SWITCHED_NOTE_MS, switchNoteFile, readLanding, readSwitchedFrom } = await import('./switchProject');

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

  // The switcher (R9, S30–S33). A fake chat list; the notes go to a scratch global storage, as each window's do.
  const storage = mkdtempSync(path.join(os.tmpdir(), 'ritemark-switch-test-'));
  const context = { globalStorageUri: { fsPath: storage } } as never;
  const noteFile = (name: string) => switchNoteFile(storage, name);
  const note = (name: string): unknown => (existsSync(noteFile(name)) ? JSON.parse(readFileSync(noteFile(name), 'utf8')) : undefined);
  const leave = (name: string, value: unknown) => {
    mkdirSync(path.dirname(noteFile(name)), { recursive: true });
    writeFileSync(noteFile(name), typeof value === 'string' ? value : JSON.stringify(value));
  };
  let working: { conversationId: string; runtimeId: string | null }[] = [];
  let stopped = 0;
  const fresh = () => new ProjectSwitcher({
    context,
    hereName: () => 'Leadership programme', hereUri: () => 'file:///p/lead', nameOf: () => 'Sales proposal Q4',
    workingChats: () => working, stopWorkingChats: async () => { stopped += 1; working = []; },
  });
  const sales = vscodeStub.Uri.parse('file:///p/sales') as never;
  const reset = () => {
    calls.length = 0; stopped = 0;
    rmSync(noteFile(LANDING_FILE), { force: true });
    rmSync(noteFile(SWITCHED_FROM_FILE), { force: true });
  };

  // Nothing working: no question, the window switches, and remembers where it was once it goes.
  reset();
  const switcher = fresh();
  assert.equal(await switcher.switchTo(sales), 'switched');
  assert.deepEqual(calls.map((call) => call[0]), ['vscode.openFolder']);
  // ... and the reload it starts is not asked about again, even with a chat working by then.
  working = [{ conversationId: 'c1', runtimeId: 'claude-code' }];
  assert.equal(await switcher.beforeReload('file:///p/sales'), false);
  assert.ok(!calls.some((call) => call[0] === 'ask'));
  switcher.writePendingNotes();
  assert.deepEqual(note(SWITCHED_FROM_FILE), { folderUri: 'file:///p/lead', name: 'Leadership programme', target: 'file:///p/sales', at: (note(SWITCHED_FROM_FILE) as { at: number }).at });
  // #623: only switchTo's own reload is let through. Its reload was stopped and, within the ten seconds, Open Recent
  // reloads for another folder: that one is asked about and held for itself, not written as the stopped switch's.
  reset(); working = [];
  const stoppedSwitch = fresh();
  await stoppedSwitch.switchTo(sales);
  working = [{ conversationId: 'c1', runtimeId: 'claude-code' }]; answer = 'Switch and stop';
  assert.equal(await stoppedSwitch.beforeReload('file:///p/other'), false);
  assert.ok(calls.some((call) => call[0] === 'ask'), 'another folder is asked about');
  stoppedSwitch.writePendingNotes();
  assert.equal((note(LANDING_FILE) as { target: string }).target, 'file:///p/other');
  assert.equal((note(SWITCHED_FROM_FILE) as { target: string }).target, 'file:///p/other');

  // Working: Cancel changes nothing.
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

  // #623 (a): the answer is a vote, not the outcome. Until the window goes, the switch leaves no note: when another
  // participant stops the reload, the window stays and no other window lands on a switch that never happened.
  reset(); working = [{ conversationId: 'c1', runtimeId: 'claude-code' }]; answer = 'Switch and stop';
  const vetoed = fresh();
  assert.equal(await vetoed.beforeReload('file:///p/sales'), false);
  assert.equal(note(LANDING_FILE), undefined, 'no landing note while the reload may still be stopped');
  assert.equal(note(SWITCHED_FROM_FILE), undefined);
  assert.equal(ProjectSwitcher.takeLanding(context, 'file:///p/sales'), false, 'a window opened on Sales does not land');
  assert.equal(ProjectSwitcher.takeSwitchedFrom(context, 'file:///p/sales'), null, '... nor says "Switched from"');
  // A later answer replaces it: Cancel, and the window closing then leaves nothing.
  working = [{ conversationId: 'c1', runtimeId: 'claude-code' }]; answer = 'Cancel';
  assert.equal(await vetoed.beforeReload('file:///p/sales'), true);
  vetoed.writePendingNotes();
  assert.equal(note(LANDING_FILE), undefined, 'a cancelled answer leaves nothing');
  // An answer two minutes old is not what ends the window (its reload was stopped): a later close leaves nothing.
  working = []; const old = fresh();
  await old.beforeReload('file:///p/sales');
  old.writePendingNotes(Date.now() + SWITCHED_NOTE_MS + 1);
  assert.equal(note(LANDING_FILE), undefined, 'a two-minute-old answer leaves nothing');
  // A note that can't be written (here a folder stands where the landing goes) leaves no partial file, and the other is
  // still written.
  reset();
  mkdirSync(path.join(noteFile(LANDING_FILE), 'in-the-way'), { recursive: true });
  const blocked = fresh();
  await blocked.beforeReload('file:///p/sales');
  blocked.writePendingNotes();
  assert.deepEqual(readdirSync(path.dirname(noteFile(LANDING_FILE))).filter((name) => name.endsWith('.tmp')), [], 'no partial file left');
  assert.equal((note(SWITCHED_FROM_FILE) as { target: string }).target, 'file:///p/sales', 'the other note is still written');
  rmSync(noteFile(LANDING_FILE), { recursive: true, force: true });
  // The notes carry the moment the window goes, not the answer's: a reload held by a slower question keeps its two minutes.
  const slow = fresh();
  await slow.beforeReload('file:///p/sales');
  const goesAt = Date.now() + 90_000;
  slow.writePendingNotes(goesAt);
  assert.deepEqual([(note(LANDING_FILE) as { at: number }).at, (note(SWITCHED_FROM_FILE) as { at: number }).at], [goesAt, goesAt]);
  reset();
  // The reload goes on: the notes are written as the window goes, and the window it opened lands with its note.
  const going = fresh();
  await going.beforeReload('file:///p/sales');
  going.writePendingNotes();
  console.log(`  the window goes: ${LANDING_FILE} ${JSON.stringify({ ...(note(LANDING_FILE) as object), at: '…' })}`);
  assert.equal(ProjectSwitcher.takeSwitchedFrom(context, 'file:///p/sales')?.name, 'Leadership programme');
  assert.equal(ProjectSwitcher.takeLanding(context, 'file:///p/sales'), true);

  // Go back (S32): the window returns and leaves no note of its own on the project it returns to.
  reset(); leave(SWITCHED_FROM_FILE, { folderUri: 'file:///p/old', name: 'Old', target: 'file:///p/lead', at: Date.now() });
  const back = fresh();
  assert.equal(await back.switchTo(sales, { goingBack: true }), 'switched');
  back.writePendingNotes();
  assert.equal(note(SWITCHED_FROM_FILE), undefined);
  // The note is taken once, only right after a switch, and never about the project itself.
  leave(SWITCHED_FROM_FILE, { folderUri: 'file:///p/lead', name: 'Leadership programme', target: 'file:///p/sales', at: Date.now() });
  assert.deepEqual(ProjectSwitcher.takeSwitchedFrom(context, 'file:///p/sales')?.name, 'Leadership programme');
  assert.equal(ProjectSwitcher.takeSwitchedFrom(context, 'file:///p/sales'), null, 'once');
  leave(SWITCHED_FROM_FILE, { folderUri: 'file:///p/sales', name: 'Sales', target: 'file:///p/sales', at: Date.now() });
  assert.equal(ProjectSwitcher.takeSwitchedFrom(context, 'file:///p/sales'), null, 'not about itself');
  assert.equal(note(SWITCHED_FROM_FILE), undefined, 'a note about itself is dropped');

  // R9, S30: every switch in place lands on Home in the next window, Go back and Open Recent included; once, only in
  // the folder it opened (any other folder when the window did not know it), only right after the switch.
  reset(); working = [];
  const goneTo = async (route: (switcher: ProjectSwitcher) => Promise<unknown>) => {
    const window = fresh();
    await route(window);
    window.writePendingNotes();
  };
  await goneTo((window) => window.switchTo(sales, { goingBack: true }));
  assert.equal(ProjectSwitcher.takeLanding(context, 'file:///p/sales/'), true, 'Go back lands on Home too');
  assert.equal(ProjectSwitcher.takeLanding(context, 'file:///p/sales'), false, 'once');
  await goneTo((window) => window.beforeReload('file:///p/sales'));
  assert.equal(ProjectSwitcher.takeLanding(context, 'file:///p/sales'), true, 'Open Recent');
  await goneTo((window) => window.beforeReload(undefined));
  assert.equal(ProjectSwitcher.takeLanding(context, 'file:///p/lead'), false, 'Open Folder… back into the same folder is no switch');
  assert.equal(note(LANDING_FILE), undefined, '... and its window spends the note: no later window lands on it');
  await goneTo((window) => window.beforeReload(undefined));
  assert.equal(ProjectSwitcher.takeLanding(context, 'file:///p/elsewhere'), true, 'Open Folder… into another folder');
  leave(LANDING_FILE, { from: 'file:///p/lead', target: 'file:///p/sales', at: Date.now() - 3 * 60 * 1000 });
  assert.equal(ProjectSwitcher.takeLanding(context, 'file:///p/sales'), false, 'too late');
  assert.equal(note(LANDING_FILE), undefined, 'a stale note is dropped');

  // #623 (b): read first, take only what is for this window. A window on another folder (or with none) starting within
  // the two minutes leaves the note for the window the switch opened; an unusable note goes.
  reset();
  await goneTo((window) => window.switchTo(sales));
  assert.equal(ProjectSwitcher.takeLanding(context, 'file:///p/other'), false, 'not in another folder');
  assert.equal(ProjectSwitcher.takeSwitchedFrom(context, 'file:///p/other'), null);
  assert.equal(ProjectSwitcher.takeLanding(context, null), false, 'not in a window with no folder');
  assert.equal(ProjectSwitcher.takeLanding(context, 'file:///p/sales'), true, '... the switched window still lands');
  assert.equal(ProjectSwitcher.takeSwitchedFrom(context, 'file:///p/sales')?.name, 'Leadership programme', '... and still says where it came from');
  // A target-less note keeps today's rule: the first window that reads it takes it, landing on another folder.
  leave(LANDING_FILE, { from: 'file:///p/lead', target: null, at: Date.now() });
  assert.equal(ProjectSwitcher.takeLanding(context, 'file:///p/elsewhere'), true);
  assert.equal(note(LANDING_FILE), undefined);
  // A "Switched from" note always names its target; one without is unusable.
  leave(SWITCHED_FROM_FILE, { folderUri: 'file:///p/lead', name: 'Leadership programme', at: Date.now() });
  assert.equal(ProjectSwitcher.takeSwitchedFrom(context, 'file:///p/elsewhere'), null);
  assert.equal(note(SWITCHED_FROM_FILE), undefined, 'dropped');
  // Unusable notes are dropped: not JSON, no time, from the future.
  for (const bad of ['{not json', { from: 'file:///p/lead', target: 'file:///p/sales' }, { from: null, target: 'file:///p/sales', at: Date.now() + 60_000 }]) {
    leave(LANDING_FILE, bad);
    assert.equal(ProjectSwitcher.takeLanding(context, 'file:///p/other'), false);
    assert.equal(note(LANDING_FILE), undefined, `dropped: ${JSON.stringify(bad)}`);
  }
  // The pure rules: a note with a target as the shell's `ritemarkReadLanding` (patch 018) reads its own; one without,
  // today's rule (the shell keeps that one in the folder it left: see #629's shell follow-up).
  const now = Date.now();
  assert.deepEqual(
    [
      readLanding({ from: 'file:///p/lead', target: 'file:///p/sales', at: now }, 'file:///p/sales', now),
      readLanding({ from: 'file:///p/lead', target: 'file:///p/sales', at: now }, 'file:///p/other', now),
      readLanding({ from: 'file:///p/lead', target: null, at: now }, 'file:///p/other', now),
      readLanding({ from: 'file:///p/lead', target: null, at: now }, 'file:///p/lead', now),
      readLanding({ from: 'file:///p/lead', target: null, at: now }, null, now),
      readLanding({ from: 'file:///p/lead', target: 'file:///p/sales', at: now }, null, now),
      readLanding({ at: now - SWITCHED_NOTE_MS - 1 }, 'file:///p/sales', now),
      readSwitchedFrom({ folderUri: 'file:///p/lead', name: 'L', target: 'file:///p/sales', at: now }, 'file:///p/sales', now),
      readSwitchedFrom({ folderUri: 'file:///p/lead', name: 'L', target: 'file:///p/sales', at: now }, 'file:///p/other', now),
      readSwitchedFrom({ folderUri: 'file:///p/lead', at: now }, 'file:///p/sales', now),
    ],
    ['take', 'keep', 'take', 'drop', 'drop', 'keep', 'drop', 'take', 'keep', 'drop'],
  );
  rmSync(storage, { recursive: true, force: true });

  console.log('projects/switchProject: all assertions passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
