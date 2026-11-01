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

/**
 * A step with no key for its provider can't run at all (Sprint 144 for the Google image step; Sprint 145 R5, #580,
 * for the OpenAI image step and the AI step on either provider; the Experience lead's words, experiences 13 and 31).
 * The step panel shows `text` and `action`, the action a link to Settings at that key (`settingsSection`, see
 * `RitemarkSettingsProvider`) whose tooltip is `tooltip`; a run that fails for the same reason says the same
 * sentence, as plain text.
 */
export interface StepKeyCopy {
  readonly text: string;
  readonly action: string;
  readonly tooltip: string;
  /** A `SettingsSection` of `RitemarkSettingsProvider` (not imported: the webview's tests load this file too). */
  readonly settingsSection: 'openai-api-key' | 'google-ai-key';
}

export const OPENAI_KEY_NEEDED: StepKeyCopy = {
  text: 'This step needs an OpenAI API key to run.',
  action: 'Add it in Settings',
  tooltip: 'Open Settings at the OpenAI API key',
  settingsSection: 'openai-api-key',
};

export const GOOGLE_AI_KEY_NEEDED: StepKeyCopy = {
  text: 'This step needs a Google AI API key to run.',
  action: 'Add it in Settings',
  tooltip: 'Open Settings at the Google AI API key',
  settingsSection: 'google-ai-key',
};

/** The words for a provider's missing key: OpenAI's, or Google AI's for Gemini (the Google image step's too). */
export function stepKeyCopy(provider: 'openai' | 'gemini'): StepKeyCopy {
  return provider === 'gemini' ? GOOGLE_AI_KEY_NEEDED : OPENAI_KEY_NEEDED;
}

/**
 * Where each provider's key is kept in the secret store: OpenAI's is `apiKeyManager`'s (its `API_KEY_ID`), Google
 * AI's is Settings' `google-ai-key`. The Flow steps, their model lists and the key watch read these names.
 */
export const STEP_KEY_SECRETS = { openai: 'openai-api-key', gemini: 'google-ai-key' } as const;

export function stepKeySecret(provider: 'openai' | 'gemini'): string {
  return provider === 'gemini' ? STEP_KEY_SECRETS.gemini : STEP_KEY_SECRETS.openai;
}

/**
 * What a step panel's model list is told when the step's key is missing (`flow:models`): the sentence, and the link
 * to Settings at that key with its tooltip. Only whether a key exists reaches the webview, never the key.
 */
export function stepKeyAnswer(copy: StepKeyCopy): {
  error: string;
  errorAction: { label: string; tooltip: string; settingsSection: StepKeyCopy['settingsSection'] };
} {
  return {
    error: copy.text,
    errorAction: { label: copy.action, tooltip: copy.tooltip, settingsSection: copy.settingsSection },
  };
}

/** Thrown where a step needs a key it doesn't have; its message is the plain sentence a run shows. */
export class StepNeedsKeyError extends Error {
  constructor(readonly copy: StepKeyCopy) {
    super(`${copy.text} ${copy.action}`);
    this.name = 'StepNeedsKeyError';
  }
}
