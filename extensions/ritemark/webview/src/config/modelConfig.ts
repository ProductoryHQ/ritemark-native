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

// Minimal fallback if extension hasn't sent config yet
const FALLBACK_CONFIG: ModelConfig = {
  openaiLLM: [{ id: 'gpt-4o', name: 'GPT-4o' }],
  openaiImage: [{ id: 'gpt-image-1.5', name: 'GPT Image 1.5' }],
  geminiLLM: [{ id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' }],
  geminiImage: [{ id: 'imagen-4.0-fast-generate-001', name: 'Imagen 4 Fast' }],
  defaults: {
    assistant: 'gpt-4o-mini',
    flowLLM: 'gpt-5.2',
    flowLLMGemini: 'gemini-2.5-flash',
    flowImage: 'gpt-image-1.5',
    flowImageGemini: 'imagen-4.0-fast-generate-001',
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

/**
 * Get default assistant model
 */
export function getDefaultAssistantModel(): string {
  return currentConfig.defaults.assistant;
}
