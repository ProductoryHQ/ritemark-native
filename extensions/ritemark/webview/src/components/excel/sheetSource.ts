/**
 * Sprint 158 PR 2 (#711): what the spreadsheet viewer reads a workbook through. `modelSource` is our reader's model
 * (readWorkbook.ts); `sheetJsSource` is SheetJS, for .xls and for a workbook our reader can't read.
 *
 * Rows and columns are 0-based sheet positions. The grid is anchored at A1, so its column letters and row numbers are
 * the cells' own addresses; hidden rows are left out of `rows` and named by `rowLabels`, hidden columns are left out
 * of `columns` (whose ids are the letters).
 */
import * as XLSX from 'xlsx'
import { cellValueFromText, type CellValue } from '../../../../src/excel/cellEdit'
import { cellKey, codeOf, type CellModel, type WorkbookModel } from './readWorkbook'
import { formatCellValue, inputText, valueFromInput } from './numberFormat'

export const MAX_DISPLAY_ROWS = 10000

export interface SheetView {
  columns: string[]
  rows: Record<string, unknown>[]
  /** Each row's 1-based sheet row, when they aren't simply 1, 2, 3 … */
  rowLabels?: number[]
  error?: string
}

export interface SheetSource {
  /** Our reader's model, when the workbook was read by it; the sheet grid draws from it (PR 3). */
  model?: WorkbookModel
  /** Rows and columns added to a sheet by Add row and the + column. */
  extra(sheet: string): { rows: number; cols: number }
  /** The sheets shown as tabs, in order: hidden sheets have none. */
  tabs: string[]
  /** The tab the workbook opens on. */
  initial: string
  extract(sheet: string): SheetView
  /** The cell's formula with its "=", when it has one. */
  formulaAt(sheet: string, row: number, col: number): string | undefined
  /** What the formula bar shows and an edit starts with; undefined to use the drawn text. */
  inputAt(sheet: string, row: number, col: number): string | undefined
  /** Typed text as a value for this cell (a date in a date cell's own order becomes the date). */
  valueFor(sheet: string, row: number, col: number, text: string): CellValue
  /** Write a value into the preview's copy; returns what the cell held, for `restore`. */
  write(sheet: string, row: number, col: number, value: CellValue): unknown
  restore(sheet: string, row: number, col: number, previous: unknown): void
  /** Add Row and the + column: the grid grows by one row or column. */
  widen(sheet: string, rows: number, cols: number): void
}

/** Our reader's model. */
export function modelSource(model: WorkbookModel): SheetSource {
  const byName = new Map(model.sheets.map((s) => [s.name, s]))
  const extra = new Map<string, { rows: number; cols: number }>()
  const sheetOf = (name: string) => byName.get(name)
  return {
    model,
    extra: (name) => extra.get(name) ?? { rows: 0, cols: 0 },
    tabs: model.sheets.filter((s) => s.state === 'visible').map((s) => s.name),
    initial: model.sheets[model.activeSheet].name,
    extract(name) {
      const sheet = sheetOf(name)
      if (!sheet) return { columns: [], rows: [], error: 'Sheet not found in workbook' }
      const grow = extra.get(name) ?? { rows: 0, cols: 0 }
      const lastR = sheet.maxR + grow.rows
      const lastC = sheet.maxC + grow.cols
      if (lastR < 0 || lastC < 0) return { columns: [], rows: [] }
      const cols: number[] = []
      for (let c = 0; c <= lastC; c++) if (!sheet.hiddenCols.has(c)) cols.push(c)
      const columns = cols.map((c) => XLSX.utils.encode_col(c))
      const rows: Record<string, unknown>[] = []
      const rowLabels: number[] = []
      for (let r = 0; r <= lastR && rows.length < MAX_DISPLAY_ROWS; r++) {
        if (sheet.hiddenRows.has(r)) continue
        const row: Record<string, unknown> = {}
        cols.forEach((c, i) => {
          row[columns[i]] = sheet.cells.get(cellKey(r, c))?.text ?? ''
        })
        rows.push(row)
        rowLabels.push(r + 1)
      }
      return { columns, rows, rowLabels }
    },
    formulaAt(name, row, col) {
      const f = sheetOf(name)?.cells.get(cellKey(row, col))?.formula
      return f !== undefined ? `=${f}` : undefined
    },
    inputAt(name, row, col) {
      const cell = sheetOf(name)?.cells.get(cellKey(row, col))
      if (!cell) return undefined
      if (cell.kind === 'e') return String(cell.value)
      return inputText(cell.value as CellValue | boolean, codeOf(model, cell.s), model.date1904)
    },
    valueFor(name, row, col, text) {
      const cell = sheetOf(name)?.cells.get(cellKey(row, col))
      return valueFromInput(text, cell ? codeOf(model, cell.s) : 'General', model.date1904)
    },
    write(name, row, col, value) {
      const sheet = sheetOf(name)
      if (!sheet) return undefined
      const key = cellKey(row, col)
      const previous = sheet.cells.get(key)
      if (value === null || value === '') {
        // a cleared cell keeps its style (its fill and borders) but holds nothing; its formula is gone
        if (previous?.s) sheet.cells.set(key, { kind: 'n', value: '', text: '', s: previous.s })
        else sheet.cells.delete(key)
        return previous
      }
      const s = previous?.s ?? 0
      const out = formatCellValue(value, codeOf(model, s), model.date1904)
      const cell: CellModel = { kind: typeof value === 'number' ? 'n' : 's', value, text: out.text, s }
      if (out.color) cell.color = out.color
      sheet.cells.set(key, cell)
      if (row > sheet.maxR) sheet.maxR = row
      if (col > sheet.maxC) sheet.maxC = col
      return previous
    },
    restore(name, row, col, previous) {
      const sheet = sheetOf(name)
      if (!sheet) return
      const key = cellKey(row, col)
      if (previous) sheet.cells.set(key, previous as CellModel)
      else sheet.cells.delete(key)
    },
    widen(name, rows, cols) {
      const sheet = sheetOf(name)
      if (!sheet) return
      const grow = extra.get(name) ?? { rows: 0, cols: 0 }
      // an empty sheet starts with A1
      if (sheet.maxR < 0 && grow.rows === 0 && grow.cols === 0) {
        extra.set(name, { rows: 1, cols: 1 })
        return
      }
      extra.set(name, { rows: grow.rows + rows, cols: grow.cols + cols })
    },
  }
}

/** SheetJS: .xls, and a workbook our reader can't read. Values as SheetJS formats them; every sheet is a tab. */
export function sheetJsSource(workbook: XLSX.WorkBook): SheetSource {
  const sheetOf = (name: string) => workbook.Sheets[name]
  return {
    extra: () => ({ rows: 0, cols: 0 }),
    tabs: [...workbook.SheetNames],
    initial: workbook.SheetNames[0],
    extract(name) {
      const worksheet = sheetOf(name)
      if (!worksheet) return { columns: [], rows: [], error: 'Sheet not found in workbook' }
      const ref = worksheet['!ref']
      if (!ref) return { columns: [], rows: [] }
      const range = XLSX.utils.decode_range(ref)
      const columns: string[] = []
      for (let c = 0; c <= range.e.c; c++) columns.push(XLSX.utils.encode_col(c))
      // anchored at A1 (blank rows kept, the first row not taken as a header) so indexes are addresses
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
        header: 1,
        defval: '',
        blankrows: true,
        raw: false,
        range: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: range.e }),
      })
      let rows = aoa.map((cells) => {
        const row: Record<string, unknown> = {}
        columns.forEach((col, i) => {
          row[col] = cells[i] ?? ''
        })
        return row
      })
      if (rows.length > MAX_DISPLAY_ROWS) rows = rows.slice(0, MAX_DISPLAY_ROWS)
      return { columns, rows }
    },
    formulaAt(name, row, col) {
      const cell = sheetOf(name)?.[XLSX.utils.encode_cell({ r: row, c: col })]
      return cell?.f ? `=${cell.f}` : undefined
    },
    inputAt() {
      return undefined
    },
    valueFor(_name, _row, _col, text) {
      return cellValueFromText(text)
    },
    write(name, row, col, value) {
      const worksheet = sheetOf(name)
      if (!worksheet) return undefined
      const addr = XLSX.utils.encode_cell({ r: row, c: col })
      const previous = worksheet[addr]
      if (value === null || value === '') {
        delete worksheet[addr]
        return previous
      }
      worksheet[addr] = typeof value === 'number' ? { t: 'n', v: value } : { t: 's', v: value }
      const range = XLSX.utils.decode_range(worksheet['!ref'] || addr)
      range.s.r = Math.min(range.s.r, row)
      range.s.c = Math.min(range.s.c, col)
      range.e.r = Math.max(range.e.r, row)
      range.e.c = Math.max(range.e.c, col)
      worksheet['!ref'] = XLSX.utils.encode_range(range)
      return previous
    },
    restore(name, row, col, previous) {
      const worksheet = sheetOf(name)
      if (!worksheet) return
      const addr = XLSX.utils.encode_cell({ r: row, c: col })
      if (previous) worksheet[addr] = previous as XLSX.CellObject
      else delete worksheet[addr]
    },
    widen(name, rows, cols) {
      const worksheet = sheetOf(name)
      if (!worksheet) return
      const ref = worksheet['!ref']
      if (!ref) {
        worksheet['!ref'] = 'A1'
        return
      }
      const range = XLSX.utils.decode_range(ref)
      range.e.r += rows
      range.e.c += cols
      worksheet['!ref'] = XLSX.utils.encode_range(range)
    },
  }
}
