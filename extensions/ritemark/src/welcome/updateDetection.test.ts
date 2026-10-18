/**
 * Sprint 133 (R10, R11, W6): telling a Ritemark 1 profile from a new one, once.
 * Run: npx tsx src/welcome/updateDetection.test.ts
 */

import assert from 'node:assert/strict';
import { classifyProfile, isRitemark1Version, opensAtStart, welcomeKind } from './updateDetection';

const none = { storedKind: undefined, lastConfirmedVersion: '', hasAnonymousId: false, hasSeenNotice: false };

// A new profile: nothing Ritemark 1 wrote.
assert.deepEqual(classifyProfile(none), { kind: 'fresh', store: true });

// Ritemark 1 profiles, as the four v1.14.0 profiles stored them (research/confirmations.md).
assert.deepEqual(classifyProfile({ ...none, lastConfirmedVersion: '1.14.0-0', hasAnonymousId: true, hasSeenNotice: true }), { kind: 'update', store: true });
assert.deepEqual(classifyProfile({ ...none, lastConfirmedVersion: '1.12.0-ext.2' }), { kind: 'update', store: true });
// Older than the activation keys (Sprint 93): the anonymous id or the notice give it away.
assert.deepEqual(classifyProfile({ ...none, hasAnonymousId: true }), { kind: 'update', store: true });
assert.deepEqual(classifyProfile({ ...none, hasSeenNotice: true }), { kind: 'update', store: true });

// Decided once: on later starts the stored kind wins, though this build's own
// version (1.14.0 until step 4) is now in lastConfirmedVersion.
assert.deepEqual(classifyProfile({ ...none, storedKind: 'fresh', lastConfirmedVersion: '1.14.0' }), { kind: 'fresh', store: false });
assert.deepEqual(classifyProfile({ ...none, storedKind: 'update', lastConfirmedVersion: '1.14.0' }), { kind: 'update', store: false });
// A stored value that is not a kind is ignored.
assert.deepEqual(classifyProfile({ ...none, storedKind: 'weird' }), { kind: 'fresh', store: true });
// A 2.x version is not Ritemark 1.
assert.deepEqual(classifyProfile({ ...none, lastConfirmedVersion: '2.0.0-0' }), { kind: 'fresh', store: true });

assert.equal(isRitemark1Version('1.14.0-0'), true);
assert.equal(isRitemark1Version('0.9.1'), true);
assert.equal(isRitemark1Version('2.0.0'), false);
assert.equal(isRitemark1Version('garbage'), false);

// Finished once a project has been opened from it: the short start sheet.
assert.equal(welcomeKind('fresh', undefined), 'fresh');
assert.equal(welcomeKind('update', undefined), 'update');
assert.equal(welcomeKind('fresh', { kind: 'fresh', at: '2026-10-18T10:00:00Z' }), 'start');
assert.equal(welcomeKind('update', { kind: 'update', at: '2026-10-18T10:00:00Z' }), 'start');
assert.equal(welcomeKind('update', { at: 'x' }), 'update', 'a malformed record is not a finish');

// When it opens at start.
assert.equal(opensAtStart({ kind: 'fresh', hasFolder: false, openingFiles: false }), true, 'S1');
assert.equal(opensAtStart({ kind: 'fresh', hasFolder: true, openingFiles: false }), false, 'R11: a first window with a folder');
assert.equal(opensAtStart({ kind: 'fresh', hasFolder: false, openingFiles: true }), false, 'R11: a first window opened with a file');
assert.equal(opensAtStart({ kind: 'update', hasFolder: true, openingFiles: false }), true, 'R10: whether or not the window restored a folder');
assert.equal(opensAtStart({ kind: 'start', hasFolder: false, openingFiles: false }), true, 'S48');
assert.equal(opensAtStart({ kind: 'start', hasFolder: true, openingFiles: false }), false);

console.log('✓ updateDetection tests passed');
