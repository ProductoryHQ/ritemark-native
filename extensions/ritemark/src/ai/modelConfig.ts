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

/** Canonical Codex agent model identifiers. */
export const CODEX_MODEL_IDS = {
  ASTRA: 'gpt-6-astra',
  SOL: 'gpt-5.6-sol',
  TERRA: 'gpt-5.6-terra',
  LUNA: 'gpt-5.6-luna',
  GPT_5_5: 'gpt-5.5',
  GPT_5_4: 'gpt-5.4',
  GPT_5_4_MINI: 'gpt-5.4-mini',
  GPT_5_3_CODEX_SPARK: 'gpt-5.3-codex-spark',
} as const;

export const CLAUDE_MODEL_IDS = {
  SONNET_5: 'claude-sonnet-5',
  OPUS_5: 'claude-opus-5',
  OPUS_4_8: 'claude-opus-4-8',
  FABLE_5_1: 'claude-fable-5-1',
  FABLE_5: 'claude-fable-5',
  HAIKU_4_5: 'claude-haiku-4-5-20251001',
} as const;

export const OPENAI_MODEL_IDS = {
  ASTRA: CODEX_MODEL_IDS.ASTRA,
  SOL: CODEX_MODEL_IDS.SOL,
  TERRA: CODEX_MODEL_IDS.TERRA,
  LUNA: CODEX_MODEL_IDS.LUNA,
  GPT_5_2: 'gpt-5.2',
  GPT_5_1: 'gpt-5.1',
  GPT_5_MINI: 'gpt-5-mini',
  GPT_5_NANO: 'gpt-5-nano',
  GPT_4O: 'gpt-4o',
  GPT_4O_MINI: 'gpt-4o-mini',
} as const;

export const GEMINI_MODEL_IDS = {
  PRO_3_1_PREVIEW: 'gemini-3.1-pro-preview',
  FLASH_3_8: 'gemini-3.8-flash',
  FLASH_LITE_3_5: 'gemini-3.5-flash-lite',
  PRO_2_5: 'gemini-2.5-pro',
  FLASH_2_5: 'gemini-2.5-flash',
  FLASH_LITE_2_5: 'gemini-2.5-flash-lite',
} as const;

export const OPENAI_IMAGE_MODEL_IDS = {
  IMAGE_2: 'gpt-image-2',
  IMAGE_1_5: 'gpt-image-1.5',
  IMAGE_1: 'gpt-image-1',
  DALL_E_3: 'dall-e-3',
} as const;

export const GEMINI_IMAGE_MODEL_IDS = {
  FLASH_3_1: 'gemini-3.1-flash-image',
  PRO_3: 'gemini-3-pro-image',
  FLASH_2_5: 'gemini-2.5-flash-image',
} as const;

export const OPENROUTER_MODEL_IDS = {
  LLAMA_3_3_70B_INSTRUCT: 'meta-llama/llama-3.3-70b-instruct',
} as const;

/** Compose OpenCode's provider-qualified route without duplicating model IDs. */
export function toOpenCodeModelId(provider: string, modelId: string): string {
  return `${provider}/${modelId}`;
}

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
 * OpenAI LLM Models (September 2026)
 *
 * Note: Model IDs verified against OpenAI API
 * Run `openai.models.list()` to get current list
 */
export const OPENAI_LLM_MODELS: ModelConfig[] = [
  // GPT-5 Family (Responses API)
  {
    id: OPENAI_MODEL_IDS.ASTRA,
    name: 'GPT-6 Astra',
    description: 'Most capable model for complex, demanding work',
    api: 'responses',
    reasoning: 'medium',
    contextWindow: 400000,
    supportsTools: true,
    supportsStreaming: true,
    costTier: 'high',
  },
  {
    id: OPENAI_MODEL_IDS.SOL,
    name: 'GPT-5.6 Sol',
    description: 'Reliable agentic workhorse for everyday tasks',
    api: 'responses',
    reasoning: 'low',
    contextWindow: 400000,
    supportsTools: true,
    supportsStreaming: true,
    costTier: 'high',
  },
  {
    id: OPENAI_MODEL_IDS.TERRA,
    name: 'GPT-5.6 Terra',
    description: 'Balanced agentic model for everyday work',
    api: 'responses',
    reasoning: 'medium',
    contextWindow: 400000,
    supportsTools: true,
    supportsStreaming: true,
    costTier: 'medium',
  },
  {
    id: OPENAI_MODEL_IDS.LUNA,
    name: 'GPT-5.6 Luna',
    description: 'Fast and affordable agentic model',
    api: 'responses',
    reasoning: 'medium',
    contextWindow: 400000,
    supportsTools: true,
    supportsStreaming: true,
    costTier: 'low',
  },
  {
    id: OPENAI_MODEL_IDS.GPT_5_2,
    name: 'GPT-5.2',
    description: 'Stable Flow default with enhanced reasoning',
    api: 'responses',
    reasoning: 'medium',
    contextWindow: 400000,
    supportsTools: true,
    supportsStreaming: true,
    costTier: 'high',
  },
  {
    id: OPENAI_MODEL_IDS.GPT_5_1,
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
    id: OPENAI_MODEL_IDS.GPT_5_MINI,
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
    id: OPENAI_MODEL_IDS.GPT_5_NANO,
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
    id: OPENAI_MODEL_IDS.GPT_4O,
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
    id: OPENAI_MODEL_IDS.GPT_4O_MINI,
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
 * OpenAI Image Models (September 2026)
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
    id: OPENAI_IMAGE_MODEL_IDS.IMAGE_2,
    name: 'GPT Image 2',
    description: 'Current image generation and editing model',
    supportsEdit: true,
    returnsBase64: true,
    sizes: ['1024x1024', '1536x1024', '1024x1536'],
    qualities: ['low', 'medium', 'high', 'auto'],
  },
  {
    id: OPENAI_IMAGE_MODEL_IDS.IMAGE_1_5,
    name: 'GPT Image 1.5',
    description: 'Deprecated; migrate saved flows to GPT Image 2',
    supportsEdit: true,
    returnsBase64: true,
    sizes: ['1024x1024', '1536x1024', '1024x1536'],
    qualities: ['low', 'medium', 'high', 'auto'],
    deprecated: true,
  },
  {
    id: OPENAI_IMAGE_MODEL_IDS.IMAGE_1,
    name: 'GPT Image 1',
    description: 'Previous generation image model',
    supportsEdit: true,
    returnsBase64: true,
    sizes: ['1024x1024', '1536x1024', '1024x1536'],
    qualities: ['low', 'medium', 'high'],
    deprecated: true,
  },
  {
    id: OPENAI_IMAGE_MODEL_IDS.DALL_E_3,
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
 * Gemini LLM Models (September 2026)
 *
 * Model IDs from: https://ai.google.dev/gemini-api/docs/models
 */
export const GEMINI_LLM_MODELS: ModelConfig[] = [
  {
    id: GEMINI_MODEL_IDS.PRO_3_1_PREVIEW,
    name: 'Gemini 3.1 Pro',
    description: 'Most capable Gemini model with reasoning',
    api: 'chat',
    reasoning: 'medium',
    contextWindow: 1000000,
    supportsTools: true,
    supportsStreaming: true,
    costTier: 'high',
  },
  {
    id: GEMINI_MODEL_IDS.FLASH_3_8,
    name: 'Gemini 3.8 Flash',
    description: 'Current fast Gemini model',
    api: 'chat',
    reasoning: 'low',
    contextWindow: 1000000,
    supportsTools: true,
    supportsStreaming: true,
    costTier: 'medium',
  },
  {
    id: GEMINI_MODEL_IDS.FLASH_LITE_3_5,
    name: 'Gemini 3.5 Flash Lite',
    description: 'Current low-cost Gemini model',
    api: 'chat',
    reasoning: 'none',
    contextWindow: 1000000,
    supportsTools: true,
    supportsStreaming: true,
    costTier: 'low',
  },
  {
    id: GEMINI_MODEL_IDS.PRO_2_5,
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
    id: GEMINI_MODEL_IDS.FLASH_2_5,
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
    id: GEMINI_MODEL_IDS.FLASH_LITE_2_5,
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
 * Gemini Image Models (September 2026)
 *
 * Native Gemini image models (Nano Banana)
 * Model IDs from: https://ai.google.dev/gemini-api/docs/models
 */
export const GEMINI_IMAGE_MODELS: ImageModelConfig[] = [
  {
    id: GEMINI_IMAGE_MODEL_IDS.FLASH_3_1,
    name: 'Gemini 3.1 Flash Image',
    description: 'Current fast native image generation and editing model',
    supportsEdit: true,
    returnsBase64: true,
    sizes: ['1024x1024', '1536x1024', '1024x1536'],
    qualities: ['standard'],
  },
  {
    id: GEMINI_IMAGE_MODEL_IDS.PRO_3,
    name: 'Gemini 3 Pro Image',
    description: 'High-fidelity native image generation and editing model',
    supportsEdit: true,
    returnsBase64: true,
    sizes: ['1024x1024', '1536x1024', '1024x1536'],
    qualities: ['standard', 'hd'],
  },
  {
    id: GEMINI_IMAGE_MODEL_IDS.FLASH_2_5,
    name: 'Gemini 2.5 Flash Image',
    description: 'Deprecated; migrate saved flows to Gemini 3.1 Flash Image',
    supportsEdit: true,
    returnsBase64: true,
    sizes: ['1024x1024'],
    qualities: ['standard'],
    deprecated: true,
  },
];

// BYOK/OpenCode provider models (`BYOK_PROVIDER_MODELS`, `ByokProvider`,
// `ByokModelOption`, `toOpenCodeModelValue`) moved to `src/ai/modelCatalog`
// (Sprint 89, GH #109). Consumers call `modelCatalog.getByokProviderModels()`.

/**
 * Default models for different use cases
 */
export const DEFAULT_MODELS = {
  /** Default for Ritemark AI Assistant (needs tools + streaming) */
  assistant: OPENAI_MODEL_IDS.GPT_4O_MINI,

  /** Default for Flow LLM nodes - OpenAI */
  flowLLM: OPENAI_MODEL_IDS.GPT_5_2,

  /** Default for Flow LLM nodes - Gemini */
  flowLLMGemini: GEMINI_MODEL_IDS.FLASH_2_5,

  /** Default for Flow Image nodes - OpenAI */
  flowImage: OPENAI_IMAGE_MODEL_IDS.IMAGE_2,

  /** Default for Flow Image nodes - Gemini */
  flowImageGemini: GEMINI_IMAGE_MODEL_IDS.FLASH_3_1,
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

// Claude Code runtime models (`CLAUDE_MODELS`, `DEFAULT_MODEL`) moved to
// `src/ai/modelCatalog` (Sprint 89, GH #109). The Claude list is now resolved
// live (`/v1/models`) with the catalog as the curated/offline layer; consumers
// call `modelCatalog.getModels('anthropic')` / `getDefault('anthropic','claude-code')`.
