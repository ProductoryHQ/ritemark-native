/**
 * A desk page tells Ritemark's shell when its content is on screen (Sprint 152, PR 3; `src/shellPageSignals.ts`), so the
 * shell's loading look stays above the page until then and the content replaces it in one change: no bare sheet while
 * the page waits for its host's first answer.
 *
 * `usePageDrawn(ready)` in the page's component posts PAGE_DRAWING on its first render, before anything the page's own
 * effects post, and PAGE_DRAWN once, just after the frame that paints the first render where `ready` is true, so the
 * content has been painted by the time the shell takes its look away.
 */

import { useLayoutEffect } from 'react'
import { PAGE_DRAWING, PAGE_DRAWN } from '../../../src/shellPageSignals'
import { vscode } from './vscode'

let drawing = false
let drawn = false

/** The page will say when it is drawn: posted once, first. */
function announcePageDrawing(): void {
  if (drawing) return
  drawing = true
  vscode.postMessage({ type: PAGE_DRAWING })
}

/**
 * The page's content is on screen: posted once. A frame callback runs before that frame's paint, so the message waits
 * for the task after it.
 */
function announcePageDrawn(): void {
  if (drawn) return
  drawn = true
  requestAnimationFrame(() => setTimeout(() => vscode.postMessage({ type: PAGE_DRAWN }), 0))
}

/** For a page whose content comes after its host answers: "drawing" now, "drawn" after the first render with `ready`. */
export function usePageDrawn(ready: boolean): void {
  announcePageDrawing() // during the first render, before the page's own effects post anything
  useLayoutEffect(() => {
    if (ready) announcePageDrawn()
  }, [ready])
}
