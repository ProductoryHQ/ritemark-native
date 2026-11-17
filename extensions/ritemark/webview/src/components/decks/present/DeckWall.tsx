/**
 * Sprint 159 (PR 5; experience 17 frame 2): the wall, the room's screen while a deck is presented.
 *
 * Only the slide, at 16:9 and as large as fits, with bands on other screen shapes in the theme's ground (`wallBand`). A Card deck shows its
 * card; a Borderless deck its words on white. It is drawn by the deck view's own `SlideCanvas`, so a slide looks the
 * same on the stage and on the wall. Nothing of Ritemark is on it.
 *
 *  - The keys (`wallKeys.ts`); a click goes on.
 *  - The bar shows when the pointer moves and fades after 2 s: back, n of N, next, all slides, "esc to stop". The
 *    pointer hides with it.
 *  - Typing a number opens the go-to box at the top: "4 · Go to <title> ↵". The host names the slide (`present/peek`).
 *  - All slides: a grid of the slides shown; a click (or Return) goes there.
 *  - One 0.3 s fade between slides, none with reduced motion.
 *
 * The host is the only source of state: every move is a request, and the wall draws what the host sends back.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import type { WallSlide, WallState } from '../../../../../src/decks/present/presentProtocol'
import { onMessage, sendToExtension } from '../../../bridge'
import { usePageDrawn } from '../../../lib/pageDrawn'
import { Button } from '../../ui/button'
import { Icon } from '../../ui/Icon'
import { Tooltip } from '../../ui/tooltip'
import { SlideCanvas } from '../slide/SlideCanvas'
import { wallBand } from '../theme/themeVars'
import { countLabel, goToKey, wallKeyOf, wallSlideSize } from './wallKeys'
import '../decks.css'
import './wall.css'

/** The bar fades this long after the pointer last moved; the go-to box closes after this pause. */
const BAR_MS = 2000
const GOTO_MS = 3000
/** The fade between two slides. */
const FADE_MS = 300
/** The go-to box sits this far below the slide's top edge (51 of the drawing's 810), the bar this far above its bottom. */
const GOTO_FROM_TOP = 51
const BAR_FROM_BOTTOM = 27
/** The grid's thumbnails: at most this wide, with this gap. */
const GRID_THUMB_MAX = 300
const GRID_GAP = 28

type Move = 'present/next' | 'present/back' | 'present/first' | 'present/last' | 'present/stop'

function useScreenSize(): { width: number; height: number } {
  const [size, setSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }))
  useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return size
}

export function DeckWall() {
  const [state, setState] = useState<WallState | null>(null)
  // The slide before the last move, kept under the new one while it fades in.
  const [leaving, setLeaving] = useState<{ slide: WallSlide; serial: number } | null>(null)
  const [serial, setSerial] = useState(0)
  const [barShown, setBarShown] = useState(false)
  const [overBar, setOverBar] = useState(false)
  const [digits, setDigits] = useState<string | null>(null)
  const [peeked, setPeeked] = useState<{ number: number; title: string | null } | null>(null)
  const [gridOpen, setGridOpen] = useState(false)
  const [gridPick, setGridPick] = useState(0)
  const stateRef = useRef<WallState | null>(null)
  stateRef.current = state
  const barTimer = useRef<number | null>(null)
  const screen = useScreenSize()
  const frame = wallSlideSize(screen.width, screen.height)

  usePageDrawn(state !== null)

  // The host's state after every move; a new slide fades in over the one before it.
  useEffect(() => onMessage(message => {
    if (message.type === 'present/wall') {
      const next = message as unknown as WallState
      const previous = stateRef.current
      if (previous && previous.slide.number !== next.slide.number) {
        setSerial(value => value + 1)
        setLeaving(leavingNow => ({ slide: previous.slide, serial: (leavingNow?.serial ?? 0) + 1 }))
      }
      setState(next)
      return
    }
    if (message.type === 'present/peeked' && typeof message.number === 'number') {
      setPeeked({ number: message.number, title: typeof message.title === 'string' ? message.title : null })
      return
    }
    // After the move into its own window, the host asks until this window has the focus, then makes it full screen
    // (a toggle, so it is told whether the window fills its screen already).
    if (message.type === 'present/focus-check' && document.hasFocus()) {
      sendToExtension('present/focus', { fullScreen: window.outerWidth >= window.screen.width && window.outerHeight >= window.screen.height })
    }
  }), [])

  useEffect(() => {
    sendToExtension('present/ready')
  }, [])

  // The slide that left is taken away once the fade is over.
  useEffect(() => {
    if (!leaving) return
    const timer = window.setTimeout(() => setLeaving(null), FADE_MS + 50)
    return () => window.clearTimeout(timer)
  }, [leaving])

  const send = useCallback((type: Move) => sendToExtension(type), [])
  const goTo = useCallback((number: number) => sendToExtension('present/go', { number }), [])

  // ---- the bar: shown when the pointer moves, faded 2 s after it stops (not while the pointer is on it)
  const showBar = useCallback(() => {
    setBarShown(true)
    if (barTimer.current !== null) window.clearTimeout(barTimer.current)
    barTimer.current = window.setTimeout(() => setBarShown(false), BAR_MS)
  }, [])
  useEffect(() => () => { if (barTimer.current !== null) window.clearTimeout(barTimer.current) }, [])
  const barVisible = barShown || overBar

  // ---- the go-to box: the host names the slide; a pause closes it
  useEffect(() => {
    if (digits === null) return
    const number = Number(digits)
    if (number >= 1) sendToExtension('present/peek', { number })
    const timer = window.setTimeout(() => { setDigits(null); setPeeked(null) }, GOTO_MS)
    return () => window.clearTimeout(timer)
  }, [digits])

  // ---- the grid of all slides: opened on the current slide
  const openGrid = useCallback(() => {
    const current = stateRef.current
    const at = current ? current.slides.findIndex(slide => slide.number === current.slide.number) : 0
    setGridPick(Math.max(0, at))
    setDigits(null)
    setGridOpen(true)
  }, [])

  // ---- the keys, caught before the app sees them (a key the wall uses never reaches a shortcut)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const current = stateRef.current
      if (!current) return
      const take = () => { event.preventDefault(); event.stopPropagation() }
      if (gridOpen) {
        const columns = gridColumns(current.slides.length, screen.width)
        const move = (by: number) => { take(); setGridPick(at => Math.max(0, Math.min(current.slides.length - 1, at + by))) }
        if (event.metaKey || event.ctrlKey || event.altKey) return
        switch (event.key) {
          case 'Escape': take(); setGridOpen(false); return
          case 'ArrowRight': move(1); return
          case 'ArrowLeft': move(-1); return
          case 'ArrowDown': move(columns); return
          case 'ArrowUp': move(-columns); return
          case 'Enter':
          case ' ': {
            take()
            const picked = current.slides[gridPick]
            setGridOpen(false)
            if (picked) goTo(picked.number)
            return
          }
        }
        return
      }
      const step = goToKey(digits, event)
      if (step.handled) {
        take()
        setDigits(step.digits)
        if (step.digits === null) setPeeked(null)
        if (step.go !== undefined) goTo(step.go)
        return
      }
      if (digits !== null) { setDigits(null); setPeeked(null) }
      const key = wallKeyOf(event)
      if (!key || key.type === 'digit') return
      take()
      if (key.type === 'stop') send('present/stop')
      else send(`present/${key.type}`)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [digits, gridOpen, gridPick, goTo, send, screen.width])

  // A click on the slide goes on (not on the bar, the box or the grid).
  const onWallClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('.wall-bar, .wall-goto, .wall-grid')) return
    if (event.button === 0) send('present/next')
  }, [send])

  if (!state) return <div className="deck-wall" />

  const gotoNumber = digits === null ? null : Number(digits)
  const gotoTitle = gotoNumber !== null && peeked?.number === gotoNumber ? peeked.title : undefined
  const gotoMissing = gotoNumber !== null && (gotoNumber < 1 || gotoTitle === null)

  const layer = (slide: WallSlide, className: string, key: string) => (
    <div key={key} className={`wall-slide ${className}${state.borderless ? ' is-borderless' : ''}`}>
      <SlideCanvas kind={slide.kind} data={slide.data} width={frame.width} theme={state.theme} borderless={state.borderless} assets={state.assets} />
    </div>
  )

  return (
    <div
      className={`deck-wall${barVisible || gridOpen ? '' : ' is-idle'}`}
      // Sprint 162: the bands follow the deck's theme (its ground's darker end; a Borderless deck's white).
      style={{ background: wallBand(state.theme, state.borderless) }}
      onPointerMove={showBar}
      onClick={onWallClick}
    >
      <div className="wall-frame" style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height }} aria-live="polite" aria-label={`Slide ${countLabel(state.position, state.count, state.skipped)}: ${state.slide.title}`}>
        {leaving ? layer(leaving.slide, 'is-leaving', `leaving-${leaving.serial}`) : null}
        {layer(state.slide, leaving ? 'is-entering' : '', `slide-${serial}`)}
      </div>

      {digits !== null ? (
        <div className="wall-goto dark" style={{ top: frame.top + GOTO_FROM_TOP }} role="status">
          <span className="wall-goto-number">{digits}</span>
          <span className="wall-goto-text">{gotoMissing ? `No slide ${digits}` : `Go to ${gotoTitle ?? `slide ${digits}`}`}</span>
          {gotoMissing ? null : <span className="wall-key">↵</span>}
        </div>
      ) : null}

      <div
        className={`wall-bar dark${barVisible ? ' is-shown' : ''}`}
        style={{ bottom: frame.top + BAR_FROM_BOTTOM }}
        onPointerEnter={() => setOverBar(true)}
        onPointerLeave={() => { setOverBar(false); showBar() }}
        aria-hidden={barVisible ? undefined : true}
      >
        <Tooltip label="Back (←)">
          <Button variant="ghost" size="icon-sm" aria-label="Back" onClick={() => send('present/back')}>
            <Icon name="caret-left" size={16} tone="inherit" />
          </Button>
        </Tooltip>
        <span className="wall-count">{countLabel(state.position, state.count, state.skipped)}</span>
        <Tooltip label="Next (→)">
          <Button variant="ghost" size="icon-sm" aria-label="Next" onClick={() => send('present/next')}>
            <Icon name="caret-right" size={16} tone="inherit" />
          </Button>
        </Tooltip>
        <span className="wall-sep" aria-hidden="true" />
        <Tooltip label={gridOpen ? 'Back to the slide' : 'All slides'}>
          <Button variant="ghost" size="icon-sm" aria-label="All slides" aria-pressed={gridOpen} data-state={gridOpen ? 'active' : undefined} onClick={() => (gridOpen ? setGridOpen(false) : openGrid())}>
            <Icon name="squares-four" size={16} tone="inherit" />
          </Button>
        </Tooltip>
        {state.presenter.available ? (
          <Tooltip label={state.presenter.on ? 'Close the presenter view' : 'Open the presenter view: your comments, the next slide and the clock'}>
            <Button variant="ghost" size="icon-sm" aria-label="Presenter view" aria-pressed={state.presenter.on} data-state={state.presenter.on ? 'active' : undefined} onClick={() => sendToExtension('present/presenter')}>
              <Icon name="monitor" size={16} tone="inherit" />
            </Button>
          </Tooltip>
        ) : null}
        <span className="wall-sep" aria-hidden="true" />
        <Tooltip label="Stop presenting and go back to the deck">
          <Button variant="ghost" size="sm" className="wall-stop" onClick={() => send('present/stop')}>
            <span className="wall-key">esc</span>
            <span className="wall-stop-words">to stop</span>
          </Button>
        </Tooltip>
      </div>

      {gridOpen ? (
        <WallGrid
          state={state}
          width={screen.width}
          picked={gridPick}
          onPick={setGridPick}
          onGo={number => { setGridOpen(false); goTo(number) }}
        />
      ) : null}
    </div>
  )
}

/** How many thumbnails a row of the grid holds on a screen this wide. */
function gridColumns(count: number, width: number): number {
  const room = Math.max(1, width - 160)
  const fit = Math.max(1, Math.floor((room + GRID_GAP) / (GRID_THUMB_MAX * 0.75 + GRID_GAP)))
  return Math.max(1, Math.min(count, fit, 6))
}

/** All slides: the slides shown, numbered as the thumbnails are; the current one marked. */
function WallGrid({ state, width, picked, onPick, onGo }: {
  state: WallState
  width: number
  picked: number
  onPick: (index: number) => void
  onGo: (number: number) => void
}) {
  const columns = gridColumns(state.slides.length, width)
  const thumb = Math.min(GRID_THUMB_MAX, Math.floor((width - 160 - (columns - 1) * GRID_GAP) / columns))
  const listRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-grid="${picked}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [picked])
  return (
    <div className="wall-grid" role="dialog" aria-label="All slides">
      <div
        ref={listRef}
        className="wall-grid-list"
        role="listbox"
        aria-label="Slides"
        style={{ gridTemplateColumns: `repeat(${columns}, ${thumb}px)` }}
      >
        {state.slides.map((slide, index) => (
          <div
            key={slide.number}
            role="option"
            aria-selected={index === picked}
            aria-label={`Slide ${slide.number}: ${slide.title}`}
            data-grid={index}
            className={`wall-grid-item${slide.number === state.slide.number ? ' is-current' : ''}${index === picked ? ' is-picked' : ''}`}
            onPointerEnter={() => onPick(index)}
            onClick={() => onGo(slide.number)}
          >
            <div className={`wall-grid-slide${state.borderless ? ' is-borderless' : ''}`}>
              <SlideCanvas kind={slide.kind} data={slide.data} width={thumb} theme={state.theme} borderless={state.borderless} assets={state.assets} />
            </div>
            <span className="wall-grid-number">{slide.number}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
