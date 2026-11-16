/**
 * The slide strip's keys (SlideStrip's `onKeyDown`), kept apart from the component so they can be tested on their own.
 *
 *  - On the strip itself: Home, End, the arrows, Shift+F10 or the menu key, and Backspace or Delete.
 *  - On a thumbnail (its ⋯ button has the focus after its menu closes): Backspace and Delete too, so a selected slide
 *    is deleted whichever of the two has the focus (Jarmo, 16 November). The arrows there stay the menu button's.
 *  - Never a key typed in words (the handout, the stage, a field), nor one from a menu, which React hands up from its
 *    portal: those are not in the strip.
 */

export type StripKey =
  | { type: 'pick'; index: number }
  | { type: 'menu' }
  | { type: 'delete'; index: number }

/** Where a key came from: the strip itself, inside one of its thumbnails, or anywhere else. */
export type KeyOrigin = 'strip' | 'thumb' | 'other'

/** What `keyOrigin` needs of an element: as much of the DOM as the test fakes. */
export interface OriginElement {
  closest(selector: string): unknown
  isContentEditable?: boolean
  tagName?: string
}

export function keyOrigin(target: OriginElement | null, strip: { contains(node: unknown): boolean } | null): KeyOrigin {
  if (!target || !strip) return 'other'
  if ((target as unknown) === strip) return 'strip'
  if (!strip.contains(target)) return 'other'
  if (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return 'other'
  return target.closest('[data-thumb]') ? 'thumb' : 'other'
}

interface KeyLike {
  key: string
  shiftKey?: boolean
  metaKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
  defaultPrevented?: boolean
}

export function stripKeyOf(event: KeyLike, origin: KeyOrigin, count: number, current: number): StripKey | null {
  if (count === 0 || origin === 'other' || event.defaultPrevented) return null
  if (event.key === 'Backspace' || event.key === 'Delete') {
    // ⌘⌫ and the like are the app's; the last slide stays, as the menu's Delete slide is off for it.
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return null
    return count < 2 ? null : { type: 'delete', index: current }
  }
  if (origin !== 'strip') return null
  if (event.key === 'Home') return { type: 'pick', index: 0 }
  if (event.key === 'End') return { type: 'pick', index: count - 1 }
  // The current slide's menu, as a right-click opens it: Shift+F10 or the menu key.
  if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) return { type: 'menu' }
  const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0
  if (step === 0) return null
  return { type: 'pick', index: Math.max(0, Math.min(count - 1, current + step)) }
}
