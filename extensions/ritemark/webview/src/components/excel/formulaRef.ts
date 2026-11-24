import { columnNumber } from '../../../../src/excel/sheetXml'

export interface ReferenceEndpoint {
  row?: number
  col?: number
  absoluteRow: boolean
  absoluteCol: boolean
}

export interface FormulaRef {
  sheet?: string
  start: ReferenceEndpoint
  end: ReferenceEndpoint
}

const MAX_ROWS = 1_048_576
const MAX_COLS = 16_384

function endpoint(text: string): ReferenceEndpoint | undefined {
  const match = /^(?:(\$?)([a-z]{1,3}))?(?:(\$?)([1-9]\d{0,6}))?$/i.exec(text)
  if (!match || (!match[2] && !match[4])) return undefined
  const col = match[2] ? columnNumber(match[2].toUpperCase()) - 1 : undefined
  const row = match[4] ? Number(match[4]) - 1 : undefined
  if ((col !== undefined && col >= MAX_COLS) || (row !== undefined && row >= MAX_ROWS)) return undefined
  return { row, col, absoluteRow: match[3] === '$', absoluteCol: match[1] === '$' }
}

/** Parse a local A1 reference. Coordinates are zero-based and retain their anchoring for rules. */
export function parseFormulaRef(formula: string): FormulaRef | undefined {
  const match = /^=?(?:(?:'((?:[^']|'')+)'|([^\s!'\[\]:]+))!)?([^!:]+)(?::([^!:]+))?$/.exec(formula.trim())
  if (!match) return undefined
  const sheet = match[1]?.replace(/''/g, "'") ?? match[2]
  if (sheet !== undefined && /[\[\]:]/.test(sheet)) return undefined
  const start = endpoint(match[3])
  const end = match[4] ? endpoint(match[4]) : start
  if (!start || !end) return undefined
  if ((start.row === undefined) !== (end.row === undefined) || (start.col === undefined) !== (end.col === undefined)) return undefined
  if (!match[4] && (start.row === undefined || start.col === undefined)) return undefined
  return { sheet, start, end }
}

export function referenceBounds(ref: FormulaRef, lastRow = MAX_ROWS - 1, lastCol = MAX_COLS - 1) {
  const { start, end } = ref
  return {
    top: Math.min(start.row ?? 0, end.row ?? 0),
    bottom: Math.max(start.row ?? lastRow, end.row ?? lastRow),
    left: Math.min(start.col ?? 0, end.col ?? 0),
    right: Math.max(start.col ?? lastCol, end.col ?? lastCol),
  }
}
