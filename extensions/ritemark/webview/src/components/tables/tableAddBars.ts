type Axis = 'x' | 'y'
type Control = { element: HTMLElement | null; axis?: Axis }

function scrollport(node: HTMLElement) {
  const rect = node.getBoundingClientRect()
  const scaleX = (node.offsetWidth && rect.width / node.offsetWidth) || 1
  const scaleY = (node.offsetHeight && rect.height / node.offsetHeight) || 1
  const left = rect.left + node.clientLeft * scaleX
  const top = rect.top + node.clientTop * scaleY
  return { left, top, right: left + node.clientWidth * scaleX, bottom: top + node.clientHeight * scaleY, scaleX, scaleY }
}

/** Keep table controls anchored to the visible part of their own geometry. */
export function watchTableAddBars(
  table: HTMLTableElement,
  frame: HTMLElement,
  controls: () => Control[],
): { reveal: (element: HTMLElement, axis: Axis) => void; update: () => void; stop: () => void } {
  const win = table.ownerDocument.defaultView!
  const viewport = table.ownerDocument.documentElement
  const clips: { node: HTMLElement; x: string; y: string }[] = []
  for (let node: HTMLElement | null = frame; node && node !== viewport; node = node.parentElement) {
    const { overflowX: x, overflowY: y } = win.getComputedStyle(node)
    if (x !== 'visible' || y !== 'visible') clips.push({ node, x, y })
  }

  // Work outward so each scroll container sees the bar's position after the inner container moves.
  const reveal = (element: HTMLElement, axis: Axis) => {
    const scrollAxis = axis === 'x' ? 'scrollLeft' : 'scrollTop'
    const start = axis === 'x' ? 'left' : 'top'
    const end = axis === 'x' ? 'right' : 'bottom'
    const scroll = (node: Element, min: number, max: number, scale: number) => {
      const rect = element.getBoundingClientRect()
      const delta = rect[start] < min ? rect[start] - min : Math.max(0, rect[end] - max)
      if (delta) node[scrollAxis] += delta / scale
    }
    for (const clip of clips) {
      if (clip[axis] !== 'auto' && clip[axis] !== 'scroll' && clip[axis] !== 'overlay') continue
      const port = scrollport(clip.node)
      scroll(clip.node, port[start], port[end], axis === 'x' ? port.scaleX : port.scaleY)
    }
    const root = table.ownerDocument.scrollingElement
    if (root) scroll(root, 0, axis === 'x' ? viewport.clientWidth : viewport.clientHeight, 1)
  }

  const update = () => {
    let left = 0
    let top = 0
    let right = viewport.clientWidth
    let bottom = viewport.clientHeight
    for (const { node, x, y } of clips) {
      const port = scrollport(node)
      if (x !== 'visible') {
        left = Math.max(left, port.left)
        right = Math.min(right, port.right)
      }
      if (y !== 'visible') {
        top = Math.max(top, port.top)
        bottom = Math.min(bottom, port.bottom)
      }
    }

    // A long bar can extend along the edge, but its thickness must fit in the clip.
    for (const { element, axis } of controls()) {
      if (!element) continue
      const rect = element.getBoundingClientRect()
      const fitsX = axis === 'y' || (rect.left >= left - 1 && rect.right <= right + 1)
      const fitsY = axis === 'x' || (rect.top >= top - 1 && rect.bottom <= bottom + 1)
      const intersects = rect.right > left && rect.left < right && rect.bottom > top && rect.top < bottom
      element.style.visibility = right > left && bottom > top && intersects && fitsX && fitsY ? '' : 'hidden'
    }
  }

  // The controls move with the table as it scrolls. Only their visibility needs an update.
  win.addEventListener('scroll', update, { capture: true, passive: true })
  win.addEventListener('resize', update)
  const observer = new ResizeObserver(update)
  observer.observe(table)
  for (const { node } of clips) observer.observe(node)
  update()
  const stop = () => {
    win.removeEventListener('scroll', update, { capture: true })
    win.removeEventListener('resize', update)
    observer.disconnect()
  }
  return { reveal, update, stop }
}
