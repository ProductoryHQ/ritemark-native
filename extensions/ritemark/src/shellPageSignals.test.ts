/**
 * Sprint 152 (PR 3): the messages a desk page posts for the shell's loading look are the shell's own strings, and a host
 * that checks what it receives leaves them alone. The shell's names live in patch 002 (`ritemarkLoadingLook.ts`), and so
 * does W5's command, which `aiStartingMark.ts` asks.
 * Run: npx tsx src/shellPageSignals.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isShellPageSignal, PAGE_DRAWING, PAGE_DRAWN } from './shellPageSignals';
import { SHELL_LOOK_SINCE_COMMAND } from './views/aiStartingMark';

const root = path.resolve(__dirname, '..', '..', '..');
const patch = readFileSync(path.join(root, 'patches', 'vscode', '002-ritemark-ui-layout.patch'), 'utf8');
assert.ok(patch.includes(`+export const RITEMARK_PAGE_DRAWING = '${PAGE_DRAWING}';`), 'the shell waits for the same "drawing"');
assert.ok(patch.includes(`+export const RITEMARK_PAGE_DRAWN = '${PAGE_DRAWN}';`), 'the shell waits for the same "drawn"');
assert.ok(patch.includes(`+CommandsRegistry.registerCommand('${SHELL_LOOK_SINCE_COMMAND}',`), 'the shell answers the command the AI view asks');

assert.equal(isShellPageSignal({ type: PAGE_DRAWING }), true);
assert.equal(isShellPageSignal({ type: PAGE_DRAWN }), true);
for (const other of [{ type: 'home/ready' }, { type: 'ritemark/pageDrawnLater' }, null, undefined, 'ritemark/pageDrawn', 7, {}]) {
  assert.equal(isShellPageSignal(other), false, `not the shell's: ${JSON.stringify(other)}`);
}

console.log('shellPageSignals: all assertions passed');
