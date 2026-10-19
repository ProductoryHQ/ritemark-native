/**
 * Sprint 134 (R9, S31, S33): the question before a switch, in words.
 * Run: npx tsx src/projects/switchProject.test.ts
 */

import assert from 'node:assert/strict';
import Module from 'node:module';

// switchProject.ts imports vscode for its glue; the words are pure.
const load = (Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown })._load;
(Module as unknown as { _load: unknown })._load = (request: string, ...rest: unknown[]) => (request === 'vscode' ? {} : load(request, ...rest));

async function main(): Promise<void> {
  const { switchQuestion } = await import('./switchProject');

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
  assert.deepEqual(unknown.buttons.map((button) => button.choice), ['switch-and-stop']);

  // A runtime Ritemark can't name.
  assert.equal(switchQuestion([null], 'A', 'B').title, 'The AI is still working in A');

  console.log('projects/switchProject: all assertions passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
