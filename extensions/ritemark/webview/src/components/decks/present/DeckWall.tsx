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
 *  - Between slides, the deck's transition (README item 19: Fade, the default 0.3 s fade, the one before fading out as
 *    the next fades in over the one ground; Push; Zoom; None), or the smooth move where elements match (item 17). A
 *    press during either jumps it to its end at once and goes on; with reduced motion nothing moves. The rules are
 *    `wallMotion.ts`, the drawing `playMotion.ts`.
 *  - B or "." blanks the wall to the theme's ground (white on Borderless), W to white, with the same fade. Any key or a
 *    click brings the slide back, and does nothing else (`blankKeyOf`); the presenter view says the wall is blank.
 *  - Small details item 3: for a published deck, Q (or the presenter view's "Show the page") shows the page's QR code
 *    and its short address on the theme's ground (`PageCode`), the same way: any key or a click brings the slide back
 *    without a step. An unpublished deck's Q does nothing.
 *  - The spotlight (decks README item 16): a click acts on what it hits (`spotClickOf`). A click on an item spotlights
 *    it and the rest of the slide dims (`useSpotlight`); a click on the spotlit item or outside any item clears it; with
 *    no spotlight a click outside any item goes on, as before. F, Tab, Shift+Tab and Esc (`spotKeyOf`).
 *  - A click on a spotlit picture (a picture alone on its slide: the first click) fills the wall with it, whole, on
 *    the theme's ground (item 11). Any key or click
 *    returns to the slide, and does nothing else (`fillKeyOf`).
 *  - Items one by one (item 18): the slide is drawn at the host's step (`reveal`), the items not shown yet hidden in their
 *    places; the item a press shows rises in, 8 px in 0.2 s (`playReveal`, run by `MotionRun`, so a press during it puts
 *    it at its end); with reduced motion, in a deck whose transition is None, or under a blank or filled wall, it is
 *    simply there.
 *  - The pointer dot (item 12): while L is held, a soft accent dot about 14 px wide where the pointer is, from this
 *    window's own pointer on one display, or from the presenter view's over its Now (`present/pointer`, relayed by the
 *    host). No trail; with reduced motion it doesn't fade. The pointer and the bar stay hidden while L is held.
 *  - The timer for an exercise (item 9): started from the presenter view, a quiet mm:ss countdown at the bottom right
 *    of the slide, in the accent, across slides, transitions, a blank wall and the QR code until it is stopped; at
 *    00:00 it pulses three times, not with reduced motion (`pointerTimer.ts`).
 *
 * The host is the only source of state: every move is a request, and the wall draws what the host sends back.
 */
import { AgendaContext, useAgendaDrawing } from '../slide/agendaContext'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react'
import type { WallPoint, WallSlide, WallState, WallTimer } from '../../../../../src/decks/present/presentProtocol'
import { onMessage, sendToExtension } from '../../../bridge'
import { usePageDrawn } from '../../../lib/pageDrawn'
import { Button } from '../../ui/button'
import { Icon } from '../../ui/Icon'
import { Tooltip } from '../../ui/tooltip'
import { SlideCanvas } from '../slide/SlideCanvas'
import { CANVAS_WIDTH } from '../slide/layoutSlide'
import { wallGround } from '../theme/themeVars'
import { PageCode } from './PageCodeView'
import { blankKeyOf, blankNow, countLabel, fillKeyOf, goToKey, settleAsked, spotClickOf, spotKeyOf, wallBleed, wallKeyOf, wallSlideSize, type SpotClick, type WallBlank } from './wallKeys'
import { directionOf, MOTION_MS, MotionRun, REVEAL_MS, revealArrivals, revealRises, stepOf, transitionOf, type MotionDirection } from './wallMotion'
import { motionPairsOf, playReveal, playStep, prefersReducedMotion } from './playMotion'
import { fillUrlIn, spotHit, spotItems, useFocusAsks, useSpotlight } from './spotlight'
import { dotPlace, pointerKeyStep, pointOnSlide, timerLook } from './pointerTimer'
import { useTimerNow } from './useTimerNow'
import { PRESENT_CODE_ACTIONS, useCodeToolsClicks } from '../slide/codeToolsClick'
import '../decks.css'
import './wall.css'

/** The bar fades this long after the pointer last moved; the go-to box closes after this pause. */
const BAR_MS = 2000
const GOTO_MS = 3000
/** The go-to box sits this far below the slide's top edge (51 of the drawing's 810), the bar this far above its bottom. */
const GOTO_FROM_TOP = 51
const BAR_FROM_BOTTOM = 27
/** The grid's thumbnails: at most this wide, with this gap. */
const GRID_THUMB_MAX = 300
const GRID_GAP = 28

type Move = 'present/next' | 'present/back' | 'present/first' | 'present/last' | 'present/stop'

/** The wall's slide now, in its frame (not the one fading out). */
const SLIDE_NOW = '.wall-slide:not(.is-leaving):not(.is-ghost)'

function useScreenSize(): { width: number; height: number } {
  const [size, setSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }))
  useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return size
}

const NO_SLIDES: WallSlide[] = []

export function DeckWall() {
  const [state, setState] = useState<WallState | null>(null)
  // The slide before the last move, going as the new one comes (README 19, the deck's transition, or 17's smooth move).
  // A move during a step first jumps that step to its end (`MotionRun`), so the slide going is always the whole one.
  const [leaving, setLeaving] = useState<{ slide: WallSlide; serial: number; direction: MotionDirection; reveal: number | undefined } | null>(null)
  // README item 18: the items a press just showed, rising in on the slide now (one step's own number, as a move's).
  const [arriving, setArriving] = useState<{ from: number; to: number; serial: number } | null>(null)
  const enteringRef = useRef<HTMLDivElement | null>(null)
  const leavingRef = useRef<HTMLDivElement | null>(null)
  const motion = useRef<MotionRun | null>(null)
  if (!motion.current) motion.current = new MotionRun({ setTimeout: (run, ms) => window.setTimeout(run, ms), clearTimeout: id => window.clearTimeout(id) })
  // A press never waits: whatever is moving is put at its end at once, and the press goes on.
  const jump = useCallback(() => { motion.current?.finish() }, [])
  // Each move's own number, only ever counting up: a move that arrives as the step before ends (its end clears the
  // slide going) still gets a new number, so its own step always starts (review of #792).
  const moves = useRef(0)
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
  // Items 11 and 16: the spotlight and the filled wall this window last asked for, until the host's state carries them.
  const focus = useFocusAsks()
  const frameRef = useRef<HTMLDivElement | null>(null)
  // The picture filling the wall (its address in the slide on the wall), kept while it fades out.
  const [fillUrl, setFillUrl] = useState<string | null>(null)
  const fillShown = useRef(false)
  fillShown.current = fillUrl !== null
  const lastFillUrl = useRef<string | null>(null)
  // Item 12: L held in this window, the pointer's place on the slide (this window's own), and the presenter view's dot.
  const [pointing, setPointingState] = useState(false)
  // The one place `pointing` is known between renders (the key and pointer handlers read it); set only by setPointing.
  const pointingRef = useRef(false)
  const [ownDot, setOwnDot] = useState<WallPoint | null>(null)
  const [relayedDot, setRelayedDot] = useState<WallPoint | null>(null)
  const lastPointer = useRef<{ x: number; y: number } | null>(null)
  const lastDot = useRef<WallPoint | null>(null)
  const screen = useScreenSize()
  const frame = wallSlideSize(screen.width, screen.height)
  // The handlers read the frame from here, so a resize never takes the window's key listeners down and up again.
  const boxRef = useRef(frame)
  boxRef.current = frame
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
      askedBlank.current = settleAsked(askedBlank.current, next.blank, next.page !== null)
      const previous = stateRef.current
      // Another slide has no spotlight: an ask made on the one before is let go.
      focus.settle(next, !previous || previous.slide.number === next.slide.number)
      if (previous && previous.slide.number !== next.slide.number) {
        // A step still running (a press from the presenter view, say) ends first, at its end.
        motion.current?.finish()
        const direction = directionOf(previous.slide.number, next.slide.number)
        setSerial(value => value + 1)
        moves.current += 1
        // The slide going is drawn as the room last saw it: at its step (README item 18).
        setLeaving({ slide: previous.slide, serial: moves.current, direction, reveal: previous.reveal?.shown })
      } else {
        // README item 18: a press that showed the next item on this slide; it rises in once it is drawn.
        const arrivals = revealArrivals(previous?.reveal ?? null, next.reveal, !!previous)
        if (arrivals) {
          motion.current?.finish()
          moves.current += 1
          setArriving({ ...arrivals, serial: moves.current })
        }
      }
      setState(next)
      return
    }
    if (message.type === 'present/peeked' && typeof message.number === 'number') {
      setPeeked({ number: message.number, title: typeof message.title === 'string' ? message.title : null })
      return
    }
    if (message.type === 'present/pointer') {
      const at = message.at as WallPoint | null | undefined
      setRelayedDot(at && typeof at.x === 'number' && typeof at.y === 'number' ? { x: at.x, y: at.y } : null)
      return
    }
  }), [])

  useEffect(() => {
    sendToExtension('present/ready')
  }, [])

  // The step from the slide before to this one, started once both are drawn (and fitted) and before they are painted;
  // the slide before is taken away when it ends, at its time or at a press.
  const leavingSerial = leaving?.serial
  const leavingDirection = useRef<MotionDirection>('next')
  leavingDirection.current = leaving?.direction ?? 'next'
  useLayoutEffect(() => {
    if (leavingSerial === undefined) return
    const run = motion.current
    const frame = window.requestAnimationFrame(() => {
      const before = leavingRef.current
      const now = enteringRef.current
      const current = stateRef.current
      if (!run || !before || !now || !current) { setLeaving(null); return }
      // A press came since this move, before its step could start (README item 18: it showed the new slide's next
      // item): the move is at its end at once, as for any press during one, and the item's rise goes on.
      if (moves.current !== leavingSerial) { setLeaving(value => (value?.serial === leavingSerial ? null : value)); return }
      // Nothing moves under a blank wall, the page's QR code or a picture filling the wall: the slide is simply there
      // when it is shown again.
      const covered = current.blank !== null || current.fill !== null || fillShown.current
      const still = prefersReducedMotion() || covered
      const transition = transitionOf(current.transition)
      // None is a cut, even where elements match: nothing to look for.
      const pairs = still || transition === 'none' ? [] : motionPairsOf(before, now)
      const step = stepOf(transition, still, pairs.length > 0)
      const direction = leavingDirection.current
      const drawing = playStep(step, direction, { leaving: before, entering: now, distance: window.innerWidth }, pairs)
      run.begin(MOTION_MS[step], drawing, () => setLeaving(value => (value?.serial === leavingSerial ? null : value)))
    })
    return () => window.cancelAnimationFrame(frame)
  }, [leavingSerial])
  useEffect(() => () => { motion.current?.finish() }, [])

  // README item 18: the item a press showed rises in, 8 px in 0.2 s, once it is drawn; a press during it puts it at its
  // end (`jump`), as for a move. Under a blank or filled wall, or with reduced motion, it is simply there.
  const arrivingSerial = arriving?.serial
  useLayoutEffect(() => {
    if (!arriving || arrivingSerial === undefined) return
    const run = motion.current
    const current = stateRef.current
    const covered = !current || current.blank !== null || current.fill !== null || fillShown.current
    // Reduced motion, a covered wall or a deck whose transition is None (stillness throughout): the item is simply there.
    if (!run || !current || !revealRises(transitionOf(current.transition), prefersReducedMotion(), covered)) { setArriving(null); return }
    const drawing = playReveal(frameRef.current?.querySelector(SLIDE_NOW) ?? null, arriving)
    run.begin(drawing ? REVEAL_MS : 0, drawing, () => setArriving(value => (value?.serial === arrivingSerial ? null : value)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrivingSerial])

  // A move clears the spotlight and the filled wall (the host's rule), so an ask still waiting is let go.
  const { letGo, askSpot: askSpotWith, askFill: askFillWith, spotNow, fillNow } = focus
  // A press never waits: whatever is moving is put at its end first (`jump`).
  const send = useCallback((type: Move) => {
    jump()
    letGo()
    sendToExtension(type)
  }, [jump, letGo])
  const askBlank = useCallback((to: WallBlank | null) => {
    jump()
    askedBlank.current = { to }
    sendToExtension('present/blank', { to })
  }, [jump])
  // A spotlight or a filled wall asked during a step: the step is put at its end first, then the ask goes on.
  const askSpot = useCallback((item: number | null) => { jump(); askSpotWith(item, sendToExtension) }, [jump, askSpotWith])
  const askFill = useCallback((item: number | null) => { jump(); askFillWith(item, sendToExtension) }, [jump, askFillWith])
  const goTo = useCallback((number: number) => {
    jump()
    letGo()
    sendToExtension('present/go', { number })
  }, [jump, letGo])
  const actOnClick = useCallback((click: SpotClick) => {
    if (!click) return
    if (click.type === 'spot') askSpot(click.item)
    else if (click.type === 'clear') askSpot(null)
    else if (click.type === 'fill') askFill(click.item)
    else send('present/next')
  }, [askSpot, askFill, send])

  // ---- the spotlight on the slide now, and the picture that fills the wall (read from the slide as it is drawn)
  useSpotlight(frameRef, SLIDE_NOW, state?.spot ?? null)
  const fill = state?.fill ?? null
  const fillSlide = state?.slide.number
  useLayoutEffect(() => {
    setFillUrl(fillUrlIn(frameRef.current?.querySelector(SLIDE_NOW) ?? null, fill))
  }, [fill, fillSlide, serial])

  // ---- the bar: shown when the pointer moves, faded 2 s after it stops (not while the pointer is on it)
  const showBar = useCallback(() => {
    setBarShown(true)
    if (barTimer.current !== null) window.clearTimeout(barTimer.current)
    barTimer.current = window.setTimeout(() => setBarShown(false), BAR_MS)
  }, [])
  useEffect(() => () => { if (barTimer.current !== null) window.clearTimeout(barTimer.current) }, [])

  // Item 12: L held here. While it is, the bar goes (it would sit beside the dot) and the pointer hides with it.
  const setPointing = useCallback((on: boolean) => {
    if (pointingRef.current === on) return
    pointingRef.current = on
    setPointingState(on)
    if (on) {
      if (barTimer.current !== null) window.clearTimeout(barTimer.current)
      barTimer.current = null
      setBarShown(false)
    }
  }, [])
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
      // A picture fills the wall (item 11): any key returns to the slide and does nothing else (not while it is blank:
      // that key brings the slide back first).
      if (!gridOpen && !blankNow(current.blank, askedBlank.current) && fillKeyOf(event, fillNow(current.fill, fillShown.current))) {
        take()
        heldKey.current = event.key
        if (digits !== null) { setDigits(null); setPeeked(null) }
        askFill(null)
        return
      }
      const blankStep = gridOpen ? null : blankKeyOf(event, blankNow(current.blank, askedBlank.current), current.page !== null)
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
      // The pointer dot (item 12): L held shows it where the pointer is; its repeats change nothing.
      const pointerStep = pointerKeyStep(pointingRef.current, 'down', event)
      if (pointerStep) {
        take()
        if (!pointingRef.current) {
          setPointing(true)
          const at = lastPointer.current
          setOwnDot(at ? pointOnSlide(boxRef.current, at.x, at.y, true) : null)
        }
        return
      }
      // The spotlight (item 16): F, Tab and Shift+Tab, and Esc while one is on. → and a clicker go on, which clears it.
      const spotStep = spotKeyOf(event, spotNow(current.spot), spotItems(frameRef.current?.querySelector(SLIDE_NOW) ?? null).length)
      if (spotStep) {
        take()
        askSpot(spotStep.type === 'spot' ? spotStep.item : null)
        return
      }
      const key = wallKeyOf(event)
      if (!key || key.type === 'digit') return
      take()
      if (key.type === 'stop') send('present/stop')
      else send(`present/${key.type}`)
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (heldKey.current === event.key) heldKey.current = null
      const pointerStep = pointerKeyStep(pointingRef.current, 'up', event)
      if (pointerStep) {
        if (pointerStep.take) { event.preventDefault(); event.stopPropagation() }
        setPointing(false)
      }
    }
    // A key let go in another window never comes here: the dot goes when this window loses the keys.
    const onBlur = () => setPointing(false)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('keyup', onKeyUp, true)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('keyup', onKeyUp, true)
      window.removeEventListener('blur', onBlur)
    }
  }, [digits, gridOpen, gridPick, goTo, send, askBlank, askSpot, askFill, spotNow, fillNow, screen.width, setPointing])

  // Item 12: the pointer's place, always kept, so L shows the dot at once; while L is held the bar stays away.
  const onWallPointerMove = useCallback((event: { clientX: number; clientY: number }) => {
    lastPointer.current = { x: event.clientX, y: event.clientY }
    if (pointingRef.current) {
      setOwnDot(pointOnSlide(boxRef.current, event.clientX, event.clientY, true))
      return
    }
    showBar()
  }, [showBar])

  // A click acts on what it hits (not on the bar, the box or the grid): an item spotlights, the spotlit picture fills
  // the wall, outside any item it clears the spotlight or, with none, goes on. On a blank or filled wall it only
  // brings the slide back.
  const onWallClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('.wall-bar, .wall-goto, .wall-grid')) return
    if (event.button !== 0) return
    const current = stateRef.current
    if (!current) return
    if (blankNow(current.blank, askedBlank.current)) { askBlank(null); return }
    if (fillNow(current.fill, fillShown.current) !== null) { askFill(null); return }
    const hit = spotHit(frameRef.current?.querySelector(SLIDE_NOW) ?? null, event.clientX, event.clientY)
    actOnClick(spotClickOf(hit, spotNow(current.spot), 'next'))
  }, [askBlank, askFill, actOnClick, spotNow, fillNow])

  // Small details 14: the shown slides' sections, for an Agenda on the wall (its progress from the slide's own place).
  const agendaDrawing = useAgendaDrawing(state?.slides ?? NO_SLIDES, false)
  // Sprint 163 PR 1: a code block's controls take their click before the wall's own (a Copy never moves the wall on).
  const wallRef = useRef<HTMLDivElement>(null)
  useCodeToolsClicks(wallRef, PRESENT_CODE_ACTIONS, !!state)

  if (!state) return <div className="deck-wall" />

  const gotoNumber = digits === null ? null : Number(digits)
  const gotoTitle = gotoNumber !== null && peeked?.number === gotoNumber ? peeked.title : undefined
  const gotoMissing = gotoNumber !== null && (gotoNumber < 1 || gotoTitle === null)
  const blank = state.blank
  if (blank) lastBlank.current = blank
  const blankShown = blank ?? lastBlank.current
  const blankColour = blankShown === 'white' ? '#FFFFFF' : ground
  if (fillUrl) lastFillUrl.current = fillUrl
  const filledUrl = fillUrl ?? lastFillUrl.current
  // This window's own dot while L is held here, else the presenter view's; the last one kept while it fades out.
  const dot = (pointing ? ownDot : null) ?? relayedDot
  if (dot) lastDot.current = dot
  const dotShownAt = dot ?? lastDot.current
  const dotAt = dotShownAt ? dotPlace(dotShownAt, frame) : null

  const layer = (slide: WallSlide, className: string, key: string, going: boolean, reveal: number | undefined) => (
    <div key={key} ref={going ? leavingRef : enteringRef} className={`wall-slide ${className}`}>
      <SlideCanvas kind={slide.kind} data={slide.data} width={frame.width} theme={state.theme} borderless={state.borderless} assets={state.assets} at={slide.number} reveal={reveal} openIn={state.openIn} />
    </div>
  )

  return (
    <AgendaContext.Provider value={agendaDrawing}>
    <div
      ref={wallRef}
      className={`deck-wall${(barVisible && !pointing) || gridOpen ? '' : ' is-idle'}`}
      // The slide's ground on the whole screen: no band, no edge where the 16:9 area ends (a Borderless deck's white).
      style={{ background: ground, '--wall-accent': state.theme.accent } as CSSProperties}
      onPointerMove={onWallPointerMove}
      onClick={onWallClick}
    >
      <div
        ref={frameRef}
        className="wall-frame deck-spot"
        style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height, '--wall-bleed-x': `${bleed.x}px`, '--wall-bleed-y': `${bleed.y}px` } as CSSProperties}
        aria-live="polite"
        aria-label={blank === 'page' ? 'The page’s QR code' : blank ? 'The wall is blank' : fillUrl ? 'A picture fills the wall' : `Slide ${countLabel(state.position, state.count, state.skipped)}: ${state.slide.title}`}
      >
        {leaving ? layer(leaving.slide, 'is-leaving', `leaving-${leaving.serial}`, true, leaving.reveal) : null}
        {layer(state.slide, '', `slide-${serial}`, false, state.reveal?.shown)}
      </div>

      {/* Item 11: the picture whole and uncropped on the theme's ground, over the whole screen, under the blank. */}
      <div className={`wall-fill${fillUrl ? ' is-shown' : ''}`} style={{ background: ground }} aria-hidden="true">
        {filledUrl ? <img src={filledUrl} alt="" draggable={false} /> : null}
      </div>

      {/* The blank: the theme's ground (the wall's own, white on Borderless) or white, over the whole screen; for Q, the
          page's QR code on the ground (kept while it fades out). */}
      <div className={`wall-blank${blank ? ' is-shown' : ''}`} style={{ background: blankColour }} aria-hidden={blank === 'page' ? undefined : true}>
        {blankShown === 'page' && state.page ? <PageCode address={state.page} theme={state.theme} borderless={state.borderless} height={screen.height} width={screen.width} /> : null}
      </div>

      {/* Item 9: the exercise's countdown, over the slide, its transitions, the blank and the QR code. */}
      {state.timer ? <WallCountdown timer={state.timer} frame={frame} /> : null}

      {/* Item 12: the pointer dot, over the slide and a spotlight; no trail (the place never animates). */}
      <div
        className={`wall-dot${dot ? ' is-shown' : ''}`}
        style={dotAt ? { left: dotAt.left, top: dotAt.top } : undefined}
        aria-hidden="true"
      />

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
    </AgendaContext.Provider>
  )
}

/**
 * Item 9: the countdown at the slide's bottom right, in the accent, its words changing once a second. At 00:00 it
 * stays and pulses three times, not with reduced motion.
 */
function WallCountdown({ timer, frame }: { timer: WallTimer; frame: { left: number; top: number; width: number; height: number } }) {
  const look = timerLook(timer, useTimerNow(timer), prefersReducedMotion())
  return (
    <div
      className={`wall-timer${look.done ? ' is-done' : ''}${look.pulse ? ' is-pulsing' : ''}`}
      style={{ right: frame.left + Math.round(frame.width * 0.028), bottom: frame.top + Math.round(frame.height * 0.04), fontSize: Math.max(18, Math.round(frame.height * 0.042)) }}
      role="timer"
      aria-label={look.done ? 'The exercise’s time is up' : `Time left: ${look.text}`}
    >
      {look.text}
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
              <SlideCanvas kind={slide.kind} data={slide.data} width={thumb} theme={state.theme} borderless={state.borderless} assets={state.assets} at={slide.number} openIn={state.openIn} />
            </div>
            <span className="wall-grid-number">{slide.number}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
