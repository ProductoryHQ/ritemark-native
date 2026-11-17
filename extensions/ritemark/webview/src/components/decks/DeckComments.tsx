/**
 * Sprint 161 (experience 46, "Comments on the slide, for Claude": "the deck's bar gets the comments button with its
 * count and Prev/Next across slides"). The comments on the deck's slides, in order, and the bar's control that goes
 * through them: the count opens the first one here or after, and Previous and Next go on from the one open, across the
 * slides, as Word's do. Each one opens on its slide, its card latched under what it is on.
 *
 * A slide's comments are counted from its Markdown (`slideCommentsOf`), the ones with words, in the order they are
 * written: the order the stage's markers have too. The handout's comments are the Text editor's own, as today.
 */
import { isBlockSlide, type SlideData } from '../../../../src/decks/deckFormat'
import { slideCommentsOf } from '../../../../src/decks/blocks/slideComments'
import { Button } from '../ui/button'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'

/** One comment to stop at: its slide (from 0) and its place among that slide's comments. */
export interface DeckCommentStop {
  slide: number
  ordinal: number
}

/** Every slide comment with words, slide by slide, in the order they are written. */
export function deckCommentStops(slides: ReadonlyArray<{ kind: string; data: SlideData }>): DeckCommentStop[] {
  const stops: DeckCommentStop[] = []
  slides.forEach((slide, index) => {
    if (!isBlockSlide(slide.kind)) return
    const comments = slideCommentsOf(slide.data.markdown ?? '').filter(comment => comment.note.trim())
    comments.forEach((_comment, ordinal) => stops.push({ slide: index, ordinal }))
  })
  return stops
}

/**
 * The stop to go to: from the one open (`at`, when it is still on the current slide), the next or the previous; with
 * none open, Next is the first on the current slide or after it, and Previous the last before it. Null at either end.
 */
export function nextCommentStop(stops: DeckCommentStop[], at: number | null, current: number, direction: 1 | -1): number | null {
  if (!stops.length) return null
  const open = at !== null && stops[at] && stops[at].slide === current ? at : null
  if (open !== null) {
    const next = open + direction
    return next >= 0 && next < stops.length ? next : null
  }
  if (direction === 1) {
    const index = stops.findIndex(stop => stop.slide >= current)
    return index >= 0 ? index : null
  }
  for (let index = stops.length - 1; index >= 0; index--) if (stops[index].slide < current) return index
  return null
}

/** The count's words: "3 comments on the slides". */
export function deckCommentsLabel(count: number): string {
  return count === 1 ? '1 comment on the slides' : `${count} comments on the slides`
}

export function DeckComments({ stops, at, current, onGo }: {
  stops: DeckCommentStop[]
  /** The stop open now, if any. */
  at: number | null
  /** The current slide, from 0. */
  current: number
  onGo: (stop: number) => void
}) {
  if (!stops.length) return null
  const previous = nextCommentStop(stops, at, current, -1)
  const next = nextCommentStop(stops, at, current, 1)
  const first = next ?? 0
  const label = deckCommentsLabel(stops.length)
  return (
    <span className="deck-comments" role="group" aria-label="Comments">
      <Tooltip label={`${label}. Open the first one here or after.`}>
        <Button variant="toolbar" size="sm" aria-label={label} onClick={() => onGo(first)}>
          <Icon name="chat" size={14} tone="inherit" />
          <span className="deck-comments-count">{stops.length}</span>
        </Button>
      </Tooltip>
      <Tooltip label={previous === null ? 'No comment before this one' : 'Previous comment'}>
        <Button variant="ghost" size="icon-xs" aria-label="Previous comment" disabled={previous === null} onClick={() => previous !== null && onGo(previous)}>
          <Icon name="caret-left" size={14} tone="inherit" />
        </Button>
      </Tooltip>
      <Tooltip label={next === null ? 'No comment after this one' : 'Next comment'}>
        <Button variant="ghost" size="icon-xs" aria-label="Next comment" disabled={next === null} onClick={() => next !== null && onGo(next)}>
          <Icon name="caret-right" size={14} tone="inherit" />
        </Button>
      </Tooltip>
    </span>
  )
}
