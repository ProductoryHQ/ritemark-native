import assert from 'node:assert/strict';
import {
  CODEX_DEFAULT_MODEL_SENTINEL,
  getCodexModelFromSelectValue,
  getCodexModelSelectValue,
} from './codexModelSelect';

console.log('Testing Codex model select helpers...');

assert.equal(
  getCodexModelSelectValue(''),
  CODEX_DEFAULT_MODEL_SENTINEL,
  'empty model should map to a non-empty sentinel'
);

assert.equal(
  getCodexModelSelectValue(undefined),
  CODEX_DEFAULT_MODEL_SENTINEL,
  'undefined model should map to a non-empty sentinel'
);

assert.equal(
  getCodexModelSelectValue('gpt-5.3-codex'),
  'gpt-5.3-codex',
  'real model id should pass through unchanged'
);

assert.equal(
  getCodexModelFromSelectValue(CODEX_DEFAULT_MODEL_SENTINEL),
  '',
  'sentinel should map back to empty model storage'
);

assert.equal(
  getCodexModelFromSelectValue('gpt-5.3-codex'),
  'gpt-5.3-codex',
  'real model id should remain unchanged'
);

console.log('\n✅ Codex model select helper tests passed!');
