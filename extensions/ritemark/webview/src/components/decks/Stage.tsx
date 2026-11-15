/**
 * Sprint 157: the stage, the current slide large in the middle (README frames 2 and 4).
 *
 *  - The words are typed on the slide: a click puts the caret there, and the thumbnail changes as you type. Enter adds
 *    a box, a point or a step; Backspace in an empty one removes it. A table's cells move on with Tab and Enter, with
 *    Add a row and Add a column under it. A box's icon is chosen from a grid.
 *  - Under the slide, quiet lines that never reach the wall: where a copy came from, and the table's two actions.
 *  - Speaker notes fold open under that. They never leave the person's screen (README decision 7).
 *
 * Every change is one transaction on the slide's node in the handout's editor, so it saves, merges and undoes as the
 * rest of the deck does; Cmd+Z on the stage runs the editor's undo.
 */
import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { Editor as TipTapEditor } from '@tiptap/react'
import { parseFrom, writeSlideBody, type SlideData } from '../../../../src/decks/deckFormat'
import type { DeckTheme } from '../../../../src/decks/deckTheme'
import { Button } from '../ui/button'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'
import { slidesOf, type DeckSlideEntry } from './deckDocument'
import { SlideCanvas, type SlideEditing } from './slide/SlideCanvas'
import { layoutSlide, textBoxes } from './slide/layoutSlide'
import { addColumn, addRow, cellPath, insertItemAfter, isEmptyItem, itemPath, nextCell, removeItem, setIcon, setPath, valueAt } from './slide/slideEdits'

interface StageProps {
  editor: TipTapEditor
  slide: DeckSlideEntry
  theme: DeckTheme
  borderless: boolean
  assets: Record<string, string>
  /** The slide's width on the stage. */
  width: number
  /** The person is writing on this slide: the handout keeps it the current one. */
  onWriting: () => void
}

/** The library's topic or the deck a copy came from, for the quiet line under the slide. */
function sourceLine(from: string | undefined): { library: boolean; name: string } | null {
  const source = parseFrom(from)
  if (!source) return null
  const name = source.path.split('/').pop()?.replace(/\.deck\.md$/i, '') ?? source.path
  return { library: /^Slide library\//.test(source.path), name }
}

/** Notes' first words beside the fold, as the prototype's "Speaker notes · Ask who has used…". */
function notesPreview(notes: string | null): string {
  const text = (notes ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  return text.length > 30 ? `${text.slice(0, 30)}…` : text
}

export function Stage({ editor, slide, theme, borderless, assets, width, onWriting }: StageProps) {
  const [focusPath, setFocusPath] = useState<string | null>(null)
  const [notesOpen, setNotesOpen] = useState(false)
  const notesRef = useRef<HTMLDivElement>(null)

  /** Change this slide's data (and its notes) in one transaction, from the editor's document as it is now. */
  const write = useCallback((mutate: (data: SlideData) => SlideData, focus?: string) => {
    const fresh = slidesOf(editor.state.doc)[slide.index]
    if (!fresh) return
    const body = writeSlideBody(fresh.node.attrs.body, mutate(fresh.data))
    if (body !== fresh.node.attrs.body) {
      editor.view.dispatch(editor.state.tr.setNodeMarkup(fresh.pos, undefined, { ...fresh.node.attrs, body }))
    }
    if (focus !== undefined) setFocusPath(focus)
  }, [editor, slide.index])

  const writeNotes = useCallback((notes: string | null) => {
    const fresh = slidesOf(editor.state.doc)[slide.index]
    if (!fresh || fresh.node.attrs.notes === notes) return
    editor.view.dispatch(editor.state.tr.setNodeMarkup(fresh.pos, undefined, { ...fresh.node.attrs, notes }))
  }, [editor, slide.index])

  const undoKey = (event: ReactKeyboardEvent<HTMLElement>): boolean => {
    const mod = event.metaKey || event.ctrlKey
    const key = event.key.toLowerCase()
    if (mod && key === 'z') {
      if (event.shiftKey) editor.commands.redo()
      else editor.commands.undo()
      return true
    }
    if (mod && key === 'y') {
      editor.commands.redo()
      return true
    }
    return false
  }

  const onKey = (path: string, event: ReactKeyboardEvent<HTMLElement>): boolean => {
    if (undoKey(event)) {
      // The box keeps the caret, so it shows what the undo put back itself.
      const element = event.currentTarget
      const fresh = slidesOf(editor.state.doc)[slide.index]
      element.textContent = fresh ? valueAt(fresh.data, path) : ''
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
      const move = nextCell(data, path, event.key === 'Enter' ? 'enter' : event.shiftKey ? 'shift-tab' : 'tab')
      if (!move) return event.key === 'Tab'
      if (move.data !== data) write(() => move.data, move.path)
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
    if (event.key === 'Enter' && !event.shiftKey && !item && !cell) {
      // From the title or a line under it, on to the next words on the slide.
      const order = textBoxes(layoutSlide(slide.kind, data, { editing: true })).map(box => box.path)
      const next = order[order.indexOf(path) + 1]
      if (next) setFocusPath(next)
      else (event.currentTarget as HTMLElement).blur()
      return true
    }
    return false
  }

  const editing: SlideEditing = {
    onText: (path, value) => {
      onWriting()
      write(current => setPath(current, path, value))
    },
    onKey,
    onSetIcon: (index, name) => write(current => setIcon(current, index, name)),
    focusPath,
    onFocused: () => setFocusPath(null),
  }

  // The notes, uncontrolled while they have the caret, as the slide's words are.
  useLayoutEffect(() => {
    const element = notesRef.current
    if (element && document.activeElement !== element && element.textContent !== (slide.notes ?? '')) element.textContent = slide.notes ?? ''
  })

  const source = sourceLine(slide.data.from)
  const preview = notesPreview(slide.notes)

  return (
    <>
      <div className="deck-big" style={{ width }}>
        <SlideCanvas kind={slide.kind} data={slide.data} width={width} theme={theme} borderless={borderless} assets={assets} editing={editing} />
      </div>
      <div className="deck-under">
        {source ? (
          <div className="deck-source">
            <Icon name={source.library ? 'books' : 'presentation'} size={12} tone="inherit" />
            {source.library ? `From the library · ${source.name}` : `From ${source.name}`}
          </div>
        ) : null}
        {slide.kind === 'table' ? (
          <div className="deck-source">
            <Tooltip label="Add an empty row at the bottom of the table">
              <Button variant="link" className="deck-line-action" onClick={() => write(addRow)}>Add a row</Button>
            </Tooltip>
            <span aria-hidden="true">·</span>
            <Tooltip label="Add an empty column on the right of the table">
              <Button variant="link" className="deck-line-action" onClick={() => write(addColumn)}>Add a column</Button>
            </Tooltip>
          </div>
        ) : null}
        <Tooltip label={notesOpen ? 'Hide the speaker notes' : 'Show the speaker notes: what you will say, only for you'}>
          <Button
            variant="ghost"
            className={`deck-notes-toggle${notesOpen ? ' is-open' : ''}`}
            aria-expanded={notesOpen}
            onClick={() => setNotesOpen(open => !open)}
          >
            <Icon name="caret-right" size={12} tone="inherit" />
            <span className="deck-notes-label">Speaker notes{preview ? ` · ${preview}` : ''}</span>
          </Button>
        </Tooltip>
        {notesOpen ? (
          <div
            ref={notesRef}
            className="deck-notes"
            contentEditable="plaintext-only"
            suppressContentEditableWarning
            role="textbox"
            aria-multiline
            aria-label="Speaker notes"
            data-ph="What you will say. Only you see it, and only here."
            onInput={event => {
              onWriting()
              const text = event.currentTarget.textContent ?? ''
              writeNotes(text === '' ? null : text)
            }}
            onKeyDown={event => {
              if (undoKey(event)) {
                event.preventDefault()
                const fresh = slidesOf(editor.state.doc)[slide.index]
                event.currentTarget.textContent = fresh?.notes ?? ''
              }
            }}
          />
        ) : null}
      </div>
    </>
  )
}
