import type { ChartData, ChartModel, ChartSeries, ChartValue } from './chartModel'
import { parseFormulaRef, referenceBounds } from './formulaRef'
import { cellKey, codeOf, type CellModel, type SheetModel, type WorkbookModel } from './readWorkbook'

/**
 * Use the current cells when the reference can be read.
 * Keep the range sparse, so whole rows/columns need only visit populated cells.
 */
function resolveData(data: ChartData | undefined, sheets: readonly SheetModel[], workbook: WorkbookModel, role?: 'cat' | 'tx'): ChartData | undefined {
  if (!data?.formula) return data
  const ref = parseFormulaRef(data.formula)
  if (!ref) return data
  const name = ref.sheet?.toLowerCase() ?? workbook.sheets[workbook.activeSheet]?.name.toLowerCase()
  const sheet = sheets.find((candidate) => candidate.kind === 'worksheet' && candidate.name.toLowerCase() === name)
  if (!sheet) return data

  const { top, bottom, left, right } = referenceBounds(ref, sheet.maxR, sheet.maxC)
  const width = right - left + 1
  const count = width * (bottom - top + 1)
  // For two-dimensional categories, preserve the cache's level order and point indices.
  if (role === 'cat' && width > 1 && bottom > top) return data

  const { type, formatCode } = data
  const points = new Map<number, ChartValue>()
  let sourceFormat: string | undefined
  let formatIndex = Infinity
  function set(index: number, cell: CellModel) {
    if (cell.kind === 'e' || cell.value === '') return
    const value = type === 'string' || (role && typeof cell.value !== 'number') ? cell.text : cell.value
    if (type === 'number' && !role && typeof value !== 'number') return
    points.set(index, value)
    if (formatCode === undefined && typeof cell.value === 'number' && index < formatIndex) {
      sourceFormat = codeOf(workbook, cell.s)
      formatIndex = index
    }
  }
  if (count <= sheet.cells.size) {
    for (let row = top; row <= bottom; row++) {
      for (let col = left; col <= right; col++) {
        const cell = sheet.cells.get(cellKey(row, col))
        if (cell) set((row - top) * width + col - left, cell)
      }
    }
  } else {
    const stride = cellKey(1, 0)
    for (const [key, cell] of sheet.cells) {
      const row = Math.floor(key / stride)
      const col = key % stride
      if (row >= top && row <= bottom && col >= left && col <= right) set((row - top) * width + col - left, cell)
    }
  }
  return { ...data, points, pointCount: count, formatCode: data.formatCode ?? sourceFormat }
}

/** Resolve each plot's series in plot order, using the latest sheets supplied by the grid. */
export function resolveSeries(model: ChartModel, sheets: readonly SheetModel[], workbook: WorkbookModel): ChartSeries[][] {
  if (!model.supported) return []
  return model.plots.map(({ series }) => series.map((entry) => ({
    ...entry,
    tx: resolveData(entry.tx, sheets, workbook, 'tx'),
    cat: resolveData(entry.cat, sheets, workbook, 'cat'),
    val: resolveData(entry.val, sheets, workbook),
    xVal: resolveData(entry.xVal, sheets, workbook),
    yVal: resolveData(entry.yVal, sheets, workbook),
  })))
}
