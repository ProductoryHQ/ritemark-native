/**
 * Sprint 142 R8 (#504; audit A3): on the ground (the left column's places, `html.rm-ground`), a list's slider shows
 * while the pointer is on it, by CSS, and while it scrolls, by this mark: `data-scrolling` on the element that
 * scrolled, for a second after its last scroll. One passive listener for the page; nothing on a page off the ground.
 *
 * 2.1.0's join pass (the Experience lead's ruling 7): Ritemark Settings on the desk shows its slider the same way.
 * Its scrolling element (`#root[data-editor-type="settings"]`, index.css) takes the scrolling mark, and
 * `data-pointer` while the pointer is on the page: its slider is drawn (::-webkit-scrollbar), and Chromium does not
 * restyle a drawn scrollbar when only the scroller's :hover changes, while an attribute's change does.
 */

const SHOW_MS = 1000
const MARKED = 'html.rm-ground, html.rm-ground *, #root[data-editor-type="settings"]'
const POINTER_MARKED = '#root[data-editor-type="settings"]'

export function watchScrollingMark(doc: Document = document): () => void {
  const timers = new Map<Element, ReturnType<typeof setTimeout>>()
  const onScroll = (event: Event) => {
    const target = event.target === doc ? doc.documentElement : event.target
    if (!(target instanceof Element) || !target.matches(MARKED)) return
    target.setAttribute('data-scrolling', '')
    const previous = timers.get(target)
    if (previous) clearTimeout(previous)
    timers.set(target, setTimeout(() => {
      timers.delete(target)
      target.removeAttribute('data-scrolling')
    }, SHOW_MS))
  }
  const onPointer = (event: Event) => {
    const page = doc.querySelector(POINTER_MARKED)
    if (!page) return
    if (event.type === 'mouseleave') page.removeAttribute('data-pointer')
    else if (!page.hasAttribute('data-pointer')) page.setAttribute('data-pointer', '')
  }
  doc.addEventListener('scroll', onScroll, { capture: true, passive: true })
  doc.addEventListener('mouseover', onPointer, { passive: true })
  doc.documentElement.addEventListener('mouseleave', onPointer, { passive: true })
  return () => {
    doc.removeEventListener('scroll', onScroll, { capture: true })
    doc.removeEventListener('mouseover', onPointer)
    doc.documentElement.removeEventListener('mouseleave', onPointer)
    timers.forEach((timer) => clearTimeout(timer))
    timers.clear()
  }
}
