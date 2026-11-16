/**
 * The deck view's `deck/current-slide` (17 November): for the AI, the slide the person is on, with its id and title.
 * Only those travel: the slide's words reach the AI through the deck tools when it reads. The current slide is the one
 * the strip picked, the stage shows, or whose part holds the caret in the handout, by the deck view's one rule.
 */

import { isCurrentSlideId, type DeckCurrentSlide } from '../../../../src/decks/deckProtocol'
import { slideTitleLine } from '../../../../src/decks/currentSlide'
import type { SlideData } from '../../../../src/decks/deckFormat'

/** How long the view waits for the current slide to settle before it tells the host (scrolling, typing a title). */
export const CURRENT_SLIDE_SETTLE_MS = 150

export type CurrentSlideMessage = {
  count: number
  slides: DeckCurrentSlide[]
}

/** The message for slide `index` of `count`, given the slides' data by place. No slide there: an empty list. */
export function currentSlideMessage(index: number, count: number, slides: ReadonlyArray<{ data: SlideData }>): CurrentSlideMessage {
  const slide = count > 0 && index < count ? slides[index] : undefined
  if (!slide) return { count, slides: [] }
  // A hand-written `id: 42` is read as a number; it is the slide's id all the same
  const rawId: unknown = slide.data.id
  const id = typeof rawId === 'number' && Number.isInteger(rawId) ? String(rawId) : rawId
  const title = slideTitleLine(slide.data.title)
  return { count, slides: [{ index, ...(isCurrentSlideId(id) ? { id } : {}), ...(title ? { title } : {}) }] }
}
