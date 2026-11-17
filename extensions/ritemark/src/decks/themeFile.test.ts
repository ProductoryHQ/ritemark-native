/**
 * Sprint 162 PR 2 (README "Saving a theme"; frames 11, 14, 18): writing a theme file from the theme's tab.
 *   - A draft's change rewrites only the lines of the fields that changed, in the quotes they had, and reads back as the
 *     change; a colour change also takes out the hand-picked shades (picked for the old colours).
 *   - A theme opened and saved without a change is byte for byte, CRLF and comments with it.
 *   - Save as a new theme… leaves the old file, and the decks that draw it, as they were.
 *   - New theme… from Paper, Ember and the deck's own theme gives a valid file by the name rule.
 *   - The tab's requests are decoded with exact fields; which files open as a theme's tab; the six preview slides.
 *
 * Run: npx tsx src/decks/themeFile.test.ts
 */
import assert from 'node:assert/strict';
import { BUILT_IN_THEME, BUILT_IN_THEME_PATH, BUILT_IN_THEME_TEXT, isThemePath, parseTheme, themeEntries, themeKeyOf } from './deckTheme';
import {
  changedFields, EMBER_THEME_TEXT, isThemeChanges, newThemeNameProblem, newThemeText, nextThemeName, normalColour, PAPER_THEME_TEXT,
  startTheme, themeNameProblem, themePathFor, themeTextWith,
} from './themeFile';
import { decodeThemeRequest, ThemeProtocolError } from './themeProtocol';
import { isLibraryThemePath, themeModeOf } from './deckMode';
import { deckPreview, previewSlidesOf, SAMPLE_DECK_TEXT } from './themePreview';
import { presentSlidesOf } from './present/presentSession';

let passed = 0;
function test(name: string, run: () => void) {
  try {
    run();
    passed++;
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

/** The lines of `after` that differ from `before`'s, by place (both the same length). */
function changedLines(before: string, after: string): string[] {
  const a = before.split('\n');
  const b = after.split('\n');
  assert.equal(a.length, b.length, 'the same number of lines');
  return b.filter((line, index) => line !== a[index]);
}

const FERN = [
  '---',
  '# Fernhollow Bank, from its brand guide',
  "name: 'Fernhollow Bank'",
  "background: '#F4F8F5'",
  'headings: "#10261E"  # ink',
  'text: "#2F4A40"',
  'accent: "#1F8A5B"',
  'soft-light: false',
  'heading-font: Source Serif 4',
  'text-font: Inter',
  'corners: square',
  'boxes: filled',
  '---',
  '',
].join('\n');

test('a change rewrites only its own line, and reads back as the change', () => {
  const after = themeTextWith(FERN, { round: 'round' });
  assert.deepEqual(changedLines(FERN, after), ['corners: round']);
  assert.equal(parseTheme(after).round, 'round');
  const glow = themeTextWith(after, { glow: true, boxes: 'outline' });
  assert.deepEqual(changedLines(after, glow), ['soft-light: true', 'boxes: outline']);
  const read = parseTheme(glow);
  assert.deepEqual([read.glow, read.boxes, read.round, read.name, read.fh], [true, 'outline', 'round', 'Fernhollow Bank', 'Source Serif 4']);
});

test('a colour keeps its line\'s quotes and its comment; a colour is written in capitals', () => {
  const background = themeTextWith(FERN, { bg: '#ffffff' });
  assert.deepEqual(changedLines(FERN, background), ["background: '#FFFFFF'"]);
  const headings = themeTextWith(FERN, { head: '#000000' });
  assert.deepEqual(changedLines(FERN, headings), ['headings: "#000000"  # ink']);
  assert.equal(parseTheme(headings).head, '#000000');
  assert.equal(parseTheme(background).bg, '#FFFFFF');
});

test('the draft, then Save: only the edited fields change, and the file reads back as the draft', () => {
  // Three changes in the tab, one of them changed back: the file differs from the original in the other two lines only.
  let draft = themeTextWith(FERN, { accent: '#D9467A' });
  draft = themeTextWith(draft, { round: 'soft' });
  draft = themeTextWith(draft, { accent: '#1F8A5B' });
  draft = themeTextWith(draft, { boxes: 'outline' });
  assert.deepEqual(changedLines(FERN, draft), ['corners: soft', 'boxes: outline']);
  const read = parseTheme(draft);
  assert.deepEqual({ ...read, card: undefined, borderless: undefined }, { ...parseTheme(FERN), round: 'soft', boxes: 'outline', card: undefined, borderless: undefined });
});

test('opened and saved without a change: byte for byte (also CRLF, a BOM-less file, a same value in other case)', () => {
  assert.equal(themeTextWith(FERN, {}), FERN);
  assert.equal(themeTextWith(FERN, { accent: '#1f8a5b', round: 'square', glow: false }), FERN, 'the same values are no change');
  const crlf = FERN.replace(/\n/g, '\r\n');
  assert.equal(themeTextWith(crlf, {}), crlf);
  const changed = themeTextWith(crlf, { round: 'round' });
  assert.equal(changed, crlf.replace('corners: square', 'corners: round'), 'CRLF stays CRLF');
  assert.equal(themeTextWith(BUILT_IN_THEME_TEXT, { bg: '#1c1f4a' }), BUILT_IN_THEME_TEXT);
});

test('a colour change takes the hand-picked shades out; any other change keeps them', () => {
  const corners = themeTextWith(BUILT_IN_THEME_TEXT, { round: 'square' });
  assert.deepEqual(changedLines(BUILT_IN_THEME_TEXT, corners), ['corners: square']);
  assert.ok(parseTheme(corners).card && parseTheme(corners).borderless, 'shades kept');
  const accent = themeTextWith(BUILT_IN_THEME_TEXT, { accent: '#FF7A45' });
  const read = parseTheme(accent);
  assert.equal(read.accent, '#FF7A45');
  assert.equal(read.card, undefined);
  assert.equal(read.borderless, undefined);
  assert.ok(!/^card:|^borderless:|^\s+g1:/m.test(accent));
  // Every other line is the built-in's own, in its order.
  const kept = BUILT_IN_THEME_TEXT.split('\n').filter(line => !/^(card|borderless):$|^\s+\S/.test(line)).map(line => line.replace('"#F2B544"', '"#FF7A45"'));
  assert.deepEqual(accent.split('\n'), kept);
});

test('a key the file lacks is added before its shade sections; a key named twice is changed where the reader takes it', () => {
  const short = '---\nname: Plain\nbackground: "#FFFFFF"\ncard:\n  g1: "#EEEEEE"\n---\n';
  const added = themeTextWith(short, { boxes: 'outline' });
  assert.equal(added, '---\nname: Plain\nbackground: "#FFFFFF"\nboxes: outline\ncard:\n  g1: "#EEEEEE"\n---\n');
  const twice = '---\nname: Twice\ncorners: soft\ncorners: round\n---\n';
  assert.equal(themeTextWith(twice, { round: 'square' }), '---\nname: Twice\ncorners: soft\ncorners: square\n---\n');
  assert.equal(parseTheme(themeTextWith(twice, { round: 'square' })).round, 'square');
  const bare = 'Notes about the theme.\n';
  const fronted = themeTextWith(bare, { accent: '#0E7C86' });
  assert.equal(fronted, '---\naccent: "#0E7C86"\n---\nNotes about the theme.\n');
  assert.equal(parseTheme(fronted).accent, '#0E7C86');
});

test('Save as a new theme… leaves the old file and its decks as they were', () => {
  const oldPath = 'Slide library/Themes/Fernhollow Bank.theme.md';
  const draft = themeTextWith(FERN, { accent: '#D9467A' });
  const name = nextThemeName('Fernhollow Bank', { names: ['Fernhollow Bank', 'Evening'], files: ['Fernhollow Bank.theme.md'] });
  assert.equal(name, 'Fernhollow Bank 2');
  const copy = themeTextWith(draft, { name });
  const newPath = themePathFor(name);
  // The new file has the draft's look and the new name; the old file's text is the one on disk, unchanged.
  assert.deepEqual([parseTheme(copy).name, parseTheme(copy).accent], ['Fernhollow Bank 2', '#D9467A']);
  assert.deepEqual(changedLines(draft, copy), ["name: 'Fernhollow Bank 2'"]);
  assert.equal(parseTheme(FERN).accent, '#1F8A5B');
  // The decks that name the old file still draw it; the new one is drawn by none until a deck picks it.
  const entries = themeEntries([{ path: oldPath, text: FERN }, { path: newPath, text: copy }], [oldPath, oldPath, null]);
  assert.deepEqual(entries.map(entry => [entry.path, entry.decks]), [[BUILT_IN_THEME_PATH, 1], [oldPath, 2], [newPath, 0]]);
  assert.equal(themeKeyOf(oldPath, entries), oldPath);
});

test('New theme…: from Paper, Ember and the deck\'s own theme, a valid file with the new name', () => {
  const paper = parseTheme(newThemeText('Harbour Light', 'paper', ''));
  assert.deepEqual([paper.name, paper.bg, paper.head, paper.accent, paper.glow, paper.round, paper.boxes, paper.fh], ['Harbour Light', '#FFFFFF', '#14213D', '#0E7C86', false, 'square', 'outline', 'Source Serif 4']);
  const ember = parseTheme(newThemeText('Harbour Dark', 'ember', ''));
  assert.deepEqual([ember.name, ember.bg, ember.accent, ember.glow, ember.round, ember.boxes, ember.fb], ['Harbour Dark', '#211B18', '#FF7A45', true, 'round', 'filled', 'Inter']);
  // A copy of the deck's theme: its file's text, every line but the name kept (shades and comments too).
  const evening = newThemeText('Evening copy', 'copy', BUILT_IN_THEME_TEXT);
  assert.deepEqual(changedLines(BUILT_IN_THEME_TEXT, evening), ['name: Evening copy']);
  assert.deepEqual(parseTheme(evening).card, BUILT_IN_THEME.card);
  const fern = newThemeText('Fern 2', 'copy', FERN);
  assert.deepEqual(changedLines(FERN, fern), ["name: 'Fern 2'"]);
  // Each start's theme for its picture in the sheet.
  assert.equal(startTheme('copy', BUILT_IN_THEME), BUILT_IN_THEME);
  assert.equal(startTheme('paper', BUILT_IN_THEME).name, 'Paper');
  assert.equal(parseTheme(PAPER_THEME_TEXT).name, 'Paper');
  assert.equal(parseTheme(EMBER_THEME_TEXT).name, 'Ember');
  // Its path is a theme a deck may name, written plainly on the deck's line.
  for (const name of ['Harbour Light', 'Fernhollow Bank', 'Q3 2026', 'Ümar & co']) {
    assert.ok(isThemePath(themePathFor(name)) && isLibraryThemePath(themePathFor(name)), name);
    assert.equal(themePathFor(` ${name} `), `Slide library/Themes/${name}.theme.md`);
  }
  // A name a YAML line would read otherwise is quoted.
  assert.equal(parseTheme(newThemeText('Yes', 'paper', '')).name, 'Yes');
  assert.equal(parseTheme(newThemeText('1: one', 'paper', '')).name, '1: one', 'quoted, so it reads back (the name rule refuses it before anyway)');
});

test('the name rule: what a file name holds, no duplicate, nothing a deck\'s line would quote', () => {
  assert.equal(themeNameProblem('Fernhollow Bank'), null);
  assert.equal(themeNameProblem('  '), 'Give the theme a name.');
  for (const bad of ['a/b', 'a\\b', 'a:b', 'a*b', 'a?b', 'a"b', 'a<b', 'a>b', 'a|b', 'a#b', 'tab\there']) assert.ok(themeNameProblem(bad), bad);
  assert.ok(themeNameProblem('.hidden'));
  assert.ok(themeNameProblem('- dash'));
  assert.ok(themeNameProblem('Ends.'));
  assert.ok(themeNameProblem('CON'));
  assert.ok(themeNameProblem('x'.repeat(61)));
  assert.equal(themeNameProblem('x'.repeat(60)), null);
  const taken = { names: ['Evening', 'Fernhollow Bank'], files: ['Fern.theme.md'] };
  assert.match(newThemeNameProblem('evening', taken) ?? '', /There's a theme called Evening already/, 'named as the project has it');
  assert.ok(newThemeNameProblem('FERN', taken), 'a file of that name, in any case');
  assert.equal(newThemeNameProblem('Harbour', taken), null);
  assert.equal(nextThemeName('Evening', taken), 'Evening 2');
  assert.equal(nextThemeName('Evening 2', { names: ['Evening', 'Evening 2'], files: [] }), 'Evening 3');
  // A name's own digits stay (review, round 1); a name holding what a file name can't gets a clean one.
  assert.equal(nextThemeName('Q3 2026', { names: ['Evening', 'Q3 2026'], files: [] }), 'Q3 2026 2');
  assert.equal(nextThemeName('Fernhollow: brand', { names: ['Fernhollow: brand'], files: [] }), 'Fernhollow brand 2');
  assert.equal(nextThemeName('###', { names: [], files: [] }), 'New theme 2');
  assert.equal(nextThemeName('x'.repeat(80), { names: [], files: [] }), `${'x'.repeat(56)} 2`);
});

test('colours: #RRGGBB in capitals from what is typed; the tab sends only fields of their own kind', () => {
  assert.deepEqual(['#abc', 'abcdef', ' #A1B2C3 ', '#12345', 'red', '#GGGGGG'].map(normalColour), ['#AABBCC', '#ABCDEF', '#A1B2C3', null, null, null]);
  assert.ok(isThemeChanges({ accent: '#FF7A45' }));
  assert.ok(isThemeChanges({ glow: false, round: 'round', boxes: 'outline' }));
  for (const bad of [{}, { accent: '#ff7a45' }, { accent: 'red' }, { glow: 'yes' }, { round: 'circle' }, { name: 'Other' }, { fh: 'Futura' }, null, []]) {
    assert.ok(!isThemeChanges(bad), JSON.stringify(bad));
  }
  assert.deepEqual(changedFields(BUILT_IN_THEME, { accent: '#f2b544', bg: '#000000', glow: true }), { bg: '#000000' });
});

test('the tab\'s requests: exact fields, or dropped', () => {
  assert.deepEqual(decodeThemeRequest({ type: 'theme/ready' }), { type: 'theme/ready' });
  assert.deepEqual(decodeThemeRequest({ type: 'theme/undo' }), { type: 'theme/undo' });
  assert.deepEqual(decodeThemeRequest({ type: 'theme/redo' }), { type: 'theme/redo' });
  assert.deepEqual(decodeThemeRequest({ type: 'theme/set', changes: { round: 'soft' } }), { type: 'theme/set', changes: { round: 'soft' } });
  assert.deepEqual(decodeThemeRequest({ type: 'theme/save-as', name: 'Evening 2', use: true }), { type: 'theme/save-as', name: 'Evening 2', use: true });
  assert.deepEqual(decodeThemeRequest({ type: 'theme/open-deck', path: 'Talks/Harbour.deck.md' }), { type: 'theme/open-deck', path: 'Talks/Harbour.deck.md' });
  for (const bad of [
    { type: 'theme/save', extra: 1 },
    { type: 'theme/set', changes: { name: 'x' } },
    { type: 'theme/set', changes: { accent: 'nope' } },
    { type: 'theme/save-as', name: '', use: true },
    { type: 'theme/save-as', name: 'A', use: 'yes' },
    { type: 'theme/open-deck', path: '/etc/passwd' },
    { type: 'theme/undo-save', token: '' },
    { type: 'theme/write', text: 'x' },
    'theme/save',
  ]) assert.throws(() => decodeThemeRequest(bad), ThemeProtocolError, JSON.stringify(bad));
});

test('which files open as the theme\'s tab: a theme directly in the project\'s Slide library/Themes, with the flag', () => {
  const on = (relative: string | null, flagOn = true, scheme = 'file') => themeModeOf({ flagOn, scheme, relative });
  assert.ok(on('Slide library/Themes/Evening.theme.md'));
  assert.ok(on('slide library/themes/Evening.THEME.md'), 'the folder in any case');
  assert.ok(!on('Slide library/Themes/Evening.theme.md', false), 'flag off: a document');
  assert.ok(!on('Slide library/Themes/Evening.theme.md', true, 'untitled'));
  assert.ok(!on(null), 'outside the project');
  assert.ok(!on('Slide library/Themes/Old/Evening.theme.md'), 'not in a folder below');
  assert.ok(!on('Talks/Evening.theme.md'));
  assert.ok(!on('Slide library/Themes/.theme.md'));
  assert.ok(!on('Slide library/Themes/Evening.md'));
});

test('the preview: six of the deck\'s slides, one of each kind first, skipped ones never; the sample has four', () => {
  const part = (kind: string, id: string, extra = '') => `\`\`\`slide ${kind}\nid: ${id}\ntitle: ${kind} ${id}\n${extra}\`\`\`\n`;
  const text = ['---', 'deck: 1', 'look: borderless', '---', '',
    part('title', 't1'), part('points', 'p1'), part('points', 'p2'), part('points', 'p3', 'skip: true\n'), part('section', 's1'),
    part('points', 'p4'), part('boxes', 'b1'), part('statement', 'st1'), part('points', 'p5'), part('table', 'tb1')].join('\n');
  const chosen = previewSlidesOf(presentSlidesOf(text)).map(slide => slide.data.id);
  assert.deepEqual(chosen, ['t1', 'p1', 's1', 'b1', 'st1', 'tb1']);
  const preview = deckPreview('Talks/Harbour.deck.md', text);
  assert.deepEqual([preview.deck, preview.borderless, preview.slides.length], ['Harbour', true, 6]);
  const sample = deckPreview(null, SAMPLE_DECK_TEXT);
  assert.deepEqual([sample.deck, sample.borderless, sample.slides.length, sample.pictures.length], [null, false, 4, 0]);
});

test('Sprint 162 PR 3: a font pick is one line, one of the six by its own name; a name in another case is no change', () => {
  const text = BUILT_IN_THEME_TEXT;
  const fraunces = themeTextWith(text, { fh: 'Fraunces' });
  const changed = fraunces.split('\n').filter((line, index) => line !== text.split('\n')[index]);
  assert.deepEqual(changed, ['heading-font: Fraunces'], 'one line, and the hand-picked shades stay (a font is no colour)');
  assert.equal(parseTheme(fraunces).fh, 'Fraunces');
  assert.equal(parseTheme(themeTextWith(text, { fb: 'Source Serif 4' })).fb, 'Source Serif 4');
  assert.ok(themeTextWith(text, { fb: 'Source Serif 4' }).includes('\ntext-font: Source Serif 4\n'));
  const lower = text.replace('heading-font: Sofia Sans', 'heading-font: inter');
  assert.equal(themeTextWith(lower, { fh: 'Inter' }), lower, '"inter" is Inter already: no new line');
  assert.ok(themeTextWith(lower, { fh: 'Space Grotesk' }).includes('heading-font: Space Grotesk'));
  const missing = text.replace('heading-font: Sofia Sans\n', '');
  assert.ok(themeTextWith(missing, { fh: 'IBM Plex Sans' }).includes('heading-font: IBM Plex Sans'), 'a theme without the line gets it');
  assert.ok(isThemeChanges({ fh: 'Fraunces', fb: 'Inter' }));
  for (const bad of ['Futura', 'fraunces', '', 42, null]) assert.equal(isThemeChanges({ fh: bad }), false, `not a font the tab sends: ${String(bad)}`);
  assert.deepEqual(changedFields(parseTheme(text), { fh: 'Sofia Sans' }), {}, 'the same font is no change');
  const futura = text.replace('heading-font: Sofia Sans', 'heading-font: Futura');
  assert.ok(themeTextWith(futura, { fh: 'Sofia Sans' }).includes('heading-font: Sofia Sans\n'), 'a name not of the six gives way to any pick, Sofia Sans too');
  assert.deepEqual(decodeThemeRequest({ type: 'theme/set', changes: { fb: 'IBM Plex Sans' } }), { type: 'theme/set', changes: { fb: 'IBM Plex Sans' } });
});

console.log(`themeFile: ${passed} passed`);
