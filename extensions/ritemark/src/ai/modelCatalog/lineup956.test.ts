import assert from 'node:assert/strict';
import { BUNDLED_CATALOG } from './bundledCatalog';
import { buildPublishedFeed } from './feedExport';
import { validateCatalog } from './schema';
import { resolveStaticModels } from './resolver';

const feed = validateCatalog(buildPublishedFeed(BUNDLED_CATALOG, undefined, '2099-01-01T00:00:00Z'));
for (const [provider, ids] of Object.entries({
  anthropic: ['claude-fable-5-2'],
  codex: ['gpt-6.1-terra', 'gpt-6-luna'],
  opencode: ['openai/gpt-6.1-terra', 'openai/gpt-6-luna', 'openrouter/openai/gpt-6.1-terra', 'openrouter/openai/gpt-6-luna'],
}) as Array<['anthropic' | 'codex' | 'opencode', string[]]>) {
  for (const id of ids) {
    const bundled = BUNDLED_CATALOG.providers[provider]!.models.find(row => row.id === id);
    assert.ok(bundled, `${provider}: ${id} is bundled`);
    assert.equal(bundled.minAppVersion, undefined);
    assert.equal(feed.providers[provider]!.models.find(row => row.id === id)?.minAppVersion, '2.3.0');
    assert.ok(!resolveStaticModels(provider, feed, null, { ...BUNDLED_CATALOG, providers: {} }, '2.2.0').some(row => row.id === id));
    assert.ok(resolveStaticModels(provider, feed, null, { ...BUNDLED_CATALOG, providers: {} }, '2.3.0').some(row => row.id === id));
  }
}
// The OpenAI API rows (Flows with an OpenAI key) stay as they are: GPT-6.1 Sol was never listed there either.
for (const id of ['gpt-6.1-terra', 'gpt-6-luna']) assert.ok(!BUNDLED_CATALOG.providers.openai!.models.some(row => row.id === id), `openai: ${id} stays out`);
console.log('lineup956: all tests passed');
