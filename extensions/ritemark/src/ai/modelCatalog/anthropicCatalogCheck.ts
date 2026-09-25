/**
 * Pre-release check of Anthropic's Claude Code model catalog (Sprint 127 R10, D4).
 *
 * Anthropic publishes a signed catalog of the models Claude Code offers, and
 * ties new models to a minimum Claude Code version. Before each release,
 * `scripts/check-anthropic-model-catalog.ts` reads it through this module and
 * raises an alert when the catalog cannot be read, has changed shape or
 * expired, or lists a model that the bundled Claude Code is too old for.
 *
 * Pure and not part of the extension bundle: the app never reads this catalog,
 * so nothing a user sees depends on its undocumented URL.
 */

import { versionLt } from './resolver';
import { CLAUDE_MODEL_ID_PATTERN } from './schema';

export const ANTHROPIC_MODEL_CATALOG_URL = 'https://downloads.claude.ai/model-catalog/v1/catalog.json';

export interface AnthropicCatalogModel {
  id: string;
  name: string;
  /** `main`, `overflow`, … — Anthropic's own grouping in the Claude Code picker. */
  section: string;
  minClaudeCodeVersion?: string;
}

export interface AnthropicCatalog {
  version: number;
  issuedAt: string;
  expiresAt: string;
  /** The Claude Code surface (`cc`) only. */
  models: AnthropicCatalogModel[];
}

export interface AnthropicCatalogCheck {
  alerts: string[];
  warnings: string[];
  mainModels: AnthropicCatalogModel[];
}

const VERSION = /^\d+\.\d+\.\d+$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function timestamp(value: unknown, field: string): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error(`${field} is not a timestamp`);
  return value;
}

function parseModel(raw: unknown, index: number): AnthropicCatalogModel {
  const where = `models[${index}]`;
  if (!isObject(raw)) throw new Error(`${where} is not an object`);
  if (typeof raw.id !== 'string' || !CLAUDE_MODEL_ID_PATTERN.test(raw.id)) throw new Error(`${where}.id is not a Claude model id`);
  if (typeof raw.name !== 'string' || raw.name.trim() === '') throw new Error(`${where}.name is missing`);
  if (typeof raw.section !== 'string' || raw.section === '') throw new Error(`${where}.section is missing`);
  const min = raw.min_claude_code_version;
  if (min !== undefined && min !== null && (typeof min !== 'string' || !VERSION.test(min))) {
    throw new Error(`${where}.min_claude_code_version is not an x.y.z version`);
  }
  return { id: raw.id, name: raw.name, section: raw.section, ...(typeof min === 'string' ? { minClaudeCodeVersion: min } : {}) };
}

/**
 * Strict on the fields the check relies on, so a format change surfaces as an
 * alert instead of a silently empty result. Throws with the first problem.
 */
export function parseAnthropicCatalog(raw: unknown, now: number): AnthropicCatalog {
  if (!isObject(raw)) throw new Error('the catalog is not a JSON object');
  if (raw.schema_version !== 1) throw new Error(`schema_version is ${JSON.stringify(raw.schema_version)}, expected 1`);
  if (typeof raw.version !== 'number' || !Number.isSafeInteger(raw.version)) throw new Error('version is not an integer');
  const issuedAt = timestamp(raw.issued_at, 'issued_at');
  const expiresAt = timestamp(raw.expires_at, 'expires_at');
  if (Date.parse(expiresAt) <= now) throw new Error(`the catalog expired at ${expiresAt}`);
  const surfaces = raw.surfaces;
  if (!isObject(surfaces) || !isObject(surfaces.cc)) throw new Error('the Claude Code surface (surfaces.cc) is missing');
  const configs = surfaces.cc.model_selector_config;
  const config = Array.isArray(configs) ? configs.find((entry) => isObject(entry) && entry.id === 'cc') : undefined;
  if (!isObject(config) || !Array.isArray(config.models) || config.models.length === 0) {
    throw new Error('the Claude Code model list (surfaces.cc.model_selector_config[id=cc].models) is missing or empty');
  }
  return { version: raw.version, issuedAt, expiresAt, models: config.models.map(parseModel) };
}

/** A dated snapshot or a 1M-context variant is the same model for the lineup. */
function baseModelId(id: string): string {
  return id.replace(/\[1m\]$/i, '').replace(/-\d{8}$/, '');
}

/** The distinct Claude Code versions a runtime manifest bundles, across targets. */
export function bundledClaudeCodeVersions(manifest: unknown): string[] {
  const rows = isObject(manifest) && Array.isArray(manifest.runtimes) ? manifest.runtimes : [];
  const versions = rows
    .filter((row): row is Record<string, unknown> => isObject(row) && row.agent === 'claude')
    .map((row) => String(row.version));
  return [...new Set(versions)];
}

export function checkAnthropicCatalog({ catalog, claudeCodeVersions, bundledModelIds }: {
  catalog: AnthropicCatalog;
  claudeCodeVersions: string[];
  bundledModelIds: string[];
}): AnthropicCatalogCheck {
  const alerts: string[] = [];
  const warnings: string[] = [];

  const versions = claudeCodeVersions.filter((version) => VERSION.test(version));
  if (versions.length === 0 || versions.length !== claudeCodeVersions.length) {
    alerts.push(`the runtime manifest must name x.y.z Claude Code versions; found ${JSON.stringify(claudeCodeVersions)}`);
  }
  const oldest = [...versions].sort((a, b) => (versionLt(a, b) ? -1 : versionLt(b, a) ? 1 : 0))[0];
  if (oldest) {
    for (const model of catalog.models) {
      if (model.minClaudeCodeVersion && versionLt(oldest, model.minClaudeCodeVersion)) {
        alerts.push(`${model.name} (${model.id}) needs Claude Code ${model.minClaudeCodeVersion} or newer, but this build bundles ${oldest}. Update the bundled Claude Code before releasing.`);
      }
    }
  }

  const bundled = new Set(bundledModelIds.map(baseModelId));
  const mainModels = catalog.models.filter((model) => model.section === 'main');
  for (const model of mainModels) {
    if (!bundled.has(baseModelId(model.id))) {
      warnings.push(`${model.name} (${model.id}) is in Anthropic's main list but not in Ritemark's bundled lineup. Add it to modelConfig.ts and bundledCatalog.ts.`);
    }
  }
  return { alerts, warnings, mainModels };
}
