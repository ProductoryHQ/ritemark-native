/**
 * Sprint 161 (PR 2, technical plan §3; the Experience lead's frames 21 and 23): the slide on the stage, written like
 * text. A lean TipTap editor holds the slide's Markdown: its title (`#`), the line under it, text, lists, tables,
 * pictures, and the `:::` blocks Columns, Boxes and Steps, drawn as the one renderer draws them (`slideDivView.ts`), so
 * the slide being edited looks like its thumbnail, the wall and the page.
 *
 * The editing model is the spike's (§2), "atom plus string body", kept in `SlideSync`:
 *  - the slide stays an atom in the handout's editor; each change here writes the slide's Markdown back to it, with
 *    `setNodeMarkup`, as one transaction, so it saves, merges and undoes as the rest of the deck does;
 *  - an unchanged slide writes back its Markdown as it was, byte for byte;
 *  - a change of the node from elsewhere (an undo, an AI's edit, a picture) comes in as its smallest replacement, never
 *    a reload, so the caret stays; it waits while an input method composes;
 *  - undo and redo (Cmd+Z, Cmd+Shift+Z, Cmd+Y, the Edit menu's) are the handout editor's: this editor has none.
 *
 * A v1 slide (`slide points`) is drawn here as `legacyToBlocks` draws it, and writing on it converts the whole deck in
 * the same transaction (`convertDeckInto`): what the person saw is what is written, and one Undo takes it back.
 *
 * The slide is scaled with `transform: scale`, never CSS `zoom` (spike §1: ProseMirror's coordinates, the caret, the
 * / menu and IME are right under a transform), and the bubble menu goes in `document.body`, outside the scaled frame.
 * The words fit the slide in steps (`slideFit.ts`), measured again as they change.
 *
 * PR 3 (frames 22, 24 and 26; `slideCommands.ts`): the slide's own / menu with its blocks and its Slides items, a box's
 * icon from the grid, Enter moving down a table, and "This slide is full" told to the
 * deck's bar (`onFull`) with Split at the cursor. While the / menu is open the words typed after the / are not written
 * to the deck (they are the menu's query), so a block chosen from it is one undo step that leaves the file as it was
 * before the /. A block, an icon, a row or a column is written as an undo step of its own (`SLIDE_COMMAND`).
 *
 * Sprint 164 PR 3: the Label (`slideLabel.ts`), typed in place like every word on the slide. A slide whose Steps block
 * still has its old pill opens with it as a Label (`stageMarkdownOf`), so the first edit writes what the stage shows.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { EditorContent, useEditor, type Editor as TipTapEditor } from '@tiptap/react'
import { Extension, createNodeFromContent, getHTMLFromFragment, type Editor as CoreEditor } from '@tiptap/core'
import type { Schema } from '@tiptap/pm/model'
import Placeholder from '@tiptap/extension-placeholder'
import type { Node as PMNode } from '@tiptap/pm/model'
import { PluginKey, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state'
import { closeHistory, undoDepth } from '@tiptap/pm/history'
import { blockTitleOf, isBlockSlide, slideDataOf, withBlockMarkdown, writeSlideData, type SlideData } from '../../../../../src/decks/deckFormat'
import { blockDataOf } from '../../../../../src/decks/blocks/convertDeck'
import { withStepsLabels } from '../../../../../src/decks/blocks/labelBlock'
import { BLOCK_CANVAS_HEIGHT, BLOCK_CANVAS_WIDTH, contentPlaceClass, contentPlaceFitKey, contentPlaceOf, drawsLogo, isCoverSlide, logoCanvasMarks, lonePictureClass, sidePictureOf, themeSlideLogo } from '../../../../../src/decks/blocks/slideRenderer'
import type { DeckTheme } from '../../../../../src/decks/deckTheme'
import { createEditorSchemaExtensions } from '../../../utils/editorMarkdown'
import { getUniqueImageFilename, readFileAsBase64, takeImageFile } from '../../../lib/pastedImage'
import { SlashCommands } from '../../../extensions/SlashCommands'
import { SlideCodeBlock } from '../../../extensions/CodeBlockWithCopyExtension'
import { CodeFillPlaces } from '../../../extensions/codeFillPlaces'
import type { BlockItemDef } from '../../../extensions/blockItems'
import { FormattingBubbleMenu } from '../../FormattingBubbleMenu'
import { themeStyle } from '../theme/themeVars'
import { SlideLogoImage } from '../slide/SlideCanvas'
import { slidesOf, type DeckSlideEntry } from '../deckDocument'
import { convertDeckInto } from '../handout/deckConvert'
import { SLIDE_SYNC, SlideSync } from './slideSync'
import { slideDivWithView, type SlideDivHandlers } from './slideDivView'
import { AGENDA_DRAWN_EVENT, slideAgendaWithView, type AgendaSource } from './slideAgendaView'
import { onDocChanged } from '../../../lib/docChange'
import { agendaOf } from '../../../../../src/decks/blocks/slideRenderer'
import { ensureSlideCommentPipeline, isTitlePlace, markdownToSlideEditorHTML, saveSlideMarkdown, slidePlaceholderOf } from './slideEditorMarkdown'
import { SlideLabel, labelNode } from './slideLabel'
import { clearStageFit, fitFlow, fitKeyOf, fitLookOf, setStageFit } from './slideFit'
import { SLIDE_MISSING_PICTURES, SlidePicture, imagePathOf, slideMissingPictures } from './slidePictures'
import { SlideQuoteBy } from './slideQuote'
import { Button } from '../../ui/button'
import { Tooltip } from '../../ui/tooltip'
import { SLIDE_COMMAND, slideItemsAt, agendaNode, isOwnStep, withoutEmptyLineAt, cellBelow, insertSlideBlock, pictureNode, setBlockValue, slideBlockNode, splitSlideHalves, webPageNode, type SlideBlockKind } from './slideCommands'
import { SlideIconPicker, UnknownIconHint, WebPageDialog, type IconHint, type IconPick } from './SlideBlockTools'
import { SlideBlockBar } from './SlideBlockBar'
import { tabsWithViews } from '../../../extensions/tabs/TabsView'
import { canHoldTabs, pastedWithoutTabs, setPendingRename, tabsBlockNode, tabsPosAtSelection } from '../../../extensions/tabs/tabsCommands'
import { ButtonBlockTools } from '../../../extensions/buttonBlock/ButtonBlockTools'
import { BUTTON_ASK, BUTTON_DROP, buttonNode } from '../../../extensions/buttonBlock/buttonCommands'
import { tabAcross } from './blockBar'
import { SlideCommentNode, SlideComments, caretTarget, clickTarget, startSlideComment } from '../SlideComments'
import { keyPastNotes, type SlideTarget } from './slideCommentPlace'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut, ContextMenuTrigger } from '../../ui/context-menu'
import { Icon } from '../../ui/Icon'
import { isMac } from '../../../hooks/usePlatform'
import { TableHandles, tableHandlesEnabled, tableMenuTargetAt } from '../../../extensions/tables/TableHandles'
import { TableHandlesLayer, useAltHeld } from '../../tables/TableHandlesLayer'
import { TableMenuItems, runClipboardEdit, type MenuKit, type TableMenuTarget } from '../../tables/TableMenuItems'
import { PictureTools, stageBounds } from '../../pictures/PictureTools'
import { PictureMakerView, usePictureMaker, type PictureAwayOptions, type PicturePlaceRef } from '../../pictures/ChatgptPicture'
import { slidePictureKey } from '../../pictures/picturesAway'
import { chosenPicture, chosenPictureUnder, leavePicture, replacePictureKeepingCaret } from '../../../extensions/pictures/pictureCommands'
import { isRelativeImagePath } from '../../../../../src/utils/imagePaths'
import { topBlockAt } from './slideCommentPlace'
import { sendToExtension } from '../../../bridge'
import { SidePicture } from './SidePicture'
import { BehindChip } from './BehindChip'
import { BubbleMenuBox } from './BubbleMenuBox'
import { CHIP_WIDTH_EMPTY, CHIP_WIDTH_FILLED, behindChipCorner, behindChipPlace, type ChipPlace } from './behindChipPlace'
import { EMPTY_SIDE, flowToSide, sideToText, type SideHeader } from './slidePicturePlace'
import { pictureNthAt, picturePosOf, putSlidePicture, samePicture, sameSidePath, type SlideDocKit, type SlidePictureTarget } from './slidePictureSwap'

export interface SlideEditorProps {
  /** The handout's editor, which holds the deck: the slide is written to its node there, and its history is the undo. */
  outer: TipTapEditor
  slide: DeckSlideEntry
  width: number
  theme: DeckTheme
  borderless: boolean
  /** The slide's pictures as webview URIs, by the paths the slide names. */
  assets: Record<string, string>
  /** 17 November: the pictures the host looked for and didn't find: drawn as missing, with Replace picture…. */
  missing?: ReadonlySet<string>
  commentCallouts?: boolean
  /** The person wrote on the slide: the handout keeps it the current one. */
  onWriting: () => void
  /** Put the caret in the slide's title once it is drawn (a new slide's), or select it whole (a deck New made). */
  focusTitle?: { select: boolean } | null
  onFocusTaken?: () => void
  /**
   * A picture pasted or dropped on the slide, read as a data URL. `atCaret`: the / menu's Picture chose it, so it goes
   * where the / was (`picture` brings it back once saved).
   */
  onPicture: (dataUrl: string, filename: string, atCaret?: boolean) => void
  /** Sprint 161: open one of the slide's saved comments (the deck's bar, Prev and Next), by its place; a new serial asks again. */
  commentOpen?: { ordinal: number; serial: number } | null
  /** The comment asked for in `commentOpen` was opened: the asker forgets the request. */
  onCommentOpened?: (serial: number) => void
  /** PR 3: the / menu's New slide below. */
  onNewSlideBelow?: () => void
  /** PR 3: Split slide here: the slide's Markdown before the caret stays, the Markdown after it is a new slide below. */
  onSplit?: (before: string, after: string) => void
  /** PR 3: the slide is full (its words at their smallest step and still more than the slide holds), or no longer. */
  onFull?: (full: boolean) => void
  /** PR 3: the bar's Split at the cursor found no caret on the slide to split at. */
  onNeedCaret?: () => void
  /** The right-click menu's Slide settings… (17 November): the popover at the point the menu was opened. */
  onSlideSettings?: (at: { x: number; y: number }) => void
  /** PR 3: the deck bar's Split at the cursor: each new number splits the slide at the caret. */
  splitRequest?: number
  /** PR 3: the picture the / menu's Picture asked for, saved beside the deck: it goes where the / was. */
  picture?: { path: string; url: string; serial: number } | null
}

/** The slide's / menu's suggestion, by its own key: while it is open, the words after the / are its query. */
const slideSlashKey = new PluginKey('slideSlash')

/** Is the slide's / menu open (its query being typed)? */
function slashOpen(state: EditorState): boolean {
  return !!(slideSlashKey.getState(state) as { active?: boolean } | undefined)?.active
}

/** What the slide's blocks, its / menu and its keys do (PR 3), as the editor's extensions call them. */
interface SlideTools {
  runItem: (range: { from: number; to: number }, item: BlockItemDef) => void
  enter: () => boolean
  splitLine: () => boolean
  tab: (direction: 1 | -1) => boolean
  pickIcon: (pos: number, anchor: HTMLElement, current: string | null) => void
  hintIcon: (pos: number, anchor: HTMLElement, name: string) => void
}

/** A paragraph that holds only `***`, the caret at its end: Split slide here's shortcut (frame 22). */
function splitLineAt(state: EditorState): { from: number; to: number } | null {
  const { $from, empty } = state.selection
  if (!empty || $from.parent.type.name !== 'paragraph' || $from.parent.textContent !== '***' || $from.parentOffset !== 3) return null
  return { from: $from.before(), to: $from.after() }
}

/** The right-click menu's shortcuts, as the platform writes them. */
const KEYS = isMac
  ? { cut: '⌘X', copy: '⌘C', paste: '⌘V', comment: '⌘/' }
  : { cut: 'Ctrl+X', copy: 'Ctrl+C', paste: 'Ctrl+V', comment: 'Ctrl+/' }

/**
 * The slide's Markdown as the stage edits it: a block slide's, or a v1 slide's as blocks (converted in memory). A Steps
 * block's old pill is the Label it becomes (Sprint 164 PR 3, `withStepsLabels`): the deck's first edit writes it so.
 */
export function stageMarkdownOf(kind: string, data: SlideData): string {
  return isBlockSlide(kind) ? withStepsLabels(data.markdown ?? '') : blockDataOf(kind, data).markdown ?? ''
}

/** An empty slide opens with an empty title, so the first words typed are its title (frame 21). */
const EMPTY_SLIDE_HTML = '<h1></h1>'

/**
 * The HTML the stage opens a slide with: a slide with no heading at all (a new Boxes slide's empty boxes) opens with an
 * empty title over its blocks, so there is a title to type (review of #765). Unwritten while it stays empty: an empty
 * heading saves as nothing, and an untouched slide writes back its Markdown as it was.
 */
function slideHTML(markdown: string, assets: Record<string, string>): string {
  if (!markdown.trim()) return EMPTY_SLIDE_HTML
  const html = markdownToSlideEditorHTML(markdown, assets)
  return blockTitleOf(markdown) ? html : EMPTY_SLIDE_HTML + html
}

/** The slide's node, as the handout's document has it now: by its id, else by its place. */
function freshEntry(outer: TipTapEditor, slide: DeckSlideEntry): DeckSlideEntry | undefined {
  const slides = slidesOf(outer.state.doc)
  const id = slide.data.id
  return (id ? slides.find(entry => entry.data.id === id) : undefined) ?? slides[slide.index]
}

/** The title's text range: the first H1, else the first block with text in it. */
function titleRange(doc: PMNode): { from: number; to: number } | null {
  let found: { from: number; to: number } | null = null
  doc.descendants((node, pos) => {
    if (found) return false
    if (node.isTextblock && (node.type.name === 'heading' ? node.attrs.level === 1 : false)) {
      found = { from: pos + 1, to: pos + node.nodeSize - 1 }
      return false
    }
    return true
  })
  if (found) return found
  doc.descendants((node, pos) => {
    if (found) return false
    if (node.isTextblock) {
      found = { from: pos + 1, to: pos + node.nodeSize - 1 }
      return false
    }
    return true
  })
  return found
}

const NO_MISSING: ReadonlySet<string> = new Set()

export function SlideEditor({ outer, slide, width, theme, borderless, assets, missing = NO_MISSING, commentCallouts, onWriting, focusTitle, onFocusTaken, onPicture, commentOpen, onCommentOpened, onNewSlideBelow, onSplit, onFull, onNeedCaret, onSlideSettings, splitRequest, picture }: SlideEditorProps) {
  // The latest of the stage's callbacks, for the editor's extensions (made once per editor).
  const actionsRef = useRef({ onNewSlideBelow, onSplit, onFull, onNeedCaret })
  actionsRef.current = { onNewSlideBelow, onSplit, onFull, onNeedCaret }
  const slideRef = useRef(slide)
  slideRef.current = slide
  const assetsRef = useRef(assets)
  assetsRef.current = assets
  const missingRef = useRef(missing)
  missingRef.current = missing
  const onWritingRef = useRef(onWriting)
  onWritingRef.current = onWriting
  const onPictureRef = useRef(onPicture)
  onPictureRef.current = onPicture
  const syncRef = useRef<SlideSync | null>(null)
  // The editor the sync was made for: a new editor (its extensions changed) gets a new sync, on its own schema.
  const syncEditor = useRef<TipTapEditor | null>(null)
  const frameRef = useRef<HTMLDivElement | null>(null)
  const fitStepRef = useRef(0)
  /** PR 3: the next write is an undo step of its own: a block's ('command'), then the typing after it ('after'). */
  const stepRef = useRef<'none' | 'command' | 'after'>('none')
  /** The next write is a new button taken away (`BUTTON_DROP`): out of the deck's undo history. */
  const quietRef = useRef(false)
  /** A new button was just added (`BUTTON_ASK`): its write records the deck's undo depth after it (`addedDepthRef`). */
  const askRef = useRef(false)
  /** The deck's undo depth just after a new button was written: while it holds, undoing takes back exactly that. */
  const addedDepthRef = useRef<number | null>(null)
  /** PR 3: words not yet written because the / menu was open (or an input method composing). */
  const heldRef = useRef(false)
  /** Is the slide full: its words at the smallest step and still more than it holds (told to the deck's bar). */
  const fullRef = useRef(false)
  /** PR 3: where the person last had the caret on this slide (the bar's Split at the cursor splits there); null before. */
  const lastCaret = useRef<number | null>(null)
  const outerRef = useRef(outer)
  outerRef.current = outer

  const nodeMarkdown = stageMarkdownOf(slide.kind, slide.data)
  // The Markdown the slide shows now: for its cover look while it is being typed.
  const [shownMarkdown, setShownMarkdown] = useState(nodeMarkdown)
  if (commentCallouts) ensureSlideCommentPipeline()
  // What the stage's step belongs to, as the strip and the wall draw this slide (`fitKeyOf`); none while words wait
  // unwritten (the / menu's query), since the slide drawn elsewhere doesn't have them yet.
  const header = isBlockSlide(slide.kind) ? slide.data : blockDataOf(slide.kind, slide.data)
  const fitKeyRef = useRef<string | null>(null)
  /** This stage, as the owner of the step it tells (`clearStageFit`). */
  const fitOwner = useRef({})
  fitKeyRef.current = shownMarkdown === nodeMarkdown ? fitKeyOf(nodeMarkdown, header.image, header.picture, fitLookOf(borderless, theme), contentPlaceFitKey(nodeMarkdown, header.valign, sidePictureOf(header))) : null
  /** Lays Replace picture… over each missing picture (set below, once the editor is made). */
  const placeMissingRef = useRef<() => void>(() => {})
  /** Sprint 167 PR 4: places the picture Behind's corner chip clear of the words (set below, with the slide's look). */
  const placeChipRef = useRef<() => void>(() => {})
  const [chipPlace, setChipPlace] = useState<ChipPlace | null>(null)

  /**
   * Write the stage's Markdown to the slide's node: one transaction, converting the deck first when it holds v1 slides.
   * `ownStep`: an undo step of its own (a block from the / menu, an icon, a row, and the first typing after one).
   */
  const write = useCallback((markdown: string, doc: PMNode, ownStep = false, quiet = false) => {
    const editorOuter = outerRef.current
    if (editorOuter.isDestroyed) return
    const entry = freshEntry(editorOuter, slideRef.current)
    if (!entry) return
    const tr = editorOuter.state.tr
    if (ownStep) closeHistory(tr)
    // A new button left without an address goes out of the history too (`dropNewButton`): ⌘Z never brings it back.
    if (quiet) tr.setMeta('addToHistory', false)
    convertDeckInto(tr)
    // The conversion puts comments at the ends of parts: this slide's place moves past any put before it.
    const pos = tr.mapping.map(entry.pos)
    const node = tr.doc.nodeAt(pos)
    if (!node || node.type.name !== 'deckSlide' || !isBlockSlide(node.attrs.kind)) return
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, body: withBlockMarkdown(node.attrs.body, markdown) })
    // Known as the stage's own before anything hears of it, so its echo is never taken for a change from elsewhere.
    syncRef.current?.wrote(markdown, doc)
    editorOuter.view.dispatch(tr)
    if (askRef.current) {
      askRef.current = false
      addedDepthRef.current = undoDepth(editorOuter.state)
    }
    setShownMarkdown(markdown)
    onWritingRef.current()
  }, [])

  // Undo and redo are the deck's, as on the rest of the stage: this editor keeps no history of its own. ⌘/ comments on
  // the selected words, or on the caret's block (Sprint 161).
  const OuterHistory = useMemo(() => Extension.create({
    name: 'slideOuterHistory',
    // Before the editor's own Backspace and Delete, which would otherwise take a comment hidden next to the caret.
    priority: 1000,
    addKeyboardShortcuts() {
      const undo = () => { outerRef.current.commands.undo(); return true }
      const redo = () => { outerRef.current.commands.redo(); return true }
      const comment = () => (commentCallouts ? startSlideComment(this.editor as TipTapEditor, caretTarget(this.editor as TipTapEditor)) : false)
      // A comment on a block is a hidden note before it: Backspace and Delete join the blocks around it and keep it.
      // The notes move only when the ordinary key then joins (`keyPastNotes` tries it first); it runs next, as always.
      // A block it can't join is selected instead, and the notes stay.
      const pastNotes = (direction: 'backward' | 'forward') => () => {
        const step = keyPastNotes(this.editor.state, direction)
        if (step === 'stop') return true
        if (!step) return false
        this.editor.view.dispatch(step.tr)
        return step.done
      }
      return { 'Mod-z': undo, 'Mod-Shift-z': redo, 'Mod-y': redo, 'Shift-Mod-z': redo, 'Mod-/': comment, Backspace: pastNotes('backward'), Delete: pastNotes('forward') }
    },
  }), [commentCallouts])

  // PR 3: what the slide's blocks, its / menu and its keys do, read at the moment they are used (`tools` is set below,
  // on every render), so the editor's extensions are made once.
  const toolsRef = useRef<SlideTools | null>(null)
  const divHandlers = useMemo<SlideDivHandlers>(() => ({
    pickIcon: (pos, anchor, current) => toolsRef.current?.pickIcon(pos, anchor, current),
    hintIcon: (pos, anchor, name) => toolsRef.current?.hintIcon(pos, anchor, name),
  }), [])
  // Small details 14: the Agenda reads the deck's sections from the handout's editor, and draws again as they change.
  const agendaSource = useMemo<AgendaSource>(() => ({
    current: () => {
      const deck = outerRef.current
      if (deck.isDestroyed) return { entries: [], hint: true }
      return { entries: agendaOf(slidesOf(deck.state.doc).map(entry => ({ kind: entry.kind, data: entry.data, number: entry.index + 1 }))), hint: true }
    },
    // Every change to the deck, the host's too (a section renamed by an AI while the slide is open).
    subscribe: listener => onDocChanged(outer, listener),
    // A new deck editor makes a new source (and a new slide editor), so the Agenda never listens to a gone one.
  }), [outer])
  const SlideKeys = useMemo(() => Extension.create({
    name: 'slideKeys',
    priority: 900,
    addKeyboardShortcuts() {
      return {
        // In a table, Enter goes on to the cell below (a new row under the last), as Tab goes on to the next cell.
        Enter: () => toolsRef.current?.enter() ?? false,
        // `***` alone on a line, then Space or Enter: Split slide here's shortcut.
        Space: () => toolsRef.current?.splitLine() ?? false,
        // 17 November: Tab and Shift+Tab move across a Columns or Boxes block's items (a list's, a code box's and a
        // table's own Tab first: `tabAcross` leaves those alone).
        Tab: () => toolsRef.current?.tab(1) ?? false,
        'Shift-Tab': () => toolsRef.current?.tab(-1) ?? false,
      }
    },
  }), [])
  const SlideSlash = useMemo(() => SlashCommands.configure({
    // Sprint 163: in a tab's pane, never Tabs or the slide's own items; never Tabs in a box, Steps or a table cell.
    itemsFor: current => slideItemsAt(current.state),
    run: (_editor, range, item) => toolsRef.current?.runItem(range, item),
    pluginKey: slideSlashKey,
  }), [])
  // Experience 48: the table's handles and keys. A right-click in a cell opens the slide's own menu, with the cell's
  // table items first (below), so Comment and Slide settings stay where they are.
  const SlideTableHandles = useMemo(() => (tableHandlesEnabled() ? TableHandles.configure({ contextMenu: false }) : null), [])

  // The handout's comment node, with the slide's own storage and ⌘/ (`SlideCommentNode`).
  const extensions = useMemo(() => createEditorSchemaExtensions({
    beforeLink: [Placeholder.configure({
      // The title's, and an empty column's "Heading" over "Text" (PR 3), nested ones included; an empty Label's while
      // the caret is in it (Sprint 164 PR 3).
      placeholder: ({ editor: current, node, pos, hasAnchor }) => slidePlaceholderOf(node, pos > 0 ? current.state.doc.resolve(pos).parent : null, isTitlePlace(current.state.doc, node, pos), hasAnchor),
      showOnlyCurrent: false,
      includeChildren: true,
    })],
    // 17 November: a picture whose file is gone is drawn as missing, with its name.
    image: SlidePicture,
    // Sprint 163 PR 1: the Text document's code block, with Copy always shown and its ↗ Open in… beside it.
    codeBlock: SlideCodeBlock,
    // Experience 48: the table's own handles and keys; its right-click items join the slide's own menu below.
    // Sprint 168 PR 1 (#863): a quote's attribution marked as the renderer marks it.
    afterImage: [OuterHistory, SlideKeys, SlideSlash, CodeFillPlaces, SlideQuoteBy, slideMissingPictures(() => missingRef.current), ...(SlideTableHandles ? [SlideTableHandles] : [])],
    commentCallouts,
    deck: [slideDivWithView(divHandlers), slideAgendaWithView(agendaSource), SlideLabel],
    // Sprint 163: the Tabs block with its band, drawn as the renderer draws it.
    tabs: tabsWithViews('slide'),
  }).map(extension => {
    if (extension.name === 'starterKit') return extension.configure({ history: false })
    if (extension.name === 'commentNode') return SlideCommentNode.extend()
    return extension
  }), [OuterHistory, SlideKeys, SlideSlash, SlideTableHandles, divHandlers, agendaSource, commentCallouts])

  const editor = useEditor({
    extensions,
    content: slideHTML(nodeMarkdown, assets),
    editorProps: {
      attributes: { class: 'blk-flow', spellcheck: 'true', 'aria-label': 'The slide' },
      handlePaste: (_view, event) => takePicture(event.clipboardData, true),
      // Sprint 163: a Tabs block pasted where none may go (another's pane, a box, Steps, a table cell) comes in as its
      // tabs' words, each under its name.
      transformPasted: (slice, view) => (canHoldTabs(view.state) ? slice : pastedWithoutTabs(view.state.schema, slice)),
      // The slide never scrolls (the lead on #769: at the fit's floor the caret at the bottom scrolled the slide's words up
      // and cut its title at the top): it may overflow at the bottom only. See also the flow's scroll reset below.
      handleScrollToSelection: () => true,
      handleDrop: (_view, event) => takePicture((event as DragEvent).dataTransfer, false, event.target),
      handleDOMEvents: {
        // The Edit menu's Undo and Redo, and the system's: the deck's history.
        beforeinput: (_view, event) => {
          const type = (event as InputEvent).inputType
          if (type !== 'historyUndo' && type !== 'historyRedo') return false
          event.preventDefault()
          if (type === 'historyUndo') outerRef.current.commands.undo()
          else outerRef.current.commands.redo()
          return true
        },
      },
    },
    onUpdate: ({ editor: updated, transaction }) => {
      if (transaction.getMeta(SLIDE_SYNC)) return
      syncRef.current?.track(transaction)
      // A table's row, column, move, sort or alignment (experience 48) is an undo step of its own too.
      if (isOwnStep(transaction)) stepRef.current = 'command'
      if (transaction.getMeta(BUTTON_DROP)) quietRef.current = true
      if (transaction.getMeta(BUTTON_ASK)) askRef.current = true
      // An input method's word is written once it is composed (the composition's end), never mid-word; the / menu's
      // query once the menu has closed (PR 3).
      if (updated.view.composing || slashOpen(updated.state)) {
        heldRef.current = true
        return
      }
      // The change that closed the menu (its item, a space): what waited is written with it, as one step.
      if (heldRef.current) flushHeld(updated)
      else writeNow(updated)
    },
    // The / menu closed with no change of the words (the caret moved away): what waited is written now. A change of
    // the words is the update's (above), so a block's own undo step is known before it is written (review of #769).
    onTransaction: ({ editor: updated, transaction }) => {
      if (!transaction.docChanged) flushHeld(updated)
      // The / menu's Picture goes where the / was, through whatever changes while the host saves it.
      if (transaction.docChanged && pictureAt.current !== null) pictureAt.current = transaction.mapping.map(pictureAt.current)
      // A picture deleted while its replacement is saved is no longer replaced (review of #774).
      if (transaction.docChanged && replaceAt.current !== null) { const mapped = transaction.mapping.mapResult(replaceAt.current, 1); replaceAt.current = mapped.deleted ? null : mapped.pos }
      if (transaction.docChanged && pendingReplace.current !== null) { const mapped = transaction.mapping.mapResult(pendingReplace.current, 1); pendingReplace.current = mapped.deleted ? null : mapped.pos }
      if (transaction.docChanged && lastCaret.current !== null) lastCaret.current = transaction.mapping.map(lastCaret.current)
    },
    // Leaving the slide writes what waited even with the menu still open (its query is words then, as typed): a slide
    // left for another is never left with words unwritten (review of #769).
    onBlur: ({ editor: updated }) => flushHeld(updated, true),
    onFocus: ({ editor: updated }) => { lastCaret.current = updated.state.selection.from },
    onSelectionUpdate: ({ editor: updated }) => { if (updated.isFocused) lastCaret.current = updated.state.selection.from },
  }, [extensions])
  // The slide's sync, made with the editor from the Markdown it was made with.
  if (editor && syncEditor.current !== editor) {
    syncEditor.current = editor
    const load = (markdown: string) => loadSlideDoc(editor.schema, markdown, assetsRef.current)
    syncRef.current = new SlideSync(load, doc => saveSlideMarkdown(doc, getHTMLFromFragment(doc.content, editor.schema), load), nodeMarkdown, editor.state.doc)
  }

  /** Write the stage's words to the node when the node lacks them. */
  function writeNow(current: TipTapEditor | CoreEditor) {
    // Read once and cleared before any early return, so it never reaches a later, unrelated write (review of #811).
    const quiet = quietRef.current
    quietRef.current = false
    const sync = syncRef.current
    if (!sync || current.isDestroyed) return
    const markdown = sync.toWrite(current.state.doc)
    if (markdown === null) {
      sync.settled(current.state.doc)
      return
    }
    // A block from the / menu is an undo step of its own, and so is the first typing after it (else it would join it).
    const step = stepRef.current
    write(markdown, current.state.doc, step !== 'none', quiet)
    stepRef.current = step === 'command' ? 'after' : 'none'
  }

  /** Words held while the / menu was open (or an input method composed): written once neither is so. */
  /**
   * A new button left without an address (the Experience lead, 19 November: no dead ⌘Z): its adding is the deck's last
   * undo step while the depth written after it holds, so undoing that step takes it back and leaves no step at all; the
   * slide follows the deck. False otherwise: the button then goes out of the history (`dropNewButton`).
   */
  function takeBackNewButton(): boolean {
    const outer = outerRef.current
    const depth = addedDepthRef.current
    addedDepthRef.current = null
    if (outer.isDestroyed || depth === null || undoDepth(outer.state) !== depth) return false
    return outer.commands.undo()
  }

  function flushHeld(current: TipTapEditor | CoreEditor, leaving = false) {
    if (!heldRef.current || current.isDestroyed || current.view.composing || (!leaving && slashOpen(current.state))) return
    heldRef.current = false
    const sync = syncRef.current
    if (!sync) return
    // A change of the node that waited meanwhile is laid over them first, as after a composition.
    const tr = sync.compositionEnded(current.state)
    if (tr) current.view.dispatch(tr)
    writeNow(current)
  }

  /**
   * A picture from the computer onto the slide: pasted (unless words are being pasted) or dropped. Onto a chosen picture
   * it replaces it (experience 49); onto the chosen side picture, the slide's place takes it, as before.
   */
  function takePicture(transfer: DataTransfer | null, pasted: boolean, dropTarget: EventTarget | null = null): boolean {
    // A drop replaces the chosen picture only when it lands on it (Codex on #774); a paste always does.
    const chosen = !editor || editor.isDestroyed ? null : pasted ? chosenPicture(editor.state) : chosenPictureUnder(editor.view, dropTarget)
    return takeImageFile(transfer, pasted, (dataUrl, filename) => {
      if (!chosen) return onPictureRef.current(dataUrl, filename)
      replaceAt.current = chosen.pos
      onPictureRef.current(dataUrl, filename, true)
    })
  }

  // A change of the node from elsewhere (an undo, an AI's edit): its smallest replacement, once no input method composes.
  useEffect(() => {
    const sync = syncRef.current
    if (!editor || editor.isDestroyed || !sync) return
    // It waits while an input method composes, or while the / menu's query is typed (PR 3: `flushHeld` takes it in).
    const holding = editor.view.composing || slashOpen(editor.state)
    const tr = sync.incoming(nodeMarkdown, editor.state, holding)
    if (holding) heldRef.current = true
    if (tr) editor.view.dispatch(tr)
    setShownMarkdown(nodeMarkdown)
  }, [editor, nodeMarkdown])
  useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom
    const ended = () => {
      // After the composition's own last input, so its words are written first.
      requestAnimationFrame(() => {
        const sync = syncRef.current
        if (!sync || editor.isDestroyed || editor.view.composing) return
        const tr = sync.compositionEnded(editor.state)
        if (tr) editor.view.dispatch(tr)
        // The composed word, with any change that waited for it.
        writeNow(editor)
      })
    }
    dom.addEventListener('compositionend', ended)
    return () => dom.removeEventListener('compositionend', ended)
  }, [editor])
  // The pictures' webview addresses came: the slide is parsed again for them (its Markdown stays as it is).
  const assetKey = JSON.stringify(assets)
  const firstAssets = useRef(assetKey)
  useEffect(() => {
    if (assetKey === firstAssets.current) return
    firstAssets.current = assetKey
    const sync = syncRef.current
    if (!editor || editor.isDestroyed || !sync || editor.view.composing) return
    const tr = sync.reparse(editor.state)
    if (tr) editor.view.dispatch(tr)
  }, [editor, assetKey])

  // The caret in the title (a new slide), or the title selected whole to be typed over (a deck New made).
  const focusAsked = focusTitle ? (focusTitle.select ? 'select' : 'caret') : null
  useEffect(() => {
    if (!editor || editor.isDestroyed || !focusAsked) return
    const range = titleRange(editor.state.doc)
    const from = range ? (focusAsked === 'select' ? range.from : range.to) : 1
    const to = range ? range.to : 1
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, from, to)))
    editor.view.focus()
    onFocusTaken?.()
  }, [editor, focusAsked, onFocusTaken])

  // The fit: the words step down while they overflow, and up only with room to spare (slideFit.ts). Measured after
  // every change, at a new width or look, and once the fonts have loaded.
  // 17 November: the one measure the strip, the wall and the page use too (`fitFlow`): words past the top, the bottom or
  // a right edge (a word is never split) step it down. The step is told to them (`setStageFit`), by what the stage
  // draws, so the slide drawn anywhere else is this one scaled. Only typing keeps the step it had (the 3 % that stops it
  // swinging at the edge); a slide coming onto the stage, a new size or look, the fonts or a picture loading measure from
  // the top, as the strip does, so a step taken before a picture had its height never stays.
  const refit = useCallback((fresh: boolean) => {
    if (!editor || editor.isDestroyed) return
    const flow = editor.view.dom as HTMLElement
    const { step, full } = fitFlow(flow, fresh ? 0 : fitStepRef.current)
    fitStepRef.current = step
    frameRef.current?.setAttribute('data-step', String(step))
    if (fitKeyRef.current) setStageFit({ key: fitKeyRef.current, step, owner: fitOwner.current })
    // PR 3 (frame 24): at the floor with words still past the slide's edge, the deck's bar says the slide is full.
    if (full !== fullRef.current) {
      fullRef.current = full
      actionsRef.current.onFull?.(full)
    }
    placeMissingRef.current()
    placeChipRef.current()
  }, [editor])
  // A slide that leaves the stage is no longer the full one, and its step is no longer the stage's.
  useEffect(() => () => {
    if (fullRef.current) actionsRef.current.onFull?.(false)
    // Only this stage's own: a new stage with the same words has told its step already (review of #771).
    clearStageFit(fitOwner.current)
  }, [])
  // Once per change of the words (the editor's update), and when the size, the look or the cover look change.
  // Sprint 167 PR 3: the content's place too (a title slide moved up keeps a top-right logo's room), worked out once.
  const placeClass = contentPlaceClass(shownMarkdown, header.valign, sidePictureOf(header))
  const lookKey = `${width}\u0000${borderless}\u0000${JSON.stringify(theme)}\u0000${isCoverSlide(shownMarkdown)}\u0000${slide.data.picture ?? ""}\u0000${placeClass}`
  useLayoutEffect(() => { refit(true) }, [refit, lookKey])
  // The words just written reach the slide's node, and its thumbnail, after the update that measured them: the step is
  // told again under their key.
  useLayoutEffect(() => {
    if (fitKeyRef.current) setStageFit({ key: fitKeyRef.current, step: fitStepRef.current, owner: fitOwner.current })
  })
  // The host said which pictures it didn't find: they are drawn as missing (17 November). Nothing in the slide changes.
  const missingKey = [...missing].sort().join('\n')
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    editor.view.dispatch(editor.state.tr.setMeta(SLIDE_MISSING_PICTURES, true))
    refit(true)
  }, [editor, missingKey, refit])
  // Replace picture… follows its picture as the slide is drawn again (a new size, a missing picture beside).
  useLayoutEffect(() => { placeMissingRef.current() })
  useEffect(() => {
    if (!editor) return
    // A slide that comes onto the stage full is said full, whatever the slide it replaced said: that slide's stage leaves
    // with "no longer full" (the cleanup above), and React runs that cleanup after this stage's layout effect has
    // measured, so the line went from a full slide to a full one (the join of a slide into a full one above it). Fitted
    // again here and once more after the frame, and the state told as it is.
    const fresh = () => refit(true)
    const typed = () => refit(false)
    fresh()
    actionsRef.current.onFull?.(fullRef.current)
    const settle = requestAnimationFrame(fresh)
    editor.on('update', typed)
    const fonts = document.fonts
    fonts?.addEventListener?.('loadingdone', fresh)
    // A picture takes its height once it has loaded, after the update that put it in (PR 3's app run: a picture from
    // the / menu left the slide at its first step, overflowing, until the next key).
    const flow = editor.view.dom
    flow.addEventListener('load', fresh, true)
    // An Agenda drawn again for the deck's sections (a section added or renamed elsewhere) changes the slide's height.
    flow.addEventListener(AGENDA_DRAWN_EVENT, fresh)
    // The browser keeps a caret in view by scrolling the clipped flow itself: it is put back, so the title stays whole.
    const unscroll = () => { if (flow.scrollTop || flow.scrollLeft) { flow.scrollTop = 0; flow.scrollLeft = 0 } }
    flow.addEventListener('scroll', unscroll)
    return () => {
      cancelAnimationFrame(settle)
      editor.off('update', typed)
      fonts?.removeEventListener?.('loadingdone', fresh)
      flow.removeEventListener('load', fresh, true)
      flow.removeEventListener(AGENDA_DRAWN_EVENT, fresh)
      flow.removeEventListener('scroll', unscroll)
    }
  }, [editor, refit])

  // ---- PR 3: the slide's / menu, its blocks' own tools, and the bar's and Settings' requests

  const [iconPick, setIconPick] = useState<IconPick | null>(null)
  /** #850: the box's unknown icon being pointed at (its tooltip). */
  const [iconHint, setIconHint] = useState<IconHint | null>(null)
  const endIconHint = useCallback(() => setIconHint(null), [])
  // Any change to the slide's words ends it (yours, an undo, or an AI's edit of the file): the box's place it holds may
  // be another block's now.
  useEffect(() => {
    if (!editor || !iconHint) return
    const changed = ({ transaction }: { transaction: Transaction }) => { if (transaction.docChanged) setIconHint(null) }
    editor.on('transaction', changed)
    return () => { editor.off('transaction', changed) }
  }, [editor, iconHint])
  const [webPageAt, setWebPageAt] = useState<number | null>(null)
  /** Where the / menu's Picture goes once the host has saved it. */
  const pictureAt = useRef<number | null>(null)
  /** 17 November: the missing picture Replace picture… was chosen on: the saved picture takes its place. */
  const replaceAt = useRef<number | null>(null)
  /** That picture while its file picker is open: it becomes `replaceAt` only when a file is chosen. */
  const pendingReplace = useRef<number | null>(null)

  const apply = (tr: Transaction | null): boolean => {
    if (!tr || !editor || editor.isDestroyed) return false
    editor.view.dispatch(tr)
    return true
  }

  /** One part of the slide as its Markdown, saved the stage's way. */
  const markdownOfDoc = (doc: PMNode): string => {
    const schema = doc.type.schema
    return saveSlideMarkdown(doc, getHTMLFromFragment(doc.content, schema), markdown => loadSlideDoc(schema, markdown, assetsRef.current))
  }

  /** Split slide here, at `pos` in `state`: the deck keeps the words before it on this slide and makes a new one below. */
  const splitAt = (state: EditorState, pos: number): boolean => {
    const halves = splitSlideHalves(state, pos)
    const before = markdownOfDoc(halves.before)
    // A cut before everything would leave this slide empty and move it whole: nothing is split (review of #769).
    if (!before.trim()) return false
    actionsRef.current.onSplit?.(before, markdownOfDoc(halves.after))
    return true
  }

  /**
   * The / menu's Picture: the computer's file picker, then the host saves the picture beside the deck. `atCaret` false:
   * the slide's own picture beside or behind it (Replace picture… on a missing one).
   */
  const choosePicture = (atCaret = true, replacing = false) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    // The / menu's place this picker was opened for, so cancelling it forgets only that (review of #771).
    const slashAt = replacing || !atCaret ? null : pictureAt.current
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) return
      // Replace picture…: the picture chosen takes the missing one's place once saved; the / menu's waits as it was.
      if (replacing) {
        replaceAt.current = pendingReplace.current
        pendingReplace.current = null
      }
      void readFileAsBase64(file).then(dataUrl => onPictureRef.current(dataUrl, getUniqueImageFilename(file), atCaret))
    })
    // Cancelled: only what this picker would have filled stops waiting.
    input.addEventListener('cancel', () => {
      if (replacing) pendingReplace.current = null
      else if (slashAt !== null && pictureAt.current === slashAt) pictureAt.current = null
    })
    input.click()
  }

  // 17 November: Replace picture… over each missing picture, in the frame (unscaled, so the button is its own size).
  const [missingSpots, setMissingSpots] = useState<{ left: number; top: number; side: boolean; path: string; nth: number }[]>([])
  placeMissingRef.current = () => {
    const frameElement = frameRef.current
    if (!frameElement) return
    const origin = frameElement.getBoundingClientRect()
    // The same missing picture may stand twice on a slide: each button knows which one it is (Codex on #771).
    const seen = new Map<string, number>()
    const spots = Array.from(frameElement.querySelectorAll<HTMLElement>('.blk-flow > .blk-pic.is-missing, .photo.is-missing')).map(place => {
      const box = place.getBoundingClientRect()
      const words = place.querySelector('.blk-missing')?.getBoundingClientRect()
      const side = place.classList.contains('photo')
      const path = place.getAttribute('data-picture') ?? ''
      const nth = side ? 0 : seen.get(path) ?? 0
      if (!side) seen.set(path, nth + 1)
      return {
        left: Math.round(box.left + box.width / 2 - origin.left),
        top: Math.round((words ? words.bottom : box.top + box.height / 2) - origin.top + 4),
        side,
        path,
        nth,
      }
    })
    setMissingSpots(current => (JSON.stringify(current) === JSON.stringify(spots) ? current : spots))
  }
  /** Replace picture… on a missing picture: the file picker; the picture saved beside the deck takes its place. */
  const replacePicture = (spot: { side: boolean; path: string; nth: number }) => {
    if (!editor || editor.isDestroyed) return
    if (spot.side) { choosePicture(false); return }
    // The picture the button stands over: the nth with its path, in the slide's order (as the places are drawn).
    let found: number | null = null
    let count = 0
    editor.state.doc.descendants((node, pos) => {
      if (found !== null || node.type.name !== 'image' || imagePathOf(node.attrs) !== spot.path) return
      if (count++ === spot.nth) found = pos
    })
    if (found === null) return
    // Waits for the picker: only a picture chosen there replaces it, never the / menu's next one.
    pendingReplace.current = found
    choosePicture(true, true)
  }

  toolsRef.current = {
    runItem: (range, item) => {
      if (!editor || editor.isDestroyed) return
      const ownStep = ({ tr }: { tr: Transaction }) => { tr.setMeta(SLIDE_COMMAND, true); return true }
      // The / and its query go first; what was never written (the menu held it) is never written.
      const chain = () => editor.chain().focus().deleteRange(range)
      switch (item.nodeType) {
        case 'heading':
          chain().setNode('heading', item.attrs).command(ownStep).run()
          return
        case 'bulletList':
          chain().toggleBulletList().command(ownStep).run()
          return
        case 'orderedList':
          chain().toggleOrderedList().command(ownStep).run()
          return
        case 'codeBlock':
          // Sprint 163 PR 1: a prompt's code block, with its own Copy and ↗ Open in…
          chain().setCodeBlock().command(ownStep).run()
          return
        case 'columns':
        case 'boxes':
        case 'steps':
        case 'table': {
          // A new Steps block comes without a Label (Sprint 164 PR 3: the decks README, "Label, a block of its own").
          const kind = item.nodeType as SlideBlockKind
          chain().command(({ tr }) => { insertSlideBlock(tr, range.from, slideBlockNode(editor.schema, kind)); return true }).run()
          return
        }
        case 'label':
          // Sprint 164 PR 3: an empty Label where the / was, the caret in it ("Label" faint), an undo step of its own.
          chain().command(({ tr }) => { insertSlideBlock(tr, range.from, labelNode(editor.schema)); return true }).run()
          return
        case 'tabs':
          // Sprint 163: "Tab 1" and "Tab 2", the first name chosen so typing names it (its band reads the pending name).
          chain().command(({ tr }) => {
            insertSlideBlock(tr, range.from, tabsBlockNode(editor.schema))
            const at = tabsPosAtSelection(tr)
            if (at !== null) setPendingRename(editor.view, at, 0)
            return true
          }).run()
          return
        case 'button':
          // Sprint 163 PR 3: a button where the / was, an undo step of its own; its address sheet opens at once.
          chain().command(({ tr }) => { insertSlideBlock(tr, range.from, buttonNode(editor.schema)); tr.setMeta(BUTTON_ASK, true); return true }).run()
          return
        case 'agenda':
          // One block line pair, an undo step of its own; the list is the deck's, drawn where it stands.
          chain().command(({ tr }) => { insertSlideBlock(tr, range.from, agendaNode(editor.schema)); return true }).run()
          return
        case 'picture':
          chain().run()
          pictureAt.current = range.from
          choosePicture()
          return
        case 'webPage':
          chain().run()
          setWebPageAt(range.from)
          return
        case 'newSlideBelow':
          chain().run()
          actionsRef.current.onNewSlideBelow?.()
          return
        case 'splitSlide': {
          chain().run()
          // The empty line the / stood on is the cut's place, in neither half.
          const cut = withoutEmptyLineAt(editor.state, editor.state.selection.from)
          splitAt(cut.state, cut.pos)
          return
        }
      }
    },
    enter: () => {
      if (!editor || editor.isDestroyed || slashOpen(editor.state)) return false
      if (apply(cellBelow(editor.state))) return true
      return toolsRef.current?.splitLine() ?? false
    },
    splitLine: () => {
      if (!editor || editor.isDestroyed || slashOpen(editor.state)) return false
      const line = splitLineAt(editor.state)
      if (!line) return false
      // The `***` is the shortcut, not words: the slide is split where its line stood, and the line goes.
      splitAt(editor.state.apply(editor.state.tr.delete(line.from, line.to)), line.from)
      return true
    },
    tab: direction => {
      if (!editor || editor.isDestroyed || slashOpen(editor.state)) return false
      const step = tabAcross(editor.state, direction)
      if (step === null) return false
      if (step !== 'stay') editor.view.dispatch(step)
      return true
    },
    pickIcon: (pos, anchor, current) => {
      const rect = anchor.getBoundingClientRect()
      setIconPick({ pos, rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, current })
      setIconHint(null)
    },
    // #850: never while the icon menu is open for it (the badge is under the menu's own place).
    hintIcon: (pos, anchor, name) => {
      if (!iconPick) setIconHint({ pos, anchor, name })
    },
  }

  // The deck bar's Split at the cursor: split at the caret the slide still has (the bar took the focus).
  const splitSeen = useRef(splitRequest)
  useEffect(() => {
    if (splitRequest === undefined || splitRequest === splitSeen.current) return
    splitSeen.current = splitRequest
    if (!editor || editor.isDestroyed) return
    // Where the person last put the caret on this slide; without one (or before all its words) the bar says where to
    // click instead of moving the slide whole (review of #769).
    const at = lastCaret.current
    if (at === null || at > editor.state.doc.content.size || !splitAt(editor.state, at)) actionsRef.current.onNeedCaret?.()
  })
  // The / menu's picture, saved: where the / was (the slide's end when that place is gone).
  const pictureSeen = useRef(picture?.serial)
  useEffect(() => {
    if (!picture || picture.serial === pictureSeen.current || !editor || editor.isDestroyed) return
    pictureSeen.current = picture.serial
    // Replace picture… on a missing picture: the new one in its place, as one step (⌘Z brings the old path back).
    const replacing = replaceAt.current
    replaceAt.current = null
    const old = replacing === null ? null : editor.state.doc.nodeAt(replacing)
    if (replacing !== null && old?.type.name === 'image') {
      // A / menu picture still on its way keeps its place (review of #771). Experience 49: its size and words stay, a
      // crop made for the old picture's shape goes.
      apply(replacePictureKeepingCaret(editor.state, replacing, { src: picture.url, title: picture.path }))
      return
    }
    const at = Math.min(pictureAt.current ?? editor.state.doc.content.size, editor.state.doc.content.size)
    pictureAt.current = null
    apply(insertSlideBlock(editor.state.tr, at, pictureNode(editor.schema, picture.path, picture.url)))
  })

  // Sprint 161 (frame 27): Ritemark's own right-click menu on the slide. What a comment from it is on is read when the
  // menu opens: the words under the click when they are selected, the block clicked, or the whole slide.
  const [frame, setFrame] = useState<HTMLDivElement | null>(null)
  const setFrameRef = useCallback((element: HTMLDivElement | null) => {
    frameRef.current = element
    setFrame(element)
  }, [])
  const menuTarget = useRef<SlideTarget>({ kind: 'slide' })
  /** The menu's Comment, waiting for the menu to close. */
  const pendingComment = useRef<SlideTarget | null>(null)
  /** The menu closed on a press outside it: the focus stays where that press put it. */
  const closedOutside = useRef(false)
  /** Where the menu was opened, and its Slide settings… waiting for the menu to close. */
  const menuPoint = useRef({ x: 0, y: 0 })
  const pendingSettings = useRef(false)
  const startPendingComment = () => {
    const target = pendingComment.current
    pendingComment.current = null
    if (target && editor && !editor.isDestroyed) startSlideComment(editor, target)
  }
  const [hasSelection, setHasSelection] = useState(false)
  /** Experience 48: the table cell (or the whole table) the right-click was on; its items lead the menu. */
  const [tableTarget, setTableTarget] = useState<TableMenuTarget | null>(null)
  const altHeld = useAltHeld()
  // The webview's own Cut, Copy and Paste, as ⌘X, ⌘C and ⌘V do them; a paste the webview refuses comes from the host's
  // clipboard as text (the one helper a table's menu uses too).
  const runEdit = (command: 'cut' | 'copy' | 'paste') => {
    if (editor) runClipboardEdit(editor, command)
  }

  // ---- Experience 49: the picture's place (In text · Left · Right · Behind), and the side picture's own tools

  /**
   * Write the slide's words (null: as they are) and header keys together, as one undo step in the deck, converting the
   * deck first when it holds v1 slides. The stage takes the new words in as a change from elsewhere.
   */
  const writeSlide = (markdown: string | null, change: SideHeader) => {
    const deck = outerRef.current
    if (deck.isDestroyed) return
    const entry = freshEntry(deck, slideRef.current)
    if (!entry) return
    const tr = deck.state.tr
    closeHistory(tr)
    convertDeckInto(tr)
    const pos = tr.mapping.map(entry.pos)
    const node = tr.doc.nodeAt(pos)
    if (!node || node.type.name !== 'deckSlide' || !isBlockSlide(node.attrs.kind)) return
    let body = String(node.attrs.body ?? '')
    if (markdown !== null) body = withBlockMarkdown(body, markdown)
    body = writeSlideData(node.attrs.kind, body, { ...slideDataOf(node.attrs.kind, body), ...change })
    if (body === node.attrs.body && !tr.docChanged) return
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, body })
    deck.view.dispatch(tr)
    onWritingRef.current()
  }
  const [sideChosen, setSideChosen] = useState(false)
  /** Place on a picture in the words: Left, Right or Behind moves it to the slide's place (In text is where it is). */
  const placeFlowPicture = (pos: number, place: 'text' | 'left' | 'right' | 'behind') => {
    if (!editor || editor.isDestroyed || place === 'text') return
    const current = sidePictureOf(header) && header.image?.trim() ? { image: header.image.trim(), alt: header.alt, url: assets[header.image.trim()] } : {}
    const moved = flowToSide(editor.state, pos, place, current)
    if (!moved) return
    writeSlide(markdownOfDoc(moved.doc), moved.header)
  }
  /** Place on the side picture: another side, or In text (its line after the slide's words, and the place goes). */
  const placeSidePicture = (place: 'text' | 'left' | 'right' | 'behind') => {
    if (place !== 'text') {
      writeSlide(null, { picture: place })
      return
    }
    const moved = sideToText(editor && !editor.isDestroyed ? markdownOfDoc(editor.state.doc) : stageMarkdownOf(slide.kind, slide.data), header)
    setSideChosen(false)
    writeSlide(moved.markdown, moved.header)
  }
  /** The side picture chosen: the words' own picture is left, so one picture is chosen at a time. */
  const chooseSide = () => {
    if (editor && !editor.isDestroyed) {
      const tr = leavePicture(editor.state)
      if (tr) editor.view.dispatch(tr)
      // The words give up the keys, so Backspace removes the picture, never a letter (review of #774).
      editor.commands.blur()
    }
    // And so does any other place that was typed in (the handout beside the slide, a comment), Sprint 167 PR 4 review.
    const typing = document.activeElement as HTMLElement | null
    if (typing && (typing.isContentEditable || typing.matches?.('input, textarea'))) typing.blur()
    setSideChosen(true)
  }

  // Pictures with ChatGPT (experience 46 and 49): Make a new picture… and Change this picture…, for a picture in the
  // words or the slide's own beside or behind. The host saves the made picture; this editor puts it in the place the
  // request was for, followed through edits (never through the shared paste and / menu channels), as one undo step on
  // the deck: ⌘Z brings the old picture back.
  const pictureRect = useCallback((place: PicturePlaceRef): DOMRect | null => {
    if (place.kind === 'side') return frameRef.current?.querySelector('.photo')?.getBoundingClientRect() ?? null
    if (!editor || editor.isDestroyed) return null
    const dom = editor.view.nodeDOM(place.pos) as HTMLElement | null
    return dom?.isConnected ? dom.getBoundingClientRect() : null
  }, [editor])
  // Jarmo's test of #800: a slide left while ChatGPT makes its picture. The request goes on; the picture lands on this
  // slide in the deck (`putSlidePicture`, the stage's own load and save of the words), and the strip is back with the
  // slide. The place is the slide's id and, in the words, which picture with that path it is.
  const slideKey = slidePictureKey({ id: slide.data.id, index: slide.index })
  const pictureAway: PictureAwayOptions = {
    key: slideKey,
    leave: place => {
      // The picture standing in the place as the slide is left: the one ChatGPT's picture replaces.
      if (place.kind === 'side') return { kind: 'side', path: place.path ?? header.image?.trim() ?? '' }
      if (!editor) return null
      const at = pictureNthAt(editor.state.doc, place.pos)
      return at ? { kind: 'flow', pos: place.pos, path: at.id, nth: at.nth } : null
    },
    land: (place, made, describe) => {
      const deck = outerRef.current
      const schema = editor?.schema
      if (deck.isDestroyed || !schema) return null
      const { id } = slideRef.current.data
      const ref = { ...(id ? { id } : {}), index: slideRef.current.index }
      const assets = { ...assetsRef.current }
      const kit: SlideDocKit = {
        load: markdown => loadSlideDoc(schema, markdown, assets),
        save: doc => saveSlideMarkdown(doc, getHTMLFromFragment(doc.content, schema), markdown => loadSlideDoc(schema, markdown, assets)),
      }
      const target: SlidePictureTarget = place.kind === 'side'
        ? { slide: ref, side: true, path: place.path ?? '' }
        : { slide: ref, side: false, path: place.path ?? '', nth: place.nth ?? 0 }
      const put = putSlidePicture(deck.state, target, { picture: { path: made.path, url: made.url, describe } }, kit)
      if (!put) return null
      deck.view.dispatch(put.tr)
      // Its own undo step: what is typed next, on any slide, is never undone with it.
      deck.view.dispatch(closeHistory(deck.state.tr))
      const landed = deck.state.doc
      const madeTarget: SlidePictureTarget = place.kind === 'side' ? { slide: ref, side: true, path: made.path } : { slide: ref, side: false, path: made.path, nth: put.nth }
      return {
        place: place.kind === 'side' ? { kind: 'side', path: made.path } : { kind: 'flow', pos: 0, path: made.path, nth: put.nth },
        undo: () => {
          if (deck.isDestroyed) return
          // Nothing since: the deck's own undo, as ⌘Z. Edits since: only this picture goes back (an undo would take those).
          if (deck.state.doc === landed) { deck.commands.undo(); return }
          const back = putSlidePicture(deck.state, madeTarget, { restore: put.before }, kit)
          if (!back) return
          deck.view.dispatch(back.tr)
          deck.view.dispatch(closeHistory(deck.state.tr))
        },
      }
    },
    find: place => {
      if (place.kind === 'side') return place
      if (!editor || editor.isDestroyed || !place.path) return null
      const pos = picturePosOf(editor.state.doc, place.path, place.nth ?? 0)
      return pos === null ? null : { kind: 'flow', pos, path: place.path }
    },
  }
  const pictureMaker = usePictureMaker({
    editor,
    rectOf: pictureRect,
    // The slide's id marks the request as a deck's (its pictures are written `images/…`).
    beforeMake: ask => {
      const slideId = slideRef.current.data.id || 'slide'
      if (ask.place.kind === 'side') return { slideId }
      if (!editor || editor.isDestroyed || editor.state.doc.nodeAt(ask.place.pos)?.type.name !== 'image') return null
      return { slideId }
    },
    placeMade: (place, made, describe) => {
      if (place.kind === 'side') {
        // The side keeps its place; its focus point starts fresh, and its description is the words asked unless the
        // person wrote their own (#800).
        // A side picture replaced by hand meanwhile is not ChatGPT's to replace: the made one stays in images/.
        if (place.path !== undefined && !sameSidePath(header.image, place.path)) return false
        const alt = describe(header.alt ?? '', header.image?.trim() || null)
        writeSlide(null, { image: made.path, alt: alt || undefined, focus: undefined })
        return true
      }
      if (!editor || editor.isDestroyed) return false
      const old = editor.state.doc.nodeAt(place.pos)
      // The picture replaced by hand meanwhile is not ChatGPT's to replace: the made one stays in images/.
      if (place.path && !(old && samePicture(old.attrs, place.path))) return false
      const alt = describe(String(old?.attrs.alt ?? ''), old ? imagePathOf(old.attrs) : null)
      return apply(replacePictureKeepingCaret(editor.state, place.pos, { src: made.url, title: made.path }, alt))
    },
    undo: () => { if (!outerRef.current.isDestroyed) outerRef.current.commands.undo() },
    away: pictureAway,
  })
  /** The slide's title and words, for ChatGPT: the title starts the field and names the file; the words are context. */
  const slideWords = (): { title: string; words: string } => {
    if (!editor || editor.isDestroyed) return { title: '', words: '' }
    const range = titleRange(editor.state.doc)
    const title = range ? editor.state.doc.textBetween(range.from, range.to, ' ').trim() : ''
    return { title, words: editor.getText({ blockSeparator: '\n' }).trim().slice(0, 4000) }
  }
  const startPictureMaker = (place: PicturePlaceRef, mode: 'new' | 'change', source: string | null) => {
    const { title, words } = slideWords()
    pictureMaker.start({
      // The picture standing in the place ('' an empty side): the made one replaces only that one.
      place: place.kind === 'side' ? { kind: 'side', path: source ?? '' } : source ? { ...place, path: source } : place,
      mode,
      suggestion: mode === 'new' ? title : '',
      ...(words ? { words } : {}),
      ...(title ? { name: title } : {}),
      ...(mode === 'change' && source ? { source } : {}),
    })
  }
  const makerOnSide = pictureMaker.state.phase !== 'idle' && pictureMaker.state.ask.place.kind === 'side'
  const makerInWords = pictureMaker.state.phase !== 'idle' && pictureMaker.state.ask.place.kind === 'flow'

  const side = sidePictureOf(header)
  const sideUrl = side && header.image ? assets[header.image.trim()] : undefined
  const sideMissing = !!side && !sideUrl && !!header.image && missing.has(header.image.trim())
  // Sprint 162 PR 4: a top-right logo's room for the title, as every other view draws it (`logoCanvasMarks`).
  const slideLogo = themeSlideLogo(theme, borderless)
  const cover = isCoverSlide(shownMarkdown)
  const logoMarks = logoCanvasMarks(slideLogo, cover, contentPlaceOf(shownMarkdown, header.valign, side))
  // 18 November: a picture alone on the slide (or under its title only) is centred, as every other view draws it.
  // Sprint 167 PR 3: the content Top, Middle or Bottom (`valign:`), as every other view draws it (`placeClass`, above).
  const classes = ['deck-sl', 'is-blocks', 'is-editing', side ? `pic-${side}` : '', cover ? 'is-cover' : '', lonePictureClass(shownMarkdown, side), placeClass, logoMarks.cls].filter(Boolean).join(' ')

  // ---- Sprint 167 PR 4 (decks README item D): the picture Behind, from the slide's corner and from anywhere on it.
  const behindFilled = side === 'behind' && !!header.image?.trim()
  /** A left press on the words' box itself (between or after its blocks, no word under it) of a slide with a picture Behind. */
  // A plain single press only: Shift (extending the words' selection), ⌘, Ctrl (the Mac's right-click) and Alt, and a
  // double press, stay the words' (review).
  const pressOnEmptyWords = (event: { button: number; detail: number; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean; target: EventTarget | null }) =>
    event.button === 0 && event.detail <= 1 && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey
    && behindFilled && !!editor && !editor.isDestroyed && event.target === editor.view.dom
  // The chip's corner: top right, or bottom right beside a top-right logo on this slide (Sprint 167 PR 1's corners);
  // its place and size: in the band between the slide's edge and its words' box, measured (`behindChipPlace.ts`).
  const chipCorner = behindChipCorner(slideLogo, cover)
  const chipLogoWidth = drawsLogo(slideLogo, cover) ? slideLogo.width : null
  // Measured wherever the words may have moved: each fit (typing, fonts, a picture loading, an Agenda drawn again, the
  // settle after the slide arrives) and each render, as Replace picture… is; set only when the place changes.
  placeChipRef.current = () => {
    if (side !== 'behind') return
    const frameElement = frameRef.current
    const flow = frameElement?.querySelector<HTMLElement>('.blk-flow')
    if (!frameElement || !flow) return
    const box = frameElement.getBoundingClientRect()
    const words = flow.getBoundingClientRect()
    const relative = (rect: DOMRect) => ({ left: rect.left - box.left, top: rect.top - box.top, right: rect.right - box.left, bottom: rect.bottom - box.top })
    // Each block of words, and the logo: the chip at its full size goes where none of them is.
    const blocks = [...Array.from(flow.children), ...Array.from(frameElement.querySelectorAll('.slide-logo'))]
      .map(element => element.getBoundingClientRect())
      .filter(rect => rect.width > 0 && rect.height > 0)
      .map(relative)
    const next = behindChipPlace(
      { width: box.width, height: box.height },
      { top: words.top - box.top, bottom: words.bottom - box.top },
      chipCorner,
      chipLogoWidth === null ? null : { width: chipLogoWidth },
      { blocks, width: behindFilled ? CHIP_WIDTH_FILLED : CHIP_WIDTH_EMPTY },
    )
    setChipPlace(current => (current && current.corner === next.corner && current.edge === next.edge && current.right === next.right && current.scale === next.scale ? current : next))
  }
  // The fit measures it as the words move (`refit`); here, when the slide's look, its picture or the logo change.
  useLayoutEffect(() => { placeChipRef.current() }, [side, lookKey, behindFilled, chipCorner, chipLogoWidth, editor])
  // A picture pasted while the slide's own picture is chosen (the words gave up the keys, so the paste reaches the
  // page): it replaces that picture, as a paste on a chosen picture in the words does (experience 49).
  useEffect(() => {
    if (!sideChosen) return
    const paste = (event: ClipboardEvent) => {
      const target = event.target as Element | null
      if (event.defaultPrevented || target?.closest?.('input, textarea, [contenteditable="true"], [data-radix-popper-content-wrapper]')) return
      if (takeImageFile(event.clipboardData, true, (dataUrl, filename) => onPictureRef.current(dataUrl, filename))) event.preventDefault()
    }
    document.addEventListener('paste', paste)
    return () => document.removeEventListener('paste', paste)
  }, [sideChosen])
  return (
    <>
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setFrameRef}
          className={`deck-slide${borderless ? ' is-borderless' : ''}${side === 'behind' && sideChosen ? ' is-behind-chosen' : ''}`}
          data-step={fitStepRef.current}
          style={{ width, height: Math.round(width * BLOCK_CANVAS_HEIGHT / BLOCK_CANVAS_WIDTH), ...(themeStyle(theme, borderless) as CSSProperties) }}
          // A right press keeps the selection as it is (the Mac would select the word under it), so "with a selection,
          // it's on the words" means the words the person chose.
          onMouseDown={event => { if (event.button === 2) event.preventDefault() }}
          // Sprint 167 PR 4: with a picture Behind, a press where there are no words (the words' box itself, between and
          // after its blocks) chooses the picture, its ring round the slide and its bar under it; a press on words puts
          // the caret there, as ever. The press goes on to the page (an open popover still closes on it), but its
          // mousedown is cancelled on the way down: the browser puts no caret and moves no focus, and ProseMirror leaves
          // a cancelled event alone, so the keys stay the picture's (Backspace removes it, never a letter; review).
          onPointerDownCapture={event => {
            if (!pressOnEmptyWords(event)) return
            // Cancelled, never stopped: the block's bar opens nothing for it, and an open popover still closes.
            event.preventDefault()
            chooseSide()
          }}
          onMouseDownCapture={event => {
            if (pressOnEmptyWords(event)) event.preventDefault()
          }}
          // A picture dropped anywhere on the slide, its edges too (outside the words' box): into the slide's place
          // (Behind, Left or Right), or a Picture block when it has none. A drop on the words is theirs (`handleDrop`).
          // Only a picture is taken: another file dropped on the slide's edges is left alone, as before (review).
          onDragOver={event => { if (Array.from(event.dataTransfer.items).some(item => item.kind === 'file' && item.type.startsWith('image/'))) event.preventDefault() }}
          onDrop={event => {
            if (event.defaultPrevented) return
            if (takePicture(event.dataTransfer, false, event.target)) event.preventDefault()
          }}
          onContextMenu={event => {
            if (!editor || editor.isDestroyed) return
            closedOutside.current = false
            pendingComment.current = null
            pendingSettings.current = false
            menuPoint.current = { x: event.clientX, y: event.clientY }
            menuTarget.current = clickTarget(editor, event)
            setHasSelection(!editor.state.selection.empty)
            setTableTarget(SlideTableHandles ? tableMenuTargetAt(editor.view, event.target) : null)
          }}
        >
          {/* Sprint 167 PR 4: the picture Behind's corner chip. First in the frame, so React always inserts it before
              the slide's canvas: the bubble menu at the frame's end is moved to the page's body (appendToBody), and a
              node inserted before it (the chip came after the canvas) made React's insertBefore throw and the deck
              view went blank when Behind was chosen in Slide settings. Its z-index lifts it over the canvas. */}
          {side === 'behind' && chipPlace && !makerOnSide ? (
            <BehindChip
              place={chipPlace}
              filled={behindFilled}
              keep={sideChosen}
              onChoose={() => (behindFilled ? chooseSide() : choosePicture(false))}
              onChatgpt={() => startPictureMaker({ kind: 'side' }, 'new', null)}
            />
          ) : null}
          <div className={classes} style={{ transform: `scale(${width / BLOCK_CANVAS_WIDTH})`, ...logoMarks.style } as CSSProperties}>
            {side ? (
              // Experience 49: the slide's picture beside or behind the words, with its own tools when chosen.
              <SidePicture
                side={side}
                url={sideUrl}
                path={header.image?.trim() ?? ''}
                missing={sideMissing}
                alt={header.alt ?? ''}
                focus={header.focus}
                chosen={sideChosen}
                comments={!!commentCallouts}
                onChoose={chooseSide}
                onLeave={() => setSideChosen(false)}
                onPlace={placeSidePicture}
                onWords={alt => writeSlide(null, { alt: alt || undefined })}
                onComment={() => {
                  setSideChosen(false)
                  if (editor && !editor.isDestroyed) startSlideComment(editor, { kind: 'slide' })
                }}
                onReplace={() => choosePicture(false)}
                onChatgpt={mode => startPictureMaker({ kind: 'side' }, mode, header.image?.trim() || null)}
                chatgptCanChange={isRelativeImagePath(header.image?.trim() ?? '')}
                barHidden={makerOnSide}
                onReveal={() => { if (header.image?.trim()) sendToExtension('revealImage', { relativePath: header.image.trim() }) }}
                onRemove={() => writeSlide(null, EMPTY_SIDE)}
                onFocus={focus => writeSlide(null, { focus })}
              />
            ) : null}
            <EditorContent editor={editor} />
            {/* Sprint 162 PR 4: the theme's logo in its corner, over the words, as every other view draws it. */}
            <SlideLogoImage logo={slideLogo} cover={cover} />
          </div>
          {missingSpots.map(spot => (
            <Tooltip key={`${spot.side}:${spot.path}:${spot.nth}`} label={`Choose a picture for ${spot.path}`}>
              <Button
                variant="outline"
                size="sm"
                className="deck-replace-picture absolute -translate-x-1/2"
                style={{ left: spot.left, top: spot.top }}
                // The slide's words keep the caret: the press never moves it into the missing place.
                onMouseDown={event => event.preventDefault()}
                onClick={() => replacePicture(spot)}
              >
                Replace picture…
              </Button>
            </Tooltip>
          ))}
          {/* 17 November: the chosen block's bar, ring and handles (`SlideBlockBar`). */}
          <SlideBlockBar editor={editor} frame={frame} theme={theme} apply={apply} pickIcon={divHandlers.pickIcon} />
          {/* Sprint 163 PR 3: the chosen button's bar (Address, Open, Delete) and its address sheet. */}
          <ButtonBlockTools editor={editor} frame={frame} takeBackNew={takeBackNewButton} />
          {/* The bubble menu in a box of its own that stays in the frame (`BubbleMenuBox`): TipTap takes its element
              out, and a node React inserted before it blanked the deck view (Sprint 167 PR 4). */}
          <BubbleMenuBox>{editor ? <FormattingBubbleMenu editor={editor} appendToBody /> : null}</BubbleMenuBox>
          {commentCallouts && editor ? (
            <SlideComments editor={editor} frame={frame} slideNumber={slide.index + 1} open={commentOpen} onOpenTaken={onCommentOpened} />
          ) : null}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent
        className="deck-slide-menu"
        // A press outside closes it and the focus stays where that press put it (the handout, a card, the strip).
        onInteractOutside={() => { closedOutside.current = true }}
        // Otherwise the focus goes back to the slide's words (the app run: after Paste the caret was lost, and ⌘Z did
        // nothing), and Comment starts here, once the menu has handed the focus back, so the card's box keeps it.
        onCloseAutoFocus={event => {
          event.preventDefault()
          if (!editor || editor.isDestroyed) return
          if (pendingComment.current) startPendingComment()
          else if (!closedOutside.current) editor.view.focus()
          if (pendingSettings.current) {
            pendingSettings.current = false
            onSlideSettings?.(menuPoint.current)
          }
        }}
      >
        {tableTarget ? (
          <>
            <TableMenuItems editor={editor!} target={tableTarget} kit={contextKit} sortDescending={altHeld} />
            <ContextMenuSeparator />
          </>
        ) : null}
        <ContextMenuItem disabled={!hasSelection} onSelect={() => runEdit('cut')}>
          Cut
          <ContextMenuShortcut>{KEYS.cut}</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem disabled={!hasSelection} onSelect={() => runEdit('copy')}>
          Copy
          <ContextMenuShortcut>{KEYS.copy}</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => runEdit('paste')}>
          Paste
          <ContextMenuShortcut>{KEYS.paste}</ContextMenuShortcut>
        </ContextMenuItem>
        {commentCallouts ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              className="gap-2"
              onSelect={() => {
                // Started once the menu has closed and handed the focus back (`onCloseAutoFocus`), one path only, so the
                // card's box keeps the caret (the app run: the box opened without it).
                pendingComment.current = menuTarget.current
              }}
            >
              <Icon name="chat-text" size={14} tone="inherit" />
              Comment
              <ContextMenuShortcut>{KEYS.comment}</ContextMenuShortcut>
            </ContextMenuItem>
          </>
        ) : null}
        {onSlideSettings ? (
          // The slide's settings at the end of its own menu, under a line (17 November, "Nothing around the slide").
          <>
            <ContextMenuSeparator />
            <ContextMenuItem className="gap-2" onSelect={() => { pendingSettings.current = true }}>
              <Icon name="gear" size={14} tone="inherit" />
              Slide settings…
            </ContextMenuItem>
          </>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
    {/* Experience 48: the table's grips, + bars and menus, drawn in the table's own element. */}
    {SlideTableHandles ? <TableHandlesLayer editor={editor} /> : null}
    {/* Experience 49: a chosen picture's ring, handles, crop frame and bar, drawn in the slide's canvas. */}
    <PictureTools
      editor={editor}
      context="slide"
      comments={!!commentCallouts}
      onComment={pos => {
        if (!editor || editor.isDestroyed) return
        const top = topBlockAt(editor.state.doc, pos)
        startSlideComment(editor, top === null ? { kind: 'slide' } : { kind: 'block', pos: top })
      }}
      onReplace={pos => {
        pendingReplace.current = pos
        choosePicture(true, true)
      }}
      onPlace={placeFlowPicture}
      onChatgpt={(pos, mode) => {
        const node = editor?.state.doc.nodeAt(pos)
        startPictureMaker({ kind: 'flow', pos }, mode, node ? imagePathOf(node.attrs) : null)
      }}
      chatgptCanChange={pos => isRelativeImagePath((editor && imagePathOf(editor.state.doc.nodeAt(pos)?.attrs ?? {})) ?? '')}
      barHidden={makerInWords}
    />
    {/* Pictures with ChatGPT: the field, the pulse and the strip on the picture's place. */}
    <PictureMakerView
      maker={pictureMaker}
      rectOf={pictureRect}
      insideOf={place => place.kind === 'side'}
      boundsOf={() => (frameRef.current ? stageBounds(frameRef.current) : undefined)}
    />
    {/* PR 3: a box's icon from the grid, and the / menu's Web page. */}
    <SlideIconPicker
      pick={iconPick}
      onPick={(pos, name) => {
        setIconPick(null)
        if (!editor || editor.isDestroyed) return
        apply(setBlockValue(editor.state, pos, 'icon', name))
        editor.view.focus()
      }}
      onClose={() => setIconPick(null)}
    />
    <UnknownIconHint
      frame={frame}
      hint={iconHint}
      onChoose={(hint, rect) => {
        setIconHint(null)
        // The menu as it is (its search, with the name in it, is Sprint 169's); No icon takes the name out of the file.
        setIconPick({ pos: hint.pos, rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, current: hint.name })
      }}
      onDone={endIconHint}
    />
    <WebPageDialog
      open={webPageAt !== null}
      onClose={() => {
        setWebPageAt(null)
        editor?.view.focus()
      }}
      onAdd={address => {
        const at = webPageAt
        setWebPageAt(null)
        if (!editor || editor.isDestroyed || at === null) return
        apply(insertSlideBlock(editor.state.tr, Math.min(at, editor.state.doc.content.size), webPageNode(editor.schema, address)))
        editor.view.focus()
      }}
    />
    </>
  )
}

/** The slide's right-click menu draws the table's items with its own primitives. */
const contextKit: MenuKit = {
  Item: ContextMenuItem as unknown as MenuKit['Item'],
  Separator: ContextMenuSeparator as unknown as MenuKit['Separator'],
}

/** The slide editor's own load of a Markdown, as its first content was parsed, with the pictures' addresses it has. */
function loadSlideDoc(schema: Schema, markdown: string, assets: Record<string, string>): PMNode {
  return createNodeFromContent(slideHTML(markdown, assets), schema, { slice: false }) as PMNode
}
