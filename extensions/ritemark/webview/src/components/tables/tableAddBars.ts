/** Keep the add bars hidden until their actual table edges enter the visible area. */
export function watchTableAddBars(
  table: HTMLTableElement,
  frame: HTMLElement,
  row: HTMLElement,
  column: HTMLElement,
): () => void {
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

    const edge = table.getBoundingClientRect()
    const visible = right > left && bottom > top
    row.style.visibility = visible && edge.bottom > top && edge.bottom <= bottom && edge.left < right && edge.right > left
      ? 'visible' : 'hidden'
    column.style.visibility = visible && edge.right > left && edge.right <= right && edge.top < bottom && edge.bottom > top
      ? 'visible' : 'hidden'
  }

  // The bars move with the table as it scrolls. Only their visibility needs an update.
  win.addEventListener('scroll', update, { capture: true, passive: true })
  win.addEventListener('resize', update)
  const observer = new ResizeObserver(update)
  observer.observe(table)
  for (const { node } of clips) observer.observe(node)
  update()
  return () => {
    win.removeEventListener('scroll', update, { capture: true })
    win.removeEventListener('resize', update)
    observer.disconnect()
  }
}
