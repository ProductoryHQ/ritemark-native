import { useState, useEffect, useCallback, useRef } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

interface PDFViewerProps {
  content: string  // base64-encoded PDF
  filename: string
  workerSrc?: string
}

export function PDFViewer({ content, filename, workerSrc }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null)

  // Configure PDF.js worker
  useEffect(() => {
    if (workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc
    }
  }, [workerSrc])

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
    setLoading(false)
    setError(null)
  }, [])

  const onDocumentLoadError = useCallback((err: Error) => {
    setError(err.message || 'Failed to load PDF')
    setLoading(false)
  }, [])

  // Track current page based on scroll position
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return
    const container = containerRef.current
    const pages = container.querySelectorAll('.react-pdf__Page')

    let closestPage = 1
    let closestDistance = Infinity

    pages.forEach((page, index) => {
      const rect = page.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      const distance = Math.abs(rect.top - containerRect.top)
      if (distance < closestDistance) {
        closestDistance = distance
        closestPage = index + 1
      }
    })

    setCurrentPage(closestPage)
  }, [])

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem' }}>
        <div style={{ fontSize: '1.2rem', color: 'var(--vscode-errorForeground, #f44)' }}>Failed to load PDF</div>
        <div style={{ color: 'var(--vscode-descriptionForeground, #888)' }}>{error}</div>
      </div>
    )
  }

  if (!pdfData) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ color: 'var(--vscode-descriptionForeground, #888)' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        borderBottom: '1px solid var(--vscode-panel-border, #e0e0e0)',
        gap: '8px',
        flexShrink: 0
      }}>
        <span style={{ color: 'var(--vscode-descriptionForeground, #888)', fontSize: '13px' }}>{filename}</span>
        <div style={{ flex: 1 }} />

        {/* Page navigation */}
        <span style={{ fontSize: '13px', color: 'var(--vscode-descriptionForeground, #888)' }}>
          {currentPage} / {numPages || '...'}
        </span>

        {/* Zoom controls */}
        <button
          onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', color: 'var(--vscode-foreground)' }}
          title="Zoom out"
        >
          -
        </button>
        <span style={{ fontSize: '12px', minWidth: '40px', textAlign: 'center' }}>
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => setScale(s => Math.min(3, s + 0.25))}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', color: 'var(--vscode-foreground)' }}
          title="Zoom in"
        >
          +
        </button>
      </div>

      {/* PDF Content - continuous scroll */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '1rem 0'
        }}
      >
        <Document
          file={{ data: pdfData }}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={
            <div style={{ padding: '2rem', color: 'var(--vscode-descriptionForeground, #888)' }}>
              Loading PDF...
            </div>
          }
        >
          {Array.from(new Array(numPages), (_, index) => (
            <div
              key={`page_${index + 1}`}
              style={{
                marginBottom: '1rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                border: '1px solid var(--vscode-panel-border, #e0e0e0)'
              }}
            >
              <Page
                pageNumber={index + 1}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
            </div>
          ))}
        </Document>
      </div>
    </div>
  )
}
