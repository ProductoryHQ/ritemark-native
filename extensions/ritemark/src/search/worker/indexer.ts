/**
 * Sprint 148 (R1–R4): the worker's index of one window's project.
 *
 * A cold start walks the folders and lists every document by its name at once,
 * then reads text, the most recently changed first: Markdown and CSV, then Word
 * and PDF (from decision 3's copies when they still match, else read). The
 * documents limit and the text budget are spent in that order; past them, the
 * rest are found by name. Reading yields between files and between a PDF's
 * pages, so a query is answered while the index reads.
 *
 * Fresh after a change (R4): the host forwards the watcher's events in batches;
 * a changed file is read again once its size has held for one more check, a
 * removed one goes at once (and its copy with it), a changed `.gitignore` walks
 * again. Chats follow the store's index; tasks are replaced from each board
 * snapshot.
 */
import * as nodePath from 'node:path';
import type {
  IndexSource,
  IndexStatus,
  NameOnlyReason,
  SearchAnswer,
  SearchKind,
  SearchLimits,
  SearchOptions,
  WorkerConfig,
  WorkerStats,
} from '../protocol';
import { ChatFeed, type ChatFs } from '../sources/chats';
import { READER_VERSION, readDocument, type ReadOutcome } from './readers';
import { TextCache, type CachedText } from './textCache';
import { WordIndex } from './wordIndex';
import { RootRules, classifyPath, isRuleFile, walkProject, type FoundDocument, type WalkFs } from './walk';

export interface IndexerFs extends WalkFs {
  readFile(target: string): Promise<Uint8Array>;
}

export interface Timers {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  now(): number;
}

export interface IndexerDependencies {
  fs: IndexerFs;
  cache: TextCache;
  chatFs?: ChatFs;
  timers: Timers;
  /** Lets queued messages (a query) in between two pieces of work. */
  pause: () => Promise<void>;
  onStatus: (status: IndexStatus) => void;
  log: (event: string, counts: Record<string, number>) => void;
  read?: (format: FoundDocument['format'], bytes: Uint8Array, budget: number, pause: () => Promise<void>) => Promise<ReadOutcome>;
}

/** How long a changed file's size must hold before it is read again (R4). */
export const SETTLE_MS = 500;
/** The first look at a changed file, before its size is known to hold. */
export const FIRST_LOOK_MS = 200;
const REWALK_MS = 500;
/** Markdown and CSV files read ahead of the one being parsed. */
const READ_AHEAD = 8;
/** Decision 3's index is written after this many Word and PDF files, not only when the walk ends. */
const FLUSH_EVERY = 50;
const STATUS_MS = 250;

interface DocumentState {
  found: FoundDocument;
  /** Read (or settled as name only) for this size and change time. */
  settled: boolean;
  chars: number;
  /** Past the documents limit when the walk shared it out, newest first across the four kinds. */
  overLimit?: boolean;
}

const BYTE_LIMIT: Record<FoundDocument['format'], keyof SearchLimits> = {
  markdown: 'markdownBytes',
  csv: 'csvBytes',
  docx: 'docxBytes',
  pdf: 'pdfBytes',
};

export function documentKey(filePath: string): string {
  return `document:${filePath}`;
}

export class Indexer {
  readonly index = new WordIndex();
  private config: WorkerConfig | null = null;
  private readonly documents = new Map<string, DocumentState>();
  private readonly rules = new Map<string, RootRules>();
  private chats: ChatFeed | null = null;
  private taskSignatures = new Map<string, string>();
  private generation = 0;
  private reading = false;
  private limited = false;
  private failed = 0;
  private textChars = 0;
  private withText = 0;
  private readonly pending = new Map<string, { size: number; handle: unknown }>();
  private rewalkHandle: unknown = null;
  private lastStatusAt = 0;
  private statusHandle: unknown = null;
  private readonly startedAt: number;
  readonly timings: Record<string, number> = {};
  private chatRefresh: Promise<void> = Promise.resolve();

  constructor(private readonly deps: IndexerDependencies) {
    this.startedAt = deps.timers.now();
  }

  private get limits(): SearchLimits {
    return this.config!.limits;
  }

  /** Documents read (or settled as name only), kept as they change so a query needn't count them. */
  private settledCount = 0;

  /** Puts a document's state in place, keeping the settled count. */
  private place(filePath: string, state: DocumentState | null): void {
    const previous = this.documents.get(filePath);
    if (previous?.settled) this.settledCount--;
    if (state) this.documents.set(filePath, state);
    else this.documents.delete(filePath);
  }

  private progress(): { done: number; total: number } {
    return { done: this.settledCount, total: this.documents.size };
  }

  status(): IndexStatus {
    let tooLarge = 0;
    for (const state of this.documents.values()) if (this.nameOnlyOf(state.found) === 'too-large') tooLarge++;
    return {
      state: !this.config ? 'starting' : this.reading ? 'reading' : 'ready',
      documents: this.progress(),
      limited: this.limited,
      tooLarge,
      failed: this.failed,
      chats: this.chats?.size ?? 0,
      tasks: this.taskSignatures.size,
    };
  }

  private emitStatus(force = false): void {
    const now = this.deps.timers.now();
    if (!force && now - this.lastStatusAt < STATUS_MS) {
      this.statusHandle ??= this.deps.timers.setTimeout(() => {
        this.statusHandle = null;
        this.emitStatus(true);
      }, STATUS_MS);
      return;
    }
    this.lastStatusAt = now;
    this.deps.onStatus(this.status());
  }

  private mark(phase: string): void {
    this.timings[phase] = Math.round(this.deps.timers.now() - this.startedAt);
  }

  async start(config: WorkerConfig): Promise<void> {
    this.config = config;
    if (config.chats) this.chats = new ChatFeed(config.chats.dir, config.chats.scopeId, config.limits.textPerChat, this.deps.chatFs);
    await this.deps.cache.open();
    await this.refreshChats();
    this.mark('chats');
    await this.walk();
  }

  /** Walks every folder and reads what changed; a newer walk stops an older one. */
  async walk(): Promise<void> {
    const config = this.config!;
    const generation = ++this.generation;
    this.reading = true;
    this.emitStatus(true);
    const walkRules = { platform: config.platform, oneDriveRoots: config.oneDriveRoots, filesExclude: config.filesExclude };
    const rules = new Map<string, RootRules>();
    const result = await walkProject(config.roots, walkRules, this.deps.fs, this.limits.maxNames, this.deps.pause, rules);
    if (generation !== this.generation) return;
    this.rules.clear();
    for (const [root, rule] of rules) this.rules.set(root, rule);
    this.limited = result.limited;
    this.mark('walk');

    // Newest first: the limits are spent in this order.
    const found = result.documents.sort((a, b) => b.mtimeMs - a.mtimeMs);
    const live = new Set(found.map((doc) => doc.path));
    for (const path of [...this.documents.keys()]) {
      if (!live.has(path)) this.forget(path);
    }
    const dropped = await this.deps.cache.sweep(new Set(found.filter((doc) => doc.format === 'docx' || doc.format === 'pdf').map((doc) => doc.path)));
    for (const doc of found) {
      const known = this.documents.get(doc.path);
      if (known && known.settled && known.found.size === doc.size && known.found.mtimeMs === doc.mtimeMs && known.found.relativePath === doc.relativePath) {
        known.found = doc;
        continue;
      }
      if (known) this.dropText(known);
      this.place(doc.path, { found: doc, settled: false, chars: 0 });
      this.index.add(this.nameSource(doc, undefined));
    }
    this.mark('names');
    // The documents limit goes to the most recently changed, whatever their kind: Markdown and CSV are read
    // first because they are quick, not because they come first.
    let slots = this.limits.maxDocuments;
    for (const doc of found) {
      const state = this.documents.get(doc.path)!;
      if (state.settled) {
        if (state.chars > 0) slots--;
        continue;
      }
      if (this.nameOnlyOf(doc)) continue;
      state.overLimit = slots <= 0;
      if (!state.overLimit) slots--;
    }
    this.deps.log('walk', { documents: found.length, limited: result.limited ? 1 : 0, cacheSwept: dropped });
    this.emitStatus(true);

    const order = (formats: FoundDocument['format'][]) => found.filter((doc) => formats.includes(doc.format));
    for (const [phase, formats] of [
      ['text', ['markdown', 'csv']],
      ['office', ['docx', 'pdf']],
    ] as const) {
      const list = order([...formats]);
      // Markdown and CSV are read a few files ahead, so the disk works while the last file is parsed. Word and
      // PDF are not: most of them come from decision 3's copies, and a read ahead of a copy is wasted.
      const ahead = phase === 'text' ? READ_AHEAD : 0;
      const fetched = new Map<string, Promise<Uint8Array | null>>();
      for (let i = 0; i < list.length; i++) {
        if (generation !== this.generation) return;
        for (let j = i; j < Math.min(list.length, i + ahead); j++) {
          const next = list[j];
          const nextState = this.documents.get(next.path);
          if (!fetched.has(next.path) && nextState && !nextState.settled && !nextState.overLimit && !this.nameOnlyOf(next)) {
            fetched.set(next.path, this.deps.fs.readFile(next.path).catch(() => null));
          }
        }
        const doc = list[i];
        const bytes = fetched.get(doc.path);
        fetched.delete(doc.path);
        const state = this.documents.get(doc.path);
        if (!state || state.settled) continue;
        await this.readOne(state, bytes);
        // Decision 3's index is written as the copies come, so a worker stopped half way keeps what it read.
        if (phase === 'office' && i % FLUSH_EVERY === FLUSH_EVERY - 1) await this.deps.cache.flush();
        this.emitStatus();
        await this.deps.pause();
      }
      this.mark(phase);
    }
    if (generation !== this.generation) return;
    this.reading = false;
    await this.deps.cache.flush();
    this.mark('ready');
    this.deps.log('ready', {
      documents: this.documents.size,
      withText: this.withText,
      textChars: this.textChars,
      terms: this.index.terms,
      failed: this.failed,
      ms: this.timings.ready,
    });
    this.emitStatus(true);
  }

  private nameOnlyOf(doc: FoundDocument): NameOnlyReason | undefined {
    if (doc.cloud) return 'online-only';
    if (doc.size > (this.limits[BYTE_LIMIT[doc.format]] as number)) return 'too-large';
    return undefined;
  }

  private nameSource(doc: FoundDocument, nameOnly: NameOnlyReason | undefined, passages: IndexSource['passages'] = [], columns?: string[]): IndexSource {
    return {
      key: documentKey(doc.path),
      kind: 'document',
      name: doc.name,
      where: doc.where,
      changedAt: doc.mtimeMs,
      passages,
      path: doc.path,
      relativePath: doc.relativePath,
      format: doc.format,
      size: doc.size,
      ...(nameOnly ? { nameOnly } : {}),
      ...(columns ? { columns } : {}),
    };
  }

  private dropText(state: DocumentState): void {
    if (state.chars > 0) {
      this.textChars -= state.chars;
      this.withText--;
    }
    state.chars = 0;
  }

  private forget(filePath: string): void {
    const state = this.documents.get(filePath);
    if (!state) return;
    this.dropText(state);
    this.place(filePath, null);
    this.index.remove(documentKey(filePath));
  }

  /** Reads one document's text, or settles it as name only. */
  private async readOne(state: DocumentState, prefetched?: Promise<Uint8Array | null>): Promise<void> {
    const doc = state.found;
    const settle = (nameOnly: NameOnlyReason | undefined, passages: IndexSource['passages'] = [], columns?: string[]) => {
      // While this read waited, the file may have gone or changed again: a newer state wins.
      if (this.documents.get(doc.path) !== state) return;
      const chars = passages.reduce((sum, passage) => sum + passage.text.length, 0);
      this.dropText(state);
      state.chars = chars;
      if (chars > 0) {
        this.textChars += chars;
        this.withText++;
      }
      if (!state.settled) this.settledCount++;
      state.settled = true;
      this.index.add(this.nameSource(doc, nameOnly, passages, columns));
    };
    const reason = this.nameOnlyOf(doc);
    if (reason) return settle(reason);
    if (state.overLimit || this.withText >= this.limits.maxDocuments || this.textChars >= this.limits.textBudget) {
      this.limited = true;
      return settle('limited');
    }
    const budget = Math.min(this.limits.textPerDocument, this.limits.textBudget - this.textChars);
    const office = doc.format === 'docx' || doc.format === 'pdf';
    if (office) {
      const cached = await this.deps.cache.get(doc.path, doc.size, doc.mtimeMs);
      if (cached) {
        if (cached.kind === 'name-only') return settle(cached.reason);
        return settle(undefined, cached.passages);
      }
    }
    let outcome: ReadOutcome;
    try {
      const bytes = (prefetched ? await prefetched : null) ?? (await this.deps.fs.readFile(doc.path));
      outcome = await (this.deps.read ?? readDocument)(doc.format, bytes, budget, this.deps.pause);
    } catch {
      outcome = { ok: false, reason: 'unreadable' };
    }
    if (!outcome.ok) {
      if (outcome.reason === 'unreadable') this.failed++;
      const nameOnly: NameOnlyReason = outcome.reason;
      if (office) await this.deps.cache.put(doc.path, doc.size, doc.mtimeMs, { kind: 'name-only', reason: nameOnly });
      return settle(nameOnly);
    }
    if (outcome.truncated && budget < this.limits.textPerDocument) this.limited = true;
    if (office) {
      const value: CachedText = { kind: 'text', passages: outcome.passages, truncated: outcome.truncated };
      await this.deps.cache.put(doc.path, doc.size, doc.mtimeMs, value);
    }
    settle(undefined, outcome.passages, outcome.columns);
  }

  // ── The watcher's events (R4) ─────────────────────────────────────────────

  private rootOf(filePath: string): RootRules | null {
    let best: RootRules | null = null;
    for (const [root, rules] of this.rules) {
      const inside = filePath === root || filePath.startsWith(root.endsWith(nodePath.sep) ? root : root + nodePath.sep);
      if (inside && (!best || root.length > best.root.path.length)) best = rules;
    }
    return best;
  }

  onEvents(events: { kind: 'created' | 'changed' | 'deleted'; path: string }[]): void {
    if (!this.config) return;
    for (const event of events) {
      const root = this.rootOf(event.path);
      if (!root) continue;
      if (isRuleFile(event.path, root.root.path)) {
        this.scheduleRewalk();
        continue;
      }
      if (event.kind === 'deleted') {
        this.cancelPending(event.path);
        if (this.documents.has(event.path)) {
          this.forget(event.path);
          void this.deps.cache.delete(event.path);
        } else {
          // A folder: every document inside it goes.
          const prefix = event.path + nodePath.sep;
          let any = false;
          for (const path of [...this.documents.keys()]) {
            if (path.startsWith(prefix)) {
              this.forget(path);
              any = true;
            }
          }
          if (any) void this.deps.cache.deleteUnder(event.path);
        }
        this.emitStatus();
        continue;
      }
      this.look(event.path, -1, FIRST_LOOK_MS);
    }
  }

  private cancelPending(filePath: string): void {
    const pending = this.pending.get(filePath);
    if (pending) {
      this.deps.timers.clearTimeout(pending.handle);
      this.pending.delete(filePath);
    }
  }

  /** Looks at a changed path after `ms`; reads it when its size held since the last look. */
  private look(filePath: string, lastSize: number, ms: number): void {
    this.cancelPending(filePath);
    const handle = this.deps.timers.setTimeout(() => {
      void this.settleChange(filePath, lastSize);
    }, ms);
    this.pending.set(filePath, { size: lastSize, handle });
  }

  private async settleChange(filePath: string, lastSize: number): Promise<void> {
    this.pending.delete(filePath);
    let size: number;
    let isDirectory = false;
    try {
      const stat = await this.deps.fs.stat(filePath);
      size = stat.size;
      isDirectory = stat.isDirectory();
    } catch {
      // Gone between the event and the look.
      if (this.documents.has(filePath)) this.forget(filePath);
      return;
    }
    if (isDirectory) {
      // A folder moved in: its files came without events of their own.
      this.scheduleRewalk();
      return;
    }
    if (size !== lastSize) {
      this.look(filePath, size, SETTLE_MS);
      return;
    }
    const root = this.rootOf(filePath);
    if (!root) return;
    const doc = await classifyPath(filePath, root, this.deps.fs);
    if (!doc) {
      if (this.documents.has(filePath)) this.forget(filePath);
      return;
    }
    const known = this.documents.get(filePath);
    if (known?.settled && known.found.size === doc.size && known.found.mtimeMs === doc.mtimeMs) return;
    if (known) this.dropText(known);
    const state: DocumentState = { found: doc, settled: false, chars: 0 };
    this.place(filePath, state);
    this.index.add(this.nameSource(doc, undefined));
    await this.readOne(state);
    await this.deps.cache.flush();
    this.deps.log('fresh', { documents: 1 });
    this.emitStatus();
  }

  private scheduleRewalk(): void {
    if (this.rewalkHandle) this.deps.timers.clearTimeout(this.rewalkHandle);
    this.rewalkHandle = this.deps.timers.setTimeout(() => {
      this.rewalkHandle = null;
      void this.walk();
    }, REWALK_MS);
  }

  setFilesExclude(filesExclude: Record<string, string[]>): void {
    if (!this.config) return;
    this.config = { ...this.config, filesExclude };
    this.scheduleRewalk();
  }

  // ── Chats and tasks (R3) ──────────────────────────────────────────────────

  refreshChats(): Promise<void> {
    this.chatRefresh = this.chatRefresh.then(async () => {
      if (!this.chats) return;
      const { upserts, removed } = await this.chats.refresh();
      for (const key of removed) this.index.remove(key);
      for (const source of upserts) {
        this.index.add(source);
        await this.deps.pause();
      }
      if (upserts.length || removed.length) {
        this.deps.log('chats', { upserts: upserts.length, removed: removed.length });
        this.emitStatus();
      }
    }).catch(() => undefined);
    return this.chatRefresh;
  }

  setTasks(sources: IndexSource[]): void {
    const next = new Map<string, string>();
    for (const source of sources) {
      if (source.kind !== 'task') continue;
      const signature = JSON.stringify([source.name, source.where, source.changedAt, source.passages]);
      next.set(source.key, signature);
      if (this.taskSignatures.get(source.key) !== signature) this.index.add(source);
    }
    for (const key of this.taskSignatures.keys()) if (!next.has(key)) this.index.remove(key);
    this.taskSignatures = next;
    this.emitStatus();
  }

  // ── Questions ─────────────────────────────────────────────────────────────

  query(queryId: number, text: string, options: SearchOptions, perKind: number, expand?: SearchKind): SearchAnswer {
    const started = this.deps.timers.now();
    const outcome = this.index.query(text, { options, perKind, expand });
    return {
      queryId,
      layer: 'words',
      tooShort: outcome.tooShort,
      groups: outcome.groups,
      reading: this.reading ? this.progress() : null,
      limited: this.limited,
      tooLarge: outcome.tooLarge,
      tookMs: Math.round((this.deps.timers.now() - started) * 100) / 100,
    };
  }

  stats(heapUsedBytes: number): WorkerStats {
    return {
      documents: this.documents.size,
      withText: this.withText,
      terms: this.index.terms,
      textChars: this.textChars,
      heapUsedBytes,
      timings: { ...this.timings },
      cache: { entries: this.deps.cache.entries, bytes: this.deps.cache.bytes, hits: this.deps.cache.hits, misses: this.deps.cache.misses },
    };
  }

  /** For tests: the reader version the cache uses. */
  static readonly readerVersion = READER_VERSION;
}
