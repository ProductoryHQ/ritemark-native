import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildAutoRow, descriptionOf, effortOf, familyOf, labelOf, orderFor } from './rows.mjs';
import { apiModel, FIXTURE, publishedFeed, publisherConfig } from './test-helpers.mjs';

const config = publisherConfig();
const anthropicRows = publishedFeed().providers.anthropic.models;
const options = { anthropicRows, publishedAt: FIXTURE.publishedAt, minAppVersion: config.autoRowMinAppVersion, maxOutputTokensCap: config.maxOutputTokensCap };

test('the shared fixture: the first live publish builds exactly the row the client expects', () => {
  assert.equal(Math.min(...anthropicRows.filter((row) => familyOf(row.id) === familyOf(FIXTURE.row.id)).map((row) => row.order)), FIXTURE.familyHeadOrder);
  assert.equal(config.autoRowMinAppVersion, FIXTURE.autoRowMinAppVersion);
  assert.deepEqual(buildAutoRow(FIXTURE.source, options), FIXTURE.row);
});

test('the same input always builds the same row', () => {
  assert.deepEqual(buildAutoRow(FIXTURE.source, options), buildAutoRow(structuredClone(FIXTURE.source), options));
});

test('label, description and tier follow the family', () => {
  assert.equal(labelOf({ id: 'claude-sonnet-6', display_name: 'Claude Sonnet 6' }), 'Sonnet 6');
  assert.equal(labelOf({ id: 'claude-sonnet-6', display_name: '  ' }), 'claude-sonnet-6');
  assert.equal(labelOf({ id: 'claude-sonnet-6' }), 'claude-sonnet-6');
  assert.equal(descriptionOf('haiku'), 'Newest Haiku model');
  assert.equal(descriptionOf('nova'), 'New Anthropic model');
  assert.equal(buildAutoRow(apiModel('claude-haiku-5', '2026-10-01T00:00:00Z'), options).tier, 'low');
  assert.equal(buildAutoRow(apiModel('claude-nova-1', '2026-10-01T00:00:00Z'), options).tier, 'medium');
});

test('a new family goes after every current row', () => {
  const last = Math.max(...anthropicRows.map((row) => row.order));
  assert.equal(orderFor('nova', anthropicRows), last + 1);
  assert.equal(orderFor('nova', []), 0);
});

test('tombstoned rows do not anchor a family', () => {
  const rows = [{ id: 'claude-nova-0', order: 0, retired: true }, { id: 'claude-opus-1', order: 3 }];
  assert.equal(orderFor('nova', rows), 4);
});

test('effort levels come from the provider capabilities', () => {
  assert.equal(effortOf(undefined), undefined);
  assert.equal(effortOf({}), undefined);
  assert.deepEqual(effortOf({ effort: { supported: false } }), { levels: [] });
  assert.deepEqual(effortOf({ effort: { supported: true, high: { supported: true }, low: { supported: true }, max: { supported: false } } }), { levels: ['low', 'high'] });
  assert.equal('thinkingEffort' in buildAutoRow(apiModel('claude-nova-1', '2026-10-01T00:00:00Z'), options), false);
});

test('the declared output budget is the provider limit, capped', () => {
  const row = (max_tokens) => buildAutoRow(apiModel('claude-nova-1', '2026-10-01T00:00:00Z', { max_tokens }), options).claudeCode;
  assert.deepEqual(row(32000), { inject: true, maxOutputTokens: 32000 });
  assert.deepEqual(row(128000), { inject: true, maxOutputTokens: 64000 });
  assert.deepEqual(row(undefined), { inject: true });
  assert.deepEqual(row(-1), { inject: true });
});

test('an automated row is never a tombstone and never carries a behavior profile', () => {
  const row = buildAutoRow(FIXTURE.source, options);
  assert.equal(row.retired, undefined);
  assert.equal(row.claudeCode.behavesAs, undefined);
  assert.equal(row.provenance, 'auto');
});
