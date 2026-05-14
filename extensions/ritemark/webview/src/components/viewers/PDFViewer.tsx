import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { sendToExtension } from '../../bridge'
import { convertPdfToMarkdown } from '../../conversion/pdfToMarkdown'
import { sanitizeImageBaseName } from '../../utils/imageNaming'

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
  onFirstPageLoad?: (page: { width: number; height: number }) => void
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

function stripExt(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

export function PDFViewer({ content, filename, workerSrc, canSaveAsMarkdown }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.0)
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

  // Capture first page dimensions
  const onFirstPageLoad = useCallback((page: { width: number; height: number }) => {
    setPageWidth(page.width)
    setPageHeight(page.height)
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

      const sourceBasename = sanitizeImageBaseName(stripExt(filename)) || 'document'

      sendToExtension('saveAsMarkdown', {
        payload: {
          markdown,
          defaultFilename: `${stripExt(filename) || 'document'}.md`,
          source: 'pdf',
          images: [],          // PDF image extraction is a v2 feature (see WB-discovery risk #5)
          warnings,
          sourceBasename,
        },
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setIsSavingMd(false)
      setSaveToast({ kind: 'error', message: `Conversion failed: ${msg}`, warnings: [] })
    }
  }, [content, filename, isSavingMd, pdfData, workerSrc])

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {/* Toolbar */}
      <div style={{
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        borderBottom: '1px solid var(--r-hairline, #e0e0e0)',
        gap: '8px',
        flexShrink: 0
      }}>
        <span style={{ color: 'var(--r-ink-muted, #888)', fontSize: '13px' }}>{filename}</span>
        <div style={{ flex: 1 }} />

        <span style={{ fontSize: '13px', color: 'var(--r-ink-muted, #888)' }}>
          {currentPage} / {numPages || '...'}
        </span>

        <button
          onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', color: 'var(--r-ink-strong)' }}
          title="Zoom out"
        >
          -
        </button>
        <span style={{ fontSize: '12px', minWidth: '40px', textAlign: 'center' }}>
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => setScale(s => Math.min(3, s + 0.25))}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', color: 'var(--r-ink-strong)' }}
          title="Zoom in"
        >
          +
        </button>

        {canSaveAsMarkdown && (
          <button
            onClick={handleSaveAsMarkdown}
            disabled={isSavingMd || !pdfData}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: isSavingMd || !pdfData ? 'default' : 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              color: 'var(--r-ink-strong)',
              fontSize: '12px',
              opacity: isSavingMd || !pdfData ? 0.5 : 1,
              marginLeft: 4,
            }}
            title="Save the PDF as a Markdown file (best-effort heuristic conversion)"
          >
            {isSavingMd ? 'Converting…' : 'Save as Markdown'}
          </button>
        )}
      </div>

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
