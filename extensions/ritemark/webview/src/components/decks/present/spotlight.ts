/**
 * Decks README items 11 and 16 (17 November): the spotlight on one thing, and a picture that fills the wall, in Present
 * only. The editor, the strip, the handout and the page never dim: only the wall and the presenter view's Now call
 * `useSpotlight`.
 *
 * An item is a box, a step, a list item, a column, a picture or a table, on a block slide (every v1 kind draws as one).
 * It is named by its place among the slide's items (`spotItems`, in the order they are drawn; a side picture on the
 * left comes first and one on the right last). A picture behind the words is the slide's ground, never an item, and
 * never dims. The title (the flow's first H1, else its first heading) never dims either.
 *
 * The spotlit item stays as it is and the rest of the slide dims to 30 % in 0.2 s (`.is-spot-dim`, decks.css); at
 * once with reduced motion. Nothing grows or moves. Only siblings on the way up from the item dim, so nothing is dimmed
 * twice and the item's own blocks keep their look.
 */
import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react'
import { blankNow, settleAsked } from './wallKeys'

export interface SpotRect {
  left: number
  top: number
  right: number
  bottom: number
}

/** The item under a point: the smallest one holding it (a list item in a box, a picture in a column), or null. */
export function itemAt(rects: readonly SpotRect[], x: number, y: number): number | null {
  let found: number | null = null
  let area = Infinity
  rects.forEach((rect, index) => {
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return
    const size = Math.max(0, rect.right - rect.left) * Math.max(0, rect.bottom - rect.top)
    // A later item of the same size is drawn inside the earlier one (the order is the document's).
    if (size <= area) { found = index; area = size }
  })
  return found
}

/** The flow's own pieces that are items, in the order they are drawn. */
const FLOW_ITEMS = '.blk-box, .blk-column, li, table, .blk-pic'

function isFlowItem(element: Element): boolean {
  if (!element.classList.contains('blk-pic')) return true
  // An empty picture place, the picture inside its frame (the frame is the item), a small picture in a line of words.
  if (element.classList.contains('empty')) return false
  return !element.parentElement?.closest('.blk-pic, p')
}

/** The slide's canvas in a view: the one `.deck-sl` of a block slide, or null (a slide of an unknown kind). */
function slideIn(root: ParentNode | null): HTMLElement | null {
  return root?.querySelector<HTMLElement>('.deck-sl.is-blocks') ?? null
}

/** The slide's items, in order (`root` holds one drawn slide). */
export function spotItems(root: ParentNode | null): HTMLElement[] {
  const slide = slideIn(root)
  if (!slide) return []
  const flow = slide.querySelector('.blk-flow')
  const items = flow ? Array.from(flow.querySelectorAll<HTMLElement>(FLOW_ITEMS)).filter(isFlowItem) : []
  const photo = Array.from(slide.children).find(child => child.classList.contains('photo') && !child.classList.contains('empty')) as HTMLElement | undefined
  if (photo && !slide.classList.contains('pic-behind')) {
    if (slide.classList.contains('pic-right')) items.push(photo)
    else items.unshift(photo)
  }
  return items
}

export function isPictureItem(element: Element): boolean {
  return element.classList.contains('blk-pic') || element.classList.contains('photo')
}

/** The slide's title in its flow: the first H1 among the flow's own blocks, else its first heading. */
function titleOf(flow: Element | null): Element | null {
  if (!flow) return null
  const blocks = Array.from(flow.children)
  return blocks.find(block => block.tagName === 'H1') ?? blocks.find(block => /^H[1-6]$/.test(block.tagName)) ?? null
}

/** What dims while `item` is spotlit: every sibling on the way up to the slide, but the title and the ground. */
export function spotDimmed(item: HTMLElement): HTMLElement[] {
  const slide = item.closest<HTMLElement>('.deck-sl')
  if (!slide) return []
  const title = titleOf(slide.querySelector('.blk-flow'))
  const behind = slide.classList.contains('pic-behind')
  const dimmed: HTMLElement[] = []
  // A block that holds the title (the flow, beside a side picture that is spotlit) dims all but the title.
  const dim = (element: HTMLElement) => {
    if (title && element.contains(title)) {
      for (const child of Array.from(element.children) as HTMLElement[]) if (child !== title) dim(child)
    } else dimmed.push(element)
  }
  let node: HTMLElement = item
  while (node !== slide && node.parentElement) {
    const parent: HTMLElement = node.parentElement
    for (const sibling of Array.from(parent.children) as HTMLElement[]) {
      if (sibling === node || sibling === title || sibling.classList.contains('veil')) continue
      if (behind && sibling.classList.contains('photo')) continue
      dim(sibling)
    }
    node = parent
  }
  return dimmed
}

/**
 * The item a click hit in a view's drawn slide, and whether it is a picture that can fill the wall (one drawn, with its
 * address); null outside any item.
 */
export function spotHit(root: ParentNode | null, x: number, y: number): { item: number; picture: boolean } | null {
  const items = spotItems(root)
  const index = itemAt(items.map(item => item.getBoundingClientRect()), x, y)
  return index === null ? null : { item: index, picture: pictureUrlOf(items[index]) !== null }
}

/** A picture item's address as the slide draws it (its `<img>`, or a side picture's background), or null. */
export function pictureUrlOf(item: HTMLElement | undefined): string | null {
  if (!item || !isPictureItem(item)) return null
  const image = item.tagName === 'IMG' ? item : item.querySelector('img')
  if (image) return image.getAttribute('src')
  const match = /url\(\s*(["']?)(.*?)\1\s*\)/.exec(item.style.backgroundImage)
  return match ? match[2] : null
}

/** The address of the picture at `fill` in the drawn slide, or null when it is not a picture there. */
export function fillUrlIn(root: ParentNode | null, fill: number | null): string | null {
  return fill === null ? null : pictureUrlOf(spotItems(root)[fill])
}

/**
 * Dims the slide drawn in `container` (the one `scope` finds) around the item at `spot`, and keeps it dimmed when the
 * slide draws again (its fit, a font that loads): the classes are put back after every change to the drawn markup.
 */
export function useSpotlight(container: RefObject<HTMLElement | null>, scope: string, spot: number | null): void {
  useLayoutEffect(() => {
    const root = container.current
    if (!root) return
    const clear = () => { for (const element of Array.from(root.querySelectorAll('.is-spot-dim'))) element.classList.remove('is-spot-dim') }
    clear()
    // No spotlight: nothing to keep, so nothing watches the slide draw.
    if (spot === null) return
    const apply = () => {
      clear()
      const item = spotItems(root.querySelector(scope))[spot]
      if (!item) return
      for (const element of spotDimmed(item)) element.classList.add('is-spot-dim')
    }
    apply()
    // Only markup changes: the classes set here are attribute changes, so this never calls itself.
    const observer = new MutationObserver(records => { if (records.some(record => record.type === 'childList')) apply() })
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [container, scope, spot])
}

/**
 * The spotlight and the filled wall this window last asked for, until the host's state carries them (`blankNow`), the
 * same in the wall and the presenter view. A move clears both on the host, so a window lets its asks go when it sends
 * one (`letGo`) and when the host's state is of another slide.
 */
export function useFocusAsks() {
  const askedSpot = useRef<{ to: number | null } | null>(null)
  const askedFill = useRef<{ to: number | null } | null>(null)
  const letGo = useCallback(() => { askedSpot.current = null; askedFill.current = null }, [])
  const askSpot = useCallback((item: number | null, send: (type: string, data: Record<string, unknown>) => void) => {
    askedSpot.current = { to: item }
    askedFill.current = { to: null }
    send('present/spot', { item })
  }, [])
  const askFill = useCallback((item: number | null, send: (type: string, data: Record<string, unknown>) => void) => {
    askedFill.current = { to: item }
    send('present/fill', { item })
  }, [])
  /** A state from the host: an ask it carries is settled; on another slide, every ask is let go. */
  const settle = useCallback((host: { spot: number | null; fill: number | null }, sameSlide: boolean) => {
    if (!sameSlide) { askedSpot.current = null; askedFill.current = null; return }
    askedSpot.current = settleAsked(askedSpot.current, host.spot)
    askedFill.current = settleAsked(askedFill.current, host.fill)
  }, [])
  const spotNow = useCallback((hostSpot: number | null) => blankNow(hostSpot, askedSpot.current), [])
  /** The filled wall now: an ask still waiting, else the host's, only while the picture is shown (`shown`). */
  const fillNow = useCallback((hostFill: number | null, shown: boolean) => (askedFill.current ? askedFill.current.to : shown ? hostFill : null), [])
  return { letGo, askSpot, askFill, settle, spotNow, fillNow }
}
