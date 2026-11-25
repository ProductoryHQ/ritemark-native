type Control = { element: HTMLElement | null; axis?: 'x' | 'y' }

/** Reveal the new bar position after the editor has rendered the added row or column. */
export function revealTableAddBar(bar: HTMLElement): void {
  bar.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

/** Keep table controls anchored to the visible part of their own geometry. */
export function watchTableAddBars(
  table: HTMLTableElement,
  frame: HTMLElement,
  controls: () => Control[],
): { update: () => void; stop: () => void } {
  const win = table.ownerDocument.defaultView!
  const viewport = table.ownerDocument.documentElement
  const clips: { node: HTMLElement; x: boolean; y: boolean }[] = []
  for (let node: HTMLElement | null = frame; node && node !== viewport; node = node.parentElement) {
    const style = win.getComputedStyle(node)
    const x = style.overflowX !== 'visible'
    const y = style.overflowY !== 'visible'
    if (x || y) clips.push({ node, x, y })
  }

  const update = () => {
    let left = 0
    let top = 0
    let right = viewport.clientWidth
    let bottom = viewport.clientHeight
    for (const { node, x, y } of clips) {
      const rect = node.getBoundingClientRect()
      const scaleX = node.offsetWidth ? rect.width / node.offsetWidth : 1
      const scaleY = node.offsetHeight ? rect.height / node.offsetHeight : 1
      const clipLeft = rect.left + node.clientLeft * scaleX
      const clipTop = rect.top + node.clientTop * scaleY
      if (x) {
        left = Math.max(left, clipLeft)
        right = Math.min(right, clipLeft + node.clientWidth * scaleX)
      }
      if (y) {
        top = Math.max(top, clipTop)
        bottom = Math.min(bottom, clipTop + node.clientHeight * scaleY)
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
  return { update, stop }
}
