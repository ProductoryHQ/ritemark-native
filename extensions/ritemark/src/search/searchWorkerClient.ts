/**
 * Sprint 148 (R4, R5): the host's side of the search worker.
 *
 * - Queries are coalesced: while one is in the worker, a newer one waits, and a
 *   still newer one replaces it; a replaced query answers null. So the worker
 *   never works through keys the person has already typed past, and an older
 *   query's answer is never drawn over a newer one's (`queryId`).
 * - A worker that stops (its heap cap, a crash) is started once more with half
 *   the limits; if it stops again, search is not available in this project.
 *
 * No `vscode` import: tests drive it with a fake worker.
 */
import type {
  HostToWorkerMessage,
  IndexSource,
  IndexStatus,
  MapEntry,
  PassageAnswer,
  SearchAnswer,
  SearchKind,
  SearchLimits,
  SearchOptions,
  WorkerConfig,
  WorkerStats,
  WorkerToHostMessage,
} from './protocol';

export interface WorkerLike {
  postMessage(message: HostToWorkerMessage): void;
  on(event: 'message', listener: (message: WorkerToHostMessage) => void): unknown;
  on(event: 'error', listener: (error: Error) => void): unknown;
  on(event: 'exit', listener: (code: number) => void): unknown;
  terminate(): Promise<number>;
}

/** `attempt` is 0 for the first start, 1 for the restart with half the limits. */
export type WorkerFactory = (attempt: number) => WorkerLike;

export function halfLimits(limits: SearchLimits): SearchLimits {
  const half = (value: number) => Math.max(1, Math.floor(value / 2));
  return {
    maxDocuments: half(limits.maxDocuments),
    maxNames: half(limits.maxNames),
    markdownBytes: half(limits.markdownBytes),
    csvBytes: half(limits.csvBytes),
    docxBytes: half(limits.docxBytes),
    pdfBytes: half(limits.pdfBytes),
    textPerDocument: half(limits.textPerDocument),
    textBudget: half(limits.textBudget),
    textPerChat: half(limits.textPerChat),
  };
}

const UNAVAILABLE_STATUS: IndexStatus = {
  state: 'unavailable',
  documents: { done: 0, total: 0 },
  limited: false,
  tooLarge: 0,
  failed: 0,
  chats: 0,
  tasks: 0,
};

interface QueryRequest {
  queryId: number;
  text: string;
  options: SearchOptions;
  perKind: number;
  expand?: SearchKind;
  resolve: (answer: SearchAnswer | null) => void;
}

export class SearchWorkerClient {
  private worker: WorkerLike | null = null;
  private attempt = 0;
  private disposed = false;
  private nextRequestId = 1;
  private nextQueryId = 1;
  private readonly requests = new Map<number, (message: WorkerToHostMessage | null) => void>();
  private inFlight: QueryRequest | null = null;
  private waiting: QueryRequest | null = null;
  private lastTasks: IndexSource[] | null = null;
  private latestStatus: IndexStatus | null = null;
  private readonly statusListeners = new Set<(status: IndexStatus) => void>();
  private config: WorkerConfig;

  constructor(
    private readonly factory: WorkerFactory,
    config: WorkerConfig,
    private readonly log: (event: string, counts: Record<string, number>) => void = () => undefined,
  ) {
    this.config = config;
  }

  get started(): boolean {
    return this.worker !== null;
  }

  get unavailable(): boolean {
    return this.latestStatus?.state === 'unavailable';
  }

  get status(): IndexStatus | null {
    return this.latestStatus;
  }

  onStatus(listener: (status: IndexStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  start(): void {
    if (this.worker || this.disposed || this.unavailable) return;
    const config = this.attempt === 0 ? this.config : { ...this.config, limits: halfLimits(this.config.limits) };
    const worker = this.factory(this.attempt);
    this.worker = worker;
    worker.on('message', (message) => {
      if (this.worker === worker) this.onMessage(message);
    });
    worker.on('error', () => {
      if (this.worker === worker) this.onStopped(worker, 'error');
    });
    worker.on('exit', (code) => {
      if (this.worker === worker) this.onStopped(worker, code === 0 ? 'exit' : 'crash');
    });
    worker.postMessage({ type: 'init', config });
    if (this.lastTasks) worker.postMessage({ type: 'tasks', sources: this.lastTasks });
  }

  private onStopped(worker: WorkerLike, why: string): void {
    this.worker = null;
    void worker.terminate().catch(() => undefined);
    // Every open question answers nothing; the next start answers again.
    for (const resolve of [...this.requests.values()]) resolve(null);
    this.requests.clear();
    this.inFlight?.resolve(null);
    this.inFlight = null;
    if (this.disposed) return;
    this.log('worker-stopped', { attempt: this.attempt, crash: why === 'exit' ? 0 : 1 });
    if (this.attempt === 0) {
      this.attempt = 1;
      this.start();
      this.pump();
      return;
    }
    this.setStatus(UNAVAILABLE_STATUS);
    this.waiting?.resolve(null);
    this.waiting = null;
  }

  private setStatus(status: IndexStatus): void {
    this.latestStatus = status;
    for (const listener of this.statusListeners) listener(status);
  }

  private onMessage(message: WorkerToHostMessage): void {
    switch (message.type) {
      case 'status':
        this.setStatus(message.status);
        return;
      case 'log':
        this.log(message.event, message.counts);
        return;
      default: {
        const resolve = this.requests.get(message.requestId);
        if (!resolve) return;
        this.requests.delete(message.requestId);
        resolve(message);
      }
    }
  }

  /** Sends what the worker follows (events, rules, chats); dropped while no worker runs, as the next start walks again. */
  post(message: Extract<HostToWorkerMessage, { type: 'fs-events' | 'rules' | 'chats-changed' | 'tasks' }>): void {
    if (message.type === 'tasks') this.lastTasks = message.sources;
    if (message.type === 'rules') this.config = { ...this.config, filesExclude: message.filesExclude };
    this.worker?.postMessage(message);
  }

  private request<T extends WorkerToHostMessage>(build: (requestId: number) => HostToWorkerMessage): Promise<T | null> {
    if (!this.worker) return Promise.resolve(null);
    const requestId = this.nextRequestId++;
    return new Promise<T | null>((resolve) => {
      this.requests.set(requestId, (message) => resolve(message as T | null));
      this.worker!.postMessage(build(requestId));
    });
  }

  /** The words layer's answer; null when a newer query replaced this one, or no worker could answer. */
  query(text: string, options: SearchOptions, perKind: number, expand?: SearchKind): Promise<SearchAnswer | null> {
    if (this.unavailable) return Promise.resolve(null);
    this.start();
    return new Promise((resolve) => {
      const request: QueryRequest = { queryId: this.nextQueryId++, text, options, perKind, expand, resolve };
      this.waiting?.resolve(null);
      this.waiting = request;
      this.pump();
    });
  }

  private pump(): void {
    if (this.inFlight || !this.waiting || !this.worker) return;
    const request = this.waiting;
    this.waiting = null;
    this.inFlight = request;
    void this.request<Extract<WorkerToHostMessage, { type: 'answer' }>>((requestId) => ({
      type: 'query',
      requestId,
      queryId: request.queryId,
      text: request.text,
      options: request.options,
      perKind: request.perKind,
      ...(request.expand ? { expand: request.expand } : {}),
    })).then((message) => {
      if (this.inFlight === request) this.inFlight = null;
      request.resolve(message?.answer ?? null);
      this.pump();
    });
  }

  async passages(words: string[], limit: number): Promise<PassageAnswer[]> {
    this.start();
    const message = await this.request<Extract<WorkerToHostMessage, { type: 'passages' }>>((requestId) => ({ type: 'passages', requestId, words, limit }));
    return message?.passages ?? [];
  }

  async map(): Promise<MapEntry[]> {
    this.start();
    const message = await this.request<Extract<WorkerToHostMessage, { type: 'map' }>>((requestId) => ({ type: 'map', requestId }));
    return message?.entries ?? [];
  }

  async stats(): Promise<WorkerStats | null> {
    const message = await this.request<Extract<WorkerToHostMessage, { type: 'stats' }>>((requestId) => ({ type: 'stats', requestId }));
    return message?.stats ?? null;
  }

  dispose(): void {
    this.disposed = true;
    const worker = this.worker;
    this.worker = null;
    for (const resolve of [...this.requests.values()]) resolve(null);
    this.requests.clear();
    this.inFlight?.resolve(null);
    this.waiting?.resolve(null);
    this.inFlight = null;
    this.waiting = null;
    void worker?.terminate().catch(() => undefined);
  }
}
