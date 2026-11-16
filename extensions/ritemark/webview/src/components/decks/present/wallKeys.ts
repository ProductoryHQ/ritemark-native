/**
 * Sprint 159 (PR 5, experience 17 frame 2): the wall's keys, pure, so the test reads the same rules the wall uses.
 *
 * → ↓, PageDown, space and Return go on; ← ↑ and PageUp go back; Home and End go to the first and last slide shown;
 * Esc stops. A clicker sends PageDown and PageUp. A key with ⌘, Ctrl or ⌥ is the app's, never the wall's.
 *
 * Typing a number opens the go-to box: "4 · Go to <title> ↵". Return goes there; Esc, or a pause (the wall's timer),
 * closes it; Backspace takes a digit back. Any other key closes the box and then does what it does.
 */

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
