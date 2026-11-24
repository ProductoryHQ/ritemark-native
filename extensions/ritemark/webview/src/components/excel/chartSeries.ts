import type { ChartData, ChartModel, ChartSeries, ChartValue } from './chartModel'
import { parseFormulaRef, referenceBounds } from './formulaRef'
import { cellKey, type CellModel, type SheetModel, type WorkbookModel } from './readWorkbook'

/**
 * Use the current cells and fill missing point indices from the chart cache.
 * Keep the range sparse, so whole rows/columns need only visit populated cells.
 */
function resolveData(data: ChartData | undefined, sheets: readonly SheetModel[], workbook: WorkbookModel): ChartData | undefined {
  if (!data?.formula) return data
  const ref = parseFormulaRef(data.formula)
  if (!ref) return data
  const name = ref.sheet?.toLowerCase() ?? workbook.sheets[workbook.activeSheet]?.name.toLowerCase()
  const sheet = sheets.find((candidate) => candidate.kind === 'worksheet' && candidate.name.toLowerCase() === name)
  if (!sheet) return data

  const { top, bottom, left, right } = referenceBounds(ref, sheet.maxR, sheet.maxC)
  const width = right - left + 1
  const count = width * (bottom - top + 1)
  const { type } = data
  const points = new Map(data.points)
  function set(index: number, cell: CellModel) {
    const value: ChartValue = type === 'string' ? cell.text : cell.value
    // A present error, blank or non-numeric cell must not show a stale numeric point.
    if (cell.kind === 'e' || (type === 'number' && typeof value !== 'number')) points.delete(index)
    else points.set(index, value)
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
  return { ...data, points, pointCount: Math.max(count, data.pointCount ?? 0) }
}

/** Resolve each plot's series in plot order, using the latest sheets supplied by the grid. */
export function resolveSeries(model: ChartModel, sheets: readonly SheetModel[], workbook: WorkbookModel): ChartSeries[][] {
  if (!model.supported) return []
  return model.plots.map(({ series }) => series.map((entry) => ({
    ...entry,
    tx: resolveData(entry.tx, sheets, workbook),
    cat: resolveData(entry.cat, sheets, workbook),
    val: resolveData(entry.val, sheets, workbook),
    xVal: resolveData(entry.xVal, sheets, workbook),
    yVal: resolveData(entry.yVal, sheets, workbook),
  })))
}
