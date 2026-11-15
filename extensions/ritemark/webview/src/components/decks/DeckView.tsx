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
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
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
import type { DocumentProperties } from '../properties'
import { SegmentedControl } from '../ui/segmented-control'
import { onDocChanged } from '../../lib/docChange'
import type { SlideData } from '../../../../src/decks/deckFormat'
import { deleteSlide, duplicateSlide, insertSlide, isSlideNode, moveSlide, partContent, partIndexAt, replacePart, restoreSlide, slideDataOf, slidesOf, updateSlide, type DeckSlideEntry } from './deckDocument'
import { DOMParser as PMDOMParser, Fragment, type Node as PMNode, type Slice } from '@tiptap/pm/model'
import { editorHTMLToMarkdown, markdownToEditorHTML } from '../../utils/editorMarkdown'
import { SourceLines, type CopySource } from './library/SourceLines'
import { onMessage, sendToExtension } from '../../bridge'
import { isTrustedDeckTransaction } from './handout/deckGuard'
import { convertKind } from './slide/convertKind'
import { SlideSettings } from './SlideSettings'
import { SlideStrip, type StripActions, type StripMark } from './SlideStrip'
import { newId, parseSlideBody, writeSlideBlock, writeSlideBody } from '../../../../src/decks/deckFormat'
import type { Transaction } from '@tiptap/pm/state'
import { useDeckAssets, useDeckTheme } from './deckBridge'
import { currentPart, scrollTopFor } from './scrollRule'
import { DeckGuard } from './handout/deckGuard'
import { DeckCurrent, setCurrentSlide } from './handout/deckCurrent'
import { DeckSlideWithPartHead } from './handout/SlidePartHead'
import { Stage } from './Stage'
import './decks.css'

/** The deck's extensions, made once: the editor's extension list is fixed at mount. */
const DECK_EXTENSIONS = [DeckSlideWithPartHead, DeckGuard, DeckCurrent]

/** The strip's width (the prototype's 132). */
const STRIP_WIDTH = 132
/** Settings beside the slide: its width, and how long a notice stays in the bar. */
const SETTINGS_WIDTH = 316
const NOTICE_MS = 8000
/** The quiet hint when a line is typed in the handout (the Experience lead's answer 10). */
const LINE_HINT = 'In this version a line stays a line. Add a slide with + between the thumbnails.'
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
/** The copies' sources are asked again this long after the deck stops changing; "Updated in the library" stays this long. */
const SOURCES_MS = 700
const UPDATED_MS = 4000

/** A notice in the deck's bar, with one action (Undo) when it has one. */
interface Notice {
  text: string
  action?: { label: string; tip: string; run: () => void }
}

/** A part to put in the deck: its slide block's kind and body, its handout, and its notes when it keeps some. */
interface NewPart {
  kind: string
  body: string
  handout: string
  notes?: string | null
}

function isNewPart(value: unknown): value is NewPart {
  const part = value as Record<string, unknown> | null
  return !!part && typeof part.kind === 'string' && typeof part.body === 'string' && typeof part.handout === 'string'
}

/**
 * Parts as the editor's own nodes: written as the file would hold them and read through the document's own Markdown
 * pipeline, so a copy is what loading the deck would make of it. The HTML is read in an inert document, never put into
 * the page. Each slide gets a paragraph after it when its handout is empty, as a new slide does.
 */
function partsFragment(editor: TipTapEditor, parts: NewPart[], imageMappings: Record<string, string>): Fragment | null {
  const markdown = parts
    .map(part => [writeSlideBlock(part.kind, part.body, part.notes ?? null), part.handout.trim()].filter(Boolean).join('\n\n'))
    .join('\n\n')
  let html: string
  try {
    html = markdownToEditorHTML(`${markdown}\n`, imageMappings)
  } catch {
    return null
  }
  const body = new window.DOMParser().parseFromString(html, 'text/html').body
  const content = PMDOMParser.fromSchema(editor.schema).parseSlice(body).content
  const nodes: PMNode[] = []
  content.forEach((node, _offset, index) => {
    nodes.push(node)
    const next = index + 1 < content.childCount ? content.child(index + 1) : null
    if (isSlideNode(node) && (!next || isSlideNode(next))) nodes.push(editor.schema.nodes.paragraph.create())
  })
  return nodes.filter(isSlideNode).length === parts.length ? Fragment.fromArray(nodes) : null
}

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
  /** The deck's front matter (its theme and its look), and the change of it. */
  properties: DocumentProperties
  onPropertiesChange: (properties: DocumentProperties) => void
}

/** The stage's width for a desk width, the handout's ratio and what is shown. */
export function stageWidthFor(avail: number, ratio: number, handoutShown: boolean): number {
  if (!handoutShown) return avail
  return Math.max(0, Math.min(avail - HANDOUT_MIN, Math.max(STAGE_MIN, Math.round(avail * ratio))))
}

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
  properties,
  onPropertiesChange,
}: DeckViewProps) {
  const [editor, setEditor] = useState<TipTapEditor | null>(null)
  const [slides, setSlides] = useState<DeckSlideEntry[]>([])
  const [current, setCurrent] = useState(0)
  const [stripWanted, setStripWanted] = useState(true)
  const [handoutWanted, setHandoutWanted] = useState(true)
  const [notesOpen, setNotesOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsAt, setSettingsAt] = useState<{ left: number; top: number } | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  // The Slide library (PR 4): each copy's source, by the slide's id; the copy just written to the library; and the
  // copies whose library write or read is on its way.
  const [sources, setSources] = useState<Record<string, CopySource>>({})
  const [justUpdated, setJustUpdated] = useState<string | null>(null)
  const [busy, setBusy] = useState<Record<string, true>>({})
  // The deck's text as this view holds it, sent with a library request: the document may not have its newest words yet.
  const contentRef = useRef(content)
  contentRef.current = content
  // A library write's Undo: the copy's `from:` and `kept` before it, put back once the host says the library is back.
  const undoneFrom = useRef(new Map<string, { id: string; from: string | undefined; kept: boolean | undefined }>())
  const [focusTitleOf, setFocusTitleOf] = useState<number | null>(null)
  const lineHintShown = useRef(false)
  const [ratio, setRatio] = useState(DEFAULT_RATIO)
  const [deskWidth, setDeskWidth] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [bar, setBar] = useState<{ left: number; top: number; height: number } | null>(null)
  const deskRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const lockUntil = useRef(0)
  const currentRef = useRef(0)
  const assets = useDeckAssets(slides)
  const theme = useDeckTheme(properties.theme)
  // Card or Borderless is the deck's own choice, in its front matter (Jarmo, 15 November: both are offered).
  const borderless = properties.look === 'borderless'
  const setLook = useCallback((look: string) => {
    const next: DocumentProperties = { ...properties }
    if (look === 'borderless') next.look = 'borderless'
    else delete next.look
    onPropertiesChange(next)
  }, [properties, onPropertiesChange])

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

  /** Part `index`'s slide id, given one first when it has none (the library and pictures find a slide by its id). */
  const idOf = useCallback((index: number): string | null => {
    if (!editor) return null
    const entry = slidesOf(editor.state.doc)[index]
    if (!entry) return null
    if (entry.data.id) return entry.data.id
    const id = newId(slidesOf(editor.state.doc).map(other => other.data.id).filter((value): value is string => !!value))
    const tr = updateSlide(editor.state, index, { ...entry.data, id })
    if (tr) editor.view.dispatch(tr)
    return id
  }, [editor])

  // ---- the strip's operations: each one transaction, so Undo takes it back whole
  const dispatch = useCallback((tr: Transaction | null) => {
    if (tr && editor && !editor.isDestroyed) editor.view.dispatch(tr)
    return !!tr
  }, [editor])

  const stripActions = useMemo<StripActions>(() => ({
    pick,
    insert: (at, kind) => {
      if (!editor || !dispatch(insertSlide(editor.state, at, kind))) return
      setFocusTitleOf(at)
      requestAnimationFrame(() => pick(at))
    },
    duplicate: index => {
      if (editor && dispatch(duplicateSlide(editor.state, index))) requestAnimationFrame(() => pick(index + 1))
    },
    toggleSkip: index => {
      if (!editor) return
      const entry = slidesOf(editor.state.doc)[index]
      if (entry) dispatch(updateSlide(editor.state, index, { ...entry.data, skip: entry.data.skip ? undefined : true }))
    },
    remove: index => {
      if (!editor) return
      const content = partContent(editor.state.doc, index)
      if (!content || !dispatch(deleteSlide(editor.state, index))) return
      setNotice({
        text: `Slide ${index + 1} is deleted`,
        action: {
          label: 'Undo',
          tip: 'Put the slide back',
          run: () => {
            // The deleted part itself goes back where it was; what was done since stays. Only while the slide is
            // still gone: Cmd+Z may have put it back already.
            const id = content.firstChild ? slideDataOf(content.firstChild.attrs.body).id : undefined
            const back = !!id && slidesOf(editor.state.doc).some(entry => entry.data.id === id)
            if (!back && !editor.isDestroyed) {
              dispatch(restoreSlide(editor.state, index, content))
              requestAnimationFrame(() => pick(index))
            }
          },
        },
      })
      const left = slidesOf(editor.state.doc).length
      requestAnimationFrame(() => pick(Math.min(index, left - 1)))
    },
    move: (from, to) => {
      if (editor && dispatch(moveSlide(editor.state, from, to))) requestAnimationFrame(() => pick(to > from ? to - 1 : to))
    },
    addToLibrary: index => {
      const id = idOf(index)
      if (!id) return
      setBusy(value => ({ ...value, [id]: true }))
      // The id may have just been given: the text is read after that change.
      requestAnimationFrame(() => sendToExtension('deck/add-to-library', { id, text: editor && !editor.isDestroyed ? editorHTMLToMarkdown(editor.getHTML()) : contentRef.current }))
    },
    showInLibrary: index => {
      const from = editor ? slidesOf(editor.state.doc)[index]?.data.from : undefined
      if (from) sendToExtension('deck/show-in-library', { from })
    },
  }), [editor, dispatch, pick, idOf])

  // A notice in the bar fades after a while.
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [notice])

  // A line typed in the handout stays a line in this cut; the first time, one quiet hint says how a slide is added.
  useEffect(() => {
    if (!editor) return
    const onTransaction = ({ transaction }: { transaction: Transaction }) => {
      if (lineHintShown.current || !transaction.docChanged || isTrustedDeckTransaction(transaction)) return
      // Only what the steps put in is looked at, not the whole deck.
      const addsLine = transaction.steps.some(step => {
        let found = false
        ;(step as { slice?: Slice }).slice?.content.descendants(node => {
          if (node.type.name === 'horizontalRule') found = true
          return !found
        })
        return found
      })
      if (addsLine) {
        lineHintShown.current = true
        setNotice({ text: LINE_HINT })
      }
    }
    editor.on('transaction', onTransaction)
    return () => { editor.off('transaction', onTransaction) }
  }, [editor])

  // Settings beside the slide: closed when the slide changes, and placed beside it (over the handout when it must).
  useEffect(() => { setSettingsOpen(false) }, [shown])
  // The new slide's stage takes the caret when it mounts; the request is spent once that slide is the current one.
  useEffect(() => {
    if (focusTitleOf === null || focusTitleOf !== shown) return
    const frame = requestAnimationFrame(() => setFocusTitleOf(null))
    return () => cancelAnimationFrame(frame)
  }, [shown, focusTitleOf])
  useLayoutEffect(() => {
    if (!settingsOpen) { setSettingsAt(null); return }
    const desk = deskRef.current
    const big = desk?.querySelector<HTMLElement>('.deck-big')
    if (!desk || !big) return
    const deskBox = desk.getBoundingClientRect()
    const bigBox = big.getBoundingClientRect()
    setSettingsAt({
      left: Math.max(8, Math.min(bigBox.right - deskBox.left + 12, deskBox.width - SETTINGS_WIDTH - 8)),
      top: Math.max(8, bigBox.top - deskBox.top - 4),
    })
  }, [settingsOpen, deskWidth, stageWidth, shown])

  /** Settings' change, made to the slide as the document has it now. */
  const changeSlide = useCallback((change: (data: SlideData) => SlideData, kind?: string) => {
    if (!editor) return
    const entry = slidesOf(editor.state.doc)[shown]
    if (entry) dispatch(updateSlide(editor.state, shown, change(entry.data), kind))
  }, [editor, dispatch, shown])

  // A picture pasted or dropped on a slide: saved beside the deck by the host, then the slide shows it. A slide that
  // places no picture beside or behind its words becomes a Picture slide.
  const onPicture = useCallback((dataUrl: string, filename: string) => {
    if (!editor) return
    const id = idOf(shown)
    if (id) sendToExtension('deck/save-image', { slideId: id, dataUrl, filename })
  }, [editor, idOf, shown])

  useEffect(() => onMessage(message => {
    if (!editor || editor.isDestroyed) return
    if (message.type === 'deck/image-failed') {
      setNotice({ text: typeof message.message === 'string' ? message.message : 'The picture could not be saved.' })
      return
    }
    if (message.type !== 'deck/image-saved' || typeof message.slideId !== 'string' || typeof message.path !== 'string') return
    const index = slidesOf(editor.state.doc).findIndex(entry => entry.data.id === message.slideId)
    if (index < 0) return
    const entry = slidesOf(editor.state.doc)[index]
    const placed = entry.data.picture && entry.data.picture !== 'none'
    const kind = placed || entry.kind === 'picture' ? undefined : 'picture'
    dispatch(updateSlide(editor.state, index, kind ? { ...convertKind(entry.data, 'picture'), image: message.path } : { ...entry.data, image: message.path }, kind))
  }), [editor, dispatch])

  // ---- the Slide library (PR 4)

  /** The deck's text as this view holds it now, front matter left out (the host reads the slides from it). */
  const currentText = useCallback(() => (editor && !editor.isDestroyed ? editorHTMLToMarkdown(editor.getHTML()) : contentRef.current), [editor])

  // The host knows which slide is current, for the Slide library's "Insert after slide N".
  useEffect(() => {
    sendToExtension('deck/current', { index: shown, count })
  }, [shown, count])

  // Each copy's source, asked a moment after the deck stops changing, and again when the window comes back (another
  // deck may have updated the library meanwhile).
  const hasCopies = slides.some(entry => entry.data.from && entry.data.id)
  useEffect(() => {
    if (!hasCopies) { setSources({}); return }
    const timer = window.setTimeout(() => sendToExtension('deck/source-states'), SOURCES_MS)
    return () => window.clearTimeout(timer)
  }, [slides, hasCopies])
  useEffect(() => {
    const again = () => { if (hasCopies && document.visibilityState === 'visible') sendToExtension('deck/source-states') }
    window.addEventListener('focus', again)
    document.addEventListener('visibilitychange', again)
    return () => {
      window.removeEventListener('focus', again)
      document.removeEventListener('visibilitychange', again)
    }
  }, [hasCopies])

  useEffect(() => {
    if (!justUpdated) return
    const timer = window.setTimeout(() => setJustUpdated(null), UPDATED_MS)
    return () => window.clearTimeout(timer)
  }, [justUpdated])

  const marks = useMemo(() => {
    const result: Record<string, StripMark> = {}
    for (const [id, source] of Object.entries(sources)) result[id] = { library: source.library, newer: source.library && source.newer && !source.changed && !source.missing }
    return result
  }, [sources])

  const done = useCallback((id: string | null) => {
    if (id) setBusy(value => { const next = { ...value }; delete next[id]; return next })
  }, [])

  /** A slide by its id, as the document has it now: the document may have moved on since the request. */
  const slideById = useCallback((id: string) => {
    if (!editor) return null
    return slidesOf(editor.state.doc).find(entry => entry.data.id === id) ?? null
  }, [editor])

  const sourceActions = useMemo(() => {
    const ask = (type: string) => {
      const id = slide?.data.id
      if (!id) return
      setBusy(value => ({ ...value, [id]: true }))
      sendToExtension(type, { id, text: currentText() })
    }
    return {
      keepHere: () => changeSlide(data => ({ ...data, kept: true })),
      updateLibrary: () => ask('deck/update-library'),
      useLibrary: () => ask('deck/use-library'),
    }
  }, [slide, changeSlide, currentText])

  useEffect(() => onMessage(message => {
    if (!editor || editor.isDestroyed) return
    switch (message.type) {
      case 'deck/source-states': {
        if (!Array.isArray(message.states)) return
        const next: Record<string, CopySource> = {}
        for (const state of message.states as CopySource[]) if (state && typeof state.id === 'string') next[state.id] = state
        setSources(next)
        return
      }
      case 'deck/library-undone': {
        const back = typeof message.token === 'string' ? undoneFrom.current.get(message.token) : undefined
        if (!back) return
        undoneFrom.current.delete(message.token as string)
        const now = slideById(back.id)
        if (now) dispatch(updateSlide(editor.state, now.index, { ...now.data, from: back.from, kept: back.kept }))
        return
      }
      case 'deck/library-failed': {
        done(typeof message.id === 'string' ? message.id : null)
        setNotice({ text: typeof message.message === 'string' ? message.message : 'The Slide library could not do that.' })
        return
      }
      case 'deck/library-written': {
        const id = typeof message.id === 'string' ? message.id : null
        done(id)
        const entry = id ? slideById(id) : null
        if (!id || !entry || typeof message.from !== 'string') return
        const before = { from: entry.data.from, kept: entry.data.kept }
        const wasNewer = !!sources[id]?.newer
        dispatch(updateSlide(editor.state, entry.index, { ...entry.data, from: message.from, kept: undefined }))
        const token = typeof message.token === 'string' ? message.token : null
        const undo = token ? {
          label: 'Undo',
          tip: 'Put the library back as it was',
          run: () => {
            // The copy's from: goes back only once the library is back (the host refuses when it changed since).
            undoneFrom.current.set(token, { id, from: before.from, kept: before.kept })
            sendToExtension('deck/undo-library', { token })
          },
        } : undefined
        const name = typeof message.sourceName === 'string' ? message.sourceName : 'the library'
        if (message.verb === 'added') setNotice({ text: `Added to the library under ${name}.`, action: undo })
        else if (wasNewer) setNotice({ text: "The library's newer version is replaced by this one.", action: undo })
        else setJustUpdated(id)
        return
      }
      case 'deck/library-part': {
        const id = typeof message.id === 'string' ? message.id : null
        done(id)
        const entry = id ? slideById(id) : null
        if (!id || !entry || !isNewPart(message)) return
        const previous = partContent(editor.state.doc, entry.index)
        const content = partsFragment(editor, [{ kind: message.kind, body: message.body, handout: message.handout, notes: entry.notes }], imageMappings)
        if (!previous || !content || !dispatch(replacePart(editor.state, entry.index, content))) {
          setNotice({ text: "The library's version could not be put in." })
          return
        }
        const hadChange = !!sources[id]?.changed
        // Undo is always offered: words typed while the library was being read are in `previous` too.
        setNotice({
          text: hadChange ? "This slide is the library's newest version now. Your change here is gone." : "This slide is the library's newest version now.",
          action: {
            label: 'Undo',
            tip: 'Put this slide back as it was',
            run: () => {
              const now = slideById(id)
              if (now && !editor.isDestroyed) dispatch(replacePart(editor.state, now.index, previous))
            },
          },
        })
        return
      }
      case 'deck/insert': {
        const requestId = typeof message.requestId === 'string' ? message.requestId : null
        const answer = (ok: boolean) => { if (requestId) sendToExtension('deck/applied', { requestId, ok }) }
        const parts = Array.isArray(message.parts) ? message.parts.filter(isNewPart) : []
        if (parts.length === 0 || typeof message.after !== 'number') { answer(false); return }
        const current = slidesOf(editor.state.doc)
        const total = current.length
        const at = total === 0 ? 0 : Math.max(0, Math.min(total, Math.floor(message.after) + 1))
        // The host chose the copies' ids from the document, which may not have this view's newest slides yet: an id
        // that is taken here is renewed.
        const taken = new Set(current.map(entry => entry.data.id).filter((id): id is string => !!id))
        const fresh = parts.map(part => {
          const data = parseSlideBody(part.body)
          if (!data.id || !taken.has(data.id)) {
            if (data.id) taken.add(data.id)
            return part
          }
          const id = newId(taken)
          taken.add(id)
          return { ...part, body: writeSlideBody(part.body, { ...data, id }) }
        })
        const content = partsFragment(editor, fresh.map(part => ({ kind: part.kind, body: part.body, handout: part.handout })), imageMappings)
        if (!content || !dispatch(restoreSlide(editor.state, at, content))) {
          setNotice({ text: 'The slides could not be put in.' })
          answer(false)
          return
        }
        answer(true)
        requestAnimationFrame(() => pick(at))
        return
      }
      case 'deck/set-from': {
        const requestId = typeof message.requestId === 'string' ? message.requestId : null
        const entry = typeof message.id === 'string' ? slideById(message.id) : null
        const ok = !!entry && typeof message.from === 'string'
          && dispatch(updateSlide(editor.state, entry.index, { ...entry.data, from: message.from as string, kept: undefined }))
        if (requestId) sendToExtension('deck/applied', { requestId, ok })
        return
      }
    }
  }), [editor, dispatch, done, slideById, sources, imageMappings, pick])

  const status = documentBarStatus(syncState, syncAction)
  const handoutContainer = scrollContainer()
  // Writing on the slide keeps it the current one while the handout is still.
  const onWriting = useCallback(() => { lockUntil.current = Date.now() + WRITE_LOCK_MS }, [])

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
        <span className="deck-notice" role="status" aria-live="polite">
          {notice ? (
            <>
              <span className="deck-notice-text">{notice.text}</span>
              {notice.action ? (
                <Tooltip label={notice.action.tip}>
                  <Button
                    variant="link"
                    className="deck-line-action"
                    onClick={() => {
                      notice.action?.run()
                      setNotice(null)
                    }}
                  >
                    {notice.action.label}
                  </Button>
                </Tooltip>
              ) : null}
            </>
          ) : null}
        </span>
        <span className="flex-1" />
        <Tooltip label="How the slides look: as a card, or the whole column as the stage">
          <SegmentedControl
            aria-label="How the slides look"
            className="deck-look"
            value={borderless ? 'borderless' : 'card'}
            onValueChange={setLook}
            options={[{ value: 'card', label: 'Card' }, { value: 'borderless', label: 'Borderless' }]}
          />
        </Tooltip>
        <span className="sr-only" role="status" aria-live="polite">{syncAction?.label ?? ''}</span>
        {status === 'action' && syncAction ? (
          <SyncActionButton action={syncAction} />
        ) : (
          <span className={`deck-saved${status === 'saved' ? '' : ' invisible'}`}>Saved</span>
        )}
      </header>

      <div ref={deskRef} className="deck-desk">
        {stripShown ? (
          <SlideStrip
            slides={slides}
            current={shown}
            theme={theme}
            borderless={borderless}
            assets={assets}
            actions={stripActions}
            stripRef={stripRef}
            marks={marks}
          />
        ) : null}

        <div className={`deck-stage${borderless ? ' is-borderless' : ''}`} style={{ left: stripWidth, width: stageWidth }}>
          <div className="deck-stage-group">
            {editor && slide && bigWidth > 0 ? (
              <Stage
                // By the slide's id: a new slide at the current place is a new stage, which takes the caret.
                key={slide.data.id ?? `index-${slide.index}`}
                editor={editor}
                slide={slide}
                theme={theme}
                borderless={borderless}
                assets={assets}
                width={bigWidth}
                onWriting={onWriting}
                notesOpen={notesOpen}
                onNotesOpen={setNotesOpen}
                settingsOpen={settingsOpen}
                onSettings={() => setSettingsOpen(open => !open)}
                initialFocus={focusTitleOf === slide.index ? 'title' : undefined}
                onPicture={onPicture}
                sourceLines={slide.data.id && sources[slide.data.id] ? (
                  <SourceLines
                    source={sources[slide.data.id]}
                    kept={slide.data.kept === true}
                    justUpdated={justUpdated === slide.data.id}
                    busy={!!busy[slide.data.id]}
                    actions={sourceActions}
                  />
                ) : undefined}
              />
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

        {settingsOpen && slide && settingsAt ? (
          <SlideSettings
            number={shown + 1}
            kind={slide.kind}
            data={slide.data}
            style={{ left: settingsAt.left, top: settingsAt.top }}
            onKind={kind => changeSlide(data => convertKind(data, kind), kind)}
            onChange={patch => changeSlide(data => ({ ...data, ...patch }))}
            onClose={() => setSettingsOpen(false)}
          />
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
