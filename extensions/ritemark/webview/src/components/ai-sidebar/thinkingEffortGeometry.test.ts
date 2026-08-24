import assert from 'node:assert/strict';
import { getThinkingEffortFillWidth } from './thinkingEffortGeometry';

assert.equal(getThinkingEffortFillWidth(0, 0), '0%');
assert.equal(
  getThinkingEffortFillWidth(1, 0),
  'calc(50% + 8px)',
  'A singleton capability keeps its native zero-range thumb and progress centered',
);
assert.equal(getThinkingEffortFillWidth(5, 0), 'calc(23px + (100% - 30px) * 0)');
assert.equal(getThinkingEffortFillWidth(5, 3), 'calc(23px + (100% - 30px) * 0.75)');
assert.equal(getThinkingEffortFillWidth(5, 4), '100%');

console.log('thinkingEffortGeometry tests passed.');
