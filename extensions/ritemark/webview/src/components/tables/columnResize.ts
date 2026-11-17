/**
 * Tables you can change (experience 48, "Column widths"): the line between two columns dragged. Plain math, in shares of
 * the table's width (percent), so it is the same at any scale: the pointer's place is divided by the slide's scale
 * before it gets here.
 */
import { WIDTH_STEP } from '../../../../src/markdown/tableWidths'

/**
 * The widths after the line before column `boundary` (1 to columns − 1) is dragged so the column on its left is
 * `leftPercent` wide: only the two columns beside the line change, their sum stays, the left one snaps to 5 % steps,
 * and neither goes under its smallest share (`mins`: its longest word, in 5 % steps).
 */
export function resizePair(percents: number[], mins: number[], boundary: number, leftPercent: number): number[] {
  const left = boundary - 1
  const right = boundary
  if (left < 0 || right >= percents.length) return percents
  const pair = percents[left] + percents[right]
  const lowest = Math.min(Math.max(mins[left] ?? WIDTH_STEP, WIDTH_STEP), pair - WIDTH_STEP)
  const highest = Math.max(pair - Math.max(mins[right] ?? WIDTH_STEP, WIDTH_STEP), lowest)
  const snapped = Math.round(leftPercent / WIDTH_STEP) * WIDTH_STEP
  const next = percents.slice()
  next[left] = Math.min(Math.max(snapped, lowest), highest)
  next[right] = pair - next[left]
  return next
}

/** A column's smallest share: its longest word (with the cell's padding) of the table's width, up to the next 5 %. */
export function minPercent(longestWord: number, tableWidth: number): number {
  if (!(tableWidth > 0)) return WIDTH_STEP
  return Math.max(WIDTH_STEP, Math.ceil(((longestWord / tableWidth) * 100) / WIDTH_STEP) * WIDTH_STEP)
}
