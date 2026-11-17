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
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Editor as TipTapEditor } from '@tiptap/react'
import { Editor, TEXT_COLUMN_WIDTH } from '../Editor'
import { Button } from '../ui/button'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'
import { SyncActionButton } from '../header'
import { documentBarStatus, type DocumentSyncAction } from '../header/DocumentSyncAction'
import type { DocumentApplyTarget } from '../../types/documentSync'
import type { DocumentSyncState } from '../../../../src/editorSync/protocol'
import type { EditorSelection } from '../../types/editor'
import type { DocumentProperties } from '../properties'
import { onDocChanged } from '../../lib/docChange'
import type { SlideData } from '../../../../src/decks/deckFormat'
import { DECK_DERIVED, DECK_OPERATION, RATIO_MAX, RATIO_MIN, initialRatio, withDrawnHeadings, deleteSlide, derivedHeadings, partHeadingAt, duplicateSlide, handoutHasText, insertSlide, isSlideNode, moveSlide, partContent, partIndexAt, replacePart, restoreSlide, slideDataOf, slidesOf, updateSlide, updateSlideMarkdown, type DeckSlideEntry } from './deckDocument'
import { StartCard } from './StartCard'
import { deckStarted, startCardRows, type StartCardState } from '../../../../src/decks/startCard'
import { DOMParser as PMDOMParser, Fragment, type Node as PMNode } from '@tiptap/pm/model'
import { editorHTMLToMarkdown, markdownToEditorHTML } from '../../utils/editorMarkdown'
import { SourceLines, type CopySource } from './library/SourceLines'
import { AddToLibrarySheet, type LibraryTopic } from './library/AddToLibrarySheet'
import { onMessage, sendToExtension } from '../../bridge'
import { convertKind, hiddenNote } from './slide/convertKind'
import { setPath, undoKeyOf } from './slide/slideEdits'
import { SlideAbout, SlideSettings } from './SlideSettings'
import { ThemeMenu, themePickedNotice } from './ThemeMenu'
import { applicableChanges, propertyChangesOf, propertyTransaction, propertyValue, sameValue, withPropertyChanges } from './theme/themePick'
import { Popover, PopoverAnchor, PopoverContent } from '../ui/popover'
import { SlideMenuItems, SlideStrip, libraryBadge, type StripActions, type StripMark } from './SlideStrip'
import { DropdownMenu, DropdownMenuContent, MoreActionsTrigger } from '../ui/dropdown-menu'
import { TEXT_HANDOUT_KEY, TEXT_HANDOUT_VALUE, exerciseTagOf, isBlockSlide, newId, slideDataOf as readSlideData, withPartHeading, writeSlideBlock, writeSlideData } from '../../../../src/decks/deckFormat'
import type { Transaction } from '@tiptap/pm/state'
import { isHistoryTransaction, undoDepth } from '@tiptap/pm/history'
import { useDeckAssets, useDeckTheme } from './deckBridge'
import { PART_TOP_GAP, currentPart, scrollTopFor, wheelStop } from './scrollRule'
import { CURRENT_SLIDE_SETTLE_MS, currentSlideMessage } from './currentSlideMessage'
import { DeckGuard } from './handout/deckGuard'
import { CONVERSION_NOTICE, DeckConvert, commentNodeAt, conversionNoticeFor, conversionStateOf, needsConversion, pictureIntoSlide } from './handout/deckConvert'
import { commentBoxStorage } from '../../extensions/comment/CommentNode'
import { blockDataOf, drawsAsBlocks, saysBlockDeck, withStepsTag } from '../../../../src/decks/blocks/convertDeck'
import { blockStepsTagOf } from '../../../../src/decks/blocks/slideRenderer'
import { splitSlide } from './blocks/slideSplit'
import { hiddenWords } from '../../../../src/decks/blocks/legacyToBlocks'
import { DeckCurrent, setCurrentSlide } from './handout/deckCurrent'
import { DeckSlideWithPartHead, partMenuSlots, type PartMenuSlot } from './handout/SlidePartHead'
import { DECK_REMOVED, DeckRemove, joinMarkOf, removalNotice, type DeckRemoval } from './handout/deckRemove'
import { DeckLines } from './handout/deckLines'
import { DeckDrawnHeadings, handoutMarkFor, hasDrawnHeadings } from './handout/drawnHeadings'
import { Stage } from './Stage'
import { DeckComments, deckCommentStops, stopIndexOf } from './DeckComments'
import { PresentButton, usePresentKeys, type PresentFrom } from './present/PresentButton'
import { DeckPublish } from './DeckPublish'
import { DeckViewSwitch, deckViewState, foldOfView, foldedSides, keepDeckViewState, keepFold, storedFold, type DeckFold, type DeckViewMode } from './DeckFolds'
import { STAGE_MARGIN, aboveLineFor, clampAboveRatio, fullSlideWidthFor, initialAboveRatio, orientationFor, rowsUnder, slideWidthFor, type DeckOrientation } from './deckLayout'
import { NO_GESTURE, slideKeyOf, slideKeyTarget, wheelPixels, wheelStep, type KeyTargetElement } from './slideNav'
import './decks.css'

/** The deck's extensions, made once: the editor's extension list is fixed at mount. */
const DECK_EXTENSIONS = [DeckSlideWithPartHead, DeckGuard, DeckCurrent, DeckLines, DeckDrawnHeadings, DeckConvert, DeckRemove]

/** The strip's width (the prototype's 132). */
const STRIP_WIDTH = 132
/** The Add to library sheet beside the slide: its width (the Settings material), and how long a notice stays in the bar. */
const SETTINGS_WIDTH = 316
const NOTICE_MS = 8000
/** Sprint 161 (PR 3, frame 24): the bar's line while the slide on the stage is full. */
export const SLIDE_FULL = 'This slide is full: its words are at their smallest size.'
/** The handout is never narrower than this (the Experience lead's answer 4). */
const HANDOUT_MIN = 300
const STAGE_MIN = 300
/** Below this desk width the strip folds; below the next, the handout folds. (Both are rooms under 1,100, where the
 *  slide sits above the handout: deckLayout.ts.) */
const NARROW_DESK = 900
const NARROWEST_DESK = 600

/** The slide's share, as this deck's view kept it (`deckViewState`, with the fold): of the width with the slide beside
 *  the handout, and of the height with the slide above it. Each orientation keeps its own. */
const storedRatio = () => deckViewState().deckRatio
const keepRatio = (ratio: number) => keepDeckViewState({ deckRatio: ratio })
const storedAboveRatio = () => deckViewState().deckAboveRatio
const keepAboveRatio = (ratio: number) => keepDeckViewState({ deckAboveRatio: ratio })
/** How long a thumbnail's scroll holds the slide, and how long writing does (the prototype's `syncLock`). */
const PICK_LOCK_MS = 500
const WRITE_LOCK_MS = 1200
/** The copies' sources are asked again this long after the deck stops changing; "Updated in the library" stays this long. */
const SOURCES_MS = 700
const UPDATED_MS = 4000
/** The start card's distance below the first part's text, and above the room's end (frame 20). */
const START_CARD_GAP = 8

/** A notice in the deck's bar, with one action (Undo) when it has one. */
interface Notice {
  text: string
  action?: { label: string; tip: string; run: () => void }
  /** While this holds, the notice stands; once it doesn't (its Undo would take back something else), it goes. */
  valid?: () => boolean
  /** A join's line: the full slide's line stays beside it (the joined slide may be full). */
  withFull?: boolean
}

const NO_SLOTS: PartMenuSlot[] = []
/** How far below the handout's top a marked join's line sits, at least, so it and its note are seen. */
const JOIN_NOTE_ROOM = 12

/** What the Slide settings popover is anchored to: a thumbnail, a part number's ⋯, or a point (the slide's right-click). */
type SettingsAnchor = { getBoundingClientRect: () => DOMRect }

/** Where a Slide settings… came from: what to anchor to, on which side, and where the focus goes back. */
type SettingsPlace = { anchor: SettingsAnchor; side: 'right' | 'left'; back: HTMLElement | null }

/**
 * A part number's ⋯ in the handout (experience 46, "Removing a slide from the handout"): the strip's own slide menu, its
 * items and actions, for the slide whose part head holds the slot. Drawn into the head's slot (a portal); nothing when
 * the slot's slide isn't one of the deck's slides as this view last read them.
 */
interface PartMenuProps {
  slot: PartMenuSlot
  /** The slide's place (from 0), as this view last read the deck; -1 when the slot's slide isn't one of them. */
  index: number
  count: number
  skipped: boolean
  fromLibrary: boolean
  actions: StripActions
  onSettings: (index: number, slot: PartMenuSlot) => void
}

const PartMenu = memo(function PartMenu({ slot, index, count, skipped, fromLibrary, actions, onSettings }: PartMenuProps) {
  if (index < 0) return null
  return createPortal(
    <DropdownMenu modal={false}>
      <MoreActionsTrigger label={`Slide ${index + 1}: more actions`} className="deck-part-more-button" />
      <DropdownMenuContent align="end" side="bottom">
        <SlideMenuItems index={index} count={count} skipped={skipped} fromLibrary={fromLibrary} actions={{ ...actions, settings: at => onSettings(at, slot) }} />
      </DropdownMenuContent>
    </DropdownMenu>,
    slot.element,
  )
})

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
  // Making a part writes its heading (16 November): a part whose handout has none opens with its slide's title.
  const markdown = parts
    .map(part => [writeSlideBlock(part.kind, part.body, part.notes ?? null), withPartHeading(part.kind, readSlideData(part.kind, part.body), part.handout.trim())].filter(Boolean).join('\n\n'))
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
  /** The editor's Markdown; with a change of the deck's front matter when this edit makes it too (its `handout: text`
   *  mark), applied to the properties as they are then. */
  onChange: (value: string, properties?: (current: DocumentProperties) => DocumentProperties) => void
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
export function stageWidthFor(avail: number, ratio: number, handoutShown: boolean, slideShown = true): number {
  if (!slideShown) return 0
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
  // Fold either side (16 November): the slide, the handout, or neither, as this deck's view kept it.
  const [fold, setFold] = useState<DeckFold>(storedFold)
  // Slide settings… (17 November): the slide whose popover is open (-1: the deck's look alone, a deck with no slides),
  // where it is anchored and on which side; and where the focus goes back when it closes (where the menu was opened).
  const [settingsFor, setSettingsFor] = useState<{ index: number; id?: string; anchor: SettingsAnchor; side: 'right' | 'left' } | null>(null)
  const settingsAnchor = useRef<SettingsAnchor>({ getBoundingClientRect: () => new DOMRect() })
  if (settingsFor) settingsAnchor.current = settingsFor.anchor
  const settingsReturn = useRef<HTMLElement | null>(null)
  const [settingsAt, setSettingsAt] = useState<{ left: number; top: number } | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  // The Slide library (PR 4): each copy's source, by the slide's id; the copy just written to the library; and the
  // copies whose library write or read is on its way.
  const [sources, setSources] = useState<Record<string, CopySource>>({})
  const [justUpdated, setJustUpdated] = useState<string | null>(null)
  const [busy, setBusy] = useState<Record<string, true>>({})
  // Add to library: the sheet beside the slide, for this slide's id, and the library's topics once the host sends them.
  const [addSheet, setAddSheet] = useState<{ id: string; number: number } | null>(null)
  const [topics, setTopics] = useState<LibraryTopic[] | null>(null)
  // The deck's text as this view holds it, sent with a library request: the document may not have its newest words yet.
  const contentRef = useRef(content)
  contentRef.current = content
  // A library write's Undo: the copy's `from:` and `kept` before it, put back once the host says the library is back.
  const undoneFrom = useRef(new Map<string, { id: string; from: string | undefined; kept: boolean | undefined }>())
  // A slide whose title takes the caret once its stage is drawn (a new slide's), or is selected whole (a deck New made)
  const [focusTitleOf, setFocusTitleOf] = useState<{ index: number; select: boolean } | null>(null)
  // Sprint 161: the slide comment the bar's Previous and Next stand on, and the one it asked the stage to open.
  // By its key (Codex on #766): a comment added or deleted before it never moves Previous and Next.
  const [commentAtKey, setCommentAtKey] = useState<string | null>(null)
  const [commentOpen, setCommentOpen] = useState<{ slide: number; slideId?: string; ordinal: number; serial: number } | null>(null)
  // Once the stage has opened it, the request is forgotten: a slide shown again later opens nothing by itself.
  const commentOpened = useCallback((serial: number) => setCommentOpen(open => (open?.serial === serial ? null : open)), [])
  const commentSerial = useRef(0)
  // Sprint 159 (PR 7): the host asked to select the title slide's title, once the deck's slides are there
  const [selectTitle, setSelectTitle] = useState(false)
  const [ratio, setRatio] = useState(() => initialRatio(storedRatio()))
  const ratioRef = useRef(ratio)
  ratioRef.current = ratio
  const [aboveRatio, setAboveRatio] = useState(() => initialAboveRatio(storedAboveRatio()))
  const aboveRatioRef = useRef(aboveRatio)
  aboveRatioRef.current = aboveRatio
  const [deskWidth, setDeskWidth] = useState(0)
  const [deskHeight, setDeskHeight] = useState(0)
  // Beside or above (deckLayout.ts): decided from the room once it is measured, and again whenever it changes.
  const [orientation, setOrientation] = useState<DeckOrientation | null>(null)
  const [dragging, setDragging] = useState(false)
  const deskRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const lockUntil = useRef(0)
  const currentRef = useRef(0)
  const { assets, missing: missingPictures } = useDeckAssets(slides)
  const theme = useDeckTheme(properties.theme)
  // Card or Borderless is the deck's own choice, in its front matter (Jarmo, 15 November: both are offered). Since 16
  // November it was chosen in the Slide settings popover; since Sprint 162 in the Theme menu on the bar (ThemeMenu).
  const borderless = properties.look === 'borderless'
  // The deck's front matter as last written from here: a pick, its Undo and its Redo each change it from what it is now.
  const propertiesRef = useRef(properties)
  propertiesRef.current = properties
  // Sprint 162: the look is a step of the deck's Undo too, as a theme pick is (theme/themePick.ts), so Cmd+Z on the bar
  // after a change in the Theme menu takes back that change and nothing else. It writes the same `look: borderless` line.
  const setLook = useCallback((look: string) => {
    const before = propertyValue(propertiesRef.current, 'look')
    const after = look === 'borderless' ? { present: true, value: 'borderless' } : { present: false }
    if (sameValue(before, after)) return
    if (editor && !editor.isDestroyed) {
      editor.view.dispatch(propertyTransaction(editor.state, 'look', before, after))
      return
    }
    const next: DocumentProperties = { ...propertiesRef.current }
    if (look === 'borderless') next.look = 'borderless'
    else delete next.look
    onPropertiesChange(next)
  }, [editor, onPropertiesChange])

  // Publish on the bar (Sprint 159 PR 4) says its one line here: why a page wasn't written, or that the link is copied.
  const publishNotice = useCallback((text: string) => setNotice({ text }), [])

  const handleEditorReady = useCallback((instance: TipTapEditor) => {
    setEditor(instance)
    onEditorReady(instance)
  }, [onEditorReady])

  // The headings of parts without their own (every part of an older deck), drawn from the slides' titles (16
  // November): put in after the document arrives and after every host update, never as an edit, and never saved until
  // the person's first edit of the handout writes them (handout/drawnHeadings.ts). Opening a deck writes nothing. A
  // deck marked `handout: text` in its front matter is written that way already: nothing is drawn for it, so a heading
  // deleted stays deleted.
  const textHandout = properties[TEXT_HANDOUT_KEY] === TEXT_HANDOUT_VALUE
  const textHandoutRef = useRef(textHandout)
  textHandoutRef.current = textHandout
  const editorRef = useRef<TipTapEditor | null>(null)
  editorRef.current = editor
  // The mark this view wrote with the first edit: taken out again when Undo brings the drawn headings back.
  const markAdded = useRef(false)
  // Whether the document's last change was an undo or a redo (the mark is taken out only by one).
  const lastWasHistory = useRef(false)
  useEffect(() => {
    if (!editor) return
    const onTransaction = ({ transaction }: { transaction: Transaction }) => {
      if (transaction.docChanged) lastWasHistory.current = isHistoryTransaction(transaction)
    }
    editor.on('transaction', onTransaction)
    return () => { editor.off('transaction', onTransaction) }
  }, [editor])
  // Sprint 161 (PR 2): `deck: 2` is written with the first block slide (the conversion at the first real edit), in the
  // same change; an undo that brings this view's v1 slides back puts the deck's version back as it was.
  const deckVersionRef = useRef(properties.deck)
  deckVersionRef.current = properties.deck
  const versionBefore = useRef<{ value: unknown } | null>(null)
  const handleChange = useCallback((markdown: string) => {
    const marked = textHandoutRef.current
    const doc = editorRef.current?.state.doc
    const changes: Array<(properties: DocumentProperties) => DocumentProperties> = []
    const mark = handoutMarkFor({ marked, drawn: !doc || hasDrawnHeadings(doc), addedHere: markAdded.current, undo: lastWasHistory.current })
    if (mark === 'add') {
      // The first real edit of the handout: its headings are written, and the mark goes with them, in this one edit.
      // Nothing is drawn from now on, whatever runs before the view renders again.
      markAdded.current = true
      textHandoutRef.current = true
      changes.push(properties => ({ ...properties, [TEXT_HANDOUT_KEY]: TEXT_HANDOUT_VALUE }))
    } else if (mark === 'remove') {
      markAdded.current = false
      textHandoutRef.current = false
      changes.push(properties => {
        const next = { ...properties }
        delete next[TEXT_HANDOUT_KEY]
        return next
      })
    }
    const version = deckVersionRef.current
    const hasBlocks = !!doc && slidesOf(doc).some(entry => isBlockSlide(entry.kind))
    if (hasBlocks && !saysBlockDeck(version === undefined || version === null ? null : String(version))) {
      if (!versionBefore.current) versionBefore.current = { value: version }
      deckVersionRef.current = 2
      changes.push(properties => ({ ...properties, deck: 2 }))
    } else if (versionBefore.current && lastWasHistory.current && doc && !hasBlocks && needsConversion(doc)) {
      const before = versionBefore.current.value
      versionBefore.current = null
      deckVersionRef.current = before
      changes.push(properties => {
        const next = { ...properties }
        if (before === undefined) delete next.deck
        else next.deck = before as DocumentProperties[string]
        return next
      })
    }
    if (changes.length === 0) onChange(markdown)
    else onChange(markdown, properties => changes.reduce((current, change) => change(current), properties))
  }, [onChange])


  useEffect(() => {
    if (!editor) return
    let queued = false
    const draw = () => {
      queued = false
      if (editor.isDestroyed) return
      const tr = derivedHeadings(editor.state, textHandoutRef.current)
      if (tr) editor.view.dispatch(tr)
    }
    const later = () => {
      if (queued) return
      queued = true
      queueMicrotask(draw)
    }
    // The document as it arrives, again as the host replaces it, and after the strip's operations (a new slide's part
    // gets its heading drawn, following the title typed on the slide).
    const onTransaction = ({ transaction }: { transaction: Transaction }) => {
      if (!transaction.docChanged || transaction.getMeta(DECK_DERIVED) === true) return
      if (transaction.getMeta('preventUpdate') === true || transaction.getMeta('ritemarkDocumentRevision') !== undefined
        || transaction.getMeta(DECK_OPERATION) === true) later()
    }
    later()
    editor.on('transaction', onTransaction)
    return () => { editor.off('transaction', onTransaction) }
  }, [editor])

  // The slides, from the editor's document, after every change (the host's too); and whether the handout holds words.
  const [handoutText, setHandoutText] = useState(false)
  useEffect(() => {
    if (!editor) return
    const refresh = () => {
      setSlides(slidesOf(editor.state.doc))
      setHandoutText(handoutHasText(editor.state.doc))
    }
    refresh()
    return onDocChanged(editor, refresh)
  }, [editor])

  const count = slides.length
  const slideAtPos = useMemo(() => new Map(slides.map(entry => [entry.pos, entry])), [slides])

  // The handout's start card (16 November, the Experience lead's frame 20) on a deck New made: the host says whether
  // this deck is New's, which AI drafts it and the project's earlier decks. Once it goes it never comes back.
  const [startState, setStartState] = useState<StartCardState | null>(null)
  const [startGone, setStartGone] = useState(false)
  const [startAt, setStartAt] = useState<{ left: number; top: number; width: number } | null>(null)
  const startRef = useRef<HTMLDivElement | null>(null)
  const startRows = startState ? startCardRows({
    fresh: startState.fresh,
    dismissed: startGone,
    slideCount: count,
    handoutHasText: handoutText,
    aiReady: !!startState.ai,
    earlierCount: startState.earlier.length,
  }) : null
  // Draft and a copy wait for the host's answer, the card's rows held meanwhile: the card goes once the row was used,
  // and stays (the bar says why) when nothing was done.
  const [startBusy, setStartBusy] = useState(false)
  useEffect(() => {
    if (!editor) return
    const off = onMessage(message => {
      if (message.type !== 'deck/start-card' || !message.state || typeof message.state !== 'object') return
      setStartState(message.state as StartCardState)
      setStartBusy(false)
    })
    sendToExtension('deck/start-card')
    return off
  }, [editor])
  // The card goes for good once the deck is started (a second slide, words in the handout), and the host forgets it.
  const started = count > 0 && deckStarted(count, handoutText)
  useEffect(() => {
    if (!startState?.fresh || startGone || !started) return
    setStartGone(true)
    sendToExtension('deck/start-card-gone')
  }, [startState, startGone, started])
  // While it shows without an Ask row, the AI's sign-in is read again when the window comes back (the person may have
  // signed in meanwhile).
  const startShown = !!startRows
  const askAgain = startShown && !startState?.ai && !startBusy
  useEffect(() => {
    if (!askAgain) return
    const again = () => { if (document.visibilityState === 'visible') sendToExtension('deck/start-card') }
    window.addEventListener('focus', again)
    return () => window.removeEventListener('focus', again)
  }, [askAgain])
  const hideStart = useCallback(() => {
    setStartGone(true)
    sendToExtension('deck/start-card-gone')
  }, [])
  const startWith = useCallback((type: 'deck/start-draft' | 'deck/start-copy', fields: Record<string, unknown>) => {
    setStartBusy(true)
    sendToExtension(type, fields)
  }, [])
  const countRef = useRef(count)
  countRef.current = count
  const slidesRef = useRef(slides)
  slidesRef.current = slides
  const shown = count === 0 ? 0 : Math.min(current, count - 1)
  const slide = slides[shown]

  // The desk's own box decides what fits: never the window's, which holds the left column and the AI column too.
  useLayoutEffect(() => {
    const desk = deskRef.current
    if (!desk) return
    const measure = () => {
      setDeskWidth(desk.clientWidth)
      setDeskHeight(desk.clientHeight)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(desk)
    measure()
    return () => observer.disconnect()
  }, [])

  const narrow = deskWidth > 0 && deskWidth < NARROW_DESK
  const stripShown = stripWanted && !narrow
  const { slideShown, handoutShown } = foldedSides(fold, !(deskWidth > 0 && deskWidth < NARROWEST_DESK))
  const slideShownRef = useRef(slideShown)
  slideShownRef.current = slideShown
  const stripWidth = stripShown ? STRIP_WIDTH : 0
  // The deck's room: the desk less the strip. Opening or folding any panel, or resizing the window, decides again.
  const avail = Math.max(0, deskWidth - stripWidth)
  useLayoutEffect(() => {
    if (deskWidth > 0) setOrientation(shownNow => orientationFor(avail, shownNow))
  }, [avail, deskWidth])
  const above = orientation === 'above'
  const split = slideShown && handoutShown
  // Above: the slide's pane over the level line, the handout under it, both the room's full width.
  const aboveLine = above && split ? aboveLineFor(deskHeight, aboveRatio) : 0
  const stageWidth = above ? (slideShown ? avail : 0) : stageWidthFor(avail, ratio, handoutShown, slideShown)
  const stageHeight = above && split ? aboveLine : deskHeight
  // Above, the slide takes its pane's height less 32 and less whatever row is still under it (today the speaker notes'),
  // measured from the stage as drawn, so the stage never overflows its pane. With no row under it, it's the pane less 32.
  const [aboveUnder, setAboveUnder] = useState(0)
  // Slide only gives the slide the whole room (the design; Jarmo, 17 November: "align slide to center... and fill the
  // space"): the largest 16:9 between the strip and the AI pane, centred both ways, never the side-by-side 900 cap. A
  // row under it, if any, scrolls with the stage as beside: sizing by it would shrink the slide as the row wraps (review).
  const slideAlone = slideShown && !handoutShown
  const bigWidth = slideAlone ? fullSlideWidthFor(stageWidth, stageHeight) : slideWidthFor(stageWidth, stageHeight, above, aboveUnder)
  useLayoutEffect(() => {
    if (!above || slideAlone) return
    const group = stageRef.current?.querySelector<HTMLElement>('.deck-stage-group')
    const big = group?.querySelector<HTMLElement>('.deck-big')
    if (!group || !big) return
    const under = rowsUnder(group.offsetHeight, big.offsetHeight)
    // Only a real change, so a row that wraps differently at the new width can't set the size swinging.
    if (Math.abs(under - aboveUnder) > 1) setAboveUnder(under)
  })
  /** The handout's left edge; beside, the line between the slide and the handout too. */
  const dividerLeft = above ? stripWidth : stripWidth + stageWidth
  /** What the view switch shows chosen: the view as drawn (under 600 px the handout has no room, so Slide only). */
  const viewShown: DeckViewMode = !handoutShown ? 'slide' : !slideShown ? 'handout' : 'both'

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

  // Sprint 161 (review of #766, round 2): a comment the bar asked for that its slide hasn't opened yet is forgotten as
  // soon as another slide is current, so that slide never opens it by itself later.
  useEffect(() => {
    if (!commentOpen) return
    const here = commentOpen.slideId !== undefined ? commentOpen.slideId === slide?.data.id : commentOpen.slide === shown
    if (!here) setCommentOpen(null)
  }, [commentOpen, shown, slide])

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

  // The room below the text, so the last part can be scrolled to the top; and the start card's place under the text.
  const measureBar = useCallback(() => {
    const tops = partTops()
    const container = scrollContainer()
    if (!container || !editor || tops.length === 0) return
    // Room below the text so the last part can be scrolled to the top, and no more (the prototype's `.hand`
    // padding): every part can then become the current one by scrolling.
    const dom = editor.view.dom
    const origin = container.getBoundingClientRect().top - container.scrollTop
    const style = getComputedStyle(dom)
    const padding = parseFloat(style.paddingBottom) || 0
    const textEnd = dom.getBoundingClientRect().bottom - origin - padding
    const lastHeight = textEnd - tops[tops.length - 1]
    // The start card sits in that room, under the text: the room is never shorter than the card
    const card = startShown ? (startRef.current?.offsetHeight ?? 0) + START_CARD_GAP * 2 : 0
    const room = Math.round(Math.max(40, card, container.clientHeight - lastHeight - PART_TOP_GAP))
    if (Math.abs(room - padding) > 1) dom.style.setProperty('padding-bottom', `${room}px`, 'important')
    // The card's sides are the text's own edges (frame 20: 48 left, 32 right), never the column's.
    const box = dom.getBoundingClientRect()
    const left = Math.round(box.left - container.getBoundingClientRect().left + (parseFloat(style.paddingLeft) || 0))
    const width = Math.round(box.width - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0))
    const next = startShown ? { left, width, top: Math.round(textEnd + START_CARD_GAP) } : null
    setStartAt(at => (at && next && at.left === next.left && at.width === next.width && at.top === next.top) || at === next ? at : next)
  }, [partTops, scrollContainer, editor, startShown])

  useEffect(() => {
    measureBar()
    if (!editor) return
    const observer = new ResizeObserver(() => measureBar())
    observer.observe(editor.view.dom)
    // The handout's own height sets the room below the text too (a taller window, a folded bar).
    const container = scrollContainer()
    if (container) observer.observe(container)

    return () => observer.disconnect()
  }, [editor, measureBar, slides])
  // The start card's own height (All decks… shows the rest) changes the room under the text.
  const startPlaced = startShown && !!startAt
  useEffect(() => {
    const card = startRef.current
    if (!startPlaced || !card) return
    const observer = new ResizeObserver(() => measureBar())
    observer.observe(card)
    return () => observer.disconnect()
  }, [startPlaced, measureBar])

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
    // One turn of the wheel moves the slide on by one at most, so a short part (a title alone) is never skipped
    // (Jarmo, 15 November). The turn is cut short where the next part is the current one, and that part is shown at once.
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || Date.now() < lockUntil.current) return
      const delta = wheelPixels(event, container.clientHeight)
      const state = { partTops: partTops(), scrollTop: container.scrollTop, clientHeight: container.clientHeight, scrollHeight: container.scrollHeight, writing: null }
      const stop = wheelStop(state, delta, currentRef.current)
      if (stop === null) return
      event.preventDefault()
      container.scrollTop = stop
      const next = currentPart({ ...state, scrollTop: container.scrollTop })
      if (next !== null && next !== currentRef.current) makeCurrent(next)
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    container.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      container.removeEventListener('scroll', onScroll)
      container.removeEventListener('wheel', onWheel)
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [scrollContainer, partTops, makeCurrent])

  // Writing in a part makes its slide the current one: the caret in its heading or its text.
  useEffect(() => {
    if (!editor) return
    const fromSelection = () => {
      if (!editor.isFocused) return
      const index = partIndexAt(editor.state.doc, editor.state.selection.from)
      if (index === null) return
      lockUntil.current = Date.now() + WRITE_LOCK_MS
      if (index !== currentRef.current) makeCurrent(index)
    }
    editor.on('selectionUpdate', fromSelection)
    editor.on('update', fromSelection)
    return () => {
      editor.off('selectionUpdate', fromSelection)
      editor.off('update', fromSelection)
    }
  }, [editor, makeCurrent])

  /** A thumbnail: its slide becomes current and the handout scrolls to its part. */
  const pick = useCallback((index: number) => {
    lockUntil.current = Date.now() + PICK_LOCK_MS
    makeCurrent(index)
    // Told even when this slide was already current: a + menu's "From the library…" may have moved the host's insert
    // point to a gap, and picking a slide brings it back to the slide.
    sendToExtension('deck/current', { index, count: countRef.current })
    const container = scrollContainer()
    const tops = partTops()
    if (container && tops[index] !== undefined) container.scrollTop = scrollTopFor(tops[index])
  }, [makeCurrent, partTops, scrollContainer])

  // Sprint 161: the comments on the slides, for the bar's count and its Previous and Next. Going to one makes its slide
  // the current one and opens its card there, latched under what it is on.
  const commentStops = useMemo(() => (commentCallouts ? deckCommentStops(slides) : []), [commentCallouts, slides])
  const goToComment = useCallback((index: number) => {
    const stop = commentStops[index]
    if (!stop) return
    setCommentAtKey(stop.key)
    if (stop.slide !== currentRef.current) pick(stop.slide)
    commentSerial.current += 1
    setCommentOpen({ slide: stop.slide, slideId: slides[stop.slide]?.data.id, ordinal: stop.ordinal, serial: commentSerial.current })
  }, [commentStops, pick, slides])

  // The conversion's line in the bar (PR 2; the Experience lead on #765): "Old notes are now comments in the handout."
  // with Show, once per deck (this view keeps that it said it), and only when old notes or hidden words became comments.
  const showConvertedComment = useCallback((note: string) => {
    if (!editor || editor.isDestroyed) return
    const pos = commentNodeAt(editor.state.doc, note)
    if (pos === null) return
    const index = partIndexAt(editor.state.doc, pos)
    if (index !== null) pick(index)
    // The comment opens latched in the margin, as a click on its marker opens it, scrolled into view.
    requestAnimationFrame(() => {
      const storage = commentBoxStorage(editor)
      const now = commentNodeAt(editor.state.doc, note)
      if (!storage || now === null) return
      storage.openRequest = { key: `n:${now}`, as: 'latched' }
      storage.notifyRail?.()
    })
  }, [editor, pick])
  // The conversion whose line the bar said (its count), so a removal made in the same edit keeps that line, once per deck.
  const conversionSaid = useRef(-1)
  useEffect(() => {
    if (!editor) return
    let seen = conversionStateOf(editor.state).count
    const onTransaction = () => {
      const state = conversionStateOf(editor.state)
      if (state.count === seen) return
      seen = state.count
      const said = conversionNoticeFor(state.last, deckViewState().deckConversionNoticed === true)
      if (!said) return
      keepDeckViewState({ deckConversionNoticed: true })
      conversionSaid.current = state.count
      setNotice({
        text: said.text,
        action: { label: 'Show', tip: 'Show the first of them in the handout', run: () => showConvertedComment(said.firstComment) },
      })
    }
    editor.on('transaction', onTransaction)
    return () => { editor.off('transaction', onTransaction) }
  }, [editor, showConvertedComment])

  // Removing a slide from the handout (experience 46): Backspace in an empty part says "Slide 14 is deleted.", the
  // join's second press "Slide 14 is joined to slide 13.", each with Undo, which is the deck's own Undo of that one step
  // (the removal is an undo step of its own: handout/deckRemove.ts). Once anything else is done or undone, the notice
  // goes: its Undo would take back something else. The first press of a join lights up the lower slide's thumbnail.
  const [joinAt, setJoinAt] = useState<number | null>(null)
  const noticeRef = useRef<Notice | null>(null)
  noticeRef.current = notice
  useEffect(() => {
    if (!editor) return
    let conversions = conversionStateOf(editor.state).count
    const onTransaction = ({ transaction }: { transaction: Transaction }) => {
      // A removal that converted a deck of today's slides (its first real edit) keeps the conversion's line too: the
      // conversion's own notice, said a moment before, would otherwise be replaced, and it is said once per deck.
      const conversion = conversionStateOf(editor.state)
      const convertedHere = conversion.count !== conversions
      conversions = conversion.count
      const mark = joinMarkOf(editor.state)
      // A join that can't be made lights nothing up on the strip: its note says why.
      setJoinAt(mark && !mark.blocked ? mark.index : null)
      const removal = transaction.getMeta(DECK_REMOVED) as DeckRemoval | undefined
      if (removal) {
        // The slide whose part holds the caret now (the part above) is the current one, held as writing holds it, so
        // the handout settling under the removed part never makes another slide current.
        const at = partIndexAt(editor.state.doc, editor.state.selection.from)
        if (at !== null) {
          lockUntil.current = Date.now() + WRITE_LOCK_MS
          makeCurrent(at)
        }
        const depth = undoDepth(editor.state)
        const valid = () => !editor.isDestroyed && undoDepth(editor.state) === depth
        const converted = convertedHere && conversionSaid.current === conversion.count ? ` ${CONVERSION_NOTICE}` : ''
        setNotice({
          text: `${removalNotice(removal)}${converted}`,
          valid,
          withFull: removal.what === 'joined',
          action: {
            label: 'Undo',
            tip: removal.what === 'joined' ? `Bring slide ${removal.number} back as it was` : 'Put the slide back',
            run: () => { if (valid()) editor.commands.undo() },
          },
        })
        return
      }
      const shown = noticeRef.current
      if (transaction.docChanged && shown?.valid && !shown.valid()) setNotice(null)
    }
    editor.on('transaction', onTransaction)
    return () => { editor.off('transaction', onTransaction) }
  }, [editor, makeCurrent])
  // The first press of a join shows its line and note: a part scrolled to the top keeps its line just out of view, so
  // the handout moves down by what it takes to show them, holding the current slide as writing holds it.
  useEffect(() => {
    if (joinAt === null || !editor) return
    const container = editor.view.dom.closest('.wysiwyg-editor') as HTMLElement | null
    const head = editor.view.dom.querySelector<HTMLElement>('.deck-part-head.is-join')
    if (!container || !head) return
    const top = head.getBoundingClientRect().top - container.getBoundingClientRect().top
    if (top >= JOIN_NOTE_ROOM) return
    lockUntil.current = Date.now() + WRITE_LOCK_MS
    container.scrollTop = Math.max(0, container.scrollTop - (JOIN_NOTE_ROOM - top))
  }, [joinAt, editor])
  // The part numbers' ⋯ (one menu in each part head's slot, the strip's own items and actions).
  const partSlots = useSyncExternalStore(
    useCallback((listener: () => void) => (editor ? partMenuSlots.subscribe(editor, listener) : () => {}), [editor]),
    useCallback(() => (editor ? partMenuSlots.get(editor) : NO_SLOTS), [editor]),
  )

  // Present (Sprint 159): from the current slide or from the start, on the wall; Stop brings the deck back to the slide
  // the presenter ended on.
  const present = useCallback((from: PresentFrom) => {
    if (countRef.current === 0) return
    sendToExtension('deck/present', { from, index: Math.max(0, Math.min(currentRef.current, countRef.current - 1)) })
  }, [])
  usePresentKeys(present, count > 0)
  useEffect(() => onMessage(message => {
    if (message.type === 'deck/present-ended' && typeof message.index === 'number' && Number.isInteger(message.index)) {
      const index = Math.max(0, Math.min(message.index, countRef.current - 1))
      requestAnimationFrame(() => pick(index))
    } else if (message.type === 'deck/present-failed' && typeof message.message === 'string') {
      setNotice({ text: message.message })
    }
  }), [pick])
  const startNumber = slides.find(entry => entry.data.skip !== true)?.index

  // The line between the slide and the handout is dragged to change the widths.
  const onDividerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const desk = deskRef.current
    if (!desk) return
    const target = event.currentTarget
    target.setPointerCapture(event.pointerId)
    setDragging(true)
    const move = (moveEvent: PointerEvent) => {
      const box = desk.getBoundingClientRect()
      // Above, the level line moves the share of the height; beside, the upright line the share of the width.
      if (above) {
        // The share kept is the line as shown, held 160 px from either edge, so it comes back where it was seen.
        if (box.height > 0) setAboveRatio(clampAboveRatio(aboveLineFor(box.height, (moveEvent.clientY - box.top) / box.height) / box.height))
        return
      }
      const x = moveEvent.clientX - box.left - stripWidth
      if (avail > 0) setRatio(Math.max(RATIO_MIN, Math.min(RATIO_MAX, x / avail)))
    }
    const up = () => {
      setDragging(false)
      if (above) keepAboveRatio(aboveRatioRef.current)
      else keepRatio(ratioRef.current)
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
      target.removeEventListener('pointercancel', up)
      // The part being read stays at the top after the widths change.
      requestAnimationFrame(() => pick(currentRef.current))
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
    target.addEventListener('pointercancel', up)
  }, [above, avail, stripWidth, pick])

  /** The view switch (17 November): Slide only, Slide and handout, or Handout only; the deck's view keeps the choice,
   *  and the part being read stays at the top. Slide settings stay: they belong to the current slide, which the strip
   *  still rings. */
  const chooseView = useCallback((view: DeckViewMode) => {
    const next = foldOfView(view)
    setFold(next)
    keepFold(next)
    requestAnimationFrame(() => pick(currentRef.current))
  }, [pick])

  // When the slide moves beside or above, the part being read stays at the top, as after a drag or a fold. Not at the
  // first decision, as the deck opens.
  const orientationShown = useRef<DeckOrientation | null>(null)
  useEffect(() => {
    if (orientation === null) return
    const before = orientationShown.current
    orientationShown.current = orientation
    if (before === null || before === orientation) return
    const frame = requestAnimationFrame(() => pick(currentRef.current))
    return () => cancelAnimationFrame(frame)
  }, [orientation, pick])

  // The full slide view (Jarmo, 16 November): with the handout hidden, the wheel over the slide and the keys move
  // between slides (slideNav.ts), through the strip's own path. With the handout shown, the scroll rule stays.
  const fullSlide = slideShown && !handoutShown
  const goTo = useCallback((index: number) => {
    const count = countRef.current
    if (count === 0) return
    const next = Math.max(0, Math.min(count - 1, index))
    if (next !== Math.min(currentRef.current, count - 1)) pick(next)
  }, [pick])
  useEffect(() => {
    const stage = stageRef.current
    if (!fullSlide || !stage) return
    let gesture = NO_GESTURE
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
      const target = event.target as Element | null
      // A stage taller than its room (a short window) still scrolls, outside the slide itself.
      if (stage.scrollHeight > stage.clientHeight + 1 && !target?.closest?.('.deck-big')) return
      event.preventDefault()
      const step = wheelStep(gesture, wheelPixels(event, stage.clientHeight), event.timeStamp)
      gesture = step.gesture
      if (step.move !== 0) goTo(Math.min(currentRef.current, countRef.current - 1) + step.move)
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [fullSlide, goTo])
  useEffect(() => {
    if (!fullSlide) return
    const onKey = (event: KeyboardEvent) => {
      // A dialog or sheet over the deck keeps its keys.
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return
      const index = slideKeyOf(event, slideKeyTarget(event.target as KeyTargetElement | null, document.body), countRef.current, currentRef.current)
      if (index === null) return
      event.preventDefault()
      goTo(index)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullSlide, goTo])

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

  /**
   * Slide settings… from a slide's menu (17 November): the slide is made current (its part scrolled to, unless it is
   * the current one already), then, once the menu has closed and handed its focus back, the popover opens beside where
   * the menu came from.
   */
  const openSettings = useCallback((index: number, place: () => SettingsPlace | null) => {
    if (index !== currentRef.current) pick(index)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const where = place()
      if (!where) return
      settingsReturn.current = where.back
      // The slide's id too, so a popover never shows or changes another slide that came to stand at its number.
      const id = editor ? slidesOf(editor.state.doc)[index]?.data.id : undefined
      setSettingsFor({ index, id, anchor: where.anchor, side: where.side })
    }))
  }, [pick, editor])
  /** From a part number's ⋯: beside the number (on its left, so the number stays in view), the focus back to its ⋯. */
  const partSettings = useCallback((index: number, slot: PartMenuSlot) => openSettings(index, () => (
    slot.element.isConnected
      ? { anchor: slot.element.parentElement?.querySelector<HTMLElement>('.deck-part-number') ?? slot.element, side: 'left', back: slot.element.querySelector('button') }
      : null
  )), [openSettings])
  /** From the slide's own right-click menu: at the point it was opened, the focus back to the slide's words. */
  const stageSettings = useCallback((at: { x: number; y: number }) => openSettings(currentRef.current, () => ({
    anchor: { getBoundingClientRect: () => new DOMRect(at.x, at.y, 0, 0) },
    side: 'right',
    // A slide of a kind this build doesn't know has no editor of its own: the strip takes the focus then.
    back: stageRef.current?.querySelector<HTMLElement>('.ProseMirror') ?? stripRef.current,
  })), [openSettings])

  // ---- the strip's operations: each one transaction, so Undo takes it back whole
  const dispatch = useCallback((tr: Transaction | null) => {
    if (tr && editor && !editor.isDestroyed) editor.view.dispatch(tr)
    return !!tr
  }, [editor])

  const stripActions = useMemo<StripActions>(() => ({
    pick,
    insert: (at, kind) => {
      if (!editor || !dispatch(insertSlide(editor.state, at, kind, Math.random, textHandoutRef.current))) return
      if (slideShownRef.current) {
        setFocusTitleOf({ index: at, select: false })
        requestAnimationFrame(() => pick(at))
        return
      }
      // With the slide folded away, the caret goes to the new part's first line in the handout, as a line typed there does.
      requestAnimationFrame(() => {
        pick(at)
        const entry = slidesOf(editor.state.doc)[at]
        const pos = entry ? entry.pos + entry.node.nodeSize + 1 : -1
        if (pos > 0 && pos <= editor.state.doc.content.size && editor.state.doc.resolve(pos).parent.isTextblock) {
          editor.chain().focus().setTextSelection(pos).run()
        }
      })
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
        text: `Slide ${index + 1} is deleted.`,
        action: {
          label: 'Undo',
          tip: 'Put the slide back',
          run: () => {
            // The deleted part itself goes back where it was; what was done since stays. Only while the slide is
            // still gone: Cmd+Z may have put it back already.
            const id = content.firstChild ? slideDataOf(content.firstChild.attrs.kind, content.firstChild.attrs.body).id : undefined
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
    undo: redo => {
      if (!editor) return
      if (redo) editor.commands.redo()
      else editor.commands.undo()
    },
    addToLibrary: index => {
      const id = idOf(index)
      if (!id) return
      // The sheet opens beside the slide; the slide is the current one, so the sheet sits by it.
      pick(index)
      setSettingsFor(null)
      setTopics(null)
      setAddSheet({ id, number: index + 1 })
      sendToExtension('deck/library-topics')
    },
    fromLibrary: (at, section) => {
      // The slides go before part `at`: the library inserts after the part before it (-1: before the first).
      sendToExtension('deck/open-library', { section, after: at - 1 })
    },
    showInLibrary: index => {
      const from = editor ? slidesOf(editor.state.doc)[index]?.data.from : undefined
      if (from) sendToExtension('deck/show-in-library', { from })
    },
    // Beside the thumbnail it came from, top-aligned; the focus back to the strip, whose keys then work at once.
    settings: index => openSettings(index, () => {
      const thumb = stripRef.current?.querySelector<HTMLElement>(`[data-thumb="${index}"] .deck-thumb-slide`)
      return thumb ? { anchor: thumb, side: 'right', back: stripRef.current } : null
    }),
  }), [editor, dispatch, pick, idOf, openSettings])

  // A notice in the bar fades after a while.
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [notice])

  // Slide settings belong to their slide: another slide made current closes them. Add to library's sheet is placed
  // beside the slide (over the handout when it must).
  // By the slide's id: a slide removed or put in above it (an AI's edit, the host's) never moves the popover onto
  // another slide, and a popover whose slide is gone (the deck's last slide deleted) closes.
  const shownSlideId = slides[shown]?.data.id
  useEffect(() => {
    setSettingsFor(open => {
      if (!open) return open
      return open.index === shown && open.index < count && (open.id === undefined || open.id === shownSlideId) ? open : null
    })
  }, [shown, shownSlideId, count])
  // A hidden slide keeps its settings (the Experience lead): hiding the slide hides the stage, not the slide.
  // The Add to library sheet belongs to its slide: another slide closes it.
  useEffect(() => { setAddSheet(sheet => (sheet && sheet.number - 1 !== shown ? null : sheet)) }, [shown])
  // The new slide's stage takes the caret when it mounts; the request is spent once that slide is the current one. A
  // request to select the title (Sprint 159, PR 7) waits instead until the stage says it selected it (its stage may not
  // be drawn yet while the view is laid out), and ends when another slide is chosen first.
  useEffect(() => {
    if (focusTitleOf === null) return
    // With the slide folded away there is no stage to take the caret: the request is dropped, never kept for later.
    if (!slideShown) { setFocusTitleOf(null); return }
    if (focusTitleOf.select) {
      if (focusTitleOf.index !== shown) setFocusTitleOf(null)
      return
    }
    if (focusTitleOf.index !== shown) return
    const frame = requestAnimationFrame(() => setFocusTitleOf(null))
    return () => cancelAnimationFrame(frame)
  }, [shown, focusTitleOf, slideShown])
  const titleSelected = useCallback(() => setFocusTitleOf(current => (current?.select ? null : current)), [])
  useLayoutEffect(() => {
    if (!addSheet) { setSettingsAt(null); return }
    const desk = deskRef.current
    if (!desk) return
    const big = desk.querySelector<HTMLElement>('.deck-big')
    const deskBox = desk.getBoundingClientRect()
    // With the slide folded away, Add to library's sheet opens beside the thumbnail it came from, as the strip's menus
    // do; at the handout's top left when the strip is folded too.
    if (!big) {
      if (slideShown) return
      const thumb = addSheet ? stripRef.current?.querySelector<HTMLElement>(`[data-thumb="${addSheet.number - 1}"]`) : null
      const thumbBox = thumb?.getBoundingClientRect()
      setSettingsAt(thumbBox && thumbBox.height > 0
        ? { left: Math.round(thumbBox.right - deskBox.left + 8), top: Math.round(Math.max(8, Math.min(thumbBox.top - deskBox.top, deskBox.height - 320))) }
        : { left: dividerLeft + 12, top: 8 })
      return
    }
    const bigBox = big.getBoundingClientRect()
    setSettingsAt({
      left: Math.max(8, Math.min(bigBox.right - deskBox.left + 12, deskBox.width - SETTINGS_WIDTH - 8)),
      top: Math.max(8, bigBox.top - deskBox.top - 4),
    })
  }, [addSheet, deskWidth, deskHeight, stageWidth, bigWidth, aboveLine, shown, slideShown, dividerLeft])

  /**
   * Settings' Label row for a slide drawn as blocks with a Steps block (PR 2): a v1 Exercise slide's `tag:` (converted
   * with the deck's first edit), or a block slide's first Steps block's pill (`withStepsTag`).
   */
  const stepsTagSetting = (entry: DeckSlideEntry): { value: string; onChange: (tag: string) => void } | undefined => {
    if (!editor) return undefined
    if (entry.kind === 'exercise') return { value: exerciseTagOf(entry.data), onChange: tag => changeSlide(data => setPath(data, 'tag', tag)) }
    const markdown = entry.data.markdown
    if (!isBlockSlide(entry.kind) || markdown === undefined) return undefined
    const tag = blockStepsTagOf(markdown)
    if (tag === null) return undefined
    return {
      value: tag,
      onChange: next => {
        const fresh = slidesOf(editor.state.doc)[entry.index]
        if (fresh?.data.markdown !== undefined) dispatch(updateSlideMarkdown(editor.state, entry.index, withStepsTag(fresh.data.markdown, next)))
      },
    }
  }

  /** Settings' change, made to the slide as the document has it now. */
  const changeSlide = useCallback((change: (data: SlideData) => SlideData, kind?: string) => {
    if (!editor) return
    const entry = slidesOf(editor.state.doc)[shown]
    if (entry) dispatch(updateSlide(editor.state, shown, change(entry.data), kind))
  }, [editor, dispatch, shown])

  // A picture pasted or dropped on a slide: saved beside the deck by the host, then the slide shows it. A slide that
  // places no picture beside or behind its words becomes a Picture slide.
  // Sprint 161 (PR 3): a picture the slide's / menu chose goes where the / was: the slide editor puts it there once the
  // host has saved it (`stagePicture`), while that slide is still on the stage; otherwise as a pasted one.
  const caretPictureFor = useRef<string | null>(null)
  const [stagePicture, setStagePicture] = useState<{ slideId: string; path: string; url: string; serial: number } | null>(null)
  const stageSlideId = useRef<string | undefined>(undefined)
  const onPicture = useCallback((dataUrl: string, filename: string, atCaret?: boolean) => {
    if (!editor) return
    const id = idOf(shown)
    if (!id) return
    caretPictureFor.current = atCaret ? id : null
    sendToExtension('deck/save-image', { slideId: id, dataUrl, filename })
  }, [editor, idOf, shown])

  useEffect(() => onMessage(message => {
    if (!editor || editor.isDestroyed) return
    if (message.type === 'deck/image-failed') {
      setNotice({ text: typeof message.message === 'string' ? message.message : 'The picture could not be saved.' })
      return
    }
    if (message.type !== 'deck/image-saved' || typeof message.slideId !== 'string' || typeof message.path !== 'string') return
    if (caretPictureFor.current === message.slideId) {
      caretPictureFor.current = null
      if (stageSlideId.current === message.slideId && typeof message.url === 'string') {
        setStagePicture({ slideId: message.slideId, path: message.path, url: message.url, serial: Date.now() })
        return
      }
    }
    const index = slidesOf(editor.state.doc).findIndex(entry => entry.data.id === message.slideId)
    if (index < 0) return
    const entry = slidesOf(editor.state.doc)[index]
    const placed = entry.data.picture && entry.data.picture !== 'none'
    // A slide drawn as blocks (Sprint 161, PR 2): the picture beside or behind it, or a picture block at the end of its
    // words; a v1 slide's deck converts in the same step, so none of its words move.
    if (drawsAsBlocks(entry.kind)) {
      dispatch(pictureIntoSlide(editor.state, message.slideId, message.path))
      return
    }
    const kind = placed || entry.kind === 'picture' ? undefined : 'picture'
    dispatch(updateSlide(editor.state, index, kind ? { ...convertKind(entry.data, 'picture'), image: message.path } : { ...entry.data, image: message.path }, kind))
  }), [editor, dispatch])

  // ---- the Slide library (PR 4)

  /** The deck's text as this view holds it now, front matter left out (the host reads the slides from it). */
  const currentText = useCallback(() => (editor && !editor.isDestroyed ? editorHTMLToMarkdown(editor.getHTML()) : contentRef.current), [editor])

  // Sprint 159 (PR 7): a deck New just made opens with its title slide's title selected, ready to be typed over. The
  // host says so once this view has told it which slide it shows; the slides may not be read yet, so it waits for them.
  useEffect(() => onMessage(message => {
    if (message.type === 'deck/select-title') setSelectTitle(true)
    // The start card's line: "This deck is now a copy of <name>.", or why it couldn't be
    else if (message.type === 'deck/notice' && typeof message.text === 'string') setNotice({ text: message.text })
  }), [])
  useEffect(() => {
    if (!selectTitle || slides.length === 0) return
    setSelectTitle(false)
    setFocusTitleOf({ index: 0, select: true })
    requestAnimationFrame(() => pick(0))
  }, [selectTitle, slides.length, pick])

  // The host knows which slide is current, for the Slide library's "Insert after slide N".
  useEffect(() => {
    sendToExtension('deck/current', { index: shown, count })
  }, [shown, count])
  // The AI knows the slide the person is on (17 November): its id and title too, told once they settle (a scroll, a
  // title being typed). A message of its own, so it never moves the library's insert point.
  const shownId = slide?.data.id
  const shownTitle = slide?.data.title
  useEffect(() => {
    const timer = window.setTimeout(() => sendToExtension('deck/current-slide', currentSlideMessage(shown, count, slidesRef.current)), CURRENT_SLIDE_SETTLE_MS)
    return () => window.clearTimeout(timer)
  }, [shown, count, shownId, shownTitle])

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
    for (const [id, source] of Object.entries(sources)) result[id] = { library: source.library, newer: source.library && source.newer && !source.changed && !source.missing, changed: source.library && source.changed && !source.missing }
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
      case 'deck/library-topics': {
        if (Array.isArray(message.topics)) setTopics((message.topics as LibraryTopic[]).filter(topic => topic && typeof topic.path === 'string' && typeof topic.name === 'string'))
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
        const fetched = partsFragment(editor, [{ kind: message.kind, body: message.body, handout: message.handout, notes: entry.notes }], imageMappings)
        // The part's heading is the handout's own, not the slide's (16 November): the copy keeps the one it has, in place of
        // the library's (an H1 or H2 right after the slide), or over the library's text when it has none.
        const own = partHeadingAt(editor.state.doc, entry.pos)
        let content = fetched
        if (fetched && own && !own.node.attrs.deckDrawn) {
          const nodes: PMNode[] = []
          fetched.forEach(node => nodes.push(node))
          const second = nodes[1]
          if (second && second.type.name === 'heading' && second.attrs.level <= 2) nodes[1] = own.node
          else nodes.splice(1, 0, own.node)
          content = Fragment.fromArray(nodes)
        }
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
          const data = readSlideData(part.kind, part.body)
          if (!data.id || !taken.has(data.id)) {
            if (data.id) taken.add(data.id)
            return part
          }
          const id = newId(taken)
          taken.add(id)
          return { ...part, body: writeSlideData(part.kind, part.body, { ...data, id }) }
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

  // ---- Sprint 162 (step-3-themes.md): the Theme menu's pick, one step of the deck's Undo (theme/themePick.ts)

  // A pick or a look, and its Undo and Redo, write the front matter. An Undo or Redo whose line was changed since by
  // someone else (the host, an AI, another program) leaves the newer value, and the bar says so.
  useEffect(() => {
    if (!editor) return
    const onTransaction = ({ transaction }: { transaction: Transaction }) => {
      const changes = propertyChangesOf(transaction)
      if (changes.length === 0) return
      const { apply, stale } = applicableChanges(propertiesRef.current, changes)
      if (stale.length > 0) setNotice({ text: "The deck's theme or look was changed since, so it is left as it is now." })
      if (apply.length === 0) return
      const next = withPropertyChanges(propertiesRef.current, apply)
      propertiesRef.current = next
      onPropertiesChange(next)
    }
    editor.on('transaction', onTransaction)
    return () => { editor.off('transaction', onTransaction) }
  }, [editor, onPropertiesChange])
  const pickTheme = useCallback((path: string, name: string) => {
    if (!editor || editor.isDestroyed) return
    editor.view.dispatch(propertyTransaction(editor.state, 'theme', propertyValue(propertiesRef.current, 'theme'), { present: true, value: path }))
    // The bar says so, with Undo, while Undo would still take back this pick (as the strip's and the joins' notices).
    const depth = undoDepth(editor.state)
    const valid = () => !editor.isDestroyed && undoDepth(editor.state) === depth
    setNotice({
      text: themePickedNotice(name),
      action: { label: 'Undo', tip: 'Put the deck back in the theme it had', run: () => { if (valid()) editor.commands.undo() } },
      valid,
    })
  }, [editor])
  // Cmd+Z (redo: Cmd+Shift+Z, Cmd+Y) with the focus on the deck's bar or nowhere in particular (after a pick the focus is
  // back on the Theme button) is the deck's Undo, as on the slide, the strip and the handout, which keep their own. In the
  // capture phase: the webview's own script marks an undo outside a text field handled (for the workbench, whose undo
  // here does nothing) before a listener in the bubble phase would see it. Only the bar and the page itself are taken.
  useEffect(() => {
    if (!editor) return
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      const step = undoKeyOf({ key: event.key, metaKey: event.metaKey, ctrlKey: event.ctrlKey, shiftKey: event.shiftKey, altKey: event.altKey, isComposing: event.isComposing })
      if (!step) return
      const target = event.target instanceof HTMLElement ? event.target : null
      if (target && target !== document.body && !target.closest('.deck-bar')) return
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return
      event.preventDefault()
      if (step === 'redo') editor.commands.redo()
      else editor.commands.undo()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [editor])

  const handoutContainer = scrollContainer()
  // Writing on the slide keeps it the current one while the handout is still.
  const onWriting = useCallback(() => { lockUntil.current = Date.now() + WRITE_LOCK_MS }, [])

  // ---- Sprint 161 (PR 3): the slide's Slides items and "This slide is full"

  /** The slide on the stage is full (its words at their smallest and still past its edge): the bar says so. */
  const [slideFull, setSlideFull] = useState(false)
  /** The bar's Split at the cursor, asked of the slide editor. */
  const [splitRequest, setSplitRequest] = useState(0)
  stageSlideId.current = slideShown && slide ? slide.data.id : undefined
  // The / menu's New slide below: an empty block slide after this one's part, its title taking the caret.
  const onNewSlideBelow = useCallback(() => stripActions.insert(shown + 1, ''), [stripActions, shown])
  // Split slide here: the words after the caret go to a new slide below, which takes the caret.
  const onSplit = useCallback((before: string, after: string) => {
    if (!editor || !dispatch(splitSlide(editor.state, shown, before, after, Math.random, textHandoutRef.current))) return
    setFocusTitleOf({ index: shown + 1, select: false })
    requestAnimationFrame(() => pick(shown + 1))
  }, [editor, dispatch, shown, pick])
  // The bar's Split at the cursor with no caret on the slide: it says where to click, and splits nothing.
  const needCaret = useCallback(() => setNotice({ text: 'Click on the slide where it should split, then Split at the cursor.' }), [])
  // PR 3 (frame 24; README, "Nothing around the slide but the slide": in the deck's bar while that slide is current).
  // Nothing moves to a new slide by itself: Split at the cursor does it, where the caret is.
  const fullLine = (
    <>
      <Tooltip label={SLIDE_FULL} className="deck-notice-words">
        <span className="deck-notice-text">{SLIDE_FULL}</span>
      </Tooltip>
      <Tooltip label="Move the words after the cursor to a new slide below this one" className="deck-notice-act">
        <Button variant="link" className="deck-line-action" onClick={() => setSplitRequest(value => value + 1)}>
          Split at the cursor
        </Button>
      </Tooltip>
    </>
  )

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
        {/* Slide, both or handout (17 November): under 600 px the handout has no room, and the deck shows the slide only. */}
        {deskWidth >= NARROWEST_DESK ? <DeckViewSwitch view={viewShown} above={above} onView={chooseView} /> : null}
        <span className="deck-count">{count === 0 ? 'No slides yet' : `Slide ${shown + 1} of ${count}`}</span>
        <span className="deck-notice" role="status" aria-live="polite">
          {notice ? (
            <>
              <Tooltip label={notice.text} className="deck-notice-words">
                <span className="deck-notice-text">{notice.text}</span>
              </Tooltip>
              {notice.action ? (
                <Tooltip label={notice.action.tip} className="deck-notice-act">
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
              {/* A join (README, "Removing a slide from the handout"): the slide fits itself, and if it's now full, the
                  bar says so too, with Split at the cursor. */}
              {notice.withFull && slideFull && slideShown ? <span className="deck-notice-gap" aria-hidden="true" /> : null}
              {notice.withFull && slideFull && slideShown ? fullLine : null}
            </>
          ) : slideFull && slideShown ? fullLine : null}
        </span>
        <span className="flex-1" />
        {/* Only with the slide shown: a comment opens on the slide, under what it is on. */}
        {slideShown ? <DeckComments stops={commentStops} at={stopIndexOf(commentStops, commentAtKey)} current={shown} onGo={goToComment} /> : null}
        <span className="sr-only" role="status" aria-live="polite">{syncAction?.label ?? ''}</span>
        {/* Sprint 162 (frame 12): the deck's one look control, on the right before Saved. */}
        <ThemeMenu theme={theme} named={properties.theme} look={borderless ? 'borderless' : 'card'} onLook={setLook} onPick={pickTheme} />
        {status === 'action' && syncAction ? (
          <SyncActionButton action={syncAction} />
        ) : (
          <span className={`deck-saved${status === 'saved' ? '' : ' invisible'}`}>Saved</span>
        )}
        <DeckPublish slides={slides} theme={theme} borderless={borderless} assets={assets} text={currentText} onNotice={publishNotice} />
        <PresentButton slideNumber={count === 0 ? null : shown + 1} startNumber={startNumber === undefined ? null : startNumber + 1} onPresent={present} />
      </header>

      <div ref={deskRef} className="deck-desk">
        {stripShown ? (
          <SlideStrip
            slides={slides}
            current={shown}
            theme={theme}
            borderless={borderless}
            assets={assets}
            missing={missingPictures}
            actions={stripActions}
            stripRef={stripRef}
            marks={marks}
            commentCounts={!!commentCallouts}
            joinAt={joinAt}
          />
        ) : null}
        {editor ? partSlots.map(slot => {
          // Each part's menu by its slide's place (one map lookup), drawn again only when what it shows changes.
          const pos = slot.getPos()
          const entry = pos === undefined ? undefined : slideAtPos.get(pos)
          return (
            <PartMenu
              key={slot.id}
              slot={slot}
              index={entry ? entry.index : -1}
              count={count}
              skipped={entry?.data.skip === true}
              fromLibrary={!!(entry?.data.id && libraryBadge(marks[entry.data.id]))}
              actions={stripActions}
              onSettings={partSettings}
            />
          )
        }) : null}

        {slideShown ? (
          <div
            ref={stageRef}
            className={`deck-stage${borderless ? ' is-borderless' : ''}${above ? ' is-above' : ''}${slideAlone ? ' is-alone' : ''}`}
            style={above ? { left: stripWidth, width: stageWidth, height: stageHeight } : { left: stripWidth, width: stageWidth }}
          >
            {/* Above, the slide is centred over the handout's column, and alone in the room: the group is the slide's
                own width. */}
            <div className="deck-stage-group" style={above || slideAlone ? { width: bigWidth + STAGE_MARGIN * 2 } : undefined}>
              {editor && slide && bigWidth > 0 ? (
                <Stage
                  // By the slide's id: a new slide at the current place is a new stage, which takes the caret.
                  key={slide.data.id ?? `index-${slide.index}`}
                  editor={editor}
                  slide={slide}
                  theme={theme}
                  borderless={borderless}
                  assets={assets}
                  missing={missingPictures}
                  width={bigWidth}
                  onWriting={onWriting}
                  commentCallouts={commentCallouts}
                  initialFocus={focusTitleOf?.index === slide.index ? 'title' : undefined}
                  selectOnFocus={focusTitleOf?.index === slide.index && focusTitleOf.select}
                  onFocusTaken={titleSelected}
                  onPicture={onPicture}
                  // By the slide's id where it has one, so a slide moved meanwhile never opens another's comment.
                  commentOpen={commentOpen && (commentOpen.slideId !== undefined ? commentOpen.slideId === slide.data.id : commentOpen.slide === slide.index) ? commentOpen : null}
                  onCommentOpened={commentOpened}
                  onNewSlideBelow={onNewSlideBelow}
                  onSplit={onSplit}
                  onFull={setSlideFull}
                  onNeedCaret={needCaret}
                  onSlideSettings={stageSettings}
                  splitRequest={splitRequest}
                  picture={stagePicture && stagePicture.slideId === slide.data.id ? stagePicture : null}
                />
              ) : null}
            </div>
          </div>
        ) : null}

        {handoutShown && slideShown ? (
          <div
            className={`deck-divider${above ? ' is-above' : ''}${dragging ? ' is-dragging' : ''}`}
            // Above, a level line from the strip to the room's right edge; beside, the upright line.
            style={above ? { left: stripWidth, top: aboveLine } : { left: dividerLeft }}
            role="separator"
            aria-orientation={above ? 'horizontal' : 'vertical'}
            aria-label={above ? 'Drag to change the heights' : 'Drag to change the widths'}
            onPointerDown={onDividerDown}
          />
        ) : null}

        {addSheet && settingsAt ? (
          <AddToLibrarySheet
            number={addSheet.number}
            topics={topics}
            style={{ left: settingsAt.left, top: settingsAt.top }}
            onClose={() => setAddSheet(null)}
            returnFocus={() => stripRef.current}
            onAdd={topic => {
              const id = addSheet.id
              setAddSheet(null)
              setBusy(value => ({ ...value, [id]: true }))
              sendToExtension('deck/add-to-library', { id, text: currentText(), topic })
            }}
          />
        ) : null}
        <div
          className={`deck-handout${handoutShown ? '' : ' is-folded'}${slideShown ? '' : ' is-solo'}${above && split ? ' is-above' : ''}`}
          // The handout alone, or below the slide, is a Text document's centred column: its width sets the text's edges
          // (decks.css).
          style={{ left: dividerLeft, top: above && split ? aboveLine : 0, ['--deck-handout-width' as string]: `${Math.max(0, deskWidth - dividerLeft)}px`, ['--deck-text-column' as string]: `${TEXT_COLUMN_WIDTH}px` }}
          aria-hidden={handoutShown ? undefined : true}
        >
          {findBar}
          <Editor
            value={content}
            onChange={handleChange}
            onSelectionChange={onSelectionChange}
            onEditorReady={handleEditorReady}
            placeholder="Write here. *** starts a new slide."
            className="h-full"
            imageMappings={imageMappings}
            commentCallouts={commentCallouts}
            syncTarget={syncTarget}
            onExternalApplied={onExternalApplied}
            extensions={DECK_EXTENSIONS}
            viewOfIncoming={textHandout ? undefined : withDrawnHeadings}
          />
          {handoutContainer && startRows && startState && startAt ? createPortal(
            <StartCard
              ref={startRef}
              style={startAt}
              aiName={startRows.ask ? startState.ai?.name ?? null : null}
              earlier={startRows.copy ? startState.earlier : []}
              busy={startBusy}
              onDraft={words => startWith('deck/start-draft', { text: words })}
              onCopy={deck => startWith('deck/start-copy', { source: deck.path })}
              onHide={hideStart}
            />,
            handoutContainer,
          ) : null}
        </div>
      </div>
      {/* 17 November (Jarmo: "slaidi settings peaks olema siin: mitte kuskil ülal tööriistaribas"; the Experience lead,
          "Nothing around the slide"): Slide settings… in the slide's own menu opens this popover, anchored beside the
          thumbnail, the part number or the point it came from, top-aligned with it. A Popover: a press outside or Esc
          closes it, and the focus goes back to where the menu was opened. */}
      <Popover open={settingsFor !== null} onOpenChange={open => { if (!open) setSettingsFor(null) }}>
        {settingsFor ? <PopoverAnchor virtualRef={settingsAnchor} /> : null}
        <PopoverContent
          side={settingsFor?.side ?? 'right'}
          align="start"
          sideOffset={8}
          collisionPadding={8}
          className="deck-settings"
          // The popup takes the focus itself, not its Close button, so no tooltip opens with it.
          onOpenAutoFocus={event => { event.preventDefault(); (event.currentTarget as HTMLElement | null)?.focus() }}
          onCloseAutoFocus={event => {
            const back = settingsReturn.current
            settingsReturn.current = null
            if (!back || !back.isConnected) return
            event.preventDefault()
            back.focus({ preventScroll: true })
          }}
          tabIndex={-1}
        >
          {slide ? (
            <SlideSettings
              number={shown + 1}
              // A slide drawn as blocks (a v1 slide too, PR 2) has no layout: its blocks are its layout (frame 26).
              kind={drawsAsBlocks(slide.kind) ? '' : slide.kind}
              data={drawsAsBlocks(slide.kind) ? { ...slide.data, ...blockDataOf(slide.kind, slide.data), skip: slide.data.skip } : slide.data}
              stepsTag={stepsTagSetting(slide)}
              about={(
                <SlideAbout
                  data={slide.data}
                  sourceLines={slide.data.id && sources[slide.data.id] ? (
                    <SourceLines
                      source={sources[slide.data.id]}
                      kept={slide.data.kept === true}
                      justUpdated={justUpdated === slide.data.id}
                      busy={!!busy[slide.data.id]}
                      actions={sourceActions}
                    />
                  ) : undefined}
                  hidden={drawsAsBlocks(slide.kind)
                    ? (!isBlockSlide(slide.kind) && hiddenWords(slide.kind, slide.data).length > 0 ? 'Words its old layout hid become a comment in the handout when you first edit this deck.' : '')
                    : hiddenNote(slide.kind, slide.data)}
                />
              )}
              onKind={kind => changeSlide(data => convertKind(data, kind), kind)}
              onChange={patch => changeSlide(data => ({ ...data, ...patch }))}
              onClose={() => setSettingsFor(null)}
              onUndo={redo => { if (redo) editor?.commands.redo(); else editor?.commands.undo() }}
            />
          ) : null}
        </PopoverContent>
      </Popover>
      {dialogs}
    </div>
  )
}
