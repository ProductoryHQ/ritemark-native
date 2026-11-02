/**
 * Sprint 148 (#591, the words layer): the search index's host, one per window.
 *
 * It starts the worker (`out/search/searchWorker.js`, found through the
 * extension's path, never by `__dirname` depth) when something asks: a query, or
 * `startAfter` (R4's warm start, which the results view turns on in PR 2). From
 * then on it forwards the watcher's events in batches, the person's
 * `files.exclude`, the chats' index file and the Task board's snapshots.
 *
 * The kill switch: `ritemark.features.project-search` (on by default). Off, the
 * index never starts, and a running one stops.
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
  type WorkerConfig,
} from './protocol';
import { enabledPatterns, mergeEvents, type FsEvent } from './hostEvents';
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

  /** R4's warm start: start after `ms` unless something asked sooner. */
  startAfter(ms = WARM_START_MS): void {
    if (this.warmTimer || this.client) return;
    this.warmTimer = setTimeout(() => {
      this.warmTimer = undefined;
      this.ensureStarted();
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

/**
 * Composes search for this window. PR 1 holds the index only: nothing starts it
 * yet but the internal commands below (Sprint 148's measurements and PR 2's view);
 * PR 2 adds the results view, and with it the warm start (`startAfter`).
 */
export function registerProjectSearch(deps: SearchHostDependencies): SearchHost {
  const host = new SearchHost(deps);
  deps.context.subscriptions.push(
    host,
    vscode.commands.registerCommand(
      '_ritemark.search.query',
      (args?: { text?: string; options?: Partial<SearchOptions>; perKind?: number; expand?: SearchKind }) =>
        host.query(typeof args?.text === 'string' ? args.text : '', args?.options, args?.perKind, args?.expand),
    ),
    vscode.commands.registerCommand('_ritemark.search.stats', () => host.stats()),
  );
  return host;
}
