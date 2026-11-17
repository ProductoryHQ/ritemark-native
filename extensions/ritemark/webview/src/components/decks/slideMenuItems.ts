/**
 * A slide's menu, one list for both places it opens (experience 46, "Removing a slide from the handout"): the strip's
 * thumbnail ⋯ (or a right-click) and the handout part number's ⋯. The same items in the same order, each acting on
 * that slide through the strip's own actions: Duplicate, Skip slide or Show slide, Add to library… or Show in the
 * library, Slide settings… (17 November, "Nothing around the slide": the gear left the bar), then Delete slide (with
 * Undo in the bar).
 */
import type { PhosphorIconName } from '../ui/Icon'

/** What a slide's menu does: the strip's own actions. */
export interface SlideMenuActions {
  duplicate: (index: number) => void
  toggleSkip: (index: number) => void
  addToLibrary: (index: number) => void
  showInLibrary: (index: number) => void
  remove: (index: number) => void
  /** Slide settings… (Jarmo, 17 November: in the slide's own menu, not in the bar): the popover beside where it came from. */
  settings: (index: number) => void
}

export interface SlideMenuItem {
  key: 'duplicate' | 'skip' | 'library' | 'settings' | 'delete'
  label: string
  icon: PhosphorIconName
  /** A line above it. */
  separated?: boolean
  danger?: boolean
  disabled?: boolean
  /** The key beside it (Duplicate's ⌘D, Delete slide's ⌫), so people can find it. */
  keyHint?: string
  run: (actions: SlideMenuActions) => void
}

/** The menu of slide `index` (from 0) in a deck of `count` slides. */
export function slideMenuItems(input: { index: number; count: number; skipped: boolean; fromLibrary: boolean; deleteKey: string; duplicateKey: string }): SlideMenuItem[] {
  const { index, count, skipped, fromLibrary, deleteKey, duplicateKey } = input
  return [
    { key: 'duplicate', label: 'Duplicate', icon: 'copy', keyHint: duplicateKey, run: actions => actions.duplicate(index) },
    { key: 'skip', label: skipped ? 'Show slide' : 'Skip slide', icon: skipped ? 'eye' : 'eye-slash', run: actions => actions.toggleSkip(index) },
    fromLibrary
      ? { key: 'library', label: 'Show in the library', icon: 'cards-three', run: actions => actions.showInLibrary(index) }
      : { key: 'library', label: 'Add to library…', icon: 'cards-three', run: actions => actions.addToLibrary(index) },
    { key: 'settings', label: 'Slide settings…', icon: 'gear', run: actions => actions.settings(index) },
    // The deck's last slide stays: a deck always has one.
    { key: 'delete', label: 'Delete slide', icon: 'trash', separated: true, danger: true, disabled: count < 2, keyHint: deleteKey, run: actions => actions.remove(index) },
  ]
}
