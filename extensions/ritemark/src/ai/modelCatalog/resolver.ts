/**
 * Resolver — the provenance-tracked catalog (Sprint 89, GH #109; Sprint 127).
 *
 * Pure: no vscode / network / fs imports, so it is fully unit-testable without
 * mocks. `index.ts` gathers the inputs (live discovery, remote catalog, cache,
 * bundled) and calls `resolveAll` on every render.
 *
 * Per provider:
 *   - the STATIC layer merges the bundled catalog with one overlay document (the
 *     fresh remote feed, else its cache) row by row (Sprint 127 R3): a stale
 *     document can neither hide a newer bundled row nor resurrect a row the build
 *     dropped; removals are explicit tombstones (`retired: true`);
 *   - a successful LIVE probe supplies the authoritative set of runnable ids and
 *     is enriched from the static layer. For Claude subscriptions the probe is the
 *     runtime's own list, which includes every model Ritemark declared to it
 *     (see runtimeDeclarations.ts) — the runtime stays the runnability authority.
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

/**
 * The merged static rows this build may offer for a provider, before any live
 * probe: tombstones removed, `minAppVersion` applied. Runtime declarations are
 * built from this list (Sprint 127 R1).
 */
export function resolveStaticModels(
  provider: Provider,
  remote: ModelCatalog | null,
  cache: ModelCatalog | null,
  bundled: ModelCatalog,
  appVersion: string,
): ModelEntry[] {
  const merged = mergeStatic(provider, bundled, pickOverlay(provider, remote, cache));
  return enrichCatalogCapabilities(merged.rows.map((row) => row.entry), bundled.providers[provider] ?? null)
    .filter((model) => allowedByAppVersion(model, appVersion));
}

function resolveProvider(
  provider: Provider,
  discovery: DiscoveryResults,
  remote: ModelCatalog | null,
  cache: ModelCatalog | null,
  bundled: ModelCatalog,
  appVersion: string,
): ResolvedProvider {
  const bundledPC = bundled.providers[provider] ?? null;
  const overlay = pickOverlay(provider, remote, cache);
  const merged = mergeStatic(provider, bundled, overlay);
  const staticRows = merged.rows
    .map((row) => ({ ...row, entry: enrichCatalogCapabilities([row.entry], bundledPC)[0] }))
    .filter((row) => allowedByAppVersion(row.entry, appVersion));
  const staticModels = staticRows.map((row) => row.entry);
  const defaults = mergeDefaults(staticModels, merged.primaryDefaults, merged.secondaryDefaults);

  const live = discovery[provider]?.filter((model) => !isRetired(model, merged.retired));

  let source: ProvenanceSource;
  let models: ModelEntry[];
  if (live && live.length > 0) {
    source = 'live';
    models = enrichLive(live, { models: staticModels, defaults }, bundledPC);
  } else {
    source = overlay && staticRows.some((row) => row.fromOverlay) ? overlay.kind : 'bundled';
    models = staticModels;
  }

  // Public resolver invariant: a newer source may add models and replace
  // presentation metadata, but it cannot accidentally erase an exact-pin
  // capability that this build knows how to implement.
  const filtered = enrichCatalogCapabilities(models, bundledPC)
    .filter((m) => allowedByAppVersion(m, appVersion));
  const canonical = source === 'live' ? canonicalizeModelAliases(filtered) : filtered;
  let sorted = [...canonical].sort((a, b) => a.order - b.order);
  let resolvedDefaults = defaults;
  // A live probe can return only future-gated or retired rows. Preserve the
  // selectable-provider invariant with models this exact build ships and knows.
  if (sorted.length === 0 && bundledPC) {
    sorted = bundledPC.models
      .filter((model) => !model.retired && allowedByAppVersion(model, appVersion))
      .sort((a, b) => a.order - b.order);
    if (sorted.length > 0) {
      source = 'bundled';
      resolvedDefaults = bundledPC.defaults;
    }
  }
  return { models: sorted, defaults: resolvedDefaults, source };
}

/** An older or undated remote/cache snapshot is not fresher than the bundled floor. */
export function isCatalogAtLeastAsFresh(candidate: ModelCatalog | null, bundled: ModelCatalog): boolean {
  if (!candidate) return false;
  const candidateTime = Date.parse(candidate.updatedAt);
  const bundledTime = Date.parse(bundled.updatedAt);
  return Number.isFinite(candidateTime) && Number.isFinite(bundledTime) && candidateTime >= bundledTime;
}

interface Overlay {
  kind: 'remote' | 'cache';
  doc: ModelCatalog;
  catalog: ProviderCatalog;
}

interface StaticRow {
  entry: ModelEntry;
  /** The row's winning metadata came from the overlay document. */
  fromOverlay: boolean;
}

interface MergedStatic {
  rows: StaticRow[];
  /** Ids whose winning static row is a tombstone — hidden from live rows too. */
  retired: Set<string>;
  primaryDefaults: Partial<Record<Surface, string>>;
  secondaryDefaults: Partial<Record<Surface, string>>;
}

/**
 * The overlay is the fresher of remote and cache (remote on a tie). A
 * structurally valid but empty provider is not a usable source: it must not
 * erase the compiled offline floor and leave a picker with no rows.
 */
function pickOverlay(provider: Provider, remote: ModelCatalog | null, cache: ModelCatalog | null): Overlay | null {
  const candidates: Overlay[] = [];
  for (const [kind, doc] of [['remote', remote], ['cache', cache]] as const) {
    const catalog = doc?.providers[provider];
    if (doc && catalog && catalog.models.length > 0) candidates.push({ kind, doc, catalog });
  }
  if (candidates.length === 0) return null;
  return candidates.reduce((best, next) => (
    timeOf(next.doc.updatedAt) > timeOf(best.doc.updatedAt) ? next : best
  ));
}

/**
 * Sprint 127 R3 — merge bundled and overlay rows per id:
 *  - in both: the fresher document's row wins (presentation and tombstone);
 *  - bundled only: kept (an overlay removes a row only with a tombstone);
 *  - overlay only: kept when it is an automated row, or was added after the
 *    bundled snapshot; otherwise the build deliberately dropped it.
 * Overlay rows come first so an `order` tie favours the overlay, as before.
 */
function mergeStatic(provider: Provider, bundled: ModelCatalog, overlay: Overlay | null): MergedStatic {
  const bundledPC = bundled.providers[provider] ?? null;
  const bundledRows = bundledPC?.models ?? [];
  if (!overlay) {
    return {
      rows: bundledRows.filter((m) => !m.retired).map((entry) => ({ entry, fromOverlay: false })),
      retired: new Set(bundledRows.filter((m) => m.retired).map((m) => m.id)),
      primaryDefaults: bundledPC?.defaults ?? {},
      secondaryDefaults: {},
    };
  }

  const bundledTime = timeOf(bundled.updatedAt);
  const overlayTime = timeOf(overlay.doc.updatedAt);
  const overlayWins = overlayTime >= bundledTime;
  const bundledById = new Map(bundledRows.map((m) => [m.id, m]));
  const overlayIds = new Set(overlay.catalog.models.map((m) => m.id));

  const winners: StaticRow[] = [];
  for (const row of overlay.catalog.models) {
    const bundledRow = bundledById.get(row.id);
    if (bundledRow) {
      winners.push(overlayWins ? { entry: row, fromOverlay: true } : { entry: bundledRow, fromOverlay: false });
    } else if (row.provenance === 'auto' || timeOf(row.addedAt ?? overlay.doc.updatedAt) > bundledTime) {
      winners.push({ entry: row, fromOverlay: true });
    }
  }
  for (const row of bundledRows) {
    if (!overlayIds.has(row.id)) winners.push({ entry: row, fromOverlay: false });
  }

  return {
    rows: winners.filter((row) => !row.entry.retired),
    retired: new Set(winners.filter((row) => row.entry.retired).map((row) => row.entry.id)),
    primaryDefaults: (overlayWins ? overlay.catalog.defaults : bundledPC?.defaults) ?? {},
    secondaryDefaults: (overlayWins ? bundledPC?.defaults : overlay.catalog.defaults) ?? {},
  };
}

/** A default names a visible, curated row: automated rows never become one (R3). */
function mergeDefaults(
  models: ModelEntry[],
  primary: Partial<Record<Surface, string>>,
  secondary: Partial<Record<Surface, string>>,
): Partial<Record<Surface, string>> {
  const out: Partial<Record<Surface, string>> = {};
  const surfaces = new Set([...Object.keys(primary), ...Object.keys(secondary)] as Surface[]);
  for (const surface of surfaces) {
    const pick = [primary[surface], secondary[surface]].find((id) => {
      const row = findModelEntry(models, id);
      return row !== undefined && row.provenance !== 'auto';
    });
    if (pick) out[surface] = pick;
  }
  return out;
}

function isRetired(model: ModelEntry, retired: Set<string>): boolean {
  return retired.has(model.id) || (model.resolvedModel !== undefined && retired.has(model.resolvedModel));
}

function timeOf(iso: string | undefined): number {
  const time = iso === undefined ? Number.NaN : Date.parse(iso);
  return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY;
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

export interface RequestedModelResolution {
  id: string;
  /** Set when the requested model is not available and `id` replaces it (R6). */
  substitutedFrom?: string;
}

/**
 * Sprint 127 R6: resolve a saved or requested model against a resolved
 * provider, reporting — never hiding — a replacement.
 */
export function resolveRequestedModelIn(
  resolved: ResolvedProvider,
  requested: string | undefined,
  surface: Surface,
): RequestedModelResolution {
  const found = findModelEntry(resolved.models, requested);
  if (found) return { id: found.id };
  const fallback = findModelEntry(resolved.models, resolved.defaults[surface])?.id ?? resolved.models[0]?.id ?? '';
  return requested && requested !== fallback ? { id: fallback, substitutedFrom: requested } : { id: fallback };
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
