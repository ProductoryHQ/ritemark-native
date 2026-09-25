/**
 * PowerPoint preview (.pptx), read-only.
 *
 * Sprint 125 (#285): a deck someone sent, read like a document — the slides stack
 * and scroll, each with its speaker notes under it, on the toolbar and find bar
 * of the Word preview. `@aiden0z/pptx-renderer` draws each slide; only the slides
 * near the view are drawn at a time, so a deck full of charts does not hold a
 * canvas per chart. It says what it cannot play, and always offers PowerPoint.
 * Evidence: docs/development/releases/v1.12.0/sprint-125-powerpoint-preview/.
 */
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { renderSlide, type SlideHandle } from '@aiden0z/pptx-renderer'
import { sendToExtension } from '../../bridge'
import { matchCountLabel, stepMatch } from '../../utils/textSearch'
import { Button } from '../ui/button'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'
import { FindBarShell, type FindBarShellHandle } from '../FindBarShell'
import { Notice, PageIndicator, SplitButton, ToolbarIconButton, ToolbarSpacer, ViewerToolbar, ZoomControls } from './ViewerToolbar'
import { fitPageZoom, fitWidthZoom, pageAtScroll, stepZoom, type FitMode } from './viewerLayout'
import { deckMatches, firstMatchFrom } from './pptx/deckSearch'
import { loadDeck, type LoadedDeck } from './pptx/loadDeck'
import { notesRanges, slideRanges } from './pptx/renderedDeck'
import './pptx/pptxPreview.css'

export interface PptxLoadError {
  title: string
  detail: string
}

interface PPTXViewerProps {
  content: string | null // base64-encoded deck; null when the host refused it
  filename: string
  /** Set when the host refused the file before sending it (R5), or the preview is off. */
  loadError?: PptxLoadError | null
}

/** Space around and between slides, at 100 %. */
const GUTTER = 24
/** Slides this far outside the view (in viewport heights) are drawn, so scrolling finds them ready. */
const DRAW_AHEAD = '150%'
const SEARCH_HIGHLIGHT = 'ritemark-doc-search'
const CURRENT_HIGHLIGHT = 'ritemark-doc-search-current'
const SLOW_RENDER_MS = 15000
const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)

function decodeBase64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i)
  return bytes
}

/** What to tell the user when reading fails, instead of the library's own words. */
function loadFailure(error: unknown): PptxLoadError {
  const message = error instanceof Error ? error.message : String(error)
  if (/central directory|is this a zip|Corrupted zip|zip limit|size mismatch|presentation\.xml/i.test(message)) {
    return {
      title: 'This file can’t be read as a presentation',
      detail: 'It may be damaged, or saved in another format. Try opening it in PowerPoint.',
    }
  }
  return { title: 'Ritemark couldn’t draw this presentation', detail: message }
}

function highlightsSupported(): boolean {
  return typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined'
}

export function PPTXViewer({ content, filename, loadError }: PPTXViewerProps) {
  const [deck, setDeck] = useState<LoadedDeck | null>(null)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [renderError, setRenderError] = useState<PptxLoadError | null>(null)
  const [slow, setSlow] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [fit, setFit] = useState<FitMode>(null)
  const [unsupportedNote, setUnsupportedNote] = useState<string | null>(null)
  const [deleted, setDeleted] = useState(false)
  const [openLabel, setOpenLabel] = useState('Open in PowerPoint')
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [currentMatch, setCurrentMatch] = useState(-1)
  const [searchOpen, setSearchOpen] = useState(false)
  /** Bumped whenever a slide is drawn or taken down, so highlights follow. */
  const [drawnVersion, setDrawnVersion] = useState(0)

  // scroller (overflow) > sizer (the scaled size, for scrolling) > stage (drawn at 100 %, then scaled)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const sizerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<FindBarShellHandle>(null)
  const slotRefs = useRef<(HTMLDivElement | null)[]>([])
  const notesRefs = useRef<(HTMLDivElement | null)[]>([])
  const handles = useRef(new Map<number, SlideHandle>())
  const mediaUrls = useRef(new Map<string, string>())
  const slideToRestore = useRef<number | null>(null)
  const zoomChosen = useRef(false)
  const revealMatch = useRef(false)
  const currentSlideRef = useRef(0)
  currentSlideRef.current = currentSlide

  // Host messages: which app opens the file, and changes to the file on disk.
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data
      if (message.type === 'openStatus') {
        if (typeof message.openLabel === 'string') setOpenLabel(message.openLabel)
      } else if (message.type === 'fileChanged') {
        // Edited elsewhere: read it again and come back to the same slide.
        slideToRestore.current = currentSlideRef.current
        setDeleted(false)
        sendToExtension('refresh')
      } else if (message.type === 'fileDeleted') {
        setDeleted(true)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  // Take every drawn slide down, and let go of the deck's images.
  const clearDrawn = useCallback(() => {
    for (const handle of handles.current.values()) {
      handle.dispose()
      handle.element.remove()
    }
    handles.current.clear()
    for (const url of mediaUrls.current.values()) URL.revokeObjectURL(url)
    mediaUrls.current.clear()
  }, [])
  useEffect(() => clearDrawn, [clearDrawn])

  // Read the deck whenever new bytes arrive.
  useEffect(() => {
    if (!content || loadError) return
    let cancelled = false
    setPhase('loading')
    setSlow(false)
    const slowTimer = setTimeout(() => {
      if (!cancelled) setSlow(true)
    }, SLOW_RENDER_MS)

    void (async () => {
      try {
        const loaded = await loadDeck(decodeBase64ToBytes(content))
        if (cancelled) return
        clearDrawn()
        setDeck(loaded)
        setUnsupportedNote(loaded.unsupported)
        setRenderError(null)
        setPhase('ready')
      } catch (e) {
        if (cancelled) return
        setRenderError(loadFailure(e))
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
  }, [content, loadError, clearDrawn])

  const slideWidth = deck?.presentation.width ?? 0
  const slideHeight = deck?.presentation.height ?? 0
  const slideCount = deck?.presentation.slides.length ?? 0
  const bodyFont = useMemo(() => {
    const theme = deck?.presentation.themes.values().next().value
    return theme?.minorFont.latin ? `'${theme.minorFont.latin.replace(/'/g, '')}', sans-serif` : 'sans-serif'
  }, [deck])

  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const goToSlide = useCallback((index: number, block: 'slide' | 'notes' = 'slide') => {
    const scroller = scrollerRef.current
    const target = block === 'notes' ? notesRefs.current[index] : slotRefs.current[index]
    if (!scroller || !target) return
    scroller.scrollTop += target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - GUTTER * zoomRef.current
  }, [])

  // A link on a slide: web links go to the host, which asks VS Code to open them;
  // a jump to another slide scrolls there. Nothing else leaves the preview (R7).
  const onNavigate = useCallback((target: { slideIndex?: number; url?: string }) => {
    if (typeof target.slideIndex === 'number') goToSlide(target.slideIndex)
    else if (target.url) sendToExtension('openLink', { url: target.url })
  }, [goToSlide])

  const onStageClick = useCallback((event: MouseEvent) => {
    const anchor = (event.target as Element).closest?.('a[href]') as HTMLAnchorElement | null
    if (!anchor) return
    event.preventDefault()
    event.stopPropagation()
    const href = anchor.getAttribute('href') ?? ''
    if (/^https?:/i.test(href)) sendToExtension('openLink', { url: href })
  }, [])

  // Draw the slides near the view; take down the ones far from it.
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!deck || phase !== 'ready' || !scroller) return
    const draw = (index: number) => {
      const slot = slotRefs.current[index]
      const slide = deck.presentation.slides[index]
      if (!slot || !slide || handles.current.has(index)) return
      try {
        const handle = renderSlide(deck.presentation, slide, {
          mediaUrlCache: mediaUrls.current,
          pdfjs: false,
          onNavigate,
        })
        slot.appendChild(handle.element)
        handles.current.set(index, handle)
      } catch {
        // A slide that cannot be drawn stays an empty white slide; the rest of the deck still shows.
      }
    }
    const takeDown = (index: number) => {
      const handle = handles.current.get(index)
      if (!handle) return
      handle.dispose()
      handle.element.remove()
      handles.current.delete(index)
    }
    const observer = new IntersectionObserver(
      (entries) => {
        let changed = false
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).dataset.slide)
          if (entry.isIntersecting) {
            if (!handles.current.has(index)) {
              draw(index)
              changed = true
            }
          } else if (handles.current.has(index)) {
            takeDown(index)
            changed = true
          }
        }
        if (changed) setDrawnVersion((v) => v + 1)
      },
      { root: scroller, rootMargin: `${DRAW_AHEAD} 0px` },
    )
    for (const slot of slotRefs.current.slice(0, deck.presentation.slides.length)) if (slot) observer.observe(slot)
    return () => observer.disconnect()
  }, [deck, phase, onNavigate])

  const stageWidth = slideWidth + GUTTER * 2

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
    // Keep the reader on the slide they were reading when the scale changes.
    if (lastAppliedZoom.current !== zoom) {
      lastAppliedZoom.current = zoom
      if (!revealMatch.current) goToSlide(currentSlideRef.current)
    }
    const stage = stageRef.current
    if (!stage) return
    const observer = new ResizeObserver(applyZoom)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [zoom, phase, deck, applyZoom, goToSlide])

  // After a load: the first time, fit the width (never above 100 %); after a refresh, return to the slide.
  useEffect(() => {
    if (phase !== 'ready' || !deck) return
    const scroller = scrollerRef.current
    if (!scroller) return
    if (!zoomChosen.current) {
      zoomChosen.current = true
      setZoom(Math.min(1, fitWidthZoom(stageWidth, scroller.clientWidth, 0)))
      scroller.focus({ preventScroll: true })
    }
    if (slideToRestore.current !== null) {
      const slide = slideToRestore.current
      slideToRestore.current = null
      requestAnimationFrame(() => goToSlide(slide))
    }
  }, [phase, deck, stageWidth, goToSlide])

  // Fit width / fit slide follow the window until the user zooms by hand.
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!fit || phase !== 'ready' || !scroller) return
    const apply = () => {
      const next = fit === 'width'
        ? fitWidthZoom(stageWidth, scroller.clientWidth, 0)
        : fitPageZoom(stageWidth, slideHeight + GUTTER * 2, scroller.clientWidth, scroller.clientHeight, 0)
      setZoom((z) => (Math.abs(z - next) > 0.001 ? next : z))
    }
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [fit, phase, stageWidth, slideHeight])

  // Track the slide being read.
  const scrollFrame = useRef(0)
  const onScroll = useCallback(() => {
    if (scrollFrame.current) return
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = 0
      const scroller = scrollerRef.current
      if (!scroller) return
      const top = scroller.getBoundingClientRect().top
      const tops = slotRefs.current.slice(0, slideCount).map((slot) => (slot ? slot.getBoundingClientRect().top - top : Infinity))
      setCurrentSlide(pageAtScroll(tops, scroller.clientHeight))
    })
  }, [slideCount])
  useEffect(() => onScroll(), [zoom, deck, onScroll])

  // Search: count in the deck's text (every slide, drawn or not), highlight the
  // words in the slides that are drawn, and the notes (always there).
  const matches = useMemo(() => (deck && phase === 'ready' ? deckMatches(deck.text, deferredQuery) : []), [deck, phase, deferredQuery])
  useEffect(() => {
    setCurrentMatch(firstMatchFrom(matches, currentSlideRef.current))
    revealMatch.current = matches.length > 0
  }, [matches])

  const current = matches[currentMatch]
  useEffect(() => {
    if (!highlightsSupported()) return
    if (!deck || !deferredQuery.trim() || matches.length === 0) {
      CSS.highlights.delete(SEARCH_HIGHLIGHT)
      CSS.highlights.delete(CURRENT_HIGHLIGHT)
      return
    }
    const all: Range[] = []
    let currentRange: Range | undefined
    deck.presentation.slides.forEach((slide, index) => {
      const handle = handles.current.get(index)
      if (handle) {
        const ranges = slideRanges(handle.element, slide.nodes.length, deferredQuery)
        all.push(...ranges)
        if (current?.slide === index && current.where === 'slide') currentRange = ranges[current.ordinal]
      }
      const notes = notesRefs.current[index]
      if (notes && deck.notes[index]?.length) {
        const ranges = notesRanges(notes, deferredQuery)
        all.push(...ranges)
        if (current?.slide === index && current.where === 'notes') currentRange = ranges[current.ordinal]
      }
    })
    if (all.length) CSS.highlights.set(SEARCH_HIGHLIGHT, new Highlight(...all))
    else CSS.highlights.delete(SEARCH_HIGHLIGHT)
    if (currentRange) CSS.highlights.set(CURRENT_HIGHLIGHT, new Highlight(currentRange))
    else CSS.highlights.delete(CURRENT_HIGHLIGHT)

    // Bring the current match into view: its slide first (which draws it), then the word.
    if (!revealMatch.current || !current) return
    const scroller = scrollerRef.current
    if (!scroller) return
    if (!currentRange) {
      goToSlide(current.slide, current.where)
      return
    }
    revealMatch.current = false
    const rect = currentRange.getBoundingClientRect()
    const view = scroller.getBoundingClientRect()
    if (rect.top < view.top + view.height * 0.15 || rect.bottom > view.bottom - view.height * 0.15) {
      scroller.scrollTop += rect.top - (view.top + view.height / 2)
    }
  }, [deck, matches, current, deferredQuery, drawnVersion, zoom, goToSlide])

  useEffect(
    () => () => {
      if (!highlightsSupported()) return
      CSS.highlights.delete(SEARCH_HIGHLIGHT)
      CSS.highlights.delete(CURRENT_HIGHLIGHT)
    },
    [],
  )

  const stepSearch = useCallback((direction: 1 | -1) => {
    revealMatch.current = true
    setCurrentMatch((c) => stepMatch(c, matches.length, direction))
  }, [matches.length])

  // Search opens as the floating find bar, as in the Markdown editor and the Word
  // preview: the magnifier or Cmd/Ctrl+F; Escape or × closes it and clears the highlights.
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
    slideToRestore.current = currentSlideRef.current
    sendToExtension('refresh')
  }, [])

  const handleOpenExternally = useCallback(() => {
    sendToExtension('openInExternalApp')
  }, [])

  const failure: PptxLoadError | null = loadError ?? (phase === 'error' ? renderError : null)
  const ready = phase === 'ready' && !failure && deck !== null

  return (
    <div className="ritemark-pptx relative flex h-full flex-col bg-surface">
      <ViewerToolbar>
        {ready && (
          <>
            <PageIndicator noun="Slide" current={currentSlide} total={slideCount} />
            <ZoomControls
              zoom={zoom}
              fit={fit}
              fitPageLabel="Fit slide"
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
            label="Find in presentation"
            tooltip={`Find in presentation (${isMac ? 'Cmd' : 'Ctrl'}+F)`}
            pressed={searchOpen}
            onClick={searchOpen ? closeSearch : openSearch}
          />
        )}
        <SplitButton
          icon="arrow-square-out"
          label={openLabel}
          tooltip="See the presentation exactly as it is, play it, and edit it"
          onClick={handleOpenExternally}
          menuLabel="More ways to use this presentation"
          actions={[]}
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
        <Notice icon="circle-notch">This presentation is taking a while to open. {openLabel} if you need it now.</Notice>
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
              <Tooltip label="Read the file from disk again">
                <Button type="button" variant="outline" size="sm" className="whitespace-nowrap" onClick={handleRefresh}>
                  <Icon name="arrow-clockwise" size={14} />
                  Try again
                </Button>
              </Tooltip>
              <Tooltip label="See the presentation in PowerPoint or another app">
                <Button type="button" size="sm" className="whitespace-nowrap" onClick={handleOpenExternally}>
                  <Icon name="arrow-square-out" size={14} />
                  {openLabel}
                </Button>
              </Tooltip>
            </div>
          </div>
        </div>
      )}

      {/* The slides; also the scroller. The find bar floats over its top. */}
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
            placeholder="Find in presentation…"
          />
        )}
        <div
          ref={scrollerRef}
          tabIndex={-1}
          onScroll={onScroll}
          className="pptx-scroller min-h-0 flex-1 overflow-auto outline-none"
        >
          <div ref={sizerRef} className="pptx-sizer">
            <div ref={stageRef} className="pptx-stage" style={{ width: stageWidth, padding: GUTTER }} onClickCapture={onStageClick}>
              {deck?.presentation.slides.map((_slide, index) => (
                <div key={index} className="pptx-item" style={{ marginBottom: index < slideCount - 1 ? GUTTER : 0 }}>
                  <div
                    ref={(el) => {
                      slotRefs.current[index] = el
                    }}
                    data-slide={index}
                    className="pptx-slide"
                    role="group"
                    aria-label={`Slide ${index + 1} of ${slideCount}`}
                    style={{ width: slideWidth, height: slideHeight, fontFamily: bodyFont }}
                  />
                  {deck.notes[index]?.length > 0 && (
                    <div
                      ref={(el) => {
                        notesRefs.current[index] = el
                      }}
                      className="pptx-notes"
                      aria-label={`Speaker notes for slide ${index + 1}`}
                    >
                      {deck.notes[index].map((paragraph, p) => (
                        <p key={p}>{paragraph}</p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
