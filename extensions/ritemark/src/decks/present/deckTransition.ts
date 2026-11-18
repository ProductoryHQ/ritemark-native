/**
 * README item 19: the deck's one transition between slides on the wall, the one list the host and the wall share.
 * Fade is the default; `transition: push`, `zoom` or `none` in the deck's front matter, as written, chooses another.
 * Pure, with no imports: the host (`presentSession.ts`) and the wall and the Theme menu (`wallMotion.ts`) read it alike.
 */
export type DeckTransition = 'fade' | 'push' | 'zoom' | 'none';

/** A transition as a front-matter value names it: Fade unless it is `push`, `zoom` or `none` as written. */
export function transitionOf(value: unknown): DeckTransition {
  return value === 'push' || value === 'zoom' || value === 'none' ? value : 'fade';
}
