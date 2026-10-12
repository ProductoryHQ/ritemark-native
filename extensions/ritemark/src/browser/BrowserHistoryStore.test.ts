/**
 * Tests for the Browser Recent store and row text (Sprint 131, #195).
 *
 * `vscode` is stubbed before the units load: an EventEmitter, an in-memory
 * Memento, and a `workspace.fs.stat` / `FileSystemError` pair for the
 * deleted-file rule. Scenario ids refer to
 * docs/development/releases/v1.14.0/sprint-131-browser-recent/scenarios.md.
 */

import { strict as assert } from 'node:assert';
import Module from 'node:module';

class StubEventEmitter<T> {
  private listeners: ((e: T) => void)[] = [];
  event = (listener: (e: T) => void) => {
    this.listeners.push(listener);
    return { dispose: () => undefined };
  };
  fire(e: T): void {
    for (const l of this.listeners) l(e);
  }
  dispose(): void {
    this.listeners = [];
  }
}

class StubFileSystemError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

const statResults = new Map<string, 'ok' | 'FileNotFound' | 'NoPermissions'>();

const vscodeStub = {
  EventEmitter: StubEventEmitter,
  FileSystemError: StubFileSystemError,
  Uri: { parse: (value: string) => ({ toString: () => value }) },
  workspace: {
    fs: {
      stat: async (uri: { toString(): string }) => {
        const result = statResults.get(uri.toString()) ?? 'FileNotFound';
        if (result !== 'ok') throw new StubFileSystemError(result);
        return { type: 1 };
      },
    },
  },
};

const moduleAny = Module as unknown as {
  _load: (request: string, parent: unknown, isMain?: boolean) => unknown;
};
const originalLoad = moduleAny._load.bind(Module);
moduleAny._load = (request: string, parent: unknown, isMain?: boolean): unknown => {
  if (request === 'vscode') return vscodeStub;
  return originalLoad(request, parent, isMain);
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { BrowserHistoryStore } = require('./BrowserHistoryStore') as typeof import('./BrowserHistoryStore');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { describe, fileIsMissing } = require('./BrowserPanelProvider') as typeof import('./BrowserPanelProvider');

type Entry = { url: string; visitedAt: number; title?: string };

function memento(initial: Entry[] = []) {
  const data = new Map<string, unknown>([['ritemark.browser.recentUrls', initial]]);
  let writes = 0;
  return {
    get: <T>(key: string, fallback: T): T => (data.has(key) ? (data.get(key) as T) : fallback),
    update: async (key: string, value: unknown) => {
      writes++;
      data.set(key, value);
    },
    keys: () => [...data.keys()],
    writes: () => writes,
  };
}

async function runTests(): Promise<void> {
  // R4 / S19: an entry saved by v1.13.0 (no slash, no title) merges with the visit.
  {
    const state = memento([
      { url: 'https://ritemark.app', visitedAt: 1 },
      { url: 'file:///tmp/old.html', visitedAt: 0 },
    ]);
    const store = new BrowserHistoryStore(state as never);
    await store.record('https://ritemark.app/', 'Ritemark');
    assert.deepEqual(
      store.getAll().map((e) => [e.url, e.title]),
      [['https://ritemark.app/', 'Ritemark'], ['file:///tmp/old.html', undefined]]
    );
  }

  // R4 revised / S31: Back to page#section replaces the page's entry and keeps the new address.
  {
    const store = new BrowserHistoryStore(memento() as never);
    await store.record('http://localhost:8765/titled.html', 'Titled Fixture');
    await store.record('http://localhost:8765/page2.html', 'Second Page');
    await store.record('http://localhost:8765/titled.html#section');
    assert.deepEqual(store.getAll().map((e) => [e.url, e.title]), [
      ['http://localhost:8765/titled.html#section', 'Titled Fixture'],
      ['http://localhost:8765/page2.html', 'Second Page'],
    ]);
    await store.setTitle('http://localhost:8765/titled.html', 'Renamed');
    assert.equal(store.getAll()[0].title, 'Renamed');
  }

  // R5: a revisit without a title keeps the title the entry had.
  {
    const store = new BrowserHistoryStore(memento([{ url: 'https://a.example/', visitedAt: 1, title: 'A' }]) as never);
    await store.record('https://b.example/', 'B');
    await store.record('https://a.example/');
    assert.deepEqual(store.getAll().map((e) => [e.url, e.title]), [['https://a.example/', 'A'], ['https://b.example/', 'B']]);
  }

  // R4 / S20: still 25 at most, newest first.
  {
    const store = new BrowserHistoryStore(memento() as never);
    for (let i = 0; i < 26; i++) await store.record(`https://site${i}.example/`);
    const all = store.getAll();
    assert.equal(all.length, 25);
    assert.equal(all[0].url, 'https://site25.example/');
    assert.equal(all.some((e) => e.url === 'https://site0.example/'), false);
  }

  // R5: setTitle changes the title in place, without reordering, and skips unchanged titles.
  {
    const state = memento([
      { url: 'https://a.example/', visitedAt: 2 },
      { url: 'https://b.example/', visitedAt: 1 },
    ]);
    const store = new BrowserHistoryStore(state as never);
    let changes = 0;
    store.onDidChange(() => changes++);
    await store.setTitle('https://b.example/', 'B');
    await store.setTitle('https://b.example/', 'B');
    await store.setTitle('https://missing.example/', 'X');
    assert.deepEqual(store.getAll().map((e) => [e.url, e.title, e.visitedAt]), [
      ['https://a.example/', undefined, 2],
      ['https://b.example/', 'B', 1],
    ]);
    assert.equal(state.writes(), 1);
    assert.equal(changes, 1);
  }

  // R6 / S24, S25: only files reported as not found are removed, in one write.
  {
    statResults.clear();
    statResults.set('file:///tmp/kept.html', 'ok');
    statResults.set('file:///Volumes/share/locked.html', 'NoPermissions');
    const state = memento([
      { url: 'https://a.example/', visitedAt: 4 },
      { url: 'file:///tmp/gone.html', visitedAt: 3 },
      { url: 'file:///tmp/kept.html', visitedAt: 2 },
      { url: 'file:///Volumes/share/locked.html', visitedAt: 1 },
    ]);
    const store = new BrowserHistoryStore(state as never);
    await store.pruneMissingFiles(fileIsMissing);
    assert.deepEqual(store.getAll().map((e) => e.url), [
      'https://a.example/',
      'file:///tmp/kept.html',
      'file:///Volumes/share/locked.html',
    ]);
    assert.equal(state.writes(), 1);
    await store.pruneMissingFiles(fileIsMissing);
    assert.equal(state.writes(), 1, 'nothing missing → no write');
    await store.pruneMissingFiles(async () => {
      throw new Error('stat exploded');
    });
    assert.equal(store.getAll().length, 3, 'a failing check keeps every entry');
  }

  // R5: row text — title over address when there is one, today's text otherwise.
  assert.deepEqual(describe('https://github.com/ProductoryHQ/ritemark-native', 'ritemark-native'), {
    name: 'ritemark-native',
    description: 'github.com/ProductoryHQ/ritemark-native',
  });
  assert.deepEqual(describe('http://localhost:5173/', 'Dev app'), { name: 'Dev app', description: 'localhost:5173' });
  assert.deepEqual(describe('https://ritemark.app/'), { name: 'ritemark.app', description: '' });
  assert.deepEqual(describe('https://ritemark.app/docs'), { name: 'ritemark.app', description: '/docs' });
  assert.deepEqual(describe('http://localhost:8765/untitled.html'), { name: 'localhost:8765', description: '/untitled.html' });
  assert.deepEqual(describe('file:///tmp/ws/report.html', 'Q3 report'), { name: 'Q3 report', description: '/tmp/ws/report.html' });
  assert.deepEqual(describe('file:///tmp/ws/my%20notes.html'), { name: 'my notes.html', description: '/tmp/ws/my notes.html' });

  console.log('All browser history store tests passed.');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
