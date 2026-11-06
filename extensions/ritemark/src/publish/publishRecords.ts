/**
 * Where each page was published, remembered on this computer (Sprint 149, R8, W3).
 *
 * One JSON file in the extension's global storage, `publish/v1/records.json`, never in the project, so a shared or
 * copied folder carries nobody's account (S32). Keyed by the page's real path: a moved or renamed file loses its
 * record and shows Publish again, while the old page stays listed (by `list()`) until it is unpublished (S30).
 *
 * Holds no token: the account ID only, which isn't a secret. Writes go through a temporary file and a rename, one at a
 * time across every window: each extension host takes a lock file beside it and reads the file again inside it, so two
 * windows publishing at once keep each other's records (Codex's review of #668). A file that can't be read as records
 * is set aside, never overwritten, so the list of published pages (the only way to unpublish a page whose file has
 * moved) can be recovered.
 *
 * No `vscode` import: the caller passes the global storage folder's path. Used by PR 4.
 */

import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PublishPlan } from './types';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface PublishRecord {
  /** The page's real path when it was published. */
  pagePath: string;
  accountId: string;
  /** The published site's name on the host (Cloudflare: the Worker's). */
  siteName: string;
  /** The public address, `https://…`. */
  address: string;
  /** Each file's published path and sha256 at the last publish. */
  files: { path: string; sha256: string }[];
  contentHash: string;
  /** ISO date of the last publish or update. */
  publishedAt: string;
  /**
   * Taken down, with the record not removed (Sprint 149, PR 4 round 3): the page is gone from the host, so it never
   * shows as online, here or after a restart, and Unpublish's Try again removes it.
   */
  unpublished?: true;
}

interface RecordsFile {
  version: 1;
  records: PublishRecord[];
}

export const RECORDS_FOLDER = path.join('publish', 'v1');
export const RECORDS_FILE = 'records.json';

function isRecord(value: unknown): value is PublishRecord {
  const r = value as PublishRecord;
  return (
    !!r &&
    typeof r.pagePath === 'string' &&
    typeof r.accountId === 'string' &&
    typeof r.siteName === 'string' &&
    typeof r.address === 'string' &&
    Array.isArray(r.files) &&
    typeof r.contentHash === 'string' &&
    typeof r.publishedAt === 'string'
  );
}

/** How long a host waits for another host's lock before giving up, and when a lock counts as left by a dead host. */
export const LOCK_WAIT_MS = 5_000;
export const LOCK_STALE_MS = 10_000;

export class PublishRecordStore {
  private readonly file: string;
  private readonly lockFile: string;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(globalStoragePath: string, private readonly platform: NodeJS.Platform = process.platform) {
    this.file = path.join(globalStoragePath, RECORDS_FOLDER, RECORDS_FILE);
    this.lockFile = `${this.file}.lock`;
  }

  private key(pagePath: string): string {
    return this.platform === 'win32' ? pagePath.toLowerCase() : pagePath;
  }

  private samePage(r: PublishRecord, pagePath: string): boolean {
    return this.key(r.pagePath) === this.key(pagePath);
  }

  private async read(): Promise<PublishRecord[]> {
    let text: string;
    try {
      text = await fs.promises.readFile(this.file, 'utf8');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw e;
    }
    try {
      const parsed = JSON.parse(text) as RecordsFile;
      if (parsed?.version !== 1 || !Array.isArray(parsed.records)) throw new Error('not records');
      return parsed.records.filter(isRecord);
    } catch {
      // Set aside, never overwritten: it may be the only list of pages still online
      await fs.promises.rename(this.file, `${this.file}.unreadable-${Date.now()}`).catch(() => undefined);
      return [];
    }
  }

  private async write(records: PublishRecord[]): Promise<void> {
    const tmp = `${this.file}.${process.pid}.${Date.now()}.${randomBytes(4).toString('hex')}.tmp`;
    const body: RecordsFile = { version: 1, records };
    await fs.promises.writeFile(tmp, JSON.stringify(body, null, 2), 'utf8');
    try {
      // Windows refuses a rename over a file another host is reading for a moment: try again briefly
      for (let attempt = 0; ; attempt++) {
        try {
          await fs.promises.rename(tmp, this.file);
          return;
        } catch (e) {
          const code = (e as NodeJS.ErrnoException).code;
          if (attempt >= 20 || (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES')) throw e;
          await sleep(10);
        }
      }
    } catch (e) {
      await fs.promises.unlink(tmp).catch(() => undefined);
      throw e;
    }
  }

  /**
   * The lock every host takes around its read-modify-write (Codex's review of #668): two project windows are two
   * extension hosts over the one file, so the queue below alone can't keep them from dropping each other's records.
   * Created exclusively; a lock older than `LOCK_STALE_MS` was left by a host that died and is taken over (moved aside
   * first, and put back if it turns out to be a fresh one); a fresh lock is waited for, never removed.
   */
  private async locked<T>(fn: () => Promise<T>): Promise<T> {
    await fs.promises.mkdir(path.dirname(this.file), { recursive: true });
    const token = `${process.pid} ${Date.now()} ${randomBytes(6).toString('hex')}`;
    const deadline = Date.now() + LOCK_WAIT_MS;
    for (;;) {
      try {
        await fs.promises.writeFile(this.lockFile, token, { flag: 'wx' });
        break;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
      }
      const seen = await fs.promises.stat(this.lockFile).catch(() => null);
      if (seen && Date.now() - seen.mtimeMs > LOCK_STALE_MS) {
        await this.takeOverStale(seen);
        continue;
      }
      if (Date.now() > deadline) throw new Error('the list of published pages is busy');
      await sleep(10 + Math.floor(Math.random() * 20));
    }
    try {
      return await fn();
    } finally {
      // Only our own lock: one taken over after a long stall belongs to the host that took it
      const held = await fs.promises.readFile(this.lockFile, 'utf8').catch(() => null);
      if (held === token) await fs.promises.unlink(this.lockFile).catch(() => undefined);
    }
  }

  private async takeOverStale(seen: fs.Stats): Promise<void> {
    const aside = `${this.lockFile}.stale-${process.pid}-${randomBytes(4).toString('hex')}`;
    try {
      await fs.promises.rename(this.lockFile, aside);
    } catch {
      return; // another host took it over first
    }
    const moved = await fs.promises.stat(aside).catch(() => null);
    if (moved && (moved.ino !== seen.ino || moved.mtimeMs !== seen.mtimeMs)) {
      // Another host's fresh lock was moved: put it back where it was (link fails if a lock is there again)
      await fs.promises.link(aside, this.lockFile).catch(() => undefined);
    }
    await fs.promises.unlink(aside).catch(() => undefined);
  }

  /** One read-modify-write at a time: in this host by the queue, across hosts by the lock, reading the file inside it. */
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private change<T>(fn: (records: PublishRecord[]) => { records?: PublishRecord[]; result: T }): Promise<T> {
    return this.serial(() => this.locked(async () => {
      const { records, result } = fn(await this.read());
      if (records) await this.write(records);
      return result;
    }));
  }

  list(): Promise<PublishRecord[]> {
    return this.serial(() => this.read());
  }

  /**
   * A page's record. Two windows publishing the same page at once leave two (each Worker keeps its record): the page
   * shows the one still online and newest, and the other stays listed so it can be unpublished.
   */
  get(pagePath: string): Promise<PublishRecord | undefined> {
    return this.serial(async () => (await this.read())
      .filter((r) => this.samePage(r, pagePath))
      .sort((x, y) => Number(Boolean(x.unpublished)) - Number(Boolean(y.unpublished)) || y.publishedAt.localeCompare(x.publishedAt))[0]);
  }

  /**
   * Notes a publish, keyed by page and site: an update (the same site) replaces its record, and so does a new site
   * for a page whose old record was already taken down; another site's record for the same page, still online, stays.
   */
  put(record: PublishRecord): Promise<void> {
    return this.change((current) => {
      const records = current.filter((r) => !this.samePage(r, record.pagePath) || (r.siteName !== record.siteName && !r.unpublished));
      records.push(record);
      return { records, result: undefined };
    });
  }

  /**
   * Notes that a page is down when its record couldn't be removed: it is kept, so Try again can still remove it, and
   * read as unpublished (`unpublished: true`). Only `siteName`'s record when it is given. Resolves false when there is
   * no such record.
   */
  markUnpublished(pagePath: string, siteName?: string): Promise<boolean> {
    return this.change((records) => {
      const found = records.filter((r) => this.samePage(r, pagePath) && (siteName === undefined || r.siteName === siteName));
      for (const r of found) r.unpublished = true;
      return found.length ? { records, result: true } : { result: false };
    });
  }

  /**
   * Forgets a page by its real path (after Unpublish), and only `siteName`'s record when it is given. Pages are found
   * by path, so a moved page is still removable.
   */
  remove(pagePath: string, siteName?: string): Promise<boolean> {
    return this.change((records) => {
      const kept = records.filter((r) => !(this.samePage(r, pagePath) && (siteName === undefined || r.siteName === siteName)));
      return kept.length === records.length ? { result: false } : { records: kept, result: true };
    });
  }
}

/** A record of what a plan would publish, once the host has published it. */
export function recordFor(
  plan: PublishPlan,
  site: { accountId: string; siteName: string; address: string },
  now: Date = new Date(),
): PublishRecord {
  return {
    pagePath: plan.pagePath,
    accountId: site.accountId,
    siteName: site.siteName,
    address: site.address,
    files: plan.files.map((f) => ({ path: f.relPath, sha256: f.sha256 ?? '' })),
    contentHash: plan.contentHash,
    publishedAt: now.toISOString(),
  };
}

/** "Published · changed": what would go now differs from the last publish (R7). */
export function changedSincePublish(record: PublishRecord, plan: PublishPlan): boolean {
  return record.contentHash !== plan.contentHash;
}

/**
 * Whether Update the page shows the sheet again (R5, R4): always the first time; again when the list of files that
 * would go differs from the last publish (S27); and whenever something looks like a key, since the scan runs again on
 * every update and its warning lives in the sheet. Otherwise Update goes straight up.
 */
export function sheetNeeded(record: PublishRecord | undefined, plan: PublishPlan): boolean {
  if (!record) return true;
  if (plan.keyHits.length > 0 || plan.tooBig.length > 0 || plan.tooMany) return true;
  const before = new Set(record.files.map((f) => f.path));
  const now = plan.files.map((f) => f.relPath);
  return before.size !== now.length || now.some((p) => !before.has(p));
}
