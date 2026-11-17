/**
 * Sprint 162 PR 1 (step-3-themes.md; README frame 12): the deck's Theme button and menu.
 *   - A pick writes the deck's `theme:` line, which reads back as the theme picked; one Undo gives the file back byte for
 *     byte, and Redo writes the pick again. The pick is its own Undo step, never joined to typing, and never read as the
 *     deck's first edit (a v1 deck isn't converted by it).
 *   - "N decks" counts the project's decks that draw each theme, a deck with no `theme:` line (or one naming a file
 *     that isn't there) counting for the built-in theme.
 *   - A missing theme file draws the built-in theme.
 *   - The menu: LOOK (Card | Borderless), then THEME with each theme's swatch, name and count, the current one ticked.
 * Driven as the handout's editor runs: the deck's schema, the history and the deck's own plugins, and the file saved
 * through the editor's own front-matter join.
 * Run with `npx tsx webview/src/components/decks/themeMenu.test.ts`.
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { register } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createDocument } from '@mixmark-io/domino'
import { getSchema } from '@tiptap/core'
import { DOMParser as PMDOMParser } from '@tiptap/pm/model'
import { EditorState, TextSelection, type Transaction } from '@tiptap/pm/state'
import { history, redo, undo } from '@tiptap/pm/history'
import { canonicalMarkdownProjection } from '../../../../src/editorSync/state'
import { joinFrontMatter, splitFrontMatter } from '../../../../src/editorSync/frontMatter'
import { BUILT_IN_THEME, BUILT_IN_THEME_PATH, deckCountLabel, parseTheme, themeEntries, themeKeyOf, themeOfEntry } from '../../../../src/decks/deckTheme'
import { DeckLibrary, type DeckFiles } from '../../../../src/decks/DeckLibrary'
import { createEditorSchemaExtensions, ensureCommentMarkedPipeline, markdownToEditorHTML } from '../../utils/editorMarkdown'
import { installTestDocument } from '../../utils/markdownFidelity'
import { DeckSlide } from './handout/deckSchema'
import { DeckDrawnHeadings } from './handout/drawnHeadings'
import { deckGuardPlugin } from './handout/deckGuard'
import { deckLinesPlugin } from './handout/deckLines'
import { conversionStateOf, deckConvertPlugin } from './handout/deckConvert'
import { DeckPropertyStep, THEME_PICKED, propertyChangesOf, propertyTransaction, propertyValue, withPropertyChanges } from './theme/themePick'

// ThemeMenu imports style sheets through its controls, which Node cannot load: for this run, a sheet is an empty module.
register(`data:text/javascript,${encodeURIComponent(
  "export async function load(url, context, next) { return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context) }",
)}`)
Object.assign(globalThis, { acquireVsCodeApi: () => ({ postMessage: () => {}, getState: () => undefined, setState: () => {} }) })
const React = await import('react')
;(globalThis as typeof globalThis & { React: typeof React }).React = React
const { createElement } = React
const { renderToStaticMarkup } = await import('react-dom/server')
const { parse } = await import('node-html-parser')
const { DECK_LOOKS, DECK_LOOK_TIP, ThemeMenuBody, ThemeSwatch, themeEntriesFrom, themePickedNotice } = await import('./ThemeMenu')

installTestDocument()
ensureCommentMarkedPipeline()
const schema = getSchema(createEditorSchemaExtensions({ commentCallouts: true, deck: [DeckSlide, DeckDrawnHeadings] }))

function elementFromString(html: string): HTMLElement {
  return createDocument(`<body>${html}</body>`).body as unknown as HTMLElement
}

const EVENING = BUILT_IN_THEME_PATH
const FERN = 'Slide library/Themes/Fern Hollow.theme.md'
const PAPER = 'Slide library/Themes/Paper.theme.md'
const FERN_TEXT = '---\nname: Fern Hollow\nbackground: "#0F2A1E"\nheadings: "#FFFFFF"\ntext: "#DDEBE2"\naccent: "#7BC47F"\n---\n'
const PAPER_TEXT = '---\nname: Paper\nbackground: "#FAF7F0"\nheadings: "#1B1B1B"\ntext: "#333333"\naccent: "#C2410C"\nsoft-light: false\n---\n'

/**
 * A deck as the deck view holds it: the editor's state with the history and the deck's plugins, the front matter as
 * the view's properties, and the file as the host writes it from the two (the body is the host's own text, which a
 * property change sends back as it was).
 */
function openDeck(text: string) {
  const split = splitFrontMatter(text)
  // The body as the host gives it to the view (ritemarkEditor.ts), which a property change sends back as it is.
  const body = canonicalMarkdownProjection(split.content)
  const doc = PMDOMParser.fromSchema(schema).parse(elementFromString(markdownToEditorHTML(body)), { preserveWhitespace: 'full' })
  let state = EditorState.create({ doc, plugins: [history(), deckGuardPlugin(), deckLinesPlugin(), deckConvertPlugin()] })
  let properties = JSON.parse(JSON.stringify(split.properties)) as Record<string, unknown>
  let file = text
  const applied: Array<readonly Transaction[]> = []
  const dispatch = (tr: Transaction) => {
    const result = state.applyTransaction(tr)
    state = result.state
    applied.push(result.transactions)
    for (const each of result.transactions) {
      const changes = propertyChangesOf(each)
      if (changes.length === 0) continue
      properties = withPropertyChanges(properties, changes)
      file = joinFrontMatter(properties, body, file)
    }
  }
  return {
    get state() { return state },
    get file() { return file },
    get properties() { return properties },
    applied,
    pick: (path: string) => dispatch(propertyTransaction(state, 'theme', propertyValue(properties, 'theme'), { present: true, value: path })),
    undo: () => undo(state, dispatch),
    redo: () => redo(state, dispatch),
    type: (words: string) => {
      let at = -1
      state.doc.descendants((node, pos) => {
        if (at < 0 && node.type.name === 'paragraph') at = pos + 1 + node.content.size
        return at < 0
      })
      assert.ok(at > 0, 'a paragraph to type in')
      dispatch(state.tr.setSelection(TextSelection.create(state.doc, at)).insertText(words))
    },
  }
}

const SLIDE = '```slide title\nid: t1\ntitle: Harbour\n```\n\nWelcome to the harbour.\n'

// ---- A pick writes the `theme:` line and reads back the same; one Undo gives back the file byte for byte; Redo again.
{
  const text = `---\ndeck: 1\ntheme: ${EVENING}\nlook: borderless\n---\n\n${SLIDE}`
  const deck = openDeck(text)
  const before = deck.state.doc
  deck.pick(FERN)
  assert.equal(deck.file, `---\ndeck: 1\ntheme: ${FERN}\nlook: borderless\n---\n\n${SLIDE}`, 'only the theme line changes')
  assert.equal(splitFrontMatter(deck.file).properties.theme, FERN, 'and it reads back as the theme picked')
  assert.equal(deck.state.doc, before, 'the document itself is the same')
  assert.equal(deck.applied[deck.applied.length - 1].length, 1, 'nothing is appended to the pick: no conversion, no lines, no guard fix')
  assert.equal(conversionStateOf(deck.state).count, 0, 'a v1 deck is not converted by a pick')
  assert.equal(deck.applied[deck.applied.length - 1][0].getMeta(THEME_PICKED), true)
  assert.equal(deck.applied[deck.applied.length - 1][0].getMeta('preventUpdate'), true, 'no Markdown change to publish')

  deck.undo()
  assert.equal(deck.file, text, 'one Undo: the file byte for byte')
  assert.equal(deck.state.doc, before)
  deck.redo()
  assert.equal(splitFrontMatter(deck.file).properties.theme, FERN, 'Redo picks it again')
  deck.undo()
  assert.equal(deck.file, text)
}

// ---- A deck with no theme line (it draws the built-in theme): the pick adds the line, and one Undo takes it out again.
// The same for a quoted line: its quotes stay.
{
  for (const text of [`---\ndeck: 1\n---\n\n${SLIDE}`, `---\n# a client's deck\ndeck: 1\ntheme: "${EVENING}"\n---\n\n${SLIDE}`]) {
    const deck = openDeck(text)
    deck.pick(PAPER)
    assert.equal(splitFrontMatter(deck.file).properties.theme, PAPER)
    assert.equal(deck.file.split('\n').filter(line => line.startsWith('theme:')).length, 1)
    deck.undo()
    assert.equal(deck.file, text, 'undone: the bytes as they were')
  }
}

// ---- The pick is its own Undo step: typing right after it (or before it) is undone on its own.
{
  const text = `---\ndeck: 2\ntheme: ${EVENING}\n---\n\n${SLIDE}`
  const deck = openDeck(text)
  deck.pick(FERN)
  deck.type(' More.')
  deck.undo()
  assert.equal(deck.properties.theme, FERN, 'the first Undo takes back the typing only')
  assert.ok(!deck.state.doc.textContent.includes('More.'))
  deck.undo()
  assert.equal(deck.file, text, 'the second Undo takes back the pick')
}

// ---- The step itself: it changes nothing in the document, maps through anything, and inverts to the value before.
{
  const step = new DeckPropertyStep('theme', { present: false }, { present: true, value: FERN })
  const inverse = step.invert() as DeckPropertyStep
  assert.deepEqual([inverse.before, inverse.after], [{ present: true, value: FERN }, { present: false }])
  assert.deepEqual(withPropertyChanges({ deck: 1, theme: FERN }, [{ key: 'theme', to: inverse.after }]), { deck: 1 })
  assert.deepEqual(withPropertyChanges({ deck: 1 }, [{ key: 'theme', to: step.after }]), { deck: 1, theme: FERN })
  assert.deepEqual(propertyValue({ theme: null }, 'theme'), { present: true, value: null }, 'a key with no value is still there')
  assert.equal(DeckPropertyStep.fromJSON(schema, step.toJSON()).key, 'theme')
}

// ---- "N decks": every deck of the project counts once, for the theme it draws.
{
  const decks = [EVENING, null, FERN, ` ${FERN} `, 'Slide library/Themes/Gone.theme.md', FERN, '../outside.theme.md']
  const entries = themeEntries([{ path: FERN, text: FERN_TEXT }, { path: PAPER, text: PAPER_TEXT }], decks)
  assert.deepEqual(entries.map(entry => [themeOfEntry(entry).name, entry.path, entry.decks]), [
    ['Evening', EVENING, 4],
    ['Fern Hollow', FERN, 3],
    ['Paper', PAPER, 0],
  ], 'Evening counts the deck naming it, the one with no line, the missing file and the path outside; sorted by name')
  assert.equal(entries.reduce((sum, entry) => sum + entry.decks, 0), decks.length)
  // The project's own Evening file is listed as itself, once, with its own text.
  const own = themeEntries([{ path: EVENING, text: '---\nname: Evening\naccent: "#FF8800"\n---\n' }], [null, EVENING])
  assert.deepEqual(own.map(entry => [entry.path, entry.decks, themeOfEntry(entry).accent]), [[EVENING, 2, '#FF8800']])
  assert.deepEqual([deckCountLabel(0), deckCountLabel(1), deckCountLabel(5)], ['No decks', '1 deck', '5 decks'])
}

// ---- The decks' theme lines, as the library reads them: an open deck's unsaved text, quotes read, no line as null.
{
  const files: Record<string, string> = {
    'Slide library/AI assistants.deck.md': `---\ndeck: 1\ntheme: ${EVENING}\n---\n\n${SLIDE}`,
    'Clients/Fern/Fern.deck.md': `---\ndeck: 2\ntheme: "${FERN}"\n---\n\n${SLIDE}`,
    'Clients/Plain.deck.md': SLIDE,
    'Clients/Bom.deck.md': `﻿---\ntheme: ${PAPER}\n---\n\n${SLIDE}`,
  }
  const project: DeckFiles = {
    async list() { return Object.keys(files).map((path, index) => ({ path, modified: index })) },
    async read(path) { return files[path] ?? null },
    async write() { throw new Error('nothing is written') },
  }
  const themes = await new DeckLibrary(project).deckThemes()
  assert.deepEqual(themes, [EVENING, FERN, null, PAPER])
}

// ---- A missing theme file draws the built-in theme: the host reads none (null), the view draws Evening, and the menu
// ticks Evening for that deck.
{
  assert.equal(themeOfEntry({ text: null }), BUILT_IN_THEME)
  assert.equal(themeKeyOf('Slide library/Themes/Gone.theme.md', new Set([FERN, EVENING])), EVENING)
  assert.equal(themeKeyOf(undefined, new Set([FERN, EVENING])), EVENING)
  assert.equal(themeKeyOf(FERN, new Set([FERN, EVENING])), FERN)
  // The deck view's own reading (`useDeckTheme`): no text from the host is the built-in theme.
  const bridge = readFileSync(fileURLToPath(new URL('./deckBridge.ts', import.meta.url)), 'utf8')
  assert.match(bridge, /theme: text === null \? BUILT_IN_THEME : parseTheme\(text\)/)
  assert.equal(parseTheme('not a theme').name, 'Evening', 'a file that is no theme reads as Evening too')
}

// ---- The menu (frame 12): LOOK first, Card | Borderless; then THEME, each row its swatch, name and count, the
// current one ticked and pressed.
{
  const entries = themeEntries([{ path: FERN, text: FERN_TEXT }, { path: PAPER, text: PAPER_TEXT }], [null, FERN, FERN])
  const picked: Array<[string, string]> = []
  let closed = 0
  const body = (named: unknown, look: 'card' | 'borderless' = 'card', list: typeof entries | null = entries) => parse(renderToStaticMarkup(createElement(ThemeMenuBody, {
    entries: list, named, look, onLook: () => {}, onPick: (path: string, name: string) => { picked.push([path, name]) }, onCurrent: () => { closed += 1 },
  })))
  const root = body(FERN)
  const labels = root.querySelectorAll('.deck-settings-k').map(label => label.textContent)
  assert.deepEqual(labels, ['Look', 'Theme'])
  assert.deepEqual(root.querySelectorAll('[aria-label="How the slides look"] input').map(input => [input.getAttribute('value'), input.hasAttribute('checked')]), [['card', true], ['borderless', false]])
  assert.deepEqual(body(FERN, 'borderless').querySelectorAll('[aria-label="How the slides look"] input').map(input => input.hasAttribute('checked')), [false, true])
  assert.deepEqual(DECK_LOOKS, [{ value: 'card', label: 'Card' }, { value: 'borderless', label: 'Borderless' }])
  assert.equal(DECK_LOOK_TIP, 'How the slides look: as a card, or the whole column as the stage')
  const rows = root.querySelectorAll('.deck-theme-row')
  assert.deepEqual(rows.map(row => [row.querySelector('.deck-theme-row-name')!.textContent, row.querySelector('.deck-theme-row-count')!.textContent, row.getAttribute('aria-pressed')]), [
    ['Evening', '1 deck', 'false'],
    ['Fern Hollow', '2 decks', 'true'],
    ['Paper', 'No decks', 'false'],
  ])
  assert.equal(rows.filter(row => row.querySelector('.deck-theme-row-check svg')).length, 1, 'one tick')
  assert.equal(rows[1].querySelector('.deck-theme-swatch')!.getAttribute('style'), 'background:#0F2A1E', "the row's swatch is its theme's ground")
  // A deck naming no theme, or a missing one, has Evening ticked.
  assert.equal(body(undefined).querySelectorAll('.deck-theme-row')[0].getAttribute('aria-pressed'), 'true')
  assert.equal(body('Slide library/Themes/Gone.theme.md').querySelectorAll('.deck-theme-row')[0].getAttribute('aria-pressed'), 'true')
  // While the host reads the themes, the menu says so.
  assert.match(body(FERN, 'card', null).textContent, /Reading the project's themes…/)
  // Edit and New theme come with the theme's tab (PR 2): not here, not even disabled.
  assert.doesNotMatch(root.textContent, /Edit|New theme/)
  assert.equal(picked.length + closed, 0, 'drawing it picks nothing')
  // The swatch: the theme's ground, a bar in its accent and one in its headings' colour.
  const swatch = parse(renderToStaticMarkup(createElement(ThemeSwatch, { theme: BUILT_IN_THEME })))
  assert.deepEqual(swatch.querySelectorAll('i').map(bar => bar.getAttribute('style')), ['background:#F2B544', 'background:#FFFFFF'])
  assert.equal(themePickedNotice('Fern Hollow'), 'This deck uses Fern Hollow now.')
  // The host's list, as the view takes it: anything malformed is left out.
  assert.deepEqual(themeEntriesFrom([{ path: FERN, text: FERN_TEXT, decks: 2 }, { path: EVENING, text: null, decks: 1 }, { path: 3 }, null, { path: PAPER, text: 4, decks: 0 }]).map(entry => entry.path), [FERN, EVENING])
  assert.deepEqual(themeEntriesFrom('nothing'), [])
}

// ---- Where it is (frame 12): on the deck's bar, on the right before Saved, then Publish and Present.
{
  const view = readFileSync(fileURLToPath(new URL('./DeckView.tsx', import.meta.url)), 'utf8')
  const bar = view.slice(view.indexOf('<header className="deck-bar">'), view.indexOf('</header>'))
  const at = (words: string) => { const index = bar.indexOf(words); assert.ok(index >= 0, words); return index }
  assert.ok(at('<span className="flex-1" />') < at('<ThemeMenu') && at('<ThemeMenu') < at('deck-saved') && at('deck-saved') < at('<DeckPublish') && at('<DeckPublish') < at('<PresentButton'))
  // The pick and its notice with Undo, which takes back only that pick (the bar's other notices' rule).
  assert.match(view, /propertyTransaction\(editor\.state, 'theme', propertyValue\(propertiesRef\.current, 'theme'\), \{ present: true, value: path \}\)/)
  assert.match(view, /text: themePickedNotice\(name\),\s+action: \{ label: 'Undo', tip: '[^']+', run: \(\) => \{ if \(valid\(\)\) editor\.commands\.undo\(\) \} \},\s+valid,/)
  const menu = readFileSync(fileURLToPath(new URL('./ThemeMenu.tsx', import.meta.url)), 'utf8')
  assert.match(menu, /<Popover open=\{open\} onOpenChange=\{setOpen\}>/, 'a Radix popover: a press outside and Esc close it')
  assert.match(menu, /if \(open\) sendToExtension\('deck\/themes'\)/, 'the themes are asked for each time it opens')
}

console.log('themeMenu.test.ts — all assertions passed')
