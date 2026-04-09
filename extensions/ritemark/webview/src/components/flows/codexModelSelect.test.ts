/**
 * Unit tests for Codex model select sentinel mapping.
 * Run: npx tsx webview/src/components/flows/codexModelSelect.test.ts
 */

import * as assert from 'assert';
import {
  CODEX_DEFAULT_MODEL_SENTINEL,
  getCodexModelFromSelectValue,
  getCodexModelSelectValue,
} from './codexModelSelect';

assert.strictEqual(
  getCodexModelSelectValue(''),
  CODEX_DEFAULT_MODEL_SENTINEL
);
assert.strictEqual(
  getCodexModelSelectValue(undefined),
  CODEX_DEFAULT_MODEL_SENTINEL
);
assert.strictEqual(getCodexModelSelectValue('gpt-5.4'), 'gpt-5.4');

assert.strictEqual(
  getCodexModelFromSelectValue(CODEX_DEFAULT_MODEL_SENTINEL),
  ''
);
assert.strictEqual(getCodexModelFromSelectValue('gpt-5.4'), 'gpt-5.4');

console.log('All codex model select tests passed.');
