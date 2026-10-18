/**
 * Sprint 133 (R6, S21–S23): the landing is read once after the reload.
 * Run: npx tsx src/welcome/landing.test.ts
 */

import assert from 'node:assert/strict';
import { LANDING_MAX_AGE_MS, decideLanding, isLandingRecord, landingPlaceholder, type LandingRecord } from './landing';

const folder = 'file:///Users/someone/Documents/Ritemark/Board%20report%202026';
const now = 1_760_000_000_000;
const record: LandingRecord = { folder, provider: 'claude', source: 'new_project', counted: true, at: now - 4_000 };

assert.deepEqual(decideLanding({ stored: undefined, windowFolder: folder, folderExists: true, now }), { action: 'none', deleteRecord: false });
assert.deepEqual(decideLanding({ stored: record, windowFolder: folder, folderExists: true, now }), { action: 'land', record }, 'S21');

// Landing once (S22): another folder drops the record without landing.
assert.deepEqual(decideLanding({ stored: record, windowFolder: 'file:///elsewhere', folderExists: true, now }), { action: 'none', deleteRecord: true });
// Older than ten minutes: dropped.
assert.deepEqual(decideLanding({ stored: { ...record, at: now - LANDING_MAX_AGE_MS - 1 }, windowFolder: folder, folderExists: true, now }), { action: 'none', deleteRecord: true });
// A clock that went backwards is not a fresh landing.
assert.deepEqual(decideLanding({ stored: { ...record, at: now + 60_000 }, windowFolder: folder, folderExists: true, now }), { action: 'none', deleteRecord: true });
// The folder is gone (S23), whether the window opened on it or came up empty.
assert.deepEqual(decideLanding({ stored: record, windowFolder: folder, folderExists: false, now }), { action: 'folder-gone', record });
assert.deepEqual(decideLanding({ stored: record, windowFolder: undefined, folderExists: false, now }), { action: 'folder-gone', record });
// Another empty window within the ten minutes leaves the record for the real landing.
assert.deepEqual(decideLanding({ stored: record, windowFolder: undefined, folderExists: true, now }), { action: 'none', deleteRecord: false });
// A malformed record is dropped.
assert.deepEqual(decideLanding({ stored: { folder }, windowFolder: folder, folderExists: true, now }), { action: 'none', deleteRecord: true });

assert.equal(isLandingRecord(record), true);
assert.equal(isLandingRecord({ ...record, provider: 'codex' }), false, 'providers by the names people know');
assert.equal(isLandingRecord({ ...record, provider: null }), true, 'skipped: no AI');

assert.equal(landingPlaceholder('claude'), 'Ask Claude about this project');
assert.equal(landingPlaceholder('chatgpt'), 'Ask ChatGPT about this project');
assert.equal(landingPlaceholder(null), null);

console.log('✓ landing tests passed');
