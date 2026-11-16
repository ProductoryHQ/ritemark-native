/**
 * The deck view's `deck/current` (17 November): the slide it shows, for the Slide library's "Insert after slide N", and
 * for the AI, the slide the person is on, with its id and title. Only those travel: the slide's words reach the AI
 * through the deck tools when it reads. The current slide is the one the strip picked, the stage shows, or whose part
 * holds the caret in the handout, by the deck view's one current-part rule.
 */

import { MAX_CURRENT_TITLE, type DeckCurrentSlide } from '../../../../src/decks/deckProtocol'
import type { SlideData } from '../../../../src/decks/deckFormat'

/** How long the view waits for the current slide to settle before it tells the host (scrolling, typing a title). */
export const CURRENT_SLIDE_SETTLE_MS = 150

export type CurrentSlideMessage = {
  index: number
  count: number
  slides?: DeckCurrentSlide[]
}

/** The message for slide `index` of `count`, given the slides' data by place. No slide there: only the place travels. */
export function currentSlideMessage(index: number, count: number, slides: ReadonlyArray<{ data: SlideData }>): CurrentSlideMessage {
  const slide = count > 0 && index < count ? slides[index] : undefined
  if (!slide) return { index, count }
  const id = typeof slide.data.id === 'string' && /^[0-9a-z]{1,16}$/i.test(slide.data.id) ? slide.data.id : undefined
  const title = typeof slide.data.title === 'string' ? slide.data.title.replace(/\s+/g, ' ').trim().slice(0, MAX_CURRENT_TITLE) : ''
  return { index, count, slides: [{ index, ...(id ? { id } : {}), ...(title ? { title } : {}) }] }
}
