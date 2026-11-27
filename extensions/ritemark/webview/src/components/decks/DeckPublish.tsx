/**
 * Sprint 159 PR 4 (experience 46, frame 6): Publish on the deck's bar, 2.2's Publish on the handout page the host
 * writes beside the deck.
 *
 *  - Hidden until Publish can be reached (the flag on and the whole-window sheet there), as the browser bar's is.
 *  - On the bar after Saved, before Present (frame 2), at the bar's 30 px (`size="bar"`).
 *  - Unpublished: Publish, outlined, with the globe. Published: the chip opens the page actions, including Update on
 *    every save. While that is on, the chip shows the live state and any pause can be reviewed from the same menu.
 *  - Publish and Publish changes send the deck's text and look as this view holds them (the document may not have its
 *    newest words or look yet) and each slide's fit, numbers only, so the page's slides fit as the deck view's do. The
 *    fit is measured on the slides drawn once out of sight (`MeasureSlides`) in that look, the way the strip draws
 *    them, so it is there with the strip hidden or the desk narrow too.
 *
 * The host keeps the state (`deck/page-state`); this only draws it and asks.
 *
 * Sprint 170 (#881, the decks README "Save as PDF, from Publish"): where this app can save a PDF (`state.pdf`), Publish
 * is a split button: Publish stays its main part, and the ▾, a part of its own with its own hover and focus, opens
 * Publish and one item that names what it saves from the view at the press (`pdfKindFor`). The Published chip's menu
 * holds the same item. The PDF takes the slides' fit the way Publish does; the host asks for the file and prints it.
 * The split button's hover is the whole button's (ui/split-button.tsx; Jarmo, 26 October); the ▾ keeps its own click
 * and focus. With Publish not reachable (off, or not ready yet), a plain Save as PDF button keeps the PDF's place: it
 * is a local file (the Experience lead, 20 November).
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { DeckPageAction, DeckPageState, DeckPdfKind, DeckRequest } from '../../../../src/decks/deckProtocol'
import { LIVE_HELP, LIVE_TIP, PAUSE_TAIL, keyPauseDetail, outsidePauseDetail, pausedTip } from '../../../../src/decks/deckLiveCopy'
import { isKeyPreview } from '../../../../src/decks/keyPreview'
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
import type { LivePause } from '../../../../src/publish/publishRecords'
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

type LiveAction = Extract<DeckRequest, { type: 'deck/live-action' }>['action']
export type PauseTarget = Pick<LivePause, 'slide' | 'location' | 'keyPreview'>

/** A pause in typing before a live deck's fit is measured again. */
const LIVE_FIT_SETTLE_MS = 800

export function sendLiveAction(action: LiveAction) {
  sendToExtension('deck/live-action', { action })
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
  onShowPause: (target: PauseTarget) => void
  /** `name`: the file the words end with (#931: cut in its middle when the bar is short of room). */
  onPageNotice: (text: string, kind: unknown, operation: unknown) => void
  onNotice: (text: string, action?: { label: string; tip: string; run: () => void; icon?: 'folder-open'; ariaLabel?: string }, name?: string) => void
}

export function DeckPublish({ slides, theme, borderless, assets, text, view, onNotice, onPageNotice, onShowPause }: DeckPublishProps) {
  const [state, setState] = useState<DeckPageState | null>(null)
  // A Publish or a Save as PDF waiting for its slides' fit: the slides, the text and the look as they were at the
  // press, and which it was (the PDF's kind named at the press, never read again later).
  const [measuring, setMeasuring] = useState<{ slides: DeckSlideEntry[]; text: string; borderless: boolean; pdf: DeckPdfKind | null } | null>(null)

  const [livePress, setLivePress] = useState<'on' | 'resume' | null>(null)
  const liveOn = state?.live?.on === true
  const lastFit = useRef<ReturnType<typeof publishRequest> | null>(null)

  useEffect(() => {
    if (!liveOn) lastFit.current = null
  }, [liveOn])

  // While live, the fit is measured from the slides once typing has paused for a moment, never at every keystroke:
  // measuring renders every slide off screen, and only a saved state is ever sent (the live engine reads the file).
  // The text is taken with the slides, so a fit always goes with the words it was measured for.
  const [settled, setSettled] = useState(() => ({ slides, text: '' }))
  useEffect(() => {
    if (!liveOn && !livePress) return
    if (livePress) { setSettled({ slides, text: text() }); return }
    const timer = setTimeout(() => setSettled({ slides, text: text() }), LIVE_FIT_SETTLE_MS)
    return () => clearTimeout(timer)
  }, [slides, liveOn, livePress, text])

  useEffect(() => {
    const stop = onMessage(message => {
      if (message.type === 'deck/page-state' && isState(message.state)) setState(message.state)
      if (message.type === 'deck/page-notice' && typeof message.text === 'string') onPageNotice(message.text, message.kind, message.operation)
      if (message.type === 'deck/pdf-saved' && typeof message.name === 'string') {
        onNotice(savedNotice(message.name), showInFolder(message.name), message.name)
      }
    })
    sendToExtension('deck/page-state')
    return stop
  }, [onNotice, onPageNotice])

  return (
    <>
      <DeckPublishControl
        state={state}
        view={view}
        onPublish={() => setMeasuring(current => current ?? { slides, text: text(), borderless, pdf: null })}
        onSavePdf={kind => setMeasuring(current => current ?? { slides, text: text(), borderless, pdf: kind })}
        onShowPause={onShowPause}
        onLiveAction={action => {
          if (action === 'off') {
            setLivePress(null)
            sendLiveAction(action)
          } else {
            setLivePress(action)
          }
        }}
        onAction={action => sendToExtension('deck/page-action', { action })}
      />
      {(liveOn || livePress) && createPortal(
        <MeasureSlides
          slides={settled.slides}
          theme={theme}
          borderless={borderless}
          assets={assets}
          onMeasured={steps => {
            const fit = publishRequest({ text: settled.text || text(), borderless }, steps)
            const last = lastFit.current
            if (livePress || last?.text !== fit.text || last.look !== fit.look || last.steps.join() !== fit.steps.join()) {
              sendToExtension('deck/live-fit', fit)
              lastFit.current = fit
            }
            // Send the fit first so the first update can use it too.
            if (livePress) {
              sendLiveAction(livePress)
              setLivePress(null)
            }
          }}
        />,
        document.body,
        livePress ?? 'live',
      )}
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
  }, [slides, theme, borderless, assets])
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
export function DeckPublishControl({ state, view = 'both', onPublish: publish, onSavePdf, onAction: act, onLiveAction, onShowPause }: {
  state: DeckPageState | null
  /** The view as drawn: Save as PDF's item names its kind. */
  view?: DeckViewMode
  onPublish: () => void
  onSavePdf?: (kind: DeckPdfKind) => void
  onAction: (action: DeckPageAction) => void
  onLiveAction?: (action: LiveAction) => void
  onShowPause?: (target: PauseTarget) => void
}) {
  const showingPause = useRef(false)
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
    <PublishMenuItem tip={pdfItemLabel(pdfKind).replace(/…$/, '')} onSelect={() => onSavePdf?.(pdfKind)}>
      <Icon name="file-pdf" size={14} tone="inherit" />
      {pdfItemLabel(pdfKind)}
    </PublishMenuItem>
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
              <PublishMenuItem tip="Publish the slides and their handout as a web page" onSelect={publish}>
                <Icon name="globe" size={14} tone="inherit" />
                Publish
              </PublishMenuItem>
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

  const publishingChanges = state.kind === 'publishing' && !!state.address && !state.live?.on
  if (publishingChanges || (state.kind === 'published' && state.changed && !state.live?.on)) {
    const menuTip = 'See it online, copy its link or take it down'
    return (
      <SplitButton
        tone="outline"
        size="bar"
        className="deck-publish-slot deck-publish-split"
        busy={publishingChanges}
        main={{
          label: publishingChanges ? 'Publishing…' : 'Publish changes',
          icon: publishingChanges
            ? <Icon name="circle-notch" size={14} tone="inherit" className="animate-spin" />
            : <Icon name="globe" size={14} tone="inherit" />,
          tooltip: publishingChanges ? 'Your changes are going online' : "Your changes aren't on the page yet",
          onClick: publish,
          className: 'deck-publish',
        }}
        menu={{
          label: menuTip,
          tooltip: menuTip,
          content: publishedMenu(state, pdfItem, publish, act, onLiveAction),
          contentClassName: 'w-[330px] max-w-[calc(100vw_-_16px)] p-2',
        }}
      />
    )
  }

  // The publisher's own bar is busy during a live deploy too. The deck keeps its live chip and switch.
  if ((state.kind === 'publishing' && state.live?.state !== 'updating') || state.kind === 'unpublishing') {
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

  const chip = publishedChip(state)
  return (
    <DropdownMenu modal={false}>
      <Tooltip label={chip.tip}>
        <DropdownMenuTrigger asChild>
          <Button variant={state.live ? 'outline' : 'toolbar'} size="bar" className={`deck-page-state-chip ${chip.className}`}>
            <span className="flex size-4 shrink-0 items-center justify-center">
              {chip.dot
                ? <span aria-hidden="true" className="size-2 rounded-full bg-[var(--r-success)] ring-2 ring-[var(--r-success-soft)]" />
                : <Icon name={chip.icon} size={14} tone="inherit" className={chip.spinning ? 'animate-spin' : undefined} />}
            </span>
            {chip.label}
            <Icon name="caret-down" size={12} tone="inherit" />
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent
        align="end"
        className="w-[330px] max-w-[calc(100vw_-_16px)] p-2"
        onCloseAutoFocus={event => {
          if (showingPause.current) event.preventDefault()
          showingPause.current = false
        }}
      >
        {publishedMenu(state, pdfItem, publish, act, onLiveAction, onShowPause && (target => {
          showingPause.current = !!target.location
          onShowPause(target)
        }))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// The menu's rows are also inspected by the deck tests, since Radix portals them only in the browser.
export function publishedMenu(
  state: DeckPageState,
  pdfItem: React.ReactNode,
  publish: () => void,
  act: (action: DeckPageAction) => void,
  onLiveAction?: (action: LiveAction) => void,
  onShowPause?: (target: PauseTarget) => void,
) {
  const publishing = state.kind === 'publishing'
  const pause = state.live?.state === 'paused' ? state.live.pause : undefined
  return (
    <>
      {pause && <>
        <p className="mb-1 rounded-md bg-[var(--r-warning-surface)] p-2 text-xs leading-relaxed text-pretty text-[var(--r-warning-ink)]">
          <PauseWords pause={pause} />
        </p>
        {pause.slide !== undefined && (
          <PublishMenuItem tip="Open the slide where the update paused" onSelect={() => onShowPause?.(pauseTarget(pause))}>
            <Icon name="magnifying-glass" size={14} tone="inherit" />
            Show it on slide {pause.slide}
          </PublishMenuItem>
        )}
        <PublishMenuItem tip={state.live?.resumeBlocked ? undefined : 'Try updating the page again'} disabled={!!state.live?.resumeBlocked} onSelect={() => onLiveAction?.('resume')}>
          <Icon name="play" size={14} tone="inherit" />
          Go on
          {state.live?.resumeBlocked && <span className="ml-auto text-xs">{state.live.resumeBlocked}</span>}
        </PublishMenuItem>
        <DropdownMenuSeparator />
      </>}
      <PublishMenuItem
        tip={LIVE_HELP}
        role="menuitemcheckbox"
        aria-checked={!!state.live?.on}
        onSelect={() => onLiveAction?.(state.live?.on ? 'off' : 'on')}
      >
        <Icon name="arrows-clockwise" size={14} tone="inherit" />
        <span className="min-w-0 flex-1">
          Update on every save
          <span className="block whitespace-normal text-xs text-ink-muted">{LIVE_HELP}</span>
        </span>
        <span aria-hidden="true" data-on={!!state.live?.on} className="group flex h-[18px] w-[30px] shrink-0 items-center rounded-full bg-hairline-strong px-0.5 data-[on=true]:bg-primary">
          <span className="size-3.5 rounded-full bg-white group-data-[on=true]:translate-x-3" />
        </span>
      </PublishMenuItem>
      <DropdownMenuSeparator />
      <PublishMenuItem tip="Copy the published page’s address" onSelect={() => act('copy-link')}>
        <Icon name="link-simple" size={14} tone="inherit" />
        Copy link
      </PublishMenuItem>
      <PublishMenuItem tip="Open the published page in your browser" onSelect={() => act('see-online')}>
        <Icon name="arrow-square-out" size={14} tone="inherit" />
        <span className="min-w-0">
          See online
          {state.address && <span className="block truncate text-xs text-ink-muted">{state.address.replace(/^https:\/\//, '')}</span>}
        </span>
      </PublishMenuItem>
      {pdfItem}
      {!state.live?.on && (state.changed || publishing) && (
        <PublishMenuItem tip={publishing ? undefined : 'Review and publish the changes'} disabled={publishing} onSelect={publish}>
          <Icon name="arrows-clockwise" size={14} tone="inherit" />
          {publishing ? 'Publishing…' : 'Publish changes'}
        </PublishMenuItem>
      )}
      <DropdownMenuSeparator />
      <PublishMenuItem tip="Take the published page offline" tone="danger" onSelect={() => act('unpublish')}>
        <Icon name="x-circle" size={14} tone="inherit" />
        Unpublish
      </PublishMenuItem>
    </>
  )
}

function PublishMenuItem({ tip, ...props }: React.ComponentProps<typeof DropdownMenuItem> & { tip?: string }) {
  const item = <DropdownMenuItem className="w-full whitespace-nowrap" {...props} />
  if (!tip) return item
  return (
    <Tooltip label={tip} hoverOnly side="left" className="flex">
      {item}
    </Tooltip>
  )
}

const LIVE_CHIPS = {
  live: { label: 'Live', icon: 'globe', className: 'is-plain text-ink-strong', tip: LIVE_TIP },
  updating: { label: 'Live', icon: 'circle-notch', className: 'is-plain text-ink-strong', tip: 'Updating the published page…' },
  paused: { label: 'Paused', icon: 'pause', className: 'border-[var(--r-warning-line)] bg-[var(--r-warning-surface)] text-[var(--r-warning-ink)] hover:bg-[var(--r-warning-surface)] hover:text-[var(--r-warning-ink)]', tip: 'Open pages keep what they had.' },
  offline: { label: 'Offline', icon: 'circle', className: 'is-plain text-ink-muted', tip: 'Saves stay on this computer. The page catches up when the connection is back.' },
} as const

export function publishedChip(state: DeckPageState) {
  if (state.live?.on) {
    const chip = LIVE_CHIPS[state.live.state]
    return {
      ...chip,
      dot: state.live.state === 'live',
      spinning: state.live.state === 'updating',
      tip: state.live.tooltip || (state.live.pause ? pausedTip(state.live.pause) : chip.tip),
    }
  }
  return {
    label: 'Published',
    icon: 'globe' as const,
    className: 'deck-publish-chip',
    dot: false,
    spinning: false,
    tip: 'The page is online: see it, copy its link or take it down',
  }
}

/** The pause words, with the key preview kept on one line: `(sk-ant-…7f3a)` would otherwise break at a hyphen. */
function PauseWords({ pause }: { pause: LivePause }) {
  const words = pauseWords(pause)
  const keep = pause.kind === 'key' && pause.keyPreview && isKeyPreview(pause.keyPreview) ? `(${pause.keyPreview})` : null
  const at = keep ? words.indexOf(keep) : -1
  if (!keep || at < 0) return <>{words}</>
  return <>{words.slice(0, at)}<span className="whitespace-nowrap">{keep}</span>{words.slice(at + keep.length)}</>
}

export function pauseWords(pause: LivePause): string {
  const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(pause.at)
  let detail = pause.detail
  if (pause.kind === 'key') {
    detail = keyPauseDetail(pause.slide)
    if (pause.keyPreview && isKeyPreview(pause.keyPreview)) detail = `${detail.slice(0, -1)} (${pause.keyPreview}).`
  }
  if (pause.kind === 'outside' && pause.outsideFiles?.length) detail = outsidePauseDetail(pause.slide, pause.outsideFiles)
  return `Paused at ${time}. ${detail} ${PAUSE_TAIL}`
}

function pauseTarget({ slide, location, keyPreview }: LivePause): PauseTarget {
  return { slide, location, keyPreview }
}
