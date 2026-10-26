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
