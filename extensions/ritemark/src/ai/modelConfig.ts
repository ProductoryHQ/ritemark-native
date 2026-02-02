/**
 * Model Configuration
 *
 * Central configuration for all AI models used in Ritemark.
 * Used by: Ritemark AI Assistant, Flow Executor, Settings
 *
 * Model ID source: OpenAI API (openai.models.list())
 */

/**
 * API type for the model
 * - 'responses': OpenAI Responses API (GPT-5+, supports reasoning)
 * - 'chat': OpenAI Chat Completions API (GPT-4, supports tools/streaming)
 */
export type APIType = 'responses' | 'chat';

/**
 * Reasoning effort level for Responses API
 * Higher = more thinking tokens, better quality, slower/costlier
 */
export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high';

/**
 * Model configuration
 */
export interface ModelConfig {
  id: string;
  name: string;
  description: string;
  api: APIType;
  reasoning: ReasoningEffort;
  /** Context window size in tokens */
  contextWindow: number;
  /** Supports tool calling (function calling) */
  supportsTools: boolean;
  /** Supports streaming responses */
  supportsStreaming: boolean;
  /** Cost tier for UI display */
  costTier: 'low' | 'medium' | 'high';
}

/**
 * OpenAI LLM Models (January 2026)
 *
 * Note: Model IDs verified against OpenAI API
 * Run `openai.models.list()` to get current list
 */
export const OPENAI_LLM_MODELS: ModelConfig[] = [
  // GPT-5 Family (Responses API)
  {
    id: 'gpt-5.2',
    name: 'GPT-5.2',
    description: 'Latest flagship model with enhanced reasoning',
    api: 'responses',
    reasoning: 'medium',
    contextWindow: 400000,
    supportsTools: true,
    supportsStreaming: true,
    costTier: 'high',
  },
  {
    id: 'gpt-5.1',
    name: 'GPT-5.1',
    description: 'Previous flagship, excellent for complex tasks',
    api: 'responses',
    reasoning: 'medium',
    contextWindow: 128000,
    supportsTools: true,
    supportsStreaming: true,
    costTier: 'high',
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    description: 'Cost-efficient with good reasoning',
    api: 'responses',
    reasoning: 'low',
    contextWindow: 128000,
    supportsTools: true,
    supportsStreaming: true,
    costTier: 'medium',
  },
  {
    id: 'gpt-5-nano',
    name: 'GPT-5 Nano',
    description: 'Fastest and cheapest, basic tasks',
    api: 'responses',
    reasoning: 'none',
    contextWindow: 32000,
    supportsTools: true,
    supportsStreaming: true,
    costTier: 'low',
  },

  // GPT-4 Family (Chat Completions API)
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'Previous gen multimodal, great for tools',
    api: 'chat',
    reasoning: 'none',
    contextWindow: 128000,
    supportsTools: true,
    supportsStreaming: true,
    costTier: 'medium',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Fast and cheap, good for simple tasks',
    api: 'chat',
    reasoning: 'none',
    contextWindow: 128000,
    supportsTools: true,
    supportsStreaming: true,
    costTier: 'low',
  },
];

/**
 * OpenAI Image Models (January 2026)
 */
export interface ImageModelConfig {
  id: string;
  name: string;
  description: string;
  /** Supports input images for editing */
  supportsEdit: boolean;
  /** Returns base64 (true) or URL (false) */
  returnsBase64: boolean;
  /** Available sizes */
  sizes: string[];
  /** Quality options */
  qualities: string[];
  /** Deprecated model */
  deprecated?: boolean;
}

export const OPENAI_IMAGE_MODELS: ImageModelConfig[] = [
  {
    id: 'gpt-image-1.5',
    name: 'GPT Image 1.5',
    description: 'Latest image model with best quality',
    supportsEdit: true,
    returnsBase64: true,
    sizes: ['1024x1024', '1536x1024', '1024x1536'],
    qualities: ['low', 'medium', 'high', 'auto'],
  },
  {
    id: 'gpt-image-1',
    name: 'GPT Image 1',
    description: 'Previous generation image model',
    supportsEdit: true,
    returnsBase64: true,
    sizes: ['1024x1024', '1536x1024', '1024x1536'],
    qualities: ['low', 'medium', 'high'],
  },
  {
    id: 'dall-e-3',
    name: 'DALL-E 3',
    description: 'Legacy model (deprecated May 2026)',
    supportsEdit: false,
    returnsBase64: false,
    sizes: ['1024x1024', '1792x1024', '1024x1792'],
    qualities: ['standard', 'hd'],
    deprecated: true,
  },
];

/**
 * Gemini LLM Models (January 2026)
 *
 * Model IDs from: https://ai.google.dev/gemini-api/docs/models
 */
export const GEMINI_LLM_MODELS: ModelConfig[] = [
  {
    id: 'gemini-3-pro-preview',
    name: 'Gemini 3 Pro',
    description: 'Most capable Gemini model with reasoning',
    api: 'chat',
    reasoning: 'medium',
    contextWindow: 1000000,
    supportsTools: true,
    supportsStreaming: true,
    costTier: 'high',
  },
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash',
    description: 'Fast Gemini 3 for quick tasks',
    api: 'chat',
    reasoning: 'low',
    contextWindow: 1000000,
    supportsTools: true,
    supportsStreaming: true,
    costTier: 'medium',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: 'Powerful Gemini for complex tasks',
    api: 'chat',
    reasoning: 'medium',
    contextWindow: 1000000,
    supportsTools: true,
    supportsStreaming: true,
    costTier: 'high',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Fast and efficient (stable)',
    api: 'chat',
    reasoning: 'none',
    contextWindow: 1000000,
    supportsTools: true,
    supportsStreaming: true,
    costTier: 'low',
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    description: 'Cheapest Gemini model',
    api: 'chat',
    reasoning: 'none',
    contextWindow: 1000000,
    supportsTools: true,
    supportsStreaming: true,
    costTier: 'low',
  },
];

/**
 * Gemini Image Models (January 2026)
 *
 * Includes both Imagen 4 and native Gemini image models (Nano Banana)
 * Model IDs from: https://ai.google.dev/gemini-api/docs/imagen
 */
export const GEMINI_IMAGE_MODELS: ImageModelConfig[] = [
  // Imagen 4 family
  {
    id: 'imagen-4.0-fast-generate-001',
    name: 'Imagen 4 Fast',
    description: 'Fastest, $0.02/image',
    supportsEdit: false,
    returnsBase64: true,
    sizes: ['1024x1024', '1536x1024', '1024x1536'],
    qualities: ['standard'],
  },
  {
    id: 'imagen-4.0-generate-001',
    name: 'Imagen 4',
    description: 'Best quality text-to-image, $0.04/image',
    supportsEdit: false,
    returnsBase64: true,
    sizes: ['1024x1024', '1536x1024', '1024x1536', '2048x2048'],
    qualities: ['standard', 'hd'],
  },
  {
    id: 'imagen-4.0-ultra-generate-001',
    name: 'Imagen 4 Ultra',
    description: '2K resolution, highest fidelity',
    supportsEdit: false,
    returnsBase64: true,
    sizes: ['1024x1024', '2048x2048'],
    qualities: ['standard', 'hd', 'ultra'],
  },
  // Gemini native image generation (Nano Banana)
  {
    id: 'gemini-2.5-flash-image',
    name: 'Nano Banana Flash',
    description: 'Fast native image generation',
    supportsEdit: true,
    returnsBase64: true,
    sizes: ['1024x1024'],
    qualities: ['standard'],
  },
  {
    id: 'gemini-3-pro-image-preview',
    name: 'Nano Banana Pro',
    description: '14 reference images, character consistency',
    supportsEdit: true,
    returnsBase64: true,
    sizes: ['1024x1024', '1536x1024', '1024x1536'],
    qualities: ['standard', 'hd'],
  },
];

/**
 * Default models for different use cases
 */
export const DEFAULT_MODELS = {
  /** Default for Ritemark AI Assistant (needs tools + streaming) */
  assistant: 'gpt-4o-mini',

  /** Default for Flow LLM nodes - OpenAI */
  flowLLM: 'gpt-5.2',

  /** Default for Flow LLM nodes - Gemini */
  flowLLMGemini: 'gemini-2.5-flash',

  /** Default for Flow Image nodes - OpenAI */
  flowImage: 'gpt-image-1.5',

  /** Default for Flow Image nodes - Gemini */
  flowImageGemini: 'imagen-4.0-fast-generate-001',
} as const;

/**
 * Get model config by ID
 */
export function getModelConfig(modelId: string): ModelConfig | undefined {
  return OPENAI_LLM_MODELS.find((m) => m.id === modelId);
}

/**
 * Get image model config by ID
 */
export function getImageModelConfig(modelId: string): ImageModelConfig | undefined {
  return OPENAI_IMAGE_MODELS.find((m) => m.id === modelId);
}

/**
 * Check if model uses Responses API
 */
export function usesResponsesAPI(modelId: string): boolean {
  const config = getModelConfig(modelId);
  return config?.api === 'responses';
}

/**
 * Get reasoning effort for model
 */
export function getReasoningEffort(modelId: string): ReasoningEffort {
  const config = getModelConfig(modelId);
  return config?.reasoning ?? 'none';
}

/**
 * Check if model supports tool calling
 */
export function supportsToolCalling(modelId: string): boolean {
  const config = getModelConfig(modelId);
  return config?.supportsTools ?? false;
}

/**
 * Get models suitable for Ritemark AI Assistant
 * (requires tool calling support)
 */
export function getAssistantModels(): ModelConfig[] {
  return OPENAI_LLM_MODELS.filter((m) => m.supportsTools);
}

/**
 * Get all LLM models for Flow editor dropdown
 */
export function getFlowLLMModels(): ModelConfig[] {
  return OPENAI_LLM_MODELS;
}

/**
 * Get all image models for Flow editor dropdown
 */
export function getFlowImageModels(): ImageModelConfig[] {
  return OPENAI_IMAGE_MODELS.filter((m) => !m.deprecated);
}
