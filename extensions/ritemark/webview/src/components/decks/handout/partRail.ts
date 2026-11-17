/**
 * The handout's number rail (Jarmo, 17 November; the Experience lead's design, released with "jah disain on õige"): each
 * part's own track at the left, from 10 px above its heading to the end of its text, with its sticky number in it.
 * Pure, so the rail's measure and its click are tested as they are; the deck view reads the laid-out page and applies
 * them (`DeckView.tsx`, `measureRail` and the rail's click).
 */

/** How far the track runs on past the end of its part's text. */
export const TRACK_TAIL = 8
/** The shortest track: room for its number, a skipped mark and the ⋯. */
export const TRACK_MIN = 34

/**
 * A track's height: from its top (where the head's CSS puts it, 10 px above the heading) to the end of its part's
 * text, and a little past it, never shorter than its number needs. The gap to the next track then marks where one
 * slide ends and the next begins.
 */
export function trackHeight(trackTop: number, textBottom: number): number {
  return Math.max(TRACK_MIN, Math.round(textBottom + TRACK_TAIL - trackTop))
}

/**
 * The slide a click on part `index`'s track makes current, as a thumbnail does; null when there's nothing to do: the
 * click is on the current slide's own track (a click there never jumps the handout away from where it is being read),
 * or on a track that isn't one of the deck's parts.
 */
export function railPick(index: number, current: number, count: number): number | null {
  if (!Number.isInteger(index) || index < 0 || index >= count) return null
  return index === current ? null : index
}

/**
 * What a click on a slide-only part's row does: its slide becomes current and the caret goes into its part, at its
 * first block (an empty heading or paragraph), so it opens to write in with its placeholders. `blocks` are the part's
 * blocks' positions in the document; null when the part has none to hold the caret (then only its slide is picked).
 */
export function rowCaret(blockPositions: readonly number[]): number | null {
  return blockPositions.length > 0 ? blockPositions[0] + 1 : null
}
