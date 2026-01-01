/**
 * CodeBlockWithCopy Component
 *
 * Custom React NodeView for TipTap code blocks that adds a copy button.
 * Shows "Copied!" text feedback after copying.
 *
 * @see Sprint 14: Block Interactions
 */

import { NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import { useState, useCallback } from 'react'
import { Copy, Check } from 'lucide-react'

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

  return (
    <NodeViewWrapper
      as="pre"
      className="tiptap-code-block"
      style={{ position: 'relative' }}
    >
      <button
        type="button"
        onClick={handleCopy}
        onMouseDown={(e) => e.preventDefault()} // Prevent editor focus loss
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
