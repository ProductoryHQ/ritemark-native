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
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { DeckPageAction, DeckPageState } from '../../../../src/decks/deckProtocol'
import type { DeckTheme } from '../../../../src/decks/deckTheme'
import { onMessage, sendToExtension } from '../../bridge'
import { Button } from '../ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'
import type { DeckSlideEntry } from './deckDocument'
import { SlideCanvas } from './slide/SlideCanvas'

/** The measuring slides' width: any will do, since the fit is measured on the 960 × 540 layout before it is scaled. */
const MEASURE_WIDTH = 192

/** Each slide's fit as `MeasureSlides` measured it, by its place in the deck; 0 where a slide wasn't measured. */
export function measuredSteps(count: number, root: ParentNode): number[] {
  const steps = Array.from({ length: count }, () => 0)
  root.querySelectorAll<HTMLElement>('[data-measure]').forEach(slot => {
    const index = Number(slot.getAttribute('data-measure'))
    const step = Number(slot.querySelector('.deck-slide')?.getAttribute('data-step'))
    if (Number.isInteger(index) && index >= 0 && index < count && Number.isInteger(step)) steps[index] = Math.max(0, Math.min(3, step))
  })
  return steps
}

/** What Publish sends: the view's text and look at the press, and each slide's fit measured in that look. */
export function publishRequest(pressed: { text: string; borderless: boolean }, steps: number[]): { text: string; look: 'card' | 'borderless'; steps: number[] } {
  return { text: pressed.text, look: pressed.borderless ? 'borderless' : 'card', steps }
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
  onNotice: (text: string) => void
}

export function DeckPublish({ slides, theme, borderless, assets, text, onNotice }: DeckPublishProps) {
  const [state, setState] = useState<DeckPageState | null>(null)
  // A Publish waiting for its slides' fit: the slides, the text and the look as they were at the press.
  const [measuring, setMeasuring] = useState<{ slides: DeckSlideEntry[]; text: string; borderless: boolean } | null>(null)

  useEffect(() => {
    const stop = onMessage(message => {
      if (message.type === 'deck/page-state' && isState(message.state)) setState(message.state)
      if (message.type === 'deck/page-notice' && typeof message.text === 'string') onNotice(message.text)
    })
    sendToExtension('deck/page-state')
    return stop
  }, [onNotice])

  return (
    <>
      <DeckPublishControl
        state={state}
        onPublish={() => setMeasuring(current => current ?? { slides, text: text(), borderless })}
        onAction={action => sendToExtension('deck/page-action', { action })}
      />
      {measuring ? createPortal(
        <MeasureSlides
          slides={measuring.slides}
          theme={theme}
          borderless={measuring.borderless}
          assets={assets}
          onMeasured={steps => {
            sendToExtension('deck/publish', publishRequest(measuring, steps))
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
export function DeckPublishControl({ state, onPublish: publish, onAction: act }: {
  state: DeckPageState | null
  onPublish: () => void
  onAction: (action: DeckPageAction) => void
}) {
  if (!state?.ready) return null

  if (state.kind === 'unpublished') {
    return (
      <Tooltip label="Publish the slides and their handout as a web page">
        <Button variant="outline" size="bar" className="deck-publish" onClick={publish}>
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
      <Tooltip label={state.changed ? 'The deck changed since it was published: update the page from here' : 'The page is online: see it, copy its link or take it down'}>
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
        <DropdownMenuSeparator />
        <DropdownMenuItem tone="danger" onSelect={() => act('unpublish')}>
          <Icon name="x-circle" size={14} tone="inherit" />
          Unpublish
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
