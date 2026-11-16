/**
 * The slide strip's keys (SlideStrip's `onKeyDown`), kept apart from the component so they can be tested on their own.
 *
 *  - On the strip itself: Home, End, the arrows, Shift+F10 or the menu key, Backspace or Delete (the selected slide),
 *    and Cmd+Z / Cmd+Shift+Z, which go to the deck's history as on the stage, so a deleted slide comes back.
 *  - On a thumbnail (its ⋯ button, reached with Tab): Backspace and Delete delete that thumbnail's slide, as its menu's
 *    Delete slide does (Jarmo, 16 November). The arrows there stay the menu button's.
 *  - Never a key typed in words (the handout, the stage, a field), nor one from a menu, which React hands up from its
 *    portal: those are not in the strip. Never a held key's repeats: a delete asks nothing.
 */
import { undoKeyOf } from './slide/slideEdits'

export type StripKey =
  | { type: 'pick'; index: number }
  | { type: 'menu' }
  | { type: 'delete'; index: number }
  | { type: 'undo'; redo: boolean }

/** Where a key came from: the strip itself, or inside thumbnail `index`; null for anywhere else. */
export type KeyOrigin = { from: 'strip' } | { from: 'thumb'; index: number } | null

/** What `keyOrigin` needs of an element: as much of the DOM as the test fakes. */
export interface OriginElement {
  closest(selector: string): { getAttribute(name: string): string | null } | null
  isContentEditable?: boolean
  tagName?: string
}

export function keyOrigin(target: OriginElement | null, strip: { contains(node: unknown): boolean } | null): KeyOrigin {
  if (!target || !strip) return null
  if ((target as unknown) === strip) return { from: 'strip' }
  if (!strip.contains(target)) return null
  if (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return null
  const index = Number(target.closest('[data-thumb]')?.getAttribute('data-thumb') ?? NaN)
  return Number.isInteger(index) && index >= 0 ? { from: 'thumb', index } : null
}

interface KeyLike {
  key: string
  shiftKey?: boolean
  metaKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
  repeat?: boolean
  isComposing?: boolean
  defaultPrevented?: boolean
}

export function stripKeyOf(event: KeyLike, origin: KeyOrigin, count: number, current: number): StripKey | null {
  if (count === 0 || !origin || event.defaultPrevented) return null
  if (event.key === 'Backspace' || event.key === 'Delete') {
    // ⌘⌫ and the like are the app's; the last slide stays, as the menu's Delete slide is off for it.
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || count < 2) return null
    const index = origin.from === 'thumb' ? origin.index : current
    return index < count ? { type: 'delete', index } : null
  }
  if (origin.from !== 'strip') return null
  const step = undoKeyOf({ key: event.key, metaKey: !!event.metaKey, ctrlKey: !!event.ctrlKey, shiftKey: !!event.shiftKey, altKey: event.altKey, isComposing: event.isComposing })
  if (step) return { type: 'undo', redo: step === 'redo' }
  // Other combinations are the app's or the system's.
  if (event.metaKey || event.ctrlKey || event.altKey) return null
  // The current slide's menu, as a right-click opens it: Shift+F10 or the menu key.
  if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) return { type: 'menu' }
  if (event.shiftKey) return null
  if (event.key === 'Home') return { type: 'pick', index: 0 }
  if (event.key === 'End') return { type: 'pick', index: count - 1 }
  const move = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0
  if (move === 0) return null
  return { type: 'pick', index: Math.max(0, Math.min(count - 1, current + move)) }
}
