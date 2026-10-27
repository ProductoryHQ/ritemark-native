/**
 * The Flow editor's default models (Sprint 141, R4).
 *
 * A Flow's LLM step runs on the catalog's `flow-llm` default when it has no model
 * of its own (`LLMNodeExecutor`). The editor proposes the same model for a new step,
 * so a feed default reaches both. The image steps' defaults stay `DEFAULT_MODELS`':
 * image lists are not in the catalog.
 */

import { DEFAULT_MODELS } from '../ai/modelConfig';

export type FlowLlmDefault = (provider: 'openai' | 'gemini', surface: 'flow-llm') => string;

export type FlowModelDefaults = { [K in keyof typeof DEFAULT_MODELS]: string };

export function flowModelDefaults(getDefault: FlowLlmDefault): FlowModelDefaults {
  return {
    ...DEFAULT_MODELS,
    flowLLM: getDefault('openai', 'flow-llm') || DEFAULT_MODELS.flowLLM,
    flowLLMGemini: getDefault('gemini', 'flow-llm') || DEFAULT_MODELS.flowLLMGemini,
  };
}

/**
 * The list a step's model picker asked for (Sprint 144, P4). The panel sends `flow:getModels` with `modelType`
 * 'llm' or 'image'; the host used to read `message.type` instead, so it answered every request with the LLM list
 * and `modelType: 'flow:getModels'`, which no panel matched, and the picker stayed greyed until its 5-second
 * timeout. Anything that isn't 'image' is the LLM list, as before.
 */
export function flowModelRequestType(message: { modelType?: unknown }): 'llm' | 'image' {
  return message.modelType === 'image' ? 'image' : 'llm';
}
