/**
 * Sprint 139 (#417, R6): a chat's saved model, and the one line when it's gone.
 *
 * Run: npx tsx src/runtime/modelSubstitution.test.ts
 */

import assert from 'node:assert/strict';
import { modelSubstitutionForTurn } from './modelSubstitution';

const offered = new Map([
  ['gpt-5.6-sol', 'gpt-5.6-sol'],
  ['gpt-6-luna', 'gpt-6-luna'],
  ['google/gemini-4-argon', 'google/gemini-4-argon'],
  ['claude-sonnet-5', 'claude-sonnet-5'],
  ['sonnet', 'claude-sonnet-5'],
]);
const catalog = { idOf: (id: string) => offered.get(id) };

// S33/S35: a saved model the catalog still offers: no line, whatever the AI.
assert.equal(modelSubstitutionForTurn({ runtimeId: 'codex', chatSavedModel: 'gpt-6-luna', turnModel: 'gpt-6-luna', catalog }), undefined);
assert.equal(modelSubstitutionForTurn({ runtimeId: 'opencode', chatSavedModel: 'google/gemini-4-argon', turnModel: 'google/gemini-4-argon', catalog }), undefined);

// S38: a saved model the catalog no longer offers, replaced by the default: one line, for ChatGPT and OpenCode too.
assert.deepEqual(
  modelSubstitutionForTurn({ runtimeId: 'codex', chatSavedModel: 'gpt-5.5-retired', turnModel: 'gpt-5.6-sol', catalog }),
  { from: 'gpt-5.5-retired', to: 'gpt-5.6-sol' },
);
assert.deepEqual(
  modelSubstitutionForTurn({ runtimeId: 'opencode', chatSavedModel: 'google/gemini-2-old', turnModel: 'google/gemini-4-argon', catalog }),
  { from: 'google/gemini-2-old', to: 'google/gemini-4-argon' },
);
// The person picked the same retired model again (it still runs): nothing to name.
assert.equal(modelSubstitutionForTurn({ runtimeId: 'codex', chatSavedModel: 'gpt-5.5-retired', turnModel: 'gpt-5.5-retired', catalog }), undefined);
// Aliases are the same model.
assert.equal(modelSubstitutionForTurn({ runtimeId: 'claude-code', chatSavedModel: 'claude-sonnet-5', turnModel: 'sonnet', catalog }), undefined);

// A chat with no saved model (new, or from 2.0): Claude keeps Sprint 127 R6's app-wide check; the others say nothing.
let asked = 0;
const appWide = () => { asked += 1; return { from: 'claude-opus-4-retired', to: 'claude-sonnet-5' }; };
assert.deepEqual(
  modelSubstitutionForTurn({ runtimeId: 'claude-code', chatSavedModel: undefined, turnModel: 'claude-sonnet-5', catalog, appWideSubstitution: appWide }),
  { from: 'claude-opus-4-retired', to: 'claude-sonnet-5' },
);
assert.equal(modelSubstitutionForTurn({ runtimeId: 'codex', chatSavedModel: undefined, turnModel: 'gpt-5.6-sol', catalog, appWideSubstitution: appWide }), undefined);
assert.equal(asked, 1, "the app-wide pick is Claude's only");
// A chat's own saved model wins over the app-wide pick.
assert.equal(modelSubstitutionForTurn({ runtimeId: 'claude-code', chatSavedModel: 'claude-sonnet-5', turnModel: 'claude-sonnet-5', catalog, appWideSubstitution: appWide }), undefined);
assert.equal(asked, 1);

console.log('modelSubstitution.test.ts: all tests passed');
