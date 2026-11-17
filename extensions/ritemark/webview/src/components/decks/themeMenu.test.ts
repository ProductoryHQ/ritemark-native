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
import { BUILT_IN_THEME, BUILT_IN_THEME_PATH, deckCountLabel, parseTheme, themeEntries, themeKeyOf, themeOfEntry, themePathOf } from '../../../../src/decks/deckTheme'
import { themeVars, wallGround } from './theme/themeVars'
import { DeckLibrary, type DeckFiles } from '../../../../src/decks/DeckLibrary'
import { createEditorSchemaExtensions, ensureCommentMarkedPipeline, markdownToEditorHTML } from '../../utils/editorMarkdown'
import { installTestDocument } from '../../utils/markdownFidelity'
import { DeckSlide } from './handout/deckSchema'
import { DeckDrawnHeadings } from './handout/drawnHeadings'
import { deckGuardPlugin } from './handout/deckGuard'
import { deckLinesPlugin } from './handout/deckLines'
import { conversionStateOf, deckConvertPlugin } from './handout/deckConvert'
import { DeckPropertyStep, applicableChanges, propertyChangesOf, propertyTransaction, propertyValue, sameValue, withPropertyChanges } from './theme/themePick'

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
      // As DeckView's listener: a change whose key was changed since by someone else is left as it is now.
      const { apply } = applicableChanges(properties, propertyChangesOf(each))
      if (apply.length === 0) continue
      properties = withPropertyChanges(properties, apply)
      file = joinFrontMatter(properties, body, file)
    }
  }
  return {
    get state() { return state },
    get file() { return file },
    get properties() { return properties },
    applied,
    pick: (path: string) => dispatch(propertyTransaction(state, 'theme', propertyValue(properties, 'theme'), { present: true, value: path })),
    // The Theme menu's look, as DeckView's setLook writes it.
    look: (look: 'card' | 'borderless') => dispatch(propertyTransaction(state, 'look', propertyValue(properties, 'look'), look === 'borderless' ? { present: true, value: 'borderless' } : { present: false })),
    /** Someone else (the host, an AI) changes a property outside the history. */
    external: (key: string, value: unknown) => { properties = { ...properties, [key]: value }; file = joinFrontMatter(properties, body, file) },
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

// ---- The look in the same menu is a step of the same Undo: Borderless writes `look: borderless`, Undo takes it out.
{
  const text = `---\ndeck: 2\ntheme: ${EVENING}\n---\n\n${SLIDE}`
  const deck = openDeck(text)
  deck.pick(FERN)
  deck.look('borderless')
  assert.equal(deck.file, `---\ndeck: 2\ntheme: ${FERN}\nlook: borderless\n---\n\n${SLIDE}`)
  deck.undo()
  assert.equal(deck.properties.look, undefined, 'the first Undo takes back the look only')
  assert.equal(deck.properties.theme, FERN)
  deck.undo()
  assert.equal(deck.file, text, 'and the second the pick: the bytes as they were')
}

// ---- An Undo never writes over a change someone else made since: the newer value stays.
{
  const text = `---\ndeck: 2\ntheme: ${EVENING}\n---\n\n${SLIDE}`
  const deck = openDeck(text)
  deck.pick(FERN)
  deck.external('theme', PAPER)
  deck.undo()
  assert.equal(deck.properties.theme, PAPER, 'the AI\'s Paper stays')
  const { apply, stale } = applicableChanges({ theme: PAPER }, [{ key: 'theme', from: { present: true, value: FERN }, to: { present: true, value: EVENING } }])
  assert.deepEqual([apply.length, stale.length], [0, 1])
  assert.ok(sameValue({ present: false }, { present: false }) && !sameValue({ present: true, value: null }, { present: false }))
}

// ---- No bands on the wall (step-3-themes.md; Jarmo, 17 November): the wall's ground is the slide's own, on the whole
// screen: the theme's soft light where it has one (so it is anchored to the screen's corner), its plain ground
// without, a Borderless deck's white. The slide's canvas on the wall has no ground of its own, so no edge shows where
// the 16:9 area ends, and a side picture runs to the screen's edges.
{
  assert.equal(wallGround(BUILT_IN_THEME, false), themeVars(BUILT_IN_THEME, false).bg, 'the slide\'s own ground')
  assert.match(wallGround(BUILT_IN_THEME, false), /^radial-gradient\(120% 95% at 88% 8%, /, 'Evening\'s soft light, from the corner')
  assert.equal(wallGround(BUILT_IN_THEME, true), '#FFFFFF')
  const fern = parseTheme(FERN_TEXT)
  assert.match(wallGround(fern, false), /^radial-gradient\(/)
  assert.ok(wallGround(fern, false).includes(fern.bg), 'its own ground in the soft light')
  assert.equal(wallGround(parseTheme(PAPER_TEXT), false), '#FAF7F0', 'no soft light: its ground')
  const wall = readFileSync(fileURLToPath(new URL('./present/DeckWall.tsx', import.meta.url)), 'utf8')
  assert.match(wall, /wallGround\(theme, borderless\)/)
  assert.match(wall, /style=\{\{ background: ground \}\}/)
  assert.match(wall, /'--wall-bleed-x': `\$\{bleed\.x\}px`, '--wall-bleed-y': `\$\{bleed\.y\}px`/, 'the frame says how far to run')
  const css = readFileSync(fileURLToPath(new URL('./present/wall.css', import.meta.url)), 'utf8')
  assert.match(css, /\.wall-slide \.deck-sl \{ background: transparent; \}/, 'no ground inside the 16:9 area')
  assert.match(css, /\.wall-frame \{ position: absolute; overflow: visible; \}/, 'nothing clipped at the 16:9 edge')
  for (const side of ['left', 'right', 'behind']) {
    assert.match(css, new RegExp(`\\.pic-${side} \\.photo \\{[^}]*var\\(--wall-bleed-x`), `a ${side} picture runs to its edge`)
  }
  assert.match(css, /\.is-blocks \.photo \{ top: calc\(-1 \* var\(--wall-bleed-y, 0px\)\); bottom: calc\(-1 \* var\(--wall-bleed-y, 0px\)\); \}/, 'and to the top and bottom')
  assert.match(css, /\.wall-slide\.is-leaving \{ animation: wall-fade-out/, 'the slide before fades out over the one ground')
  assert.match(css, /wall-fade-out \{ from \{ opacity: var\(--wall-fade-from, 1\); \}/, 'from where it was, so a quick move never flashes')
  assert.match(css, /\.wall-slide \.deck-sl\.is-blocks \{ overflow: visible; \}/, 'only a block canvas lets its picture out')
}

// ---- When the bar is short of room, what gives way, in order: the Theme button's name, Publish's word, the notice's
// words, Present's word last (step-3-themes.md).
{
  const css = readFileSync(fileURLToPath(new URL('./decks.css', import.meta.url)), 'utf8')
  const weight = (selector: string) => Number(new RegExp(`\\n${selector.replace(/[.>]/g, m => `\\${m}`)} \\{ flex-shrink: (\\d+);`).exec(css)?.[1])
  const order = ['.deck-bar > .deck-theme-slot', '.deck-bar > .deck-publish-slot', '.deck-bar > .deck-notice', '.deck-bar > .deck-present'].map(weight)
  assert.ok(order.every(Number.isFinite), String(order))
  assert.ok(order[0] > order[1] && order[1] > order[2] && order[2] > order[3], String(order))
  const menu = readFileSync(fileURLToPath(new URL('./ThemeMenu.tsx', import.meta.url)), 'utf8')
  assert.match(menu, /<Tooltip label=\{`\$\{theme\.name\}: the deck's look and theme`\} className="deck-theme-slot">/, 'the name is in its tooltip')
  const publish = readFileSync(fileURLToPath(new URL('./DeckPublish.tsx', import.meta.url)), 'utf8')
  assert.match(publish, /className="deck-publish-slot">\s+<Button variant="outline" size="bar" className="deck-publish" iconWhenNarrow onClick=\{publish\}>/)
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
  // A project's own Evening file is Evening in that project (step-3-themes.md): listed once, with its own text; a deck
  // with no line, or naming a file that isn't there, draws it, is counted under it and has its row ticked.
  const ownFile = { path: EVENING, text: '---\nname: Evening\naccent: "#FF8800"\n---\n' }
  const own = themeEntries([ownFile], [null, EVENING, 'Slide library/Themes/Gone.theme.md'])
  assert.deepEqual(own.map(entry => [entry.path, entry.decks, themeOfEntry(entry).accent]), [[EVENING, 3, '#FF8800']])
  assert.equal(themeKeyOf(null, own), EVENING)
  assert.equal(themeKeyOf('Slide library/Themes/Gone.theme.md', own), EVENING)
  assert.equal(themeKeyOf(EVENING, own), EVENING)
  // Every reader asks for the file a deck names, or Evening's path when it names none (and falls back to Evening's file).
  assert.equal(themePathOf(undefined), EVENING)
  assert.equal(themePathOf('https://example.com/x.theme.md'), EVENING)
  assert.equal(themePathOf(` ${FERN} `), FERN)
  // A hand-written line names its file whatever its slashes, a leading ./ or its case.
  const listed = themeEntries([{ path: FERN, text: FERN_TEXT }], [])
  for (const named of ['Slide library\\Themes\\Fern Hollow.theme.md', './Slide library//Themes/Fern Hollow.theme.md', 'slide library/themes/fern hollow.theme.md'])
    assert.equal(themeKeyOf(named, listed), FERN, named)
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
  const library = new DeckLibrary(project)
  assert.deepEqual(await library.deckThemes(), [EVENING, FERN, null, PAPER])
  // The library's listing reads the line the same way (its quotes were kept before, so the thumbnails drew Evening).
  assert.deepEqual((await library.listDecks()).map(deck => deck.theme).sort(), [EVENING, FERN, PAPER, null].sort())
}

// ---- A missing theme file draws the built-in theme: the host reads none (null), the view draws Evening, and the menu
// ticks Evening for that deck.
{
  assert.equal(themeOfEntry({ text: null }), BUILT_IN_THEME)
  const list = themeEntries([{ path: FERN, text: FERN_TEXT }], [])
  assert.equal(themeKeyOf('Slide library/Themes/Gone.theme.md', list), EVENING)
  assert.equal(themeKeyOf(undefined, list), EVENING)
  assert.equal(themeKeyOf(FERN, list), FERN)
  // The deck view's own reading (`useDeckTheme`): no text from the host is the built-in theme.
  const bridge = readFileSync(fileURLToPath(new URL('./deckBridge.ts', import.meta.url)), 'utf8')
  assert.match(bridge, /theme: themeWithLogo\(text === null \? BUILT_IN_THEME : parseTheme\(text\), message\.logo\)/)
  assert.match(bridge, /const path: string \| null = themePathOf\(themePath\)/, 'a deck naming no theme asks for Evening\'s file')
  // The host's readers all fall back to the project's own Evening file, then to the built-in theme.
  const pages = readFileSync(fileURLToPath(new URL('../../../../src/decks/deckPages.ts', import.meta.url)), 'utf8')
  assert.match(pages, /const evening = await readProjectTheme\(root, BUILT_IN_THEME_PATH\)/)
  for (const reader of ['deckPublish.ts', 'present/DeckPresenter.ts', 'SlideLibraryViewProvider.ts'])
    assert.match(readFileSync(fileURLToPath(new URL(`../../../../src/decks/${reader}`, import.meta.url)), 'utf8'), /themePathOf\(/, reader)
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
  // Cmd+Z on the bar (the focus is back on the Theme button after a pick) is the deck's Undo. In the capture phase: the
  // webview's own script marks an undo outside a text field handled before a bubble listener sees it (found in the app).
  assert.match(view, /if \(target && target !== document\.body && !target\.closest\('\.deck-bar'\)\) return/)
  assert.match(view, /window\.addEventListener\('keydown', onKey, true\)\s+return \(\) => window\.removeEventListener\('keydown', onKey, true\)/)
  const menu = readFileSync(fileURLToPath(new URL('./ThemeMenu.tsx', import.meta.url)), 'utf8')
  assert.match(menu, /<Popover open=\{open\} onOpenChange=\{setOpen\}>/, 'a Radix popover: a press outside and Esc close it')
  assert.match(menu, /if \(open\) sendToExtension\('deck\/themes'\)/, 'the themes are asked for each time it opens')
}

// ---- Sprint 162 PR 2 (frame 12): after the themes, Edit <Name> for the theme the deck draws, and New theme…. Edit only
// for a theme the project has a file for: never for the built-in Evening until the project has its own file.
{
  const edits: string[] = []
  let news = 0
  const body = (list: ReturnType<typeof themeEntries>, named: unknown) => parse(renderToStaticMarkup(createElement(ThemeMenuBody, {
    entries: list, named, look: 'card', onLook: () => {}, onPick: () => {}, onCurrent: () => {}, onEdit: (path: string) => { edits.push(path) }, onNew: () => { news += 1 },
  })))
  const list = themeEntries([{ path: FERN, text: FERN_TEXT }], [null, FERN])
  const fern = body(list, FERN)
  assert.deepEqual(fern.querySelectorAll('.deck-theme-row').map(row => row.textContent.trim()).slice(-2), ['Edit Fern Hollow', 'New theme…'])
  assert.equal(fern.querySelectorAll('.deck-theme-sep').length, 2, 'a line between the themes and the two actions')
  const evening = body(list, undefined)
  assert.doesNotMatch(evening.textContent, /Edit/, 'the built-in Evening has no file to edit')
  assert.match(evening.textContent, /New theme…/)
  const own = themeEntries([{ path: EVENING, text: '---\nname: Evening\naccent: "#FF8800"\n---\n' }], [null])
  assert.match(body(own, undefined).textContent, /Edit Evening/, "the project's own Evening file is edited in its tab")
  assert.doesNotMatch(body(list, FERN).textContent, /Reading the project's themes/)
  assert.equal(edits.length + news, 0, 'drawing it opens nothing')
  // While the themes are read, neither shows (nothing greyed).
  assert.doesNotMatch(parse(renderToStaticMarkup(createElement(ThemeMenuBody, { entries: null, named: FERN, look: 'card', onLook: () => {}, onPick: () => {}, onCurrent: () => {}, onEdit: () => {}, onNew: () => {} }))).textContent, /Edit|New theme/)
  const { takenThemeNames } = await import('./ThemeMenu')
  assert.deepEqual(takenThemeNames(list), { names: ['Evening', 'Fern Hollow'], files: ['Fern Hollow.theme.md'] })
}

// ---- Sprint 162 PR 2: New theme… with "Use it in this deck" (ticked by default) writes the deck's `theme:` line naming
// the new file, as a pick: one Undo gives the file back byte for byte. The new file reads as a theme from each start.
{
  const { newThemeText, themePathFor } = await import('../../../../src/decks/themeFile')
  const { BUILT_IN_THEME_TEXT } = await import('../../../../src/decks/deckTheme')
  const name = 'Fernhollow Bank'
  const path = themePathFor(name)
  assert.equal(path, 'Slide library/Themes/Fernhollow Bank.theme.md')
  for (const text of [`---\ndeck: 2\ntheme: ${EVENING}\n---\n\n${SLIDE}`, `---\ndeck: 1\n---\n\n${SLIDE}`]) {
    const deck = openDeck(text)
    deck.pick(path)
    assert.equal(splitFrontMatter(deck.file).properties.theme, path)
    assert.equal(deck.file.split('\n').filter(line => line.startsWith('theme:')).length, 1)
    deck.undo()
    assert.equal(deck.file, text, 'one Undo: the deck as it was')
  }
  for (const start of ['copy', 'paper', 'ember'] as const) {
    const made = parseTheme(newThemeText(name, start, BUILT_IN_THEME_TEXT))
    assert.equal(made.name, name, start)
  }
  // The host's line reaches the view as a pick (one Undo, the bar's line); a theme the deck draws already is left.
  const view = readFileSync(fileURLToPath(new URL('./DeckView.tsx', import.meta.url)), 'utf8')
  assert.match(view, /if \(message\.type !== 'deck\/use-theme' \|\| typeof message\.path !== 'string' \|\| typeof message\.name !== 'string'\) return\s+if \(propertiesRef\.current\.theme === message\.path\) return\s+pickTheme\(message\.path, message\.name\)/)
  const { NewThemeSheet, firstThemeName, themeStarts } = await import('./theme/NewThemeSheet')
  assert.equal(firstThemeName({ names: ['Evening'], files: [] }), 'New theme')
  assert.equal(firstThemeName({ names: ['Evening', 'New theme'], files: [] }), 'New theme 2')
  assert.deepEqual(themeStarts(BUILT_IN_THEME).map(start => [start.name, start.note]), [
    ['A copy of Evening', 'The one this deck uses'],
    ['Paper', 'Light, a serif for headings'],
    ['Ember', 'Dark, warm, round corners'],
  ])
  const sheet = readFileSync(fileURLToPath(new URL('./theme/NewThemeSheet.tsx', import.meta.url)), 'utf8')
  assert.match(sheet, /const \[use, setUse\] = useState\(true\)/, '"Use it in this deck" is ticked')
  assert.equal(typeof NewThemeSheet, 'function')
}

console.log('themeMenu.test.ts — all assertions passed')
