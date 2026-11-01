import assert from 'node:assert/strict';
import { getDefaultLLMModel, getModelConfig, modelListWaiting, modelOptionsWithPersistedSelection, setModelConfig } from './modelConfig';

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

// Sprint 144 P4: a step's model picker waits only while it has no list at all.
assert.equal(modelListWaiting(true, 0), true, 'no list yet: the picker waits');
assert.equal(modelListWaiting(true, 3), false, 'a known list stays usable while the host refreshes it');
assert.equal(modelListWaiting(false, 0), false, 'nothing is loading: the picker is never greyed');

// The host answers with the list the picker asked for (FlowEditorProvider, `flow:getModels`).
const { flowModelRequestType } = await import('../../../src/flows/flowModelDefaults');
assert.equal(flowModelRequestType({ modelType: 'llm' }), 'llm');
assert.equal(flowModelRequestType({ modelType: 'image' }), 'image', 'an Image step gets the image list');
assert.equal(flowModelRequestType({}), 'llm', 'an older panel without modelType gets the LLM list');
const request = { type: 'flow:getModels', provider: 'openai', modelType: 'llm' };
assert.notEqual(flowModelRequestType(request), request.type, "the message's own type is never the list's type");

// A Google image step with no key (Sprint 144, the Experience lead's words): the panel's line and a run's error say
// the same sentence; the panel's action opens Settings at that key.
const { GOOGLE_IMAGE_KEY_NEEDED, StepNeedsKeyError } = await import('../../../src/flows/flowModelDefaults');
const keyNeeded = new StepNeedsKeyError(GOOGLE_IMAGE_KEY_NEEDED);
assert.equal(keyNeeded.message, 'This step needs a Google AI API key to run. Add it in Settings', "a run's error, word for word");
assert.equal(`${GOOGLE_IMAGE_KEY_NEEDED.text} ${GOOGLE_IMAGE_KEY_NEEDED.action}`, keyNeeded.message, "the panel's line is the same sentence");
assert.equal(GOOGLE_IMAGE_KEY_NEEDED.settingsSection, 'google-ai-key');
assert.ok(!/⚠/.test(keyNeeded.message), 'no warning sign');

console.log('webview modelConfig.test.ts passed');
