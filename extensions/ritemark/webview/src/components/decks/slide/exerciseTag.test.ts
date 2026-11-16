/**
 * 16 November: an exercise slide's pill is the slide's own words, in an optional `tag:` line. Missing: the default
 * ("Exercise"), and the deck stays byte for byte; edited on the slide or in Settings' Label row: written through
 * `writeScalar`; emptied: `tag: ""`, no pill, on the stage, the wall and the page; Undo puts back the line that was there.
 *
 * Run: npx tsx webview/src/components/decks/slide/exerciseTag.test.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { register } from 'node:module'
import { fileURLToPath } from 'node:url'

// SlideCanvas and SlideSettings import style sheets, which Node cannot load: for this run, a sheet is an empty module.
register(`data:text/javascript,${encodeURIComponent(
  "export async function load(url, context, next) { return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context) }",
)}`)
Object.assign(globalThis, { acquireVsCodeApi: () => ({ postMessage: () => {}, getState: () => undefined, setState: () => {} }) })
const consoleError = console.error
console.error = (...args: unknown[]) => { if (!String(args[0]).includes('useLayoutEffect does nothing on the server')) consoleError(...args) }
const React = await import('react')
;(globalThis as typeof globalThis & { React: typeof React }).React = React
const { createElement } = React
const { renderToStaticMarkup } = await import('react-dom/server')
const { parse } = await import('node-html-parser')
const { EditorState } = await import('@tiptap/pm/state')
const { history, undo } = await import('@tiptap/pm/history')
const { getSchema } = await import('@tiptap/core')

const { EXERCISE_TAG, exerciseTagOf, parseDeck, parseSlideBody, writeSlideBody } = await import('../../../../../src/decks/deckFormat')
const { BUILT_IN_THEME } = await import('../../../../../src/decks/deckTheme')
const { publicDeck, deckDigest } = await import('../../../../../src/decks/page/publicDeck')
const { pageHtml } = await import('../../../../../src/decks/page/pageHtml')
const { PAGE_SCRIPT } = await import('../../../../../src/decks/page/pageScript')
const { wallDataOf } = await import('../../../../../src/decks/present/presentProtocol')
const { slideStamp } = await import('../../../../../src/decks/deckLibraryFormat')
const { layoutSlide, textBoxes } = await import('./layoutSlide')
const { setPath, valueAt } = await import('./slideEdits')
const { slideMarkup } = await import('./slideMarkup')
const { SlideCanvas } = await import('./SlideCanvas')
const { SlideSettings } = await import('../SlideSettings')
const { createEditorSchemaExtensions } = await import('../../../utils/editorMarkdown')
const { installTestDocument } = await import('../../../utils/markdownFidelity')
const { DeckSlide } = await import('../handout/deckSchema')
const { slidesOf, updateSlide } = await import('../deckDocument')

const BODY = 'id: ex01\ntitle: Try it\nitems:\n- heading: Open the file\n- heading: Ask the assistant'
const DECK = `---\ndeck: 1\n---\n\n\`\`\`slide exercise\n${BODY}\n\`\`\`\n\nDo the steps.\n`
const pill = (kind: string, data: Parameters<typeof layoutSlide>[1], editing = false) =>
  textBoxes(layoutSlide(kind, data, { editing })).find(box => box.path === 'tag')

// ---- A deck with no `tag:` line: read, written back and drawn as before.
{
  const data = parseSlideBody(BODY)
  assert.equal(data.tag, undefined)
  assert.equal(writeSlideBody(BODY, data), BODY, 'opening and writing back changes no byte')
  assert.equal(parseDeck(DECK).slides[0].body, BODY)
  assert.equal(exerciseTagOf(data), 'Exercise')
  assert.equal(EXERCISE_TAG, 'Exercise')
  const box = pill('exercise', data)!
  assert.deepEqual([box.text, box.cls, box.placeholder], ['Exercise', 'tag', 'Exercise'], 'the default pill, as text the slide edits')
  assert.equal(valueAt(data, 'tag'), 'Exercise')
  // Only an exercise has a pill.
  for (const kind of ['points', 'boxes', 'title', 'statement']) assert.equal(pill(kind, { ...data, tag: 'X' }, true), undefined, kind)
  // The other marks carry no words of the person's: numbers and the bar.
  const marks = layoutSlide('exercise', data).boxes.filter(entry => entry.type === 'mark')
  assert.deepEqual(marks.map(mark => mark.key), [])
}

// ---- Editing the pill writes `tag: <words>` through writeScalar, after the title, quoted where it has to be.
{
  const cases: Array<[string, string]> = [
    ['Harjutus', 'tag: Harjutus'],
    ['Step: one', 'tag: "Step: one"'],
    ['Note:', 'tag: "Note:"'],
    ['#1 of 3', 'tag: "#1 of 3"'],
    ['Try it # now', 'tag: "Try it # now"'],
    ['yes', 'tag: "yes"'],
    ['2', 'tag: "2"'],
  ]
  for (const [words, line] of cases) {
    const next = setPath(parseSlideBody(BODY), 'tag', words)
    const body = writeSlideBody(BODY, next)
    assert.equal(body, `id: ex01\ntitle: Try it\n${line}\nitems:\n- heading: Open the file\n- heading: Ask the assistant`, words)
    assert.equal(parseSlideBody(body).tag, words, `${words} reads back`)
    // That any YAML reader reads the same string: deckFormat.test.ts (js-yaml), with these words.
    assert.equal(pill('exercise', parseSlideBody(body))!.text, words)
  }
  // A changed pill rewrites only its own line.
  const written = 'id: ex01\ntitle: Try it\ntag: Harjutus   # mine\nitems:\n- heading: Open'
  assert.equal(writeSlideBody(written, parseSlideBody(written)), written, 'an untouched line stays as written')
  assert.equal(writeSlideBody(written, setPath(parseSlideBody(written), 'tag', 'Ülesanne')), 'id: ex01\ntitle: Try it\ntag: Ülesanne\nitems:\n- heading: Open')
}

// ---- Emptying it writes `tag: ""`: no pill anywhere but on the stage, where it waits for the caret to leave.
{
  const body = writeSlideBody(BODY, setPath(parseSlideBody(BODY), 'tag', ''))
  assert.match(body, /\ntag: ""\n/)
  const data = parseSlideBody(body)
  assert.equal(data.tag, '')
  assert.equal(exerciseTagOf(data), '')
  assert.equal(valueAt(data, 'tag'), '')
  assert.equal(pill('exercise', data), undefined, 'no pill on a thumbnail, the wall or the page')
  const editing = pill('exercise', data, true)!
  assert.deepEqual([editing.text, editing.placeholder], ['', 'Exercise'], 'on the stage: empty, the default as its placeholder')
  // The stage's empty pill is hidden by its own rule once the caret leaves; the placeholder is faint, on the pill.
  const css = readFileSync(fileURLToPath(new URL('./slide.css', import.meta.url)), 'utf8')
  assert.match(css, /\.deck-sl \.tag\[contenteditable\]:empty:not\(:focus\) \{ display: none; \}/)
  assert.match(css, /\.deck-sl \.tag \{ white-space: nowrap; \}/)
  const stage = renderToStaticMarkup(createElement(SlideCanvas, {
    kind: 'exercise', data, width: 960, theme: BUILT_IN_THEME, borderless: false, assets: {},
    editing: { onText: () => {}, onKey: () => false, onSetIcon: () => {}, focusPath: null, onFocused: () => {} },
  }))
  const tag = parse(stage).querySelector('.tag')!
  assert.equal(tag.getAttribute('contenteditable'), 'plaintext-only')
  assert.equal(tag.getAttribute('data-ph'), 'Exercise')
  assert.equal(tag.getAttribute('data-path'), 'tag')
  assert.equal(tag.getAttribute('aria-multiline'), undefined, 'one line')
}

// ---- Settings' Label row: only on an exercise, the pill's words, the default as its placeholder.
{
  const render = (kind: string, tag?: string) => parse(renderToStaticMarkup(createElement(SlideSettings, {
    number: 2, kind, data: { title: 'Try it', ...(tag === undefined ? {} : { tag }) }, onKind: () => {}, onChange: () => {}, onClose: () => {}, onUndo: () => {},
  })))
  const field = (tag?: string) => render('exercise', tag).querySelector('#deck-tag-2')!
  assert.equal(render('exercise').querySelector('label[for="deck-tag-2"]')!.text, 'Label')
  assert.equal(field().getAttribute('placeholder'), 'Exercise')
  assert.equal(field().getAttribute('value'), 'Exercise', 'no line: the default, as the slide shows it')
  assert.equal(field('Harjutus').getAttribute('value'), 'Harjutus')
  assert.equal(field('').getAttribute('value'), '', 'no pill: empty, the default as its placeholder')
  for (const kind of ['points', 'boxes', 'title', 'section', 'table']) assert.equal(render(kind).querySelector('#deck-tag-2'), null, kind)
}

// ---- The Label row sets the line, as the deck view writes it (one transaction), and Undo puts back the line that was there.
{
  installTestDocument()
  const schema = getSchema(createEditorSchemaExtensions({ deck: [DeckSlide] }))
  const run = (body: string, words: string) => {
    const doc = schema.nodes.doc.create(null, [schema.nodes.deckSlide.create({ kind: 'exercise', body, notes: null }), schema.nodes.paragraph.create(null, schema.text('Do the steps.'))])
    let state = EditorState.create({ doc, plugins: [history()] })
    // DeckView's `onChange={patch => changeSlide(data => ({ ...data, ...patch }))}`, with the row's patch.
    const tr = updateSlide(state, 0, { ...slidesOf(state.doc)[0].data, tag: words })!
    state = state.apply(tr)
    const set = slidesOf(state.doc)[0].node.attrs.body as string
    undo(state, next => { state = state.apply(next) })
    return { set, undone: slidesOf(state.doc)[0].node.attrs.body as string }
  }
  const fromNone = run(BODY, 'Harjutus')
  assert.match(fromNone.set, /\ntag: Harjutus\n/)
  assert.equal(fromNone.undone, BODY, 'Undo takes the line out again: the default comes back')
  const hidden = writeSlideBody(BODY, { ...parseSlideBody(BODY), tag: '' })
  const fromHidden = run(hidden, 'Harjutus')
  assert.match(fromHidden.set, /\ntag: Harjutus\n/, 'words in the row bring the pill back')
  assert.equal(fromHidden.undone, hidden, 'Undo puts back `tag: ""`')
  const written = 'id: ex01\ntitle: Try it\ntag: "Teema: 1"\nitems:\n- heading: Open'
  const cleared = run(written, '')
  assert.match(cleared.set, /\ntag: ""\n/, 'an emptied row: no pill')
  assert.equal(cleared.undone, written, 'Undo puts back the words that were there')
}

// ---- The page and the wall show the same pill, or none.
{
  const deckText = (tagLine: string) => DECK.replace('title: Try it\n', `title: Try it\n${tagLine}`)
  const page = (text: string) => {
    const deck = publicDeck(text, { folderName: 'Demo', deckName: 'Demo', theme: BUILT_IN_THEME })
    const html = pageHtml(deck, { slideCss: '', fonts: [] }, { digest: deckDigest(deck), pictureUrl: () => null })
    return { deck, root: parse(html) }
  }
  const wall = (text: string) => {
    const data = wallDataOf(parseSlideBody(parseDeck(text).slides[0].body))
    return parse(renderToStaticMarkup(createElement(SlideCanvas, { kind: 'exercise', data, width: 960, theme: BUILT_IN_THEME, borderless: false, assets: {} })))
  }
  for (const [line, words] of [['', 'Exercise'], ['tag: Harjutus\n', 'Harjutus'], ['tag: "Teema: <1> & 2"\n', 'Teema: <1> & 2'], ['tag: ""\n', null]] as const) {
    const { deck, root } = page(deckText(line))
    const slide = root.querySelector('.deck-sl .tag')
    const label = root.querySelector('.part .lab .tag')
    const contents = root.querySelector('.toc .tag')
    const onWall = wall(deckText(line)).querySelector('.deck-sl .tag')
    if (words === null) {
      assert.equal(slide, null, 'the page draws no pill on the slide')
      assert.equal(label, null, 'nor beside the part')
      assert.equal(contents, null, 'nor in Contents')
      assert.equal(onWall, null, 'the wall draws none')
      assert.equal(deck.slides[0].data.tag, '')
    } else {
      for (const [where, node] of [['slide', slide], ['part', label], ['contents', contents], ['wall', onWall]] as const) {
        assert.equal(node?.text, words, `${where}: ${words}`)
      }
      assert.equal(deck.slides[0].data.tag, line ? words : undefined, 'the page holds the line only when it is written')
    }
    // Contents still knows it is an exercise, pill or none, so it ticks it once its steps are done.
    assert.equal(root.querySelector('.part')!.hasAttribute('data-exercise'), true)
  }
  assert.ok(PAGE_SCRIPT.includes("part.hasAttribute('data-exercise')"))
  assert.ok(!PAGE_SCRIPT.includes('.lab .tag'))
  // A changed pill is a changed page; a deck without the line keeps its digest.
  const digest = (text: string) => deckDigest(publicDeck(text, { folderName: 'Demo', deckName: 'Demo', theme: BUILT_IN_THEME }))
  assert.notEqual(digest(deckText('tag: Harjutus\n')), digest(DECK))
  assert.notEqual(digest(deckText('tag: ""\n')), digest(DECK))
  assert.equal(slideMarkup('exercise', parseSlideBody(BODY), { theme: BUILT_IN_THEME, borderless: false }).includes('>Exercise</div>'), true)
}

// ---- A library copy: the pill counts in its stamp only when its line is written, so every stamp made before stands.
{
  const data = parseSlideBody(BODY)
  const before = slideStamp('exercise', data, 'Do the steps.', 'Slide library')
  // The stamp main computed for this slide before the pill had a line: pinned, so it can't drift.
  assert.equal(before, 'la3q3a')
  assert.notEqual(slideStamp('exercise', { ...data, tag: 'Harjutus' }, 'Do the steps.', 'Slide library'), before)
  assert.notEqual(slideStamp('exercise', { ...data, tag: '' }, 'Do the steps.', 'Slide library'), before)
}

console.log('exerciseTag: passed')
