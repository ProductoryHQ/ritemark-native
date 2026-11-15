/**
 * Sprint 157 (README decision 5): which slide is current as the handout scrolls. Pure, so the prototype's rule is
 * tested as it is.
 *
 *  - The part being written in is always the current one.
 *  - Else the part that starts at the top of the handout (within 26 px) is the one being read.
 *  - Else the last part that starts above a line 0.28 of the way down (the prototype Jarmo tried; the Experience
 *    lead's answer 9).
 *  - Scrolled to the top, the first part; scrolled to the end with the last part at the top, the last.
 */

/** The line a part crosses to become the current one, as a share of the handout's height. */
export const READ_LINE = 0.28
/** How near the top a part's start counts as "at the top". */
export const TOP_SNAP = 26
/** The space the deck view keeps above each part's head when it scrolls a part to the top. */
export const PART_TOP_GAP = 6

export interface ScrollState {
  /** Each part's top, in the handout's scrolled content, in order. */
  partTops: number[]
  scrollTop: number
  clientHeight: number
  scrollHeight: number
  /** The part the person is writing in, or null. */
  writing: number | null
}

/** The current part's index, or null when the deck has no parts. */
export function currentPart(state: ScrollState): number | null {
  const { partTops, scrollTop, clientHeight, scrollHeight, writing } = state
  const count = partTops.length
  if (count === 0) return null
  if (writing !== null && writing >= 0 && writing < count) return writing
  if (scrollTop < 8) return 0
  const line = scrollTop + clientHeight * READ_LINE
  let current = 0
  let atTop: number | null = null
  partTops.forEach((top, index) => {
    if (top <= line) current = index
    if (atTop === null && Math.abs(top - PART_TOP_GAP - scrollTop) < TOP_SNAP) atTop = index
  })
  if (atTop !== null) current = atTop
  if (scrollTop + clientHeight >= scrollHeight - 4 && scrollTop >= partTops[count - 1] - PART_TOP_GAP - 2) current = count - 1
  return current
}

/** Where to scroll the handout so a part starts at its top. */
export function scrollTopFor(partTop: number): number {
  return Math.max(0, partTop - PART_TOP_GAP)
}
