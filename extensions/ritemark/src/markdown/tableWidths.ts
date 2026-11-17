/**
 * Tables you can change (experience 48, "Column widths"): a Markdown table's column widths, kept the way Pandoc reads
 * them, as the number of dashes in each cell of the line under the header row (`|---|--------|-----|`). The file stays
 * a plain GFM table; equal dashes everywhere mean automatic widths.
 *
 * Which tables have widths. People line tables up by eye, and AIs write a header's dashes as long as its words
 * (`| Name | Description |` over `|------|-------------|`), so unequal dashes in a file are mostly not widths. Read as
 * widths, they would change how a person's untouched tables look. So a table has widths only when all of these hold:
 *  - its dash counts are not all equal
 *  - Pandoc's own condition: a line of the table is longer than 72 characters (Pandoc's default `--columns`), so Pandoc
 *    reads the same widths from it
 *  - the line under the header isn't lined up by eye: its pipes are not where the header row's, or the first body
 *    row's, are.
 * Ritemark writes widths as 80 dashes in all (4 for every 5 %), so the line it writes is always longer than 72 and
 * (but for a header written to the same lengths, which the writer avoids) never lined up with the rows.
 *
 * Pure, with no imports: the slide renderer (host) and the editors (webview) read widths with these same functions.
 */

/** Pandoc's default `--columns`: a table with a line longer than this has the widths its dashes give. */
export const PANDOC_COLUMNS = 72
/** The dashes Ritemark writes for a table's widths in all: 4 for every 5 %. */
export const WIDTH_UNITS = 80
/** Widths snap to 5 % steps. */
export const WIDTH_STEP = 5

const DELIM_CELL = /^(\s*)(:?)(-+)(:?)(\s*)$/

/** A pipe table line's cells as written (outer pipes required), split on unescaped pipes. */
export function rowCells(line: string): string[] | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|') || trimmed.length < 2) return null
  const cells: string[] = []
  let current = ''
  for (let index = 1; index < trimmed.length - 1; index++) {
    const char = trimmed[index]
    if (char === '\\' && index + 1 < trimmed.length - 1) {
      current += char + trimmed[index + 1]
      index++
    } else if (char === '|') {
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current)
  return cells
}

/** The width units of a delimiter row's cells (the run of dashes and colons), or null when it isn't one. */
export function delimiterUnits(delimiterRow: string): number[] | null {
  const cells = rowCells(delimiterRow)
  if (!cells) return null
  const units: number[] = []
  for (const cell of cells) {
    const match = DELIM_CELL.exec(cell)
    if (!match) return null
    units.push(match[2].length + match[3].length + match[4].length)
  }
  return units
}

/** Each column's share, in 5 % steps that add up to 100, from its units. */
export function percentsOf(units: number[]): number[] {
  const total = units.reduce((sum, unit) => sum + unit, 0)
  if (!total) return units.map(() => 100 / units.length)
  return snapPercents(units.map(unit => (unit / total) * 100))
}

/** Shares snapped to 5 % steps, at least one step each, adding up to exactly 100 (largest remainders first). */
export function snapPercents(raw: number[]): number[] {
  const steps = 100 / WIDTH_STEP
  const scaled = raw.map(value => Math.max(value, 0))
  const total = scaled.reduce((sum, value) => sum + value, 0) || 1
  const wanted = scaled.map(value => (value / total) * steps)
  const result = wanted.map(value => Math.max(1, Math.floor(value)))
  let left = steps - result.reduce((sum, value) => sum + value, 0)
  const order = wanted.map((value, index) => ({ index, rest: value - Math.floor(value) })).sort((a, b) => b.rest - a.rest || a.index - b.index)
  for (let pass = 0; left > 0 && pass < 100; pass++) {
    for (const { index } of order) {
      if (left <= 0) break
      result[index]++
      left--
    }
  }
  // Too many steps (every column took its one): taken back from the widest.
  while (left < 0) {
    const widest = result.indexOf(Math.max(...result))
    if (result[widest] <= 1) break
    result[widest]--
    left++
  }
  return result.map(value => value * WIDTH_STEP)
}

/**
 * Does a table, as written (its `raw` lines: header, delimiter, body), have column widths? See the module's comment.
 */
export function tableHasWidths(raw: string): boolean {
  const lines = raw.replace(/\n+$/, '').split('\n')
  const [header, delimiter, firstBody] = lines
  if (!header || !delimiter) return false
  const units = delimiterUnits(delimiter)
  if (!units || units.length < 2 || units.every(unit => unit === units[0])) return false
  if (!lines.some(line => line.length > PANDOC_COLUMNS)) return false
  return !linedUp(delimiter, header) && !(firstBody && linedUp(delimiter, firstBody))
}

/** Are a row's pipes where the delimiter row's are (the row lined up with it by eye)? */
function linedUp(delimiter: string, row: string): boolean {
  const a = rowCells(delimiter)
  const b = rowCells(row)
  if (!a || !b || a.length !== b.length) return false
  const leadA = delimiter.length - delimiter.trimStart().length
  const leadB = row.length - row.trimStart().length
  return leadA === leadB && a.every((cell, index) => cell.length === b[index].length)
}

/** The widths a table's attributes give: its delimiter row, when it was read (or written) as having widths. */
export function widthsOf(delimiterRow: unknown, hasWidths: unknown, columns: number): number[] | null {
  if (hasWidths !== true && hasWidths !== 'true') return null
  if (typeof delimiterRow !== 'string') return null
  const units = delimiterUnits(delimiterRow)
  return units && units.length === columns ? percentsOf(units) : null
}

/**
 * A delimiter cell `units` long for an alignment, its spacing as `like` had it: the `:` marks are inside the run, so the
 * run (the width) stays as long as it was; a run too short for its marks grows to hold them and one dash.
 */
export function delimiterCellOf(units: number, align: 'left' | 'center' | 'right' | null, like?: string): string {
  const match = like ? DELIM_CELL.exec(like) : null
  const before = match ? match[1] : ''
  const after = match ? match[5] : ''
  const colons = align === 'center' ? 2 : align ? 1 : 0
  const dashes = Math.max(units - colons, 1)
  const run = (align === 'left' || align === 'center' ? ':' : '') + '-'.repeat(dashes) + (align === 'right' || align === 'center' ? ':' : '')
  return before + run + after
}

/** A delimiter cell's run with automatic widths: `---`, `:---`, `---:`, `:---:`. */
export function automaticUnits(align: 'left' | 'center' | 'right' | null): number {
  return align === 'center' ? 5 : align ? 4 : 3
}

/** The alignment a delimiter cell gives. */
export function alignOfCell(cell: string): 'left' | 'center' | 'right' | null {
  const match = DELIM_CELL.exec(cell)
  if (!match) return null
  if (match[2] && match[4]) return 'center'
  if (match[2]) return 'left'
  if (match[4]) return 'right'
  return null
}

/**
 * The delimiter row for widths (`percents`, 5 % steps adding to 100), each cell's alignment and spacing kept from the
 * row as it was (`cells`). Null `percents`: automatic widths, every cell back to the shortest run for its alignment.
 */
export function delimiterRowWithWidths(cells: string[], percents: number[] | null): string {
  const next = cells.map((cell, index) => {
    const align = alignOfCell(cell)
    if (!percents) return delimiterCellOf(automaticUnits(align), align, cell)
    return delimiterCellOf(Math.round((percents[index] / 100) * WIDTH_UNITS), align, cell)
  })
  return '|' + next.join('|') + '|'
}
