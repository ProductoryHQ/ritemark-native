/**
 * Sprint 148, PR 4 (R9): a search result opens its document at the passage.
 *
 * The host sends `find:open { text, occurrence, page? }` (`src/search/findAtPassage.ts`); the Markdown editor, the
 * Word preview and the PDF preview open their find bar with `text` and land on that occurrence, as ⌘F and Enter
 * would. `text` is plain text: it only ever goes into the find bar's input and a literal `indexOf`, never into HTML,
 * a pattern or a URL. Nothing here reads or changes the document. Pure functions.
 */
import { normalizeQuery } from './textSearch'

export interface FindRequest {
  text: string
  occurrence: number
  /** PDF only: the passage's page, for when the occurrence isn't there. */
  page?: number
  /** A new id for each request, so the same words asked again land again. */
  id: number
}

export const MAX_FIND_TEXT = 200
const MAX_OCCURRENCE = 1_000_000
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/

/** The request in a host message, or null when the message isn't a well-formed `find:open`. */
export function decodeFindOpen(message: unknown, id: number): FindRequest | null {
  if (!message || typeof message !== 'object') return null
  const m = message as { type?: unknown; text?: unknown; occurrence?: unknown; page?: unknown }
  if (m.type !== 'find:open' || typeof m.text !== 'string') return null
  if (!m.text.trim() || m.text.length > MAX_FIND_TEXT || CONTROL.test(m.text)) return null
  const occurrence =
    typeof m.occurrence === 'number' && Number.isInteger(m.occurrence) && m.occurrence >= 0 && m.occurrence <= MAX_OCCURRENCE
      ? m.occurrence
      : 0
  const request: FindRequest = { text: m.text, occurrence, id }
  if (typeof m.page === 'number' && Number.isInteger(m.page) && m.page >= 1) request.page = m.page
  return request
}

/**
 * Which match to land on, once the find bar has `count` matches for the request's text: its occurrence, or the
 * last match when the document has fewer (the page's text and the index's can differ by a match). -1 for none.
 * `pageOf` (PDF): a match's page; an occurrence past the end then lands on the first match at or after `page`.
 */
export function landingIndex(request: FindRequest, count: number, pageOf?: (index: number) => number): number {
  if (count <= 0) return -1
  if (request.occurrence < count) return request.occurrence
  if (pageOf && request.page) {
    for (let i = 0; i < count; i++) if (pageOf(i) >= request.page) return i
  }
  return count - 1
}

/** Whether the find bar's query is still the request's (the person hasn't typed something else). */
export function isRequestQuery(request: FindRequest, query: string): boolean {
  return normalizeQuery(query) === normalizeQuery(request.text)
}
