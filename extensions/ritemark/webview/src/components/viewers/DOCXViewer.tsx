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
import { useCallback, useDeferredValue, useEffect, useRef, useState } from 'react'
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
import { FindBarShell, type FindBarShellHandle } from '../FindBarShell'
import {
  Notice,
  PageIndicator,
  SplitButton,
  ToolbarIconButton,
  ToolbarSpacer,
  ViewerToolbar,
  ZoomControls,
} from './ViewerToolbar'
import { fitPageZoom, fitWidthZoom, pageAtScroll, stepZoom, type FitMode } from './viewerLayout'
import './documentSearch.css'
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
const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)

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
  const [hyphenate, setHyphenate] = useState(false)
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

  // scroller (overflow) > sizer (the scaled size, for scrolling) > stage (drawn at 100 %, then scaled)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const sizerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const styleRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<FindBarShellHandle>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const pageToRestore = useRef<number | null>(null)
  const zoomChosen = useRef(false)
  const revealMatch = useRef(false)
  const currentPageRef = useRef(0)
  currentPageRef.current = currentPage

  // Host messages: which app opens the file, Save-as-Markdown results, file changes.
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data
      if (message.type === 'openStatus') {
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
    const stage = stageRef.current
    const styles = styleRef.current
    if (!content || loadError || !stage || !styles) return
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
        stage.innerHTML = ''
        styles.innerHTML = ''
        await renderAsync(prepared.data, stage, styles, {
          ...RENDER_OPTIONS,
          ignoreLastRenderedPageBreak: !prepared.honourPageMarkers,
        })
        if (cancelled) return
        setPageCount(fillPageNumbers(stage))
        setUnsupportedNote(describeUnsupported(prepared.unsupported))
        setHyphenate(prepared.autoHyphenation)
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

  /**
   * Sizes at 100 %, from layout (offset sizes ignore the scale transform):
   * the drawn document with its margins, and one page with the margins around it.
   * Zoom is a transform, not CSS `zoom`: in this Chromium, `zoom` leaves
   * getBoundingClientRect unscaled while scrolling is scaled, so positions
   * could not be trusted.
   */
  const naturalSizes = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return { stageWidth: 0, stageHeight: 0, pageHeight: 0 }
    const pages = renderedPages(stage)
    const margin = stage.offsetWidth - Math.max(0, ...pages.map((page) => page.offsetWidth))
    const pageHeight = Math.max(0, ...pages.map((page) => page.offsetHeight)) + margin
    return { stageWidth: stage.offsetWidth, stageHeight: stage.offsetHeight, pageHeight }
  }, [])

  const goToPage = useCallback((index: number) => {
    const scroller = scrollerRef.current
    const stage = stageRef.current
    if (!scroller || !stage) return
    const pages = renderedPages(stage)
    const page = pages[Math.max(0, Math.min(index, pages.length - 1))]
    if (!page) return
    scroller.scrollTop += page.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 12
  }, [])

  // Apply the zoom: scale the stage, and give the sizer the scaled size so the scroll range matches.
  const applyZoom = useCallback(() => {
    const stage = stageRef.current
    const sizer = sizerRef.current
    if (!stage || !sizer) return
    stage.style.transform = `scale(${zoom})`
    sizer.style.width = `${stage.offsetWidth * zoom}px`
    sizer.style.height = `${stage.offsetHeight * zoom}px`
  }, [zoom])

  const lastAppliedZoom = useRef(zoom)
  useEffect(() => {
    if (phase !== 'ready') return
    applyZoom()
    // Keep the reader on the page they were reading when the scale changes.
    if (lastAppliedZoom.current !== zoom) {
      lastAppliedZoom.current = zoom
      if (!revealMatch.current) goToPage(currentPageRef.current)
    }
    const stage = stageRef.current
    if (!stage) return
    // Images and fonts settle after the first paint and change the drawn size.
    const observer = new ResizeObserver(applyZoom)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [zoom, phase, renderVersion, applyZoom, goToPage])

  // After a render: the first time, fit the width (never above 100 %); after a refresh, return to the page.
  useEffect(() => {
    if (phase !== 'ready') return
    const scroller = scrollerRef.current
    if (!scroller) return
    if (!zoomChosen.current) {
      zoomChosen.current = true
      const { stageWidth } = naturalSizes()
      setZoom(Math.min(1, fitWidthZoom(stageWidth, scroller.clientWidth, 0)))
    }
    if (pageToRestore.current !== null) {
      const page = pageToRestore.current
      pageToRestore.current = null
      requestAnimationFrame(() => goToPage(page))
    }
  }, [phase, renderVersion, naturalSizes, goToPage])

  // Fit width / fit page follow the window until the user zooms by hand.
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!fit || phase !== 'ready' || !scroller) return
    const apply = () => {
      const { stageWidth, pageHeight } = naturalSizes()
      const next = fit === 'width'
        ? fitWidthZoom(stageWidth, scroller.clientWidth, 0)
        : fitPageZoom(stageWidth, pageHeight, scroller.clientWidth, scroller.clientHeight, 0)
      setZoom((z) => (Math.abs(z - next) > 0.001 ? next : z))
    }
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [fit, phase, renderVersion, naturalSizes])

  // Track the page being read.
  const scrollFrame = useRef(0)
  const onScroll = useCallback(() => {
    if (scrollFrame.current) return
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = 0
      const scroller = scrollerRef.current
      const stage = stageRef.current
      if (!scroller || !stage) return
      const top = scroller.getBoundingClientRect().top
      const tops = renderedPages(stage).map((page) => page.getBoundingClientRect().top - top)
      setCurrentPage(pageAtScroll(tops, scroller.clientHeight))
    })
  }, [])
  useEffect(() => onScroll(), [zoom, renderVersion, onScroll])

  // Search: find matches in the drawn text; highlight without touching the DOM.
  useEffect(() => {
    const scroller = scrollerRef.current
    const stage = stageRef.current
    if (phase !== 'ready' || !scroller || !stage) {
      setMatches([])
      setCurrentMatch(-1)
      return
    }
    const { nodes, chunks } = textChunks(stage)
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

  // Search opens as the floating find bar, as in the Markdown editor: the
  // magnifier or Cmd/Ctrl+F; Escape or × closes it and clears the highlights.
  const openSearch = useCallback(() => {
    setSearchOpen(true)
    searchRef.current?.focus()
  }, [])
  const closeSearch = useCallback(() => {
    setSearchOpen(false)
    setQuery('')
    scrollerRef.current?.focus()
  }, [])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        openSearch()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [openSearch])

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
    <div className={`ritemark-docx relative flex h-full flex-col bg-surface${hyphenate ? ' docx-hyphenate' : ''}`}>
      <ViewerToolbar>
        {ready && (
          <>
            <PageIndicator current={currentPage} total={pageCount} />
            <ZoomControls
              zoom={zoom}
              fit={fit}
              onStep={(d) => {
                setFit(null)
                setZoom((z) => stepZoom(z, d))
              }}
              onFit={setFit}
              onSet={(z) => {
                setFit(null)
                setZoom(z)
              }}
            />
          </>
        )}
        <ToolbarSpacer />
        {ready && (
          <ToolbarIconButton
            icon="magnifying-glass"
            label="Find in document"
            tooltip={`Find in document (${isMac ? 'Cmd' : 'Ctrl'}+F)`}
            pressed={searchOpen}
            onClick={searchOpen ? closeSearch : openSearch}
          />
        )}
        <SplitButton
          icon="arrow-square-out"
          label={openLabel}
          tooltip="See the document exactly as it is, and edit it"
          onClick={handleOpenExternally}
          menuLabel="More ways to use this document"
          actions={canSaveAsMarkdown && ready
            ? [{ icon: 'file-text', label: isSavingMd ? 'Converting…' : 'Save as Markdown', onSelect: handleSaveAsMarkdown, disabled: isSavingMd }]
            : []}
        />
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

      {/* The drawn document; also the scroller. The find bar floats over its top. */}
      <div className="relative flex min-h-0 flex-1 flex-col" style={{ display: ready ? 'flex' : 'none' }}>
        {ready && searchOpen && (
          <FindBarShell
            ref={searchRef}
            query={query}
            onQueryChange={setQuery}
            countLabel={matchCountLabel(currentMatch, matches.length, deferredQuery)}
            hasMatches={matches.length > 0}
            onNext={() => stepSearch(1)}
            onPrevious={() => stepSearch(-1)}
            onClose={closeSearch}
          />
        )}
        <div
          ref={scrollerRef}
          tabIndex={-1}
          onScroll={onScroll}
          className="docx-scroller min-h-0 flex-1 overflow-auto outline-none"
        >
          <div ref={sizerRef} className="docx-sizer">
            <div ref={stageRef} className="docx-stage" />
          </div>
        </div>
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
