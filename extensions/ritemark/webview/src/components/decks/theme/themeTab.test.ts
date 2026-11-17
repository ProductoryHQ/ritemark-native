/**
 * Sprint 162 PR 2 (frames 11, 18): the theme's own tab.
 *   - The contrast line measures the text and the headings against the background (WCAG's ratio, cut to one decimal,
 *     never rounded up past the 4.5 to 1 rule).
 *   - "Used by N decks", the file note, the host's decks message as the tab takes it.
 *   - Only the fields the engine reads: the fonts (PR 3) and the logo (PR 4) came later.
 * Run with `npx tsx webview/src/components/decks/theme/themeTab.test.ts`.
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { register } from 'node:module'
import { fileURLToPath } from 'node:url'
import { BUILT_IN_THEME, parseTheme } from '../../../../../src/decks/deckTheme'
import { EMBER_THEME_TEXT, PAPER_THEME_TEXT } from '../../../../../src/decks/themeFile'
import { contrast } from './themeVars'
import { contrastLine, ratioWords, READABLE_RATIO } from './themeContrast'

// The tab imports style sheets, which Node cannot load: for this run, a sheet is an empty module.
register(`data:text/javascript,${encodeURIComponent(
  "export async function load(url, context, next) { return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context) }",
)}`)
Object.assign(globalThis, { acquireVsCodeApi: () => ({ postMessage: () => {}, getState: () => undefined, setState: () => {} }) })
const React = await import('react')
;(globalThis as typeof globalThis & { React: typeof React }).React = React
const { COLOUR_ROWS, FONT_ROWS, CORNER_OPTIONS, BOX_OPTIONS, THEME_PALETTE, decksWords, themeDecksFrom, themeFileNote, themeUndoKey, usedByWords } = await import('./ThemeTab')

// ---- The ratio: WCAG's own pairs, and Evening's as frame 11 reads them (text 12.6, headings 15.6).
{
  assert.equal(Math.round(contrast('#000000', '#FFFFFF') * 100) / 100, 21)
  assert.equal(contrast('#777777', '#777777'), 1)
  assert.equal(Math.round(contrast('#767676', '#FFFFFF') * 100) / 100, 4.54, 'the grey that just passes on white')
  const evening = contrastLine(BUILT_IN_THEME)
  assert.equal(evening.ok, true)
  assert.equal(evening.words, 'Easy to read: text 12.6 to 1, headings 15.6 to 1 on the background.')
  assert.equal(ratioWords(evening.text), '12.6')
  assert.equal(ratioWords(evening.headings), '15.6')
  // Paper and Ember pass too.
  for (const text of [PAPER_THEME_TEXT, EMBER_THEME_TEXT]) assert.equal(contrastLine(parseTheme(text)).ok, true, text)
}

// ---- Under the rule: the line says which pair, and a ratio just under 4.5 never reads as 4.5.
{
  const faint = contrastLine({ bg: '#FFFFFF', head: '#14213D', text: '#999999' })
  assert.equal(faint.ok, false)
  assert.equal(faint.words, `Hard to read: text ${ratioWords(contrast('#999999', '#FFFFFF'))} to 1 on the background. Aim for 4.5 to 1 or more.`)
  const headings = contrastLine({ bg: '#1C1F4A', head: '#3D428F', text: '#FFFFFF' })
  assert.match(headings.words, /^Hard to read: headings [\d.]+ to 1 on the background\./)
  // #777777 on white is 4.48 to 1: cut to 4.4, not rounded up to 4.5.
  const near = contrastLine({ bg: '#FFFFFF', head: '#000000', text: '#777777' })
  assert.equal(near.ok, false)
  assert.ok(near.text < READABLE_RATIO && near.text > 4.4)
  assert.match(near.words, /text 4\.4 to 1/)
  assert.deepEqual([ratioWords(15), ratioWords(4.49), ratioWords(4.5), ratioWords(21)], ['15', '4.4', '4.5', '21'])
}

// ---- The tab's words and what it offers: the engine's fields only.
{
  assert.deepEqual(COLOUR_ROWS.map(row => [row.field, row.label]), [['bg', 'Background'], ['head', 'Headings'], ['text', 'Text'], ['accent', 'Accent']])
  assert.equal(COLOUR_ROWS[3].note, 'Numbers, icons, the line under a title')
  assert.deepEqual(CORNER_OPTIONS.map(option => option.label), ['Square', 'Soft', 'Round'])
  assert.deepEqual(BOX_OPTIONS.map(option => option.label), ['Filled', 'Outline'])
  assert.equal(THEME_PALETTE.length, 16)
  assert.ok(THEME_PALETTE.every(colour => /^#[0-9A-F]{6}$/.test(colour)))
  assert.deepEqual([usedByWords(0), usedByWords(1), usedByWords(4)], ['No deck uses it yet', 'Used by 1 deck', 'Used by 4 decks'])
  assert.match(themeFileNote('Evening'), /^Evening is a file in Slide library › Themes\. Nothing changes in the decks until you save;/)
  const tab = readFileSync(fileURLToPath(new URL('./ThemeTab.tsx', import.meta.url)), 'utf8')
  const sheet = readFileSync(fileURLToPath(new URL('./NewThemeSheet.tsx', import.meta.url)), 'utf8')
  // Claude's row (PR 5) isn't in this part, not even greyed. The logo (PR 4) is: between Fonts and Shape, as the prototype has it.
  for (const source of [tab, sheet]) {
    const shown = source.replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    assert.doesNotMatch(shown, /Ask Claude/, 'nothing of a later part shows')
  }
  assert.ok(tab.indexOf('>Logo</div>') > tab.indexOf('>Fonts</div>') && tab.indexOf('>Logo</div>') < tab.indexOf('>Shape</div>'), 'Logo sits between Fonts and Shape')
  // Fonts (PR 3): the prototype's Fonts, Headings and Text, each a choice of the six, between the contrast line and Shape.
  assert.deepEqual(FONT_ROWS.map(row => [row.field, row.label]), [['fh', 'Headings'], ['fb', 'Text']])
  assert.ok(FONT_ROWS.every(row => row.tip.length > 0), 'each font row has a tooltip')
  assert.ok(tab.indexOf('>Fonts</div>') > tab.indexOf('theme-contrast') && tab.indexOf('>Fonts</div>') < tab.indexOf('>Shape</div>'))
  assert.match(tab, /DECK_FONT_LIST\.map\(font =>/, 'the choices are the six')
  // The draft's bar (frame 18): Not saved, Discard, Save ▾ with Save as a new theme… and Discard the changes.
  assert.match(tab, /<span className="deck-saved theme-not-saved">/)
  assert.match(tab, />Discard<\/Button>/)
  assert.match(tab, /Save as a new theme…/)
  assert.match(tab, /Discard the changes/)
  // Every change goes to the host, which writes the document's lines: the tab never writes the file itself.
  assert.match(tab, /sendToExtension\('theme\/set', \{ changes \}\)/)
  assert.doesNotMatch(tab, /theme\/write|writeFile/)
}

// ---- The host's decks message, as the tab takes it: anything malformed is no message.
{
  const good = {
    decks: [{ path: 'Talks/Harbour.deck.md', name: 'Harbour' }, { path: 3 }],
    preview: { deck: 'Harbour', borderless: true, slides: [], assets: {} },
    useIn: 'Harbour',
    taken: { names: ['Evening'], files: [] },
  }
  const read = themeDecksFrom(good)!
  assert.deepEqual(read.decks, [{ path: 'Talks/Harbour.deck.md', name: 'Harbour' }])
  assert.deepEqual([read.preview.deck, read.preview.borderless, read.useIn], ['Harbour', true, 'Harbour'])
  assert.equal(themeDecksFrom({ ...good, taken: null }), null)
  assert.equal(themeDecksFrom({ ...good, decks: 'x' }), null)
  assert.equal(themeDecksFrom({ ...good, preview: { slides: 'x' } }), null)
}

// ---- Round two and the Experience lead (17 November): the draft bar says what Save will do, Cmd+Z is the draft's own
// Undo, Escape in a hex field puts the colour back, a refused name says why as it is typed, and a theme file's icon.
{
  const tab = readFileSync(fileURLToPath(new URL('./ThemeTab.tsx', import.meta.url)), 'utf8')
  assert.match(tab, /Not saved\.\s+\{count \? \(/)
  assert.match(tab, /\{' Saving changes '\}\s+<UsedBy decks=\{decks\?\.decks \?\? null\} words=\{decksWords\(count\)\}/, 'the count opens the same list')
  assert.deepEqual([decksWords(1), decksWords(2)], ['1 deck', '2 decks'])
  const key = (key: string, mods: Partial<{ metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }> = {}) => themeUndoKey({ key, metaKey: false, ctrlKey: false, shiftKey: false, ...mods })
  assert.deepEqual([key('z', { metaKey: true }), key('Z', { metaKey: true, shiftKey: true }), key('y', { ctrlKey: true }), key('y', { metaKey: true }), key('z')], ['undo', 'redo', 'redo', null, null])
  assert.match(tab, /window\.addEventListener\('keydown', onKey, true\)/)
  assert.match(tab, /if \(before\.current !== value\) onChange\(before\.current\)/, 'Escape sends the colour it had back')
  const sheet = readFileSync(fileURLToPath(new URL('./NewThemeSheet.tsx', import.meta.url)), 'utf8')
  for (const source of [sheet, tab]) assert.match(source, /const shown = problem \?\? local/, 'the reason shows as the name is typed, an empty one too')
  assert.match(sheet, /<Tooltip label=\{local \?\? `Write \$\{name\.trim\(\)\} in Slide library › Themes and open it`\}>\s+<Button size="sm" disabled=\{!!local \|\| busy\}/)
  const icons = JSON.parse(readFileSync(fileURLToPath(new URL('../../../../../fileicons/ritemark-icon-theme.json', import.meta.url)), 'utf8'))
  assert.equal(icons.fileExtensions['theme.md'], '_file_theme_dark')
  assert.equal(icons.light.fileExtensions['theme.md'], '_file_theme')
  assert.match(readFileSync(fileURLToPath(new URL('../../../../../fileicons/icons/palette.svg', import.meta.url)), 'utf8'), /M12 22a1 1 0 0 1 0-20/)
}

console.log('themeTab.test.ts — all assertions passed')
