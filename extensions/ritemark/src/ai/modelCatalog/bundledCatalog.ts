/**
 * Bundled baseline catalog — the offline floor (Sprint 89, GH #109).
 *
 * This is the lowest layer of the resolver waterfall: used only when live probes,
 * the remote catalog, and the on-disk cache are all unavailable. It guarantees the
 * app renders a correct, current model list with zero network.
 *
 * Shipped inside the VSIX as a typed const (NOT a .json import — tsconfig has no
 * `resolveJsonModule`, and a compiled const is type-checked and needs no runtime
 * file read). The PUBLISHED catalog (`feeds/model-catalog.json` in ritemark-public)
 * mirrors this shape and is what gets edited to add a model without an app release.
 *
 * Keep this seed in sync with the published catalog at publish time (Phase 4).
 * Model ids frozen from the Sprint 116 provider/runtime audit on 2026-09-13.
 */

import type { ModelCatalog } from './schema';
import {
  CLAUDE_MODEL_IDS,
  CODEX_MODEL_IDS,
  GEMINI_MODEL_IDS,
  OPENAI_MODEL_IDS,
  OPENROUTER_MODEL_IDS,
  toOpenCodeModelId,
} from '../modelConfig';

export const BUNDLED_CATALOG: ModelCatalog = {
  schemaVersion: 1,
  updatedAt: '2026-09-13T00:00:00Z',
  providers: {
    anthropic: {
      defaults: { 'claude-code': CLAUDE_MODEL_IDS.SONNET_5 },
      models: [
        { id: CLAUDE_MODEL_IDS.SONNET_5, label: 'Sonnet 5', description: 'Fast & capable (recommended)', tier: 'medium', deprecated: false, order: 0, thinkingEffort: { levels: ['low', 'medium', 'high', 'xhigh', 'max'] } },
        { id: CLAUDE_MODEL_IDS.OPUS_5, label: 'Opus 5', description: 'Most powerful Opus-tier', tier: 'high', deprecated: false, order: 1, thinkingEffort: { levels: ['low', 'medium', 'high', 'xhigh', 'max'] } },
        { id: CLAUDE_MODEL_IDS.FABLE_5_1, label: 'Fable 5.1', description: 'Current long-horizon model', tier: 'high', deprecated: false, order: 2, thinkingEffort: { levels: ['low', 'medium', 'high', 'xhigh', 'max'] } },
        { id: CLAUDE_MODEL_IDS.OPUS_4_8, label: 'Opus 4.8', description: 'Previous Opus generation', tier: 'high', deprecated: false, order: 3, thinkingEffort: { levels: ['low', 'medium', 'high', 'xhigh', 'max'] } },
        { id: CLAUDE_MODEL_IDS.FABLE_5, label: 'Fable 5', description: 'Previous Fable generation', tier: 'high', deprecated: false, order: 4, thinkingEffort: { levels: ['low', 'medium', 'high', 'xhigh', 'max'] } },
        { id: CLAUDE_MODEL_IDS.HAIKU_4_5, label: 'Haiku 4.5', description: 'Quick & light', tier: 'low', deprecated: false, order: 5 },
      ],
    },
    openai: {
      defaults: { 'flow-llm': OPENAI_MODEL_IDS.GPT_5_2 },
      models: [
        { id: OPENAI_MODEL_IDS.ASTRA, label: 'GPT-6 Astra', description: 'Most capable model for complex work', tier: 'high', deprecated: false, order: 0 },
        { id: OPENAI_MODEL_IDS.SOL, label: 'GPT-5.6 Sol', description: 'Reliable agentic workhorse', tier: 'high', deprecated: false, order: 1 },
        { id: OPENAI_MODEL_IDS.TERRA, label: 'GPT-5.6 Terra', description: 'Balanced agentic model', tier: 'medium', deprecated: false, order: 2 },
        { id: OPENAI_MODEL_IDS.LUNA, label: 'GPT-5.6 Luna', description: 'Fast agentic model', tier: 'low', deprecated: false, order: 3 },
        { id: OPENAI_MODEL_IDS.GPT_5_2, label: 'GPT-5.2', description: 'Stable Flow default', tier: 'high', deprecated: false, order: 4 },
        { id: OPENAI_MODEL_IDS.GPT_5_1, label: 'GPT-5.1', description: 'Previous flagship, complex tasks', tier: 'high', deprecated: false, order: 5 },
        { id: OPENAI_MODEL_IDS.GPT_5_MINI, label: 'GPT-5 Mini', description: 'Cost-efficient with good reasoning', tier: 'medium', deprecated: false, order: 6 },
        { id: OPENAI_MODEL_IDS.GPT_5_NANO, label: 'GPT-5 Nano', description: 'Fastest and cheapest', tier: 'low', deprecated: false, order: 7 },
        { id: OPENAI_MODEL_IDS.GPT_4O, label: 'GPT-4o', description: 'Previous-gen multimodal, great for tools', tier: 'medium', deprecated: false, order: 8 },
        { id: OPENAI_MODEL_IDS.GPT_4O_MINI, label: 'GPT-4o Mini', description: 'Fast and cheap, simple tasks', tier: 'low', deprecated: false, order: 9 },
      ],
    },
    gemini: {
      defaults: { 'flow-llm': GEMINI_MODEL_IDS.FLASH_2_5 },
      models: [
        { id: GEMINI_MODEL_IDS.PRO_3_1_PREVIEW, label: 'Gemini 3.1 Pro', description: 'Most capable Gemini with reasoning', tier: 'high', deprecated: false, order: 0 },
        { id: GEMINI_MODEL_IDS.FLASH_3_8, label: 'Gemini 3.8 Flash', description: 'Current fast Gemini model', tier: 'medium', deprecated: false, order: 1 },
        { id: GEMINI_MODEL_IDS.FLASH_LITE_3_5, label: 'Gemini 3.5 Flash Lite', description: 'Current low-cost Gemini model', tier: 'low', deprecated: false, order: 2 },
        { id: GEMINI_MODEL_IDS.PRO_2_5, label: 'Gemini 2.5 Pro', description: 'Powerful, complex tasks', tier: 'high', deprecated: false, order: 3 },
        { id: GEMINI_MODEL_IDS.FLASH_2_5, label: 'Gemini 2.5 Flash', description: 'Fast and efficient (stable)', tier: 'low', deprecated: false, order: 4 },
        { id: GEMINI_MODEL_IDS.FLASH_LITE_2_5, label: 'Gemini 2.5 Flash Lite', description: 'Cheapest Gemini 2.5 model', tier: 'low', deprecated: false, order: 5 },
      ],
    },
    codex: {
      defaults: { codex: CODEX_MODEL_IDS.SOL },
      models: [
        { id: CODEX_MODEL_IDS.ASTRA, label: 'GPT-6 Astra', description: 'Most capable Codex model', tier: 'high', deprecated: false, order: 0, thinkingEffort: { levels: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'], defaultLevel: 'medium' } },
        { id: CODEX_MODEL_IDS.SOL, label: 'GPT-5.6 Sol', description: 'Reliable agentic workhorse', tier: 'high', deprecated: false, order: 1, thinkingEffort: { levels: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'], defaultLevel: 'low' } },
        { id: CODEX_MODEL_IDS.TERRA, label: 'GPT-5.6 Terra', description: 'Balanced', tier: 'medium', deprecated: false, order: 2, thinkingEffort: { levels: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'], defaultLevel: 'medium' } },
        { id: CODEX_MODEL_IDS.LUNA, label: 'GPT-5.6 Luna', description: 'Fast & light', tier: 'low', deprecated: false, order: 3, thinkingEffort: { levels: ['low', 'medium', 'high', 'xhigh', 'max'], defaultLevel: 'medium' } },
        { id: CODEX_MODEL_IDS.GPT_5_5, label: 'GPT-5.5', description: 'Previous flagship agentic model', tier: 'high', deprecated: false, order: 4, thinkingEffort: { levels: ['low', 'medium', 'high', 'xhigh'], defaultLevel: 'medium' } },
        { id: CODEX_MODEL_IDS.GPT_5_3_CODEX_SPARK, label: 'GPT-5.3 Codex Spark', description: 'Fast coding-focused model', tier: 'low', deprecated: false, order: 5, thinkingEffort: { levels: ['low', 'medium', 'high', 'xhigh'], defaultLevel: 'high' } },
        { id: CODEX_MODEL_IDS.GPT_5_4, label: 'GPT-5.4', description: 'Retained for saved selections', tier: 'medium', deprecated: true, order: 6, thinkingEffort: { levels: ['low', 'medium', 'high', 'xhigh'], defaultLevel: 'medium' } },
        { id: CODEX_MODEL_IDS.GPT_5_4_MINI, label: 'GPT-5.4 Mini', description: 'Retained for saved selections', tier: 'low', deprecated: true, order: 7, thinkingEffort: { levels: ['low', 'medium', 'high', 'xhigh'], defaultLevel: 'medium' } },
      ],
    },
    // opencode is BYOK/multi-vendor: ids are composite `<vendor>/<model>`; consumers
    // group by the id prefix. Kept in sync with the curated OpenCode picker list.
    opencode: {
      defaults: {},
      models: [
        { id: toOpenCodeModelId('google', GEMINI_MODEL_IDS.PRO_3_1_PREVIEW), label: 'Gemini 3.1 Pro', description: 'Google — most capable, deep reasoning', tier: 'high', deprecated: false, order: 0 },
        { id: toOpenCodeModelId('google', GEMINI_MODEL_IDS.FLASH_3_8), label: 'Gemini 3.8 Flash', description: 'Google — current fast model', tier: 'medium', deprecated: false, order: 1 },
        { id: toOpenCodeModelId('google', GEMINI_MODEL_IDS.FLASH_LITE_3_5), label: 'Gemini 3.5 Flash Lite', description: 'Google — current low-cost model', tier: 'low', deprecated: false, order: 2 },
        { id: toOpenCodeModelId('google', GEMINI_MODEL_IDS.PRO_2_5), label: 'Gemini 2.5 Pro', description: 'Google — proven, large context', tier: 'high', deprecated: false, order: 3 },
        { id: toOpenCodeModelId('openai', OPENAI_MODEL_IDS.ASTRA), label: 'GPT-6 Astra', description: 'OpenAI — most capable', tier: 'high', deprecated: false, order: 4 },
        { id: toOpenCodeModelId('openai', OPENAI_MODEL_IDS.SOL), label: 'GPT-5.6 Sol', description: 'OpenAI — reliable agentic model', tier: 'high', deprecated: false, order: 5 },
        { id: toOpenCodeModelId('openai', OPENAI_MODEL_IDS.TERRA), label: 'GPT-5.6 Terra', description: 'OpenAI — balanced agentic model', tier: 'medium', deprecated: false, order: 6 },
        { id: toOpenCodeModelId('openai', OPENAI_MODEL_IDS.LUNA), label: 'GPT-5.6 Luna', description: 'OpenAI — fast agentic model', tier: 'low', deprecated: false, order: 7 },
        { id: toOpenCodeModelId('openai', OPENAI_MODEL_IDS.GPT_5_2), label: 'GPT-5.2', description: 'OpenAI — stable reasoning model', tier: 'high', deprecated: false, order: 8 },
        { id: toOpenCodeModelId('openai', OPENAI_MODEL_IDS.GPT_4O), label: 'GPT-4o', description: 'OpenAI — fast multimodal generalist', tier: 'medium', deprecated: false, order: 9 },
        { id: toOpenCodeModelId('anthropic', CLAUDE_MODEL_IDS.SONNET_5), label: 'Claude Sonnet 5', description: 'Anthropic — fast & capable', tier: 'medium', deprecated: false, order: 10 },
        { id: toOpenCodeModelId('anthropic', CLAUDE_MODEL_IDS.OPUS_5), label: 'Claude Opus 5', description: 'Anthropic — most powerful', tier: 'high', deprecated: false, order: 11 },
        { id: toOpenCodeModelId('anthropic', CLAUDE_MODEL_IDS.OPUS_4_8), label: 'Claude Opus 4.8', description: 'Anthropic — previous Opus generation', tier: 'high', deprecated: false, order: 12 },
        { id: toOpenCodeModelId('openrouter', toOpenCodeModelId('anthropic', CLAUDE_MODEL_IDS.SONNET_5)), label: 'Claude Sonnet 5', description: 'OpenRouter — Anthropic via OpenRouter', tier: 'medium', deprecated: false, order: 13 },
        { id: toOpenCodeModelId('openrouter', toOpenCodeModelId('google', GEMINI_MODEL_IDS.PRO_3_1_PREVIEW)), label: 'Gemini 3.1 Pro', description: 'OpenRouter — Google via OpenRouter', tier: 'high', deprecated: false, order: 14 },
        { id: toOpenCodeModelId('openrouter', toOpenCodeModelId('google', GEMINI_MODEL_IDS.FLASH_3_8)), label: 'Gemini 3.8 Flash', description: 'OpenRouter — Google via OpenRouter', tier: 'medium', deprecated: false, order: 15 },
        { id: toOpenCodeModelId('openrouter', toOpenCodeModelId('openai', OPENAI_MODEL_IDS.ASTRA)), label: 'GPT-6 Astra', description: 'OpenRouter — OpenAI via OpenRouter', tier: 'high', deprecated: false, order: 16 },
        { id: toOpenCodeModelId('openrouter', toOpenCodeModelId('openai', OPENAI_MODEL_IDS.SOL)), label: 'GPT-5.6 Sol', description: 'OpenRouter — OpenAI via OpenRouter', tier: 'high', deprecated: false, order: 17 },
        { id: toOpenCodeModelId('openrouter', toOpenCodeModelId('openai', OPENAI_MODEL_IDS.TERRA)), label: 'GPT-5.6 Terra', description: 'OpenRouter — OpenAI via OpenRouter', tier: 'medium', deprecated: false, order: 18 },
        { id: toOpenCodeModelId('openrouter', toOpenCodeModelId('openai', OPENAI_MODEL_IDS.LUNA)), label: 'GPT-5.6 Luna', description: 'OpenRouter — OpenAI via OpenRouter', tier: 'low', deprecated: false, order: 19 },
        { id: toOpenCodeModelId('openrouter', toOpenCodeModelId('openai', OPENAI_MODEL_IDS.GPT_5_2)), label: 'GPT-5.2', description: 'OpenRouter — OpenAI via OpenRouter', tier: 'high', deprecated: false, order: 20 },
        { id: toOpenCodeModelId('openrouter', OPENROUTER_MODEL_IDS.LLAMA_3_3_70B_INSTRUCT), label: 'Llama 3.3 70B', description: 'OpenRouter — open-weight, low cost', tier: 'low', deprecated: false, order: 21 },
      ],
    },
  },
};
