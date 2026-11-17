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
import { makeTempDir } from '../testing/tempDir';

// ── A small vscode for the host module: a project folder on disk, one open deck, 2.2's page state ──
const root = makeTempDir('ritemark-deck-publish-');
const none = () => ({ dispose() {} });
const changeListeners: Array<(event: { document: unknown }) => void> = [];
let pageStateAsks = 0;
let bar: { kind: 'unpublished' | 'published'; changed: boolean } = { kind: 'unpublished', changed: false };
const vscodeStub = {
  Uri: { file: (fsPath: string) => ({ scheme: 'file', fsPath, toString: () => `file://${fsPath}` }) },
  workspace: {
    get workspaceFolders() { return [{ uri: { scheme: 'file', fsPath: root } }]; },
    getWorkspaceFolder: () => ({ uri: { scheme: 'file', fsPath: root } }),
    textDocuments: [],
    onDidChangeTextDocument: (listener: (event: { document: unknown }) => void) => { changeListeners.push(listener); return { dispose() {} }; },
    onDidChangeConfiguration: none,
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
const load = (Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown })._load;
// Node can't import a .css file (esbuild inlines it): the page's slide rules, read from disk as the page tests do.
const slideCss = fs.readFileSync(path.resolve(__dirname, '..', '..', 'webview', 'src', 'components', 'decks', 'slide', 'slide.css'), 'utf8');
(Module as unknown as { _load: unknown })._load = (request: string, ...rest: unknown[]) => {
  if (request === 'vscode') return vscodeStub;
  if (request.endsWith('/slide/slide.css')) return { __esModule: true, default: slideCss };
  return load(request, ...rest);
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DeckPublisher } = require('./deckPublish') as typeof import('./deckPublish');
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
  console.log('deckPublish: all passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
