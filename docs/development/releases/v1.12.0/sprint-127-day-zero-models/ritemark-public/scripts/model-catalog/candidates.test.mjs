import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isCoolingDown, newModels, nextCooldown, nextWatermark } from './candidates.mjs';
import { apiModel, FIXTURE, publishedFeed, publisherConfig } from './test-helpers.mjs';

const HOUR = 60 * 60 * 1000;
const watermark = publisherConfig().watermark;
const ids = (models) => models.map((model) => model.id);

function feedWith(...rows) {
  const feed = publishedFeed();
  feed.providers.anthropic.models.push(...rows);
  return feed;
}

test('a model created after the watermark and absent from the feed is new', () => {
  const models = [apiModel('claude-opus-6', '2026-10-01T00:00:00Z')];
  assert.deepEqual(ids(newModels(models, publishedFeed(), { watermark })), ['claude-opus-6']);
});

test('models already in the feed are not new', () => {
  const known = publishedFeed().providers.anthropic.models[0].id;
  assert.deepEqual(newModels([apiModel(known, '2026-10-01T00:00:00Z')], publishedFeed(), { watermark }), []);
});

test('a tombstoned model is not new', () => {
  const feed = feedWith({ ...FIXTURE.row, id: 'claude-opus-6', retired: true });
  assert.deepEqual(newModels([apiModel('claude-opus-6', '2026-10-01T00:00:00Z')], feed, { watermark }), []);
});

test('a dated snapshot of a known model is ignored (S18)', () => {
  const feed = feedWith(FIXTURE.row);
  const models = [apiModel(`${FIXTURE.row.id}-20260920`, '2026-09-20T00:00:00Z')];
  assert.deepEqual(newModels(models, feed, { watermark }), []);
});

test('a dated snapshot of a newly listed alias is ignored, the alias is new', () => {
  const models = [apiModel('claude-opus-6-20261001', '2026-10-01T00:00:00Z'), apiModel('claude-opus-6', '2026-10-01T00:00:00Z')];
  assert.deepEqual(ids(newModels(models, publishedFeed(), { watermark })), ['claude-opus-6']);
});

test('a dated id with no alias is new', () => {
  const models = [apiModel('claude-opus-6-20261001', '2026-10-01T00:00:00Z')];
  assert.deepEqual(ids(newModels(models, publishedFeed(), { watermark })), ['claude-opus-6-20261001']);
});

test('legacy models are not backfilled (S19)', () => {
  const models = [apiModel('claude-3-haiku-20240307', '2024-03-07T00:00:00Z'), apiModel('claude-legacy-1', watermark)];
  assert.deepEqual(newModels(models, publishedFeed(), { watermark }), []);
});

test('non-Claude, malformed and undated entries are ignored', () => {
  const models = [
    apiModel('gpt-6', '2026-10-01T00:00:00Z'),
    apiModel('Claude Opus 6', '2026-10-01T00:00:00Z'),
    apiModel('claude-opus-6[1m]', '2026-10-01T00:00:00Z'),
    { id: 'claude-undated' },
    null,
  ];
  assert.deepEqual(newModels(models, publishedFeed(), { watermark }), []);
});

test('new models come oldest first', () => {
  const models = [apiModel('claude-b', '2026-10-02T00:00:00Z'), apiModel('claude-c', '2026-10-01T00:00:00Z'), apiModel('claude-a', '2026-10-02T00:00:00Z')];
  assert.deepEqual(ids(newModels(models, publishedFeed(), { watermark })), ['claude-c', 'claude-a', 'claude-b']);
});

test('an unparseable watermark stops the run', () => {
  assert.throws(() => newModels([], publishedFeed(), { watermark: 'soon' }), /watermark/);
});

test('a failed canary backs off 1 h, doubling, capped at 24 h', () => {
  const now = Date.parse('2026-10-01T00:00:00Z');
  let entry;
  const waits = [];
  for (let i = 0; i < 7; i++) {
    entry = nextCooldown(entry, now);
    waits.push((entry.retryAfter - now) / HOUR);
  }
  assert.deepEqual(waits, [1, 2, 4, 8, 16, 24, 24]);
  assert.equal(entry.failures, 7);
  assert.equal(isCoolingDown(entry, now), true);
  assert.equal(isCoolingDown(entry, entry.retryAfter), false);
  assert.equal(isCoolingDown(undefined, now), false);
});

test('the watermark moves to the newest published model', () => {
  const published = [apiModel('claude-a', '2026-10-01T00:00:00Z'), apiModel('claude-b', '2026-10-03T00:00:00Z')];
  assert.equal(nextWatermark(watermark, published, []), '2026-10-03T00:00:00.000Z');
});

test('the watermark stays below a model that is still pending', () => {
  const published = [apiModel('claude-b', '2026-10-03T00:00:00Z')];
  const pending = [apiModel('claude-a', '2026-10-02T00:00:00Z')];
  assert.equal(nextWatermark(watermark, published, pending), '2026-10-01T23:59:59.999Z');
  assert.ok(Date.parse(nextWatermark(watermark, published, pending)) < Date.parse(pending[0].created_at));
});

test('the watermark never moves backwards', () => {
  assert.equal(nextWatermark(watermark, [], [apiModel('claude-a', '2026-10-02T00:00:00Z')]), new Date(watermark).toISOString());
});
