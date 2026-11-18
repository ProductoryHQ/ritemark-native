/**
 * Sprint 159 (PR 6; experience 17 frame 3): the presenter view, on the laptop while the wall shows on the projector.
 * In Ritemark Dark whatever the app's theme, so it glows less in a dim room.
 *
 *  - The slide now, as the room sees it, and the next one.
 *  - Your comments (Sprint 161): the current part's comments in large type, with A− and A+.
 *  - The slides shown, in a row: a click goes there.
 *  - The clock: time elapsed, against the session's length (`ritemark-length` in the deck's front matter) when the deck
 *    has one; a click on it asks for the length. Pause and Reset are this view's own. Beside it, small, the time of day
 *    in the system's 12- or 24-hour format (`timeOfDayText`), for lunch.
 *  - While the wall is blank (B, "." or W), Now says "The wall is blank · B to show it".
 *  - Small details item 3: for a published deck, "Show the page" (or Q) puts the page's QR code on the wall; Now shows
 *    it too and says "The page’s QR code is on the wall · Q to show the slide". An unpublished deck has no button.
 *  - The spotlight (decks README item 16): a click on an item in Now spotlights it on the wall, and Now shows the same
 *    dimming; the wall's click rule (`spotClickOf`), except that a click outside any item never steps. A click on the
 *    spotlit picture fills the wall with it (item 11), and Now says so; any key or a click on Now returns.
 *  - The pointer dot (decks README item 12): while L is held, the pointer over Now shows a soft accent dot at the same
 *    place on the wall (`present/pointer`, at most once a frame), and in Now; off Now, or L let go, it goes.
 *  - The timer for an exercise (item 9): on a slide with a Steps block, Timer offers 5, 10, 15, 20 or 30 min, the
 *    default from a number in the Steps label or on the slide; Start puts the countdown on the wall. While it runs it is
 *    shown here on every slide, with Restart and Stop (`pointerTimer.ts`).
 *  - Back, Next (the one bright button), Swap displays (with two displays) and Stop.
 *  - "Claude and notices wait until you stop.": the main window, with the AI and the notices, stays behind.
 *
 * The keys are the wall's (`wallKeys.ts`): the presenter's keyboard or clicker moves the wall from here. The host is
 * the only source of state; this is the one window that gets the notes.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import type { PresenterState, WallPoint, WallSlide, WallTimer } from '../../../../../src/decks/present/presentProtocol'
import { onMessage, sendToExtension } from '../../../bridge'
import { usePageDrawn } from '../../../lib/pageDrawn'
import { Button } from '../../ui/button'
import { Icon } from '../../ui/Icon'
import { SegmentedControl } from '../../ui/segmented-control'
import { Tooltip } from '../../ui/tooltip'
import { SlideCanvas } from '../slide/SlideCanvas'
import { wallGround } from '../theme/themeVars'
import { PageCode } from './PageCodeView'
import { blankKeyOf, blankNow, clockText, countLabel, fillKeyOf, goToKey, settleAsked, spotClickOf, spotKeyOf, timeOfDayFormat, wallKeyOf, type WallBlank } from './wallKeys'
import { fillUrlIn, spotHit, spotItems, useFocusAsks, useSpotlight } from './spotlight'
import { dotPlace, pointerKeyStep, pointOnSlide, samePoint, timerLook, timerNextTick, timerOfferOf, TIMER_MINUTES } from './pointerTimer'
import '../decks.css'
import './presenter.css'

/** The notes' type sizes (A− and A+ step through them); the drawing's 22 first. */
const NOTE_SIZES = [18, 22, 26, 30, 36, 42]
const DEFAULT_NOTE_SIZE = 1
/** The go-to box closes after this pause. */
const GOTO_MS = 3000
/** The right column (next slide and notes) and the gaps, as drawn at 1440 × 900. */
const SIDE_WIDTH = 384
const EDGE = 32
const THUMB_WIDTH = 150
/** The slide now, in Now (not the blank or the filled wall over it). */
const NOW_SLIDE = ':scope > .pv-slide'

function useScreenSize(): { width: number; height: number } {
  const [size, setSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }))
  useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return size
}

/**
 * Item 9: the timer while it runs, on every slide: the time left as the wall shows it (or that it is up), Restart for
 * the same minutes, and Stop.
 */
function PresenterTimer({ timer, onRestart, onStop }: { timer: WallTimer; onRestart: () => void; onStop: () => void }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const wait = timerNextTick(timer, now)
    if (wait <= 0) return
    const id = window.setTimeout(() => setNow(Date.now()), wait)
    return () => window.clearTimeout(id)
  }, [timer, now])
  // Here the words are enough: nothing pulses in the presenter view.
  const look = timerLook(timer, now, true)
  return (
    <div className="pv-timer is-running">
      <span className="pv-label">{`Timer · ${timer.minutes} min, on the wall`}</span>
      <div className="pv-timer-row">
        <span className={`pv-timer-left${look.done ? ' is-done' : ''}`} role="timer">{look.done ? 'Time is up' : `${look.text} left`}</span>
        <span className="pv-grow" />
        <Tooltip label={`Start the ${timer.minutes} minutes again`}>
          <Button variant="outline" onClick={onRestart}>
            <Icon name="arrow-counter-clockwise" size={16} tone="inherit" />
            Restart
          </Button>
        </Tooltip>
        <Tooltip label="Stop the timer and take it off the wall">
          <Button variant="outline" onClick={onStop}>
            <Icon name="square" size={16} tone="inherit" />
            Stop timer
          </Button>
        </Tooltip>
      </div>
    </div>
  )
}

/** The clock: elapsed since the start, with Pause and Reset of its own. */
function useClock(startedAt: number | null): { now: number; elapsed: number; paused: boolean; pause: () => void; reset: () => void } {
  const [now, setNow] = useState(() => Date.now())
  const [offset, setOffset] = useState<{ start: number | null; pausedAt: number | null; pausedFor: number }>({ start: null, pausedAt: null, pausedFor: 0 })
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(timer)
  }, [])
  const start = offset.start ?? startedAt ?? now
  const until = offset.pausedAt ?? now
  return {
    now,
    elapsed: until - start - offset.pausedFor,
    paused: offset.pausedAt !== null,
    pause: () => setOffset(value => value.pausedAt === null
      ? { ...value, pausedAt: Date.now() }
      : { ...value, pausedAt: null, pausedFor: value.pausedFor + (Date.now() - value.pausedAt) }),
    reset: () => setOffset(value => ({ start: Date.now(), pausedAt: value.pausedAt === null ? null : Date.now(), pausedFor: 0 })),
  }
}

export function DeckPresenterView() {
  const [state, setState] = useState<PresenterState | null>(null)
  const [noteSize, setNoteSize] = useState(DEFAULT_NOTE_SIZE)
  const [digits, setDigits] = useState<string | null>(null)
  const [peeked, setPeeked] = useState<{ number: number; title: string | null } | null>(null)
  const screen = useScreenSize()
  const clock = useClock(state?.startedAt ?? null)
  const rowRef = useRef<HTMLDivElement>(null)
  // The key that blanked the wall or brought the slide back: held down, its repeats do nothing (never a step).
  const heldKey = useRef<string | null>(null)
  // The blank this window last asked for, until the host's state carries it (`blankNow`).
  const askedBlank = useRef<{ to: WallBlank | null } | null>(null)
  // Items 11 and 16: the spotlight and the filled wall this window last asked for, until the host's state carries them.
  const focus = useFocusAsks()
  const { letGo, askSpot: askSpotWith, askFill: askFillWith, spotNow, fillNow } = focus
  const nowRef = useRef<HTMLDivElement | null>(null)
  const shownNumber = useRef<number | null>(null)
  const [fillUrl, setFillUrl] = useState<string | null>(null)
  const fillShown = useRef(false)
  fillShown.current = fillUrl !== null
  // Item 12: L held here, the pointer's place on Now's slide, and the place last sent to the wall (once a frame).
  const [pointing, setPointing] = useState(false)
  const pointingRef = useRef(false)
  pointingRef.current = pointing
  const [nowDot, setNowDot] = useState<WallPoint | null>(null)
  const overNow = useRef<WallPoint | null>(null)
  const sentDot = useRef<WallPoint | null>(null)
  const dotFrame = useRef<number | null>(null)
  // Item 9: the minutes chosen for this slide's timer (the slide's default until one is chosen).
  const [picked, setPicked] = useState<{ slide: number; minutes: number } | null>(null)
  // The time of day's format, made again only when the system's clock changes.
  const clockLocale = state?.clock.locale ?? null
  const hourCycle = state?.clock.hourCycle ?? null
  const dayFormat = useMemo(() => timeOfDayFormat({ locale: clockLocale, hourCycle }), [clockLocale, hourCycle])

  usePageDrawn(state !== null)

  useEffect(() => onMessage(message => {
    if (message.type === 'present/presenter') {
      const next = message as unknown as PresenterState
      askedBlank.current = settleAsked(askedBlank.current, next.blank, next.page !== null)
      // Another slide has no spotlight: an ask made on the one before is let go.
      focus.settle(next, shownNumber.current === null || shownNumber.current === next.current.number)
      shownNumber.current = next.current.number
      setState(next)
    }
    else if (message.type === 'present/peeked' && typeof message.number === 'number') {
      setPeeked({ number: message.number, title: typeof message.title === 'string' ? message.title : null })
    }
  }), [])
  useEffect(() => { sendToExtension('present/ready') }, [])

  const send = useCallback((type: string, data: Record<string, unknown> = {}) => {
    // A move clears the spotlight and the filled wall (the host's rule), so an ask still waiting is let go, as the
    // wall does for every request but the blank.
    if (type !== 'present/blank') letGo()
    sendToExtension(type, data)
  }, [letGo])
  const askSpot = useCallback((item: number | null) => askSpotWith(item, sendToExtension), [askSpotWith])

  // ---- item 12: the dot's place goes to the wall at most once a frame, and only when it moved
  const sendDot = useCallback((at: WallPoint | null) => {
    setNowDot(at)
    if (dotFrame.current !== null) return
    dotFrame.current = window.requestAnimationFrame(() => {
      dotFrame.current = null
      const latest = pointingRef.current ? overNow.current : null
      if (samePoint(latest, sentDot.current)) return
      sentDot.current = latest
      sendToExtension('present/pointer', { at: latest })
    })
  }, [])
  useEffect(() => () => { if (dotFrame.current !== null) window.cancelAnimationFrame(dotFrame.current) }, [])
  const setPointer = useCallback((on: boolean) => {
    if (pointingRef.current === on) return
    pointingRef.current = on
    setPointing(on)
    sendDot(on ? overNow.current : null)
  }, [sendDot])
  const onNowPointer = useCallback((event: { clientX: number; clientY: number }) => {
    const rect = nowRef.current?.querySelector<HTMLElement>(NOW_SLIDE)?.getBoundingClientRect()
    overNow.current = rect ? pointOnSlide(rect, event.clientX, event.clientY) : null
    if (pointingRef.current) sendDot(overNow.current)
  }, [sendDot])
  const onNowLeave = useCallback(() => {
    overNow.current = null
    if (pointingRef.current) sendDot(null)
  }, [sendDot])
  const askFill = useCallback((item: number | null) => askFillWith(item, sendToExtension), [askFillWith])

  // Now shows the wall's spotlight, and the picture that fills the wall (read from Now's own drawing of the slide).
  useSpotlight(nowRef, NOW_SLIDE, state?.spot ?? null)
  const fill = state?.fill ?? null
  const nowNumber = state?.current.number
  useLayoutEffect(() => {
    setFillUrl(fillUrlIn(nowRef.current?.querySelector(NOW_SLIDE) ?? null, fill))
  }, [fill, nowNumber])

  // The go-to box: the host names the slide; a pause closes it.
  useEffect(() => {
    if (digits === null) return
    const number = Number(digits)
    if (number >= 1) sendToExtension('present/peek', { number })
    const timer = window.setTimeout(() => { setDigits(null); setPeeked(null) }, GOTO_MS)
    return () => window.clearTimeout(timer)
  }, [digits])

  // The wall's keys, from the presenter's keyboard or clicker.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!state) return
      const take = () => { event.preventDefault(); event.stopPropagation() }
      if (event.repeat && heldKey.current === event.key) { take(); return }
      // A picture fills the wall (item 11): any key returns to the slide and does nothing else.
      if (!blankNow(state.blank, askedBlank.current) && fillKeyOf(event, fillNow(state.fill, fillShown.current))) {
        take()
        heldKey.current = event.key
        if (digits !== null) { setDigits(null); setPeeked(null) }
        askFill(null)
        return
      }
      // B, "." or W blanks the wall; while it is blank, any key brings the slide back and does nothing else (Return and
      // space on one of this view's buttons still press that button).
      const onButton = (event.key === 'Enter' || event.key === ' ') && !!(event.target as Element | null)?.closest?.('button')
      const blankStep = blankKeyOf(event, blankNow(state.blank, askedBlank.current), state.page !== null)
      if (blankStep && !(blankStep.type === 'show' && onButton)) {
        take()
        heldKey.current = event.key
        if (digits !== null) { setDigits(null); setPeeked(null) }
        const to = blankStep.type === 'show' ? null : blankStep.to
        askedBlank.current = { to }
        send('present/blank', { to })
        return
      }
      const step = goToKey(digits, event)
      if (step.handled) {
        take()
        setDigits(step.digits)
        if (step.digits === null) setPeeked(null)
        if (step.go !== undefined) send('present/go', { number: step.go })
        return
      }
      if (digits !== null) { setDigits(null); setPeeked(null) }
      // The pointer dot (item 12): L held shows it on the wall where the pointer is over Now; its repeats change nothing.
      const pointerStep = pointerKeyStep(pointingRef.current, 'down', event)
      if (pointerStep) {
        take()
        setPointer(true)
        return
      }
      // The spotlight (item 16): F, Tab and Shift+Tab, and Esc while one is on. Without one, Tab reaches this view's
      // buttons as usual.
      const spotStep = spotKeyOf(event, spotNow(state.spot), spotItems(nowRef.current?.querySelector(NOW_SLIDE) ?? null).length)
      if (spotStep) {
        take()
        askSpot(spotStep.type === 'spot' ? spotStep.item : null)
        return
      }
      const key = wallKeyOf(event)
      if (!key || key.type === 'digit') return
      // Return and space on one of this view's buttons press that button.
      if (key.type === 'next' && onButton) return
      take()
      send(key.type === 'stop' ? 'present/stop' : `present/${key.type}`)
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (heldKey.current === event.key) heldKey.current = null
      const pointerStep = pointerKeyStep(pointingRef.current, 'up', event)
      if (pointerStep) {
        if (pointerStep.take) { event.preventDefault(); event.stopPropagation() }
        setPointer(false)
      }
    }
    // L let go in another window never comes here: the dot goes when this window loses the keys.
    const onBlur = () => setPointer(false)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('keyup', onKeyUp, true)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('keyup', onKeyUp, true)
      window.removeEventListener('blur', onBlur)
    }
  }, [state, digits, send, askSpot, askFill, spotNow, fillNow, setPointer])

  // A click on Now acts on what it hits, on the wall (`spotClickOf`); on a blank or filled wall it brings the slide back.
  const onNowClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (!state || event.button !== 0) return
    if ((event.target as Element).closest('.pv-goto')) return
    if (blankNow(state.blank, askedBlank.current)) {
      askedBlank.current = { to: null }
      sendToExtension('present/blank', { to: null })
      return
    }
    if (fillNow(state.fill, fillShown.current) !== null) { askFill(null); return }
    const hit = spotHit(nowRef.current?.querySelector(NOW_SLIDE) ?? null, event.clientX, event.clientY)
    const click = spotClickOf(hit, spotNow(state.spot), 'none')
    if (!click || click.type === 'next') return
    if (click.type === 'fill') askFill(click.item)
    else askSpot(click.type === 'spot' ? click.item : null)
  }, [state, askSpot, askFill, spotNow, fillNow])

  // The row keeps the current slide in view.
  useLayoutEffect(() => {
    rowRef.current?.querySelector<HTMLElement>('.pv-thumb.is-current')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [state?.current.number])

  if (!state) return <div className="deck-presenter dark" />

  // The slide now takes what the right column and the row leave, at 16:9.
  const nowWidth = Math.max(240, Math.min(screen.width - EDGE * 3 - SIDE_WIDTH, Math.round((screen.height - 56 - 136 - 112) * 16 / 9)))
  const timeOfDay = dayFormat.format(new Date(clock.now))
  const shownIndex = state.slides.findIndex(slide => slide.number === state.current.number)
  const gotoNumber = digits === null ? null : Number(digits)
  const gotoTitle = gotoNumber !== null && peeked?.number === gotoNumber ? peeked.title : undefined
  const gotoMissing = gotoNumber !== null && (gotoNumber < 1 || gotoTitle === null)
  const nowHeight = Math.round(nowWidth * 9 / 16)
  // The page on the wall now: its address while the code shows, else null.
  const pageShown = state.blank === 'page' ? state.page : null
  const togglePage = () => {
    const to = blankNow(state.blank, askedBlank.current) === 'page' ? null : 'page'
    askedBlank.current = { to }
    send('present/blank', { to })
  }
  // Item 9: the timer this slide offers (a Steps block), with the minutes chosen for it, and the one running.
  const offer = timerOfferOf(state.current)
  const timerMinutes = picked?.slide === state.current.number ? picked.minutes : offer?.minutes ?? null
  const startTimer = (minutes: number) => send('present/timer', { minutes })
  // Item 12: the dot in Now, where the room sees it on the wall.
  const nowDotAt = pointing && nowDot ? dotPlace(nowDot, { left: 0, top: 0, width: nowWidth, height: nowHeight }) : null
  const canvas = (slide: WallSlide, width: number) => (
    <div className={`pv-slide${state.borderless ? ' is-borderless' : ''}`} style={{ width }}>
      <SlideCanvas kind={slide.kind} data={slide.data} width={width} theme={state.theme} borderless={state.borderless} assets={state.assets} />
    </div>
  )

  return (
    <div className="deck-presenter dark">
      <div className="pv-main" style={{ width: nowWidth }}>
        <div className="pv-label">{state.wallDisplay ? `Now, on ${state.wallDisplay}` : 'Now, on the wall'}</div>
        <div
          ref={nowRef}
          className={`pv-now deck-spot${pointing ? ' is-pointing' : ''}`}
          onClick={onNowClick}
          onPointerMove={onNowPointer}
          onPointerEnter={onNowPointer}
          onPointerLeave={onNowLeave}
        >
          {canvas(state.current, nowWidth)}
          {nowDotAt ? <span className="pv-dot" style={{ left: nowDotAt.left, top: nowDotAt.top, background: state.theme.accent }} aria-hidden="true" /> : null}
          {fillUrl && !state.blank ? (
            // Item 11: what the room sees, the picture whole on the theme's ground, and how to return.
            <div className="pv-blank">
              <div className="pv-blank-ground pv-fill" style={{ background: wallGround(state.theme, state.borderless) }}>
                <img src={fillUrl} alt="" draggable={false} />
              </div>
              <span className="pv-blank-words" role="status">The picture fills the wall · any key to return</span>
            </div>
          ) : null}
          {pageShown ? (
            // What the room sees: the page's QR code on the theme's ground (any key brings the slide back).
            <div className="pv-blank is-page">
              <div className="pv-blank-ground" style={{ background: wallGround(state.theme, state.borderless) }} />
              <PageCode address={pageShown} theme={state.theme} borderless={state.borderless} height={Math.round(nowHeight * 0.8)} width={nowWidth} />
              <span className="pv-blank-words" role="status">The page’s QR code is on the wall · Q to show the slide</span>
            </div>
          ) : state.blank && state.blank !== 'page' ? (
            // What the room sees: the wall's blank, with the slide faintly under it (it comes back with any key).
            <div className="pv-blank">
              <div className="pv-blank-ground" style={{ background: state.blank === 'white' ? '#FFFFFF' : wallGround(state.theme, state.borderless) }} />
              <span className="pv-blank-words" role="status">The wall is blank · B to show it</span>
            </div>
          ) : null}
          {digits !== null ? (
            <div className="pv-goto" role="status">
              <span className="pv-goto-number">{digits}</span>
              <span className="pv-goto-text">{gotoMissing ? `No slide ${digits}` : `Go to ${gotoTitle ?? `slide ${digits}`}`}</span>
              {gotoMissing ? null : <span className="pv-key">↵</span>}
            </div>
          ) : null}
        </div>
        <div ref={rowRef} className="pv-row" role="listbox" aria-label="Slides">
          {state.slides.map((slide, index) => (
            <div
              key={slide.number}
              role="option"
              aria-selected={slide.number === state.current.number}
              aria-label={`Slide ${slide.number}: ${slide.title}`}
              className={`pv-thumb${slide.number === state.current.number ? ' is-current' : ''}${shownIndex >= 0 && index < shownIndex ? ' is-past' : ''}`}
              onClick={() => send('present/go', { number: slide.number })}
            >
              {canvas(slide, THUMB_WIDTH)}
            </div>
          ))}
        </div>
      </div>

      <div className="pv-side">
        <div className="pv-label">Next</div>
        {state.next ? canvas(state.next, SIDE_WIDTH) : <div className="pv-end">The end of the deck</div>}
        {state.timer ? (
          <PresenterTimer timer={state.timer} onRestart={() => startTimer(state.timer?.minutes ?? TIMER_MINUTES[1])} onStop={() => send('present/timer', { minutes: null })} />
        ) : offer && timerMinutes !== null ? (
          <div className="pv-timer">
            <span className="pv-label">Timer</span>
            <div className="pv-timer-row">
              <SegmentedControl
                aria-label="The exercise’s minutes"
                value={String(timerMinutes)}
                onValueChange={value => setPicked({ slide: state.current.number, minutes: Number(value) })}
                options={TIMER_MINUTES.map(minutes => ({ value: String(minutes), label: String(minutes) }))}
              />
              <span className="pv-timer-unit">min</span>
              <span className="pv-grow" />
              <Tooltip label={`Show a ${timerMinutes}-minute countdown on the wall, at the bottom right`}>
                <Button variant="outline" onClick={() => startTimer(timerMinutes)}>
                  <Icon name="timer" size={16} tone="inherit" />
                  Start
                </Button>
              </Tooltip>
            </div>
          </div>
        ) : null}
        <div className="pv-notes-head">
          <span className="pv-label">Your comments</span>
          <span className="pv-sizes">
            <Tooltip label="Smaller comments">
              <Button variant="outline" size="compact" aria-label="Smaller comments" disabled={noteSize === 0} onClick={() => setNoteSize(size => Math.max(0, size - 1))}>A−</Button>
            </Tooltip>
            <Tooltip label="Larger comments">
              <Button variant="outline" size="compact" aria-label="Larger comments" disabled={noteSize === NOTE_SIZES.length - 1} onClick={() => setNoteSize(size => Math.min(NOTE_SIZES.length - 1, size + 1))}>A+</Button>
            </Tooltip>
          </span>
        </div>
        {/* Sprint 161 (decision 8): the current part's comments, read-only, in the order they are written. */}
        <div className="pv-notes" style={{ fontSize: NOTE_SIZES[noteSize], lineHeight: `${Math.round(NOTE_SIZES[noteSize] * 1.55)}px` }}>
          {state.comments.length ? (
            <ol className="pv-comments">
              {state.comments.map((comment, index) => (
                <li key={index} className="pv-comment">
                  {comment.words ? <span className="pv-comment-on">“{comment.words}”</span> : null}
                  {comment.note}
                </li>
              ))}
            </ol>
          ) : <span className="pv-no-notes">No comments on this slide.</span>}
        </div>
        <div className="pv-held">
          <Icon name="bell-slash" size={16} tone="inherit" />
          Claude and notices wait until you stop.
        </div>
      </div>

      <div className="pv-foot">
        <Tooltip label={state.length ? 'Change the session’s length' : 'Set the session’s length'}>
          <Button variant="ghost" className="pv-clock" onClick={() => send('present/set-length')}>
            <span className="pv-time">{clockText(clock.elapsed)}</span>
            <span className="pv-of">{state.length ? `elapsed, of ${state.length} minutes` : 'elapsed'}</span>
          </Button>
        </Tooltip>
        <span className="pv-daytime" aria-label={`The time: ${timeOfDay}`}>{timeOfDay}</span>
        <Tooltip label={clock.paused ? 'Start the clock again' : 'Pause the clock'}>
          <Button variant="outline" onClick={clock.pause}>
            <Icon name={clock.paused ? 'play' : 'pause'} size={16} tone="inherit" />
            {clock.paused ? 'Resume' : 'Pause'}
          </Button>
        </Tooltip>
        <Tooltip label="Start the clock from zero">
          <Button variant="outline" onClick={clock.reset}>
            <Icon name="arrow-counter-clockwise" size={16} tone="inherit" />
            Reset
          </Button>
        </Tooltip>
        <span className="pv-grow" />
        <span className="pv-count">{state.skipped ? 'Skipped slide' : `Slide ${countLabel(state.position, state.count, false)}`}</span>
        <Tooltip label="The slide before (←)">
          <Button variant="outline" onClick={() => send('present/back')}>
            <Icon name="caret-left" size={16} tone="inherit" />
            Back
          </Button>
        </Tooltip>
        <Tooltip label="The next slide (→)">
          <Button className="pv-next" onClick={() => send('present/next')}>
            Next
            <Icon name="caret-right" size={16} tone="inherit" />
          </Button>
        </Tooltip>
        {state.page ? (
          <Tooltip label={pageShown ? 'Show the slide on the wall again (Q)' : 'Show the page’s QR code on the wall, so phones in the room open it (Q)'}>
            <Button variant="outline" aria-pressed={pageShown !== null} data-state={pageShown ? 'active' : undefined} onClick={togglePage}>
              <Icon name="qr-code" size={16} tone="inherit" />
              Show the page
            </Button>
          </Tooltip>
        ) : null}
        {state.canSwap ? (
          <Tooltip label="Show the slides on the other display, and this view here">
            <Button variant="outline" onClick={() => send('present/swap')}>
              <Icon name="arrows-left-right" size={16} tone="inherit" />
              Swap displays
            </Button>
          </Tooltip>
        ) : null}
        <Tooltip label="Stop presenting and go back to the deck (esc)">
          <Button variant="outline" onClick={() => send('present/stop')}>Stop</Button>
        </Tooltip>
      </div>
    </div>
  )
}
