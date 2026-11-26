/**
 * The block's bar (experience 46, 17 November: "The block's bar has one shape for every block", "A block changes type
 * with one click", "How wide a box is", "Tab moves across items"; frame 23's Columns tools; frames 29 and 30): what it
 * does to the slide editor's document. Pure ProseMirror, so the tests drive the same steps the stage takes, and every
 * change carries `SLIDE_COMMAND`: the stage writes it to the deck as an undo step of its own, so one ⌘Z takes it back.
 *
 *  - **The chosen block** is the slide's top-level block holding the caret: Boxes, Steps, Columns, a bullet list (List)
 *    or a numbered one (Numbered). A list inside a column belongs to its Columns block.
 *  - **Turn into** keeps every item's heading and line: a box's or a column's `###` heading is a step's or a list item's
 *    first line, and its lines follow; a list item's first line is a box's or a column's heading. Between Boxes and
 *    Columns, and between the three lists, the items move as they are, so the round trip writes the same bytes. What only
 *    one kind can show (a box's icon, Boxes' Width, Style and alignment, Steps' label, the columns' split) stays with
 *    that kind: ⌘Z brings it back. A comment on an item stays with it, or with the block where the kind has no room.
 *  - **Boxes:** Width (`width`), Style (`fill`), alignment (`align`): one value each on the block's own line
 *    (`setBlockValue`, `withFenceValue`), none is the default. Mark (Sprint 167 PR 2, README item C): Icon, Number, Dot
 *    or Arrow, the block's look (`look`, `setBoxesMark`); Icon is the default and writes none.
 *  - **Columns:** the count (2, 3, 4): a new column comes empty; a lower count takes an empty column first, wherever it
 *    stands, and with none empty the last column's words join the one before it, so nothing typed is lost. Remove a column (frame 23) takes the caret's column and its words away, as Delete
 *    block takes the block's. The split: the line between two columns snaps to ⅓, ½ and ⅔ of the two, and is written as
 *    each column's `width` on its own line (`::: {.column width="33%"}`, Pandoc's and Quarto's form).
 *  - **Add, the +, Delete and the ⋮ drag.** A comment note before the block moves with it; Delete keeps the block's
 *    comments (they are words), where the block stood.
 *  - **Reveal** (decks README item 18): one toggle, "One by one", pressed when on (off is All at once), for every kind
 *    but the Agenda (`setReveal`); it folds right after the alignment (`FOLD_AT`). Boxes,
 *    Steps and Columns write `reveal="one"` on their own line; a list is wrapped in `::: incremental` (`::: {reveal="one"}`
 *    is read the same), which the bar sees through (`revealWrappedList`): to it, the block is still a List. Turn into
 *    carries One by one to the new kind.
 *  - **Tab** in a box or a column goes to the start of the next one (Shift+Tab the one before); in the last it stays.
 *    In a list item, a code box or a table cell, Tab is theirs (indent, the next cell).
 */
import type { Node as PMNode, Schema } from '@tiptap/pm/model'
import { NodeSelection, Selection, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state'
import { liftTarget } from '@tiptap/pm/transform'
import { MARK_LOOK, OPEN_FENCE, boxesShowIcons, REVEAL_KEY, REVEAL_LIST_CLOSE, REVEAL_LIST_OPEN, REVEAL_ONE, boxesMarkOf, columnWidthOf, isRevealWrapperAttrs, parseFenceAttributes, revealsOne, slideBlockClassOf, withFenceValue, wrapperLineWithoutReveal, type BoxesMark, type FenceAttributes } from '../../../../../src/decks/blocks/fencedDiv'
import { boxIconOf, UNKNOWN_ICON } from '../slide/iconSet'
import { SLIDE_COMMAND, setBlockValue, slideDivNode } from './slideCommands'
import { addTab, columnsToTabs, tabsAround, tabsToColumns } from '../../../extensions/tabs/tabsCommands'

/**
 * The kinds of block the bar is for; its type menu lists `BAR_KINDS`, in that order. The Agenda (small details 14) has a
 * bar of its own type and Delete only: it is one piece, drawn from the deck, and turns into nothing.
 */
export type BarKind = 'boxes' | 'steps' | 'columns' | 'list' | 'numbered' | 'agenda' | 'tabs'
export const BAR_KINDS: readonly BarKind[] = ['boxes', 'steps', 'columns', 'list', 'numbered']
/** The type menu's names. */
export const BAR_KIND_LABEL: Readonly<Record<BarKind, string>> = { boxes: 'Boxes', steps: 'Steps', columns: 'Columns', list: 'List', numbered: 'Numbered', agenda: 'Agenda', tabs: 'Tabs' }

/**
 * Sprint 163 (README "Tabs in the editor"): the type menu's kinds for a block. Tabs turn into Columns and back, and
 * nothing else (a tab's pane holds any blocks, which a box or a list item can't); a Tabs block inside a column only
 * stays Tabs.
 */
export function typeMenuKinds(kind: BarKind, nested: boolean): readonly BarKind[] {
  if (kind === 'tabs') return nested ? ['tabs'] : ['tabs', 'columns']
  if (kind === 'columns') return [...BAR_KINDS, 'tabs']
  return BAR_KINDS
}
/** The Agenda's tooltip on its bar (the decks README, small details 14). */
export const AGENDA_TIP = "Lists this deck's sections"

/**
 * README item 18 (the Experience lead, 18 November): Reveal is one toggle, "One by one", pressed when on; off is All at
 * once, the default. Its words and tooltip.
 */
export const REVEAL_LABEL = 'One by one'
export const REVEAL_TIP = 'In Present, show the items one by one: the slide opens with the first, and each → or clicker press shows the next'

/**
 * When the bar is wider than the slide's pane, its own groups fold one by one (the lead on #773), in this order: the
 * alignment first, then Reveal (it keeps its toggle, as an icon with its tooltip), then Width or the Columns count, then
 * Style, and last Boxes' Mark (Sprint 167 PR 2), a menu already, which keeps its value as its icon only, the word in its
 * tooltip. `fold` counts the folds; a group is folded from its number on.
 */
export const FOLD_AT = { alignment: 1, reveal: 2, size: 3, style: 4, mark: 5 } as const
export const MAX_FOLD = FOLD_AT.mark

/** A Columns block holds two to four columns from the bar (more can be written, and are kept). */
export const MIN_COLUMNS = 2
export const MAX_COLUMNS = 4
/** Where the line between two columns snaps: a third, a half, two thirds of the two. */
export const SPLIT_SNAPS = [1 / 3, 1 / 2, 2 / 3] as const

const NO_ATTRIBUTES: FenceAttributes = { classes: [], id: null, values: {} }

/** A `:::` block's attributes, read from its opening line as written. */
export function divAttributesOf(node: PMNode): FenceAttributes {
  if (node.type.name !== 'slideDiv') return NO_ATTRIBUTES
  const open = OPEN_FENCE.exec(String(node.attrs.open ?? ''))
  return (open ? parseFenceAttributes(open[2]) : null) ?? NO_ATTRIBUTES
}

/** The look used to draw a box's badge. */
export function boxLookAt(doc: PMNode, pos: number | undefined): string {
  return pos === undefined ? 'boxes' : divAttributesOf(doc.resolve(pos).parent).values.look ?? 'boxes'
}

/** The position of the innermost box (`::: box`) holding the selection's head, or null. */
export function caretBoxPos(state: EditorState): number | null {
  const $head = state.selection.$head
  for (let depth = $head.depth; depth > 0; depth--) {
    const node = $head.node(depth)
    if (node.type.name === 'slideDiv' && slideBlockClassOf(divAttributesOf(node)) === 'box') return $head.before(depth)
  }
  return null
}

/** The caret's box and its icon, including an unknown name as written. */
export function caretBoxIcon(state: EditorState) {
  const pos = caretBoxPos(state)
  const node = pos === null ? null : state.doc.nodeAt(pos)
  if (pos === null || !node || !boxesShowIcons(boxLookAt(state.doc, pos))) return null
  const icon = boxIconOf(divAttributesOf(node).values.icon)
  return { pos, current: icon?.name ?? null, glyph: icon?.phosphor ?? UNKNOWN_ICON }
}

export function isBoxIconShortcut(event: Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'defaultPrevented'>): boolean {
  return event.key === 'F10' && event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.defaultPrevented
}

export type BoxIconMenuCloseReason = 'trigger' | 'outside' | 'escape' | 'mouse-pick' | 'keyboard-pick'

export function boxIconMenuReturnFocus(
  openedByKeyboard: boolean,
  reason: BoxIconMenuCloseReason,
): 'trigger' | 'editor' | null {
  if (reason === 'outside') return null
  if (reason === 'mouse-pick') return 'editor'
  return openedByKeyboard ? 'trigger' : 'editor'
}

const divKind = (node: PMNode) => (node.type.name === 'slideDiv' ? slideBlockClassOf(divAttributesOf(node)) : null)
const isNote = (node: PMNode) => node.type.name === 'commentNode'
const isEmptyText = (node: PMNode) => node.isTextblock && node.content.size === 0

const isList = (node: PMNode) => node.type.name === 'bulletList' || node.type.name === 'orderedList'

/**
 * README item 18: a list set to One by one, wrapped in `::: incremental` (or `::: {reveal="one"}`): its list, when the
 * wrapper holds one list and nothing else but comment notes; null for anything else. To the bar it is the list.
 */
export function revealWrappedList(node: PMNode): PMNode | null {
  if (node.type.name !== 'slideDiv' || !isRevealWrapperAttrs(divAttributesOf(node))) return null
  let list: PMNode | null = null
  let other = false
  node.forEach(child => {
    if (isNote(child)) return
    if (!list && isList(child)) list = child
    else other = true
  })
  return other ? null : list
}

/** The bar's kind of a top-level block, or null for a block it isn't for (a title, a line, a table, a picture). */
export function barKindOf(node: PMNode): BarKind | null {
  if (node.type.name === 'slideAgenda') return 'agenda'
  if (node.type.name === 'tabsBlock') return 'tabs'
  const list = isList(node) ? node : revealWrappedList(node)
  if (list) return list.type.name === 'bulletList' ? 'list' : 'numbered'
  const kind = divKind(node)
  return kind === 'boxes' || kind === 'steps' || kind === 'columns' ? kind : null
}

/** A block whose items are one level down, in a list of its own: Steps, and a list in its reveal wrapper. */
const listIsInside = (block: { node: PMNode; kind: BarKind }) => block.kind === 'steps' || ((block.kind === 'list' || block.kind === 'numbered') && !isList(block.node))

/** Is the block set to One by one (README item 18)? */
export function revealsOneBlock(block: { node: PMNode; kind: BarKind }): boolean {
  if (block.kind === 'list' || block.kind === 'numbered') return !isList(block.node)
  // A Tabs block is one item in a reveal (README "Present"), and the Agenda one piece.
  if (block.kind === 'agenda' || block.kind === 'tabs') return false
  return revealsOne(divAttributesOf(block.node))
}

/**
 * Reveal on the bar (README item 18): One by one (`one`) or All at once. Boxes, Steps and Columns write `reveal="one"`
 * on their own line, or take it out; a List or Numbered list is wrapped in `::: incremental` … `:::`, or unwrapped, its
 * own lines never changing. One transaction, one ⌘Z; null when nothing changes.
 */
export function setReveal(state: EditorState, pos: number, one: boolean): Transaction | null {
  const block = blockAt(state, pos)
  if (!block || block.kind === 'agenda' || block.kind === 'tabs' || revealsOneBlock(block) === one) return null
  if (block.kind !== 'list' && block.kind !== 'numbered') {
    const open = String(block.node.attrs.open ?? '')
    const next = withFenceValue(open, REVEAL_KEY, one ? REVEAL_ONE : null)
    if (next === null || next === open) return null
    return state.tr.setNodeMarkup(pos, undefined, { ...block.node.attrs, open: next }).setMeta(SLIDE_COMMAND, true)
  }
  const tr = state.tr
  if (one) {
    const range = state.doc.resolve(pos).blockRange(state.doc.resolve(pos + block.node.nodeSize))
    if (!range) return null
    const wrapper = slideDivNode(state.schema, REVEAL_LIST_OPEN, REVEAL_LIST_CLOSE, [block.node])
    tr.wrap(range, [{ type: wrapper.type, attrs: wrapper.attrs }])
  } else {
    // A wrapper that carries more than Reveal (an id, another class or value) keeps them: only its Reveal goes.
    const open = String(block.node.attrs.open ?? '')
    const kept = wrapperLineWithoutReveal(open)
    if (kept !== null) {
      const attrs = OPEN_FENCE.exec(kept)
      const read = attrs ? parseFenceAttributes(attrs[2]) : null
      return tr.setNodeMarkup(pos, undefined, { ...block.node.attrs, open: kept, class: read ? read.classes.join(' ') : '' }).setMeta(SLIDE_COMMAND, true)
    }
    // A wrapper read as `::: {reveal="one"}` is unwrapped the same: All at once writes nothing.
    const range = state.doc.resolve(pos + 1).blockRange(state.doc.resolve(pos + block.node.nodeSize - 1))
    const target = range ? liftTarget(range) : null
    if (!range || target === null) return null
    tr.lift(range, target)
  }
  return tr.setMeta(SLIDE_COMMAND, true)
}

/** Sprint 167 PR 2 (README item C): the Mark menu's words, in its order (`BOXES_MARKS`), and each choice's tooltip. */
export const MARK_LABEL: Readonly<Record<BoxesMark, string>> = { icon: 'Icon', number: 'Number', dot: 'Dot', arrow: 'Arrow' }
export const MARK_TIP: Readonly<Record<BoxesMark, string>> = {
  icon: "Each box's own icon",
  number: 'The boxes numbered in their order',
  dot: 'A dot on each box',
  arrow: 'An arrow on each box',
}
export const MARK_MENU_TIP = 'Mark on every box'

/**
 * Mark on a Boxes block's bar (README item C): its look on the block's own line (`look="steps"`), or none for Icon, one
 * transaction and one ⌘Z. The mark it shows already is no change, so a look written another way (`look="boxes"`, or a
 * word no look draws) keeps its line. The boxes' own `icon` values stay: Icon draws them again.
 */
export function setBoxesMark(state: EditorState, pos: number, mark: BoxesMark): Transaction | null {
  const block = blockAt(state, pos)
  if (!block || block.kind !== 'boxes' || boxesMarkOf(divAttributesOf(block.node)) === mark) return null
  return setBlockValue(state, pos, 'look', MARK_LOOK[mark])
}

/** The block the bar is for: its place, its node and its kind. */
export interface ChosenBlock {
  pos: number
  node: PMNode
  kind: BarKind
}

/** The top-level block holding the selection, when the bar is for it; null otherwise. */
export function chosenBlockAt(state: EditorState): ChosenBlock | null {
  const selection = state.selection
  if (selection instanceof NodeSelection && selection.$from.depth === 0) {
    const kind = barKindOf(selection.node)
    return kind ? { pos: selection.from, node: selection.node, kind } : null
  }
  // Sprint 163: the caret in a Tabs block chooses that block, wherever it stands (an exercise's tabs are in a column).
  const tabs = tabsAround(state)
  if (tabs) return { pos: tabs.pos, node: tabs.node, kind: 'tabs' }
  const $head = selection.$head
  if ($head.depth < 1) return null
  const node = $head.node(1)
  const kind = barKindOf(node)
  return kind ? { pos: $head.before(1), node, kind } : null
}

/** The block at `pos`, when the bar is for it. */
function blockAt(state: EditorState, pos: number): ChosenBlock | null {
  const node = state.doc.nodeAt(pos)
  const kind = node ? barKindOf(node) : null
  return node && kind ? { pos, node, kind } : null
}

/** A `:::` block with its lines, as the / menu's blocks are made (`slideDivNode`). */
const div = slideDivNode

const emptyColumn = (schema: Schema) => div(schema, '::: column', ':::', [schema.nodes.heading.create({ level: 3 }), schema.nodes.paragraph.create()])

// ---------------------------------------------------------------------------
// Items: what Turn into carries from one kind to another
// ---------------------------------------------------------------------------

/** One item of a block: a box's or a column's blocks, or a list item. */
type Item = { from: 'div'; content: PMNode[] } | { from: 'li'; node: PMNode }

/** A block's items, the comment notes it has outside any item (`before`), and what it holds besides them (`after`). */
interface Parts {
  items: Item[]
  before: PMNode[]
  after: PMNode[]
  /** The list the items came from (List, Numbered, Steps): what it was written as, for a list it turns into. */
  list: PMNode | null
  /** README item 18: the block was set to One by one; the kind it turns into is too. */
  reveal: boolean
}

function partsOf(block: ChosenBlock): Parts {
  const parts: Parts = { items: [], before: [], after: [], list: null, reveal: revealsOneBlock(block) }
  const fromList = (list: PMNode) => { parts.list = list; list.forEach(item => parts.items.push({ from: 'li', node: item })) }
  if ((block.kind === 'list' || block.kind === 'numbered') && !listIsInside(block)) {
    fromList(block.node)
    return parts
  }
  if (listIsInside(block)) {
    let listed = false
    block.node.forEach(child => {
      // What stands before the list stays before the block, and what follows it after: the reading order holds.
      if (!listed && (block.kind === 'steps' ? child.type.name === 'orderedList' : isList(child))) { fromList(child); listed = true }
      else if (!listed) parts.before.push(child)
      else parts.after.push(child)
    })
    return parts
  }
  // Boxes and Columns: a note between items goes with the item after it (it is a note on that item's first block).
  let notes: PMNode[] = []
  block.node.forEach(child => {
    if (isNote(child)) { notes.push(child); return }
    const content: PMNode[] = [...notes]
    notes = []
    if (child.type.name === 'slideDiv') child.forEach(inner => content.push(inner))
    else content.push(child)
    parts.items.push({ from: 'div', content })
  })
  if (notes.length) {
    const last = parts.items[parts.items.length - 1]
    if (last?.from === 'div') last.content.push(...notes)
    else parts.before.push(...notes)
  }
  return parts
}

/**
 * A block moved between a box (or a column) and a list item, written the canonical way: how it was written where it
 * stood (`md…`, `markdownAsWritten`: a list tight under its line, its indent in the item) belongs to that place, and
 * would read back differently from the new one, so the round trip writes the same bytes.
 */
function asMoved(node: PMNode): PMNode {
  if (node.isText) return node
  const attrs: Record<string, unknown> = { ...node.attrs }
  let changed = false
  for (const name of Object.keys(attrs)) {
    if (/^md[A-Z]/.test(name) && attrs[name] !== null && attrs[name] !== node.type.spec.attrs?.[name]?.default) {
      attrs[name] = node.type.spec.attrs?.[name]?.default ?? null
      changed = true
    }
  }
  const children: PMNode[] = []
  let inner = false
  node.forEach(child => { const moved = asMoved(child); if (moved !== child) inner = true; children.push(moved) })
  return changed || inner ? node.type.create(attrs, inner ? children : node.content, node.marks) : node
}

/** An item as a box's or a column's blocks: a list item's first line is its heading, its other lines follow. */
function itemAsDivContent(schema: Schema, item: Item): PMNode[] {
  if (item.from === 'div') return item.content
  const children: PMNode[] = []
  item.node.forEach(child => children.push(asMoved(child)))
  const first = children[0]
  if (!first || first.type.name !== 'paragraph') return children
  // A first line with a line break in it (`1. Heading⏎text`): the heading is the words before the break.
  let cut = -1
  first.forEach((child, offset) => { if (cut < 0 && child.type.name === 'hardBreak') cut = offset })
  const heading = cut < 0 ? first.content : first.content.cut(0, cut)
  const line = cut < 0 ? null : first.content.cut(cut + 1)
  const out: PMNode[] = []
  if (heading.size) out.push(schema.nodes.heading.create({ level: 3 }, heading))
  if (line && line.size) out.push(schema.nodes.paragraph.create(null, line))
  return [...out, ...children.slice(1)].filter(node => !isEmptyText(node))
}

/** An item as a list item: a box's or a column's heading is its first line, its other blocks follow. */
function itemAsListItem(schema: Schema, item: Item): PMNode {
  if (item.from === 'li') return item.node
  const blocks = item.content.filter(node => !isEmptyText(node)).map(asMoved)
  const notes = blocks.filter(isNote)
  const rest = blocks.filter(node => !isNote(node))
  let first: PMNode
  const head = rest[0]
  if (head && head.type.name === 'heading') first = schema.nodes.paragraph.create(null, head.content)
  else if (head && head.type.name === 'paragraph') first = head
  else first = schema.nodes.paragraph.create()
  const tail = head && (head.type.name === 'heading' || head.type.name === 'paragraph') ? rest.slice(1) : rest
  return schema.nodes.listItem.createChecked(null, [first, ...notes, ...tail])
}

/** A box's or a column's blocks, never empty: an empty box keeps its empty line, an empty column its places. */
function divChild(schema: Schema, kind: 'box' | 'column', content: PMNode[]): PMNode {
  const blocks = content.filter(node => !isEmptyText(node))
  if (!blocks.some(node => !isNote(node))) {
    const empty = kind === 'column' ? [schema.nodes.heading.create({ level: 3 }), schema.nodes.paragraph.create()] : [schema.nodes.paragraph.create()]
    return div(schema, `::: ${kind}`, ':::', [...blocks, ...empty])
  }
  return div(schema, `::: ${kind}`, ':::', blocks)
}

/** The block of `kind` holding `parts`' items. A Steps block has no Label (Sprint 164 PR 3, as the / menu's). */
function build(schema: Schema, kind: BarKind, parts: Parts): PMNode {
  // README item 18: One by one goes with the items into the new kind, written as that kind writes it.
  const revealed = (open: string) => (parts.reveal ? withFenceValue(open, REVEAL_KEY, REVEAL_ONE)! : open)
  const wrapped = (list: PMNode) => (parts.reveal ? div(schema, REVEAL_LIST_OPEN, REVEAL_LIST_CLOSE, [list]) : list)
  if (kind === 'boxes' || kind === 'columns') {
    const child = kind === 'boxes' ? 'box' : 'column'
    const children = parts.items.map(item => divChild(schema, child, itemAsDivContent(schema, item)))
    if (!children.length) children.push(divChild(schema, child, []))
    return div(schema, revealed(`:::: ${kind}`), '::::', children)
  }
  const items = parts.items.map(item => itemAsListItem(schema, item))
  if (!items.length) items.push(schema.nodes.listItem.create(null, [schema.nodes.paragraph.create()]))
  // A list into a list of its own kind keeps what it was written as: a numbered list's start and `)`, between Numbered
  // and Steps (Codex on #773). A bullet list never turns into another bullet list, so its `*` has nowhere to go.
  const same = (type: string) => (parts.list?.type.name === type ? parts.list.attrs : null)
  if (kind === 'list') return wrapped(schema.nodes.bulletList.createChecked(same('bulletList'), items))
  const list = schema.nodes.orderedList.createChecked(same('orderedList'), items)
  if (kind === 'numbered') return wrapped(list)
  return div(schema, revealed('::: steps'), ':::', [list])
}

/** Which item the caret is in (its index), or 0. */
function caretItem(state: EditorState, block: ChosenBlock): number {
  const $head = state.selection.$head
  if ($head.depth < 2 || $head.before(1) !== block.pos) return 0
  // The list's items are one level deeper in Steps, and in a list's reveal wrapper.
  const depth = listIsInside(block) ? 3 : 2
  if ($head.depth < depth) return 0
  let index = $head.index(depth - 1)
  if (block.kind === 'boxes' || block.kind === 'columns') {
    // Notes are no items.
    let notes = 0
    for (let at = 0; at < index; at++) if (isNote(block.node.child(at))) notes++
    index -= notes
  }
  return index
}

/** The start of item `index` of the block at `pos` (its first place for the caret). */
function itemStart(doc: PMNode, pos: number, kind: BarKind, index: number): Selection {
  const block = doc.nodeAt(pos)!
  let holder = block
  let start = pos + 1
  if (listIsInside({ node: block, kind })) {
    let offset = 0
    block.forEach((child, childOffset) => { if (holder === block && (kind === 'steps' ? child.type.name === 'orderedList' : isList(child))) { holder = child; offset = childOffset } })
    start = pos + 1 + offset + 1
  }
  let seen = 0
  let at = start
  for (let child = 0; child < holder.childCount; child++) {
    const node = holder.child(child)
    if (!isNote(node)) {
      if (seen === index) return Selection.findFrom(doc.resolve(at + 1), 1, true) ?? Selection.near(doc.resolve(at))
      seen++
    }
    at += node.nodeSize
  }
  return Selection.near(doc.resolve(pos + 1))
}

/**
 * Turn the block at `pos` into `kind` (frames 29 and 30): one transaction, every item's heading and line kept, the caret
 * in the same item. Null when it is that kind already, or when nothing can be built.
 */
export function turnInto(state: EditorState, pos: number, kind: BarKind): Transaction | null {
  const block = blockAt(state, pos)
  // The Agenda holds no items to carry, and no block turns into one.
  if (!block || block.kind === kind || block.kind === 'agenda' || kind === 'agenda') return null
  // Sprint 163: Columns ⇄ Tabs, and nothing else for Tabs.
  if (block.kind === 'columns' && kind === 'tabs') return columnsToTabs(state, pos)
  if (block.kind === 'tabs') return kind === 'columns' && state.doc.resolve(pos).depth === 0 ? tabsToColumns(state, pos) : null
  if (kind === 'tabs') return null
  const parts = partsOf(block)
  let made: PMNode
  try {
    made = build(state.schema, kind, parts)
  } catch {
    return null
  }
  const item = caretItem(state, block)
  const tr = state.tr.replaceWith(pos, pos + block.node.nodeSize, [...parts.before, made, ...parts.after])
  const at = pos + parts.before.reduce((size, node) => size + node.nodeSize, 0)
  tr.setSelection(itemStart(tr.doc, at, kind, Math.min(item, Math.max(0, itemCount(made, kind) - 1))))
  return tr.setMeta(SLIDE_COMMAND, true)
}

/** How many items a block holds. */
export function itemCount(node: PMNode, kind: BarKind): number {
  if (listIsInside({ node, kind })) {
    let count = 0
    node.forEach(child => { if (kind === 'steps' ? child.type.name === 'orderedList' : isList(child)) count = Math.max(count, child.childCount) })
    return count
  }
  let count = 0
  node.forEach(child => { if (!isNote(child)) count++ })
  return count
}

// ---------------------------------------------------------------------------
// Add, the +, Delete
// ---------------------------------------------------------------------------

/** Add (the bar) and the + at the block's edge: one more item at the end, the caret in it. Null at four columns. */
export function addItem(state: EditorState, pos: number): Transaction | null {
  const block = blockAt(state, pos)
  if (!block || block.kind === 'agenda') return null
  // Sprint 163: a tab at the end (the stage then names it: `addTab`'s index).
  if (block.kind === 'tabs') return addTab(state, pos)?.tr ?? null
  const schema = state.schema
  const tr = state.tr
  const end = pos + block.node.nodeSize - 1
  if (block.kind === 'boxes' || block.kind === 'columns') {
    if (block.kind === 'columns' && columnCount(block.node) >= MAX_COLUMNS) return null
    const node = block.kind === 'boxes' ? div(schema, '::: box', ':::', [schema.nodes.paragraph.create()]) : emptyColumn(schema)
    tr.insert(end, node)
    if (block.kind === 'columns') withoutWidths(tr, pos)
    tr.setSelection(Selection.findFrom(tr.doc.resolve(end + 1), 1, true) ?? Selection.near(tr.doc.resolve(end)))
    return tr.setMeta(SLIDE_COMMAND, true)
  }
  let listEnd = end
  if (listIsInside(block)) {
    let found = -1
    block.node.forEach((child, offset) => { if (block.kind === 'steps' ? child.type.name === 'orderedList' : isList(child)) found = pos + 1 + offset + child.nodeSize - 1 })
    if (found < 0) return null
    listEnd = found
  }
  tr.insert(listEnd, schema.nodes.listItem.create(null, [schema.nodes.paragraph.create()]))
  tr.setSelection(TextSelection.create(tr.doc, listEnd + 2))
  return tr.setMeta(SLIDE_COMMAND, true)
}

/** Every comment note inside a node, in order. */
export function notesIn(node: PMNode): PMNode[] {
  const notes: PMNode[] = []
  node.descendants(child => {
    if (isNote(child)) notes.push(child)
    return !isNote(child)
  })
  return notes
}

/** Delete (the bar, and Columns' Delete block): the block goes, its comments stay where it stood (they are words). */
export function deleteBlock(state: EditorState, pos: number): Transaction | null {
  const block = blockAt(state, pos)
  if (!block) return null
  const notes = notesIn(block.node)
  const tr = state.tr
  // A block that is its parent's only one (the slide's, or a column's: Sprint 163's Tabs in a column) leaves an empty line.
  const keep = notes.length || state.doc.resolve(pos).parent.childCount > 1 ? notes : [state.schema.nodes.paragraph.create()]
  tr.replaceWith(pos, pos + block.node.nodeSize, keep)
  tr.setSelection(Selection.near(tr.doc.resolve(Math.min(pos, tr.doc.content.size)), -1))
  return tr.setMeta(SLIDE_COMMAND, true)
}

// ---------------------------------------------------------------------------
// Columns: the count, Remove a column, the split
// ---------------------------------------------------------------------------

/** A Columns block's columns, with their places. */
function columnsOf(node: PMNode, pos: number): { node: PMNode; pos: number }[] {
  const out: { node: PMNode; pos: number }[] = []
  node.forEach((child, offset) => { if (divKind(child) === 'column') out.push({ node: child, pos: pos + 1 + offset }) })
  return out
}

export function columnCount(node: PMNode): number {
  return columnsOf(node, 0).length
}

/** Each column's `width` taken out (an even split again), in `tr` as it is now. */
export function withoutWidths(tr: Transaction, pos: number): void {
  const block = tr.doc.nodeAt(pos)
  if (!block) return
  for (const column of columnsOf(block, pos)) {
    const open = String(column.node.attrs.open ?? '')
    const next = withFenceValue(open, 'width', null)
    if (next !== null && next !== open) tr.setNodeMarkup(column.pos, undefined, { ...column.node.attrs, open: next })
  }
}

/** A column with no words in it: every line empty. A comment is words, so a column holding one is not empty. */
function isEmptyColumn(column: PMNode): boolean {
  let empty = true
  column.forEach(child => { if (!isEmptyText(child)) empty = false })
  return empty
}

/**
 * The count (2, 3, 4): new columns come empty. A lower count takes an empty column first, wherever it stands (the last
 * empty one when there are several); with none empty, the last column's words join the one before it, so nothing typed
 * is lost. So removing one particular column is: delete its words, then lower the count (the Experience lead,
 * 17 November). The split goes back to even. Null when nothing changes.
 */
export function setColumnCount(state: EditorState, pos: number, count: number): Transaction | null {
  const block = blockAt(state, pos)
  if (!block || block.kind !== 'columns' || count < MIN_COLUMNS || count > MAX_COLUMNS) return null
  const columns = columnsOf(block.node, pos)
  if (columns.length === count) return null
  const schema = state.schema
  const tr = state.tr
  if (count > columns.length) {
    const end = pos + block.node.nodeSize - 1
    tr.insert(end, Array.from({ length: count - columns.length }, () => emptyColumn(schema)))
  } else {
    // One column at a time, on the document as it is now.
    for (let left = columns.length - count; left > 0; left -= 1) {
      const now = columnsOf(tr.doc.nodeAt(pos)!, pos)
      const empty = now.map(column => isEmptyColumn(column.node)).lastIndexOf(true)
      if (empty >= 0) {
        tr.delete(now[empty].pos, now[empty].pos + now[empty].node.nodeSize)
        continue
      }
      const last = now[now.length - 1]
      const kept = now[now.length - 2]
      const moved: PMNode[] = []
      last.node.forEach(child => { if (!isEmptyText(child)) moved.push(child) })
      const own: PMNode[] = []
      kept.node.forEach(child => { if (!isEmptyText(child)) own.push(child) })
      // The last column first, so the place of the one before it stays as it is.
      tr.delete(last.pos, last.pos + last.node.nodeSize)
      tr.replaceWith(kept.pos, kept.pos + kept.node.nodeSize, kept.node.type.create(kept.node.attrs, [...own, ...moved]))
    }
  }
  withoutWidths(tr, pos)
  const $head = tr.doc.resolve(Math.min(tr.mapping.map(state.selection.head), tr.doc.content.size))
  tr.setSelection(Selection.near($head))
  return tr.setMeta(SLIDE_COMMAND, true)
}

/** The caret's column in the Columns block at `pos` (its index among the columns), or null. */
export function columnIndexAt(state: EditorState, pos: number): number | null {
  const block = blockAt(state, pos)
  if (!block || block.kind !== 'columns') return null
  const head = state.selection.head
  const index = columnsOf(block.node, pos).findIndex(column => head > column.pos && head < column.pos + column.node.nodeSize)
  return index < 0 ? null : index
}

/** Remove a column (frame 23): the column at `index` and its words go. Null at two columns (Delete block is there). */
export function removeColumn(state: EditorState, pos: number, index: number): Transaction | null {
  const block = blockAt(state, pos)
  if (!block || block.kind !== 'columns') return null
  const columns = columnsOf(block.node, pos)
  const column = columns[index]
  if (!column || columns.length <= MIN_COLUMNS) return null
  const tr = state.tr.delete(column.pos, column.pos + column.node.nodeSize)
  withoutWidths(tr, pos)
  const into = columns[index + 1] ?? columns[index - 1]
  // The column's comments are words: they stay, at the start of the column that takes the caret, as Delete keeps a
  // block's.
  const notes = notesIn(column.node)
  if (notes.length) tr.insert(tr.mapping.map(into.pos) + 1, notes)
  const start = tr.doc.resolve(tr.mapping.map(into.pos) + 1)
  tr.setSelection(Selection.findFrom(start, 1, true) ?? Selection.near(start))
  return tr.setMeta(SLIDE_COMMAND, true)
}

/** The nearest snap (⅓, ½, ⅔) to a place along the two columns, 0 to 1. */
export function snapSplit(raw: number): number {
  let best: number = SPLIT_SNAPS[0]
  for (const snap of SPLIT_SNAPS) if (Math.abs(snap - raw) < Math.abs(best - raw)) best = snap
  return best
}

/** Each column's share in percent: its `width`, or an even share. */
export function columnShares(node: PMNode): number[] {
  const columns = columnsOf(node, 0)
  return columns.map(column => columnWidthOf(divAttributesOf(column.node)) ?? 100 / columns.length)
}

/**
 * The split dragged: the line after column `line` lands at `fraction` (snapped to ⅓, ½ or ⅔) of it and the column
 * after it. Every column's share is written as its `width` (whole percents); back at an even split, none is.
 */
export function setColumnSplit(state: EditorState, pos: number, line: number, fraction: number): Transaction | null {
  const block = blockAt(state, pos)
  if (!block || block.kind !== 'columns') return null
  const columns = columnsOf(block.node, pos)
  if (line < 0 || line >= columns.length - 1) return null
  const written = splitShares(columnShares(block.node), line, fraction)
  const tr = state.tr
  columns.forEach((column, index) => {
    const open = String(column.node.attrs.open ?? '')
    const next = withFenceValue(open, 'width', written ? `${written[index]}%` : null)
    if (next !== null && next !== open) tr.setNodeMarkup(column.pos, undefined, { ...column.node.attrs, open: next })
  })
  return tr.docChanged ? tr.setMeta(SLIDE_COMMAND, true) : null
}

/**
 * The columns' shares once the line after column `line` lands at `fraction` (snapped), as `setColumnSplit` writes
 * them: whole percents, or null back at an even split (no width is written).
 */
export function splitShares(shares: readonly number[], line: number, fraction: number): number[] | null {
  const next = [...shares]
  const pair = next[line] + next[line + 1]
  const snapped = snapSplit(fraction)
  next[line] = pair * snapped
  next[line + 1] = pair * (1 - snapped)
  const even = 100 / next.length
  return next.every(share => Math.abs(share - even) < 0.5) ? null : next.map(share => Math.round(share))
}

/**
 * Where the split's guide stands while it drags (#829), on the screen: in the middle of the gap the line after column
 * `index` will have once dropped at `fraction`, where its handle then sits. The grid shares its room, the columns' span
 * from `grid.left` (the first column's left edge) to `grid.right` (the last one's right) without the gaps between them
 * (`gap`: the slide's 32 px times its fit and the stage's scale), so a third of the two columns' span is not a third of
 * their room: the guide stood a sixth of the gap off the split at ⅓ and ⅔. Every column's share is taken as the drop
 * writes it (whole percents, `splitShares`), since rounding one outside the pair moves the pair too. `shares` are the
 * columns' now (`columnShares`).
 */
export function splitGuideX(grid: { left: number; right: number }, gap: number, shares: readonly number[], index: number, fraction: number): number {
  const drawn = splitShares(shares, index, fraction) ?? shares.map(() => 1)
  const total = drawn.reduce((sum, share) => sum + share, 0)
  const room = Math.max(0, grid.right - grid.left - gap * (drawn.length - 1))
  // Shares that round to nothing (a hand-written 0.4 %) still give a place, never NaN.
  const before = drawn.slice(0, index + 1).reduce((sum, share) => sum + share, 0)
  const share = total > 0 ? before / total : (index + 1) / drawn.length
  return grid.left + share * room + gap * index + gap / 2
}

// ---------------------------------------------------------------------------
// The ⋮ drag
// ---------------------------------------------------------------------------

/** The first top-level index of the block at `index` with the comment notes right before it (they go with it). */
function withNotesBefore(doc: PMNode, index: number): number {
  let first = index
  while (first > 0 && isNote(doc.child(first - 1))) first--
  return first
}

/**
 * Where the block at top-level `index` may be dropped: the gaps between the slide's blocks (0 to the count), never
 * above the slide's title, never between a comment note and the block it is on, and never where it already is.
 */
export function dropGaps(doc: PMNode, index: number): number[] {
  const first = withNotesBefore(doc, index)
  let titleAt = 0
  while (titleAt < doc.childCount && isNote(doc.child(titleAt))) titleAt++
  const title = titleAt < doc.childCount && doc.child(titleAt).type.name === 'heading' && doc.child(titleAt).attrs.level === 1 ? titleAt + 1 : 0
  const gaps: number[] = []
  for (let gap = title; gap <= doc.childCount; gap++) {
    if (gap >= first && gap <= index + 1) continue
    if (gap > 0 && isNote(doc.child(gap - 1))) continue
    gaps.push(gap)
  }
  return gaps
}

/** Move the block at `pos` (and the notes on it) to top-level gap `gap`, the caret with it. Null where it can't go. */
export function moveBlock(state: EditorState, pos: number, gap: number): Transaction | null {
  const $pos = state.doc.resolve(pos)
  if ($pos.depth !== 0) return null
  const index = $pos.index(0)
  const node = state.doc.child(index)
  if (!dropGaps(state.doc, index).includes(gap)) return null
  const first = withNotesBefore(state.doc, index)
  let from = 0
  for (let at = 0; at < first; at++) from += state.doc.child(at).nodeSize
  const to = pos + node.nodeSize
  let target = 0
  for (let at = 0; at < gap; at++) target += state.doc.child(at).nodeSize
  const moving = state.doc.slice(from, to).content
  const head = state.selection.head
  const offset = head >= pos && head <= to ? head - pos : null
  const tr = state.tr.delete(from, to)
  const at = tr.mapping.map(target, gap > index ? -1 : 1)
  tr.insert(at, moving)
  const newPos = at + (pos - from)
  if (offset !== null) tr.setSelection(Selection.near(tr.doc.resolve(Math.min(newPos + offset, tr.doc.content.size))))
  return tr.setMeta(SLIDE_COMMAND, true)
}

// ---------------------------------------------------------------------------
// Tab across boxes and columns
// ---------------------------------------------------------------------------

/** The node types whose own Tab wins: a list item (indent), a code box (indent), a table's cell (the next cell). */
const OWN_TAB = new Set(['listItem', 'taskItem', 'codeBlock', 'tableCell', 'tableHeader'])

/**
 * Tab (1) or Shift+Tab (-1) in a box or a column: a selection at the start of the next (or previous) one; 'stay' in
 * the last (or first), so the focus stays on the slide; null where Tab isn't the bar's (a list, a code box, a table, a
 * line outside any box or column).
 */
export function tabAcross(state: EditorState, direction: 1 | -1): Transaction | 'stay' | null {
  const $head = state.selection.$head
  for (let depth = $head.depth; depth > 0; depth--) {
    const node = $head.node(depth)
    if (OWN_TAB.has(node.type.name)) return null
    const kind = divKind(node)
    if (kind !== 'box' && kind !== 'column') continue
    const parent = $head.node(depth - 1)
    const parentKind = divKind(parent)
    if ((kind === 'box' && parentKind !== 'boxes') || (kind === 'column' && parentKind !== 'columns')) return null
    const index = $head.index(depth - 1)
    const parentStart = $head.start(depth - 1)
    for (let next = index + direction; next >= 0 && next < parent.childCount; next += direction) {
      if (divKind(parent.child(next)) !== kind) continue
      let at = parentStart
      for (let child = 0; child < next; child++) at += parent.child(child).nodeSize
      const target = Selection.findFrom(state.doc.resolve(at + 1), 1, true)
      return target ? state.tr.setSelection(target).scrollIntoView() : 'stay'
    }
    return 'stay'
  }
  return null
}

// ---------------------------------------------------------------------------
// Where the handles go, and what a drag means (the stage's frame, in screen pixels)
// ---------------------------------------------------------------------------

/** A box on the screen, or in the stage's frame (its left and top from the frame's). */
export interface Box {
  left: number
  top: number
  width: number
  height: number
}

/** The handles' size on the screen: the slide scales, they don't, so they stay a pointer's size at any stage size. */
export const HANDLE_SIZE = 20

/** The ⋮ at the block's top left: just left of it where the slide has room, else over its corner, never off the slide. */
export function gripSpot(block: Box): { left: number; top: number } {
  return { left: Math.max(0, block.left - HANDLE_SIZE - 4), top: Math.max(0, block.top) }
}

/** The accent ring's line, drawn just outside the ring's box (a 2 px box-shadow). */
export const RING_LINE = 2

/** How far the ring stands off the block: 8 px from the words; a box has its own padding, so Boxes' ring sits closer. */
export function ringGap(kind: BarKind): number {
  return kind === 'boxes' ? 4 : 8
}

/**
 * The round + (the Experience lead on #773: it never covers words): on the right edge's middle of a row of boxes or
 * columns; on a list's or Steps' bottom, under its numbers or bullets (`markerX`, their middle), where the new item
 * appears, centred on the ring's bottom line (the lead's follow-up to #773), so it clears the last bullet.
 */
export function plusSpot(block: Box, kind: BarKind, markerX: number | null = null): { left: number; top: number } {
  if (kind === 'boxes' || kind === 'columns') return { left: block.left + block.width - HANDLE_SIZE / 2, top: block.top + block.height / 2 - HANDLE_SIZE / 2 }
  const x = markerX ?? block.left
  return { left: Math.max(0, x - HANDLE_SIZE / 2), top: block.top + block.height + ringGap(kind) + RING_LINE / 2 - HANDLE_SIZE / 2 }
}

/** How far under the block the bar starts: clear of a + on the ring's bottom line (lists and Steps), with a gap. */
export function barGap(kind: BarKind): number {
  return kind === 'boxes' || kind === 'columns' ? 8 : ringGap(kind) + RING_LINE / 2 + HANDLE_SIZE / 2 + 8
}

/**
 * A box's icon handle (frame 4; the lead's follow-up to #773): a handle the ⋮'s and the +'s size, centred on the box's
 * top edge, its right side 12 px of the slide in from the box's right, where the icon place was. `scale` is the
 * slide's on the screen.
 */
export function iconSpot(box: Box, scale: number): { left: number; top: number } {
  return { left: box.left + box.width - 12 * scale - HANDLE_SIZE, top: box.top - HANDLE_SIZE / 2 }
}

/**
 * The bar's left edge: under the block, inside the slide's pane (8 px from its edges, the divider included: the
 * Experience lead on #773), and on the window. Null when the bar is wider than the pane: its own group then folds.
 */
export function barLeft(blockLeft: number, width: number, pane: { left: number; right: number }, windowWidth: number): number | null {
  const min = Math.max(8, pane.left + 8)
  const max = Math.min(windowWidth - 8, pane.right - 8) - width
  if (max < min) return null
  return Math.max(min, Math.min(blockLeft, max))
}

/**
 * Where a pointer at `x` (screen) lies along two columns from `left` to `right` (screen), 0 to 1. Screen pixels are the
 * slide's times its scale on both sides of the division, so the place is the same at any stage size. Read in the two
 * columns' room, without the `gap` between them (#829), as the guide is drawn: a pointer on the guide reads its snap.
 */
export function splitPlace(x: number, left: number, right: number, gap = 0): number {
  const width = right - left - gap
  if (!(width > 0)) return 0.5
  return Math.max(0, Math.min(1, (x - left - gap / 2) / width))
}

/** The gap a pointer at `y` drops a block into: the allowed gap whose line is nearest. `lines` maps a gap to its y. */
export function nearestGap(y: number, gaps: readonly number[], lines: ReadonlyMap<number, number>): number | null {
  let best: number | null = null
  let distance = Infinity
  for (const gap of gaps) {
    const line = lines.get(gap)
    if (line === undefined) continue
    const away = Math.abs(line - y)
    if (away < distance) { distance = away; best = gap }
  }
  return best
}
