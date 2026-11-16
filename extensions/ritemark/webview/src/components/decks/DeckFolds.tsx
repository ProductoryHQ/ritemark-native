/**
 * Fold either side (experience 46, "Fold either side"; Jarmo, 16 November: the opposite arrow too, "et saaksin keskenduda
 * ainult teksti kirjutamisele"). The line between the slide and the handout carries one split control (Jarmo, 16 November:
 * "see võiks olla split button"): a 26 px pill standing upright on the line, ‹ Hide the slide over › Hide the handout,
 * with a hairline between the halves. With the slide above the handout (deckLayout.ts), the pill lies flat at the
 * line's right end: ˄ Hide the slide, ˅ Hide the handout. With the slide hidden, the handout is a Text document's
 * centred column and one round › at its left edge (˅ at its top edge, above) brings the slide back; with the handout
 * hidden, one round ‹ at the line (˄ at the slide's bottom, above) brings it back.
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

/** What this deck's view keeps: the slide's share of the width beside the handout (`deckRatio`), its share of the
 *  height above it (`deckAboveRatio`), and the fold. Never the file. */
export interface DeckViewState { deckRatio?: unknown; deckAboveRatio?: unknown; deckFold?: unknown; deckConversionNoticed?: unknown }

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
 *  bottom, 28 px, or from its right end with the slide above, is decks.css's `.deck-fold`, the one place it is kept.) */
const INSET = 22

interface FoldButton { label: string; icon: 'caret-left' | 'caret-right' | 'caret-up' | 'caret-down'; side: 'slide' | 'handout' }

/**
 * The fold's control at the line between the slide and the handout. Beside, `line` is the line's distance from the
 * desk's left and the split pill stands upright on it: ‹ Hide the slide over › Hide the handout. With the slide above
 * (`above`), `line` is its distance from the desk's top and the pill lies flat at the line's right end: ˄ Hide the
 * slide, ˅ Hide the handout. With one side hidden, one round button, `INSET` inside the side that shows, brings the
 * folded side back: at the handout's left edge (its top right above, where the pill was, so the hand returns to the same spot), or at the slide's right or bottom end. The
 * returned `at` is where the control's middle stands along the line's axis.
 */
export function foldControl(slideShown: boolean, handoutShown: boolean, line: number, above = false): { at: number; buttons: FoldButton[] } {
  if (!slideShown) return { at: line + INSET, buttons: [{ label: 'Show the slide', icon: above ? 'caret-down' : 'caret-right', side: 'slide' }] }
  if (!handoutShown) return { at: line - INSET, buttons: [{ label: 'Show the handout', icon: above ? 'caret-up' : 'caret-left', side: 'handout' }] }
  return {
    at: line,
    buttons: [
      { label: 'Hide the slide', icon: above ? 'caret-up' : 'caret-left', side: 'slide' },
      { label: 'Hide the handout', icon: above ? 'caret-down' : 'caret-right', side: 'handout' },
    ],
  }
}

export function DeckFolds({ slideShown, handoutShown, line, above = false, onToggle }: {
  slideShown: boolean
  handoutShown: boolean
  /** The line between the slide and the handout: from the desk's left beside, from its top with the slide above. */
  line: number
  above?: boolean
  onToggle: (side: 'slide' | 'handout') => void
}) {
  const control = foldControl(slideShown, handoutShown, line, above)
  // Two buttons are the split pill; one is the round button that brings a folded side back.
  const split = control.buttons.length === 2
  // The tooltip opens off the line: beside the upright pill, over the flat one, and into the side that shows.
  const tipSide = split ? (above ? 'top' : 'right') : above && slideShown ? 'top' : 'bottom'
  return (
    // One element whatever the fold, and each half keyed by its side: the pressed half stays the same button when the
    // pill becomes the one round button, so the keyboard's focus stays on it.
    <div
      className={`deck-fold${split ? ' is-split' : ''}${above ? ' is-above' : ''}`}
      style={above ? { top: control.at } : { left: control.at }}
      role={split ? 'group' : undefined}
      aria-label={split ? 'Fold either side' : undefined}
    >
      {control.buttons.map((button, at) => (
        <Tooltip key={button.side} label={button.label} side={tipSide}>
          <Button
            variant={split ? 'ghost' : 'outline'}
            size="icon-sm"
            // Each half names its end of the pill (the upper one, or the left one when it lies flat), so its corners and
            // the hairline never depend on Tooltip's wrapper.
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
