/**
 * The pages Ritemark published on Cloudflare, remembered on this computer (spec R8, R9): in the extension's global
 * storage (`publish/v1/cloudflare-pages.json`), never in the project, so a shared folder carries nobody's account.
 *
 * One record per published page: the Worker's name, the account it is on, its address, the page's file and the hash
 * of what went at the last publish. No token. A record whose file moved or went stays, so Settings ▸ Sharing ▸ Web
 * pages can still unpublish it (S30).
 *
 * PR 3's per-file store (`publishRecords.ts`) is planned beside this one; when it lands the two become one, with this
 * file's records as Cloudflare's part of it.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface PublishedPageRecord {
  /** The Worker's name: the page's part of the address. */
  siteName: string;
  accountId: string;
  address: string;
  /** The page's real path when it was published. */
  pagePath: string;
  /** The file's name, for Settings' list. */
  pageName: string;
  /** `contentHash` of what went, for "Published · changed". */
  contentHash: string;
  /** The URL paths that went, for the sheet's "the list changed" (R5). */
  files: string[];
  publishedAt: number;
}

export function ledgerDir(globalStoragePath: string): string {
  return path.join(globalStoragePath, 'publish', 'v1');
}

function isRecord(value: unknown): value is PublishedPageRecord {
  const r = value as Partial<PublishedPageRecord> | null;
  return Boolean(r) && typeof r!.siteName === 'string' && typeof r!.accountId === 'string' && typeof r!.address === 'string'
    && typeof r!.pagePath === 'string' && typeof r!.pageName === 'string' && typeof r!.contentHash === 'string'
    && Array.isArray(r!.files) && typeof r!.publishedAt === 'number';
}

export class SiteLedger {
  private records: PublishedPageRecord[] | null = null;
  private writing: Promise<void> = Promise.resolve();

  constructor(private readonly dir: string) {}

  private get file(): string {
    return path.join(this.dir, 'cloudflare-pages.json');
  }

  async all(): Promise<PublishedPageRecord[]> {
    if (this.records) return [...this.records];
    try {
      const parsed = JSON.parse(await fs.readFile(this.file, 'utf8')) as { v?: unknown; pages?: unknown };
      this.records = parsed.v === 1 && Array.isArray(parsed.pages) ? parsed.pages.filter(isRecord) : [];
    } catch {
      this.records = [];
    }
    return [...this.records];
  }

  async forPage(pagePath: string): Promise<PublishedPageRecord | undefined> {
    // The newest, should a page have gone to two addresses: an older one stays listed in Settings until unpublished
    return (await this.all()).filter((r) => r.pagePath === pagePath).sort((a, b) => b.publishedAt - a.publishedAt)[0];
  }

  async bySite(siteName: string): Promise<PublishedPageRecord | undefined> {
    return (await this.all()).find((r) => r.siteName === siteName);
  }

  async put(record: PublishedPageRecord): Promise<void> {
    const rest = (await this.all()).filter((r) => r.siteName !== record.siteName);
    await this.save([...rest, record]);
  }

  async remove(siteName: string): Promise<void> {
    await this.save((await this.all()).filter((r) => r.siteName !== siteName));
  }

  private async save(records: PublishedPageRecord[]): Promise<void> {
    this.records = records;
    const write = async () => {
      await fs.mkdir(this.dir, { recursive: true });
      const tmp = `${this.file}.${process.pid}.tmp`;
      await fs.writeFile(tmp, JSON.stringify({ v: 1, pages: records }, null, 2), 'utf8');
      await fs.rename(tmp, this.file);
    };
    this.writing = this.writing.then(write, write);
    await this.writing;
  }
}
