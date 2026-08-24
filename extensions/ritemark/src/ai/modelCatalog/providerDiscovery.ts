/**
 * Provider discovery — consolidated live probes (Sprint 89, GH #109).
 *
 * One home for every "ask the provider what models exist" path. Each probe is
 * independent, times out fast, and returns `ModelEntry[] | null` (null = probe
 * unavailable / failed → resolver falls back to catalog). Probes fabricate
 * `tier`/`deprecated`/`order`; the resolver enriches known ids from the catalog.
 *
 * Absorbs the previous scattered sources: `agent/discoverModels.ts` (kept, called
 * here), `codex/codexModels.ts`, and `FlowEditorProvider.fetch*Models()`.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { discoverClaudeModels } from '../../agent/discoverModels';
import type { ModelEntry, ModelThinkingEffort } from './schema';
import { isExplicitThinkingEffort } from '../../runtime/thinkingEffort';

const PROBE_TIMEOUT_MS = 8_000;

function entry(id: string, label: string, order: number, description = '', thinkingEffort?: ModelThinkingEffort): ModelEntry {
  return { id, label, description, tier: 'medium', deprecated: false, order, ...(thinkingEffort ? { thinkingEffort } : {}) };
}

async function fetchJson(url: string, headers: Record<string, string>): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Anthropic: `GET /v1/models` is PRIMARY when an API key is present (provider-cadence,
 * surfaces new models the day they ship). SDK `supportedModels()` is the OAuth-only
 * fallback (capped at the bundled CLI version).
 */
export async function discoverAnthropic(opts: {
  apiKey: string | null;
  workspacePath?: string;
  binaryPath?: string;
}): Promise<ModelEntry[] | null> {
  if (opts.apiKey) {
    const json = (await fetchJson('https://api.anthropic.com/v1/models?limit=1000', {
      'x-api-key': opts.apiKey,
      'anthropic-version': '2023-06-01',
    })) as { data?: Array<{ id?: string; display_name?: string }> } | null;
    const data = json?.data;
    if (Array.isArray(data) && data.length > 0) {
      return data
        .filter((m): m is { id: string; display_name?: string } => typeof m.id === 'string')
        .map((m, i) => entry(m.id, m.display_name ?? m.id, i));
    }
  }
  // Fallback: bundled SDK supportedModels() (handles OAuth login without an API key).
  if (opts.workspacePath && opts.binaryPath) {
    const models = await discoverClaudeModels({
      workspacePath: opts.workspacePath,
      pathToClaudeCodeExecutable: opts.binaryPath,
      ...(opts.apiKey ? { anthropicApiKey: opts.apiKey } : {}),
    });
    if (models && models.length > 0) {
      return models.map((m, i) => entry(
        m.id,
        m.label,
        i,
        m.description,
        m.supportsEffort === undefined
          ? undefined
          : { levels: m.supportsEffort ? (m.supportedEffortLevels ?? []) : [] },
      ));
    }
  }
  return null;
}

/** OpenAI `models.list()` via REST, filtered to chat-suitable LLMs (mirrors the old flow filter). */
export async function discoverOpenAI(apiKey: string | null): Promise<ModelEntry[] | null> {
  if (!apiKey) return null;
  const json = (await fetchJson('https://api.openai.com/v1/models', {
    Authorization: `Bearer ${apiKey}`,
  })) as { data?: Array<{ id?: string }> } | null;
  const data = json?.data;
  if (!Array.isArray(data) || data.length === 0) return null;
  const EXCLUDE = /instruct|vision|audio|realtime|tts|whisper|embedding|davinci|babbage|search|image/;
  const models = data
    .map((m) => m.id)
    .filter((id): id is string => typeof id === 'string')
    .filter((id) => /gpt|o1|o3/.test(id) && !EXCLUDE.test(id))
    .sort((a, b) => a.localeCompare(b))
    .map((id, i) => entry(id, id, i));
  return models.length > 0 ? models : null;
}

/** Gemini `GET /v1/models`, filtered to models that support `generateContent`. */
export async function discoverGemini(apiKey: string | null): Promise<ModelEntry[] | null> {
  if (!apiKey) return null;
  const json = (await fetchJson(
    `https://generativelanguage.googleapis.com/v1/models?key=${encodeURIComponent(apiKey)}`,
    {},
  )) as { models?: Array<{ name?: string; displayName?: string; supportedGenerationMethods?: string[] }> } | null;
  const models = json?.models;
  if (!Array.isArray(models) || models.length === 0) return null;
  const out = models
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m, i) => {
      const id = (m.name ?? '').replace(/^models\//, '');
      return entry(id, m.displayName ?? id, i);
    })
    .filter((m) => m.id.length > 0);
  return out.length > 0 ? out : null;
}

/** Codex: read the CLI-maintained cache (`~/.codex/models_cache.json`). */
export async function discoverCodex(): Promise<ModelEntry[] | null> {
  try {
    const cachePath = path.join(os.homedir(), '.codex', 'models_cache.json');
    const raw = fs.readFileSync(cachePath, 'utf-8');
    const cache = JSON.parse(raw) as {
      models?: Array<{
        slug?: string;
        display_name?: string;
        description?: string;
        visibility?: string;
        priority?: number;
        default_reasoning_effort?: unknown;
        supported_reasoning_efforts?: unknown[];
      }>;
    };
    if (!Array.isArray(cache.models)) return null;
    const visible = cache.models
      .filter((m) => m.visibility === 'list' && typeof m.slug === 'string')
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
      .map((m, i) => {
        const levels = (m.supported_reasoning_efforts ?? []).filter(isExplicitThinkingEffort);
        const defaultLevel = isExplicitThinkingEffort(m.default_reasoning_effort)
          ? m.default_reasoning_effort
          : undefined;
        return entry(
          m.slug as string,
          m.display_name ?? (m.slug as string),
          i,
          m.description ?? '',
          m.supported_reasoning_efforts === undefined
            ? undefined
            : { levels, ...(defaultLevel && levels.includes(defaultLevel) ? { defaultLevel } : {}) },
        );
      });
    return visible.length > 0 ? visible : null;
  } catch {
    return null;
  }
}

/**
 * OpenCode/BYOK: models come from the ACP agent's `configOptions`. Wiring the ACP
 * handshake into a synchronous probe is deferred; returns null so the resolver serves
 * the curated catalog entries (composite `<vendor>/<model>` ids). Tracked as follow-up.
 */
export async function discoverOpenCode(): Promise<ModelEntry[] | null> {
  return null;
}
