/**
 * Decks README item 18 (18 November): items arrive one by one in Present. The renderer's count and marks, the step
 * rules, and the host driving them from both windows: → shows the next item and ← hides the last one shown, after the
 * last item → goes to the next slide, coming back from it shows a slide whole, the go-to box jumps to a slide shown
 * whole, the presenter view's "Shown n of m" and its Next preview, and the spotlight, the blank wall, the page's QR
 * code and a filled wall around a step. Run: npx tsx src/decks/present/DeckPresenter.reveal.test.ts
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

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { revealCountOf, revealKept, revealLabel, revealOnArrival, revealStepOf } = require('./revealSteps') as typeof import('./revealSteps');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { arrivalOfMove, opensOnward } = require('./slideArrival') as typeof import('./slideArrival');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { blockSlideHtml, blockRevealCount } = require('../blocks/slideRenderer') as typeof import('../blocks/slideRenderer');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { pageHtml } = require('../page/pageHtml') as typeof import('../page/pageHtml');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { publicDeck } = require('../page/publicDeck') as typeof import('../page/publicDeck');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { BUILT_IN_THEME } = require('../deckTheme') as typeof import('../deckTheme');

const settle = (ms = 20) => new Promise(resolve => setTimeout(resolve, ms));

function last(panel: StubPanel, type: string): Record<string, unknown> {
  const found = [...panel.posted].reverse().find(message => message.type === type);
  assert.ok(found, `${panel.viewType} got a ${type}`);
  return found;
}

/** A block slide of a v2 deck. */
function blockSlide(id: string, body: string): string {
  return ['```slide', '---', `id: ${id}`, '---', body, '```', '', ''].join('\n');
}

const BOXES = ['# Four ideas', '', ':::: {.boxes reveal="one"}', ...['One', 'Two', 'Three', 'Four'].flatMap(word => ['::: box', `### ${word}`, ':::', '']), '::::'].join('\n');
const LIST = ['# Two steps', '', '::: incremental', '- Open the file', '- Ask the question', ':::'].join('\n');
const DECK = `---\ndeck: 2\nhandout: text\n---\n\n${blockSlide('s1', '# Start')}${blockSlide('s2', BOXES)}${blockSlide('s3', LIST)}`;

// ---- The count and the drawing: the renderer numbers the items it draws; Present hides those not shown yet.
{
  assert.equal(blockRevealCount(BOXES), 4);
  assert.equal(blockRevealCount(LIST), 2);
  assert.equal(blockRevealCount(LIST.replace('::: incremental', '::: {reveal="one"}')), 2, '{reveal="one"} around a list reveals too');
  assert.equal(blockRevealCount(BOXES.replace(' reveal="one"', '')), 0, 'All at once: nothing to reveal');
  assert.equal(blockRevealCount(['::: {.steps reveal="one"}', '1. A', '   - inner', '2. B', ':::'].join('\n')), 2, 'a step, not its inner list');
  // Steps' items are its numbered list, whatever stands before it (review of #799); a task list is no reveal list.
  const stepsAfterList = ['::: {.steps reveal="one"}', '- a note', '- another', '', '1. A', '2. B', '3. C', ':::'].join('\n');
  assert.equal(blockRevealCount(stepsAfterList), 3, 'the steps, not the bullets before them');
  assert.ok(blockSlideHtml(stepsAfterList, { reveal: 1 }).includes('<li data-reveal-item="1" data-reveal-hidden="">B</li>'));
  assert.equal(blockRevealCount(['::: incremental', '- [ ] a', '- [ ] b', ':::'].join('\n')), 0, 'a task list in the wrapper is not revealed');
  assert.equal(blockRevealCount([':::: {.columns reveal="one"}', '::: column', 'A', ':::', '::: column', 'B', ':::', '::::'].join('\n')), 2);
  // Two blocks on one slide: their items one after another, in the slide's order.
  assert.equal(blockRevealCount(`${BOXES}\n\n${LIST.replace('# Two steps\n\n', '')}`), 6);
  assert.equal(revealCountOf({ kind: '', data: { markdown: BOXES } }), 4);
  assert.equal(revealCountOf({ kind: 'title', data: { title: 'Old slide' } }), 0, 'an older slide shows whole');
  const shown2 = blockSlideHtml(BOXES, { reveal: 2 });
  assert.equal((shown2.match(/data-reveal-hidden/g) ?? []).length, 2, 'two of four hidden');
  assert.ok(/data-reveal-item="1">/.test(shown2) && /data-reveal-item="2" data-reveal-hidden="">/.test(shown2), shown2);
  assert.equal(blockSlideHtml(BOXES).includes('data-reveal-hidden'), false, 'without a step every item shows');
  assert.ok(blockSlideHtml(LIST, { reveal: 1 }).includes('<li data-reveal-item="1" data-reveal-hidden="">Ask the question</li>'));
}

// ---- The step rules.
{
  assert.deepEqual(revealOnArrival(4, 'first'), { shown: 1, count: 4 });
  assert.deepEqual(revealOnArrival(4, 'whole'), { shown: 4, count: 4 });
  assert.equal(revealOnArrival(0, 'first'), null);
  assert.deepEqual(revealStepOf({ shown: 1, count: 4 }, 'next'), { shown: 2, count: 4 });
  assert.equal(revealStepOf({ shown: 4, count: 4 }, 'next'), null, 'after the last item → moves');
  assert.deepEqual(revealStepOf({ shown: 3, count: 4 }, 'back'), { shown: 2, count: 4 });
  assert.equal(revealStepOf({ shown: 1, count: 4 }, 'back'), null, 'at the first item ← moves');
  assert.equal(revealStepOf(null, 'next'), null);
  assert.deepEqual(['next', 'back', 'first', 'last', 'go'].map(move => opensOnward(arrivalOfMove(move as never)) ? 'first' : 'whole'), ['first', 'whole', 'first', 'whole', 'whole']);
  assert.deepEqual(revealKept({ shown: 2, count: 4 }, 3), { shown: 2, count: 3 }, 'an edit keeps the step');
  assert.deepEqual(revealKept({ shown: 4, count: 4 }, 5), { shown: 5, count: 5 }, 'a whole slide stays whole');
  assert.deepEqual(revealKept(null, 3), { shown: 3, count: 3 }, 'items that came with an edit show: nothing hides under the room');
  assert.equal(revealKept({ shown: 2, count: 4 }, 0), null);
  assert.equal(revealLabel({ shown: 2, count: 4 }), 'Shown 2 of 4');
  assert.equal(revealLabel(null), null);
}

// ---- The page (and its print, the same HTML) shows every item, and a wrapped list as the bare list: only the wrapper
// and the items' numbers tell them apart.
{
  const bareText = DECK.replace('::: incremental\n', '').replace('- Ask the question\n:::', '- Ask the question').replace(':::: {.boxes reveal="one"}', ':::: boxes');
  const page = (text: string) => pageHtml(publicDeck(text, { folderName: 'F', deckName: 'D', theme: BUILT_IN_THEME }), { slideCss: '', fonts: [] }, { digest: 'd', pictureUrl: () => null });
  const revealed = page(DECK);
  assert.ok(revealed.includes('<div class="blk-group" data-reveal="one"><ul>'), 'the wrapper is drawn as a plain block');
  assert.ok(!revealed.replace(/<script>[\s\S]*<\/script>/, '').replace(/<style>[\s\S]*<\/style>/, '').includes('data-reveal-hidden'), 'the page draws every item; its player hides them as the reader steps');
  const plain = revealed
    .replace(/ data-reveal-item="\d+"/g, '')
    .replace(/ data-reveal="one"/g, '')
    .replace(/<div class="blk-group"><ul>([\s\S]*?)<\/ul>\n<\/div>\n/g, '<ul>$1</ul>\n');
  const bare = page(bareText);
  // The deck's text differs (its digest-free bytes too): compare the drawn slides only.
  const slides = (html: string) => [...html.matchAll(/<div class="blk-flow"[\s\S]*?<\/div><\/div>/g)].map(match => match[0]);
  assert.ok(slides(bare).length >= 3 && slides(bare).some(drawn => drawn.includes('Ask the question')), 'the page draws the slides');
  assert.deepEqual(slides(plain), slides(bare), 'every slide drawn as without Reveal');
}

async function main(): Promise<void> {
  const before = { dev: process.env.VSCODE_DEV, windowed: process.env.RITEMARK_PRESENT_WINDOWED };
  delete process.env.VSCODE_DEV;
  delete process.env.RITEMARK_PRESENT_WINDOWED;
  try {
    const memory = new Map<string, unknown>();
    const state = { get: (key: string, fallback?: unknown) => (memory.has(key) ? memory.get(key) : fallback), update: async (key: string, value: unknown) => { memory.set(key, value); }, keys: () => [...memory.keys()] };
    const presenter = new DeckPresenter({ fsPath: '/extension' } as never, state as never);
    presenter.pageAddress = async () => 'https://talk.example.workers.dev/';
    const document = { text: DECK, version: 1, getText: () => document.text, uri: { fsPath: '/talks/talk.deck.md', scheme: 'file' } };
    const origin = {
      document,
      panel: { viewColumn: 1, webview: { postMessage: async () => true }, onDidDispose: () => ({ dispose() {} }) },
    };
    await presenter.start(origin as never, { type: 'deck/present', from: 'start', index: 0 } as never);
    await settle();
    const wall = panels.find(panel => panel.viewType === DECK_WALL_VIEW_TYPE)!;
    const laptop = panels.find(panel => panel.viewType === DECK_PRESENTER_VIEW_TYPE)!;
    assert.ok(wall && laptop, 'both windows open');
    const onWall = () => last(wall, 'present/wall') as unknown as { slide: { number: number }; reveal: unknown; spot: number | null; blank: unknown };
    const onLaptop = () => last(laptop, 'present/presenter') as unknown as { current: { number: number }; next: { number: number } | null; reveal: unknown; nextReveal: unknown; nextIsItem: boolean };
    const at = (number: number, reveal: unknown, label: string) => {
      assert.equal(onWall().slide.number, number, `${label}: the wall's slide`);
      assert.deepEqual(onWall().reveal, reveal, `${label}: the wall's step`);
      assert.deepEqual(onLaptop().reveal, reveal, `${label}: Now's step`);
    };
    const press = async (type: string, from = laptop, extra: Record<string, unknown> = {}) => { from.send({ type, ...extra }); await settle(); };
    // README item 20: how the slide on the wall arrived, which decides row or whole there; the presenter view never has it.
    const arrived = (arrival: string | null, label: string) => {
      assert.equal((last(wall, 'present/wall') as { arrival?: unknown }).arrival, arrival, `${label}: arrived as ${arrival}`);
      assert.ok(!('arrival' in last(laptop, 'present/presenter')), `${label}: the presenter view has no arrival (it never animates)`);
    };

    // Slide 1 shows whole; Next shows slide 2 as it opens, with its first item.
    at(1, null, 'the start');
    const states = wall.posted.filter(message => message.type === 'present/wall');
    assert.equal(states[0].arrival, 'start', 'the wall\'s first state: presenting starts, the first slide arriving in a row');
    assert.ok(states.slice(1).every(message => message.arrival === null), 'what follows on the same slide (the page\'s address) arrives as nothing');
    assert.equal(onLaptop().next!.number, 2);
    assert.deepEqual(onLaptop().nextReveal, { shown: 1, count: 4 });
    assert.equal(onLaptop().nextIsItem, false);

    // → opens slide 2 with the title and its first item; Next is its next item.
    await press('present/next');
    at(2, { shown: 1, count: 4 }, '→ to slide 2');
    arrived('next', '→ to slide 2');
    assert.equal(onLaptop().nextIsItem, true);
    assert.equal(onLaptop().next!.number, 2, 'Next is the same slide');
    assert.deepEqual(onLaptop().nextReveal, { shown: 2, count: 4 }, 'with its next item');

    // Each → (or a clicker's PageDown, the same request) shows the next item; ← hides the last one shown.
    await press('present/next', wall);
    at(2, { shown: 2, count: 4 }, 'the second item');
    arrived(null, 'an item shown on the same slide');
    assert.equal(revealLabel(onLaptop().reveal as never), 'Shown 2 of 4');
    await press('present/back');
    at(2, { shown: 1, count: 4 }, '← hides it');
    await press('present/back');
    at(1, null, '← at the first item goes back a slide');
    arrived('back', '← back a slide');

    // Coming back from the next slide shows it whole, as it was left.
    await press('present/next');
    for (const shown of [2, 3, 4]) await press('present/next');
    at(2, { shown: 4, count: 4 }, 'every item shown');
    assert.equal(onLaptop().nextIsItem, false, 'no item left: Next is the next slide');
    assert.equal(onLaptop().next!.number, 3);
    assert.deepEqual(onLaptop().nextReveal, { shown: 1, count: 2 }, 'as it opens');
    await press('present/next');
    at(3, { shown: 1, count: 2 }, 'after the last item → goes to the next slide');
    await press('present/back');
    at(2, { shown: 4, count: 4 }, 'back from the next slide: whole');

    // The go-to box (and the grid, the row) jumps to the slide shown whole; End too; Home opens as → does.
    await press('present/go', laptop, { number: 3 });
    at(3, { shown: 2, count: 2 }, 'a typed number: whole');
    arrived('jump', 'a typed number');
    await press('present/last');
    arrived('jump', 'End');
    await press('present/first');
    arrived('home', 'Home');
    await press('present/next');
    at(2, { shown: 1, count: 4 }, 'Home, then →');
    await press('present/go', laptop, { number: 2 });
    at(2, { shown: 4, count: 4 }, 'the go-to box on the slide already shown: whole');
    await press('present/go', laptop, { number: 99 });
    at(2, { shown: 4, count: 4 }, 'a number with no slide changes nothing');

    // The spotlight: F and a click work on the shown items; a press that shows the next item clears it, as a move does.
    await press('present/back');
    await press('present/back');
    at(2, { shown: 2, count: 4 }, 'two shown');
    await press('present/spot', wall, { item: 1 });
    assert.equal(onWall().spot, 1);
    arrived(null, 'the spotlight');
    assert.deepEqual(onWall().reveal, { shown: 2, count: 4 }, 'a spotlight is no step');
    await press('present/next', wall);
    at(2, { shown: 3, count: 4 }, '→ with a spotlight on: the next item');
    assert.equal(onWall().spot, null, 'and the spotlight is cleared, in one press');

    // The blank wall and the page's QR code pause it: the key that brings the slide back (`to` null) does not step.
    for (const to of ['ground', 'white', 'page']) {
      await press('present/blank', wall, { to });
      assert.equal(onWall().blank, to, `${to}: the wall is covered`);
      assert.deepEqual(onWall().reveal, { shown: 3, count: 4 }, `${to}: the step is kept`);
      arrived(null, `${to}: covered`);
      await press('present/blank', wall, { to: null });
      at(2, { shown: 3, count: 4 }, `${to}: back at the same step`);
      arrived(null, `${to}: the slide back, whole`);
    }
    // A filled wall pauses it the same way.
    await press('present/fill', wall, { item: 0 });
    await press('present/fill', wall, { item: null });
    at(2, { shown: 3, count: 4 }, 'a filled wall: back at the same step');
    arrived(null, 'back from a filled picture, whole');

    // An edit to the slide on the wall waits for the next move (as blanking does); the step is kept within its items.
    document.text = DECK.replace('### Four', '### Four, edited');
    document.version = 2;
    await press('present/next');
    at(2, { shown: 4, count: 4 }, 'the last item, from the slide the wall has');
    wall.send({ type: 'present/ready' });
    await settle();
    at(2, { shown: 4, count: 4 }, 'the wall drawn again keeps its step');
    arrived(null, 'the wall drawn again: nothing arrives');
    assert.ok(JSON.stringify(onWall().slide).includes('Four, edited'), 'and shows the edit');

    // The slide on the wall deleted in the editor during a step: it has no items left to show, so → moves on
    // (review of #799), to the slide that came after it.
    await press('present/back');
    at(2, { shown: 3, count: 4 }, 'a step before the deletion');
    document.text = document.text.replace(blockSlide('s2', BOXES.replace('### Four', '### Four, edited')), '');
    document.version = 3;
    assert.ok(!document.text.includes('Four habits'), 'the slide is gone from the deck');
    await press('present/next');
    assert.equal(onWall().slide.number, 2, 'the slide that came after it, now second');
    assert.ok(JSON.stringify(onWall().slide).includes('Two steps'));
    assert.deepEqual(onWall().reveal, { shown: 1, count: 2 }, 'opening with its first item');

    presenter.stop();
    await settle();
  } finally {
    if (before.dev === undefined) delete process.env.VSCODE_DEV; else process.env.VSCODE_DEV = before.dev;
    if (before.windowed === undefined) delete process.env.RITEMARK_PRESENT_WINDOWED; else process.env.RITEMARK_PRESENT_WINDOWED = before.windowed;
  }
  console.log('DeckPresenter.reveal: the count, the step rules, →, ←, back from the next slide, the go-to box, the spotlight, blank, QR and a filled wall pass');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
