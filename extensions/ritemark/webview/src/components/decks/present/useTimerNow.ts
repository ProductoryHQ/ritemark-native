/**
 * Decks README item 9: the clock a countdown is drawn at, for the wall and the presenter view alike. The time is read
 * at each draw, so a timer started again (Restart, or a new one) never shows an old clock for a moment; the window is
 * drawn again only when the words change (`timerNextTick`) and once more when the 00:00 pulses end.
 */
import { useEffect, useState } from 'react'
import type { WallTimer } from '../../../../../src/decks/present/presentProtocol'
import { timerNextTick } from './pointerTimer'

export function useTimerNow(timer: WallTimer): number {
  const [tick, setTick] = useState(0)
  const now = Date.now()
  const { endsAt, minutes } = timer
  useEffect(() => {
    const wait = timerNextTick({ endsAt, minutes }, Date.now())
    if (wait <= 0) return
    const id = window.setTimeout(() => setTick(value => value + 1), wait)
    return () => window.clearTimeout(id)
  }, [endsAt, minutes, tick])
  return now
}
