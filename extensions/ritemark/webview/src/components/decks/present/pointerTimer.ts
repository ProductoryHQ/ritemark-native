/**
 * Decks README items 12 and 9 (17 November): a pointer dot on the wall, and a timer for an exercise. Both are overlays
 * on the wall, in Present only, and neither writes anything to the file. Pure, so the test reads the same rules the
 * wall and the presenter view use.
 *
 * Item 12, the pointer dot (PowerPoint's laser pointer). While L is held, the pointer over the presenter view's Now, or
 * over the wall on one display, shows a soft accent dot about 14 px wide at the same place on the wall. Releasing L
 * hides it. No trail; with reduced motion it doesn't fade. The place crosses the host as a point on the slide, from 0
 * to 1 across and down its 16:9 area (`pointOnSlide`), so the presenter view's small Now and the wall's large slide
 * name the same spot (`dotPlace`). L is no other key of the wall's (`wallKeys.ts`: B . W Q F and the moves); while the
 * wall is blank or a picture fills it, L brings the slide back, as any key does, and does nothing else.
 *
 * Item 9, the timer. On a slide with a Steps block the presenter view offers a Timer of 5, 10, 15, 20 or 30 min; a
 * number in the Steps label or on the slide picks the default ("20 min", "20 minutes", "20 minutit"). A number the row
 * doesn't have joins it as its own choice, in order (25: 5 · 10 · 15 · 20 · 25 · 30), since the person meant it. Start shows a
 * quiet mm:ss countdown at the wall's bottom right, in the accent, across slides until stopped. At 0:00 it pulses gently
 * three times, with no sound; with reduced motion it doesn't pulse (`timerLook`).
 */
import type { WallPoint, WallTimer } from '../../../../../src/decks/present/presentProtocol'
import { blockStepsTagOf } from '../../../../../src/decks/blocks/slideRenderer'
import { exerciseTagOf, isBlockSlide } from '../../../../../src/decks/deckFormat'
import type { KeyInput } from './wallKeys'

// ---- Item 12: the pointer dot

/** The dot's width on the wall, in CSS pixels. */
export const DOT_SIZE = 14

/** A box on the screen: the slide's 16:9 area in a window. */
export interface PlaceRect {
  left: number
  top: number
  width: number
  height: number
}

/** L, alone: the pointer dot's key (a key with ⌘, Ctrl or ⌥ is the app's). */
export function isPointerKey(event: KeyInput): boolean {
  return (event.key === 'l' || event.key === 'L') && !event.metaKey && !event.ctrlKey && !event.altKey
}

/**
 * What a key does to the dot, held (`held`) or not: L down holds it, its repeats change nothing, L up lets go. Null: the
 * key is not the dot's. `take`: the wall or the presenter view keeps the key from the app.
 */
export function pointerKeyStep(held: boolean, phase: 'down' | 'up', event: KeyInput & { repeat?: boolean }): { held: boolean; take: boolean } | null {
  if (phase === 'up') {
    // Released with ⌘ held, or after a ⌘ was pressed, L still lets go.
    return event.key === 'l' || event.key === 'L' ? { held: false, take: held } : null
  }
  if (!isPointerKey(event)) return null
  return { held: true, take: true }
}

/**
 * The point on the slide under the pointer: 0 to 1 across and down `rect`, the slide's 16:9 area; null outside it (the
 * presenter view's pointer off Now shows no dot). `loose` keeps a point outside the area (the wall's own pointer on
 * one display, in the bands around the slide), so the dot follows it to the screen's edges.
 */
export function pointOnSlide(rect: PlaceRect, clientX: number, clientY: number, loose = false): WallPoint | null {
  if (rect.width <= 0 || rect.height <= 0) return null
  const x = (clientX - rect.left) / rect.width
  const y = (clientY - rect.top) / rect.height
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  if (loose) return { x, y }
  if (x < 0 || x > 1 || y < 0 || y > 1) return null
  return { x, y }
}

/** The dot's centre in a window, for a point on the slide drawn in `rect` (the wall's frame, or the presenter's Now). */
export function dotPlace(at: WallPoint, rect: PlaceRect): { left: number; top: number } {
  return { left: Math.round(rect.left + at.x * rect.width), top: Math.round(rect.top + at.y * rect.height) }
}

/** Two points are the same dot (the presenter view sends a point only when it moved a pixel's worth). */
export function samePoint(a: WallPoint | null, b: WallPoint | null, epsilon = 0.0005): boolean {
  if (a === null || b === null) return a === b
  return Math.abs(a.x - b.x) < epsilon && Math.abs(a.y - b.y) < epsilon
}

// ---- Item 9: the timer for an exercise

/** The minutes the presenter view offers, in order. */
export const TIMER_MINUTES = [5, 10, 15, 20, 30] as const
/** The default when the Steps label and the slide name no time. */
export const TIMER_DEFAULT = 10
/** At 0:00 the countdown pulses this many times, each this long (wall.css's `wall-timer-pulse`). */
export const TIMER_PULSES = 3
export const TIMER_PULSE_MS = 900

/**
 * The minutes a text names: a number then "min" ("20 min", "20min", "20 mins", "20 minutes", "a 20-minute task") or an
 * Estonian form of "minut" ("20 minutit", "20 minuti jooksul", "20 minutiks"). The first one wins; null when none.
 */
export function minutesIn(text: string): number | null {
  const match = /(?<![\d.,:])(\d{1,3})[\s ]*(?:-[\s ]*)?min(?:s|ut\p{L}*)?(?!\p{L})/iu.exec(text)
  if (!match) return null
  const minutes = Number(match[1])
  return minutes >= 1 ? minutes : null
}

/** The longest time a slide may name for its timer; a larger number is taken for no time (the default then). */
export const TIMER_MAX_NAMED = 90

/** The row of minutes for a slide that names `named`: the offered ones, and the named one in its place when it isn't. */
export function timerChoicesOf(named: number | null): number[] {
  const choices: number[] = [...TIMER_MINUTES]
  if (named !== null && !choices.includes(named)) choices.push(named)
  return choices.sort((a, b) => a - b)
}

/** A slide as the presenter view gets it (`WallSlide`): a block slide's Markdown, or a v1 slide's words. */
export interface TimerSlide {
  kind: string
  data: { markdown?: string; title?: string; tag?: string; items?: { heading?: string; text?: string }[] }
}

/**
 * The Steps label of a slide that has a Steps block ('' for a Steps block without one), or null when it has none: only
 * such a slide offers the timer. The wall's slides are block slides (every v1 kind goes out as one, `publicSlide`); a
 * v1 Exercise read as it is counts too.
 */
export function stepsLabelOf(slide: TimerSlide): string | null {
  if (slide.kind === 'exercise') return exerciseTagOf(slide.data)
  if (!isBlockSlide(slide.kind) || typeof slide.data.markdown !== 'string') return null
  return blockStepsTagOf(slide.data.markdown)
}

/** The words on a slide, for a time named outside the label. */
function slideWords(slide: TimerSlide): string {
  const parts: string[] = []
  if (typeof slide.data.markdown === 'string') parts.push(slide.data.markdown)
  if (typeof slide.data.title === 'string') parts.push(slide.data.title)
  for (const item of slide.data.items ?? []) {
    if (typeof item.heading === 'string') parts.push(item.heading)
    if (typeof item.text === 'string') parts.push(item.text)
  }
  return parts.join('\n')
}

/**
 * The timer a slide offers: null without a Steps block; else its minutes, from the Steps label first, then the slide's
 * words, as written (a number the row doesn't have joins it, in order: the Experience lead, 18 November); a number over
 * 90, or none, gives 10. `choices` is the row the presenter view shows, the default among them.
 */
export function timerOfferOf(slide: TimerSlide): { minutes: number; choices: number[] } | null {
  const label = stepsLabelOf(slide)
  if (label === null) return null
  const found = minutesIn(label) ?? minutesIn(slideWords(slide))
  const named = found !== null && found <= TIMER_MAX_NAMED ? found : null
  return { minutes: named ?? TIMER_DEFAULT, choices: timerChoicesOf(named) }
}

/** The time left as mm:ss, counted up to the next whole second, so it starts at "20:00" and ends at "00:00". */
export function timerText(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(total / 60)
  return `${String(minutes).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** How the countdown looks at `now`: its words, whether it is at 0:00, and whether it is pulsing. */
export interface TimerLook {
  text: string
  left: number
  done: boolean
  pulse: boolean
}

/**
 * The countdown at `now`. At 0:00 it stays there; it pulses three times from the moment it gets there, never with
 * reduced motion, and never for a wall that only opened later (a reload after the end shows 00:00, still).
 */
export function timerLook(timer: WallTimer, now: number, reducedMotion: boolean): TimerLook {
  const left = Math.max(0, timer.endsAt - now)
  const done = left === 0
  const since = now - timer.endsAt
  const pulse = done && !reducedMotion && since < TIMER_PULSES * TIMER_PULSE_MS
  return { text: timerText(left), left, done, pulse }
}

/** The next time the countdown's words change (the next whole second), so a window draws it no more than it must. */
export function timerNextTick(timer: WallTimer, now: number): number {
  const left = timer.endsAt - now
  if (left <= 0) return Math.max(0, TIMER_PULSES * TIMER_PULSE_MS - (now - timer.endsAt))
  const intoSecond = left % 1000
  return intoSecond === 0 ? 1000 : intoSecond
}
