/**
 * A slide's menu, one list for both places it opens (experience 46, "Removing a slide from the handout"): the strip's
 * thumbnail ⋯ (or a right-click) and the handout part number's ⋯. The same items in the same order, each acting on
 * that slide through the strip's own actions: Duplicate, Move up and Move down (18 November, the Experience lead: the
 * keys' own move, off at the ends as a Mac menu has them); then Skip slide or Show slide, Add to library… or Show in
 * the library, Slide settings… (17 November, "Nothing around the slide": the gear left the bar); then Delete slide
 * (with Undo in the bar). Copy as picture (item 15, the Experience lead on 18 November) stands right after Add to
 * library…, with no key of its own: Cmd+C on a chosen thumbnail already copies the slide within decks.
 */
import type { PhosphorIconName } from '../ui/Icon'

/** What a slide's menu does: the strip's own actions. */
export interface SlideMenuActions {
  duplicate: (index: number) => void
  /** Move up (-1) or down (+1) one place, with the handout part: the strip's Cmd+↑ and Cmd+↓. */
  nudge: (index: number, step: -1 | 1) => void
  toggleSkip: (index: number) => void
  addToLibrary: (index: number) => void
  showInLibrary: (index: number) => void
  remove: (index: number) => void
  /** Copy as picture: a 1920 × 1080 PNG of the slide in its theme on the clipboard. */
  copyPicture: (index: number) => void
  /** Slide settings… (Jarmo, 17 November: in the slide's own menu, not in the bar): the popover beside where it came from. */
  settings: (index: number) => void
}

export interface SlideMenuItem {
  key: 'duplicate' | 'up' | 'down' | 'skip' | 'library' | 'picture' | 'settings' | 'delete'
  label: string
  icon: PhosphorIconName
  /** A line above it. */
  separated?: boolean
  danger?: boolean
  disabled?: boolean
  /** The key beside it (Duplicate's ⌘D, Delete slide's ⌫), so people can find it. */
  keyHint?: string
  /** While it is off: its tooltip, saying why. */
  disabledTip?: string
  run: (actions: SlideMenuActions) => void
}

/** The menu of slide `index` (from 0) in a deck of `count` slides. */
export function slideMenuItems(input: { index: number; count: number; skipped: boolean; fromLibrary: boolean; deleteKey: string; duplicateKey: string; upKey: string; downKey: string }): SlideMenuItem[] {
  const { index, count, skipped, fromLibrary, deleteKey, duplicateKey, upKey, downKey } = input
  const first = index <= 0
  const last = index >= count - 1
  return [
    { key: 'duplicate', label: 'Duplicate', icon: 'copy', keyHint: duplicateKey, run: actions => actions.duplicate(index) },
    { key: 'up', label: 'Move up', icon: 'arrow-up', keyHint: upKey, disabled: first, disabledTip: first ? 'The first slide is already at the top' : undefined, run: actions => actions.nudge(index, -1) },
    { key: 'down', label: 'Move down', icon: 'arrow-down', keyHint: downKey, disabled: last, disabledTip: last ? 'The last slide is already at the bottom' : undefined, run: actions => actions.nudge(index, 1) },
    { key: 'skip', label: skipped ? 'Show slide' : 'Skip slide', icon: skipped ? 'eye' : 'eye-slash', separated: true, run: actions => actions.toggleSkip(index) },
    fromLibrary
      ? { key: 'library', label: 'Show in the library', icon: 'cards-three', run: actions => actions.showInLibrary(index) }
      : { key: 'library', label: 'Add to library…', icon: 'cards-three', run: actions => actions.addToLibrary(index) },
    { key: 'picture', label: 'Copy as picture', icon: 'image', run: actions => actions.copyPicture(index) },
    { key: 'settings', label: 'Slide settings…', icon: 'gear', run: actions => actions.settings(index) },
    // The deck's last slide stays: a deck always has one.
    { key: 'delete', label: 'Delete slide', icon: 'trash', separated: true, danger: true, disabled: count < 2, disabledTip: count < 2 ? 'A deck keeps at least one slide' : undefined, keyHint: deleteKey, run: actions => actions.remove(index) },
  ]
}
