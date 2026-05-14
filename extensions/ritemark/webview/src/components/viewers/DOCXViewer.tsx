import { useState, useEffect, useCallback, useRef } from 'react'
import { renderAsync } from 'docx-preview'
import mammoth from 'mammoth'
import { sendToExtension } from '../../bridge'
import { createTurndownService } from '../../utils/turndownService'
import { buildExtractedImageFilename, mimeToExt } from '../../utils/imageNaming'

interface DOCXViewerProps {
  content: string  // base64-encoded DOCX
  filename: string
  canSaveAsMarkdown?: boolean
}

interface ExtractedImage {
  filename: string
  contentType: string
  base64: string
}

function decodeBase64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

function stripExt(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

export function DOCXViewer({ content, filename, canSaveAsMarkdown }: DOCXViewerProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasWord, setHasWord] = useState(false)
  const [isSavingMd, setIsSavingMd] = useState(false)
  const [saveToast, setSaveToast] = useState<{
    kind: 'success' | 'error'
    message: string
    warnings: string[]
  } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const styleRef = useRef<HTMLDivElement>(null)

  // Listen for Word status + Save-as-Markdown result from extension
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data
      if (message.type === 'wordStatus') {
        setHasWord(message.hasWord)
      } else if (message.type === 'saveAsMarkdownResult') {
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

  // Render DOCX when content changes
  useEffect(() => {
    if (!content || !containerRef.current) return

    const renderDocx = async () => {
      setLoading(true)
      setError(null)

      try {
        const bytes = decodeBase64ToBytes(content)

        if (containerRef.current) {
          containerRef.current.innerHTML = ''
        }

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

  const handleSaveAsMarkdown = useCallback(async () => {
    if (isSavingMd) return
    setIsSavingMd(true)
    setSaveToast(null)

    try {
      const bytes = decodeBase64ToBytes(content)
      const sourceBasename = stripExt(filename) || 'document'
      const images: ExtractedImage[] = []

      const result = await mammoth.convertToHtml(
        { arrayBuffer: bytes.buffer as ArrayBuffer },
        {
          convertImage: mammoth.images.imgElement(async (image) => {
            const base64 = await image.readAsBase64String()
            const ext = mimeToExt(image.contentType)
            const imgFilename = buildExtractedImageFilename(
              sourceBasename,
              images.length + 1,
              ext
            )
            images.push({ filename: imgFilename, contentType: image.contentType, base64 })
            const relPath = `./images/${imgFilename}`
            // src + title=relative path so the shared turndown image rule (in
            // utils/turndownService) emits ./images/... in the final markdown
            // rather than the DOM-resolved absolute URL.
            return { src: relPath, title: relPath }
          }),
        }
      )

      const html = result.value
      const warnings = result.messages
        .filter((m) => m.type === 'warning')
        .map((m) => m.message)

      const turndownService = createTurndownService()
      // Match Editor's image-href semantics: an <img title="./..."> turns into
      // ![alt](./...) so the markdown points at the on-disk file instead of
      // whatever the DOM resolved src to.
      turndownService.addRule('saveAsMarkdownImage', {
        filter: 'img',
        replacement: (_content, node) => {
          const el = node as HTMLImageElement
          const alt = el.alt || ''
          const title = el.getAttribute('title') || ''
          const src = title.startsWith('./') ? title : el.getAttribute('src') || el.src
          return `![${alt}](${src})`
        },
      })

      const markdown = turndownService.turndown(html)

      sendToExtension('saveAsMarkdown', {
        payload: {
          markdown,
          defaultFilename: `${sourceBasename}.md`,
          source: 'docx',
          images,
          warnings,
        },
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setIsSavingMd(false)
      setSaveToast({ kind: 'error', message: `Conversion failed: ${msg}`, warnings: [] })
    }
  }, [content, filename, isSavingMd])

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
        <span style={{ color: 'var(--r-ink-muted, #888)', fontSize: '13px' }}>
          {filename}
        </span>
        <div style={{ flex: 1 }} />

        {canSaveAsMarkdown && (
          <button
            onClick={handleSaveAsMarkdown}
            disabled={isSavingMd || loading || !!error}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: isSavingMd || loading || error ? 'default' : 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              color: 'var(--r-ink-strong)',
              fontSize: '12px',
              opacity: isSavingMd || loading || error ? 0.5 : 1
            }}
            title="Save the document as a Markdown file with images extracted to ./images/"
          >
            {isSavingMd ? 'Converting…' : 'Save as Markdown'}
          </button>
        )}

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
