/**
 * #931 (the decks README, "Save as PDF, from Publish", 20 November): the bar's "Saved as <name>.pdf" shows the whole
 * name when the bar has room for it; only a name too long for the room is cut, in the middle, keeping its start, its
 * end and its extension ("Day one – sl…handout.pdf"). Pure, so the cut is tested under Node; `DeckView`'s notice
 * measures the room and asks `fitNotice` for the longest words that fit.
 */

/** The cut's mark: one ellipsis character. */
export const CUT = '…'

/** `name` kept to `keep` characters (and the ellipsis), its start and end kept, the end never shorter than its extension. */
export function middleCut(name: string, keep: number): string {
  if (keep >= name.length) return name
  const keepAt = Math.max(2, Math.floor(keep))
  const extension = /\.[^.\s]{1,6}$/.exec(name)?.[0] ?? ''
  // The end holds the extension whatever the room; the start at least one character.
  const tail = Math.max(extension.length, Math.min(keepAt - 1, Math.max(extension.length + 1, Math.floor(keepAt / 2))))
  const head = Math.max(1, keepAt - tail)
  return `${name.slice(0, head).trimEnd()}${CUT}${name.slice(name.length - tail)}`
}

/**
 * The notice's words for the room: `prefix` and the whole `name` when they fit, else the longest middle cut of the name
 * that fits (`fits` measures), else its shortest.
 */
export function fitNotice(prefix: string, name: string, fits: (words: string) => boolean): string {
  if (fits(prefix + name)) return prefix + name
  let low = 2
  let high = name.length - 1
  let best = 2
  while (low <= high) {
    const keep = Math.floor((low + high) / 2)
    if (fits(prefix + middleCut(name, keep))) {
      best = keep
      low = keep + 1
    } else {
      high = keep - 1
    }
  }
  return prefix + middleCut(name, best)
}
