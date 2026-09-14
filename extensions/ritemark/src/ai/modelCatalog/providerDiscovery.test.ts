/** Focused Codex model-cache compatibility tests for Sprint 116. */
import * as assert from 'assert';
import { parseCodexModelsCache } from './providerDiscovery';

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
console.log('providerDiscovery: current and legacy Codex cache schemas pass');
