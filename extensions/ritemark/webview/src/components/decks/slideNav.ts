/**
 * Moving between slides in the full slide view (Jarmo, 16 November: "full slide views peaks mouse scroll ja arrows
 * navigeerima slaidide vahel edasi-tagasi"). With the handout hidden, the slide fills the deck view, and there is no
 * handout to scroll: the wheel over the slide and the keys go to the next or previous slide instead. Skipped slides
 * count, since this is editing, not Present. With the handout shown, scrolling stays the scroll rule's.
 *
 * Pure functions, kept apart from the deck view so they can be tested on their own.
 */

// ---------------------------------------------------------------------------
// The wheel: one slide per gesture
// ---------------------------------------------------------------------------

/** How far a gesture must scroll, in pixels, before the slide moves; and how long the wheel must be still before the
 *  next gesture starts. A trackpad flick's momentum keeps the gesture going, so it moves one slide, never ten. */
export const WHEEL_STEP = 40
export const WHEEL_QUIET_MS = 400
/** A mouse wheel's notch is one event of a step or more, its own gesture once this long after the last event: a
 *  trackpad's flick and its momentum come every frame (about 16 ms) and never leave such a gap, so notches turned in a
 *  row move a slide each while a flick still moves one. */
export const WHEEL_NOTCH_GAP_MS = 100

export interface WheelGesture {
  /** The delta added up in this gesture, until it reaches the step. */
  sum: number
  /** Whether this gesture has moved the slide already: the rest of it is ignored. */
  spent: boolean
  /** When the last wheel event came, in ms; -Infinity before any. */
  last: number
  /** Whether a box under the pointer took this gesture to scroll (`wheelRoute`): the rest of it is the box's, never the
   *  slide's, so a flick that brings a column to its end doesn't move the slide with its momentum. */
  held?: boolean
}

export const NO_GESTURE: WheelGesture = { sum: 0, spent: false, last: -Infinity }

/** A wheel event's vertical delta in pixels: lines and pages turned into pixels as the handout's wheel rule does. */
export function wheelPixels(event: { deltaY: number; deltaMode: number }, pageHeight: number): number {
  return event.deltaMode === 1 ? event.deltaY * 40 : event.deltaMode === 2 ? event.deltaY * pageHeight : event.deltaY
}

/**
 * One wheel event: the gesture after it, and the slide's move (+1 next, -1 previous, 0 none). A gesture ends once the
 * wheel has been still for `WHEEL_QUIET_MS`, or at a notch (`WHEEL_NOTCH_GAP_MS`). Within a gesture the deltas add up until they reach the step; then the
 * slide moves once and the rest of the gesture is ignored. Turning the other way before the step starts the sum again.
 */
export function wheelStep(gesture: WheelGesture, delta: number, now: number): { gesture: WheelGesture; move: -1 | 0 | 1 } {
  const current = gestureAt(gesture, delta, now)
  if (current.spent || !Number.isFinite(delta) || delta === 0) return { gesture: { ...current, last: now }, move: 0 }
  const sum = Math.sign(current.sum) === -Math.sign(delta) ? delta : current.sum + delta
  if (Math.abs(sum) < WHEEL_STEP) return { gesture: { sum, spent: false, last: now }, move: 0 }
  return { gesture: { sum: 0, spent: true, last: now }, move: sum > 0 ? 1 : -1 }
}

/** The gesture this event belongs to: the one going on, or a new one after `WHEEL_QUIET_MS` of stillness or at a notch. */
function gestureAt(gesture: WheelGesture, delta: number, now: number): WheelGesture {
  const gap = now - gesture.last
  const fresh = gap >= WHEEL_QUIET_MS || (gap >= WHEEL_NOTCH_GAP_MS && Math.abs(delta) >= WHEEL_STEP)
  return fresh ? { ...NO_GESTURE } : gesture
}

// ---------------------------------------------------------------------------
// What scrolls first (Jarmo, 19 November: "Editori vaates raske navigeerida slaidide vahel"; issue #824)
// ---------------------------------------------------------------------------

/** What the wheel needs of an element under the pointer: as much of the DOM as the test fakes. */
export interface WheelBox {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
  parentElement: WheelBox | null
  classList?: { contains(name: string): boolean }
}

/** Whether a box scrolls `delta` itself: it scrolls (overflow-y auto or scroll), holds more than its room, and has room
 *  left that way. A box that only clips (overflow hidden, as the slide does) never takes the wheel. */
export function boxScrolls(box: Pick<WheelBox, 'scrollTop' | 'scrollHeight' | 'clientHeight'>, overflowY: string, delta: number): boolean {
  if (!Number.isFinite(delta) || delta === 0) return false
  if (overflowY !== 'auto' && overflowY !== 'scroll' && overflowY !== 'overlay') return false
  if (box.scrollHeight <= box.clientHeight + 1) return false
  return delta > 0 ? box.scrollTop + box.clientHeight < box.scrollHeight - 1 : box.scrollTop >= 1
}

/**
 * Who takes a wheel event over the stage in the full slide view: 'box' when something under the pointer scrolls that
 * way first, and 'slide' when nothing does and the slide moves. A box is a pane or a column on the slide that holds more
 * than its room (the design: it scrolls, in the editor too), or, outside the slide, the stage itself when it is taller
 * than its room. Over the slide the stage never counts, so the slide always moves there, as before; over the empty bands
 * the stage scrolls to its end first and the next gesture moves the slide (before, the bands did nothing once the
 * stage could scroll at all).
 */
export function wheelTaker<T extends WheelBox>(target: T | null, stage: T, delta: number, overflowOf: (box: T) => string): 'box' | 'slide' {
  let overSlide = false
  for (let box: T | null = target; box && box !== stage; box = box.parentElement as T | null) {
    if (box.classList?.contains('deck-big')) overSlide = true
    // The cheap reads first: only a box that holds more than its room is asked for its style.
    if (box.scrollHeight > box.clientHeight + 1 && boxScrolls(box, overflowOf(box), delta)) return 'box'
  }
  return !overSlide && boxScrolls(stage, overflowOf(stage), delta) ? 'box' : 'slide'
}

/**
 * One wheel event over the stage, with `wheelTaker`'s answer: the gesture after it, the slide's move, and whether the
 * browser scrolls the box (`scroll`; otherwise the event's default is prevented). A gesture is decided by its first
 * event with a delta: a box that scrolls that way keeps the whole gesture, a trackpad's momentum included, and the
 * slide never moves in it; otherwise it is the slide's, one slide per gesture (`wheelStep`). Once the box has reached
 * its end the rest of its gesture is ignored, and the next gesture moves the slide.
 */
export function wheelRoute(gesture: WheelGesture, delta: number, now: number, taker: 'box' | 'slide'): { gesture: WheelGesture; move: -1 | 0 | 1; scroll: boolean } {
  const current = gestureAt(gesture, delta, now)
  const undecided = !current.held && !current.spent && current.sum === 0
  if (current.held || (undecided && taker === 'box' && Number.isFinite(delta) && delta !== 0)) {
    return { gesture: { sum: 0, spent: false, last: now, held: true }, move: 0, scroll: taker === 'box' }
  }
  return { ...wheelStep(current, delta, now), scroll: false }
}

// ---------------------------------------------------------------------------
// The keys
// ---------------------------------------------------------------------------

/** What `slideKeyTarget` needs of the key's target: as much of the DOM as the test fakes. */
export interface KeyTargetElement {
  closest(selector: string): unknown
  isContentEditable?: boolean
  tagName?: string
}

/**
 * Where a key came from, for the full slide view: 'page' for the page itself (nothing focused) or the stage outside any
 * editable box, 'button' for a button on the stage or the view switch's (Space stays the button's), and null for everywhere else:
 * a title or box being edited, a field, the strip (its own keys), a menu or dialog, the deck's bar.
 */
export function slideKeyTarget(target: KeyTargetElement | null, body: unknown): 'page' | 'button' | null {
  if (!target || target === body || target.tagName === 'HTML' || target.tagName === 'BODY') return 'page'
  if (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return null
  if (target.closest('[contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]')) return null
  if (target.closest('[role="menu"], [role="dialog"], [role="alertdialog"], [role="listbox"], .deck-strip')) return null
  // The stage, and the view switch's Slide only that just hid the handout (it keeps the focus after the press; 17 November).
  if (!target.closest('.deck-stage, .deck-view-switch')) return null
  return target.tagName === 'BUTTON' || target.closest('button') ? 'button' : 'page'
}

interface KeyLike {
  key: string
  shiftKey?: boolean
  metaKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
  isComposing?: boolean
  defaultPrevented?: boolean
}

/**
 * The slide a key goes to in the full slide view, or null when the key isn't one of these: ↓ → PageDown and Space the
 * next, ↑ ← PageUp the previous, Home and End the first and the last. Never with a modifier (those are the app's and
 * the system's), never while composing, and never from an editable box: there the arrows move the caret.
 */
export function slideKeyOf(event: KeyLike, from: 'page' | 'button' | null, count: number, current: number): number | null {
  if (!from || count === 0 || event.defaultPrevented || event.isComposing) return null
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return null
  const last = count - 1
  const at = Math.max(0, Math.min(current, last))
  switch (event.key) {
    case 'Home': return 0
    case 'End': return last
    case 'ArrowDown': case 'ArrowRight': case 'PageDown': return Math.min(last, at + 1)
    case 'ArrowUp': case 'ArrowLeft': case 'PageUp': return Math.max(0, at - 1)
    // Space presses a focused button; only from the page itself does it move the slide.
    case ' ': return from === 'page' ? Math.min(last, at + 1) : null
    default: return null
  }
}
