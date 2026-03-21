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
import { Copy, Check, Code, Eye } from 'lucide-react'
import { renderMermaid } from '../lib/mermaid'

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
  const uniqueId = useId()
  const diagramRef = useRef<HTMLDivElement>(null)

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

  // For mermaid blocks: show diagram or code
  if (isMermaid) {
    const showDiagram = !showCode && svgContent && !renderError

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
                <Eye size={14} />
                <span>Diagram</span>
              </>
            ) : (
              <>
                <Code size={14} />
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
                <Check size={14} />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span>Copy</span>
              </>
            )}
          </button>
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
            <Check size={14} />
            <span>Copied!</span>
          </>
        ) : (
          <>
            <Copy size={14} />
            <span>Copy</span>
          </>
        )}
      </button>
      <NodeViewContent as="code" />
    </NodeViewWrapper>
  )
}

export default CodeBlockWithCopy
