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

/** How a saved model the list no longer offers is named, in a step's picker and on its card. */
export function unavailableModelName(id: string): string {
  return `Unavailable: ${id}`;
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
    models: [{ id: selectedId, name: unavailableModelName(selectedId) }, ...models],
    unavailable: true,
  };
}

// Sprint 144 (P4): the image lists the host answered a step's `flow:getModels` with. A step's card and its panel
// read the same list, so they name the same model; until the host has answered, both read the built-in list.
const fetchedImageModels: Partial<Record<'openai' | 'gemini', ModelInfo[]>> = {};
const imageModelListeners = new Set<() => void>();

/** The panel stores the host's answer here (a non-empty list only; an error keeps the built-in one). */
export function setFetchedImageModels(provider: 'openai' | 'gemini', models: ModelInfo[]): void {
  if (models.length === 0) return;
  fetchedImageModels[provider] = models;
  for (const listener of [...imageModelListeners]) listener();
}

/** The image models a step offers: the host's answer once it came, else the built-in list. */
export function offeredImageModels(provider: 'openai' | 'gemini'): ModelInfo[] {
  return fetchedImageModels[provider] ?? getImageModels(provider);
}

/** For `useSyncExternalStore`: called when a host's answer changes `offeredImageModels`. */
export function subscribeImageModels(listener: () => void): () => void {
  imageModelListeners.add(listener);
  return () => { imageModelListeners.delete(listener); };
}

/**
 * The model an Image step runs on, as its card and its panel both name it (Sprint 144, P4). A run sends the saved
 * model as it is, or the provider's default when none is saved (`ImageNodeExecutor`, no substitution), so:
 * - by its name when the offered list has it;
 * - "Unavailable: <id>" for a saved model the list doesn't offer, as the panel's picker says (OpenAI removed its
 *   DALL·E models from the API on 12 May 2026, so a step saved on one fails when it runs);
 * - its id when the list is still empty (unknown is not unavailable), and for a default the list doesn't name.
 */
export function imageStepModel(
  savedModel: string | undefined,
  defaultModel: string,
  offered: ModelInfo[],
): { id: string; label: string; unavailable: boolean } {
  const id = savedModel || defaultModel;
  const known = offered.find(model => model.id === id);
  if (known) return { id, label: known.name, unavailable: false };
  if (savedModel && offered.length > 0) return { id, label: unavailableModelName(id), unavailable: true };
  return { id, label: id, unavailable: false };
}

/**
 * Sprint 144 P4: whether a Flow step's model picker waits for the host's list. It waits (greyed, "Loading models...")
 * only while it has no list at all; a known list, and the step's saved model, stay usable while the host refreshes it.
 */
export function modelListWaiting(isLoading: boolean, knownModels: number): boolean {
  return isLoading && knownModels === 0;
}

/**
 * Get default assistant model
 */
export function getDefaultAssistantModel(): string {
  return currentConfig.defaults.assistant;
}
