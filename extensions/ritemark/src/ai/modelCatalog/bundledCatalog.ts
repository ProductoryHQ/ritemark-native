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
 * Sprint 127 R9 (2026-09-24): the Anthropic lineup follows the bundled Claude
 * Code (2.1.304 since v2.0.0), which supports every model in Anthropic's Claude Code catalog.
 * v1.13.0 (2026-10-04): Sonnet 5.5 joins as the recommended default; Sonnet 5 stays as the previous one.
 * v1.14.0 (2026-10-13): GPT-6.1 Sol, the default of the bundled Codex, becomes the
 * Codex default (#398); GPT-5.6 Sol stays selectable. Haiku 5.5 joins, which Claude Code
 * 2.1.296 resolves `haiku` to. Claude models below 5 (Opus 4.8, Haiku 4.5) are kept
 * for saved selections and hidden from model menus (`CLAUDE_MENU_MIN_GENERATION`).
 * v2.0.0 (2026-10-20): Claude Code 2.1.304; its live model list is the same as 2.1.296's
 * (the Sprint 127 probes), so the lineup does not change.
 * `npm run check:anthropic-models` re-checks that before each release (R10).
 * v2.1.0 (2026-10-26, Sprint 141): Gemini 4 Argon joins Flows' Gemini list and OpenCode's
 * Google and OpenRouter groups (#532); OpenCode's groups follow the lineup (Claude 5.5s,
 * GPT-6.1 Sol), with OpenRouter's own ids (R2); Flows' Gemini default is 3.5 Flash Lite,
 * and the 2.5 models are retained for saved selections (#531). Flows' defaults are written
 * once, in `DEFAULT_MODELS`. No row carries `minAppVersion`: before activation the catalog
 * resolves as app version 0.0.0, so a gate here would hide the row from this build itself.
 * Gates for older apps are the feed's (`feedGates.ts`, applied by the export).
 */

import type { ModelCatalog } from './schema';
import {
  CLAUDE_MODEL_IDS,
  CODEX_MODEL_IDS,
  DEFAULT_MODELS,
  GEMINI_MODEL_IDS,
  OPENAI_MODEL_IDS,
  OPENROUTER_MODEL_IDS,
  toOpenCodeModelId,
} from '../modelConfig';

export const BUNDLED_CATALOG: ModelCatalog = {
  schemaVersion: 1,
  updatedAt: '2026-10-26T00:00:00Z',
  providers: {
    anthropic: {
      defaults: { 'claude-code': CLAUDE_MODEL_IDS.SONNET_5_5 },
      models: [
        { id: CLAUDE_MODEL_IDS.SONNET_5_5, label: 'Sonnet 5.5', description: 'Fast & capable (recommended)', tier: 'medium', deprecated: false, order: 0, thinkingEffort: { levels: ['low', 'medium', 'high', 'xhigh', 'max'] } },
        { id: CLAUDE_MODEL_IDS.OPUS_5_5, label: 'Opus 5.5', description: 'Most capable Opus model', tier: 'high', deprecated: false, order: 1, thinkingEffort: { levels: ['low', 'medium', 'high', 'xhigh', 'max'] } },
        { id: CLAUDE_MODEL_IDS.SONNET_5, label: 'Sonnet 5', description: 'Previous Sonnet model', tier: 'medium', deprecated: false, order: 2, thinkingEffort: { levels: ['low', 'medium', 'high', 'xhigh', 'max'] } },
        { id: CLAUDE_MODEL_IDS.OPUS_5, label: 'Opus 5', description: 'Previous Opus model', tier: 'high', deprecated: false, order: 3, thinkingEffort: { levels: ['low', 'medium', 'high', 'xhigh', 'max'] } },
        { id: CLAUDE_MODEL_IDS.FABLE_5_1, label: 'Fable 5.1', description: 'Current long-horizon model', tier: 'high', deprecated: false, order: 4, thinkingEffort: { levels: ['low', 'medium', 'high', 'xhigh', 'max'] } },
        { id: CLAUDE_MODEL_IDS.OPUS_4_8, label: 'Opus 4.8', description: 'Retained for saved selections', tier: 'high', deprecated: true, order: 5, thinkingEffort: { levels: ['low', 'medium', 'high', 'xhigh', 'max'] } },
        { id: CLAUDE_MODEL_IDS.FABLE_5, label: 'Fable 5', description: 'Previous Fable generation', tier: 'high', deprecated: false, order: 6, thinkingEffort: { levels: ['low', 'medium', 'high', 'xhigh', 'max'] } },
        { id: CLAUDE_MODEL_IDS.HAIKU_5_5, label: 'Haiku 5.5', description: 'Quick & light', tier: 'low', deprecated: false, order: 7, thinkingEffort: { levels: ['low', 'medium', 'high', 'xhigh', 'max'] } },
        { id: CLAUDE_MODEL_IDS.HAIKU_4_5, label: 'Haiku 4.5', description: 'Retained for saved selections', tier: 'low', deprecated: true, order: 8 },
      ],
    },
    openai: {
      defaults: { 'flow-llm': DEFAULT_MODELS.flowLLM },
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
      defaults: { 'flow-llm': DEFAULT_MODELS.flowLLMGemini },
      models: [
        { id: GEMINI_MODEL_IDS.ARGON_4, label: 'Gemini 4 Argon', description: "Google's flagship reasoning model", tier: 'high', deprecated: false, order: 0 },
        { id: GEMINI_MODEL_IDS.PRO_3_1_PREVIEW, label: 'Gemini 3.1 Pro', description: 'Most capable Gemini with reasoning', tier: 'high', deprecated: false, order: 1 },
        { id: GEMINI_MODEL_IDS.FLASH_3_8, label: 'Gemini 3.8 Flash', description: 'Current fast Gemini model', tier: 'medium', deprecated: false, order: 2 },
        { id: GEMINI_MODEL_IDS.FLASH_LITE_3_5, label: 'Gemini 3.5 Flash Lite', description: 'Current low-cost Gemini model', tier: 'low', deprecated: false, order: 3 },
        { id: GEMINI_MODEL_IDS.PRO_2_5, label: 'Gemini 2.5 Pro', description: 'Retained for saved selections', tier: 'high', deprecated: true, order: 4 },
        { id: GEMINI_MODEL_IDS.FLASH_2_5, label: 'Gemini 2.5 Flash', description: 'Retained for saved selections', tier: 'low', deprecated: true, order: 5 },
        { id: GEMINI_MODEL_IDS.FLASH_LITE_2_5, label: 'Gemini 2.5 Flash Lite', description: 'Retained for saved selections', tier: 'low', deprecated: true, order: 6 },
      ],
    },
    codex: {
      defaults: { codex: CODEX_MODEL_IDS.SOL_6_1 },
      models: [
        { id: CODEX_MODEL_IDS.SOL_6_1, label: 'GPT-6.1 Sol', description: 'Latest agentic workhorse (recommended)', tier: 'high', deprecated: false, order: 0, thinkingEffort: { levels: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'], defaultLevel: 'low' } },
        { id: CODEX_MODEL_IDS.ASTRA, label: 'GPT-6 Astra', description: 'Most capable model', tier: 'high', deprecated: false, order: 1, thinkingEffort: { levels: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'], defaultLevel: 'medium' } },
        { id: CODEX_MODEL_IDS.SOL, label: 'GPT-5.6 Sol', description: 'Previous agentic workhorse', tier: 'high', deprecated: false, order: 2, thinkingEffort: { levels: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'], defaultLevel: 'low' } },
        { id: CODEX_MODEL_IDS.TERRA, label: 'GPT-5.6 Terra', description: 'Balanced', tier: 'medium', deprecated: false, order: 3, thinkingEffort: { levels: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'], defaultLevel: 'medium' } },
        { id: CODEX_MODEL_IDS.LUNA, label: 'GPT-5.6 Luna', description: 'Fast & light', tier: 'low', deprecated: false, order: 4, thinkingEffort: { levels: ['low', 'medium', 'high', 'xhigh', 'max'], defaultLevel: 'medium' } },
        { id: CODEX_MODEL_IDS.GPT_5_5, label: 'GPT-5.5', description: 'Previous flagship agentic model', tier: 'high', deprecated: false, order: 5, thinkingEffort: { levels: ['low', 'medium', 'high', 'xhigh'], defaultLevel: 'medium' } },
        { id: CODEX_MODEL_IDS.GPT_5_3_CODEX_SPARK, label: 'GPT-5.3 Codex Spark', description: 'Fast coding-focused model', tier: 'low', deprecated: false, order: 6, thinkingEffort: { levels: ['low', 'medium', 'high', 'xhigh'], defaultLevel: 'high' } },
        { id: CODEX_MODEL_IDS.GPT_5_4, label: 'GPT-5.4', description: 'Retained for saved selections', tier: 'medium', deprecated: true, order: 7, thinkingEffort: { levels: ['low', 'medium', 'high', 'xhigh'], defaultLevel: 'medium' } },
        { id: CODEX_MODEL_IDS.GPT_5_4_MINI, label: 'GPT-5.4 Mini', description: 'Retained for saved selections', tier: 'low', deprecated: true, order: 8, thinkingEffort: { levels: ['low', 'medium', 'high', 'xhigh'], defaultLevel: 'medium' } },
      ],
    },
    // opencode is BYOK/multi-vendor: ids are composite `<vendor>/<model>`; consumers
    // group by the id prefix. Kept in sync with the curated OpenCode picker list.
    // Sprint 141 R2: a row joins when the provider's own public list and models.dev
    // (OpenCode's registry) both name it, with tool calling.
    opencode: {
      defaults: {},
      models: [
        // Sprint 141 decision 10: the first row is OpenCode's one-shot model and the composer's
        // first choice, so it is one Google's free tier serves (3.8 Flash; Argon and 3.1 Pro
        // are "Not available" on it, Gemini API pricing page of 2026-10-26).
        { id: toOpenCodeModelId('google', GEMINI_MODEL_IDS.FLASH_3_8), label: 'Gemini 3.8 Flash', description: 'Google — current fast model', tier: 'medium', deprecated: false, order: 0 },
        { id: toOpenCodeModelId('google', GEMINI_MODEL_IDS.ARGON_4), label: 'Gemini 4 Argon', description: 'Google — flagship reasoning', tier: 'high', deprecated: false, order: 1 },
        { id: toOpenCodeModelId('google', GEMINI_MODEL_IDS.PRO_3_1_PREVIEW), label: 'Gemini 3.1 Pro', description: 'Google — most capable, deep reasoning', tier: 'high', deprecated: false, order: 2 },
        { id: toOpenCodeModelId('google', GEMINI_MODEL_IDS.FLASH_LITE_3_5), label: 'Gemini 3.5 Flash Lite', description: 'Google — current low-cost model', tier: 'low', deprecated: false, order: 3 },
        { id: toOpenCodeModelId('google', GEMINI_MODEL_IDS.PRO_2_5), label: 'Gemini 2.5 Pro', description: 'Retained for saved selections', tier: 'high', deprecated: true, order: 4 },
        { id: toOpenCodeModelId('openai', OPENAI_MODEL_IDS.SOL_6_1), label: 'GPT-6.1 Sol', description: 'OpenAI — latest agentic workhorse', tier: 'high', deprecated: false, order: 5 },
        { id: toOpenCodeModelId('openai', OPENAI_MODEL_IDS.ASTRA), label: 'GPT-6 Astra', description: 'OpenAI — most capable', tier: 'high', deprecated: false, order: 6 },
        { id: toOpenCodeModelId('openai', OPENAI_MODEL_IDS.SOL), label: 'GPT-5.6 Sol', description: 'OpenAI — reliable agentic model', tier: 'high', deprecated: false, order: 7 },
        { id: toOpenCodeModelId('openai', OPENAI_MODEL_IDS.TERRA), label: 'GPT-5.6 Terra', description: 'OpenAI — balanced agentic model', tier: 'medium', deprecated: false, order: 8 },
        { id: toOpenCodeModelId('openai', OPENAI_MODEL_IDS.LUNA), label: 'GPT-5.6 Luna', description: 'OpenAI — fast agentic model', tier: 'low', deprecated: false, order: 9 },
        { id: toOpenCodeModelId('openai', OPENAI_MODEL_IDS.GPT_5_2), label: 'GPT-5.2', description: 'OpenAI — stable reasoning model', tier: 'high', deprecated: false, order: 10 },
        { id: toOpenCodeModelId('openai', OPENAI_MODEL_IDS.GPT_4O), label: 'GPT-4o', description: 'OpenAI — fast multimodal generalist', tier: 'medium', deprecated: false, order: 11 },
        { id: toOpenCodeModelId('anthropic', CLAUDE_MODEL_IDS.SONNET_5_5), label: 'Claude Sonnet 5.5', description: 'Anthropic — fast & capable', tier: 'medium', deprecated: false, order: 12 },
        { id: toOpenCodeModelId('anthropic', CLAUDE_MODEL_IDS.OPUS_5_5), label: 'Claude Opus 5.5', description: 'Anthropic — most capable', tier: 'high', deprecated: false, order: 13 },
        { id: toOpenCodeModelId('anthropic', CLAUDE_MODEL_IDS.HAIKU_5_5), label: 'Claude Haiku 5.5', description: 'Anthropic — quick & light', tier: 'low', deprecated: false, order: 14 },
        { id: toOpenCodeModelId('anthropic', CLAUDE_MODEL_IDS.SONNET_5), label: 'Claude Sonnet 5', description: 'Anthropic — previous Sonnet', tier: 'medium', deprecated: false, order: 15 },
        { id: toOpenCodeModelId('anthropic', CLAUDE_MODEL_IDS.OPUS_5), label: 'Claude Opus 5', description: 'Anthropic — previous Opus', tier: 'high', deprecated: false, order: 16 },
        { id: toOpenCodeModelId('anthropic', CLAUDE_MODEL_IDS.OPUS_4_8), label: 'Claude Opus 4.8', description: 'Anthropic — previous Opus generation', tier: 'high', deprecated: false, order: 17 },
        { id: toOpenCodeModelId('openrouter', toOpenCodeModelId('google', GEMINI_MODEL_IDS.ARGON_4)), label: 'Gemini 4 Argon', description: 'OpenRouter — Google via OpenRouter', tier: 'high', deprecated: false, order: 18 },
        { id: toOpenCodeModelId('openrouter', OPENROUTER_MODEL_IDS.CLAUDE_SONNET_5_5), label: 'Claude Sonnet 5.5', description: 'OpenRouter — Anthropic via OpenRouter', tier: 'medium', deprecated: false, order: 19 },
        { id: toOpenCodeModelId('openrouter', toOpenCodeModelId('anthropic', CLAUDE_MODEL_IDS.SONNET_5)), label: 'Claude Sonnet 5', description: 'OpenRouter — Anthropic via OpenRouter', tier: 'medium', deprecated: false, order: 20 },
        { id: toOpenCodeModelId('openrouter', toOpenCodeModelId('openai', OPENAI_MODEL_IDS.SOL_6_1)), label: 'GPT-6.1 Sol', description: 'OpenRouter — OpenAI via OpenRouter', tier: 'high', deprecated: false, order: 21 },
        { id: toOpenCodeModelId('openrouter', toOpenCodeModelId('google', GEMINI_MODEL_IDS.PRO_3_1_PREVIEW)), label: 'Gemini 3.1 Pro', description: 'OpenRouter — Google via OpenRouter', tier: 'high', deprecated: false, order: 22 },
        { id: toOpenCodeModelId('openrouter', toOpenCodeModelId('google', GEMINI_MODEL_IDS.FLASH_3_8)), label: 'Gemini 3.8 Flash', description: 'OpenRouter — Google via OpenRouter', tier: 'medium', deprecated: false, order: 23 },
        { id: toOpenCodeModelId('openrouter', toOpenCodeModelId('openai', OPENAI_MODEL_IDS.ASTRA)), label: 'GPT-6 Astra', description: 'OpenRouter — OpenAI via OpenRouter', tier: 'high', deprecated: false, order: 24 },
        { id: toOpenCodeModelId('openrouter', toOpenCodeModelId('openai', OPENAI_MODEL_IDS.SOL)), label: 'GPT-5.6 Sol', description: 'OpenRouter — OpenAI via OpenRouter', tier: 'high', deprecated: false, order: 25 },
        { id: toOpenCodeModelId('openrouter', toOpenCodeModelId('openai', OPENAI_MODEL_IDS.TERRA)), label: 'GPT-5.6 Terra', description: 'OpenRouter — OpenAI via OpenRouter', tier: 'medium', deprecated: false, order: 26 },
        { id: toOpenCodeModelId('openrouter', toOpenCodeModelId('openai', OPENAI_MODEL_IDS.LUNA)), label: 'GPT-5.6 Luna', description: 'OpenRouter — OpenAI via OpenRouter', tier: 'low', deprecated: false, order: 27 },
        { id: toOpenCodeModelId('openrouter', toOpenCodeModelId('openai', OPENAI_MODEL_IDS.GPT_5_2)), label: 'GPT-5.2', description: 'OpenRouter — OpenAI via OpenRouter', tier: 'high', deprecated: false, order: 28 },
        { id: toOpenCodeModelId('openrouter', OPENROUTER_MODEL_IDS.LLAMA_3_3_70B_INSTRUCT), label: 'Llama 3.3 70B', description: 'OpenRouter — open-weight, low cost', tier: 'low', deprecated: false, order: 29 },
      ],
    },
  },
};
