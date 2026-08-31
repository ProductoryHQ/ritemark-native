import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canCompleteViewResolution,
  canonicalJson,
  classifyAcceptedModelEdit,
  classifyStaleViewEdit,
  classifyThreeWay,
  observeLocalSaveReceipts,
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

test('a delayed local save remains local-only when the model has advanced', () => {
  assert.deepEqual(observeLocalSaveReceipts([{ sequence: 1, hash: 'local-b' }], 'local-b', 'local-c', 1), {
    remainingReceipts: [],
    state: 'local-only',
  });
});

test('post-participant save content is recognized after format-on-save', () => {
  assert.deepEqual(observeLocalSaveReceipts([{ sequence: 1, hash: 'post-format' }], 'post-format', 'newer-local', 1), {
    remainingReceipts: [],
    state: 'local-only',
  });
});

test('collapsed saves consume through the newest matching local snapshot', () => {
  const receipts = [
    { sequence: 1, hash: 'local-b' },
    { sequence: 2, hash: 'local-c' },
    { sequence: 3, hash: 'local-b' },
    { sequence: 4, hash: 'local-d' },
  ];
  assert.deepEqual(observeLocalSaveReceipts(receipts, 'local-b', 'local-e', 3), {
    remainingReceipts: [{ sequence: 4, hash: 'local-d' }],
    state: 'local-only',
  });
  assert.deepEqual(observeLocalSaveReceipts(receipts, 'local-b', 'local-e', 4), {
    remainingReceipts: [],
  });
  assert.deepEqual(observeLocalSaveReceipts([{ sequence: 1, hash: 'local-b' }], 'local-b', 'local-b', 1), {
    remainingReceipts: [],
    state: 'synced',
  });
});

test('an unconfirmed or canceled save attempt cannot hide a real external conflict', () => {
  assert.deepEqual(observeLocalSaveReceipts([], 'canceled-attempt', 'newer-local', 0), {
    remainingReceipts: [],
  });
});

test('an unmatched disk observation retires only receipts it can order after', () => {
  assert.deepEqual(observeLocalSaveReceipts(
    [{ sequence: 1, hash: 'local-b' }],
    'external-d',
    'local-c',
    1,
  ), { remainingReceipts: [] });
  assert.deepEqual(observeLocalSaveReceipts(
    [{ sequence: 2, hash: 'local-b' }],
    'older-disk-a',
    'local-c',
    1,
  ), { remainingReceipts: [{ sequence: 2, hash: 'local-b' }] });
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

test('a stale full-document edit never overwrites a newer dirty model', () => {
  assert.equal(classifyStaleViewEdit('disk-b', 'disk-b', 'local-c'), 'materialize-conflict');
  assert.equal(classifyStaleViewEdit('peer-c', 'disk-b', 'local-d'), 'reject');
  assert.equal(classifyStaleViewEdit('same', 'disk-b', 'same'), 'already-current');
  assert.equal(classifyStaleViewEdit('model-a', undefined, 'local-b'), 'reject');
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
