/**
 * Present where this Ritemark can't place the wall (Sprint 159, PRs 5 and 6; the Experience lead, 16 November): a shell
 * without the placement commands, outside a dev build. Pressing Present, ⌘↩ or ⇧⌘↩ is answered with a notice in the
 * deck's bar, words only, and nothing opens: no panel, no window command. The menu's options carry no reason to
 * disable Present. Run: npx tsx src/decks/present/DeckPresenter.test.ts
 */

// ── A vscode stub that records what the presenter asks of it ────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require('module') as {
  _resolveFilename: (request: string, parent: unknown, isMain: boolean) => string;
};
const asked: string[] = [];
const vscodeMod = {
  window: {
    createWebviewPanel: () => {
      asked.push('createWebviewPanel');
      throw new Error('the wall must not open');
    },
  },
  commands: {
    // An older shell: VS Code's commands, none of the shell's `_ritemark.present.*`.
    getCommands: async () => ['workbench.action.moveEditorToNewWindow', 'workbench.action.toggleFullScreen'],
    executeCommand: async (command: string) => {
      asked.push(`executeCommand ${command}`);
    },
  },
  ViewColumn: { Active: -1 },
  Uri: { joinPath: () => ({ fsPath: '' }), file: (fsPath: string) => ({ fsPath }) },
};
const originalResolve = Module._resolveFilename.bind(Module);
Module._resolveFilename = function (request: string, ...rest: [unknown, boolean]) {
  if (request === 'vscode') return '__vscode_stub__';
  return originalResolve(request, ...rest);
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(require as any).cache['__vscode_stub__'] = {
  id: '__vscode_stub__', filename: '__vscode_stub__', loaded: true, children: [], paths: [], exports: vscodeMod,
};

import * as assert from 'assert';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DeckPresenter, presentFallbackAllowed } = require('./DeckPresenter') as typeof import('./DeckPresenter');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PRESENT_NEEDS_UPDATE } = require('./presentProtocol') as typeof import('./presentProtocol');

const DECK = '---\ndeck: 1\n---\n\n```slide title\nid: a1\ntitle: One\n```\n\n```slide title\nid: a2\ntitle: Two\n```\n';

function origin(text: string) {
  const posted: unknown[] = [];
  const panel = {
    webview: { postMessage: async (message: unknown) => { posted.push(message); return true; } },
    onDidDispose: () => ({ dispose() {} }),
  };
  const document = { getText: () => text, uri: { fsPath: '/deck.deck.md', scheme: 'file' } };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { posted, value: { document, panel } as any };
}

async function main(): Promise<void> {
  // The lead's words, exactly.
  assert.equal(PRESENT_NEEDS_UPDATE, 'Presenting needs a newer Ritemark. Update it, then present again.');

  // Only a dev build places the wall with VS Code's own window commands.
  assert.equal(presentFallbackAllowed({}), false);
  assert.equal(presentFallbackAllowed({ VSCODE_DEV: '1' }), true);

  const devBefore = process.env.VSCODE_DEV;
  delete process.env.VSCODE_DEV;
  try {
    const memory = new Map<string, unknown>();
    const state = { get: (key: string, fallback?: unknown) => (memory.has(key) ? memory.get(key) : fallback), update: async (key: string, value: unknown) => { memory.set(key, value); }, keys: () => [...memory.keys()] };
    const presenter = new DeckPresenter({ fsPath: '/extension' } as never, state as never);
    // The menu: no reason to disable Present, and no presenter view without the shell.
    const options = await presenter.options();
    assert.deepEqual(Object.keys(options).sort(), ['available', 'on', 'type', 'wallDisplay']);
    assert.equal(options.available, false);
    // Present and ⌘↩ (from this slide), ⇧⌘↩ (from the start), and a deck whose every slide is skipped: each is
    // answered with the notice, and nothing is opened or moved.
    const cases: Array<{ text: string; request: { from: 'here'; index: number } | { from: 'start' } }> = [
      { text: DECK, request: { from: 'here', index: 1 } },
      { text: DECK, request: { from: 'start' } },
      { text: DECK.replace(/title: (One|Two)/g, 'title: $1\nskip: true'), request: { from: 'start' } },
    ];
    for (const { text, request } of cases) {
      const { posted, value } = origin(text);
      await presenter.start(value, request as never);
      assert.deepEqual(posted, [{ type: 'deck/present-failed', message: PRESENT_NEEDS_UPDATE }], 'a notice with the words only');
    }
    assert.deepEqual(asked, [], 'no wall panel and no window command');
    presenter.dispose();
  } finally {
    if (devBefore === undefined) delete process.env.VSCODE_DEV;
    else process.env.VSCODE_DEV = devBefore;
  }
  console.log('DeckPresenter: all tests passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
