/** Focused Codex model-cache compatibility tests for Sprint 116. */
import * as assert from 'assert';
import { effortFromCapabilities, parseCodexModelsCache } from './providerDiscovery';

const current = parseCodexModelsCache({ models: [{
  slug: 'gpt-6-astra', display_name: 'GPT-6 Astra', description: 'Current cache row',
  visibility: 'list', priority: 1, default_reasoning_level: 'medium',
  supported_reasoning_levels: [
    { effort: 'low' }, { effort: 'medium' }, { effort: 'ultra' }, { effort: 'invented' },
  ],
}] });
assert.deepStrictEqual(current?.[0].thinkingEffort, {
  levels: ['low', 'medium', 'ultra'], defaultLevel: 'medium',
});

const legacy = parseCodexModelsCache({ models: [{
  slug: 'gpt-5.6-sol', visibility: 'list', default_reasoning_effort: 'low',
  supported_reasoning_efforts: ['low', 'medium', 'high'],
}] });
assert.deepStrictEqual(legacy?.[0].thinkingEffort, {
  levels: ['low', 'medium', 'high'], defaultLevel: 'low',
});
assert.strictEqual(parseCodexModelsCache({ models: [] }), null);
// Sprint 127 R2 (S8): /v1/models capability tree → effort levels.
assert.deepStrictEqual(effortFromCapabilities({
  effort: {
    supported: true,
    low: { supported: true }, medium: { supported: true }, high: { supported: true },
    xhigh: { supported: false }, max: { supported: true },
  },
}), { levels: ['low', 'medium', 'high', 'max'] });
assert.deepStrictEqual(effortFromCapabilities({ effort: { supported: false } }), { levels: [] });
assert.strictEqual(effortFromCapabilities(undefined), undefined);
assert.strictEqual(effortFromCapabilities({ image_input: { supported: true } }), undefined);
console.log('providerDiscovery: current and legacy Codex cache schemas and provider effort capabilities pass');
