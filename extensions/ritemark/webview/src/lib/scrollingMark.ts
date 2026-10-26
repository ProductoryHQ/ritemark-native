/**
 * Sprint 142 R8 (#504; audit A3): on the ground (the left column's places, `html.rm-ground`), a list's slider shows
 * while the pointer is on it, by CSS, and while it scrolls, by this mark: `data-scrolling` on the element that
 * scrolled, for a second after its last scroll. One passive listener for the page; nothing on a page off the ground.
 */

const SHOW_MS = 1000

export function watchScrollingMark(doc: Document = document): () => void {
  const timers = new Map<Element, ReturnType<typeof setTimeout>>()
  const onScroll = (event: Event) => {
    if (!doc.documentElement.classList.contains('rm-ground')) return
    const target = event.target === doc ? doc.documentElement : event.target
    if (!(target instanceof Element)) return
    target.setAttribute('data-scrolling', '')
    const previous = timers.get(target)
    if (previous) clearTimeout(previous)
    timers.set(target, setTimeout(() => {
      timers.delete(target)
      target.removeAttribute('data-scrolling')
    }, SHOW_MS))
  }
  doc.addEventListener('scroll', onScroll, { capture: true, passive: true })
  return () => {
    doc.removeEventListener('scroll', onScroll, { capture: true })
    timers.forEach((timer) => clearTimeout(timer))
    timers.clear()
  }
}
