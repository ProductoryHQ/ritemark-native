/**
 * Sprint 158 PR 2 (#711): a cell's value as Excel shows it, by its number format, and typed text back into a value.
 *
 * numfmt (MIT) formats with Excel's own rules. SheetJS's formatter threw on day-first date codes such as
 * `dd.mm.yyyy`, the format Estonian workbooks use, and the grid showed `1/3/26` for 03.01.2026.
 */
import * as numfmt from 'numfmt'
import { cellValueFromText, type CellValue } from '../../../../src/excel/cellEdit'

/** Excel's built-in format codes that numfmt doesn't know by id. */
const BUILT_IN: Record<number, string> = {
  0: 'General',
  1: '0',
  2: '0.00',
  3: '#,##0',
  4: '#,##0.00',
  9: '0%',
  10: '0.00%',
  11: '0.00E+00',
  12: '# ?/?',
  13: '# ??/??',
  14: 'mm-dd-yy',
  15: 'd-mmm-yy',
  16: 'd-mmm',
  17: 'mmm-yy',
  18: 'h:mm AM/PM',
  19: 'h:mm:ss AM/PM',
  20: 'h:mm',
  21: 'h:mm:ss',
  22: 'm/d/yy h:mm',
  37: '#,##0 ;(#,##0)',
  38: '#,##0 ;[Red](#,##0)',
  39: '#,##0.00;(#,##0.00)',
  40: '#,##0.00;[Red](#,##0.00)',
  45: 'mm:ss',
  46: '[h]:mm:ss',
  47: 'mmss.0',
  48: '##0.0E+0',
  49: '@',
}

/** The format code for a numFmtId: the workbook's own, else Excel's built-in one, else General. */
export function formatCode(id: number, custom: ReadonlyMap<number, string>): string {
  return custom.get(id) ?? BUILT_IN[id] ?? numfmt.getFormatFromId?.(id) ?? 'General'
}

const OPTIONS = { locale: 'en', throws: false, leap1900: true, nbsp: false } as const

/** Days between the 1904 and the 1900 date systems. */
const DATE_1904_OFFSET = 1462

export interface FormattedValue {
  text: string
  /** A colour the format asks for ([Red] …), as CSS. */
  color?: string
}

/** A cell's text as Excel draws it. Numbers that can't be formatted fall back to their plain digits. */
export function formatCellValue(value: CellValue | boolean, code: string, date1904 = false): FormattedValue {
  if (value === null || value === '') return { text: '' }
  if (typeof value === 'boolean') return { text: value ? 'TRUE' : 'FALSE' }
  if (typeof value === 'string') {
    // a text section (`…;…;…;@`) applies to text; any other format leaves it as it is
    if (code !== 'General' && code.includes('@')) {
      const out = numfmt.format(code, value, OPTIONS)
      return { text: typeof out === 'string' ? out : value }
    }
    return { text: value }
  }
  const isDate = numfmt.isDateFormat(code)
  const v = isDate && date1904 ? value + DATE_1904_OFFSET : value
  const out = numfmt.format(code, v, OPTIONS)
  const text = typeof out === 'string' ? out : String(value)
  const colour = /\[(red|blue|green|black|white|yellow|magenta|cyan|color\s*\d+)\]/i.test(code)
    ? numfmt.formatColor(code, v, OPTIONS)
    : null
  return colour && typeof colour === 'string' ? { text, color: EXCEL_COLOURS[colour.toLowerCase()] ?? colour } : { text }
}

/** Excel's named format colours, which differ from CSS's names ([Green] is #00FF00, CSS green #008000). */
const EXCEL_COLOURS: Record<string, string> = {
  black: '#000000',
  blue: '#0000FF',
  cyan: '#00FFFF',
  green: '#00FF00',
  magenta: '#FF00FF',
  red: '#FF0000',
  white: '#FFFFFF',
  yellow: '#FFFF00',
}

export function isDateCode(code: string): boolean {
  return numfmt.isDateFormat(code)
}

/**
 * What a cell shows in the formula bar and starts an edit with, as Excel does: a plain number as its digits
 * (1450, not "1,450.00 €"), a percentage with its sign (25%), a date in the cell's own date format.
 */
export function inputText(value: CellValue | boolean, code: string, date1904 = false): string {
  if (value === null) return ''
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (typeof value === 'string') return value
  if (isDateCode(code)) return formatCellValue(value, code, date1904).text
  if (numfmt.isPercentFormat(code)) return `${+(value * 100).toPrecision(15)}%`
  return String(+value.toPrecision(15))
}

/** The order of day, month and year in a date format code, from where each first appears. */
function dateOrder(code: string): Array<'d' | 'm' | 'y'> | null {
  const plain = code.replace(/"[^"]*"|\[[^\]]*\]|\\./g, '').toLowerCase()
  const at = (ch: string) => plain.indexOf(ch)
  const d = at('d')
  const y = at('y')
  // the first m that isn't a minute (after h, before s)
  let m = -1
  for (let i = 0; i < plain.length; i++) {
    if (plain[i] !== 'm') continue
    const before = plain.slice(0, i).replace(/[^a-z]/g, '')
    const after = plain.slice(i).replace(/[^a-z]/g, '')
    if (/h$/.test(before.replace(/m+$/, '')) || /^m*s/.test(after)) continue
    m = i
    break
  }
  const parts = [['d', d], ['m', m], ['y', y]].filter(([, i]) => (i as number) >= 0) as Array<['d' | 'm' | 'y', number]>
  if (parts.length < 2) return null
  return parts.sort((a, b) => a[1] - b[1]).map(([k]) => k)
}

/** Serial day of a date in the 1900 system (1 = 1 January 1900, with Excel's 29 February 1900). */
function serialOf(year: number, month: number, day: number): number | null {
  const time = Date.UTC(year, month - 1, day)
  const check = new Date(time)
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null
  const days = Math.round((time - Date.UTC(1899, 11, 30)) / 86_400_000)
  // Excel counts a 29 February 1900 that never was: before March 1900 its serials are one lower (Codex on #724)
  return days < 61 ? days - 1 : days
}

/**
 * Typed text as a value for a cell with this format: a date typed in a date cell's own order (03.01.2026 in a
 * dd.mm.yyyy cell) becomes the date, a percentage in a percent cell becomes its fraction, and anything else is read
 * as the editor always has (a number when it reads as one, otherwise text).
 */
export function valueFromInput(text: string, code: string, date1904 = false): CellValue {
  const trimmed = text.trim()
  // a time or a duration typed in a time cell (8:30, 36:00, 8:30:15) is a fraction of a day
  const time = /^(\d{1,5}):([0-5]\d)(?::([0-5]\d))?$/.exec(trimmed)
  if (time && isDateCode(code) && /h/i.test(code.replace(/"[^"]*"/g, ''))) {
    return (Number(time[1]) + Number(time[2]) / 60 + Number(time[3] ?? 0) / 3600) / 24
  }
  if (isDateCode(code) && trimmed) {
    const order = dateOrder(code)
    const parts = trimmed.split(/[./\-\s]+/)
    if (order && parts.length === order.length && parts.every((p) => /^\d{1,4}$/.test(p))) {
      const get = (k: 'd' | 'm' | 'y') => Number(parts[order.indexOf(k)])
      let year = order.includes('y') ? get('y') : new Date().getFullYear()
      if (year < 100) year += year < 30 ? 2000 : 1900
      const serial = serialOf(year, order.includes('m') ? get('m') : 1, order.includes('d') ? get('d') : 1)
      if (serial !== null) return date1904 ? serial - DATE_1904_OFFSET : serial
    }
  }
  if (numfmt.isPercentFormat(code) && /^-?\d+(\.\d+)?\s*%$/.test(trimmed)) {
    return Number(trimmed.replace(/\s*%$/, '')) / 100
  }
  return cellValueFromText(text)
}
