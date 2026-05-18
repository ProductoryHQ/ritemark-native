/**
 * PDF → Markdown heuristic converter.
 *
 * Best-effort conversion driven by PDF.js text content. PDFs are an imaging
 * format — headings, paragraphs, lists, and tables are not first-class — so
 * everything here is a heuristic that trades fidelity for predictability.
 *
 * Pipeline:
 *  1. For each page, fetch text items with positions via `page.getTextContent()`.
 *  2. Detect repeating top/bottom-of-page lines across pages (running headers /
 *     footers / page numbers) and strip them.
 *  3. Detect a multi-column layout per page and merge column-by-column.
 *  4. Cluster items into lines by Y position.
 *  5. Compute body-text font-size baseline, classify large lines as headings.
 *  6. Detect list markers (`•`, `-`, `*`, `1.` etc.) and emit list syntax.
 *  7. Merge soft-wrapped lines into paragraphs.
 *  8. Emit GFM markdown.
 *
 * Out of scope for v1:
 *  - Image extraction (PDF.js's `getOperatorList()` + objs cache is fragile;
 *    we surface a warning when the source contains rasters).
 *  - Table detection (no consistent column-grid analysis yet; tables become
 *    plain text with a warning).
 *  - OCR for scanned PDFs (no text layer → output is empty with a warning).
 */

import type { TextContent, TextItem, TextMarkedContent } from 'pdfjs-dist/types/src/display/api'

type AnyPdfjs = {
  getDocument: (src: { data: Uint8Array }) => { promise: Promise<PdfjsDocument> }
  GlobalWorkerOptions?: { workerSrc?: string }
}

interface PdfjsDocument {
  numPages: number
  getPage(n: number): Promise<PdfjsPage>
}

interface PdfjsPage {
  getViewport(opts: { scale: number }): { width: number; height: number }
  getTextContent(opts?: { disableNormalization?: boolean }): Promise<TextContent>
}

export interface PdfToMarkdownResult {
  markdown: string
  warnings: string[]
}

interface Line {
  text: string
  x: number
  y: number              // PDF coordinate (origin bottom-left), higher = further up the page
  height: number         // font height (rough proxy for font size)
  hasListMarker: boolean
}

const LIST_BULLET = /^[•◦‣⁃\-\*·]\s+/
const LIST_NUMBER = /^(\d{1,3})[.)]\s+/
const SCANNED_PDF_TEXT_THRESHOLD = 50  // total chars across all pages

export async function convertPdfToMarkdown(
  pdfjs: AnyPdfjs,
  pdfData: Uint8Array,
  options: { workerSrc?: string } = {}
): Promise<PdfToMarkdownResult> {
  if (options.workerSrc && pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = options.workerSrc
  }

  const warnings: string[] = []
  const loadingTask = pdfjs.getDocument({ data: pdfData.slice(0) })
  const doc = await loadingTask.promise

  // Phase 1: collect raw lines per page.
  const pages: Line[][] = []
  let totalChars = 0
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const items = filterTextItems(content.items)
    const lines = groupIntoLines(items)
    totalChars += lines.reduce((sum, l) => sum + l.text.length, 0)
    pages.push(lines)
  }

  // Scanned PDF: no text layer → bail early with a warning.
  if (totalChars < SCANNED_PDF_TEXT_THRESHOLD) {
    warnings.push(
      'This PDF appears to be scanned (no embedded text layer). OCR support is coming soon. The exported markdown will be mostly empty.'
    )
  }

  // Phase 2: strip running headers / footers (text that repeats verbatim in
  // the top or bottom of >= 3 pages). Removal is scoped to the same top/
  // bottom-most lines the detector inspected — a body-text heading like
  // "Chapter 3" that happens to normalize to a header pattern is never
  // touched mid-page.
  const skipPatterns = detectRepeatingMargins(pages)
  if (skipPatterns.size > 0) {
    for (const pageLines of pages) {
      if (pageLines.length === 0) continue
      const sortedByY = [...pageLines].sort((a, b) => b.y - a.y)
      const marginCandidates = [
        sortedByY[0],
        sortedByY[sortedByY.length - 1],
      ].filter((line, idx, arr) => line && (idx === 0 || line !== arr[0]))
      for (const candidate of marginCandidates) {
        const key = normalizePageNumber(candidate.text)
        if (!key || !skipPatterns.has(key)) continue
        const idx = pageLines.indexOf(candidate)
        if (idx >= 0) pageLines.splice(idx, 1)
      }
    }
  }

  // Phase 3: detect multi-column layout per page and re-order.
  let multiColumnPagesMerged = 0
  for (let i = 0; i < pages.length; i++) {
    const reordered = reorderMultiColumn(pages[i])
    if (reordered.didMerge) {
      multiColumnPagesMerged++
      pages[i] = reordered.lines
    }
  }
  if (multiColumnPagesMerged > 0) {
    warnings.push(
      `Detected a multi-column layout on ${multiColumnPagesMerged} page${multiColumnPagesMerged === 1 ? '' : 's'}. Merged into a single column — review for cross-column splicing.`
    )
  }

  // Phase 4: compute body-text height baseline across ALL pages so heading
  // detection is stable per-document, not per-page.
  const bodyHeight = inferBodyHeight(pages.flat())

  // Phase 5: emit markdown.
  const md: string[] = []
  let listMode: 'none' | 'bullet' | 'number' = 'none'
  let listCounter = 0
  let paragraphBuffer: string[] = []
  let lastWasHeading = false

  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      md.push(paragraphBuffer.join(' '))
      md.push('')
      paragraphBuffer = []
      listMode = 'none'
    }
  }

  const flushListBreak = () => {
    if (listMode !== 'none') {
      md.push('')
      listMode = 'none'
      listCounter = 0
    }
  }

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const pageLines = pages[pageIdx]

    for (let lineIdx = 0; lineIdx < pageLines.length; lineIdx++) {
      const line = pageLines[lineIdx]
      const text = line.text.trim()
      if (!text) continue

      const headingLevel = classifyHeading(line, bodyHeight)

      if (headingLevel) {
        flushParagraph()
        flushListBreak()
        // strip any leading list-marker prefix before emitting heading text
        const cleaned = text.replace(LIST_BULLET, '').replace(LIST_NUMBER, '')
        md.push('#'.repeat(headingLevel) + ' ' + cleaned)
        md.push('')
        lastWasHeading = true
        continue
      }

      // List detection.
      const bulletMatch = text.match(LIST_BULLET)
      const numberMatch = text.match(LIST_NUMBER)

      if (bulletMatch) {
        flushParagraph()
        if (listMode !== 'bullet') {
          if (listMode !== 'none') md.push('')
          listMode = 'bullet'
        }
        md.push('- ' + text.slice(bulletMatch[0].length))
        lastWasHeading = false
        continue
      }

      if (numberMatch) {
        flushParagraph()
        if (listMode !== 'number') {
          if (listMode !== 'none') md.push('')
          listMode = 'number'
          listCounter = 0
        }
        listCounter++
        md.push(`${listCounter}. ` + text.slice(numberMatch[0].length))
        lastWasHeading = false
        continue
      }

      // Paragraph soft-wrap: continue the current paragraph unless this line
      // looks like the start of a new one (large vertical gap from previous,
      // or this is the first line after a heading).
      const prevLine = lineIdx > 0 ? pageLines[lineIdx - 1] : null
      const verticalGap = prevLine ? Math.abs(prevLine.y - line.y) : 0
      const tightGap = verticalGap <= line.height * 1.6

      // List-item soft-wrap: a non-bullet line that sits close to the previous
      // line while a list is active is almost always a wrap of that last item
      // (long bullets routinely break onto a second line). Append to the
      // pending list entry rather than ending the list and re-emitting as a
      // separate paragraph.
      if (listMode !== 'none' && tightGap && !lastWasHeading) {
        const lastEmitted = md.pop() ?? ''
        md.push(`${lastEmitted} ${escapeMarkdownInline(text)}`)
        lastWasHeading = false
        continue
      }

      const newParagraph =
        lastWasHeading ||
        !tightGap ||
        listMode !== 'none'

      if (newParagraph) {
        flushParagraph()
        flushListBreak()
      }

      paragraphBuffer.push(escapeMarkdownInline(text))
      lastWasHeading = false
    }

    // Page boundary: flush in-flight paragraph but keep list continuation if
    // pdfs that wrap a list across pages.
    flushParagraph()
  }
  flushListBreak()

  return {
    markdown: md.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n',
    warnings,
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function filterTextItems(items: Array<TextItem | TextMarkedContent>): TextItem[] {
  return items.filter((it): it is TextItem => typeof (it as TextItem).str === 'string')
}

/**
 * Group glyphs that share a Y coordinate (within `epsilon`) into a single
 * line, sorted left-to-right.
 */
function groupIntoLines(items: TextItem[]): Line[] {
  if (items.length === 0) return []

  // Sort top-to-bottom (PDF Y origin is bottom-left → larger Y = higher up).
  const sorted = [...items].sort((a, b) => {
    const ay = a.transform[5]
    const by = b.transform[5]
    if (Math.abs(ay - by) > 2) return by - ay
    return a.transform[4] - b.transform[4]
  })

  const lines: Line[] = []
  let current: TextItem[] = []
  let currentY: number | null = null

  for (const item of sorted) {
    const y = item.transform[5]
    if (currentY === null || Math.abs(currentY - y) <= 2) {
      current.push(item)
      currentY = currentY === null ? y : (currentY + y) / 2
    } else {
      lines.push(materializeLine(current))
      current = [item]
      currentY = y
    }
  }
  if (current.length > 0) lines.push(materializeLine(current))

  return lines
}

function materializeLine(items: TextItem[]): Line {
  const sorted = [...items].sort((a, b) => a.transform[4] - b.transform[4])

  // Reassemble text, inserting a space when X gap exceeds half a glyph height.
  const parts: string[] = []
  let prevEnd: number | null = null
  let prevHeight = sorted[0]?.height ?? 12
  for (const it of sorted) {
    const x = it.transform[4]
    if (prevEnd !== null && x - prevEnd > prevHeight * 0.5 && !parts[parts.length - 1]?.endsWith(' ')) {
      parts.push(' ')
    }
    parts.push(it.str)
    prevEnd = x + it.width
    prevHeight = it.height || prevHeight
  }

  const text = parts.join('').replace(/\s+/g, ' ').trim()
  const x = sorted[0].transform[4]
  const y = sorted[0].transform[5]
  const height = Math.max(...sorted.map((it) => it.height || 0)) || 12
  const hasListMarker = LIST_BULLET.test(text) || LIST_NUMBER.test(text)

  return { text, x, y, height, hasListMarker }
}

/**
 * Find normalized lines that repeat across many pages near the top or bottom
 * of the page — these are running headers / footers / page numbers.
 */
function detectRepeatingMargins(pages: Line[][]): Set<string> {
  if (pages.length < 3) return new Set()

  const counts = new Map<string, number>()
  const total = pages.length
  for (const pageLines of pages) {
    if (pageLines.length === 0) continue
    const sortedByY = [...pageLines].sort((a, b) => b.y - a.y)
    const candidates = [
      sortedByY[0],                          // top-most line
      sortedByY[sortedByY.length - 1],       // bottom-most line
    ]
    const seenThisPage = new Set<string>()
    for (const line of candidates) {
      if (!line || !line.text) continue
      const key = normalizePageNumber(line.text)
      if (!key) continue  // line isn't page-number-like
      if (seenThisPage.has(key)) continue
      seenThisPage.add(key)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }

  const repeating = new Set<string>()
  for (const [key, n] of counts) {
    // Repeats in >=60% of pages → assume running header/footer.
    if (n / total >= 0.6) repeating.add(key)
  }
  return repeating
}

/**
 * Normalize a line for cross-page repetition matching.
 *
 * Only fires on lines that are *mostly* digits / common page-number tokens —
 * pure body-text headings like "Section 4 conclusions" must not collide with
 * each other just because of a shared bare digit. Returns the empty string for
 * lines that don't look like a page-number candidate.
 */
function normalizePageNumber(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''

  // Strip everything except letters, digits and one-letter separators so we
  // can decide whether the line is dominated by digits.
  const compact = trimmed.replace(/\s+/g, ' ')
  const digitCount = (compact.match(/\d/g) ?? []).length
  const letterCount = (compact.match(/\p{L}/gu) ?? []).length

  // A footer like "Page 7", "7 / 42", "— 7 —", "7" all qualify (≥1 digit and
  // either no letters or very few — capped at 8 to allow "Page", "Chapter").
  const looksLikePageNumber =
    digitCount > 0 && letterCount <= 8

  if (!looksLikePageNumber) return ''

  return compact.replace(/\b\d+\b/g, '\\d').toLowerCase()
}

/**
 * Detect a two-column layout by checking whether line X positions cluster into
 * two distinct bands with a wide gap. Returns the lines re-ordered left-column
 * first, then right-column.
 */
function reorderMultiColumn(lines: Line[]): { lines: Line[]; didMerge: boolean } {
  if (lines.length < 8) return { lines, didMerge: false }

  const xs = lines.map((l) => l.x).sort((a, b) => a - b)
  const minX = xs[0]
  const maxX = xs[xs.length - 1]
  const pageWidth = maxX - minX
  if (pageWidth < 200) return { lines, didMerge: false }

  // Look for a gap of at least 25% of the X range with no line starting in it.
  const midGapStart = minX + pageWidth * 0.4
  const midGapEnd = minX + pageWidth * 0.6
  const inGap = xs.filter((x) => x >= midGapStart && x <= midGapEnd).length
  const inGapRatio = inGap / xs.length
  if (inGapRatio > 0.05) return { lines, didMerge: false }

  // Threshold = midpoint between the highest left-column X and lowest right-
  // column X. Conservative: only consider as multi-column when both columns
  // have a meaningful number of lines (each >= 25%).
  const split = (minX + maxX) / 2
  const left = lines.filter((l) => l.x < split)
  const right = lines.filter((l) => l.x >= split)
  if (left.length / lines.length < 0.25 || right.length / lines.length < 0.25) {
    return { lines, didMerge: false }
  }

  // Stable sort each column top-to-bottom.
  left.sort((a, b) => b.y - a.y)
  right.sort((a, b) => b.y - a.y)

  return { lines: [...left, ...right], didMerge: true }
}

function inferBodyHeight(lines: Line[]): number {
  const heights = lines
    .map((l) => l.height)
    .filter((h) => h > 0)
    .sort((a, b) => a - b)
  if (heights.length === 0) return 12
  // Use the median rather than mean — headings would pull the mean up.
  return heights[Math.floor(heights.length / 2)]
}

/**
 * Heading classifier based on font-height delta vs body baseline.
 * Returns 0 = body, 1..3 = H1..H3.
 */
function classifyHeading(line: Line, bodyHeight: number): number {
  if (!line.text || line.text.length === 0) return 0
  if (bodyHeight <= 0) return 0
  const ratio = line.height / bodyHeight
  if (ratio >= 1.7) return 1
  if (ratio >= 1.35) return 2
  if (ratio >= 1.15) return 3
  return 0
}

/** Escape characters that would otherwise be interpreted as markdown syntax. */
function escapeMarkdownInline(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/([_*`])/g, '\\$1')
}
