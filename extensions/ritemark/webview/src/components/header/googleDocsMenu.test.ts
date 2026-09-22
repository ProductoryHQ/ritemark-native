import assert from 'node:assert/strict';
import { formatSyncedAt, googleDocsMenuItems, type GoogleDocsProjection } from './googleDocsMenu';

const base: GoogleDocsProjection = {
  state: 'unbound', docUrl: null, title: null, lastSyncedAt: null, boundAccountEmail: null, stage: null,
};
const labels = (p: GoogleDocsProjection | null) => googleDocsMenuItems(p).map((i) => i.label);

// Nothing shows until the host says so, or when the feature cannot run.
assert.deepEqual(labels(null), []);
assert.deepEqual(labels({ ...base, state: 'hidden' }), []);
assert.deepEqual(labels({ ...base, state: 'unavailable' }), []);

// One entry point per state.
assert.deepEqual(labels({ ...base, state: 'not-connected' }), ['Connect Google Docs…']);
assert.equal(googleDocsMenuItems({ ...base, state: 'not-connected' })[0].action, 'settings');
assert.deepEqual(labels({ ...base, state: 'unbound' }), ['Create Google Doc']);
assert.equal(googleDocsMenuItems({ ...base, state: 'unbound' })[0].action, 'publish');

const bound: GoogleDocsProjection = {
  ...base, state: 'bound', docUrl: 'https://docs.google.com/document/d/x/edit', title: 'Course outline',
  lastSyncedAt: '2026-09-21T10:00:00.000Z', boundAccountEmail: 'jarmo@productory.eu',
};
assert.deepEqual(labels(bound), ['Sync Google Doc', 'Open Google Doc', 'Remove Google Docs link…']);
assert.deepEqual(googleDocsMenuItems(bound).map((i) => i.action), ['publish', 'open', 'unlink']);
assert.match(googleDocsMenuItems(bound, new Date('2026-09-21T10:05:00.000Z'))[0].description ?? '', /Course outline.*synced 5 min ago/);

const mismatch = googleDocsMenuItems({ ...bound, state: 'account-mismatch' });
assert.deepEqual(mismatch.map((i) => i.action), ['settings'], 'a Doc owned by another account can never be synced from here');
assert.match(mismatch[0].description ?? '', /jarmo@productory\.eu/);

// Busy is one disabled line naming the stage; there is nothing to click twice.
const busy = googleDocsMenuItems({ ...bound, state: 'busy', stage: 'uploading-images' });
assert.equal(busy.length, 1);
assert.equal(busy[0].disabled, true);
assert.equal(busy[0].action, null);
assert.equal(busy[0].label, 'Uploading images…');
assert.equal(googleDocsMenuItems({ ...base, state: 'busy' })[0].label, 'Publishing…');

// Labels stay single-line.
for (const p of [bound, { ...base, state: 'unbound' as const }, { ...base, state: 'not-connected' as const }]) {
  for (const item of googleDocsMenuItems(p)) assert.ok(!item.label.includes('\n'));
}

// Relative sync times.
const now = new Date('2026-09-21T12:00:00.000Z');
assert.equal(formatSyncedAt(null, now), null);
assert.equal(formatSyncedAt('not a date', now), null);
assert.equal(formatSyncedAt('2026-09-21T11:59:40.000Z', now), 'synced just now');
assert.equal(formatSyncedAt('2026-09-21T11:15:00.000Z', now), 'synced 45 min ago');
assert.equal(formatSyncedAt('2026-09-21T09:00:00.000Z', now), 'synced 3 h ago');
assert.match(formatSyncedAt('2026-09-10T09:00:00.000Z', now) ?? '', /^synced /);

console.log('webview/googleDocsMenu: all assertions passed');
