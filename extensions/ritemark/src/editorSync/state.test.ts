import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canCompleteViewResolution,
  canonicalJson,
  canonicalMarkdownProjection,
  classifyAcceptedModelEdit,
  classifyRefusedSave,
  classifyStaleViewEdit,
  classifyThreeWay,
  droppedRecentSave,
  ensureTrailingNewline,
  observeLocalSaveReceipts,
  initializeThreeWayState,
  normalizeLogicalText,
  STALE_WRITE_WINDOW_MS,
} from './state';

test('a refused save: converged, disk text unchanged, or a real conflict (#454, R10, R11)', () => {
  // S49: a tool wrote exactly the person's text.
  assert.equal(classifyRefusedSave({ baseDiskLogicalHash: 'a', diskLogicalHash: 'b', modelLogicalHash: 'b' }), 'converged');
  // S47: a sync client touched the file or rewrote its line endings; the words are the ones the person started from.
  assert.equal(classifyRefusedSave({ baseDiskLogicalHash: 'a', diskLogicalHash: 'a', modelLogicalHash: 'b' }), 'disk-unchanged');
  // S40: an agent changed the text while the person typed.
  assert.equal(classifyRefusedSave({ baseDiskLogicalHash: 'a', diskLogicalHash: 'c', modelLogicalHash: 'b' }), 'conflict');
  // Converged wins even when the base also matches (nothing to save, nothing to ask).
  assert.equal(classifyRefusedSave({ baseDiskLogicalHash: 'a', diskLogicalHash: 'a', modelLogicalHash: 'a' }), 'converged');
});

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

test('ensureTrailingNewline appends exactly one newline when the body lacks one', () => {
  assert.equal(ensureTrailingNewline('- [ ] plain bullet'), '- [ ] plain bullet\n');
});

test('ensureTrailingNewline is a no-op when the body already ends in a newline', () => {
  assert.equal(ensureTrailingNewline('# Canary\n\njust a paragraph\n'), '# Canary\n\njust a paragraph\n');
});

test('ensureTrailingNewline never turns an empty body into a bare newline', () => {
  assert.equal(ensureTrailingNewline(''), '');
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

// Shared with webview/src/editorValueReconciliation.test.ts — keep both tables identical.
const canonicalProjectionVectors: Array<[string, string, string]> = [
  ['alpha\n', 'alpha', 'trailing newline added by ensureTrailingNewline'],
  ['alpha\n\n\n', 'alpha', 'several trailing newlines'],
  ['\nalpha', 'alpha', 'leading newline left by gray-matter behind front matter'],
  ['\n\n# Title\n\nbody\n', '# Title\n\nbody', 'both ends trimmed, inner blank line kept'],
  ['alpha\r\nbeta\r\n', 'alpha\nbeta', 'CRLF document compares as LF'],
  ['\uFEFFalpha\n', 'alpha', 'UTF-8 BOM'],
  ['', '', 'empty document'],
  ['\n', '', 'newline-only document'],
  ['  indented', '  indented', 'leading spaces are content'],
  ['alpha  \n', 'alpha  ', 'trailing spaces before the newline are content'],
  ['- [ ]', '- [ ]', 'a bare task marker is content'],
];

test('canonicalMarkdownProjection makes the persisted body and the editor projection compare equal', () => {
  for (const [input, expected, why] of canonicalProjectionVectors) {
    assert.equal(canonicalMarkdownProjection(input), expected, why);
  }
});

test('canonicalMarkdownProjection is idempotent', () => {
  for (const [input] of canonicalProjectionVectors) {
    const once = canonicalMarkdownProjection(input);
    assert.equal(canonicalMarkdownProjection(once), once);
  }
});

// Sprint 145 R1 (#588): the stale-write guard's decision.
const BASE = '# Title\n\nThe second line.\n\nThe third line.\n';
const SAVE_A = '# Title\n\nThe second line.\n\nThe third line. Alpha words typed first.\n';
const SAVE_B = '# Title\n\nThe second line.\n\nThe third line. Alpha words typed first. Bravo words typed second.\n';
const NOW = 1_000_000;
const recentSaves = [
  { text: SAVE_A, previousText: BASE, savedAt: NOW - 6_000 },
  { text: SAVE_B, previousText: SAVE_A, savedAt: NOW - 1_000 },
];
const lost = (diskText: string, saves = recentSaves, now = NOW) =>
  droppedRecentSave({ saves, diskText, now, windowMs: STALE_WRITE_WINDOW_MS });

test('#588 S1: a writer that read before the second save drops its words', () => {
  assert.equal(lost(SAVE_A.replace('# Title', '# Title, edited by the writer')), 4);
});

test('#588 S2: a writer that read the latest save drops nothing', () => {
  assert.equal(lost(SAVE_B.replace('# Title', '# Title, edited by the writer')), 0);
  assert.equal(lost(SAVE_B), 0);
});

test('#588 S4: a writer that rewrites the sentence just typed drops it (decision 1)', () => {
  assert.equal(lost(SAVE_B.replace('Bravo words typed second.', 'Something else entirely.')), 4);
});

test('#588 S5: line endings and a byte order mark are not a loss', () => {
  assert.equal(lost(SAVE_B.replace(/\n/g, '\r\n')), 0);
  assert.equal(lost(`﻿${SAVE_B}`), 0);
  const crlfSaves = recentSaves.map(save => ({
    ...save,
    text: save.text.replace(/\n/g, '\r\n'),
    previousText: save.previousText.replace(/\n/g, '\r\n'),
  }));
  assert.equal(lost(SAVE_B, crlfSaves), 0);
  assert.equal(lost(SAVE_A, crlfSaves), 4);
});

test('#588: a rewrap, a moved paragraph or a changed neighbour keeps the words', () => {
  assert.equal(lost(SAVE_B.replace('Alpha words typed first. Bravo', 'Alpha words typed first.\nBravo')), 0);
  assert.equal(lost('# Title\n\nThe third line. Alpha words typed first. Bravo words typed second.\n\nThe second line, rewritten.\n'), 0);
});

test('#588: a common word elsewhere does not hide a lost sentence', () => {
  const saves = [{ text: 'the cat sat on the mat\n\nthe end and the start\n', previousText: 'the cat sat on the mat\n', savedAt: NOW - 500 }];
  // Every word of the new paragraph is elsewhere in the writer's copy, but not the run.
  assert.equal(lost('the cat sat on the mat and the end start\n', saves), 5);
});

test('#588: a writer that removes another copy of a word the person typed is not a loss', () => {
  const saves = [{ text: 'Notes on text\n\nMore text here.\n', previousText: 'Notes on text\n', savedAt: NOW - 500 }];
  assert.equal(lost('Notes\n\nMore text here.\n', saves), 0);
});

test('#588: saves outside the window, no saves, and words the person removed do not count', () => {
  assert.equal(lost(SAVE_A, recentSaves, NOW + STALE_WRITE_WINDOW_MS), 0, 'both saves are older than the window');
  assert.equal(lost(BASE, recentSaves, NOW - 1_000 + STALE_WRITE_WINDOW_MS), 4, 'only the newer save is inside');
  assert.equal(lost(BASE, []), 0);
  const removed = [
    { text: SAVE_A, previousText: BASE, savedAt: NOW - 3_000 },
    { text: BASE, previousText: SAVE_A, savedAt: NOW - 1_000 },
  ];
  assert.equal(lost(BASE, removed), 0, 'the person deleted their own sentence again');
});

test('#588 S7: a CSV cell next to the person\'s cell, and a dropped row', () => {
  const before = 'name,amount\nTea,3\nCoffee,4\n';
  const saved = 'name,amount\nTea,3\nCoffee,4\nCake,5\n';
  const saves = [{ text: saved, previousText: before, savedAt: NOW - 500 }];
  assert.equal(lost('name,amount\nTea,3\nCoffee,9\nCake,5\n', saves), 0, 'another cell changed, the new row kept');
  assert.equal(lost('name,amount\nTea,3\nCoffee,9\n', saves), 2, 'the new row is gone');
});
