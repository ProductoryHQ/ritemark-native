/** Zero-based A1 references. Missing axes represent whole rows or columns. */
export interface FormulaAddress {
  row?: number
  col?: number
  absoluteRow: boolean
  absoluteCol: boolean
}

export interface FormulaRef {
  sheet?: string
  start: FormulaAddress
  end: FormulaAddress
}

export const EXCEL_ROWS = 1048576
export const EXCEL_COLS = 16384

// A token pattern shared with the rule formula lexer. Whole axes require a colon.
export const A1_TOKEN = /(?:(?:'(?:[^']|'')+'|[\p{L}_][\p{L}\p{N}_.]*)!)?(?:\$?[A-Z]{1,3}\$?[1-9]\d*(?::\$?[A-Z]{1,3}\$?[1-9]\d*)?|\$?[A-Z]{1,3}:\$?[A-Z]{1,3}|\$?[1-9]\d*:\$?[1-9]\d*)/iu

export function parseFormulaRef(source: string): FormulaRef | undefined {
  const input = source.trim().replace(/^=/, '')
  if (A1_TOKEN.exec(input)?.[0] !== input) return undefined
  const separator = input.lastIndexOf('!')
  const qualifier = separator < 0 ? undefined : input.slice(0, separator)
  const sheet = qualifier?.startsWith("'") ? qualifier.slice(1, -1).replace(/''/g, "'") : qualifier
  if (sheet && /[\[\]:]/.test(sheet)) return undefined
  const [first, last = first] = input.slice(separator + 1).split(':')
  const address = (value: string): FormulaAddress | undefined => {
    const match = /^(?:(\$?)([A-Za-z]+))?(?:(\$?)(\d+))?$/.exec(value)
    if (!match) return undefined
    const [, columnLock, letters, rowLock, digits] = match
    let col = 0
    for (const letter of letters?.toUpperCase() ?? '') col = col * 26 + letter.charCodeAt(0) - 64
    return { row: digits ? Number(digits) - 1 : undefined, col: letters ? col - 1 : undefined,
      absoluteRow: rowLock === '$', absoluteCol: columnLock === '$' }
  }
  const start = address(first)
  const end = address(last)
  if (!start || !end || [start, end].some(({ row, col }) => (row ?? 0) >= EXCEL_ROWS || (col ?? 0) >= EXCEL_COLS)) return undefined
  return { sheet, start, end }
}

export interface RefArea { top: number; left: number; bottom: number; right: number }

export function refArea(ref: FormulaRef, rowOffset = 0, colOffset = 0): RefArea | undefined {
  const { start, end } = ref
  const r1 = start.row === undefined ? 0 : start.row + (start.absoluteRow ? 0 : rowOffset)
  const r2 = end.row === undefined ? EXCEL_ROWS - 1 : end.row + (end.absoluteRow ? 0 : rowOffset)
  const c1 = start.col === undefined ? 0 : start.col + (start.absoluteCol ? 0 : colOffset)
  const c2 = end.col === undefined ? EXCEL_COLS - 1 : end.col + (end.absoluteCol ? 0 : colOffset)
  const area = { top: Math.min(r1, r2), bottom: Math.max(r1, r2), left: Math.min(c1, c2), right: Math.max(c1, c2) }
  return area.top >= 0 && area.left >= 0 && area.bottom < EXCEL_ROWS && area.right < EXCEL_COLS ? area : undefined
}
