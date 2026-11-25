/**
 * Sprint 157 (experience 46): a deck (`.rtms`, or an older `.deck.md`) opened as a deck, as Jarmo sketched it on 14 November and the Experience
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
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent, type CSSProperties, type ReactNode } from 'react'
import { matchesKeyPreview } from '../../../../src/decks/keyPreview'
import { clockMinutes, explicitMinutes, readTimetable, SESSION_LENGTH, SESSION_START } from '../../../../src/decks/timetable'
import { slideCountWithMinutes } from '../../../../src/decks/timetableDisplay'
import { DeckMinutes } from './DeckMinutes'
import { lengthMinutesOf } from '../../../../src/decks/present/presentSession'
import { createPortal } from 'react-dom'
import type { Editor as TipTapEditor } from '@tiptap/react'
import { Editor, TEXT_COLUMN_WIDTH } from '../Editor'
import { Button, roomChanged } from '../ui/button'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'
import { SyncActionButton } from '../header'
import { documentBarStatus, type DocumentSyncAction } from '../header/DocumentSyncAction'
import type { DocumentApplyTarget } from '../../types/documentSync'
import type { DocumentSyncState } from '../../../../src/editorSync/protocol'
import type { EditorSelection } from '../../types/editor'
import type { DocumentProperties } from '../properties'
import { DeckOpenInContext } from './slide/codeToolsClick'
import { cutName, fitNotice, hideClippedNotice } from './noticeCut'
import { AgendaContext, useAgendaDrawing } from './slide/agendaContext'
import { DeckIconsContext } from './slide/IconGrid'
import { deckIconsInUse } from './slide/iconSearch'
import { onDocChanged } from '../../lib/docChange'
import { deckWordCount } from './deckWordCount'
import { parseDeck, type SlideData } from '../../../../src/decks/deckFormat'
import { DECK_DERIVED, DECK_OPERATION, RATIO_MAX, RATIO_MIN, initialRatio, withDrawnHeadings, deleteSlide, derivedHeadings, partHeadingAt, partRange, duplicateSlide, handoutHasText, insertSlide, isSlideNode, moveSlide, nudgeTarget, partChangedBy, partContent, sealHistory, partIndexAt, replacePart, restoreSlide, slideDataOf, slidesOf, updateSlide, type DeckSlideEntry } from './deckDocument'
import { StartCard } from './StartCard'
import { deckStarted, startCardPlace, startCardRows, type StartCardState } from '../../../../src/decks/startCard'
import { DOMParser as PMDOMParser, Fragment, type Node as PMNode } from '@tiptap/pm/model'
import { editorHTMLToMarkdown, markdownToEditorHTML } from '../../utils/editorMarkdown'
import { SourceLines, type CopySource } from './library/SourceLines'
import { AddToLibrarySheet, type LibraryTopic } from './library/AddToLibrarySheet'
import { onMessage, sendToExtension } from '../../bridge'
import { getUniqueImageFilename, readFileAsBase64 } from '../../lib/pastedImage'
import { dropPlaceNow, insertPictureSlides, newSlideIds, pictureTitleOf, type SavedPicture } from './stripPictures'
import { COPY_FAILED_NOTE, copiedNote, copySlidePicture } from './slidePicture'
import { convertKind, hiddenNote } from './slide/convertKind'
import { undoKeyOf } from './slide/slideEdits'
import { SlideAbout, SlideSettings } from './SlideSettings'
import { ThemeMenu, themePickedNotice } from './ThemeMenu'
import { TransitionPreview, previewTarget, type TransitionPreviewRequest } from './TransitionPreview'
import { transitionOf, transitionValue } from './present/wallMotion'
import { ThemeChangeSheet, themeChangeFrom } from './theme/ThemeChangeSheet'
import type { ThemeChangeView } from '../../../../src/decks/themeChange'
import { deckNameOf } from '../../../../src/decks/deckFileName'
import { applicableChanges, propertyChangesOf, propertyTransaction, propertyValue, sameValue, withPropertyChanges } from './theme/themePick'
import { Popover, PopoverAnchor, PopoverContent } from '../ui/popover'
import { SlideMenuItems, SlideStrip, libraryBadge, type StripActions, type StripMark } from './SlideStrip'
import { DropdownMenu, DropdownMenuContent, MoreActionsTrigger } from '../ui/dropdown-menu'
import { OPEN_IN_KEY, OPEN_IN_NONE, TEXT_HANDOUT_KEY, TEXT_HANDOUT_VALUE, isBlockSlide, newId, slideDataOf as readSlideData, withPartHeading, writeSlideBlock, writeSlideData } from '../../../../src/decks/deckFormat'
import { TextSelection, type Transaction } from '@tiptap/pm/state'
import { isHistoryTransaction, undoDepth } from '@tiptap/pm/history'
import { useDeckAssets, useDeckTheme } from './deckBridge'
import { PART_TOP_GAP, currentPart, scrollTopFor, wheelStop } from './scrollRule'
import { CURRENT_SLIDE_SETTLE_MS, currentSlideMessage } from './currentSlideMessage'
import { DeckGuard } from './handout/deckGuard'
import { CONVERSION_NOTICE, DeckConvert, DeckFrontMatterSteps, commentNodeAt, conversionNoticeFor, conversionStateOf, pictureIntoSlide } from './handout/deckConvert'
import { commentBoxStorage } from '../../extensions/comment/CommentNode'
import { blockDataOf, drawsAsBlocks } from '../../../../src/decks/blocks/convertDeck'
import { splitSlide } from './blocks/slideSplit'
import { hiddenWords } from '../../../../src/decks/blocks/legacyToBlocks'
import { DeckCurrent, deckCurrentKey, deckFocusKey, setCurrentSlide } from './handout/deckCurrent'
import { DeckSlideWithPartHead, partMenuSlots, type PartMenuSlot } from './handout/SlidePartHead'
import { railPick, rowCaret, trackHeight } from './handout/partRail'
import { DECK_REMOVED, DeckRemove, joinMarkOf, removalNotice, type DeckRemoval } from './handout/deckRemove'
import { DeckLines } from './handout/deckLines'
import { DeckDrawnHeadings } from './handout/drawnHeadings'
import { Stage } from './Stage'
import { DeckComments, deckCommentStops, stopIndexOf } from './DeckComments'
import { PresentButton, usePresentKeys, type PresentFrom } from './present/PresentButton'
import { DeckPublish, type PauseTarget } from './DeckPublish'
import { computeResults } from '../../extensions/SearchExtension'
import { DeckViewSwitch, deckViewState, foldOfView, foldedSides, foldForFind, keepDeckViewState, OPENING_FOLD, type DeckFold, type DeckViewMode } from './DeckFolds'
import { STAGE_MARGIN, aboveLineFor, clampAboveRatio, fullSlideWidthFor, initialAboveRatio, orientationFor, rowsUnder, slideWidthFor, type DeckOrientation } from './deckLayout'
import { NO_GESTURE, slideKeyOf, slideKeyTarget, stageScrollAfter, stageWheelOf, wheelPixels, wheelRoute, wheelTaker, type KeyTargetElement } from './slideNav'
import { slideOrderKeyOf } from './stripKeys'
import { isMac } from '../../hooks/usePlatform'
import './decks.css'

/** The deck's extensions, made once: the editor's extension list is fixed at mount. */
const DECK_EXTENSIONS = [DeckSlideWithPartHead, DeckGuard, DeckCurrent, DeckLines, DeckDrawnHeadings, DeckConvert, DeckRemove]

/** The strip's width (the prototype's 132). */
const STRIP_WIDTH = 132
const TIMETABLE_STRIP_WIDTH = 300
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
const MIN_STRIP_DESK = 660
const NARROWEST_DESK = 600

/** The slide's share, as this deck's view kept it (`deckViewState`; the view itself is never kept): of the width with the slide beside
 *  the handout, and of the height with the slide above it. Each orientation keeps its own. */
const storedRatio = () => deckViewState().deckRatio
const keepRatio = (ratio: number) => keepDeckViewState({ deckRatio: ratio })
const storedAboveRatio = () => deckViewState().deckAboveRatio
const keepAboveRatio = (ratio: number) => keepDeckViewState({ deckAboveRatio: ratio })
/** How long a thumbnail's scroll holds the slide, and how long writing does (the prototype's `syncLock`). */
const PICK_LOCK_MS = 500
const WRITE_LOCK_MS = 1200
/** How long a thumbnail an undo changed keeps its flash (decks.css plays it once, in less). */
const FLASH_MS = 900

/** Where a key on the stage comes from (slideNav.ts), or null while a dialog or sheet over the deck keeps its keys. */
function stageKeyFrom(event: KeyboardEvent): 'page' | 'button' | null {
  if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return null
  return slideKeyTarget(event.target as KeyTargetElement | null, document.body)
}
/** The copies' sources are asked again this long after the deck stops changing; "Updated in the library" stays this long. */
const SOURCES_MS = 700
const UPDATED_MS = 4000
/** The start card's distance below the first part's text, and above the room's end (frame 20). */
const START_CARD_GAP = 8
/** The start card's distance under the slide in Slide only (decks.css `.deck-stage .deck-start`). */
const START_CARD_SLIDE_GAP = 16

/**
 * Item 8: one drop of pictures on the strip, before part `at` when it was dropped: before the slide with id `before`
 * (null: at the end), wherever that slide stands once every picture is saved. Each picture's saved path (null: not
 * saved) by its slide id.
 */
interface PictureDrop {
  at: number
  /** Undefined when that slide had no id: the place it was dropped at, then. */
  before: string | null | undefined
  pictures: Array<{ id: string; title: string }>
  paths: Map<string, string | null>
}

/**
 * A notice's one action: a link with its word (Undo), or (#931, the Experience lead) an icon button right after the
 * words, its word in the tooltip and its name for a screen reader in `ariaLabel` (Show in folder).
 */
interface NoticeAction {
  label: string
  tip: string
  run: () => void
  icon?: 'folder-open'
  ariaLabel?: string
}

/** A notice in the deck's bar, with one action (Undo) when it has one. */
interface Notice {
  text: string
  action?: NoticeAction
  /** While this holds, the notice stands; once it doesn't (its Undo would take back something else), it goes. */
  valid?: () => boolean
  /** A join's line: the full slide's line stays beside it (the joined slide may be full). */
  withFull?: boolean
  /** #931: the file name the words end with ("Saved as <name>"): too long for the room, it is cut in its middle. */
  name?: string
}

/**
 * #931: a notice ending with a file name ("Saved as <name>") takes the room the bar has, and its action (Show in folder)
 * sits right after the name. The whole words, hidden, and the action's room keep the note's width as the bar gives it;
 * over them, one line holds the words that fit that width (the name cut in its middle, its end and extension kept,
 * `fitNotice`) and then the action. The note's own width is never set here, so it is watched for the bar's changes
 * (a window or a sheet) without feeding back. The tooltip on the words holds the whole words.
 */
function NoticeWords({ text, name, after }: { text: string; name: string; after: ReactNode }) {
  const boxRef = useRef<HTMLSpanElement>(null)
  const lineRef = useRef<HTMLSpanElement>(null)
  const shownRef = useRef<HTMLSpanElement>(null)
  const afterRef = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const box = boxRef.current
    const line = lineRef.current
    const shown = shownRef.current
    if (!box || !line || !shown) return
    const prefix = text.slice(0, text.length - name.length)
    const measure = document.createElement('canvas').getContext('2d')
    const shortestCut = prefix + cutName(name, 2)
    let live = true
    const fit = () => {
      if (!live) return // a fonts' answer that comes after this notice was replaced
      const room = line.clientWidth - (afterRef.current?.offsetWidth ?? 0) - NOTICE_ACTION_GAP
      if (measure) {
        const hidden = hideClippedNotice(text, room, shown.dataset.noteHidden, noticeMeasure(shown, measure), shortestCut)
        if (hidden) {
          shown.dataset.noteHidden = text
          return
        }
        delete shown.dataset.noteHidden
      }
      shown.textContent = fitNotice(prefix, name, words => {
        shown.textContent = words
        return shown.scrollWidth <= room
      })
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(box)
    void document.fonts?.ready?.then(fit)
    return () => {
      live = false
      observer.disconnect()
    }
  }, [text, name])
  return (
    <span ref={boxRef} className="deck-notice-cut">
      <span className="deck-notice-sizer" aria-hidden="true"><span>{text}</span><span className="deck-notice-room" /></span>
      <span ref={lineRef} className="deck-notice-line">
        <Tooltip label={text} className="deck-notice-words">
          <span ref={shownRef} className="deck-notice-shown" aria-hidden="true" />
        </Tooltip>
        <span ref={afterRef} className="deck-notice-after">{after}</span>
      </span>
      <span className="sr-only">{text}</span>
    </span>
  )
}

/** The gap between a file-name notice's words and its action (decks.css `.deck-notice-line`). */
const NOTICE_ACTION_GAP = 8

function noticeMeasure(words: HTMLElement, measure: CanvasRenderingContext2D) {
  const style = getComputedStyle(words)
  measure.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  return (text: string) => measure.measureText(text).width
}

/** Check the bar with full controls and the notice down to its ellipses and actions. */
function fitDeckBar(bar: HTMLElement, notice: HTMLSpanElement, measure: CanvasRenderingContext2D | null) {
  notice.setAttribute('data-measure-words', '')
  bar.removeAttribute('data-theme-compact')
  notice.setAttribute('data-measure-min', '')
  const minimum = notice.getBoundingClientRect().width
  notice.removeAttribute('data-measure-min')
  notice.style.setProperty('--deck-notice-min', `${minimum}px`)

  roomChanged() // Ask Publish and Present to measure again with the bar's controls at full width.
  const last = bar.lastElementChild
  const right = bar.getBoundingClientRect().right - parseFloat(getComputedStyle(bar).paddingRight)
  if (last && last.getBoundingClientRect().right > right + 0.01) {
    bar.setAttribute('data-theme-compact', '')
    roomChanged()
  }

  // Measure with all words in flow so a collapsed note can return when there is room.
  if (measure) {
    for (const words of notice.querySelectorAll<HTMLElement>(':scope > .deck-notice-words > .deck-notice-text')) {
      const text = words.textContent ?? ''
      const room = words.getBoundingClientRect().width
      const hidden = hideClippedNotice(text, room, words.dataset.noteHidden, noticeMeasure(words, measure))
      if (hidden) words.dataset.noteHidden = text
      else delete words.dataset.noteHidden
    }
  }
  notice.removeAttribute('data-measure-words')
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
 *
 * With it, the row a slide with no handout folds to (17 November): "Slide only" and the slide's title, which opens the
 * part to write in. The head shows it only while it's folded (`is-only`, decks.css).
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
  /** The slide's title, for the folded row. */
  title: string
  onOpenPart: (index: number) => void
}

const PartMenu = memo(function PartMenu({ slot, index, count, skipped, fromLibrary, actions, onSettings, title, onOpenPart }: PartMenuProps) {
  if (index < 0) return null
  return (
    <>
      {createPortal(
        <DropdownMenu modal={false}>
          <MoreActionsTrigger label={`Slide ${index + 1}: more actions`} className="deck-part-more-button" />
          <DropdownMenuContent align="start" side="bottom">
            <SlideMenuItems index={index} count={count} skipped={skipped} fromLibrary={fromLibrary} actions={{ ...actions, settings: at => onSettings(at, slot) }} />
          </DropdownMenuContent>
        </DropdownMenu>,
        slot.element,
      )}
      {createPortal(
        <Tooltip label="Write a handout for this slide">
          <Button variant="ghost" className="deck-part-only-row" onMouseDown={event => event.preventDefault()} onClick={() => onOpenPart(index)}>
            <span className="deck-part-only-key">Slide only</span>
            <span className="deck-part-only-title">{title}</span>
          </Button>
        </Tooltip>,
        slot.row,
      )}
    </>
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
  /** Sprint 162 PR 2: the deck's file name, whose name New theme…'s "Use it in <deck>" says. */
  filename?: string
}

/** The stage's width for a desk width, the handout's ratio and what is shown. */
export function stageWidthFor(avail: number, ratio: number, handoutShown: boolean, slideShown = true): number {
  if (!slideShown) return 0
  if (!handoutShown) return avail
  return Math.max(0, Math.min(avail - HANDOUT_MIN, Math.max(STAGE_MIN, Math.round(avail * ratio))))
}

const countDeckEditorWords = (editor: TipTapEditor) => deckWordCount(editorHTMLToMarkdown(editor.getHTML()))

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
  filename,
}: DeckViewProps) {
  const [editor, setEditor] = useState<TipTapEditor | null>(null)
  const [slides, setSlides] = useState<DeckSlideEntry[]>([])
  const [current, setCurrent] = useState(0)
  const [stripWanted, setStripWanted] = useState<boolean | null>(null)
  const [stripMode, setStripMode] = useState<'thumbnails' | 'list'>(() => deckViewState().deckStripMode === 'list' ? 'list' : 'thumbnails')
  const chooseStripMode = (mode: typeof stripMode) => {
    setStripMode(mode)
    keepDeckViewState({ deckStripMode: mode })
  }
  // Fold either side (16 November): the slide, the handout, or neither. Every deck opens in Slide only (19 November);
  // the choice lives while the deck is open and is never kept.
  const [fold, setFold] = useState<DeckFold>(OPENING_FOLD)
  const [showHandoutInNarrowView, setShowHandoutInNarrowView] = useState(false)
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
  const barRef = useRef<HTMLElement>(null)
  const barNoticeRef = useRef<HTMLSpanElement>(null)
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
  // Sprint 163 PR 1: the code blocks' ↗ Open in… on the stage and the strip, off for a deck with `open-in: none` (as its page).
  const openIn = String((properties as Record<string, unknown>)[OPEN_IN_KEY] ?? '').trim() !== OPEN_IN_NONE
  // Copy as picture draws the slide in the look the strip shows, read when it is asked for.
  const lookRef = useRef({ theme, borderless, assets, missing: missingPictures })
  lookRef.current = { theme, borderless, assets, missing: missingPictures }
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

  // README item 19: the deck's transition on the wall, chosen in the Theme menu. Fade writes nothing; any other writes
  // `transition: <it>`, as one step of the deck's Undo (the same property step as the look). Choosing one plays it once
  // on the stage (`TransitionPreview`).
  const transition = transitionOf(properties.transition)
  const [transitionPreview, setTransitionPreview] = useState<TransitionPreviewRequest | null>(null)
  const setTransition = useCallback((value: string) => {
    const chosen = transitionOf(value)
    const before = propertyValue(propertiesRef.current, 'transition')
    const after = transitionValue(chosen)
    if (!sameValue(before, after)) {
      if (editor && !editor.isDestroyed) editor.view.dispatch(propertyTransaction(editor.state, 'transition', before, after))
      else {
        const next: DocumentProperties = { ...propertiesRef.current }
        if (after.present) next.transition = after.value
        else delete next.transition
        onPropertiesChange(next)
      }
    }
    setTransitionPreview(previous => ({ serial: (previous?.serial ?? 0) + 1, transition: chosen }))
  }, [editor, onPropertiesChange])

  // Publish on the bar (Sprint 159 PR 4) says its one line here: why a page wasn't written, or that the link is copied.
  const publishNotice = useCallback((text: string, action?: Notice['action'], name?: string) => setNotice({ text, action, name }), [])

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
  // What this view wrote into the front matter with the first edit (`handout: text`, `deck: 2`), and the step that did:
  // that step's Undo takes it out again (`DeckFrontMatterSteps`, review of #796).
  const frontMatterSteps = useRef(new DeckFrontMatterSteps())
  // Whether the document's last change was an undo or a redo (the mark is taken out only by one).
  const lastWasHistory = useRef(false)
  useEffect(() => {
    if (!editor) return
    const onTransaction = ({ transaction }: { transaction: Transaction }) => {
      if (!transaction.docChanged) return
      lastWasHistory.current = isHistoryTransaction(transaction)
      frontMatterSteps.current.transaction(lastWasHistory.current, undoDepth(editor.state))
    }
    editor.on('transaction', onTransaction)
    return () => { editor.off('transaction', onTransaction) }
  }, [editor])
  // Sprint 161 (PR 2): `deck: 2` is written with the first edit after which the deck holds a block slide (the
  // conversion at the first real edit, or any edit of a deck of block slides), in the same change; that edit's Undo puts
  // the deck's version back as it was.
  const deckVersionRef = useRef(properties.deck)
  deckVersionRef.current = properties.deck
  const handleChange = useCallback((markdown: string) => {
    const state = editorRef.current?.state
    const change = frontMatterSteps.current.change({
      marked: textHandoutRef.current,
      version: deckVersionRef.current,
      doc: state?.doc ?? null,
      undo: lastWasHistory.current,
      depth: state ? undoDepth(state) : null,
    })
    if (!change) {
      onChange(markdown)
      return
    }
    // Nothing is drawn from now on once the mark is written, whatever runs before the view renders again.
    textHandoutRef.current = change.marked
    deckVersionRef.current = change.version
    onChange(markdown, change.apply)
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
    // A deck that opens with no slide has nothing to show in Slide only: it opens with the handout beside, to type in.
    if (slidesOf(editor.state.doc).length === 0) setFold(current => (current === 'handout' ? null : current))
    return onDocChanged(editor, refresh)
  }, [editor])

  // The Find loan (`foldForFind`, after `chooseView`) can end while Find is open.
  const findBorrowedHandout = useRef(false)

  const count = slides.length
  // Small details 14: the deck's sections, for every Agenda the strip draws; the editor says so when there are none.
  const agendaDrawing = useAgendaDrawing(slides.map(entry => ({ kind: entry.kind, data: entry.data, number: entry.index + 1 })), true)
  // Copy as picture (its own React root) reads the same list when it is asked for.
  const agendaRef = useRef(agendaDrawing)
  agendaRef.current = agendaDrawing
  const slideAtPos = useMemo(() => new Map(slides.map(entry => [entry.pos, entry])), [slides])

  // The handout's start card (16 November, the Experience lead's frame 20) on a deck New made: the host says whether
  // this deck is New's, which AI drafts it and the project's earlier decks. Once it goes it never comes back.
  const [startState, setStartState] = useState<StartCardState | null>(null)
  const [startGone, setStartGone] = useState(false)
  const [startAt, setStartAt] = useState<{ left: number; top: number; width: number } | null>(null)
  const startRef = useRef<HTMLDivElement | null>(null)
  const [startWords, setStartWords] = useState('')
  const [startAll, setStartAll] = useState(false)
  const showAllEarlier = useCallback(() => setStartAll(true), [])
  // The card as drawn, wherever it is: the handout's room and the slide's size are measured from it.
  const [startEl, setStartEl] = useState<HTMLDivElement | null>(null)
  const startRefSet = useCallback((element: HTMLDivElement | null) => {
    startRef.current = element
    setStartEl(element)
  }, [])
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
  // The one card, wherever `startCardPlace` puts it: the same component, rows and rules in the handout and under the slide.
  const startCard = (style: CSSProperties) => startRows && startState ? (
    <StartCard
      ref={startRefSet}
      style={style}
      aiName={startRows.ask ? startState.ai?.name ?? null : null}
      earlier={startRows.copy ? startState.earlier : []}
      busy={startBusy}
      onDraft={words => startWith('deck/start-draft', { text: words })}
      onCopy={deck => startWith('deck/start-copy', { source: deck.path })}
      onHide={hideStart}
      words={startWords}
      onWords={setStartWords}
      all={startAll}
      onAll={showAllEarlier}
    />
  ) : null
  const countRef = useRef(count)
  countRef.current = count
  const slidesRef = useRef(slides)
  slidesRef.current = slides
  // Sprint 169 PR 3 (#868): the icon menu's first view, the deck's icons in use, read when a menu opens.
  const iconsInUse = useCallback(() => deckIconsInUse(slidesRef.current), [])
  const shown = count === 0 ? 0 : Math.min(current, count - 1)
  const slide = slides[shown]
  const timing = useMemo(() => readTimetable(slides.map(entry =>
    writeSlideBlock(entry.kind, entry.node.attrs.body)).join('\n\n')), [slides])
  const sessionStart = clockMinutes(properties[SESSION_START])
  const sessionMinutes = lengthMinutesOf(String(properties[SESSION_LENGTH] ?? ''))
  const shownTiming = timing.slides[shown]
  const countLabel = count === 0 ? 'No slides yet' : `Slide ${shown + 1} of ${count}`
  // A draft belongs to the current slide. Not keyed on the body: saving the time changes it, and the box would lose focus.
  const minutesKey = `${shown}:${slide?.data.id ?? ''}`

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

  const stripFits = deskWidth === 0 || deskWidth >= MIN_STRIP_DESK
  const stripShown = stripFits && (stripWanted ?? (stripMode === 'list' || deskWidth === 0 || deskWidth >= NARROW_DESK))
  const handoutRoom = !(deskWidth > 0 && deskWidth < NARROWEST_DESK)
  const { slideShown, handoutShown } = foldedSides(fold, handoutRoom || showHandoutInNarrowView)
  const slideShownRef = useRef(slideShown)
  slideShownRef.current = slideShown
  const stripWidth = stripShown ? (stripMode === 'list' ? TIMETABLE_STRIP_WIDTH : STRIP_WIDTH) : 0
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
  // The one start card (#917): at the handout's top while the handout shows, under the slide in Slide only.
  const startPlace = startShown ? startCardPlace(slideShown, handoutShown) : null
  const startInHandout = startPlace === 'handout'
  // Under the slide, the card's room (its height and the 16 above it) is kept free, so the slide and the card both fit
  // the stage without scrolling: the wheel over a slide in Slide only moves slides, never the stage (slideNav.ts). The
  // card's rows don't wrap, so its height doesn't change with the slide's width and the size can't swing.
  const [slideCardRoom, setSlideCardRoom] = useState(0)
  const startUnderSlide = startPlace === 'slide'
  useLayoutEffect(() => {
    const card = startUnderSlide ? startEl : null
    if (!card) { setSlideCardRoom(0); return }
    const measure = () => {
      const room = Math.ceil(card.offsetHeight + START_CARD_SLIDE_GAP)
      setSlideCardRoom(before => (Math.abs(before - room) > 1 ? room : before))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(card)
    return () => observer.disconnect()
  }, [startUnderSlide, startEl])
  // At most half the stage: a card taller than that (All decks… in a project of many decks) scrolls with the stage
  // instead, so the slide never shrinks to nothing and the card is never unmounted by its own size (review).
  const slideCardUnder = startUnderSlide ? Math.min(slideCardRoom, Math.max(0, Math.floor(stageHeight / 2))) : 0
  const bigWidth = slideAlone ? fullSlideWidthFor(stageWidth, stageHeight, slideCardUnder) : slideWidthFor(stageWidth, stageHeight, above, aboveUnder)
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
  /** What the view switch shows chosen: the view as drawn, including a handout opened by Show it. */
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
  }, [editor, shown, count, stripMode, stripShown])

  // Where the slide's pane stands once another slide is shown (#902, #871): beside the handout the pane can be taller
  // than its room. A slide chosen any way (the strip's click and keys, Home and End, a comment, the rail, the handout
  // read on into the next part) is seen from its top; the wheel's step says its direction first (`paneMove`), so going
  // back shows the slide from its end. Set after the new slide is drawn, so its end is measured on it, and only when the
  // slide changes, so a split drag or a view switch on the same slide keeps the reader's place.
  const paneMove = useRef<-1 | 0 | 1>(0)
  useLayoutEffect(() => {
    const stage = stageRef.current
    if (stage) stage.scrollTop = stageScrollAfter(paneMove.current, stage)
    paneMove.current = 0
  }, [shown])

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
    const card = startInHandout ? (startRef.current?.offsetHeight ?? 0) + START_CARD_GAP * 2 : 0
    const room = Math.round(Math.max(40, card, container.clientHeight - lastHeight - PART_TOP_GAP))
    if (Math.abs(room - padding) > 1) dom.style.setProperty('padding-bottom', `${room}px`, 'important')
    // The card's sides are the text's own edges (frame 20: 48 left, 32 right), never the column's.
    const box = dom.getBoundingClientRect()
    const left = Math.round(box.left - container.getBoundingClientRect().left + (parseFloat(style.paddingLeft) || 0))
    const width = Math.round(box.width - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0))
    const next = startInHandout ? { left, width, top: Math.round(textEnd + START_CARD_GAP) } : null
    setStartAt(at => (at && next && at.left === next.left && at.width === next.width && at.top === next.top) || at === next ? at : next)
  }, [partTops, scrollContainer, editor, startInHandout])

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
  const startPlaced = startInHandout && !!startAt
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
  const pickRef = useRef(pick)
  pickRef.current = pick

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
      // #931: "Saved as <name>" stands until the deck is edited; then the deck's own Saved comes back.
      else if (transaction.docChanged && shown?.name) setNotice(null)
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

  /** The view switch (17 November): Slide only, Slide and handout, or Handout only; the choice holds while the deck is open,
   *  and the part being read stays at the top. Slide settings stay: they belong to the current slide, which the strip
   *  still rings. */
  const chooseView = useCallback((view: DeckViewMode) => {
    const next = foldOfView(view)
    setShowHandoutInNarrowView(false)
    findBorrowedHandout.current = false
    setFold(next)
    requestAnimationFrame(() => pick(currentRef.current))
  }, [pick])

  // Find (⌘F) searches the handout and draws its bar there: opening it in Slide only borrows the handout, beside the
  // slide, so the bar and its matches show (not on a desk with no room for the handout). Closing Find (Esc or its ×)
  // gives it back: the view returns to Slide only, unless the person chose a view while Find was open (`chooseView`
  // ends the loan), which then holds, or the deck has no slide left to show. As after any fold, the part being read
  // stays at the top. The rest is read when Find opens or closes, never as a reason to decide again.
  const findOpen = Boolean(findBar)
  const findSees = useRef({ fold, handoutRoom: true, hasSlides: true, pick })
  findSees.current = { fold, handoutRoom: !(deskWidth > 0 && deskWidth < NARROWEST_DESK), hasSlides: count > 0, pick }
  useEffect(() => {
    const seen = findSees.current
    const next = foldForFind(findOpen, seen.fold, findBorrowedHandout.current, seen.handoutRoom, seen.hasSlides)
    findBorrowedHandout.current = next.borrowed
    if (next.fold === seen.fold) return
    setFold(next.fold)
    requestAnimationFrame(() => seen.pick(currentRef.current))
  }, [findOpen])

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

  // The full slide view (Jarmo, 16 November): with the handout hidden, the wheel anywhere over the stage (the slide and
  // the empty bands around it) and the keys move between slides (slideNav.ts), through the strip's own path. A gesture
  // means the same in every view, by side of the room (#855, the Experience lead): beside the handout too, the wheel
  // anywhere on the slide's side moves one slide and the handout scrolls to its part, as a thumbnail's click does; on
  // the handout's side it scrolls the text (the scroll rule's).
  const fullSlide = slideShown && !handoutShown
  const stageWheel = stageWheelOf(slideShown, handoutShown)
  const goTo = useCallback((index: number) => {
    const count = countRef.current
    if (count === 0) return
    const next = Math.max(0, Math.min(count - 1, index))
    if (next !== Math.min(currentRef.current, count - 1)) pick(next)
  }, [pick])
  useEffect(() => {
    const stage = stageRef.current
    if (!stageWheel || !stage) return
    let gesture = NO_GESTURE
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
      const delta = wheelPixels(event, stage.clientHeight)
      // A pane or a column that holds more than its room scrolls first, then the stage while it can (a short window; in
      // Slide only, under the bands alone, as the slide fits there); everything else on the slide's side moves the
      // slide, one per gesture (#824, #855). What is under the pointer is asked only while the gesture is undecided,
      // not through a flick's momentum.
      const takerOf = () => wheelTaker(event.target as HTMLElement | null, stage, delta, box => getComputedStyle(box).overflowY, stageWheel)
      const route = wheelRoute(gesture, delta, event.timeStamp, takerOf)
      gesture = route.gesture
      if (!route.scroll) event.preventDefault()
      if (route.move !== 0) {
        const from = Math.min(currentRef.current, countRef.current - 1)
        // The new slide is seen from where the gesture goes on (a pane taller than its room): the pane's effect reads
        // the direction once the slide is drawn. At the deck's ends nothing moves, and nothing is left waiting.
        paneMove.current = route.move
        goTo(from + route.move)
        if (Math.min(currentRef.current, countRef.current - 1) === from) paneMove.current = 0
      }
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [stageWheel, goTo])
  useEffect(() => {
    if (!fullSlide) return
    const onKey = (event: KeyboardEvent) => {
      // A dialog or sheet over the deck keeps its keys.
      const index = slideKeyOf(event, stageKeyFrom(event), countRef.current, currentRef.current)
      if (index === null) return
      event.preventDefault()
      goTo(index)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullSlide, goTo])

  // The number's rail (17 November): each track runs from where the head's CSS puts its top to the end of its part's text.
  // Measured after the page is laid out: when the document, the selection (a part opens while the caret is in it) or the
  // current slide (a part folds or opens) changes, and when the handout's size changes. A folded block has no box, so
  // it's passed over. Every place is read first and every height written after, so the page is laid out once.
  const measureRail = useCallback(() => {
    if (!editor || editor.isDestroyed) return
    const heads = Array.from(editor.view.dom.querySelectorAll<HTMLElement>(':scope > .deck-part-head'))
    const heights = heads.map((head, index) => {
      const track = head.querySelector<HTMLElement>(':scope > .deck-part-track')
      if (!track) return null
      const end = heads[index + 1] ?? null
      let bottom = head.getBoundingClientRect().bottom
      for (let block = head.nextElementSibling; block && block !== end; block = block.nextElementSibling) {
        const box = block.getBoundingClientRect()
        if (box.height > 0) bottom = Math.max(bottom, box.bottom)
      }
      return { track, height: `${trackHeight(track.getBoundingClientRect().top, bottom)}px` }
    })
    for (const entry of heights) if (entry && entry.track.style.height !== entry.height) entry.track.style.height = entry.height
  }, [editor])
  useEffect(() => {
    if (!editor) return
    let frame: number | null = null
    const later = () => {
      if (frame === null) frame = requestAnimationFrame(() => { frame = null; measureRail() })
    }
    const onTransaction = ({ transaction }: { transaction: Transaction }) => {
      if (transaction.docChanged || transaction.selectionSet || transaction.getMeta(deckCurrentKey) !== undefined || transaction.getMeta(deckFocusKey) !== undefined) later()
    }
    later()
    editor.on('transaction', onTransaction)
    const observer = new ResizeObserver(later)
    observer.observe(editor.view.dom)
    return () => {
      editor.off('transaction', onTransaction)
      observer.disconnect()
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [editor, measureRail])
  // A click on a track makes its slide the current one, as a thumbnail does (its ⋯ is its own).
  useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null
      const track = target?.closest?.('.deck-part-track')
      if (!track || target?.closest('.deck-part-more')) return
      const heads = Array.from(dom.querySelectorAll(':scope > .deck-part-head'))
      const index = railPick(heads.indexOf(track.parentElement as Element), Math.min(currentRef.current, countRef.current - 1), heads.length)
      if (index !== null) pick(index)
    }
    dom.addEventListener('click', onClick)
    return () => dom.removeEventListener('click', onClick)
  }, [editor, pick])
  // A slide with no handout's row (17 November): its part opens to write in and its slide becomes current. The handout
  // takes the focus and the caret goes in first, which opens the part (deckCurrent.ts: a part the caret is in, while the
  // handout has the focus, never folds), so the handout scrolls to the part as it now stands.
  const openPart = useCallback((index: number) => {
    if (!editor || editor.isDestroyed) return
    const range = partRange(editor.state.doc, index)
    const blocks: number[] = []
    if (range) {
      editor.state.doc.nodesBetween(range.from, range.to, (node, pos) => {
        if (pos > range.from && pos < range.to && node.isTextblock) blocks.push(pos)
        return pos === range.from ? false : !node.isTextblock
      })
    }
    const caret = rowCaret(blocks)
    if (caret !== null) {
      editor.view.focus()
      editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, caret)).setMeta('addToHistory', false))
    }
    pick(index)
  }, [editor, pick])

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
  /** From a part number's ⋯: beside the number (on its right: the number is on the rail at the handout's left), the focus back to its ⋯. */
  const partSettings = useCallback((index: number, slot: PartMenuSlot) => openSettings(index, () => (
    slot.element.isConnected
      ? { anchor: slot.element.parentElement?.querySelector<HTMLElement>('.deck-part-number') ?? slot.element, side: 'right', back: slot.element.querySelector('button') }
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

  /**
   * A strip operation that is an undo step of its own, before and after: words typed at once next to the copy or the
   * moved part start a step of their own too (review of #784), so one Cmd+Z takes back the operation alone.
   */
  const dispatchStep = useCallback((tr: Transaction | null) => {
    if (!dispatch(tr) || !editor) return false
    dispatch(sealHistory(editor.state))
    return true
  }, [dispatch, editor])
  const dispatchStepRef = useRef(dispatchStep)
  dispatchStepRef.current = dispatchStep

  // Item 8: the pictures dropped on the strip, by the new slide id each was saved for, until all of a drop's are saved.
  const pictureDrops = useRef(new Map<string, PictureDrop>())
  const pictureSaved = useCallback((slideId: string, path: string | null): boolean => {
    const drop = pictureDrops.current.get(slideId)
    if (!drop) return false
    pictureDrops.current.delete(slideId)
    drop.paths.set(slideId, path)
    if (drop.paths.size < drop.pictures.length) return true
    const saved: SavedPicture[] = drop.pictures.flatMap(picture => {
      const at = drop.paths.get(picture.id)
      return at ? [{ ...picture, path: at }] : []
    })
    const failed = drop.pictures.length - saved.length
    const target = editorRef.current
    let inserted = false
    if (saved.length && target && !target.isDestroyed) {
      // Before the slide it was dropped before, where that slide stands now: slides moved or deleted while the pictures
      // were saved don't move the drop place (review of #794). That slide gone, the place it was dropped at.
      const at = dropPlaceNow(slidesOf(target.state.doc).map(entry => entry.data.id), drop.before, drop.at)
      // One transaction, an undo step of its own: one Cmd+Z takes every slide of the drop back.
      inserted = dispatchStepRef.current(insertPictureSlides(target.state, at, saved, textHandoutRef.current))
      if (inserted) requestAnimationFrame(() => pickRef.current(at))
    }
    if (saved.length && !inserted) setNotice({ text: 'The pictures are saved in images/, but their slides could not be added.' })
    else if (failed) setNotice({ text: failed === 1 ? 'A picture could not be saved beside the deck.' : `${failed} pictures could not be saved beside the deck.` })
    return true
  }, [])

  /** Part `from` to stand before part `to`, its slide then current: a drag's drop and Cmd+↑ / Cmd+↓ alike. */
  const moveTo = useCallback((from: number, to: number) => {
    if (editor && dispatchStep(moveSlide(editor.state, from, to))) requestAnimationFrame(() => pick(to > from ? to - 1 : to))
  }, [editor, dispatchStep, pick])

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
      if (editor && dispatchStep(duplicateSlide(editor.state, index))) requestAnimationFrame(() => pick(index + 1))
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
    move: moveTo,
    nudge: (index, step) => {
      const to = editor ? nudgeTarget(index, step, slidesOf(editor.state.doc).length) : null
      if (to !== null) moveTo(index, to)
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
    // Item 15: the slide in the look the strip shows, at 1920 × 1080, on the clipboard; the bar says so.
    copyPicture: index => {
      const entry = editor ? slidesOf(editor.state.doc)[index] : undefined
      if (!entry) return
      const look = lookRef.current
      // An Agenda's picture lists the deck's sections, as the strip draws it, without the editor's hint
      const agenda = { entries: agendaRef.current.entries, hint: false }
      void copySlidePicture({ kind: entry.kind, data: entry.data, theme: look.theme, borderless: look.borderless, assets: look.assets, missing: look.missing, agenda, openIn })
        .then(copied => setNotice({ text: copied ? copiedNote(index + 1) : COPY_FAILED_NOTE }))
    },
    // Item 8: each picture saved in `images/` for the slide id it will have; the slides go in once all are saved.
    dropPictures: (at, files) => {
      if (!editor || files.length === 0) return
      // Never an id another drop still waits to use.
      const ids = newSlideIds(editor.state.doc, files.length, Math.random, pictureDrops.current.keys())
      const pictures = files.map((file, index) => ({ id: ids[index], title: pictureTitleOf(file.name) }))
      const standing = slidesOf(editor.state.doc)[at]
      const before = standing ? standing.data.id : null
      const drop: PictureDrop = { at, before, pictures, paths: new Map() }
      for (const id of ids) pictureDrops.current.set(id, drop)
      files.forEach((file, index) => {
        void readFileAsBase64(file).then(
          dataUrl => sendToExtension('deck/save-image', { slideId: ids[index], dataUrl, filename: getUniqueImageFilename(file) }),
          () => pictureSaved(ids[index], null),
        )
      })
    },
  }), [editor, dispatch, dispatchStep, pick, idOf, openSettings, moveTo, pictureSaved])

  // Cmd+D, Cmd+↑ and Cmd+↓ (Ctrl on Windows) with a slide chosen on the stage: the focus on the stage outside its words,
  // or on nothing (17 November). The strip takes the same keys itself (stripKeys.ts); words keep their editor's keys.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = slideOrderKeyOf(event, isMac)
      // With the slide folded away there is no slide on the stage to choose: the keys are the handout's view's. A button
      // with the focus (the view switch just pressed, a tool on the stage) keeps them too (Codex on #784).
      if (!key || countRef.current === 0 || !slideShownRef.current || stageKeyFrom(event) !== 'page') return
      event.preventDefault()
      const index = Math.min(currentRef.current, countRef.current - 1)
      if (key.type === 'duplicate') stripActions.duplicate(index)
      else stripActions.nudge(index, key.step)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stripActions])

  // Undo shows what it undid (17 November, Keynote and Google Slides): an undo or a redo that changes a slide which
  // isn't the current one makes it current, the handout scrolled to its part, and its thumbnail flashes once. With the
  // caret in the handout in that part, the editor keeps it in view itself, and the part only becomes current.
  const [flash, setFlash] = useState<{ index: number; serial: number } | null>(null)
  // Never reset, so a flash always has a key of its own and plays again (review of #784).
  const flashSerial = useRef(0)
  useEffect(() => {
    if (!editor) return
    let frame: number | null = null
    const onTransaction = ({ transaction }: { transaction: Transaction }) => {
      if (!transaction.docChanged || !isHistoryTransaction(transaction)) return
      const index = partChangedBy(transaction)
      if (index === null || index === currentRef.current) return
      flashSerial.current += 1
      const shown = { index, serial: flashSerial.current }
      if (frame !== null) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        frame = null
        if (editor.isDestroyed || index >= slidesOf(editor.state.doc).length) return
        if (editor.isFocused && partIndexAt(editor.state.doc, editor.state.selection.from) === index) {
          lockUntil.current = Date.now() + WRITE_LOCK_MS
          makeCurrent(index)
        } else pick(index)
        setFlash(shown)
      })
    }
    editor.on('transaction', onTransaction)
    return () => {
      editor.off('transaction', onTransaction)
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [editor, pick, makeCurrent])
  useEffect(() => {
    if (!flash) return
    const timer = window.setTimeout(() => setFlash(null), FLASH_MS)
    return () => window.clearTimeout(timer)
  }, [flash])

  useLayoutEffect(() => {
    const bar = barRef.current
    const notice = barNoticeRef.current
    if (!bar || !notice) return
    const measure = document.createElement('canvas').getContext('2d')
    const fit = () => fitDeckBar(bar, notice, measure)
    fit()
    const resize = new ResizeObserver(fit)
    resize.observe(bar)
    // Controls can gain or lose room at the same width (for example, when Publish becomes a split button).
    const content = new MutationObserver(fit)
    content.observe(bar, { childList: true, characterData: true, subtree: true })
    document.fonts?.addEventListener('loadingdone', fit)
    return () => {
      resize.disconnect()
      content.disconnect()
      document.fonts?.removeEventListener('loadingdone', fit)
    }
  }, [])

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

  /** Settings' change, made to the slide as the document has it now. */
  const changeSlide = useCallback((change: (data: SlideData) => SlideData, kind?: string) => {
    if (!editor) return
    const entry = slidesOf(editor.state.doc)[shown]
    if (entry) dispatch(updateSlide(editor.state, shown, change(entry.data), kind))
  }, [editor, dispatch, shown])
  const commitMinutes = (index: number, time: string | undefined) => {
    if (!editor || editor.isDestroyed) return
    const entry = slidesOf(editor.state.doc)[index]
    if (entry) dispatchStep(updateSlide(editor.state, index, { ...entry.data, time }))
  }

  const pickTimedSlide = (index: number) => {
    if (!slideShown) setFold(null)
    pick(index)
  }

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

  /**
   * Sprint 167 PR 4 (decks README item D): Slide settings' Choose… and Replace… under Behind, and Behind chosen with no
   * picture: the computer's file picker, then the picture saved beside the deck for the slide the settings are for,
   * which puts it into its place (`pictureIntoSlide`).
   */
  const choosePictureForSlide = useCallback(() => {
    // The slide the settings are for: by its id when it has one, read now without writing anything, so slides moved
    // while the picker is open never send the picture elsewhere; an old slide without one gets it (`idOf`) only once a
    // file is chosen, so a cancelled picker leaves the deck as it was (review).
    const at = shown
    const known = editor ? slidesOf(editor.state.doc)[at]?.data.id : undefined
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) return
      void readFileAsBase64(file).then(dataUrl => {
        const id = known || idOf(at)
        if (!id) return
        // Into the slide's place, never at a caret: a / menu picture still on its way for this slide is no longer one.
        if (caretPictureFor.current === id) caretPictureFor.current = null
        sendToExtension('deck/save-image', { slideId: id, dataUrl, filename: getUniqueImageFilename(file) })
      })
    })
    input.click()
  }, [editor, idOf, shown])

  useEffect(() => onMessage(message => {
    // A drop's pictures first, whatever this editor's state: the drop finishes (and says so) against the editor of now.
    if ((message.type === 'deck/image-saved' || message.type === 'deck/image-failed') && typeof message.slideId === 'string'
      && pictureSaved(message.slideId, message.type === 'deck/image-saved' && typeof message.path === 'string' ? message.path : null)) return
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
  }), [editor, dispatch, pictureSaved])

  // ---- the Slide library (PR 4)

  /** The deck's text as this view holds it now, front matter left out (the host reads the slides from it). */
  const currentText = useCallback(() => (editor && !editor.isDestroyed ? editorHTMLToMarkdown(editor.getHTML()) : contentRef.current), [editor])

  const showPause = useCallback(({ slide: number, location, keyPreview }: PauseTarget) => {
    if (number === undefined || number < 1 || number > countRef.current) return
    const index = number - 1
    pick(index)
    if (!location || !editor || editor.isDestroyed) return
    // Scan locations are in the saved body, with a one-based line and zero-based UTF-16 columns.
    const body = contentRef.current.replace(/^\uFEFF/, '')
    const lines = body.split('\n')
    const line = lines[location.line - 1]
    const { column, endColumn } = location
    if (line === undefined || column === undefined || endColumn === undefined || endColumn <= column || endColumn > line.length) return
    const target = line.slice(column, endColumn)
    if (keyPreview && !matchesKeyPreview(target, keyPreview)) return
    const source = parseDeck(body).slides[index]
    if (!source) return
    const offset = lines.slice(0, location.line - 1).reduce((sum, row) => sum + row.length + 1, column)
    if (offset < source.start || offset >= source.handoutEnd) return
    const inHandout = offset >= source.handoutStart
    const before = body.slice(inHandout ? source.handoutStart : source.start, offset)
    const occurrence = before.split(target).length - 1
    if (inHandout && !handoutShown) {
      chooseView(handoutRoom ? 'both' : 'handout')
      // Show it is an explicit request to see handout text even when only one pane fits.
      setShowHandoutInNarrowView(!handoutRoom)
    }
    if (!inHandout && !slideShown) chooseView('slide')

    requestAnimationFrame(() => {
      if (editor.isDestroyed || currentRef.current !== index) return
      if (inHandout) {
        const range = partRange(editor.state.doc, index)
        const match = range && computeResults(editor.state.doc, target)
          .filter(hit => hit.from >= range.from && hit.to <= range.to && editor.state.doc.textBetween(hit.from, hit.to) === target)[occurrence]
        if (match) editor.chain().focus().setTextSelection(match).scrollIntoView().run()
        return
      }
      const stage = stageRef.current?.querySelector('.deck-big')
      if (!stage) return
      // The stage has its own editor. Use the DOM range there, as the stage does for layout text.
      const walker = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT)
      let remaining = occurrence
      while (walker.nextNode()) {
        const node = walker.currentNode
        const text = node.textContent ?? ''
        for (let at = text.indexOf(target); at >= 0; at = text.indexOf(target, at + target.length)) {
          if (remaining-- !== 0) continue
          const range = document.createRange()
          range.setStart(node, at)
          range.setEnd(node, at + target.length)
          node.parentElement?.closest<HTMLElement>('[contenteditable="true"]')?.focus({ preventScroll: true })
          const selection = window.getSelection()
          selection?.removeAllRanges()
          selection?.addRange(range)
          node.parentElement?.scrollIntoView({ block: 'nearest' })
          return
        }
      }
    })
  }, [editor, pick, handoutRoom, handoutShown, slideShown, chooseView])

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
  // Sprint 162 PR 2: New theme… and Save as a new theme… with "Use it in this deck": the host names the new theme, and
  // the deck uses it as a pick (one Undo, the bar's line). A theme it draws already is left as it is.
  useEffect(() => onMessage(message => {
    if (message.type !== 'deck/use-theme' || typeof message.path !== 'string' || typeof message.name !== 'string') return
    if (propertiesRef.current.theme === message.path) return
    pickTheme(message.path, message.name)
  }), [pickTheme])
  // Sprint 162 PR 5 (17 November, frame 13): See what changed for an AI's theme change, a sheet over the stage; the strip
  // and the chat stay in view. Undo goes to the host, which puts the decks back and says so in the chat.
  const [themeChange, setThemeChange] = useState<ThemeChangeView | null>(null)
  useEffect(() => onMessage(message => {
    if (message.type === 'deck/theme-change') {
      const change = themeChangeFrom(message.change)
      if (change) setThemeChange(change)
    } else if (message.type === 'deck/theme-change-undone' && typeof message.id === 'string') {
      const id = message.id
      setThemeChange(current => (current && current.id === id ? { ...current, undone: true } : current))
    }
  }), [])
  // What New theme… shows of this deck: its name, and a slide with boxes when it has one (frame 14).
  const newTheme = useMemo(() => {
    const slide = slides.find(entry => entry.kind === 'boxes') ?? slides[1] ?? slides[0] ?? null
    return {
      deckName: deckNameOf(filename ?? '') || 'this deck',
      slide: slide ? { kind: slide.kind, data: slide.data } : null,
      assets,
    }
  }, [slides, filename, assets])
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
    <AgendaContext.Provider value={agendaDrawing}>
    <DeckIconsContext.Provider value={iconsInUse}>
    <DeckOpenInContext.Provider value={openIn}>
    <div className="deck-view h-screen bg-surface flex flex-col">
      <header className="deck-bar" ref={barRef}>
        <Tooltip label={stripShown ? 'Hide the slides' : 'Show the slides'}>
          <Button
            variant="toolbar"
            size="icon-sm"
            data-state={stripShown ? 'active' : undefined}
            aria-pressed={stripShown}
            aria-label="Slides"
            disabled={!stripFits}
            onClick={() => setStripWanted(!stripShown)}
          >
            <Icon name="list" size={14} tone={stripShown ? 'inherit' : 'muted'} />
          </Button>
        </Tooltip>
        {/* Under 600 px the slide normally has the desk. Show it can open the handout in its place. */}
        {deskWidth >= NARROWEST_DESK || showHandoutInNarrowView ? <DeckViewSwitch view={viewShown} above={above} onView={chooseView} /> : null}
        <span className="deck-count">
          {shownTiming && shownTiming.sectionMinutes === null ? (
            <DeckMinutes key={minutesKey} count={countLabel} timing={shownTiming}
              fromLabel={shownTiming.labelMinutes !== null && explicitMinutes(slide?.data.time) === null}
              onCommit={time => commitMinutes(shown, time)} />
          ) : slideCountWithMinutes(countLabel, shownTiming)}
        </span>
        <span className="deck-notice" ref={barNoticeRef} role="status" aria-live="polite">
          {notice ? (
            <>
              {notice.name && notice.text.endsWith(notice.name) ? (
                <NoticeWords
                  text={notice.text}
                  name={notice.name}
                  after={notice.action?.icon ? (
                    <Tooltip label={notice.action.tip}>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="deck-notice-icon"
                        aria-label={notice.action.ariaLabel ?? notice.action.label}
                        onClick={() => {
                          notice.action?.run()
                          setNotice(null)
                        }}
                      >
                        <Icon name={notice.action.icon} size={14} />
                      </Button>
                    </Tooltip>
                  ) : null}
                />
              ) : (
                <Tooltip label={notice.text} className="deck-notice-words">
                  <span className="deck-notice-text">{notice.text}</span>
                </Tooltip>
              )}
              {notice.name && notice.text.endsWith(notice.name) ? null : notice.action ? (
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
        <span className="deck-bar-spacer" />
        {/* Only with the slide shown: a comment opens on the slide, under what it is on. */}
        {slideShown ? <DeckComments stops={commentStops} at={stopIndexOf(commentStops, commentAtKey)} current={shown} onGo={goToComment} /> : null}
        <span className="sr-only" role="status" aria-live="polite">{syncAction?.label ?? ''}</span>
        {/* Sprint 162 (frame 12): the deck's one look control, on the right before Saved. */}
        <ThemeMenu theme={theme} named={properties.theme} look={borderless ? 'borderless' : 'card'} onLook={setLook} transition={transition} onTransition={setTransition} onPick={pickTheme} newTheme={newTheme} />
        {status === 'action' && syncAction ? (
          <SyncActionButton action={syncAction} />
        ) : notice?.name ? null : (
          // #931: while "Saved as <name>" shows, the deck's own Saved steps aside, so the note has its room
          <span className={`deck-saved${status === 'saved' ? '' : ' invisible'}`}>Saved</span>
        )}
        <DeckPublish slides={slides} theme={theme} borderless={borderless} assets={assets} text={currentText} view={viewShown} onNotice={publishNotice} onShowPause={showPause} />
        <PresentButton slideNumber={count === 0 ? null : shown + 1} startNumber={startNumber === undefined ? null : startNumber + 1} onPresent={present} />
      </header>

      <div ref={deskRef} className="deck-desk" style={{ ['--deck-strip' as string]: `${stripWidth}px` }}>
        {themeChange ? (
          <ThemeChangeSheet
            change={themeChange}
            style={{ left: stripShown ? 'var(--deck-strip)' : 0 }}
            onUndo={() => sendToExtension('deck/theme-change-undo', { id: themeChange.id })}
            onClose={() => setThemeChange(null)}
          />
        ) : null}
        {stripShown ? (
          <SlideStrip
            slides={slides}
            current={shown}
            timing={{ ...timing, sessionStart, sessionMinutes }}
            mode={stripMode}
            onMode={chooseStripMode}
            onPickTimedSlide={pickTimedSlide}
            onMinutes={commitMinutes}
            onSession={(field, value) => sendToExtension('deck/session-time', { field, value })}
            theme={theme}
            borderless={borderless}
            assets={assets}
            missing={missingPictures}
            actions={stripActions}
            stripRef={stripRef}
            marks={marks}
            commentCounts={!!commentCallouts}
            joinAt={joinAt}
            flash={flash}
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
              title={(entry?.data.title ?? '').trim()}
              onOpenPart={openPart}
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
              {/* #917: in Slide only the same card sits under the slide, at the slide's own width (decks.css). */}
              {startPlace === 'slide' && slide ? startCard({ width: bigWidth }) : null}
              {slide && bigWidth > 0 ? (
                <TransitionPreview
                  request={transitionPreview}
                  target={() => stageRef.current?.querySelector<HTMLElement>('.deck-big') ?? null}
                  from={slide}
                  to={previewTarget(slides, shown)?.to ?? null}
                  direction={previewTarget(slides, shown)?.direction ?? 'next'}
                  width={bigWidth}
                  theme={theme}
                  borderless={borderless}
                  assets={assets}
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
            countDocumentWords={countDeckEditorWords}
            extensions={DECK_EXTENSIONS}
            viewOfIncoming={textHandout ? undefined : withDrawnHeadings}
          />
          {startInHandout && handoutContainer && startAt ? createPortal(startCard(startAt), handoutContainer) : null}
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
              onChoosePicture={choosePictureForSlide}
              onClose={() => setSettingsFor(null)}
            />
          ) : null}
        </PopoverContent>
      </Popover>
      {dialogs}
    </div>
    </DeckOpenInContext.Provider>
    </DeckIconsContext.Provider>
    </AgendaContext.Provider>
  )
}
