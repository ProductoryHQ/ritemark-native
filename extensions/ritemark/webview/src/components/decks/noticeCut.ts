/**
 * #931 (the decks README, "Save as PDF, from Publish", 20 November): the bar's "Saved as <name>.pdf" shows the whole
 * name when the bar has room for it; only a name too long for the room is cut, in the middle, keeping its start, its
 * end and its extension ("Day one – sl…handout.pdf"). Pure, so the cut is tested under Node; `DeckView`'s notice
 * measures the room and asks `fitNotice` for the longest words that fit.
 */

/** The cut's mark: one ellipsis character. */
export const CUT = '…'

type GraphemeSegmenter = new (locale?: string, options?: { granularity: 'grapheme' }) => { segment(text: string): Iterable<{ segment: string }> }

/**
 * A name's characters as a person sees them (grapheme clusters: an emoji, a joined emoji, a flag or an accented letter
 * is one), so a cut never splits one into a lone half (Codex on #932). Code points where the runtime has no
 * `Intl.Segmenter`.
 */
export function charactersOf(name: string): string[] {
  const Segmenter = (Intl as { Segmenter?: GraphemeSegmenter }).Segmenter
  return Segmenter ? Array.from(new Segmenter(undefined, { granularity: 'grapheme' }).segment(name), part => part.segment) : Array.from(name)
}

/** Keep a full note visible, and require 3 px of extra room to restore a clipped note. */
export function hideClippedNotice(
  text: string, room: number, hiddenFor: string | undefined, measure: (text: string) => number, shortestCut?: string,
): boolean {
  const displayed = text.replace(/\s+/g, ' ').trim()
  if (room + 0.5 >= measure(displayed)) return false
  const prefix = charactersOf(displayed).slice(0, 12).join('').trimEnd()
  const minimum = Math.max(
    measure(prefix + CUT),
    shortestCut === undefined ? 0 : measure(shortestCut.replace(/\s+/g, ' ').trim()),
  )
  return room < minimum + (hiddenFor === text ? 3 : 0)
}

/** `name` kept to `keep` characters (and the ellipsis), its start and end kept, the end never shorter than its extension. */
export function cutName(name: string, keep: number): string {
  const characters = charactersOf(name)
  if (keep >= characters.length) return name
  const keepAt = Math.max(2, Math.floor(keep))
  const extension = charactersOf(/\.[^.\s]{1,6}$/.exec(name)?.[0] ?? '').length
  // The end holds the extension whatever the room; the start at least one character.
  const tail = Math.max(extension, Math.min(keepAt - 1, Math.max(extension + 1, Math.floor(keepAt / 2))))
  const head = Math.max(1, keepAt - tail)
  return `${characters.slice(0, head).join('').trimEnd()}${CUT}${characters.slice(characters.length - tail).join('')}`
}

/**
 * The notice's words for the room: `prefix` and the whole `name` when they fit, else the longest middle cut of the name
 * that fits (`fits` measures), else its shortest.
 */
export function fitNotice(prefix: string, name: string, fits: (words: string) => boolean): string {
  if (fits(prefix + name)) return prefix + name
  let low = 2
  let high = charactersOf(name).length - 1
  let best = 2
  while (low <= high) {
    const keep = Math.floor((low + high) / 2)
    if (fits(prefix + cutName(name, keep))) {
      best = keep
      low = keep + 1
    } else {
      high = keep - 1
    }
  }
  return prefix + cutName(name, best)
}
