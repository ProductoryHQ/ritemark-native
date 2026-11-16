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

/** A folded side's button sits this far from the line, inside the side that shows. (Its distance from the room's
 *  bottom, 28 px, is decks.css's `.deck-fold`, the one place it is kept.) */
const INSET = 22

interface FoldButton { label: string; icon: 'caret-left' | 'caret-right'; side: 'slide' | 'handout' }

/** The fold's control at the line between the slide and the handout (`line`, from the desk's left). With both sides
 *  shown, the split pill's two halves, upper first, centred on the line; otherwise one round button, `INSET` inside the
 *  side that shows, to bring the folded side back. The returned `left` is where the control's middle stands. */
export function foldControl(slideShown: boolean, handoutShown: boolean, line: number): { left: number; buttons: FoldButton[] } {
  if (!slideShown) return { left: line + INSET, buttons: [{ label: 'Show the slide', icon: 'caret-right', side: 'slide' }] }
  if (!handoutShown) return { left: line - INSET, buttons: [{ label: 'Show the handout', icon: 'caret-left', side: 'handout' }] }
  return {
    left: line,
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
  // Two buttons are the split pill; one is the round button that brings a folded side back.
  const split = control.buttons.length === 2
  return (
    // One element whatever the fold, and each half keyed by its side: the pressed half stays the same button when the
    // pill becomes the one round button, so the keyboard's focus stays on it.
    <div
      className={`deck-fold${split ? ' is-split' : ''}`}
      style={{ left: control.left }}
      role={split ? 'group' : undefined}
      aria-label={split ? 'Fold either side' : undefined}
    >
      {control.buttons.map((button, at) => (
        <Tooltip key={button.side} label={button.label} side={split ? 'right' : 'bottom'}>
          <Button
            variant={split ? 'ghost' : 'outline'}
            size="icon-sm"
            // Each half names its end of the pill, so its corners and the hairline never depend on Tooltip's wrapper.
            className={`deck-fold-button${split ? (at === 0 ? ' is-upper' : ' is-lower') : ''}`}
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
