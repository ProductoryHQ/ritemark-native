/**
 * README item 20: the slide's content arrives in a row. The one drawing of it, for the wall (`playMotion.playStep`) and
 * for the published page, whose one script carries this very function's source (`pageScript.ts` puts
 * `String(rowPlayer)` in, called with `ROW_NUMBERS`), so the wall and the page move the same ("The page and Present are
 * one player"). Whether a slide arrives in a row at all is `slideArrival.rowPlays`.
 *
 *  - The slide before leaves as one, in 0.15 s (Push: pushed off to the left in 0.4 s), never in a row.
 *  - The new slide's pieces come in reading order: the title, a paragraph, each point of a list, each box, step and
 *    column, a table, a picture in the words. Up to eight come 70 ms apart; with more, closer (28 ms at least), and from
 *    the 14th on, together, so a slide settles within about 0.9 s. In Fade each rises 14 px as it fades in, in Zoom it
 *    grows from 92 %, in Push it comes in from the right on the slide's heels, 30 ms apart. The new title starts as the
 *    slide before goes, so the two never sit on top of each other.
 *  - A picture on the side slides in 28 px from its own edge as the title comes; one Behind is ground, settling from
 *    104 % under the words.
 *  - An item One by one hasn't shown yet (`data-reveal-hidden`) waits; the logo and the ground never move. A slide with
 *    no flow of blocks (a v1 layout) arrives as one piece.
 *
 * `rowPlayer` uses nothing but its argument and the elements it is given (no imports, no module names, plain ASCII), so
 * its source runs as it is on the page; `pageScript.test.ts` checks the page's copy is this source.
 */
import { EASE_IN_OUT, EASE_OUT, MOTION_MS, ROW } from './wallMotion'

/** The row's numbers, from the wall's own (`wallMotion.ROW`, `MOTION_MS`, the easings). */
export interface RowNumbers {
  gap: number
  minGap: number
  span: number
  last: number
  ms: number
  rise: number
  zoom: number
  leaveMs: number
  pushGap: number
  pushMs: number
  photoMs: number
  photoShift: number
  behindFrom: number
  easeOut: string
  easeInOut: string
  leaveEase: string
}

export const ROW_NUMBERS: RowNumbers = {
  gap: ROW.gap,
  minGap: ROW.minGap,
  span: ROW.span,
  last: ROW.last,
  ms: ROW.ms,
  rise: ROW.rise,
  zoom: ROW.zoom,
  leaveMs: ROW.leaveMs,
  pushGap: ROW.pushGap,
  pushMs: MOTION_MS.push,
  photoMs: 900,
  photoShift: 28,
  behindFrom: 1.04,
  easeOut: EASE_OUT,
  easeInOut: EASE_IN_OUT,
  leaveEase: 'cubic-bezier(0.4, 0, 1, 1)',
}

/** The deck transitions that move; None never reaches the row. */
export type RowTransition = 'fade' | 'push' | 'zoom'

export interface RowHow {
  transition: RowTransition
  /** How far the slide before is pushed (Push), in px: the screen's width on the wall, the frame's on the page. */
  width: number
  /** Elements that don't take part (the smooth move's gliding ones): left out of the row. */
  skip?: readonly Element[]
  /** The slide before is left to the caller (the smooth move cross-fades it): false. */
  leave?: boolean
}

/** What one arrival started, and when its last piece is in place (ms from now). */
export interface RowPlay {
  animations: Animation[]
  end: number
}

export interface RowPlayer {
  /** When each of a slide's `n` pieces starts, after `lead` ms. */
  delays(n: number, lead: number, push: boolean): number[]
  /** A slide's pieces, in reading order. */
  piecesOf(entering: Element, skip?: readonly Element[]): Element[]
  /** Play one arrival: the slide before (or none: the start, one column) leaves, and the new slide's pieces come in a row. */
  play(entering: Element, leaving: Element | null, how: RowHow): RowPlay
}

/**
 * The player for these numbers. Its body names no inner function (methods on one object, an explicit stack for the
 * walk), so no build step wraps anything inside it (esbuild's `keepNames`, which tsx uses, adds `__name(...)` calls around
 * named inner functions): what `String(rowPlayer)` gives runs alone, on the page.
 */
export function rowPlayer(row: RowNumbers): RowPlayer {
  const player: RowPlayer = {
    delays(n: number, lead: number, push: boolean): number[] {
      const gap = push ? row.pushGap : n <= 8 ? row.gap : Math.max(row.minGap, Math.round(row.span / (n - 1)))
      const out: number[] = []
      for (let index = 0; index < n; index++) out.push(lead + Math.min(index, row.last) * gap)
      return out
    },
    piecesOf(entering: Element, skip?: readonly Element[]): Element[] {
      const flow = entering.querySelector('.blk-flow')
      if (!flow) return [entering]
      const out: Element[] = []
      // In reading order: a list, boxes, columns, steps or a group give their items; anything else is one piece.
      const stack: Element[] = Array.prototype.slice.call(flow.children).reverse()
      while (stack.length) {
        const element = stack.pop() as Element
        if (element.hasAttribute('data-reveal-hidden')) continue
        if (skip && skip.indexOf(element) >= 0) continue
        const tag = String(element.tagName).toUpperCase()
        const names = element.classList
        if (tag === 'UL' || tag === 'OL' || names.contains('blk-boxes') || names.contains('blk-columns') || names.contains('blk-steps') || names.contains('blk-group')) {
          const children: Element[] = Array.prototype.slice.call(element.children)
          for (let index = children.length - 1; index >= 0; index--) stack.push(children[index])
          continue
        }
        out.push(element)
      }
      return out
    },
    play(entering: Element, leaving: Element | null, how: RowHow): RowPlay {
      const played: RowPlay = { animations: [], end: 0 }
      const push = how.transition === 'push'
      // Each step: [element, keyframes, ms, delay, easing, fill].
      const steps: Array<[Element, Keyframe[], number, number, string, FillMode]> = []
      // The slide before leaves as one, and stays gone until it is taken away.
      if (leaving && how.leave !== false) {
        if (push) steps.push([leaving, [{ transform: 'translateX(0)' }, { transform: 'translateX(' + (-how.width) + 'px)' }], row.pushMs, 0, row.easeInOut, 'forwards'])
        else steps.push([leaving, [{ opacity: 1 }, { opacity: 0 }], row.leaveMs, 0, row.leaveEase, 'forwards'])
      }
      // The new title starts as the slide before goes, so the two never sit on top of each other.
      const lead = push || !leaving ? 0 : row.leaveMs - 10
      const pieces = player.piecesOf(entering, how.skip)
      const starts = player.delays(pieces.length, lead, push)
      const from: Keyframe = push
        ? { transform: 'translateX(960px)' }
        : how.transition === 'zoom'
          ? { opacity: 0, transform: 'scale(' + row.zoom + ')' }
          : { opacity: 0, transform: 'translateY(' + row.rise + 'px)' }
      const to: Keyframe = push ? { transform: 'none' } : { opacity: 1, transform: 'none' }
      // Each piece waits unseen until its turn (`backwards`), and is as drawn once it has come.
      for (let index = 0; index < pieces.length; index++) steps.push([pieces[index], [from, to], push ? row.pushMs : row.ms, starts[index], push ? row.easeInOut : row.easeOut, 'backwards'])
      // A picture on the side slides in from its own edge as the title comes; one Behind settles under the words.
      const photo = push ? null : entering.querySelector('.deck-sl.is-blocks .photo')
      const slide = photo ? photo.closest('.deck-sl') : null
      if (photo && slide && !(how.skip && how.skip.indexOf(photo) >= 0)) {
        if (slide.classList.contains('pic-behind')) steps.push([photo, [{ transform: 'scale(' + row.behindFrom + ')' }, { transform: 'none' }], row.photoMs, 0, row.easeOut, 'backwards'])
        else steps.push([photo, [{ opacity: 0, transform: 'translateX(' + (slide.classList.contains('pic-left') ? -row.photoShift : row.photoShift) + 'px)' }, { opacity: 1, transform: 'none' }], row.ms, lead, row.easeOut, 'backwards'])
      }
      for (const [element, keyframes, ms, delay, easing, fill] of steps) {
        if (typeof (element as HTMLElement).animate !== 'function') continue
        played.animations.push((element as HTMLElement).animate(keyframes, { duration: ms, delay, easing, fill }))
        played.end = Math.max(played.end, delay + ms)
      }
      return played
    },
  }
  return player
}

/** The wall's player (the page builds its own from this function's source and the same numbers). */
export const ROW_PLAYER: RowPlayer = rowPlayer(ROW_NUMBERS)
