/**
 * Bundled catalog → published feed document (Sprint 127, R4/R8).
 *
 * `feeds/model-catalog.json` in ritemark-public starts as the complete bundled
 * lineup, and each shell release refreshes it the same way, because clients on
 * older builds take a fresher feed wholesale. A refresh must not lose what only
 * the feed carries:
 * - automated rows and tombstones are kept, unless the bundled lineup now
 *   curates the same id (the curated row wins);
 * - curated feed-only rows are dropped (the bundled lineup is the curated
 *   authority at release time);
 * - defaults come from the bundled lineup;
 * - providers this build does not know are kept untouched.
 *
 * Sprint 141 R6: a refresh must not take away what older apps need either. On a row
 * the bundled lineup also has, the current feed's `claudeCode` (1.12.0's Sonnet 5.5
 * declaration) and `minAppVersion` are carried on from a curated feed row when the
 * bundled row has none.
 * The gates in `feedGates.ts` are added, never loosening a stricter one already in
 * the feed. The bundled row's own value always wins.
 *
 * Used by `scripts/export-bundled-model-catalog.ts`; not part of the extension bundle.
 */

import { FEED_MIN_APP_VERSION } from './feedGates';
import { versionLt } from './resolver';
import { PROVIDERS, validateCatalog, type ModelCatalog, type ModelEntry, type Provider } from './schema';

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function feedOnlyRowsToKeep(currentProvider: unknown, curatedIds: Set<string>): JsonObject[] {
  if (!isObject(currentProvider) || !Array.isArray(currentProvider.models)) return [];
  return currentProvider.models.filter((row): row is JsonObject =>
    isObject(row)
    && typeof row.id === 'string'
    && !curatedIds.has(row.id)
    && (row.provenance === 'auto' || row.retired === true));
}

/**
 * @param current the feed as currently published (raw JSON), or undefined for
 *   a first publish. It must pass the client validator.
 */
function currentRowsById(currentProvider: unknown): Map<string, JsonObject> {
  if (!isObject(currentProvider) || !Array.isArray(currentProvider.models)) return new Map();
  return new Map(currentProvider.models
    .filter((row): row is JsonObject => isObject(row) && typeof row.id === 'string')
    .map((row) => [row.id as string, row]));
}

/** Sprint 141 R6: the published row, with the fields only older apps need. */
function withOlderAppFields(
  provider: Provider,
  row: ModelEntry,
  current: JsonObject | undefined,
  gates: Partial<Record<Provider, Record<string, string>>>,
): JsonObject {
  const out: JsonObject = { ...row };
  // Only a curated feed row carries fields on: an automated row's belong to the
  // withdrawn publisher, and the curated bundled row replaces it whole.
  const carried = current && current.provenance !== 'auto' ? current : undefined;
  if (row.claudeCode === undefined && carried && isObject(carried.claudeCode)) out.claudeCode = { ...carried.claudeCode };
  if (row.minAppVersion === undefined) {
    const candidates = [
      typeof carried?.minAppVersion === 'string' ? carried.minAppVersion : undefined,
      gates[provider]?.[row.id],
    ].filter((version): version is string => typeof version === 'string');
    // The stricter (higher) gate wins: a refresh never opens a row to older apps.
    const gate = candidates.reduce<string | undefined>((best, next) => (best === undefined || versionLt(best, next) ? next : best), undefined);
    if (gate) out.minAppVersion = gate;
  }
  return out;
}

export function buildPublishedFeed(
  bundled: ModelCatalog,
  current: unknown,
  updatedAt: string,
  gates: Partial<Record<Provider, Record<string, string>>> = FEED_MIN_APP_VERSION,
): JsonObject {
  if (!Number.isFinite(Date.parse(updatedAt))) throw new Error('updatedAt must be an ISO-8601 timestamp');
  if (current !== undefined) validateCatalog(current);
  const currentProviders = isObject(current) && isObject(current.providers) ? current.providers : {};

  const providers: JsonObject = {};
  for (const provider of PROVIDERS) {
    const catalog = bundled.providers[provider];
    if (!catalog) continue;
    const curatedIds = new Set(catalog.models.map((row) => row.id));
    const currentRows = currentRowsById(currentProviders[provider]);
    providers[provider] = {
      defaults: { ...catalog.defaults },
      models: [
        ...catalog.models.map((row) => withOlderAppFields(provider, row, currentRows.get(row.id), gates)),
        ...feedOnlyRowsToKeep(currentProviders[provider], curatedIds),
      ],
    };
  }
  const known = new Set<string>(PROVIDERS);
  for (const [provider, catalog] of Object.entries(currentProviders)) {
    if (!known.has(provider)) providers[provider] = catalog;
  }

  const feed = { schemaVersion: 1, updatedAt, providers };
  validateCatalog(feed);
  return feed;
}
