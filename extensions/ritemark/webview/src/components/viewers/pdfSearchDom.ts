/**
 * Issue #344 — the DOM half of PDF search: turning a resolved match location
 * into the actual `Range` PDF.js drew, once that page's TextLayer exists.
 *
 * Each rendered page is `LazyPage`'s wrapper div, tagged `data-page-number`;
 * inside it, react-pdf's `<Page>` draws `.react-pdf__Page__textContent` (its
 * `textLayer`), where PDF.js appends one `span[role="presentation"]` per
 * non-empty text item, in the same order `page.getTextContent()` returns
 * them — `[role="presentation"]` alone would also match the `<br>` PDF.js
 * inserts after a line's last item, so the `span` qualifier matters.
 */
import type { ResolvedPdfMatch } from './pdfSearchIndex'

function pageTextSpans(container: HTMLElement, page: number): HTMLElement[] | null {
  const pageEl = container.querySelector<HTMLElement>(
    `[data-page-number="${page}"] .react-pdf__Page__textContent`
  )
  if (!pageEl) return null
  return Array.from(pageEl.querySelectorAll<HTMLElement>('span[role="presentation"]'))
}

/** True once the given page's text layer has spans to search against. */
export function isPageTextLayerRendered(container: HTMLElement, page: number): boolean {
  return pageTextSpans(container, page) !== null
}

/** Builds the `Range` for a match, or null if its page isn't rendered (yet). */
export function buildMatchRange(container: HTMLElement, match: ResolvedPdfMatch): Range | null {
  const startSpans = pageTextSpans(container, match.start.page)
  const endSpans = match.start.page === match.end.page ? startSpans : pageTextSpans(container, match.end.page)
  const startNode = startSpans?.[match.start.itemIndex]?.firstChild
  const endNode = endSpans?.[match.end.itemIndex]?.firstChild
  if (!startNode || !endNode) return null
  try {
    const range = document.createRange()
    range.setStart(startNode, match.start.offset)
    range.setEnd(endNode, match.end.offset)
    return range
  } catch {
    // Offsets out of range for the current DOM (e.g. a stale index mid-reload).
    return null
  }
}

/** Scrolls the page's wrapper into view within the scroller. */
export function scrollPageIntoView(scroller: HTMLElement, page: number): void {
  const pageEl = scroller.querySelector<HTMLElement>(`[data-page-number="${page}"]`)
  if (!pageEl) return
  scroller.scrollTop += pageEl.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 16
}
