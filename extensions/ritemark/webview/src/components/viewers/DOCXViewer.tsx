import { useState, useEffect, useCallback, useRef } from 'react'
import { renderAsync } from 'docx-preview'
import { sendToExtension } from '../../bridge'

interface DOCXViewerProps {
  content: string  // base64-encoded DOCX
  filename: string
  canSaveAsMarkdown?: boolean
}

export function DOCXViewer({ content, filename, canSaveAsMarkdown: _canSaveAsMarkdown }: DOCXViewerProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasWord, setHasWord] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const styleRef = useRef<HTMLDivElement>(null)

  // Listen for Word status from extension
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data
      if (message.type === 'wordStatus') {
        setHasWord(message.hasWord)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  // Render DOCX when content changes
  useEffect(() => {
    if (!content || !containerRef.current) return

    const renderDocx = async () => {
      setLoading(true)
      setError(null)

      try {
        // Decode base64 to ArrayBuffer
        const binaryString = atob(content)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }

        // Clear previous content
        if (containerRef.current) {
          containerRef.current.innerHTML = ''
        }

        // Render with docx-preview
        await renderAsync(bytes.buffer, containerRef.current!, styleRef.current!, {
          useBase64URL: true,        // Required: VS Code webview restricts blob: URLs
          inWrapper: true,           // Wrap content in a container
          ignoreWidth: false,        // Preserve document width
          ignoreHeight: false,       // Preserve document height
          ignoreFonts: false,        // Preserve fonts
          breakPages: true,          // Show page breaks
        })

        setLoading(false)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        setError(msg)
        setLoading(false)
      }
    }

    renderDocx()
  }, [content])

  const handleRefresh = useCallback(() => {
    sendToExtension('refresh')
  }, [])

  const handleOpenInWord = useCallback(() => {
    sendToExtension('openInExternalApp', { app: 'word' })
  }, [])

  // Check if this is a .doc file (not supported)
  const isDocFormat = filename.toLowerCase().endsWith('.doc') && !filename.toLowerCase().endsWith('.docx')

  if (isDocFormat) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem' }}>
        <div style={{ fontSize: '1.2rem', color: 'var(--r-error, #f44)' }}>
          Unsupported format
        </div>
        <div style={{ color: 'var(--r-ink-muted, #888)', textAlign: 'center', maxWidth: '400px' }}>
          The legacy .doc format is not supported. Please convert to .docx format using Microsoft Word or another word processor.
        </div>
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
        borderBottom: '1px solid var(--r-hairline, #e0e0e0)',
        gap: '8px',
        flexShrink: 0
      }}>
        <span style={{ color: 'var(--r-ink-muted, #888)', fontSize: '13px' }}>
          {filename}
        </span>
        <div style={{ flex: 1 }} />

        {hasWord && (
          <button
            onClick={handleOpenInWord}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              color: 'var(--r-ink-strong)',
              fontSize: '12px'
            }}
            title="Open in Microsoft Word"
          >
            Open in Word
          </button>
        )}

        <button
          onClick={handleRefresh}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: '6px',
            color: 'var(--r-ink-strong)',
            fontSize: '12px'
          }}
          title="Refresh"
        >
          ↻
        </button>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          color: 'var(--r-ink-muted, #888)'
        }}>
          Loading {filename}...
        </div>
      )}

      {/* Error state */}
      {error && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: '1rem'
        }}>
          <div style={{ fontSize: '1.2rem', color: 'var(--r-error, #f44)' }}>
            Failed to load document
          </div>
          <div style={{ color: 'var(--r-ink-muted, #888)' }}>{error}</div>
          <button
            onClick={handleRefresh}
            style={{
              background: 'var(--r-accent, #4338ca)',
              color: 'var(--vscode-button-foreground, #fff)',
              border: 'none',
              padding: '6px 16px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      )}

      {/* Style container for docx-preview generated styles */}
      <div ref={styleRef} style={{ display: 'none' }} />

      {/* Document content container */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: 'auto',
          display: loading || error ? 'none' : 'block',
        }}
      />
    </div>
  )
}
