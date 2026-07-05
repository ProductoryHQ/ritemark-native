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
    models = enrichLive(live, bestCatalog);
    defaults = bestCatalog?.defaults ?? {};
  } else if (remotePC) {
    source = 'remote';
    models = remotePC.models;
    defaults = remotePC.defaults;
  } else if (cachePC) {
    source = 'cache';
    models = cachePC.models;
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

  const filtered = models.filter((m) => allowedByAppVersion(m, appVersion));
  const sorted = [...filtered].sort((a, b) => a.order - b.order);
  return { models: sorted, defaults, source };
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
function enrichLive(live: ModelEntry[], catalog: ProviderCatalog | null): ModelEntry[] {
  if (!catalog) return live;
  const curatedById = new Map(catalog.models.map((m) => [m.id, m]));
  const liveIds = new Set(live.map((m) => m.id));
  const enriched = live.map((m) => curatedById.get(m.id) ?? m);
  const deprecatedExtras = catalog.models.filter((m) => m.deprecated && !liveIds.has(m.id));
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
