/**
 * Word preview (.docx), read-only.
 *
 * Sprint 124 (#284): pages you can move through, zoom, fit and search, drawn
 * closer to Word — docx-preview 0.4.1 on a package prepared by `prepareDocx`
 * (Word's page markers where the document has them, page numbers per page,
 * broken embedded font faces dropped) with Office-only fonts aliased. It says
 * what it cannot show, and always offers to open the file elsewhere.
 * Evidence: docs/development/releases/v1.12.0/sprint-124-word-preview-fidelity/.
 */
import { useCallback, useDeferredValue, useEffect, useRef, useState, type ReactNode } from 'react'
import { renderAsync } from 'docx-preview'
import mammoth from 'mammoth'
import { sendToExtension } from '../../bridge'
import { createTurndownService } from '../../utils/turndownService'
import { buildExtractedImageFilename, mimeToExt, stripExt } from '../../utils/imageNaming'
import { matchCountLabel, stepMatch } from '../../utils/textSearch'
import { Button } from '../ui/button'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'
import { describeUnsupported } from './docx/docxXml'
import { installOfficeFontAliases } from './docx/officeFonts'
import { prepareDocx } from './docx/prepareDocx'
import { fillPageNumbers, renderedPages, textChunks } from './docx/renderedDocx'
import { findDocumentMatches } from './documentSearch'
import {
  DocumentSearchField,
  PageControls,
  ToolbarIconButton,
  ToolbarSpacer,
  ToolbarTextButton,
  ViewerToolbar,
  ZoomControls,
} from './ViewerToolbar'
import { fitPageZoom, fitWidthZoom, pageAtScroll, stepZoom, type FitMode } from './viewerLayout'
import './docx/docxPreview.css'

export interface DocxLoadError {
  title: string
  detail: string
}

interface DOCXViewerProps {
  content: string | null // base64-encoded DOCX; null when the host refused to load it
  filename: string
  canSaveAsMarkdown?: boolean
  /** Set when the host's check refused the file before sending it (R5). */
  loadError?: DocxLoadError | null
}

interface ExtractedImage {
  filename: string
  contentType: string
  base64: string
}

// renderAltChunks off: an alt chunk is HTML embedded in the document, and it
// would be inserted into the webview as-is.
const RENDER_OPTIONS = {
  useBase64URL: true, // VS Code webviews restrict blob: URLs
  inWrapper: true,
  ignoreWidth: false,
  ignoreHeight: false,
  ignoreFonts: false,
  breakPages: true,
  renderAltChunks: false,
} as const

const SEARCH_HIGHLIGHT = 'ritemark-doc-search'
const CURRENT_HIGHLIGHT = 'ritemark-doc-search-current'
const SLOW_RENDER_MS = 15000

function decodeBase64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

/** What to tell the user when drawing fails, instead of the library's own words. */
function renderFailure(error: unknown): DocxLoadError {
  const message = error instanceof Error ? error.message : String(error)
  if (/central directory|is this a zip|Corrupted zip|no Word document/i.test(message)) {
    return {
      title: 'This file can’t be read as a Word document',
      detail: 'It may be damaged, or saved in another format. Try opening it in a word processor.',
    }
  }
  return { title: 'Ritemark couldn’t draw this document', detail: message }
}

function highlightsSupported(): boolean {
  return typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined'
}

export function DOCXViewer({ content, filename, canSaveAsMarkdown, loadError }: DOCXViewerProps) {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [renderError, setRenderError] = useState<DocxLoadError | null>(null)
  const [slow, setSlow] = useState(false)
  const [renderVersion, setRenderVersion] = useState(0)
  const [pageCount, setPageCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [fit, setFit] = useState<FitMode>(null)
  const [unsupportedNote, setUnsupportedNote] = useState<string | null>(null)
  const [deleted, setDeleted] = useState(false)
  const [openLabel, setOpenLabel] = useState('Open in Word')
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [matches, setMatches] = useState<Range[]>([])
  const [currentMatch, setCurrentMatch] = useState(-1)
  const [isSavingMd, setIsSavingMd] = useState(false)
  const [saveToast, setSaveToast] = useState<{
    kind: 'success' | 'error'
    message: string
    warnings: string[]
  } | null>(null)

  const scrollerRef = useRef<HTMLDivElement>(null)
  const styleRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const pageToRestore = useRef<number | null>(null)
  const zoomChosen = useRef(false)
  const revealMatch = useRef(false)
  const currentPageRef = useRef(0)
  currentPageRef.current = currentPage

  // Host messages: which app opens the file, Save-as-Markdown results, file changes.
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data
      if (message.type === 'wordStatus') {
        if (typeof message.openLabel === 'string') setOpenLabel(message.openLabel)
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
      } else if (message.type === 'fileChanged') {
        // Edited elsewhere: read it again and come back to the same page.
        pageToRestore.current = currentPageRef.current
        setDeleted(false)
        sendToExtension('refresh')
      } else if (message.type === 'fileDeleted') {
        setDeleted(true)
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

  // Render the document whenever new bytes arrive.
  useEffect(() => {
    const scroller = scrollerRef.current
    const styles = styleRef.current
    if (!content || loadError || !scroller || !styles) return
    let cancelled = false
    setPhase('loading')
    setSlow(false)
    const slowTimer = setTimeout(() => {
      if (!cancelled) setSlow(true)
    }, SLOW_RENDER_MS)

    void (async () => {
      try {
        installOfficeFontAliases()
        const prepared = await prepareDocx(decodeBase64ToBytes(content))
        if (cancelled) return
        scroller.innerHTML = ''
        styles.innerHTML = ''
        await renderAsync(prepared.data, scroller, styles, {
          ...RENDER_OPTIONS,
          ignoreLastRenderedPageBreak: !prepared.honourPageMarkers,
        })
        if (cancelled) return
        setPageCount(fillPageNumbers(scroller))
        setUnsupportedNote(describeUnsupported(prepared.unsupported))
        setRenderError(null)
        setPhase('ready')
        setRenderVersion((v) => v + 1)
      } catch (e) {
        if (cancelled) return
        setRenderError(renderFailure(e))
        setPhase('error')
      } finally {
        clearTimeout(slowTimer)
        if (!cancelled) setSlow(false)
      }
    })()

    return () => {
      cancelled = true
      clearTimeout(slowTimer)
    }
  }, [content, loadError])

  const wrapper = useCallback(() => scrollerRef.current?.querySelector<HTMLElement>('.docx-wrapper') ?? null, [])

  /** The pages' size at 100 %: the widest page, and the tallest. */
  const naturalPageSize = useCallback((): { width: number; height: number } => {
    const scroller = scrollerRef.current
    if (!scroller) return { width: 0, height: 0 }
    const pages = renderedPages(scroller)
    let width = 0
    let height = 0
    for (const page of pages) {
      const rect = page.getBoundingClientRect()
      width = Math.max(width, rect.width / zoom)
      height = Math.max(height, rect.height / zoom)
    }
    return { width, height }
  }, [zoom])

  const goToPage = useCallback((index: number) => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const pages = renderedPages(scroller)
    const page = pages[Math.max(0, Math.min(index, pages.length - 1))]
    if (!page) return
    scroller.scrollTop += page.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 12
  }, [])

  // Apply the zoom to the drawn document.
  useEffect(() => {
    const el = wrapper()
    if (el) el.style.zoom = String(zoom)
  }, [zoom, renderVersion, wrapper])

  // After a render: the first time, fit the width (never above 100 %); after a refresh, return to the page.
  useEffect(() => {
    if (phase !== 'ready') return
    const scroller = scrollerRef.current
    if (!scroller) return
    if (!zoomChosen.current) {
      zoomChosen.current = true
      const { width } = naturalPageSize()
      setZoom(Math.min(1, fitWidthZoom(width, scroller.clientWidth)))
    }
    if (pageToRestore.current !== null) {
      const page = pageToRestore.current
      pageToRestore.current = null
      requestAnimationFrame(() => goToPage(page))
    }
    // naturalPageSize changes with zoom; this runs once per render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, renderVersion])

  // Fit width / fit page follow the window until the user zooms by hand.
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!fit || phase !== 'ready' || !scroller) return
    const apply = () => {
      const { width, height } = naturalPageSize()
      const next = fit === 'width'
        ? fitWidthZoom(width, scroller.clientWidth)
        : fitPageZoom(width, height, scroller.clientWidth, scroller.clientHeight)
      setZoom((z) => (Math.abs(z - next) > 0.001 ? next : z))
    }
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [fit, phase, renderVersion, naturalPageSize])

  // Track the page being read.
  const scrollFrame = useRef(0)
  const onScroll = useCallback(() => {
    if (scrollFrame.current) return
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = 0
      const scroller = scrollerRef.current
      if (!scroller) return
      const top = scroller.getBoundingClientRect().top
      const tops = renderedPages(scroller).map((page) => page.getBoundingClientRect().top - top)
      setCurrentPage(pageAtScroll(tops, scroller.clientHeight))
    })
  }, [])
  useEffect(() => onScroll(), [zoom, renderVersion, onScroll])

  // Search: find matches in the drawn text; highlight without touching the DOM.
  useEffect(() => {
    const scroller = scrollerRef.current
    if (phase !== 'ready' || !scroller) {
      setMatches([])
      setCurrentMatch(-1)
      return
    }
    const { nodes, chunks } = textChunks(scroller)
    const ranges = findDocumentMatches(chunks, deferredQuery).map((m) => {
      const range = document.createRange()
      range.setStart(nodes[m.start.chunk], m.start.offset)
      range.setEnd(nodes[m.end.chunk], m.end.offset)
      return range
    })
    setMatches(ranges)
    // Start at the first match from where the reader is.
    const viewTop = scroller.getBoundingClientRect().top
    const first = ranges.findIndex((range) => range.getBoundingClientRect().top >= viewTop)
    setCurrentMatch(ranges.length ? Math.max(0, first) : -1)
    revealMatch.current = ranges.length > 0
  }, [deferredQuery, phase, renderVersion])

  useEffect(() => {
    if (!highlightsSupported()) return
    if (matches.length) CSS.highlights.set(SEARCH_HIGHLIGHT, new Highlight(...matches))
    else CSS.highlights.delete(SEARCH_HIGHLIGHT)
    const current = matches[currentMatch]
    if (current) CSS.highlights.set(CURRENT_HIGHLIGHT, new Highlight(current))
    else CSS.highlights.delete(CURRENT_HIGHLIGHT)
  }, [matches, currentMatch])

  useEffect(
    () => () => {
      if (!highlightsSupported()) return
      CSS.highlights.delete(SEARCH_HIGHLIGHT)
      CSS.highlights.delete(CURRENT_HIGHLIGHT)
    },
    [],
  )

  // Bring the current match into view (after the zoom has been applied).
  useEffect(() => {
    if (!revealMatch.current) return
    revealMatch.current = false
    const scroller = scrollerRef.current
    const range = matches[currentMatch]
    if (!scroller || !range) return
    const rect = range.getBoundingClientRect()
    const view = scroller.getBoundingClientRect()
    scroller.scrollTop += rect.top - (view.top + view.height / 2)
  }, [matches, currentMatch, zoom])

  const stepSearch = useCallback((direction: 1 | -1) => {
    revealMatch.current = true
    setCurrentMatch((c) => stepMatch(c, matches.length, direction))
  }, [matches.length])

  // Cmd/Ctrl+F puts you in the search field.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const handleRefresh = useCallback(() => {
    pageToRestore.current = currentPageRef.current
    sendToExtension('refresh')
  }, [])

  const handleOpenExternally = useCallback(() => {
    sendToExtension('openInExternalApp')
  }, [])

  const handleSaveAsMarkdown = useCallback(async () => {
    if (isSavingMd || !content) return
    setIsSavingMd(true)
    setSaveToast(null)

    try {
      const bytes = decodeBase64ToBytes(content)
      const sourceBasename = stripExt(filename) || 'document'
      const images: ExtractedImage[] = []
      const unrecognizedMimes = new Set<string>()

      const result = await mammoth.convertToHtml(
        { arrayBuffer: bytes.buffer as ArrayBuffer },
        {
          convertImage: mammoth.images.imgElement(async (image) => {
            const base64 = await image.readAsBase64String()
            const { ext, recognized } = mimeToExt(image.contentType)
            if (!recognized) unrecognizedMimes.add(image.contentType)
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

      if (unrecognizedMimes.size > 0) {
        warnings.push(
          `Saved ${unrecognizedMimes.size} image${unrecognizedMimes.size === 1 ? '' : 's'} with unrecognized content type${unrecognizedMimes.size === 1 ? '' : 's'} (${[...unrecognizedMimes].join(', ')}); files were written with .png extension and may not render correctly.`
        )
      }

      const turndownService = createTurndownService()
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
  const failure: DocxLoadError | null = isDocFormat
    ? {
        title: 'The old .doc format isn’t supported',
        detail: 'Open it in a word processor, or save it as .docx to preview it here.',
      }
    : loadError ?? (phase === 'error' ? renderError : null)
  const ready = phase === 'ready' && !failure

  return (
    <div className="ritemark-docx relative flex h-full flex-col bg-surface">
      <ViewerToolbar title={filename}>
        {ready && (
          <>
            <PageControls current={currentPage} total={pageCount} onStep={(d) => goToPage(currentPage + d)} />
            <ZoomControls
              zoom={zoom}
              fit={fit}
              onStep={(d) => {
                setFit(null)
                setZoom((z) => stepZoom(z, d))
              }}
              onFit={setFit}
            />
          </>
        )}
        <ToolbarSpacer />
        {ready && (
          <DocumentSearchField
            ref={searchRef}
            query={query}
            countLabel={matchCountLabel(currentMatch, matches.length, deferredQuery)}
            hasMatches={matches.length > 0}
            onQueryChange={setQuery}
            onStep={stepSearch}
            onLeave={() => scrollerRef.current?.focus()}
          />
        )}
        {canSaveAsMarkdown && ready && (
          <ToolbarTextButton
            icon="file-text"
            label={isSavingMd ? 'Converting…' : 'Save as Markdown'}
            tooltip={isSavingMd ? 'Converting the document to Markdown' : 'Save the document as a Markdown file, with its images in ./images/'}
            disabled={isSavingMd}
            onClick={handleSaveAsMarkdown}
          />
        )}
        <ToolbarTextButton icon="arrow-square-out" label={openLabel} tooltip="See the document exactly as it is, in a word processor" onClick={handleOpenExternally} />
        <ToolbarIconButton icon="arrow-clockwise" label="Refresh" tooltip="Read the file from disk again" onClick={handleRefresh} />
      </ViewerToolbar>

      {deleted && (
        <Notice icon="warning">This file was deleted or moved. You are looking at the last version Ritemark read.</Notice>
      )}
      {ready && unsupportedNote && (
        <Notice icon="info" onDismiss={() => setUnsupportedNote(null)}>
          {unsupportedNote} {openLabel} to see them.
        </Notice>
      )}
      {slow && phase === 'loading' && !failure && (
        <Notice icon="circle-notch">This document is taking a while to draw. {openLabel} if you need it now.</Notice>
      )}

      {phase === 'loading' && !failure && (
        <div className="flex flex-1 items-center justify-center gap-2 font-ui text-[13px] text-ink-muted">
          <Icon name="circle-notch" size={16} className="animate-spin" />
          Opening {filename}…
        </div>
      )}

      {failure && (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="flex max-w-md flex-col items-center gap-3 text-center">
            <Icon name="warning-circle" size={20} tone="active" />
            <div className="font-ui text-[15px] font-medium text-ink-strong">{failure.title}</div>
            <div className="font-ui text-[13px] text-ink-muted">{failure.detail}</div>
            <div className="mt-1 flex gap-2">
              {!isDocFormat && (
                <Tooltip label="Read the file from disk again">
                  <Button type="button" variant="outline" size="sm" className="whitespace-nowrap" onClick={handleRefresh}>
                    <Icon name="arrow-clockwise" size={14} />
                    Try again
                  </Button>
                </Tooltip>
              )}
              <Tooltip label="See the document in a word processor">
                <Button type="button" size="sm" className="whitespace-nowrap" onClick={handleOpenExternally}>
                  <Icon name="arrow-square-out" size={14} />
                  {openLabel}
                </Button>
              </Tooltip>
            </div>
          </div>
        </div>
      )}

      {/* docx-preview writes its generated styles here */}
      <div ref={styleRef} style={{ display: 'none' }} />

      {/* The drawn document; also the scroller */}
      <div
        ref={scrollerRef}
        tabIndex={-1}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-auto outline-none"
        style={{ display: ready ? 'block' : 'none' }}
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

function Notice({ icon, children, onDismiss }: { icon: 'warning' | 'info' | 'circle-notch'; children: ReactNode; onDismiss?: () => void }) {
  return (
    <div role="status" className="flex shrink-0 items-center gap-2 border-b border-hairline bg-surface-soft px-3 py-1.5 font-ui text-[12px] text-ink-strong">
      <Icon name={icon} size={14} className={icon === 'circle-notch' ? 'animate-spin' : undefined} />
      <span className="min-w-0 flex-1">{children}</span>
      {onDismiss && <ToolbarIconButton icon="x" label="Dismiss" tooltip="Hide this notice" onClick={onDismiss} />}
    </div>
  )
}
