/**
 * Where each page was published, remembered on this computer (Sprint 149, R8, W3).
 *
 * One JSON file in the extension's global storage, `publish/v1/records.json`, never in the project, so a shared or
 * copied folder carries nobody's account (S32). Keyed by the page's real path: a moved or renamed file loses its
 * record and shows Publish again, while the old page stays listed (by `list()`) until it is unpublished (S30).
 *
 * Holds no token: the account ID only, which isn't a secret. Writes go through a temporary file and a rename, one at a
 * time. A file that can't be read as records is set aside, never overwritten, so the list of published pages (the
 * only way to unpublish a page whose file has moved) can be recovered.
 *
 * No `vscode` import: the caller passes the global storage folder's path. Used by PR 4.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PublishPlan } from './types';

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

export class PublishRecordStore {
  private readonly file: string;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(globalStoragePath: string, private readonly platform: NodeJS.Platform = process.platform) {
    this.file = path.join(globalStoragePath, RECORDS_FOLDER, RECORDS_FILE);
  }

  private key(pagePath: string): string {
    return this.platform === 'win32' ? pagePath.toLowerCase() : pagePath;
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
    await fs.promises.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.${Date.now()}.tmp`;
    const body: RecordsFile = { version: 1, records };
    await fs.promises.writeFile(tmp, JSON.stringify(body, null, 2), 'utf8');
    await fs.promises.rename(tmp, this.file);
  }

  /** One read-modify-write at a time. */
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  list(): Promise<PublishRecord[]> {
    return this.serial(() => this.read());
  }

  get(pagePath: string): Promise<PublishRecord | undefined> {
    return this.serial(async () => (await this.read()).find((r) => this.key(r.pagePath) === this.key(pagePath)));
  }

  put(record: PublishRecord): Promise<void> {
    return this.serial(async () => {
      const records = (await this.read()).filter((r) => this.key(r.pagePath) !== this.key(record.pagePath));
      records.push(record);
      await this.write(records);
    });
  }

  /** Forgets a page by its real path (after Unpublish). Pages are found by path, so a moved page is still removable. */
  remove(pagePath: string): Promise<boolean> {
    return this.serial(async () => {
      const records = await this.read();
      const kept = records.filter((r) => this.key(r.pagePath) !== this.key(pagePath));
      if (kept.length === records.length) return false;
      await this.write(kept);
      return true;
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
