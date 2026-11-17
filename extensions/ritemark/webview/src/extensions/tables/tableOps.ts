/**
 * Tables you can change (experience 48): what the table's grips, menus, + bars and keys do, as plain functions from an
 * editor state to one transaction (or null when there's nothing to do). The Text editor and the slide editor run the
 * same functions, on prosemirror-tables' `TableMap`, `moveTableRow` and `moveTableColumn`.
 *
 * A Markdown table is a grid with one header row, an alignment per column and no merged cells, so these operations
 * keep it one:
 *  - the first row is the header: it is never moved or deleted, and nothing is moved above it. "Insert above" on it
 *    makes a new, empty header and the old header the first body row;
 *  - a column's alignment is on every cell of it (`mdAlign`) and on the table's delimiter row as written (`mdDelims`,
 *    `markdownAsWritten.ts`), which the save writes while it has as many cells as the table has columns. Every column
 *    operation updates both, so the delimiter row keeps how it was written for the columns it didn't touch;
 *  - sorting reorders the body rows only.
 *
 * Every transaction is an undo step of its own (`closeHistory`) and carries `TABLE_COMMAND`, so the slide editor writes
 * it as one too.
 */
import type { Node as PMNode, ResolvedPos } from '@tiptap/pm/model'
import { type EditorState, Plugin, PluginKey, Selection, TextSelection, type Transaction } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { closeHistory } from '@tiptap/pm/history'
import { CellSelection, TableMap, moveTableColumn, moveTableRow } from '@tiptap/pm/tables'
import { automaticUnits, delimiterCellOf, delimiterRowWithWidths, snapPercents, widthsOf } from '../../../../src/markdown/tableWidths'

/** On every table transaction: one undo step, written by the slide editor as one. */
export const TABLE_COMMAND = 'rmTableCommand'

export type ColumnAlign = 'left' | 'center' | 'right' | null

/** A table in the document: its position (before the node) and the node. */
export interface TableAt {
  pos: number
  node: PMNode
}

/** A cell of a table: the table, the cell's row and column. */
export interface CellAt extends TableAt {
  row: number
  col: number
}

export function tableAt(doc: PMNode, pos: number): TableAt | null {
  const node = pos >= 0 && pos < doc.content.size ? doc.nodeAt(pos) : null
  return node && node.type.spec.tableRole === 'table' ? { pos, node } : null
}

/** The cell a position is in, with its table, row and column; null outside a table. */
export function cellAtPos($pos: ResolvedPos): CellAt | null {
  for (let depth = $pos.depth; depth > 0; depth--) {
    if ($pos.node(depth).type.spec.tableRole === 'cell' || $pos.node(depth).type.spec.tableRole === 'header_cell') {
      const table = $pos.node(depth - 2)
      if (!table || table.type.spec.tableRole !== 'table') return null
      const tableStart = $pos.start(depth - 2)
      const map = TableMap.get(table)
      const rect = map.findCell($pos.before(depth) - tableStart)
      return { pos: tableStart - 1, node: table, row: rect.top, col: rect.left }
    }
  }
  return null
}

/** The cell the selection is in (a cell selection's head cell). */
export function cellAtSelection(state: EditorState): CellAt | null {
  const selection = state.selection
  if (selection instanceof CellSelection) return cellAtPos(state.doc.resolve(selection.$headCell.pos + 1))
  return cellAtPos(selection.$head)
}

/** Is the table's whole content chosen: every cell in a cell selection, or the table as a node? */
export function wholeTableChosen(state: EditorState): TableAt | null {
  const selection = state.selection
  if (selection instanceof CellSelection && selection.isColSelection() && selection.isRowSelection()) {
    const cell = cellAtPos(state.doc.resolve(selection.$anchorCell.pos + 1))
    return cell ? { pos: cell.pos, node: cell.node } : null
  }
  const node = (selection as Selection & { node?: PMNode }).node
  if (node && node.type.spec.tableRole === 'table') return { pos: selection.from, node }
  return null
}

function size(table: PMNode): { width: number; height: number; map: TableMap } {
  const map = TableMap.get(table)
  return { width: map.width, height: map.height, map }
}

/** The document position of a cell (before it) in the table at `tablePos` of `doc`. */
export function cellPos(doc: PMNode, tablePos: number, row: number, col: number): number | null {
  const table = doc.nodeAt(tablePos)
  if (!table) return null
  const { map, width, height } = size(table)
  if (row < 0 || col < 0 || row >= height || col >= width) return null
  return tablePos + 1 + map.map[row * width + col]
}

/** The caret at the start of a cell's words. */
function caretIn(tr: Transaction, tablePos: number, row: number, col: number): Transaction {
  const at = cellPos(tr.doc, tablePos, row, col)
  if (at !== null) tr.setSelection(TextSelection.near(tr.doc.resolve(at + 1)))
  return tr
}

function finish(tr: Transaction): Transaction {
  closeHistory(tr)
  tr.setMeta(TABLE_COMMAND, true)
  return tr.scrollIntoView()
}

/** A column's alignment, read from its header cell. */
export function columnAlign(table: PMNode, col: number): ColumnAlign {
  const header = table.firstChild?.maybeChild(col)
  const align = header?.attrs.mdAlign
  return align === 'left' || align === 'center' || align === 'right' ? align : null
}

// ---------------------------------------------------------------------------
// The delimiter row as written
// ---------------------------------------------------------------------------

const DELIM_CELL = /^(\s*)(:?-+:?)(\s*)$/

/** The delimiter row's cells as written (`| :-- | --: |` → `[' :-- ', ' --: ']`); null when there is none to keep. */
export function delimiterCells(delims: unknown, columns: number): string[] | null {
  if (typeof delims !== 'string' || !delims.startsWith('|') || !delims.endsWith('|') || delims.length < 2) return null
  const cells = delims.slice(1, -1).split('|')
  return cells.length === columns && cells.every(cell => DELIM_CELL.test(cell)) ? cells : null
}

/** The marker GFM writes for an alignment. */
export function alignMarker(align: ColumnAlign): string {
  return delimiterCellOf(automaticUnits(align), align)
}

/** A delimiter cell's run (its dashes and colons): the column's width in a table with widths. */
function runOf(cell: string): number {
  return cell.trim().length
}

/** A new column's delimiter cell, `---`, its spacing as the cell beside it had it. */
function newDelimiterCell(like: string | undefined): string {
  return delimiterCellOf(automaticUnits(null), null, like)
}

/**
 * The table's delimiter row after a column change, written as it was for the columns the change didn't touch. A table
 * whose delimiter row doesn't match its columns (none kept, or changed elsewhere) gets none: the save then writes one
 * from the cells' alignment. A table with widths (experience 48) gets its widths back from `widths`, in 5 % steps.
 */
function withDelims(tr: Transaction, tablePos: number, before: PMNode, change: (cells: string[]) => string[], widths?: (percents: number[]) => number[]): void {
  const table = tr.doc.nodeAt(tablePos)
  if (!table || !('mdDelims' in table.attrs)) return
  const columns = size(before).width
  const cells = delimiterCells(before.attrs.mdDelims, columns)
  const percents = widthsOf(before.attrs.mdDelims, before.attrs.mdWidths, columns)
  let next: string | null = null
  let hasWidths = false
  if (cells) {
    const changed = change(cells)
    if (percents && widths) {
      next = delimiterRowWithWidths(changed, snapPercents(widths(percents)))
      hasWidths = true
    } else {
      next = '|' + changed.join('|') + '|'
      hasWidths = !!percents
    }
  }
  const attrs = { ...table.attrs, mdDelims: next, ...('mdWidths' in table.attrs ? { mdWidths: hasWidths ? 'true' : null } : {}) }
  if (attrs.mdDelims !== table.attrs.mdDelims || attrs.mdWidths !== table.attrs.mdWidths) tr.setNodeMarkup(tablePos, undefined, attrs)
}

/** The columns' widths, in 5 % steps adding to 100, when the table has them (experience 48); null for automatic. */
export function columnWidths(table: PMNode): number[] | null {
  return widthsOf(table.attrs.mdDelims, table.attrs.mdWidths, size(table).width)
}

/**
 * Set the columns' widths (a dragged line between two columns), or back to automatic (`null`, a double-click on it),
 * as the delimiter row's dashes, one undo step. Null when nothing changes.
 */
export function setColumnWidths(state: EditorState, tablePos: number, percents: number[] | null): Transaction | null {
  const table = tableAt(state.doc, tablePos)
  if (!table || !('mdDelims' in table.node.attrs)) return null
  const { width } = size(table.node)
  if (percents && percents.length !== width) return null
  const spaced = table.node.attrs.mdSpacing !== 'compact'
  const cells = delimiterCells(table.node.attrs.mdDelims, width)
    ?? Array.from({ length: width }, (_, col) => {
      const marker = alignMarker(columnAlign(table.node, col))
      return spaced ? ` ${marker} ` : marker
    })
  const snapped = percents ? snapPercents(percents) : null
  if (!snapped && !columnWidths(table.node)) return null
  const mdDelims = delimiterRowWithWidths(cells, snapped)
  const mdWidths = snapped ? 'true' : null
  if (mdDelims === table.node.attrs.mdDelims && mdWidths === (table.node.attrs.mdWidths ?? null)) return null
  const tr = state.tr.setNodeMarkup(tablePos, undefined, { ...table.node.attrs, mdDelims, mdWidths })
  return finish(tr)
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

/** A new column at index `at` (0 = before the first, width = after the last). The caret goes to its cell in `focusRow`. */
export function insertColumn(state: EditorState, tablePos: number, at: number, focusRow = 0): Transaction | null {
  const table = tableAt(state.doc, tablePos)
  if (!table) return null
  const { width, height, map } = size(table.node)
  if (at < 0 || at > width) return null
  const tr = state.tr
  const schema = state.schema
  for (let row = 0; row < height; row++) {
    const rowNode = table.node.child(row)
    const type = row === 0 ? schema.nodes.tableHeader : schema.nodes.tableCell
    const cell = type.createAndFill()
    if (!cell) return null
    // After the cell before it, or before the row's first cell.
    const pos = at === 0
      ? tablePos + 1 + map.map[row * width]
      : tablePos + 1 + map.map[row * width + at - 1] + rowNode.child(at - 1).nodeSize
    tr.insert(tr.mapping.map(pos), cell)
  }
  withDelims(tr, tablePos, table.node, cells => {
    const next = cells.slice()
    next.splice(at, 0, newDelimiterCell(cells[Math.min(at, cells.length - 1)]))
    return next
  }, percents => {
    // The new column takes an equal share; the others give it up in proportion.
    const share = 100 / (percents.length + 1)
    const next = percents.map(value => (value * (100 - share)) / 100)
    next.splice(at, 0, share)
    return next
  })
  return finish(caretIn(tr, tablePos, Math.min(Math.max(focusRow, 0), height - 1), at))
}

/** Delete a column; the table goes with its last column. */
export function deleteColumn(state: EditorState, tablePos: number, col: number): Transaction | null {
  const table = tableAt(state.doc, tablePos)
  if (!table) return null
  const { width, height, map } = size(table.node)
  if (col < 0 || col >= width) return null
  if (width === 1) return deleteTable(state, tablePos)
  const tr = state.tr
  for (let row = 0; row < height; row++) {
    const pos = tablePos + 1 + map.map[row * width + col]
    const cell = table.node.nodeAt(map.map[row * width + col])!
    tr.delete(tr.mapping.map(pos), tr.mapping.map(pos + cell.nodeSize))
  }
  withDelims(tr, tablePos, table.node, cells => cells.filter((_, index) => index !== col), percents => percents.filter((_, index) => index !== col))
  return finish(caretIn(tr, tablePos, 0, Math.min(col, width - 2)))
}

/** Move a column to index `to` (where it ends up). */
export function moveColumn(state: EditorState, tablePos: number, from: number, to: number, focusRow = 0): Transaction | null {
  const table = tableAt(state.doc, tablePos)
  if (!table) return null
  const { width, height } = size(table.node)
  if (from === to || from < 0 || to < 0 || from >= width || to >= width) return null
  const tr = runInTable(state, tablePos, moveTableColumn({ from, to, select: false, pos: tablePos + 1 }))
  if (!tr) return null
  withDelims(tr, tablePos, table.node, cells => {
    const next = cells.slice()
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    return next
  })
  return finish(caretIn(tr, tablePos, Math.min(Math.max(focusRow, 0), height - 1), to))
}

/** A column's alignment, on its cells and its delimiter cell. Null when it already has it. */
export function alignColumn(state: EditorState, tablePos: number, col: number, align: ColumnAlign): Transaction | null {
  const table = tableAt(state.doc, tablePos)
  if (!table) return null
  const { width, height, map } = size(table.node)
  if (col < 0 || col >= width) return null
  const tr = state.tr
  for (let row = 0; row < height; row++) {
    const offset = map.map[row * width + col]
    const cell = table.node.nodeAt(offset)!
    if ((cell.attrs.mdAlign ?? null) !== align) tr.setNodeMarkup(tablePos + 1 + offset, undefined, { ...cell.attrs, mdAlign: align })
  }
  // The run keeps its length (in a table with widths, the column's width; in one lined up by eye, its line).
  withDelims(tr, tablePos, table.node, cells => cells.map((cell, index) => (index === col ? delimiterCellOf(Math.max(runOf(cell), automaticUnits(align)), align, cell) : cell)))
  if (!tr.docChanged) return null
  return finish(tr)
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

/**
 * Sort the body rows by a column's words, A to Z or Z to A; the header stays first, rows with an empty cell go last,
 * and rows with the same words keep their order. Null when the rows are already in that order.
 */
export function sortByColumn(state: EditorState, tablePos: number, col: number, direction: 'asc' | 'desc'): Transaction | null {
  const table = tableAt(state.doc, tablePos)
  if (!table) return null
  const { width, height } = size(table.node)
  if (col < 0 || col >= width || height < 3) return null
  const body: PMNode[] = []
  for (let row = 1; row < height; row++) body.push(table.node.child(row))
  const key = (row: PMNode) => row.maybeChild(col)?.textContent.trim() ?? ''
  const sorted = body
    .map((row, index) => ({ row, index, words: key(row) }))
    .sort((a, b) => {
      if (!a.words !== !b.words) return a.words ? -1 : 1
      const order = collator.compare(a.words, b.words)
      return (direction === 'asc' ? order : -order) || a.index - b.index
    })
  if (sorted.every((entry, index) => entry.index === index)) return null
  const tr = state.tr
  const start = tablePos + 1 + table.node.child(0).nodeSize
  tr.replaceWith(start, tablePos + table.node.nodeSize - 1, sorted.map(entry => entry.row))
  return finish(caretIn(tr, tablePos, 0, col))
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

/**
 * A new row at index `at`: 1 to height for a body row, 0 for a new header (the old header becomes the first body row).
 * Its cells take their columns' alignment. The caret goes to the new row's cell in `focusCol`.
 */
export function insertRow(state: EditorState, tablePos: number, at: number, focusCol = 0): Transaction | null {
  const table = tableAt(state.doc, tablePos)
  if (!table) return null
  const { width, height } = size(table.node)
  if (at < 0 || at > height) return null
  const schema = state.schema
  const tr = state.tr
  const cellType = at === 0 ? schema.nodes.tableHeader : schema.nodes.tableCell
  const cells: PMNode[] = []
  for (let col = 0; col < width; col++) {
    const cell = cellType.createAndFill({ mdAlign: columnAlign(table.node, col) })
    if (!cell) return null
    cells.push(cell)
  }
  const row = schema.nodes.tableRow.create(table.node.child(0).attrs, cells)
  let pos = tablePos + 1
  for (let index = 0; index < at; index++) pos += table.node.child(index).nodeSize
  if (at === 0) {
    // The old header row's cells become body cells, as a body row's are.
    let cellPosition = tablePos + 2
    table.node.child(0).forEach(cell => {
      tr.setNodeMarkup(cellPosition, schema.nodes.tableCell, cell.attrs, cell.marks)
      cellPosition += cell.nodeSize
    })
  }
  tr.insert(pos, row)
  return finish(caretIn(tr, tablePos, at, Math.min(Math.max(focusCol, 0), width - 1)))
}

/** Delete a body row (the header row is never deleted). */
export function deleteRow(state: EditorState, tablePos: number, row: number, focusCol = 0): Transaction | null {
  const table = tableAt(state.doc, tablePos)
  if (!table) return null
  const { width, height } = size(table.node)
  if (row < 1 || row >= height) return null
  let pos = tablePos + 1
  for (let index = 0; index < row; index++) pos += table.node.child(index).nodeSize
  const tr = state.tr.delete(pos, pos + table.node.child(row).nodeSize)
  return finish(caretIn(tr, tablePos, Math.min(row, height - 2), Math.min(Math.max(focusCol, 0), width - 1)))
}

/** Move a body row to index `to` (where it ends up); the header row neither moves nor has a row moved above it. */
export function moveRow(state: EditorState, tablePos: number, from: number, to: number, focusCol = 0): Transaction | null {
  const table = tableAt(state.doc, tablePos)
  if (!table) return null
  const { width, height } = size(table.node)
  if (from === to || from < 1 || to < 1 || from >= height || to >= height) return null
  const tr = runInTable(state, tablePos, moveTableRow({ from, to, select: false, pos: tablePos + 1 }))
  if (!tr) return null
  return finish(caretIn(tr, tablePos, to, Math.min(Math.max(focusCol, 0), width - 1)))
}

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

export function deleteTable(state: EditorState, tablePos: number): Transaction | null {
  const table = tableAt(state.doc, tablePos)
  if (!table) return null
  const tr = state.tr.delete(tablePos, tablePos + table.node.nodeSize)
  tr.setSelection(Selection.near(tr.doc.resolve(Math.min(tablePos, tr.doc.content.size))))
  return finish(tr)
}

/**
 * Tab: the next cell, and in the last cell a new row with the caret in its first cell. Null outside a table, so Tab
 * does what it did there.
 */
export function nextCellOrNewRow(state: EditorState): Transaction | null {
  const cell = cellAtSelection(state)
  if (!cell) return null
  const { width, height } = size(cell.node)
  if (cell.col < width - 1) return caretIn(state.tr, cell.pos, cell.row, cell.col + 1).scrollIntoView()
  if (cell.row < height - 1) return caretIn(state.tr, cell.pos, cell.row + 1, 0).scrollIntoView()
  return insertRow(state, cell.pos, height, 0)
}

/** Shift+Tab: the cell before, or null in the first cell (or outside a table). */
export function previousCell(state: EditorState): Transaction | null {
  const cell = cellAtSelection(state)
  if (!cell) return null
  const { width } = size(cell.node)
  if (cell.col > 0) return caretIn(state.tr, cell.pos, cell.row, cell.col - 1).scrollIntoView()
  if (cell.row > 0) return caretIn(state.tr, cell.pos, cell.row - 1, width - 1).scrollIntoView()
  return null
}

/**
 * A column or a row chosen (its grip clicked or dragged): its cells tinted, as a decoration, never as a selection, so the
 * caret stays where it was, no formatting bar comes up, and an Undo after the change gives back the caret, not a tint.
 */
export interface TableTint {
  tablePos: number
  kind: 'column' | 'row'
  index: number
}

export const tableTintKey = new PluginKey<TableTint | null>('rmTableTint')

/** The tint: set or cleared by `setTint`, following its table through changes, gone with it. */
export function tableTintPlugin(): Plugin<TableTint | null> {
  return new Plugin<TableTint | null>({
    key: tableTintKey,
    state: {
      init: () => null,
      apply(tr, tint) {
        const meta = tr.getMeta(tableTintKey) as TableTint | null | undefined
        if (meta !== undefined) return meta
        if (!tint || !tr.docChanged) return tint
        const mapped = tr.mapping.mapResult(tint.tablePos, -1)
        return mapped.deleted || !tableAt(tr.doc, mapped.pos) ? null : { ...tint, tablePos: mapped.pos }
      },
    },
    props: {
      decorations: state => tintDecorations(state.doc, tableTintKey.getState(state) ?? null),
    },
  })
}

export function setTint(state: EditorState, tint: TableTint | null): Transaction {
  return state.tr.setMeta(tableTintKey, tint)
}

/** The tinted cells, with prosemirror-tables' own class for chosen cells, which both editors draw. */
export function tintDecorations(doc: PMNode, tint: TableTint | null): DecorationSet {
  if (!tint) return DecorationSet.empty
  const table = tableAt(doc, tint.tablePos)
  if (!table) return DecorationSet.empty
  const { width, height } = size(table.node)
  const decorations: Decoration[] = []
  const count = tint.kind === 'column' ? height : width
  for (let i = 0; i < count; i++) {
    const at = tint.kind === 'column' ? cellPos(doc, tint.tablePos, i, tint.index) : cellPos(doc, tint.tablePos, tint.index, i)
    const cell = at === null ? null : doc.nodeAt(at)
    if (at !== null && cell) decorations.push(Decoration.node(at, at + cell.nodeSize, { class: 'selectedCell' }))
  }
  return DecorationSet.create(doc, decorations)
}

/**
 * prosemirror-tables' move commands read the table from the selection: they run on the state with the caret put in the
 * table's first cell, and their transaction (which starts from the same document) is returned.
 */
function runInTable(state: EditorState, tablePos: number, command: (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean): Transaction | null {
  const first = cellPos(state.doc, tablePos, 0, 0)
  if (first === null) return null
  const inTable = state.apply(state.tr.setSelection(TextSelection.near(state.doc.resolve(first + 1))))
  let result: Transaction | null = null
  command(inTable, tr => { result = tr })
  if (!result) return null
  // The same steps on a transaction of the state given, so its selection and history start from it.
  const tr = state.tr
  for (const step of (result as Transaction).steps) tr.step(step)
  return tr
}
