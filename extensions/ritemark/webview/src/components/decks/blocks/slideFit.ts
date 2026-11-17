/**
 * Sprint 161 (spike §5, PR 2): the fit of the slide being edited on the stage. Every size on a block slide is an `em`
 * of one `--fit`, 100 / 92 / 84 / 76 / 68 / 60 % (`BLOCK_FIT_STEPS`). While the words overflow, the step goes down; it
 * goes back up only when the bigger step leaves 3 % of the height free, so typing at the edge never sets it swinging.
 * Pure: the stage measures, this decides.
 */
import { BLOCK_FIT_STEPS, BLOCK_MAX_STEP } from '../../../../../src/decks/blocks/slideRenderer'

/** The words' height at a step, and the room they have. */
export interface FitMeasure {
  content: number
  room: number
}

/** Room to spare before the step goes up again: 3 % of the height. */
export const FIT_HYSTERESIS = 0.97

const overflows = (measure: FitMeasure) => measure.content > measure.room + 2

/**
 * The step for the words now, from the step they had (`current`). `measure(step)` lays the words out at that step and
 * measures them. At the floor (60 %) the words may still overflow: the step stays there.
 */
export function nextFitStep(current: number, measure: (step: number) => FitMeasure, max = BLOCK_MAX_STEP): number {
  let step = Math.max(0, Math.min(max, Math.round(current)))
  let now = measure(step)
  while (overflows(now) && step < max) {
    step++
    now = measure(step)
  }
  if (overflows(now)) return step
  while (step > 0) {
    const bigger = measure(step - 1)
    if (bigger.content > bigger.room * FIT_HYSTERESIS) break
    step--
  }
  return step
}

/**
 * PR 3 (frame 24): is the slide full at this step: its words at the floor (60 %) and still more than the slide holds.
 * Only then does the deck's bar say "This slide is full"; a slide that fits at any step never does.
 */
export function isFullAt(step: number, measure: FitMeasure, max = BLOCK_MAX_STEP): boolean {
  return step >= max && overflows(measure)
}

/** The `--fit` value of a step. */
export function fitValue(step: number): number {
  return BLOCK_FIT_STEPS[Math.max(0, Math.min(BLOCK_MAX_STEP, step))]
}

/**
 * How tall the words in a flow are: from the top of its first block to the bottom of its last, with their margins.
 * The flow's own height is fixed (it fills the slide), so its `scrollHeight` never says how much room is left.
 */
export function contentHeightOf(flow: HTMLElement): number {
  const children = Array.from(flow.children) as HTMLElement[]
  let top = Infinity
  let bottom = 0
  for (const child of children) {
    const style = getComputedStyle(child)
    // A comment on the slide (Sprint 161) is never drawn: it takes no room.
    if (style.display === 'none') continue
    top = Math.min(top, child.offsetTop - (parseFloat(style.marginTop) || 0))
    bottom = Math.max(bottom, child.offsetTop + child.offsetHeight + (parseFloat(style.marginBottom) || 0))
  }
  if (top === Infinity) return 0
  // A cover slide's words sit at the bottom (flex-end): they overflow upwards, past the top, where scrollHeight
  // doesn't see them; the blocks' own extent does.
  return Math.max(bottom - top, flow.scrollHeight > flow.clientHeight + 1 ? flow.scrollHeight : 0)
}
