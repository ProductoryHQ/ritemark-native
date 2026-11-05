/**
 * The Cloudflare connection (Sprint 149, W5; spec R6): one SecretStorage entry, `ritemark.publish.cloudflare.v1`,
 * written only here, on the extension host.
 *
 * 2.2 ships the token path alone (the plan's cut 1: OAuth waits for decision 6's client). The entry has a `kind` so
 * OAuth's tokens can sit beside it later: `kind: 'oauth'` with an access token, a refresh token and an expiry, and
 * `token()` then refreshing once for every caller, as `GoogleAccountService.accessToken` does. Nothing else changes.
 *
 * The token never leaves this module except into the client's Authorization header: `snapshot()` holds the account's
 * name and its workers.dev name, nothing more.
 */

import type { ConnectionSnapshot, TokenCheck } from '../host';
import { PublishError } from '../host';
import { CloudflareApiError, type CloudflareClient } from './client';

export const CONNECTION_SECRET_KEY = 'ritemark.publish.cloudflare.v1';

export interface SecretsLike {
  get(key: string): PromiseLike<string | undefined>;
  store(key: string, value: string): PromiseLike<void>;
  delete(key: string): PromiseLike<void>;
}

interface StoredTokenConnectionV1 {
  v: 1;
  kind: 'token';
  token: string;
  accountId: string;
  accountName: string;
  subdomain: string | null;
  connectedAt: number;
}
type StoredConnection = StoredTokenConnectionV1;

/** A Cloudflare API token as pasted: 40 or so URL-safe characters. Anything else never reaches the network. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{20,200}$/;

function parseStored(raw: string | undefined): StoredConnection | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredTokenConnectionV1>;
    if (value.v !== 1 || value.kind !== 'token') return null;
    if (typeof value.token !== 'string' || !TOKEN_SHAPE.test(value.token)) return null;
    if (typeof value.accountId !== 'string' || typeof value.accountName !== 'string') return null;
    return {
      v: 1, kind: 'token', token: value.token, accountId: value.accountId, accountName: value.accountName,
      subdomain: typeof value.subdomain === 'string' && value.subdomain ? value.subdomain : null,
      connectedAt: typeof value.connectedAt === 'number' ? value.connectedAt : 0,
    };
  } catch {
    return null;
  }
}

/** What a person pastes, cleaned: a "Bearer " prefix and surrounding spaces taken off. */
export function cleanPastedToken(pasted: string): string {
  return pasted.trim().replace(/^bearer\s+/i, '').trim();
}

export interface CloudflareAccountDeps {
  secrets: SecretsLike;
  /** A client that sends the given token. */
  makeClient: (token: () => string) => CloudflareClient;
  now?: () => number;
}

export class CloudflareAccount {
  private connection: StoredConnection | null = null;
  private loaded = false;
  private readonly listeners = new Set<() => void>();
  private readonly now: () => number;

  constructor(private readonly deps: CloudflareAccountDeps) {
    this.now = deps.now ?? Date.now;
  }

  onDidChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) {
      try { listener(); } catch { /* a listener must not break the account */ }
    }
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    this.connection = parseStored(await this.deps.secrets.get(CONNECTION_SECRET_KEY));
    this.loaded = true;
  }

  /** Read again after the entry changed elsewhere (another window). */
  async reload(): Promise<void> {
    this.loaded = false;
    await this.load();
    this.emit();
  }

  snapshot(): ConnectionSnapshot {
    const c = this.connection;
    return c
      ? { state: 'connected', accountName: c.accountName, subdomain: c.subdomain }
      : { state: 'disconnected', accountName: null, subdomain: null };
  }

  /** Host-only: the connected account's ID, for the ledger's records and the API's paths. */
  accountId(): string | null {
    return this.connection?.accountId ?? null;
  }

  /** Host-only: the token for the client's header. */
  token(): string {
    if (!this.connection) throw new PublishError('not-connected', 'Connect Cloudflare first.');
    return this.connection.token;
  }

  /** A client for the connected account. */
  client(): CloudflareClient {
    return this.deps.makeClient(() => this.token());
  }

  /**
   * Checks a pasted token (M1, M10) and keeps it only when it can publish. The three outcomes of answer 8, and
   * `unreachable` when Cloudflare didn't answer. A refused token is never stored.
   */
  async connectWithToken(pasted: string): Promise<TokenCheck> {
    await this.load();
    const token = cleanPastedToken(pasted);
    if (!TOKEN_SHAPE.test(token)) return 'refused';
    const probe = this.deps.makeClient(() => token);

    let accounts: Array<{ id: string; name: string }>;
    try {
      accounts = await probe.accounts();
    } catch (error) {
      return failureOutcome(error);
    }
    if (accounts.length === 0) return 'cannot-publish';

    for (const account of accounts) {
      let allowed: boolean;
      try {
        allowed = await probe.canPublish(account.id);
      } catch (error) {
        const outcome = failureOutcome(error);
        if (outcome === 'unreachable') return outcome;
        continue;
      }
      if (!allowed) continue;
      // null only for Cloudflare's "no name yet" (10007); a read that fails is the token check's failure, never
      // "no name", since "no name" leads to registering one (Opus review of b07e7c11)
      let subdomain: string | null;
      try {
        subdomain = await probe.subdomain(account.id);
      } catch (error) {
        if (error instanceof CloudflareApiError && error.status === 403) return 'cannot-publish';
        return failureOutcome(error);
      }
      await this.persist({ v: 1, kind: 'token', token, accountId: account.id, accountName: account.name, subdomain, connectedAt: this.now() });
      return 'connected';
    }
    return 'cannot-publish';
  }

  /** Disconnect (R6, R9): the entry goes; published pages stay published. A token has no grant to revoke (M14 is OAuth's). */
  async disconnect(): Promise<void> {
    await this.load();
    await this.deps.secrets.delete(CONNECTION_SECRET_KEY);
    this.connection = null;
    this.emit();
  }

  /**
   * The account's workers.dev name as Cloudflare has it now (it may have been set in Cloudflare's dashboard since
   * connecting). Kept when it changed. null only for "no name yet"; a failed read throws.
   */
  async refreshSubdomain(): Promise<string | null> {
    const id = this.accountId();
    if (!this.connection || !id) throw new PublishError('not-connected', 'Connect Cloudflare first.');
    const now = await this.client().subdomain(id);
    if (this.connection && now !== this.connection.subdomain) await this.persist({ ...this.connection, subdomain: now });
    return now;
  }

  async setSubdomain(subdomain: string): Promise<void> {
    if (!this.connection) throw new PublishError('not-connected', 'Connect Cloudflare first.');
    await this.persist({ ...this.connection, subdomain });
  }

  private async persist(connection: StoredConnection): Promise<void> {
    await this.deps.secrets.store(CONNECTION_SECRET_KEY, JSON.stringify(connection));
    this.connection = connection;
    this.loaded = true;
    this.emit();
  }
}

function failureOutcome(error: unknown): TokenCheck {
  if (error instanceof PublishError && error.code === 'unreachable') return 'unreachable';
  if (error instanceof CloudflareApiError && (error.status === 401 || error.status === 403 || error.status === 400)) return 'refused';
  if (error instanceof CloudflareApiError && error.status >= 500) return 'unreachable';
  return 'refused';
}
