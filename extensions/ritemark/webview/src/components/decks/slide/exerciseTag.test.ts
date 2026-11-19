/**
 * 16 November: an exercise slide's pill is the slide's own words, in an optional `tag:` line. Missing: the default
 * ("Exercise"), and the deck stays byte for byte; written through `writeScalar`; emptied: `tag: ""`, no pill, on the
 * stage, the wall and the page; Undo puts back the line that was there.
 *
 * Sprint 164 PR 3 (the decks README, "Label, a block of its own"): the pill is drawn as a Label over the slide's title,
 * as the slide converts (`legacyToBlocks`), and Settings' Label row is gone (Jarmo's yes by name, 19 November).
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

const { EXERCISE_TAG, exerciseTagOf, isDefaultExerciseTag, parseDeck, parseSlideBody, writeSlideBody } = await import('../../../../../src/decks/deckFormat')
const { BUILT_IN_THEME } = await import('../../../../../src/decks/deckTheme')
const { publicDeck, deckDigest } = await import('../../../../../src/decks/page/publicDeck')
const { pageHtml } = await import('../../../../../src/decks/page/pageHtml')
const { PAGE_SCRIPT } = await import('../../../../../src/decks/page/pageScript')
const { wallDataOf } = await import('../../../../../src/decks/present/presentProtocol')
const { slideStamp, slideStamps } = await import('../../../../../src/decks/deckLibraryFormat')
const { layoutSlide, textBoxes } = await import('./layoutSlide')
const { oneLine, setPath, undoKeyOf, valueAt } = await import('./slideEdits')
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
  // Sprint 161 (PR 2, decision 8): the stage draws an Exercise slide as the blocks its conversion writes; Sprint 164 PR 3:
  // its pill as a Label over its title, by #752's rule: none for `tag: ""`, the words for any other, the default without.
  const drawn = (tag: string | undefined) => parse(renderToStaticMarkup(createElement(SlideCanvas, {
    kind: 'exercise', data: { ...data, tag }, width: 960, theme: BUILT_IN_THEME, borderless: false, assets: {},
    editing: { onText: () => {}, onKey: () => false, onSetIcon: () => {}, focusPath: null, onFocused: () => {} },
  })))
  assert.equal(drawn('').querySelector('.blk-label'), null, 'no Label')
  assert.equal(drawn('Harjutus').querySelector('.blk-label')!.text, 'Harjutus')
  assert.equal(drawn(undefined).querySelector('.blk-label')!.text, 'Exercise', 'no line: the default')
  assert.equal(drawn('Harjutus').querySelector('.blk-pill'), null, 'no pill of the Steps block\'s own')
}

// ---- Sprint 164 PR 3 (Jarmo's yes by name, 19 November): Settings has no Label row, on an exercise or anywhere else.
{
  const render = (kind: string, tag?: string) => parse(renderToStaticMarkup(createElement(SlideSettings, {
    number: 2, kind, data: { title: 'Try it', ...(tag === undefined ? {} : { tag }) }, onKind: () => {}, onChange: () => {}, onClose: () => {},
  })))
  for (const kind of ['exercise', '', 'points', 'boxes', 'title', 'section', 'table']) {
    const root = render(kind, 'Harjutus')
    assert.equal(root.querySelector('#deck-tag-2'), null, kind)
    assert.equal(root.querySelector('label[for="deck-tag-2"]'), null, kind)
  }
}

// ---- A `tag:` change through the deck view's one write of a slide's data (`updateSlide`, one transaction) sets the line,
// and Undo puts back the line that was there.
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

// ---- The page and the wall show the same pill, or none. Sprint 161 (PR 2): both draw the slide as the blocks its
// conversion writes; Sprint 164 PR 3: the pill as its Label (`.blk-label`), written only when it has words.
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
    const slide = root.querySelector('.deck-sl .blk-label')
    const contents = root.querySelector('.toc .tag')
    const onWall = wall(deckText(line)).querySelector('.deck-sl .blk-label')
    if (words === null) {
      assert.equal(slide, null, 'the page draws no pill on the slide')
      assert.equal(contents, null, 'nor in Contents')
      assert.equal(onWall, null, 'the wall draws none')
      assert.ok(!(deck.slides[0].data.markdown ?? '').includes('{.label}'), 'no Label in the page\'s slide')
    } else {
      for (const [where, node] of [['slide', slide], ['contents', contents], ['wall', onWall]] as const) {
        assert.equal(node?.text, words, `${where}: ${words}`)
      }
      assert.ok((deck.slides[0].data.markdown ?? '').includes(']{.label}\n\n# Try it'), 'the page holds it as a Label over the title')
      assert.ok(!/tag=/.test(deck.slides[0].data.markdown ?? ''), 'never on the Steps line')
    }
    // Contents still knows it is an exercise, pill or none, so it ticks it once its steps are done.
    assert.equal(root.querySelector('#frame > .layer')!.hasAttribute('data-exercise'), true)
  }
  assert.ok(PAGE_SCRIPT.includes("layer.hasAttribute('data-exercise')"))
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
  // The stamp main computed for this slide before the pill had a line: pinned, so it can't drift. Sprint 161: today's
  // stamp is the block stamp, and a `from:` line holding this one still matches (`slideStamps`).
  assert.ok(slideStamps('exercise', data, 'Do the steps.', 'Slide library').includes('la3q3a'))
  assert.notEqual(slideStamp('exercise', { ...data, tag: 'Harjutus' }, 'Do the steps.', 'Slide library'), before)
  assert.notEqual(slideStamp('exercise', { ...data, tag: '' }, 'Do the steps.', 'Slide library'), before)
}

// ---- The first review's findings (PR 752, round 1).
{
  // A long label stays on one line within the content's width, cut with an ellipsis, never run off the slide.
  const long = pill('exercise', { title: 'T', tag: 'Harjutus 3: ava fail ja küsi assistendilt abi, siis veel üks samm ja veel' })!
  assert.equal(long.style?.maxWidth, 832)
  assert.equal(pill('exercise', { title: 'T', tag: 'X', picture: 'left' })!.style?.maxWidth, 960 - 432 - 48, 'beside a picture: the side it has')
  const css = readFileSync(fileURLToPath(new URL('./slide.css', import.meta.url)), 'utf8')
  assert.match(css, /\.deck-sl \.tag \{ box-sizing: border-box; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; \}/)
  // A label of spaces is no pill, anywhere.
  assert.equal(exerciseTagOf({ tag: '   ' }), '')
  assert.equal(pill('exercise', { title: 'T', tag: ' ' }), undefined)
  assert.equal(pill('exercise', { title: 'T', tag: ' ' }, true)!.text, '')
  const spaces = publicDeck(DECK.replace('title: Try it\n', 'title: Try it\ntag: " "\n'), { folderName: 'Demo', deckName: 'Demo', theme: BUILT_IN_THEME })
  assert.equal(parse(pageHtml(spaces, { slideCss: '', fonts: [] }, { digest: deckDigest(spaces), pictureUrl: () => null })).querySelector('.tag'), null)
  // The stamp: `tag: Exercise` written out draws what no line draws, so it is no change; a tag on another kind draws nothing.
  const data = parseSlideBody(BODY)
  const stamp = (kind: string, tag?: string) => slideStamp(kind, { ...data, ...(tag === undefined ? {} : { tag }) }, 'Do the steps.', 'Slide library')
  assert.equal(stamp('exercise', 'Exercise'), stamp('exercise'))
  assert.equal(stamp('exercise', '  '), stamp('exercise', ''), 'spaces are no pill, as empty is')
  assert.equal(stamp('points', 'Harjutus'), stamp('points'))
  // The undo keys and the one-line rule, shared by the stage and the Label row.
  const keys = (key: string, mods: { meta?: boolean; ctrl?: boolean; shift?: boolean } = {}) =>
    undoKeyOf({ key, metaKey: !!mods.meta, ctrlKey: !!mods.ctrl, shiftKey: !!mods.shift })
  assert.deepEqual([keys('z', { meta: true }), keys('Z', { meta: true, shift: true }), keys('y', { ctrl: true }), keys('z'), keys('a', { meta: true })], ['undo', 'redo', 'redo', null, null])
  assert.equal(oneLine('Har\njutus\r\n2\u2028x'), 'Har jutus 2 x')
}

// ---- Round 2 (PR 752).
{
  // A blank pill is saved as none, so the file never holds `tag: " "` and the Label row shows what is stored.
  assert.equal(setPath({ title: 'T' }, 'tag', '   ').tag, '')
  assert.equal(writeSlideBody(BODY, setPath(parseSlideBody(BODY), 'tag', ' ')).includes('tag: ""'), true)
  // Undo keys: never mid-composition, never with Alt.
  assert.equal(undoKeyOf({ key: 'z', metaKey: true, ctrlKey: false, shiftKey: false, isComposing: true }), null)
  assert.equal(undoKeyOf({ key: 'z', metaKey: true, ctrlKey: false, shiftKey: false, altKey: true }), null)
  // The default, in any case (the pill is drawn in capitals), is the default to the stamp.
  for (const tag of [undefined, 'Exercise', 'exercise', 'EXERCISE', ' Exercise ']) assert.equal(isDefaultExerciseTag({ tag }), true, String(tag))
  for (const tag of ['', 'Harjutus', 'Exercises']) assert.equal(isDefaultExerciseTag({ tag }), false, tag)
  const data = parseSlideBody(BODY)
  const stamp = (tag?: string) => slideStamp('exercise', { ...data, ...(tag === undefined ? {} : { tag }) }, 'Do the steps.', 'Slide library')
  assert.equal(stamp('exercise'), stamp())
  assert.ok(slideStamps('exercise', { ...data, tag: 'EXERCISE' }, 'Do the steps.', 'Slide library').includes('la3q3a'))
  // The pill's CSS: no ellipsis while it is typed in (the caret's end stays in view).
  const css = readFileSync(fileURLToPath(new URL('./slide.css', import.meta.url)), 'utf8')
  assert.match(css, /\.deck-sl \.tag\[contenteditable\]:focus \{ text-overflow: clip; \}/)
}

// ---- The Experience lead's guard (16 November): focusing the pill and leaving it without typing writes nothing (the
// Label row, which shared the rule, is gone since Sprint 164 PR 3). The DOM writes only on `input` (the pill) and `change` (the row), never on focus or blur; and a write
// of the words as they were is no write at all, through the one rule both use (`setPath`).
{
  installTestDocument()
  const schema = getSchema(createEditorSchemaExtensions({ deck: [DeckSlide] }))
  const unchanged = (body: string, label: string) => {
    const data = parseSlideBody(body)
    const shown = valueAt(data, 'tag')
    // The Label row's onChange and the pill's onText both go through setPath with the words they show.
    assert.equal(setPath(data, 'tag', oneLine(shown)), data, `${label}: the same words are the same data`)
    // The stage's write: the body is rewritten from that data, and is the body as it was, so nothing is dispatched.
    assert.equal(writeSlideBody(body, setPath(data, 'tag', shown)), body, `${label}: the stage writes nothing`)
    // The deck view's write (Settings): no transaction at all, so the document, the undo history and the file stay.
    const doc = schema.nodes.doc.create(null, [schema.nodes.deckSlide.create({ kind: 'exercise', body, notes: null })])
    const state = EditorState.create({ doc })
    assert.equal(updateSlide(state, 0, setPath(slidesOf(state.doc)[0].data, 'tag', shown)), null, `${label}: Settings dispatches nothing`)
  }
  unchanged(BODY, 'no tag: line (the field and the pill show "Exercise")')
  unchanged(BODY.replace('title: Try it', 'title: Try it\ntag: Harjutus'), 'tag: Harjutus')
  unchanged(BODY.replace('title: Try it', 'title: Try it\ntag: ""'), 'tag: ""')
  unchanged(BODY.replace('title: Try it', 'title: Try it\ntag: "  "'), 'tag of spaces')
  // The deck file as a whole: no line written, byte for byte.
  const body = parseDeck(DECK).slides[0].body
  assert.equal(DECK.replace(body, writeSlideBody(body, setPath(parseSlideBody(body), 'tag', 'Exercise'))), DECK)
  // Typing the default over a missing line writes nothing either; any other words do.
  assert.equal(setPath(parseSlideBody(BODY), 'tag', 'Exercise').tag, undefined)
  assert.equal(setPath(parseSlideBody(BODY), 'tag', 'Exercis').tag, 'Exercis')
}

console.log('exerciseTag: passed')
