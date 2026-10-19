/**
 * Tests for the Browser Recent store and row text (Sprint 131, #195), and the page's Recent label, its two
 * actions and its list (Sprint 134 R18).
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
const executedCommands: string[] = [];

const vscodeStub = {
  commands: {
    executeCommand: async (command: string) => {
      executedCommands.push(command);
    },
  },
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
const { describe, fileIsMissing, recentHeaderHtml, BrowserPanelProvider, RECENT_ACTIONS, RECENT_LIST_SCRIPT } =
  require('./BrowserPanelProvider') as typeof import('./BrowserPanelProvider');

/** The page script's list, evaluated from the same text the page runs. */
const page = new Function(`${RECENT_LIST_SCRIPT}\nreturn { renderList };`)() as {
  renderList(items: Array<{ url: string; name: string; description: string; visitedAt: number }>): string;
};

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

  // Sprint 134 R18: the Recent label in the column's 11-caps style, with New browser tab (+) and Clear history at
  // its right, each an icon button with an accessible name and a tooltip that says what it does.
  {
    const header = recentHeaderHtml();
    assert.ok(header.includes('<span class="group-label" role="heading" aria-level="2">Recent</span>'), header);
    const buttons = header.match(/<button [^>]*>/g) ?? [];
    assert.deepEqual(buttons, [
      '<button type="button" class="group-btn" data-message="newTab" aria-label="New browser tab" data-tooltip="Open a new browser tab">',
      '<button type="button" class="group-btn" data-message="clearAll" aria-label="Clear history" data-tooltip="Clear the list of recent pages">',
    ]);
    assert.ok(header.indexOf('group-label') < header.indexOf('group-actions'), 'the buttons sit at the label\'s right');
    assert.equal((header.match(/<svg /g) ?? []).length, 2, 'each button is an icon');
    assert.deepEqual(
      RECENT_ACTIONS.map((action) => action.command),
      ['ritemark.browser.newTab', 'ritemark.browser.history.clearAll'],
      'they run the two commands the title row ran'
    );
  }

  // R18: with no pages, plain words; the line under them stays.
  {
    const empty = page.renderList([]);
    assert.equal(
      empty,
      '<div class="empty"><div class="empty-title">No pages yet</div>Pages you visit in Ritemark Browser appear here.</div>'
    );
    assert.ok(!empty.includes('No recent URLs'));
  }

  // R18 / Sprint 131: a page's title, address and description are shown as text, never as markup.
  {
    const rows = page.renderList([
      {
        url: 'https://evil.example/?q="><img src=x onerror=alert(1)>',
        name: '<img src=x onerror=alert(1)><b>Quarterly</b> & \'notes\'',
        description: 'evil.example/<script>alert(1)</script>',
        visitedAt: 1,
      },
    ]);
    assert.ok(!/<img|<b>|<script/.test(rows), rows);
    assert.ok(
      rows.includes('<div class="item-name">&lt;img src=x onerror=alert(1)&gt;&lt;b&gt;Quarterly&lt;/b&gt; &amp; &#39;notes&#39;</div>'),
      rows
    );
    assert.ok(rows.includes('data-url="https://evil.example/?q=&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"'), rows);
    assert.ok(rows.includes('<div class="item-description">evil.example/&lt;script&gt;alert(1)&lt;/script&gt;</div>'), rows);
    assert.ok(rows.includes('aria-label="Remove from history"'), 'each page keeps its remove button');
  }

  // R18: the page draws the label over the list, and its two buttons run their commands; opening and
  // removing a page work as before.
  {
    const store = new BrowserHistoryStore(memento([{ url: 'https://ritemark.app/', visitedAt: 1, title: 'Ritemark' }]) as never);
    const provider = new BrowserPanelProvider(store, { toString: () => 'ext' } as never);
    let receive: (msg: unknown) => void = () => undefined;
    const posted: unknown[] = [];
    const view = {
      visible: true,
      onDidChangeVisibility: () => ({ dispose: () => undefined }),
      webview: {
        options: {},
        html: '',
        cspSource: 'vscode-resource:',
        onDidReceiveMessage: (handler: (msg: unknown) => void) => {
          receive = handler;
          return { dispose: () => undefined };
        },
        postMessage: async (msg: unknown) => {
          posted.push(msg);
          return true;
        },
      },
    };
    provider.resolveWebviewView(view as never, {} as never, {} as never);
    const html = view.webview.html;
    assert.ok(html.indexOf(recentHeaderHtml()) > 0 && html.indexOf(recentHeaderHtml()) < html.indexOf('<div id="content">'));
    assert.ok(html.includes(RECENT_LIST_SCRIPT), 'the page runs the tested list');
    assert.ok(!html.includes('No recent URLs'));

    executedCommands.length = 0;
    receive({ type: 'newTab' });
    receive({ type: 'clearAll' });
    receive({ type: 'somethingElse' });
    assert.deepEqual(executedCommands, ['ritemark.browser.newTab', 'ritemark.browser.history.clearAll']);

    executedCommands.length = 0;
    receive({ type: 'open', url: 'https://ritemark.app/' });
    assert.deepEqual(executedCommands, ['ritemark.browser.history.open']);
    receive({ type: 'ready' });
    assert.deepEqual(posted[0], {
      type: 'items',
      items: [{ url: 'https://ritemark.app/', name: 'Ritemark', description: 'ritemark.app', visitedAt: 1 }],
    });
    receive({ type: 'remove', url: 'https://ritemark.app/' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepEqual(store.getAll(), []);
    provider.dispose();
  }

  console.log('All browser history store tests passed.');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
