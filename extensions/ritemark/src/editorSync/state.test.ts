import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canCompleteViewResolution,
  canonicalJson,
  classifyAcceptedModelEdit,
  classifyThreeWay,
  initializeThreeWayState,
  normalizeLogicalText,
} from './state';

test('three-way classifier keeps ordinary local autosave lag quiet', () => {
  assert.equal(classifyThreeWay({ baseDiskHash: 'a', baseModelHash: 'a', diskHash: 'a', modelHash: 'b' }), 'local-only');
});

test('three-way classifier distinguishes external-only, converged, and conflict', () => {
  assert.equal(classifyThreeWay({ baseDiskHash: 'a', baseModelHash: 'a', diskHash: 'b', modelHash: 'a' }), 'external-only');
  assert.equal(classifyThreeWay({ baseDiskHash: 'a', baseModelHash: 'a', diskHash: 'b', modelHash: 'b' }), 'converged');
  assert.equal(classifyThreeWay({ baseDiskHash: 'a', baseModelHash: 'a', diskHash: 'b', modelHash: 'c' }), 'conflict');
});

test('logical normalization ignores one BOM and EOL representation', () => {
  assert.equal(normalizeLogicalText('\uFEFFa\r\nb\r'), 'a\nb\n');
});

test('canonical JSON sorts nested object keys without reordering arrays', () => {
  assert.equal(canonicalJson({ z: 1, a: { d: 2, c: [3, 1] } }), '{"a":{"c":[3,1],"d":2},"z":1}');
});

test('a pre-existing dirty model is local-only against the disk base', () => {
  assert.deepEqual(initializeThreeWayState('disk-a', 'local-b', true), {
    baseDiskLogicalHash: 'disk-a',
    baseModelHash: 'disk-a',
    state: 'local-only',
  });
  assert.deepEqual(initializeThreeWayState('same', 'same', false), {
    baseDiskLogicalHash: 'same',
    baseModelHash: 'same',
    state: 'synced',
  });
});

test('a clean model lagging disk is initialized for external import', () => {
  assert.deepEqual(initializeThreeWayState('disk-b', 'model-a', false), {
    baseDiskLogicalHash: 'model-a',
    baseModelHash: 'model-a',
    state: 'synced',
  });
});

test('typing during conflict extends the local snapshot instead of dropping the edit', () => {
  assert.equal(classifyAcceptedModelEdit('base', 'local-next', true, false), 'conflict');
  assert.equal(classifyAcceptedModelEdit('base', 'local-next', true, true), 'local-only');
});

test('resolution waits for every visible view but not dormant views', () => {
  assert.equal(canCompleteViewResolution(4, [
    { visible: true, disposed: false, acknowledgedRevision: 4 },
    { visible: true, disposed: false, acknowledgedRevision: 3 },
  ]), false);
  assert.equal(canCompleteViewResolution(4, [
    { visible: true, disposed: false, acknowledgedRevision: 4 },
    { visible: false, disposed: false, acknowledgedRevision: 1 },
    { visible: true, disposed: true, acknowledgedRevision: 0 },
  ]), true);
});
