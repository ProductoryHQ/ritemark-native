/**
 * Sprint 127 R4/R8: bundled catalog → published feed, keeping what only the feed carries.
 * Run: npx tsx src/ai/modelCatalog/feedExport.test.ts
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { BUNDLED_CATALOG } from './bundledCatalog';
import { buildPublishedFeed } from './feedExport';
import { validateCatalog } from './schema';

let failures = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL ${name}\n       ${err instanceof Error ? err.message : String(err)}`);
  }
}

type Row = { id: string; [key: string]: unknown };
type Feed = { schemaVersion: number; updatedAt: string; providers: Record<string, { defaults: Record<string, string>; models: Row[] }> };

const NOW = '2026-09-24T12:00:00Z';
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'testdata', 'auto-row.fixture.json'), 'utf8'));
const autoRow: Row = fixture.row;
const bundledAnthropic = BUNDLED_CATALOG.providers.anthropic!;

function publishedWith(extraAnthropicRows: Row[], extra: Record<string, unknown> = {}): Feed {
  const feed = JSON.parse(JSON.stringify(buildPublishedFeed(BUNDLED_CATALOG, undefined, '2026-09-20T00:00:00Z'))) as Feed;
  feed.providers.anthropic.models.push(...extraAnthropicRows);
  return { ...feed, ...extra } as Feed;
}

function exported(current: unknown): Feed {
  return buildPublishedFeed(BUNDLED_CATALOG, current, NOW) as unknown as Feed;
}

function anthropicIds(feed: Feed): string[] {
  return feed.providers.anthropic.models.map((row) => row.id);
}

console.log('feedExport.test.ts');

test('a first publish is the complete bundled lineup with the new updatedAt', () => {
  const feed = exported(undefined);
  assert.equal(feed.updatedAt, NOW);
  assert.equal(feed.schemaVersion, 1);
  for (const [provider, catalog] of Object.entries(BUNDLED_CATALOG.providers)) {
    assert.deepEqual(feed.providers[provider].models, catalog!.models, provider);
    assert.deepEqual(feed.providers[provider].defaults, catalog!.defaults, provider);
  }
  validateCatalog(feed);
});

test('a refresh keeps an automated row the bundled lineup does not curate', () => {
  const feed = exported(publishedWith([autoRow]));
  assert.deepEqual(feed.providers.anthropic.models.find((row) => row.id === autoRow.id), autoRow);
  assert.equal(anthropicIds(feed).length, bundledAnthropic.models.length + 1);
});

test('a refresh keeps a tombstone the bundled lineup does not curate', () => {
  const tombstone: Row = { id: 'claude-test-9', label: 'Test 9', description: '', tier: 'low', deprecated: true, order: 9, retired: true };
  const feed = exported(publishedWith([tombstone]));
  assert.deepEqual(feed.providers.anthropic.models.find((row) => row.id === tombstone.id), tombstone);
});

test('a refresh drops a curated feed-only row', () => {
  const curated: Row = { id: 'claude-test-8', label: 'Test 8', description: '', tier: 'low', deprecated: false, order: 8 };
  const feed = exported(publishedWith([curated]));
  assert.ok(!anthropicIds(feed).includes(curated.id));
});

test('a model the bundled lineup now curates keeps only the curated row', () => {
  const curatedId = bundledAnthropic.models[0].id;
  const current = publishedWith([]);
  current.providers.anthropic.models = current.providers.anthropic.models.filter((row) => row.id !== curatedId);
  current.providers.anthropic.models.push({ ...autoRow, id: curatedId });
  const feed = exported(current);
  const rows = feed.providers.anthropic.models.filter((row) => row.id === curatedId);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], bundledAnthropic.models[0]);
});

test('a tombstone for a model the bundled lineup curates again is dropped', () => {
  const curatedId = bundledAnthropic.models[1].id;
  const current = publishedWith([]);
  const row = current.providers.anthropic.models.find((candidate) => candidate.id === curatedId)!;
  row.retired = true;
  const feed = exported(current);
  assert.equal(feed.providers.anthropic.models.find((candidate) => candidate.id === curatedId)!.retired, undefined);
});

test('defaults come from the bundled lineup', () => {
  const current = publishedWith([]);
  current.providers.anthropic.defaults = { 'claude-code': bundledAnthropic.models[1].id };
  assert.deepEqual(exported(current).providers.anthropic.defaults, bundledAnthropic.defaults);
});

test('a provider this build does not know is kept untouched', () => {
  const current = publishedWith([]) as Feed & { providers: Record<string, unknown> };
  const future = { defaults: {}, models: [{ id: 'future-model', label: 'Future', description: '', tier: 'low', deprecated: false, order: 0 }] };
  (current.providers as Record<string, unknown>).futureprovider = future;
  assert.deepEqual(exported(current).providers.futureprovider, future);
});

test('an invalid current feed is refused', () => {
  const current = publishedWith([{ ...autoRow, id: 'not a model' }]);
  assert.throws(() => exported(current), /invalid catalog/);
});

test('an unparseable updatedAt is refused', () => {
  assert.throws(() => buildPublishedFeed(BUNDLED_CATALOG, undefined, 'soon'), /ISO-8601/);
});

if (failures > 0) {
  console.error(`feedExport.test.ts: ${failures} failure(s)`);
  process.exit(1);
}
console.log('feedExport.test.ts passed');
