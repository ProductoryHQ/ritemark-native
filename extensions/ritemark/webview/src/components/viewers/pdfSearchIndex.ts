/**
 * Issue #344 — search over a PDF, including pages the viewer hasn't rendered
 * yet (it renders lazily; see `LazyPage` in `PDFViewer.tsx`).
 *
 * `page.getTextContent()` is fetched for every page up front (the same call
 * `conversion/pdfToMarkdown.ts` uses for Save-as-Markdown), independent of
 * what react-pdf has drawn. Each non-empty text item becomes one `TextChunk`
 * — the same shape `documentSearch.ts` already matches against for the Word
 * preview — with a page boundary as a block boundary, so a match can never
 * span two pages. `findDocumentMatches` is reused as-is; only the plumbing
 * that turns a match back into an on-page location is new.
 *
 * A match's chunk index maps 1:1 to a `PdfMatchLocation`, which in turn maps
 * to the Nth `span[role="presentation"]` PDF.js's TextLayer renders for that
 * page — but only once the page has actually been rendered. Locating that
 * span (and reading the render itself) is `PDFViewer.tsx`'s job; this module
 * stays pure and DOM-free, like `documentSearch.ts`.
 */
import type { TextContent, TextItem, TextMarkedContent } from 'pdfjs-dist/types/src/display/api'
import { findDocumentMatches, type DocumentMatch, type TextChunk } from './documentSearch'
import { SCANNED_PDF_TEXT_THRESHOLD } from '../../conversion/pdfToMarkdown'

export interface PdfMatchLocation {
  /** 1-based, matching react-pdf's `pageNumber`. */
  page: number
  /**
   * Index among the page's non-empty text items, in document order — the
   * same order PDF.js's TextLayer appends `span[role="presentation"]`
   * elements (it skips items whose `str` is empty, so this index must too).
   */
  itemIndex: number
}

export interface PdfSearchIndex {
  chunks: TextChunk[]
  locations: PdfMatchLocation[]
  /** No (or almost no) extractable text across the whole document — likely a scanned PDF. */
  scanned: boolean
}

interface MinimalPdfPage {
  getTextContent(): Promise<TextContent>
}

interface MinimalPdfDocument {
  numPages: number
  getPage(pageNumber: number): Promise<MinimalPdfPage>
}

function isTextItem(item: TextItem | TextMarkedContent): item is TextItem {
  return typeof (item as TextItem).str === 'string'
}

/** Fetches every page's text content and builds the flat, searchable index. */
export async function buildPdfSearchIndex(doc: MinimalPdfDocument): Promise<PdfSearchIndex> {
  const chunks: TextChunk[] = []
  const locations: PdfMatchLocation[] = []
  let totalChars = 0

  for (let page = 1; page <= doc.numPages; page++) {
    const pdfPage = await doc.getPage(page)
    const content = await pdfPage.getTextContent()
    let itemIndex = 0
    let startOfPage = true
    for (const item of content.items) {
      if (!isTextItem(item) || item.str.length === 0) continue
      chunks.push({ text: item.str, newBlock: startOfPage })
      locations.push({ page, itemIndex })
      startOfPage = false
      itemIndex++
      totalChars += item.str.length
    }
  }

  return { chunks, locations, scanned: totalChars < SCANNED_PDF_TEXT_THRESHOLD }
}

export interface ResolvedPdfMatch {
  start: PdfMatchLocation & { offset: number }
  end: PdfMatchLocation & { offset: number }
}

/** Resolves a `DocumentMatch` (chunk/offset pairs) to page-relative locations. */
export function resolvePdfMatch(index: PdfSearchIndex, match: DocumentMatch): ResolvedPdfMatch {
  const start = index.locations[match.start.chunk]
  const end = index.locations[match.end.chunk]
  return {
    start: { ...start, offset: match.start.offset },
    end: { ...end, offset: match.end.offset },
  }
}

export { findDocumentMatches }
