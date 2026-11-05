/**
 * Where a published page goes (Sprint 149, W4; spec principle "Cloudflare is the first place, not the only one").
 *
 * One interface for a place that holds pages; Cloudflare (`cloudflare/`) is its first implementation. What goes up is
 * PR 3's model (`types.ts`): a `GatheredPlan`, which only `gatherPage` makes, after its key scan. `readVerifiedUpload`
 * turns that plan into bytes by reading each file's `realPath` again and checking its `sha256`: the bytes that go are
 * exactly the bytes the sheet's scan read, or nothing goes. Nothing here imports `vscode`, so every part tests under
 * plain Node.
 *
 * A token never appears in any type below that leaves the host: the connection's snapshot holds the account's name
 * and its workers.dev name only.
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { contentHashOf, isGatheredPlan } from './gather';
import { MAX_FILE_BYTES, MAX_FILES, type GatheredPlan } from './types';

/** One file that goes up, at the path it is served from (`/index.html`, `/img/a.png`), with its checked bytes. */
export interface UploadFile {
  readonly urlPath: string;
  readonly bytes: Uint8Array;
}

/** What one Publish or Update sends: a plan's files, read again and matched to its hashes. Only `readVerifiedUpload` makes one. */
export interface VerifiedUpload {
  readonly files: readonly UploadFile[];
  /** The page's own file among `files`, by its `urlPath`. */
  readonly pageUrlPath: string;
  /** The plan's `contentHash` (PR 3's `contentHashOf`): what "changed since publishing" compares. */
  readonly contentHash: string;
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
  /** The account has a workers.dev name already: it is never renamed (Opus review of b07e7c11). */
  | 'name-exists'
  /** A Worker of this name is on the account already: a first publish never replaces it. */
  | 'address-taken'
  /** A file differs from what the sheet's scan read: nothing was sent. */
  | 'changed'
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
  /** Reads the account's workers.dev name again, now: null only when Cloudflare says there is none. */
  refreshSubdomain(): Promise<string | null>;
  /**
   * Registers the account's workers.dev name (M2), only after a fresh read finds none. Throws `name-taken`,
   * `name-invalid`, or `name-exists` (with the account's name kept) when it has one.
   */
  chooseSubdomain(name: string): Promise<string>;
  /** Whether the account holds a site of this name (a first publish never replaces one). */
  siteExists(siteName: string): Promise<boolean>;
  /**
   * Publish or Update: the same call with the same `siteName` keeps the address (M8). `replacing` is false for a
   * first publish, which refuses a name already on the account (`address-taken`).
   */
  publish(siteName: string, upload: VerifiedUpload, options: { replacing: boolean }): Promise<PublishedSite>;
  /** Unpublish; resolves only after the address has stopped answering (R7, M9). */
  unpublish(siteName: string, address: string, options?: { onSlow?: () => void }): Promise<void>;
}

// ------------------------------------------------------------------ the plan, as bytes

const verifiedUploads = new WeakSet<object>();

/** Whether an upload is one `readVerifiedUpload` made: the host refuses anything else. */
export function isVerifiedUpload(value: unknown): value is VerifiedUpload {
  return typeof value === 'object' && value !== null && verifiedUploads.has(value);
}

/**
 * The page goes up as its folder's `index.html`, so the address is the site's own (`…workers.dev/`), with no file
 * name in it. Its folder stays, so every file it uses is where its references say. No other page goes (PR 3), so the
 * name is free.
 */
export function pageUrlPathOf(relPath: string): string {
  const dir = path.posix.dirname(relPath);
  return dir === '.' ? '/index.html' : `/${dir}/index.html`;
}

export const FILE_CHANGED = (name: string) =>
  `${name} changed after Ritemark checked it. Nothing was sent. Press Publish again to see what goes.`;

export interface ReadFileDeps {
  stat?: (p: string) => Promise<{ size: number }>;
  readFile?: (p: string) => Promise<Uint8Array>;
}

/**
 * PR 3's plan as bytes (its blocking item): each file read by its `realPath`, its sha256 checked against the plan,
 * and those bytes, not a second read, are what goes. All files are read and checked before anything is sent, so a
 * file that changed after the sheet stops the whole upload and says which. A plan `gatherPage` didn't make, one over
 * the free plan's limits, or one whose hash list doesn't add up is refused.
 */
export async function readVerifiedUpload(plan: GatheredPlan, deps: ReadFileDeps = {}): Promise<VerifiedUpload> {
  if (!isGatheredPlan(plan)) throw new PublishError('failed', 'Ritemark could not check what goes. Press Publish again.');
  if (plan.tooMany || plan.files.length > MAX_FILES) {
    throw new PublishError('too-many', `This page uses ${plan.files.length} files. Cloudflare's free plan takes ${MAX_FILES}.`);
  }
  if (plan.tooBig.length > 0) {
    throw new PublishError('too-big', `${path.posix.basename(plan.tooBig[0].projectPath)} is larger than 25 MB, too big to publish.`);
  }
  if (plan.files.length === 0) throw new PublishError('failed', 'There is nothing to publish.');
  if (contentHashOf(plan.files) !== plan.contentHash) throw new PublishError('failed', 'Ritemark could not check what goes. Press Publish again.');

  const stat = deps.stat ?? ((p: string) => fs.promises.stat(p));
  const readFile = deps.readFile ?? ((p: string) => fs.promises.readFile(p));
  const files: UploadFile[] = [];
  for (const file of plan.files) {
    const name = path.posix.basename(file.projectPath);
    if (!file.sha256) throw new PublishError('too-big', `${name} is larger than 25 MB, too big to publish.`);
    let bytes: Uint8Array;
    try {
      // The size first, so a file that grew past the limit is never read whole
      if ((await stat(file.realPath)).size > MAX_FILE_BYTES) throw new PublishError('changed', FILE_CHANGED(name));
      bytes = await readFile(file.realPath);
    } catch (error) {
      if (error instanceof PublishError) throw error;
      throw new PublishError('changed', FILE_CHANGED(name));
    }
    if (bytes.byteLength > MAX_FILE_BYTES || createHash('sha256').update(bytes).digest('hex') !== file.sha256) {
      throw new PublishError('changed', FILE_CHANGED(name));
    }
    files.push(Object.freeze({ urlPath: file === plan.files[0] ? pageUrlPathOf(file.relPath) : `/${file.relPath}`, bytes }));
  }
  const upload: VerifiedUpload = Object.freeze({
    files: Object.freeze(files),
    pageUrlPath: pageUrlPathOf(plan.files[0].relPath),
    contentHash: plan.contentHash,
  });
  verifiedUploads.add(upload);
  return upload;
}
