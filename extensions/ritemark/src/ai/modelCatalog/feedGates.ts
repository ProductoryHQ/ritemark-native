/**
 * Gates for older apps, applied only to the published feed (Sprint 141, R6/R8).
 *
 * Every Ritemark from 1.8.1 reads `feeds/model-catalog.json`. A row whose model an
 * older app's runtime can't run is gated there with `minAppVersion`: the first
 * release whose bundled runtime runs it. The gates live here, not on the bundled
 * rows: before activation the catalog resolves as app version 0.0.0, so a gate on a
 * bundled row would hide it from this build itself.
 *
 * The export (`feedExport.ts`) applies them; a gate already in the feed is carried
 * on. Audit A1 (`docs/development/releases/v2.1.0/sprint-141-model-lineup/research/feed-readers-audit.md`)
 * records why each gate is what it is.
 *
 * Not part of the extension bundle.
 */

import {
  CLAUDE_MODEL_IDS,
  CODEX_MODEL_IDS,
  GEMINI_MODEL_IDS,
  OPENAI_MODEL_IDS,
  OPENROUTER_MODEL_IDS,
  toOpenCodeModelId,
} from '../modelConfig';
import type { Provider } from './schema';

export const FEED_MIN_APP_VERSION: Partial<Record<Provider, Record<string, string>>> = {
  // Codex 0.161.0 made GPT-6.1 Sol its own default; 1.14.0 is the first release with it (0.162.1).
  codex: { [CODEX_MODEL_IDS.SOL_6_1]: '1.14.0' },
  // Claude Code 2.1.296 (1.14.0) is the first bundled CLI that knows Haiku 5.5.
  anthropic: { [CLAUDE_MODEL_IDS.HAIKU_5_5]: '1.14.0' },
  // OpenCode rows from 2.0.0 (OpenCode 1.19.3), the version Argon was run on (c4808be).
  opencode: Object.fromEntries([
    toOpenCodeModelId('google', GEMINI_MODEL_IDS.ARGON_4),
    toOpenCodeModelId('openai', OPENAI_MODEL_IDS.SOL_6_1),
    toOpenCodeModelId('anthropic', CLAUDE_MODEL_IDS.SONNET_5_5),
    toOpenCodeModelId('anthropic', CLAUDE_MODEL_IDS.OPUS_5_5),
    toOpenCodeModelId('anthropic', CLAUDE_MODEL_IDS.HAIKU_5_5),
    toOpenCodeModelId('openrouter', toOpenCodeModelId('google', GEMINI_MODEL_IDS.ARGON_4)),
    toOpenCodeModelId('openrouter', OPENROUTER_MODEL_IDS.CLAUDE_SONNET_5_5),
    toOpenCodeModelId('openrouter', toOpenCodeModelId('openai', OPENAI_MODEL_IDS.SOL_6_1)),
  ].map((id) => [id, '2.0.0'])),
};
