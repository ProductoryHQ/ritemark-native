/**
 * Sprint 157 (experience 46): a `.deck.md` opened as a deck, as Jarmo sketched it on 14 November and the Experience
 * lead drew it: the deck's bar; numbered thumbnails on the left; one slide large in the middle; and on the right the
 * handout, the text of every slide in one column, a part per slide.
 *
 * The handout IS the document editor, holding the whole deck file, with the slide blocks as atom nodes. Saving,
 * conflicts, the writer's-copy merge and undo are therefore a document's own; the strip and the stage are drawn from
 * the editor's document.
 *
 * Kept in step (README decision 5): scrolling the handout changes the slide; choosing a thumbnail scrolls the handout
 * to its part; writing in a part makes its slide the current one.
 */
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Editor as TipTapEditor } from '@tiptap/react'
import { Editor } from '../Editor'
import { Button } from '../ui/button'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'
import { SyncActionButton } from '../header'
import { documentBarStatus, type DocumentSyncAction } from '../header/DocumentSyncAction'
import type { DocumentApplyTarget } from '../../types/documentSync'
import type { DocumentSyncState } from '../../../../src/editorSync/protocol'
import type { EditorSelection } from '../../types/editor'
import { parseFrom, type SlideData } from '../../../../src/decks/deckFormat'
import { onDocChanged } from '../../lib/docChange'
import { partIndexAt, slidesOf, type DeckSlideEntry } from './deckDocument'
import { useDeckAssets } from './deckBridge'
import { currentPart, scrollTopFor } from './scrollRule'
import { DeckGuard } from './handout/deckGuard'
import { DeckCurrent, setCurrentSlide } from './handout/deckCurrent'
import { DeckSlideWithPartHead } from './handout/SlidePartHead'
import { SlideCanvas } from './slide/SlideCanvas'
import './decks.css'

/** The deck's extensions, made once: the editor's extension list is fixed at mount. */
const DECK_EXTENSIONS = [DeckSlideWithPartHead, DeckGuard, DeckCurrent]

/** The strip's width, and the thumbnails' (the prototype's 132 and 96). */
const STRIP_WIDTH = 132
const THUMB_WIDTH = 96
/** The slide's room on the stage: 24 on each side, at most 900 wide. */
const STAGE_MARGIN = 24
const BIG_MAX = 900
/** The handout is never narrower than this (the Experience lead's answer 4). */
const HANDOUT_MIN = 300
const STAGE_MIN = 300
/** Below this desk width the strip folds and the slide and the handout split 60:40; below the next, the handout folds. */
const NARROW_DESK = 900
const NARROWEST_DESK = 600
const DEFAULT_RATIO = 0.6
/** How long a thumbnail's scroll holds the slide, and how long writing does (the prototype's `syncLock`). */
const PICK_LOCK_MS = 500
const WRITE_LOCK_MS = 1200

interface DeckViewProps {
  content: string
  onChange: (value: string) => void
  onEditorReady: (editor: TipTapEditor) => void
  onSelectionChange?: (selection: EditorSelection) => void
  imageMappings: Record<string, string>
  commentCallouts?: boolean
  syncTarget?: DocumentApplyTarget
  onExternalApplied: (target: DocumentApplyTarget) => void
  syncAction?: DocumentSyncAction
  syncState?: DocumentSyncState
  /** The conflict and paragraph dialogs, the document's own. */
  dialogs?: ReactNode
  /** The document's find bar, over the handout (Cmd+F and a search result). */
  findBar?: ReactNode
}

/** The stage's width for a desk width, the handout's ratio and what is shown. */
export function stageWidthFor(avail: number, ratio: number, handoutShown: boolean): number {
  if (!handoutShown) return avail
  return Math.max(0, Math.min(avail - HANDOUT_MIN, Math.max(STAGE_MIN, Math.round(avail * ratio))))
}

/** The library's topic or the deck a copy came from, for the quiet line under the slide. */
function sourceLine(from: string | undefined): { library: boolean; name: string } | null {
  const source = parseFrom(from)
  if (!source) return null
  const name = source.path.split('/').pop()?.replace(/\.deck\.md$/i, '') ?? source.path
  return { library: /^Slide library\//.test(source.path), name }
}

interface ThumbnailProps {
  index: number
  kind: string
  data: SlideData
  current: boolean
  pictureUrl?: string
  onPick: (index: number) => void
}

/** One numbered thumbnail in the strip. */
const Thumbnail = memo(function Thumbnail({ index, kind, data, current, pictureUrl, onPick }: ThumbnailProps) {
  return (
    <div
      role="option"
      aria-selected={current}
      aria-label={`Slide ${index + 1}${data.title ? `: ${data.title}` : ''}${data.skip ? ', skipped' : ''}`}
      data-thumb={index}
      className={`deck-thumb${current ? ' is-current' : ''}${data.skip ? ' is-skip' : ''}`}
      onClick={() => onPick(index)}
    >
      <span className="deck-thumb-no">{index + 1}</span>
      <div className="deck-thumb-slide">
        <SlideCanvas kind={kind} data={data} width={THUMB_WIDTH} pictureUrl={pictureUrl} />
      </div>
      {data.skip ? <span className="deck-thumb-eye"><Icon name="eye-slash" size={12} tone="inherit" /></span> : null}
    </div>
  )
})

export function DeckView({
  content,
  onChange,
  onEditorReady,
  onSelectionChange,
  imageMappings,
  commentCallouts,
  syncTarget,
  onExternalApplied,
  syncAction,
  syncState,
  dialogs,
  findBar,
}: DeckViewProps) {
  const [editor, setEditor] = useState<TipTapEditor | null>(null)
  const [slides, setSlides] = useState<DeckSlideEntry[]>([])
  const [current, setCurrent] = useState(0)
  const [stripWanted, setStripWanted] = useState(true)
  const [handoutWanted, setHandoutWanted] = useState(true)
  const [ratio, setRatio] = useState(DEFAULT_RATIO)
  const [deskWidth, setDeskWidth] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [bar, setBar] = useState<{ left: number; top: number; height: number } | null>(null)
  const deskRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const lockUntil = useRef(0)
  const currentRef = useRef(0)
  const assets = useDeckAssets(slides)

  const handleEditorReady = useCallback((instance: TipTapEditor) => {
    setEditor(instance)
    onEditorReady(instance)
  }, [onEditorReady])

  // The slides, from the editor's document, after every change (the host's too).
  useEffect(() => {
    if (!editor) return
    const refresh = () => setSlides(slidesOf(editor.state.doc))
    refresh()
    return onDocChanged(editor, refresh)
  }, [editor])

  const count = slides.length
  const shown = count === 0 ? 0 : Math.min(current, count - 1)
  const slide = slides[shown]

  // The desk's width decides what fits.
  useLayoutEffect(() => {
    const desk = deskRef.current
    if (!desk) return
    const observer = new ResizeObserver(() => setDeskWidth(desk.clientWidth))
    observer.observe(desk)
    setDeskWidth(desk.clientWidth)
    return () => observer.disconnect()
  }, [])

  const narrow = deskWidth > 0 && deskWidth < NARROW_DESK
  const stripShown = stripWanted && !narrow
  const handoutShown = handoutWanted && !(deskWidth > 0 && deskWidth < NARROWEST_DESK)
  const stripWidth = stripShown ? STRIP_WIDTH : 0
  const avail = Math.max(0, deskWidth - stripWidth)
  const stageWidth = stageWidthFor(avail, narrow ? DEFAULT_RATIO : ratio, handoutShown)
  const bigWidth = Math.max(0, Math.min(stageWidth - STAGE_MARGIN * 2, BIG_MAX))
  const dividerLeft = stripWidth + stageWidth

  const scrollContainer = useCallback((): HTMLElement | null => {
    return (editor?.view.dom.closest('.wysiwyg-editor') as HTMLElement | null) ?? null
  }, [editor])

  /** Each part head's top, in the handout's scrolled content. */
  const partTops = useCallback((): number[] => {
    const container = scrollContainer()
    if (!container || !editor) return []
    const origin = container.getBoundingClientRect().top - container.scrollTop
    return Array.from(editor.view.dom.querySelectorAll<HTMLElement>(':scope > .deck-part-head'))
      .map(head => head.getBoundingClientRect().top - origin)
  }, [editor, scrollContainer])

  const makeCurrent = useCallback((index: number) => {
    currentRef.current = index
    setCurrent(index)
  }, [])

  // The current slide's part head is marked in the handout; the strip keeps its thumbnail in view.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    editor.view.dispatch(setCurrentSlide(editor.state.tr, count === 0 ? null : shown))
    const strip = stripRef.current
    const thumb = strip?.querySelector<HTMLElement>(`[data-thumb="${shown}"]`)
    if (strip && thumb && (thumb.offsetTop < strip.scrollTop || thumb.offsetTop > strip.scrollTop + strip.clientHeight - 70)) {
      strip.scrollTop = thumb.offsetTop - 120
    }
  }, [editor, shown, count])

  // The current part's line on the left of the handout, from its head to the next one's.
  const measureBar = useCallback(() => {
    const tops = partTops()
    const container = scrollContainer()
    if (!container || !editor || tops.length === 0 || shown >= tops.length) { setBar(null); return }
    const top = tops[shown] + 16
    let end: number
    if (shown + 1 < tops.length) {
      end = tops[shown + 1] - 6
    } else {
      // The last part ends where the text does, above the room left for scrolling it to the top.
      const dom = editor.view.dom
      const origin = container.getBoundingClientRect().top - container.scrollTop
      end = dom.getBoundingClientRect().bottom - origin - (parseFloat(getComputedStyle(dom).paddingBottom) || 0) - 10
    }
    // 12 to the left of the part's text, as the prototype's `.hpart.cur::before`.
    const head = editor.view.dom.querySelector<HTMLElement>(':scope > .deck-part-head')
    const left = head ? head.getBoundingClientRect().left - container.getBoundingClientRect().left - 12 : 8
    setBar({ left, top, height: Math.max(0, end - top) })
  }, [partTops, scrollContainer, shown, editor])

  useEffect(() => {
    measureBar()
    if (!editor) return
    const observer = new ResizeObserver(() => measureBar())
    observer.observe(editor.view.dom)
    return () => observer.disconnect()
  }, [editor, measureBar, slides])

  // Scrolling the handout changes the slide, unless a pick or writing holds it.
  useEffect(() => {
    const container = scrollContainer()
    if (!container) return
    let frame: number | null = null
    const onScroll = () => {
      if (frame !== null) return
      frame = requestAnimationFrame(() => {
        frame = null
        if (Date.now() < lockUntil.current) return
        const next = currentPart({
          partTops: partTops(),
          scrollTop: container.scrollTop,
          clientHeight: container.clientHeight,
          scrollHeight: container.scrollHeight,
          writing: null,
        })
        if (next !== null && next !== currentRef.current) makeCurrent(next)
      })
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', onScroll)
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [scrollContainer, partTops, makeCurrent])

  // Writing in a part makes its slide the current one: the caret in its text, or the cursor in its title.
  useEffect(() => {
    if (!editor) return
    const fromSelection = () => {
      if (!editor.isFocused) return
      const index = partIndexAt(editor.state.doc, editor.state.selection.from)
      if (index === null) return
      lockUntil.current = Date.now() + WRITE_LOCK_MS
      if (index !== currentRef.current) makeCurrent(index)
    }
    const onFocusIn = (event: FocusEvent) => {
      const head = (event.target as HTMLElement | null)?.closest?.('.deck-part-head')
      if (!head) return
      const heads = Array.from(editor.view.dom.querySelectorAll(':scope > .deck-part-head'))
      const index = heads.indexOf(head)
      if (index < 0) return
      lockUntil.current = Date.now() + WRITE_LOCK_MS
      makeCurrent(index)
    }
    const onTitleInput = () => { lockUntil.current = Date.now() + WRITE_LOCK_MS }
    editor.on('selectionUpdate', fromSelection)
    editor.on('update', fromSelection)
    editor.view.dom.addEventListener('focusin', onFocusIn)
    editor.view.dom.addEventListener('input', onTitleInput, true)
    return () => {
      editor.off('selectionUpdate', fromSelection)
      editor.off('update', fromSelection)
      editor.view.dom.removeEventListener('focusin', onFocusIn)
      editor.view.dom.removeEventListener('input', onTitleInput, true)
    }
  }, [editor, makeCurrent])

  /** A thumbnail: its slide becomes current and the handout scrolls to its part. */
  const pick = useCallback((index: number) => {
    lockUntil.current = Date.now() + PICK_LOCK_MS
    makeCurrent(index)
    const container = scrollContainer()
    const tops = partTops()
    if (container && tops[index] !== undefined) container.scrollTop = scrollTopFor(tops[index])
  }, [makeCurrent, partTops, scrollContainer])

  const onStripKey = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (count === 0) return
    const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0
    if (event.key === 'Home') { event.preventDefault(); pick(0); return }
    if (event.key === 'End') { event.preventDefault(); pick(count - 1); return }
    if (step === 0) return
    event.preventDefault()
    pick(Math.max(0, Math.min(count - 1, shown + step)))
  }, [count, pick, shown])

  // The line between the slide and the handout is dragged to change the widths.
  const onDividerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const desk = deskRef.current
    if (!desk) return
    const target = event.currentTarget
    target.setPointerCapture(event.pointerId)
    setDragging(true)
    const move = (moveEvent: PointerEvent) => {
      const left = desk.getBoundingClientRect().left + stripWidth
      const x = moveEvent.clientX - left
      if (avail > 0) setRatio(Math.max(0.3, Math.min(0.82, x / avail)))
    }
    const up = () => {
      setDragging(false)
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
      target.removeEventListener('pointercancel', up)
      // The part being read stays at the top after the widths change.
      requestAnimationFrame(() => pick(currentRef.current))
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
    target.addEventListener('pointercancel', up)
  }, [avail, stripWidth, pick])

  const status = documentBarStatus(syncState, syncAction)
  const source = slide ? sourceLine(slide.data.from) : null
  const handoutContainer = scrollContainer()
  const pictureOf = (entry: DeckSlideEntry) => (entry.data.image ? assets[entry.data.image] : undefined)

  // Keyed by place and memoised on the slide's own data (read once per distinct body), so a keystroke redraws only
  // the thumbnail whose slide changed.
  const strip = slides.map(entry => (
    <Thumbnail
      key={entry.index}
      index={entry.index}
      kind={entry.kind}
      data={entry.data}
      current={entry.index === shown}
      pictureUrl={pictureOf(entry)}
      onPick={pick}
    />
  ))

  return (
    <div className="deck-view h-screen bg-surface flex flex-col">
      <header className="deck-bar">
        <Tooltip label={stripShown ? 'Hide the slides' : 'Show the slides'}>
          <Button
            variant="toolbar"
            size="icon-sm"
            data-state={stripShown ? 'active' : undefined}
            aria-pressed={stripShown}
            aria-label="Slides"
            disabled={narrow}
            onClick={() => setStripWanted(value => !value)}
          >
            <Icon name="list" size={14} tone={stripShown ? 'inherit' : 'muted'} />
          </Button>
        </Tooltip>
        <span className="deck-count">{count === 0 ? 'No slides yet' : `Slide ${shown + 1} of ${count}`}</span>
        <span className="flex-1" />
        <span className="sr-only" role="status" aria-live="polite">{syncAction?.label ?? ''}</span>
        {status === 'action' && syncAction ? (
          <SyncActionButton action={syncAction} />
        ) : (
          <span className={`deck-saved${status === 'saved' ? '' : ' invisible'}`}>Saved</span>
        )}
      </header>

      <div ref={deskRef} className="deck-desk">
        {stripShown ? (
          <div
            ref={stripRef}
            className="deck-strip"
            role="listbox"
            aria-label="Slides"
            tabIndex={0}
            onKeyDown={onStripKey}
          >
            {strip}
          </div>
        ) : null}

        <div className="deck-stage" style={{ left: stripWidth, width: stageWidth }}>
          <div className="deck-stage-group">
            {slide && bigWidth > 0 ? (
              <div className="deck-big" style={{ width: bigWidth }}>
                <SlideCanvas kind={slide.kind} data={slide.data} width={bigWidth} pictureUrl={pictureOf(slide)} />
              </div>
            ) : null}
            {source ? (
              <div className="deck-under">
                <div className="deck-source">
                  <Icon name={source.library ? 'books' : 'presentation'} size={12} tone="inherit" />
                  {source.library ? `From the library · ${source.name}` : `From ${source.name}`}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {handoutShown ? (
          <div
            className={`deck-divider${dragging ? ' is-dragging' : ''}`}
            style={{ left: dividerLeft }}
            role="separator"
            aria-orientation="vertical"
            aria-label="Drag to change the widths"
            onPointerDown={onDividerDown}
          />
        ) : null}
        {deskWidth >= NARROWEST_DESK ? (
          <div className="deck-fold" style={{ left: handoutShown ? dividerLeft : dividerLeft - 22 }}>
            <Tooltip label={handoutShown ? 'Hide the handout' : 'Show the handout'}>
              <Button
                variant="outline"
                size="icon-sm"
                className="deck-fold-button"
                aria-label={handoutShown ? 'Hide the handout' : 'Show the handout'}
                onClick={() => {
                  setHandoutWanted(value => !value)
                  requestAnimationFrame(() => pick(currentRef.current))
                }}
              >
                <Icon name={handoutShown ? 'caret-right' : 'caret-left'} size={14} tone="inherit" />
              </Button>
            </Tooltip>
          </div>
        ) : null}

        <div className={`deck-handout${handoutShown ? '' : ' is-folded'}`} style={{ left: dividerLeft + 8 }} aria-hidden={handoutShown ? undefined : true}>
          {findBar}
          <Editor
            value={content}
            onChange={onChange}
            onSelectionChange={onSelectionChange}
            onEditorReady={handleEditorReady}
            placeholder="Text and prompts for this slide."
            className="h-full"
            imageMappings={imageMappings}
            commentCallouts={commentCallouts}
            syncTarget={syncTarget}
            onExternalApplied={onExternalApplied}
            extensions={DECK_EXTENSIONS}
          />
          {handoutContainer && bar ? createPortal(<div className="deck-part-bar" style={{ left: bar.left, top: bar.top, height: bar.height }} />, handoutContainer) : null}
        </div>
      </div>
      {dialogs}
    </div>
  )
}
