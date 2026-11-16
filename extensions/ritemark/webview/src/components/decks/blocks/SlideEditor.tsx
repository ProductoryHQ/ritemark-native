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
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { EditorContent, useEditor, type Editor as TipTapEditor } from '@tiptap/react'
import { Extension, createNodeFromContent, getHTMLFromFragment } from '@tiptap/core'
import type { Schema } from '@tiptap/pm/model'
import Placeholder from '@tiptap/extension-placeholder'
import type { Node as PMNode } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import { blockTitleOf, isBlockSlide, withBlockMarkdown, type SlideData } from '../../../../../src/decks/deckFormat'
import { blockDataOf } from '../../../../../src/decks/blocks/convertDeck'
import { BLOCK_CANVAS_HEIGHT, BLOCK_CANVAS_WIDTH, isCoverSlide, sidePictureOf } from '../../../../../src/decks/blocks/slideRenderer'
import type { DeckTheme } from '../../../../../src/decks/deckTheme'
import { createEditorSchemaExtensions } from '../../../utils/editorMarkdown'
import { takeImageFile } from '../../../lib/pastedImage'
import { FormattingBubbleMenu } from '../../FormattingBubbleMenu'
import { themeStyle } from '../theme/themeVars'
import { slidesOf, type DeckSlideEntry } from '../deckDocument'
import { convertDeckInto } from '../handout/deckConvert'
import { SLIDE_SYNC, SlideSync } from './slideSync'
import { SlideDivWithView } from './slideDivView'
import { ensureSlideCommentPipeline, markdownToSlideEditorHTML, saveSlideMarkdown } from './slideEditorMarkdown'
import { contentHeightOf, fitValue, nextFitStep } from './slideFit'

export interface SlideEditorProps {
  /** The handout's editor, which holds the deck: the slide is written to its node there, and its history is the undo. */
  outer: TipTapEditor
  slide: DeckSlideEntry
  width: number
  theme: DeckTheme
  borderless: boolean
  /** The slide's pictures as webview URIs, by the paths the slide names. */
  assets: Record<string, string>
  commentCallouts?: boolean
  /** The person wrote on the slide: the handout keeps it the current one. */
  onWriting: () => void
  /** Put the caret in the slide's title once it is drawn (a new slide's), or select it whole (a deck New made). */
  focusTitle?: { select: boolean } | null
  onFocusTaken?: () => void
  /** A picture pasted or dropped on the slide, read as a data URL. */
  onPicture: (dataUrl: string, filename: string) => void
}

/** The slide's Markdown as the stage edits it: a block slide's, or a v1 slide's as blocks (converted in memory). */
export function stageMarkdownOf(kind: string, data: SlideData): string {
  return (isBlockSlide(kind) ? data.markdown : blockDataOf(kind, data).markdown) ?? ''
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

export function SlideEditor({ outer, slide, width, theme, borderless, assets, commentCallouts, onWriting, focusTitle, onFocusTaken, onPicture }: SlideEditorProps) {
  const slideRef = useRef(slide)
  slideRef.current = slide
  const assetsRef = useRef(assets)
  assetsRef.current = assets
  const onWritingRef = useRef(onWriting)
  onWritingRef.current = onWriting
  const onPictureRef = useRef(onPicture)
  onPictureRef.current = onPicture
  const syncRef = useRef<SlideSync | null>(null)
  // The editor the sync was made for: a new editor (its extensions changed) gets a new sync, on its own schema.
  const syncEditor = useRef<TipTapEditor | null>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const stepRef = useRef(0)
  const outerRef = useRef(outer)
  outerRef.current = outer

  const nodeMarkdown = stageMarkdownOf(slide.kind, slide.data)
  // The Markdown the slide shows now: for its cover look while it is being typed.
  const [shownMarkdown, setShownMarkdown] = useState(nodeMarkdown)
  if (commentCallouts) ensureSlideCommentPipeline()

  /** Write the stage's Markdown to the slide's node: one transaction, converting the deck first when it holds v1 slides. */
  const write = useCallback((markdown: string, doc: PMNode) => {
    const editorOuter = outerRef.current
    if (editorOuter.isDestroyed) return
    const entry = freshEntry(editorOuter, slideRef.current)
    if (!entry) return
    const tr = editorOuter.state.tr
    convertDeckInto(tr)
    // The conversion puts comments at the ends of parts: this slide's place moves past any put before it.
    const pos = tr.mapping.map(entry.pos)
    const node = tr.doc.nodeAt(pos)
    if (!node || node.type.name !== 'deckSlide' || !isBlockSlide(node.attrs.kind)) return
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, body: withBlockMarkdown(node.attrs.body, markdown) })
    // Known as the stage's own before anything hears of it, so its echo is never taken for a change from elsewhere.
    syncRef.current?.wrote(markdown, doc)
    editorOuter.view.dispatch(tr)
    setShownMarkdown(markdown)
    onWritingRef.current()
  }, [])

  // Undo and redo are the deck's, as on the rest of the stage: this editor keeps no history of its own.
  const OuterHistory = useMemo(() => Extension.create({
    name: 'slideOuterHistory',
    addKeyboardShortcuts() {
      const undo = () => { outerRef.current.commands.undo(); return true }
      const redo = () => { outerRef.current.commands.redo(); return true }
      return { 'Mod-z': undo, 'Mod-Shift-z': redo, 'Mod-y': redo, 'Shift-Mod-z': redo }
    },
  }), [])

  const extensions = useMemo(() => createEditorSchemaExtensions({
    beforeLink: [Placeholder.configure({ placeholder: ({ node, pos }) => (pos === 0 && node.type.name === 'heading' ? 'Title' : ''), showOnlyCurrent: false })],
    afterImage: [OuterHistory],
    commentCallouts,
    deck: [SlideDivWithView],
  }).map(extension => (extension.name === 'starterKit' ? extension.configure({ history: false }) : extension)), [OuterHistory, commentCallouts])

  const editor = useEditor({
    extensions,
    content: slideHTML(nodeMarkdown, assets),
    editorProps: {
      attributes: { class: 'blk-flow', spellcheck: 'true', 'aria-label': 'The slide' },
      handlePaste: (_view, event) => takePicture(event.clipboardData, true),
      handleDrop: (_view, event) => takePicture((event as DragEvent).dataTransfer, false),
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
      // An input method's word is written once it is composed (the composition's end), never mid-word.
      if (updated.view.composing) return
      writeNow(updated)
    },
  }, [extensions])
  // The slide's sync, made with the editor from the Markdown it was made with.
  if (editor && syncEditor.current !== editor) {
    syncEditor.current = editor
    const load = (markdown: string) => loadSlideDoc(editor.schema, markdown, assetsRef.current)
    syncRef.current = new SlideSync(load, doc => saveSlideMarkdown(doc, getHTMLFromFragment(doc.content, editor.schema), load), nodeMarkdown, editor.state.doc)
  }

  /** Write the stage's words to the node when the node lacks them. */
  function writeNow(current: TipTapEditor) {
    const sync = syncRef.current
    if (!sync || current.isDestroyed) return
    const markdown = sync.toWrite(current.state.doc)
    if (markdown === null) sync.settled(current.state.doc)
    else write(markdown, current.state.doc)
  }

  /** A picture from the computer onto the slide: pasted (unless words are being pasted) or dropped. */
  function takePicture(transfer: DataTransfer | null, pasted: boolean): boolean {
    return takeImageFile(transfer, pasted, (dataUrl, filename) => onPictureRef.current(dataUrl, filename))
  }

  // A change of the node from elsewhere (an undo, an AI's edit): its smallest replacement, once no input method composes.
  useEffect(() => {
    const sync = syncRef.current
    if (!editor || editor.isDestroyed || !sync) return
    const tr = sync.incoming(nodeMarkdown, editor.state, editor.view.composing)
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
  const refit = useCallback(() => {
    if (!editor || editor.isDestroyed) return
    const flow = editor.view.dom as HTMLElement
    const measure = (step: number) => {
      flow.style.setProperty('--fit', String(fitValue(step)))
      return { content: contentHeightOf(flow), room: flow.clientHeight }
    }
    const step = nextFitStep(stepRef.current, measure)
    flow.style.setProperty('--fit', String(fitValue(step)))
    stepRef.current = step
    frameRef.current?.setAttribute('data-step', String(step))
  }, [editor])
  // Once per change of the words (the editor's update), and when the size, the look or the cover look change.
  const lookKey = `${width}\u0000${borderless}\u0000${JSON.stringify(theme)}\u0000${isCoverSlide(shownMarkdown)}\u0000${slide.data.picture ?? ""}`
  useLayoutEffect(() => { refit() }, [refit, lookKey])
  useEffect(() => {
    if (!editor) return
    editor.on('update', refit)
    const fonts = document.fonts
    fonts?.addEventListener?.('loadingdone', refit)
    return () => {
      editor.off('update', refit)
      fonts?.removeEventListener?.('loadingdone', refit)
    }
  }, [editor, refit])

  const header = isBlockSlide(slide.kind) ? slide.data : blockDataOf(slide.kind, slide.data)
  const side = sidePictureOf(header)
  const sideUrl = side && header.image ? assets[header.image.trim()] : undefined
  const classes = ['deck-sl', 'is-blocks', 'is-editing', side ? `pic-${side}` : '', isCoverSlide(shownMarkdown) ? 'is-cover' : ''].filter(Boolean).join(' ')
  return (
    <div
      ref={frameRef}
      className={`deck-slide${borderless ? ' is-borderless' : ''}`}
      data-step={stepRef.current}
      style={{ width, height: Math.round(width * BLOCK_CANVAS_HEIGHT / BLOCK_CANVAS_WIDTH), ...(themeStyle(theme, borderless) as CSSProperties) }}
    >
      <div className={classes} style={{ transform: `scale(${width / BLOCK_CANVAS_WIDTH})` }}>
        {side ? (
          <>
            <div className={`photo${sideUrl ? '' : ' empty'}`} style={sideUrl ? { backgroundImage: `url("${sideUrl.replace(/"/g, '%22')}")` } : undefined} />
            {side === 'behind' ? <div className="veil" /> : null}
          </>
        ) : null}
        <EditorContent editor={editor} />
      </div>
      {editor ? <FormattingBubbleMenu editor={editor} appendToBody /> : null}
    </div>
  )
}

/** The slide editor's own load of a Markdown, as its first content was parsed, with the pictures' addresses it has. */
function loadSlideDoc(schema: Schema, markdown: string, assets: Record<string, string>): PMNode {
  return createNodeFromContent(slideHTML(markdown, assets), schema, { slice: false }) as PMNode
}
