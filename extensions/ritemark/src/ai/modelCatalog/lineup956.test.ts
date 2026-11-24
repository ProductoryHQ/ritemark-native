import assert from 'node:assert/strict';
import { CODEX_MODEL_IDS, DEFAULT_MODELS, getModelConfig, toOpenCodeModelId } from '../modelConfig';
import { BUNDLED_CATALOG } from './bundledCatalog';
import { buildPublishedFeed } from './feedExport';
import { validateCatalog } from './schema';
import { resolveAll, resolveRequestedModelIn, resolveStaticModels } from './resolver';

const gpt62 = [CODEX_MODEL_IDS.SOL_6_2, CODEX_MODEL_IDS.ASTRA_6_2];
const openCodeOpenAI = gpt62.map(id => toOpenCodeModelId('openai', id));
const openCodeOpenRouter = openCodeOpenAI.map(id => toOpenCodeModelId('openrouter', id));
const emptyCatalog = { ...BUNDLED_CATALOG, providers: {} };

const feed = validateCatalog(buildPublishedFeed(BUNDLED_CATALOG, undefined, '2099-01-01T00:00:00Z'));
for (const [provider, ids] of Object.entries({
  anthropic: ['claude-fable-5-2'],
  codex: [...gpt62, 'gpt-6.1-terra', 'gpt-6-luna'],
  opencode: [...openCodeOpenAI, ...openCodeOpenRouter, 'openai/gpt-6.1-terra', 'openai/gpt-6-luna', 'openrouter/openai/gpt-6.1-terra', 'openrouter/openai/gpt-6-luna'],
}) as Array<['anthropic' | 'codex' | 'opencode', string[]]>) {
  for (const id of ids) {
    const bundled = BUNDLED_CATALOG.providers[provider]!.models.find(row => row.id === id);
    assert.ok(bundled, `${provider}: ${id} is bundled`);
    assert.equal(bundled.minAppVersion, undefined);
    assert.equal(feed.providers[provider]!.models.find(row => row.id === id)?.minAppVersion, '2.3.0');
    assert.ok(!resolveStaticModels(provider, feed, null, emptyCatalog, '2.2.0').some(row => row.id === id));
    assert.ok(resolveStaticModels(provider, feed, null, emptyCatalog, '2.3.0').some(row => row.id === id));
  }
}
const bundled = resolveAll({}, null, null, BUNDLED_CATALOG, '0.0.0');
assert.equal(bundled.codex.defaults.codex, CODEX_MODEL_IDS.SOL_6_2);
assert.equal(feed.providers.codex?.defaults.codex, CODEX_MODEL_IDS.SOL_6_2);
assert.deepEqual(bundled.codex.models.slice(0, 2).map(row => row.id), gpt62);
assert.deepEqual(bundled.openai.models.slice(0, 2).map(row => row.id), gpt62);
assert.deepEqual(bundled.opencode.models.filter(row => row.id.startsWith('openai/')).slice(0, 2).map(row => row.id), openCodeOpenAI);
assert.deepEqual(bundled.opencode.models.filter(row => row.id.startsWith('openrouter/openai/')).slice(0, 2).map(row => row.id), openCodeOpenRouter);
assert.equal(bundled.openai.defaults['flow-llm'], DEFAULT_MODELS.flowLLM);

const priorFeed = validateCatalog(buildPublishedFeed({
  ...BUNDLED_CATALOG,
  providers: { codex: {
    defaults: { codex: CODEX_MODEL_IDS.SOL_6_1 },
    models: BUNDLED_CATALOG.providers.codex!.models.filter(row => !gpt62.some(id => id === row.id)),
  } },
}, undefined, '2099-01-01T00:00:00Z'));
const older = resolveAll({}, feed, null, priorFeed, '2.2.0').codex;
assert.deepEqual(resolveRequestedModelIn(older, undefined, 'codex'), { id: CODEX_MODEL_IDS.SOL_6_1 });

for (const id of gpt62) {
  const row = feed.providers.openai!.models.find(model => model.id === id);
  assert.ok(row);
  // 2.2's modelConfig.ts lacks these, so its Flows would call them through Chat Completions.
  assert.equal(row.minAppVersion, '2.3.0');
  assert.equal(BUNDLED_CATALOG.providers.openai!.models.find(model => model.id === id)?.minAppVersion, undefined);
  assert.ok(!resolveStaticModels('openai', feed, null, emptyCatalog, '2.2.0').some(model => model.id === id));
  assert.ok(resolveStaticModels('openai', feed, null, emptyCatalog, '2.3.0').some(model => model.id === id));
  assert.equal(getModelConfig(id)?.api, 'responses');
}

// Terra and Luna remain agent-only.
for (const id of ['gpt-6.1-terra', 'gpt-6-luna']) assert.ok(!BUNDLED_CATALOG.providers.openai!.models.some(row => row.id === id), `openai: ${id} stays out`);
console.log('lineup956: all tests passed');

// Thinking effort follows Codex 0.171.0's own model list (`codex debug models`, 22 Nov 2026):
// GPT-6 Luna stops at Max and starts at Medium; GPT-6.2 Astra starts at Low.
const effortOf = (id: string) => bundled.codex.models.find(row => row.id === id)?.thinkingEffort;
const allSix = ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'];
assert.deepEqual(effortOf(CODEX_MODEL_IDS.SOL_6_2), { levels: allSix, defaultLevel: 'low' });
assert.deepEqual(effortOf(CODEX_MODEL_IDS.ASTRA_6_2), { levels: allSix, defaultLevel: 'low' });
assert.deepEqual(effortOf(CODEX_MODEL_IDS.TERRA_6_1), { levels: allSix, defaultLevel: 'low' });
assert.deepEqual(effortOf(CODEX_MODEL_IDS.LUNA_6), { levels: ['low', 'medium', 'high', 'xhigh', 'max'], defaultLevel: 'medium' }, 'GPT-6 Luna offers no Ultra');
