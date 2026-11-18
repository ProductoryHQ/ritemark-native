/**
 * A wide table's soft edges (the Experience lead on #781). A table that scrolls sideways in its own frame (a deck's
 * handout, `decks.css`; the published page, `pageHtml.ts`) would show its last visible column cut mid-word, which reads
 * as a clipped bug. So the frame fades its content over 24 px on whichever side has more to scroll to, and the fade
 * goes when that end is reached. The fade is a `mask-image` on the frame, chosen by two classes this watcher sets:
 * `is-scrollable-left` and `is-scrollable-right`. A mask fades the cells' own words and the grey header row alike,
 * which the CSS scroll-shadow trick (painted behind the cells) could not.
 *
 * The watcher is a passive scroll listener, drawing once per animation frame, and a `ResizeObserver` (the frame's
 * border box, and the table's size as its words change), drawing in its own callback, before the frame is painted.
 * It only sets classes, so with reduced motion nothing moves. A frame that doesn't scroll (`overflow-x: visible`, as
 * in a Text document or on a slide) gets no class: the watcher sees that once, when the frame is first drawn, and
 * stops, so those editors keep no listener or observer for it.
 *
 * The published page runs the same rule as plain JavaScript (`PAGE_EDGE_RULE` in `src/decks/page/pageScript.ts`);
 * `pageScript.test.ts` runs both and fails when they part.
 */

/** Less than this many pixels left to scroll counts as the end (a zoomed frame's scroll position has fractions). */
export const EDGE_SLACK = 1

export interface TableEdges {
  left: boolean
  right: boolean
}

/**
 * Which sides of a frame have more to scroll to. A right-to-left frame starts at its right edge with `scrollLeft` 0
 * and goes negative towards its left (the standard every current browser follows).
 */
export function tableEdges(scrollLeft: number, scrollWidth: number, clientWidth: number, rtl = false): TableEdges {
  const room = scrollWidth - clientWidth
  if (!(room > EDGE_SLACK)) return { left: false, right: false }
  const at = Math.min(room, Math.abs(scrollLeft))
  const fromStart = at > EDGE_SLACK
  const toEnd = at < room - EDGE_SLACK
  return rtl ? { left: toEnd, right: fromStart } : { left: fromStart, right: toEnd }
}

/** The window the watcher uses: the page's own, or a test's stand-in. */
export interface EdgeWindow {
  getComputedStyle(element: Element): { overflowX: string; direction?: string }
  requestAnimationFrame(callback: () => void): number
  cancelAnimationFrame(handle: number): void
  ResizeObserver?: new (callback: () => void) => { observe(target: Element, options?: { box?: string }): void; disconnect(): void }
}

/**
 * Keeps `frame`'s two classes in step with its scroll position, its size and `content`'s size. The scrollbar's own
 * height goes in `--rm-fade-bar`, so the mask leaves a classic scrollbar's thumb whole. Returns the clean-up, which
 * removes the listener, the observer and a pending frame (and runs by itself for a frame that doesn't scroll).
 */
export function watchTableEdges(frame: HTMLElement, content: Element, win: EdgeWindow = window as unknown as EdgeWindow): () => void {
  let pending = 0
  let bar = ''
  let stopped = false
  let rtl: boolean | null = null
  const draw = () => {
    pending = 0
    if (stopped || !frame.isConnected) return
    if (rtl === null) {
      const style = win.getComputedStyle(frame)
      if (!/^(auto|scroll)$/.test(style.overflowX)) {
        stop()
        return
      }
      rtl = style.direction === 'rtl'
    }
    const edges = tableEdges(frame.scrollLeft, frame.scrollWidth, frame.clientWidth, rtl)
    frame.classList.toggle('is-scrollable-left', edges.left)
    frame.classList.toggle('is-scrollable-right', edges.right)
    const height = edges.left || edges.right ? Math.max(0, frame.offsetHeight - frame.clientHeight) : 0
    const next = height ? `${height}px` : ''
    if (next === bar) return
    bar = next
    if (next) frame.style.setProperty('--rm-fade-bar', next)
    else frame.style.removeProperty('--rm-fade-bar')
  }
  const schedule = () => {
    if (!pending && !stopped) pending = win.requestAnimationFrame(draw)
  }
  const Observer = win.ResizeObserver
  const observer = typeof Observer === 'function' ? new Observer(draw) : null
  const stop = () => {
    stopped = true
    frame.removeEventListener('scroll', schedule)
    observer?.disconnect()
    if (pending) win.cancelAnimationFrame(pending)
    pending = 0
  }
  frame.addEventListener('scroll', schedule, { passive: true })
  observer?.observe(frame, { box: 'border-box' })
  observer?.observe(content)
  schedule()
  return stop
}
