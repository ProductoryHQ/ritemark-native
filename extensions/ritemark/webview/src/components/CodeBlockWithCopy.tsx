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
import { createPortal } from 'react-dom'
import { Icon } from './ui/Icon'
import { renderMermaid, renderMermaidToPngDataUrl } from '../lib/mermaid'
import { sendToExtension } from '../bridge'

type ImageActionStatus = 'idle' | 'busy' | 'success' | 'error'

const IMAGE_ACTION_RESET_MS = 2000
const DOWNLOAD_FILENAME = 'mermaid-diagram.png'
const EXPAND_ZOOM_MIN = 0.25
const EXPAND_ZOOM_MAX = 4
const EXPAND_ZOOM_WHEEL_FACTOR = 0.0015

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function dataUrlToBlob(dataUrl: string): Blob {
  // VS Code webview CSP default-src 'none' blocks fetch(dataUrl) — manual
  // base64 decode + Uint8Array keeps the conversion synchronous and avoids
  // the connect-src restriction.
  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex < 0) {
    throw new Error('Invalid data URL')
  }
  const header = dataUrl.slice(0, commaIndex)
  const payload = dataUrl.slice(commaIndex + 1)
  const mimeMatch = header.match(/^data:([^;]+)/)
  const mime = mimeMatch?.[1] ?? 'application/octet-stream'
  const isBase64 = /;base64/i.test(header)
  const binary = isBase64 ? atob(payload) : decodeURIComponent(payload)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mime })
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

  const handleCopy = useCallback(() => {
    const text = node.textContent
    if (!text) return
    sendToExtension('copyToClipboard', { text })
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
      // Delegate to extension host — same pattern as exportWord/exportPDF.
      // Extension uses vscode.window.showSaveDialog + fs.writeFile.
      // Browser showSaveFilePicker is blocked in cross-origin sub-frames.
      sendToExtension('mermaid:downloadImage', {
        dataUrl,
        filename: DOWNLOAD_FILENAME,
      })
      setDownloadStatus('idle')
    } catch (err) {
      console.error('Failed to prepare mermaid image for download:', err)
      setDownloadStatus('error')
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

  const zoomBy = useCallback((factor: number) => {
    const canvas = expandCanvasRef.current
    const oldZoom = expandZoomRef.current
    const newZoom = clamp(oldZoom * factor, EXPAND_ZOOM_MIN, EXPAND_ZOOM_MAX)
    if (newZoom === oldZoom) return

    let newScrollX = 0
    let newScrollY = 0
    if (canvas) {
      const rect = canvas.getBoundingClientRect()
      const centerX = rect.width / 2
      const centerY = rect.height / 2
      const contentX = canvas.scrollLeft + centerX
      const contentY = canvas.scrollTop + centerY
      const ratio = newZoom / oldZoom
      newScrollX = contentX * ratio - centerX
      newScrollY = contentY * ratio - centerY
    }

    expandZoomRef.current = newZoom
    setExpandZoom(newZoom)
    if (canvas) {
      requestAnimationFrame(() => {
        canvas.scrollLeft = newScrollX
        canvas.scrollTop = newScrollY
      })
    }
  }, [])

  const zoomIn = useCallback(() => zoomBy(1.25), [zoomBy])
  const zoomOut = useCallback(() => zoomBy(1 / 1.25), [zoomBy])

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
            className="code-copy-btn mermaid-toggle-btn"
            data-tooltip={showCode ? 'Show diagram' : 'Show code'}
            aria-label={showCode ? 'Show diagram' : 'Show code'}
          >
            <Icon name={showCode ? 'eye' : 'code'} size={16} />
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className={`code-copy-btn ${copied ? 'copied' : ''}`}
            data-tooltip={copied ? 'Copied!' : 'Copy code'}
            aria-label={copied ? 'Copied!' : 'Copy code'}
          >
            <Icon name={copied ? 'check' : 'copy'} size={16} />
          </button>
          {hasRenderedDiagram && (
            <>
              <button
                type="button"
                onClick={handleCopyImage}
                className={`code-copy-btn ${copyImageStatus === 'success' ? 'copied' : ''}`}
                disabled={copyImageStatus === 'busy'}
                data-tooltip={copyImageLabel}
                aria-label={copyImageLabel}
              >
                <Icon name={copyImageStatus === 'success' ? 'check' : 'image'} size={16} />
              </button>
              <button
                type="button"
                onClick={handleDownloadImage}
                disabled={downloadStatus === 'busy'}
                className={`code-copy-btn ${downloadStatus === 'success' ? 'copied' : ''}`}
                data-tooltip={downloadLabel}
                aria-label={downloadLabel}
              >
                <Icon name={downloadStatus === 'success' ? 'check' : 'download'} size={16} />
              </button>
              <button
                type="button"
                onClick={openExpand}
                ref={expandTriggerRef}
                className="code-copy-btn"
                data-tooltip="Expand diagram"
                aria-label="Expand diagram"
              >
                <Icon name="arrows-out" size={16} />
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

        {/* Expanded view overlay (Sprint 56) — rendered via Portal to document.body
            so position: fixed anchors to the viewport, not a transformed ancestor
            inside ProseMirror/TipTap. */}
        {isExpanded && svgContent && createPortal(
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
              <div className="mermaid-expand-toolbar__group mermaid-expand-toolbar__zoom-group">
                <span className="mermaid-expand-zoom" aria-live="polite">
                  {Math.round(expandZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={zoomOut}
                  disabled={showCode || expandZoom <= EXPAND_ZOOM_MIN}
                  className="code-copy-btn mermaid-expand-btn"
                  data-tooltip="Zoom out"
                  aria-label="Zoom out"
                >
                  <Icon name="minus" size={16} />
                </button>
                <button
                  type="button"
                  onClick={zoomIn}
                  disabled={showCode || expandZoom >= EXPAND_ZOOM_MAX}
                  className="code-copy-btn mermaid-expand-btn"
                  data-tooltip="Zoom in"
                  aria-label="Zoom in"
                >
                  <Icon name="plus" size={16} />
                </button>
                <button
                  type="button"
                  onClick={resetExpandZoom}
                  disabled={showCode || expandZoom === 1}
                  className="code-copy-btn mermaid-expand-btn"
                  data-tooltip="Reset zoom"
                  aria-label="Reset zoom"
                >
                  <Icon name="arrow-counter-clockwise" size={16} />
                </button>
              </div>
              <div className="mermaid-expand-toolbar__divider" aria-hidden="true" />
              <div className="mermaid-expand-toolbar__group mermaid-expand-toolbar__actions-group">
                <button
                  type="button"
                  onClick={toggleView}
                  className="code-copy-btn mermaid-expand-btn"
                  data-tooltip={showCode ? 'Show diagram' : 'Show code'}
                  aria-label={showCode ? 'Show diagram' : 'Show code'}
                >
                  <Icon name={showCode ? 'eye' : 'code'} size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`code-copy-btn mermaid-expand-btn ${copied ? 'copied' : ''}`}
                  data-tooltip={copied ? 'Copied!' : 'Copy code'}
                  aria-label={copied ? 'Copied!' : 'Copy code'}
                >
                  <Icon name={copied ? 'check' : 'copy'} size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleCopyImage}
                  disabled={copyImageStatus === 'busy'}
                  className={`code-copy-btn mermaid-expand-btn ${copyImageStatus === 'success' ? 'copied' : ''}`}
                  data-tooltip={copyImageLabel}
                  aria-label={copyImageLabel}
                >
                  <Icon name={copyImageStatus === 'success' ? 'check' : 'image'} size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleDownloadImage}
                  disabled={downloadStatus === 'busy'}
                  className={`code-copy-btn mermaid-expand-btn ${downloadStatus === 'success' ? 'copied' : ''}`}
                  data-tooltip={downloadLabel}
                  aria-label={downloadLabel}
                >
                  <Icon name={downloadStatus === 'success' ? 'check' : 'download'} size={16} />
                </button>
              </div>
              <div className="mermaid-expand-toolbar__divider" aria-hidden="true" />
              <button
                type="button"
                onClick={closeExpand}
                className="code-copy-btn mermaid-expand-btn mermaid-expand-toolbar__close"
                data-tooltip="Close (Esc)"
                aria-label="Close expanded view"
                autoFocus
              >
                <Icon name="x" size={16} />
              </button>
            </div>
            <div className="mermaid-expand-canvas" ref={expandCanvasRef}>
              {showCode ? (
                <pre className="mermaid-expand-code-view">
                  <code>{node.textContent}</code>
                </pre>
              ) : (
                <div
                  className="mermaid-expand-stage"
                  style={{
                    transform: `scale(${expandZoom})`,
                    transformOrigin: 'top left',
                  }}
                  dangerouslySetInnerHTML={{ __html: svgContent }}
                />
              )}
            </div>
            {!showCode && (
              <div className="mermaid-expand-hint" aria-hidden="true">
                Cmd/Ctrl + Scroll to zoom · Scroll to pan · Esc to close
              </div>
            )}
          </div>,
          document.body
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
        data-tooltip={copied ? 'Copied!' : 'Copy code'}
        aria-label={copied ? 'Copied!' : 'Copy code'}
      >
        <Icon name={copied ? 'check' : 'copy'} size={16} />
      </button>
      <NodeViewContent as="code" />
    </NodeViewWrapper>
  )
}

export default CodeBlockWithCopy
