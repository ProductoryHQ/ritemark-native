/**
 * Slide, both or handout: the deck's view (experience 46; Jarmo, 16 November: fold either side, "et saaksin keskenduda
 * ainult teksti kirjutamisele"). Since 17 November it is chosen with a view switch on the deck's bar (`DeckViewSwitch`),
 * right after the strip's button: Slide only (the easel), Slide and handout (two panes side by side, or one above the
 * other, drawn the way the room is split now) and Handout only (a page of lines). It replaces the fold arrows on the
 * line between the panes, because chevrons beside a slide read as previous and next ("kasutaja arvab, et saab
 * navigeerida slaidide vahel"). The line between the panes only drags.
 *
 * The view is one value (the fold: which side is folded away), so the two sides can never both be hidden. Since
 * 19 November every deck opens in Slide only, a new deck too (Jarmo: "slide only should be default view"): the view
 * lives only while the deck is open (its webview keeps its context when hidden), and nothing is stored in the file or
 * remembered, so a deck opened again starts in Slide only. A fold an older build kept in the view state is never read.
 * Two exceptions show the handout, where the words are: a deck that opens with no slide, and Find, which borrows it
 * while open (`foldForFind`).
 */
import { Button } from '../ui/button'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'
import { getState, saveState } from '../../bridge'

/** Which side is folded away: the slide, the handout, or neither. */
export type DeckFold = 'slide' | 'handout' | null

/** What this deck's view keeps: the slide's share of the width beside the handout (`deckRatio`) and its share of the
 *  height above it (`deckAboveRatio`), and thumbnails or list (`deckStripMode`). A `deckFold` an older build kept is not read. */
export interface DeckViewState { deckRatio?: unknown; deckAboveRatio?: unknown; deckConversionNoticed?: unknown; deckStripMode?: unknown }

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

/** The fold every deck opens with: the handout folded away, Slide only. A constant, never read from anything kept, so
 *  nothing an older build kept (its `deckFold`) can bring back a different start. */
export const OPENING_FOLD: DeckFold = 'handout'

/**
 * Find borrows the handout (Experience lead, 19 November): its bar and matches are the handout's, so opening Find in
 * Slide only shows the handout beside the slide, and closing it returns to Slide only. `borrowed` says the handout is on
 * loan; a view the person chooses while Find is open ends the loan (the caller clears it), and that view then holds.
 * With no room for the handout (under 600 px) nothing is borrowed; a deck with no slide left keeps the handout.
 */
export function foldForFind(findOpen: boolean, fold: DeckFold, borrowed: boolean, handoutRoom = true, hasSlides = true): { fold: DeckFold; borrowed: boolean } {
  if (findOpen) return fold === 'handout' && handoutRoom ? { fold: null, borrowed: true } : { fold, borrowed }
  return { fold: borrowed && hasSlides ? 'handout' : fold, borrowed: false }
}

/** What each side shows, from the fold and whether the desk has room for the handout at all. */
export function foldedSides(fold: DeckFold, handoutRoom: boolean): { slideShown: boolean; handoutShown: boolean } {
  const handoutShown = fold !== 'handout' && handoutRoom
  // The slide folds only while the handout shows: with no room for the handout, the slide stays.
  return { slideShown: fold !== 'slide' || !handoutShown, handoutShown }
}

/** The deck's three views: the slide alone, both, the handout alone. */
export type DeckViewMode = 'slide' | 'both' | 'handout'

/** The view a fold shows: the handout folded away is Slide only, the slide folded away Handout only. */
export function viewOfFold(fold: DeckFold): DeckViewMode {
  return fold === 'handout' ? 'slide' : fold === 'slide' ? 'handout' : 'both'
}

/** The fold that shows a view. */
export function foldOfView(view: DeckViewMode): DeckFold {
  return view === 'slide' ? 'handout' : view === 'handout' ? 'slide' : null
}

/** One of the switch's three parts: its view, its words (the tooltip and the name a screen reader says) and its icon. */
export interface ViewPart { view: DeckViewMode; label: string; icon: 'presentation' | 'square-split-horizontal' | 'square-split-vertical' | 'article' }

/**
 * The switch's parts, in order. Slide and handout's icon is drawn the way the room is split now: two panes side by
 * side, or one above the other (`above`).
 */
export function viewParts(above: boolean): ViewPart[] {
  return [
    { view: 'slide', label: 'Slide only', icon: 'presentation' },
    { view: 'both', label: 'Slide and handout', icon: above ? 'square-split-vertical' : 'square-split-horizontal' },
    { view: 'handout', label: 'Handout only', icon: 'article' },
  ]
}

/**
 * The view switch on the deck's bar: three small icons in one segment, the chosen one raised. Layout glyphs, the kind
 * macOS and VS Code use to show or hide a pane, never arrows, so nothing reads as moving between slides. Each part is
 * a button of its own (Tab reaches it, Enter or Space chooses it) with its tooltip.
 */
export function DeckViewSwitch({ view, above, onView }: { view: DeckViewMode; above: boolean; onView: (view: DeckViewMode) => void }) {
  return (
    <div className="deck-view-switch" role="group" aria-label="View">
      {viewParts(above).map(part => (
        <Tooltip key={part.view} label={part.label}>
          <Button
            variant="toolbar"
            size="icon-sm"
            className="deck-view-part"
            data-state={view === part.view ? 'active' : undefined}
            aria-pressed={view === part.view}
            aria-label={part.label}
            onClick={() => onView(part.view)}
          >
            <Icon name={part.icon} size={14} tone="inherit" />
          </Button>
        </Tooltip>
      ))}
    </div>
  )
}
