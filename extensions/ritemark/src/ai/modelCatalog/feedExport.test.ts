/**
 * Sprint 127 R4/R8: bundled catalog → published feed, keeping what only the feed carries.
 * Run: npx tsx src/ai/modelCatalog/feedExport.test.ts
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { BUNDLED_CATALOG } from './bundledCatalog';
import { buildPublishedFeed } from './feedExport';
import { FEED_MIN_APP_VERSION } from './feedGates';
import { resolveAll } from './resolver';
import { validateCatalog } from './schema';
import { CLAUDE_MODEL_IDS, CODEX_MODEL_IDS, GEMINI_MODEL_IDS } from '../modelConfig';

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
  const feed = buildPublishedFeed(BUNDLED_CATALOG, undefined, NOW, {}) as unknown as Feed;
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

// ── Sprint 141 R6: what older apps need ────────────────────────────────────

const FEED_C4808BE = JSON.parse(fs.readFileSync(path.join(__dirname, 'testdata', 'feed-c4808be.json'), 'utf8'));
const SONNET_5_5 = CLAUDE_MODEL_IDS.SONNET_5_5;
const OPENCODE_ARGON = `google/${GEMINI_MODEL_IDS.ARGON_4}`;

test('S141 S20: the export keeps Sonnet 5.5\'s declaration from the feed of c4808be', () => {
  const feed = exported(FEED_C4808BE);
  const sonnet = feed.providers.anthropic.models.find((row) => row.id === SONNET_5_5)!;
  assert.deepEqual(sonnet.claudeCode, { inject: true, maxOutputTokens: 64000 });
  assert.equal(BUNDLED_CATALOG.providers.anthropic!.models.find((row) => row.id === SONNET_5_5)!.claudeCode, undefined, 'the bundled row stays clean');
});

test('S141 S21: the export keeps Argon\'s OpenCode gate, and lists Argon once', () => {
  const feed = exported(FEED_C4808BE);
  const rows = feed.providers.opencode.models.filter((row) => row.id === OPENCODE_ARGON);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].minAppVersion, '2.0.0');
  assert.equal(feed.providers.gemini.models.filter((row) => row.id === GEMINI_MODEL_IDS.ARGON_4).length, 1);
});

test('S141 R6: the gates in feedGates.ts are applied, and the stricter gate wins', () => {
  const feed = exported(FEED_C4808BE);
  assert.equal(feed.providers.codex.models.find((row) => row.id === CODEX_MODEL_IDS.SOL_6_1)!.minAppVersion, '1.14.0');
  assert.equal(feed.providers.anthropic.models.find((row) => row.id === CLAUDE_MODEL_IDS.HAIKU_5_5)!.minAppVersion, '1.14.0');
  for (const [id, version] of Object.entries(FEED_MIN_APP_VERSION.opencode ?? {})) {
    assert.equal(feed.providers.opencode.models.find((row) => row.id === id)?.minAppVersion, version, id);
  }
  const current = JSON.parse(JSON.stringify(FEED_C4808BE));
  current.providers.opencode.models.find((row: Row) => row.id === OPENCODE_ARGON).minAppVersion = '2.1.0';
  assert.equal(exported(current).providers.opencode.models.find((row) => row.id === OPENCODE_ARGON)!.minAppVersion, '2.1.0', 'a stricter feed gate is kept');
});

test('S141 S22: a bundled row\'s own value wins over the feed\'s', () => {
  const bundled = JSON.parse(JSON.stringify(BUNDLED_CATALOG));
  bundled.providers.anthropic.models.find((row: Row) => row.id === SONNET_5_5).claudeCode = { inject: true, maxOutputTokens: 32000 };
  bundled.providers.opencode.models.find((row: Row) => row.id === OPENCODE_ARGON).minAppVersion = '1.0.0';
  const feed = buildPublishedFeed(bundled, FEED_C4808BE, NOW) as unknown as Feed;
  assert.deepEqual(feed.providers.anthropic.models.find((row) => row.id === SONNET_5_5)!.claudeCode, { inject: true, maxOutputTokens: 32000 });
  assert.equal(feed.providers.opencode.models.find((row) => row.id === OPENCODE_ARGON)!.minAppVersion, '1.0.0');
});

test('S141 R6: an automated feed row carries nothing onto the curated row', () => {
  const current = publishedWith([]);
  current.providers.anthropic.models = current.providers.anthropic.models.filter((row) => row.id !== SONNET_5_5);
  current.providers.anthropic.models.push({ ...autoRow, id: SONNET_5_5, minAppVersion: '9.0.0' });
  const sonnet = exported(current).providers.anthropic.models.find((row) => row.id === SONNET_5_5)!;
  assert.equal(sonnet.claudeCode, undefined);
  assert.equal(sonnet.minAppVersion, undefined);
});

test('S141 S31: 2.1 resolves the exported feed to its own bundled lineup', () => {
  const feed = validateCatalog(exported(FEED_C4808BE));
  const fromFeed = resolveAll({}, feed, null, BUNDLED_CATALOG, '2.1.0');
  const bundledOnly = resolveAll({}, null, null, BUNDLED_CATALOG, '2.1.0');
  for (const provider of ['anthropic', 'openai', 'gemini', 'codex', 'opencode'] as const) {
    assert.deepEqual(fromFeed[provider].models.map((m) => m.id), bundledOnly[provider].models.map((m) => m.id), provider);
    assert.deepEqual(fromFeed[provider].defaults, bundledOnly[provider].defaults, provider);
  }
});

if (failures > 0) {
  console.error(`feedExport.test.ts: ${failures} failure(s)`);
  process.exit(1);
}
console.log('feedExport.test.ts passed');
