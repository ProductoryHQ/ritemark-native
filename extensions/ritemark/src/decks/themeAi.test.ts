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

  await test('review round 1: names, case, ids, a second press and a change from before a reload', async () => {
    // A theme found by the name it holds, not only its file's name: changed in place, never a second file
    write('Slide library/Themes/Brand.theme.md', change.aiThemeText(null, 'Harbour Bank', { bg: '#FFFFFF', head: '#102030', text: '#203040', accent: '#0E7C86' }));
    const inPlace = await ai.setDeckTheme('chat-6', { name: 'harbour bank', fields: { corners: 'round' }, decks: [] });
    assert.match(inPlace.text, /^Changed Slide library\/Themes\/Brand\.theme\.md\./);
    assert.equal(parseTheme(read('Slide library/Themes/Brand.theme.md')).round, 'round');
    assert.equal(exists('Slide library/Themes/harbour bank.theme.md'), false);
    // Evening is the built-in theme: never a project file made by the AI
    const evening = await ai.setDeckTheme('chat-6', { name: 'Evening', fields: FERN, decks: [] });
    assert.ok(evening.isError);
    assert.match(evening.text, /Evening is Ritemark's built-in theme/);
    // A deck named in another case is recorded in its real case: Undo finds it and removes the theme
    const before = read('Fernhollow/Talk.deck.md');
    const cased = await ai.setDeckTheme('chat-7', { name: 'Cased', fields: FERN, decks: ['fernhollow/talk.deck.md'] });
    assert.match(cased.text, /Talk uses it now\./);
    assert.doesNotMatch(cased.text, /keep their themes: [^.]*Talk/, 'the changed deck is not listed as one that keeps its theme');
    const casedId = added.at(-1)!.chip.id;
    assert.match(casedId, /^theme-change-[0-9a-z]+-\d+$/, 'ids carry the window\'s own mark, so an old button never names a newer change');
    // Two presses at once: one Undo, the same answer twice
    const [first, second] = await Promise.all([ai.undo(casedId), ai.undo(casedId)]);
    assert.equal(first, second);
    assert.equal(first, 'Talk has its old theme again. Removed Cased.');
    assert.equal(read('Fernhollow/Talk.deck.md'), before);
    assert.equal(undone.filter(event => event.id === casedId).length, 1, 'one answer in the chat');
    // A button from before a window reload: said in the chat, nothing touched
    const stale = await ai.undo('theme-change-old-1');
    assert.equal(stale, 'This change can no longer be undone here: the window was reloaded since.');
    assert.deepEqual(undone.at(-1), { id: 'theme-change-old-1', words: stale });
  });

  await test('review round 1: a deck only shown becomes a change of its own when a later write points it', async () => {
    // Made in one chat; Talk then names it in another spelling, as a person might write it
    await ai.setDeckTheme('chat-8a', { name: 'Shown', fields: FERN, decks: [] });
    const spelled = change.withThemeLine(DECK, "theme: './Slide library/Themes/Shown.theme.md'");
    write('Fernhollow/Talk.deck.md', spelled);
    const shownBefore = read('Slide library/Themes/Shown.theme.md');
    // Another chat changes the theme with no deck: its record only shows Talk, which draws it already
    await ai.setDeckTheme('chat-8b', { name: 'Shown', fields: { corners: 'round' }, decks: [] });
    const id = added.at(-1)!.chip.id;
    // The same chat then points Talk at it: joined, and Talk is a change of its own now
    await ai.setDeckTheme('chat-8b', { name: 'Shown', fields: {}, decks: ['Fernhollow/Talk.deck.md'] });
    assert.equal(added.at(-1)!.chip.id, id, 'joined');
    assert.equal(await ai.undo(id), 'Talk has its old theme again. Shown is as it was before.');
    assert.equal(read('Fernhollow/Talk.deck.md'), spelled, 'Talk\'s own spelling is back');
    assert.equal(read('Slide library/Themes/Shown.theme.md'), shownBefore);
    write('Fernhollow/Talk.deck.md', DECK);
  });

  await test('review round 1: a colour check\'s Undo with the tab closed says to open it, and can run later', async () => {
    const relative = 'Slide library/Themes/Faint.theme.md';
    const fileText = change.aiThemeText(null, 'Faint', { bg: '#1C1F4A', head: '#FFFFFF', text: '#5A5F8C', accent: '#F2B544' });
    write(relative, fileText);
    const document = { uri: { scheme: 'file', fsPath: path.join(root, ...relative.split('/')) }, text: fileText, isDirty: false, getText() { return this.text; } };
    textDocuments.push(document);
    await ai.setDraftColours('chat-9', relative, { text: '#868AAA' });
    const id = added.at(-1)!.chip.id;
    textDocuments.splice(textDocuments.indexOf(document), 1);
    assert.equal(await ai.undo(id), "Open Faint's tab to undo the colour check: its draft isn't open.");
    textDocuments.push(document);
    assert.equal(await ai.undo(id), "Put Faint's colours back as they were. The draft is as it was before the check.");
    assert.equal(parseTheme(document.text).text, '#5A5F8C');
  });

  await test('Ask mode: set_deck_theme asks on the approval card first, and a no writes nothing', async () => {
    const asked: Array<{ filePath: string; diff?: string }> = [];
    const declined = await ai.setDeckTheme('chat-10', { name: 'Asked', fields: FERN, decks: ['Fernhollow/Talk.deck.md'] }, async request => { asked.push(request); return false; });
    assert.equal(declined.text, 'The user declined the theme change, so nothing was written. Ask what they would like instead.');
    assert.equal(asked[0].filePath, 'Slide library/Themes/Asked.theme.md and 1 deck');
    assert.match(asked[0].diff!, /^Slide library\/Themes\/Asked\.theme\.md \(new\):\n---\nname: Asked/);
    assert.match(asked[0].diff!, /Fernhollow\/Talk\.deck\.md:\n- theme: 'Slide library\/Themes\/Evening\.theme\.md' # the default\n\+ theme: Slide library\/Themes\/Asked\.theme\.md$/);
    assert.equal(exists('Slide library/Themes/Asked.theme.md'), false);
    assert.equal(read('Fernhollow/Talk.deck.md'), DECK);
    const approved = await ai.setDeckTheme('chat-10', { name: 'Asked', fields: FERN, decks: ['Fernhollow/Talk.deck.md'] }, async () => true);
    assert.match(approved.text, /^Made Slide library\/Themes\/Asked\.theme\.md\./);
    await ai.undo(added.at(-1)!.chip.id);
    assert.equal(read('Fernhollow/Talk.deck.md'), DECK);
  });

  await test('review round 2: a front matter with blanks after its opener, an empty one, and one the change made', () => {
    const line = change.themeLineFor('Slide library/Themes/X.theme.md');
    const spaced = '--- \ndeck: 2\n---\nbody\n';
    const pointed = change.withThemeLine(spaced, line);
    assert.equal(pointed, `--- \ndeck: 2\n${line}\n---\nbody\n`);
    assert.equal(change.withThemeLine(pointed, null), spaced);
    const empty = '---\n---\nbody\n';
    assert.equal(change.withThemeLine(empty, line), `---\n${line}\n---\nbody\n`);
    assert.equal(change.withThemeLine(change.withThemeLine(empty, line), null), empty, 'an empty front matter stays one');
    const bare = '# Hi\n';
    const made = change.withThemeLine(bare, line);
    assert.equal(change.withThemeLine(made, null, { dropEmpty: true }), bare, 'a front matter the change made goes with Undo');
    const crlf = '---\r\ndeck: 2\r\n---\r\nbody\r\n';
    assert.equal(change.withThemeLine(change.withThemeLine(crlf, line), null), crlf);
  });

  await test('review round 2: Undo gives a deck without front matter back byte for byte', async () => {
    write('Fernhollow/Bare.deck.md', '```slide\n# Bare\n```\n');
    await ai.setDeckTheme('chat-11', { name: 'Bare look', fields: FERN, decks: ['Fernhollow/Bare.deck.md'] });
    assert.ok(read('Fernhollow/Bare.deck.md').startsWith('---\ntheme: Slide library/Themes/Bare look.theme.md\n---\n'));
    assert.equal(await ai.undo(added.at(-1)!.chip.id), 'Bare has its old theme again. Removed Bare look.');
    assert.equal(read('Fernhollow/Bare.deck.md'), '```slide\n# Bare\n```\n');
    fs.unlinkSync(path.join(root, 'Fernhollow/Bare.deck.md'));
  });

  await test('review round 2: Ask mode reads again after the card: the person\'s words kept, a theme changed meanwhile stops it', async () => {
    // The person types in the deck while the card waits: their words stay, only the line changes
    const typed = await ai.setDeckTheme('chat-12', { name: 'Waited', fields: FERN, decks: ['Fernhollow/Talk.deck.md'] }, async () => {
      write('Fernhollow/Talk.deck.md', DECK + 'A line typed meanwhile.\r\n');
      return true;
    });
    assert.match(typed.text, /^Made /);
    assert.ok(read('Fernhollow/Talk.deck.md').endsWith('A line typed meanwhile.\r\n'));
    assert.equal(change.themeLineOf(read('Fernhollow/Talk.deck.md')), 'theme: Slide library/Themes/Waited.theme.md');
    await ai.undo(added.at(-1)!.chip.id);
    assert.equal(read('Fernhollow/Talk.deck.md'), DECK + 'A line typed meanwhile.\r\n');
    write('Fernhollow/Talk.deck.md', DECK);
    // The theme is changed while the card waits: nothing is written
    write('Slide library/Themes/Steady.theme.md', change.aiThemeText(null, 'Steady', { bg: '#FFFFFF', head: '#102030', text: '#203040', accent: '#0E7C86' }));
    const stopped = await ai.setDeckTheme('chat-12', { name: 'Steady', fields: { corners: 'round' }, decks: ['Fernhollow/Talk.deck.md'] }, async () => {
      write('Slide library/Themes/Steady.theme.md', read('Slide library/Themes/Steady.theme.md').replace('#0E7C86', '#0E7C87'));
      return true;
    });
    assert.ok(stopped.isError);
    assert.match(stopped.text, /^Steady changed while the user was asked, so nothing was written\./);
    assert.equal(read('Fernhollow/Talk.deck.md'), DECK);
    assert.equal(parseTheme(read('Slide library/Themes/Steady.theme.md')).round, 'soft');
  });

  await test('Fix the colours: each failing pair reaches its ratio, its hue kept, and nothing else moves', () => {
    // Text too faint and the accent too dark on Evening's ground; headings pass
    const faint = parseTheme(change.aiThemeText(BUILT_IN_THEME_TEXT, 'Evening', { text: '#5A5F8C', accent: '#4A3A10' }));
    const fix = change.colourFixes(faint);
    assert.deepEqual(fix.moved.map(entry => entry.field), ['text', 'accent'], 'only the failing colours move');
    assert.equal(fix.changes.head, undefined);
    assert.equal(fix.changes.bg, undefined);
    const fixed = parseTheme(change.aiThemeText(BUILT_IN_THEME_TEXT, 'Evening', { text: '#5A5F8C', accent: '#4A3A10', ...fix.changes }));
    assert.ok(change.colourPairs(fixed).every(pair => pair.ok), 'every pair passes after the fix');
    for (const entry of fix.moved) {
      assert.ok(entry.toRatio >= (entry.field === 'accent' ? 3 : 4.5) && entry.fromRatio < entry.toRatio);
      assert.ok(Math.abs(change.hueOf(entry.from) - change.hueOf(entry.to)) < 0.02, `${entry.field}'s hue kept (${entry.from} → ${entry.to})`);
    }
    // The least move: one step less lightness would not pass
    const text = fix.moved[0];
    assert.ok(text.toRatio < 4.8, `just far enough (${text.toRatio.toFixed(2)})`);
    // Light ground: the text goes darker, not lighter
    const paper = parseTheme(change.aiThemeText(null, 'Paper', { bg: '#FFFFFF', head: '#14213D', text: '#9AA3B5', accent: '#0E7C86' }));
    const darker = change.colourFixes(paper).moved.find(entry => entry.field === 'text')!;
    assert.ok(change.colourPairs(paper)[0].ratio < 4.5);
    assert.ok(parseInt(darker.to.slice(1, 3), 16) < parseInt(darker.from.slice(1, 3), 16), `darker on white (${darker.from} → ${darker.to})`);
    // A theme that passes moves nothing
    assert.deepEqual(change.colourFixes(BUILT_IN_THEME).moved, []);
  });

  await test('Fix the colours leaves a pair it can\'t fix as it is, and says so', () => {
    // On any ground black or white reaches 4.5 : 1 (the worst ground gives 4.58), so with these rules a colour of the four
    // can always be fixed by its lightness; a ratio no lightness reaches gives no fix
    assert.equal(change.lightnessFix('#9A9A9A', '#777777', 7), null, 'neither white nor black reads at 7 : 1 on #777777');
    // What no field of the four moves: a hand-picked borderless shade that fails. It is left, and the line says why
    const shaded = parseTheme(BUILT_IN_THEME_TEXT.replace('  tx: "#33365A"', '  tx: "#C0C2D8"'));
    const fix = change.colourFixes(shaded);
    assert.deepEqual(fix.moved, []);
    assert.deepEqual(fix.shades, ['Text, borderless']);
    assert.match(change.checkWords(shaded, fix), /Left as it is: text, borderless \(the theme's own borderless shades; change a colour to have them worked out again\)\./);
  });

  await test('Fix the colours in the tab: into the draft only, with its sheet naming what moved; Check all colours only measures', async () => {
    const relative = 'Slide library/Themes/Muted.theme.md';
    const fileText = change.aiThemeText(null, 'Muted', { bg: '#1C1F4A', head: '#FFFFFF', text: '#5A5F8C', accent: '#F2B544' });
    write(relative, fileText);
    const document = { uri: { scheme: 'file', fsPath: path.join(root, ...relative.split('/')) }, text: fileText, isDirty: false, getText() { return this.text; } };
    textDocuments.push(document);
    const shown: unknown[] = [];
    themes.showChange = async (_fsPath: string, build: (webview: unknown) => unknown) => { shown.push(build({ asWebviewUri: () => '' })); return true; };
    // Check all colours: measures, changes nothing
    const checked = await ai.checkColoursInTab(document as never, false);
    assert.equal(checked, 'One pair fails: text 2.5 to 1.');
    assert.equal(document.text, fileText);
    // Fix the colours: the draft only, never the file, and nothing to the chat
    const before = added.length;
    const words = await ai.checkColoursInTab(document as never, true);
    assert.match(words, /^Moved text #5A5F8C → #[0-9A-F]{6}\. Not saved yet\.$/);
    assert.ok(document.isDirty);
    assert.equal(read(relative), fileText, 'the file is untouched until Save');
    assert.equal(added.length, before, 'nothing goes to a chat');
    const sheet = shown.at(-1) as { moved: Array<{ label: string; from: string; to: string; fromRatio: number; toRatio: number }>; id: string };
    assert.equal(sheet.moved.length, 1);
    assert.equal(sheet.moved[0].label, 'Text');
    assert.equal(sheet.moved[0].from, '#5A5F8C');
    assert.ok(sheet.moved[0].fromRatio < 4.5 && sheet.moved[0].toRatio >= 4.5);
    // The sheet's Undo puts the draft back
    assert.equal(await ai.undo(sheet.id), "Put Muted's colours back as they were. The draft is as it was before the check.");
    assert.equal(parseTheme(document.text).text, '#5A5F8C');
  });

  fs.rmSync(root, { recursive: true, force: true });
  console.log(`themeAi: ${passed} passed`);
}

void main().catch(error => {
  fs.rmSync(root, { recursive: true, force: true });
  console.error(error);
  process.exit(1);
});
