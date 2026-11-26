/**
 * Sprint 141 R10 (#529): OpenCode's model lists from OpenCode's own list.
 * The fixture is the list OpenCode 1.19.4 builds from the models.dev registry for
 * Google, OpenAI, Anthropic and OpenRouter keys (audit A3), plus the keyless run's
 * free models. Pure — no vscode, network or key.
 * Run: npx tsx src/ai/modelCatalog/opencodeLiveList.test.ts
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { GEMINI_MODEL_IDS, OPENAI_MODEL_IDS, toOpenCodeModelId } from '../modelConfig';
import { BUNDLED_CATALOG } from './bundledCatalog';
import { openCodeLiveRows, type OpenCodeModelOption } from './opencodeLiveList';
import { resolveAll, resolveStaticModels } from './resolver';
import { deriveRuntimeAvailabilities, type RuntimeAvailabilityInput } from '../../runtime/availability';
import { openCodeModelOptions } from '../../acp/acpManager';
import type { ModelEntry } from './schema';

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

const APP = '2.1.0';
const GOOGLE_NEON = toOpenCodeModelId('google', GEMINI_MODEL_IDS.NEON_4);
const GOOGLE_ARGON = toOpenCodeModelId('google', GEMINI_MODEL_IDS.ARGON_4);
const HISTORICAL_FIXTURE: OpenCodeModelOption[] = JSON.parse(fs.readFileSync(path.join(__dirname, 'testdata', 'opencode-models.fixture.json'), 'utf8')).options;
// Extend the recorded list with a simulated OpenCode option for the new model.
const FIXTURE = [...HISTORICAL_FIXTURE, { value: GOOGLE_NEON, name: 'Google/Neon from OpenCode' }];
const CURATED = resolveStaticModels('opencode', null, null, BUNDLED_CATALOG, APP);
const ids = (rows: ModelEntry[]): string[] => rows.map((row) => row.id);
// Reconstruct the lineup from before #956 so Terra is still a newly discovered model.
const OPENAI_MODELS_SINCE_956 = [
  OPENAI_MODEL_IDS.TERRA_6_1, OPENAI_MODEL_IDS.LUNA_6,
  OPENAI_MODEL_IDS.SOL_6_2, OPENAI_MODEL_IDS.ASTRA_6_2,
];
const ADDED_SINCE_956 = new Set(OPENAI_MODELS_SINCE_956.flatMap(id => {
  const openai = toOpenCodeModelId('openai', id);
  return [openai, toOpenCodeModelId('openrouter', openai)];
}));
const CATALOG_BEFORE_956 = {
  ...BUNDLED_CATALOG,
  providers: {
    ...BUNDLED_CATALOG.providers,
    opencode: { ...BUNDLED_CATALOG.providers.opencode!, models: BUNDLED_CATALOG.providers.opencode!.models.filter((row) => !ADDED_SINCE_956.has(row.id)) },
  },
};
const CURATED_BEFORE_956 = resolveStaticModels('opencode', null, null, CATALOG_BEFORE_956, APP);
const offered = (rows: ModelEntry[], vendor: string): string[] => ids(rows.filter((row) => !row.hidden && row.id.startsWith(`${vendor}/`)));

function resolvedWith(live: ModelEntry[] | null): ModelEntry[] {
  return resolveAll({ opencode: live }, null, null, BUNDLED_CATALOG, APP).opencode.models;
}

test('S35: a keyed provider\'s group is OpenCode\'s list, with catalog labels for known models', () => {
  const models = resolvedWith(openCodeLiveRows(FIXTURE, CURATED));
  const neon = models.find((row) => row.id === GOOGLE_NEON);
  assert.strictEqual(neon?.label, 'Gemini 4 Neon');
  assert.strictEqual(neon?.description, 'Google — strong reasoning', 'the catalog\'s description, not OpenCode\'s name');
  assert.strictEqual(models[0].id, 'google/gemini-3.8-flash', 'catalog order first (decision 10: the free-tier model leads)');
});

test('S35/#529: a model the provider adds, newer than the lineup, is offered with OpenCode\'s name', () => {
  const models = resolveAll({ opencode: openCodeLiveRows(FIXTURE, CURATED_BEFORE_956) }, null, null, CATALOG_BEFORE_956, APP).opencode.models;
  const terra = models.find((row) => row.id === 'openai/gpt-6.1-terra');
  assert.ok(terra && !terra.hidden, 'GPT-6.1 Terra (not in the catalog) is offered');
  assert.strictEqual(terra.label, 'GPT-6.1 Terra');
  const curatedLast = Math.max(...models.filter((row) => CURATED_BEFORE_956.some((c) => c.id === row.id)).map((row) => row.order));
  assert.ok(terra.order > curatedLast, 'new models come after the curated ones');
});

test('S36: older models the catalog doesn\'t curate stay resolvable but hidden; the menu stays short', () => {
  const live = openCodeLiveRows(FIXTURE, CURATED);
  const models = resolvedWith(live);
  for (const vendor of ['google', 'openai', 'anthropic', 'openrouter']) {
    assert.ok(offered(models, vendor).length <= 20, `${vendor}: ${offered(models, vendor).length} offered`);
  }
  const older = models.find((row) => row.id === 'google/gemini-2.5-flash');
  assert.strictEqual(older?.hidden, true, 'gemini-2.5-flash: listed by OpenCode, not curated, older');
});

test('S36: embedding, speech, image, live and batch routes are not listed at all', () => {
  const live = openCodeLiveRows([
    { value: 'google/gemini-embedding-001' }, { value: 'google/gemini-4-flash-tts' }, { value: 'google/gemini-4-flash-image' },
    { value: 'google/gemini-4-live' }, { value: `openrouter/${GOOGLE_NEON}:batch` }, { value: 'openai/gpt-6.1-realtime' },
    { value: 'openai/gpt-6.1-audio' }, { value: 'google/gemma-4-27b' }, { value: 'openrouter/qwen/qwen-9-max' },
  ], CURATED);
  assert.deepStrictEqual(ids(live), []);
});

test('S36: OpenRouter keeps only the lineup\'s families, plus its curated rows', () => {
  const models = resolvedWith(openCodeLiveRows(FIXTURE, CURATED));
  for (const id of offered(models, 'openrouter')) {
    assert.ok(/^openrouter\/(google|openai|anthropic)\//.test(id) || CURATED.some((row) => row.id === id), id);
  }
  assert.ok(offered(models, 'openrouter').includes('openrouter/meta-llama/llama-3.3-70b-instruct'));
});

test('S37: a vendor the live list doesn\'t cover keeps its static rows', () => {
  const googleOnly = openCodeLiveRows(FIXTURE.filter((option) => option.value.startsWith('google/')), CURATED);
  const models = resolvedWith(googleOnly);
  const staticOnly = resolvedWith(null);
  assert.deepStrictEqual(offered(models, 'anthropic'), offered(staticOnly, 'anthropic'));
  assert.deepStrictEqual(offered(models, 'openai'), offered(staticOnly, 'openai'));
  assert.ok(offered(models, 'google').length > 0);
});

test('S37: OpenCode stays ready for a keyed provider whatever the live list holds', () => {
  const googleOnly = openCodeLiveRows(FIXTURE.filter((option) => option.value.startsWith('google/')), CURATED);
  const models = resolvedWith(googleOnly);
  const grouped: Record<string, Array<{ id: string }>> = {};
  for (const row of models) (grouped[row.id.split('/')[0]] ??= []).push({ id: row.id.slice(row.id.indexOf('/') + 1) });
  const input = {
    runtimeHydration: {
      'claude-code': { phase: 'ready', error: null },
      codex: { phase: 'ready', error: null },
      opencode: { phase: 'ready', error: null },
    },
    setupStatus: { state: 'ready', error: null },
    codexStatus: { state: 'ready', error: null },
    opencodeEnabled: true,
    acpProviders: { google: false, openai: false, anthropic: true, openrouter: false },
    byokProviderModels: grouped,
  } as unknown as RuntimeAvailabilityInput;
  assert.strictEqual(deriveRuntimeAvailabilities(input).opencode.state, 'ready');
});

test('S38: no live list (no network, no chat yet) is today\'s static list', () => {
  assert.deepStrictEqual(ids(resolvedWith(null)), ids(resolveAll({}, null, null, BUNDLED_CATALOG, APP).opencode.models));
  assert.deepStrictEqual(openCodeLiveRows([], CURATED), []);
});

test('S39: the keyless run\'s free models give Ritemark no row', () => {
  const free = FIXTURE.filter((option) => option.value.startsWith('opencode/'));
  assert.ok(free.length > 0);
  assert.deepStrictEqual(openCodeLiveRows(free, CURATED), []);
});

test('S35: narrowing by the provider\'s own list drops an unknown model it doesn\'t name, never a curated one', () => {
  const live = openCodeLiveRows(FIXTURE, CURATED_BEFORE_956, { openai: new Set(['gpt-6.1-sol']) });
  assert.ok(!ids(live).includes('openai/gpt-6.1-terra'), 'not in OpenAI\'s list for this key');
  assert.ok(ids(live).includes('openai/gpt-5.2'), 'curated rows stay: OpenCode runs them');
});

test('A model OpenCode doesn\'t list is not offered from the live list (version gates by construction)', () => {
  const withoutNeon = FIXTURE.filter((option) => option.value !== GOOGLE_NEON);
  const models = resolvedWith(openCodeLiveRows(withoutNeon, CURATED));
  assert.ok(!offered(models, 'google').includes(GOOGLE_NEON));
});

test('A saved pick on a hidden live model still resolves', () => {
  const models = resolvedWith(openCodeLiveRows(FIXTURE, CURATED));
  assert.ok(models.some((row) => row.id === 'google/gemini-2.5-flash' && row.hidden));
  assert.ok(models.some((row) => row.id === GOOGLE_ARGON && row.hidden));
});

test('acpManager reads the model option\'s choices from session/new', () => {
  const options = openCodeModelOptions([
    { id: 'mode', name: 'Mode', type: 'select', currentValue: 'build', options: [{ value: 'build', name: 'Build' }] },
    { id: 'model', name: 'Model', category: 'model', type: 'select', currentValue: 'opencode/beam-free', options: [{ value: GOOGLE_NEON, name: 'Google/Gemini 4 Neon' }, { value: 'opencode/beam-free', name: 'OpenCode/Beam Free' }] },
  ] as never);
  assert.deepStrictEqual(options, [{ value: GOOGLE_NEON, name: 'Google/Gemini 4 Neon' }, { value: 'opencode/beam-free', name: 'OpenCode/Beam Free' }]);
  assert.deepStrictEqual(openCodeModelOptions([] as never), []);
});

if (failures > 0) {
  console.error(`\nopencodeLiveList: ${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nopencodeLiveList: all tests passed');
