/**
 * Sprint 162 PR 6 (step-3-themes.md, "The wall and the page follow the theme"): a published page keeps its theme until
 * Update the page, and the chip says "Published · changed" while the page would carry another one.
 *
 *  - A theme field, a font, the logo's file or the theme the deck picks each reads as changed; the same theme back (an
 *    Undo) reads "Published" again. The theme's unsaved draft never counts: the decks read the file on disk.
 *  - Nothing of that writes the page, its fonts or its logo: they stay byte for byte until Update the page, which
 *    writes the deck with its theme as it is now, and the chip says "Published" again.
 *  - A theme or logo file written asks the chip again (`lookChanged`), without asking 2.2.
 *
 * Run: npx tsx src/decks/deckPublish.test.ts
 */
import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Module from 'node:module';
import { mock } from 'node:test';
import { liveFileDisplay } from './deckLiveIssues';
import type { LivePreference } from '../publish/publishRecords';
import { gatherPage } from '../publish/gather';
import { liveIssue, type LiveIssue } from '../publish/liveUpdate';
import type { GatheredPlan } from '../publish/types';
import { makeTempDir } from '../testing/tempDir';

// ── A small vscode for the host module: a project folder on disk, one open deck, 2.2's page state ──
const root = fs.realpathSync(makeTempDir('ritemark-deck-publish-'));
let workspaceRoot = root;
let rootChecks = 0;
const none = () => ({ dispose() {} });
const savedListeners: Array<(document: unknown) => void> = [];
const watchListeners: Array<(uri: { fsPath: string }) => void> = [];
const changeListeners: Array<(event: { document: unknown }) => void> = [];
let pageStateAsks = 0;
let bar: { kind: 'unpublished' | 'published'; changed: boolean } = { kind: 'unpublished', changed: false };
class EventEmitter<T> {
  private listeners: Array<(value: T) => void> = [];
  event = (listener: (value: T) => void) => {
    this.listeners.push(listener);
    return { dispose: () => { this.listeners = this.listeners.filter(entry => entry !== listener); } };
  };
  fire(value: T): void { for (const listener of [...this.listeners]) listener(value); }
  dispose(): void { this.listeners = []; }
}
const vscodeStub = {
  EventEmitter,
  RelativePattern: class {},
  Uri: { file: (fsPath: string) => ({ scheme: 'file', fsPath, toString: () => `file://${fsPath}` }) },
  workspace: {
    get workspaceFolders() { rootChecks++; return [{ uri: { scheme: 'file', fsPath: workspaceRoot } }]; },
    getWorkspaceFolder: () => ({ uri: { scheme: 'file', fsPath: root } }),
    textDocuments: [],
    onDidChangeTextDocument: (listener: (event: { document: unknown }) => void) => { changeListeners.push(listener); return { dispose() {} }; },
    onDidChangeConfiguration: none,
    onDidSaveTextDocument: (listener: (document: unknown) => void) => { savedListeners.push(listener); return none(); },
    createFileSystemWatcher: () => ({
      ...none(),
      onDidChange: (listener: (uri: { fsPath: string }) => void) => { watchListeners.push(listener); return none(); },
      onDidCreate: none,
    }),
    getConfiguration: () => ({ get: (key: string, fallback?: unknown) => (key === 'decks' ? true : fallback) }),
  },
  window: {},
  commands: {
    executeCommand: async (command: string) => {
      if (command !== '_ritemark.publish.pageState') return undefined;
      pageStateAsks++;
      return { ...bar };
    },
  },
};
const usage: unknown[] = [];
const load = (Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown })._load;
// Node can't import a .css file (esbuild inlines it): the page's slide rules, read from disk as the page tests do.
const slideCss = fs.readFileSync(path.resolve(__dirname, '..', '..', 'webview', 'src', 'components', 'decks', 'slide', 'slide.css'), 'utf8');
(Module as unknown as { _load: unknown })._load = (request: string, ...rest: unknown[]) => {
  if (request === '../analytics/posthog') return { trackEvent: async (...event: unknown[]) => { usage.push(event); } };
  if (request === 'vscode') return vscodeStub;
  if (request.endsWith('/slide/slide.css')) return { __esModule: true, default: slideCss };
  return load(request, ...rest);
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DeckPublisher } = require('./deckPublish') as typeof import('./deckPublish');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { foreignPageLine } = require('./page/pageFile') as typeof import('./page/pageFile');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { splitFrontMatter } = require('../editorSync/frontMatter') as typeof import('../editorSync/frontMatter');

const extension = path.resolve(__dirname, '..', '..');
const themes = path.join(root, 'Slide library', 'Themes');
const fernPath = path.join(themes, 'Fern.theme.md');
const paperPath = path.join(themes, 'Paper.theme.md');
const logoPath = path.join(themes, 'Fern logo.svg');
const deckPath = path.join(root, 'Training', 'Intro.deck.md');
const pagePath = path.join(root, 'Training', 'Intro.html');

const themeText = (fields: { name?: string; accent?: string; heading?: string; logo?: boolean } = {}) => `---
name: ${fields.name ?? 'Fern'}
background: "#FAF7F0"
headings: "#1D2433"
text: "#2E3445"
accent: "${fields.accent ?? '#C2410C'}"
soft-light: false
heading-font: ${fields.heading ?? 'Inter'}
text-font: Sofia Sans
corners: soft
boxes: filled
${fields.logo === false ? '' : 'logo: Fern logo.svg\n'}---
`;
const LOGO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><rect width="100" height="40" fill="#C2410C"/></svg>';
const deckText = (theme = 'Fern') => `---
deck: 1
theme: Slide library/Themes/${theme}.theme.md
---

\`\`\`slide title
id: a1
title: Fern training
subtitle: A synthetic deck
\`\`\`

Welcome, everyone.
`;

/** The page and every file beside it, by name: what a reader of the published page gets. */
function pageFiles(): Map<string, string> {
  const files = new Map<string, string>();
  const folder = path.dirname(pagePath);
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (!full.endsWith('.deck.md')) files.set(path.relative(folder, full), fs.readFileSync(full).toString('base64'));
    }
  };
  walk(folder);
  return files;
}

async function main(): Promise<void> {
  fs.mkdirSync(themes, { recursive: true });
  fs.mkdirSync(path.dirname(deckPath), { recursive: true });
  fs.writeFileSync(fernPath, themeText());
  fs.writeFileSync(paperPath, themeText({ name: 'Paper', accent: '#0F766E', logo: false }));
  fs.writeFileSync(logoPath, LOGO);
  let text = deckText();
  fs.writeFileSync(deckPath, text);
  const document = { uri: vscodeStub.Uri.file(deckPath), getText: () => text };

  let published = 0;
  const feature = {
    isReady: () => true,
    setPageRows: () => undefined,
    onDidChangeReady: none,
    onDidChangePageState: none,
    controller: { holdPage: () => () => undefined, recordFor: async () => (published > 0 ? { address: 'https://fern.example.test' } : undefined) },
    publishPage: async () => {
      published++;
      bar = { kind: 'published', changed: false };
      return 'published';
    },
  };
  const publisher = new DeckPublisher(extension);
  publisher.connect(feature as unknown as Parameters<InstanceType<typeof DeckPublisher>['connect']>[0]);
  const posts: Array<{ kind: string; changed: boolean }> = [];
  publisher.attach(document as never, async message => {
    if (message.type === 'deck/page-state') posts.push({ kind: message.state.kind, changed: message.state.changed });
    return true;
  });
  const notices: string[] = [];
  const publish = () => publisher.publish(document as never, splitFrontMatter(text).content, 'card', [], line => notices.push(line));
  const state = async () => {
    const read = await publisher.stateOf(document as never);
    return read.kind === 'published' ? (read.changed ? 'Published · changed' : 'Published') : read.kind;
  };

  try {
    // --- Publish: the page goes up with Fern, its font and its logo
    await publish();
    assert.deepEqual(notices, []);
    assert.equal(published, 1);
    assert.equal(await state(), 'Published');
    const live = pageFiles();
    assert.ok(live.has('Intro.html'));
    assert.ok([...live.keys()].some(name => name.startsWith(`fonts${path.sep}Inter-`)), 'the theme\'s font goes beside the page');
    assert.ok([...live.keys()].some(name => name.startsWith(`logos${path.sep}logo-`)), 'and its logo');
    const page = () => fs.readFileSync(pagePath, 'utf8');
    assert.match(page(), /#C2410C/i, 'the page wears Fern\'s accent');

    // --- A theme field saved: changed; the same field back (an Undo of the Save): Published
    fs.writeFileSync(fernPath, themeText({ accent: '#7C3AED' }));
    assert.equal(await state(), 'Published · changed', 'a theme field');
    fs.writeFileSync(fernPath, themeText());
    assert.equal(await state(), 'Published', 'the theme back as the page has it');

    // --- A font
    fs.writeFileSync(fernPath, themeText({ heading: 'Fraunces' }));
    assert.equal(await state(), 'Published · changed', 'another heading font');
    fs.writeFileSync(fernPath, themeText());
    assert.equal(await state(), 'Published');

    // --- The logo's file replaced in place (the theme file unchanged), then put back; then the logo removed
    fs.writeFileSync(logoPath, LOGO.replace('#C2410C', '#1D2433'));
    assert.equal(await state(), 'Published · changed', 'the logo\'s file');
    fs.writeFileSync(logoPath, LOGO);
    assert.equal(await state(), 'Published');
    fs.writeFileSync(fernPath, themeText({ logo: false }));
    assert.equal(await state(), 'Published · changed', 'the logo taken out of the theme');
    fs.writeFileSync(fernPath, themeText());
    assert.equal(await state(), 'Published');

    // --- The theme the deck picks, and the pick undone
    text = deckText('Paper');
    assert.equal(await state(), 'Published · changed', 'another theme picked');
    text = deckText();
    assert.equal(await state(), 'Published', 'the pick undone');
    // Another theme with the very same fields is still another theme (its name is in the digest)
    fs.writeFileSync(paperPath, themeText({ name: 'Paper' }));
    text = deckText('Paper');
    assert.equal(await state(), 'Published · changed', 'another theme, even with the same colours');
    text = deckText();

    // --- A theme or logo file written asks the chip again at once, from the digest alone (2.2 isn't asked)
    fs.writeFileSync(fernPath, themeText({ accent: '#7C3AED' }));
    const asked = pageStateAsks;
    const before = posts.length;
    publisher.lookChanged(document as never);
    for (let i = 0; i < 50 && posts.length === before; i++) await new Promise(resolve => setTimeout(resolve, 10));
    assert.deepEqual(posts.at(-1), { kind: 'published', changed: true }, 'the chip says Published · changed');
    assert.equal(pageStateAsks, asked, 'without asking 2.2: its page file is as it was');

    // --- A Save and its Undo at once: the refreshes go in turn, so the last word is the newest (the review of #791)
    {
      const from = posts.length;
      fs.writeFileSync(fernPath, themeText({ accent: '#0F766E' }));
      publisher.lookChanged(document as never);
      fs.writeFileSync(fernPath, themeText({ accent: '#7C3AED' }));
      publisher.lookChanged(document as never);
      for (let i = 0; i < 100 && posts.length < from + 2; i++) await new Promise(resolve => setTimeout(resolve, 10));
      assert.equal(posts.length, from + 2);
      assert.deepEqual(posts.at(-1), { kind: 'published', changed: true });
      fs.writeFileSync(fernPath, themeText());
      publisher.lookChanged(document as never);
      fs.writeFileSync(fernPath, themeText({ accent: '#7C3AED' }));
      publisher.lookChanged(document as never);
      fs.writeFileSync(fernPath, themeText());
      publisher.lookChanged(document as never);
      for (let i = 0; i < 100 && posts.length < from + 5; i++) await new Promise(resolve => setTimeout(resolve, 10));
      assert.deepEqual(posts.at(-1), { kind: 'published', changed: false }, 'the last write was the Undo: Published');
      fs.writeFileSync(fernPath, themeText({ accent: '#7C3AED' }));
    }

    // --- Nothing of that changed the page or the files beside it
    assert.deepEqual(pageFiles(), live, 'the page keeps its theme until Update the page');
    assert.equal(published, 1, 'and nothing went up');

    // --- Update the page: the deck as it is now, with its theme as saved; Published again
    await publish();
    assert.deepEqual(notices, []);
    assert.equal(published, 2);
    assert.match(page(), /#7C3AED/i, 'the page wears the theme as saved');
    assert.doesNotMatch(page(), /#C2410C/i);
    assert.notDeepEqual(pageFiles().get('Intro.html'), live.get('Intro.html'));
    assert.equal(await state(), 'Published', 'and the chip says Published again');
  } finally {
    publisher.dispose();
  }

  // Sprint 170 (the Experience lead, 20 November): with Publish not reachable, the state still names the PDF kinds,
  // so the bar keeps a plain Save as PDF (a local file); Publish stays hidden (`ready: false`).
  {
    const off = new DeckPublisher(extension);
    off.connect({ ...feature, isReady: () => false } as unknown as Parameters<InstanceType<typeof DeckPublisher>['connect']>[0]);
    off.pdfKinds = async () => ['slides-and-handout'];
    try {
      assert.deepEqual(await off.stateOf(document as never), { ready: false, kind: 'unpublished', changed: false, pdf: ['slides-and-handout'] });
    } finally {
      off.dispose();
    }
  }
  // The live run uses the same saved words and measured fit as a manual Update.
  let preference: LivePreference | undefined;
  let finishManual: (() => void) | undefined;
  let manualStarted: (() => void) | undefined;
  let liveHtml = '';
  let liveDigest = '';
  let diagnosis: LiveIssue | undefined;
  let nextResult: (() => void) | undefined;
  const liveFeature = {
    ...feature,
    publishPage: async () => {
      if (manualStarted) await new Promise<void>(resolve => {
        finishManual = resolve;
        manualStarted?.();
      });
      return 'published';
    },
    controller: {
      ...feature.controller,
      recordFor: async () => ({ files: [], live: preference }),
      setLive: async (_page: string, on: boolean) => {
        preference = on ? { on: true, id: 'test' } : undefined;
        return true;
      },
      pauseLivePage: async (_page: string, _input: unknown, detail: string) => {
        const pause = { kind: 'page' as const, at: 1, detail };
        preference = { ...preference!, pause };
        return { kind: 'paused', pause };
      },
      updateLive: async (page: { realPath: string }, input: { digest: string; describe: (plan: GatheredPlan, issue?: LiveIssue) => LiveIssue | undefined }) => {
        liveDigest = input.digest;
        liveHtml = fs.readFileSync(page.realPath, 'utf8');
        const plan = await gatherPage(page.realPath, root);
        diagnosis = input.describe(plan, liveIssue(plan));
        return { kind: 'updated', pictures: [] };
      },
    },
  };
  const livePublisher = new DeckPublisher(extension);
  const uri = document.uri;
  try {
    livePublisher.connect(liveFeature as never);
    const seat = livePublisher.attach(document as never, async () => true);
    const ready = new Promise<void>(resolve => { nextResult = resolve; });
    livePublisher.onDidUpdateLive(() => nextResult?.());
    assert.equal(liveHtml, '', 'connecting and attaching never send');
    text = deckText('Paper');
    fs.writeFileSync(deckPath, text);
    const body = splitFrontMatter(text).content;
    livePublisher.rememberLiveInput(document as never, undefined, { text: body, look: 'card', steps: [2] });
    await livePublisher.liveAction(document as never, 'on');
    await ready;
    const fromLive = liveHtml;
    const beforeTimetable = liveDigest;
    assert.ok(fromLive);
    await livePublisher.liveAction(document as never, 'off');
    await livePublisher.publish(document as never, body, 'card', [2], () => {});
    assert.equal(fromLive, fs.readFileSync(pagePath, 'utf8'), 'live and manual Update build the same page, including fit');
    seat.dispose();
    preference = { on: true, id: 'already-on' };
    liveHtml = '';
    livePublisher.attach(document as never, async () => true);
    await livePublisher.stateOf(document as never);
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(liveHtml, '', 'opening a deck while its switch is on sends nothing');
    const timed = new Promise<void>(resolve => { nextResult = resolve; });
    text = text.replace('deck: 1', 'deck: 1\nritemark-length: 180').replace('id: a1', 'id: a1\ntime: 25');
    fs.writeFileSync(deckPath, text);
    savedListeners.at(-1)?.(document);
    await timed;
    assert.equal(liveDigest, beforeTimetable, 'minutes and session changes have no public digest');
    const changed = new Promise<void>(resolve => { nextResult = resolve; });
    text = text.replace('Welcome, everyone.', 'An external save.');
    fs.writeFileSync(deckPath, text);
    watchListeners.at(-1)?.(uri);
    await changed;
    assert.match(liveHtml, /An external save/);
    const saved = new Promise<void>(resolve => { nextResult = resolve; });
    text = text.replace('An external save.', 'An editor save.');
    fs.writeFileSync(deckPath, text);
    savedListeners.at(-1)?.(document);
    await saved;
    assert.match(liveHtml, /An editor save/);
    const foundKey = new Promise<void>(resolve => { nextResult = resolve; });
    const fixtureKey = ['sk', 'ant', 'A1'.repeat(14)].join('-');
    text = text.replace('An editor save.', fixtureKey);
    fs.writeFileSync(deckPath, text);
    savedListeners.at(-1)?.(document);
    await foundKey;
    assert.equal(diagnosis?.kind, 'key');
    assert.equal(diagnosis?.slide, 1);
    assert.equal(diagnosis?.location?.line, text.slice(0, text.indexOf(fixtureKey)).split('\n').length);
    assert.equal(diagnosis?.keyPreview, 'sk-ant-…A1A1');
    assert.equal(diagnosis?.detail, 'Slide 1 has what looks like a key.');
    assert.equal(JSON.stringify(diagnosis).includes(fixtureKey), false);

    const foundPicture = new Promise<void>(resolve => { nextResult = resolve; });
    text = text.replace(fixtureKey, '![Outside](/tmp/elsewhere.png)');
    fs.writeFileSync(deckPath, text);
    savedListeners.at(-1)?.(document);
    await foundPicture;
    assert.equal(diagnosis?.kind, 'outside');
    assert.equal(diagnosis?.slide, 1);

    assert.match(diagnosis?.detail ?? '', /shows (?:~\/.*|…\/)elsewhere\.png, which is outside/);
    const limited = new Promise<void>(resolve => { nextResult = resolve; });
    const logo = path.join(root, 'Shared', 'logo.png');
    fs.mkdirSync(path.dirname(logo));
    fs.closeSync(fs.openSync(logo, 'w'));
    fs.truncateSync(logo, 26 * 1024 * 1024);
    text = deckText('Paper').replace('Welcome, everyone.', '![Logo](../Shared/logo.png)');
    fs.writeFileSync(deckPath, text);
    savedListeners.at(-1)?.(document);
    await limited;
    assert.equal(diagnosis?.kind, 'limits');
    assert.equal(diagnosis?.slide, 1);
    assert.equal(diagnosis?.detail, 'logo.png is too big to publish (26 MB). A file can be up to 25 MB.');

    const usageForFirstPage = [...usage];
    const otherDeck = path.join(path.dirname(deckPath), 'Other.rtms');
    fs.writeFileSync(otherDeck, deckText('Paper'));
    const otherDocument = { uri: vscodeStub.Uri.file(otherDeck), getText: () => deckText('Paper') };
    const otherSeat = livePublisher.attach(otherDocument as never, async () => true);
    await livePublisher.liveAction(otherDocument as never, 'on');
    otherSeat.dispose();
    const usageForBoth = [...usage];

    const ownedHtml = fs.readFileSync(pagePath, 'utf8');
    fs.writeFileSync(pagePath, '<main>Someone else’s page</main>');
    await livePublisher.liveAction(document as never, 'on');
    const refusedState = (await livePublisher.stateOf(document as never)).live;
    await livePublisher.liveAction(document as never, 'off');
    fs.writeFileSync(pagePath, ownedHtml);

    const states: string[] = [];
    livePublisher.attach(document as never, async message => {
      if (message.type === 'deck/page-state' && message.state.live) states.push(message.state.live.state);
      return true;
    });
    preference = { on: true, id: 'manual-overlap' };
    const started = new Promise<void>(resolve => { manualStarted = resolve; });
    const manual = livePublisher.publish(document as never, splitFrontMatter(text).content, 'card', [], () => {});
    await started;
    const afterManual = new Promise<void>(resolve => { nextResult = resolve; });
    for (const words of ['First save.', 'Latest save.']) {
      text = deckText('Paper').replace('Welcome, everyone.', words);
      fs.writeFileSync(deckPath, text);
      savedListeners.at(-1)?.(document);
      await new Promise(resolve => setTimeout(resolve, 35));
    }
    const beforeManualFinishes = liveHtml;
    finishManual?.();
    await manual;
    const sentPromptly = await Promise.race([afterManual.then(() => true), new Promise(resolve => setTimeout(() => resolve(false), 500))]);

    const event = ['feature_used', { feature: 'live_deck_update', source: 'deck' }];
    assert.deepEqual(usageForFirstPage, [event]);
    assert.deepEqual(usageForBoth, [event, event]);
    assert.equal(refusedState?.state, 'paused');
    assert.equal(refusedState?.pause?.kind, 'page');
    assert.equal(refusedState?.pause?.detail, foreignPageLine(pagePath));
    assert.equal(beforeManualFinishes.includes('Latest save.'), false);
    assert.equal(states.includes('offline'), false);
    assert.equal(sentPromptly, true, 'the pending save follows the manual publish immediately');
    assert.equal(liveHtml.includes('Latest save.'), true);
    assert.equal(liveHtml.includes('First save.'), false);

    assert.equal(liveFileDisplay('/Users/example/Project/Shared/logo.png', '/Users/example/Project', '/Users/example'), 'Shared/logo.png');
    assert.equal(liveFileDisplay('/Users/example/Shared/logo.png', '/Users/example/Project', '/Users/example'), '~/Shared/logo.png');
    assert.equal(liveFileDisplay('C:/Users/Example/Shared/logo.png', 'c:/users/example/Project', 'c:/users/example'), '~/Shared/logo.png');
    assert.equal(liveFileDisplay('/Users/another/Shared/logo.png', '/Users/example/Project', '/Users/example'), '…/logo.png');

    workspaceRoot = path.join(root, 'unrelated-project');
    fs.mkdirSync(workspaceRoot);
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
      await livePublisher.liveAction(document as never, 'on');
      const state = (await livePublisher.stateOf(document as never)).live;
      assert.equal(state?.state, 'paused');
      assert.equal(state?.pause?.kind, 'page');
      assert.match(state?.pause?.detail ?? '', /project/);
      const checks = rootChecks;
      mock.timers.tick(60_000);
      await new Promise<void>(resolve => setImmediate(resolve));
      assert.equal(rootChecks, checks, 'the outside-project refusal never rechecks on a timer');
    } finally {
      mock.timers.reset();
      workspaceRoot = root;
    }

  } finally {
    livePublisher.dispose();
  }
  console.log('deckPublish: all passed');
}

const deadline = setTimeout(() => { throw new Error('deckPublish test timed out'); }, 8_000);
main().finally(() => clearTimeout(deadline)).catch(error => {
  console.error(error);
  process.exit(1);
});
