/**
 * Fold either side (experience 46, "Fold either side"; Jarmo, 16 November: the opposite arrow too, "et saaksin keskenduda
 * ainult teksti kirjutamisele"). The line between the slide and the handout carries one split control (Jarmo, 16 November:
 * "see võiks olla split button"): a 26 px pill standing upright on the line, ‹ Hide the slide over › Hide the handout,
 * with a hairline between the halves. With the slide hidden, the handout is a Text document's centred column and one
 * round › at its left edge brings the slide back; with the handout hidden, one round ‹ at the line brings it back.
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

/** What this deck's view keeps: the slide's share (the divider) and the fold. Never the file. */
export interface DeckViewState { deckRatio?: unknown; deckFold?: unknown }

/** This deck's kept view state, or nothing when the view has none. */
export function deckViewState(): DeckViewState {
  try {
    return getState<DeckViewState | null>() ?? {}
  } catch {
    return {}
  }
}

/** Keeps a change in this deck's view state, beside what is already kept there; an undefined value removes its key. */
export function keepDeckViewState(change: DeckViewState) {
  try {
    const next: Record<string, unknown> = { ...((getState<object | null>() ?? {}) as object), ...change }
    for (const key of Object.keys(change) as (keyof DeckViewState)[]) if (change[key] === undefined) delete next[key]
    saveState(next)
  } catch {
    // Kept for this view only; without the view's state the defaults stand next time.
  }
}

/** The fold this deck's view kept, if any. */
export const storedFold = (): DeckFold => foldFrom(deckViewState().deckFold)

/** Keeps the fold in this deck's view state; both sides shown is no entry at all. */
export const keepFold = (fold: DeckFold) => keepDeckViewState({ deckFold: fold ?? undefined })

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

/** The fold's distance from the room's bottom: the pill's lower end, or the one round button's. */
const BOTTOM = 28
/** A folded side's button sits this far from the line, inside the side that shows. */
const INSET = 22

interface FoldButton { label: string; icon: 'caret-left' | 'caret-right'; side: 'slide' | 'handout' }

/** The fold's control: with both sides shown, the split pill's two halves, upper first; otherwise one round button to
 *  bring the folded side back. `left` is where it stands, from the desk's left (the pill's middle on the line). */
export function foldControl(slideShown: boolean, handoutShown: boolean, line: number): { left: number; bottom: number; split: boolean; buttons: FoldButton[] } {
  if (!slideShown) return { left: line + INSET, bottom: BOTTOM, split: false, buttons: [{ label: 'Show the slide', icon: 'caret-right', side: 'slide' }] }
  if (!handoutShown) return { left: line - INSET, bottom: BOTTOM, split: false, buttons: [{ label: 'Show the handout', icon: 'caret-left', side: 'handout' }] }
  return {
    left: line,
    bottom: BOTTOM,
    split: true,
    buttons: [
      { label: 'Hide the slide', icon: 'caret-left', side: 'slide' },
      { label: 'Hide the handout', icon: 'caret-right', side: 'handout' },
    ],
  }
}

export function DeckFolds({ slideShown, handoutShown, left, onToggle }: {
  slideShown: boolean
  handoutShown: boolean
  left: number
  onToggle: (side: 'slide' | 'handout') => void
}) {
  const control = foldControl(slideShown, handoutShown, left)
  return (
    // One element whatever the fold, and each half keyed by its side: the pressed half stays the same button when the
    // pill becomes the one round button, so the keyboard's focus stays on it.
    <div
      className={`deck-fold${control.split ? ' is-split' : ''}`}
      style={{ left: control.left, bottom: control.bottom }}
      role={control.split ? 'group' : undefined}
      aria-label={control.split ? 'Fold either side' : undefined}
    >
      {control.buttons.map(button => (
        <Tooltip key={button.side} label={button.label} side={control.split ? 'right' : 'bottom'}>
          <Button
            variant={control.split ? 'ghost' : 'outline'}
            size="icon-sm"
            className="deck-fold-button"
            aria-label={button.label}
            onClick={() => onToggle(button.side)}
          >
            <Icon name={button.icon} size={14} tone="inherit" />
          </Button>
        </Tooltip>
      ))}
    </div>
  )
}
