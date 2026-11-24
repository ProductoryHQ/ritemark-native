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

    // Small details, item 1 (17 November): B, "." or W blanks the wall, and the presenter view says so; the slide
    // comes back with the webview's next key (`to` null), and a move from a button or the row brings it back too.
    const presenterView = reopened[0];
    const onWallNow = (last(wall, 'present/wall').slide as { title: string }).title;
    // An edit to the slide on the wall, made during the talk: blanking is not a move, so it still waits.
    document.text = document.text.replace(`title: ${onWallNow}\n`, `title: ${onWallNow}, edited\n`);
    document.version = 4;
    changeListener({ document });
    await settle(400);
    assert.ok(titles(last(presenterView, 'present/presenter').slides).includes(`${onWallNow}, edited`), 'the row has the edit');
    presenterView.send({ type: 'present/blank', to: 'white' });
    await settle();
    assert.equal(last(wall, 'present/wall').blank, 'white');
    assert.equal((last(wall, 'present/wall').slide as { title: string }).title, onWallNow, 'blanking is not a move');
    assert.equal(last(presenterView, 'present/presenter').blank, 'white', 'the presenter view knows the wall is blank');
    wall.send({ type: 'present/blank', to: null });
    await settle();
    assert.equal(last(wall, 'present/wall').blank, null);
    assert.equal(last(presenterView, 'present/presenter').blank, null);
    assert.equal((last(wall, 'present/wall').slide as { title: string }).title, onWallNow, 'the key that brings it back does not step');
    wall.send({ type: 'present/blank', to: 'ground' });
    await settle();
    assert.equal(last(presenterView, 'present/presenter').blank, 'ground');
    presenterView.send({ type: 'present/go', number: 1 });
    await settle();
    assert.equal(last(wall, 'present/wall').blank, null, 'a move brings the slide back');
    assert.equal((last(wall, 'present/wall').slide as { title: string }).title, 'Zero');
    wall.send({ type: 'present/blank', to: 'white' });
    await settle();
    wall.send({ type: 'present/blank', to: 'black' });
    await settle();
    assert.equal(last(wall, 'present/wall').blank, 'white', 'an unknown colour is not a request');
    wall.send({ type: 'present/blank', to: null });
    await settle();

    // Decks README items 11 and 16: a click on an item in Now spotlights it on the wall, and Now shows it too; a
    // spotlight is not a move, and the next move (→ or a clicker) clears it and goes on in one press.
    const spotOn = (last(wall, 'present/wall').slide as { title: string }).title;
    presenterView.send({ type: 'present/spot', item: 1 });
    await settle();
    assert.equal(last(wall, 'present/wall').spot, 1, 'the wall has the spotlight');
    assert.equal(last(presenterView, 'present/presenter').spot, 1, 'Now shows the same');
    assert.equal((last(wall, 'present/wall').slide as { title: string }).title, spotOn, 'a spotlight is not a move');
    wall.send({ type: 'present/spot', item: 2 });
    await settle();
    assert.equal(last(wall, 'present/wall').spot, 2, 'another item: the spotlight moves');
    // A click on a spotlit picture fills the wall; any key returns, still on the same slide, still spotlit.
    presenterView.send({ type: 'present/fill', item: 2 });
    await settle();
    assert.equal(last(wall, 'present/wall').fill, 2);
    assert.equal(last(presenterView, 'present/presenter').fill, 2, 'Now says the picture fills the wall');
    wall.send({ type: 'present/fill', item: null });
    await settle();
    assert.equal(last(wall, 'present/wall').fill, null);
    assert.equal(last(wall, 'present/wall').spot, 2, 'returning keeps the spotlight');
    assert.equal((last(wall, 'present/wall').slide as { title: string }).title, spotOn, 'returning does not step');
    // A new spotlight is never a filled wall.
    wall.send({ type: 'present/fill', item: 2 });
    await settle();
    wall.send({ type: 'present/spot', item: 0 });
    await settle();
    assert.equal(last(wall, 'present/wall').fill, null);
    // Sprint 163: with the presenter view on, a tab chosen on Now shows on the wall; it is no move, and a move
    // starts every Tabs block at its first tab again (below).
    presenterView.send({ type: 'present/tab', block: 0, tab: 2 });
    await settle();
    assert.deepEqual(last(wall, 'present/wall').tabs, [2], 'the wall shows the tab Now chose');
    assert.deepEqual(last(presenterView, 'present/presenter').tabs, [2], 'Now shows it too');
    assert.equal((last(wall, 'present/wall').slide as { title: string }).title, spotOn, 'a tab is not a move');
    wall.send({ type: 'present/tab', block: 0, tab: 1 });
    await settle();
    assert.deepEqual(last(wall, 'present/wall').tabs, [2], 'the wall cannot choose a tab while the presenter view is on');
    presenterView.send({ type: 'present/tab', block: 0, tab: -1 });
    await settle();
    assert.deepEqual(last(wall, 'present/wall').tabs, [2], 'a place that is not one is not a request');
    // → clears it and goes on, once.
    const spotStates = wall.posted.filter(message => (message as { type?: string }).type === 'present/wall').length;
    wall.send({ type: 'present/next' });
    await settle();
    assert.equal(last(wall, 'present/wall').spot, null, 'a move clears the spotlight');
    assert.equal(last(presenterView, 'present/presenter').spot, null);
    assert.deepEqual(last(wall, 'present/wall').tabs, [], 'a move starts every Tabs block at its first tab');
    assert.notEqual((last(wall, 'present/wall').slide as { title: string }).title, spotOn, 'and goes on');
    assert.equal(wall.posted.filter(message => (message as { type?: string }).type === 'present/wall').length, spotStates + 1, 'in one press');
    // The wall drawn again without a move keeps the spotlight on the same slide, and lets it go when the slide comes
    // in another form (an edit since): an item's place would name another item (review of #790).
    wall.send({ type: 'present/spot', item: 1 });
    await settle();
    wall.send({ type: 'present/ready' });
    await settle();
    assert.equal(last(wall, 'present/wall').spot, 1, 'the same slide drawn again keeps it');
    const spotTitle = (last(wall, 'present/wall').slide as { title: string }).title;
    document.text = document.text.replace(`title: ${spotTitle}\n`, `title: ${spotTitle}, moved\n`);
    document.version = 5;
    changeListener({ document });
    await settle(400);
    wall.send({ type: 'present/ready' });
    await settle();
    assert.equal((last(wall, 'present/wall').slide as { title: string }).title, `${spotTitle}, moved`);
    assert.equal(last(wall, 'present/wall').spot, null, 'an edited slide drawn again has no spotlight');
    assert.equal(last(presenterView, 'present/presenter').spot, null);
    wall.send({ type: 'present/spot', item: 'x' });
    await settle();
    assert.equal(last(wall, 'present/wall').spot, null, 'a place that is not one is not a request');
    // The presenter view's clock: the system's locale, never missing.
    const clockSent = last(presenterView, 'present/presenter').clock as { locale: unknown; hourCycle: unknown };
    assert.ok(clockSent && 'locale' in clockSent && 'hourCycle' in clockSent);

    // Small details item 3: this deck isn't published (no page address), so Q does nothing and no button shows.
    assert.equal(last(wall, 'present/wall').page, null)
    assert.equal(last(presenterView, 'present/presenter').page, null, 'no "Show the page" for an unpublished deck')
    wall.send({ type: 'present/blank', to: null });
    await settle();
    wall.send({ type: 'present/blank', to: 'page' });
    await settle();
    assert.equal(last(wall, 'present/wall').blank, null, "an unpublished deck's Q does nothing");

    // Decks README item 9: the timer, started from the presenter view, is on the wall and stays across moves, blanks
    // and spotlights until stopped; nothing of it is written to the file.
    const textBeforeTimer = document.text;
    const timerStart = Date.now();
    presenterView.send({ type: 'present/timer', minutes: 20 });
    await settle();
    const timed = last(wall, 'present/wall').timer as { endsAt: number; minutes: number };
    assert.equal(timed.minutes, 20);
    assert.ok(timed.endsAt >= timerStart + 20 * 60_000 && timed.endsAt <= Date.now() + 20 * 60_000, 'it ends 20 minutes from the start');
    assert.deepEqual(last(presenterView, 'present/presenter').timer, timed, 'the presenter view has the same timer');
    presenterView.send({ type: 'present/next' });
    await settle();
    assert.deepEqual(last(wall, 'present/wall').timer, timed, 'it stays across slides');
    wall.send({ type: 'present/blank', to: 'ground' });
    await settle();
    assert.deepEqual(last(wall, 'present/wall').timer, timed, 'and on a blank wall');
    wall.send({ type: 'present/blank', to: null });
    await settle();
    wall.send({ type: 'present/spot', item: 0 });
    await settle();
    assert.deepEqual(last(wall, 'present/wall').timer, timed, 'and with a spotlight');
    wall.send({ type: 'present/timer', minutes: 5 });
    await settle();
    assert.deepEqual(last(wall, 'present/wall').timer, timed, "the wall can't set it: only the presenter view offers it");
    presenterView.send({ type: 'present/timer', minutes: 0 });
    presenterView.send({ type: 'present/timer', minutes: 'ten' });
    await settle();
    assert.deepEqual(last(wall, 'present/wall').timer, timed, 'minutes that are not minutes are not a request');
    presenterView.send({ type: 'present/timer', minutes: 20 });
    await settle();
    assert.ok((last(wall, 'present/wall').timer as { endsAt: number }).endsAt >= timed.endsAt, 'Restart starts it again');
    presenterView.send({ type: 'present/timer', minutes: null });
    await settle();
    assert.equal(last(wall, 'present/wall').timer, null, 'Stop takes it off the wall');
    assert.equal(last(presenterView, 'present/presenter').timer, null);
    assert.equal(document.text, textBeforeTimer, 'the timer writes nothing to the file');

    // Item 12: the presenter view's dot is relayed to the wall as it comes, and only the dot: no state is sent.
    const wallStatesBeforeDot = wall.posted.filter(message => message.type === 'present/wall').length;
    presenterView.send({ type: 'present/pointer', at: { x: 0.25, y: 0.75 } });
    await settle();
    assert.deepEqual(last(wall, 'present/pointer').at, { x: 0.25, y: 0.75 }, 'the wall gets the place');
    presenterView.send({ type: 'present/pointer', at: null });
    await settle();
    assert.equal(last(wall, 'present/pointer').at, null, 'L let go: no dot');
    presenterView.send({ type: 'present/pointer', at: { x: 2, y: 0.5 } });
    wall.send({ type: 'present/pointer', at: { x: 0.5, y: 0.5 } });
    await settle();
    assert.equal(last(wall, 'present/pointer').at, null, 'a place off the slide, or from the wall itself, is not relayed');
    assert.equal(wall.posted.filter(message => message.type === 'present/wall').length, wallStatesBeforeDot, 'the dot is no state');
    assert.equal(document.text, textBeforeTimer, 'the dot writes nothing to the file');
    // The presenter view's page loaded again (Swap displays) while L was held: the wall's dot goes.
    presenterView.send({ type: 'present/pointer', at: { x: 0.5, y: 0.5 } });
    await settle();
    presenterView.send({ type: 'present/ready' });
    await settle();
    assert.equal(last(wall, 'present/pointer').at, null, 'a reloaded presenter view holds no dot');
    // The presenter view turned off while a timer runs: the timer goes too, since only that view can stop it.
    presenterView.send({ type: 'present/timer', minutes: 10 });
    await settle();
    assert.equal((last(wall, 'present/wall').timer as { minutes: number }).minutes, 10);
    wall.send({ type: 'present/presenter' });
    await settle();
    assert.equal(last(wall, 'present/wall').timer, null, 'no timer left on the wall without the view that stops it');
    // #974: with the presenter view off, the wall chooses the tab on its own slide.
    const beforeTab = last(wall, 'present/wall');
    assert.equal((beforeTab.presenter as { on: boolean }).on, false);
    wall.send({ type: 'present/tab', block: 0, tab: 2 });
    await settle();
    const afterTab = last(wall, 'present/wall');
    assert.deepEqual(afterTab.tabs, [2], 'the wall shows the tab it chose');
    assert.deepEqual(afterTab.slide, beforeTab.slide, 'the tab click stays on the same slide');
    assert.equal(afterTab.spot, beforeTab.spot, 'the tab click keeps the spotlight as it was');
    // On again, as the person last chose (the next start opens it too).
    wall.send({ type: 'present/presenter' });
    await settle(50);

    presenter.dispose();
    await settle();
    assert.ok(panels.every(panel => panel.disposed), 'Stop closes both');

    // ---- A published deck: Q and "Show the page" put the page's QR code on the wall; any key returns without a step.
    let address: string | null = 'https://talk.example.workers.dev/';
    const published = new DeckPresenter({ fsPath: '/extension' } as never, state as never);
    const asked: unknown[] = [];
    published.pageAddress = async askedFor => { asked.push(askedFor); return address; };
    let pageListener: (() => void) | null = null;
    published.onPageChange = listener => { pageListener = listener; return { dispose() { pageListener = null; } } as never; };
    const panelsBefore = panels.length;
    await published.start(origin as never, { type: 'deck/present', from: 'here', index: 1 } as never);
    await settle(50);
    const wall2 = panels.slice(panelsBefore).find(panel => panel.viewType === DECK_WALL_VIEW_TYPE);
    const laptop2 = panels.slice(panelsBefore).find(panel => panel.viewType === DECK_PRESENTER_VIEW_TYPE);
    assert.ok(wall2 && laptop2, 'both windows open again');
    assert.equal(asked[0], document, "the deck's own document is asked");
    assert.equal(last(wall2, 'present/wall').page, address, 'the wall knows the page');
    assert.equal(last(laptop2, 'present/presenter').page, address, 'the presenter view offers "Show the page"');
    const onWall2 = (last(wall2, 'present/wall').slide as { title: string }).title;
    laptop2.send({ type: 'present/blank', to: 'page' });
    await settle();
    assert.equal(last(wall2, 'present/wall').blank, 'page', 'the QR code is on the wall');
    assert.equal(last(laptop2, 'present/presenter').blank, 'page', 'the presenter view says so');
    assert.equal((last(wall2, 'present/wall').slide as { title: string }).title, onWall2, 'showing the page is not a move');
    // Any key (the webview sends `to` null) returns to the same slide.
    wall2.send({ type: 'present/blank', to: null });
    await settle();
    assert.equal(last(wall2, 'present/wall').blank, null);
    assert.equal((last(wall2, 'present/wall').slide as { title: string }).title, onWall2, 'the key that returns does not step');
    // A move from a button returns too, on the slide it moves to.
    wall2.send({ type: 'present/blank', to: 'page' });
    await settle();
    laptop2.send({ type: 'present/next' });
    await settle();
    assert.equal(last(wall2, 'present/wall').blank, null, 'a move takes the code away');
    // A key that comes while Q is still asking wins: the code never shows after the slide came back.
    let answer: ((value: string | null) => void) | null = null;
    published.pageAddress = () => new Promise(resolve => { answer = resolve; });
    wall2.send({ type: 'present/blank', to: 'page' });
    await settle();
    wall2.send({ type: 'present/blank', to: null });
    await settle();
    assert.ok(answer, 'Q asked Publish again');
    answer!(address);
    await settle();
    assert.equal(last(wall2, 'present/wall').blank, null, 'the later key wins over the slow Q');
    published.pageAddress = async askedFor => { asked.push(askedFor); return address; };
    // Unpublished meanwhile: Q asks again, shows nothing, and the button goes.
    address = null;
    wall2.send({ type: 'present/blank', to: 'page' });
    await settle();
    assert.equal(last(wall2, 'present/wall').blank, null, 'no code for a page that is gone');
    assert.equal(last(wall2, 'present/wall').page, null);
    assert.equal(last(laptop2, 'present/presenter').page, null, 'the button goes with the page');
    // A refused Q still sends both windows a state, so the ask they keep settles.
    const refusedBefore = wall2.posted.length;
    wall2.send({ type: 'present/blank', to: 'page' });
    await settle();
    assert.ok(wall2.posted.length > refusedBefore, 'a refused Q is answered');
    // Published again from the main window during the talk: Publish's page state changes, and the button comes back.
    address = 'https://talk.example.workers.dev/';
    assert.ok(pageListener, 'the presenter listens for page changes');
    pageListener!();
    await settle();
    assert.equal(last(wall2, 'present/wall').page, address, 'Q works again');
    assert.equal(last(laptop2, 'present/presenter').page, address, '"Show the page" is back');
    published.dispose();
    await settle();
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
