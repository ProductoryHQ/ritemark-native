import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { isEnabled } from '../features';
import { ProjectList } from '../projects/ProjectList';
import { getCurrentAppVersion } from '../update/versionService';
import { normalizeProjectUri } from '../conversations/projectScope';
import { connectQuickLookEvents, realPathOrAbsolute } from './quickLookEvents';
import { projectRoot } from './deckDocuments';
import { PRINT_COMMAND } from './deckPdf';
import type { DeckPublisher } from './deckPublish';
import { loadPageAssets } from './page/pageAssets';
import { QuickLookCache, quickLookRoot, sha256 } from './quickLookCache';
import { cacheSavedSlides, dependencyStamps } from './quickLookJobs';
import { quickLookAvailable } from './quickLook/availability';

export async function startQuickLook(
  context: vscode.ExtensionContext, publisher: DeckPublisher, projects: ProjectList, ready: Promise<void>,
): Promise<void> {
  if (!await quickLookAvailable()) return;
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
  const extensionVersion: string = context.extension.packageJSON.version;
  const filePath = (uri: vscode.Uri) => uri.scheme === 'file' ? uri.fsPath : undefined;
  context.subscriptions.push(connectQuickLookEvents({
    ready,
    projects: async () => new Map((await projects.entries()).flatMap(project => {
      const file = filePath(vscode.Uri.parse(project.folderUri));
      return file ? [[normalizeProjectUri(project.folderUri), realPathOrAbsolute(file)] as const] : [];
    })),
    onProjectsChanged: refresh => {
      const changed = () => { void refresh().catch(() => undefined); };
      const unsubscribe = projects.onDidChange(changed);
      // ProjectList's in-process event is local to the window.
      fs.watchFile(projectListFile, { interval: 500, persistent: false }, changed);
      return { dispose: () => { unsubscribe(); fs.unwatchFile(projectListFile, changed); } };
    },
    workspace: projectRoot,
    onWorkspaceChanged: refresh => vscode.workspace.onDidChangeWorkspaceFolders(refresh),
    watch: (root, changed) => {
      const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(root, '**/*'));
      watcher.onDidChange(uri => changed(uri.fsPath, 'change'));
      watcher.onDidCreate(uri => changed(uri.fsPath, 'create'));
      watcher.onDidDelete(uri => changed(uri.fsPath, 'delete'));
      return watcher;
    },
    onSave: save => vscode.workspace.onDidSaveTextDocument(({ uri }) => {
      const file = filePath(uri);
      if (file) save(file);
    }),
    onRename: rename => vscode.workspace.onDidRenameFiles(event => {
      for (const { oldUri, newUri } of event.files) rename(filePath(oldUri), filePath(newUri));
    }),
    onDelete: remove => vscode.workspace.onDidDeleteFiles(event => {
      for (const uri of event.files) {
        const file = filePath(uri);
        if (file) remove(file);
      }
    }),
    findDecks: async root => (await vscode.workspace.findFiles(
      new vscode.RelativePattern(root, '**/*.[rR][tT][mM][sS]'), null)).map(uri => uri.fsPath),
    enabled: () => isEnabled('decks'),
    draw: (job, active, allowed, dependencies) => cacheSavedSlides({
      ...job, active, allowed, dependencies, appVersion, extensionVersion, cache, print,
      load: (file, text) => publisher.savedPageInput(file, text),
    }),
    fresh: async job => {
      const entry = await cache.metadata(job.file);
      if (!entry || entry.owner !== job.owner || entry.appVersion !== appVersion
        || entry.extensionVersion !== extensionVersion || !entry.dependencies) return;
      const bytes = await fs.promises.readFile(job.realPath).catch(() => undefined);
      if (!bytes || sha256(bytes) !== entry.sourceSha256) return;
      const files = Object.keys(entry.dependencies);
      if (JSON.stringify(await dependencyStamps(files)) === JSON.stringify(entry.dependencies)) return files;
    },
    remove: file => cache.remove(file, () => !fs.existsSync(file)),
    removeUnder: folder => cache.removeMissingUnder(folder),
    purgeOwners: listed => cache.purgeUnlisted(listed),
    prune: () => cache.prune(),
  }));
}
