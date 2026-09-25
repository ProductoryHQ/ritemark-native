/**
 * Unit tests for the model-catalog core (Sprint 89, GH #109).
 * Pure — no vscode/network. Run: npx tsx src/ai/modelCatalog/modelCatalog.test.ts
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { validateCatalog, type ModelCatalog } from './schema';
import { BUNDLED_CATALOG } from './bundledCatalog';
import { CLAUDE_MODEL_IDS } from '../modelConfig';
import {
  canonicalizeModelAliases,
  findModelEntry,
  isCatalogAtLeastAsFresh,
  resolveAll,
  resolveRequestedModelIn,
  resolveStaticModels,
  substitutionForTurn,
  versionLt,
  type DiscoveryResults,
} from './resolver';

let failures = 0;
// One day after the bundled lineup, so a test document counts as fresher than it.
const TEST_CATALOG_DATE = new Date(Date.parse(BUNDLED_CATALOG.updatedAt) + 24 * 60 * 60 * 1000).toISOString();
function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL ${name}\n       ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ── schema.validateCatalog ─────────────────────────────────────────────────

test('validateCatalog accepts the bundled baseline (round-trip)', () => {
  const v = validateCatalog(JSON.parse(JSON.stringify(BUNDLED_CATALOG)));
  assert.strictEqual(v.schemaVersion, 1);
  assert.ok(v.providers.anthropic, 'anthropic present');
  assert.ok(v.providers.anthropic!.models.length >= 4);
});

test('validateCatalog throws on wrong schemaVersion', () => {
  assert.throws(() => validateCatalog({ schemaVersion: 2, updatedAt: TEST_CATALOG_DATE, providers: {} }));
});

test('validateCatalog rejects an unparseable catalog date', () => {
  assert.throws(() => validateCatalog({ schemaVersion: 1, updatedAt: 'unknown', providers: {} }));
});

test('validateCatalog throws on malformed model entry (missing id)', () => {
  assert.throws(() =>
    validateCatalog({
      schemaVersion: 1,
      updatedAt: TEST_CATALOG_DATE,
      providers: { anthropic: { models: [{ label: 'X', description: '', tier: 'high', deprecated: false, order: 0 }], defaults: {} } },
    }),
  );
});

test('validateCatalog throws on bad tier', () => {
  assert.throws(() =>
    validateCatalog({
      schemaVersion: 1,
      updatedAt: TEST_CATALOG_DATE,
      providers: { openai: { models: [{ id: 'a', label: 'A', description: '', tier: 'ultra', deprecated: false, order: 0 }], defaults: {} } },
    }),
  );
});

test('validateCatalog accepts canonical effort metadata and rejects invented levels', () => {
  const valid = validateCatalog({
    schemaVersion: 1,
    updatedAt: TEST_CATALOG_DATE,
    providers: {
      codex: {
        models: [{
          id: 'effort-model', label: 'Effort', description: '', tier: 'high', deprecated: false, order: 0,
          thinkingEffort: { levels: ['low', 'xhigh', 'ultra'], defaultLevel: 'low' },
        }],
        defaults: {},
      },
    },
  });
  assert.deepStrictEqual(valid.providers.codex?.models[0].thinkingEffort?.levels, ['low', 'xhigh', 'ultra']);
  assert.throws(() => validateCatalog({
    schemaVersion: 1,
    updatedAt: TEST_CATALOG_DATE,
    providers: {
      codex: {
        models: [{
          id: 'bad', label: 'Bad', description: '', tier: 'high', deprecated: false, order: 0,
          thinkingEffort: { levels: ['extreme'] },
        }],
        defaults: {},
      },
    },
  }));
});

test('validateCatalog drops unknown provider keys (forward-compat)', () => {
  const v = validateCatalog({
    schemaVersion: 1,
    updatedAt: TEST_CATALOG_DATE,
    providers: {
      anthropic: { models: [], defaults: {} },
      // a provider a future build added that this one does not know:
      mistral: { models: [{ id: 'm', label: 'M', description: '', tier: 'low', deprecated: false, order: 0 }], defaults: {} },
    },
  });
  assert.ok(v.providers.anthropic, 'known provider kept');
  assert.ok(!('mistral' in v.providers), 'unknown provider dropped');
});

// ── resolver.resolveAll waterfall ──────────────────────────────────────────

const APP = '1.9.0';

test('bundled-only resolves every provider from the bundled floor', () => {
  const r = resolveAll({}, null, null, BUNDLED_CATALOG, APP);
  assert.strictEqual(r.anthropic.source, 'bundled');
  assert.strictEqual(r.anthropic.models[0].id, 'claude-sonnet-5'); // order 0
  assert.strictEqual(r.anthropic.defaults['claude-code'], 'claude-sonnet-5');
});

test('live probe wins and is enriched with curated metadata', () => {
  const discovery: DiscoveryResults = {
    anthropic: [
      { id: 'claude-sonnet-5', label: 'raw-name', description: '', tier: 'low', deprecated: false, order: 9 },
      { id: 'claude-future-6', label: 'Future', description: 'live-only', tier: 'high', deprecated: false, order: 1 },
    ],
  };
  const r = resolveAll(discovery, null, null, BUNDLED_CATALOG, APP);
  assert.strictEqual(r.anthropic.source, 'live');
  const sonnet = r.anthropic.models.find((m) => m.id === 'claude-sonnet-5')!;
  assert.strictEqual(sonnet.label, 'Sonnet 5', 'known id enriched from catalog');
  assert.deepStrictEqual(sonnet.thinkingEffort?.levels, ['low', 'medium', 'high', 'xhigh', 'max'], 'catalog effort is the offline floor');
  const future = r.anthropic.models.find((m) => m.id === 'claude-future-6')!;
  assert.strictEqual(future.label, 'Future', 'live-only id preserved');
  assert.strictEqual(r.anthropic.defaults['claude-code'], 'claude-sonnet-5', 'defaults from catalog');
});

test('live aliases with one resolved identity collapse to one explicit default-marked row', () => {
  const models = canonicalizeModelAliases([
    {
      id: 'default', label: 'Default', description: 'Opus 5 with 1M context · Best for complex tasks',
      resolvedModel: 'claude-opus-5[1m]', tier: 'medium', deprecated: false, order: 0,
      thinkingEffort: { levels: ['low', 'medium', 'high'] },
    },
    {
      id: 'opus[1m]', label: 'Opus (1M context)', description: 'Opus 5 with 1M context · Best for complex tasks',
      resolvedModel: 'claude-opus-5[1m]', tier: 'medium', deprecated: false, order: 1,
      thinkingEffort: { levels: ['low', 'medium', 'high'] },
    },
    {
      id: 'sonnet', label: 'Sonnet', description: 'Sonnet 5 · Efficient',
      resolvedModel: 'claude-sonnet-5', tier: 'medium', deprecated: false, order: 2,
    },
  ]);

  assert.equal(models.length, 2);
  assert.equal(models[0].id, 'opus[1m]', 'explicit alias remains the deterministic request id');
  assert.equal(models[0].resolvedModel, 'claude-opus-5[1m]');
  assert.deepStrictEqual(models[0].aliases, ['default']);
  assert.equal(models[0].isDefault, true);
  assert.equal(findModelEntry(models, 'default')?.id, 'opus[1m]', 'persisted default alias reconciles');
  assert.equal(findModelEntry(models, 'opus[1m]')?.id, 'opus[1m]');
  assert.equal(findModelEntry(models, 'claude-opus-5[1m]')?.id, 'opus[1m]', 'canonical ids reconcile too');
});

test('matching labels without resolved identity are never merged', () => {
  const models = canonicalizeModelAliases([
    { id: 'a', label: 'Same', description: '', tier: 'medium', deprecated: false, order: 0 },
    { id: 'b', label: 'Same', description: '', tier: 'medium', deprecated: false, order: 1 },
  ]);
  assert.deepStrictEqual(models.map((model) => model.id), ['a', 'b']);
});

test('live effort metadata overrides a stale curated capability', () => {
  const discovery: DiscoveryResults = {
    codex: [{
      id: 'gpt-5.6-sol', label: 'live', description: '', tier: 'high', deprecated: false, order: 0,
      thinkingEffort: { levels: ['low', 'high'], defaultLevel: 'high' },
    }],
  };
  const r = resolveAll(discovery, null, null, BUNDLED_CATALOG, APP);
  assert.deepStrictEqual(r.codex.models[0].thinkingEffort, { levels: ['low', 'high'], defaultLevel: 'high' });
});

test('live explicit Auto-only capability overrides the bundled effort floor', () => {
  const discovery: DiscoveryResults = {
    anthropic: [{
      id: 'claude-sonnet-5', label: 'live', description: '', tier: 'medium', deprecated: false, order: 0,
      thinkingEffort: { levels: [] },
    }],
  };
  const r = resolveAll(discovery, null, null, BUNDLED_CATALOG, APP);
  assert.deepStrictEqual(r.anthropic.models[0].thinkingEffort, { levels: [] });
});

test('live model keeps bundled effort when a newer remote catalog omits the field', () => {
  const discovery: DiscoveryResults = {
    codex: [{
      id: 'gpt-5.6-sol', label: 'Live Sol', description: '', tier: 'high', deprecated: false, order: 0,
    }],
  };
  const remote: ModelCatalog = {
    schemaVersion: 1,
    updatedAt: TEST_CATALOG_DATE,
    providers: {
      codex: {
        models: [{
          id: 'gpt-5.6-sol', label: 'Remote Sol', description: 'fresh copy',
          tier: 'high', deprecated: false, order: 0,
        }],
        defaults: { codex: 'gpt-5.6-sol' },
      },
    },
  };
  const r = resolveAll(discovery, remote, null, BUNDLED_CATALOG, APP);
  assert.deepStrictEqual(
    r.codex.models[0].thinkingEffort,
    { levels: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'], defaultLevel: 'low' },
  );
});

test('remote is used when no live probe, in preference to bundled', () => {
  const remote: ModelCatalog = {
    schemaVersion: 1,
    updatedAt: TEST_CATALOG_DATE,
    providers: { anthropic: { models: [{ id: 'remote-only', label: 'R', description: '', tier: 'high', deprecated: false, order: 0 }], defaults: { 'claude-code': 'remote-only' } } },
  };
  const r = resolveAll({}, remote, null, BUNDLED_CATALOG, APP);
  assert.strictEqual(r.anthropic.source, 'remote');
  assert.strictEqual(r.anthropic.models[0].id, 'remote-only');
});

test('remote model keeps the exact-pin bundled effort floor when the remote schema predates it', () => {
  const remote: ModelCatalog = {
    schemaVersion: 1,
    updatedAt: TEST_CATALOG_DATE,
    providers: {
      anthropic: {
        models: [{
          id: 'claude-sonnet-5', label: 'Remote Sonnet', description: 'fresh copy',
          tier: 'medium', deprecated: false, order: 0,
        }],
        defaults: { 'claude-code': 'claude-sonnet-5' },
      },
    },
  };
  const r = resolveAll({}, remote, null, BUNDLED_CATALOG, APP);
  assert.strictEqual(r.anthropic.models[0].label, 'Remote Sonnet', 'remote presentation remains authoritative');
  assert.deepStrictEqual(
    r.anthropic.models[0].thinkingEffort?.levels,
    ['low', 'medium', 'high', 'xhigh', 'max'],
    'bundled audited capability fills only the missing remote field',
  );
});

test('cache is used when no live and no remote', () => {
  const cache: ModelCatalog = {
    schemaVersion: 1,
    updatedAt: TEST_CATALOG_DATE,
    providers: { anthropic: { models: [{ id: 'cache-only', label: 'C', description: '', tier: 'high', deprecated: false, order: 0 }], defaults: {} } },
  };
  const r = resolveAll({}, null, cache, BUNDLED_CATALOG, APP);
  assert.strictEqual(r.anthropic.source, 'cache');
  assert.strictEqual(r.anthropic.models[0].id, 'cache-only');
});

test('empty remote/cache providers cannot erase the bundled selectable floor', () => {
  const emptyRemote: ModelCatalog = {
    schemaVersion: 1,
    updatedAt: TEST_CATALOG_DATE,
    providers: { anthropic: { models: [], defaults: {} } },
  };
  const emptyCache: ModelCatalog = {
    schemaVersion: 1,
    updatedAt: TEST_CATALOG_DATE,
    providers: { anthropic: { models: [], defaults: {} } },
  };
  const r = resolveAll({}, emptyRemote, emptyCache, BUNDLED_CATALOG, APP);
  assert.strictEqual(r.anthropic.source, 'bundled');
  assert.ok(r.anthropic.models.length > 0);
  assert.strictEqual(r.anthropic.defaults['claude-code'], 'claude-sonnet-5');
});

test('a source containing only future-gated models falls back to this build bundled floor', () => {
  const remote: ModelCatalog = {
    schemaVersion: 1,
    updatedAt: TEST_CATALOG_DATE,
    providers: {
      anthropic: {
        models: [{
          id: 'future-only', label: 'Future', description: '', tier: 'high',
          deprecated: false, order: 0, minAppVersion: '99.0.0',
        }],
        defaults: { 'claude-code': 'future-only' },
      },
    },
  };
  const r = resolveAll({}, remote, null, BUNDLED_CATALOG, APP);
  assert.strictEqual(r.anthropic.source, 'bundled');
  assert.ok(r.anthropic.models.some((model) => model.id === 'claude-sonnet-5'));
});

test('minAppVersion filters entries above the running app version', () => {
  const bundled: ModelCatalog = {
    schemaVersion: 1,
    updatedAt: TEST_CATALOG_DATE,
    providers: {
      anthropic: {
        defaults: {},
        models: [
          { id: 'now', label: 'Now', description: '', tier: 'high', deprecated: false, order: 0 },
          { id: 'future', label: 'Future', description: '', tier: 'high', deprecated: false, order: 1, minAppVersion: '2.0.0' },
        ],
      },
      openai: { models: [], defaults: {} },
      gemini: { models: [], defaults: {} },
      codex: { models: [], defaults: {} },
      opencode: { models: [], defaults: {} },
    },
  };
  const r = resolveAll({}, null, null, bundled, '1.9.0');
  const ids = r.anthropic.models.map((m) => m.id);
  assert.deepStrictEqual(ids, ['now'], 'future-gated entry filtered out at 1.9.0');
  const r2 = resolveAll({}, null, null, bundled, '2.1.0');
  assert.deepStrictEqual(r2.anthropic.models.map((m) => m.id).sort(), ['future', 'now']);
});

test('deprecated catalog model absent from a live probe is preserved + flagged (R2)', () => {
  const remote: ModelCatalog = {
    schemaVersion: 1,
    updatedAt: TEST_CATALOG_DATE,
    providers: {
      anthropic: {
        defaults: {},
        models: [{ id: 'claude-legacy', label: 'Legacy', description: '', tier: 'high', deprecated: true, order: 5 }],
      },
    },
  };
  const discovery: DiscoveryResults = {
    anthropic: [{ id: 'claude-sonnet-5', label: 'raw', description: '', tier: 'medium', deprecated: false, order: 0 }],
  };
  const r = resolveAll(discovery, remote, null, BUNDLED_CATALOG, APP);
  assert.strictEqual(r.anthropic.source, 'live');
  const legacy = r.anthropic.models.find((m) => m.id === 'claude-legacy');
  assert.ok(legacy, 'deprecated catalog model preserved despite live absence');
  assert.strictEqual(legacy!.deprecated, true);
  assert.ok(r.anthropic.models.some((m) => m.id === 'claude-sonnet-5'), 'live model still present');
});

test('remote/cache older than the bundled audit date cannot hide the bundled floor', () => {
  const stale: ModelCatalog = {
    schemaVersion: 1,
    updatedAt: '2026-07-25T00:00:00Z',
    providers: {
      codex: {
        models: [{ id: 'old-only', label: 'Old', description: '', tier: 'medium', deprecated: false, order: 0 }],
        defaults: { codex: 'old-only' },
      },
    },
  };
  const bundled: ModelCatalog = {
    ...BUNDLED_CATALOG,
    updatedAt: '2026-09-13T00:00:00Z',
  };

  assert.strictEqual(isCatalogAtLeastAsFresh(stale, bundled), false);
  assert.strictEqual(resolveAll({}, stale, stale, bundled, APP).codex.source, 'bundled');
  assert.ok(resolveAll({}, stale, stale, bundled, APP).codex.models.some((model) => model.id === 'gpt-5.6-sol'));
});

// ── Sprint 127: feed contract and per-row static merge (R3, R7) ────────────

const AUTO_ROW_FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, 'testdata', 'auto-row.fixture.json'), 'utf-8'));
const S127_BUNDLED: ModelCatalog = { ...BUNDLED_CATALOG, updatedAt: '2026-09-13T00:00:00Z' };
const S127_APP = '1.12.0';

function feed(updatedAt: string, anthropicModels: unknown[], defaults: Record<string, string> = {}): ModelCatalog {
  return validateCatalog({ schemaVersion: 1, updatedAt, providers: { anthropic: { models: anthropicModels, defaults } } });
}

test('S127: the automated-row fixture validates with every Sprint 127 field', () => {
  const v = feed('2026-09-24T09:10:00Z', [AUTO_ROW_FIXTURE.row]);
  const row = v.providers.anthropic!.models[0];
  assert.strictEqual(row.provenance, 'auto');
  assert.strictEqual(row.addedAt, '2026-09-24T09:10:00Z');
  assert.deepStrictEqual(row.claudeCode, { inject: true, maxOutputTokens: 64000 });
});

test('S127 S30: a malformed Claude id rejects the whole feed (fail-closed)', () => {
  assert.throws(() => feed(TEST_CATALOG_DATE, [{ ...AUTO_ROW_FIXTURE.row, id: 'not a model; rm -rf /' }]));
  assert.throws(() => feed(TEST_CATALOG_DATE, [{ ...AUTO_ROW_FIXTURE.row, id: 'gpt-6' }]));
  assert.doesNotThrow(() => feed(TEST_CATALOG_DATE, [{ ...AUTO_ROW_FIXTURE.row, id: 'claude-opus-6[1m]' }]));
});

test('S127: new fields are type-checked; unknown claudeCode keys are dropped', () => {
  assert.throws(() => feed(TEST_CATALOG_DATE, [{ ...AUTO_ROW_FIXTURE.row, provenance: 'bot' }]));
  assert.throws(() => feed(TEST_CATALOG_DATE, [{ ...AUTO_ROW_FIXTURE.row, addedAt: 'yesterday' }]));
  assert.throws(() => feed(TEST_CATALOG_DATE, [{ ...AUTO_ROW_FIXTURE.row, retired: 'yes' }]));
  assert.throws(() => feed(TEST_CATALOG_DATE, [{ ...AUTO_ROW_FIXTURE.row, claudeCode: { maxOutputTokens: 1.5 } }]));
  assert.throws(() => feed(TEST_CATALOG_DATE, [{ ...AUTO_ROW_FIXTURE.row, claudeCode: { behavesAs: 'opus; rm' } }]));
  const v = feed(TEST_CATALOG_DATE, [{ ...AUTO_ROW_FIXTURE.row, claudeCode: { inject: true, contextWindow: 1000000 } }]);
  assert.deepStrictEqual(v.providers.anthropic!.models[0].claudeCode, { inject: true });
});

test('S127: claudeCode is kept only on anthropic rows', () => {
  const v = validateCatalog({
    schemaVersion: 1, updatedAt: TEST_CATALOG_DATE,
    providers: { openai: { models: [{ id: 'gpt-x', label: 'X', description: '', tier: 'high', deprecated: false, order: 0, claudeCode: { inject: true } }], defaults: {} } },
  });
  assert.strictEqual(v.providers.openai!.models[0].claudeCode, undefined);
});

test('S127 S10: a stale feed cannot hide a bundled model', () => {
  const stale = validateCatalog(JSON.parse(fs.readFileSync(path.join(__dirname, 'testdata', 'stale-feed-2026-07-25.json'), 'utf-8')));
  const r = resolveAll({}, stale, stale, S127_BUNDLED, S127_APP);
  assert.ok(r.anthropic.models.some((m) => m.id === 'claude-fable-5-1'), 'bundled Fable 5.1 survives the 2026-07-25 feed');
  assert.ok(r.codex.models.some((m) => m.id === 'gpt-6-astra'), 'bundled Astra survives');
});

test('S127 S11: a stale feed cannot resurrect a row the build dropped', () => {
  const stale = validateCatalog(JSON.parse(fs.readFileSync(path.join(__dirname, 'testdata', 'stale-feed-2026-07-25.json'), 'utf-8')));
  const r = resolveAll({}, stale, stale, S127_BUNDLED, S127_APP);
  assert.ok(!r.codex.models.some((m) => m.id === 'gpt-5.3-codex'), 'old Codex row stays hidden');
  assert.strictEqual(r.codex.source, 'bundled');
});

test('S127 S12: an automated row published after the build is added', () => {
  const overlay = feed('2026-09-24T09:10:00Z', [AUTO_ROW_FIXTURE.row]);
  const r = resolveAll({}, overlay, null, S127_BUNDLED, S127_APP);
  const opus6 = r.anthropic.models.find((m) => m.id === 'claude-opus-6');
  assert.ok(opus6, 'auto row offered');
  assert.ok(r.anthropic.models.some((m) => m.id === 'claude-sonnet-5'), 'bundled rows kept alongside');
  assert.strictEqual(r.anthropic.source, 'remote');
  const ordered = r.anthropic.models.map((m) => m.id);
  assert.ok(ordered.indexOf('claude-opus-6') < ordered.indexOf(CLAUDE_MODEL_IDS.OPUS_5_5), 'sorted just before its predecessor');
});

test('S127 S12: an automated row survives a build newer than its publish date', () => {
  const overlay = feed('2026-09-24T09:10:00Z', [AUTO_ROW_FIXTURE.row]);
  const laterBuild: ModelCatalog = { ...BUNDLED_CATALOG, updatedAt: '2026-10-01T00:00:00Z' };
  const r = resolveAll({}, overlay, null, laterBuild, S127_APP);
  assert.ok(r.anthropic.models.some((m) => m.id === 'claude-opus-6'));
});

test('S127 S33: automated rows stay invisible to builds below their minAppVersion', () => {
  const overlay = feed('2026-09-24T09:10:00Z', [AUTO_ROW_FIXTURE.row]);
  const r = resolveAll({}, overlay, null, S127_BUNDLED, '1.11.0');
  assert.ok(!r.anthropic.models.some((m) => m.id === 'claude-opus-6'));
});

test('S127 S13: a fresher feed relabels a bundled row', () => {
  const overlay = feed('2026-09-24T00:00:00Z', [
    { id: 'claude-opus-5', label: 'Opus 5 (renamed)', description: '', tier: 'high', deprecated: false, order: 1 },
  ]);
  const r = resolveAll({}, overlay, null, S127_BUNDLED, S127_APP);
  const opus = r.anthropic.models.find((m) => m.id === 'claude-opus-5')!;
  assert.strictEqual(opus.label, 'Opus 5 (renamed)');
  assert.deepStrictEqual(opus.thinkingEffort?.levels, ['low', 'medium', 'high', 'xhigh', 'max'], 'bundled capability floor');
});

test('S127 S13: an older feed cannot relabel a newer bundled row', () => {
  const overlay = feed('2026-09-01T00:00:00Z', [
    { id: 'claude-opus-5', label: 'Stale label', description: '', tier: 'high', deprecated: false, order: 1 },
  ]);
  const r = resolveAll({}, overlay, null, S127_BUNDLED, S127_APP);
  assert.strictEqual(r.anthropic.models.find((m) => m.id === 'claude-opus-5')!.label, 'Opus 5');
});

test('S127 S14: a fresher tombstone removes a model from static and live lists', () => {
  const overlay = feed('2026-09-24T09:10:00Z', [{ ...AUTO_ROW_FIXTURE.row, retired: true }]);
  const staticOnly = resolveAll({}, overlay, null, S127_BUNDLED, S127_APP);
  assert.ok(!staticOnly.anthropic.models.some((m) => m.id === 'claude-opus-6'));
  const live = resolveAll({
    anthropic: [
      { id: 'claude-opus-6', resolvedModel: 'claude-opus-6', label: 'Opus 6', description: '', tier: 'medium', deprecated: false, order: 0 },
      { id: 'sonnet', resolvedModel: 'claude-sonnet-5', label: 'Sonnet', description: '', tier: 'medium', deprecated: false, order: 1 },
    ],
  }, overlay, null, S127_BUNDLED, S127_APP);
  assert.deepStrictEqual(live.anthropic.models.map((m) => m.id), ['sonnet']);
  const bundledTombstoned = feed('2026-09-24T09:10:00Z', [
    { id: 'claude-fable-5', label: 'Fable 5', description: '', tier: 'high', deprecated: false, order: 4, retired: true },
  ]);
  assert.ok(!resolveAll({}, bundledTombstoned, null, S127_BUNDLED, S127_APP).anthropic.models.some((m) => m.id === 'claude-fable-5'));
});

test('S127 S14: an older tombstone cannot hide a newer bundled row', () => {
  const overlay = feed('2026-09-01T00:00:00Z', [
    { id: 'claude-fable-5', label: 'Fable 5', description: '', tier: 'high', deprecated: false, order: 4, retired: true },
  ]);
  assert.ok(resolveAll({}, overlay, null, S127_BUNDLED, S127_APP).anthropic.models.some((m) => m.id === 'claude-fable-5'));
});

test('S127 S15: an automated row never becomes the default', () => {
  const overlay = feed('2026-09-24T09:10:00Z', [AUTO_ROW_FIXTURE.row], { 'claude-code': 'claude-opus-6' });
  const r = resolveAll({}, overlay, null, S127_BUNDLED, S127_APP);
  assert.strictEqual(r.anthropic.defaults['claude-code'], 'claude-sonnet-5');
});

test('S127: resolveStaticModels exposes merged rows for runtime declarations', () => {
  const overlay = feed('2026-09-24T09:10:00Z', [AUTO_ROW_FIXTURE.row]);
  const rows = resolveStaticModels('anthropic', overlay, null, S127_BUNDLED, S127_APP);
  assert.ok(rows.some((m) => m.id === 'claude-opus-6' && m.claudeCode?.inject === true));
  assert.ok(!resolveStaticModels('anthropic', overlay, null, S127_BUNDLED, '1.11.0').some((m) => m.id === 'claude-opus-6'));
});

test('S127 S28: an unavailable saved model is replaced by the default and reported', () => {
  const r = resolveAll({}, null, null, S127_BUNDLED, S127_APP).anthropic;
  assert.deepStrictEqual(resolveRequestedModelIn(r, 'claude-opus-6', 'claude-code'), { id: 'claude-sonnet-5', substitutedFrom: 'claude-opus-6' });
  assert.deepStrictEqual(resolveRequestedModelIn(r, 'claude-opus-5', 'claude-code'), { id: 'claude-opus-5' });
  assert.deepStrictEqual(resolveRequestedModelIn(r, undefined, 'claude-code'), { id: 'claude-sonnet-5' }, 'nothing saved: no notice');
});

test('S127: live alias rows take the curated presentation of the model they resolve to, and keep their ids', () => {
  const live: DiscoveryResults = {
    anthropic: [
      { id: 'default', resolvedModel: 'claude-sonnet-5', label: 'Default (recommended)', description: '', tier: 'medium', deprecated: false, order: 0 },
      { id: 'sonnet', resolvedModel: 'claude-sonnet-5', label: 'Sonnet', description: '', tier: 'medium', deprecated: false, order: 1 },
      { id: CLAUDE_MODEL_IDS.FABLE_5_1, resolvedModel: CLAUDE_MODEL_IDS.FABLE_5_1, label: 'Fable', description: '', tier: 'medium', deprecated: false, order: 2 },
      { id: 'opus', resolvedModel: CLAUDE_MODEL_IDS.OPUS_5_5, label: 'Opus', description: '', tier: 'medium', deprecated: false, order: 3 },
      { id: 'opus[1m]', resolvedModel: `${CLAUDE_MODEL_IDS.OPUS_5_5}[1m]`, label: 'Opus (1M context)', description: '', tier: 'medium', deprecated: false, order: 4 },
      { id: 'haiku', resolvedModel: CLAUDE_MODEL_IDS.HAIKU_4_5, label: 'Haiku', description: '', tier: 'medium', deprecated: false, order: 5 },
    ],
  };
  const models = resolveAll(live, null, null, BUNDLED_CATALOG, APP).anthropic.models;
  const opus = findModelEntry(models, 'opus')!;
  assert.strictEqual(opus.id, 'opus', 'a saved alias keeps resolving');
  assert.strictEqual(opus.label, 'Opus 5.5', 'curated label, not the CLI family name');
  assert.strictEqual(opus.resolvedModel, CLAUDE_MODEL_IDS.OPUS_5_5);
  assert.strictEqual(findModelEntry(models, CLAUDE_MODEL_IDS.OPUS_5_5)?.id, 'opus', 'the concrete id reconciles to the alias row');
  assert.strictEqual(findModelEntry(models, 'opus[1m]')?.label, 'Opus (1M context)', 'a 1M variant keeps its own label');
  assert.strictEqual(findModelEntry(models, 'sonnet')?.label, 'Sonnet 5');
  assert.strictEqual(findModelEntry(models, 'haiku')?.label, 'Haiku 4.5');
  assert.deepStrictEqual(
    models.filter((model) => !model.id.endsWith('[1m]')).map((model) => model.label),
    ['Sonnet 5', 'Opus 5.5', 'Fable 5.1', 'Haiku 4.5'],
    'curated order',
  );
});

test('S127 S28: a turn on the replacement of an unavailable saved model owes the notice', () => {
  const same = (a: string, b: string) => a === b;
  const saved = { id: 'claude-sonnet-5', substitutedFrom: 'claude-opus-4-1' };
  assert.deepStrictEqual(substitutionForTurn(saved, 'claude-sonnet-5', same), { from: 'claude-opus-4-1', to: 'claude-sonnet-5' }, 'the sidebar already sent the replacement');
  assert.strictEqual(substitutionForTurn(saved, 'claude-opus-5', same), undefined, 'the user chose another model');
  assert.strictEqual(substitutionForTurn({ id: 'claude-sonnet-5' }, 'claude-sonnet-5', same), undefined, 'the saved model is available');
  assert.strictEqual(substitutionForTurn(undefined, 'claude-sonnet-5', same), undefined, 'not a Claude turn');
  const byIdentity = (a: string, b: string) => a.replace(/^sonnet$/, 'claude-sonnet-5') === b.replace(/^sonnet$/, 'claude-sonnet-5');
  assert.deepStrictEqual(substitutionForTurn(saved, 'sonnet', byIdentity), { from: 'claude-opus-4-1', to: 'claude-sonnet-5' }, 'aliases compare by identity');
});

test('versionLt compares dotted-numeric versions correctly', () => {
  assert.strictEqual(versionLt('1.9.0', '2.0.0'), true);
  assert.strictEqual(versionLt('2.0.0', '1.9.0'), false);
  assert.strictEqual(versionLt('1.9.0', '1.9.0'), false);
  assert.strictEqual(versionLt('1.10.0', '1.9.0'), false, '10 > 9');
  assert.strictEqual(versionLt('1.9.0-beta', '1.9.0'), false, 'pre-release suffix dropped');
});

// ── summary ────────────────────────────────────────────────────────────────

if (failures > 0) {
  console.error(`\nmodelCatalog: ${failures} test(s) failed`);
  process.exit(1);
} else {
  console.log('\nmodelCatalog: all tests passed');
}
