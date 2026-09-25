/**
 * Model Catalog — schema v1 (Sprint 89, GH #109)
 *
 * The catalog is the single, provenance-tracked source of model lists + defaults
 * for every runtime and surface. This module defines the schema and a hand-rolled
 * validator (no zod — CLAUDE.md dep discipline / #105 package-tree concern).
 *
 * The SAME schema describes three things:
 *   - the bundled baseline (`bundledCatalog.ts`, shipped in the VSIX),
 *   - the remote catalog (`feeds/model-catalog.json` in ritemark-public),
 *   - the on-disk cache of the last good remote fetch.
 *
 * `validateCatalog()` is fail-closed: on any structural violation it THROWS, so
 * callers (remoteSource) fall back to cache/bundled rather than trust bad data.
 * Unknown provider keys are DROPPED (forward-compat: a newer catalog naming a
 * provider this build doesn't know must not break the whole fetch).
 */

import {
  isExplicitThinkingEffort,
  type ExplicitThinkingEffort,
} from '../../runtime/thinkingEffort';

export interface ModelThinkingEffort {
  levels: ExplicitThinkingEffort[];
  defaultLevel?: ExplicitThinkingEffort;
}

/**
 * Who wrote a catalog row (Sprint 127 R3/R4). `auto` rows come from the
 * ritemark-public publisher: they may add a model, never become a default.
 */
export type ModelProvenance = 'curated' | 'auto';

/**
 * How to declare a model to the Claude Code runtime (Sprint 127 R1). The CLI
 * lists and runs a declared model it does not know through the SDK's
 * `settings.modelPicker`; `maxOutputTokens` replaces its conservative 32K
 * default for unknown models.
 */
export interface ClaudeCodeDeclaration {
  inject?: boolean;
  maxOutputTokens?: number;
  /** Curated rows only — ignored on `auto` rows (R7). */
  behavesAs?: string;
}

/** Claude request ids the client will declare or accept from a feed (R7). */
export const CLAUDE_MODEL_ID_PATTERN = /^claude-[a-z0-9]+(?:-[a-z0-9]+)*(?:\[1m\])?$/;

const MAX_DECLARED_OUTPUT_TOKENS = 1_000_000;

/** A single selectable model, as shown in a picker row. */
export interface ModelEntry {
  /** Provider model id; OpenCode entries use a provider-qualified composite id. */
  id: string;
  /** Runtime-reported canonical identity for a live request alias. */
  resolvedModel?: string;
  /** Other request ids that the live runtime resolves to this same model. */
  aliases?: string[];
  /** The live runtime exposed `default` as an alias of this model. */
  isDefault?: boolean;
  /** Short display label for the row. */
  label: string;
  /** One-line description (curated — the live `/v1/models` probe does not return this). */
  description: string;
  /** Cost/capability tier for UI hinting. */
  tier: ModelTier;
  /** Whether the model is deprecated (still selectable, flagged in UI). */
  deprecated: boolean;
  /** Sort order within its provider list (ascending). */
  order: number;
  /** Optional semver gate: entry is filtered out when the running app version is below this. */
  minAppVersion?: string;
  /** Authoritative model-scoped manual effort levels; absent means Auto-only. */
  thinkingEffort?: ModelThinkingEffort;
  /** Omitted = 'curated'. */
  provenance?: ModelProvenance;
  /** When the row entered its catalog; omitted = the document's `updatedAt`. */
  addedAt?: string;
  /** Tombstone: never offered, never declared to a runtime. */
  retired?: boolean;
  /** Anthropic rows only. */
  claudeCode?: ClaudeCodeDeclaration;
}

export type ModelTier = 'low' | 'medium' | 'high';

/**
 * Flat provider set. Note `opencode` is BYOK and multi-vendor: its `ModelEntry.id`
 * values are composite `<vendor>/<model>` strings; consumers derive the vendor from
 * the id prefix rather than from a separate provider key.
 */
export type Provider = 'anthropic' | 'openai' | 'gemini' | 'codex' | 'opencode';

/** UI surfaces that request a default model from a provider. */
export type Surface = 'claude-code' | 'flow-llm' | 'flow-image' | 'byok' | 'codex' | 'opencode';

export interface ProviderCatalog {
  models: ModelEntry[];
  defaults: Partial<Record<Surface, string>>;
}

export interface ModelCatalog {
  schemaVersion: 1;
  /** ISO-8601 timestamp of when this catalog was published/generated. */
  updatedAt: string;
  providers: Partial<Record<Provider, ProviderCatalog>>;
}

/** The canonical provider list, in default display order. */
export const PROVIDERS: readonly Provider[] = ['anthropic', 'openai', 'gemini', 'codex', 'opencode'];

const TIERS: readonly ModelTier[] = ['low', 'medium', 'high'];
const PROVIDER_SET = new Set<string>(PROVIDERS);
const TIER_SET = new Set<string>(TIERS);

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function fail(msg: string): never {
  throw new Error(`[modelCatalog] invalid catalog: ${msg}`);
}

function validateEntry(raw: unknown, where: string, provider: Provider): ModelEntry {
  if (!isObject(raw)) fail(`${where} is not an object`);
  const {
    id, label, description, tier, deprecated, order, minAppVersion, thinkingEffort,
    provenance, addedAt, retired, claudeCode,
  } = raw;
  if (typeof id !== 'string' || id.length === 0) fail(`${where}.id must be a non-empty string`);
  // Sprint 127 R7: a Claude id is passed to the CLI verbatim; the CLI itself
  // accepts any string as a model-picker row, so the feed is checked here.
  if (provider === 'anthropic' && !CLAUDE_MODEL_ID_PATTERN.test(id)) fail(`${where}.id must be a Claude model id`);
  if (typeof label !== 'string') fail(`${where}.label must be a string`);
  if (typeof description !== 'string') fail(`${where}.description must be a string`);
  if (typeof tier !== 'string' || !TIER_SET.has(tier)) fail(`${where}.tier must be one of ${TIERS.join('|')}`);
  if (typeof deprecated !== 'boolean') fail(`${where}.deprecated must be a boolean`);
  if (typeof order !== 'number' || !Number.isFinite(order)) fail(`${where}.order must be a finite number`);
  if (minAppVersion !== undefined && typeof minAppVersion !== 'string') fail(`${where}.minAppVersion must be a string`);
  if (provenance !== undefined && provenance !== 'curated' && provenance !== 'auto') fail(`${where}.provenance must be curated|auto`);
  if (addedAt !== undefined && (typeof addedAt !== 'string' || !Number.isFinite(Date.parse(addedAt)))) {
    fail(`${where}.addedAt must be a parseable ISO-8601 timestamp`);
  }
  if (retired !== undefined && typeof retired !== 'boolean') fail(`${where}.retired must be a boolean`);
  const entry: ModelEntry = { id, label, description, tier: tier as ModelTier, deprecated, order };
  if (minAppVersion !== undefined) entry.minAppVersion = minAppVersion;
  if (thinkingEffort !== undefined) {
    const effort = objectAtThinkingEffort(thinkingEffort, `${where}.thinkingEffort`);
    entry.thinkingEffort = effort;
  }
  if (provenance !== undefined) entry.provenance = provenance;
  if (addedAt !== undefined) entry.addedAt = addedAt as string;
  if (retired !== undefined) entry.retired = retired;
  if (claudeCode !== undefined && provider === 'anthropic') {
    entry.claudeCode = validateClaudeCode(claudeCode, `${where}.claudeCode`);
  }
  return entry;
}

function validateClaudeCode(value: unknown, where: string): ClaudeCodeDeclaration {
  if (!isObject(value)) fail(`${where} must be an object`);
  const { inject, maxOutputTokens, behavesAs } = value;
  if (inject !== undefined && typeof inject !== 'boolean') fail(`${where}.inject must be a boolean`);
  if (maxOutputTokens !== undefined && (
    typeof maxOutputTokens !== 'number'
    || !Number.isSafeInteger(maxOutputTokens)
    || maxOutputTokens <= 0
    || maxOutputTokens > MAX_DECLARED_OUTPUT_TOKENS
  )) {
    fail(`${where}.maxOutputTokens must be a positive integer`);
  }
  if (behavesAs !== undefined && (typeof behavesAs !== 'string' || !CLAUDE_MODEL_ID_PATTERN.test(behavesAs))) {
    fail(`${where}.behavesAs must be a Claude model id`);
  }
  // Unknown keys (e.g. a future contextWindow) are dropped, not rejected.
  return {
    ...(inject === undefined ? {} : { inject }),
    ...(maxOutputTokens === undefined ? {} : { maxOutputTokens: maxOutputTokens as number }),
    ...(behavesAs === undefined ? {} : { behavesAs: behavesAs as string }),
  };
}

function objectAtThinkingEffort(value: unknown, where: string): ModelThinkingEffort {
  if (!isObject(value)) fail(`${where} must be an object`);
  if (!Array.isArray(value.levels) || !value.levels.every(isExplicitThinkingEffort)) {
    fail(`${where}.levels must contain canonical explicit effort values`);
  }
  const levels = [...new Set(value.levels)] as ExplicitThinkingEffort[];
  if (levels.length !== value.levels.length) fail(`${where}.levels must be deduplicated`);
  if (value.defaultLevel !== undefined && !isExplicitThinkingEffort(value.defaultLevel)) {
    fail(`${where}.defaultLevel must be a canonical explicit effort value`);
  }
  if (value.defaultLevel !== undefined && !levels.includes(value.defaultLevel)) {
    fail(`${where}.defaultLevel must be included in levels`);
  }
  return {
    levels,
    ...(value.defaultLevel === undefined ? {} : { defaultLevel: value.defaultLevel }),
  };
}

function validateProviderCatalog(raw: unknown, where: string, provider: Provider): ProviderCatalog {
  if (!isObject(raw)) fail(`${where} is not an object`);
  if (!Array.isArray(raw.models)) fail(`${where}.models must be an array`);
  const models = raw.models.map((m, i) => validateEntry(m, `${where}.models[${i}]`, provider));
  const defaults: Partial<Record<Surface, string>> = {};
  if (raw.defaults !== undefined) {
    if (!isObject(raw.defaults)) fail(`${where}.defaults must be an object`);
    for (const [k, v] of Object.entries(raw.defaults)) {
      if (typeof v !== 'string') fail(`${where}.defaults.${k} must be a string`);
      defaults[k as Surface] = v;
    }
  }
  return { models, defaults };
}

/**
 * Validate + normalise an untrusted catalog document. Throws on any structural
 * violation. Unknown provider keys are dropped (not an error). Returns a value
 * whose `providers` only contains recognised, well-formed provider catalogs.
 */
export function validateCatalog(raw: unknown): ModelCatalog {
  if (!isObject(raw)) fail('root is not an object');
  if (raw.schemaVersion !== 1) fail(`schemaVersion must be 1 (got ${JSON.stringify(raw.schemaVersion)})`);
  if (typeof raw.updatedAt !== 'string' || !Number.isFinite(Date.parse(raw.updatedAt))) {
    fail('updatedAt must be a parseable ISO-8601 timestamp');
  }
  if (!isObject(raw.providers)) fail('providers must be an object');

  const providers: Partial<Record<Provider, ProviderCatalog>> = {};
  for (const [key, value] of Object.entries(raw.providers)) {
    if (!PROVIDER_SET.has(key)) continue; // drop unknown providers (forward-compat)
    providers[key as Provider] = validateProviderCatalog(value, `providers.${key}`, key as Provider);
  }

  return { schemaVersion: 1, updatedAt: raw.updatedAt, providers };
}
