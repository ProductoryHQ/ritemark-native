/**
 * Sprint 158 PR 3 (#711): Excel's column widths and row heights in pixels at 100 %.
 *
 * A column's width is stored in characters of the Normal font's widest digit (the "maximum digit width", MDW), and
 * Excel turns it into pixels with ECMA-376 §18.3.1.13's formula. Row heights are points. From the spike's reader.
 */
import type { FontStyle } from './excelStyles'

/** The widest digit, in pixels at 96 dpi (or `dpi`), of an Office font at its size: known values, others scaled from
 *  Calibri. */
export function maxDigitWidth(font: Pick<FontStyle, 'name' | 'size'>, dpi = 96): number {
  const px = (font.size * dpi) / 72
  const ratio: Record<string, number> = {
    calibri: 0.507,
    carlito: 0.507,
    'aptos narrow': 0.48,
    aptos: 0.55,
    arial: 0.556,
    liberation: 0.556,
    // Caladea, Cambria's metric twin: its digits are 517 of 1,000 units (Sprint 158 PR 4)
    cambria: 0.517,
    caladea: 0.517,
    'times new roman': 0.5,
  }
  return Math.max(dpi === 96 ? 5 : 4, Math.round(px * (ratio[String(font.name ?? '').toLowerCase()] ?? 0.507)))
}

/**
 * Which Excel the widths follow (Sprint 158 PR 4). Excel for Windows counts a column in pixels at 96 dpi, with the
 * widest digit there (Calibri 11: 7 px; a 12.5-character column is 87 px). Excel for Mac counts it in points, with the
 * widest digit at 72 dpi (Calibri 11: 6 pt; the same column is 75 pt, 100 px), and pads no default column to a
 * multiple of 8. So a file's columns are about 14% wider on a Mac, and a total that fits there shows #### on Windows.
 * Checked on the training budget against Excel for Mac's own window: columns A, B, D, E, K and the default all match.
 * The grid follows the Excel of the computer it runs on.
 */
export type ExcelGeometry = 'mac' | 'windows'

export interface ColumnScale {
  /** A stored width (characters) in pixels. */
  pixels(width: number): number
  /** A column with no width of its own: `defaultColWidth`, else `baseColWidth` (8) and padding. */
  defaultPixels(defaultColWidth: number | undefined, baseColWidth: number | undefined): number
}

export function columnScale(font: Pick<FontStyle, 'name' | 'size'>, geometry: ExcelGeometry): ColumnScale {
  if (geometry === 'mac') {
    const mdw = maxDigitWidth(font, 72)
    const px = (points: number) => Math.round((points * 4) / 3)
    return {
      pixels: (width) => px(columnPixels(width, mdw)),
      defaultPixels: (defaultColWidth, baseColWidth) =>
        px(defaultColWidth !== undefined ? columnPixels(defaultColWidth, mdw) : (baseColWidth ?? 8) * mdw + 5),
    }
  }
  const mdw = maxDigitWidth(font)
  return {
    pixels: (width) => columnPixels(width, mdw),
    defaultPixels: (defaultColWidth, baseColWidth) => defaultColumnPixels(defaultColWidth, baseColWidth, mdw),
  }
}

/** A stored column width (characters) in pixels. */
export function columnPixels(width: number, mdw: number): number {
  return Math.trunc(((256 * width + Math.trunc(128 / mdw)) / 256) * mdw)
}

/** The width of a column with no width of its own: `defaultColWidth`, else `baseColWidth` (8) plus padding, in 8s. */
export function defaultColumnPixels(defaultColWidth: number | undefined, baseColWidth: number | undefined, mdw: number): number {
  if (defaultColWidth !== undefined) return columnPixels(defaultColWidth, mdw)
  return Math.ceil(((baseColWidth ?? 8) * mdw + 5) / 8) * 8
}

/** Points to pixels at 96 dpi. */
export function pointsToPixels(points: number): number {
  return Math.round((points * 4) / 3)
}

/** The default row height when a sheet gives none: what Excel uses for the Normal font's size. */
export function defaultRowPoints(font: Pick<FontStyle, 'size'>): number {
  return font.size <= 11 ? 15 : Math.round(font.size * 1.36 * 4) / 4
}
