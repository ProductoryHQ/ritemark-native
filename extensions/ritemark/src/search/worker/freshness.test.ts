/**
 * Sprint 148 (R1–R4): the worker's index over time, with a fake clock and an
 * in-memory folder: the cold start, a saved change within 2 s, a file still
 * being written, removals, a changed .gitignore, the limits, decision 3's copies
 * across a restart, chats and tasks.
 * Run: npx tsx src/search/worker/freshness.test.ts
 */
import assert from 'node:assert/strict';
import { promises as fsp } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DEFAULT_SEARCH_LIMITS, DEFAULT_SEARCH_OPTIONS, type IndexStatus, type SearchLimits, type WorkerConfig } from '../protocol';
import type { ChatFs } from '../sources/chats';
import { FIRST_LOOK_MS, Indexer, SETTLE_MS, type IndexerFs, type Timers } from './indexer';
import { TextCache } from './textCache';

// ── An in-memory folder ──────────────────────────────────────────────────────
class MemoryFs implements IndexerFs {
  readonly files = new Map<string, { data: Uint8Array; mtimeMs: number }>();
  reads: string[] = [];
  private tick = 1;

  write(target: string, text: string): void {
    this.files.set(target, { data: new TextEncoder().encode(text), mtimeMs: this.tick++ });
  }

  remove(prefix: string): void {
    for (const key of [...this.files.keys()]) if (key === prefix || key.startsWith(`${prefix}/`)) this.files.delete(key);
  }

  private isDir(target: string): boolean {
    for (const key of this.files.keys()) if (key.startsWith(`${target}/`)) return true;
    return false;
  }

  async readdir(dir: string) {
    const names = new Map<string, boolean>();
    for (const key of this.files.keys()) {
      if (!key.startsWith(`${dir}/`)) continue;
      const rest = key.slice(dir.length + 1);
      const name = rest.split('/')[0];
      names.set(name, rest.includes('/'));
    }
    if (names.size === 0 && !this.isDir(dir)) throw new Error('ENOENT');
    return [...names].map(([name, isDir]) => ({ name, isDirectory: () => isDir, isFile: () => !isDir, isSymbolicLink: () => false }));
  }

  async stat(target: string) {
    const file = this.files.get(target);
    if (file) return { size: file.data.length, mtimeMs: file.mtimeMs, blocks: 8, isFile: () => true, isDirectory: () => false };
    if (this.isDir(target)) return { size: 0, mtimeMs: 0, blocks: 0, isFile: () => false, isDirectory: () => true };
    throw new Error('ENOENT');
  }

  async readHead(target: string, maxBytes: number) {
    const file = this.files.get(target);
    if (!file) throw new Error('ENOENT');
    return file.data.subarray(0, maxBytes);
  }

  async readFile(target: string) {
    const file = this.files.get(target);
    if (!file) throw new Error('ENOENT');
    this.reads.push(target);
    return file.data.slice();
  }
}

// ── A fake clock ─────────────────────────────────────────────────────────────
class Clock implements Timers {
  time = 0;
  private next = 1;
  private readonly tasks = new Map<number, { at: number; run: () => void }>();

  setTimeout(run: () => void, ms: number): unknown {
    const id = this.next++;
    this.tasks.set(id, { at: this.time + ms, run });
    return id;
  }

  clearTimeout(handle: unknown): void {
    this.tasks.delete(handle as number);
  }

  now(): number {
    return this.time;
  }

  async advance(ms: number): Promise<void> {
    const target = this.time + ms;
    for (;;) {
      await settle();
      const due = [...this.tasks.entries()].filter(([, task]) => task.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      this.tasks.delete(due[0]);
      this.time = due[1].at;
      due[1].run();
    }
    this.time = target;
    await settle();
  }
}

async function settle(): Promise<void> {
  for (let i = 0; i < 50; i++) await new Promise<void>((resolve) => setImmediate(resolve));
}

const ROOT = '/p';

function makeIndexer(fs: MemoryFs, clock: Clock, options: { limits?: Partial<SearchLimits>; cacheDir?: string | null; chatFs?: ChatFs; read?: ConstructorParameters<typeof Indexer>[0]['read'] } = {}) {
  const statuses: IndexStatus[] = [];
  const indexer = new Indexer({
    fs,
    cache: new TextCache(options.cacheDir ?? null, 10 * 1024 * 1024),
    chatFs: options.chatFs,
    timers: clock,
    pause: () => Promise.resolve(),
    onStatus: (status) => statuses.push(status),
    log: () => undefined,
    read: options.read,
  });
  const config: WorkerConfig = {
    roots: [{ path: ROOT, name: 'p' }],
    filesExclude: {},
    platform: 'linux',
    oneDriveRoots: [],
    cacheDir: options.cacheDir ?? null,
    cacheBytes: 10 * 1024 * 1024,
    chats: options.chatFs ? { dir: '/store', scopeId: 'ps1-scope' } : null,
    limits: { ...DEFAULT_SEARCH_LIMITS, ...options.limits },
  };
  return { indexer, statuses, config };
}

function found(indexer: Indexer, text: string, kind = 'document'): string[] {
  return indexer.query(1, text, DEFAULT_SEARCH_OPTIONS, 50).groups.find((group) => group.kind === kind)?.results.map((result) => result.name) ?? [];
}

async function main() {
  // ── The cold start, then a saved change within 2 s (R4) ────────────────────
  {
    const fs = new MemoryFs();
    fs.write(`${ROOT}/Alpha.md`, '# Alpha\n\nThe first words.');
    fs.write(`${ROOT}/Budget.csv`, 'Item,Cost\nHarbour fees,120\n');
    fs.write(`${ROOT}/sub/Gamma.md`, 'Gamma words.');
    fs.write(`${ROOT}/.gitignore`, 'ignored/\n');
    fs.write(`${ROOT}/ignored/Hidden.md`, 'hidden words');
    const clock = new Clock();
    const { indexer, statuses, config } = makeIndexer(fs, clock);
    await indexer.start(config);
    assert.equal(indexer.status().state, 'ready');
    assert.deepEqual(indexer.status().documents, { done: 3, total: 3 });
    assert.ok(statuses.some((status) => status.state === 'reading'), 'it said it was reading');
    assert.deepEqual(found(indexer, 'first'), ['Alpha']);
    assert.deepEqual(found(indexer, 'harbour fees'), ['Budget']);
    assert.deepEqual(found(indexer, 'hidden'), [], '.gitignore');

    // A save: the host's batch, one look, one more once the size held.
    const savedAt = clock.now();
    fs.write(`${ROOT}/Alpha.md`, '# Alpha\n\nThe omega words now.');
    indexer.onEvents([{ kind: 'changed', path: `${ROOT}/Alpha.md` }]);
    await clock.advance(FIRST_LOOK_MS);
    assert.deepEqual(found(indexer, 'omega'), [], 'not before its size held');
    await clock.advance(SETTLE_MS);
    assert.deepEqual(found(indexer, 'omega'), ['Alpha']);
    assert.deepEqual(found(indexer, 'first'), []);
    const took = clock.now() - savedAt + 300; // + the host's batch (EVENT_BATCH_MS)
    assert.ok(took <= 2000, `fresh within 2 s (${took} ms)`);

    // A file still being written is read once its size holds.
    indexer.onEvents([{ kind: 'created', path: `${ROOT}/Growing.md` }]);
    fs.write(`${ROOT}/Growing.md`, 'part');
    await clock.advance(FIRST_LOOK_MS);
    fs.write(`${ROOT}/Growing.md`, 'part one and part two');
    await clock.advance(SETTLE_MS);
    assert.deepEqual(found(indexer, 'two'), [], 'still growing');
    await clock.advance(SETTLE_MS);
    assert.deepEqual(found(indexer, 'two'), ['Growing']);

    // A removed file goes at once; a removed folder takes its documents.
    fs.remove(`${ROOT}/Budget.csv`);
    indexer.onEvents([{ kind: 'deleted', path: `${ROOT}/Budget.csv` }]);
    assert.deepEqual(found(indexer, 'harbour'), []);
    fs.remove(`${ROOT}/sub`);
    indexer.onEvents([{ kind: 'deleted', path: `${ROOT}/sub` }]);
    assert.deepEqual(found(indexer, 'gamma'), []);

    // A rename is a delete and a create.
    fs.write(`${ROOT}/Renamed.md`, 'The omega words now.');
    fs.remove(`${ROOT}/Alpha.md`);
    indexer.onEvents([{ kind: 'deleted', path: `${ROOT}/Alpha.md` }, { kind: 'created', path: `${ROOT}/Renamed.md` }]);
    await clock.advance(FIRST_LOOK_MS + SETTLE_MS);
    assert.deepEqual(found(indexer, 'omega'), ['Renamed']);

    // A changed .gitignore walks again.
    fs.write(`${ROOT}/.gitignore`, '# nothing ignored now\n');
    indexer.onEvents([{ kind: 'changed', path: `${ROOT}/.gitignore` }]);
    await clock.advance(1000);
    assert.deepEqual(found(indexer, 'hidden'), ['Hidden']);

    // Events for what search leaves out change nothing.
    fs.write(`${ROOT}/.ritemark/tasks/1-card.md`, 'card words');
    indexer.onEvents([{ kind: 'created', path: `${ROOT}/.ritemark/tasks/1-card.md` }, { kind: 'created', path: '/elsewhere/x.md' }]);
    await clock.advance(2000);
    assert.deepEqual(found(indexer, 'card'), []);
  }

  // ── The limits: the newest first, the rest by name (R1) ────────────────────
  {
    const fs = new MemoryFs();
    fs.write(`${ROOT}/Old.md`, 'shared words');
    fs.write(`${ROOT}/New.md`, 'shared words');
    fs.write(`${ROOT}/Huge.md`, 'x'.repeat(2000));
    const clock = new Clock();
    const { indexer, config } = makeIndexer(fs, clock, { limits: { maxDocuments: 1, markdownBytes: 1000 } });
    await indexer.start(config);
    assert.deepEqual(found(indexer, 'shared'), ['New'], 'the most recently changed is read inside');
    assert.deepEqual(found(indexer, 'old'), ['Old'], 'the rest by name');
    assert.equal(indexer.status().limited, true);
    const huge = indexer.query(1, 'huge', DEFAULT_SEARCH_OPTIONS, 5).groups[0].results[0];
    assert.equal(huge.nameOnly, 'too-large');
    assert.equal(indexer.status().tooLarge, 1);
  }
  {
    // The limit goes to the newest of every kind: a newer PDF before an older Markdown file, though Markdown is read first.
    const fs = new MemoryFs();
    fs.write(`${ROOT}/Older.md`, 'shared words');
    fs.write(`${ROOT}/Newer.pdf`, '%PDF');
    const read = async (format: string) => ({ ok: true, passages: [{ text: format === 'pdf' ? 'shared pdf words' : 'shared words', at: {} }], truncated: false }) as const;
    const { indexer, config } = makeIndexer(fs, new Clock(), { limits: { maxDocuments: 1 }, read });
    await indexer.start(config);
    assert.deepEqual(found(indexer, 'shared'), ['Newer']);
    assert.equal(indexer.query(1, 'older', DEFAULT_SEARCH_OPTIONS, 5).groups[0].results[0].nameOnly, 'limited');
  }

  // ── Decision 3: Word and PDF text from the copies after a restart ──────────
  {
    const cacheDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'search-fresh-'));
    try {
      const fs = new MemoryFs();
      fs.write(`${ROOT}/Deck.pdf`, '%PDF-fake');
      fs.write(`${ROOT}/Letter.docx`, 'PK-fake');
      fs.write(`${ROOT}/Notes.md`, 'markdown words');
      let reads = 0;
      const read = async (format: string) => {
        reads++;
        if (format === 'docx') return { ok: false, reason: 'protected' } as const;
        const words = format === 'pdf' ? 'quarterly figures' : 'markdown words';
        return { ok: true, passages: [{ text: words, at: { page: 1 } }], truncated: false } as const;
      };
      const first = makeIndexer(fs, new Clock(), { cacheDir, read });
      await first.indexer.start(first.config);
      assert.equal(reads, 3);
      assert.deepEqual(found(first.indexer, 'quarterly'), ['Deck']);
      const second = makeIndexer(fs, new Clock(), { cacheDir, read });
      await second.indexer.start(second.config);
      assert.equal(reads, 4, 'only the Markdown is read again');
      assert.deepEqual(found(second.indexer, 'quarterly'), ['Deck']);
      assert.equal(second.indexer.query(1, 'letter', DEFAULT_SEARCH_OPTIONS, 5).groups[0].results[0].nameOnly, 'protected');
      // A PDF removed while Ritemark was closed: its copy goes at the next start.
      fs.remove(`${ROOT}/Deck.pdf`);
      const third = makeIndexer(fs, new Clock(), { cacheDir, read });
      await third.indexer.start(third.config);
      const left = (await fsp.readdir(cacheDir)).filter((name) => name !== 'index.json');
      assert.equal(left.length, 1, 'only the Word file\'s copy stays');
    } finally {
      await fsp.rm(cacheDir, { recursive: true, force: true });
    }
  }

  // ── Chats and tasks (R3) ────────────────────────────────────────────────────
  {
    const files = new Map<string, string>();
    const chatFs: ChatFs = {
      readFile: async (target) => {
        const value = files.get(target);
        if (value === undefined) throw new Error('ENOENT');
        return value;
      },
      exists: async (target) => files.has(target),
    };
    const id = '11111111-2222-4333-8444-555555555555';
    const record = (title: string, revision: number) =>
      JSON.stringify({
        conversationId: id,
        title,
        lastActivityAt: '2026-11-01T10:00:00.000Z',
        revision,
        events: [
          { kind: 'user-message', eventId: 'e1', text: 'What does the lighthouse cost?' },
          { kind: 'assistant-message', eventId: 'e2', runtimeId: 'claude-code', content: 'About 4000 euros a year.' },
        ],
      });
    files.set('/store/index.json', JSON.stringify({ entries: [{ conversationId: id, scopeId: 'ps1-scope', revision: 1, integrity: 'verified' }] }));
    files.set(`/store/records/${id}.json`, record('Lighthouse costs', 1));
    const fs = new MemoryFs();
    fs.write(`${ROOT}/Notes.md`, 'words');
    const { indexer, config } = makeIndexer(fs, new Clock(), { chatFs });
    await indexer.start(config);
    assert.deepEqual(found(indexer, 'euros', 'chat'), ['Lighthouse costs']);
    assert.equal(indexer.status().chats, 1);
    // The chat changes, then is deleted.
    files.set('/store/index.json', JSON.stringify({ entries: [{ conversationId: id, scopeId: 'ps1-scope', revision: 2, integrity: 'verified' }] }));
    files.set(`/store/records/${id}.json`, record('Lighthouse budget', 2));
    await indexer.refreshChats();
    assert.deepEqual(found(indexer, 'lighthouse', 'chat'), ['Lighthouse budget']);
    files.set('/store/index.json', JSON.stringify({ entries: [] }));
    await indexer.refreshChats();
    assert.deepEqual(found(indexer, 'lighthouse', 'chat'), []);

    indexer.setTasks([{ key: 'task:c1', kind: 'task', name: 'Paint the lighthouse', where: 'Doing', changedAt: 1, passages: [] }]);
    assert.deepEqual(found(indexer, 'paint', 'task'), ['Paint the lighthouse']);
    indexer.setTasks([]);
    assert.deepEqual(found(indexer, 'paint', 'task'), [], 'a snapshot replaces the set');
  }

  console.log('freshness.test.ts: all passed');
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
