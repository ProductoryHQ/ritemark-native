import assert from 'node:assert/strict';
import {
  EXPLICIT_THINKING_EFFORTS,
  isThinkingEffort,
  thinkingEffortLabel,
  validateThinkingEffort,
} from './thinkingEffort';
import type { ThinkingEffortCapability } from './thinkingEffort';

const capability: ThinkingEffortCapability = {
  selectable: ['low', 'high', 'xhigh'],
  defaultLevel: 'high' as const,
  source: 'model-catalog' as const,
  supportsAppliedValue: false,
};

assert.deepEqual(EXPLICIT_THINKING_EFFORTS, ['low', 'medium', 'high', 'xhigh', 'max', 'ultra']);
assert.equal(isThinkingEffort('ultra'), true);
assert.equal(isThinkingEffort('extreme'), false);
assert.equal(thinkingEffortLabel('xhigh'), 'Extra');
assert.equal(thinkingEffortLabel('ultra'), 'Ultra');
assert.equal(validateThinkingEffort('high', capability), 'high');
assert.equal(validateThinkingEffort('medium', capability), 'auto');
assert.equal(validateThinkingEffort('unexpected', capability), 'auto');

console.log('thinkingEffort.test.ts: all tests passed');
