/**
 * Sprint 157 (README decision 5): which slide is current as the handout scrolls. Pure, so the prototype's rule is
 * tested as it is.
 *
 *  - The part being written in is always the current one.
 *  - Else a part becomes the current one when its head crosses a line 0.28 of the way down (the prototype Jarmo
 *    tried; the Experience lead's answer 9), and stays it while its head is within 26 px of the top, as when a
 *    thumbnail scrolled it there.
 *  - The slide only moves forward as the handout scrolls down, and back as it scrolls up, and every part has a stretch
 *    of the scrolling of its own (Jarmo, 15 November: scrolling went 4, 6, back to 5, and a title alone was skipped).
 *  - Scrolled to the top, the first part; scrolled to the end with the last part at the top, the last.
 *  - One turn of the wheel moves the slide on by one at most: `wheelStop` cuts the turn short where the next part is
 *    the current one.
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

/**
 * Where each part becomes the current one, as a scroll position: from where its head crosses the line, but never
 * before the part above has left the top (its head more than 26 px up), and always after the part above's own start,
 * so the positions only grow and no part is left without a stretch.
 */
export function partStarts(partTops: number[], clientHeight: number): number[] {
  const starts: number[] = []
  partTops.forEach((top, index) => {
    if (index === 0) { starts.push(-Infinity); return }
    const crossesLine = top - clientHeight * READ_LINE
    const aboveLeftTop = partTops[index - 1] - PART_TOP_GAP + TOP_SNAP
    starts.push(Math.max(crossesLine, aboveLeftTop, starts[index - 1] + 1))
  })
  return starts
}

/** The current part's index, or null when the deck has no parts. */
export function currentPart(state: ScrollState): number | null {
  const { partTops, clientHeight, writing } = state
  const count = partTops.length
  if (count === 0) return null
  if (writing !== null && writing >= 0 && writing < count) return writing
  return partAt(state, partStarts(partTops, clientHeight), state.scrollTop)
}

/** The part current at `scrollTop`, from the parts' starts (nobody writing). */
function partAt(state: ScrollState, starts: number[], scrollTop: number): number {
  const { partTops, clientHeight, scrollHeight } = state
  const count = partTops.length
  if (scrollTop < 8) return 0
  if (scrollTop + clientHeight >= scrollHeight - 4 && scrollTop >= partTops[count - 1] - PART_TOP_GAP - 2) return count - 1
  let current = 0
  starts.forEach((start, index) => {
    if (start <= scrollTop) current = index
  })
  return current
}

/**
 * Where one wheel turn of `delta` pixels from `state.scrollTop` should stop, so the current part moves by one at most
 * from `shown`: the furthest point on the way where that still holds. Null when the turn may go as it would (it skips
 * nothing, or no point on the way shows the next part, so holding it back would only stop the scrolling).
 */
export function wheelStop(state: ScrollState, delta: number, shown: number): number | null {
  const maxTop = Math.max(0, state.scrollHeight - state.clientHeight)
  const target = Math.min(maxTop, Math.max(0, state.scrollTop + delta))
  const step = delta > 0 ? 1 : -1
  const next = shown + step
  if (state.partTops.length === 0) return null
  // The starts depend on the parts and the height only, so they are worked out once for the whole turn.
  const starts = partStarts(state.partTops, state.clientHeight)
  const at = (scrollTop: number) => partAt(state, starts, scrollTop)
  const skips = (part: number) => (step > 0 ? part > next : part < next)
  if (delta === 0 || !skips(at(target))) return null
  let stop: number | null = null
  for (let top = state.scrollTop + step; step > 0 ? top <= target : top >= target; top += step) {
    const part = at(top)
    if (skips(part)) break
    if (part === next) stop = top
  }
  return stop
}

/** Where to scroll the handout so a part starts at its top. */
export function scrollTopFor(partTop: number): number {
  return Math.max(0, partTop - PART_TOP_GAP)
}
