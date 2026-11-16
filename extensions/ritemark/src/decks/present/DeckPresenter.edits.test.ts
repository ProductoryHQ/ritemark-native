/**
 * An edit during a talk (Sprint 159, PR 6; Codex on #736): the wall changes only on a move, and the presenter view's
 * Now is the slide the wall shows, in the wall's look, so an edit to the current slide or to the look waits for the
 * move on the laptop too. The presenter view's next slide and row follow the edit at once, and the row still marks the
 * current slide at its place after the edit. Run: npx tsx src/decks/present/DeckPresenter.edits.test.ts
 */

// ── A vscode stub: the shell's commands, two displays, and panels whose pages load and record what they get ────────
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require('module') as {
  _resolveFilename: (request: string, parent: unknown, isMain: boolean) => string;
};

interface StubPanel {
  viewType: string;
  viewColumn: number;
  posted: Array<Record<string, unknown>>;
  disposed: boolean;
  webview: Record<string, unknown>;
  onDidDispose: (listener: () => void) => { dispose(): void };
  reveal: () => void;
  dispose: () => void;
  send: (message: unknown) => void;
}

const panels: StubPanel[] = [];
let changeListener: ((event: { document: unknown }) => void) | null = null;

class TabInputWebview {
  constructor(readonly viewType: string) {}
}

function makePanel(viewType: string): StubPanel {
  const receivers: Array<(message: unknown) => void> = [];
  const disposers: Array<() => void> = [];
  const panel: StubPanel = {
    viewType,
    viewColumn: 1,
    posted: [],
    disposed: false,
    webview: {
      html: '',
      cspSource: 'vscode-webview:',
      asWebviewUri: (uri: { fsPath: string }) => ({ toString: () => `webview:${uri.fsPath}` }),
      postMessage: async (message: Record<string, unknown>) => { panel.posted.push(message); return true; },
      onDidReceiveMessage: (listener: (message: unknown) => void) => { receivers.push(listener); return { dispose() {} }; },
    },
    onDidDispose: listener => { disposers.push(listener); return { dispose() {} }; },
    reveal: () => {},
    dispose: () => {
      if (panel.disposed) return;
      panel.disposed = true;
      for (const listener of disposers) listener();
    },
    send: message => { for (const listener of receivers) listener(message); },
  };
  return panel;
}

const vscodeMod = {
  window: {
    createWebviewPanel: (viewType: string) => {
      const panel = makePanel(viewType);
      panels.push(panel);
      // Its page loads a moment later and says so.
      setTimeout(() => panel.send({ type: 'present/ready' }), 0);
      return panel;
    },
    tabGroups: {
      get all() {
        return [{ tabs: panels.filter(panel => !panel.disposed).map(panel => ({ input: new TabInputWebview(`mainThreadWebview-${panel.viewType}`) })) }];
      },
    },
  },
  workspace: {
    onDidChangeTextDocument: (listener: (event: { document: unknown }) => void) => {
      changeListener = listener;
      return { dispose() { changeListener = null; } };
    },
    getWorkspaceFolder: () => undefined,
  },
  commands: {
    getCommands: async () => ['_ritemark.present.place', '_ritemark.present.displays'],
    executeCommand: async (command: string) => {
      if (command === '_ritemark.present.displays') {
        return [{ name: 'Built-in Retina Display', primary: true, internal: true }, { name: 'Projector', primary: false, internal: false }];
      }
      // The window moved and kept its page: no load to wait for.
      return 'moved';
    },
  },
  ViewColumn: { Active: -1 },
  TabInputWebview,
  Uri: {
    joinPath: (base: { fsPath: string }, ...parts: string[]) => ({ fsPath: [base.fsPath, ...parts].join('/') }),
    file: (fsPath: string) => ({ fsPath }),
  },
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
const { DeckPresenter } = require('./DeckPresenter') as typeof import('./DeckPresenter');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DECK_PRESENTER_VIEW_TYPE, DECK_WALL_VIEW_TYPE } = require('./presentProtocol') as typeof import('./presentProtocol');

function slide(id: string, title: string): string {
  return `\`\`\`slide title\nid: ${id}\ntitle: ${title}\n\`\`\`\n\n`;
}

const BEFORE = `---\ndeck: 1\n---\n\n${slide('a1', 'One')}${slide('a2', 'Two')}${slide('a3', 'Three')}`;
// During the talk: the look turns Borderless, a slide goes in before the current one, and the current one is retitled.
const AFTER = `---\ndeck: 1\nlook: borderless\n---\n\n${slide('a0', 'Zero')}${slide('a1', 'One')}${slide('a2', 'Two, retitled')}${slide('a3', 'Three')}`;

const settle = (ms = 20) => new Promise(resolve => setTimeout(resolve, ms));

function last(panel: StubPanel, type: string): Record<string, unknown> {
  const found = [...panel.posted].reverse().find(message => message.type === type);
  assert.ok(found, `${panel.viewType} got a ${type}`);
  return found;
}

const titles = (slides: unknown) => (slides as Array<{ title: string }>).map(entry => entry.title);

async function main(): Promise<void> {
  const before = { dev: process.env.VSCODE_DEV, windowed: process.env.RITEMARK_PRESENT_WINDOWED };
  delete process.env.VSCODE_DEV;
  delete process.env.RITEMARK_PRESENT_WINDOWED;
  try {
    const memory = new Map<string, unknown>();
    const state = { get: (key: string, fallback?: unknown) => (memory.has(key) ? memory.get(key) : fallback), update: async (key: string, value: unknown) => { memory.set(key, value); }, keys: () => [...memory.keys()] };
    const presenter = new DeckPresenter({ fsPath: '/extension' } as never, state as never);
    const document = { text: BEFORE, version: 1, getText: () => document.text, uri: { fsPath: '/talks/talk.deck.md', scheme: 'file' } };
    const originPosted: unknown[] = [];
    const origin = {
      document,
      panel: { viewColumn: 1, webview: { postMessage: async (message: unknown) => { originPosted.push(message); return true; } }, onDidDispose: () => ({ dispose() {} }) },
    };

    // Present from the second slide: the wall on the projector, the presenter view on the laptop.
    await presenter.start(origin as never, { type: 'deck/present', from: 'here', index: 1 } as never);
    await settle();
    const wall = panels.find(panel => panel.viewType === DECK_WALL_VIEW_TYPE);
    const laptop = panels.find(panel => panel.viewType === DECK_PRESENTER_VIEW_TYPE);
    assert.ok(wall && laptop, 'both windows open');
    assert.equal((last(wall, 'present/wall').slide as { title: string }).title, 'Two');
    assert.equal((last(laptop, 'present/presenter').current as { title: string }).title, 'Two');

    // The edit, typed during the talk.
    const wallStates = wall.posted.filter(message => message.type === 'present/wall').length;
    document.text = AFTER;
    document.version = 2;
    assert.ok(changeListener, 'the presenter listens for edits');
    changeListener({ document });
    await settle(400);
    assert.equal(wall.posted.filter(message => message.type === 'present/wall').length, wallStates, 'the wall waits for the move');
    const onWall = last(wall, 'present/wall');
    const edited = last(laptop, 'present/presenter');
    const now = edited.current as { title: string; number: number; data: { title?: string } };
    // Now is the room's slide, in the room's look.
    assert.equal(now.title, 'Two', "Now is the wall's slide, not the edited one");
    assert.deepEqual(now.data, (onWall.slide as { data: unknown }).data);
    assert.equal(edited.borderless, onWall.borderless, "Now is drawn in the wall's look");
    assert.equal(edited.borderless, false);
    // The next slide and the row follow the edit; the row marks the current slide at its new place.
    assert.deepEqual(titles(edited.slides), ['Zero', 'One', 'Two, retitled', 'Three']);
    assert.equal((edited.next as { title: string }).title, 'Three');
    assert.equal(now.number, 3, 'the row marks the current slide where it is now');

    // The next move takes the edit to the wall, and Now with it.
    laptop.send({ type: 'present/back' });
    await settle();
    laptop.send({ type: 'present/next' });
    await settle();
    const moved = last(wall, 'present/wall');
    assert.equal((moved.slide as { title: string }).title, 'Two, retitled');
    assert.equal(moved.borderless, true);
    const followed = last(laptop, 'present/presenter');
    assert.equal((followed.current as { title: string }).title, 'Two, retitled');
    assert.equal(followed.borderless, true);

    // The wall drawn again without a move (its page loaded again, as after Swap displays) shows the deck as it is now:
    // Now follows what it shows.
    document.text = AFTER.replace('title: Two, retitled', 'title: Two, once more');
    document.version = 3;
    changeListener({ document });
    await settle(400);
    assert.equal((last(laptop, 'present/presenter').current as { title: string }).title, 'Two, retitled', 'Now waits for the wall');
    wall.send({ type: 'present/ready' });
    await settle();
    assert.equal((last(wall, 'present/wall').slide as { title: string }).title, 'Two, once more');
    assert.equal((last(laptop, 'present/presenter').current as { title: string }).title, 'Two, once more', 'Now follows the wall');

    // Turned off and on again from the wall's bar: one presenter view again, its Now the wall's slide.
    wall.send({ type: 'present/presenter' });
    await settle();
    wall.send({ type: 'present/presenter' });
    await settle(50);
    const reopened = panels.filter(panel => panel.viewType === DECK_PRESENTER_VIEW_TYPE && !panel.disposed);
    assert.equal(reopened.length, 1, 'one presenter view again');
    assert.equal((last(reopened[0], 'present/presenter').current as { title: string }).title, (last(wall, 'present/wall').slide as { title: string }).title);

    presenter.dispose();
    await settle();
    assert.ok(panels.every(panel => panel.disposed), 'Stop closes both');
  } finally {
    if (before.dev === undefined) delete process.env.VSCODE_DEV;
    else process.env.VSCODE_DEV = before.dev;
    if (before.windowed === undefined) delete process.env.RITEMARK_PRESENT_WINDOWED;
    else process.env.RITEMARK_PRESENT_WINDOWED = before.windowed;
  }
  console.log('DeckPresenter (edits during a talk): all tests passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
