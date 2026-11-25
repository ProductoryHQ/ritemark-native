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
}

export function sha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function sourceIdentity(file: string) {
  const realPath = fs.realpathSync.native(file);
  const source = realPath.normalize('NFC');
  return { realPath, source, key: sha256(source) };
}

export function quickLookRoot(bundleId: string, home = os.homedir()): string {
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

function missingSource(file: string): boolean {
  try {
    const { realPath, source } = sourceIdentity(file);
    return source !== file || !fs.statSync(realPath).isFile();
  } catch (error) {
    return ['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '');
  }
}

function ownerExited(lock: string): boolean {
  const seen = info(lock);
  if (!seen?.isFile() || Date.now() - seen.mtimeMs < STALE_LOCK_MS) return false;
  let pid: number;
  try {
    pid = Number(fs.readFileSync(lock, 'utf8').split(' ')[0]);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ESRCH';
  }
}

async function locked<T>(lock: string, canWait: () => boolean, run: () => Promise<T>): Promise<T | undefined> {
  const deadline = Date.now() + 120_000;
  const token = `${process.pid} ${randomUUID()}`;
  while (canWait()) {
    try {
      // Use wx and finish the tiny PID record synchronously before yielding.
      fs.writeFileSync(lock, token, { flag: 'wx', mode: 0o600 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      if (ownerExited(lock)) {
        // Serialize reapers, then recheck. A waiter cannot unlink a replacement lock.
        await locked(lock + '.reap', canWait, async () => {
          if (ownerExited(lock)) fs.unlinkSync(lock);
        });
      }
      if (Date.now() >= deadline) throw new Error('Quick Look cache is busy');
      await sleep(25);
      continue;
    }
    try {
      return await run();
    } finally {
      if (fs.readFileSync(lock, 'utf8') === token) fs.unlinkSync(lock);
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
  const handle = await fs.promises.open(file, 'wx', 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export class QuickLookCache {
  constructor(
    readonly root: string,
    private readonly cacheLimit = MAX_CACHE_BYTES,
    private readonly pdfLimit = MAX_PDF_BYTES,
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
    return locked(path.join(this.root, '.lock'), () => true, run);
  }

  /** The shell serializes prints too. This lease covers preparation and publication across window hosts. */
  async drawWhenAvailable(canWait: () => boolean, draw: () => Promise<void>): Promise<void> {
    if (!canWait() || !this.safeRoot(true)) return;
    await locked(path.join(this.root, '.draw-lock'), canWait, draw);
  }

  /** Same validation a native reader performs, usable for freshness checks and tests. */
  async read(file: string, inputs?: string): Promise<QuickLookEntry | undefined> {
    try {
      if (!this.safeRoot()) return;
      const { realPath, key, source } = sourceIdentity(file);
      const folder = path.join(this.root, key);
      const entry = await manifest(folder);
      if (!entry || entry.source !== source || (inputs !== undefined && entry.inputs !== inputs)) return;
      if (sha256(await fs.promises.readFile(realPath)) !== entry.sourceSha256) return;
      const pdf = await readLimited(path.join(folder, 'slides.pdf'), this.pdfLimit);
      if (sha256(pdf) === entry.pdfSha256) return entry;
    } catch {
      // Any failure leaves the plain case.
    }
  }

  async publish(
    file: string, pdf: Buffer, details: Pick<QuickLookEntry, 'sourceSha256' | 'slides' | 'appVersion' | 'inputs'>,
    current: () => Promise<boolean>,
    active: () => boolean = () => true,
  ): Promise<boolean> {
    if (pdf.length > this.pdfLimit || details.slides < 1 || !Number.isSafeInteger(details.slides)) return false;
    const identity = sourceIdentity(file);
    return (await this.mutate(async () => {
      if (!active()) return false;
      const folder = path.join(this.root, identity.key);
      if (!info(folder)) fs.mkdirSync(folder, { mode: 0o700 });
      if (!info(folder)?.isDirectory()) return false;
      const entry: QuickLookEntry = {
        v: 1, source: identity.source, ...details, pdfSha256: sha256(pdf), drawnAt: new Date().toISOString(),
      };
      const encoded = Buffer.from(JSON.stringify(entry));
      if (encoded.length > MAX_MANIFEST_BYTES || encoded.length + pdf.length > this.cacheLimit) return false;
      for (const name of fs.readdirSync(folder)) {
        if (name.startsWith('.tmp-')) fs.rmSync(path.join(folder, name), { force: true });
      }
      const temp = () => path.join(folder, `.tmp-${process.pid}-${randomUUID()}`);
      const pdfTemp = temp();
      const jsonTemp = temp();
      try {
        await writeTemp(pdfTemp, pdf);
        await writeTemp(jsonTemp, encoded);
        if (!active() || !await current()) return false;
        await this.pruneLocked(encoded.length + pdf.length, identity.key);
        if (!active() || sourceIdentity(file).source !== identity.source
          || sha256(fs.readFileSync(identity.realPath)) !== details.sourceSha256) return false;
        fs.renameSync(pdfTemp, path.join(folder, 'slides.pdf'));
        fs.renameSync(jsonTemp, path.join(folder, 'entry.json'));
        return true;
      } finally {
        fs.rmSync(pdfTemp, { force: true });
        fs.rmSync(jsonTemp, { force: true });
        if (fs.readdirSync(folder).length === 0) fs.rmdirSync(folder);
      }
    })) ?? false;
  }

  async remove(file: string, shouldRemove: () => boolean = () => true): Promise<void> {
    const source = path.resolve(file).normalize('NFC');
    await this.mutate(async () => {
      if (shouldRemove()) fs.rmSync(path.join(this.root, sha256(source)), { recursive: true, force: true });
    });
  }

  async purgeProject(root: string, listedRoots: () => Promise<readonly string[]>): Promise<void> {
    await this.mutate(async () => {
      const keep = await listedRoots();
      for (const { folder, entry } of await this.entries()) {
        if (entry && containsSource(root, entry.source) && !keep.some(other => containsSource(other, entry.source))) {
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
    for (const key of fs.readdirSync(this.root)) {
      if (!HEX.test(key) || key === skipKey) continue;
      const folder = path.join(this.root, key);
      found.push({ folder, entry: await manifest(folder) });
    }
    return found;
  }

  private async pruneLocked(reserved = 0, skipKey?: string): Promise<void> {
    const live: Array<{ folder: string; drawnAt: number; bytes: number }> = [];
    let total = reserved;
    for (const { folder, entry } of await this.entries(skipKey)) {
      const pdf = entry && info(path.join(folder, 'slides.pdf'));
      if (!entry || missingSource(entry.source) || !pdf?.isFile() || pdf.size > this.pdfLimit) {
        fs.rmSync(folder, { recursive: true, force: true });
        continue;
      }
      for (const name of fs.readdirSync(folder)) {
        if (name !== 'slides.pdf' && name !== 'entry.json') fs.rmSync(path.join(folder, name), { recursive: true, force: true });
      }
      const bytes = pdf.size + fs.lstatSync(path.join(folder, 'entry.json')).size;
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
