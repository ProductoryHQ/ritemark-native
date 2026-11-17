/**
 * Sprint 159 (PR 5, experience 17 frame 2): the wall's keys, pure, so the test reads the same rules the wall uses.
 *
 * → ↓, PageDown, space and Return go on; ← ↑ and PageUp go back; Home and End go to the first and last slide shown;
 * Esc stops. A clicker sends PageDown and PageUp. A key with ⌘, Ctrl or ⌥ is the app's, never the wall's.
 *
 * Typing a number opens the go-to box: "4 · Go to <title> ↵". Return goes there; Esc, or a pause (the wall's timer),
 * closes it; Backspace takes a digit back. Any other key closes the box and then does what it does.
 *
 * Small details (decks README, item 1, 17 November): B or "." blanks the wall to the theme's ground, W to white; while
 * it is blank any key brings the slide back, and that key does nothing else (`blankKeyOf`).
 *
 * Item 3: for a published deck, Q shows the page's QR code on the wall the same way; any key brings the slide back. An
 * unpublished deck's Q does nothing.
 *
 * The spotlight and a filled wall (decks README, items 11 and 16, 17 November): F spotlights the slide's first item, Tab
 * and Shift+Tab move the spotlight, Esc clears it (`spotKeyOf`); → and a clicker clear it and go on, as any move does.
 * While a picture fills the wall any key returns to the slide, and does nothing else (`fillKeyOf`). A click acts on
 * what it hits (`spotClickOf`): the same rule in the wall and in the presenter view's Now.
 */

import type { ClockLocale, WallBlank } from '../../../../../src/decks/present/presentProtocol'

export type { WallBlank }

export type WallKey =
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'first' }
  | { type: 'last' }
  | { type: 'stop' }
  | { type: 'digit'; digit: string }

export interface KeyInput {
  key: string
  metaKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
}

/** What a key does on the wall, or null when it is not the wall's. */
export function wallKeyOf(event: KeyInput): WallKey | null {
  if (event.metaKey || event.ctrlKey || event.altKey) return null
  switch (event.key) {
    case 'ArrowRight':
    case 'ArrowDown':
    case 'PageDown':
    case ' ':
    case 'Spacebar':
    case 'Enter':
      return { type: 'next' }
    case 'ArrowLeft':
    case 'ArrowUp':
    case 'PageUp':
      return { type: 'back' }
    case 'Home':
      return { type: 'first' }
    case 'End':
      return { type: 'last' }
    case 'Escape':
      return { type: 'stop' }
    default:
      return /^[0-9]$/.test(event.key) ? { type: 'digit', digit: event.key } : null
  }
}

/** What a key does to a blank wall, or to one that isn't. */
export type BlankStep = { type: 'blank'; to: WallBlank } | { type: 'show' }

/** Keys that are only held with another: pressed alone, they never bring the slide back. */
const HELD_KEYS = new Set(['Shift', 'Meta', 'Control', 'Alt', 'AltGraph', 'CapsLock', 'Fn', 'FnLock', 'Hyper', 'Super', 'OS', 'NumLock', 'ScrollLock', 'Dead'])

/**
 * B or "." blanks the wall to the theme's ground, W to white (a clicker's blank button sends B or "."), and Q shows the
 * published page's QR code (`page`: the deck has one; else Q is no key of the wall's). While the wall is blank or shows
 * the code, any key brings the slide back (Esc, a digit and → too), and that key does nothing else. A key with ⌘, Ctrl
 * or ⌥ is still the app's. Null: the key is not about blanking, and does what it does.
 */
export function blankKeyOf(event: KeyInput, blank: WallBlank | null, page = false): BlankStep | null {
  if (event.metaKey || event.ctrlKey || event.altKey) return null
  if (blank !== null) return HELD_KEYS.has(event.key) ? null : { type: 'show' }
  switch (event.key) {
    case 'b':
    case 'B':
    case '.':
      return { type: 'blank', to: 'ground' }
    case 'w':
    case 'W':
      return { type: 'blank', to: 'white' }
    case 'q':
    case 'Q':
      return page ? { type: 'blank', to: 'page' } : null
    default:
      return null
  }
}

/**
 * The blank a window's next key is read against: the one it last asked for (`asked`) until the host's state says so,
 * else the host's. A clicker's second press (Page Down right after ".") then never reads the wall as not yet blank.
 */
export function blankNow<T>(host: T, asked: { to: T } | null): T {
  return asked ? asked.to : host
}

/**
 * The ask kept until a state from the host carries it (the blank, the spotlight, a filled wall). A Q the host refused
 * (the deck no longer has a page, `hostPage` false) is settled too: the host never shows the code then, and the next
 * key must not be read against it.
 */
export function settleAsked<T>(asked: { to: T } | null, host: T, hostPage = true): { to: T } | null {
  if (asked && (asked.to as unknown) === 'page' && !hostPage) return null
  return asked && asked.to === host ? null : asked
}

/** What a key does to the spotlight: an item spotlit (its place among the slide's items), or the spotlight cleared. */
export type SpotStep = { type: 'spot'; item: number } | { type: 'clear' }

/**
 * Item 16's keys, with `spot` the item spotlit now (or null) and `count` the slide's items. F spotlights the first item.
 * Tab and Shift+Tab move to the next and previous item while one is spotlit, and stop at the ends (without a spotlight
 * Tab is the window's own, so the presenter view's buttons are still reached by Tab). Esc clears the spotlight; without
 * one it stops, as before. Null: the key is not the spotlight's (→ and a clicker step, and the move clears it).
 */
export function spotKeyOf(event: KeyInput & { shiftKey?: boolean }, spot: number | null, count: number): SpotStep | null {
  if (event.metaKey || event.ctrlKey || event.altKey) return null
  switch (event.key) {
    case 'f':
    case 'F':
      return count > 0 ? { type: 'spot', item: 0 } : null
    case 'Tab': {
      if (spot === null || count <= 0) return null
      const at = Math.min(spot, count - 1)
      return { type: 'spot', item: event.shiftKey ? Math.max(0, at - 1) : Math.min(count - 1, at + 1) }
    }
    case 'Escape':
      return spot === null ? null : { type: 'clear' }
    default:
      return null
  }
}

/**
 * Item 11: while a picture fills the wall, any key returns to the slide and does nothing else (as on a blank wall); a
 * key with ⌘, Ctrl or ⌥ is still the app's, and a key that is only held with another does nothing.
 */
export function fillKeyOf(event: KeyInput, fill: number | null): 'return' | null {
  if (fill === null || event.metaKey || event.ctrlKey || event.altKey) return null
  return HELD_KEYS.has(event.key) ? null : 'return'
}

/** What a click does: an item spotlit, the spotlight cleared, a picture filling the wall, the next slide, or nothing. */
export type SpotClick = { type: 'spot'; item: number } | { type: 'clear' } | { type: 'fill'; item: number } | { type: 'next' } | null

/**
 * Items 11 and 16: a click acts on what it hits (`hit`, the item under the pointer, or null outside any item). A click on
 * an item spotlights it, and on another item moves the spotlight there. A click on the spotlit item, or outside any
 * item, clears it; a click on a spotlit picture fills the wall. A picture that is the slide's only item (`alone`: only
 * the title beside it) fills the wall at the first click, since a spotlight on it would change nothing to see (the
 * Experience lead, 18 November). With no spotlight, a click outside any item does what it did before: on the wall it
 * goes on (`outside` 'next'); in the presenter view's Now nothing.
 */
export function spotClickOf(hit: { item: number; picture: boolean; alone?: boolean } | null, spot: number | null, outside: 'next' | 'none'): SpotClick {
  if (!hit) {
    if (spot !== null) return { type: 'clear' }
    return outside === 'next' ? { type: 'next' } : null
  }
  if (hit.picture && hit.alone) return { type: 'fill', item: hit.item }
  if (hit.item !== spot) return { type: 'spot', item: hit.item }
  return hit.picture ? { type: 'fill', item: hit.item } : { type: 'clear' }
}

/** The go-to box's digits; at most this many. */
export const MAX_GOTO_DIGITS = 4

/** What a key does to the go-to box. */
export interface GoToStep {
  /** The box's digits after the key, or null when the box is closed. */
  digits: string | null
  /** Return was pressed: go to this number. */
  go?: number
  /** The key was the box's: nothing else does anything with it. */
  handled: boolean
}

/** A key while the go-to box is open (`digits`), or a digit that opens it (`digits` null). */
export function goToKey(digits: string | null, event: KeyInput): GoToStep {
  if (event.metaKey || event.ctrlKey || event.altKey) return { digits, handled: false }
  const digit = /^[0-9]$/.test(event.key) ? event.key : null
  if (digits === null) return digit ? { digits: digit, handled: true } : { digits: null, handled: false }
  if (digit) return { digits: digits.length < MAX_GOTO_DIGITS ? digits + digit : digits, handled: true }
  switch (event.key) {
    case 'Backspace':
      return { digits: digits.length > 1 ? digits.slice(0, -1) : null, handled: true }
    case 'Enter':
      return { digits: null, go: Number(digits), handled: true }
    case 'Escape':
      return { digits: null, handled: true }
    default:
      // Any other key closes the box and does what it does (→ goes on).
      return { digits: null, handled: false }
  }
}

/**
 * n of N on the wall's bar. A skipped slide reached by its number has no place among the slides shown; a slide deleted
 * in the editor while it is on the wall has none either, until the next move.
 */
export function countLabel(position: number | null, count: number, skipped: boolean): string {
  if (skipped) return 'Skipped slide'
  return position === null ? `– of ${count}` : `${position} of ${count}`
}

/**
 * In the deck view: ⌘↩ presents from this slide (as the Present button does) and ⇧⌘↩ from the start, as in
 * PowerPoint for Mac and Google Slides (Ctrl on Windows). ⇧↩ alone is the handout's line break, never Present.
 */
export function presentKeyOf(event: KeyInput & { shiftKey?: boolean }, mac: boolean): 'here' | 'start' | null {
  if (event.key !== 'Enter' || event.altKey) return null
  const mod = mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey
  if (!mod) return null
  return event.shiftKey ? 'start' : 'here'
}

/** The slide's width on a screen: 16:9, as large as fits, with bands on the other sides. */
export function wallSlideSize(width: number, height: number): { width: number; height: number; left: number; top: number } {
  const slideWidth = Math.max(0, Math.min(width, Math.round(height * 16 / 9)))
  const slideHeight = Math.round(slideWidth * 9 / 16)
  return { width: slideWidth, height: slideHeight, left: Math.round((width - slideWidth) / 2), top: Math.round((height - slideHeight) / 2) }
}

/**
 * How far the slide's ground and its picture run past the 16:9 area to the screen's edges (step-3-themes.md, "No bands
 * on the wall"), in the slide canvas's own pixels (`canvasWidth` wide), each side; a pixel more, so a rounded frame
 * never leaves a hairline at an edge.
 */
export function wallBleed(frame: { width: number; left: number; top: number }, canvasWidth: number): { x: number; y: number } {
  if (frame.width <= 0) return { x: 0, y: 0 }
  const scale = frame.width / canvasWidth
  const side = (band: number) => (band > 0 ? Math.ceil((band + 1) / scale) : 0)
  return { x: side(frame.left), y: side(frame.top) }
}

/** The presenter view's clock: elapsed time as m:ss, or h:mm:ss past an hour. */
export function clockText(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = String(total % 60).padStart(2, '0')
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`
}

/**
 * The presenter view's time of day, hours and minutes in the locale's own format ("14:05", "2:05 PM"), with the
 * system's 12- or 24-hour choice over the locale's when it has one. A locale the webview can't read falls back to its
 * own.
 */
export function timeOfDayFormat(clock: ClockLocale | null): Intl.DateTimeFormat {
  const options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }
  if (clock?.hourCycle) options.hourCycle = clock.hourCycle
  try {
    return new Intl.DateTimeFormat(clock?.locale ?? undefined, options)
  } catch {
    return new Intl.DateTimeFormat(undefined, options)
  }
}

export function timeOfDayText(date: Date, clock: ClockLocale | null): string {
  return timeOfDayFormat(clock).format(date)
}
