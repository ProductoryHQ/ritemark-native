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
import { isExplicitThinkingEffort, type ExplicitThinkingEffort } from '../../runtime/thinkingEffort';
import {
  discoveryPickerSettings,
  dropShadowedDeclarations,
  NO_CLAUDE_DECLARATIONS,
  type ClaudeRuntimeDeclarations,
} from './runtimeDeclarations';

const PROBE_TIMEOUT_MS = 8_000;

function entry(
  id: string,
  label: string,
  order: number,
  description = '',
  thinkingEffort?: ModelThinkingEffort,
  resolvedModel?: string,
): ModelEntry {
  return {
    id,
    label,
    description,
    tier: 'medium',
    deprecated: false,
    order,
    ...(thinkingEffort ? { thinkingEffort } : {}),
    ...(resolvedModel ? { resolvedModel } : {}),
  };
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
 * Anthropic (Sprint 127 R1/R2). The list must describe the account that runs
 * the requests, so the caller passes `apiKey` only when Claude Code runs in
 * API-key mode:
 *  - API key: `GET /v1/models` — provider cadence, new models the day they ship;
 *  - subscription: the runtime's own `supportedModels()`, plus every model the
 *    catalog declares to it through `settings.modelPicker`. The runtime stays the
 *    runnability authority: a declared model it does not echo is not listed.
 */
export async function discoverAnthropic(opts: {
  apiKey: string | null;
  workspacePath?: string;
  binaryPath?: string;
  declarations?: ClaudeRuntimeDeclarations;
}): Promise<ModelEntry[] | null> {
  if (opts.apiKey) {
    const json = (await fetchJson('https://api.anthropic.com/v1/models?limit=1000', {
      'x-api-key': opts.apiKey,
      'anthropic-version': '2023-06-01',
    })) as { data?: Array<{ id?: string; display_name?: string; capabilities?: unknown }> } | null;
    const data = json?.data;
    if (Array.isArray(data) && data.length > 0) {
      return data
        .filter((m): m is { id: string; display_name?: string; capabilities?: unknown } => typeof m.id === 'string')
        .map((m, i) => entry(m.id, m.display_name ?? m.id, i, '', effortFromCapabilities(m.capabilities)));
    }
  }
  if (opts.workspacePath && opts.binaryPath) {
    const declarations = opts.declarations ?? NO_CLAUDE_DECLARATIONS;
    const settings = discoveryPickerSettings(declarations);
    const models = await discoverClaudeModels({
      workspacePath: opts.workspacePath,
      pathToClaudeCodeExecutable: opts.binaryPath,
      ...(opts.apiKey ? { anthropicApiKey: opts.apiKey } : {}),
      ...(settings ? { settings } : {}),
    });
    if (models && models.length > 0) {
      const rows = models.map((m, i) => entry(
        m.id,
        m.label,
        i,
        m.description,
        m.supportsEffort === undefined
          ? undefined
          : { levels: m.supportsEffort ? (m.supportedEffortLevels ?? []) : [] },
        m.resolvedModel,
      ));
      return dropShadowedDeclarations(rows, declarations.pickerOptions.map((option) => option.model));
    }
  }
  return null;
}

const PROVIDER_EFFORT_LEVELS: readonly ExplicitThinkingEffort[] = ['low', 'medium', 'high', 'xhigh', 'max'];

/**
 * `/v1/models` capability tree → effort levels (Sprint 127 R2). Absent tree:
 * unknown, the catalog floor applies. `effort.supported: false`: Auto only.
 */
export function effortFromCapabilities(capabilities: unknown): ModelThinkingEffort | undefined {
  if (!isRecord(capabilities) || !isRecord(capabilities.effort)) return undefined;
  const effort = capabilities.effort;
  if (effort.supported !== true) return { levels: [] };
  return {
    levels: PROVIDER_EFFORT_LEVELS.filter((level) => {
      const leaf = effort[level];
      return isRecord(leaf) && leaf.supported === true;
    }),
  };
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
    return parseCodexModelsCache(JSON.parse(fs.readFileSync(cachePath, 'utf-8')));
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Normalize the current object-valued effort schema and the legacy string schema. */
export function parseCodexModelsCache(raw: unknown): ModelEntry[] | null {
  if (!isRecord(raw) || !Array.isArray(raw.models)) return null;

  const visible = raw.models
    .filter((model): model is Record<string, unknown> => (
      isRecord(model) && model.visibility === 'list' && typeof model.slug === 'string'
    ))
    .sort((a, b) => (
      (typeof a.priority === 'number' ? a.priority : 0)
      - (typeof b.priority === 'number' ? b.priority : 0)
    ))
    .map((model, index) => {
      const currentLevels = model.supported_reasoning_levels;
      const legacyLevels = model.supported_reasoning_efforts;
      const rawLevels = Array.isArray(currentLevels)
        ? currentLevels.map((level) => isRecord(level) ? level.effort : undefined)
        : Array.isArray(legacyLevels) ? legacyLevels : null;
      const levels = (rawLevels ?? []).filter(isExplicitThinkingEffort);
      const rawDefault = model.default_reasoning_level ?? model.default_reasoning_effort;
      const defaultLevel = isExplicitThinkingEffort(rawDefault) && levels.includes(rawDefault)
        ? rawDefault
        : undefined;
      const slug = model.slug as string;
      return entry(
        slug,
        typeof model.display_name === 'string' ? model.display_name : slug,
        index,
        typeof model.description === 'string' ? model.description : '',
        rawLevels === null ? undefined : { levels, ...(defaultLevel ? { defaultLevel } : {}) },
      );
    });
  return visible.length > 0 ? visible : null;
}

/**
 * OpenCode/BYOK: models come from the ACP agent's `configOptions`. Wiring the ACP
 * handshake into a synchronous probe is deferred; returns null so the resolver serves
 * the curated catalog entries (composite `<vendor>/<model>` ids). Tracked as follow-up.
 */
export async function discoverOpenCode(): Promise<ModelEntry[] | null> {
  return null;
}
