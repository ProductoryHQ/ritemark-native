/**
 * Sprint 158 PR 3 (#711): Excel's column widths and row heights in pixels at 100 %.
 *
 * A column's width is stored in characters of the Normal font's widest digit (the "maximum digit width", MDW), and
 * Excel turns it into pixels with ECMA-376 §18.3.1.13's formula. Row heights are points. From the spike's reader.
 */
import type { FontStyle } from './excelStyles'

/** The widest digit, in pixels at 96 dpi, of an Office font at its size: known values, others scaled from Calibri. */
export function maxDigitWidth(font: Pick<FontStyle, 'name' | 'size'>): number {
  const px = (font.size * 4) / 3
  const ratio: Record<string, number> = {
    calibri: 0.507,
    carlito: 0.507,
    'aptos narrow': 0.48,
    aptos: 0.55,
    arial: 0.556,
    liberation: 0.556,
    cambria: 0.55,
    caladea: 0.55,
    'times new roman': 0.5,
  }
  return Math.max(5, Math.round(px * (ratio[String(font.name ?? '').toLowerCase()] ?? 0.507)))
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
