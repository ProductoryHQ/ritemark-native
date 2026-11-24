let measureContext: CanvasRenderingContext2D | null = null
/** Text widths, kept while the fonts are the same: scrolling measures the same cells again and again. */
const measured = new Map<string, number>()
export function measure(text: string, font: string): number {
  const key = `${font}\u0000${text}`
  const known = measured.get(key)
  if (known !== undefined) return known
  if (typeof document === 'undefined') return text.length * 7
  if (!measureContext) measureContext = document.createElement('canvas').getContext('2d')
  if (!measureContext) return text.length * 7
  measureContext.font = font
  const width = measureContext.measureText(text).width
  if (measured.size > 50_000) measured.clear()
  measured.set(key, width)
  return width
}
/** Fonts that finished loading change widths: measure again. */
export function forgetMeasures() {
  measured.clear()
}
