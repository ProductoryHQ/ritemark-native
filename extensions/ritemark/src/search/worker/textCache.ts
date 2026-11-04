/**
 * Sprint 148 (decision 3): copies of the text read from documents, kept on this
 * computer so a restart doesn't read every document again. Word and PDF from the
 * start; Markdown and CSV too since the Windows speed PR (a warm start there spent
 * 11 s reading 10,000 Markdown files again).
 *
 * They live in Ritemark's storage for the project (`context.storageUri`, outside
 * the project's folder), at most `maxBytes` in all, with an `index.json` beside
 * them. A Word or PDF copy is one file per document, named by a hash of its path.
 * Markdown and CSV copies are many and small, and opening a file each is what is
 * slow on Windows, so they are lines of one file, `pack.jsonl`, read in place by
 * their offset; each line names its document, size and change time, and a line
 * that doesn't match its row is not used. Only the lines not yet written are held
 * in memory. A dropped line stays in the file as waste until the waste outgrows
 * what is live, when the file is written again with the live lines only.
 * A copy is used only while its document's size, change time and the readers'
 * version still match.
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
import { READER_VERSION, formatOf, type Passage } from './readers';

export type CachedText =
  /** `budget`: the characters it was read under. A copy cut short is used only under a budget no larger. */
  | { kind: 'text'; passages: Passage[]; truncated: boolean; budget: number; columns?: string[] }
  | { kind: 'name-only'; reason: NameOnlyReason };

interface IndexRow {
  path: string;
  size: number;
  mtimeMs: number;
  bytes: number;
  /** When it was written, ms. */
  at: number;
  /** A Markdown or CSV copy: its line's byte offset in `pack.jsonl` (-1 while not yet written). */
  packAt?: number;
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
  /** Opened to read anywhere and to add at its end; made when missing. */
  openPack(target: string): Promise<PackFile>;
}

export interface PackFile {
  size(): Promise<number>;
  read(offset: number, length: number): Promise<Buffer>;
  append(data: Buffer): Promise<void>;
  close(): Promise<void>;
}

/**
 * The copies are documents' text: on a Mac shared by several people they are this person's only. Folders are
 * made 0700 and files 0600 (Windows keeps the profile folder's own rights).
 */
export const nodeCacheFs: CacheFs = {
  mkdir: async (dir) => {
    await fsp.mkdir(dir, { recursive: true, mode: 0o700 });
  },
  readFile: (target) => fsp.readFile(target, 'utf8'),
  writeFile: (target, data) => fsp.writeFile(target, data, { encoding: 'utf8', mode: 0o600 }),
  rename: (from, to) => fsp.rename(from, to),
  // Files only: the cache never removes a folder.
  rm: (target) => fsp.rm(target, { force: true }),
  readdir: (dir) => fsp.readdir(dir),
  openPack: async (target) => {
    const handle = await fsp.open(target, 'a+', 0o600);
    return {
      size: async () => (await handle.stat()).size,
      read: async (offset, length) => {
        const buffer = Buffer.alloc(length);
        const { bytesRead } = await handle.read(buffer, 0, length, offset);
        return bytesRead === length ? buffer : buffer.subarray(0, bytesRead);
      },
      append: async (data) => {
        await handle.appendFile(data);
      },
      close: () => handle.close(),
    };
  },
};

const INDEX = 'index.json';
const PACK = 'pack.jsonl';
/** The only files the cache writes, and so the only ones it ever removes. */
const OWN_FILE = /^(?:[0-9a-f]{40}\.json|index\.json|pack\.jsonl)(?:\.tmp)?$/;
/** Lines not yet written past this many bytes are written at once, not only at the next flush. */
const PENDING_BYTES = 4 * 1024 * 1024;
/** Eviction leaves this share of the cap. */
const EVICT_TO = 0.9;
/** The pack is written again when its waste passes this and what is live. */
const WASTE_BYTES = 16 * 1024 * 1024;

/** Markdown and CSV copies are lines of the pack; Word and PDF copies, files of their own. */
function packed(filePath: string): boolean {
  const format = formatOf(nodePath.basename(filePath));
  return format === 'markdown' || format === 'csv';
}

interface PackLine {
  p: string;
  s: number;
  m: number;
  v: CachedText;
}

function hashOf(filePath: string): string {
  return createHash('sha1').update(filePath).digest('hex');
}

export class TextCache {
  private rows = new Map<string, IndexRow>();
  private totalBytes = 0;
  private dirty = false;
  private opened = false;
  private pack: PackFile | null = null;
  /** The pack's length in bytes, written lines only. */
  private packSize = 0;
  /** Bytes in the pack no row points to. */
  private packWaste = 0;
  /** Lines not yet written, by hash; their rows' `packAt` is -1. */
  private readonly pending = new Map<string, string>();
  private pendingBytes = 0;
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
    let packLive = 0;
    for (const [hash, row] of Object.entries(index.entries)) {
      if (row && typeof row.path === 'string' && typeof row.bytes === 'number') {
        if (row.packAt !== undefined && !(typeof row.packAt === 'number' && row.packAt >= 0)) continue;
        this.rows.set(hash, row);
        this.totalBytes += row.bytes;
        if (row.packAt !== undefined) packLive += row.bytes;
      }
    }
    if (packLive > 0 || (await this.hasPack())) {
      try {
        this.packSize = await (await this.openPackFile()).size();
      } catch {
        this.packSize = 0;
      }
      // Rows past the pack's end (a pack cut short) are no use.
      for (const [hash, row] of [...this.rows]) {
        if (row.packAt !== undefined && row.packAt + row.bytes > this.packSize) {
          packLive -= row.bytes;
          this.totalBytes -= row.bytes;
          this.rows.delete(hash);
          this.dirty = true;
        }
      }
      this.packWaste = Math.max(0, this.packSize - packLive);
    }
  }

  private async hasPack(): Promise<boolean> {
    try {
      return (await this.fs.readdir(this.dir!)).includes(PACK);
    } catch {
      return false;
    }
  }

  private async openPackFile(): Promise<PackFile> {
    if (!this.pack) {
      await this.fs.mkdir(this.dir!);
      this.pack = await this.fs.openPack(nodePath.join(this.dir!, PACK));
    }
    return this.pack;
  }

  /** Whether a copy for this size and change time is known, without reading it: then the document isn't read ahead. */
  has(filePath: string, size: number, mtimeMs: number): boolean {
    if (!this.dir) return false;
    const row = this.rows.get(hashOf(filePath));
    return !!row && row.path === filePath && row.size === size && row.mtimeMs === mtimeMs;
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
      const value =
        row.packAt !== undefined ? await this.readLine(hash, row) : (JSON.parse(await this.fs.readFile(nodePath.join(this.dir, `${hash}.json`))) as CachedText);
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

  /** A pack line, checked against its row: a line that names another document or version is no copy. */
  private async readLine(hash: string, row: IndexRow): Promise<CachedText | null> {
    const pending = this.pending.get(hash);
    const text = pending ?? (row.packAt! >= 0 ? (await (await this.openPackFile()).read(row.packAt!, row.bytes)).toString('utf8') : null);
    if (text === null) return null;
    const line = JSON.parse(text) as PackLine;
    if (!line || line.p !== row.path || line.s !== row.size || line.m !== row.mtimeMs) return null;
    return line.v;
  }

  private async putNow(filePath: string, size: number, mtimeMs: number, value: CachedText): Promise<void> {
    if (!this.dir) return;
    if (packed(filePath)) return this.putLine(filePath, size, mtimeMs, value);
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

  private async putLine(filePath: string, size: number, mtimeMs: number, value: CachedText): Promise<void> {
    const hash = hashOf(filePath);
    const line = JSON.stringify({ p: filePath, s: size, m: mtimeMs, v: value } satisfies PackLine) + '\n';
    const bytes = Buffer.byteLength(line, 'utf8');
    if (bytes > this.maxBytes) return;
    if (this.rows.has(hash)) await this.drop(hash);
    this.rows.set(hash, { path: filePath, size, mtimeMs, bytes, at: this.now(), packAt: -1 });
    this.pending.set(hash, line);
    this.pendingBytes += bytes;
    this.totalBytes += bytes;
    this.dirty = true;
    await this.evict();
    if (this.pendingBytes >= PENDING_BYTES) await this.writePending();
  }

  /** Adds the lines not yet written to the pack's end, and gives their rows their offsets. */
  private async writePending(): Promise<void> {
    if (this.pending.size === 0) return;
    const lines = [...this.pending];
    const data = Buffer.from(lines.map(([, line]) => line).join(''), 'utf8');
    try {
      await (await this.openPackFile()).append(data);
    } catch {
      return; // kept pending: the next flush tries again
    }
    let offset = this.packSize;
    for (const [hash, line] of lines) {
      const bytes = Buffer.byteLength(line, 'utf8');
      this.rows.get(hash)!.packAt = offset;
      offset += bytes;
    }
    this.packSize = offset;
    this.pending.clear();
    this.pendingBytes = 0;
  }

  /** Writes the pack again with its live lines only, once its waste outgrows them. */
  private async compactPack(): Promise<void> {
    const live = this.packSize - this.packWaste;
    if (this.packWaste < WASTE_BYTES || this.packWaste < live) return;
    const target = nodePath.join(this.dir!, PACK);
    const rows = [...this.rows].filter(([, row]) => row.packAt !== undefined && row.packAt >= 0).sort((a, b) => a[1].packAt! - b[1].packAt!);
    const moved = new Map<string, number>();
    let next: PackFile | null = null;
    try {
      const pack = await this.openPackFile();
      await this.fs.rm(`${target}.tmp`).catch(() => undefined);
      next = await this.fs.openPack(`${target}.tmp`);
      let offset = 0;
      for (const [hash, row] of rows) {
        await next.append(await pack.read(row.packAt!, row.bytes));
        moved.set(hash, offset);
        offset += row.bytes;
      }
      await next.close();
      next = null;
      await pack.close();
      this.pack = null;
      await this.fs.rename(`${target}.tmp`, target);
      for (const [hash, at] of moved) this.rows.get(hash)!.packAt = at;
      this.packSize = offset;
      this.packWaste = 0;
      // The old offsets are wrong from the rename on: the index follows at once.
      this.dirty = true;
      await this.writeIndex();
    } catch {
      await next?.close().catch(() => undefined);
    }
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
    await this.removeOwnFiles((name) => name !== INDEX && name !== PACK && (name.endsWith('.tmp') || !this.rows.has(name.slice(0, 40))));
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
    // The lines first: the index never points past what the pack holds.
    await this.writePending();
    if (this.pending.size > 0) return;
    await this.compactPack();
    if (this.dirty) await this.writeIndex();
  }

  private async writeIndex(): Promise<void> {
    if (!this.dir) return;
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
    if (row?.packAt !== undefined) {
      // A line: waste in the pack once written, nothing to remove.
      if (row.packAt >= 0) this.packWaste += row.bytes;
      else if (this.pending.delete(hash)) this.pendingBytes -= row.bytes;
      return;
    }
    if (this.dir) await this.fs.rm(nodePath.join(this.dir, `${hash}.json`)).catch(() => undefined);
  }

  /** Past the cap, the oldest copies go in one batch, down to EVICT_TO of it, so the next puts don't sort again. */
  private async evict(): Promise<void> {
    if (this.totalBytes <= this.maxBytes) return;
    const goal = this.maxBytes * EVICT_TO;
    const oldest = [...this.rows.entries()].sort((a, b) => a[1].at - b[1].at);
    for (const [hash] of oldest) {
      if (this.totalBytes <= goal) break;
      await this.drop(hash);
    }
  }
}
