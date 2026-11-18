/**
 * Sprint 163 (PR 2; decks README "Tabs in the editor"): what the Tabs block's band, its tab menu and its bar do to an
 * editor's document. Pure ProseMirror, so the tests drive the same steps the editors take, and every change carries
 * `SLIDE_COMMAND` (the slide's stage writes it to the deck as an undo step of its own; the Text editor's history keeps
 * it as one step too).
 *
 *  - **A new block** has "Tab 1" and "Tab 2"; **a new tab** is "Tab n" at the end. Both open with the name chosen, so
 *    typing names it (the band reads `pendingRename`).
 *  - **Rename** writes the tab's heading line again (its level kept); an empty name or the same one writes nothing.
 *  - **Duplicate** puts a copy after it ("Plan copy"), **Move left / right** and a drag move it.
 *  - **Delete tab** takes the tab and its pane without asking (⌘Z brings them back). When one tab is left, the block
 *    dissolves: that tab's blocks stay where the block was, as ordinary blocks ("no tabs, no block").
 *  - **Columns ⇄ Tabs** (the type menu): each column becomes a tab, its heading the tab's name and the rest its pane;
 *    each tab a column, its name the column's heading. One step; ⌘Z undoes it.
 */
import { Fragment, Slice, type Node as PMNode, type Schema } from '@tiptap/pm/model'
import { Selection, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { OPEN_FENCE, parseFenceAttributes, slideBlockClassOf } from '../../../../src/decks/blocks/fencedDiv'
import { PANE_PLACEHOLDER, TAB_LEVEL, TABSET_CLOSE, TABSET_OPEN, newTabName, renamedTabLine, tabHeadingLine } from '../../../../src/decks/blocks/tabset'
import { hasMisplacedTabs, tabNameOf, tabsLevelOf } from './tabsMarkdown'

export { hasMisplacedTabs }

/** The slide's own-undo-step meta (`slideCommands.SLIDE_COMMAND`), named here so the Text editor needs no deck code. */
export const TABS_STEP_META = 'deckSlideCommand'

/**
 * A tab whose name is chosen for typing as soon as its band draws (a new block's first tab, a new tab): set by the
 * change that makes it, read once by the block's band. Kept per editor view, by the block's place after the change.
 */
const pendingRenames = new WeakMap<EditorView | object, { pos: number; index: number }>()

export function setPendingRename(view: EditorView | object, pos: number, index: number): void {
  pendingRenames.set(view, { pos, index })
}

/** The tab to rename now in the block at `pos`, once: the band asks as it draws. */
export function takePendingRename(view: EditorView | object, pos: number): number | null {
  const pending = pendingRenames.get(view)
  if (!pending || pending.pos !== pos) return null
  pendingRenames.delete(view)
  return pending.index
}

const step = (tr: Transaction) => tr.setMeta(TABS_STEP_META, true)

/** One tab's pane, its heading line `line`, holding `content` (an empty line when it has none). */
export function tabPaneNode(schema: Schema, line: string, content: readonly PMNode[] = [], attrs: Record<string, unknown> = {}): PMNode {
  const blocks = content.length ? Fragment.from(content as PMNode[]) : Fragment.from(schema.nodes.paragraph.create())
  return schema.nodes.tabPane.create({ gap: 'true', mdTight: null, ...attrs, line }, blocks)
}

/** A new Tabs block: "Tab 1" and "Tab 2" (or `names`), their panes empty, written as Quarto writes a tabset. */
export function tabsBlockNode(schema: Schema, names: readonly string[] = [newTabName(0), newTabName(1)], contents: ReadonlyArray<readonly PMNode[]> = []): PMNode {
  const panes = names.map((name, index) => tabPaneNode(schema, tabHeadingLine(TAB_LEVEL, name), contents[index] ?? []))
  return schema.nodes.tabsBlock.create({ open: TABSET_OPEN, close: TABSET_CLOSE, gapOpen: 'false', gapClose: 'true', mdTight: null }, panes)
}

/** The Tabs block at `pos`, or null. */
function tabsAt(state: EditorState, pos: number): PMNode | null {
  const node = state.doc.nodeAt(pos)
  return node && node.type.name === 'tabsBlock' ? node : null
}

/** Where pane `index` of the block at `pos` starts (its own position). */
export function panePos(block: PMNode, pos: number, index: number): number {
  let at = pos + 1
  for (let child = 0; child < index && child < block.childCount; child++) at += block.child(child).nodeSize
  return at
}

/**
 * The first place in pane `index` of the block at `pos` for the caret: its first line, or its first block when that is
 * a picture (selected whole). Never a place in another pane: the caret there would open that tab instead.
 */
export function paneSelection(doc: PMNode, pos: number, index: number): Selection | null {
  const block = doc.nodeAt(pos)
  if (!block || block.type.name !== 'tabsBlock' || !block.childCount) return null
  const at = Math.max(0, Math.min(index, block.childCount - 1))
  const start = panePos(block, pos, at)
  const end = start + block.child(at).nodeSize
  const found = Selection.findFrom(doc.resolve(start + 1), 1)
  return found && found.from > start && found.to < end ? found : null
}

/** The caret at the start of pane `index`. */
function intoPane(tr: Transaction, pos: number, index: number): Transaction {
  const selection = paneSelection(tr.doc, pos, index)
  return selection ? tr.setSelection(selection) : tr
}

/** The innermost Tabs block holding a change's selection (a block just put in), by its place; null outside one. */
export function tabsPosAtSelection(tr: Transaction): number | null {
  const $head = tr.selection.$head
  for (let depth = $head.depth; depth > 0; depth--) if ($head.node(depth).type.name === 'tabsBlock') return $head.before(depth)
  return null
}

/** The innermost Tabs block holding the selection, with its place and the pane the caret is in; null outside one. */
export function tabsAround(state: EditorState): { pos: number; node: PMNode; index: number; depth: number } | null {
  const $head = state.selection.$head
  for (let depth = $head.depth; depth > 0; depth--) {
    const node = $head.node(depth)
    if (node.type.name === 'tabsBlock') return { pos: $head.before(depth), node, index: depth < $head.depth ? $head.index(depth) : 0, depth }
  }
  return null
}

/**
 * Where a new Tabs block may go (README "Adding it"): anywhere a block goes, but never inside another Tabs block, a box,
 * a Steps block or a table cell. The / menu leaves Tabs out there.
 */
export function canHoldTabs(state: EditorState): boolean {
  const $from = state.selection.$from
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth)
    const name = node.type.name
    if (name === 'tabsBlock' || name === 'tabPane' || name === 'tableCell' || name === 'tableHeader') return false
    if (name === 'slideDiv') {
      const open = OPEN_FENCE.exec(String(node.attrs.open ?? ''))
      const attrs = open ? parseFenceAttributes(open[2]) : null
      const kind = attrs ? slideBlockClassOf(attrs) : null
      if (kind === 'box' || kind === 'boxes' || kind === 'steps') return false
    }
  }
  return true
}

/**
 * A new Tabs block where the / was (the Text editor's): in place of the empty line it stood on, else after the block the
 * caret is in. Its first name is chosen for typing (`view`'s pending name). The slide's stage puts blocks its own way
 * (`insertSlideBlock`).
 */
export function insertTabsBlock(tr: Transaction, at: number, view: EditorView | object | null): Transaction {
  const node = tabsBlockNode(tr.doc.type.schema)
  const $pos = tr.doc.resolve(Math.max(0, Math.min(at, tr.doc.content.size)))
  let placed = -1
  if ($pos.depth > 0 && $pos.parent.type.name === 'paragraph' && $pos.parent.content.size === 0) {
    const holder = $pos.node($pos.depth - 1)
    const index = $pos.index($pos.depth - 1)
    if (holder.canReplaceWith(index, index + 1, node.type)) {
      placed = $pos.before()
      tr.replaceWith(placed, $pos.after(), node)
    }
  }
  // A place between the top level's blocks (the block menu's +).
  if (placed < 0 && $pos.depth === 0 && tr.doc.canReplaceWith($pos.index(0), $pos.index(0), node.type)) {
    placed = $pos.pos
    tr.insert(placed, node)
  }
  for (let depth = $pos.depth - 1; placed < 0 && depth >= 0; depth--) {
    const index = $pos.index(depth) + 1
    if (!$pos.node(depth).canReplaceWith(index, index, node.type)) continue
    placed = $pos.after(depth + 1)
    tr.insert(placed, node)
  }
  if (placed < 0) return tr
  tr.setSelection(TextSelection.near(tr.doc.resolve(placed + 2)))
  if (view) setPendingRename(view, placed, 0)
  return step(tr).scrollIntoView()
}

/** An empty tab's pane's faint words (README "Adding it"), for its only empty line; null for any other line. */
export function tabPanePlaceholderOf(node: PMNode, parent: PMNode | null): string | null {
  if (parent?.type.name !== 'tabPane') return null
  return node.type.name === 'paragraph' && parent.childCount === 1 ? PANE_PLACEHOLDER : ''
}

/** Add (the band's +, the bar's Add): a tab at the end, "Tab n", opened, its name chosen. */
export function addTab(state: EditorState, pos: number): { tr: Transaction; index: number } | null {
  const block = tabsAt(state, pos)
  if (!block) return null
  const level = tabsLevelOf(block)
  const taken = new Set<string>()
  block.forEach(pane => taken.add(tabNameOf(pane.attrs.line)))
  let number = block.childCount
  while (taken.has(newTabName(number))) number++
  const tr = state.tr.insert(pos + block.nodeSize - 1, tabPaneNode(state.schema, tabHeadingLine(level, newTabName(number))))
  intoPane(tr, pos, block.childCount)
  return { tr: step(tr), index: block.childCount }
}

/** Rename tab `index`: its heading line written again with `name`. Null for an empty name or the same one. */
export function renameTab(state: EditorState, pos: number, index: number, name: string): Transaction | null {
  const block = tabsAt(state, pos)
  const words = name.replace(/\s+/g, ' ').trim()
  if (!block || index < 0 || index >= block.childCount || !words) return null
  const pane = block.child(index)
  const line = String(pane.attrs.line ?? '')
  if (tabNameOf(line) === words) return null
  return step(state.tr.setNodeMarkup(panePos(block, pos, index), undefined, { ...pane.attrs, line: renamedTabLine(line, words) }))
}

/** Duplicate tab `index`: a copy right after it, "<name> copy", opened. */
export function duplicateTab(state: EditorState, pos: number, index: number): Transaction | null {
  const block = tabsAt(state, pos)
  if (!block || index < 0 || index >= block.childCount) return null
  const pane = block.child(index)
  const copy = state.schema.nodes.tabPane.create({ ...pane.attrs, mdTight: null, line: renamedTabLine(String(pane.attrs.line ?? ''), `${tabNameOf(pane.attrs.line)} copy`) }, pane.content)
  const tr = state.tr.insert(panePos(block, pos, index + 1), copy)
  return step(intoPane(tr, pos, index + 1))
}

/** Move tab `from` to place `to` (a drag, Move left, Move right): its pane goes with it, and it stays open. */
export function moveTab(state: EditorState, pos: number, from: number, to: number): Transaction | null {
  const block = tabsAt(state, pos)
  if (!block || from === to || from < 0 || to < 0 || from >= block.childCount || to >= block.childCount) return null
  const panes: PMNode[] = []
  block.forEach(pane => panes.push(pane))
  const [moved] = panes.splice(from, 1)
  panes.splice(to, 0, moved)
  // Where each one stood as written belongs to that place: a moved block is written the canonical way.
  const written = panes.map(pane => (pane.attrs.mdTight ? pane.type.create({ ...pane.attrs, mdTight: null }, pane.content) : pane))
  const tr = state.tr.replaceWith(pos + 1, pos + block.nodeSize - 1, written)
  return step(intoPane(tr, pos, to))
}

/**
 * Delete tab `index`, without asking (⌘Z brings it back). The tab after it opens (the one before it at the end). With
 * one tab left, the block dissolves: that tab's blocks stay where the block was.
 */
export function deleteTab(state: EditorState, pos: number, index: number): Transaction | null {
  const block = tabsAt(state, pos)
  if (!block || index < 0 || index >= block.childCount) return null
  if (block.childCount === 1) return dissolveTabs(state, pos, 0)
  if (block.childCount === 2) {
    const left = block.child(index === 0 ? 1 : 0)
    const tr = state.tr.replaceWith(pos, pos + block.nodeSize, left.content)
    tr.setSelection(Selection.findFrom(tr.doc.resolve(Math.min(pos + 1, tr.doc.content.size)), 1, true) ?? Selection.near(tr.doc.resolve(Math.min(pos, tr.doc.content.size))))
    return step(tr)
  }
  const at = panePos(block, pos, index)
  const tr = state.tr.delete(at, at + block.child(index).nodeSize)
  return step(intoPane(tr, pos, Math.min(index, block.childCount - 2)))
}

/** The block taken away, tab `index`'s blocks left where it was. */
export function dissolveTabs(state: EditorState, pos: number, index: number): Transaction | null {
  const block = tabsAt(state, pos)
  if (!block || index < 0 || index >= block.childCount) return null
  const tr = state.tr.replaceWith(pos, pos + block.nodeSize, block.child(index).content)
  tr.setSelection(Selection.findFrom(tr.doc.resolve(Math.min(pos + 1, tr.doc.content.size)), 1, true) ?? Selection.near(tr.doc.resolve(Math.min(pos, tr.doc.content.size))))
  return step(tr)
}

// ---------------------------------------------------------------------------
// Columns ⇄ Tabs (the type menu)
// ---------------------------------------------------------------------------

const isEmptyText = (node: PMNode) => node.isTextblock && node.content.size === 0

function divClass(node: PMNode): string | null {
  if (node.type.name !== 'slideDiv') return null
  const open = OPEN_FENCE.exec(String(node.attrs.open ?? ''))
  const attrs = open ? parseFenceAttributes(open[2]) : null
  return attrs ? slideBlockClassOf(attrs) : null
}

/** Is this a Columns block whose children are all columns (comment notes aside)? */
export function isColumnsBlock(node: PMNode): boolean {
  if (divClass(node) !== 'columns') return false
  let other = false
  node.forEach(child => { if (child.type.name !== 'commentNode' && divClass(child) !== 'column') other = true })
  return !other
}

/** Which item of a Columns or Tabs block the caret is in (a column, a tab), or 0. */
function itemOfCaret(state: EditorState, pos: number): number {
  const $head = state.selection.$head
  for (let depth = $head.depth; depth > 0; depth--) {
    if ($head.before(depth) === pos && depth < $head.depth) {
      let index = $head.index(depth)
      const node = $head.node(depth)
      for (let at = 0; at < $head.index(depth); at++) if (node.child(at).type.name === 'commentNode') index--
      return Math.max(0, index)
    }
  }
  return 0
}

/**
 * Columns → Tabs: each column a tab, its heading (its first block) the tab's name and the rest its pane; a column with no
 * heading is "Tab n". A comment note between columns goes with the column after it. The caret stays in its item.
 */
export function columnsToTabs(state: EditorState, pos: number): Transaction | null {
  const block = state.doc.nodeAt(pos)
  if (!block || !isColumnsBlock(block) || !state.schema.nodes.tabsBlock) return null
  const schema = state.schema
  const names: string[] = []
  const contents: PMNode[][] = []
  let notes: PMNode[] = []
  block.forEach(child => {
    if (child.type.name === 'commentNode') { notes.push(child); return }
    const blocks: PMNode[] = []
    child.forEach(inner => blocks.push(inner))
    const head = blocks[0]
    const name = head && head.type.name === 'heading' && head.textContent.trim() ? head.textContent.replace(/\s+/g, ' ').trim() : ''
    names.push(name || newTabName(names.length))
    contents.push([...notes, ...(name ? blocks.slice(1) : blocks).filter(node => !isEmptyText(node))])
    notes = []
  })
  if (!names.length) return null
  if (notes.length) contents[contents.length - 1].push(...notes)
  const made = tabsBlockNode(schema, names, contents)
  const item = itemOfCaret(state, pos)
  const tr = state.tr.replaceWith(pos, pos + block.nodeSize, made)
  return step(intoPane(tr, pos, Math.min(item, names.length - 1)))
}

/** Tabs → Columns: each tab a column, its name the column's heading (an H3, as a column's) and its pane the rest. */
export function tabsToColumns(state: EditorState, pos: number): Transaction | null {
  const block = tabsAt(state, pos)
  const slideDiv = state.schema.nodes.slideDiv
  if (!block || !slideDiv) return null
  const schema = state.schema
  const columns: PMNode[] = []
  block.forEach(pane => {
    const content: PMNode[] = [schema.nodes.heading.create({ level: 3 }, tabNameOf(pane.attrs.line) ? schema.text(tabNameOf(pane.attrs.line)) : null)]
    pane.forEach(child => { if (!isEmptyText(child)) content.push(child) })
    if (content.length === 1) content.push(schema.nodes.paragraph.create())
    columns.push(slideDiv.create({ open: '::: column', close: ':::', gapOpen: 'false', gapClose: 'false', class: 'column' }, content))
  })
  const made = slideDiv.create({ open: ':::: columns', close: '::::', gapOpen: 'false', gapClose: 'false', class: 'columns' }, columns)
  const item = itemOfCaret(state, pos)
  const tr = state.tr.replaceWith(pos, pos + block.nodeSize, made)
  // The caret in the same item: the column's first line after its heading.
  const columnsNode = tr.doc.nodeAt(pos)
  if (columnsNode) {
    let at = pos + 1
    for (let child = 0; child < Math.min(item, columnsNode.childCount - 1); child++) at += columnsNode.child(child).nodeSize
    tr.setSelection(TextSelection.near(tr.doc.resolve(at + 2)))
  }
  return step(tr)
}

/**
 * A pasted Tabs block where none may go (inside another, a box, Steps or a table cell): its tabs' blocks, each tab's name
 * as a line of its own over them, so nothing pasted is lost and no tab stands inside another.
 */
export function flattenTabs(schema: Schema, content: Fragment): Fragment {
  return flattenTabsIn(schema, content)
}

/** A pasted slice where no Tabs block may go: flattened, and closed at both ends when that changed its depth. */
export function pastedWithoutTabs(schema: Schema, slice: Slice): Slice {
  const content = flattenTabsIn(schema, slice.content)
  return content === slice.content ? slice : new Slice(content, 0, 0)
}

function flattenTabsIn(schema: Schema, content: Fragment): Fragment {
  const out: PMNode[] = []
  let changed = false
  content.forEach(node => {
    if (node.type.name === 'tabsBlock') {
      changed = true
      node.forEach(pane => {
        const name = tabNameOf(pane.attrs.line)
        if (name) out.push(schema.nodes.paragraph.create(null, schema.text(name, schema.marks.bold ? [schema.marks.bold.create()] : [])))
        pane.forEach(child => out.push(child))
      })
      return
    }
    if (node.isLeaf || node.isTextblock) { out.push(node); return }
    const inner = flattenTabsIn(schema, node.content)
    if (inner !== node.content) { changed = true; out.push(node.copy(inner)) } else out.push(node)
  })
  return changed ? Fragment.from(out) : content
}
