import * as fs from 'node:fs';
import * as path from 'node:path';
import { deckVersionOf, isReadableDeckVersion } from './deckFormat';
import { drawDeckPdf, prepareDeckPdf, type PdfDeps, type PrintInput } from './deckPdf';
import { picturePaths } from './page/pageFile';
import { pictureFile } from './page/pageHtml';
import { QuickLookCache, MAX_PDF_BYTES, sha256, sourceIdentity } from './quickLookCache';

export async function canStartQuickLook(
  platform: NodeJS.Platform, enabled: boolean, decks: boolean, hasPrint: () => Promise<boolean>, hasBundles: () => Promise<boolean>,
  env: NodeJS.ProcessEnv = process.env,
): Promise<boolean> {
  const devOverride = env.RITEMARK_BUILD_CHANNEL === 'test' && env.RITEMARK_QUICKLOOK_DEV === '1';
  return platform === 'darwin' && enabled && decks && (devOverride || await hasBundles()) && await hasPrint();
}

interface Job<T> {
  key: string;
  value: T;
  due: number;
  cancelled?: boolean;
}

/** A replaceable job per source. Starting a job yields to the host's other work first. */
export class QuickLookJobs<T> {
  private readonly pending = new Map<string, Job<T>>();
  private running?: Job<T>;
  private timer?: ReturnType<typeof setTimeout>;
  private disposed = false;

  constructor(private readonly run: (value: T, current: () => boolean) => Promise<void>, private readonly debounceMs = 2000) {}

  queue(key: string, value: T): void {
    if (this.disposed) return;
    if (this.running?.key === key) this.running.cancelled = true;
    this.pending.set(key, { key, value, due: Date.now() + this.debounceMs });
    if (!this.timer) this.schedule();
  }

  cancel(match: (value: T) => boolean): void {
    for (const [key, job] of this.pending) if (match(job.value)) this.pending.delete(key);
    if (this.running && match(this.running.value)) this.running.cancelled = true;
    this.schedule();
  }

  dispose(): void {
    this.disposed = true;
    this.cancel(() => true);
  }

  private schedule(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (this.disposed || this.running) return;
    let next: Job<T> | undefined;
    for (const job of this.pending.values()) {
      if (!next || job.due < next.due) next = job;
    }
    if (!next) return;
    const job = next;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (this.pending.get(job.key) === job) void this.start(job);
      else this.schedule();
    }, Math.max(0, job.due - Date.now()));
  }

  private async start(job: Job<T>): Promise<void> {
    if (this.disposed || this.pending.get(job.key) !== job) return;
    this.running = job;
    this.pending.delete(job.key);
    const current = () => !this.disposed && !job.cancelled;
    try {
      await this.run(job.value, current);
    } catch {
      // Background drawing failures leave the plain case and never interrupt saving.
    } finally {
      this.running = undefined;
      this.schedule();
    }
  }
}

type SavedPrintInput = PrintInput & { themeBytes: Buffer | null; themeFiles: string[] };
type SavedInput = (file: string, text: string) => Promise<SavedPrintInput>;
type PrintDeps = Pick<PdfDeps, 'assets' | 'print' | 'tempRoot'>;

/** Resolve the on-disk drawing and its dependencies using the Slides-as-PDF builder. */
export async function prepareSavedSlides(file: string, bytes: Buffer, appVersion: string, load: SavedInput, deps: PrintDeps, extensionVersion = appVersion) {
  const text = bytes.toString('utf8');
  if (!isReadableDeckVersion(deckVersionOf(text))) return;
  const input = await load(file, text);
  const built = await prepareDeckPdf(input, 'slides', deps);
  const pictures = await Promise.all(built.pictures.map(async picture => {
    const stat = await fs.promises.stat(picture.file).catch(() => undefined);
    return [path.relative(path.dirname(file), picture.file).normalize('NFC'), stat?.size ?? null, stat?.mtimeMs ?? null];
  }));
  const sourceSha256 = sha256(bytes);
  // Opening the deck can supply measured steps during a print without changing its saved inputs.
  const inputs = sha256(JSON.stringify([sourceSha256, input.themeBytes && sha256(input.themeBytes), input.logo && sha256(input.logo.bytes), pictures, appVersion, extensionVersion]));
  const dependencies = picturePaths(built.deck).filter(picture => picture.from === 'slide')
    .map(picture => path.resolve(path.dirname(file), pictureFile(picture.path, picture.from)));
  return { built, input, inputs, sourceSha256, dependencies: [...input.themeFiles, ...dependencies] };
}

/** Read exact saved bytes, print in a private temp folder, and validate inputs again before publishing. */
export async function cacheSavedSlides(options: {
  file: string;
  realPath: string;
  appVersion: string;
  extensionVersion: string;
  owner?: string;
  load: SavedInput;
  print: PrintDeps;
  cache: QuickLookCache;
  active: () => boolean;
  allowed: () => Promise<boolean>;
  dependencies: (files: string[]) => void;
}): Promise<void> {
  const { file, realPath, appVersion, extensionVersion, owner, load, print, cache, active, allowed, dependencies } = options;
  const prepare = async () => {
    if (sourceIdentity(file).realPath !== realPath) return;
    return prepareSavedSlides(file, await fs.promises.readFile(realPath), appVersion, load, print, extensionVersion);
  };
  await cache.drawWhenAvailable(active, async () => {
    if (!active() || !await allowed()) return;
    const snapshot = await prepare();
    if (!active()) return;
    dependencies(snapshot?.dependencies ?? []);
    const stillCurrent = async () => {
      if (!active() || (await prepare())?.inputs !== snapshot?.inputs) return false;
      return allowed();
    };
    if (!snapshot || !snapshot.built.deck.slides.length) {
      if (await stillCurrent()) await cache.remove(realPath, active);
      return;
    }
    const stamps = await dependencyStamps(snapshot.dependencies);
    const entry = await cache.read(file, snapshot.inputs);
    if (entry && entry.owner === owner && entry.extensionVersion === extensionVersion
      && JSON.stringify(entry.dependencies) === JSON.stringify(stamps)) return;
    await drawDeckPdf(snapshot.input, snapshot.built, print, async pdfPath => {
      if (!active()) return;
      if ((await fs.promises.stat(pdfPath)).size > MAX_PDF_BYTES) {
        if (await stillCurrent()) await cache.remove(realPath, active);
        return;
      }
      const pdf = await fs.promises.readFile(pdfPath);
      await cache.publish(file, pdf, {
        sourceSha256: snapshot.sourceSha256, slides: snapshot.built.deck.slides.length, appVersion, inputs: snapshot.inputs, owner, extensionVersion, dependencies: stamps,
      }, stillCurrent, active);
    });
  });
}

/** Cheap startup checks also notice dependencies edited while the app was closed. */
export async function dependencyStamps(files: readonly string[]): Promise<Record<string, string>> {
  return Object.fromEntries(await Promise.all([...new Set(files)].sort().map(async file => {
    const stat = await fs.promises.stat(file).catch(() => undefined);
    return [file, stat ? `${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}` : 'missing'];
  })));
}
