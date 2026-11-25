import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

export const MAX_PDF_BYTES = 50 * 1024 * 1024;
export const MAX_CACHE_BYTES = 500 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 64 * 1024;
const STALE_LOCK_MS = 60_000;
const HEX = /^[a-f0-9]{64}$/;

export interface QuickLookEntry {
  v: 1;
  source: string;
  sourceSha256: string;
  pdfSha256: string;
  slides: number;
  appVersion: string;
  drawnAt: string;
  inputs: string;
  owner?: string;
  extensionVersion?: string;
  dependencies?: Record<string, string>;
}

export function sha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function sourceIdentity(file: string) {
  const realPath = fs.realpathSync.native(file);
  const source = realPath.normalize('NFC');
  return { realPath, source, key: sha256(source) };
}

export function quickLookRoot(bundleId: string, home = os.userInfo().homedir): string {
  if (!/^[\w-]+(?:\.[\w-]+)+$/.test(bundleId)) throw new Error('Invalid app bundle identifier');
  return path.join(home, 'Library', 'Caches', bundleId, 'quicklook', 'v1');
}

export function containsSource(root: string, source: string): boolean {
  const relative = path.relative(root.normalize('NFC'), source.normalize('NFC'));
  return !!relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}

function info(file: string): fs.Stats | undefined {
  return fs.lstatSync(file, { throwIfNoEntry: false });
}

const realpath = promisify(fs.realpath.native);

async function missingSource(file: string): Promise<boolean> {
  try {
    const realPath = await realpath(file);
    return realPath.normalize('NFC') !== file || !(await fs.promises.stat(realPath)).isFile();
  } catch (error) {
    return ['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '');
  }
}

const exec = promisify(execFile);
const writeFile = promisify(fs.writeFile);
const fsync = promisify(fs.fsync);

async function processStart(pid: number): Promise<string | undefined> {
  try {
    const { stdout } = await exec('/bin/ps', ['-p', String(pid), '-o', 'lstart='], {
      env: { ...process.env, LC_ALL: 'C', TZ: 'UTC' },
    });
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

type ProcessStart = (pid: number) => Promise<string | undefined>;
let ownStart: Promise<string | undefined> | undefined;
const startOf: ProcessStart = pid => pid === process.pid
  ? (ownStart ??= processStart(pid))
  : processStart(pid);

function sameDirectory(folder: string, original: fs.Stats): boolean {
  const current = info(folder);
  return !!current?.isDirectory() && current.dev === original.dev && current.ino === original.ino;
}

async function ownerExited(lock: string, startOf: ProcessStart): Promise<boolean> {
  const seen = info(lock);
  if (!seen?.isFile() || Date.now() - seen.mtimeMs < STALE_LOCK_MS) return false;
  const record = (await readLimited(lock, 4096).catch(() => undefined))?.toString('utf8');
  if (record === undefined) return false;
  const [pidField, token, ...timestamp] = record.split(' ');
  const pid = Number(pidField);
  let stale = !/^\d+$/.test(pidField) || !Number.isSafeInteger(pid) || pid <= 0
    || !/^[0-9a-f-]{36}$/.test(token ?? '');
  if (!stale) {
    try {
      process.kill(pid, 0);
      const start = timestamp.join(' ');
      const actual = start && await startOf(pid);
      stale = !!actual && actual !== start;
    } catch (error) {
      stale = (error as NodeJS.ErrnoException).code === 'ESRCH';
    }
  }
  const now = info(lock);
  return stale && now?.dev === seen.dev && now.ino === seen.ino && now.mtimeMs === seen.mtimeMs;
}

async function locked<T>(lock: string, startOf: ProcessStart, canWait: () => boolean, run: () => Promise<T>): Promise<T | undefined> {
  const deadline = Date.now() + 120_000;
  const token = `${process.pid} ${randomUUID()} ${await startOf(process.pid) ?? ''}`;
  while (canWait()) {
    try {
      // Use wx and finish the tiny PID record synchronously before yielding.
      fs.writeFileSync(lock, token, { flag: 'wx', mode: 0o600 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      if (await ownerExited(lock, startOf)) {
        // Serialize reapers, then recheck. A waiter cannot unlink a replacement lock.
        await locked(lock + '.reap', startOf, canWait, async () => {
          if (await ownerExited(lock, startOf)) fs.unlinkSync(lock);
        });
      }
      if (Date.now() >= deadline) throw new Error('Quick Look cache is busy');
      await sleep(25);
      continue;
    }
    try {
      return await run();
    } finally {
      if (info(lock)?.isFile() && fs.readFileSync(lock, 'utf8') === token) fs.unlinkSync(lock);
    }
  }
  return undefined;
}

async function readLimited(file: string, limit: number): Promise<Buffer> {
  const handle = await fs.promises.open(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const stat = await handle.stat();
    const { size } = stat;
    if (size > limit || !stat.isFile()) throw new Error('Invalid cache file');
    const bytes = Buffer.alloc(size + 1);
    const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
    if (bytesRead !== size) throw new Error('Cache file changed during read');
    return bytes.subarray(0, size);
  } finally {
    await handle.close();
  }
}

async function manifest(folder: string): Promise<QuickLookEntry | undefined> {
  try {
    if (!info(folder)?.isDirectory()) return;
    const value = JSON.parse((await readLimited(path.join(folder, 'entry.json'), MAX_MANIFEST_BYTES)).toString('utf8')) as QuickLookEntry;
    if (value.v === 1 && typeof value.source === 'string' && path.isAbsolute(value.source)
      && value.source === value.source.normalize('NFC') && sha256(value.source) === path.basename(folder)
      && HEX.test(value.sourceSha256) && HEX.test(value.pdfSha256) && HEX.test(value.inputs)
      && Number.isSafeInteger(value.slides) && value.slides >= 1
      && typeof value.appVersion === 'string' && typeof value.drawnAt === 'string' && Number.isFinite(Date.parse(value.drawnAt))) return value;
  } catch {
    // A partial or invalid entry is a cache miss.
  }
}

async function writeTemp(file: string, bytes: Buffer): Promise<void> {
  // Open in the same turn as the caller's directory identity check.
  const fd = fs.openSync(file, 'wx', 0o600);
  try {
    await writeFile(fd, bytes);
    await fsync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

export class QuickLookCache {
  constructor(
    readonly root: string,
    private readonly cacheLimit = MAX_CACHE_BYTES,
    private readonly pdfLimit = MAX_PDF_BYTES,
    private readonly processStart = startOf,
  ) {}

  private safeRoot(create = false): boolean {
    // Validate each cache-owned directory. Higher ancestors can legitimately
    // be aliases (for example the macOS /var -> /private/var link).
    const quicklook = path.dirname(this.root);
    const bundle = path.dirname(quicklook);
    const caches = path.dirname(bundle);
    const library = path.dirname(caches);
    for (const folder of [library, caches, bundle, quicklook, this.root]) {
      if (create && !info(folder)) {
        try {
          fs.mkdirSync(folder, { mode: 0o700 });
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        }
      }
      if (!info(folder)?.isDirectory()) return false;
    }
    return true;
  }

  private async mutate<T>(run: () => Promise<T>): Promise<T | undefined> {
    if (!this.safeRoot(true)) return;
    return locked(path.join(this.root, '.lock'), this.processStart, () => true, run);
  }

  /** The shell serializes prints too. This lease covers preparation and publication across window hosts. */
  async drawWhenAvailable(canWait: () => boolean, draw: () => Promise<void>): Promise<void> {
    if (!canWait() || !this.safeRoot(true)) return;
    await locked(path.join(this.root, '.draw-lock'), this.processStart, canWait, draw);
  }

  async metadata(file: string): Promise<QuickLookEntry | undefined> {
    try {
      if (!this.safeRoot()) return;
      const folder = path.join(this.root, sourceIdentity(file).key);
      const original = info(folder);
      if (!original?.isDirectory()) return;
      const entry = await manifest(folder);
      if (!entry || !sameDirectory(folder, original)) return;
      const pdf = info(path.join(folder, 'slides.pdf'));
      if (pdf?.isFile() && pdf.size <= this.pdfLimit) return entry;
    } catch {
      // A missing or incomplete entry needs to be drawn.
    }
  }

  /** Same validation a native reader performs, usable for freshness checks and tests. */
  async read(file: string, inputs?: string): Promise<QuickLookEntry | undefined> {
    try {
      if (!this.safeRoot()) return;
      const { realPath, key, source } = sourceIdentity(file);
      const folder = path.join(this.root, key);
      const original = info(folder);
      if (!original?.isDirectory()) return;
      const entry = await manifest(folder);
      if (!entry || entry.source !== source || (inputs !== undefined && entry.inputs !== inputs)) return;
      if (sha256(await fs.promises.readFile(realPath)) !== entry.sourceSha256) return;
      if (!sameDirectory(folder, original)) return;
      const pdf = await readLimited(path.join(folder, 'slides.pdf'), this.pdfLimit);
      if (sha256(pdf) === entry.pdfSha256) return entry;
    } catch {
      // Any failure leaves the plain case.
    }
  }

  async publish(
    file: string, pdf: Buffer, details: Pick<QuickLookEntry, 'sourceSha256' | 'slides' | 'appVersion' | 'inputs' | 'owner' | 'extensionVersion' | 'dependencies'>,
    current: () => Promise<boolean>,
    active: () => boolean = () => true,
  ): Promise<boolean> {
    if (pdf.length > this.pdfLimit || details.slides < 1 || !Number.isSafeInteger(details.slides)) return false;
    const identity = sourceIdentity(file);
    return (await this.mutate(async () => {
      if (!active()) return false;
      const folder = path.join(this.root, identity.key);
      const entry: QuickLookEntry = {
        v: 1, source: identity.source, ...details, pdfSha256: sha256(pdf), drawnAt: new Date().toISOString(),
      };
      let encoded = Buffer.from(JSON.stringify(entry));
      if (encoded.length > MAX_MANIFEST_BYTES && entry.dependencies) {
        // Dependency metadata is optional. A large deck can still publish.
        delete entry.dependencies;
        encoded = Buffer.from(JSON.stringify(entry));
      }
      if (encoded.length > MAX_MANIFEST_BYTES || encoded.length + pdf.length > this.cacheLimit) return false;
      const existing = info(folder);
      if (existing && (!existing.isDirectory() || fs.readdirSync(folder).some(name =>
        (name !== 'slides.pdf' && name !== 'entry.json') || !info(path.join(folder, name))?.isFile()))) {
        fs.rmSync(folder, { recursive: true, force: true });
      }
      if (!info(folder)) fs.mkdirSync(folder, { mode: 0o700 });
      const original = info(folder);
      if (!original?.isDirectory()) return false;
      const temp = () => path.join(folder, `.tmp-${process.pid}-${randomUUID()}`);
      const pdfTemp = temp();
      const jsonTemp = temp();
      try {
        await writeTemp(pdfTemp, pdf);
        if (!sameDirectory(folder, original)) return false;
        await writeTemp(jsonTemp, encoded);
        if (!active() || !await current()) return false;
        await this.pruneLocked(encoded.length + pdf.length, identity.key);
        if (!active() || !sameDirectory(folder, original) || sourceIdentity(file).source !== identity.source
          || sha256(fs.readFileSync(identity.realPath)) !== details.sourceSha256) return false;
        fs.renameSync(pdfTemp, path.join(folder, 'slides.pdf'));
        fs.renameSync(jsonTemp, path.join(folder, 'entry.json'));
        return true;
      } finally {
        if (sameDirectory(folder, original)) {
          fs.rmSync(pdfTemp, { force: true });
          fs.rmSync(jsonTemp, { force: true });
          if (fs.readdirSync(folder).length === 0) fs.rmdirSync(folder);
        }
      }
    })) ?? false;
  }

  async remove(file: string, shouldRemove: () => boolean = () => true): Promise<void> {
    const source = path.resolve(file).normalize('NFC');
    await this.mutate(async () => {
      if (shouldRemove()) fs.rmSync(path.join(this.root, sha256(source)), { recursive: true, force: true });
    });
  }

  async purgeUnlisted(listedOwners: () => Promise<ReadonlySet<string>>): Promise<void> {
    await this.mutate(async () => {
      const entries = await this.entries();
      const keep = await listedOwners();
      for (const { folder, entry } of entries) {
        if (entry?.owner && !keep.has(entry.owner)) fs.rmSync(folder, { recursive: true, force: true });
      }
    });
  }

  async removeMissingUnder(root: string): Promise<void> {
    await this.mutate(async () => {
      for (const { folder, entry } of await this.entries()) {
        if (entry && containsSource(root, entry.source) && await missingSource(entry.source)) {
          fs.rmSync(folder, { recursive: true, force: true });
        }
      }
    });
  }

  async prune(): Promise<void> {
    await this.mutate(() => this.pruneLocked());
  }

  private async entries(skipKey?: string) {
    const found: Array<{ folder: string; entry?: QuickLookEntry }> = [];
    for (const key of await fs.promises.readdir(this.root)) {
      if (!HEX.test(key) || key === skipKey) continue;
      const folder = path.join(this.root, key);
      const original = info(folder);
      const entry = await manifest(folder);
      found.push({ folder, entry: original && sameDirectory(folder, original) ? entry : undefined });
    }
    return found;
  }

  private async pruneLocked(reserved = 0, skipKey?: string): Promise<void> {
    const live: Array<{ folder: string; drawnAt: number; bytes: number }> = [];
    let total = reserved;
    for (const { folder, entry } of await this.entries(skipKey)) {
      const original = info(folder);
      const missing = entry && await missingSource(entry.source);
      const pdf = original && sameDirectory(folder, original) && info(path.join(folder, 'slides.pdf'));
      if (!entry || missing || !pdf || !pdf.isFile() || pdf.size > this.pdfLimit) {
        fs.rmSync(folder, { recursive: true, force: true });
        continue;
      }
      const json = info(path.join(folder, 'entry.json'));
      if (!json?.isFile() || fs.readdirSync(folder).some(name => name !== 'slides.pdf' && name !== 'entry.json')) {
        fs.rmSync(folder, { recursive: true, force: true });
        continue;
      }
      const bytes = pdf.size + json.size;
      total += bytes;
      live.push({ folder, drawnAt: Date.parse(entry.drawnAt), bytes });
    }
    live.sort((a, b) => a.drawnAt - b.drawnAt);
    for (const entry of live) {
      if (total <= this.cacheLimit) break;
      fs.rmSync(entry.folder, { recursive: true, force: true });
      total -= entry.bytes;
    }
  }
}
