/**
 * README items 17 and 19 (experience 46, 18 November): how one slide becomes the next on the wall.
 *
 *  - 19, the deck's transition: Fade (the default, 0.3 s), Push (0.4 s, to the left going on and to the right going
 *    back), Zoom (the new slide grows from 96 % as it fades in, 0.35 s) or None (a cut). One for the deck, in its front
 *    matter (`transition: push`), chosen in the Theme menu's TRANSITION.
 *  - 17, the smooth move: when the next slide has the same title text, the same picture file, or a block of the same
 *    type with the same item headings, those glide and resize to their new place in 0.4 s, easing out, and everything
 *    else cross-fades. Where things match, the move takes the place of the deck's transition for that step.
 *  - A press during a transition or a move jumps it to its end at once and goes on (`MotionRun.finish`), so a press
 *    never waits.
 *  - Reduced motion means None, whatever the deck says (`stepOf`). A deck whose transition is None never moves: no glide
 *    either, even where elements match.
 *
 * Pure but for the reading of a drawn slide (`motionKeysOf`, which takes the elements it is given), so the tests drive
 * the same rules the wall runs. The drawing of a step is `playMotion.ts`.
 */

import { transitionOf, type DeckTransition } from '../../../../../src/decks/present/deckTransition'

/** The deck's transition (`transition:` in its front matter), one list with the host's (`deckTransition.ts`). */
export { transitionOf, type DeckTransition }

/** What one step on the wall does: the deck's transition, or the smooth move where elements match. */
export type MotionStep = DeckTransition | 'move'

/** Going on (the next slide, a later number) or back. */
export type MotionDirection = 'next' | 'back'

/** The Theme menu's TRANSITION, in its order; Fade first, as the default. */
export const DECK_TRANSITIONS: ReadonlyArray<{ value: DeckTransition; label: string }> = [
  { value: 'fade', label: 'Fade' },
  { value: 'push', label: 'Push' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'none', label: 'None' },
]
export const DECK_TRANSITION_TIP = 'How one slide becomes the next when you present: choosing one plays it on the slide'

/** Each step's length in ms (README 17 and 19). */
export const MOTION_MS: Readonly<Record<MotionStep, number>> = { fade: 300, push: 400, zoom: 350, none: 0, move: 400 }
/** In a smooth move, what doesn't match cross-fades as the deck's Fade does. */
export const MOVE_FADE_MS = MOTION_MS.fade
/** Zoom's new slide starts at this size. */
export const ZOOM_FROM = 0.96

/** The wall's easings: out for an arrival and the smooth move, in-and-out for Push. */
export const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)'
export const EASE_IN_OUT = 'cubic-bezier(0.65, 0, 0.35, 1)'

/**
 * README item 20, the content arriving in a row (the published page plays it, Sprint 163 PR 4): the slide before leaves
 * as one in `leaveMs`; the new slide's pieces come `gap` ms apart (with more than eight, closer, never under `minGap`,
 * within `span`; from the `last + 1`th piece on, together), each in `ms`, rising `rise` px (Fade) or growing from `zoom`
 * (Zoom); in Push they come on the slide's heels, `pushGap` ms apart.
 */
export const ROW = { gap: 70, minGap: 28, span: 480, last: 13, ms: 480, rise: 14, zoom: 0.92, leaveMs: 150, pushGap: 30 } as const

/** README item 18: an item shown by → arrives in 0.2 s, rising this far (on the 960 slide) as it fades in. */
export const REVEAL_MS = 200
export const REVEAL_RISE = 8

/**
 * Whether an item a press shows rises in (README item 18, the Experience lead, 18 November): not with reduced motion,
 * not under a blank or filled wall, and not in a deck whose transition is None, which asks for stillness throughout. In
 * each of those the item appears at once.
 */
export function revealRises(transition: DeckTransition, reducedMotion: boolean, covered: boolean): boolean {
  return !reducedMotion && !covered && transition !== 'none'
}

/**
 * The items that arrive with a state from the host (README item 18): those from the step before up to the step now, on
 * the same slide, when a press showed the next item (one more). Null for another slide (its transition draws it), a
 * step back (the item hides at once), no step, or a jump that shows the slide whole (the go-to box, End, the row on the
 * slide already shown: whole at once, nothing rises). Whether it rises at all is `revealRises`.
 */
export function revealArrivals(before: { shown: number } | null, now: { shown: number } | null, sameSlide: boolean): { from: number; to: number } | null {
  if (!sameSlide || !before || !now || now.shown !== before.shown + 1) return null
  return { from: before.shown, to: now.shown }
}

/**
 * The front-matter change for a choice: Fade writes nothing (the line taken out), any other writes `transition: <it>`.
 * As `{ present, value }`, the shape the deck's property steps carry (`theme/themePick.ts`).
 */
export function transitionValue(transition: DeckTransition): { present: true; value: DeckTransition } | { present: false } {
  return transition === 'fade' ? { present: false } : { present: true, value: transition }
}

/**
 * What a step does: nothing moves with reduced motion, or while the wall is covered (blank, the page's QR code, a picture
 * filling it: `still`), or in a deck whose transition is None (a cut, with no glide and no fade, even where elements
 * match: README item 19, the Experience lead, 18 November); where elements match, the smooth move; else the deck's own.
 */
export function stepOf(transition: DeckTransition, still: boolean, matched: boolean): MotionStep {
  if (still || transition === 'none') return 'none'
  if (matched) return 'move'
  return transition
}

/** A later slide is going on; an earlier one is going back (so Push moves the other way). */
export function directionOf(fromNumber: number, toNumber: number): MotionDirection {
  return toNumber < fromNumber ? 'back' : 'next'
}

/** README 19's preview on the stage (`TransitionPreview`). */
/**
 * The slide a preview goes to from the one at `index`, and which way: the next slide shown, else the one before, never
 * a skipped one (the wall's Next never shows it); null when the deck has no other slide shown.
 */
export function previewTarget<T extends { data: { skip?: unknown } }>(slides: readonly T[], index: number): { to: T; direction: MotionDirection } | null {
  const after = slides.slice(index + 1).find(slide => slide.data.skip !== true)
  if (after) return { to: after, direction: 'next' }
  const before = slides.slice(0, Math.max(0, index)).reverse().find(slide => slide.data.skip !== true)
  return before ? { to: before, direction: 'back' } : null
}

// ---------------------------------------------------------------------------------------------------------------------
// The one run at a time, and a press during it
// ---------------------------------------------------------------------------------------------------------------------

/** The clock a run uses: the window's timers on the wall, fake ones in the test. */
export interface MotionClock {
  setTimeout: (run: () => void, ms: number) => number
  clearTimeout: (id: number) => void
}

/** The part of a run that draws: the animations it started, finished at once on a jump. */
export interface MotionDrawing {
  /** Put every element at its end, at once. */
  finish: () => void
}

/**
 * The wall's step in progress, one at a time. `begin` starts one, ending any before it at its end first; `finish` (a
 * press, or the next slide arriving) jumps the running one to its end at once and calls its `onEnd`, so whatever comes
 * next starts from the slide fully shown. A step ends exactly once, at its time or at a jump, whichever comes first.
 */
export class MotionRun {
  private current: { timer: number; drawing: MotionDrawing | null; onEnd: () => void } | null = null

  constructor(private readonly clock: MotionClock) {}

  get running(): boolean {
    return this.current !== null
  }

  begin(ms: number, drawing: MotionDrawing | null, onEnd: () => void): void {
    this.finish()
    if (ms <= 0) {
      drawing?.finish()
      onEnd()
      return
    }
    const run = { timer: 0, drawing, onEnd }
    run.timer = this.clock.setTimeout(() => {
      if (this.current !== run) return
      this.current = null
      // At its time too: what the step added (the smooth move's copy) is taken away, each element left at its end.
      drawing?.finish()
      onEnd()
    }, ms)
    this.current = run
  }

  /** Jump the running step to its end at once; true when one was running. */
  finish(): boolean {
    const run = this.current
    if (!run) return false
    this.current = null
    this.clock.clearTimeout(run.timer)
    run.drawing?.finish()
    run.onEnd()
    return true
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Which elements match between two slides (README 17)
// ---------------------------------------------------------------------------------------------------------------------

/** The part of a DOM element the matching reads: real elements on the wall, domino's in the test. */
export interface MotionElement {
  readonly tagName: string
  readonly textContent: string | null
  readonly children: ArrayLike<MotionElement> | HTMLCollection
  getAttribute(name: string): string | null
  querySelector(selector: string): MotionElement | null
  querySelectorAll(selector: string): ArrayLike<MotionElement> | NodeListOf<Element>
  contains(other: MotionElement | Node | null): boolean
  readonly classList: { contains(name: string): boolean }
}

/** What kind of element a key names: the title, a picture, or a block. */
export type MotionKeyKind = 'title' | 'picture' | 'block'

/** One element a slide may share with the next, by what makes it the same. */
export interface MotionKey<E = MotionElement> {
  /** The same on both slides when the element is the same: `title:Agenda`, `picture:<file>#1`, `block:boxes:[…]#1`. */
  key: string
  kind: MotionKeyKind
  element: E
}

/** Words as the person reads them: runs of white space as one, trimmed. */
function words(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim()
}

const HEADING = /^H[1-6]$/

function childElements<E extends MotionElement>(element: E): E[] {
  return Array.from(element.children as ArrayLike<E>)
}

/** An item's heading: its first heading's words, else its leading bold words, else its words. */
function itemHeading(item: MotionElement): string {
  for (const child of childElements(item)) {
    if (HEADING.test(child.tagName.toUpperCase())) return words(child.textContent)
  }
  const first = childElements(item)[0]
  if (first && first.tagName.toUpperCase() === 'STRONG') return words(first.textContent)
  return words(item.textContent)
}

/** A block's type and its items' headings, or null for an element that isn't a block of items. */
function blockOf(element: MotionElement): { type: string; headings: string[] } | null {
  const tag = element.tagName.toUpperCase()
  const items = (type: string, list: MotionElement[]) => ({ type, headings: list.map(itemHeading) })
  if (element.classList.contains('blk-boxes')) return items('boxes', childElements(element).filter(child => child.classList.contains('blk-box')))
  if (element.classList.contains('blk-columns')) return items('columns', childElements(element).filter(child => child.classList.contains('blk-column')))
  if (element.classList.contains('blk-steps')) {
    const list = childElements(element).find(child => /^(OL|UL)$/.test(child.tagName.toUpperCase()))
    return items('steps', list ? childElements(list).filter(child => child.tagName.toUpperCase() === 'LI') : [])
  }
  if (tag === 'UL' || tag === 'OL') return items('list', childElements(element).filter(child => child.tagName.toUpperCase() === 'LI'))
  if (tag === 'TABLE') return { type: 'table', headings: Array.from(element.querySelectorAll('th') as ArrayLike<MotionElement>).map(cell => words(cell.textContent)) }
  return null
}

/** A picture's file, by the address the wall draws it from (one file, one address), or null. */
function pictureAddressOf(element: MotionElement): string | null {
  if (element.classList.contains('empty')) return null
  if (element.classList.contains('photo')) {
    const style = element.getAttribute('style') ?? ''
    const url = /background-image:\s*url\((["']?)(.*?)\1\)/i.exec(style)
    return url && url[2] ? url[2] : null
  }
  const image = element.tagName.toUpperCase() === 'IMG' ? element : element.querySelector('img')
  const source = image?.getAttribute('src')
  return source ? source : null
}

/**
 * The elements of one drawn slide (its `.deck-sl` canvas, or anything holding it) that can match the next slide's: its
 * title (the first heading at the top of its flow), its pictures (in the flow and beside or behind it) and its blocks
 * of items (boxes, columns, steps, lists, tables) with at least one heading. A key that repeats on the slide is
 * numbered, so the second of two same pictures matches the second.
 */
export function motionKeysOf<E extends MotionElement>(root: E): MotionKey<E>[] {
  const keys: MotionKey<E>[] = []
  const seen = new Map<string, number>()
  const add = (kind: MotionKeyKind, base: string, element: E) => {
    const count = (seen.get(base) ?? 0) + 1
    seen.set(base, count)
    keys.push({ key: `${base}#${count}`, kind, element })
  }
  const flows = Array.from(root.querySelectorAll('.blk-flow') as ArrayLike<E>)
  const flow = flows[0]
  if (flow) {
    const first = childElements(flow).find(child => HEADING.test(child.tagName.toUpperCase()))
    if (first && /^H[12]$/.test(first.tagName.toUpperCase())) {
      const title = words(first.textContent)
      if (title) add('title', `title:${title}`, first)
    }
    for (const element of Array.from(flow.querySelectorAll('.blk-boxes, .blk-columns, .blk-steps, ul, ol, table') as ArrayLike<E>)) {
      // A list inside a block of steps is the block's own.
      if (/^(UL|OL)$/.test(element.tagName.toUpperCase()) && hasAncestorClass(element, flow, 'blk-steps')) continue
      const block = blockOf(element)
      if (!block || block.headings.length === 0 || block.headings.every(heading => heading === '')) continue
      add('block', `block:${block.type}:${JSON.stringify(block.headings)}`, element)
    }
  }
  const pictures = Array.from(root.querySelectorAll('.photo, .blk-pic') as ArrayLike<E>)
    // A frame's own picture (`span.blk-pic > … > img.blk-pic`) is read once, as its frame.
    .filter(element => !isFramedPicture(element, root))
  for (const element of pictures) {
    const address = pictureAddressOf(element)
    if (address) add('picture', `picture:${address}`, element)
  }
  return keys
}

function isFramedPicture(element: MotionElement, root: MotionElement): boolean {
  return element.tagName.toUpperCase() === 'IMG' && hasAncestorClass(element, root, 'blk-pic')
}

/** Whether an element inside `root` sits inside another with that class (`root` itself not counted). */
function hasAncestorClass(element: MotionElement, root: MotionElement, name: string): boolean {
  let node = (element as unknown as { parentElement: MotionElement | null }).parentElement
  while (node && node !== root) {
    if (node.classList.contains(name)) return true
    node = (node as unknown as { parentElement: MotionElement | null }).parentElement
  }
  return false
}

/** A pair of the same element on the slide before (`from`) and the slide now (`to`). */
export interface MotionPair<E = MotionElement> {
  key: string
  kind: MotionKeyKind
  from: E
  to: E
}

/**
 * The elements that glide: those whose key is on both slides. An element inside another that glides goes with it, so
 * it is left out (a picture in a box that matches moves as the box does).
 */
export function matchMotion<E extends MotionElement>(before: readonly MotionKey<E>[], now: readonly MotionKey<E>[]): MotionPair<E>[] {
  const earlier = new Map(before.map(entry => [entry.key, entry]))
  const pairs: MotionPair<E>[] = []
  for (const entry of now) {
    const match = earlier.get(entry.key)
    if (match) pairs.push({ key: entry.key, kind: entry.kind, from: match.element, to: entry.element })
  }
  return pairs.filter(pair => !pairs.some(other => other !== pair && (
    (other.to !== pair.to && other.to.contains(pair.to)) || (other.from !== pair.from && other.from.contains(pair.from))
  )))
}
