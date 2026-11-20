/**
 * Sprint 159 PR 4 (experience 46, frame 6): Publish on the deck's bar, 2.2's Publish on the handout page the host
 * writes beside the deck.
 *
 *  - Hidden until Publish can be reached (the flag on and the whole-window sheet there), as the browser bar's is.
 *  - On the bar after Saved, before Present (frame 2), at the bar's 30 px (`size="bar"`).
 *  - Unpublished: Publish, outlined, with the globe. Published: the chip, "Published" or "Published · changed", whose menu has See online, Copy
 *    link, Update the page (only after a public change) and Unpublish. Publishing… and Unpublishing… while they run.
 *  - Publish and Update the page send the deck's text and look as this view holds them (the document may not have its
 *    newest words or look yet) and each slide's fit, numbers only, so the page's slides fit as the deck view's do. The
 *    fit is measured on the slides drawn once out of sight (`MeasureSlides`) in that look, the way the strip draws
 *    them, so it is there with the strip hidden or the desk narrow too.
 *
 * The host keeps the state (`deck/page-state`); this only draws it and asks.
 *
 * Sprint 170 (#881, the decks README "Save as PDF, from Publish"): where this app can save a PDF (`state.pdf`), Publish
 * is a split button: Publish stays its main part, and the ▾, a part of its own with its own hover and focus, opens
 * Publish… and one item that names what it saves from the view at the press (`pdfKindFor`). The Published chip's menu
 * holds the same item. The PDF takes the slides' fit the way Publish does; the host asks for the file and prints it.
 * The split button's hover is the whole button's (ui/split-button.tsx; Jarmo, 26 October); the ▾ keeps its own click
 * and focus. With Publish not reachable (off, or not ready yet), a plain Save as PDF button keeps the PDF's place: it
 * is a local file (the Experience lead, 20 November).
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { DeckPageAction, DeckPageState, DeckPdfKind } from '../../../../src/decks/deckProtocol'
import { pdfItemLabel, pdfKindFor } from '../../../../src/decks/deckPdfKinds'
import type { DeckTheme } from '../../../../src/decks/deckTheme'
import { onMessage, sendToExtension } from '../../bridge'
import { Button } from '../ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { SplitButton } from '../ui/split-button'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'
import type { DeckSlideEntry } from './deckDocument'
import type { DeckViewMode } from './DeckFolds'
import { SlideCanvas } from './slide/SlideCanvas'
import { BLOCK_MAX_STEP } from '../../../../src/decks/blocks/slideRenderer'

/** The measuring slides' width: any will do, since the fit is measured on the 960 × 540 layout before it is scaled. */
const MEASURE_WIDTH = 192

/** Each slide's fit as `MeasureSlides` measured it, by its place in the deck; 0 where a slide wasn't measured. */
export function measuredSteps(count: number, root: ParentNode): number[] {
  const steps = Array.from({ length: count }, () => 0)
  root.querySelectorAll<HTMLElement>('[data-measure]').forEach(slot => {
    const index = Number(slot.getAttribute('data-measure'))
    const step = Number(slot.querySelector('.deck-slide')?.getAttribute('data-step'))
    if (Number.isInteger(index) && index >= 0 && index < count && Number.isInteger(step)) steps[index] = Math.max(0, Math.min(BLOCK_MAX_STEP, step))
  })
  return steps
}

/** What Publish sends: the view's text and look at the press, and each slide's fit measured in that look. */
export function publishRequest(pressed: { text: string; borderless: boolean }, steps: number[]): { text: string; look: 'card' | 'borderless'; steps: number[] } {
  return { text: pressed.text, look: pressed.borderless ? 'borderless' : 'card', steps }
}

/** What Save as PDF sends: the kind the item named, and the same text, look and fit as Publish. */
export function pdfRequest(kind: DeckPdfKind, pressed: { text: string; borderless: boolean }, steps: number[]): { kind: DeckPdfKind; text: string; look: 'card' | 'borderless'; steps: number[] } {
  return { kind, ...publishRequest(pressed, steps) }
}

/** The note's action after a save (#931, the Experience lead): an icon button right after the name. */
export function showInFolder(name: string): { label: string; tip: string; run: () => void; icon: 'folder-open'; ariaLabel: string } {
  return { label: 'Show in folder', tip: 'Show in folder', icon: 'folder-open', ariaLabel: `Show ${name} in its folder`, run: () => sendToExtension('deck/pdf-show') }
}

/** The bar's note after a save. */
export function savedNotice(name: string): string {
  return `Saved as ${name}`
}

function isState(value: unknown): value is DeckPageState {
  const state = value as DeckPageState | null
  return !!state && typeof state.ready === 'boolean' && typeof state.changed === 'boolean'
    && ['unpublished', 'publishing', 'published', 'unpublishing'].includes(state.kind)
}

interface DeckPublishProps {
  slides: DeckSlideEntry[]
  theme: DeckTheme
  borderless: boolean
  assets: Record<string, string>
  /** The deck's text as this view holds it now, front matter left out. */
  text: () => string
  /** The view as drawn (Slide only under 600 px): what Save as PDF's item names. */
  view: DeckViewMode
  /** `name`: the file the words end with (#931: cut in its middle when the bar is short of room). */
  onNotice: (text: string, action?: { label: string; tip: string; run: () => void; icon?: 'folder-open'; ariaLabel?: string }, name?: string) => void
}

export function DeckPublish({ slides, theme, borderless, assets, text, view, onNotice }: DeckPublishProps) {
  const [state, setState] = useState<DeckPageState | null>(null)
  // A Publish or a Save as PDF waiting for its slides' fit: the slides, the text and the look as they were at the
  // press, and which it was (the PDF's kind named at the press, never read again later).
  const [measuring, setMeasuring] = useState<{ slides: DeckSlideEntry[]; text: string; borderless: boolean; pdf: DeckPdfKind | null } | null>(null)

  useEffect(() => {
    const stop = onMessage(message => {
      if (message.type === 'deck/page-state' && isState(message.state)) setState(message.state)
      if (message.type === 'deck/page-notice' && typeof message.text === 'string') onNotice(message.text)
      if (message.type === 'deck/pdf-saved' && typeof message.name === 'string') {
        onNotice(savedNotice(message.name), showInFolder(message.name), message.name)
      }
    })
    sendToExtension('deck/page-state')
    return stop
  }, [onNotice])

  return (
    <>
      <DeckPublishControl
        state={state}
        view={view}
        onPublish={() => setMeasuring(current => current ?? { slides, text: text(), borderless, pdf: null })}
        onSavePdf={kind => setMeasuring(current => current ?? { slides, text: text(), borderless, pdf: kind })}
        onAction={action => sendToExtension('deck/page-action', { action })}
      />
      {measuring ? createPortal(
        <MeasureSlides
          slides={measuring.slides}
          theme={theme}
          borderless={measuring.borderless}
          assets={assets}
          onMeasured={steps => {
            if (measuring.pdf) sendToExtension('deck/save-pdf', pdfRequest(measuring.pdf, measuring, steps))
            else sendToExtension('deck/publish', publishRequest(measuring, steps))
            setMeasuring(null)
          }}
        />,
        document.body,
      ) : null}
    </>
  )
}

/**
 * The deck's slides drawn once out of sight, as the strip draws them, so their measuring pass finds each one's fit
 * (`data-step`). The pass runs in layout effects, which finish before the next frame; the fit is read after it.
 */
function MeasureSlides({ slides, theme, borderless, assets, onMeasured }: {
  slides: DeckSlideEntry[]
  theme: DeckTheme
  borderless: boolean
  assets: Record<string, string>
  onMeasured: (steps: number[]) => void
}) {
  const root = useRef<HTMLDivElement>(null)
  const measured = useRef(onMeasured)
  measured.current = onMeasured
  useEffect(() => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        if (root.current) measured.current(measuredSteps(slides.length, root.current))
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [slides])
  return (
    <div ref={root} className="deck-measure" aria-hidden="true">
      {slides.map(entry => (
        <div key={entry.index} data-measure={entry.index}>
          <SlideCanvas kind={entry.kind} data={entry.data} width={MEASURE_WIDTH} theme={theme} borderless={borderless} assets={assets} />
        </div>
      ))}
    </div>
  )
}

/** The control for a state: drawn by itself, so each state can be rendered and checked. */
export function DeckPublishControl({ state, view = 'both', onPublish: publish, onSavePdf, onAction: act }: {
  state: DeckPageState | null
  /** The view as drawn: Save as PDF's item names its kind. */
  view?: DeckViewMode
  onPublish: () => void
  onSavePdf?: (kind: DeckPdfKind) => void
  onAction: (action: DeckPageAction) => void
}) {
  if (!state) return null
  // The one PDF item, for the kind this view saves among those this app makes; none where it makes none.
  const pdfKind = onSavePdf ? pdfKindFor(view, state.pdf ?? []) : null
  if (!state.ready) {
    // Publish stays hidden; the PDF, a local file, keeps its place as a plain button.
    if (!pdfKind) return null
    return (
      <Tooltip label={pdfItemLabel(pdfKind).replace(/…$/, '')} className="deck-publish-slot">
        <Button variant="outline" size="bar" className="deck-save-pdf" iconWhenNarrow onClick={() => onSavePdf?.(pdfKind)}>
          <Icon name="file-pdf" size={14} tone="inherit" />
          Save as PDF
        </Button>
      </Tooltip>
    )
  }
  const pdfItem = pdfKind ? (
    <DropdownMenuItem onSelect={() => onSavePdf?.(pdfKind)}>
      <Icon name="file-pdf" size={14} tone="inherit" />
      {pdfItemLabel(pdfKind)}
    </DropdownMenuItem>
  ) : null

  if (state.kind === 'unpublished' && pdfItem) {
    return (
      // Publish stays the main part; the ▾ (its own click and focus) opens Publish… and the PDF item.
      <SplitButton
        tone="outline"
        size="bar"
        className="deck-publish-slot deck-publish-split"
        main={{ label: 'Publish', icon: <Icon name="globe" size={14} tone="inherit" />, tooltip: 'Publish the slides and their handout as a web page', onClick: publish, className: 'deck-publish' }}
        menu={{
          label: 'Publish or save as PDF',
          tooltip: 'Publish, or save the deck as a PDF',
          content: (
            <>
              <DropdownMenuItem onSelect={publish}>
                <Icon name="globe" size={14} tone="inherit" />
                Publish…
              </DropdownMenuItem>
              {pdfItem}
            </>
          ),
        }}
      />
    )
  }

  if (state.kind === 'unpublished') {
    return (
      // When the bar is short of room, Publish folds to its icon after the Theme button's name (decks.css).
      <Tooltip label="Publish the slides and their handout as a web page" className="deck-publish-slot">
        <Button variant="outline" size="bar" className="deck-publish" iconWhenNarrow onClick={publish}>
          <Icon name="globe" size={14} tone="inherit" />
          Publish
        </Button>
      </Tooltip>
    )
  }

  if (state.kind === 'publishing' || state.kind === 'unpublishing') {
    const publishing = state.kind === 'publishing'
    return (
      <Tooltip label={publishing ? 'The page is going online' : 'The page is being taken down'}>
        <Button variant="toolbar" size="bar" className="deck-publish-chip" disabled>
          <Icon name="circle-notch" size={14} tone="inherit" className="animate-spin" />
          {publishing ? 'Publishing…' : 'Unpublishing…'}
        </Button>
      </Tooltip>
    )
  }

  return (
    <DropdownMenu modal={false}>
      <Tooltip label={state.changed ? 'The deck or its theme changed since it was published: update the page from here' : 'The page is online: see it, copy its link or take it down'}>
        <DropdownMenuTrigger asChild>
          <Button variant="toolbar" size="bar" className="deck-publish-chip">
            <Icon name="globe" size={14} tone="inherit" />
            {state.changed ? 'Published · changed' : 'Published'}
            <Icon name="caret-down" size={12} tone="inherit" />
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => act('see-online')}>
          <Icon name="arrow-square-out" size={14} tone="inherit" />
          See online
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => act('copy-link')}>
          <Icon name="link-simple" size={14} tone="inherit" />
          Copy link
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!state.changed} onSelect={publish}>
          <Icon name="arrows-clockwise" size={14} tone="inherit" />
          Update the page
          {state.changed ? null : <span className="ml-auto pl-3 text-[12px] text-ink-muted">No changes</span>}
        </DropdownMenuItem>
        {pdfItem ? <DropdownMenuSeparator /> : null}
        {pdfItem}
        <DropdownMenuSeparator />
        <DropdownMenuItem tone="danger" onSelect={() => act('unpublish')}>
          <Icon name="x-circle" size={14} tone="inherit" />
          Unpublish
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
