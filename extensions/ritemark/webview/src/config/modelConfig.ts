/**
 * Model Configuration for Webview
 *
 * This receives model config from the extension via postMessage.
 * Extension sends 'flow:modelConfig' on webview init.
 *
 * NOTE: This is populated at runtime from the extension's modelConfig.ts
 * to avoid duplicating model definitions.
 */

export interface ModelInfo {
  id: string;
  name: string;
}

export interface ModelConfig {
  openaiLLM: ModelInfo[];
  openaiImage: ModelInfo[];
  geminiLLM: ModelInfo[];
  geminiImage: ModelInfo[];
  defaults: {
    assistant: string;
    flowLLM: string;
    flowLLMGemini: string;
    flowImage: string;
    flowImageGemini: string;
  };
}

// Non-selectable bootstrap state until the extension sends the authoritative
// catalog. Model identifiers live only in the extension's modelConfig.ts.
const FALLBACK_CONFIG: ModelConfig = {
  openaiLLM: [],
  openaiImage: [],
  geminiLLM: [],
  geminiImage: [],
  defaults: {
    assistant: '',
    flowLLM: '',
    flowLLMGemini: '',
    flowImage: '',
    flowImageGemini: '',
  },
};

// Current config - updated when extension sends 'flow:modelConfig'
let currentConfig: ModelConfig = FALLBACK_CONFIG;

/**
 * Set model config (called when extension sends 'flow:modelConfig')
 */
export function setModelConfig(config: ModelConfig): void {
  currentConfig = config;
}

/**
 * Get current model config
 */
export function getModelConfig(): ModelConfig {
  return currentConfig;
}

/**
 * Get LLM models for a provider
 */
export function getLLMModels(provider: 'openai' | 'gemini'): ModelInfo[] {
  return provider === 'openai'
    ? currentConfig.openaiLLM
    : currentConfig.geminiLLM;
}

/**
 * Get image models for a provider
 */
export function getImageModels(provider: 'openai' | 'gemini'): ModelInfo[] {
  return provider === 'openai'
    ? currentConfig.openaiImage
    : currentConfig.geminiImage;
}

/**
 * Get default LLM model for a provider
 */
export function getDefaultLLMModel(provider: 'openai' | 'gemini'): string {
  return provider === 'openai'
    ? currentConfig.defaults.flowLLM
    : currentConfig.defaults.flowLLMGemini;
}

/**
 * Get default image model for a provider
 */
export function getDefaultImageModel(provider: 'openai' | 'gemini'): string {
  return provider === 'openai'
    ? currentConfig.defaults.flowImage
    : currentConfig.defaults.flowImageGemini;
}

/** Keep a saved model visible without adding unavailable models to new-choice lists. */
export function modelOptionsWithPersistedSelection(
  models: ModelInfo[],
  selectedId: string | undefined,
): { models: ModelInfo[]; unavailable: boolean } {
  if (!selectedId || models.some(model => model.id === selectedId)) {
    return { models, unavailable: false };
  }
  return {
    models: [{ id: selectedId, name: `Unavailable: ${selectedId}` }, ...models],
    unavailable: true,
  };
}

/**
 * Get default assistant model
 */
export function getDefaultAssistantModel(): string {
  return currentConfig.defaults.assistant;
}
