/**
 * Sprint 167 PR 5 (decks README item B, `block-details.html`; Jarmo: "kasutaja ei saa aru, kuidas How to delete a
 * box"): one box's, column's, step's or list item's own handle on the chosen block, and what its menu and its drag do
 * to the slide editor's document. Pure ProseMirror and plain geometry, so the tests drive the same steps the stage takes
 * (`SlideItemHandle` draws it).
 *
 *  - **The items** of a chosen block: Boxes' boxes, Columns' columns, Steps' steps and a list's items (a list in its
 *    reveal wrapper too). A comment note right before a box or a column goes with it, as it does with a block.
 *  - **Duplicate** puts a copy right after the item, the caret at its start; the copy has no comments (a comment is on
 *    the words it was written on, once). A column's copy sets the columns back to an even split, as Add does; a block
 *    of four columns has no room for one more.
 *  - **Move left / right** (boxes, columns) and **Move up / down** (steps, list items) swap it with its neighbour; the
 *    drag moves it to any place in its block. The caret goes with it.
 *  - **Delete box / column / step / item** takes it and its words away; its comments stay, as Delete keeps a block's.
 *    The only item takes the block with it (Delete on the bar). A column of two: the other column's words stay on the
 *    slide, where the block stood, so one particular column goes without emptying it first.
 *
 * Every change carries `SLIDE_COMMAND`: the stage writes it to the deck as an undo step of its own, so one ⌘Z takes it
 * back. The handle sits where no words are: on a box's top edge in its padding, over a column on the ring's top line,
 * and left of a step or a list item on the ring's left line (`itemGripSpot`).
 */
import { Fragment, type Node as PMNode } from '@tiptap/pm/model'
import { Selection, type EditorState, type Transaction } from '@tiptap/pm/state'
import { slideBlockClassOf } from '../../../../../src/decks/blocks/fencedDiv'
import { SLIDE_COMMAND } from './slideCommands'
import { HANDLE_SIZE, MAX_COLUMNS, RING_LINE, caretBoxPos, chosenBlockAt, deleteBlock, divAttributesOf, gripSpot, notesIn, removeColumn, ringGap, withoutWidths, type BarKind, type Box, type ChosenBlock } from './blockBar'

/** What one item of a block is called in its menu. */
export type ItemKind = 'box' | 'column' | 'step' | 'item'

/** The item kind of a block's items; null for a block without items of its own (the Agenda, Tabs). */
export function itemKindOf(kind: BarKind): ItemKind | null {
  if (kind === 'boxes') return 'box'
  if (kind === 'columns') return 'column'
  if (kind === 'steps') return 'step'
  if (kind === 'list' || kind === 'numbered') return 'item'
  return null
}

/** Boxes and columns sit side by side (left, right); steps and list items one under another (up, down). */
export const itemRuns = (kind: ItemKind): 'row' | 'column' => (kind === 'box' || kind === 'column' ? 'row' : 'column')

/** The menu's words for each kind. */
export const ITEM_WORD: Readonly<Record<ItemKind, string>> = { box: 'box', column: 'column', step: 'step', item: 'item' }

/** The grip's tooltip: what a click and a drag do. */
export function itemGripTip(kind: ItemKind): string {
  return `Click for the ${ITEM_WORD[kind]}'s menu, drag to move it`
}

/** One item: its place and node, and where the comment notes right before it start (they go with it). */
export interface BlockItem {
  pos: number
  node: PMNode
  /** The first note right before it, or its own place when it has none. */
  from: number
}

const isNote = (node: PMNode) => node.type.name === 'commentNode'
const isList = (node: PMNode) => node.type.name === 'bulletList' || node.type.name === 'orderedList'
const childKind = (node: PMNode) => (node.type.name === 'slideDiv' ? slideBlockClassOf(divAttributesOf(node)) : null)

/** The node holding a list block's items, and its place: the list itself, Steps' list, or the list in its wrapper. */
function listHolder(block: ChosenBlock): { node: PMNode; pos: number } | null {
  if (isList(block.node)) return { node: block.node, pos: block.pos }
  let found: { node: PMNode; pos: number } | null = null
  block.node.forEach((child, offset) => {
    if (found) return
    if (block.kind === 'steps' ? child.type.name === 'orderedList' : isList(child)) found = { node: child, pos: block.pos + 1 + offset }
  })
  return found
}

/** The block's items, in order. */
export function blockItems(block: ChosenBlock): BlockItem[] {
  const kind = itemKindOf(block.kind)
  if (!kind) return []
  const items: BlockItem[] = []
  if (kind === 'step' || kind === 'item') {
    const holder = listHolder(block)
    holder?.node.forEach((child, offset) => {
      const pos = holder.pos + 1 + offset
      items.push({ pos, node: child, from: pos })
    })
    return items
  }
  let notesFrom: number | null = null
  block.node.forEach((child, offset) => {
    const pos = block.pos + 1 + offset
    if (isNote(child)) { notesFrom ??= pos; return }
    if (childKind(child) === kind) items.push({ pos, node: child, from: notesFrom ?? pos })
    notesFrom = null
  })
  return items
}

/** The box to offer the icon chooser for when Mark → Icon is picked on an all-plain block. */
export function boxForEmptyIconMenu(state: EditorState, block: ChosenBlock): number | null {
  if (block.kind !== 'boxes') return null
  const boxes = blockItems(block)
  if (boxes.some(box => divAttributesOf(box.node).values.icon?.trim())) return null
  const caret = caretBoxPos(state)
  return boxes.find(box => box.pos === caret)?.pos ?? boxes[0]?.pos ?? null
}

/** The item holding the caret, by its index; null when the caret is in none of them. */
export function caretItemIndex(state: EditorState, block: ChosenBlock): number | null {
  const head = state.selection.head
  const index = blockItems(block).findIndex(item => head > item.pos && head < item.pos + item.node.nodeSize)
  return index < 0 ? null : index
}

/** The block at `pos` as the bar sees it, when the caret's block is that one. */
function blockAtPos(state: EditorState, pos: number): ChosenBlock | null {
  const block = chosenBlockAt(state)
  return block && block.pos === pos ? block : null
}

/** The caret at the start of the item at `pos` in `tr`'s document. */
function caretIntoItem(tr: Transaction, pos: number): void {
  const $at = tr.doc.resolve(Math.min(pos + 1, tr.doc.content.size))
  tr.setSelection(Selection.findFrom($at, 1, true) ?? Selection.near($at))
}

/** A copy without its comments: a comment is on the words it was written on, once. */
function withoutComments(node: PMNode): PMNode | null {
  if (node.isText) return node.marks.some(mark => mark.type.name === 'commentMark') ? node.mark(node.marks.filter(mark => mark.type.name !== 'commentMark')) : node
  if (node.isLeaf) return node
  const children: PMNode[] = []
  let lost = false
  node.forEach(child => {
    if (isNote(child)) return
    const copy = withoutComments(child)
    if (copy) children.push(copy)
    else lost = true
  })
  if (lost) return null
  // A box that held a comment only keeps an empty line.
  if (!children.length && !node.isTextblock && node.type.contentMatch.defaultType) children.push(node.type.contentMatch.defaultType.create())
  try {
    return node.type.createChecked(node.attrs, Fragment.from(children), node.marks)
  } catch {
    // What the schema still needs, filled in; never an empty copy and never the original with its comments: no copy.
    return node.type.createAndFill(node.attrs, Fragment.from(children), node.marks)
  }
}

/**
 * An item in a new place is written the canonical way (as `moveTab` writes a tab): how it was written where it stood
 * (`mdTight`, a box tight under the one before it) belongs to that place.
 */
function asPlaced(node: PMNode): PMNode {
  return node.attrs.mdTight ? node.type.create({ ...node.attrs, mdTight: null }, node.content, node.marks) : node
}

/** Can the item at `index` be duplicated (a fifth column can't)? */
export function canDuplicateItem(block: ChosenBlock): boolean {
  return block.kind !== 'columns' || blockItems(block).length < MAX_COLUMNS
}

/** Duplicate: a copy right after the item, the caret at its start. Null when there is no room or no such item. */
export function duplicateItem(state: EditorState, blockPos: number, index: number): Transaction | null {
  const block = blockAtPos(state, blockPos)
  if (!block || !canDuplicateItem(block)) return null
  const item = blockItems(block)[index]
  if (!item) return null
  const end = item.pos + item.node.nodeSize
  const copy = withoutComments(item.node)
  if (!copy) return null
  const tr = state.tr.insert(end, asPlaced(copy))
  if (block.kind === 'columns') withoutWidths(tr, blockPos)
  caretIntoItem(tr, end)
  return tr.setMeta(SLIDE_COMMAND, true)
}

/**
 * Move the item at `from` so it ends up at index `to` (Move left / right / up / down, and the drag), its notes with it,
 * the caret with it (where it was in it, else at its start). Null where nothing moves.
 */
export function moveItem(state: EditorState, blockPos: number, from: number, to: number): Transaction | null {
  const block = blockAtPos(state, blockPos)
  if (!block) return null
  const items = blockItems(block)
  const item = items[from]
  if (!item || to === from || to < 0 || to >= items.length) return null
  const end = item.pos + item.node.nodeSize
  const slice = state.doc.slice(item.from, end).content
  const moving: PMNode[] = []
  slice.forEach(node => moving.push(node === item.node ? asPlaced(node) : node))
  const head = state.selection.head
  const offset = head > item.pos && head < end ? head - item.pos : null
  // The place it goes: before the item now at `to` (and its notes), or after it.
  const target = to < from ? items[to].from : items[to].pos + items[to].node.nodeSize
  const tr = state.tr.delete(item.from, end)
  const at = tr.mapping.map(target, to < from ? 1 : -1)
  tr.insert(at, moving)
  const itemAt = at + (item.pos - item.from)
  if (offset !== null) tr.setSelection(Selection.near(tr.doc.resolve(Math.min(itemAt + offset, tr.doc.content.size))))
  else caretIntoItem(tr, itemAt)
  return tr.setMeta(SLIDE_COMMAND, true)
}

/** A node's children that hold something (no empty lines). */
function filled(node: PMNode): PMNode[] {
  const out: PMNode[] = []
  node.forEach(child => { if (!(child.isTextblock && child.content.size === 0)) out.push(child) })
  return out
}

/**
 * Delete box / column / step / item: it and its words go; its comments stay (they are words). The only item takes its
 * block (the bar's Delete). A column of two leaves the other column's words on the slide where the block stood.
 */
export function deleteItem(state: EditorState, blockPos: number, index: number): Transaction | null {
  const block = blockAtPos(state, blockPos)
  if (!block) return null
  const items = blockItems(block)
  const item = items[index]
  if (!item) return null
  if (items.length === 1) return deleteBlock(state, blockPos)
  if (block.kind === 'columns') {
    if (items.length > 2) return removeColumn(state, blockPos, index)
    // Two columns: the other one's words take the block's place, with every comment the block holds (this column's,
    // and the notes between its children) where it stood.
    const other = items[1 - index].node
    const kept: PMNode[] = []
    block.node.forEach(child => {
      if (child === other) kept.push(...filled(other))
      else if (child === item.node) kept.push(...notesIn(child))
      else if (!(child.isTextblock && child.content.size === 0)) kept.push(child)
    })
    const tr = state.tr.replaceWith(blockPos, blockPos + block.node.nodeSize, kept.length ? kept : [state.schema.nodes.paragraph.create()])
    const $at = tr.doc.resolve(Math.min(blockPos + 1, tr.doc.content.size))
    tr.setSelection(Selection.findFrom($at, 1, true) ?? Selection.near($at))
    return tr.setMeta(SLIDE_COMMAND, true)
  }
  const notes = notesIn(item.node)
  const tr = state.tr
  const end = item.pos + item.node.nodeSize
  if (block.kind === 'boxes') {
    // The box's comments stay in the block where it stood (a note between boxes is the next box's).
    tr.replaceWith(item.pos, end, notes)
  } else {
    tr.delete(item.pos, end)
    if (notes.length) {
      // A list item starts with its line: the comments go at the end of the item before, or after the next one's line.
      const neighbour = index > 0 ? items[index - 1] : items[index + 1]
      const neighbourPos = tr.mapping.map(neighbour.pos)
      const into = index > 0 ? neighbourPos + neighbour.node.nodeSize - 1 : neighbourPos + 1 + neighbour.node.firstChild!.nodeSize
      tr.insert(into, notes)
    }
  }
  // The caret to the item that takes its place, else the one before it.
  const next = index + 1 < items.length ? items[index + 1] : items[index - 1]
  caretIntoItem(tr, tr.mapping.map(next.pos, index + 1 < items.length ? 1 : -1))
  return tr.setMeta(SLIDE_COMMAND, true)
}

// ---------------------------------------------------------------------------
// Where the handle goes, which item it is on, and where a drag lands (the stage's frame, in screen pixels)
// ---------------------------------------------------------------------------

/** The Text editor's table grips (`TableHandlesLayer`): a column's pill on the top edge, a row's on the left edge. */
export const ITEM_GRIP = { width: 28, height: 14 } as const
export const ITEM_ROW_GRIP = { width: 14, height: 26 } as const
/** How far a row grip stands off the block's left edge (the table grip's `GRIP_GAP`). */
export const ITEM_GRIP_GAP = 4

/** An item on the screen, in the frame: its box, and its top padding (where a box's handle may sit). */
export interface PlacedItem extends Box {
  padTop: number
}

/**
 * The handle's place and size: a box's on its top edge, in the middle, never lower than its padding (so it covers no
 * words at any fit); a column's in the middle over it, on the ring's top line (a column has no padding: its words start
 * at its edge); a step's or a list item's 4 px left of the block (over the ring's left line), in the middle of the item; the first item's, which would meet the block's ⋮ there, just
 * left of the ⋮ on the same line (under it, it read as the second item's: the app run).
 */
export function itemGripSpot(kind: ItemKind, item: PlacedItem, block: Box, blockKind: BarKind): Box {
  if (kind === 'box' || kind === 'column') {
    const { width, height } = ITEM_GRIP
    const left = item.left + item.width / 2 - width / 2
    const top = kind === 'box'
      ? Math.min(item.top - height / 2, item.top + item.padTop - height)
      : block.top - ringGap(blockKind) - RING_LINE / 2 - height / 2
    return { left, top, width, height }
  }
  const { width, height } = ITEM_ROW_GRIP
  // The table row grip's gap from its table: 4 px clear of the numbers or bullets, on the ring's line.
  let left = block.left - ITEM_GRIP_GAP - width
  let top = item.top + item.height / 2 - height / 2
  const grip = gripSpot(block)
  const meets = (x: number, y: number) => x < grip.left + HANDLE_SIZE && x + width > grip.left && y < grip.top + HANDLE_SIZE && y + height > grip.top
  if (meets(left, top)) {
    left = grip.left - ITEM_GRIP_GAP - width
    // No room left of the ⋮ (the slide's edge): under it instead.
    if (left < 0) { left = block.left - ITEM_GRIP_GAP - width; top = grip.top + HANDLE_SIZE + ITEM_GRIP_GAP }
  }
  return { left, top, width, height }
}

/**
 * How far around the block a pointer still points at one of its items: the handles sit just outside it. On the left
 * the first step's or list item's sits beyond the block's ⋮ (about 42 px out), so the pointer on its way there keeps
 * that item; above, right and below, the title and the next block stay their own.
 */
export const ITEM_REACH = 24
export const ITEM_REACH_LEFT = 48

/**
 * The item a pointer at (x, y) in the frame points at: within the block (and `ITEM_REACH` around it, where the handles
 * are), the nearest item, so crossing the gap between two items, or onto a handle, keeps one; null outside.
 */
export function itemAtPoint(items: readonly Box[], block: Box, x: number, y: number): number | null {
  if (x < block.left - ITEM_REACH_LEFT || x > block.left + block.width + ITEM_REACH || y < block.top - ITEM_REACH || y > block.top + block.height + ITEM_REACH) return null
  let best: number | null = null
  let distance = Infinity
  items.forEach((item, index) => {
    const dx = Math.max(item.left - x, 0, x - (item.left + item.width))
    const dy = Math.max(item.top - y, 0, y - (item.top + item.height))
    const away = Math.hypot(dx, dy)
    if (away < distance) { distance = away; best = index }
  })
  return best
}

/** A drop line: a vertical one between boxes or columns, a horizontal one between steps or list items. */
export interface DropLine {
  /** The index the item ends up at. */
  to: number
  left: number
  top: number
  width: number
  height: number
}

/**
 * Where a dragged item lands (the table's `dropTarget`, along rows that may wrap): the gap between two items nearest the
 * pointer, with its line, and the index the item ends up at. Boxes wrap into rows: a gap at a row's end is drawn after
 * its last box, the one at a row's start before its first. Null when the nearest gap is where the item already is.
 */
export function itemDropLine(items: readonly Box[], runs: 'row' | 'column', from: number, x: number, y: number): DropLine | null {
  if (!items.length) return null
  const lines: { gap: number; left: number; top: number; width: number; height: number }[] = []
  const sameRow = (a: Box, b: Box) => Math.abs(a.top - b.top) < 1
  for (let gap = 0; gap <= items.length; gap++) {
    const before = items[gap - 1]
    const after = items[gap]
    if (runs === 'column') {
      const y0 = !before ? after.top - 2 : !after ? before.top + before.height + 2 : (before.top + before.height + after.top) / 2
      const box = after ?? before
      lines.push({ gap, left: box.left, top: y0, width: box.width, height: 0 })
      continue
    }
    if (before && after && sameRow(before, after)) {
      lines.push({ gap, left: (before.left + before.width + after.left) / 2, top: after.top, width: 0, height: after.height })
      continue
    }
    if (before) lines.push({ gap, left: before.left + before.width + 2, top: before.top, width: 0, height: before.height })
    if (after) lines.push({ gap, left: after.left - 2, top: after.top, width: 0, height: after.height })
  }
  let best = lines[0]
  let distance = Infinity
  for (const line of lines) {
    const dx = Math.max(line.left - x, 0, x - (line.left + line.width))
    const dy = Math.max(line.top - y, 0, y - (line.top + line.height))
    const away = Math.hypot(dx, dy)
    if (away < distance) { distance = away; best = line }
  }
  if (best.gap === from || best.gap === from + 1) return null
  return { to: best.gap > from ? best.gap - 1 : best.gap, left: best.left, top: best.top, width: best.width, height: best.height }
}
