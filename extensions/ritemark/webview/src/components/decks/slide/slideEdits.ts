/**
 * Sprint 157: the edits typing on the slide makes to its data. Pure: each returns new data, and the deck view writes
 * it into the slide's block (`writeSlideBody`, which rewrites only the lines that changed).
 *
 * Paths are the layout's: `title`, `subtitle`, `number`, `tag`, `items.2.heading`, `items.2.text`, `rows.1.0`.
 */
import { exerciseTagOf, type SlideData, type SlideItem } from '../../../../../src/decks/deckFormat'

const ITEM_PATH = /^items\.(\d+)\.(heading|text)$/
const CELL_PATH = /^rows\.(\d+)\.(\d+)$/
/** A table starts with a heading row and one row, two columns, empty. */
const EMPTY_TABLE = [['', ''], ['', '']]

/** Words typed into a one-line place (a title, the pill, the Label row): their line breaks as spaces. */
export function oneLine(value: string): string {
  return value.replace(/[\r\n\u2028\u2029]+/g, ' ')
}

/** The deck's undo keys, as the stage and Settings' fields take them: Cmd+Z, and Cmd+Shift+Z or Cmd+Y for redo. */
export function undoKeyOf(event: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; key: string }): 'undo' | 'redo' | null {
  if (!event.metaKey && !event.ctrlKey) return null
  const key = event.key.toLowerCase()
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo'
  if (key === 'y') return 'redo'
  return null
}

export function itemPath(path: string): { index: number; field: 'heading' | 'text' } | null {
  const match = ITEM_PATH.exec(path)
  return match ? { index: Number(match[1]), field: match[2] as 'heading' | 'text' } : null
}

export function cellPath(path: string): { row: number; column: number } | null {
  const match = CELL_PATH.exec(path)
  return match ? { row: Number(match[1]), column: Number(match[2]) } : null
}

/** The words at `path`, as the slide holds them now. */
export function valueAt(data: SlideData, path: string): string {
  if (path === 'title' || path === 'subtitle' || path === 'number') return data[path] ?? ''
  if (path === 'tag') return exerciseTagOf(data)
  const item = itemPath(path)
  if (item) return data.items?.[item.index]?.[item.field] ?? ''
  const cell = cellPath(path)
  if (cell) return tableRows(data)[cell.row]?.[cell.column] ?? ''
  return ''
}

/**
 * The words at `path` set to `value`. An emptied title, subtitle or number leaves the file; an emptied pill stays as
 * `tag: ""`, no pill, since a missing line shows the default.
 */
export function setPath(data: SlideData, path: string, value: string): SlideData {
  if (path === 'title' || path === 'subtitle' || path === 'number') {
    return { ...data, [path]: value === '' ? undefined : value }
  }
  if (path === 'tag') return { ...data, tag: value }
  const item = itemPath(path)
  if (item) {
    const items: SlideItem[] = [...(data.items ?? [])]
    while (items.length <= item.index) items.push({ heading: '' })
    const next: SlideItem = { ...items[item.index], [item.field]: value }
    if (item.field === 'text' && value === '') delete next.text
    items[item.index] = next
    return { ...data, items }
  }
  const cell = cellPath(path)
  if (cell) {
    const rows = (data.rows && data.rows.length ? data.rows : EMPTY_TABLE).map(row => [...row])
    while (rows.length <= cell.row) rows.push([])
    const row = rows[cell.row]
    while (row.length <= cell.column) row.push('')
    row[cell.column] = value
    return { ...data, rows }
  }
  return data
}

/** A new empty item after `index` (Enter in a box, a point, a step). */
export function insertItemAfter(data: SlideData, index: number): SlideData {
  const items = [...(data.items ?? [])]
  items.splice(index + 1, 0, { heading: '' })
  return { ...data, items }
}

/** The item at `index` taken out (Backspace in an empty one). */
export function removeItem(data: SlideData, index: number): SlideData {
  const items = [...(data.items ?? [])]
  items.splice(index, 1)
  return { ...data, items }
}

/** Is the item at `index` empty: no heading and no text? */
export function isEmptyItem(data: SlideData, index: number): boolean {
  const item = data.items?.[index]
  return !item || (!(item.heading ?? '').trim() && !(item.text ?? '').trim())
}

export function setIcon(data: SlideData, index: number, name: string | null): SlideData {
  const items = [...(data.items ?? [])]
  while (items.length <= index) items.push({ heading: '' })
  const next: SlideItem = { ...items[index] }
  if (name) next.icon = name
  else delete next.icon
  items[index] = next
  return { ...data, items }
}

/** The table's rows as drawn: the stored rows, or the empty table a new Table slide shows. */
export function tableRows(data: SlideData): string[][] {
  return data.rows && data.rows.length ? data.rows : EMPTY_TABLE
}

/** Add a row (the slide's "Add a row"): as wide as the widest row. */
export function addRow(data: SlideData): SlideData {
  const rows = tableRows(data).map(row => [...row])
  const columns = Math.max(1, ...rows.map(row => row.length))
  rows.push(Array.from({ length: columns }, () => ''))
  return { ...data, rows }
}

/** Add a column (the slide's "Add a column"): an empty cell at the end of every row. */
export function addColumn(data: SlideData): SlideData {
  const rows = tableRows(data).map(row => [...row])
  const columns = Math.max(1, ...rows.map(row => row.length))
  return { ...data, rows: rows.map(row => [...row, ...Array.from({ length: columns + 1 - row.length }, () => '')]) }
}

/** Where Tab (or Shift+Tab) and Enter go from a cell: the next cell, or a new row past the last one. */
export function nextCell(data: SlideData, path: string, key: 'tab' | 'shift-tab' | 'enter'): { path: string; data: SlideData } | null {
  const cell = cellPath(path)
  if (!cell) return null
  const rows = tableRows(data)
  const columns = Math.max(1, ...rows.map(row => row.length))
  if (key === 'shift-tab') {
    const flat = cell.row * columns + cell.column - 1
    if (flat < 0) return null
    return { path: `rows.${Math.floor(flat / columns)}.${flat % columns}`, data }
  }
  if (key === 'tab') {
    const flat = cell.row * columns + cell.column + 1
    if (flat < rows.length * columns) return { path: `rows.${Math.floor(flat / columns)}.${flat % columns}`, data }
    return { path: `rows.${rows.length}.0`, data: addRow(data) }
  }
  if (cell.row + 1 < rows.length) return { path: `rows.${cell.row + 1}.${cell.column}`, data }
  return { path: `rows.${rows.length}.${cell.column}`, data: addRow(data) }
}
