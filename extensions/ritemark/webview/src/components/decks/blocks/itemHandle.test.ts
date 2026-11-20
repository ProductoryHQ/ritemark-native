/**
 * Sprint 167 PR 5 (decks README item B): one box's, column's, step's or list item's own handle. Its menu (Duplicate,
 * Move left / right or up / down, Delete) on every kind, each one undo step on the deck as the stage writes it; the drag's
 * drop line and where the item lands; Backspace in an empty item, as before; and where the handle sits (never on
 * words, only on the chosen block). Run with `npx tsx webview/src/components/decks/blocks/itemHandle.test.ts`.
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { createDocument } from '@mixmark-io/domino'
import { getSchema } from '@tiptap/core'
import { DOMParser as PMDOMParser, type Node as PMNode } from '@tiptap/pm/model'
import { EditorState, Plugin, TextSelection, type Transaction } from '@tiptap/pm/state'
import { closeHistory, history, undo } from '@tiptap/pm/history'
import { joinBackward, selectNodeBackward } from '@tiptap/pm/commands'
import { canonicalMarkdownProjection } from '../../../../../src/editorSync/state'
import { joinFrontMatter, splitFrontMatter } from '../../../../../src/editorSync/frontMatter'
import { slideDataOf, withBlockMarkdown } from '../../../../../src/decks/deckFormat'
import { createEditorSchemaExtensions, ensureCommentMarkedPipeline, markdownToEditorHTML } from '../../../utils/editorMarkdown'
import { editorHTML, editorMarkdown, installTestDocument } from '../../../utils/markdownFidelity'
import { DeckSlide } from '../handout/deckSchema'
import { DeckDrawnHeadings, drawnHeadingsFollow } from '../handout/drawnHeadings'
import { deckGuardPlugin } from '../handout/deckGuard'
import { deckLinesPlugin } from '../handout/deckLines'
import { convertDeckInto, deckConvertPlugin } from '../handout/deckConvert'
import { derivedHeadings, slidesOf } from '../deckDocument'
import { loadSlide, loadSlideWithComments, saveSlide } from './slideEditorHarness'
import { saveSlideMarkdown } from './slideEditorMarkdown'
import { SlideSync } from './slideSync'
import { keyPastNotes } from './slideCommentPlace'
import { SLIDE_COMMAND } from './slideCommands'
import { HANDLE_SIZE, chosenBlockAt, gripSpot, ringGap, type Box } from './blockBar'
import {
  ITEM_GRIP, ITEM_REACH, ITEM_ROW_GRIP, blockItems, canDuplicateItem, caretItemIndex, deleteItem, duplicateItem, itemAtPoint, itemDropLine, itemGripSpot, itemGripTip, itemKindOf, itemRuns, moveItem,
} from './itemHandle'

installTestDocument()
ensureCommentMarkedPipeline()
const deckSchema = getSchema(createEditorSchemaExtensions({ commentCallouts: true, deck: [DeckSlide, DeckDrawnHeadings] }))
const here = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')

function elementFromString(html: string): HTMLElement {
  const body = createDocument(`<body>${html}</body>`).body as unknown as HTMLElement
  const strip = (node: HTMLElement) => {
    for (let index = node.childNodes.length - 1; index >= 0; index -= 1) {
      const child = node.childNodes[index]
      if (child.nodeType === 3 && child.nodeValue && /^(\n\s\s|\n)$/.test(child.nodeValue)) node.removeChild(child)
      else if (child.nodeType === 1) strip(child as HTMLElement)
    }
  }
  strip(body)
  return body
}

const drawnPlugin = () => new Plugin({ appendTransaction: (transactions, _old, next) => drawnHeadingsFollow(transactions, next) })

function openDeck(text: string) {
  const split = splitFrontMatter(text)
  const doc = PMDOMParser.fromSchema(deckSchema).parse(elementFromString(markdownToEditorHTML(canonicalMarkdownProjection(split.content))), { preserveWhitespace: 'full' })
  const properties = JSON.parse(JSON.stringify(split.properties))
  let state = EditorState.create({ doc, plugins: [history(), deckGuardPlugin(), deckLinesPlugin(), drawnPlugin(), deckConvertPlugin()] })
  const drawn = derivedHeadings(state)
  if (drawn) state = state.apply(drawn)
  return { state, save: (next: PMNode) => joinFrontMatter(properties, editorMarkdown(next), text) }
}

const slideSave = (doc: PMNode) => saveSlideMarkdown(doc, editorHTML(doc), loadSlide)

/** A caret just after `text`'s first letter in the document. */
function caretAt(doc: PMNode, text: string): TextSelection {
  let at = -1
  doc.descendants((node, pos) => {
    if (at >= 0 || !node.isText) return
    const found = node.text!.indexOf(text)
    if (found >= 0) at = pos + found + 1
  })
  assert.ok(at >= 0, `found ${text}`)
  return TextSelection.create(doc, at)
}

/** The stage on the deck's first slide: SlideEditor's write, a handle's change an undo step of its own. */
function stageOn(deck: ReturnType<typeof openDeck>) {
  let outer = deck.state
  const entry = slidesOf(outer.doc)[0]
  const markdown = slideDataOf(entry.kind, entry.node.attrs.body).markdown ?? ''
  let inner = EditorState.create({ doc: loadSlide(markdown) })
  const sync = new SlideSync(loadSlide, slideSave, markdown, inner.doc)
  return {
    get inner() { return inner },
    apply(tr: Transaction | null) {
      assert.ok(tr, 'the handle made a change')
      assert.equal(tr.getMeta(SLIDE_COMMAND), true, 'a handle change is an undo step of its own')
      inner = inner.apply(tr)
      sync.track(tr)
      const next = sync.toWrite(inner.doc)
      if (next === null) { sync.settled(inner.doc); return }
      const step = outer.tr
      closeHistory(step)
      convertDeckInto(step)
      const pos = step.mapping.map(slidesOf(outer.doc)[0].pos)
      const node = step.doc.nodeAt(pos)!
      step.setNodeMarkup(pos, undefined, { ...node.attrs, body: withBlockMarkdown(node.attrs.body, next) })
      sync.wrote(next, inner.doc)
      outer = outer.apply(step)
    },
    caretIn(text: string) { inner = inner.apply(inner.tr.setSelection(caretAt(inner.doc, text))) },
    undo() { undo(outer, tr => { outer = outer.apply(tr) }) },
    save: () => deck.save(outer.doc),
  }
}

const DECK = (body: string) => ['---', 'deck: 2', 'handout: text', '---', '', '```slide', '---', 'id: a1', '---', body, '```', '', '## Today', '', 'The plan.', ''].join('\n')

const BOXES = ['# Today', '', ':::: boxes', '::: box', '### Map', '', 'Sort the mail.', ':::', '', '::: box', '### Draft', '', 'Claude drafts.', ':::', '', '::: box', '### Send', '', 'Log every reply.', ':::', '::::'].join('\n')
const COLUMNS = ['# Pick', '', ':::: columns', '::: column', '### Copilot', '', 'Documents', ':::', '', '::: column', '### Cursor', '', 'Building', ':::', '', '::: column', '### Codex', '', 'Cloud', ':::', '::::'].join('\n')
const TWO_COLUMNS = ['# Pick', '', ':::: columns', '::: column', '### Before', '', 'Old way', ':::', '', '::: column', '### After', '', 'New way', ':::', '::::'].join('\n')
const STEPS = ['# Plan', '', '::: steps', '1. Open the file', '2. Ask the question', '3. Check the answer', ':::'].join('\n')
const LIST = ['# Plan', '', '- Open the file', '- Ask the question', '- Check the answer', '', 'After the list.'].join('\n')
const NUMBERED = ['# Plan', '', '1. Open the file', '2. Ask the question', '3. Check the answer'].join('\n')
const REVEALED = ['# Plan', '', '::: incremental', '- Open the file', '- Ask the question', '- Check the answer', ':::'].join('\n')

function stateWith(markdown: string, text: string): EditorState {
  const doc = loadSlide(markdown)
  return EditorState.create({ doc, selection: caretAt(doc, text) })
}
const block = (state: EditorState) => chosenBlockAt(state)!
const saved = (tr: Transaction | null) => { assert.ok(tr, 'a change'); return saveSlide(tr.doc) }
/** The words of a slide's items, in order, read from its Markdown. */
const order = (markdown: string, words: string[]) => words.map(word => markdown.indexOf(word)).every((at, index, all) => at >= 0 && (index === 0 || at > all[index - 1]))

// ---- The items of every kind, and the caret's.
{
  assert.equal(itemKindOf('boxes'), 'box')
  assert.equal(itemKindOf('columns'), 'column')
  assert.equal(itemKindOf('steps'), 'step')
  assert.equal(itemKindOf('list'), 'item')
  assert.equal(itemKindOf('numbered'), 'item')
  assert.equal(itemKindOf('agenda'), null, 'the Agenda is one piece: no item handle')
  assert.equal(itemKindOf('tabs'), null, 'Tabs have their own band')
  assert.equal(itemRuns('box'), 'row')
  assert.equal(itemRuns('step'), 'column')
  for (const [markdown, word, count] of [[BOXES, 'Draft', 3], [COLUMNS, 'Cursor', 3], [STEPS, 'Ask', 3], [LIST, 'Ask', 3], [NUMBERED, 'Ask', 3], [REVEALED, 'Ask', 3]] as const) {
    const state = stateWith(markdown, word)
    assert.equal(blockItems(block(state)).length, count, `${word}: ${count} items`)
    assert.equal(caretItemIndex(state, block(state)), 1, `${word}: the caret is in the second item`)
  }
  // The caret on the title: no block is chosen, so no item shows a handle.
  assert.equal(chosenBlockAt(stateWith(BOXES, 'Today')), null, 'no block chosen: no handle')
  assert.equal(itemGripTip('box'), "Click for the box's menu, drag to move it")
}

// ---- Boxes: Duplicate, Move left, Move right, Delete box.
{
  const state = stateWith(BOXES, 'Draft')
  const pos = block(state).pos
  const twice = saved(duplicateItem(state, pos, 1))
  assert.equal(twice.split('### Draft').length - 1, 2, 'Duplicate: the box twice')
  assert.deepEqual(twice.split('\n').filter(line => line.startsWith('### ')), ['### Map', '### Draft', '### Draft', '### Send'], 'the copy right after it')
  const dup = duplicateItem(state, pos, 1)!
  assert.equal(caretItemIndex(EditorState.create({ doc: dup.doc, selection: dup.selection }), chosenBlockAt(EditorState.create({ doc: dup.doc, selection: dup.selection }))!), 2, 'the caret at the copy')
  assert.equal(saveSlide(loadSlide(twice)), twice, 'the copy is byte-stable on the next open')

  const left = saved(moveItem(state, pos, 1, 0))
  assert.ok(order(left, ['Draft', 'Map', 'Send']), 'Move left')
  const right = saved(moveItem(state, pos, 1, 2))
  assert.ok(order(right, ['Map', 'Send', 'Draft']), 'Move right')
  assert.equal(moveItem(state, pos, 0, -1), null, 'the first box has no left')
  assert.equal(moveItem(state, pos, 2, 3), null, 'the last box has no right')
  const moved = moveItem(state, pos, 1, 0)!
  assert.ok(moved.selection.$head.parent.textContent.startsWith('D'), 'the caret goes with the box')

  const gone = saved(deleteItem(state, pos, 1))
  assert.ok(!gone.includes('Draft') && order(gone, ['Map', 'Send']), 'Delete box: that box and its words go, no other')
  assert.equal(gone, BOXES.replace(['::: box', '### Draft', '', 'Claude drafts.', ':::', '', ''].join('\n'), ''), 'nothing else changes')
  // The only box takes its block with it (the bar's Delete).
  const one = stateWith(['# T', '', ':::: boxes', '::: box', 'Only', ':::', '::::', '', 'After'].join('\n'), 'Only')
  assert.ok(!saved(deleteItem(one, block(one).pos, 0)).includes('boxes'), 'the only box: the block goes')
}

// ---- Columns: the same menu; Delete column without emptying it first.
{
  const state = stateWith(COLUMNS, 'Cursor')
  const pos = block(state).pos
  assert.ok(order(saved(moveItem(state, pos, 1, 0)), ['Cursor', 'Copilot', 'Codex']), 'Move left')
  assert.ok(order(saved(moveItem(state, pos, 1, 2)), ['Copilot', 'Codex', 'Cursor']), 'Move right')
  const four = saved(duplicateItem(state, pos, 1))
  assert.equal(four.split('### Cursor').length - 1, 2, 'Duplicate column')
  assert.equal(four.split('\n').filter(line => line === '::: column').length, 4)
  // At four columns there is no room for a fifth.
  const full = stateWith(four, 'Codex')
  assert.equal(canDuplicateItem(block(full)), false)
  assert.equal(duplicateItem(full, block(full).pos, 0), null, 'four columns: no Duplicate')
  // A split set by hand goes back to even, as Add does.
  const widths = COLUMNS.replace('::: column\n### Copilot', '::: {.column width="50%"}\n### Copilot').replace('::: column\n### Cursor', '::: {.column width="25%"}\n### Cursor').replace('::: column\n### Codex', '::: {.column width="25%"}\n### Codex')
  const evened = stateWith(widths, 'Cursor')
  assert.ok(!saved(duplicateItem(evened, block(evened).pos, 1)).includes('width='), 'a copied column: an even split again')
  // A move keeps each column's own width with it.
  const kept = saved(moveItem(evened, block(evened).pos, 0, 2))
  const keptLines = kept.split('\n')
  assert.equal(keptLines[keptLines.indexOf('### Copilot') - 1], '::: {.column width="50%"}', 'the width goes with its column')
  assert.ok(order(kept, ['Cursor', 'Codex', 'Copilot']), 'moved to the end')
  // Delete column: that column and its words, even with words in it.
  const gone = saved(deleteItem(state, pos, 1))
  assert.ok(!gone.includes('Cursor') && !gone.includes('Building') && order(gone, ['Copilot', 'Codex']), 'Delete column')
  // Of two columns: the other one's words stay on the slide, where the block stood.
  const two = stateWith(TWO_COLUMNS, 'After')
  const single = saved(deleteItem(two, block(two).pos, 1))
  assert.ok(!single.includes('columns') && !single.includes('After') && order(single, ['# Pick', '### Before', 'Old way']), `two columns: the other's words stay: ${single}`)
}

// ---- Steps, a list, a numbered list and a revealed list: Move up, Move down, Duplicate, Delete.
for (const [markdown, label] of [[STEPS, 'Steps'], [LIST, 'List'], [NUMBERED, 'Numbered'], [REVEALED, 'One by one list']] as const) {
  const state = stateWith(markdown, 'Ask')
  const pos = block(state).pos
  assert.ok(order(saved(moveItem(state, pos, 1, 0)), ['Ask', 'Open', 'Check']), `${label}: Move up`)
  assert.ok(order(saved(moveItem(state, pos, 1, 2)), ['Open', 'Check', 'Ask']), `${label}: Move down`)
  const twice = saved(duplicateItem(state, pos, 1))
  assert.equal(twice.split('Ask the question').length - 1, 2, `${label}: Duplicate`)
  const gone = saved(deleteItem(state, pos, 1))
  assert.ok(!gone.includes('Ask') && order(gone, ['Open', 'Check']), `${label}: Delete`)
  for (const result of [moveItem(state, pos, 1, 0), duplicateItem(state, pos, 1), deleteItem(state, pos, 1)]) {
    const next = EditorState.create({ doc: result!.doc, selection: result!.selection })
    assert.ok(chosenBlockAt(next) && chosenBlockAt(next)!.kind === block(state).kind, `${label}: the block stays chosen, the handle on it`)
  }
  if (label === 'One by one list') assert.ok(saved(moveItem(state, pos, 1, 0)).includes('::: incremental'), 'One by one stays')
}

// ---- A comment stays with its words: Delete keeps it, Duplicate doesn't copy it.
{
  const doc = loadSlideWithComments(BOXES)
  const note = doc.type.schema.nodes.commentNode
  let heading = -1
  doc.descendants((node, pos) => { if (heading < 0 && node.type.name === 'heading' && node.textContent === 'Draft') heading = pos })
  const withNote = EditorState.create({ doc }).tr.insert(heading, note.create({ note: 'Shorter, please' }))
  const state = EditorState.create({ doc: withNote.doc, selection: caretAt(withNote.doc, 'Draft') })
  const pos = block(state).pos
  const notes = (tr: Transaction) => { let count = 0; tr.doc.descendants(node => { if (node.type.name === 'commentNode') count++ }); return count }
  assert.equal(notes(duplicateItem(state, pos, 1)!), 1, 'Duplicate: the copy has no comment of its own')
  assert.equal(notes(deleteItem(state, pos, 1)!), 1, 'Delete box: its comment stays')
  assert.equal(notes(moveItem(state, pos, 1, 0)!), 1, 'Move: the comment goes with it')
  // A list item's comment goes to the item before it.
  const listDoc = loadSlideWithComments(LIST)
  let line = -1
  listDoc.descendants((node, pos) => { if (line < 0 && node.type.name === 'paragraph' && node.textContent === 'Ask the question') line = pos + node.nodeSize })
  const listNote = EditorState.create({ doc: listDoc }).tr.insert(line, note.create({ note: 'Which one?' }))
  const listState = EditorState.create({ doc: listNote.doc, selection: caretAt(listNote.doc, 'Ask') })
  assert.equal(notes(deleteItem(listState, block(listState).pos, 1)!), 1, 'Delete item: its comment stays')
  const firstNote = EditorState.create({ doc: listNote.doc, selection: caretAt(listNote.doc, 'Ask') })
  assert.equal(notes(deleteItem(firstNote, block(firstNote).pos, 0)!), 1, 'Delete the first item: the others keep the comment')
}

// ---- Each action is one Undo, and the file is as it was.
for (const [body, word, actions] of [
  [BOXES, 'Draft', ['duplicate', 'left', 'right', 'delete']],
  [COLUMNS, 'Cursor', ['duplicate', 'left', 'right', 'delete']],
  [TWO_COLUMNS, 'After', ['delete']],
  [STEPS, 'Ask', ['duplicate', 'left', 'right', 'delete']],
  [LIST, 'Ask', ['duplicate', 'left', 'right', 'delete']],
] as const) {
  const text = DECK(body)
  const deck = openDeck(text)
  assert.equal(deck.save(deck.state.doc), text, 'an untouched deck is the same bytes')
  for (const action of actions) {
    const stage = stageOn(deck)
    stage.caretIn(word)
    const now = stage.inner
    const pos = block(now).pos
    stage.apply(action === 'duplicate' ? duplicateItem(now, pos, 1) : action === 'left' ? moveItem(now, pos, 1, 0) : action === 'right' ? moveItem(now, pos, 1, 2) : deleteItem(now, pos, 1))
    assert.notEqual(stage.save(), text, `${word} ${action}: written to the deck`)
    stage.undo()
    assert.equal(stage.save(), text, `${word} ${action}: one Undo gives the file back`)
  }
}

// ---- Backspace in an empty item still removes it, as it did before the handle (the stage's own key: the notes'
// step, then the editor's join).
{
  const backspace = (state: EditorState): EditorState => {
    const step = keyPastNotes(state, 'backward')
    if (step === 'stop') return state
    let next = step ? state.apply(step.tr) : state
    if (step?.done) return next
    const run = (tr: Transaction) => { next = next.apply(tr) }
    assert.ok(joinBackward(next, run) || selectNodeBackward(next, run), 'the key acts')
    return next
  }
  const emptyIn = (markdown: string, word: string, at: number) => {
    // An empty item made where the caret is, as Enter or Duplicate of an empty one makes it.
    let state = stateWith(markdown, word)
    const b = block(state)
    const items = blockItems(b)
    const kind = itemKindOf(b.kind)!
    const empty = kind === 'step' || kind === 'item'
      ? state.schema.nodes.listItem.create(null, [state.schema.nodes.paragraph.create()])
      : items[0].node.type.create({ ...items[0].node.attrs }, [state.schema.nodes.paragraph.create()])
    const place = items[at].pos
    const tr = state.tr.insert(place, empty)
    tr.setSelection(TextSelection.create(tr.doc, place + 2))
    state = state.apply(tr)
    return state
  }
  for (const [markdown, word] of [[BOXES, 'Draft'], [STEPS, 'Ask'], [LIST, 'Ask'], [NUMBERED, 'Ask']] as const) {
    const state = emptyIn(markdown, word, 1)
    const before = blockItems(block(state)).length
    const after = backspace(state)
    assert.equal(blockItems(chosenBlockAt(after)!).length, before - 1, `${word}: Backspace in an empty item removes it`)
    for (const text of ['Ask', 'Draft', 'Map', 'Open', 'Check', 'Send'].filter(text => markdown.includes(text))) assert.ok(after.doc.textContent.includes(text), `${text} stays`)
  }
  // The handle adds no key of its own to the slide's editor.
  assert.ok(!/addKeyboardShortcuts|keydown.*Backspace|Backspace/.test(here('./SlideItemHandle.tsx')), 'no Backspace of the handle')
}

// ---- Where the handle sits: never on words, under the ⋮ never.
{
  const blockBox: Box = { left: 100, top: 200, width: 600, height: 180 }
  // A box's: its middle on the top edge, inside the box's padding at any fit.
  const box = { left: 100, top: 200, width: 190, height: 180, padTop: 12 }
  const spot = itemGripSpot('box', box, blockBox, 'boxes')
  assert.deepEqual({ width: spot.width, height: spot.height }, ITEM_GRIP, 'the table column grip\'s shape')
  assert.equal(spot.left + spot.width / 2, box.left + box.width / 2, 'in the middle of the top edge')
  assert.equal(spot.top + spot.height / 2, box.top, 'centred on the edge')
  assert.ok(spot.top + spot.height <= box.top + box.padTop, 'clear of the words')
  const tight = itemGripSpot('box', { ...box, padTop: 4 }, blockBox, 'boxes')
  assert.ok(tight.top + tight.height <= box.top + 4, 'a box drawn small: still clear of its words')
  // A column's: over the column, on the ring's top line, above the words.
  const column = { left: 100, top: 200, width: 280, height: 180, padTop: 0 }
  const columnSpot = itemGripSpot('column', column, blockBox, 'columns')
  assert.ok(columnSpot.top + columnSpot.height <= column.top, 'above the column\'s words')
  assert.equal(columnSpot.top + columnSpot.height / 2, blockBox.top - ringGap('columns') - 1, 'on the ring\'s line')
  // A step's or a list item's: on the left edge, outside the block, in the item's middle, never on the ⋮.
  const second = { left: 100, top: 260, width: 600, height: 40, padTop: 0 }
  const row = itemGripSpot('step', second, blockBox, 'steps')
  assert.deepEqual({ width: row.width, height: row.height }, ITEM_ROW_GRIP, 'the table row grip\'s shape')
  assert.ok(row.left + row.width <= blockBox.left, 'left of the words')
  assert.equal(row.top + row.height / 2, second.top + second.height / 2, 'in the item\'s middle')
  const first = { left: 100, top: 200, width: 600, height: 30, padTop: 0 }
  const top = itemGripSpot('item', first, blockBox, 'list')
  const grip = gripSpot(blockBox)
  assert.ok(top.left + top.width <= grip.left, 'the first item\'s handle sits left of the block\'s ⋮, never on it')
  assert.equal(top.top + top.height / 2, first.top + first.height / 2, 'on its own item\'s line')
  const edge = itemGripSpot('item', first, { ...blockBox, left: 30 }, 'list')
  const edgeGrip = gripSpot({ ...blockBox, left: 30 })
  assert.ok(edge.left >= 0 && edge.top >= edgeGrip.top + HANDLE_SIZE, 'at the slide\'s edge: under the ⋮ instead')
}

// ---- The item under the pointer, near the block; none away from it.
{
  const block: Box = { left: 100, top: 100, width: 400, height: 100 }
  const items: Box[] = [{ left: 100, top: 100, width: 190, height: 100 }, { left: 310, top: 100, width: 190, height: 100 }]
  assert.equal(itemAtPoint(items, block, 150, 150), 0)
  assert.equal(itemAtPoint(items, block, 400, 150), 1)
  assert.equal(itemAtPoint(items, block, 302, 150), 1, 'the gap between them: the nearer box')
  assert.equal(itemAtPoint(items, block, 400, 100 - ITEM_REACH + 4), 1, 'on its handle, over its top edge')
  assert.equal(itemAtPoint(items, block, 400, 100 - ITEM_REACH - 4), null, 'away from the block: none (the caret\'s)')
}

// ---- The drag's drop line, and where the item lands.
{
  // Three boxes in a row.
  const row: Box[] = [{ left: 0, top: 0, width: 100, height: 80 }, { left: 116, top: 0, width: 100, height: 80 }, { left: 232, top: 0, width: 100, height: 80 }]
  assert.equal(itemDropLine(row, 'row', 0, 60, 40), null, 'over its own place: no line')
  const between = itemDropLine(row, 'row', 0, 226, 40)!
  assert.deepEqual({ to: between.to, left: between.left, width: between.width, height: between.height }, { to: 1, left: 224, width: 0, height: 80 }, 'between the 2nd and 3rd: a vertical line in the gap')
  const end = itemDropLine(row, 'row', 0, 340, 40)!
  assert.equal(end.to, 2, 'after the last')
  assert.equal(end.left, 334, 'the line just after the last box')
  assert.equal(itemDropLine(row, 'row', 2, 0, 40)!.to, 0, 'to the front')
  // Boxes in two rows: the row's end and the next row's start are the same gap, each drawn at its own row.
  const rows: Box[] = [{ left: 0, top: 0, width: 100, height: 80 }, { left: 116, top: 0, width: 100, height: 80 }, { left: 0, top: 96, width: 100, height: 80 }]
  const wrapEnd = itemDropLine(rows, 'row', 0, 220, 40)!
  assert.deepEqual({ to: wrapEnd.to, top: wrapEnd.top }, { to: 1, top: 0 }, 'after the first row\'s last box')
  const wrapStart = itemDropLine(rows, 'row', 0, -2, 136)!
  assert.deepEqual({ to: wrapStart.to, top: wrapStart.top }, { to: 1, top: 96 }, 'before the second row\'s first box: the same place')
  // Steps: a horizontal line between them, the item's width.
  const steps: Box[] = [{ left: 0, top: 0, width: 300, height: 30 }, { left: 0, top: 40, width: 300, height: 30 }, { left: 0, top: 80, width: 300, height: 30 }]
  const under = itemDropLine(steps, 'column', 0, 50, 76)!
  assert.deepEqual(under, { to: 1, left: 0, top: 75, width: 300, height: 0 }, 'between the 2nd and 3rd step')
  assert.equal(itemDropLine(steps, 'column', 2, 50, -5)!.to, 0, 'above the first')
  // A drop lands it there: the move the drop makes.
  const state = stateWith(STEPS, 'Open')
  assert.ok(order(saved(moveItem(state, block(state).pos, 0, under.to)), ['Ask', 'Open', 'Check']))
}

// ---- The stage: the handle is drawn in the block bar's layer, only while the chosen block's bar shows, hidden while a
// handle drags; it is a Button with a tooltip, and a press on it keeps the caret.
{
  const bar = here('./SlideBlockBar.tsx')
  const handle = here('./SlideItemHandle.tsx')
  const portal = bar.slice(bar.indexOf('createPortal(showing ? ('), bar.indexOf(') : null, layer)}'))
  assert.ok(portal.includes('<SlideItemHandle'), 'inside the chosen block\'s handles, in the layer over the slide (never in its words)')
  assert.ok(/hidden=\{!!drag\}/.test(portal), 'hidden while any handle drags')
  assert.ok(/<Tooltip label=\{itemGripTip\(kind\)\}/.test(handle), 'a tooltip says what it does')
  assert.ok(/onMouseDown=\{event => event.preventDefault\(\)\}/.test(handle), 'a press keeps the caret on the slide')
  assert.ok(handle.includes("from '../../ui/button'") && !/<button/.test(handle), 'the shadcn Button')
  for (const words of ['Duplicate', "'Move left'", "'Move right'", "'Move up'", "'Move down'", '`Delete ${word}`']) assert.ok(handle.includes(words), words)
  const css = here('../decks.css')
  assert.ok(/\.deck-item-grip \{[^}]*cursor: grab/.test(css), 'the grab cursor')
}

console.log('itemHandle: all passed')
