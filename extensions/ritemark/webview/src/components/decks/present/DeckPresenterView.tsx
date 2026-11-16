/**
 * Sprint 159 (PR 6; experience 17 frame 3): the presenter view, on the laptop while the wall shows on the projector.
 * In Ritemark Dark whatever the app's theme, so it glows less in a dim room.
 *
 *  - The slide now, as the room sees it, and the next one.
 *  - Your comments (Sprint 161): the current part's comments in large type, with A− and A+.
 *  - The slides shown, in a row: a click goes there.
 *  - The clock: time elapsed, against the session's length (`ritemark-length` in the deck's front matter) when the deck
 *    has one; a click on it asks for the length. Pause and Reset are this view's own.
 *  - Back, Next (the one bright button), Swap displays (with two displays) and Stop.
 *  - "Claude and notices wait until you stop.": the main window, with the AI and the notices, stays behind.
 *
 * The keys are the wall's (`wallKeys.ts`): the presenter's keyboard or clicker moves the wall from here. The host is
 * the only source of state; this is the one window that gets the notes.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PresenterState, WallSlide } from '../../../../../src/decks/present/presentProtocol'
import { onMessage, sendToExtension } from '../../../bridge'
import { usePageDrawn } from '../../../lib/pageDrawn'
import { Button } from '../../ui/button'
import { Icon } from '../../ui/Icon'
import { Tooltip } from '../../ui/tooltip'
import { SlideCanvas } from '../slide/SlideCanvas'
import { clockText, countLabel, goToKey, wallKeyOf } from './wallKeys'
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

function useScreenSize(): { width: number; height: number } {
  const [size, setSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }))
  useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return size
}

/** The clock: elapsed since the start, with Pause and Reset of its own. */
function useClock(startedAt: number | null): { elapsed: number; paused: boolean; pause: () => void; reset: () => void } {
  const [now, setNow] = useState(() => Date.now())
  const [offset, setOffset] = useState<{ start: number | null; pausedAt: number | null; pausedFor: number }>({ start: null, pausedAt: null, pausedFor: 0 })
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(timer)
  }, [])
  const start = offset.start ?? startedAt ?? now
  const until = offset.pausedAt ?? now
  return {
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

  usePageDrawn(state !== null)

  useEffect(() => onMessage(message => {
    if (message.type === 'present/presenter') setState(message as unknown as PresenterState)
    else if (message.type === 'present/peeked' && typeof message.number === 'number') {
      setPeeked({ number: message.number, title: typeof message.title === 'string' ? message.title : null })
    }
  }), [])
  useEffect(() => { sendToExtension('present/ready') }, [])

  const send = useCallback((type: string, data: Record<string, unknown> = {}) => sendToExtension(type, data), [])

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
      const step = goToKey(digits, event)
      if (step.handled) {
        take()
        setDigits(step.digits)
        if (step.digits === null) setPeeked(null)
        if (step.go !== undefined) send('present/go', { number: step.go })
        return
      }
      if (digits !== null) { setDigits(null); setPeeked(null) }
      const key = wallKeyOf(event)
      if (!key || key.type === 'digit') return
      // Return and space on one of this view's buttons press that button.
      if ((key.type === 'next') && (event.key === 'Enter' || event.key === ' ') && (event.target as Element | null)?.closest?.('button')) return
      take()
      send(key.type === 'stop' ? 'present/stop' : `present/${key.type}`)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [state, digits, send])

  // The row keeps the current slide in view.
  useLayoutEffect(() => {
    rowRef.current?.querySelector<HTMLElement>('.pv-thumb.is-current')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [state?.current.number])

  if (!state) return <div className="deck-presenter dark" />

  // The slide now takes what the right column and the row leave, at 16:9.
  const nowWidth = Math.max(240, Math.min(screen.width - EDGE * 3 - SIDE_WIDTH, Math.round((screen.height - 56 - 136 - 112) * 16 / 9)))
  const shownIndex = state.slides.findIndex(slide => slide.number === state.current.number)
  const gotoNumber = digits === null ? null : Number(digits)
  const gotoTitle = gotoNumber !== null && peeked?.number === gotoNumber ? peeked.title : undefined
  const gotoMissing = gotoNumber !== null && (gotoNumber < 1 || gotoTitle === null)
  const canvas = (slide: WallSlide, width: number) => (
    <div className={`pv-slide${state.borderless ? ' is-borderless' : ''}`} style={{ width }}>
      <SlideCanvas kind={slide.kind} data={slide.data} width={width} theme={state.theme} borderless={state.borderless} assets={state.assets} />
    </div>
  )

  return (
    <div className="deck-presenter dark">
      <div className="pv-main" style={{ width: nowWidth }}>
        <div className="pv-label">{state.wallDisplay ? `Now, on ${state.wallDisplay}` : 'Now, on the wall'}</div>
        <div className="pv-now">
          {canvas(state.current, nowWidth)}
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
