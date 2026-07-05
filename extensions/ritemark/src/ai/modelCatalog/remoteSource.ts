/**
 * Remote catalog source (Sprint 89, GH #109).
 *
 * Fetches the published catalog from ritemark-public over HTTPS, validates it
 * (fail-closed), size-caps it, and caches the last good copy to globalState so
 * the app survives offline. Trust model v1: HTTPS + origin allowlist + strict
 * schema + size cap (pinned-key signature deferred — see architecture.md).
 */

import type * as vscode from 'vscode';
import { validateCatalog, type ModelCatalog } from './schema';

export const REMOTE_URL =
  'https://raw.githubusercontent.com/jarmo-productory/ritemark-public/main/feeds/model-catalog.json';

/** Origin allowlist: the URL must live under our public repo's raw host + org. */
const ALLOWED_PREFIX = 'https://raw.githubusercontent.com/jarmo-productory/';
const SIZE_CAP_BYTES = 512 * 1024;
const FETCH_TIMEOUT_MS = 8_000;

const CACHE_KEY = 'modelCatalog_v1';
const FETCHED_AT_KEY = 'modelCatalog_v1_fetchedAt';

interface CacheEnvelope {
  catalog: unknown;
  fetchedAt: string;
}

function debug(msg: string, err?: unknown): void {
  const detail = err instanceof Error ? err.message : err !== undefined ? String(err) : '';
  console.warn(`[modelCatalog] ${msg}${detail ? `: ${detail}` : ''}`);
}

/**
 * Fetch + validate + cache the remote catalog. Returns null on any failure
 * (offline, bad status, oversize, schema violation) so the resolver falls back
 * to cache/bundled. Never throws.
 */
export async function fetchRemoteCatalog(storage: vscode.Memento): Promise<ModelCatalog | null> {
  if (!REMOTE_URL.startsWith(ALLOWED_PREFIX)) {
    debug('remote URL failed origin allowlist — refusing to fetch');
    return null;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(REMOTE_URL, { signal: controller.signal, redirect: 'error' });
    if (!res.ok) {
      debug(`remote fetch HTTP ${res.status}`);
      return null;
    }
    const declared = res.headers.get('content-length');
    if (declared && Number(declared) > SIZE_CAP_BYTES) {
      debug(`remote catalog too large (content-length ${declared} > ${SIZE_CAP_BYTES})`);
      return null;
    }
    const text = await res.text();
    if (text.length > SIZE_CAP_BYTES) {
      debug(`remote catalog too large (${text.length} bytes > ${SIZE_CAP_BYTES})`);
      return null;
    }
    const catalog = validateCatalog(JSON.parse(text)); // throws on invalid schema/JSON
    saveCatalogToCache(catalog, storage);
    return catalog;
  } catch (err) {
    debug('remote fetch failed', err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function getCachedCatalog(storage: vscode.Memento): ModelCatalog | null {
  const env = storage.get<CacheEnvelope>(CACHE_KEY);
  if (!env || env.catalog === undefined) return null;
  try {
    return validateCatalog(env.catalog);
  } catch (err) {
    debug('cached catalog failed validation — ignoring', err);
    return null;
  }
}

export function saveCatalogToCache(catalog: ModelCatalog, storage: vscode.Memento): void {
  const nowIso = new Date().toISOString();
  void storage.update(CACHE_KEY, { catalog, fetchedAt: nowIso } satisfies CacheEnvelope);
  void storage.update(FETCHED_AT_KEY, Date.now());
}

/** True if we have never fetched, or the last fetch is older than `intervalMs`. */
export function shouldRefetch(storage: vscode.Memento, intervalMs: number): boolean {
  const last = storage.get<number>(FETCHED_AT_KEY);
  if (typeof last !== 'number') return true;
  return Date.now() - last >= intervalMs;
}
