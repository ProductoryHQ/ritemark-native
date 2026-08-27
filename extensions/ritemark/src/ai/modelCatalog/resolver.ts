/**
 * Resolver — the provenance-tracked waterfall (Sprint 89, GH #109).
 *
 * Pure: no vscode / network / fs imports, so it is fully unit-testable without
 * mocks. `index.ts` gathers the four inputs (live discovery, remote catalog,
 * cache, bundled) and calls `resolveAll` on every render.
 *
 * Per provider, highest-trust-that-succeeds wins:
 *   live  → remote → cache → bundled
 *
 * When a live probe succeeds it supplies the AUTHORITATIVE set of available ids;
 * curated metadata (label/description/tier/order/deprecated) and per-surface
 * defaults are merged in from the best available catalog layer. A live-only id
 * not present in any catalog is kept as-is (that is how a brand-new model shows
 * up the day it ships).
 */

import type { ModelCatalog, ModelEntry, Provider, ProviderCatalog, Surface } from './schema';
import { PROVIDERS } from './schema';

export type ProvenanceSource = 'live' | 'remote' | 'cache' | 'bundled';

/** Live probe results keyed by provider. `null`/absent = probe unavailable or failed. */
export type DiscoveryResults = Partial<Record<Provider, ModelEntry[] | null>>;

export interface ResolvedProvider {
  models: ModelEntry[];
  defaults: Partial<Record<Surface, string>>;
  source: ProvenanceSource;
}

export function resolveAll(
  discovery: DiscoveryResults,
  remote: ModelCatalog | null,
  cache: ModelCatalog | null,
  bundled: ModelCatalog,
  appVersion: string,
): Record<Provider, ResolvedProvider> {
  const out = {} as Record<Provider, ResolvedProvider>;
  for (const provider of PROVIDERS) {
    out[provider] = resolveProvider(provider, discovery, remote, cache, bundled, appVersion);
  }
  return out;
}

function resolveProvider(
  provider: Provider,
  discovery: DiscoveryResults,
  remote: ModelCatalog | null,
  cache: ModelCatalog | null,
  bundled: ModelCatalog,
  appVersion: string,
): ResolvedProvider {
  const remotePC = remote?.providers[provider] ?? null;
  const cachePC = cache?.providers[provider] ?? null;
  const bundledPC = bundled.providers[provider] ?? null;
  const bestCatalog = remotePC ?? cachePC ?? bundledPC; // curated metadata + defaults

  const live = discovery[provider];

  let source: ProvenanceSource;
  let models: ModelEntry[];
  let defaults: Partial<Record<Surface, string>>;

  if (live && live.length > 0) {
    source = 'live';
    models = enrichLive(live, bestCatalog, bundledPC);
    defaults = bestCatalog?.defaults ?? {};
  } else if (remotePC) {
    source = 'remote';
    models = enrichCatalogCapabilities(remotePC.models, bundledPC);
    defaults = remotePC.defaults;
  } else if (cachePC) {
    source = 'cache';
    models = enrichCatalogCapabilities(cachePC.models, bundledPC);
    defaults = cachePC.defaults;
  } else if (bundledPC) {
    source = 'bundled';
    models = bundledPC.models;
    defaults = bundledPC.defaults;
  } else {
    source = 'bundled';
    models = [];
    defaults = {};
  }

  // Public resolver invariant: a newer source may add/remove models and replace
  // presentation metadata, but it cannot accidentally erase an exact-pin
  // capability that this build knows how to implement.
  const filtered = enrichCatalogCapabilities(models, bundledPC)
    .filter((m) => allowedByAppVersion(m, appVersion));
  const canonical = source === 'live' ? canonicalizeModelAliases(filtered) : filtered;
  const sorted = [...canonical].sort((a, b) => a.order - b.order);
  return { models: sorted, defaults, source };
}

/**
 * Collapse live request aliases only when the provider reports the exact same
 * resolved identity. Labels are never used as identity: two similarly named
 * models must remain distinct unless the runtime explicitly equates them.
 */
export function canonicalizeModelAliases(models: ModelEntry[]): ModelEntry[] {
  const groups = new Map<string, ModelEntry[]>();
  const order: string[] = [];

  for (const model of models) {
    const key = model.resolvedModel ? `resolved:${model.resolvedModel}` : `id:${model.id}`;
    const group = groups.get(key);
    if (group) {
      group.push(model);
    } else {
      groups.set(key, [model]);
      order.push(key);
    }
  }

  return order.map((key) => {
    const group = groups.get(key)!;
    if (group.length === 1 && group[0].id !== 'default') return group[0];

    const representative = group.find((model) => model.id !== 'default') ?? group[0];
    const aliases = group
      .map((model) => model.id)
      .filter((id) => id !== representative.id);
    const fallbackEffort = group.find((model) => model.thinkingEffort)?.thinkingEffort;

    return {
      ...representative,
      order: Math.min(...group.map((model) => model.order)),
      ...(representative.resolvedModel ? { resolvedModel: representative.resolvedModel } : {}),
      ...(aliases.length > 0 ? { aliases } : {}),
      ...(group.some((model) => model.id === 'default') ? { isDefault: true } : {}),
      ...(representative.thinkingEffort || !fallbackEffort
        ? {}
        : { thinkingEffort: fallbackEffort }),
    };
  });
}

/** Find a resolved picker row by its representative id or a retained alias. */
export function findModelEntry(models: ModelEntry[], id: string | undefined): ModelEntry | undefined {
  if (!id) return undefined;
  return models.find((model) => (
    model.id === id
    || model.resolvedModel === id
    || model.aliases?.includes(id)
  ));
}

/**
 * Remote/cache catalogs can predate a capability field added by the shipping
 * app. Preserve their provider-cadence model set and labels, but use the exact-
 * pin bundled metadata as a floor for a known model. A remote capability, when
 * present, remains authoritative.
 */
function enrichCatalogCapabilities(
  models: ModelEntry[],
  bundled: ProviderCatalog | null,
): ModelEntry[] {
  if (!bundled) return models;
  const bundledById = new Map(bundled.models.map((model) => [model.id, model]));
  return models.map((model) => ({
    ...model,
    thinkingEffort: model.thinkingEffort ?? bundledById.get(model.id)?.thinkingEffort,
  }));
}

/**
 * Merge a successful live probe with the catalog:
 *  - each live id the catalog knows about is replaced with the curated entry
 *    (better label/description/tier/order/deprecated);
 *  - live-only ids pass through unchanged (so newly-released models appear);
 *  - catalog entries marked `deprecated` that the live probe NO LONGER lists are
 *    appended, so a user who still has one selected sees it (flagged) rather than
 *    getting a silent reset (spec R2).
 */
function enrichLive(
  live: ModelEntry[],
  catalog: ProviderCatalog | null,
  bundled: ProviderCatalog | null,
): ModelEntry[] {
  if (!catalog && !bundled) return live;
  const curatedById = new Map((catalog?.models ?? []).map((m) => [m.id, m]));
  const bundledById = new Map((bundled?.models ?? []).map((m) => [m.id, m]));
  const liveIds = new Set(live.map((m) => m.id));
  const enriched = live.map((m) => {
    const curated = curatedById.get(m.id);
    const bundledEntry = bundledById.get(m.id);
    if (!curated && !bundledEntry) return m;
    return {
      ...m,
      ...curated,
      // Live protocol metadata wins. A remote catalog may predate this field,
      // so the exact-pin bundled capability remains the final offline floor.
      thinkingEffort: m.thinkingEffort ?? curated?.thinkingEffort ?? bundledEntry?.thinkingEffort,
    };
  });
  const deprecatedExtras = (catalog?.models ?? []).filter((m) => m.deprecated && !liveIds.has(m.id));
  return [...enriched, ...deprecatedExtras];
}

function allowedByAppVersion(entry: ModelEntry, appVersion: string): boolean {
  if (!entry.minAppVersion) return true;
  return !versionLt(appVersion, entry.minAppVersion);
}

/** Minimal dotted-numeric semver compare (no pre-release handling, no new dep). */
export function versionLt(a: string, b: string): boolean {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x < y) return true;
    if (x > y) return false;
  }
  return false;
}

function parseVersion(v: string): number[] {
  return v
    .split('-')[0] // drop any pre-release suffix
    .split('.')
    .map((s) => {
      const n = parseInt(s, 10);
      return Number.isFinite(n) ? n : 0;
    });
}
