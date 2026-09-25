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
 * Used by `scripts/export-bundled-model-catalog.ts`; not part of the extension bundle.
 */

import { PROVIDERS, validateCatalog, type ModelCatalog } from './schema';

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
export function buildPublishedFeed(bundled: ModelCatalog, current: unknown, updatedAt: string): JsonObject {
  if (!Number.isFinite(Date.parse(updatedAt))) throw new Error('updatedAt must be an ISO-8601 timestamp');
  if (current !== undefined) validateCatalog(current);
  const currentProviders = isObject(current) && isObject(current.providers) ? current.providers : {};

  const providers: JsonObject = {};
  for (const provider of PROVIDERS) {
    const catalog = bundled.providers[provider];
    if (!catalog) continue;
    const curatedIds = new Set(catalog.models.map((row) => row.id));
    providers[provider] = {
      defaults: { ...catalog.defaults },
      models: [
        ...catalog.models.map((row) => ({ ...row })),
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
