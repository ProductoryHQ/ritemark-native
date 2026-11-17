/**
 * Sprint 162 PR 5 (step-3-themes.md, "Making a theme" and "The AI and themes"; frame 13): the AI's theme changes.
 *   - A deck's `theme:` line changes alone, and its old line puts the deck back byte for byte.
 *   - The colour check's five pairs on Card and Borderless, and the nearest colour that passes.
 *   - set_deck_theme makes the theme file and points the deck at it, recorded under the chat it came from; Undo puts the
 *     deck back and removes the new theme when no deck uses it; it keeps the theme when the person changed it since, or
 *     another deck uses it, and says so.
 *   - set_theme_draft_colours moves colours in the open tab's draft only: the file on disk is untouched until Save.
 *   - See what changed's two slides: the first, and the first with Boxes, Steps or Columns, else the second.
 *
 * Run: npx tsx src/decks/themeAi.test.ts
 */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import Module from 'node:module';

// ── A small vscode for the host module: a project folder on disk, documents the test opens ──
class EventEmitter<T> {
  private listeners: Array<(value: T) => void> = [];
  event = (listener: (value: T) => void) => {
    this.listeners.push(listener);
    return { dispose: () => { this.listeners = this.listeners.filter(entry => entry !== listener); } };
  };
  fire(value: T): void { for (const listener of [...this.listeners]) listener(value); }
  dispose(): void { this.listeners = []; }
}
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-theme-ai-'));
const textDocuments: Array<{ uri: { scheme: string; fsPath: string }; getText(): string; isDirty: boolean }> = [];
const none = () => ({ dispose() {} });
const vscodeStub = {
  EventEmitter,
  Uri: { file: (fsPath: string) => ({ scheme: 'file', fsPath, toString: () => `file://${fsPath}` }) },
  RelativePattern: class { constructor(public base: unknown, public pattern: string) {} },
  workspace: {
    get workspaceFolders() { return [{ uri: { scheme: 'file', fsPath: root } }]; },
    getWorkspaceFolder: () => ({ uri: { scheme: 'file', fsPath: root } }),
    textDocuments,
    onDidChangeTextDocument: none,
    onDidSaveTextDocument: none,
    fs: { delete: async (uri: { fsPath: string }) => fs.promises.unlink(uri.fsPath) },
    getConfiguration: () => ({ get: (_key: string, fallback?: unknown) => fallback }),
  },
  window: { tabGroups: { all: [] }, showInformationMessage: async () => undefined },
  commands: { executeCommand: async () => undefined },
};
const load = (Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown })._load;
(Module as unknown as { _load: unknown })._load = (request: string, ...rest: unknown[]) => (request === 'vscode' ? vscodeStub : load(request, ...rest));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ThemeAi } = require('./themeAi') as typeof import('./themeAi');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const change = require('./themeChange') as typeof import('./themeChange');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { BUILT_IN_THEME, BUILT_IN_THEME_TEXT, parseTheme } = require('./deckTheme') as typeof import('./deckTheme');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { frontMatterField } = require('./deckFormat') as typeof import('./deckFormat');

let passed = 0;
async function test(name: string, run: () => void | Promise<void>) {
  try {
    await run();
    passed++;
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

const write = (relative: string, text: string) => {
  const absolute = path.join(root, ...relative.split('/'));
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, text);
};
const read = (relative: string) => fs.readFileSync(path.join(root, ...relative.split('/')), 'utf8');
const exists = (relative: string) => fs.existsSync(path.join(root, ...relative.split('/')));

/** The project's decks, as `DeckLibrary.deckThemeList` gives them. */
const library = {
  async deckThemeList() {
    const out: Array<{ path: string; theme: string | null; text: string; modified: number }> = [];
    const walk = (folder: string) => {
      for (const entry of fs.readdirSync(path.join(root, folder), { withFileTypes: true })) {
        const relative = folder ? `${folder}/${entry.name}` : entry.name;
        if (entry.isDirectory()) walk(relative);
        else if (entry.name.endsWith('.deck.md')) {
          const text = read(relative);
          out.push({ path: relative, theme: frontMatterField(text, 'theme'), text, modified: 0 });
        }
      }
    };
    walk('');
    return out;
  },
};
const pagesSeen: string[] = [];
const pages = { themeFilesChanged: async (changed: string) => { pagesSeen.push(changed); }, themeChangeWhenShown: () => undefined };
/** The theme's tab: its document's text is the draft; a change is never saved. */
const themes = {
  hasView: (document: unknown) => textDocuments.includes(document as never),
  draftChange: async (document: { text?: string; isDirty: boolean }, text: string) => { document.text = text; document.isDirty = true; return true; },
  showChange: async () => true,
  open: async () => undefined,
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ai = new ThemeAi(() => library as any, pages as any, themes as any);
const added: Array<{ conversationId: string; chip: { id: string; kind: string; themeName: string } }> = [];
ai.onDidAdd(event => added.push(event));
const undone: Array<{ id: string; words: string }> = [];
ai.onDidUndo(event => undone.push(event));

const DECK = [
  '---',
  'deck: 2',
  "theme: 'Slide library/Themes/Evening.theme.md' # the default",
  'look: card',
  '---',
  '',
  '```slide',
  '# AI assistants and agents',
  '```',
  '',
  '```slide',
  '# Today',
  '- Why agents?',
  '```',
  '',
  '```slide',
  '# Four parts',
  ':::: boxes',
  '::: box',
  '### Instructions',
  ':::',
  '::::',
  '```',
  '',
].join('\r\n');

const FERN = { background: '#F4F7F2', headings: '#14301F', text: '#2B3A30', accent: '#2E7D4F', heading_font: 'Source Serif 4', text_font: 'Inter', corners: 'square' as const };

async function main() {
  await test('a deck\'s theme line changes alone, and the old line puts it back byte for byte', () => {
    assert.equal(change.themeLineOf(DECK), "theme: 'Slide library/Themes/Evening.theme.md' # the default");
    const line = change.themeLineFor('Slide library/Themes/Fernhollow Bank.theme.md');
    assert.equal(line, 'theme: Slide library/Themes/Fernhollow Bank.theme.md');
    const pointed = change.withThemeLine(DECK, line);
    assert.equal(pointed, DECK.replace("theme: 'Slide library/Themes/Evening.theme.md' # the default", line), 'only that line, CRLF kept');
    assert.equal(change.withThemeLine(pointed, change.themeLineOf(DECK)), DECK, 'back byte for byte');
    // No line: added after `deck:`, and taken out again
    const bare = '---\ndeck: 2\nlook: card\n---\n\nbody\n';
    const added = change.withThemeLine(bare, line);
    assert.equal(added, `---\ndeck: 2\n${line}\nlook: card\n---\n\nbody\n`);
    assert.equal(change.withThemeLine(added, null), bare);
    // No front matter: one is made, and taken out again leaves the line's front matter only
    assert.equal(change.withThemeLine('# Hi\n', line), `---\n${line}\n---\n# Hi\n`);
    assert.equal(frontMatterField(change.withThemeLine('# Hi\n', line), 'theme'), 'Slide library/Themes/Fernhollow Bank.theme.md');
  });

  await test('the colour check measures five pairs on Card and Borderless', () => {
    const pairs = change.colourPairs(BUILT_IN_THEME);
    assert.deepEqual(pairs.map(pair => [pair.label, pair.look, pair.min]), [
      ['Text', 'card', 4.5], ['Headings', 'card', 4.5], ['Accent, as words', 'card', 3], ['Text, borderless', 'borderless', 4.5], ['Accent, borderless', 'borderless', 3],
    ]);
    assert.ok(pairs.every(pair => pair.ok), 'Evening passes all five');
    // A faint text and a dark accent on Evening's ground: those two fail, and only they get a fix
    const faint = parseTheme(change.aiThemeText(BUILT_IN_THEME_TEXT, 'Evening', { text: '#5A5F8C', accent: '#4A3A10' }));
    const failing = change.colourPairs(faint).filter(pair => !pair.ok).map(pair => pair.label);
    assert.deepEqual(failing, ['Text', 'Accent, as words']);
    const fixes = change.suggestedFixes(faint);
    assert.deepEqual(fixes.map(fix => fix.field), ['text', 'accent']);
    for (const fix of fixes) {
      const min = fix.field === 'accent' ? 3 : 4.5;
      const moved = parseTheme(change.aiThemeText(BUILT_IN_THEME_TEXT, 'Evening', { [fix.field]: fix.to }));
      assert.ok(change.colourPairs(moved).find(pair => pair.field === fix.field)!.ratio >= min, `${fix.field} passes after the fix`);
      assert.ok(fix.to !== fix.from);
    }
    // Just far enough: no more than a little past the rule
    const text = change.colourPairs(parseTheme(change.aiThemeText(BUILT_IN_THEME_TEXT, 'Evening', { text: fixes[0].to })))[0];
    assert.ok(text.ratio < 5.2, `moved just far enough (${text.ratio.toFixed(2)})`);
    // A ground no colour reads on gives no fix
    assert.equal(change.passingColour('#808080', '#777777', 21), null);
  });

  await test('See what changed shows the first slide and the first with Boxes, Steps or Columns', () => {
    const slide = (kind: string, markdown = '') => ({ kind, data: { markdown } });
    assert.deepEqual(change.changeSlideIndexes([slide(''), slide('', '# Today'), slide('', '# Parts\n:::: boxes\n::: box\n:::\n::::')]), [0, 2]);
    assert.deepEqual(change.changeSlideIndexes([slide(''), slide('', '::: {.steps tag=""}\n1. a\n:::')]), [0, 1]);
    assert.deepEqual(change.changeSlideIndexes([slide('title'), slide('points'), slide('columns')]), [0, 2]);
    assert.deepEqual(change.changeSlideIndexes([slide(''), slide('', '# a'), slide('', '# b')]), [0, 1], 'else the second');
    assert.deepEqual(change.changeSlideIndexes([slide('')]), [0]);
    assert.deepEqual(change.changeSlideIndexes([]), []);
  });

  await test('set_deck_theme makes the theme, points the deck, and records it under the chat', async () => {
    write('Fernhollow/Talk.deck.md', DECK);
    write('Fernhollow/Other.deck.md', '---\ndeck: 2\n---\n\n```slide\n# Other\n```\n');
    const result = await ai.setDeckTheme('chat-1', { name: 'Fernhollow Bank', fields: FERN, decks: ['Fernhollow/Talk.deck.md'] });
    assert.ok(!result.isError, result.text);
    assert.match(result.text, /^Made Slide library\/Themes\/Fernhollow Bank\.theme\.md\./);
    assert.match(result.text, /Talk uses it now\./);
    assert.match(result.text, /Other decks in the project keep their themes: Other\./);
    assert.match(result.text, /All five pairs pass\./);
    const theme = parseTheme(read('Slide library/Themes/Fernhollow Bank.theme.md'));
    assert.deepEqual([theme.name, theme.bg, theme.head, theme.text, theme.accent, theme.fh, theme.fb, theme.round], ['Fernhollow Bank', '#F4F7F2', '#14301F', '#2B3A30', '#2E7D4F', 'Source Serif 4', 'Inter', 'square']);
    assert.ok(!read('Slide library/Themes/Fernhollow Bank.theme.md').includes('card:'), 'Evening\'s hand-picked shades go with its colours');
    assert.equal(change.themeLineOf(read('Fernhollow/Talk.deck.md')), 'theme: Slide library/Themes/Fernhollow Bank.theme.md');
    assert.equal(read('Fernhollow/Other.deck.md').includes('theme:'), false, 'the other deck is left alone');
    assert.equal(added.length, 1);
    assert.deepEqual(added[0].conversationId, 'chat-1');
    assert.deepEqual({ kind: added[0].chip.kind, themeName: added[0].chip.themeName }, { kind: 'theme', themeName: 'Fernhollow Bank' });
    // A second write of the same theme in the same chat joins the record: one Undo takes both back
    const again = await ai.setDeckTheme('chat-1', { name: 'Fernhollow Bank', fields: { boxes: 'outline' }, decks: [] });
    assert.ok(!again.isError, again.text);
    assert.match(again.text, /^Changed /);
    assert.equal(added.length, 1, 'joined, not a second record');
    assert.equal(parseTheme(read('Slide library/Themes/Fernhollow Bank.theme.md')).boxes, 'outline');
  });

  await test('Undo puts the deck back byte for byte and removes the new theme no deck uses', async () => {
    const words = await ai.undo(added[0].chip.id);
    assert.equal(read('Fernhollow/Talk.deck.md'), DECK);
    assert.equal(exists('Slide library/Themes/Fernhollow Bank.theme.md'), false);
    assert.equal(words, 'Talk has its old theme again. Removed Fernhollow Bank.');
    assert.deepEqual(undone.at(-1), { id: added[0].chip.id, words });
    assert.equal(await ai.undo(added[0].chip.id), 'Already undone.');
  });

  await test('Undo keeps a theme the person changed since, and one another deck uses', async () => {
    await ai.setDeckTheme('chat-2', { name: 'Fernhollow Bank', fields: FERN, decks: ['Fernhollow/Talk.deck.md'] });
    const changed = added.at(-1)!.chip.id;
    write('Slide library/Themes/Fernhollow Bank.theme.md', read('Slide library/Themes/Fernhollow Bank.theme.md').replace('#2E7D4F', '#2E7D50'));
    assert.equal(await ai.undo(changed), 'Talk has its old theme again. Kept Fernhollow Bank: you changed it after I made it.');
    assert.equal(read('Fernhollow/Talk.deck.md'), DECK);
    assert.ok(exists('Slide library/Themes/Fernhollow Bank.theme.md'));
    fs.unlinkSync(path.join(root, 'Slide library/Themes/Fernhollow Bank.theme.md'));

    await ai.setDeckTheme('chat-3', { name: 'Fernhollow Bank', fields: FERN, decks: ['Fernhollow/Talk.deck.md'] });
    const used = added.at(-1)!.chip.id;
    // The person points the other deck at it by hand meanwhile
    write('Fernhollow/Other.deck.md', change.withThemeLine(read('Fernhollow/Other.deck.md'), change.themeLineFor('Slide library/Themes/Fernhollow Bank.theme.md')));
    assert.equal(await ai.undo(used), 'Talk has its old theme again. Kept Fernhollow Bank: another deck uses it.');
    assert.ok(exists('Slide library/Themes/Fernhollow Bank.theme.md'));
  });

  await test('refuses what it can\'t write: a font not of the six, a bad name, a new theme without its colours', async () => {
    const futura = await ai.setDeckTheme('chat-4', { name: 'Brand', fields: { ...FERN, heading_font: 'Futura' }, decks: [] });
    assert.ok(futura.isError);
    assert.match(futura.text, /one of the six fonts Ritemark ships: Sofia Sans, Inter, IBM Plex Sans, Space Grotesk, Source Serif 4, Fraunces/);
    assert.ok((await ai.setDeckTheme('chat-4', { name: 'a/b', fields: FERN, decks: [] })).isError);
    const half = await ai.setDeckTheme('chat-4', { name: 'Half', fields: { background: '#FFFFFF' }, decks: [] });
    assert.equal(half.text, 'A new theme needs all four colours. Missing: headings, text, accent.');
    await assert.rejects(ai.setDeckTheme('chat-4', { name: 'Brand', fields: FERN, decks: ['../outside.deck.md'] }), /is not inside this project/, 'the tool answers it as an error (runTool)');
    assert.equal(exists('Slide library/Themes/Brand.theme.md'), false, 'nothing written for a refused deck');
  });

  await test('the colour check moves colours in the open tab\'s draft only, and its Undo puts them back', async () => {
    const relative = 'Slide library/Themes/Dim.theme.md';
    const fileText = change.aiThemeText(null, 'Dim', { bg: '#1C1F4A', head: '#FFFFFF', text: '#5A5F8C', accent: '#F2B544' });
    write(relative, fileText);
    // Not open in its tab: no draft to change
    const closed = await ai.setDraftColours('chat-5', relative, { text: '#C9CBE6' });
    assert.ok(closed.isError);
    assert.match(closed.text, /isn't open in its tab/);
    const document = {
      uri: { scheme: 'file', fsPath: path.join(root, ...relative.split('/')) },
      text: fileText,
      isDirty: false,
      getText() { return this.text; },
    };
    textDocuments.push(document);
    const check = await ai.checkColours(relative);
    assert.match(check.text, /Text \(card\): #5A5F8C on #1C1F4A, [0-9.]+ to 1, needs 4.5 to 1: FAILS/);
    assert.match(check.text, /The nearest colours that pass: text #5A5F8C → #[0-9A-F]{6}\./);
    const to = /text #5A5F8C → (#[0-9A-F]{6})/.exec(check.text)![1];
    const result = await ai.setDraftColours('chat-5', relative, { text: to });
    assert.ok(!result.isError, result.text);
    assert.match(result.text, new RegExp(`^Moved in Dim's draft \\(not saved\\): text #5A5F8C → ${to}\\.`));
    assert.equal(parseTheme(document.text).text, to, 'the draft has the new colour');
    assert.ok(document.isDirty, 'the tab shows Not saved');
    assert.equal(read(relative), fileText, 'the file on disk is untouched until Save');
    const chip = added.at(-1)!;
    assert.deepEqual({ conversationId: chip.conversationId, kind: chip.chip.kind, themeName: chip.chip.themeName }, { conversationId: 'chat-5', kind: 'draft', themeName: 'Dim' });
    assert.equal(await ai.undo(chip.chip.id), "Put Dim's colours back as they were. The draft is as it was before the check.");
    assert.equal(parseTheme(document.text).text, '#5A5F8C');
    assert.equal(read(relative), fileText);
  });

  await test('the colour check asks the open chat in the person\'s words', () => {
    let asked = '';
    ai.onDidAsk(event => { asked = event.text; });
    ai.askColourCheck('Slide library/Themes/Dim.theme.md', 'Dim');
    assert.match(asked, /^Check that the colours of Dim \(Slide library\/Themes\/Dim\.theme\.md\) are easy to read: measure the five pairs with check_theme_colours, and move only the colours that fail into the theme's draft with set_theme_draft_colours/);
  });

  fs.rmSync(root, { recursive: true, force: true });
  console.log(`themeAi: ${passed} passed`);
}

void main().catch(error => {
  fs.rmSync(root, { recursive: true, force: true });
  console.error(error);
  process.exit(1);
});
