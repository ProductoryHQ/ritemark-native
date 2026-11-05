/**
 * Where a published page goes (Sprint 149, W4; spec principle "Cloudflare is the first place, not the only one").
 *
 * One interface for a place that holds pages; Cloudflare (`cloudflare/`) is its first implementation. The shared
 * types are kept to the few PR 3's gather and sheet need to hand over: a list of files with their bytes, and the
 * page's name. Nothing here imports `vscode`, so every part tests under plain Node.
 *
 * A token never appears in any type below that leaves the host: the connection's snapshot holds the account's name
 * and its workers.dev name only.
 */

/** One file that goes up, at the path it is served from (`/index.html`, `/img/a.png`). */
export interface PublishAsset {
  urlPath: string;
  bytes: Uint8Array;
}

/** What one Publish or Update sends: the files PR 3's gather chose, and which of them is the page. */
export interface PublishRequest {
  assets: PublishAsset[];
  /** The page's own file among `assets`, by its `urlPath`. */
  pageUrlPath: string;
}

/** The connection as anything outside the host may see it: no token, no account ID. */
export interface ConnectionSnapshot {
  state: 'disconnected' | 'connected';
  /** The account's name, as Cloudflare gives it (M1). */
  accountName: string | null;
  /** The account's workers.dev name, or null when it has none yet (M2: the sheet's name row asks once). */
  subdomain: string | null;
}

/** The three outcomes of a pasted token (spec R6, the lead's answer 8), and a network failure. */
export type TokenCheck = 'connected' | 'refused' | 'cannot-publish' | 'unreachable';

/** A published page as the host knows it. */
export interface PublishedSite {
  /** The site's name at the place (the Worker's name), unique per account. */
  name: string;
  /** The public address of the page. */
  address: string;
}

export type PublishErrorCode =
  | 'not-connected'
  | 'refused'
  | 'cannot-publish'
  | 'unreachable'
  | 'name-taken'
  | 'name-invalid'
  | 'too-big'
  | 'too-many'
  | 'still-online'
  | 'failed';

/** An error a person can read. Its message is always redacted: no token, no account ID, no upload JWT. */
export class PublishError extends Error {
  constructor(readonly code: PublishErrorCode, message: string) {
    super(message);
    this.name = 'PublishError';
  }
}

export interface PublishHost {
  readonly id: 'cloudflare';
  snapshot(): ConnectionSnapshot;
  /** The token path (R6). OAuth (cut for 2.2, the plan's cut 1) adds its own `connect` beside this one. */
  connectWithToken(token: string): Promise<TokenCheck>;
  disconnect(): Promise<void>;
  /** Registers the account's workers.dev name (M2). Throws `name-taken` or `name-invalid`. */
  chooseSubdomain(name: string): Promise<string>;
  /** Publish or Update: the same call with the same `siteName` keeps the address (M8). */
  publish(siteName: string, request: PublishRequest): Promise<PublishedSite>;
  /** Unpublish; resolves only after the address has stopped answering (R7, M9). */
  unpublish(siteName: string, address: string, options?: { onSlow?: () => void }): Promise<void>;
}
