import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertAdditionsOnly, assertSize, serializeCatalog, SIZE_CAP_BYTES, validateCatalog, validateConfig } from './schema.mjs';
import { FIXTURE, liveConfig, liveFeed, publishedFeed, publisherConfig } from './test-helpers.mjs';

function appended(doc, row = FIXTURE.row) {
  const next = structuredClone(doc);
  next.providers.anthropic.models.push(structuredClone(row));
  next.updatedAt = FIXTURE.publishedAt;
  return next;
}

test('the live feed and the live publisher config are valid', () => {
  const feed = liveFeed();
  validateCatalog(feed);
  assertSize(feed);
  validateConfig(liveConfig());
});

test('the frozen fixtures are valid', () => {
  validateCatalog(publishedFeed());
  validateConfig(publisherConfig());
});

test('the shared automated row is valid', () => {
  validateCatalog(appended(publishedFeed()));
});

test('duplicate ids are rejected', () => {
  const feed = publishedFeed();
  feed.providers.openai.models.push(structuredClone(feed.providers.openai.models[0]));
  assert.throws(() => validateCatalog(feed), /duplicate ids/);
});

test('malformed Claude ids are rejected (S30)', () => {
  for (const id of ['Claude Opus', 'claude-opus-6; rm -rf ~', 'claude-', 'gpt-6', 'claude-opus-6[2m]']) {
    assert.throws(() => validateCatalog(appended(publishedFeed(), { ...FIXTURE.row, id })), /Claude model id/, id);
  }
  validateCatalog(appended(publishedFeed(), { ...FIXTURE.row, id: 'claude-opus-6[1m]' }));
});

test('Claude Code declarations are anthropic-only and bounded', () => {
  const feed = publishedFeed();
  feed.providers.openai.models[0].claudeCode = { inject: true };
  assert.throws(() => validateCatalog(feed), /only valid on anthropic rows/);
  for (const maxOutputTokens of [0, -1, 1.5, 1_000_001, '64000']) {
    const doc = appended(publishedFeed(), { ...FIXTURE.row, claudeCode: { inject: true, maxOutputTokens } });
    assert.throws(() => validateCatalog(doc), /maxOutputTokens/, String(maxOutputTokens));
  }
  const badProfile = appended(publishedFeed(), { ...FIXTURE.row, claudeCode: { inject: true, behavesAs: 'gpt-6' } });
  assert.throws(() => validateCatalog(badProfile), /behavesAs/);
});

test('providers the publisher does not know are kept valid', () => {
  const feed = publishedFeed();
  feed.providers.futureprovider = { defaults: {}, models: [{ id: 'future-1', label: 'Future', description: '', tier: 'low', deprecated: false, order: 0 }] };
  validateCatalog(feed);
});

test('the 512 KB client cap is enforced', () => {
  const feed = publishedFeed();
  feed.providers.openai.models[0].description = 'x'.repeat(SIZE_CAP_BYTES);
  assert.throws(() => assertSize(feed), /byte client cap/);
});

test('the feed is written as two-space JSON with a final newline', () => {
  assert.equal(serializeCatalog({ a: [1] }), '{\n  "a": [\n    1\n  ]\n}\n');
});

test('appending an automated row passes the additions-only check', () => {
  const before = publishedFeed();
  assertAdditionsOnly(before, appended(before));
});

test('the publisher cannot change anything but appended automated rows (S21)', () => {
  const before = publishedFeed();
  const cases = {
    'edit an existing row': (doc) => { doc.providers.anthropic.models[0].label = 'Renamed'; },
    'remove a row': (doc) => { doc.providers.anthropic.models.shift(); },
    'change a default': (doc) => { doc.providers.anthropic.defaults['claude-code'] = FIXTURE.row.id; },
    'change another provider': (doc) => { doc.providers.openai.models[0].order = 99; },
    'add a provider': (doc) => { doc.providers.futureprovider = { defaults: {}, models: [] }; },
    'move updatedAt backwards': (doc) => { doc.updatedAt = '2000-01-01T00:00:00Z'; },
    'add a curated row': (doc) => { doc.providers.anthropic.models.at(-1).provenance = 'curated'; },
    'add a row without a declaration': (doc) => { doc.providers.anthropic.models.at(-1).claudeCode = { inject: false }; },
    'add a behavior profile (S31)': (doc) => { doc.providers.anthropic.models.at(-1).claudeCode.behavesAs = before.providers.anthropic.models[0].id; },
    'add a tombstone': (doc) => { doc.providers.anthropic.models.at(-1).retired = true; },
    'add a row without minAppVersion': (doc) => { delete doc.providers.anthropic.models.at(-1).minAppVersion; },
  };
  for (const [name, mutate] of Object.entries(cases)) {
    const after = appended(before);
    mutate(after);
    assert.throws(() => assertAdditionsOnly(before, after), /invalid catalog/, name);
  }
});

test('the publisher config is checked', () => {
  const cases = {
    watermark: (config) => { config.watermark = 'recently'; },
    maxAdditionsPerRun: (config) => { config.maxAdditionsPerRun = 0; },
    autoRowMinAppVersion: (config) => { config.autoRowMinAppVersion = '1.12'; },
    maxOutputTokensCap: (config) => { config.maxOutputTokensCap = 2_000_000; },
    'no canary versions': (config) => { config.canary.claudeCodeVersions = []; },
    'a bad canary version': (config) => { config.canary.claudeCodeVersions = ['latest']; },
    agentSdkVersion: (config) => { config.canary.agentSdkVersion = undefined; },
  };
  for (const [name, mutate] of Object.entries(cases)) {
    const config = publisherConfig();
    mutate(config);
    assert.throws(() => validateConfig(config), /invalid config/, name);
  }
});
