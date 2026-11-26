import * as fs from 'node:fs';
import * as path from 'node:path';
import { DECK_EXTENSION } from './deckFileName';
import { containsSource, sourceIdentity } from './quickLookCache';
import { QuickLookJobs } from './quickLookJobs';

type Disposable = { dispose(): void };
type FileChange = 'create' | 'change' | 'delete';
export type QuickLookJob = { file: string; realPath: string; owner?: string };
type Roots = ReadonlyMap<string, string>;

interface EventSources {
  ready: Promise<void>;
  projects(): Promise<Roots>;
  onProjectsChanged(refresh: () => Promise<void>): Disposable;
  workspace(): string | null;
  onWorkspaceChanged(refresh: () => void): Disposable;
  watch(root: string, changed: (file: string, kind: FileChange) => void): Disposable;
  onSave(save: (file: string) => void): Disposable;
  onRename(rename: (from: string | undefined, to: string | undefined) => void): Disposable;
  onDelete(remove: (file: string) => void): Disposable;
  findDecks(root: string): Promise<string[]>;
  enabled(): boolean;
  draw(job: QuickLookJob, active: () => boolean, allowed: () => Promise<boolean>, dependencies: (files: string[]) => void): Promise<void>;
  fresh(job: QuickLookJob): Promise<string[] | undefined>;
  remove(file: string): Promise<void>;
  removeUnder(folder: string): Promise<void>;
  purgeOwners(listed: () => Promise<ReadonlySet<string>>): Promise<void>;
  prune(): Promise<void>;
  debounceMs?: number;
}

const isDeck = (file: string) => path.extname(file).toLowerCase() === DECK_EXTENSION;
const quietly = (work: Promise<unknown>) => { void work.catch(() => undefined); };
const equal = (a: string, b: string) => a.normalize('NFC') === b.normalize('NFC');
const within = (root: string, file: string) => equal(root, file) || containsSource(root, file);

export function realPathOrAbsolute(file: string): string {
  try { return fs.realpathSync.native(file); } catch { return path.resolve(file); }
}

function ownerOf(listed: Roots, realPath: string, realRoot: string | null): string | undefined {
  let best: [string, string] | undefined;
  for (const [key, folder] of listed) {
    if (!containsSource(folder, realPath)) continue;
    if (realRoot && equal(realRoot, folder)) return key;
    if (!best || folder.length > best[1].length) best = [key, folder];
  }
  return best?.[0];
}

export function connectQuickLookEvents(deps: EventSources): Disposable {
  let disposed = false;
  let root: string | null = null;
  let realRoot: string | null = null;
  let listed: Roots = new Map();
  let watcher: Disposable | undefined;
  let generation = 0;
  let pruneTimer: ReturnType<typeof setTimeout> | undefined;
  const tracked = new Map<string, Set<string>>();

  function track(file: string, dependencies: string[]) {
    tracked.set(file, new Set(dependencies.flatMap(dep => [dep, realPathOrAbsolute(dep)])));
  }

  const jobs = new QuickLookJobs<QuickLookJob>((job, active) => deps.draw(job, active,
    async () => !job.owner || (await deps.projects()).has(job.owner),
    files => {
      if (active() && realRoot && containsSource(realRoot, job.realPath)) track(job.file, files);
    }), deps.debounceMs);

  function candidate(file: string, workspaceOnly: boolean) {
    if (disposed || !deps.enabled() || !isDeck(file)) return;
    try {
      const { key, realPath } = sourceIdentity(file);
      const inWorkspace = realRoot && containsSource(realRoot, realPath);
      if (workspaceOnly && !inWorkspace) return;
      if (inWorkspace && ![...listed.values()].some(folder => equal(folder, realRoot!))) return;
      return { key, job: { file, realPath, owner: ownerOf(listed, realPath, realRoot) } };
    } catch {
      // The source can disappear before its watcher event is delivered.
    }
  }

  function queue(file: string, workspaceOnly: boolean) {
    const next = candidate(file, workspaceOnly);
    if (next) jobs.queue(next.key, next.job);
  }

  function schedulePrune() {
    clearTimeout(pruneTimer);
    if (!disposed) pruneTimer = setTimeout(() => quietly(deps.prune()), deps.debounceMs ?? 2000);
  }

  function remove(file: string) {
    if (disposed) return;
    const target = realRoot && root && within(root, file) ? path.join(realRoot, path.relative(root, file)) : file;
    jobs.cancel(job => within(file, job.file) || within(target, job.realPath));
    for (const deck of tracked.keys()) if (within(file, deck) || within(target, deck)) tracked.delete(deck);
    if (isDeck(file)) quietly(deps.remove(target));
    else quietly(deps.removeUnder(target));
    schedulePrune();
  }

  async function scan(folder: string, cheap: boolean) {
    const revision = generation;
    if (disposed || !realRoot || !within(realRoot, realPathOrAbsolute(folder))) return;
    for (const file of await deps.findDecks(folder)) {
      if (disposed || generation !== revision) return;
      const next = candidate(file, true);
      if (!next) continue;
      const files = cheap ? await deps.fresh(next.job) : undefined;
      if (disposed || generation !== revision) return;
      if (files) track(file, files);
      else jobs.queue(next.key, next.job);
    }
  }

  function create(file: string) {
    const revision = generation;
    quietly((async () => {
      const stat = await fs.promises.stat(file).catch(() => undefined);
      if (disposed || revision !== generation) return;
      if (stat?.isDirectory()) await scan(file, false);
      else if (stat?.isFile()) queue(file, true);
    })());
  }

  function changed(file: string, kind: FileChange) {
    if (kind === 'delete') remove(file);
    else if (kind === 'create') create(file);
    else queue(file, true);
    for (const [deck, paths] of tracked) {
      if ([...paths].some(dep => within(file, dep))) queue(deck, true);
    }
  }

  function sweep() {
    if (root && realRoot && [...listed.values()].some(folder => equal(folder, realRoot!))) {
      quietly(scan(root, true));
    }
    schedulePrune();
  }

  function watchWorkspace() {
    if (disposed) return;
    watcher?.dispose();
    generation++;
    const previous = realRoot;
    jobs.cancel(job => !!previous && containsSource(previous, job.realPath));
    tracked.clear();
    root = deps.workspace();
    realRoot = root ? realPathOrAbsolute(root) : null;
    watcher = root ? deps.watch(root, changed) : undefined;
    sweep();
  }

  const listedOwners = async () => new Set((await deps.projects()).keys());
  let refresh = deps.ready.then(async () => {
    if (disposed) return;
    listed = await deps.projects();
    if (disposed) return;
    watchWorkspace();
    await deps.purgeOwners(listedOwners);
  });
  const subscriptions = [
    deps.onProjectsChanged(() => {
      refresh = refresh.catch(() => undefined).then(async () => {
        if (disposed) return;
        const next = await deps.projects();
        if (disposed) return;
        const removed = [...listed.keys()].some(key => !next.has(key));
        const added = [...next.keys()].some(key => !listed.has(key));
        listed = next;
        if (removed) {
          generation++;
          jobs.cancel(job => !!job.owner && !next.has(job.owner));
          await deps.purgeOwners(listedOwners);
        }
        if (added || removed) sweep();
      });
      quietly(refresh);
      return refresh;
    }),
    deps.onWorkspaceChanged(watchWorkspace),
    deps.onSave(file => quietly(refresh.then(() => queue(file, false)))),
    deps.onRename((from, to) => {
      if (from) changed(from, 'delete');
      if (to) changed(to, 'create');
    }),
    deps.onDelete(file => changed(file, 'delete')),
  ];
  quietly(refresh);
  return { dispose: () => {
    disposed = true;
    jobs.dispose();
    watcher?.dispose();
    clearTimeout(pruneTimer);
    for (const subscription of subscriptions) subscription.dispose();
  } };
}
