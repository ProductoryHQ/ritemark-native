/**
 * CodeBlockWithCopy Component
 *
 * Custom React NodeView for TipTap code blocks that adds a copy button.
 * For mermaid code blocks, renders the diagram as SVG with a code/diagram toggle.
 *
 * @see Sprint 14: Block Interactions
 * @see Sprint 46: Mermaid Diagram Rendering
 */

import { NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import { useState, useCallback, useEffect, useId, useRef } from 'react'
import { Icon } from './ui/Icon'
import { renderMermaid, renderMermaidToPngDataUrl } from '../lib/mermaid'

type ImageActionStatus = 'idle' | 'busy' | 'success' | 'error'

const IMAGE_ACTION_RESET_MS = 2000
const DOWNLOAD_FILENAME = 'mermaid-diagram.png'
const EXPAND_ZOOM_MIN = 0.25
const EXPAND_ZOOM_MAX = 4
const EXPAND_ZOOM_WHEEL_FACTOR = 0.0015

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl)
  return response.blob()
}

function supportsImageClipboardWrite(): boolean {
  return typeof ClipboardItem !== 'undefined' && typeof navigator?.clipboard?.write === 'function'
}

interface CodeBlockWithCopyProps {
  node: {
    textContent: string
    attrs: {
      language?: string
    }
  }
}

export function CodeBlockWithCopy({ node }: CodeBlockWithCopyProps) {
  const [copied, setCopied] = useState(false)
  const isMermaid = node.attrs.language === 'mermaid'

  // Mermaid rendering state
  const [showCode, setShowCode] = useState(false)
  const [svgContent, setSvgContent] = useState<string | null>(null)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [copyImageStatus, setCopyImageStatus] = useState<ImageActionStatus>('idle')
  const [downloadStatus, setDownloadStatus] = useState<ImageActionStatus>('idle')
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandZoom, setExpandZoom] = useState(1)
  const uniqueId = useId()
  const diagramRef = useRef<HTMLDivElement>(null)
  const expandCanvasRef = useRef<HTMLDivElement>(null)
  const expandTriggerRef = useRef<HTMLButtonElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const expandZoomRef = useRef(1)

  // Render mermaid diagram when content changes
  useEffect(() => {
    if (!isMermaid) return
    if (!node.textContent.trim()) {
      setSvgContent(null)
      setRenderError(null)
      return
    }

    let cancelled = false
    // Clean ID for mermaid (no colons allowed)
    const cleanId = 'mermaid-' + uniqueId.replace(/:/g, '-')

    renderMermaid(cleanId, node.textContent)
      .then((svg) => {
        if (!cancelled) {
          setSvgContent(svg)
          setRenderError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSvgContent(null)
          setRenderError(err?.message || 'Failed to render diagram')
        }
      })

    return () => { cancelled = true }
  }, [node.textContent, isMermaid, uniqueId])

  const handleCopy = useCallback(async () => {
    const text = node.textContent
    if (!text) return

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy code:', err)
    }
  }, [node.textContent])

  const toggleView = useCallback(() => {
    setShowCode((prev) => !prev)
  }, [])

  const handleCopyImage = useCallback(async () => {
    if (!svgContent) return
    if (!supportsImageClipboardWrite()) {
      setCopyImageStatus('error')
      setTimeout(() => setCopyImageStatus('idle'), IMAGE_ACTION_RESET_MS)
      return
    }
    setCopyImageStatus('busy')
    try {
      const dataUrl = await renderMermaidToPngDataUrl(svgContent)
      const blob = await dataUrlToBlob(dataUrl)
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setCopyImageStatus('success')
    } catch (err) {
      console.error('Failed to copy mermaid image:', err)
      setCopyImageStatus('error')
    } finally {
      setTimeout(() => setCopyImageStatus('idle'), IMAGE_ACTION_RESET_MS)
    }
  }, [svgContent])

  const handleDownloadImage = useCallback(async () => {
    if (!svgContent) return
    setDownloadStatus('busy')
    try {
      const dataUrl = await renderMermaidToPngDataUrl(svgContent)
      const blob = await dataUrlToBlob(dataUrl)
      const objectUrl = URL.createObjectURL(blob)
      try {
        const anchor = document.createElement('a')
        anchor.href = objectUrl
        anchor.download = DOWNLOAD_FILENAME
        anchor.style.display = 'none'
        document.body.appendChild(anchor)
        anchor.click()
        document.body.removeChild(anchor)
      } finally {
        // Defer revoke so the browser has time to start the download.
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
      }
      setDownloadStatus('success')
    } catch (err) {
      console.error('Failed to download mermaid image:', err)
      setDownloadStatus('error')
    } finally {
      setTimeout(() => setDownloadStatus('idle'), IMAGE_ACTION_RESET_MS)
    }
  }, [svgContent])

  const openExpand = useCallback(() => {
    if (!svgContent) return
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null
    setExpandZoom(1)
    expandZoomRef.current = 1
    setIsExpanded(true)
  }, [svgContent])

  const closeExpand = useCallback(() => {
    setIsExpanded(false)
    setTimeout(() => {
      const target = previouslyFocusedRef.current ?? expandTriggerRef.current
      target?.focus?.()
    }, 0)
  }, [])

  const resetExpandZoom = useCallback(() => {
    setExpandZoom(1)
    expandZoomRef.current = 1
    const canvas = expandCanvasRef.current
    if (canvas) {
      canvas.scrollLeft = 0
      canvas.scrollTop = 0
    }
  }, [])

  // Keep wheel handler closure in sync with the latest zoom value.
  useEffect(() => {
    expandZoomRef.current = expandZoom
  }, [expandZoom])

  // Escape closes overlay, while overlay is mounted only.
  useEffect(() => {
    if (!isExpanded) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeExpand()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isExpanded, closeExpand])

  // Lock background scroll while overlay is open.
  useEffect(() => {
    if (!isExpanded) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isExpanded])

  // Cursor-anchored Cmd/Ctrl+Scroll zoom inside the overlay canvas.
  // React's onWheel is passive by default, so attach the native listener
  // ourselves with passive: false to be allowed to call preventDefault.
  useEffect(() => {
    if (!isExpanded) return
    const canvas = expandCanvasRef.current
    if (!canvas) return

    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()

      const oldZoom = expandZoomRef.current
      const factor = Math.exp(-e.deltaY * EXPAND_ZOOM_WHEEL_FACTOR)
      const newZoom = clamp(oldZoom * factor, EXPAND_ZOOM_MIN, EXPAND_ZOOM_MAX)
      if (newZoom === oldZoom) return

      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      const contentX = canvas.scrollLeft + mouseX
      const contentY = canvas.scrollTop + mouseY
      const ratio = newZoom / oldZoom
      const newScrollX = contentX * ratio - mouseX
      const newScrollY = contentY * ratio - mouseY

      expandZoomRef.current = newZoom
      setExpandZoom(newZoom)
      requestAnimationFrame(() => {
        canvas.scrollLeft = newScrollX
        canvas.scrollTop = newScrollY
      })
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [isExpanded])

  // For mermaid blocks: show diagram or code
  if (isMermaid) {
    const showDiagram = !showCode && svgContent && !renderError
    const hasRenderedDiagram = Boolean(svgContent) && !renderError
    const copyImageLabel =
      copyImageStatus === 'success'
        ? 'Copied!'
        : copyImageStatus === 'error'
        ? 'Copy failed'
        : copyImageStatus === 'busy'
        ? 'Copying…'
        : 'Copy image'
    const downloadLabel =
      downloadStatus === 'success'
        ? 'Downloaded'
        : downloadStatus === 'error'
        ? 'Download failed'
        : downloadStatus === 'busy'
        ? 'Saving…'
        : 'Download'

    return (
      <NodeViewWrapper
        as="pre"
        className={`tiptap-code-block mermaid-block ${showDiagram ? 'mermaid-block--diagram' : 'mermaid-block--code'}`}
        style={{ position: 'relative' }}
      >
        {/* Toolbar buttons */}
        <div className="mermaid-toolbar">
          <button
            type="button"
            onClick={toggleView}
            onMouseDown={(e) => e.preventDefault()}
            className="code-copy-btn mermaid-toggle-btn"
            title={showCode ? 'Show diagram' : 'Show code'}
            aria-label={showCode ? 'Show diagram' : 'Show code'}
          >
            {showCode ? (
              <>
                <Icon name="eye" size={14} />
                <span>Diagram</span>
              </>
            ) : (
              <>
                <Icon name="code" size={14} />
                <span>Code</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            onMouseDown={(e) => e.preventDefault()}
            className={`code-copy-btn ${copied ? 'copied' : ''}`}
            title={copied ? 'Copied!' : 'Copy code'}
            aria-label={copied ? 'Copied!' : 'Copy code'}
          >
            {copied ? (
              <>
                <Icon name="check" size={14} />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Icon name="copy" size={14} />
                <span>Copy</span>
              </>
            )}
          </button>
          {hasRenderedDiagram && (
            <>
              <button
                type="button"
                onClick={handleCopyImage}
                onMouseDown={(e) => e.preventDefault()}
                className={`code-copy-btn ${copyImageStatus === 'success' ? 'copied' : ''}`}
                disabled={copyImageStatus === 'busy'}
                title={copyImageLabel}
                aria-label={copyImageLabel}
              >
                {copyImageStatus === 'success' ? (
                  <>
                    <Icon name="check" size={14} />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Icon name="image" size={14} />
                    <span>{copyImageStatus === 'busy' ? 'Copying…' : 'Copy image'}</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleDownloadImage}
                onMouseDown={(e) => e.preventDefault()}
                className={`code-copy-btn ${downloadStatus === 'success' ? 'copied' : ''}`}
                disabled={downloadStatus === 'busy'}
                title={downloadLabel}
                aria-label={downloadLabel}
              >
                {downloadStatus === 'success' ? (
                  <>
                    <Icon name="check" size={14} />
                    <span>Downloaded</span>
                  </>
                ) : (
                  <>
                    <Icon name="download" size={14} />
                    <span>{downloadStatus === 'busy' ? 'Saving…' : 'Download'}</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={openExpand}
                onMouseDown={(e) => e.preventDefault()}
                ref={expandTriggerRef}
                className="code-copy-btn"
                title="Expand diagram"
                aria-label="Expand diagram"
              >
                <Icon name="arrows-out" size={14} />
                <span>Expand</span>
              </button>
            </>
          )}
        </div>

        {/* Rendered diagram */}
        {showDiagram && (
          <div
            ref={diagramRef}
            className="mermaid-rendered-diagram"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        )}

        {/* Error message */}
        {renderError && !showCode && (
          <div className="mermaid-error">
            <span>Diagram error: {renderError}</span>
          </div>
        )}

        {/* Code content - always in DOM, hidden via CSS when showing diagram */}
        <div
          style={showDiagram ? {
            position: 'absolute',
            height: 0,
            overflow: 'hidden',
            opacity: 0,
            pointerEvents: 'none',
          } : undefined}
        >
          <NodeViewContent as="code" />
        </div>

        {/* Expanded view overlay (Sprint 56) */}
        {isExpanded && svgContent && (
          <div
            className="mermaid-expand-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Expanded Mermaid diagram"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeExpand()
            }}
          >
            <div className="mermaid-expand-toolbar">
              <span className="mermaid-expand-zoom">
                {Math.round(expandZoom * 100)}%
              </span>
              <button
                type="button"
                onClick={resetExpandZoom}
                className="code-copy-btn mermaid-expand-btn"
                title="Reset zoom"
                aria-label="Reset zoom"
              >
                <Icon name="arrow-counter-clockwise" size={14} />
                <span>Reset</span>
              </button>
              <button
                type="button"
                onClick={closeExpand}
                className="code-copy-btn mermaid-expand-btn"
                title="Close (Esc)"
                aria-label="Close expanded view"
                autoFocus
              >
                <Icon name="x" size={14} />
                <span>Close</span>
              </button>
            </div>
            <div className="mermaid-expand-canvas" ref={expandCanvasRef}>
              <div
                className="mermaid-expand-stage"
                style={{
                  transform: `scale(${expandZoom})`,
                  transformOrigin: 'top left',
                }}
                dangerouslySetInnerHTML={{ __html: svgContent }}
              />
            </div>
            <div className="mermaid-expand-hint" aria-hidden="true">
              Cmd/Ctrl + Scroll to zoom · Scroll to pan · Esc to close
            </div>
          </div>
        )}
      </NodeViewWrapper>
    )
  }

  // Non-mermaid code blocks: original behavior
  return (
    <NodeViewWrapper
      as="pre"
      className="tiptap-code-block"
      style={{ position: 'relative' }}
    >
      <button
        type="button"
        onClick={handleCopy}
        onMouseDown={(e) => e.preventDefault()}
        className={`code-copy-btn ${copied ? 'copied' : ''}`}
        title={copied ? 'Copied!' : 'Copy code'}
        aria-label={copied ? 'Copied!' : 'Copy code'}
      >
        {copied ? (
          <>
            <Icon name="check" size={14} />
            <span>Copied!</span>
          </>
        ) : (
          <>
            <Icon name="copy" size={14} />
            <span>Copy</span>
          </>
        )}
      </button>
      <NodeViewContent as="code" />
    </NodeViewWrapper>
  )
}

export default CodeBlockWithCopy
