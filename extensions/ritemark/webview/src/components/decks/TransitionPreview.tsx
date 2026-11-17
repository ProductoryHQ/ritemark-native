/**
 * README item 19 ("Trying one"): choosing a transition in the Theme menu plays it once on the stage, from the current
 * slide to the next and back, so the person sees what they chose. The only motion the deck view ever has; with reduced
 * motion there is no preview.
 *
 * Drawn over the stage's slide (`.deck-big`), with the wall's own drawing (`present/playMotion.ts`): the deck's
 * transition only, never a smooth move. Any key or press stops it at once, and the stage is as it was.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { DeckTheme } from '../../../../src/decks/deckTheme'
import type { SlideData } from '../../../../src/decks/deckFormat'
import { SlideCanvas } from './slide/SlideCanvas'
import { MOTION_MS, MotionRun, type DeckTransition } from './present/wallMotion'
import { playStep, prefersReducedMotion } from './present/playMotion'

/** The next slide stays this long before the preview goes back. */
const HOLD_MS = 700

export interface TransitionPreviewRequest {
  /** A new serial plays again. */
  serial: number
  transition: DeckTransition
}

interface TransitionPreviewProps {
  request: TransitionPreviewRequest | null
  /** The stage's slide, which the preview covers. */
  target: () => HTMLElement | null
  /** The slide on the stage and the one the preview goes to (the next, or the one before on the last slide). */
  from: { kind: string; data: SlideData } | null
  to: { kind: string; data: SlideData } | null
  width: number
  theme: DeckTheme
  borderless: boolean
  assets: Record<string, string>
}

/** Whether a choice plays: a slide to go to, and motion allowed. */
export function previewPlays(hasTo: boolean, reducedMotion: boolean): boolean {
  return hasTo && !reducedMotion
}

export function TransitionPreview({ request, target, from, to, width, theme, borderless, assets }: TransitionPreviewProps) {
  const [playing, setPlaying] = useState<{ serial: number; transition: DeckTransition; host: HTMLElement } | null>(null)
  const fromRef = useRef<HTMLDivElement>(null)
  const toRef = useRef<HTMLDivElement>(null)
  const run = useRef<MotionRun | null>(null)
  if (!run.current) run.current = new MotionRun({ setTimeout: (go, ms) => window.setTimeout(go, ms), clearTimeout: id => window.clearTimeout(id) })

  // A new choice: play it, unless motion is reduced or there is no other slide.
  useEffect(() => {
    if (!request) return
    const host = target()
    if (!host || !previewPlays(!!from && !!to, prefersReducedMotion())) return
    run.current?.finish()
    setPlaying({ serial: request.serial, transition: request.transition, host })
    // Only a new request plays; the slides it shows are the ones at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.serial])

  // There and back: the transition going on, a pause on the next slide, the transition going back, and gone.
  const serial = playing?.serial
  useLayoutEffect(() => {
    if (serial === undefined || !playing) return
    const motion = run.current
    const first = fromRef.current
    const second = toRef.current
    if (!motion || !first || !second) { setPlaying(null); return }
    const transition = playing.transition
    const distance = playing.host.getBoundingClientRect().width
    let hold = 0
    let stopped = false
    const end = () => { stopped = true; setPlaying(value => (value?.serial === serial ? null : value)) }
    const reset = (element: HTMLElement) => {
      for (const animation of element.getAnimations?.() ?? []) animation.cancel()
      element.style.visibility = ''
    }
    motion.begin(MOTION_MS[transition], playStep(transition, 'next', { leaving: first, entering: second, distance }), () => {
      if (stopped) return
      hold = window.setTimeout(() => {
        if (stopped) return
        reset(first)
        reset(second)
        motion.begin(MOTION_MS[transition], playStep(transition, 'back', { leaving: second, entering: first, distance }), end)
      }, HOLD_MS)
    })
    // Any key or press stops it at once.
    const stop = () => { window.clearTimeout(hold); stopped = true; motion.finish(); end() }
    window.addEventListener('keydown', stop, true)
    window.addEventListener('pointerdown', stop, true)
    return () => {
      window.removeEventListener('keydown', stop, true)
      window.removeEventListener('pointerdown', stop, true)
      window.clearTimeout(hold)
      stopped = true
      motion.finish()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serial])

  if (!playing || !from || !to) return null
  return createPortal(
    <div className="deck-transition-preview" aria-hidden="true">
      <div ref={fromRef} className="deck-transition-layer">
        <SlideCanvas kind={from.kind} data={from.data} width={width} theme={theme} borderless={borderless} assets={assets} />
      </div>
      <div ref={toRef} className="deck-transition-layer">
        <SlideCanvas kind={to.kind} data={to.data} width={width} theme={theme} borderless={borderless} assets={assets} />
      </div>
    </div>,
    playing.host,
  )
}
