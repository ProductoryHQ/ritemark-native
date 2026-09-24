import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { sendToExtension } from '../../bridge'
import { convertPdfToMarkdown } from '../../conversion/pdfToMarkdown'
import { stripExt } from '../../utils/imageNaming'
import { PageIndicator, ToolbarSpacer, ToolbarTextButton, ViewerToolbar, ZoomControls } from './ViewerToolbar'
import { fitPageZoom, fitWidthZoom, stepZoom, type FitMode } from './viewerLayout'

interface PDFViewerProps {
  content: string  // base64-encoded PDF
  filename: string
  workerSrc?: string
  canSaveAsMarkdown?: boolean
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
}: {
  pageNumber: number
  scale: number
  width: number
  height: number
  onFirstPageLoad?: (page: { width: number; height: number; originalWidth?: number; originalHeight?: number }) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

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

  return (
    <div
      ref={ref}
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
      {isVisible ? (
        <Page
          pageNumber={pageNumber}
          scale={scale}
          renderTextLayer={true}
          renderAnnotationLayer={true}
          onLoadSuccess={(page) => {
            setHasLoaded(true)
            if (onFirstPageLoad) onFirstPageLoad(page)
          }}
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
  }, [content])

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
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

      {/* PDF Content */}
      <div
        ref={containerRef}
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
            />
          ))}
        </Document>
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
