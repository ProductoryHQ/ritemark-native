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
const FIXTURE: OpenCodeModelOption[] = JSON.parse(fs.readFileSync(path.join(__dirname, 'testdata', 'opencode-models.fixture.json'), 'utf8')).options;
const CURATED = resolveStaticModels('opencode', null, null, BUNDLED_CATALOG, APP);
const ids = (rows: ModelEntry[]): string[] => rows.map((row) => row.id);
const offered = (rows: ModelEntry[], vendor: string): string[] => ids(rows.filter((row) => !row.hidden && row.id.startsWith(`${vendor}/`)));

function resolvedWith(live: ModelEntry[] | null): ModelEntry[] {
  return resolveAll({ opencode: live }, null, null, BUNDLED_CATALOG, APP).opencode.models;
}

test('S35: a keyed provider\'s group is OpenCode\'s list, with catalog labels for known models', () => {
  const models = resolvedWith(openCodeLiveRows(FIXTURE, CURATED));
  const argon = models.find((row) => row.id === 'google/gemini-4-argon');
  assert.strictEqual(argon?.label, 'Gemini 4 Argon');
  assert.strictEqual(argon?.description, 'Google — flagship reasoning', 'the catalog\'s description, not OpenCode\'s name');
  assert.strictEqual(models[0].id, 'google/gemini-3.8-flash', 'catalog order first (decision 10: the free-tier model leads)');
});

test('S35/#529: a model the provider adds, newer than the lineup, is offered with OpenCode\'s name', () => {
  const models = resolvedWith(openCodeLiveRows(FIXTURE, CURATED));
  const terra = models.find((row) => row.id === 'openai/gpt-6.1-terra');
  assert.ok(terra && !terra.hidden, 'GPT-6.1 Terra (not in the catalog) is offered');
  assert.strictEqual(terra.label, 'GPT-6.1 Terra');
  const curatedLast = Math.max(...models.filter((row) => CURATED.some((c) => c.id === row.id)).map((row) => row.order));
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
    { value: 'google/gemini-4-live' }, { value: 'openrouter/google/gemini-4-argon:batch' }, { value: 'openai/gpt-6.1-realtime' },
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
  const live = openCodeLiveRows(FIXTURE, CURATED, { openai: new Set(['gpt-6.1-sol']) });
  assert.ok(!ids(live).includes('openai/gpt-6.1-terra'), 'not in OpenAI\'s list for this key');
  assert.ok(ids(live).includes('openai/gpt-5.2'), 'curated rows stay: OpenCode runs them');
});

test('A model OpenCode doesn\'t list is not offered from the live list (version gates by construction)', () => {
  const withoutArgon = FIXTURE.filter((option) => option.value !== 'google/gemini-4-argon');
  const models = resolvedWith(openCodeLiveRows(withoutArgon, CURATED));
  assert.ok(!offered(models, 'google').includes('google/gemini-4-argon'));
});

test('A saved pick on a hidden live model still resolves', () => {
  const models = resolvedWith(openCodeLiveRows(FIXTURE, CURATED));
  assert.ok(models.some((row) => row.id === 'google/gemini-2.5-flash' && row.hidden));
});

test('acpManager reads the model option\'s choices from session/new', () => {
  const options = openCodeModelOptions([
    { id: 'mode', name: 'Mode', type: 'select', currentValue: 'build', options: [{ value: 'build', name: 'Build' }] },
    { id: 'model', name: 'Model', category: 'model', type: 'select', currentValue: 'opencode/beam-free', options: [{ value: 'google/gemini-4-argon', name: 'Google/Gemini 4 Argon' }, { value: 'opencode/beam-free', name: 'OpenCode/Beam Free' }] },
  ] as never);
  assert.deepStrictEqual(options, [{ value: 'google/gemini-4-argon', name: 'Google/Gemini 4 Argon' }, { value: 'opencode/beam-free', name: 'OpenCode/Beam Free' }]);
  assert.deepStrictEqual(openCodeModelOptions([] as never), []);
});

if (failures > 0) {
  console.error(`\nopencodeLiveList: ${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nopencodeLiveList: all tests passed');
