/**
 * Fold either side (experience 46, "Fold either side"; Jarmo, 16 November: the opposite arrow too, "et saaksin keskenduda
 * ainult teksti kirjutamisele"). The line between the slide and the handout carries two round buttons, one above the
 * other: ‹ Hide the slide, and › Hide the handout. With the slide hidden, the handout is a Text document's centred column
 * and one › at its left edge brings the slide back; with the handout hidden, one ‹ at the line brings it back.
 *
 * The fold is one value, so the two sides can never both be hidden. Each deck keeps it in its own view state, as it
 * keeps the divider's share, never in the file: opening a deck writes nothing.
 */
import { Button } from '../ui/button'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'
import { getState, saveState } from '../../bridge'

/** Which side is folded away: the slide, the handout, or neither. */
export type DeckFold = 'slide' | 'handout' | null

/** The fold as the view kept it; anything else is no fold. */
export function foldFrom(stored: unknown): DeckFold {
  return stored === 'slide' || stored === 'handout' ? stored : null
}

/** The fold this deck's view kept, if any. */
export function storedFold(): DeckFold {
  try {
    return foldFrom(getState<{ deckFold?: unknown } | null>()?.deckFold)
  } catch {
    return null
  }
}

/** Keeps the fold in this deck's view state, beside what the view already keeps there (the divider's share). */
export function keepFold(fold: DeckFold) {
  try {
    const next: Record<string, unknown> = { ...((getState<object | null>() ?? {}) as object) }
    if (fold) next.deckFold = fold
    else delete next.deckFold
    saveState(next)
  } catch {
    // Kept for this view only; without the view's state the deck opens with both sides.
  }
}

/** The fold a button press makes: pressing a side's button folds it, or brings it back when it is the folded one. */
export function toggledFold(current: DeckFold, side: 'slide' | 'handout'): DeckFold {
  return current === side ? null : side
}

/** What each side shows, from the fold and whether the desk has room for the handout at all. */
export function foldedSides(fold: DeckFold, handoutRoom: boolean): { slideShown: boolean; handoutShown: boolean } {
  const handoutShown = fold !== 'handout' && handoutRoom
  // The slide folds only while the handout shows: with no room for the handout, the slide stays.
  return { slideShown: fold !== 'slide' || !handoutShown, handoutShown }
}

/** The buttons' distance from the room's bottom: the lower one's (today's fold), and the upper one's above it. */
const LOWER = 28
const UPPER = 64
/** A folded side's button sits this far from the line, inside the side that shows. */
const INSET = 22

interface FoldButton { label: string; icon: 'caret-left' | 'caret-right'; side: 'slide' | 'handout'; left: number; bottom: number }

/** The round buttons for the fold, at the line between the slide and the handout (`left`, from the desk's left). */
export function foldButtons(slideShown: boolean, handoutShown: boolean, left: number): FoldButton[] {
  if (!slideShown) return [{ label: 'Show the slide', icon: 'caret-right', side: 'slide', left: left + INSET, bottom: LOWER }]
  if (!handoutShown) return [{ label: 'Show the handout', icon: 'caret-left', side: 'handout', left: left - INSET, bottom: LOWER }]
  return [
    { label: 'Hide the slide', icon: 'caret-left', side: 'slide', left, bottom: UPPER },
    { label: 'Hide the handout', icon: 'caret-right', side: 'handout', left, bottom: LOWER },
  ]
}

export function DeckFolds({ slideShown, handoutShown, left, onToggle }: {
  slideShown: boolean
  handoutShown: boolean
  left: number
  onToggle: (side: 'slide' | 'handout') => void
}) {
  return (
    <>
      {foldButtons(slideShown, handoutShown, left).map(button => (
        // Keyed by its side: the pressed button stays the same element, so the keyboard's focus stays on it.
        <div key={button.side} className="deck-fold" style={{ left: button.left, bottom: button.bottom }}>
          <Tooltip label={button.label}>
            <Button
              variant="outline"
              size="icon-sm"
              className="deck-fold-button"
              aria-label={button.label}
              onClick={() => onToggle(button.side)}
            >
              <Icon name={button.icon} size={14} tone="inherit" />
            </Button>
          </Tooltip>
        </div>
      ))}
    </>
  )
}
