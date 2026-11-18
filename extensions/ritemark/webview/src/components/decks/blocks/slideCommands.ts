/**
 * Sprint 161 (PR 3; experience 46, frames 22, 23, 24 and 26): what the slide's own / menu and its blocks do to the
 * slide editor's document. Pure ProseMirror, so the tests drive the same steps the stage takes.
 *
 *  - **The / menu** (frame 22) in four groups: Text (Title, Heading, Bullet list, Numbered list, Code block, with their
 *    Markdown shortcuts), Blocks (Columns, Boxes, Steps, Table, and the Agenda of small details 14), Media (Picture, Web page) and Slides (New slide below, Split
 *    slide here). Web page is a link to the page, in the picture's group; no live page is drawn.
 *  - **A block** goes where the / was typed: in place of the empty line, else after the block the caret is in. Its
 *    lines are the ones the conversion writes (`:::: columns`, `::: box`, `::: steps`), so a new block saves as an AI
 *    would write it, and its empty boxes and its first empty step are kept (`slideEditorMarkdown`'s blank rule).
 *  - **Split slide here** cuts the slide at the caret: the blocks before it stay, the rest go to a new slide below. A
 *    comment on a block goes with its block.
 *  - **A box's icon and the Steps pill** are one value each on the block's opening line (`withFenceValue`): changing one
 *    rewrites that line only.
 *  - **A table** in a slide: Enter moves to the cell below (a new row under the last), as Tab moves to the next cell.
 *    Its rows and columns are changed with the table's own handles (`extensions/tables/`), as in a Text document.
 *
 * Every change made here carries `SLIDE_COMMAND`: the stage writes it to the deck as an undo step of its own, so one
 * Undo takes the block (or the icon, or the row) back and leaves the words typed before it.
 */
import type { Node as PMNode, Schema } from '@tiptap/pm/model'
import { TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state'
import { canSplit } from '@tiptap/pm/transform'
import { TableMap, addRow, cellAround } from '@tiptap/pm/tables'
import { TABLE_COMMAND } from '../../../extensions/tables/tableOps'
import { SLIDE_COMMAND, placeBlock } from '../../../extensions/blockPlacement'
import { BULLET_LIST_KEYWORDS, BUTTON_KEYWORDS, CODE_BLOCK_KEYWORDS, NUMBERED_LIST_KEYWORDS, PICTURE_KEYWORDS, TABLE_KEYWORDS, TABS_KEYWORDS, type BlockItemDef } from '../../../extensions/blockItems'
import { OPEN_FENCE, parseFenceAttributes, withFenceValue } from '../../../../../src/decks/blocks/fencedDiv'
import { EXERCISE_TAG } from '../../../../../src/decks/deckFormat'
import { stepsTagOf } from '../../../../../src/decks/blocks/slideRenderer'
import { AGENDA_CLOSE, AGENDA_OPEN } from '../../../../../src/decks/blocks/agenda'
import { canHoldTabs } from '../../../extensions/tabs/tabsCommands'

/** Meta on a slide editor transaction that the stage writes to the deck as an undo step of its own (`blockPlacement`). */
export { SLIDE_COMMAND }

/** Is a slide editor transaction an undo step of its own: a block, an icon, a row, or a table's handles (experience 48)? */
export function isOwnStep(tr: Transaction): boolean {
  return tr.getMeta(SLIDE_COMMAND) === true || tr.getMeta(TABLE_COMMAND) === true
}

/** The slide's / menu (frame 22), in its groups, with the shortcuts the design shows and its hidden search words (18 November). */
export const SLIDE_ITEMS: BlockItemDef[] = [
  { group: 'Text', title: 'Title', description: '', icon: 'text-h-one', nodeType: 'heading', attrs: { level: 1 }, shortcut: '#', keywords: ['h1', 'heading 1', 'pealkiri'] },
  { group: 'Text', title: 'Heading', description: '', icon: 'text-h-two', nodeType: 'heading', attrs: { level: 2 }, shortcut: '##', keywords: ['h2', 'subheading', 'alapealkiri'] },
  { group: 'Text', title: 'Bullet list', description: '', icon: 'list', nodeType: 'bulletList', shortcut: '-', keywords: BULLET_LIST_KEYWORDS },
  { group: 'Text', title: 'Numbered list', description: '', icon: 'list-numbers', nodeType: 'orderedList', shortcut: '1.', keywords: NUMBERED_LIST_KEYWORDS },
  // Sprint 163 PR 1: prompts live on the slide, each in a code block with its own Copy (the decks README).
  { group: 'Text', title: 'Code block', description: '', icon: 'code', nodeType: 'codeBlock', shortcut: '```', keywords: CODE_BLOCK_KEYWORDS },
  { group: 'Blocks', title: 'Columns', description: '', icon: 'columns', nodeType: 'columns', keywords: ['column', 'cols', 'two columns', 'layout', 'veerud', 'veerg'] },
  { group: 'Blocks', title: 'Boxes', description: '', icon: 'squares-four', nodeType: 'boxes', keywords: ['cards', 'tiles', 'grid', 'kastid', 'kaardid'] },
  { group: 'Blocks', title: 'Steps', description: '', icon: 'list-checks', nodeType: 'steps', keywords: ['process', 'timeline', 'flow', 'sammud', 'protsess'] },
  { group: 'Blocks', title: 'Table', description: '', icon: 'table', nodeType: 'table', keywords: TABLE_KEYWORDS },
  // Sprint 163: tabs, each pane ordinary blocks (decks README "Tabs in the editor").
  { group: 'Blocks', title: 'Tabs', description: '', icon: 'tabs', nodeType: 'tabs', keywords: TABS_KEYWORDS },
  // Sprint 163 PR 3: a button that opens a full address in a new tab (the decks README, "The Button block").
  { group: 'Blocks', title: 'Button', description: '', icon: 'cursor-click', nodeType: 'button', keywords: BUTTON_KEYWORDS },
  // Small details 14: the deck's section slides, listed and numbered by themselves.
  { group: 'Blocks', title: 'Agenda', description: '', icon: 'calendar', nodeType: 'agenda', keywords: ['contents', 'toc', 'sisukord', 'päevakava'] },
  { group: 'Media', title: 'Picture', description: '', icon: 'image', nodeType: 'picture', keywords: PICTURE_KEYWORDS },
  { group: 'Media', title: 'Web page', description: '', icon: 'globe', nodeType: 'webPage', keywords: ['link', 'url', 'website', 'embed', 'veebileht'] },
  { group: 'Slides', title: 'New slide below', description: '', icon: 'plus-square', nodeType: 'newSlideBelow', keywords: ['slide', 'new slide', 'page', 'uus slaid'] },
  { group: 'Slides', title: 'Split slide here', description: '', icon: 'scissors', nodeType: 'splitSlide', shortcut: '***', keywords: ['split', 'break', 'divide', 'poolita', 'jaga'] },
]

/** The slide's own items, which a tab's pane never offers (README "In the pane"): the title and the slides' items. */
const NOT_IN_A_PANE = new Set(['agenda', 'newSlideBelow', 'splitSlide', 'tabs'])

/**
 * Sprint 163: the slide's / menu where the caret is. In a tab's pane, never Tabs, the Title or the slide's own items;
 * in a box, Steps or a table cell, never Tabs (`canHoldTabs`).
 */
export function slideItemsAt(state: EditorState): BlockItemDef[] {
  const inPane = (() => {
    const $from = state.selection.$from
    for (let depth = $from.depth; depth > 0; depth--) if ($from.node(depth).type.name === 'tabPane') return true
    return false
  })()
  if (inPane) return SLIDE_ITEMS.filter(item => !NOT_IN_A_PANE.has(item.nodeType) && !(item.nodeType === 'heading' && item.attrs?.level === 1))
  return canHoldTabs(state) ? SLIDE_ITEMS : SLIDE_ITEMS.filter(item => item.nodeType !== 'tabs')
}

export type SlideBlockKind = 'columns' | 'boxes' | 'steps' | 'table'

/** A `:::` block with its lines, as the slide editor loads one (`slideDiv`'s attributes). */
export const slideDivNode = (schema: Schema, open: string, close: string, content: PMNode[]) =>
  schema.nodes.slideDiv.create({ open, close, gapOpen: 'false', gapClose: 'false', class: parseFenceAttributes(OPEN_FENCE.exec(open)![2])!.classes.join(' ') }, content)

/** A new block, empty, as the conversion writes one: two columns, three boxes, Steps with one step, a 3 × 3 table. */
export function slideBlockNode(schema: Schema, kind: SlideBlockKind, tag: string | null = null): PMNode {
  const paragraph = () => schema.nodes.paragraph.create()
  switch (kind) {
    case 'columns':
      // Each column an empty heading over an empty line: "Heading" over "Text" faint, nothing written (the lead on #769).
      return slideDivNode(schema, ':::: columns', '::::', [0, 1].map(() => slideDivNode(schema, '::: column', ':::', [schema.nodes.heading.create({ level: 3 }), paragraph()])))
    case 'boxes':
      return slideDivNode(schema, ':::: boxes', '::::', [0, 1, 2].map(() => slideDivNode(schema, '::: box', ':::', [paragraph()])))
    case 'steps':
      // A label carried from the deck's earlier pill is written as its own tag (the lead on #769).
      return slideDivNode(schema, tag === null ? '::: steps' : withFenceValue('::: steps', 'tag', tag)!, ':::', [schema.nodes.orderedList.create(null, [schema.nodes.listItem.create(null, [paragraph()])])])
    case 'table': {
      const row = (header: boolean) => schema.nodes.tableRow.create(null, [0, 1, 2].map(() => (header ? schema.nodes.tableHeader : schema.nodes.tableCell).create(null, [paragraph()])))
      return schema.nodes.table.create(null, [row(true), row(false), row(false)])
    }
  }
}

/**
 * Put `node` where the / was (`at`, after its text is taken out): in place of the empty line it stood on, else after
 * the block the caret is in, at the first level that can hold it. The caret goes into the new block's first line.
 * An empty heading (the slide's title waiting for its words) is never replaced: the block goes after it. Nothing goes
 * inside a table: a Markdown table's cell holds one line, so the block goes after the table (review of #769).
 */
export function insertSlideBlock(tr: Transaction, at: number, node: PMNode): Transaction {
  const placed = placeBlock(tr, at, node)
  if (placed < 0) return tr
  tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(placed + 1, tr.doc.content.size))))
  return tr.setMeta(SLIDE_COMMAND, true).scrollIntoView()
}

/** The Agenda (small details 14): `::: agenda` and `:::`, its list drawn from the deck's sections, never written. */
export function agendaNode(schema: Schema): PMNode {
  return schema.nodes.slideAgenda.create({ raw: `${AGENDA_OPEN}\n${AGENDA_CLOSE}` })
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

/**
 * Split slide here from the / menu: the empty line the / stood on is the place of the cut, not a line of either half
 * (the app run: an empty list item was left at the first half's end). The state without it, and the place mapped;
 * the state as it was when the caret's line has words.
 */
export function withoutEmptyLineAt(state: EditorState, pos: number): { state: EditorState; pos: number } {
  const $pos = state.doc.resolve(pos)
  if ($pos.depth === 0 || !$pos.parent.isTextblock || $pos.parent.content.size > 0 || $pos.parent.type.name === 'heading') return { state, pos }
  let depth = $pos.depth
  // The list item that holds only this line, and the list when it is its only item.
  if (depth >= 2 && $pos.node(depth - 1).type.name === 'listItem' && $pos.node(depth - 1).childCount === 1) {
    depth -= 1
    if (depth >= 2 && $pos.node(depth - 1).childCount === 1) depth -= 1
  }
  // Never the only block of its parent (a column keeps its line).
  if ($pos.node(depth - 1).childCount < 2) return { state, pos }
  const tr = state.tr.delete($pos.before(depth), $pos.after(depth))
  return { state: state.apply(tr), pos: tr.mapping.map(pos, -1) }
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

/**
 * The label a new Steps block takes (the Experience lead on #769): the deck's last pill label written in words of its
 * own, up to and including the slide being written on (a v1 Exercise slide's `tag:`, a block slide's Steps `tag`);
 * null when there is none, so the new pill shows "Exercise" by #752's rule. An emptied (hidden) pill and the default
 * word are no label to carry.
 */
export function lastPillLabel(slides: Array<{ kind: string; markdown?: string; tag?: string }>): string | null {
  let label: string | null = null
  const take = (tag: string | undefined) => {
    if (tag === undefined || !tag.trim() || tag.trim().toLowerCase() === EXERCISE_TAG.toLowerCase()) return
    label = tag
  }
  for (const slide of slides) {
    if (slide.kind === 'exercise') { take(slide.tag); continue }
    if (slide.kind !== '' || !slide.markdown) continue
    let code: string | null = null
    for (const line of slide.markdown.split('\n')) {
      // A `:::` line inside a code block is the code's words.
      const fence = /^ {0,3}(`{3,}|~{3,})/.exec(line)
      if (code !== null) { if (fence && fence[1][0] === code[0] && fence[1].length >= code.length) code = null; continue }
      if (fence) { code = fence[1]; continue }
      const open = OPEN_FENCE.exec(line)
      const attrs = open ? parseFenceAttributes(open[2]) : null
      if (attrs?.classes.includes('steps')) take(attrs.values.tag)
    }
  }
  return label
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
    // A new row is an undo step of its own, as the table's + bar makes one (Codex on #769).
    tr.setMeta(SLIDE_COMMAND, true)
    tableNode = tr.doc.nodeAt(tableStart - 1)!
    tableMap = TableMap.get(tableNode)
  }
  const cellPos = tableStart + tableMap.map[rect.bottom * tableMap.width + rect.left]
  tr.setSelection(TextSelection.near(tr.doc.resolve(cellPos + 1)))
  return tr.scrollIntoView()
}
