/**
 * Sprint 148 (#591, the words layer): the search index's host, one per window.
 *
 * It starts the worker (`out/search/searchWorker.js`, found through the
 * extension's path, never by `__dirname` depth) when something asks: a query, or
 * `startAfter` (R4's warm start, 5 s after activation on a shell with the box).
 * From then on it forwards the watcher's events in batches, the person's
 * `files.exclude`, the chats' index file and the Task board's snapshots.
 *
 * The kill switch: `ritemark.features.project-search` (on by default). Off, the
 * index never starts, a running one stops, and the Search row and ⌘⇧F open
 * VS Code's search (E3). The context key `ritemark.projectSearch.enabled` tells
 * the shell (PR 3) whether to draw the box.
 *
 * PR 2 adds the results view (`SearchViewProvider`, `searchPanel.ts`) and the
 * Search row's command with the box's arguments.
 *
 * Nothing leaves the computer (E2): no network, no AI, no usage event; the log
 * carries counts and timings, never words, names or paths.
 */
import * as path from 'node:path';
import { monitorEventLoopDelay, type IntervalHistogram } from 'node:perf_hooks';
import { Worker } from 'node:worker_threads';
import * as vscode from 'vscode';
import { conversationStoreDir } from '../conversations/ConversationStore';
import { resolveProjectScope } from '../conversations/projectScope';
import { isEnabled } from '../features';
import type { TaskBoardHost } from '../taskBoard/taskBoardHost';
import {
  DEFAULT_SEARCH_LIMITS,
  DEFAULT_SEARCH_OPTIONS,
  type IndexStatus,
  type MapEntry,
  type PassageAnswer,
  type SearchAnswer,
  type SearchKind,
  type SearchOptions,
  type SearchResult,
  type WorkerConfig,
} from './protocol';
import { enabledPatterns, mergeEvents, type FsEvent } from './hostEvents';
import { SearchPanelController, searchRowAction } from './searchPanel';
import { SearchViewProvider } from './SearchViewProvider';
import { SearchWorkerClient, type WorkerLike } from './searchWorkerClient';
import { taskSources } from './sources/tasks';
import { oneDriveRootsFromEnv } from './worker/cloudFiles';

/** The worker's heap cap (E1). */
export const SEARCH_WORKER_HEAP_MB = 512;
/** Decision 3: at most this much of Word and PDF text kept on this computer. */
export const SEARCH_CACHE_BYTES = 200 * 1024 * 1024;
/** The watcher's events reach the worker in batches this far apart (R4). */
export const EVENT_BATCH_MS = 300;
/** R4: 5 s after the extension starts, if nothing asked sooner. */
export const WARM_START_MS = 5000;
/** M3: how often the host's event-loop delay is sampled while the worker reads. */
const HOST_DELAY_RESOLUTION_MS = 10;
/** The shell's box (patch 018, PR 3) registers this; a shell without it has no box (E3). */
export const FOCUS_BOX_COMMAND = '_ritemark.projectHead.focusSearch';
/** Tells the shell (PR 3) to draw the box: the kill switch is on and the window has a project folder. */
export const ENABLED_CONTEXT_KEY = 'ritemark.projectSearch.enabled';

export interface SearchHostDependencies {
  context: vscode.ExtensionContext;
  taskBoard: TaskBoardHost | undefined;
  boardEnabled: () => boolean;
}

export class SearchHost implements vscode.Disposable {
  private client: SearchWorkerClient | null = null;
  private readonly running: vscode.Disposable[] = [];
  private readonly disposables: vscode.Disposable[] = [];
  private batch: FsEvent[] = [];
  private batchTimer: ReturnType<typeof setTimeout> | undefined;
  private warmTimer: ReturnType<typeof setTimeout> | undefined;
  private chatTimer: ReturnType<typeof setTimeout> | undefined;
  private hostDelay: IntervalHistogram | null = null;
  private hostDelayReport: { p50: number; p95: number; max: number } | null = null;
  private readonly statusEmitter = new vscode.EventEmitter<IndexStatus>();
  readonly onStatus = this.statusEmitter.event;

  constructor(private readonly deps: SearchHostDependencies) {
    this.disposables.push(
      this.statusEmitter,
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('ritemark.features.project-search') && !this.enabled) this.stop();
        if (event.affectsConfiguration('files.exclude') && this.client) this.client.post({ type: 'rules', filesExclude: this.filesExclude() });
      }),
      // A folder added to or removed from the project: a running index starts again over the new folders.
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        if (!this.client) return;
        this.stop();
        this.ensureStarted();
      }),
    );
  }

  get enabled(): boolean {
    return isEnabled('project-search') && this.roots().length > 0;
  }

  get status(): IndexStatus | null {
    return this.client?.status ?? null;
  }

  private roots(): vscode.WorkspaceFolder[] {
    return (vscode.workspace.workspaceFolders ?? []).filter((folder) => folder.uri.scheme === 'file');
  }

  private filesExclude(): Record<string, string[]> {
    const patterns: Record<string, string[]> = {};
    for (const folder of this.roots()) {
      patterns[folder.uri.fsPath] = enabledPatterns(vscode.workspace.getConfiguration('files', folder.uri).get('exclude'));
    }
    return patterns;
  }

  private config(): WorkerConfig {
    const { context } = this.deps;
    const folders = this.roots();
    const scope = resolveProjectScope({
      workspaceFileUri: vscode.workspace.workspaceFile?.toString() ?? null,
      folderUris: (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.toString()),
      platform: process.platform,
    });
    return {
      roots: folders.map((folder) => ({ path: folder.uri.fsPath, name: folder.name })),
      filesExclude: this.filesExclude(),
      platform: process.platform,
      oneDriveRoots: process.platform === 'win32' ? oneDriveRootsFromEnv(process.env) : [],
      cacheDir: context.storageUri ? path.join(context.storageUri.fsPath, 'search', 'v1') : null,
      cacheBytes: SEARCH_CACHE_BYTES,
      chats: { dir: conversationStoreDir(context.globalStorageUri.fsPath), scopeId: scope.scopeId },
      limits: DEFAULT_SEARCH_LIMITS,
    };
  }

  private createWorker(): WorkerLike {
    const script = path.join(this.deps.context.extensionPath, 'out', 'search', 'searchWorker.js');
    const worker = new Worker(script, {
      resourceLimits: { maxOldGenerationSizeMb: SEARCH_WORKER_HEAP_MB },
      // pdf.js's warnings and anything else the worker prints stay out of the host's log (E2).
      stdout: true,
      stderr: true,
    });
    worker.stdout.resume();
    worker.stderr.resume();
    return worker as unknown as WorkerLike;
  }

  /** Starts the index if it may run; true when it runs. */
  ensureStarted(): boolean {
    if (this.client) return !this.client.unavailable;
    if (!this.enabled) return false;
    const client = new SearchWorkerClient(() => this.createWorker(), this.config(), (event, counts) => this.logCounts(event, counts));
    this.client = client;
    this.hostDelay = monitorEventLoopDelay({ resolution: HOST_DELAY_RESOLUTION_MS });
    this.hostDelay.enable();
    this.running.push({ dispose: client.onStatus((status) => this.onWorkerStatus(status)) });
    client.start();
    this.follow(client);
    return true;
  }

  /** R4's warm start: start after `ms` unless something asked sooner, and only if `shouldStart` still agrees then. */
  startAfter(ms = WARM_START_MS, shouldStart: () => boolean | Promise<boolean> = () => true): void {
    if (this.warmTimer || this.client) return;
    this.warmTimer = setTimeout(() => {
      this.warmTimer = undefined;
      void Promise.resolve()
        .then(shouldStart)
        .then((go) => {
          if (go) this.ensureStarted();
        }, () => undefined);
    }, ms);
  }

  private onWorkerStatus(status: IndexStatus): void {
    if (status.state !== 'reading' && this.hostDelay) {
      // M3: the host's event-loop delay while the worker read, in ms. The histogram records each whole
      // interval between its timer's ticks, so the resolution is taken off to leave the delay.
      const histogram = this.hostDelay;
      this.hostDelay = null;
      histogram.disable();
      const delayMs = (ns: number) => Math.max(0, Math.round((ns / 1e6 - HOST_DELAY_RESOLUTION_MS) * 10) / 10);
      this.hostDelayReport = {
        p50: delayMs(histogram.percentile(50)),
        p95: delayMs(histogram.percentile(95)),
        max: delayMs(histogram.max),
      };
      this.logCounts('host-delay', { p50Ms: this.hostDelayReport.p50, p95Ms: this.hostDelayReport.p95, maxMs: this.hostDelayReport.max });
    }
    this.statusEmitter.fire(status);
  }

  private follow(client: SearchWorkerClient): void {
    const queue = (kind: FsEvent['kind']) => (uri: vscode.Uri) => {
      if (uri.scheme !== 'file') return;
      this.batch.push({ kind, path: uri.fsPath });
      this.batchTimer ??= setTimeout(() => {
        this.batchTimer = undefined;
        const events = mergeEvents(this.batch);
        this.batch = [];
        client.post({ type: 'fs-events', events });
      }, EVENT_BATCH_MS);
    };
    for (const folder of this.roots()) {
      const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, '**/*'));
      this.running.push(watcher, watcher.onDidCreate(queue('created')), watcher.onDidChange(queue('changed')), watcher.onDidDelete(queue('deleted')));
    }
    // Chats: the store's index file, as Home follows it.
    const chatIndex = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(vscode.Uri.file(conversationStoreDir(this.deps.context.globalStorageUri.fsPath)), 'index.json'),
    );
    const onChatIndex = () => {
      if (this.chatTimer) clearTimeout(this.chatTimer);
      this.chatTimer = setTimeout(() => client.post({ type: 'chats-changed' }), EVENT_BATCH_MS);
    };
    this.running.push(chatIndex, chatIndex.onDidChange(onChatIndex), chatIndex.onDidCreate(onChatIndex), chatIndex.onDidDelete(onChatIndex));
    // Tasks: the board's snapshots, as a replacement of the set.
    const board = this.deps.taskBoard?.controller;
    if (board) {
      const unsubscribe = board.subscribe((snapshot) => client.post({ type: 'tasks', sources: this.deps.boardEnabled() ? taskSources(snapshot) : [] }));
      this.running.push({ dispose: unsubscribe });
    }
  }

  async query(text: string, options: Partial<SearchOptions> = {}, perKind = 5, expand?: SearchKind): Promise<SearchAnswer | null> {
    if (!this.ensureStarted() || !this.client) return null;
    return this.client.query(text, { ...DEFAULT_SEARCH_OPTIONS, ...options }, perKind, expand);
  }

  /** Sprint 150's first question. */
  async passages(words: string[], limit = 20): Promise<PassageAnswer[]> {
    if (!this.ensureStarted() || !this.client) return [];
    return this.client.passages(words, limit);
  }

  /** Sprint 150's second question. */
  async map(): Promise<MapEntry[]> {
    if (!this.ensureStarted() || !this.client) return [];
    return this.client.map();
  }

  /** M1 and M3's numbers: the worker's own, and the host's event-loop delay while it read. */
  async stats(): Promise<unknown> {
    const worker = (await this.client?.stats()) ?? null;
    return { worker, status: this.status, hostDelayMs: this.hostDelayReport };
  }

  private logCounts(event: string, counts: Record<string, number>): void {
    const parts = Object.entries(counts).map(([key, value]) => `${key}=${value}`);
    console.log(`[search] ${event} ${parts.join(' ')}`);
  }

  /** Stops the worker and what follows it (the kill switch turned off). */
  stop(): void {
    if (this.warmTimer) clearTimeout(this.warmTimer);
    if (this.batchTimer) clearTimeout(this.batchTimer);
    if (this.chatTimer) clearTimeout(this.chatTimer);
    this.warmTimer = this.batchTimer = this.chatTimer = undefined;
    this.batch = [];
    for (const disposable of this.running.splice(0)) disposable.dispose();
    this.hostDelay?.disable();
    this.hostDelay = null;
    this.client?.dispose();
    this.client = null;
  }

  dispose(): void {
    this.stop();
    for (const disposable of this.disposables.splice(0)) disposable.dispose();
  }
}

/** What opening a result needs from the rest of the extension (R8). */
export interface SearchOpenDependencies {
  /** A chat on the AI's sheet, with the matching message's turn in view when given (A5). */
  openConversation(conversationId: string, reveal: { turnId: string | null; preserveFocus: boolean }): Promise<void>;
  /** A task as its card's page. */
  openCard(cardId: string): Promise<void>;
}

export interface ProjectSearch {
  host: SearchHost;
  /** The head's Search row (`ritemark.projectHead.search`): what the shell's box sends, or nothing. */
  runSearchRow(arg?: unknown): Promise<unknown>;
}

/** A result's own id after its kind: `chat:<id>` → `<id>`. */
function idOf(result: SearchResult): string | null {
  const prefix = `${result.kind}:`;
  return result.key.startsWith(prefix) ? result.key.slice(prefix.length) : null;
}

/**
 * Composes search for this window: the index, the results view, the Search row's command, the kill switch's
 * context key and R4's warm start. `_ritemark.search.query` and `_ritemark.search.stats` stay for the
 * measurements (M1–M6).
 */
export function registerProjectSearch(deps: SearchHostDependencies & { opens: SearchOpenDependencies }): ProjectSearch {
  const host = new SearchHost(deps);
  const { context, opens } = deps;

  const open = async (result: SearchResult): Promise<void> => {
    const id = idOf(result);
    if (result.kind === 'document') {
      // Its usual editor (Markdown in Ritemark, Word and PDF in their previews, CSV in the table), at its top until
      // PR 4; the keyboard stays in the results, so the next one is one key away (R8).
      if (result.path) await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(result.path), { preserveFocus: true });
    } else if (result.kind === 'chat') {
      if (id) await opens.openConversation(id, { turnId: result.passage?.at.turnId ?? null, preserveFocus: true });
    } else if (id) {
      await opens.openCard(id);
    }
  };

  // Whether the shell draws the box: its command is registered by the workbench before extensions run. A positive
  // answer is kept; a negative one is asked again after a while.
  let shellBox: { value: boolean; at: number } | null = null;
  const shellHasBox = async (): Promise<boolean> => {
    if (shellBox?.value) return true;
    if (shellBox && Date.now() - shellBox.at < 10_000) return false;
    const commands = await vscode.commands.getCommands(false);
    shellBox = { value: commands.includes(FOCUS_BOX_COMMAND), at: Date.now() };
    return shellBox.value;
  };

  let view: SearchViewProvider | null = null;
  const panel = new SearchPanelController({
    query: (text, options, perKind, expand) => host.query(text, options, perKind, expand),
    post: (message) => view?.post(message),
    setup: () => ({
      projectName: vscode.workspace.name ?? vscode.workspace.workspaceFolders?.[0]?.name ?? '',
      roots: (vscode.workspace.workspaceFolders ?? []).filter((folder) => folder.uri.scheme === 'file').map((folder) => folder.uri.fsPath),
    }),
    // E2: a failure logs its kind only, never a path.
    open: (result) => open(result).catch((error: unknown) => console.warn('[search] could not open a result:', error instanceof Error ? error.name : 'error')),
    focusResults: async () => view?.focus(),
    focusBox: async () => {
      if (await shellHasBox()) await vscode.commands.executeCommand(FOCUS_BOX_COMMAND);
    },
    now: () => performance.now(),
  });
  view = new SearchViewProvider(context.extensionUri, (message) => {
    void panel.onViewMessage(message).catch((error: unknown) => console.warn('[search] a view message failed:', error instanceof Error ? error.name : 'error'));
  });

  const updateContextKey = () => void vscode.commands.executeCommand('setContext', ENABLED_CONTEXT_KEY, host.enabled);
  updateContextKey();

  const runSearchRow = async (arg?: unknown): Promise<unknown> => {
    const action = searchRowAction(arg, { enabled: host.enabled, shellHasBox: await shellHasBox() });
    switch (action.kind) {
      case 'vscode-search':
        return vscode.commands.executeCommand(action.command);
      case 'query':
        return panel.setText(action.text);
      case 'focus-first':
        return panel.key('down');
      case 'open-top':
        return panel.key('enter');
      case 'focus-box':
        return vscode.commands.executeCommand(FOCUS_BOX_COMMAND);
    }
  };

  context.subscriptions.push(
    host,
    { dispose: () => panel.dispose() },
    vscode.window.registerWebviewViewProvider(SearchViewProvider.viewType, view, { webviewOptions: { retainContextWhenHidden: true } }),
    host.onStatus((status) => panel.onStatus(status)),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('ritemark.features.project-search')) updateContextKey();
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => updateContextKey()),
    vscode.commands.registerCommand(
      '_ritemark.search.query',
      (args?: { text?: string; options?: Partial<SearchOptions>; perKind?: number; expand?: SearchKind }) =>
        host.query(typeof args?.text === 'string' ? args.text : '', args?.options, args?.perKind, args?.expand),
    ),
    vscode.commands.registerCommand('_ritemark.search.stats', async () => ({ ...((await host.stats()) as object), panel: panel.stats() })),
  );

  // R4: 5 s after activation, unless a query asked sooner; only where the box can be used (the kill switch on and a
  // shell that draws it), so a shell without the box reads nothing in the background.
  host.startAfter(WARM_START_MS, async () => host.enabled && (await shellHasBox()));

  return { host, runSearchRow };
}
