/**
 * Sprint 158 PR 3 (#711): a sheet's geometry for the sheet grid, as Excel lays it out at 100 %. Pure (no DOM), so it
 * is tested on its own; the grid (SheetGrid.tsx) draws from it only what is in view.
 *
 * Rows are in display order: the frozen rows first, then the rest, sorted when a sort is chosen (a view; the file's
 * order doesn't change). `rowOf[i]` is display row i's sheet row. Columns are in sheet order. Hidden rows and columns
 * are 0 px, as in Excel.
 */
import { columnScale, defaultRowPoints, pointsToPixels, type ExcelGeometry } from './columnWidth'
export type { ExcelGeometry }
import type { CellStyle, FontStyle, WorkbookStyles } from './excelStyles'
import { cellKey, type SheetModel } from './readWorkbook'

/** Header row height and the frame's look (experience 47, decision 9). */
export const HEADER_HEIGHT = 22
/** Cell text inset each side, in pixels, by the Excel the widths follow (columnWidth.ts). Excel for Mac's: measured
 *  on the training budget against its window, text starts 0.25–0.9 pt further in than at 2 px (Sprint 158 PR 4).
 *  Excel for Windows keeps 2: its 64 px default column holds eight Calibri digits only at 2 (review of #725).
 *  1 px ran "8:15" into "Müük" (the Experience lead, 15 November). */
export function cellPadding(geometry: ExcelGeometry): number {
  return geometry === 'mac' ? 3 : 2
}

export interface SheetLayout {
  /** Drawn rows and columns. */
  rows: number
  cols: number
  /** Display row → sheet row. */
  rowOf: Int32Array
  /** Sheet row → display row. */
  displayOf: Map<number, number>
  colW: Float64Array
  rowH: Float64Array
  /** Prefix sums: X[c] is column c's left edge, Y[i] display row i's top edge (without the headers). */
  X: Float64Array
  Y: Float64Array
  frozenRows: number
  frozenCols: number
  headerW: number
  headerH: number
  /** The merge a sheet cell is in, by its cellKey: the merge's index. */
  mergeAt: MergeIndex
  merges: Array<[number, number, number, number]>
}

export interface LayoutOptions {
  /** Fill at least this much: the grid runs to the paper's edges (decision 9). */
  minWidth: number
  minHeight: number
  /** At least this many rows and columns: the sheet goes on past the paper's edge as Excel's does, and the grid
   *  asks for more as the person moves or scrolls there (Sprint 158 PR 5). */
  minRows?: number
  minCols?: number
  /** The rows under the frozen ones in a sort's order (sortedRows), worked out when the sort was chosen and kept
   *  through edits, as Excel keeps a sorted range: an edit doesn't move its row. */
  rowOrder?: number[]
  /** Auto-fit heights: rows without a height of their own, that hold wrapped text or a larger font. */
  autoHeight?: (row: number) => number | undefined
  /** Column widths as Excel for Mac or for Windows lays them out (columnWidth.ts); Windows when not given. */
  geometry?: ExcelGeometry
}

/** Which merge a cell is in. Small merges are indexed cell by cell; a large one (a whole sheet merged, A1:XFD1048576,
 *  is a few bytes in a file) is kept as a range and checked as one, so it can't make the grid enumerate billions of
 *  cells (Codex on #724). */
export interface MergeIndex {
  get(key: number): number | undefined
  has(key: number): boolean
}

const CELL_BY_CELL_MERGE = 4096

export function mergeIndex(merges: ReadonlyArray<[number, number, number, number]>): MergeIndex {
  const small = new Map<number, number>()
  const large: number[] = []
  merges.forEach(([r1, c1, r2, c2], i) => {
    if ((r2 - r1 + 1) * (c2 - c1 + 1) > CELL_BY_CELL_MERGE) {
      large.push(i)
      return
    }
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) small.set(cellKey(r, c), i)
  })
  const get = (key: number) => {
    const found = small.get(key)
    if (found !== undefined || !large.length) return found
    const r = Math.floor(key / 16384)
    const c = key % 16384
    return large.find((i) => {
      const [r1, c1, r2, c2] = merges[i]
      return r >= r1 && r <= r2 && c >= c1 && c <= c2
    })
  }
  return { get, has: (key) => get(key) !== undefined }
}

/** The style a cell draws with: its own, else its row's, else its column's (Excel's order). */
export function styleIndexOf(sheet: SheetModel, r: number, c: number): number {
  const cell = sheet.cells.get(cellKey(r, c))
  if (cell) return cell.s
  const row = sheet.layout.rows.get(r)
  if (row?.style !== undefined) return row.style
  for (const col of sheet.layout.cols) if (c >= col.min && c <= col.max && col.style !== undefined) return col.style
  return 0
}

export function styleOf(styles: WorkbookStyles, s: number): CellStyle | undefined {
  return styles.xfs[s] ?? styles.xfs[0]
}

/** Binary search: the index i with P[i] <= v < P[i + 1], clamped to [0, n - 1]. */
export function indexAt(P: Float64Array, n: number, v: number): number {
  let lo = 0
  let hi = n - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (P[mid] <= v) lo = mid
    else hi = mid - 1
  }
  return lo
}

export function buildLayout(sheet: SheetModel, styles: WorkbookStyles, opts: LayoutOptions): SheetLayout {
  const L = sheet.layout
  const scale = columnScale(styles.baseFont, opts.geometry ?? 'windows')
  const defaultColPx = scale.defaultPixels(L.defaultColWidth, L.baseColWidth)
  const defaultRowPx = pointsToPixels(L.defaultRowHeight ?? defaultRowPoints(styles.baseFont))

  // drawings reach as far as their end cell
  let usedR = sheet.maxR
  let usedC = sheet.maxC
  for (const d of L.drawings) {
    const end = d.anchor.to ?? d.anchor.from
    if (end) {
      usedR = Math.max(usedR, end.row)
      usedC = Math.max(usedC, end.col)
    }
  }
  usedR = Math.max(usedR, L.frozen.rows - 1)
  usedC = Math.max(usedC, L.frozen.cols - 1)

  // columns: their widths, then as many as fill the paper
  const widthOf = (c: number): number => {
    if (sheet.hiddenCols.has(c)) return 0
    for (const col of L.cols) if (c >= col.min && c <= col.max) return col.width !== undefined ? scale.pixels(col.width) : defaultColPx
    return defaultColPx
  }
  const colWidths: number[] = []
  let width = 0
  for (let c = 0; c < 16384 && (c <= usedC || width < opts.minWidth || c < (opts.minCols ?? 0)); c++) {
    const w = widthOf(c)
    colWidths.push(w)
    width += w
  }

  // rows: the frozen ones, then the rest in display order (sorted, when a sort is chosen)
  const lastUsedR = usedR
  const heightOf = (r: number): number => {
    if (sheet.hiddenRows.has(r)) return 0
    const def = L.rows.get(r)
    if (def?.height !== undefined) return pointsToPixels(def.height)
    if (L.zeroHeight) return 0
    return Math.max(defaultRowPx, opts.autoHeight?.(r) ?? 0)
  }
  let order: number[] = []
  if (opts.rowOrder) {
    // the frozen rows, the sorted ones, then any row not in the sort (rows added since) in sheet order
    const seen = new Set<number>()
    for (let r = 0; r < Math.min(L.frozen.rows, lastUsedR + 1); r++) {
      order.push(r)
      seen.add(r)
    }
    for (const r of opts.rowOrder) if (r <= lastUsedR && !seen.has(r)) {
      order.push(r)
      seen.add(r)
    }
    for (let r = 0; r <= lastUsedR; r++) if (!seen.has(r)) order.push(r)
  } else {
    for (let r = 0; r <= lastUsedR; r++) order.push(r)
  }
  let height = 0
  const rowHeights: number[] = order.map((r) => {
    const h = heightOf(r)
    height += h
    return h
  })
  // On a sheet whose rows are hidden unless they say otherwise (zeroHeight), every row past the data is hidden: none
  // fills the paper, so filling it would run to Excel's last row (Codex on #726). Only the rows the grid asks for go on.
  const fillsPaper = !L.zeroHeight
  while (((fillsPaper && height < opts.minHeight) || order.length < (opts.minRows ?? 0)) && order.length < 1_048_576) {
    const r = order.length
    order.push(r)
    const h = heightOf(r)
    rowHeights.push(h)
    height += h
  }

  const rows = order.length
  const cols = colWidths.length
  const rowOf = Int32Array.from(order)
  const displayOf = new Map<number, number>()
  order.forEach((r, i) => displayOf.set(r, i))
  const colW = Float64Array.from(colWidths)
  const rowH = Float64Array.from(rowHeights)
  const X = new Float64Array(cols + 1)
  for (let c = 0; c < cols; c++) X[c + 1] = X[c] + colW[c]
  const Y = new Float64Array(rows + 1)
  for (let i = 0; i < rows; i++) Y[i + 1] = Y[i] + rowH[i]

  const mergeAt = mergeIndex(L.merges)

  return {
    rows,
    cols,
    rowOf,
    displayOf,
    colW,
    rowH,
    X,
    Y,
    frozenRows: Math.min(L.frozen.rows, rows),
    frozenCols: Math.min(L.frozen.cols, cols),
    headerW: L.showHeaders ? Math.max(32, String(rows).length * 7 + 16) : 0,
    headerH: L.showHeaders ? HEADER_HEIGHT : 0,
    mergeAt,
    merges: L.merges,
  }
}

/**
 * The rows under the frozen ones that hold something, sorted by a column; empty cells last either way, as Excel
 * sorts. The empty rows after them aren't sorted.
 */
export function sortedRows(sheet: SheetModel, col: number, dir: 1 | -1, compare: (a: unknown, b: unknown) => number): number[] {
  const body: number[] = []
  for (let r = sheet.layout.frozen.rows; r <= sheet.maxR; r++) body.push(r)
  const valueOf = (r: number) => {
    const cell = sheet.cells.get(cellKey(r, col))
    return cell && cell.value !== '' ? cell.value : ''
  }
  return body.sort((a, b) => {
    const va = valueOf(a)
    const vb = valueOf(b)
    if (va === '' && vb === '') return a - b
    if (va === '') return 1
    if (vb === '') return -1
    return dir * compare(va, vb) || a - b
  })
}

/**
 * Why the rows can't be sorted, or undefined when they can: merged cells across the sortable rows (experience 47,
 * decision 3; Excel asks for them to be unmerged first too). Names the first such merge's column.
 */
export function sortRefusal(sheet: SheetModel, columnLetters: (c: number) => string): string | undefined {
  const first = sheet.layout.frozen.rows
  const merge = sheet.layout.merges.find(([r1, , r2]) => r2 >= first && r1 <= sheet.maxR)
  if (!merge) return undefined
  // the column by its heading in the frozen rows above (the Phase column), else by its letter (the B column)
  let heading = ''
  for (let r = first - 1; r >= 0 && !heading; r--) heading = sheet.cells.get(cellKey(r, merge[1]))?.text.trim() ?? ''
  const name = heading && heading.length <= 40 ? heading : columnLetters(merge[1])
  return `This sheet has merged cells in the ${name} column, so its rows can't be sorted here. Excel asks for them to be unmerged first too.`
}

/** Calibri and Cambria, where they aren't installed, drawn by their metric twins: subsets of Carlito and Caladea
 *  (SIL OFL) in the bundle, renamed as the licence asks (sheetGrid.css). Same advance widths, so a column holds what
 *  it holds in Excel and #### shows where Excel shows it. Set by the grid (`useFontTwins`); lower-case family to twin. */
export const GRID_SANS = 'Ritemark Grid Sans'
export const GRID_SERIF = 'Ritemark Grid Serif'
const fontTwins = new Map<string, string>()

export function setFontTwins(twins: Iterable<[string, string]>): void {
  fontTwins.clear()
  for (const [family, twin] of twins) fontTwins.set(family.toLowerCase(), twin)
}

/** A font as CSS, on the white paper: its family with fallbacks, size, weight, slant, decoration and colour. */
export function fontCss(font: Partial<FontStyle> | undefined, base: FontStyle): Record<string, string> {
  const f = { ...base, ...font }
  const family = f.name ?? base.name ?? 'Calibri'
  const twin = fontTwins.get(family.toLowerCase())
  const decoration = [f.underline ? 'underline' : '', f.strike ? 'line-through' : ''].filter(Boolean).join(' ')
  const css: Record<string, string> = {
    fontFamily: twin ? `'${twin}', Arial, sans-serif` : `'${family.replace(/['"\\]/g, '')}', 'Carlito', Arial, sans-serif`,
    fontSize: `${((f.size ?? 11) * 4) / 3}px`,
    fontWeight: f.bold ? '700' : '400',
    fontStyle: f.italic ? 'italic' : 'normal',
    color: f.color ?? '#000000',
  }
  if (decoration) css.textDecoration = decoration
  if (f.underline === 'double' || f.underline === 'doubleAccounting') css.textDecorationStyle = 'double'
  if (f.vertAlign) {
    css.verticalAlign = f.vertAlign === 'superscript' ? 'super' : 'sub'
    css.fontSize = `${((f.size ?? 11) * 4) / 3 * 0.75}px`
  }
  return css
}

/** The same font as a canvas `font` string, to measure text. */
export function fontShorthand(font: Partial<FontStyle> | undefined, base: FontStyle): string {
  const css = fontCss(font, base)
  return `${css.fontStyle} ${css.fontWeight} ${css.fontSize} ${css.fontFamily}`
}
