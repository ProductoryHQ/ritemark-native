/**
 * Sprint 134 (R5, S18–S22): Home and Tasks, first and pinned.
 * Run: npx tsx src/views/permanentTabs.test.ts
 */

import assert from 'node:assert/strict';
import Module from 'node:module';

// permanentTabs.ts imports vscode for its glue; the plan is pure.
const load = (Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown })._load;
(Module as unknown as { _load: unknown })._load = (request: string, ...rest: unknown[]) => (request === 'vscode' ? {} : load(request, ...rest));

async function main(): Promise<void> {
  const { planPermanentTabs } = await import('./permanentTabs');
  const other = { kind: 'other' as const, pinned: false };
  const home = (pinned = true) => ({ kind: 'home' as const, pinned });
  const board = (pinned = true) => ({ kind: 'board' as const, pinned });

  // S18: a fresh window: both opened, Home first.
  assert.deepEqual(planPermanentTabs([], true), [{ kind: 'home', action: 'open' }, { kind: 'board', action: 'open' }]);
  // S19: restored as they were: nothing to do.
  assert.deepEqual(planPermanentTabs([home(), board(), other, other], true), []);
  // One missing.
  assert.deepEqual(planPermanentTabs([board(), other], true), [{ kind: 'home', action: 'open' }]);
  assert.deepEqual(planPermanentTabs([home(), other], true), [{ kind: 'board', action: 'open' }]);
  // Restored but not pinned, or not first.
  assert.deepEqual(planPermanentTabs([other, home(false), board()], true), [{ kind: 'home', action: 'pin' }]);
  assert.deepEqual(planPermanentTabs([board(), home()], true), [{ kind: 'home', action: 'pin' }]);
  assert.deepEqual(planPermanentTabs([home(), other, board(false)], true), [{ kind: 'board', action: 'pin' }]);
  // S22: the board flag off: Home alone, and a board tab the window restored goes.
  assert.deepEqual(planPermanentTabs([], false), [{ kind: 'home', action: 'open' }]);
  assert.deepEqual(planPermanentTabs([home(), other], false), []);
  assert.deepEqual(planPermanentTabs([home(), board(), other], false), [{ kind: 'board', action: 'remove' }]);
  assert.deepEqual(planPermanentTabs([board(), other], false), [{ kind: 'home', action: 'open' }, { kind: 'board', action: 'remove' }]);

  console.log('views/permanentTabs: all assertions passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
