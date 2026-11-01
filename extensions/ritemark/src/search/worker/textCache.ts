/**
 * Sprint 148 (decision 3): copies of the text read from Word and PDF files, kept
 * on this computer so a restart doesn't read every PDF again.
 *
 * They live in Ritemark's storage for the project (`context.storageUri`, outside
 * the project's folder), at most `maxBytes` in all, one file per document named
 * by a hash of its path, with an `index.json` beside them. A copy is used only
 * while its document's size, change time and the readers' version still match.
 *
 * A copy goes with its file: dropped at once when the watcher reports the
 * document deleted or renamed away (a rename writes the new path's copy when it
 * is read again), and by a sweep at each index start for deletions made while
 * Ritemark was closed. The oldest copies go past `maxBytes`; the whole folder
 * goes when the readers' version changes.
 */
import { createHash } from 'node:crypto';
import { promises as fsp } from 'node:fs';
import * as nodePath from 'node:path';
import type { NameOnlyReason } from '../protocol';
import { READER_VERSION, type Passage } from './readers';

export type CachedText =
  /** `budget`: the characters it was read under. A copy cut short is used only under a budget no larger. */
  | { kind: 'text'; passages: Passage[]; truncated: boolean; budget: number }
  | { kind: 'name-only'; reason: NameOnlyReason };

interface IndexRow {
  path: string;
  size: number;
  mtimeMs: number;
  bytes: number;
  /** When it was written, ms. */
  at: number;
}

interface IndexFile {
  schema: 1;
  readerVersion: number;
  entries: Record<string, IndexRow>;
}

export interface CacheFs {
  mkdir(dir: string): Promise<void>;
  readFile(target: string): Promise<string>;
  writeFile(target: string, data: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  rm(target: string): Promise<void>;
  readdir(dir: string): Promise<string[]>;
}

export const nodeCacheFs: CacheFs = {
  mkdir: async (dir) => {
    await fsp.mkdir(dir, { recursive: true });
  },
  readFile: (target) => fsp.readFile(target, 'utf8'),
  writeFile: (target, data) => fsp.writeFile(target, data, 'utf8'),
  rename: (from, to) => fsp.rename(from, to),
  // Files only: the cache never removes a folder.
  rm: (target) => fsp.rm(target, { force: true }),
  readdir: (dir) => fsp.readdir(dir),
};

const INDEX = 'index.json';
/** The only files the cache writes, and so the only ones it ever removes. */
const OWN_FILE = /^(?:[0-9a-f]{40}\.json|index\.json)(?:\.tmp)?$/;

function hashOf(filePath: string): string {
  return createHash('sha1').update(filePath).digest('hex');
}

export class TextCache {
  private rows = new Map<string, IndexRow>();
  private totalBytes = 0;
  private dirty = false;
  private opened = false;
  hits = 0;
  misses = 0;

  constructor(
    private readonly dir: string | null,
    private readonly maxBytes: number,
    private readonly fs: CacheFs = nodeCacheFs,
    private readonly now: () => number = Date.now,
    private readonly readerVersion: number = READER_VERSION,
  ) {}

  get entries(): number {
    return this.rows.size;
  }

  get bytes(): number {
    return this.totalBytes;
  }

  get enabled(): boolean {
    return this.dir !== null;
  }

  // Every read and write of the folder runs one at a time, in order: a flush never writes `index.json.tmp`
  // while another does, and a copy is never written twice at once.
  private tail: Promise<unknown> = Promise.resolve();

  private serial<T>(work: () => Promise<T>): Promise<T> {
    const run = this.tail.then(work, work);
    this.tail = run.catch(() => undefined);
    return run;
  }

  open(): Promise<void> {
    return this.serial(() => this.openNow());
  }

  get(filePath: string, size: number, mtimeMs: number): Promise<CachedText | null> {
    return this.serial(() => this.getNow(filePath, size, mtimeMs));
  }

  put(filePath: string, size: number, mtimeMs: number, value: CachedText): Promise<void> {
    return this.serial(() => this.putNow(filePath, size, mtimeMs, value));
  }

  /** The document went (deleted, or renamed away): its copy goes at once. */
  delete(filePath: string): Promise<void> {
    return this.serial(() => this.deleteNow(filePath));
  }

  /** A folder went: the copies of every document inside it go. */
  deleteUnder(folderPath: string): Promise<void> {
    return this.serial(() => this.deleteUnderNow(folderPath));
  }

  /** At index start: drops the copies whose documents are gone (deleted while Ritemark was closed). */
  sweep(livePaths: ReadonlySet<string>): Promise<number> {
    return this.serial(() => this.sweepNow(livePaths));
  }

  flush(): Promise<void> {
    return this.serial(() => this.flushNow());
  }

  private async openNow(): Promise<void> {
    if (this.opened || !this.dir) return;
    this.opened = true;
    let index: IndexFile | null = null;
    try {
      index = JSON.parse(await this.fs.readFile(nodePath.join(this.dir, INDEX))) as IndexFile;
    } catch {
      index = null;
    }
    if (!index || index.schema !== 1 || index.readerVersion !== this.readerVersion || typeof index.entries !== 'object' || !index.entries) {
      // Another readers' version, or no index: every copy goes.
      await this.removeOwnFiles(() => true);
      this.dirty = true;
      return;
    }
    for (const [hash, row] of Object.entries(index.entries)) {
      if (row && typeof row.path === 'string' && typeof row.bytes === 'number') {
        this.rows.set(hash, row);
        this.totalBytes += row.bytes;
      }
    }
  }

  private async getNow(filePath: string, size: number, mtimeMs: number): Promise<CachedText | null> {
    if (!this.dir) return null;
    const hash = hashOf(filePath);
    const row = this.rows.get(hash);
    if (!row || row.path !== filePath || row.size !== size || row.mtimeMs !== mtimeMs) {
      this.misses++;
      return null;
    }
    try {
      const value = JSON.parse(await this.fs.readFile(nodePath.join(this.dir, `${hash}.json`))) as CachedText;
      if (value && (value.kind === 'text' || value.kind === 'name-only')) {
        this.hits++;
        return value;
      }
    } catch {
      // fall through: the copy is unusable
    }
    await this.drop(hash);
    this.misses++;
    return null;
  }

  private async putNow(filePath: string, size: number, mtimeMs: number, value: CachedText): Promise<void> {
    if (!this.dir) return;
    const hash = hashOf(filePath);
    const data = JSON.stringify(value);
    const bytes = Buffer.byteLength(data, 'utf8');
    if (bytes > this.maxBytes) return;
    const target = nodePath.join(this.dir, `${hash}.json`);
    try {
      await this.fs.mkdir(this.dir);
      await this.fs.writeFile(`${target}.tmp`, data);
      await this.fs.rename(`${target}.tmp`, target);
    } catch {
      return;
    }
    const previous = this.rows.get(hash);
    if (previous) this.totalBytes -= previous.bytes;
    this.rows.set(hash, { path: filePath, size, mtimeMs, bytes, at: this.now() });
    this.totalBytes += bytes;
    this.dirty = true;
    await this.evict();
  }

  private async deleteNow(filePath: string): Promise<void> {
    const hash = hashOf(filePath);
    if (this.rows.has(hash)) await this.drop(hash);
  }

  private async deleteUnderNow(folderPath: string): Promise<void> {
    const prefix = folderPath.endsWith(nodePath.sep) ? folderPath : folderPath + nodePath.sep;
    for (const [hash, row] of [...this.rows]) {
      if (row.path.startsWith(prefix)) await this.drop(hash);
    }
  }

  private async sweepNow(livePaths: ReadonlySet<string>): Promise<number> {
    let dropped = 0;
    for (const [hash, row] of [...this.rows]) {
      if (!livePaths.has(row.path)) {
        await this.drop(hash);
        dropped++;
      }
    }
    // Copies the index doesn't know (a write cut short) go too.
    await this.removeOwnFiles((name) => name !== INDEX && (name.endsWith('.tmp') || !this.rows.has(name.slice(0, 40))));
    return dropped;
  }

  private async removeOwnFiles(which: (name: string) => boolean): Promise<void> {
    if (!this.dir) return;
    let names: string[];
    try {
      names = await this.fs.readdir(this.dir);
    } catch {
      return; // no folder yet
    }
    for (const name of names) {
      if (OWN_FILE.test(name) && which(name)) await this.fs.rm(nodePath.join(this.dir, name)).catch(() => undefined);
    }
  }

  private async flushNow(): Promise<void> {
    if (!this.dir || !this.dirty) return;
    const index: IndexFile = { schema: 1, readerVersion: this.readerVersion, entries: Object.fromEntries(this.rows) };
    const target = nodePath.join(this.dir, INDEX);
    this.dirty = false;
    try {
      await this.fs.mkdir(this.dir);
      await this.fs.writeFile(`${target}.tmp`, JSON.stringify(index));
      await this.fs.rename(`${target}.tmp`, target);
    } catch {
      this.dirty = true; // the next flush tries again
    }
  }

  private async drop(hash: string): Promise<void> {
    const row = this.rows.get(hash);
    if (row) this.totalBytes -= row.bytes;
    this.rows.delete(hash);
    this.dirty = true;
    if (this.dir) await this.fs.rm(nodePath.join(this.dir, `${hash}.json`)).catch(() => undefined);
  }

  private async evict(): Promise<void> {
    if (this.totalBytes <= this.maxBytes) return;
    const oldest = [...this.rows.entries()].sort((a, b) => a[1].at - b[1].at);
    for (const [hash] of oldest) {
      if (this.totalBytes <= this.maxBytes) break;
      await this.drop(hash);
    }
  }
}
