import assert from 'node:assert/strict';
import { getDefaultLLMModel, getModelConfig, modelOptionsWithPersistedSelection, setModelConfig } from './modelConfig';

const available = [{ id: 'current', name: 'Current' }];
assert.deepEqual(modelOptionsWithPersistedSelection(available, 'current'), {
  models: available,
  unavailable: false,
});
assert.deepEqual(modelOptionsWithPersistedSelection(available, 'retired'), {
  models: [{ id: 'retired', name: 'Unavailable: retired' }, ...available],
  unavailable: true,
});
assert.deepEqual(modelOptionsWithPersistedSelection(available, undefined), {
  models: available,
  unavailable: false,
});

// Sprint 141 R4: the Flow editor proposes the default the host sends, which is the
// catalog's `flow-llm` default (`flowModelDefaults`), not a list of its own.
assert.equal(getDefaultLLMModel('gemini'), '', 'nothing is proposed before the host sends its config');
setModelConfig({
  ...getModelConfig(),
  defaults: { ...getModelConfig().defaults, flowLLM: 'catalog-openai-default', flowLLMGemini: 'catalog-gemini-default' },
});
assert.equal(getDefaultLLMModel('gemini'), 'catalog-gemini-default');
assert.equal(getDefaultLLMModel('openai'), 'catalog-openai-default');
// A second config (the catalog changed while the editor was open) replaces the first.
setModelConfig({ ...getModelConfig(), defaults: { ...getModelConfig().defaults, flowLLMGemini: 'feed-gemini-default' } });
assert.equal(getDefaultLLMModel('gemini'), 'feed-gemini-default');

console.log('webview modelConfig.test.ts passed');
