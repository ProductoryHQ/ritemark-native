/**
 * Sprint 161 (spike §5, PR 2): the fit of a block slide. Every size on a block slide is an `em` of one `--fit`,
 * 100 / 92 / 84 / 76 / 68 / 60 % (`BLOCK_FIT_STEPS`). While the words overflow, the step goes down; it goes back up only
 * when the bigger step leaves 3 % of the height free, so typing at the edge never sets it swinging.
 *
 * 17 November (Jarmo's 49-slide deck: thumbnails that didn't match the stage): one measure for every view that draws a
 * block slide (`measureFlowAt`, `fitFlow`): the stage, the strip, the wall and Publish's measuring for the page. It sees
 * words past the top (a cover's title), past the bottom and past a right edge, so each view is a scaled copy of the
 * stage. The stage's own step is shared too (`setStageFit`), so its slide drawn elsewhere takes exactly that step.
 * `nextFitStep` and `isFullAt` decide, and are pure.
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

/** Is this element drawn in the words' flow (not hidden, not laid over them)? */
function inFlow(element: Element): boolean {
  const style = getComputedStyle(element)
  return style.display !== 'none' && style.position !== 'absolute' && style.position !== 'fixed'
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
    // A comment on the slide (Sprint 161) is never drawn, and the stage's own marks lie over the words: neither takes
    // room.
    if (!inFlow(child)) continue
    const style = getComputedStyle(child)
    top = Math.min(top, child.offsetTop - (parseFloat(style.marginTop) || 0))
    bottom = Math.max(bottom, child.offsetTop + child.offsetHeight + (parseFloat(style.marginBottom) || 0))
  }
  if (top === Infinity) return 0
  // A cover slide's words sit at the bottom (flex-end): they overflow upwards, past the top, where scrollHeight
  // doesn't see them; the blocks' own extent does.
  return Math.max(bottom - top, flow.scrollHeight > flow.clientHeight + 1 ? flow.scrollHeight : 0)
}

/**
 * The boxes a word can run out of sideways: a block's own lines, a box, a column, a table's cells. Words on a slide are
 * never split mid-word (17 November: "Töölauaagen|did"), so a word wider than its box is the fit's to solve, as words
 * past the bottom are.
 */
const WORD_BOXES = 'h1, h2, h3, h4, h5, h6, p, li, th, td, blockquote, .blk-box, .blk-column, .blk-steps'

/**
 * Does a word (or a table) run out of its box, or out of the slide, sideways? A box's words may not reach into its
 * padding either: a heading in a box grows to its longest word, so its right edge is compared with the box's inner
 * edge (in the slide's own pixels, whatever the scale it is drawn at).
 */
export function overflowsSideways(flow: HTMLElement): boolean {
  const room = flow.clientWidth
  for (const child of Array.from(flow.children) as HTMLElement[]) {
    if (inFlow(child) && child.offsetLeft + child.offsetWidth > room + 1) return true
  }
  const scale = (flow.getBoundingClientRect().width / (flow.offsetWidth || 1)) || 1
  for (const box of Array.from(flow.querySelectorAll<HTMLElement>(WORD_BOXES))) {
    if (box.scrollWidth > box.clientWidth + 1) return true
    const style = getComputedStyle(box)
    const inner = box.getBoundingClientRect().right - ((parseFloat(style.paddingRight) || 0) + (parseFloat(style.borderRightWidth) || 0)) * scale
    for (const child of drawnChildren(box)) {
      if (child.getBoundingClientRect().right > inner + scale) return true
    }
  }
  return false
}

/** An element's children as they are laid out: through a `display: contents` wrapper (the stage's box holds its words
 *  in one), and without what is hidden or laid over them. */
function drawnChildren(element: Element): Element[] {
  const out: Element[] = []
  for (const child of Array.from(element.children)) {
    if (getComputedStyle(child).display === 'contents') out.push(...drawnChildren(child))
    else if (inFlow(child)) out.push(child)
  }
  return out
}

/**
 * The flow measured at `step`: its `--fit` set to that step, then the words' height and the room. Words running out
 * sideways count as more than the room, so the fit steps down for them as for words past the bottom.
 */
export function measureFlowAt(flow: HTMLElement, step: number): FitMeasure {
  flow.style.setProperty('--fit', String(fitValue(step)))
  const room = flow.clientHeight
  const content = contentHeightOf(flow)
  return { content: overflowsSideways(flow) ? Math.max(content, room + 3) : content, room }
}

/**
 * The fit of a drawn flow, from the step it had (`current`; 0 for a slide drawn afresh, as the stage opens one): stepped
 * down while it overflows, up again only with room to spare (`nextFitStep`). The flow is left at the step found.
 */
export function fitFlow(flow: HTMLElement, current = 0): { step: number; full: boolean } {
  const measure = (step: number) => measureFlowAt(flow, step)
  const step = nextFitStep(current, measure)
  return { step, full: isFullAt(step, measure(step)) }
}

// ---------------------------------------------------------------------------
// The stage's step, for the other views of the same slide
// ---------------------------------------------------------------------------

/**
 * The step the stage found for the slide it shows, by what it draws (`fitKeyOf`). A thumbnail, the wall or Publish's
 * measuring of the same slide in the same look takes this step, so they match the stage even where the stage's step
 * stays put at the edge while typing (its 3 % hysteresis). Only the stage's one slide is kept.
 */
let stageFit: { key: string; step: number } | null = null
const stageFitListeners = new Set<() => void>()

/** What a fit belongs to: the slide's Markdown, its picture and place, and the look. */
export function fitKeyOf(markdown: string, image: string | undefined, picture: string | undefined, look: string): string {
  return [markdown, image ?? '', picture ?? '', look].join('\u0000')
}

/** The look part of a fit's key: Card or Borderless, and the theme. */
export function fitLookOf(borderless: boolean, theme: unknown): string {
  return `${borderless}\u0000${JSON.stringify(theme)}`
}

/** The stage tells its step; null as its slide leaves the stage. */
export function setStageFit(fit: { key: string; step: number } | null) {
  if (stageFit?.key === fit?.key && stageFit?.step === fit?.step) return
  stageFit = fit
  for (const listener of stageFitListeners) listener()
}

/** The stage's step for this key, or null when the stage shows another slide or look. */
export function stageFitFor(key: string): number | null {
  return stageFit && stageFit.key === key ? stageFit.step : null
}

/** For `useSyncExternalStore`: called whenever the stage's step changes. */
export function subscribeStageFit(listener: () => void): () => void {
  stageFitListeners.add(listener)
  return () => { stageFitListeners.delete(listener) }
}
