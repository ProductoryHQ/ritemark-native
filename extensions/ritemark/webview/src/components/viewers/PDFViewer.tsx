import { useState, useEffect, useDeferredValue, useCallback, useRef, useMemo } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import './documentSearch.css'
import { sendToExtension } from '../../bridge'
import { convertPdfToMarkdown } from '../../conversion/pdfToMarkdown'
import { stripExt } from '../../utils/imageNaming'
import { matchCountLabel, normalizeQuery, stepMatch } from '../../utils/textSearch'
import { FindBarShell, type FindBarShellHandle } from '../FindBarShell'
import { buildMatchRange, isPageTextLayerRendered, scrollPageIntoView } from './pdfSearchDom'
import { buildPdfSearchIndex, findDocumentMatches, resolvePdfMatch, type PdfSearchIndex } from './pdfSearchIndex'
import { PageIndicator, ToolbarIconButton, ToolbarSpacer, ToolbarTextButton, ViewerToolbar, ZoomControls } from './ViewerToolbar'
import { fitPageZoom, fitWidthZoom, stepZoom, type FitMode } from './viewerLayout'

interface PDFViewerProps {
  content: string  // base64-encoded PDF
  filename: string
  workerSrc?: string
  canSaveAsMarkdown?: boolean
}

const SEARCH_HIGHLIGHT = 'ritemark-doc-search'
const CURRENT_HIGHLIGHT = 'ritemark-doc-search-current'
const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)

function highlightsSupported(): boolean {
  return typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined'
}

type PdfSearchStatus = 'idle' | 'loading' | 'scanned' | 'ready'

/** "3 of 12", "No matches", "This PDF has no searchable text", or '' — see FindBarShell. */
function searchStatusLabel(status: PdfSearchStatus, query: string, currentMatch: number, matchCount: number): string {
  if (status === 'scanned') return 'This PDF has no searchable text'
  if (status !== 'ready') return normalizeQuery(query) ? 'Searching…' : ''
  return matchCountLabel(currentMatch, matchCount, query)
}

/**
 * Lazy page wrapper — only renders the actual <Page> when within viewport margin.
 * Uses IntersectionObserver for reliable, layout-stable visibility detection.
 */
function LazyPage({
  pageNumber,
  scale,
  width,
  height,
  onFirstPageLoad,
  forceVisible,
  onTextLayerReady,
}: {
  pageNumber: number
  scale: number
  width: number
  height: number
  onFirstPageLoad?: (page: { width: number; height: number; originalWidth?: number; originalHeight?: number }) => void
  /** Issue #344: render this page now, bypassing the IntersectionObserver — a search match landed on it. */
  forceVisible?: boolean
  /** Issue #344: the page's TextLayer has spans in the DOM and can be searched. */
  onTextLayerReady?: (pageNumber: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  // A stable callback: react-pdf redraws the text layer when this prop changes,
  // and the parent re-renders on every text-layer render — an inline arrow here
  // redrew the layer in a loop and left search ranges pointing at removed spans.
  const handleTextLayerSuccess = useCallback(() => onTextLayerReady?.(pageNumber), [onTextLayerReady, pageNumber])

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Once loaded, keep rendered to avoid thrashing
        if (entry.isIntersecting) {
          setIsVisible(true)
        } else if (!hasLoaded) {
          setIsVisible(false)
        }
      },
      { rootMargin: '800px 0px' } // Pre-render pages 800px above/below viewport
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [hasLoaded])

  const scaledWidth = width * scale
  const scaledHeight = height * scale
  // Once rendered (by intersection or forced by a search match), keep it
  // rendered — matches the "avoid thrashing" intent of `hasLoaded` above;
  // without it, forcing a page while off-screen would draw it once and then
  // hide it again as soon as `forceVisible` clears.
  const shouldRender = isVisible || forceVisible || hasLoaded

  return (
    <div
      ref={ref}
      data-page-number={pageNumber}
      style={{
        width: scaledWidth,
        height: scaledHeight,
        margin: '0 auto 16px auto',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        border: '1px solid var(--r-hairline, #e0e0e0)',
        background: 'white',
        overflow: 'hidden',
      }}
    >
      {shouldRender ? (
        <Page
          pageNumber={pageNumber}
          scale={scale}
          renderTextLayer={true}
          renderAnnotationLayer={true}
          onLoadSuccess={(page) => {
            setHasLoaded(true)
            if (onFirstPageLoad) onFirstPageLoad(page)
          }}
          onRenderTextLayerSuccess={handleTextLayerSuccess}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ccc',
            fontSize: '13px',
          }}
        >
          {pageNumber}
        </div>
      )}
    </div>
  )
}

export function PDFViewer({ content, filename, workerSrc, canSaveAsMarkdown }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.0)
  const [fit, setFit] = useState<FitMode>(null)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null)
  const [pageWidth, setPageWidth] = useState<number>(595)  // A4 default
  const [pageHeight, setPageHeight] = useState<number>(842)
  const [isSavingMd, setIsSavingMd] = useState(false)
  const [saveToast, setSaveToast] = useState<{
    kind: 'success' | 'error'
    message: string
    warnings: string[]
  } | null>(null)

  // Issue #344: search. The doc proxy (for eager per-page getTextContent())
  // comes from Document's onLoadSuccess — the same parse react-pdf already
  // does, so search doesn't reopen the file.
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [searchIndex, setSearchIndex] = useState<PdfSearchIndex | null>(null)
  const [indexStatus, setIndexStatus] = useState<PdfSearchStatus>('idle')
  const indexRequestedRef = useRef(false)
  const [currentMatch, setCurrentMatch] = useState(-1)
  // Bumped every time a page's TextLayer renders. react-pdf redraws a text
  // layer on every scale change and when a page scrolls back in, replacing its
  // spans, so ranges built earlier point at detached nodes and paint nothing:
  // the ranges are rebuilt from the DOM on each bump.
  const [renderedVersion, setRenderedVersion] = useState(0)
  const [pinnedPage, setPinnedPage] = useState<number | null>(null)
  // Scroll to the current match only when a search starts or the user steps —
  // not every time a page renders while they scroll around.
  const revealMatch = useRef(false)
  const searchRef = useRef<FindBarShellHandle>(null)
  const currentPageRef = useRef(1)
  currentPageRef.current = currentPage

  const matches = useMemo(
    () => (searchIndex ? findDocumentMatches(searchIndex.chunks, deferredQuery) : []),
    [searchIndex, deferredQuery]
  )

  // Ranges for whichever matches sit on a page whose text layer is in the DOM
  // now; entries for matches on pages not drawn stay null until they are.
  const matchRanges = useMemo(() => {
    const container = containerRef.current
    if (!container || !searchIndex) return []
    return matches.map((match) => buildMatchRange(container, resolvePdfMatch(searchIndex, match)))
    // renderedVersion is not read here; it is a dependency purely to rebuild
    // the ranges after a text layer has been (re)drawn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, searchIndex, renderedVersion])

  // Configure PDF.js worker
  useEffect(() => {
    if (workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc
    }
  }, [workerSrc])

  // Listen for Save-as-Markdown result from extension host.
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data
      if (message.type === 'saveAsMarkdownResult') {
        setIsSavingMd(false)
        if (message.success) {
          setSaveToast({
            kind: 'success',
            message: `Saved ${message.filename}`,
            warnings: (message.warnings as string[]) ?? [],
          })
        } else if (message.error && message.error !== 'cancelled') {
          setSaveToast({
            kind: 'error',
            message: `Save failed: ${message.error}`,
            warnings: [],
          })
        }
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  // Auto-dismiss toast after 6s.
  useEffect(() => {
    if (!saveToast) return
    const timer = setTimeout(() => setSaveToast(null), 6000)
    return () => clearTimeout(timer)
  }, [saveToast])

  // Decode base64 content to Uint8Array
  useEffect(() => {
    if (!content) return
    try {
      const binaryString = atob(content)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      setPdfData(bytes)
      setError(null)
    } catch (e) {
      setError('Failed to decode PDF data')
    }
    // New (or reloaded) file: the old search index no longer applies.
    indexRequestedRef.current = false
    setSearchIndex(null)
    setIndexStatus('idle')
    setCurrentMatch(-1)
    setPinnedPage(null)
  }, [content])

  const onDocumentLoadSuccess = useCallback((pdf: PDFDocumentProxy) => {
    pdfDocRef.current = pdf
    setNumPages(pdf.numPages)
    setError(null)
  }, [])

  const onDocumentLoadError = useCallback((err: Error) => {
    setError(err.message || 'Failed to load PDF')
  }, [])

  // Memoize file data so Document doesn't re-load on every render
  const fileData = useMemo(() => {
    if (!pdfData) return null
    return { data: pdfData.slice(0) }
  }, [pdfData])

  // Capture first page dimensions, at 100 % (the callback fires again after
  // each zoom, with `width` already scaled).
  const onFirstPageLoad = useCallback((page: { width: number; height: number; originalWidth?: number; originalHeight?: number }) => {
    setPageWidth(page.originalWidth ?? page.width)
    setPageHeight(page.originalHeight ?? page.height)
  }, [])

  const handleSaveAsMarkdown = useCallback(async () => {
    if (isSavingMd || !pdfData) return
    setIsSavingMd(true)
    setSaveToast(null)

    try {
      const { markdown, warnings } = await convertPdfToMarkdown(
        pdfjs as unknown as Parameters<typeof convertPdfToMarkdown>[0],
        pdfData,
        workerSrc ? { workerSrc } : undefined
      )

      // Empty markdown + warnings means we already know the save will produce
      // nothing useful (e.g. scanned PDF). Surface it without bothering the
      // user with a Save As dialog.
      if (markdown.trim().length === 0 && warnings.length > 0) {
        setIsSavingMd(false)
        setSaveToast({ kind: 'error', message: 'Nothing to save', warnings })
        return
      }

      sendToExtension('saveAsMarkdown', {
        payload: {
          markdown,
          defaultFilename: `${stripExt(filename) || 'document'}.md`,
          source: 'pdf',
          images: [],          // PDF image extraction is a v2 feature (see WB-discovery risk #5)
          warnings,
        },
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setIsSavingMd(false)
      setSaveToast({ kind: 'error', message: `Conversion failed: ${msg}`, warnings: [] })
    }
  }, [content, filename, isSavingMd, pdfData, workerSrc])

  // Sprint 124 (#284): fit width / fit page follow the window until the user zooms by hand.
  useEffect(() => {
    const container = containerRef.current
    if (!fit || !container) return
    const apply = () => {
      const next = fit === 'width'
        ? fitWidthZoom(pageWidth, container.clientWidth)
        : fitPageZoom(pageWidth, pageHeight, container.clientWidth, container.clientHeight - 32)
      setScale((s) => (Math.abs(s - next) > 0.001 ? next : s))
    }
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(container)
    return () => observer.disconnect()
  }, [fit, pageWidth, pageHeight, pdfData])

  // Track current page from scroll position
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return
    const container = containerRef.current
    const scrollTop = container.scrollTop
    const slotHeight = (pageHeight * scale) + 16
    const page = Math.floor(scrollTop / slotHeight) + 1
    setCurrentPage(Math.max(1, Math.min(page, numPages)))
  }, [pageHeight, scale, numPages])

  // Issue #344: a page's TextLayer just (re)rendered — rebuild the ranges.
  const onTextLayerReady = useCallback(() => {
    setRenderedVersion((v) => v + 1)
  }, [])

  // Build the search index once, the first time the find bar opens — every
  // page's text, eagerly, independent of what's been rendered (react-pdf
  // draws lazily). Save-as-Markdown does the equivalent fetch separately
  // (conversion/pdfToMarkdown.ts); this reuses the already-parsed document
  // instead of reopening the file.
  const ensureSearchIndex = useCallback(() => {
    const doc = pdfDocRef.current
    if (!doc || indexRequestedRef.current) return
    indexRequestedRef.current = true
    setIndexStatus('loading')
    void buildPdfSearchIndex(doc)
      .then((index) => {
        setSearchIndex(index)
        setIndexStatus(index.scanned ? 'scanned' : 'ready')
      })
      .catch(() => {
        indexRequestedRef.current = false
        setIndexStatus('idle')
      })
  }, [])

  const openSearch = useCallback(() => {
    setSearchOpen(true)
    ensureSearchIndex()
    searchRef.current?.focus()
  }, [ensureSearchIndex])
  const closeSearch = useCallback(() => {
    setSearchOpen(false)
    setQuery('')
    containerRef.current?.focus()
  }, [])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        openSearch()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [openSearch])

  // Pick the first match at or after the page the reader is on.
  useEffect(() => {
    if (!searchIndex || matches.length === 0) {
      setCurrentMatch(-1)
      return
    }
    const startPage = currentPageRef.current
    const first = matches.findIndex((m) => searchIndex.locations[m.start.chunk].page >= startPage)
    setCurrentMatch(Math.max(0, first))
    revealMatch.current = true
  }, [matches, searchIndex])

  const stepSearch = useCallback((direction: 1 | -1) => {
    revealMatch.current = true
    setCurrentMatch((c) => stepMatch(c, matches.length, direction))
  }, [matches.length])

  // Bring the current match's page into view — rendering it first (via
  // pinnedPage) if it hasn't been drawn yet — when a search starts or the user
  // steps. Re-runs once that render completes (matchRanges is rebuilt with
  // renderedVersion); once the match is in view it leaves the scroll alone.
  useEffect(() => {
    if (!revealMatch.current || !searchIndex || currentMatch < 0) return
    const match = matches[currentMatch]
    const container = containerRef.current
    if (!match || !container) return
    const targetPage = searchIndex.locations[match.start.chunk].page
    if (!isPageTextLayerRendered(container, targetPage)) {
      setPinnedPage(targetPage)
      return
    }
    const range = matchRanges[currentMatch]
    if (!range) return
    revealMatch.current = false
    scrollPageIntoView(container, targetPage)
    const rect = range.getBoundingClientRect()
    const view = container.getBoundingClientRect()
    if (rect.width > 0 || rect.height > 0) {
      container.scrollTop += rect.top - (view.top + view.height / 2)
    }
  }, [currentMatch, matches, searchIndex, matchRanges])

  // Highlight every match whose page has rendered; the current one gets its
  // own highlight layered on top — same CSS Custom Highlight API pattern as
  // the Word preview (DOCXViewer.tsx).
  useEffect(() => {
    if (!highlightsSupported()) return
    const valid = matchRanges.filter((r): r is Range => r !== null)
    if (valid.length) CSS.highlights.set(SEARCH_HIGHLIGHT, new Highlight(...valid))
    else CSS.highlights.delete(SEARCH_HIGHLIGHT)
    const current = matchRanges[currentMatch]
    if (current) CSS.highlights.set(CURRENT_HIGHLIGHT, new Highlight(current))
    else CSS.highlights.delete(CURRENT_HIGHLIGHT)
  }, [matchRanges, currentMatch])

  useEffect(
    () => () => {
      if (!highlightsSupported()) return
      CSS.highlights.delete(SEARCH_HIGHLIGHT)
      CSS.highlights.delete(CURRENT_HIGHLIGHT)
    },
    []
  )

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem' }}>
        <div style={{ fontSize: '1.2rem', color: 'var(--r-error, #f44)' }}>Failed to load PDF</div>
        <div style={{ color: 'var(--r-ink-muted, #888)' }}>{error}</div>
      </div>
    )
  }

  if (!pdfData) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ color: 'var(--r-ink-muted, #888)' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div className="bg-surface" style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <ViewerToolbar>
        <PageIndicator current={currentPage - 1} total={numPages} />
        <ZoomControls
          zoom={scale}
          fit={fit}
          onStep={(d) => {
            setFit(null)
            setScale((s) => stepZoom(s, d))
          }}
          onFit={setFit}
          onSet={(s) => {
            setFit(null)
            setScale(s)
          }}
        />
        <ToolbarSpacer />
        <ToolbarIconButton
          icon="magnifying-glass"
          label="Find in document"
          tooltip={`Find in document (${isMac ? 'Cmd' : 'Ctrl'}+F)`}
          pressed={searchOpen}
          onClick={searchOpen ? closeSearch : openSearch}
        />
        {canSaveAsMarkdown && (
          <ToolbarTextButton
            icon="file-text"
            label={isSavingMd ? 'Converting…' : 'Save as Markdown'}
            tooltip={isSavingMd ? 'Converting the PDF to Markdown' : 'Save the PDF as a Markdown file (a best-effort conversion)'}
            disabled={isSavingMd || !pdfData}
            onClick={handleSaveAsMarkdown}
          />
        )}
      </ViewerToolbar>

      {/* PDF Content; the find bar floats over its top. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        {searchOpen && (
          <FindBarShell
            ref={searchRef}
            query={query}
            onQueryChange={setQuery}
            countLabel={searchStatusLabel(indexStatus, deferredQuery, currentMatch, matches.length)}
            hasMatches={indexStatus === 'ready' && matches.length > 0}
            onNext={() => stepSearch(1)}
            onPrevious={() => stepSearch(-1)}
            onClose={closeSearch}
          />
        )}
        <div
          ref={containerRef}
          tabIndex={-1}
          onScroll={handleScroll}
          style={{ flex: 1, overflow: 'auto', padding: '16px 0' }}
        >
          <Document
            file={fileData}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div style={{ padding: '2rem', color: 'var(--r-ink-muted, #888)' }}>
                Loading PDF...
              </div>
            }
          >
            {Array.from({ length: numPages }, (_, i) => (
              <LazyPage
                key={i}
                pageNumber={i + 1}
                scale={scale}
                width={pageWidth}
                height={pageHeight}
                onFirstPageLoad={i === 0 ? onFirstPageLoad : undefined}
                forceVisible={pinnedPage === i + 1}
                onTextLayerReady={onTextLayerReady}
              />
            ))}
          </Document>
        </div>
      </div>

      {/* Save-as-Markdown toast */}
      {saveToast && (
        <div
          role="status"
          style={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            maxWidth: 420,
            padding: '10px 14px',
            borderRadius: 6,
            background: saveToast.kind === 'success'
              ? 'var(--vscode-editorInfo-background, #1f2937)'
              : 'var(--vscode-editorError-background, #5b1f1f)',
            color: 'var(--vscode-editor-foreground, #f5f5f5)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            fontSize: 12,
            lineHeight: 1.4,
            zIndex: 10,
          }}
        >
          <div style={{ fontWeight: 600 }}>{saveToast.message}</div>
          {saveToast.warnings.length > 0 && (
            <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
              {saveToast.warnings.map((w, i) => (
                <li key={i} style={{ color: 'var(--r-ink-muted, #c9c9c9)' }}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
