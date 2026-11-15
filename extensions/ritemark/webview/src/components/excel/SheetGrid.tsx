/**
 * Sprint 158 PR 3 (#711; experience 47): an Excel sheet drawn as Excel draws it, beside DataTable (which stays for
 * CSV). Column widths and row heights, fills, fonts, borders, alignment, wrapped and rotated text, text that runs into
 * empty neighbours, ####, merged cells, frozen panes, gridlines and hidden rows and columns, on white paper.
 *
 * The sheet is four regions, as in the spike (research/spike/render/layout.js): the corner and the frozen rows and
 * columns stick while the body scrolls under them. Each region draws, in layers, only the cells in view: gridlines,
 * fills, borders, text, then charts' and pictures' places, the selection and the cell being edited. Its geometry
 * comes from sheetLayout.ts.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import * as XLSX from 'xlsx'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { writeClipboard, readClipboard } from '../../lib/clipboard'
import { compareCells } from '../sheetSort'
import { installFontFallbacks, installOfficeFontAliases, isOfficeFontMissing } from '../viewers/docx/officeFonts'
import { cellKey, type CellModel, type SheetModel, type WorkbookModel } from './readWorkbook'
import { GRID_SANS, cellPadding, GRID_SERIF, buildLayout, fontCss, fontShorthand, indexAt, mergeIndex, setFontTwins, sortRefusal, sortedRows, styleIndexOf, styleOf, type SheetLayout } from './sheetLayout'
import { columnScale, type ExcelGeometry } from './columnWidth'
import { isMac } from '../../hooks/usePlatform'
import type { CellStyle } from './excelStyles'
import './sheetGrid.css'

export interface SheetGridProps {
  model: WorkbookModel
  sheet: SheetModel
  /** Raised by every edit, so the grid draws the model again. */
  version: number
  editable: boolean
  /** A cell typed into, by its sheet row and column (0-based). */
  onEdit: (row: number, col: number, text: string) => void
  /** What the formula bar shows and an edit starts with. */
  getInput: (row: number, col: number) => string
  getFormula: (row: number, col: number) => string | undefined
  onEditingFormulaChange?: (editingFormula: boolean) => void
  onOpenInExcel: () => void
  openInLabel: string
}

interface Pos {
  /** Display row and sheet column. */
  i: number
  c: number
}

const letters = (c: number) => XLSX.utils.encode_col(c)
const OVERSCAN = 3

type RegionKind = 'corner' | 'top' | 'left' | 'body'

let measureContext: CanvasRenderingContext2D | null = null
/** Column widths and the cell inset as the Excel on this computer lays them out (columnWidth.ts). */
const GEOMETRY: ExcelGeometry = isMac ? 'mac' : 'windows'
const CELL_PADDING = cellPadding(GEOMETRY)

/** Text widths, kept while the fonts are the same: scrolling measures the same cells again and again. */
const measured = new Map<string, number>()
function measure(text: string, font: string): number {
  const key = `${font}\u0000${text}`
  const known = measured.get(key)
  if (known !== undefined) return known
  if (!measureContext) measureContext = document.createElement('canvas').getContext('2d')
  if (!measureContext) return text.length * 7
  measureContext.font = font
  const width = measureContext.measureText(text).width
  if (measured.size > 50_000) measured.clear()
  measured.set(key, width)
  return width
}
/** Fonts that finished loading change widths: measure again. */
function forgetMeasures() {
  measured.clear()
}

function horizontalOf(cell: CellModel | undefined, style: CellStyle | undefined): string {
  const h = style?.align.horizontal
  if (h && h !== 'general') return ({ centerContinuous: 'center', fill: 'left', distributed: 'justify', justify: 'justify' } as Record<string, string>)[h] ?? h
  if (!cell) return 'left'
  return cell.kind === 'n' && cell.value !== '' ? 'right' : cell.kind === 'b' || cell.kind === 'e' ? 'center' : 'left'
}

function verticalOf(style: CellStyle | undefined): string {
  return ({ top: 'flex-start', center: 'center', justify: 'center', distributed: 'center' } as Record<string, string>)[style?.align.vertical ?? ''] ?? 'flex-end'
}

function borderCss(side: { width: number; style: string; color: string } | undefined): string | undefined {
  return side ? `${side.width}px ${side.style} ${side.color}` : undefined
}

export function SheetGrid({
  model,
  sheet,
  version,
  editable,
  onEdit,
  getInput,
  getFormula,
  onEditingFormulaChange,
  onOpenInExcel,
  openInLabel,
}: SheetGridProps) {
  const styles = model.styles
  const base = styles.baseFont
  const scroller = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const [viewport, setViewport] = useState({ w: 1200, h: 800 })
  const [scroll, setScroll] = useState({ x: 0, y: 0 })
  // a sort: its column and direction, and the row order worked out when it was chosen
  const [sort, setSortState] = useState<{ col: number; dir: 1 | -1; rows: number[] } | null>(null)
  const [selected, setSelected] = useState<Pos>({ i: 0, c: 0 })
  const [editing, setEditingState] = useState<{ pos: Pos; value: string; fromBar: boolean } | null>(null)
  // the live edit, for handlers of an older render (a blur right after Enter or Escape must see that it has ended)
  const editingRef = useRef<{ pos: Pos; value: string; fromBar: boolean } | null>(null)
  const setEditing = useCallback((next: { pos: Pos; value: string; fromBar: boolean } | null | ((prev: { pos: Pos; value: string; fromBar: boolean } | null) => { pos: Pos; value: string; fromBar: boolean } | null)) => {
    const value = typeof next === 'function' ? next(editingRef.current) : next
    editingRef.current = value
    setEditingState(value)
  }, [])
  const [fontsReady, setFontsReady] = useState(0)

  // Office fonts: Calibri and Cambria, where missing, by their bundled metric twins; Aptos and the rest by the
  // Office aliases (officeFonts.ts); a family installed nowhere by Arial
  useEffect(() => {
    installOfficeFontAliases()
    installFontFallbacks(styles.families)
    const twins: Array<[string, string]> = []
    if (isOfficeFontMissing('Calibri')) twins.push(['Calibri', GRID_SANS])
    if (isOfficeFontMissing('Cambria')) twins.push(['Cambria', GRID_SERIF])
    setFontTwins(twins)
    // a face loads when text first asks for it, after this effect: load the twins' faces now, then measure again
    const faces = twins.flatMap(([, twin]) => ['', 'bold ', 'italic ', 'italic bold '].map((face) => `${face}16px '${twin}'`))
    void Promise.all(faces.map((face) => document.fonts?.load(face).catch(() => [])))
      .then(() => document.fonts?.ready)
      .then(() => {
        forgetMeasures()
        setFontsReady((n) => n + 1)
      })
  }, [styles])

  const setSort = useCallback((next: { col: number; dir: 1 | -1 } | null) => {
    setSortState(next ? { ...next, rows: sortedRows(sheet, next.col, next.dir, compareCells) } : null)
  }, [sheet])

  // a new sheet: back to its top-left, no sort
  useEffect(() => {
    setSortState(null)
    setEditing(null)
    setReach({ rows: 0, cols: 0 })
    setSelected({ i: sheet.layout.frozen.rows, c: sheet.layout.frozen.cols })
    scroller.current?.scrollTo(0, 0)
  }, [sheet])

  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const update = () => setViewport({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // The sheet goes on past the paper's edge, as Excel's does: there is no Add row or + column (Sprint 158 PR 5).
  // A scroll to the grid's end, or a cell chosen near it, adds rows and columns, up to Excel's 1,048,576 by 16,384.
  // Typing into one writes that cell, and the sheet's used range grows to take it in.
  const [reach, setReach] = useState({ rows: 0, cols: 0 })
  const growBy = useCallback((rows: number, cols: number) => {
    setReach((r) => ({ rows: Math.min(1_048_576, Math.max(r.rows, layoutRef.current.rows) + rows), cols: Math.min(16_384, Math.max(r.cols, layoutRef.current.cols) + cols) }))
  }, [])

  const frame = useRef(0)
  const onScroll = useCallback(() => {
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      const el = scroller.current
      if (!el) return
      setScroll({ x: el.scrollLeft, y: el.scrollTop })
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 4 && el.scrollTop > 0
      const atRight = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 && el.scrollLeft > 0
      if (atBottom || atRight) growBy(atBottom ? 50 : 0, atRight ? 10 : 0)
    })
  }, [growBy])

  const mergedCells = useMemo(() => mergeIndex(sheet.layout.merges), [sheet])

  // rows without a height of their own grow for wrapped text and larger fonts, as Excel fits them
  const autoHeight = useMemo(() => {
    const cache = new Map<number, number | undefined>()
    // only rows with a wrapped cell or a font larger than the sheet's are fitted: found once, from the cells
    const candidates = new Map<number, number[]>()
    for (const [key, cell] of sheet.cells) {
      if (cell.text === '') continue
      const style = styleOf(styles, cell.s)
      if (!style?.align.wrap && (style?.font.size ?? base.size) <= base.size) continue
      const r = Math.floor(key / 16384)
      const list = candidates.get(r) ?? []
      list.push(key % 16384)
      candidates.set(r, list)
    }
    // the layout's own widths: by the Normal font's widest digit and the sheet's default
    const scale = columnScale(base, GEOMETRY)
    const defaultPx = scale.defaultPixels(sheet.layout.defaultColWidth, sheet.layout.baseColWidth)
    const colPx = (c: number) => {
      if (sheet.hiddenCols.has(c)) return 0
      const col = sheet.layout.cols.find((d) => c >= d.min && c <= d.max)
      return col?.width !== undefined ? scale.pixels(col.width) : defaultPx
    }
    return (r: number) => {
      const cols = candidates.get(r)
      if (!cols) return undefined
      if (cache.has(r)) return cache.get(r)
      let need: number | undefined
      for (const c of cols) {
        const cell = sheet.cells.get(cellKey(r, c))
        if (!cell || cell.text === '' || !colPx(c) || mergedCells.has(cellKey(r, c))) continue
        const style = styleOf(styles, cell.s)
        const px = ((style?.font.size ?? base.size) * 4) / 3
        let h = Math.ceil(px * 1.36)
        if (style?.align.wrap) {
          const width = Math.max(1, colPx(c) - 2 * CELL_PADDING)
          const font = fontShorthand(style.font, base)
          let lines = 0
          for (const paragraph of cell.text.split('\n')) {
            let line = 0
            lines++
            for (const word of paragraph.split(/(\s+)/)) {
              const w = measure(word, font)
              if (line + w > width && line > 0) {
                lines++
                line = w
              } else line += w
            }
          }
          h = Math.ceil(lines * px * 1.25 + 4)
        }
        need = Math.max(need ?? 0, h)
      }
      cache.set(r, need)
      return need
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, styles, version, fontsReady, mergedCells])

  const layout: SheetLayout = useMemo(
    () =>
      buildLayout(sheet, styles, {
        // whole steps of 400 px, the same steps the layout is rebuilt at, so the grid always reaches the edges
        minWidth: Math.ceil(viewport.w / 400) * 400 + 64,
        minHeight: Math.ceil(viewport.h / 400) * 400 + 40,
        minRows: reach.rows,
        minCols: reach.cols,
        rowOrder: sort?.rows,
        autoHeight,
        geometry: GEOMETRY,
      }),
    // the grid grows by whole screens, so a resize by a few pixels doesn't lay the sheet out again
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sheet, styles, version, Math.ceil(viewport.w / 400), Math.ceil(viewport.h / 400), reach, sort, autoHeight],
  )

  const layoutRef = useRef(layout)
  layoutRef.current = layout
  const { X, Y, rowOf, frozenRows: fr, frozenCols: fc, headerW: HW, headerH: HH } = layout
  const FW = X[fc]
  const FH = Y[fr]
  const TW = X[layout.cols]
  const TH = Y[layout.rows]

  // what is in view, beyond the frozen panes
  const view = useMemo(() => {
    const c0 = Math.max(fc, indexAt(X, layout.cols, scroll.x + FW) - OVERSCAN)
    const c1 = Math.min(layout.cols - 1, indexAt(X, layout.cols, scroll.x + viewport.w - HW) + OVERSCAN)
    const i0 = Math.max(fr, indexAt(Y, layout.rows, scroll.y + FH) - OVERSCAN)
    const i1 = Math.min(layout.rows - 1, indexAt(Y, layout.rows, scroll.y + viewport.h - HH) + OVERSCAN)
    return { c0, c1, i0, i1 }
  }, [layout, scroll, viewport, X, Y, fc, fr, FW, FH, HW, HH])

  const cellAt = (i: number, c: number) => sheet.cells.get(cellKey(rowOf[i], c))
  const styleAt = (i: number, c: number) => styleOf(styles, styleIndexOf(sheet, rowOf[i], c))
  const mergeOf = (i: number, c: number) => {
    const m = layout.mergeAt.get(cellKey(rowOf[i], c))
    return m === undefined ? undefined : layout.merges[m]
  }

  /** A display rectangle (rows i1..i2, columns c1..c2) in canvas pixels, headers included. */
  const rect = (i1: number, c1: number, i2: number, c2: number) => ({
    x: HW + X[c1],
    y: HH + Y[i1],
    w: X[c2 + 1] - X[c1],
    h: Y[i2 + 1] - Y[i1],
  })

  /** A cell's rectangle: its merge's when it is in one. */
  const cellRect = (pos: Pos) => {
    const m = mergeOf(pos.i, pos.c)
    if (m) {
      const a = layout.displayOf.get(m[0]) ?? pos.i
      const b = layout.displayOf.get(m[2]) ?? pos.i
      return rect(a, m[1], b, m[3])
    }
    return rect(pos.i, pos.c, pos.i, pos.c)
  }

  const regionOrigin = (kind: RegionKind) => ({
    x: kind === 'top' || kind === 'body' ? HW + FW : 0,
    y: kind === 'left' || kind === 'body' ? HH + FH : 0,
  })
  const regionOfPos = (pos: Pos): RegionKind => (pos.i < fr ? (pos.c < fc ? 'corner' : 'top') : pos.c < fc ? 'left' : 'body')

  // text that runs into empty neighbours, and numbers too wide for their column (####), for the rows in view
  const textBoxes = useMemo(() => {
    const spans = new Map<number, [number, number]>()
    const hashes = new Map<number, string>()
    const rowsInView = [...Array(fr).keys(), ...Array.from({ length: Math.max(0, view.i1 - view.i0 + 1) }, (_, k) => view.i0 + k)]
    const lastC = Math.min(layout.cols - 1, Math.max(view.c1, sheet.maxC))
    for (const i of rowsInView) {
      if (!layout.rowH[i]) continue
      const r = rowOf[i]
      for (let c = 0; c <= lastC; c++) {
        const cell = sheet.cells.get(cellKey(r, c))
        if (!cell || cell.text === '' || !layout.colW[c] || layout.mergeAt.has(cellKey(r, c))) continue
        const style = styleOf(styles, cell.s)
        const a = style?.align
        if (a && (a.wrap || a.rotation || a.shrink)) continue
        const h = horizontalOf(cell, style)
        if (h === 'justify') continue
        const shown = cell.pad ? cell.pad[0] + cell.text + cell.pad[1] : cell.text
        const width = measure(shown, fontShorthand(style?.font, base)) + 2 * CELL_PADDING + (a?.indent ?? 0) * 9
        const avail = layout.colW[c]
        if (width <= avail + 0.5) continue
        if (cell.kind !== 's') {
          // numbers and dates don't run over: Excel fills the cell with # (decision 8)
          const hashWidth = measure('#', fontShorthand(style?.font, base)) || 7
          hashes.set(cellKey(r, c), '#'.repeat(Math.max(1, Math.floor((avail - 2 * CELL_PADDING) / hashWidth))))
          continue
        }
        const free = (cc: number) => cc >= 0 && cc < layout.cols && !(sheet.cells.get(cellKey(r, cc))?.text) && !layout.mergeAt.has(cellKey(r, cc))
        let c0 = c
        let c1 = c
        let w = avail
        if (h === 'center') {
          while (w < width && free(c0 - 1) && free(c1 + 1)) {
            c0--
            c1++
            w += layout.colW[c0] + layout.colW[c1]
          }
        } else if (h === 'right') {
          while (w < width && free(c0 - 1)) w += layout.colW[--c0]
        } else {
          while (w < width && free(c1 + 1)) w += layout.colW[++c1]
        }
        if (c0 !== c || c1 !== c) spans.set(cellKey(r, c), [c0, c1])
      }
    }
    return { spans, hashes }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, view, sheet, styles, version, fontsReady])

  const selectedRow = rowOf[selected.i] ?? 0
  const selectedCell = cellAt(selected.i, selected.c)
  const formula = getFormula(selectedRow, selected.c)
  const editingFormula = !!editing && !!getFormula(rowOf[editing.pos.i], editing.pos.c)
  useEffect(() => {
    onEditingFormulaChange?.(editingFormula)
  }, [editingFormula, onEditingFormulaChange])

  // ── Selection, keyboard and editing ───────────────────────────────────

  /** The next visible row or column from here, in a direction; stays put at the edge. */
  const step = useCallback((pos: Pos, di: number, dc: number): Pos => {
    let { i, c } = pos
    // leave a merge from its edge
    const m = mergeOf(i, c)
    if (m && di > 0) i = layout.displayOf.get(m[2]) ?? i
    if (m && dc > 0) c = m[3]
    do {
      i += di
      c += dc
    } while (i >= 0 && i < layout.rows && c >= 0 && c < layout.cols && ((di && !layout.rowH[i]) || (dc && !layout.colW[c])))
    if (i < 0 || i >= layout.rows || c < 0 || c >= layout.cols) return pos
    // a merged cell is chosen as one, by its top-left cell
    const n = mergeOf(i, c)
    if (n) return { i: layout.displayOf.get(n[0]) ?? i, c: n[1] }
    return { i, c }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout])

  const select = useCallback((pos: Pos) => {
    const m = mergeOf(pos.i, pos.c)
    setSelected(m ? { i: layout.displayOf.get(m[0]) ?? pos.i, c: m[1] } : pos)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout])

  // A sideways scroll settles with a whole column at the frozen line: a cell cut partway reads as another number
  // ("20.00 €" for 5,220.00 €; the Experience lead, 15 November). Vertical scrolling stays smooth: a cut row doesn't
  // change what a number says. The scroll offset that puts column c at the frozen line is X[c] - FW.
  const columnEdge = useCallback((x: number, toward: 'nearest' | 'up') => {
    if (x <= 0) return 0
    const c = Math.max(fc, indexAt(X, layout.cols, x + FW))
    const lo = X[c] - FW
    const hi = c + 1 <= layout.cols ? X[c + 1] - FW : lo
    if (toward === 'up') return x <= lo + 0.5 ? lo : hi
    return x - lo <= hi - x ? lo : hi
  }, [X, FW, fc, layout.cols])

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const settle = () => {
      const max = el.scrollWidth - el.clientWidth
      const x = el.scrollLeft
      if (x <= 0 || x >= max - 1) return
      const edge = Math.min(columnEdge(x, 'nearest'), max)
      if (Math.abs(edge - x) > 0.5) el.scrollTo({ left: edge, behavior: 'smooth' })
    }
    el.addEventListener('scrollend', settle)
    return () => el.removeEventListener('scrollend', settle)
  }, [columnEdge])

  // a cell chosen near the grid's end: more rows or columns past it, so the arrow keys go on as in Excel
  useEffect(() => {
    const near = { rows: selected.i >= layout.rows - 3 ? 20 : 0, cols: selected.c >= layout.cols - 2 ? 5 : 0 }
    if (near.rows || near.cols) growBy(near.rows, near.cols)
  }, [selected, layout.rows, layout.cols, growBy])

  // keep the chosen cell in view, beside the frozen panes
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const r = cellRect(selected)
    const left = r.x - HW
    const top = r.y - HH
    if (selected.c >= fc) {
      if (left - FW < el.scrollLeft) el.scrollLeft = left - FW
      // far enough for the whole cell, to the next column edge, so the settle above has nothing to move
      else if (r.x + r.w > el.scrollLeft + el.clientWidth) el.scrollLeft = columnEdge(r.x + r.w - el.clientWidth, 'up')
    }
    if (selected.i >= fr) {
      if (top - FH < el.scrollTop) el.scrollTop = top - FH
      else if (r.y + r.h > el.scrollTop + el.clientHeight) el.scrollTop = r.y + r.h - el.clientHeight
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  const startEditing = useCallback((pos: Pos, value?: string, fromBar = false) => {
    if (!editable) return
    setEditing({ pos, value: value ?? getInput(rowOf[pos.i], pos.c), fromBar })
  }, [editable, getInput, rowOf])

  const commit = useCallback((then?: Pos) => {
    // the live edit, ended before the grid takes the focus, so the editor's blur that follows sends nothing
    const live = editingRef.current
    if (live) {
      setEditing(null)
      const row = rowOf[live.pos.i]
      // the text a cell shows as its value, or its formula shown in the bar and not changed, is no edit
      if (live.value !== getInput(row, live.pos.c) && live.value !== getFormula(row, live.pos.c)) onEdit(row, live.pos.c, live.value)
    }
    if (then) select(then)
    scroller.current?.focus()
  }, [getInput, getFormula, onEdit, rowOf, select, setEditing])

  const cancel = useCallback(() => {
    setEditing(null)
    scroller.current?.focus()
  }, [setEditing])

  useEffect(() => {
    if (!editing || editing.fromBar) return
    const el = editorRef.current
    if (!el) return
    el.focus()
    el.selectionStart = el.selectionEnd = el.value.length
  }, [editing?.pos.i, editing?.pos.c, editing?.fromBar]) // eslint-disable-line react-hooks/exhaustive-deps

  const onGridKey = (e: React.KeyboardEvent) => {
    // keys from the sort menu (a portal, but a React child of the grid) are the menu's
    if (editing || !scroller.current?.contains(e.target as Node)) return
    const move: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
    if (move[e.key]) {
      e.preventDefault()
      select(step(selected, ...move[e.key]))
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      select(step(selected, 0, e.shiftKey ? -1 : 1))
      return
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
      e.preventDefault()
      writeClipboard(selectedCell?.text ?? '')
      return
    }
    if (!editable) return
    if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
      e.preventDefault()
      readClipboard().then((text) => onEdit(selectedRow, selected.c, text.replace(/\r?\n$/, '')))
      return
    }
    if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault()
      startEditing(selected)
      return
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      if (getInput(selectedRow, selected.c) !== '') onEdit(selectedRow, selected.c, '')
      return
    }
    // a character starts an edit, also one typed with Option or AltGr (€, @, { on an Estonian keyboard)
    if (e.key.length === 1 && !e.metaKey && !(e.ctrlKey && !e.altKey)) {
      e.preventDefault()
      startEditing(selected, e.key)
    }
  }

  const posFromPoint = (clientX: number, clientY: number): Pos | null => {
    const el = scroller.current
    if (!el) return null
    const box = el.getBoundingClientRect()
    const vx = clientX - box.left
    const vy = clientY - box.top
    if (vx < HW || vy < HH) return null
    // inside the frozen panes the point is not scrolled; beyond them it is
    const sx = vx - HW < FW ? vx - HW : vx - HW + el.scrollLeft
    const sy = vy - HH < FH ? vy - HH : vy - HH + el.scrollTop
    if (sx >= TW || sy >= TH) return null
    return { i: indexAt(Y, layout.rows, sy), c: indexAt(X, layout.cols, sx) }
  }

  const onPointerDown = (e: React.MouseEvent) => {
    // a click inside the cell being edited moves its caret; it doesn't choose another cell
    // a click in the sort menu (a portal, but a React child of the grid) is the menu's
    if (e.button !== 0 || e.target === editorRef.current || !scroller.current?.contains(e.target as Node)) return
    const pos = posFromPoint(e.clientX, e.clientY)
    if (!pos) return
    if (editing) commit()
    const m = mergeOf(pos.i, pos.c)
    const target = m ? { i: layout.displayOf.get(m[0]) ?? pos.i, c: m[1] } : pos
    if (e.detail >= 2) {
      e.preventDefault()
      setSelected(target)
      startEditing(target)
      return
    }
    setSelected(target)
    scroller.current?.focus()
  }

  // ── Drawing ───────────────────────────────────────────────────────────

  const regionRange = (kind: RegionKind) => {
    const rows = kind === 'corner' || kind === 'top' ? [0, fr - 1] : [view.i0, view.i1]
    const cols = kind === 'corner' || kind === 'left' ? [0, fc - 1] : [view.c0, view.c1]
    return { i0: rows[0], i1: rows[1], c0: cols[0], c1: cols[1] }
  }

  const renderRegion = (kind: RegionKind): ReactNode[] => {
    const o = regionOrigin(kind)
    const { i0, i1, c0, c1 } = regionRange(kind)
    const out: ReactNode[] = []
    // absolute in its region, also when a tooltip or menu trigger wraps it
    const place = (x: number, y: number, w: number, h: number): CSSProperties => ({ position: 'absolute', left: x - o.x, top: y - o.y, width: w, height: h })
    const gridOn = sheet.layout.showGridLines
    const noGridRight = new Set<number>()
    for (const [k, [s0, s1]] of textBoxes.spans) for (let c = s0; c < s1; c++) noGridRight.add(k - (k % 16384) + c)

    // gridlines: one line per row and per column in view
    if (gridOn && i1 >= i0 && c1 >= c0) {
      const top = HH + Y[i0]
      const bottom = HH + Y[i1 + 1]
      const left = HW + X[c0]
      const right = HW + X[c1 + 1]
      for (let c = c0; c <= c1; c++) if (layout.colW[c]) out.push(<div key={`gv${c}`} className="sg-gridline" style={place(HW + X[c + 1] - 1, top, 1, bottom - top)} />)
      for (let i = i0; i <= i1; i++) if (layout.rowH[i]) out.push(<div key={`gh${i}`} className="sg-gridline" style={place(left, HH + Y[i + 1] - 1, right - left, 1)} />)
    }

    const drawn = new Set<number>()
    const slot = (i: number, c: number, i2: number, c2: number, r: number) => {
      const style = styleAt(i, c)
      const R = rect(i, c, i2, c2)
      const k = cellKey(r, c)
      if (style?.fill) {
        out.push(<div key={`f${k}`} className="sg-fill" style={{ ...place(R.x, R.y, R.w, R.h), background: style.fill }} />)
      } else if (gridOn) {
        for (let cc = c; cc < c2 + 1; cc++) {
          if (noGridRight.has(cellKey(r, cc))) out.push(<div key={`e${r}:${cc}`} className="sg-eraser" style={place(HW + X[cc + 1] - 1, R.y, 1, R.h - 1)} />)
        }
      }
      // borders: a merge takes its right edge from its right column and its bottom edge from its bottom row
      let b = style?.border
      if (i2 !== i || c2 !== c) {
        const right = styleAt(i, c2)?.border
        const bottom = styleAt(i2, c)?.border
        if (b || right || bottom) b = { left: b?.left, top: b?.top, right: right?.right ?? b?.right, bottom: bottom?.bottom ?? b?.bottom }
      }
      if (b && (b.left || b.right || b.top || b.bottom)) {
        out.push(
          <div
            key={`b${k}`}
            className="sg-border"
            style={{
              ...place(R.x - 1, R.y - 1, R.w + 1, R.h + 1),
              borderLeft: borderCss(b.left),
              borderRight: borderCss(b.right),
              borderTop: borderCss(b.top),
              borderBottom: borderCss(b.bottom),
            }}
          />,
        )
      }
      const cell = sheet.cells.get(k)
      if (cell && cell.text !== '') out.push(text(cell, style, R, k, place))
    }

    for (let i = Math.max(i0, 0); i <= i1; i++) {
      if (!layout.rowH[i]) continue
      const r = rowOf[i]
      for (let c = Math.max(c0, 0); c <= c1; c++) {
        if (!layout.colW[c]) continue
        const m = layout.mergeAt.get(cellKey(r, c))
        if (m !== undefined) {
          if (drawn.has(m)) continue
          drawn.add(m)
          const [mr1, mc1, mr2, mc2] = layout.merges[m]
          const a = layout.displayOf.get(mr1)
          const z = layout.displayOf.get(mr2)
          if (a === undefined || z === undefined) continue
          slot(a, mc1, z, mc2, mr1)
          continue
        }
        slot(i, c, i, c, r)
      }
    }
    // text that runs in from a cell left or right of the view
    for (const [k, [s0, s1]] of textBoxes.spans) {
      const r = Math.floor(k / 16384)
      const c = k % 16384
      const i = layout.displayOf.get(r)
      if (i === undefined || i < i0 || i > i1 || (c >= c0 && c <= c1) || s1 < c0 || s0 > c1) continue
      const cell = sheet.cells.get(k)
      if (cell) out.push(text(cell, styleAt(i, c), rect(i, c, i, c), k, place))
    }
    // comments: Excel's red corner
    for (const [r, c] of sheet.layout.comments) {
      const i = layout.displayOf.get(r)
      if (i === undefined || i < i0 || i > i1 || c < c0 || c > c1) continue
      out.push(<div key={`m${r}:${c}`} className="sg-comment" style={{ left: HW + X[c + 1] - 7 - o.x, top: HH + Y[i] - o.y }} />)
    }
    out.push(...objects(kind, place))
    if (layout.headerH) out.push(...headers(kind, place))
    if (kind === regionOfPos(selected)) {
      const R = cellRect(selected)
      // the ring reaches 1 px outside its cell; where the cell meets the region's edge (B5 beside the frozen line,
      // a first row under the headers) the region would clip that side, so the ring steps inside there
      const x0 = Math.max(R.x - 1, o.x + 1)
      const y0 = Math.max(R.y - 1, o.y + 1)
      out.push(<div key="sel" className="sg-selection" style={place(x0, y0, R.x + R.w - x0, R.y + R.h - y0)} />)
    }
    if (editing && kind === regionOfPos(editing.pos)) out.push(editor(editing.pos, place))
    if (fr && (kind === 'corner' || kind === 'top')) out.push(<div key="fh" className="sg-freeze-h" />)
    if (fc && (kind === 'corner' || kind === 'left')) out.push(<div key="fv" className="sg-freeze-v" />)
    return out
  }

  const text = (cell: CellModel, style: CellStyle | undefined, R: { x: number; y: number; w: number; h: number }, k: number, place: (x: number, y: number, w: number, h: number) => CSSProperties) => {
    const a = style?.align
    const h = horizontalOf(cell, style)
    const span = textBoxes.spans.get(k)
    let x = R.x
    let w = R.w
    if (span) {
      x = HW + X[span[0]]
      w = X[span[1] + 1] - X[span[0]]
    }
    const css: CSSProperties = {
      ...place(x, R.y, w, R.h),
      ...fontCss(style?.font, base),
      justifyContent: verticalOf(style),
      textAlign: h as CSSProperties['textAlign'],
      padding: `0 ${CELL_PADDING}px 1px`,
    }
    if (cell.color) css.color = cell.color
    if (a?.indent) css[h === 'right' ? 'paddingRight' : 'paddingLeft'] = CELL_PADDING + a.indent * 9
    const hash = textBoxes.hashes.get(k)
    let inner: ReactNode
    if (hash) inner = <span>{hash}</span>
    else if (cell.runs) {
      inner = (
        <span>
          {cell.runs.map((run, n) => (
            <span key={n} style={run.font ? fontCss({ ...style?.font, ...run.font }, base) : undefined}>
              {run.text}
            </span>
          ))}
        </span>
      )
    } else if (cell.pad) {
      inner = (
        <span>
          <span className="sg-pad">{cell.pad[0]}</span>
          {cell.text}
          <span className="sg-pad">{cell.pad[1]}</span>
        </span>
      )
    } else inner = <span>{cell.text}</span>
    let cls = 'sg-text' + (a?.wrap || h === 'justify' ? ' sg-wrap' : '')
    if (a?.rotation) {
      cls += ' sg-rot'
      if (a.rotation === 255) inner = <span className="sg-stack">{inner}</span>
      else {
        const deg = a.rotation <= 90 ? -a.rotation : a.rotation - 90
        inner = <span style={{ display: 'inline-block', whiteSpace: 'nowrap', transform: `rotate(${deg}deg)` }}>{inner}</span>
      }
    }
    return (
      <div key={`t${k}`} className={cls} style={css}>
        {inner}
      </div>
    )
  }

  const objects = (kind: RegionKind, place: (x: number, y: number, w: number, h: number) => CSSProperties): ReactNode[] => {
    const out: ReactNode[] = []
    sheet.layout.drawings.forEach((d, n) => {
      const a = d.anchor
      let x0: number
      let y0: number
      let w: number
      let h: number
      const yOf = (row: number) => Y[Math.min(layout.displayOf.get(row) ?? layout.rows, layout.rows)]
      if (a.from) {
        x0 = X[Math.min(a.from.col, layout.cols)] + a.from.colOff
        y0 = yOf(a.from.row) + a.from.rowOff
      } else if (a.pos) {
        x0 = a.pos.x
        y0 = a.pos.y
      } else return
      if (a.to) {
        w = X[Math.min(a.to.col, layout.cols)] + a.to.colOff - x0
        h = yOf(a.to.row) + a.to.rowOff - y0
      } else if (a.size) {
        w = a.size.width
        h = a.size.height
      } else return
      if (w <= 0 || h <= 0) return
      // drawn in each region it reaches
      const inCorner = x0 < FW && y0 < FH
      const reaches: Record<RegionKind, boolean> = {
        corner: inCorner,
        top: y0 < FH && x0 + w > FW,
        left: x0 < FW && y0 + h > FH,
        body: x0 + w > FW && y0 + h > FH,
      }
      if (!reaches[kind]) return
      const what = d.what === 'chart' ? 'Chart' : d.what === 'image' ? 'Picture' : 'Shape'
      const label = d.what === 'chart' && d.title ? `Chart: ${d.title}` : what
      const small = w < 160 || h < 90
      out.push(
        <div key={`o${n}`} className="sg-object" style={place(HW + x0, HH + y0, w, h)} title={`${label}. Kept in the file. Open in Excel to see it.`}>
          <Icon name={d.what === 'chart' ? 'chart-bar' : 'image'} size={16} tone="inherit" className="shrink-0" />
          {!small && (
            <div className="min-w-0">
              <div className="sg-object-label">{label}</div>
              <div className="sg-object-sub">Kept in the file. Open in Excel to see it.</div>
            </div>
          )}
        </div>,
      )
    })
    return out
  }

  const refusal = useMemo(() => sortRefusal(sheet, letters), [sheet])

  const headers = (kind: RegionKind, place: (x: number, y: number, w: number, h: number) => CSSProperties): ReactNode[] => {
    const out: ReactNode[] = []
    const { i0, i1, c0, c1 } = regionRange(kind)
    if (kind === 'corner') out.push(<div key="hc" className="sg-head" style={place(0, 0, HW, HH)} />)
    if (kind === 'corner' || kind === 'top') {
      for (let c = Math.max(0, c0); c <= c1; c++) {
        if (!layout.colW[c]) continue
        const current = c === selected.c
        const hiddenNext = c + 1 < layout.cols && !layout.colW[c + 1]
        const cls = `sg-head sg-col-head${current ? ' sg-current' : ''}${hiddenNext ? ' sg-hidden-next' : ''}${sort?.col === c ? ' sg-sorted' : ''}`
        out.push(
          <DropdownMenu key={`hx${c}`}>
            <Tooltip label={`Sort the rows by column ${letters(c)}`}>
              <DropdownMenuTrigger asChild>
                <div className={cls} style={{ ...place(HW + X[c], 0, layout.colW[c], HH), cursor: 'pointer' }} role="button" aria-label={`Column ${letters(c)}`}>
                  {letters(c)}
                  <Icon name="caret-down" size={12} tone="inherit" className="sg-caret" />
                </div>
              </DropdownMenuTrigger>
            </Tooltip>
            <DropdownMenuContent align="start" className="max-w-[300px]">
              <DropdownMenuItem disabled={!!refusal} onSelect={() => setSort({ col: c, dir: 1 })}>
                <Icon name="sort-ascending" size={14} tone="inherit" />
                <span>Sort A to Z</span>
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!!refusal} onSelect={() => setSort({ col: c, dir: -1 })}>
                <Icon name="sort-descending" size={14} tone="inherit" />
                <span>Sort Z to A</span>
              </DropdownMenuItem>
              {sort && !refusal && (
                <DropdownMenuItem onSelect={() => setSort(null)}>
                  <span>Back to the file's order</span>
                </DropdownMenuItem>
              )}
              {refusal && (
                <>
                  <div className="px-2 py-1.5 text-xs leading-[17px] text-[var(--r-ink-muted)]">{refusal}</div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={onOpenInExcel}>
                    <Icon name="arrow-square-out" size={14} tone="inherit" />
                    <span>{openInLabel}</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>,
        )
      }
    }
    if (kind === 'corner' || kind === 'left') {
      for (let i = Math.max(0, i0); i <= i1; i++) {
        if (!layout.rowH[i]) continue
        const hiddenNext = i + 1 < layout.rows && !layout.rowH[i + 1]
        out.push(
          <div
            key={`hy${i}`}
            className={`sg-head sg-row-head${i === selected.i ? ' sg-current' : ''}${hiddenNext ? ' sg-hidden-next' : ''}`}
            style={place(0, HH + Y[i], HW, layout.rowH[i])}
          >
            {rowOf[i] + 1}
          </div>,
        )
      }
    }
    return out
  }

  const editor = (pos: Pos, place: (x: number, y: number, w: number, h: number) => CSSProperties) => {
    const R = cellRect(pos)
    const style = styleAt(pos.i, pos.c)
    const css = fontCss(style?.font, base)
    const width = Math.max(R.w + 1, Math.min(600, measure(editing?.value ?? '', fontShorthand(style?.font, base)) + 12))
    return (
      <textarea
        key="editor"
        ref={editorRef}
        className="sg-editor"
        style={{
          ...place(R.x - 1, R.y - 1, width, Math.max(R.h + 1, 22)),
          ...css,
          textAlign: horizontalOf(cellAt(pos.i, pos.c), style) as CSSProperties['textAlign'],
          padding: `0 ${CELL_PADDING + 1}px`,
        }}
        value={editing?.value ?? ''}
        onChange={(e) => setEditing((ed) => (ed ? { ...ed, value: e.target.value } : ed))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.altKey && !e.shiftKey) {
            e.preventDefault()
            commit(step(pos, 1, 0))
          } else if (e.key === 'Tab') {
            e.preventDefault()
            commit(step(pos, 0, e.shiftKey ? -1 : 1))
          } else if (e.key === 'Escape') {
            e.preventDefault()
            cancel()
          }
        }}
        onBlur={() => {
          if (editingRef.current) commit()
        }}
        aria-label={`Edit ${letters(pos.c)}${rowOf[pos.i] + 1}`}
      />
    )
  }

  const reference = `${letters(selected.c)}${selectedRow + 1}`
  const barValue = editing ? editing.value : (formula ?? getInput(selectedRow, selected.c))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* the formula bar: the cell and what it holds (experience 47, frame 1); typing here edits the cell */}
      <div className="mx-4 mb-3 flex min-h-[32px] shrink-0 items-stretch rounded-md border border-[var(--r-hairline)] bg-[var(--r-surface)]">
        <span className="flex min-w-[48px] max-w-[160px] flex-none items-center border-r border-[var(--r-hairline)] px-2.5 text-xs text-[var(--r-ink-muted)]">
          <span className="truncate">{reference}</span>
        </span>
        <span className="flex items-center pl-2.5 text-[var(--r-ink-faint)]">
          <Icon name="function" size={14} tone="inherit" />
        </span>
        <textarea
          rows={1}
          aria-label={`What ${reference} holds`}
          className="h-[30px] min-h-[30px] flex-1 resize-none overflow-hidden rounded-r-md border-0 bg-transparent px-2.5 py-[5px] text-[13px] leading-5 text-[var(--r-ink-strong)] outline-none"
          value={barValue}
          readOnly={!editable}
          onFocus={() => {
            if (editable && !editingRef.current) setEditing({ pos: selected, value: formula ?? getInput(selectedRow, selected.c), fromBar: true })
          }}
          onChange={(e) => setEditing({ pos: editing?.pos ?? selected, value: e.target.value, fromBar: true })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              commit(step(selected, 1, 0))
            } else if (e.key === 'Escape') {
              e.preventDefault()
              cancel()
            }
          }}
          onBlur={() => {
            if (editingRef.current?.fromBar) commit()
          }}
        />
      </div>

      <div className="sg-paper">
        <div ref={scroller} className="sg-scroller" tabIndex={0} onScroll={onScroll} onKeyDown={onGridKey} onMouseDown={onPointerDown} aria-label={`Sheet ${sheet.name}`}>
          <div
            className="sg-canvas"
            style={{
              width: HW + TW,
              height: HH + TH,
              gridTemplateColumns: `${HW + FW}px ${Math.max(0, TW - FW)}px`,
              gridTemplateRows: `${HH + FH}px ${Math.max(0, TH - FH)}px`,
            }}
          >
            <div className="sg-region sg-corner">{renderRegion('corner')}</div>
            <div className="sg-region sg-top">{renderRegion('top')}</div>
            <div className="sg-region sg-left">{renderRegion('left')}</div>
            <div className="sg-region sg-body">{renderRegion('body')}</div>
          </div>
        </div>
      </div>

    </div>
  )
}
