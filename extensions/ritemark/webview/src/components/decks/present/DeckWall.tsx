/**
 * Sprint 159 (PR 5; experience 17 frame 2): the wall, the room's screen while a deck is presented.
 *
 * Only the slide. Its words, boxes and logo stay in the 16:9 area, as large as fits and centred, so a deck looks the
 * same on a 16:9 projector and in the editor; its ground runs to the screen's edges on any other shape (step-3-themes.md,
 * "No bands on the wall"; Jarmo, 17 November). A Card deck's ground, its colour and soft light, is drawn on the whole
 * screen (`wallGround`), so the soft light is anchored to the screen's corner and no edge shows where the 16:9 area
 * ends; a picture Behind, Left or Right runs to the screen's edges on its side (`wallBleed`, wall.css). A Borderless
 * deck is white to the edges. It is drawn by the deck view's own `SlideCanvas`, so a slide looks the same on the stage
 * and on the wall. Nothing of Ritemark is on it.
 *
 *  - The keys (`wallKeys.ts`); a click goes on.
 *  - The bar shows when the pointer moves and fades after 2 s: back, n of N, next, all slides, "esc to stop". The
 *    pointer hides with it.
 *  - Typing a number opens the go-to box at the top: "4 · Go to <title> ↵". The host names the slide (`present/peek`).
 *  - All slides: a grid of the slides shown; a click (or Return) goes there.
 *  - One 0.3 s fade between slides, the one before fading out as the next fades in (the ground under both stays), none
 *    with reduced motion.
 *  - B or "." blanks the wall to the theme's ground (white on Borderless), W to white, with the same fade. Any key or a
 *    click brings the slide back, and does nothing else (`blankKeyOf`); the presenter view says the wall is blank.
 *
 * The host is the only source of state: every move is a request, and the wall draws what the host sends back.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react'
import type { WallSlide, WallState } from '../../../../../src/decks/present/presentProtocol'
import { onMessage, sendToExtension } from '../../../bridge'
import { usePageDrawn } from '../../../lib/pageDrawn'
import { Button } from '../../ui/button'
import { Icon } from '../../ui/Icon'
import { Tooltip } from '../../ui/tooltip'
import { SlideCanvas } from '../slide/SlideCanvas'
import { CANVAS_WIDTH } from '../slide/layoutSlide'
import { wallGround } from '../theme/themeVars'
import { blankKeyOf, blankNow, countLabel, goToKey, settleAsked, wallBleed, wallKeyOf, wallSlideSize, type WallBlank } from './wallKeys'
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
  // The slide before the last move, fading out as the new one fades in, from the opacity it had (a move during a
  // fade takes the half-shown slide out from where it was, never from full, so nothing flashes).
  const [leaving, setLeaving] = useState<{ slide: WallSlide; serial: number; from: number } | null>(null)
  const enteringRef = useRef<HTMLDivElement | null>(null)
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
  // The key that blanked the wall or brought the slide back: held down, its repeats do nothing (never a step).
  const heldKey = useRef<string | null>(null)
  // The blank this window last asked for, until the host's state carries it (`blankNow`).
  const askedBlank = useRef<{ to: WallBlank | null } | null>(null)
  // The colour the wall last blanked to, kept while the blank fades out.
  const lastBlank = useRef<WallBlank>('ground')
  const screen = useScreenSize()
  const frame = wallSlideSize(screen.width, screen.height)
  const bleed = wallBleed(frame, CANVAS_WIDTH)

  // The ground, worked out once per theme and look (the wall draws again at every pointer move).
  const theme = state?.theme
  const borderless = state?.borderless ?? false
  const ground = useMemo(() => (theme ? wallGround(theme, borderless) : ''), [theme, borderless])

  usePageDrawn(state !== null)

  // The host's state after every move; a new slide fades in over the one before it.
  useEffect(() => onMessage(message => {
    if (message.type === 'present/wall') {
      const next = message as unknown as WallState
      askedBlank.current = settleAsked(askedBlank.current, next.blank)
      const previous = stateRef.current
      if (previous && previous.slide.number !== next.slide.number) {
        const shown = enteringRef.current ? Number.parseFloat(getComputedStyle(enteringRef.current).opacity) : 1
        const from = Number.isFinite(shown) ? shown : 1
        setSerial(value => value + 1)
        setLeaving(leavingNow => ({ slide: previous.slide, serial: (leavingNow?.serial ?? 0) + 1, from }))
      }
      setState(next)
      return
    }
    if (message.type === 'present/peeked' && typeof message.number === 'number') {
      setPeeked({ number: message.number, title: typeof message.title === 'string' ? message.title : null })
      return
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
  const askBlank = useCallback((to: WallBlank | null) => {
    askedBlank.current = { to }
    sendToExtension('present/blank', { to })
  }, [])
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
      // A blank wall: any key brings the slide back and does nothing else; B, "." or W blanks it. The grid, open over a
      // blank wall, keeps its own keys (Esc closes it, Return goes to the slide, which brings the slide back).
      if (event.repeat && heldKey.current === event.key) { take(); return }
      const blankStep = gridOpen ? null : blankKeyOf(event, blankNow(current.blank, askedBlank.current))
      if (blankStep) {
        take()
        heldKey.current = event.key
        if (digits !== null) { setDigits(null); setPeeked(null) }
        askBlank(blankStep.type === 'show' ? null : blankStep.to)
        return
      }
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
    const onKeyUp = (event: KeyboardEvent) => { if (heldKey.current === event.key) heldKey.current = null }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('keyup', onKeyUp, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('keyup', onKeyUp, true)
    }
  }, [digits, gridOpen, gridPick, goTo, send, askBlank, screen.width])

  // A click on the slide goes on (not on the bar, the box or the grid); on a blank wall it only brings the slide back.
  const onWallClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('.wall-bar, .wall-goto, .wall-grid')) return
    if (event.button !== 0) return
    if (stateRef.current && blankNow(stateRef.current.blank, askedBlank.current)) askBlank(null)
    else send('present/next')
  }, [send, askBlank])

  if (!state) return <div className="deck-wall" />

  const gotoNumber = digits === null ? null : Number(digits)
  const gotoTitle = gotoNumber !== null && peeked?.number === gotoNumber ? peeked.title : undefined
  const gotoMissing = gotoNumber !== null && (gotoNumber < 1 || gotoTitle === null)
  const blank = state.blank
  if (blank) lastBlank.current = blank
  const blankColour = (blank ?? lastBlank.current) === 'white' ? '#FFFFFF' : ground

  const layer = (slide: WallSlide, className: string, key: string, from?: number) => (
    <div
      key={key}
      ref={from === undefined ? enteringRef : undefined}
      className={`wall-slide ${className}`}
      style={from === undefined ? undefined : ({ '--wall-fade-from': from } as CSSProperties)}
    >
      <SlideCanvas kind={slide.kind} data={slide.data} width={frame.width} theme={state.theme} borderless={state.borderless} assets={state.assets} />
    </div>
  )

  return (
    <div
      className={`deck-wall${barVisible || gridOpen ? '' : ' is-idle'}`}
      // The slide's ground on the whole screen: no band, no edge where the 16:9 area ends (a Borderless deck's white).
      style={{ background: ground }}
      onPointerMove={showBar}
      onClick={onWallClick}
    >
      <div
        className="wall-frame"
        style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height, '--wall-bleed-x': `${bleed.x}px`, '--wall-bleed-y': `${bleed.y}px` } as CSSProperties}
        aria-live="polite"
        aria-label={blank ? 'The wall is blank' : `Slide ${countLabel(state.position, state.count, state.skipped)}: ${state.slide.title}`}
      >
        {leaving ? layer(leaving.slide, 'is-leaving', `leaving-${leaving.serial}`, leaving.from) : null}
        {layer(state.slide, leaving ? 'is-entering' : '', `slide-${serial}`)}
      </div>

      {/* The blank: the theme's ground (the wall's own, white on Borderless) or white, over the whole screen. */}
      <div className={`wall-blank${blank ? ' is-shown' : ''}`} style={{ background: blankColour }} aria-hidden="true" />

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
