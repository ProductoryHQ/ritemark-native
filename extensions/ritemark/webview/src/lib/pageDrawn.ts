/**
 * A desk page tells Ritemark's shell when its content is on screen (Sprint 152, PR 3; `src/shellPageSignals.ts`), so the
 * shell's loading look stays above the page until then and the content replaces it in one change: no bare sheet while
 * the page waits for its host's first answer.
 *
 * `announcePageDrawing()` comes first, before anything else the page posts (`main.tsx`, for the pages that say when
 * they are drawn); `usePageDrawn(ready)` posts PAGE_DRAWN once, in the frame after the first render where `ready` is
 * true, so the content has been painted by the time the shell takes its look away.
 */

import { useLayoutEffect } from 'react'
import { PAGE_DRAWING, PAGE_DRAWN } from '../../../src/shellPageSignals'
import { vscode } from './vscode'

let drawn = false

/** The page will say when it is drawn: posted first. */
export function announcePageDrawing(): void {
  vscode.postMessage({ type: PAGE_DRAWING })
}

/** The page's content is on screen: posted once, after the frame that paints it. */
export function announcePageDrawn(): void {
  if (drawn) return
  drawn = true
  requestAnimationFrame(() => vscode.postMessage({ type: PAGE_DRAWN }))
}

/** Announces the page drawn after the first render where `ready` is true. */
export function usePageDrawn(ready: boolean): void {
  useLayoutEffect(() => {
    if (ready) announcePageDrawn()
  }, [ready])
}
