/**
 * README items 17 and 19: drawing one step between two slides, with the Web Animations API, so a press can jump every
 * part of it to its end at once (`MotionDrawing.finish`). The rules (which step, how long, which elements match) are
 * `wallMotion.ts`; this only draws them.
 *
 *  - Fade: the slide before fades out as the new one fades in (0.3 s).
 *  - Push: the new slide comes in from the right and pushes the one before off to the left (0.4 s); back, the other way.
 *    The layers move by the screen's width, so a slide is wholly off the wall, its ground staying (it is the wall's).
 *  - Zoom: the new slide grows from 96 % as it fades in, and the one before fades out (0.35 s).
 *  - The smooth move: each matching element glides and resizes from where it was to its new place (0.4 s, easing out)
 *    on a copy of the new slide in which only those elements show; everything else cross-fades (0.3 s). A title keeps
 *    the shape of its words (one scale, from the font sizes); a picture takes its new box's shape; a block keeps its own.
 *  - None: nothing to draw.
 *
 * Used by the wall, and by the Theme menu's preview on the stage (only the deck's transition there, never a move).
 */
import { EASE_IN_OUT, EASE_OUT, matchMotion, motionKeysOf, MOTION_MS, MOVE_FADE_MS, REVEAL_MS, REVEAL_RISE, ZOOM_FROM, type MotionDirection, type MotionDrawing, type MotionPair, type MotionStep } from './wallMotion'
import { ROW_PLAYER, type RowHow, type RowTransition } from './rowArrival'

/** Reduced motion, the system's or VS Code's own setting (the class it puts on a webview's body). */
export function prefersReducedMotion(): boolean {
  const media = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const vscode = typeof document !== 'undefined' && (document.body?.classList.contains('vscode-reduce-motion') || document.documentElement.classList.contains('vscode-reduce-motion'))
  return !!(media || vscode)
}

/** The elements that would glide between two drawn slides (README 17). */
export function motionPairsOf(before: HTMLElement, now: HTMLElement): MotionPair<HTMLElement>[] {
  return matchMotion(motionKeysOf(before as never), motionKeysOf(now as never)) as unknown as MotionPair<HTMLElement>[]
}

interface Layers {
  /** The slide before, drawn over the same ground. */
  leaving: HTMLElement
  /** The slide now. */
  entering: HTMLElement
  /** How far a Push moves a layer: the screen's width (or the stage's), in px. */
  distance: number
}

/** A step's drawing, and how long it runs (the row's last piece may come after the transition's own length). */
export interface StepDrawing extends MotionDrawing {
  ms: number
}

/**
 * Draw one step; the drawing's `finish` puts everything at its end at once and takes away what the step added. With
 * `row` (README item 20, `slideArrival.rowPlays`: a press going on), Fade, Push and Zoom bring the new slide's content in
 * a row (`rowArrival.ts`, the page's own drawing too), and a smooth move's other elements arrive in a row behind the
 * gliding ones; without it the slide comes whole.
 */
export function playStep(step: MotionStep, direction: MotionDirection, layers: Layers, pairs: readonly MotionPair<HTMLElement>[] = [], row = false): StepDrawing {
  const animations: Animation[] = []
  const undo: Array<() => void> = []
  const { leaving, entering, distance } = layers
  let ms = MOTION_MS[step]
  const inRow = (how: RowHow) => {
    const played = ROW_PLAYER.play(entering, leaving, how)
    animations.push(...played.animations)
    ms = Math.max(ms, played.end)
  }
  const animate = (element: HTMLElement, keyframes: Keyframe[], ms: number, easing: string) => {
    if (typeof element.animate !== 'function') return
    const animation = element.animate(keyframes, { duration: ms, easing, fill: 'both' })
    animations.push(animation)
    // The new slide's end is how it is drawn anyway: its animation is taken off at the end, so nothing lingers on the
    // slide now shown. The slide before keeps its end (gone) until it is taken away.
    if (element !== leaving) undo.push(() => animation.cancel())
  }
  switch (row && step !== 'none' && step !== 'move' ? 'row' : step) {
    case 'row':
      inRow({ transition: step as RowTransition, width: distance })
      break
    case 'fade':
      animate(entering, [{ opacity: 0 }, { opacity: 1 }], MOTION_MS.fade, 'ease')
      animate(leaving, [{ opacity: 1 }, { opacity: 0 }], MOTION_MS.fade, 'ease')
      break
    case 'push': {
      const way = direction === 'back' ? -1 : 1
      animate(entering, [{ transform: `translateX(${way * distance}px)` }, { transform: 'translateX(0)' }], MOTION_MS.push, EASE_IN_OUT)
      animate(leaving, [{ transform: 'translateX(0)' }, { transform: `translateX(${-way * distance}px)` }], MOTION_MS.push, EASE_IN_OUT)
      break
    }
    case 'zoom':
      animate(entering, [{ opacity: 0, transform: `scale(${ZOOM_FROM})` }, { opacity: 1, transform: 'scale(1)' }], MOTION_MS.zoom, EASE_OUT)
      animate(leaving, [{ opacity: 1 }, { opacity: 0 }], MOTION_MS.zoom, EASE_OUT)
      break
    case 'move':
      // In a row, what doesn't glide arrives behind what does (README item 20); else it cross-fades.
      if (row) inRow({ transition: 'fade', width: distance, skip: pairs.map(pair => pair.to), leave: false })
      else animate(entering, [{ opacity: 0 }, { opacity: 1 }], MOVE_FADE_MS, 'ease')
      animate(leaving, [{ opacity: 1 }, { opacity: 0 }], MOVE_FADE_MS, 'ease')
      glide(entering, pairs, animate, undo)
      break
    case 'none':
      // A cut: the slide before is gone at once, before anything is painted.
      leaving.style.visibility = 'hidden'
      break
  }
  let done = false
  return {
    ms,
    finish: () => {
      if (done) return
      done = true
      for (const animation of animations) {
        try {
          animation.finish()
        } catch {
          // An animation whose element left the page: nothing to finish.
        }
      }
      for (const step of undo.reverse()) step()
    },
  }
}

/** A drawing made of animations already started: its `finish` puts each at its end, once. */
export function drawingOf(animations: readonly Animation[]): MotionDrawing {
  let done = false
  return {
    finish: () => {
      if (done) return
      done = true
      for (const animation of animations) {
        try {
          animation.finish()
        } catch {
          // An animation whose element left the page: nothing to finish.
        }
      }
    },
  }
}

/**
 * README item 18: the items shown by a press (`from` to `to`, their `data-reveal-item` numbers) arrive in `slide`, each
 * fading in as it rises 8 px (on the slide's own canvas) in 0.2 s. Its `finish` puts them at their end at once, so a press
 * during it never waits. Nothing to draw: null.
 */
export function playReveal(slide: Element | null, arrivals: { from: number; to: number }): MotionDrawing | null {
  if (!slide) return null
  const animations: Animation[] = []
  for (let index = arrivals.from; index < arrivals.to; index++) {
    const item = slide.querySelector<HTMLElement>(`[data-reveal-item="${index}"]`)
    if (!item || typeof item.animate !== 'function') continue
    animations.push(item.animate([{ opacity: 0, transform: `translateY(${REVEAL_RISE}px)` }, { opacity: 1, transform: 'translateY(0)' }], { duration: REVEAL_MS, easing: EASE_OUT }))
  }
  if (!animations.length) return null
  return {
    finish: () => {
      for (const animation of animations) {
        try {
          animation.finish()
        } catch {
          // An item that left the page: nothing to finish.
        }
      }
    },
  }
}

/** The path of child indexes from `root` down to `element`, or null when it isn't inside. */
function pathTo(root: Element, element: Element): number[] | null {
  const path: number[] = []
  let node: Element | null = element
  while (node && node !== root) {
    const parent: Element | null = node.parentElement
    if (!parent) return null
    path.unshift(Array.prototype.indexOf.call(parent.children, node))
    node = parent
  }
  return node === root ? path : null
}

function follow(root: Element, path: readonly number[]): HTMLElement | null {
  let node: Element | null = root
  for (const index of path) node = node?.children[index] ?? null
  return node as HTMLElement | null
}

/** Where an element's words are drawn (their lines' box), or its own box for anything else. */
function wordsRect(element: HTMLElement): DOMRect {
  const range = element.ownerDocument.createRange()
  range.selectNodeContents(element)
  const rect = range.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0 ? rect : element.getBoundingClientRect()
}

function fontSize(element: HTMLElement): number {
  const size = Number.parseFloat(getComputedStyle(element).fontSize)
  return Number.isFinite(size) && size > 0 ? size : 1
}

/**
 * The smooth move: a copy of the new slide over both, in which only the matching elements show, each drawn at its new
 * place and moved from its old one. The originals are hidden on both slides while it runs, so nothing shows twice.
 */
function glide(
  entering: HTMLElement,
  pairs: readonly MotionPair<HTMLElement>[],
  animate: (element: HTMLElement, keyframes: Keyframe[], ms: number, easing: string) => void,
  undo: Array<() => void>,
) {
  if (pairs.length === 0 || !entering.parentElement) return
  const moves = pairs.map(pair => {
    const kind = pair.kind
    const box = { from: pair.from.getBoundingClientRect(), to: pair.to.getBoundingClientRect() }
    const content = kind === 'title' ? { from: wordsRect(pair.from), to: wordsRect(pair.to) } : box
    // The slide's own scale on the wall: a canvas of 960 drawn at the frame's width.
    const local = pair.to.offsetWidth > 0 ? box.to.width / pair.to.offsetWidth : 1
    let sx: number
    let sy: number
    if (kind === 'picture') {
      sx = box.from.width / Math.max(1, box.to.width)
      sy = box.from.height / Math.max(1, box.to.height)
    } else {
      sx = kind === 'title' ? fontSize(pair.from) / fontSize(pair.to) : box.from.width / Math.max(1, box.to.width)
      sy = sx
    }
    const tx = ((content.from.left - box.to.left) - sx * (content.to.left - box.to.left)) / (local || 1)
    const ty = ((content.from.top - box.to.top) - sy * (content.to.top - box.to.top)) / (local || 1)
    return { pair, path: pathTo(entering, pair.to), transform: `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})` }
  })
  const ghost = entering.cloneNode(true) as HTMLElement
  ghost.classList.add('is-ghost')
  ghost.setAttribute('aria-hidden', 'true')
  ghost.style.visibility = 'hidden'
  ghost.style.pointerEvents = 'none'
  entering.parentElement.insertBefore(ghost, entering.nextSibling)
  undo.push(() => ghost.remove())
  for (const move of moves) {
    const copy = move.path ? follow(ghost, move.path) : null
    if (!copy) continue
    for (const original of [move.pair.from, move.pair.to]) {
      const was = original.style.visibility
      original.style.visibility = 'hidden'
      undo.push(() => { original.style.visibility = was })
    }
    copy.style.visibility = 'visible'
    copy.style.transformOrigin = '0 0'
    const base = getComputedStyle(move.pair.to).transform
    const end = base && base !== 'none' ? base : 'none'
    animate(copy, [{ transform: end === 'none' ? move.transform : `${move.transform} ${end}` }, { transform: end }], MOTION_MS.move, EASE_OUT)
  }
}
