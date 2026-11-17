/**
 * Sprint 161 (PR 3; experience 46, frames 22, 23, 24 and 26): what the slide's own / menu and its blocks do to the
 * slide editor's document. Pure ProseMirror, so the tests drive the same steps the stage takes.
 *
 *  - **The / menu** (frame 22) in four groups: Text (Title, Heading, Bullet list, Numbered list, with their Markdown
 *    shortcuts), Blocks (Columns, Boxes, Steps, Table), Media (Picture, Web page) and Slides (New slide below, Split
 *    slide here). Web page is a link to the page, in the picture's group; no live page is drawn.
 *  - **A block** goes where the / was typed: in place of the empty line, else after the block the caret is in. Its
 *    lines are the ones the conversion writes (`:::: columns`, `::: box`, `::: steps`), so a new block saves as an AI
 *    would write it, and its empty boxes and its first empty step are kept (`slideEditorMarkdown`'s blank rule).
 *  - **Split slide here** cuts the slide at the caret: the blocks before it stay, the rest go to a new slide below. A
 *    comment on a block goes with its block.
 *  - **A box's icon and the Steps pill** are one value each on the block's opening line (`withFenceValue`): changing one
 *    rewrites that line only.
 *  - **A table** in a slide: Enter moves to the cell below (a new row under the last), as Tab moves to the next cell;
 *    Settings' Add a row and Add a column add one at the bottom and on the right.
 *
 * Every change made here carries `SLIDE_COMMAND`: the stage writes it to the deck as an undo step of its own, so one
 * Undo takes the block (or the icon, or the row) back and leaves the words typed before it.
 */
import type { Node as PMNode, Schema } from '@tiptap/pm/model'
import { TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state'
import { canSplit } from '@tiptap/pm/transform'
import { TableMap, addColumn, addRow, cellAround } from '@tiptap/pm/tables'
import type { BlockItemDef } from '../../../extensions/blockItems'
import { OPEN_FENCE, parseFenceAttributes, withFenceValue } from '../../../../../src/decks/blocks/fencedDiv'
import { EXERCISE_TAG } from '../../../../../src/decks/deckFormat'
import { stepsTagOf } from '../../../../../src/decks/blocks/slideRenderer'

/** Meta on a slide editor transaction that the stage writes to the deck as an undo step of its own. */
export const SLIDE_COMMAND = 'deckSlideCommand'

/** The slide's / menu (frame 22), in its groups, with the shortcuts the design shows. */
export const SLIDE_ITEMS: BlockItemDef[] = [
  { group: 'Text', title: 'Title', description: '', icon: 'text-h-one', nodeType: 'heading', attrs: { level: 1 }, shortcut: '#' },
  { group: 'Text', title: 'Heading', description: '', icon: 'text-h-two', nodeType: 'heading', attrs: { level: 2 }, shortcut: '##' },
  { group: 'Text', title: 'Bullet list', description: '', icon: 'list', nodeType: 'bulletList', shortcut: '-' },
  { group: 'Text', title: 'Numbered list', description: '', icon: 'list-numbers', nodeType: 'orderedList', shortcut: '1.' },
  { group: 'Blocks', title: 'Columns', description: '', icon: 'columns', nodeType: 'columns' },
  { group: 'Blocks', title: 'Boxes', description: '', icon: 'squares-four', nodeType: 'boxes' },
  { group: 'Blocks', title: 'Steps', description: '', icon: 'list-checks', nodeType: 'steps' },
  { group: 'Blocks', title: 'Table', description: '', icon: 'table', nodeType: 'table' },
  { group: 'Media', title: 'Picture', description: '', icon: 'image', nodeType: 'picture' },
  { group: 'Media', title: 'Web page', description: '', icon: 'globe', nodeType: 'webPage' },
  { group: 'Slides', title: 'New slide below', description: '', icon: 'plus-square', nodeType: 'newSlideBelow' },
  { group: 'Slides', title: 'Split slide here', description: '', icon: 'scissors', nodeType: 'splitSlide', shortcut: '***' },
]

export type SlideBlockKind = 'columns' | 'boxes' | 'steps' | 'table'

/** A `:::` block with its lines, as the slide editor loads one (`slideDiv`'s attributes). */
const div = (schema: Schema, open: string, close: string, content: PMNode[]) =>
  schema.nodes.slideDiv.create({ open, close, gapOpen: 'false', gapClose: 'false', class: parseFenceAttributes(OPEN_FENCE.exec(open)![2])!.classes.join(' ') }, content)

/** A new block, empty, as the conversion writes one: two columns, three boxes, Steps with one step, a 3 × 3 table. */
export function slideBlockNode(schema: Schema, kind: SlideBlockKind): PMNode {
  const paragraph = () => schema.nodes.paragraph.create()
  switch (kind) {
    case 'columns':
      return div(schema, ':::: columns', '::::', [div(schema, '::: column', ':::', [paragraph()]), div(schema, '::: column', ':::', [paragraph()])])
    case 'boxes':
      return div(schema, ':::: boxes', '::::', [0, 1, 2].map(() => div(schema, '::: box', ':::', [paragraph()])))
    case 'steps':
      return div(schema, '::: steps', ':::', [schema.nodes.orderedList.create(null, [schema.nodes.listItem.create(null, [paragraph()])])])
    case 'table': {
      const row = (header: boolean) => schema.nodes.tableRow.create(null, [0, 1, 2].map(() => (header ? schema.nodes.tableHeader : schema.nodes.tableCell).create(null, [paragraph()])))
      return schema.nodes.table.create(null, [row(true), row(false), row(false)])
    }
  }
}

/**
 * Put `node` where the / was (`at`, after its text is taken out): in place of the empty line it stood on, else after
 * the block the caret is in, at the first level that can hold it. The caret goes into the new block's first line.
 */
export function insertSlideBlock(tr: Transaction, at: number, node: PMNode): Transaction {
  const $pos = tr.doc.resolve(Math.max(0, Math.min(at, tr.doc.content.size)))
  let placed = -1
  if ($pos.depth > 0 && $pos.parent.isTextblock && $pos.parent.content.size === 0) {
    const depth = $pos.depth
    const holder = $pos.node(depth - 1)
    const index = $pos.index(depth - 1)
    if (holder.canReplaceWith(index, index + 1, node.type)) {
      placed = $pos.before(depth)
      tr.replaceWith(placed, $pos.after(depth), node)
    }
  }
  if (placed < 0 && $pos.depth === 0 && tr.doc.canReplaceWith($pos.index(0), $pos.index(0), node.type)) {
    placed = $pos.pos
    tr.insert(placed, node)
  }
  for (let depth = $pos.depth - 1; placed < 0 && depth >= 0; depth--) {
    // After the child that holds the caret at this level, where that level can hold the block.
    const index = $pos.index(depth) + 1
    if (!$pos.node(depth).canReplaceWith(index, index, node.type)) continue
    placed = $pos.after(depth + 1)
    tr.insert(placed, node)
  }
  if (placed < 0) return tr
  tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(placed + 1, tr.doc.content.size))))
  return tr.setMeta(SLIDE_COMMAND, true).scrollIntoView()
}

/** A link to a web page, as its own line where the / was: the address as its words (no live page is drawn). */
export function webPageNode(schema: Schema, address: string): PMNode {
  return schema.nodes.paragraph.create(null, [schema.text(address, [schema.marks.link.create({ href: address })])])
}

/** A picture the host saved, as the slide editor's image node: drawn from `url`, saved as `path` (the title, as a loaded one). */
export function pictureNode(schema: Schema, path: string, url: string): PMNode {
  return schema.nodes.image.create({ src: url, title: path, alt: '' })
}

// ---------------------------------------------------------------------------
// Split slide here
// ---------------------------------------------------------------------------

/** The slide's document in two at the caret: the blocks before it, and the blocks after it (for a new slide below). */
export interface SlideHalves {
  before: PMNode
  after: PMNode
}

const isNote = (node: PMNode | null | undefined) => node?.type.name === 'commentNode'
const isTablePart = (node: PMNode) => typeof node.type.spec.tableRole === 'string'

/**
 * Split the slide at `pos` (the caret): a line split there, a list or a block split around it, and everything from
 * there on goes to the second half. At the end of a line (or an item, a box) that line stays whole with the first
 * half, and at its start it goes whole with the second. A table is never cut: the cut is after the block holding it.
 * A comment on the block after the cut goes with that block.
 */
export function splitSlideHalves(state: EditorState, pos: number): SlideHalves {
  const tr = state.tr
  const doc = state.doc
  let $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)))
  // Out of every level the caret ends (or starts): the cut falls between the blocks there, never inside an empty one.
  while ($pos.depth > 0 && !isTablePart($pos.parent)) {
    if ($pos.pos === $pos.end()) $pos = doc.resolve($pos.after())
    else if ($pos.pos === $pos.start()) $pos = doc.resolve($pos.before())
    else break
  }
  let inTable = false
  for (let depth = $pos.depth; depth > 0; depth--) if (isTablePart($pos.node(depth))) inTable = true
  let cut: number
  if ($pos.depth === 0) cut = $pos.pos
  else if (!inTable && canSplit(doc, $pos.pos, $pos.depth)) {
    tr.split($pos.pos, $pos.depth)
    cut = $pos.pos + $pos.depth
  } else cut = $pos.after(1)
  const content = tr.doc.content
  // The top-level index the cut stands before, moved back over the comment notes on the block after it.
  let index = 0
  let offset = 0
  while (index < content.childCount && offset < cut) {
    offset += content.child(index).nodeSize
    index++
  }
  while (index > 0 && isNote(content.child(index - 1))) index--
  const nodes: PMNode[] = []
  content.forEach(child => nodes.push(child))
  const type = doc.type
  const half = (part: PMNode[]) => type.createAndFill(null, part) ?? type.create(null, part)
  return { before: half(nodes.slice(0, index)), after: half(nodes.slice(index)) }
}

// ---------------------------------------------------------------------------
// A box's icon and the Steps pill
// ---------------------------------------------------------------------------

/** The `:::` block at `pos` with one value of its opening line set (or taken out); null when nothing changes. */
export function setBlockValue(state: EditorState, pos: number, key: string, value: string | null): Transaction | null {
  const node = state.doc.nodeAt(pos)
  if (!node || node.type.name !== 'slideDiv') return null
  const open = String(node.attrs.open ?? '')
  const next = withFenceValue(open, key, value)
  if (next === null || next === open) return null
  return state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, open: next }).setMeta(SLIDE_COMMAND, true)
}

/**
 * The Steps pill's words typed in place (#752's rule): words the pill already shows write nothing (so a Steps block
 * with no `tag` stays without one while its pill reads "Exercise"); any other words, an empty pill included, are its
 * `tag`. Null when nothing changes.
 */
export function setStepsTag(state: EditorState, pos: number, words: string): Transaction | null {
  const node = state.doc.nodeAt(pos)
  if (!node || node.type.name !== 'slideDiv') return null
  const open = OPEN_FENCE.exec(String(node.attrs.open ?? ''))
  const attrs = open ? parseFenceAttributes(open[2]) : null
  if (!attrs || !attrs.classes.includes('steps')) return null
  const shown = stepsTagOf(attrs)
  const typed = words.replace(/\s*\n\s*/g, ' ')
  if (typed === shown || (!typed.trim() && !shown)) return null
  // Typed like any other words on the slide: the pill's keys join one undo step as typing does.
  return setBlockValue(state, pos, 'tag', typed.trim() ? typed : '')?.setMeta(SLIDE_COMMAND, false) ?? null
}

/** The pill's placeholder while it is empty and the caret is in it: the default word, faint. */
export const PILL_PLACEHOLDER = EXERCISE_TAG

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

/** Enter in a table cell: the cell below, in a new row when it is the last one. Null outside a table. */
export function cellBelow(state: EditorState): Transaction | null {
  const $cell = cellAround(state.selection.$from)
  if (!$cell) return null
  const table = $cell.node(-1)
  const tableStart = $cell.start(-1)
  const map = TableMap.get(table)
  const rect = map.findCell($cell.pos - tableStart)
  const tr = state.tr
  let tableNode = table
  let tableMap = map
  if (rect.bottom >= map.height) {
    addRow(tr, { map, tableStart, table, left: 0, top: 0, right: map.width, bottom: map.height }, map.height)
    tableNode = tr.doc.nodeAt(tableStart - 1)!
    tableMap = TableMap.get(tableNode)
  }
  const cellPos = tableStart + tableMap.map[rect.bottom * tableMap.width + rect.left]
  tr.setSelection(TextSelection.near(tr.doc.resolve(cellPos + 1)))
  return tr.scrollIntoView()
}

/** The table Settings' Add a row and Add a column act on: the one with the caret, else the slide's first. */
function tableAt(state: EditorState): { table: PMNode; tableStart: number } | null {
  const $cell = cellAround(state.selection.$from)
  if ($cell) return { table: $cell.node(-1), tableStart: $cell.start(-1) }
  let found: { table: PMNode; tableStart: number } | null = null
  state.doc.descendants((node, pos) => {
    if (found) return false
    if (node.type.name === 'table') { found = { table: node, tableStart: pos + 1 }; return false }
    return true
  })
  return found
}

/** Settings' Add a row (at the bottom) or Add a column (on the right) of the slide's table; null without a table. */
export function addToTable(state: EditorState, what: 'row' | 'column'): Transaction | null {
  const at = tableAt(state)
  if (!at) return null
  const map = TableMap.get(at.table)
  const rect = { map, tableStart: at.tableStart, table: at.table, left: 0, top: 0, right: map.width, bottom: map.height }
  const tr = state.tr
  if (what === 'row') addRow(tr, rect, map.height)
  else addColumn(tr, rect, map.width)
  return tr.setMeta(SLIDE_COMMAND, true)
}
