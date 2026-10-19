import assert from 'node:assert/strict';
import { formatLastUpdate, googleDocsMenuItems, type GoogleDocsProjection } from './googleDocsMenu';

const base: GoogleDocsProjection = {
  state: 'unbound', docUrl: null, title: null, lastSyncedAt: null, boundAccountEmail: null, stage: null,
};
const labels = (p: GoogleDocsProjection | null) => googleDocsMenuItems(p).map((i) => i.label);
const actions = (p: GoogleDocsProjection | null) => googleDocsMenuItems(p).map((i) => i.action);

// Nothing shows until the host says so, or when the feature cannot run.
assert.deepEqual(labels(null), []);
assert.deepEqual(labels({ ...base, state: 'hidden' }), []);
assert.deepEqual(labels({ ...base, state: 'unavailable' }), []);

// Publish to Google Docs, as experience 26's frame 1 draws it. Without an
// account it still opens Settings to connect one, as Connect Google Docs… did.
assert.deepEqual(labels({ ...base, state: 'not-connected' }), ['Publish to Google Docs']);
assert.deepEqual(actions({ ...base, state: 'not-connected' }), ['settings']);
assert.equal(googleDocsMenuItems({ ...base, state: 'not-connected' })[0].detail, 'Connect your Google account first');
assert.deepEqual(labels({ ...base, state: 'unbound' }), ['Publish to Google Docs']);
assert.deepEqual(actions({ ...base, state: 'unbound' }), ['publish']);
assert.equal(googleDocsMenuItems({ ...base, state: 'unbound' })[0].detail, 'One Google Doc you update from here');

// Linked: update, open, remove the link (1.x: Sync, Open, Remove Google Docs link…).
const bound: GoogleDocsProjection = {
  ...base, state: 'bound', docUrl: 'https://docs.google.com/document/d/x/edit', title: 'Course outline',
  lastSyncedAt: '2026-09-21T10:00:00.000Z', boundAccountEmail: 'jarmo@productory.eu',
};
assert.deepEqual(labels(bound), ['Update the Google Doc', 'Open in Google Docs', 'Remove the link…']);
assert.deepEqual(actions(bound), ['publish', 'open', 'unlink']);
const boundItems = googleDocsMenuItems(bound, new Date('2026-09-21T10:05:00.000Z'));
assert.equal(boundItems[0].detail, 'Last updated 5 min ago');
assert.equal(boundItems[1].detail, 'Course outline');
assert.equal(boundItems[2].detail, 'The Google Doc is not deleted');
assert.equal(googleDocsMenuItems({ ...bound, lastSyncedAt: null })[0].detail, 'Sends this version');

// Published with another account: reconnect, which opens Settings (1.x: Reconnect Google account…).
const mismatch = googleDocsMenuItems({ ...bound, state: 'account-mismatch' });
assert.deepEqual(mismatch.map((i) => i.action), ['settings'], 'a Doc owned by another account can never be updated from here');
assert.equal(mismatch[0].label, 'Reconnect your Google account');
assert.equal(mismatch[0].detail, 'Published with jarmo@productory.eu');
assert.equal(googleDocsMenuItems({ ...bound, state: 'account-mismatch', boundAccountEmail: null })[0].detail, 'Published with another Google account');

// Busy is one disabled line naming the stage; there is nothing to click twice.
const busy = googleDocsMenuItems({ ...bound, state: 'busy', stage: 'uploading-images' });
assert.equal(busy.length, 1);
assert.equal(busy[0].disabled, true);
assert.equal(busy[0].action, null);
assert.equal(busy[0].label, 'Uploading images…');
assert.equal(googleDocsMenuItems({ ...base, state: 'busy' })[0].label, 'Publishing…');

// Labels and second lines stay single-line.
for (const p of [bound, { ...bound, state: 'account-mismatch' as const }, { ...base, state: 'unbound' as const }, { ...base, state: 'not-connected' as const }]) {
  for (const item of googleDocsMenuItems(p)) {
    assert.ok(!item.label.includes('\n'));
    assert.ok(!(item.detail ?? '').includes('\n'));
  }
}

// When the Google Doc was last updated.
const now = new Date('2026-09-21T12:00:00.000Z');
assert.equal(formatLastUpdate(null, now), null);
assert.equal(formatLastUpdate('not a date', now), null);
assert.equal(formatLastUpdate('2026-09-21T11:59:40.000Z', now), 'Last updated just now');
assert.equal(formatLastUpdate('2026-09-21T11:15:00.000Z', now), 'Last updated 45 min ago');
assert.equal(formatLastUpdate('2026-09-21T09:00:00.000Z', now), 'Last updated 3 h ago');
assert.match(formatLastUpdate('2026-09-10T09:00:00.000Z', now) ?? '', /^Last updated \S/);

console.log('webview/googleDocsMenu: all assertions passed');
