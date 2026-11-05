/**
 * The Cloudflare client (Sprint 149, W4): the spike's six calls as plain `fetch`, no new dependency.
 *
 * 1. `GET  /accounts`                                          the account from the token (M1)
 * 2. `GET  /accounts/:a/workers/subdomain`                     its workers.dev name; 10007 = none yet (M2)
 * 3. `POST /accounts/:a/workers/scripts/:n/assets-upload-session` manifest → buckets + upload JWT
 * 4. `POST /accounts/:a/workers/assets/upload?base64=true`     each bucket, with the upload JWT, not the token
 * 5. `PUT  /accounts/:a/workers/scripts/:n?excludeScript=true` metadata only: an assets-only Worker (M4)
 * 6. `POST /accounts/:a/workers/scripts/:n/subdomain`          the address on, previews off (M5)
 * and `DELETE /accounts/:a/workers/scripts/:n` to unpublish (M9).
 *
 * The token goes only to the API host, in the Authorization header, never in a URL. Every error's text goes through
 * `redact`. The address check after Unpublish asks the public address with no credentials at all.
 */

import { PublishError } from '../host';
import { COMPATIBILITY_DATE, NAME_RE, NOINDEX_HEADERS, type ManifestEntry } from './assets';
import { redact } from './redact';

export const CLOUDFLARE_API = 'https://api.cloudflare.com/client/v4';

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  headers?: { get(name: string): string | null };
  text(): Promise<string>;
}
export type FetchLike = (url: string, init?: {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
  redirect?: 'manual' | 'follow';
}) => Promise<FetchResponseLike>;

export interface CloudflareClientDeps {
  fetch: FetchLike;
  /** The token, read from SecretStorage by the account each call. Host-only. */
  token: () => string;
  /** Only Cloudflare's API, or a local fake server on 127.0.0.1 for tests. */
  apiBase?: string;
  /** Tests only: where the public address check is sent instead of `https://<host>/` (a 127.0.0.1 fake). */
  addressBase?: string;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  /** Retries after the first try, for a 429, a 5xx or a dropped connection. */
  retries?: number;
  /** Receives redacted lines only. */
  log?: (line: string) => void;
}

/** A refused call, its text already redacted. */
export class CloudflareApiError extends Error {
  constructor(readonly status: number, readonly codes: number[], message: string) {
    super(message);
    this.name = 'CloudflareApiError';
  }
}

/** Cloudflare's codes for a token it doesn't accept, and for one that may not do this. */
const AUTH_CODES = new Set([1000, 6003, 6111, 9106, 9109, 10000, 10001]);
/** 10007: no such thing (no workers.dev name yet; no such Worker). */
const NOT_FOUND = 10007;

const ACCOUNT_ID = /^[a-f0-9]{32}$/;
const LOCAL_BASE = /^http:\/\/127\.0\.0\.1:\d{1,5}(\/[\w\-./]*)?$/;

export type AddressAnswer = 'answers' | 'gone' | 'unknown';

export class CloudflareClient {
  private readonly apiBase: string;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly timeoutMs: number;
  private readonly retries: number;

  constructor(private readonly deps: CloudflareClientDeps) {
    const base = (deps.apiBase ?? CLOUDFLARE_API).replace(/\/+$/, '');
    if (base !== CLOUDFLARE_API && !LOCAL_BASE.test(base)) {
      throw new Error('The Cloudflare client sends credentials only to api.cloudflare.com.');
    }
    if (deps.addressBase !== undefined && !LOCAL_BASE.test(deps.addressBase)) {
      throw new Error('The address check can be redirected only to a local test server.');
    }
    this.apiBase = base;
    this.sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.timeoutMs = deps.timeoutMs ?? 60_000;
    this.retries = deps.retries ?? 3;
  }

  /** Every secret the client knows, for `redact`. */
  private secrets(extra: ReadonlyArray<string | undefined> = []): string[] {
    let token = '';
    try { token = this.deps.token(); } catch { /* no token: nothing to hide */ }
    return [token, ...extra].filter((s): s is string => Boolean(s));
  }

  private redact(text: unknown, extra: ReadonlyArray<string | undefined> = []): string {
    return redact(text, this.secrets(extra));
  }

  // ------------------------------------------------------------------ the calls

  /** M1: the accounts the token can see, with their names. */
  async accounts(): Promise<Array<{ id: string; name: string }>> {
    const result = await this.call<unknown>('GET', '/accounts', { query: { per_page: '50' } });
    if (!Array.isArray(result)) return [];
    return result
      .filter((a): a is { id: string; name?: unknown } => Boolean(a) && typeof (a as { id?: unknown }).id === 'string' && ACCOUNT_ID.test((a as { id: string }).id))
      .map((a) => ({ id: a.id, name: typeof a.name === 'string' && a.name.trim() ? a.name.trim() : 'your account' }));
  }

  /** M10: whether the token may publish Workers on this account (a list of scripts is the cheapest such call). */
  async canPublish(accountId: string): Promise<boolean> {
    try {
      await this.call('GET', `/accounts/${this.account(accountId)}/workers/scripts`, {}, [accountId]);
      return true;
    } catch (error) {
      if (error instanceof CloudflareApiError && (error.status === 403 || error.codes.some((c) => AUTH_CODES.has(c)))) return false;
      throw error;
    }
  }

  /** M2: the account's workers.dev name, or null when it has none yet. */
  async subdomain(accountId: string): Promise<string | null> {
    try {
      const result = await this.call<{ subdomain?: unknown }>('GET', `/accounts/${this.account(accountId)}/workers/subdomain`, {}, [accountId]);
      return typeof result?.subdomain === 'string' && result.subdomain ? result.subdomain : null;
    } catch (error) {
      if (error instanceof CloudflareApiError && error.codes.includes(NOT_FOUND)) return null;
      throw error;
    }
  }

  /** M2: registers the account's workers.dev name. A name Cloudflare refuses is `name-taken` (answer 5). */
  async registerSubdomain(accountId: string, name: string): Promise<string> {
    if (!NAME_RE.test(name)) throw new PublishError('name-invalid', 'Use lowercase letters, digits and dashes.');
    try {
      const result = await this.call<{ subdomain?: unknown }>('PUT', `/accounts/${this.account(accountId)}/workers/subdomain`, { json: { subdomain: name } }, [accountId]);
      return typeof result?.subdomain === 'string' && result.subdomain ? result.subdomain : name;
    } catch (error) {
      if (error instanceof CloudflareApiError && (error.status === 400 || error.status === 409) && !error.codes.some((c) => AUTH_CODES.has(c))) {
        throw new PublishError('name-taken', 'This name is taken. Try another.');
      }
      throw error;
    }
  }

  /**
   * Publish or Update a Worker of static assets: the manifest, the missing files, the metadata-only deploy with
   * noindex on every path, and the workers.dev address with previews off. Returns how many files went up (M8: an
   * Update sends only the ones Cloudflare doesn't hold).
   */
  async deploy(accountId: string, scriptName: string, manifest: Record<string, { hash: string; size: number }>, entries: readonly ManifestEntry[]): Promise<{ uploaded: number }> {
    const account = this.account(accountId);
    const script = this.script(scriptName);
    const extra = [accountId];

    const session = await this.call<{ jwt?: unknown; buckets?: unknown }>('POST', `/accounts/${account}/workers/scripts/${script}/assets-upload-session`, { json: { manifest } }, extra);
    if (typeof session?.jwt !== 'string' || !session.jwt) throw new CloudflareApiError(0, [], 'Cloudflare did not start the upload.');
    const buckets = Array.isArray(session.buckets) ? session.buckets.filter(Array.isArray) as string[][] : [];
    const byHash = new Map(entries.map((e) => [e.hash, e]));

    let completion = session.jwt;
    let uploaded = 0;
    if (buckets.length > 0) {
      const uploadJwt = session.jwt;
      const single = jwtClaim(uploadJwt, 'wrangler_single_asset_uploads') === true;
      completion = '';
      for (const bucket of buckets) {
        if (single) {
          for (const hash of bucket) {
            const entry = byHash.get(hash);
            if (!entry) throw new CloudflareApiError(0, [], 'Cloudflare asked for a file Ritemark did not send.');
            const r = await this.call<{ jwt?: unknown }>('POST', `/accounts/${account}/workers/assets/upload/${encodeURIComponent(hash)}`, {
              bearer: uploadJwt, raw: Buffer.from(entry.bytes), contentType: entry.contentType,
            }, [...extra, uploadJwt]);
            uploaded++;
            if (typeof r?.jwt === 'string' && r.jwt) completion = r.jwt;
          }
        } else {
          const form = () => {
            const body = new FormData();
            for (const hash of bucket) {
              const entry = byHash.get(hash);
              if (!entry) throw new CloudflareApiError(0, [], 'Cloudflare asked for a file Ritemark did not send.');
              body.append(hash, new Blob([Buffer.from(entry.bytes).toString('base64')], { type: entry.contentType }), hash);
            }
            return body;
          };
          const r = await this.call<{ jwt?: unknown }>('POST', `/accounts/${account}/workers/assets/upload`, {
            bearer: uploadJwt, form, query: { base64: 'true' },
          }, [...extra, uploadJwt]);
          uploaded += bucket.length;
          if (typeof r?.jwt === 'string' && r.jwt) completion = r.jwt;
        }
      }
      if (!completion) throw new CloudflareApiError(0, [], 'Cloudflare did not finish the upload.');
    }

    const metadata = {
      assets: {
        jwt: completion,
        config: { html_handling: 'auto-trailing-slash', not_found_handling: 'none', _headers: NOINDEX_HEADERS },
      },
      compatibility_date: COMPATIBILITY_DATE,
    };
    await this.call('PUT', `/accounts/${account}/workers/scripts/${script}`, {
      form: () => { const body = new FormData(); body.set('metadata', JSON.stringify(metadata)); return body; },
      query: { excludeScript: 'true' },
    }, [...extra, completion]);

    await this.call('POST', `/accounts/${account}/workers/scripts/${script}/subdomain`, {
      json: { enabled: true, previews_enabled: false },
      headers: { 'Cloudflare-Workers-Script-Api-Date': '2025-08-01' },
    }, extra);

    return { uploaded };
  }

  /** M9: deletes the Worker, its versions and its files. One already gone counts as deleted. */
  async deleteScript(accountId: string, scriptName: string): Promise<void> {
    try {
      await this.call('DELETE', `/accounts/${this.account(accountId)}/workers/scripts/${this.script(scriptName)}`, { query: { force: 'true' } }, [accountId]);
    } catch (error) {
      if (error instanceof CloudflareApiError && (error.status === 404 || error.codes.includes(NOT_FOUND))) return;
      throw error;
    }
  }

  /**
   * Whether the public address still serves the page. Sent with no credentials. A 404 or 410 is gone; a page, a
   * redirect, a 5xx or no answer at all leaves it unknown, so "Unpublished" is never said early (R7, M9).
   */
  async addressAnswers(address: string): Promise<AddressAnswer> {
    let url: URL;
    try { url = new URL(address); } catch { return 'unknown'; }
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.workers.dev')) return 'unknown';
    const target = this.deps.addressBase ? `${this.deps.addressBase}/__site/${url.hostname}${url.pathname}` : url.toString();
    try {
      const res = await this.withDeadline(target, { method: 'GET', redirect: 'manual', headers: { 'Cache-Control': 'no-cache' } });
      if (res.status === 404 || res.status === 410) return 'gone';
      if (res.status >= 200 && res.status < 400) return 'answers';
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  // ------------------------------------------------------------------ transport

  private account(id: string): string {
    if (!ACCOUNT_ID.test(id)) throw new CloudflareApiError(0, [], 'The stored Cloudflare account is not valid. Connect again.');
    return id;
  }

  private script(name: string): string {
    if (!NAME_RE.test(name)) throw new PublishError('name-invalid', 'Use lowercase letters, digits and dashes.');
    return name;
  }

  private async withDeadline(url: string, init: Parameters<FetchLike>[1]): Promise<{ status: number; ok: boolean; text: string; retryAfter: string | null }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.deps.fetch(url, { ...init, signal: controller.signal });
      const text = await res.text();
      return { status: res.status, ok: res.ok, text, retryAfter: res.headers?.get('retry-after') ?? null };
    } finally {
      clearTimeout(timer);
    }
  }

  private async call<T = unknown>(
    method: string,
    path: string,
    options: {
      json?: unknown;
      form?: () => FormData;
      raw?: Uint8Array;
      contentType?: string;
      bearer?: string;
      headers?: Record<string, string>;
      query?: Record<string, string>;
    },
    extraSecrets: ReadonlyArray<string | undefined> = [],
  ): Promise<T> {
    const url = new URL(this.apiBase + path);
    for (const [k, v] of Object.entries(options.query ?? {})) url.searchParams.set(k, v);
    const bearer = options.bearer ?? this.deps.token();
    if (!bearer) throw new PublishError('not-connected', 'Connect Cloudflare first.');

    for (let attempt = 0; ; attempt++) {
      const headers: Record<string, string> = { Authorization: `Bearer ${bearer}`, ...(options.headers ?? {}) };
      let body: unknown;
      if (options.json !== undefined) { body = JSON.stringify(options.json); headers['Content-Type'] = 'application/json'; }
      if (options.form) body = options.form(); // fetch sets the multipart boundary; a retry builds the form again
      if (options.raw) { body = options.raw; headers['Content-Type'] = options.contentType ?? 'application/octet-stream'; }

      let res: Awaited<ReturnType<CloudflareClient['withDeadline']>>;
      try {
        res = await this.withDeadline(url.toString(), { method, headers, body });
      } catch (error) {
        if (attempt < this.retries) {
          this.deps.log?.(this.redact(`[publish] ${method} ${url.pathname}: no answer, trying again (${attempt + 1})`, extraSecrets));
          await this.sleep(backoff(attempt, null));
          continue;
        }
        throw new PublishError('unreachable', this.redact(`Ritemark couldn't reach Cloudflare (${String((error as Error)?.message ?? error)}).`, extraSecrets));
      }

      if ((res.status === 429 || res.status >= 500) && attempt < this.retries) {
        this.deps.log?.(this.redact(`[publish] ${method} ${url.pathname}: HTTP ${res.status}, trying again (${attempt + 1})`, extraSecrets));
        await this.sleep(backoff(attempt, res.retryAfter));
        continue;
      }

      let parsed: { success?: unknown; result?: unknown; errors?: unknown } = {};
      try { parsed = res.text ? JSON.parse(res.text) : {}; } catch { parsed = { success: res.ok }; }
      const errors = Array.isArray(parsed.errors) ? parsed.errors as Array<{ code?: unknown; message?: unknown }> : [];
      if (!res.ok || parsed.success === false) {
        const codes = errors.map((e) => Number(e.code)).filter(Number.isFinite);
        const detail = errors.map((e) => `${String(e.code)}: ${String(e.message)}`).join('; ');
        const message = this.redact(`Cloudflare refused ${method} ${url.pathname} (HTTP ${res.status}${detail ? `, ${detail}` : ''}).`, extraSecrets);
        this.deps.log?.(`[publish] ${message}`);
        throw new CloudflareApiError(res.status, codes, message);
      }
      return (parsed.result ?? parsed) as T;
    }
  }
}

function backoff(attempt: number, retryAfter: string | null): number {
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds, 10) * 1000;
  return Math.min(500 * 2 ** attempt, 8000);
}

function jwtClaim(jwt: string, claim: string): unknown {
  try {
    return (JSON.parse(Buffer.from(jwt.split('.')[1] ?? '', 'base64url').toString('utf8')) as Record<string, unknown>)[claim];
  } catch {
    return undefined;
  }
}
