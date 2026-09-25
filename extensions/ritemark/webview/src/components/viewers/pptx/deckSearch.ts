/**
 * Sprint 125 (#285) R4 — search a deck.
 *
 * Only the slides near the view are drawn (so a chart-heavy deck does not keep a
 * canvas per chart), which means the drawn text cannot be counted. Matches are
 * counted in the deck's own text instead — each slide's shapes and its speaker
 * notes — with the same case-folded matcher as the Word preview, a match never
 * crossing from one paragraph into the next. The viewer then highlights the
 * words themselves in whichever slides are drawn. Pure.
 */
import { findAll, normalizeQuery } from '../../../utils/textSearch'

/** Each slide's text, one string per paragraph or table cell, in drawing order. */
export interface DeckText {
  slides: string[][]
  notes: string[][]
}

export interface DeckMatch {
  slide: number
  where: 'slide' | 'notes'
  /** The match's place among this slide's (or its notes') matches. */
  ordinal: number
}

/** The renderer's text index entry, as far as the count needs it. */
export interface IndexEntry {
  slideIndex: number
  nodePath: string
  text: string
}

/**
 * Paragraphs per slide from the renderer's text index. The index also lists the
 * master's and the layout's shapes on every slide (`slides/3/master/nodes/…`);
 * those are dropped, so repeated footers do not count once per slide.
 */
export function slideParagraphs(entries: readonly IndexEntry[], slideCount: number): string[][] {
  const slides: string[][] = Array.from({ length: slideCount }, () => [])
  for (const entry of entries) {
    if (!/^slides\/\d+\/nodes\//.test(entry.nodePath)) continue
    slides[entry.slideIndex]?.push(...entry.text.split('\n'))
  }
  return slides
}

export function countIn(blocks: readonly string[], needle: string): number {
  let count = 0
  for (const block of blocks) count += findAll(block, needle).length
  return count
}

/** Every match in the deck, slide by slide: a slide's own text first, then its notes. */
export function deckMatches(text: DeckText, query: string): DeckMatch[] {
  const needle = normalizeQuery(query)
  if (!needle) return []
  const matches: DeckMatch[] = []
  text.slides.forEach((blocks, slide) => {
    const onSlide = countIn(blocks, needle)
    for (let ordinal = 0; ordinal < onSlide; ordinal++) matches.push({ slide, where: 'slide', ordinal })
    const inNotes = countIn(text.notes[slide] ?? [], needle)
    for (let ordinal = 0; ordinal < inNotes; ordinal++) matches.push({ slide, where: 'notes', ordinal })
  })
  return matches
}

/** Where a new search starts: the first match on or after the slide being read. */
export function firstMatchFrom(matches: readonly DeckMatch[], slide: number): number {
  if (matches.length === 0) return -1
  const index = matches.findIndex((match) => match.slide >= slide)
  return index < 0 ? 0 : index
}
