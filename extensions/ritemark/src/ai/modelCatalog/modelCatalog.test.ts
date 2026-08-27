/**
 * Unit tests for the model-catalog core (Sprint 89, GH #109).
 * Pure — no vscode/network. Run: npx tsx src/ai/modelCatalog/modelCatalog.test.ts
 */

import * as assert from 'assert';
import { validateCatalog, type ModelCatalog } from './schema';
import { BUNDLED_CATALOG } from './bundledCatalog';
import {
  canonicalizeModelAliases,
  findModelEntry,
  resolveAll,
  versionLt,
  type DiscoveryResults,
} from './resolver';

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

// ── schema.validateCatalog ─────────────────────────────────────────────────

test('validateCatalog accepts the bundled baseline (round-trip)', () => {
  const v = validateCatalog(JSON.parse(JSON.stringify(BUNDLED_CATALOG)));
  assert.strictEqual(v.schemaVersion, 1);
  assert.ok(v.providers.anthropic, 'anthropic present');
  assert.ok(v.providers.anthropic!.models.length >= 4);
});

test('validateCatalog throws on wrong schemaVersion', () => {
  assert.throws(() => validateCatalog({ schemaVersion: 2, updatedAt: 'x', providers: {} }));
});

test('validateCatalog throws on malformed model entry (missing id)', () => {
  assert.throws(() =>
    validateCatalog({
      schemaVersion: 1,
      updatedAt: 'x',
      providers: { anthropic: { models: [{ label: 'X', description: '', tier: 'high', deprecated: false, order: 0 }], defaults: {} } },
    }),
  );
});

test('validateCatalog throws on bad tier', () => {
  assert.throws(() =>
    validateCatalog({
      schemaVersion: 1,
      updatedAt: 'x',
      providers: { openai: { models: [{ id: 'a', label: 'A', description: '', tier: 'ultra', deprecated: false, order: 0 }], defaults: {} } },
    }),
  );
});

test('validateCatalog accepts canonical effort metadata and rejects invented levels', () => {
  const valid = validateCatalog({
    schemaVersion: 1,
    updatedAt: 'x',
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
    updatedAt: 'x',
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
    updatedAt: 'x',
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
    updatedAt: 'x',
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
    updatedAt: 'x',
    providers: { anthropic: { models: [{ id: 'remote-only', label: 'R', description: '', tier: 'high', deprecated: false, order: 0 }], defaults: { 'claude-code': 'remote-only' } } },
  };
  const r = resolveAll({}, remote, null, BUNDLED_CATALOG, APP);
  assert.strictEqual(r.anthropic.source, 'remote');
  assert.strictEqual(r.anthropic.models[0].id, 'remote-only');
});

test('remote model keeps the exact-pin bundled effort floor when the remote schema predates it', () => {
  const remote: ModelCatalog = {
    schemaVersion: 1,
    updatedAt: 'x',
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
    updatedAt: 'x',
    providers: { anthropic: { models: [{ id: 'cache-only', label: 'C', description: '', tier: 'high', deprecated: false, order: 0 }], defaults: {} } },
  };
  const r = resolveAll({}, null, cache, BUNDLED_CATALOG, APP);
  assert.strictEqual(r.anthropic.source, 'cache');
  assert.strictEqual(r.anthropic.models[0].id, 'cache-only');
});

test('minAppVersion filters entries above the running app version', () => {
  const bundled: ModelCatalog = {
    schemaVersion: 1,
    updatedAt: 'x',
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
    updatedAt: 'x',
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
