/** Tables you can change (experience 48): where a dragged column or row lands. Plain math, in the table's coordinates. */
import type { Rect } from '../../extensions/tables/TableHandles'

/**
 * Where a dragged column or row lands, from the pointer's place along the table (in its coordinates): the nearest
 * boundary between cells, and the index it ends up at. A row never lands above the header.
 */
export function dropTarget(spans: Rect[], kind: 'column' | 'row', from: number, at: number): { to: number; line: number } {
  const start = (rect: Rect) => (kind === 'column' ? rect.left : rect.top)
  const end = (rect: Rect) => (kind === 'column' ? rect.left + rect.width : rect.top + rect.height)
  const boundaries = spans.map(start).concat(spans.length ? [end(spans[spans.length - 1])] : [])
  const first = kind === 'row' ? 1 : 0
  let best = first
  for (let index = first; index < boundaries.length; index++) {
    if (Math.abs(boundaries[index] - at) < Math.abs(boundaries[best] - at)) best = index
  }
  const to = best > from ? best - 1 : best
  return { to, line: boundaries[best] }
}
