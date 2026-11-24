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

export const EXCEL_ROWS = 1_048_576
export const EXCEL_COLS = 16_384

function endpoint(text: string): ReferenceEndpoint | undefined {
  const match = /^(?:(\$?)([a-z]{1,3}))?(?:(\$?)([1-9]\d{0,6}))?$/i.exec(text)
  if (!match || (!match[2] && !match[4])) return undefined
  const col = match[2] ? columnNumber(match[2].toUpperCase()) - 1 : undefined
  const row = match[4] ? Number(match[4]) - 1 : undefined
  if ((col !== undefined && col >= EXCEL_COLS) || (row !== undefined && row >= EXCEL_ROWS)) return undefined
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

export function referenceBounds(ref: FormulaRef, lastRow = EXCEL_ROWS - 1, lastCol = EXCEL_COLS - 1) {
  const { start, end } = ref
  return {
    top: Math.min(start.row ?? 0, end.row ?? 0),
    bottom: Math.max(start.row ?? lastRow, end.row ?? lastRow),
    left: Math.min(start.col ?? 0, end.col ?? 0),
    right: Math.max(start.col ?? lastCol, end.col ?? lastCol),
  }
}

/** Join two local references when their union is a rectangle and their edges touch. */
export function joinAdjacentRefs(first: FormulaRef, second: FormulaRef): FormulaRef | undefined {
  if (first.sheet?.toLowerCase() !== second.sheet?.toLowerCase()) return undefined
  const a = referenceBounds(first)
  const b = referenceBounds(second)
  const across = a.top === b.top && a.bottom === b.bottom && (a.right + 1 === b.left || b.right + 1 === a.left)
  const down = a.left === b.left && a.right === b.right && (a.bottom + 1 === b.top || b.bottom + 1 === a.top)
  if (!across && !down) return undefined

  const wholeColumns = first.start.row === undefined || second.start.row === undefined
  const wholeRows = first.start.col === undefined || second.start.col === undefined
  return {
    sheet: first.sheet,
    start: { row: wholeColumns ? undefined : Math.min(a.top, b.top), col: wholeRows ? undefined : Math.min(a.left, b.left), absoluteRow: false, absoluteCol: false },
    end: { row: wholeColumns ? undefined : Math.max(a.bottom, b.bottom), col: wholeRows ? undefined : Math.max(a.right, b.right), absoluteRow: false, absoluteCol: false },
  }
}

// A token pattern shared with the rule formula lexer. Whole axes require a colon.
export const A1_TOKEN = /(?:(?:'(?:[^']|'')+'|[\p{L}_][\p{L}\p{N}_.]*)!)?(?:\$?[A-Z]{1,3}\$?[1-9]\d*(?::\$?[A-Z]{1,3}\$?[1-9]\d*)?|\$?[A-Z]{1,3}:\$?[A-Z]{1,3}|\$?[1-9]\d*:\$?[1-9]\d*)/iu

export interface RefArea { top: number; left: number; bottom: number; right: number }

export function refArea(ref: FormulaRef, rowOffset = 0, colOffset = 0): RefArea | undefined {
  const shift = (endpoint: ReferenceEndpoint): ReferenceEndpoint => ({
    ...endpoint,
    row: endpoint.row === undefined ? undefined : endpoint.row + (endpoint.absoluteRow ? 0 : rowOffset),
    col: endpoint.col === undefined ? undefined : endpoint.col + (endpoint.absoluteCol ? 0 : colOffset),
  })
  const area = referenceBounds({ ...ref, start: shift(ref.start), end: shift(ref.end) })
  return area.top >= 0 && area.left >= 0 && area.bottom < EXCEL_ROWS && area.right < EXCEL_COLS ? area : undefined
}
