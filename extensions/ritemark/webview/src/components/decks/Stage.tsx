/**
 * Sprint 157: the stage, the current slide large in the middle (README frames 2 and 4).
 *
 *  - Sprint 161 (PR 2): a block slide, and a v1 slide of the nine kinds (drawn as blocks, decision 8), is written on
 *    like text in the slide editor (`blocks/SlideEditor.tsx`); its first edit converts the deck. A slide of a kind this
 *    build doesn't know keeps its layout's words, typed in place: a click puts the caret there, and Enter goes on.
 *  - Nothing sits around the slide (17 November, "Nothing around the slide but the slide"): Slide settings is in the
 *    slide's own menu (the strip's, the part number's and the end of the slide's right-click menu), and where a copy
 *    came from is at the top of its popover (`SlideAbout`). The fold for notes that
 *    sat under it is gone (Jarmo, 17 November): anything private is a comment in the handout.
 *
 * Every change is one transaction on the slide's node in the handout's editor, so it saves, merges and undoes as the
 * rest of the deck does; Cmd+Z on the stage runs the editor's undo.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { Editor as TipTapEditor } from '@tiptap/react'
import { writeSlideData, type SlideData } from '../../../../src/decks/deckFormat'
import { drawsAsBlocks } from '../../../../src/decks/blocks/convertDeck'
import type { DeckTheme } from '../../../../src/decks/deckTheme'
import { slidesOf, type DeckSlideEntry } from './deckDocument'
import { takeImageFile } from '../../lib/pastedImage'
import { SlideCanvas, type SlideEditing } from './slide/SlideCanvas'
import { SlideEditor } from './blocks/SlideEditor'
import { itemMarksOf, layoutSlide, textBoxes, withoutListMarker } from './slide/layoutSlide'
import { undoKeyOf, cellPath, insertItemAfter, isEmptyItem, itemPath, nextCell, removeItem, setIcon, setPath, valueAt } from './slide/slideEdits'

interface StageProps {
  editor: TipTapEditor
  slide: DeckSlideEntry
  theme: DeckTheme
  borderless: boolean
  assets: Record<string, string>
  /** 17 November: pictures the host found no file for (drawn as missing, with Replace picture…). */
  missing?: ReadonlySet<string>
  /** The slide's width on the stage. */
  width: number
  /** The person is writing on this slide: the handout keeps it the current one. */
  onWriting: () => void
  /** Comments load and save on the slide as in the handout (the comment-callouts flag). */
  commentCallouts?: boolean
  /** Words to put the caret in once the slide is drawn (a new slide's title); asked again when it changes. */
  initialFocus?: string
  /** Sprint 159 (PR 7): select those words whole, to be typed over (a deck New just made), rather than put the caret after them. */
  selectOnFocus?: boolean
  /** The words asked for took the caret (or the selection). */
  onFocusTaken?: () => void
  /** A picture pasted or dropped on the slide, read as a data URL (`atCaret`: the / menu's Picture, PR 3). */
  onPicture: (dataUrl: string, filename: string, atCaret?: boolean) => void
  /**
   * Pictures with ChatGPT: a picture is on its way for the slide on the stage, placed as a saved one when it comes
   * (`atCaret`: in the words, where the slide editor waits for it; else the slide's own beside or behind). Its slide id.
   */
  onPictureComing?: (atCaret: boolean) => string | null
  /** Sprint 161: open one of the slide's saved comments (the deck's bar), by its place; a new serial asks again. */
  commentOpen?: { ordinal: number; serial: number } | null
  /** The comment asked for was opened: the asker forgets the request. */
  onCommentOpened?: (serial: number) => void
  /** Sprint 161 (PR 3): the slide editor's Slides items, its "full" state, and the bar's and Settings' requests. */
  onNewSlideBelow?: () => void
  onSplit?: (before: string, after: string) => void
  onFull?: (full: boolean) => void
  onNeedCaret?: () => void
  /** The slide's right-click menu's Slide settings… (17 November): the popover at that point. */
  onSlideSettings?: (at: { x: number; y: number }) => void
  splitRequest?: number
  picture?: { path: string; url: string; serial: number } | null
}

export function Stage(props: StageProps) {
  // A block slide, and a v1 slide drawn as blocks: written like text (Sprint 161, PR 2).
  if (drawsAsBlocks(props.slide.kind)) return <BlockStage {...props} />
  return <LayoutStage {...props} />
}

function BlockStage({ editor, slide, theme, borderless, assets, missing, width, onWriting, commentCallouts, initialFocus, selectOnFocus, onFocusTaken, onPicture, onPictureComing, commentOpen, onCommentOpened, onNewSlideBelow, onSplit, onFull, onNeedCaret, onSlideSettings, splitRequest, picture }: StageProps) {
  // A request that comes after the stage is drawn (a deck New made, already shown) is taken once it changes.
  const focusTitle = useMemo(() => (initialFocus ? { select: !!selectOnFocus } : null), [initialFocus, selectOnFocus])
  return (
    <div className="deck-big" style={{ width }}>
      <SlideEditor
        outer={editor}
        slide={slide}
        width={width}
        theme={theme}
        borderless={borderless}
        assets={assets}
        missing={missing}
        commentCallouts={commentCallouts}
        onWriting={onWriting}
        focusTitle={focusTitle}
        onFocusTaken={onFocusTaken}
        onPicture={onPicture}
        onPictureComing={onPictureComing}
        commentOpen={commentOpen}
        onCommentOpened={onCommentOpened}
        onNewSlideBelow={onNewSlideBelow}
        onSplit={onSplit}
        onFull={onFull}
        onNeedCaret={onNeedCaret}
        onSlideSettings={onSlideSettings}
        splitRequest={splitRequest}
        picture={picture}
      />
    </div>
  )
}

/** A slide of a kind this build doesn't know: its layout's words, typed in place (Sprint 157). */
function LayoutStage({ editor, slide, theme, borderless, assets, width, onWriting, initialFocus, selectOnFocus, onFocusTaken, onPicture, onSlideSettings }: StageProps) {
  const [focusPath, setFocusPath] = useState<string | null>(initialFocus ?? null)
  const [focusSelect, setFocusSelect] = useState(!!selectOnFocus)
  // A request that comes after the stage is drawn (the deck's first slide, already shown when New's deck opens); the
  // one it was drawn with is already in the state above, so the first run leaves it, and the caret is placed once
  const asked = useRef({ initialFocus, selectOnFocus })
  useEffect(() => {
    if (asked.current.initialFocus === initialFocus && asked.current.selectOnFocus === selectOnFocus) return
    asked.current = { initialFocus, selectOnFocus }
    if (!initialFocus) return
    setFocusPath(initialFocus)
    setFocusSelect(!!selectOnFocus)
  }, [initialFocus, selectOnFocus])
  const onFocusTakenRef = useRef(onFocusTaken)
  onFocusTakenRef.current = onFocusTaken

  /** Change this slide's data in one transaction, from the editor's document as it is now. */
  const write = useCallback((mutate: (data: SlideData) => SlideData, focus?: string) => {
    const fresh = slidesOf(editor.state.doc)[slide.index]
    if (!fresh) return
    const body = writeSlideData(fresh.kind, fresh.node.attrs.body, mutate(fresh.data))
    if (body !== fresh.node.attrs.body) {
      editor.view.dispatch(editor.state.tr.setNodeMarkup(fresh.pos, undefined, { ...fresh.node.attrs, body }))
    }
    if (focus !== undefined) setFocusPath(focus)
  }, [editor, slide.index])

  const undoKey = (event: ReactKeyboardEvent<HTMLElement>): boolean => {
    const step = undoKeyOf({ key: event.key, metaKey: event.metaKey, ctrlKey: event.ctrlKey, shiftKey: event.shiftKey, altKey: event.altKey, isComposing: event.nativeEvent.isComposing })
    if (step === 'redo') editor.commands.redo()
    else if (step === 'undo') editor.commands.undo()
    return step !== null
  }

  const onKey = (path: string, event: ReactKeyboardEvent<HTMLElement>): boolean => {
    if (undoKey(event)) {
      // The box keeps the caret, so it shows what the undo put back itself.
      const element = event.currentTarget
      const fresh = slidesOf(editor.state.doc)[slide.index]
      // As the layout draws it: an item it numbers itself shows its words without their marker.
      const words = fresh ? valueAt(fresh.data, path) : ''
      const heading = fresh && itemPath(path)?.field === 'heading' ? itemPath(path) : null
      element.textContent = heading && fresh ? withoutListMarker(words, heading.index + 1, itemMarksOf(fresh.kind, fresh.data.look || 'boxes')) : words
      const range = document.createRange()
      range.selectNodeContents(element)
      range.collapse(false)
      window.getSelection()?.removeAllRanges()
      window.getSelection()?.addRange(range)
      return true
    }
    const data = slide.data
    const cell = cellPath(path)
    if (cell && (event.key === 'Tab' || (event.key === 'Enter' && !event.shiftKey))) {
      const key = event.key === 'Enter' ? 'enter' : event.shiftKey ? 'shift-tab' : 'tab'
      const move = nextCell(data, path, key)
      if (!move) return event.key === 'Tab'
      // The rows come from the document as it is now, so the words just typed are kept.
      if (move.data !== data) write(current => nextCell(current, path, key)?.data ?? current, move.path)
      else setFocusPath(move.path)
      return true
    }
    const item = itemPath(path)
    if (item && event.key === 'Enter' && !event.shiftKey) {
      if (slide.kind === 'columns') {
        // A column's heading goes on to its lines; its lines take Enter as a new line.
        if (item.field === 'text') return false
        setFocusPath(`items.${item.index}.text`)
        return true
      }
      write(current => insertItemAfter(current, item.index), `items.${item.index + 1}.heading`)
      return true
    }
    if (item && event.key === 'Backspace' && !(event.currentTarget.textContent ?? '') && isEmptyItem(data, item.index) && (data.items?.length ?? 0) > 1) {
      write(current => removeItem(current, item.index), item.index > 0 ? `items.${item.index - 1}.heading` : 'title')
      return true
    }
    if (event.key === 'Enter' && (!event.shiftKey || path === 'tag') && !item && !cell) {
      // From the title or a line under it, on to the next words on the slide (the pill stays on one line).
      const order = textBoxes(layoutSlide(slide.kind, data, { editing: true })).map(box => box.path)
      const next = order[order.indexOf(path) + 1]
      if (next) setFocusPath(next)
      else (event.currentTarget as HTMLElement).blur()
      return true
    }
    return false
  }

  // One editing object per slide, words and caret target, so the stage's canvas redraws only when they change.
  const onKeyRef = useRef(onKey)
  onKeyRef.current = onKey
  const editing: SlideEditing = useMemo(() => ({
    onText: (path, value) => {
      onWriting()
      write(current => setPath(current, path, value))
    },
    onKey: (path, event) => onKeyRef.current(path, event),
    onSetIcon: (index, name) => write(current => setIcon(current, index, name)),
    focusPath,
    focusSelect,
    onFocused: () => {
      setFocusPath(null)
      setFocusSelect(false)
      onFocusTakenRef.current?.()
    },
  }), [onWriting, write, focusPath, focusSelect])

  /** A picture from the computer onto the slide: pasted (unless words are being pasted into a box) or dropped. */
  const takePicture = (transfer: DataTransfer | null, pasted: boolean): boolean => takeImageFile(transfer, pasted, onPicture)

  return (
    <>
      <div
        className="deck-big"
        style={{ width }}
        onPaste={event => { if (takePicture(event.clipboardData, true)) event.preventDefault() }}
        onDragOver={event => { if (Array.from(event.dataTransfer.types).includes('Files')) event.preventDefault() }}
        onDrop={event => { if (takePicture(event.dataTransfer, false)) event.preventDefault() }}
        // A slide of a kind this build doesn't know has no menu of its own: a right-click opens its Slide settings, so
        // they stay reachable with the strip and the handout both out of view (the gear left the bar, 17 November).
        onContextMenu={event => {
          // Inside a box being typed in, the system's own menu (Cut, Copy, Paste) stays.
          if (!onSlideSettings || (event.target as Element | null)?.closest?.('[contenteditable="true"]')) return
          event.preventDefault()
          onSlideSettings({ x: event.clientX, y: event.clientY })
        }}
      >
        <SlideCanvas kind={slide.kind} data={slide.data} width={width} theme={theme} borderless={borderless} assets={assets} editing={editing} />
      </div>
    </>
  )
}
