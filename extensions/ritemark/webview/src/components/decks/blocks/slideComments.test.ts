/**
 * Sprint 161 (experience 46, "Comments on the slide, for Claude"): comments on the slide editor's document, in the
 * handout's notation inside the slide block. Byte-identical round trips through the stage's sync (`SlideSync`), what a
 * comment is on and that it stays on it through an edit around it, the one door (`startSlideComment`, the right-click
 * menu's Comment and ⌘/), and the strip's and the bar's counts.
 * Run with `npx tsx webview/src/components/decks/blocks/slideComments.test.ts`.
 */
import { strict as assert } from 'node:assert'
import { register } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Node as PMNode } from '@tiptap/pm/model'
import { EditorState, NodeSelection, TextSelection, type Selection, type Transaction } from '@tiptap/pm/state'
import { loadSlideWithComments, saveSlide, slideCommentSchema } from './slideEditorHarness'
import { SlideSync } from './slideSync'
import { keyPastNotes, notesOutOfTheWay, placeSlideNote, slideMarkersOf, topBlockAt, noteTarget } from './slideCommentPlace'
import { joinBackward, joinForward, selectNodeBackward } from '@tiptap/pm/commands'
import { slideCommentsOf } from '../../../../../src/decks/blocks/slideComments'
import { saveSlideMarkdown } from './slideEditorMarkdown'
import { editorHTML } from '../../../utils/markdownFidelity'

// SlideComments imports style sheets through the card's controls, which Node cannot load: for this run, a sheet is an
// empty module; and the bridge asks for the webview's API.
register(`data:text/javascript,${encodeURIComponent(
  "export async function load(url, context, next) { return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context) }",
)}`)
Object.assign(globalThis, { acquireVsCodeApi: () => ({ postMessage: () => {}, getState: () => undefined, setState: () => {} }) })
const React = await import('react')
;(globalThis as typeof globalThis & { React: typeof React }).React = React
const { caretTarget, leaveHiddenNote, markerSpot, startSlideComment } = await import('../SlideComments')
const { liftCommentLine, registerOpenBox, startComment, yieldOpenBox } = await import('../../../extensions/comment/CommentNode')
const { stripCommentCount } = await import('../SlideStrip')
const { DeckComments, deckCommentStops, nextCommentStop, deckCommentsLabel, stopIndexOf } = await import('../DeckComments')
const { renderToStaticMarkup } = await import('react-dom/server')
const { parse } = await import('node-html-parser')

const here = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const load = loadSlideWithComments
/** The stage's save, as SlideEditor makes it. */
const save = (doc: PMNode) => saveSlideMarkdown(doc, editorHTML(doc), load)

const ID_A = '11111111-1111-4111-8111-111111111111'
const ID_B = '22222222-2222-4222-8222-222222222222'
const ID_C = '33333333-3333-4333-8333-333333333333'

const PLAIN = `# An assistant's four parts

An assistant is set up once and used every day.

:::: {.boxes look="boxes"}

::: {.box icon="list-checks"}
### Instructions
What it does
:::

::: {.box icon="book"}
### Knowledge
The files it answers from
:::

::::

Closing line.`

const COMMENTED = `# An assistant's four parts

An assistant is set up <mark data-comment="@claude say it once" data-comment-id="${ID_A}">once and used every day</mark>.

<!-- {id:${ID_B}} Make each box at most five words. @claude -->

:::: {.boxes look="boxes"}

::: {.box icon="list-checks"}
### Instructions
What it does
:::

::: {.box icon="book"}
### Knowledge
The files it answers from
:::

::::

Closing line.

<!-- {id:${ID_C}} The whole slide is too busy. -->`

/** The stage on a slide: its document, its sync with the node, and the node's Markdown. */
function stage(markdown: string) {
  let state = EditorState.create({ doc: load(markdown) })
  let node = markdown
  const sync = new SlideSync(load, save, markdown, state.doc)
  const apply = (tr: Transaction) => {
    state = state.apply(tr)
    sync.track(tr)
    const write = sync.toWrite(state.doc)
    if (write === null) sync.settled(state.doc)
    else { node = write; sync.wrote(write, state.doc) }
  }
  return { get state() { return state }, get node() { return node }, apply }
}

/** The position of the first text `words`, from its start. */
function at(doc: PMNode, words: string): number {
  let found = -1
  doc.descendants((child, pos) => {
    if (found >= 0 || !child.isText) return
    const index = child.text!.indexOf(words)
    if (index >= 0) found = pos + index
  })
  assert.ok(found >= 0, words)
  return found
}

/** The top-level block holding `words`. */
const blockOf = (doc: PMNode, words: string) => topBlockAt(doc, at(doc, words))!

/** The note with this id: its position. */
function notePos(doc: PMNode, id: string): number {
  let found = -1
  doc.descendants((child, pos) => {
    if (child.type.name === 'commentNode' && child.attrs.id === id) found = pos
  })
  assert.ok(found >= 0, id)
  return found
}

/** Fill a new note's words, as the card's Comment does (`applyCommentNote`). */
function fill(tr: Transaction, id: string, note: string): Transaction {
  return tr.setNodeMarkup(notePos(tr.doc, id), undefined, { id, note, agentAlias: null })
}

// ── Byte-identical: a slide with comments opens and saves as it was written ──
{
  const view = stage(COMMENTED)
  assert.equal(view.node, COMMENTED)
  // A selection, and a word typed and taken away again: the slide is written back byte for byte.
  view.apply(view.state.tr.setSelection(TextSelection.create(view.state.doc, at(view.state.doc, 'Closing'))))
  const pos = at(view.state.doc, 'Closing')
  view.apply(view.state.tr.insertText('X', pos))
  assert.notEqual(view.node, COMMENTED)
  view.apply(view.state.tr.delete(pos, pos + 1))
  assert.equal(view.node, COMMENTED, 'a word typed and deleted again gives the slide back as written')
  // The comments' carriers save as the handout's do: both notes and the mark, ids and all.
  const saved = saveSlide(load(COMMENTED))
  for (const piece of [`<!-- {id:${ID_B}} Make each box at most five words. @claude -->`, `<!-- {id:${ID_C}} The whole slide is too busy. -->`, `<mark data-comment="@claude say it once" data-comment-id="${ID_A}">once and used every day</mark>`]) {
    assert.ok(saved.includes(piece), `the save keeps ${piece}`)
  }
  assert.deepEqual(slideCommentsOf(saved), slideCommentsOf(COMMENTED), 'a save reads back as the same comments on the same things')
  console.log('slideComments (stage): a slide with comments round-trips byte for byte')
}

// ── Adding a comment, then deleting it, gives the slide back byte for byte ──
{
  const view = stage(PLAIN)
  const boxes = blockOf(view.state.doc, 'Instructions')
  const add = view.state.tr
  placeSlideNote({ kind: 'block', pos: boxes })(add, ID_B)
  view.apply(add)
  view.apply(fill(view.state.tr, ID_B, 'Shorter boxes. @claude'))
  assert.equal(
    view.node,
    PLAIN.replace('\n\n:::: {.boxes', `\n\n<!-- {id:${ID_B}} Shorter boxes. @claude -->\n\n:::: {.boxes`),
    'the note is written right before the block it is on, and nothing else changes',
  )
  const note = notePos(view.state.doc, ID_B)
  view.apply(view.state.tr.delete(note, note + view.state.doc.nodeAt(note)!.nodeSize))
  assert.equal(view.node, PLAIN, 'deleted again, the slide is as it was written')

  // On the whole slide: at its end.
  const whole = stage(PLAIN)
  const end = whole.state.tr
  placeSlideNote({ kind: 'slide' })(end, ID_C)
  whole.apply(end)
  whole.apply(fill(whole.state.tr, ID_C, 'Too busy.'))
  assert.equal(whole.node, `${PLAIN}\n\n<!-- {id:${ID_C}} Too busy. -->`)

  // On the words: the handout's mark.
  const words = stage(PLAIN)
  const from = at(words.state.doc, 'once and used')
  words.apply(words.state.tr.addMark(from, from + 'once and used every day'.length, slideCommentSchema.marks.commentMark.create({ id: ID_A, note: 'Say it once.', agentAlias: null })))
  assert.equal(words.node, PLAIN.replace('once and used every day', `<mark data-comment="Say it once." data-comment-id="${ID_A}">once and used every day</mark>`))
  words.apply(words.state.tr.removeMark(from, from + 'once and used every day'.length, slideCommentSchema.marks.commentMark))
  assert.equal(words.node, PLAIN)
  console.log('slideComments (stage): adding then deleting a comment is byte-identical')
}

// ── What each comment is on: the stage and the Markdown agree ──
{
  const doc = load(COMMENTED)
  const markers = slideMarkersOf(doc)
  assert.deepEqual(markers.map(marker => marker.key), [`c:${ID_A}`, `c:${ID_B}`, `c:${ID_C}`])
  assert.deepEqual(markers.map(marker => marker.anchor), slideCommentsOf(COMMENTED).map(comment => comment.anchor), 'one reading of what a comment is on')
  assert.deepEqual(markers[1].target, { kind: 'block', pos: blockOf(doc, 'Instructions') })
  assert.deepEqual(markers[2].target, { kind: 'slide' })
  assert.equal(markers[0].target.kind, 'words')
  // Codex on #766: an anchored comment without an id carries its whole range, which Edit and Delete use (the shared
  // operations read `from` and `to` when there is no id).
  const legacy = load('# T\n\nA <mark data-comment="no id">kept words</mark> line.')
  const [old] = slideMarkersOf(legacy)
  assert.equal(old.commentId, undefined)
  assert.equal(old.key, `m:${old.from}-${old.to}`)
  assert.equal(legacy.textBetween(old.from!, old.to!), 'kept words', 'from and to are the words')
  console.log('slideComments (stage): words, a block and the whole slide, read the same way on the stage and in the file')
}

// ── Each anchor survives an edit around it ──
{
  const view = stage(COMMENTED)
  const anchors = () => slideCommentsOf(view.node).map(comment => comment.anchor)
  const before = anchors()
  // Words typed before and after the commented words, and inside the boxes.
  view.apply(view.state.tr.insertText('Really, ', at(view.state.doc, 'An assistant is')))
  view.apply(view.state.tr.insertText(' still', at(view.state.doc, 'every day') + 'every day'.length))
  view.apply(view.state.tr.insertText(' and more', at(view.state.doc, 'What it does') + 'What it does'.length))
  // A new paragraph after the line, before the note on the boxes (Enter at the line's end).
  const lineEnd = blockOf(view.state.doc, 'An assistant is') + view.state.doc.nodeAt(blockOf(view.state.doc, 'An assistant is'))!.nodeSize
  view.apply(view.state.tr.insert(lineEnd, slideCommentSchema.nodes.paragraph.create(null, slideCommentSchema.text('A new line.'))))
  // Words typed at the slide's end, before the note on the whole slide.
  view.apply(view.state.tr.insertText(' Thanks.', at(view.state.doc, 'Closing line.') + 'Closing line.'.length))
  const after = anchors()
  assert.equal(after[0].kind, 'words')
  assert.equal((after[0] as { words: string }).words, 'once and used every day', 'the words stay the words')
  assert.deepEqual(after[1], before[1], 'the note stays on the boxes')
  assert.deepEqual(after[2], before[2], 'the note stays on the whole slide')
  // The block before the boxes deleted: the note is still on the boxes.
  const line = blockOf(view.state.doc, 'A new line.')
  view.apply(view.state.tr.delete(line, line + view.state.doc.nodeAt(line)!.nodeSize))
  assert.deepEqual(slideCommentsOf(view.node)[1].anchor, before[1])
  assert.deepEqual(noteTarget(view.state.doc, notePos(view.state.doc, ID_B)), { kind: 'block', pos: blockOf(view.state.doc, 'Instructions') })
  console.log('slideComments (stage): each anchor survives an edit around it')
}

// ── Backspace and Delete next to a hidden note: the blocks join, the comment stays (never taken by a key) ──
{
  const md = `<!-- {id:${ID_A}} On the title -->\n\n# Title\n\nFirst line.\n\n<!-- {id:${ID_B}} On the second line -->\n\nSecond line.`
  const caretAt = (doc: PMNode, words: string, end = false) => EditorState.create({ doc, selection: TextSelection.create(doc, at(doc, words) + (end ? words.length : 0)) })
  // Backspace at the start of "Second line.": the note moves before "First line.", then the ordinary Backspace joins.
  let state = caretAt(load(md), 'Second line.')
  const back = notesOutOfTheWay(state, 'backward')
  assert.ok(back && back !== 'stop')
  state = state.apply(back)
  assert.ok(joinBackward(state, tr => { state = state.apply(tr) }))
  assert.equal(save(state.doc), `<!-- {id:${ID_A}} On the title -->\n\n# Title\n\n<!-- {id:${ID_B}} On the second line -->\n\nFirst line.Second line.`)
  // Delete at the end of "First line.": the same, forward.
  state = caretAt(load(md), 'First line.', true)
  const forward = notesOutOfTheWay(state, 'forward')
  assert.ok(forward && forward !== 'stop')
  state = state.apply(forward)
  assert.ok(joinForward(state, tr => { state = state.apply(tr) }))
  assert.equal(save(state.doc), `<!-- {id:${ID_A}} On the title -->\n\n# Title\n\n<!-- {id:${ID_B}} On the second line -->\n\nFirst line.Second line.`)
  // Nothing to join with: the key does nothing, and the note stays.
  assert.equal(notesOutOfTheWay(caretAt(load(md), 'Title'), 'backward'), 'stop', 'Backspace at the title, a note before it')
  assert.equal(notesOutOfTheWay(caretAt(load(`${PLAIN}\n\n<!-- {id:${ID_C}} whole -->`), 'Closing line.', true), 'forward'), 'stop', 'Delete at the end, a note on the whole slide after it')
  // Anywhere else, the keys are the ordinary ones.
  assert.equal(notesOutOfTheWay(caretAt(load(md), 'First line.'), 'backward'), null)
  assert.equal(notesOutOfTheWay(caretAt(load(md), 'Second line.', true), 'forward'), null)
  // Review round 1: next to a picture or a line the notes moved and nothing joined, so the comment changed what it
  // was on. The notes now move only when the ordinary key then acts; it takes the picture before, as it does without
  // a note, and the comment stays on the words.
  const withPicture = `# Title\n\n![A chart](images/chart.png)\n\n<!-- {id:${ID_B}} On the line -->\n\nThe line.`
  let pictureState = caretAt(load(withPicture), 'The line.')
  /** The stage's Backspace: the move, then the ordinary key (`joinBackward`, else `selectNodeBackward`). */
  const backspace = (state: EditorState): EditorState => {
    const step = keyPastNotes(state, 'backward')
    assert.ok(step && step !== 'stop', 'the key acts here')
    let next = state.apply(step.tr)
    if (step.done) return next
    const run = (tr: Transaction) => { next = next.apply(tr) }
    assert.ok(joinBackward(next, run) || selectNodeBackward(next, run))
    return next
  }
  pictureState = backspace(pictureState)
  assert.deepEqual(slideCommentsOf(save(pictureState.doc)).map(comment => comment.anchor), [{ kind: 'block', block: { kind: 'text' } }], 'still on the line')
  // Review round 2: next to a table, which can't be joined, the key selects the table, as it does without a note
  // (it did nothing), and the comment stays on the line.
  const withTable = `# Title\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n<!-- {id:${ID_B}} On the line -->\n\nThe line.`
  const tableState = backspace(caretAt(load(withTable), 'The line.'))
  assert.equal((tableState.selection as NodeSelection).node?.type.name, 'table', 'the table is selected')
  assert.deepEqual(slideCommentsOf(save(tableState.doc)).map(comment => comment.anchor), [{ kind: 'block', block: { kind: 'text' } }], 'still on the line')
  const nothingBefore = `<!-- {id:${ID_B}} On the title -->\n\n# Title`
  assert.equal(keyPastNotes(caretAt(load(nothingBefore), 'Title'), 'backward'), 'stop')
  const source = here('./SlideEditor.tsx')
  assert.match(source, /const step = keyPastNotes\(this\.editor\.state, direction\)\n        if \(step === 'stop'\) return true\n        if \(!step\) return false\n        this\.editor\.view\.dispatch\(step\.tr\)\n        return step\.done/)
  assert.match(source, /Backspace: pastNotes\('backward'\), Delete: pastNotes\('forward'\)/)
  assert.match(source, /priority: 1000,/, "before the editor's own Backspace and Delete")
  assert.match(here('../SlideComments.tsx'), /export const SlideCommentNode = CommentNode\.extend\(\{\n  selectable: false,/, 'the caret and the arrows never select a hidden note')
  console.log('slideComments (keys): Backspace and Delete join the blocks around a note and keep it')
}

// ── The one door: the right-click menu's Comment and ⌘/ ──
interface Storage { openBox: unknown; openRequest: { key: string; as: string } | null; notifyRail: (() => void) | null; hideToolbar: (() => void) | null }
function fakeEditor(doc: PMNode, select: (doc: PMNode) => Selection, openBox: unknown = null) {
  let state = EditorState.create({ schema: slideCommentSchema, doc, selection: select(doc) })
  const storage: Storage = { openBox, openRequest: null, notifyRail: () => {}, hideToolbar: () => {} }
  const transactions: Transaction[] = []
  const editor = {
    isDestroyed: false,
    get state() { return state },
    storage: { commentNode: storage },
    view: { dispatch(tr: Transaction) { transactions.push(tr); state = state.apply(tr) } },
  }
  return { editor: editor as never, storage, transactions, dispatch: (tr: Transaction) => editor.view.dispatch(tr), get state() { return state } }
}
const requestedId = (storage: Storage) => {
  assert.ok(storage.openRequest && storage.openRequest.as === 'box' && storage.openRequest.key.startsWith('c:'))
  return storage.openRequest.key.slice(2)
}
{
  // Right-click on the boxes: a note before them, and its box asked for.
  const plain = load(PLAIN)
  const onBoxes = fakeEditor(plain, doc => TextSelection.create(doc, at(doc, 'Closing')))
  assert.equal(startSlideComment(onBoxes.editor, { kind: 'block', pos: blockOf(plain, 'Instructions') }), true)
  const id = requestedId(onBoxes.storage)
  assert.deepEqual(slideMarkersOf(onBoxes.state.doc).find(marker => marker.commentId === id)?.anchor, { kind: 'block', block: { kind: 'boxes', count: 2 } })
  assert.equal(onBoxes.transactions.length, 1, 'one transaction')

  // On the background: the whole slide. A selection elsewhere isn't what it is on: it collapses first.
  const whole = fakeEditor(plain, doc => TextSelection.create(doc, at(doc, 'An assistant is'), at(doc, 'An assistant is') + 12))
  startSlideComment(whole.editor, { kind: 'slide' })
  const wholeId = requestedId(whole.storage)
  assert.deepEqual(slideMarkersOf(whole.state.doc).find(marker => marker.commentId === wholeId)?.target, { kind: 'slide' })
  assert.ok(!slideMarkersOf(whole.state.doc).some(marker => marker.kind === 'mark'), 'no mark on the words that happened to be selected')

  // On the words selected: the handout's comment mark.
  const words = fakeEditor(plain, doc => TextSelection.create(doc, at(doc, 'once and used'), at(doc, 'once and used') + 'once and used every day'.length))
  startSlideComment(words.editor, { kind: 'words' })
  const wordsId = requestedId(words.storage)
  const mark = slideMarkersOf(words.state.doc).find(marker => marker.commentId === wordsId)
  assert.deepEqual(mark?.anchor, { kind: 'words', words: 'once and used every day' })

  // ⌘/: the caret's block, the boxes when the caret is in a box.
  const caret = fakeEditor(plain, doc => TextSelection.create(doc, at(doc, 'What it does') + 3))
  assert.deepEqual(caretTarget(caret.editor), { kind: 'block', pos: blockOf(plain, 'Instructions') })
  startSlideComment(caret.editor, caretTarget(caret.editor))
  assert.equal(slideMarkersOf(caret.state.doc).length, 1)

  // One box at a time (#687): an empty new box on the slide closes in the same transaction, and the new note lands
  // before its own block although the old note before it is gone.
  const first = fakeEditor(plain, doc => TextSelection.create(doc, at(doc, 'Closing')))
  startSlideComment(first.editor, { kind: 'block', pos: blockOf(plain, 'Instructions') })
  const oldId = requestedId(first.storage)
  first.storage.openBox = { key: `c:${oldId}`, commentId: oldId, kind: 'new', anchor: 'node', dirty: false, bringForward: () => {}, close: () => {} }
  startSlideComment(first.editor, { kind: 'block', pos: blockOf(first.state.doc, 'Instructions') })
  const newId = requestedId(first.storage)
  const now = slideMarkersOf(first.state.doc)
  assert.deepEqual(now.map(marker => marker.commentId), [newId], 'the empty one went, the new one is there')
  assert.deepEqual(now[0].target, { kind: 'block', pos: blockOf(first.state.doc, 'Instructions') })

  // The handout's box with words not saved comes forward, and nothing new is made.
  // (Review round 1: the rule held one way only. Every editor's open box is registered, so it holds both ways.)
  let forward = 0
  const handout = fakeEditor(plain, doc => TextSelection.create(doc, 1))
  const handoutBox = { key: 'c:x', kind: 'new' as const, anchor: 'node' as const, dirty: true, bringForward: () => { forward++ }, close: () => {} }
  const unregisterHandout = registerOpenBox(handout.editor, handoutBox)
  const slideOne = fakeEditor(plain, doc => TextSelection.create(doc, at(doc, 'Closing')))
  assert.equal(startSlideComment(slideOne.editor, { kind: 'slide' }), true)
  assert.equal(forward, 1)
  assert.equal(slideOne.transactions.length, 0, 'nothing new on the slide')
  unregisterHandout()
  // The other way: the slide's box with unsaved words comes forward when the handout starts a comment (⌘/, the
  // bubble menu's Comment, the rail's Edit), and nothing new opens there.
  let slideForward = 0
  const slideBox = { key: 'c:y', kind: 'new' as const, anchor: 'node' as const, dirty: true, bringForward: () => { slideForward++ }, close: () => {} }
  const unregisterSlide = registerOpenBox(slideOne.editor, slideBox)
  const handoutTwo = fakeEditor(plain, doc => TextSelection.create(doc, at(doc, 'Closing')))
  assert.equal(startComment(handoutTwo.editor), true)
  assert.equal(slideForward, 1)
  assert.equal(handoutTwo.transactions.length, 0, 'nothing new in the handout')
  assert.equal(yieldOpenBox(handoutTwo.editor, 'c:z'), null, "the rail's Edit and clicks wait too")
  unregisterSlide()
  // A clean box elsewhere closes as Cancel does, in its own editor, and the new one opens.
  let closed = 0
  const cleanSlide = fakeEditor(plain, doc => TextSelection.create(doc, at(doc, 'Closing')))
  startSlideComment(cleanSlide.editor, { kind: 'slide' })
  const cleanId = requestedId(cleanSlide.storage)
  registerOpenBox(cleanSlide.editor, { key: `c:${cleanId}`, commentId: cleanId, kind: 'new', anchor: 'node', dirty: false, bringForward: () => {}, close: () => { closed++ } })
  const handoutThree = fakeEditor(plain, doc => TextSelection.create(doc, at(doc, 'Closing')))
  assert.equal(startComment(handoutThree.editor), true)
  assert.equal(closed, 1)
  assert.equal(slideMarkersOf(cleanSlide.state.doc).length, 0, "the slide's empty comment went")
  assert.equal(slideMarkersOf(handoutThree.state.doc).length, 1, 'the new one is there')

  // Review round 2: `///` + Enter in the handout while a slide's empty box is open. Closing the slide's box writes into
  // the handout's document (the slide is a node there), so the lift must be built on the document as it is after
  // that: before the fix it was built on the old one and ProseMirror threw a mismatched transaction.
  {
    const slideSide = fakeEditor(plain, doc => TextSelection.create(doc, at(doc, 'Closing')))
    startSlideComment(slideSide.editor, { kind: 'slide' })
    const slideId = requestedId(slideSide.storage)
    const handoutDoc = load('# Handout\n\n///')
    const handoutSide = fakeEditor(handoutDoc, doc => TextSelection.create(doc, at(doc, '///') + 3))
    // The slide's write reaches the handout: here, a word typed into its heading.
    const slideView = (slideSide.editor as unknown as { view: { dispatch: (tr: Transaction) => void } }).view
    const slideDispatch = slideView.dispatch.bind(slideView)
    slideView.dispatch = (tr: Transaction) => { slideDispatch(tr); handoutSide.dispatch(handoutSide.state.tr.insertText('!', at(handoutSide.state.doc, 'Handout') + 7)) }
    const unregister = registerOpenBox(slideSide.editor, { key: `c:${slideId}`, commentId: slideId, kind: 'new', anchor: 'node', dirty: false, bringForward: () => {}, close: () => {} })
    assert.doesNotThrow(() => assert.equal(liftCommentLine(handoutSide.editor), true))
    assert.equal(slideMarkersOf(slideSide.state.doc).length, 0, "the slide's empty comment went")
    assert.equal(slideMarkersOf(handoutSide.state.doc).length, 1, 'the line became a note in the handout')
    assert.ok(handoutSide.state.doc.textContent.includes('Handout!'), "on the document as the slide's write left it")
    unregister()
  }
  // The rail's own ways of opening a comment (Edit, a click on a highlight or a marker) ask every editor too, not only
  // when the rail itself has a box open.
  assert.doesNotMatch(here('../../MarginCommentRail.tsx'), /boxOpen && editor \? yieldOpenBox/)
  assert.equal((here('../../MarginCommentRail.tsx').match(/const target = editor \? yieldOpenBox\(editor, (m\.)?key\) : (m\.)?key/g) ?? []).length, 3)

  // Saving a note's card leaves no hidden note selected (a key would take it).
  const saved = fakeEditor(plain, doc => TextSelection.create(doc, at(doc, 'Closing')))
  startSlideComment(saved.editor, { kind: 'block', pos: blockOf(plain, 'Closing') })
  const savedId = requestedId(saved.storage)
  saved.dispatch(saved.state.tr.setSelection(NodeSelection.create(saved.state.doc, notePos(saved.state.doc, savedId))))
  leaveHiddenNote(saved.editor)
  assert.equal(saved.state.selection instanceof TextSelection, true)
  assert.equal(saved.state.selection.from, at(saved.state.doc, 'Closing'), 'the caret at the start of the block the note is on')

  // The menu and the key, as the stage wires them.
  const editorSource = here('./SlideEditor.tsx')
  assert.match(editorSource, /'Mod-\/': comment/, '⌘/ comments on the slide')
  assert.match(editorSource, /startSlideComment\(this\.editor as TipTapEditor, caretTarget\(this\.editor as TipTapEditor\)\)/)
  assert.match(editorSource, /extension\.name === 'commentNode'\) return SlideCommentNode\.extend\(\)/, "the handout's comment node, with the slide's own storage")
  assert.doesNotMatch(here('../SlideComments.tsx').slice(here('../SlideComments.tsx').indexOf('export const SlideCommentNode'), here('../SlideComments.tsx').indexOf('/** The card')), /Mod-\//, "the handout's ⌘/ (a note inside the words) is not the slide's")
  // Ritemark's own menu replaces the system's (frame 27): Radix's context menu closes on a press outside and on Esc.
  const menu = editorSource.slice(editorSource.indexOf('<ContextMenu>'), editorSource.indexOf('</ContextMenu>'))
  const items = menu.slice(menu.indexOf('<ContextMenuContent'))
  const order = ['Cut\n', 'Copy\n', 'Paste\n', '<ContextMenuSeparator />', 'Comment\n'].map(word => items.indexOf(word))
  assert.ok(order.every((index, i) => index > 0 && (i === 0 || index > order[i - 1])), `Cut, Copy, Paste, then Comment: ${order}`)
  assert.match(items, /<ContextMenuShortcut>\{KEYS\.comment\}<\/ContextMenuShortcut>/)
  assert.match(editorSource, /comment: '⌘\/'/)
  // The app run (17 November): after Paste from the menu the caret was gone (⌘Z then did nothing), and Comment's box
  // opened without the caret. The menu's close now gives the focus back to the slide's words (not after a press
  // outside), and Comment starts there, on that one path. Proved live in the run (README); here, the wiring's parts.
  assert.ok(menu.includes('onInteractOutside={() => { closedOutside.current = true }}'))
  assert.ok(menu.includes('if (pendingComment.current) startPendingComment()') && menu.includes('else if (!closedOutside.current) editor.view.focus()'))
  assert.ok(!menu.includes('setTimeout(startPendingComment'), 'one path: no timer racing the close')
  // A marker never covers what it is on (the app run; the review of its fix): past the words' end, above it when the
  // frame's edge is too close, stepping upward (never back onto the words) when two meet; a block's at its corner.
  const wordsBox = { left: 100, top: 200, right: 300, width: 200 }
  assert.deepEqual(markerSpot(wordsBox, 'words', 900, []), { left: 302, top: 190 }, 'just past the words, on their first line')
  const second = markerSpot(wordsBox, 'words', 900, [{ left: 302, top: 190 }])
  assert.ok(second.left >= 300 && second.top < 190 - 20, `a second one steps up, not left onto the words: ${JSON.stringify(second)}`)
  const atEdge = markerSpot({ left: 600, top: 200, right: 890, width: 290 }, 'words', 900, [])
  assert.ok(atEdge.top + 26 <= 200 && atEdge.left <= 900 - 26, `no room past the end: above it, inside the frame: ${JSON.stringify(atEdge)}`)
  assert.deepEqual(markerSpot({ left: 100, top: 200, right: 500, width: 400 }, 'block', 900, []), { left: 490, top: 186 }, "a block's at its top-right corner")
  assert.deepEqual(markerSpot(wordsBox, 'slide', 900, []), { left: 864, top: 10 }, "the slide's in its corner")
  assert.match(menu, /<ContextMenuTrigger asChild>\s+<div\s+ref=\{setFrameRef\}/, 'the menu is on the whole slide')
  assert.match(menu, /onMouseDown=\{event => \{ if \(event\.button === 2\) event\.preventDefault\(\) \}\}/, 'a right press keeps the selection the person made')
  assert.match(here('../../ui/context-menu.tsx'), /from '@radix-ui\/react-context-menu'/, "the menu is Radix's (DismissableLayer: outside press and Esc close it)")
  console.log('slideComments (door): the right-click menu and ⌘/ start a comment on the words, a block or the slide')
}

// ── Counts: the strip's dot, and the bar's Previous and Next across slides ──
{
  const slides = [
    { kind: '', data: { markdown: '# Welcome' } },
    { kind: '', data: { markdown: COMMENTED } },
    { kind: 'points', data: { title: 'Old slide' } },
    { kind: '', data: { markdown: `# Last\n\n<!-- {id:${ID_A}} one -->\n\n<!-- {id:${ID_B}} -->` } },
  ]
  assert.deepEqual(slides.map(slide => stripCommentCount(slide as never)), [0, 3, 0, 1], 'an empty note (a box still open) is not counted')
  const stops = deckCommentStops(slides as never)
  assert.deepEqual(stops.map(stop => [stop.slide, stop.ordinal, stop.key]), [[1, 0, `c:${ID_A}`], [1, 1, `c:${ID_B}`], [1, 2, `c:${ID_C}`], [3, 0, `c:${ID_A}`]])
  // Codex on #766: the open comment is kept by its key, so one added or deleted before it never moves Next and
  // Previous. With the comment on the words deleted, the open one (the boxes' note) is still found, now at 0.
  const fewer = deckCommentStops([slides[0], { kind: '', data: { markdown: COMMENTED.replace(/<mark[^>]*>(once and used every day)<\/mark>/, '$1') } }] as never)
  assert.equal(stopIndexOf(fewer, `c:${ID_B}`), 0)
  assert.equal(nextCommentStop(fewer, stopIndexOf(fewer, `c:${ID_B}`), 1, 1), 1, 'Next goes to the note on the whole slide, not past it')
  assert.equal(stopIndexOf(fewer, `c:${ID_A}`), null, 'a deleted comment is no longer open')
  assert.equal(deckCommentStops([{ kind: '', data: { id: 'k3f9', markdown: '# T\n\n<!-- legacy, no id -->' } }] as never)[0].key, 's:k3f9#0', 'a comment without an id by its slide and place')
  // With none open: Next is the first on this slide or after; Previous the last before it.
  assert.equal(nextCommentStop(stops, null, 0, 1), 0)
  assert.equal(nextCommentStop(stops, null, 2, 1), 3)
  assert.equal(nextCommentStop(stops, null, 2, -1), 2)
  assert.equal(nextCommentStop(stops, null, 1, -1), null)
  // From the one open, across the slides.
  assert.equal(nextCommentStop(stops, 2, 1, 1), 3, 'Next goes on to the next slide')
  assert.equal(nextCommentStop(stops, 3, 3, -1), 2, 'Previous comes back')
  assert.equal(nextCommentStop(stops, 3, 3, 1), null, 'the last has no Next')
  assert.equal(nextCommentStop(stops, 2, 0, 1), 0, 'one open on another slide than the current one counts as none')
  const bar = parse(renderToStaticMarkup(React.createElement(DeckComments, { stops, at: 3, current: 3, onGo: () => {} })))
  assert.equal(bar.querySelector('.deck-comments-count')?.text, '4')
  assert.equal(bar.querySelector('[aria-label="4 comments on the slides"]')?.tagName, 'BUTTON')
  assert.equal(bar.querySelector('[aria-label="Next comment"]')?.hasAttribute('disabled'), true)
  assert.equal(bar.querySelector('[aria-label="Previous comment"]')?.hasAttribute('disabled'), false)
  assert.equal(renderToStaticMarkup(React.createElement(DeckComments, { stops: [], at: null, current: 0, onGo: () => {} })), '', 'no comments, no button')
  assert.equal(deckCommentsLabel(1), '1 comment on the slides')
  // Review round 1: a request the stage opened is forgotten (a slide shown again opens nothing by itself), it is
  // matched by the slide's id, the bar's control shows only with the slide shown, and the strip's dots follow the
  // comment flag as the bar and the markers do.
  const view = here('../DeckView.tsx')
  // Round 2: only the request that was taken is forgotten, and one not taken yet goes when another slide is current.
  assert.match(view, /const commentOpened = useCallback\(\(serial: number\) => setCommentOpen\(open => \(open\?\.serial === serial \? null : open\)\), \[\]\)/)
  assert.match(view, /if \(!here\) setCommentOpen\(null\)\n  \}, \[commentOpen, shown, slide\]\)/)
  assert.match(view, /onCommentOpened=\{commentOpened\}/)
  assert.match(view, /commentOpen\.slideId !== undefined \? commentOpen\.slideId === slide\.data\.id/)
  assert.match(view, /\{slideShown \? <DeckComments /)
  assert.match(view, /commentCounts=\{!!commentCallouts\}/)
  assert.match(here('../SlideStrip.tsx'), /comments=\{commentCounts \? stripCommentCount\(entry\) : 0\}/)
  assert.match(here('../SlideComments.tsx'), /onOpenTaken\?\.\(open\.serial\)/)
  // The card is in document.body but its events reach the slide's frame through React: they stop at the card.
  assert.match(here('../SlideComments.tsx'), /onContextMenu=\{event => event\.stopPropagation\(\)\}\n      onMouseDown=\{event => event\.stopPropagation\(\)\}/)
  console.log('slideComments (counts): the strip counts a slide\'s comments, the bar goes through them across slides')
}

console.log('slideComments (webview): all tests passed')
