import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { isEnabled } from '../features';
import { ProjectList } from '../projects/ProjectList';
import { getCurrentAppVersion } from '../update/versionService';
import { DECK_EXTENSION } from './deckFileName';
import { projectRoot } from './deckDocuments';
import { PRINT_COMMAND } from './deckPdf';
import type { DeckPublisher } from './deckPublish';
import { loadPageAssets } from './page/pageAssets';
import { containsSource, QuickLookCache, quickLookRoot, sourceIdentity } from './quickLookCache';
import { cacheSavedSlides, canStartQuickLook, QuickLookJobs } from './quickLookJobs';

const DECK_PATTERN = '**/*.[rR][tT][mM][sS]';
const isDeck = (file: string) => path.extname(file).toLowerCase() === DECK_EXTENSION;
const quietly = (work: Promise<unknown>) => { void work.catch(() => undefined); };

function realPathOrAbsolute(file: string): string {
  try { return fs.realpathSync.native(file); } catch { return path.resolve(file); }
}

interface DeckJob {
  file: string;
  realPath: string;
  owner?: string;
}

export async function startQuickLook(
  context: vscode.ExtensionContext, publisher: DeckPublisher, projects: ProjectList, ready: Promise<void>,
): Promise<void> {
  if (!await canStartQuickLook(process.platform, isEnabled('deck-quick-look'), isEnabled('decks'),
    async () => (await vscode.commands.getCommands(false)).includes(PRINT_COMMAND))) return;
  const product = JSON.parse(await fs.promises.readFile(path.join(vscode.env.appRoot, 'product.json'), 'utf8')) as {
    darwinBundleIdentifier?: string;
  };
  if (!product.darwinBundleIdentifier) return;
  const cache = new QuickLookCache(quickLookRoot(product.darwinBundleIdentifier));
  const appVersion = getCurrentAppVersion();
  const projectListFile = ProjectList.fileFor(context.globalStorageUri.fsPath);
  const print = {
    assets: () => loadPageAssets(context.extensionPath),
    print: (htmlPath: string) => Promise.resolve(vscode.commands.executeCommand<string>(PRINT_COMMAND, htmlPath)),
  };
  let disposed = false;
  let root: string | null = null;
  let realRoot: string | null = null;
  let listed = new Map<string, string>();
  let watch: vscode.FileSystemWatcher | undefined;
  let sweep: ReturnType<typeof setTimeout> | undefined;
  const deckDependencies = new Map<string, Set<string>>();

  async function readRoots() {
    const next = new Map<string, string>();
    for (const project of await projects.entries()) {
      const uri = vscode.Uri.parse(project.folderUri);
      if (uri.scheme === 'file') next.set(project.folderUri, realPathOrAbsolute(uri.fsPath));
    }
    return next;
  }

  const jobs = new QuickLookJobs<DeckJob>(async (job, active) => {
    await cacheSavedSlides({
      ...job, active, appVersion, cache, print,
      load: (file, text) => publisher.savedPageInput(file, text),
      allowed: async () => !job.owner || [...(await readRoots()).values()].includes(job.owner),
      dependencies: files => {
        if (realRoot && containsSource(realRoot, job.realPath)) {
          deckDependencies.set(job.file, new Set(files.flatMap(file => [file, realPathOrAbsolute(file)]).map(file => file.normalize('NFC'))));
        }
      },
    });
  });

  function queue(file: string, fromWorkspace: boolean): void {
    if (disposed || !isDeck(file) || !isEnabled('decks')) return;
    try {
      const { key, realPath } = sourceIdentity(file);
      const inWorkspace = realRoot && (containsSource(realRoot, realPath) || (root && containsSource(root, file)));
      if (fromWorkspace && (!inWorkspace || !realRoot || !containsSource(realRoot, realPath))) return;
      const roots = [...listed.values()];
      const owner = (inWorkspace && realRoot) || roots.find(other => containsSource(other, realPath)) || undefined;
      if (owner && !roots.includes(owner)) return;
      jobs.queue(key, { file, realPath, owner });
    } catch {
      // A delete or replacement can arrive before its watcher event.
    }
  }

  function remove(file: string): void {
    if (!isDeck(file)) return;
    deckDependencies.delete(file);
    jobs.cancel(job => job.file === file || job.realPath === file);
    const target = realRoot && root && containsSource(root, file) ? path.join(realRoot, path.relative(root, file)) : file;
    // A replacement may already occupy the path by the time a delete event arrives.
    quietly(cache.remove(target, () => !fs.existsSync(target)));
    quietly(cache.prune());
  }

  function queueSweep(): void {
    clearTimeout(sweep);
    const here = root;
    const resolved = realRoot;
    if (!here || !resolved || ![...listed.values()].includes(resolved)) return;
    sweep = setTimeout(() => quietly((async () => {
      const decks = await vscode.workspace.findFiles(new vscode.RelativePattern(here, DECK_PATTERN), null);
      if (disposed || root !== here || realRoot !== resolved) return;
      for (const deck of decks) queue(deck.fsPath, true);
      await cache.prune();
    })()), 0);
  }

  function watchProject(): void {
    watch?.dispose();
    jobs.cancel(job => job.owner === realRoot);
    deckDependencies.clear();
    root = projectRoot();
    realRoot = root ? realPathOrAbsolute(root) : null;
    if (root) {
      watch = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(root, '**/*'));
      const changed = (uri: vscode.Uri, deleted: boolean) => {
        const file = uri.fsPath;
        if (isDeck(file)) {
          if (deleted) remove(file);
          else queue(file, true);
        }
        const name = file.normalize('NFC');
        for (const [deck, paths] of deckDependencies) {
          if (paths.has(name)) queue(deck, true);
        }
      };
      watch.onDidCreate(uri => changed(uri, false));
      watch.onDidChange(uri => changed(uri, false));
      watch.onDidDelete(uri => changed(uri, true));
    }
    queueSweep();
  }

  let refresh = ready.then(async () => {
    if (disposed) return;
    listed = await readRoots();
    if (!disposed) watchProject();
  });
  function projectsChanged(): void {
    refresh = refresh.catch(() => undefined).then(async () => {
      if (disposed) return;
      const next = await readRoots();
      if (disposed) return;
      const remaining = [...next.values()];
      const removed = new Set([...listed.values()].filter(old => !remaining.includes(old)));
      const opened = realRoot && ![...listed.values()].includes(realRoot) && remaining.includes(realRoot);
      listed = next;
      for (const old of removed) {
        jobs.cancel(job => job.owner === old || (containsSource(old, job.realPath) &&
          !remaining.some(other => containsSource(other, job.realPath))));
        await cache.purgeProject(old, async () => [...(await readRoots()).values()]);
      }
      if (opened) queueSweep();
    });
    quietly(refresh);
  }

  const unsubscribe = projects.onDidChange(projectsChanged);
  // ProjectList is shared across windows, but its in-process event is local.
  fs.watchFile(projectListFile, { interval: 500, persistent: false }, projectsChanged);
  context.subscriptions.push(
    { dispose: () => {
      disposed = true;
      unsubscribe();
      fs.unwatchFile(projectListFile, projectsChanged);
      watch?.dispose();
      clearTimeout(sweep);
      jobs.dispose();
    } },
    vscode.workspace.onDidChangeWorkspaceFolders(() => { if (!disposed) watchProject(); }),
    vscode.workspace.onDidSaveTextDocument(document => {
      if (document.uri.scheme === 'file') quietly(refresh.then(() => queue(document.uri.fsPath, false)));
    }),
    vscode.workspace.onDidRenameFiles(event => {
      for (const { oldUri, newUri } of event.files) {
        if (oldUri.scheme === 'file') remove(oldUri.fsPath);
        if (newUri.scheme === 'file') queue(newUri.fsPath, true);
      }
    }),
    vscode.workspace.onDidDeleteFiles(event => {
      for (const uri of event.files) if (uri.scheme === 'file') remove(uri.fsPath);
    }),
  );
  quietly(refresh);
}
