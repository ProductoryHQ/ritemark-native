/**
 * Sprint 161 (experience 46, "Comments on the slide, for Claude"; frames 27 and 28): the comments on the slide being
 * edited. It is experience 11's comment, on the slide:
 *
 *  - **Starting one:** Ritemark's own right-click menu on the slide (Cut, Copy, Paste, then Comment ⌘/), and ⌘/. With
 *    a selection it is on the words; otherwise on the block clicked (or the caret's), or on the whole slide when the
 *    click is on its background. Every new comment comes through the handout's one door (`startComment`), so the one-
 *    box rule (#687) and "a selection over a saved comment opens it" hold here too.
 *  - **The card** is the margin rail's (`ComposeBubble`, `CommentBubble`), anchored under what the comment is on, with
 *    its head saying what that is ("On the four boxes, slide 6"). `@claude`, `@chatgpt` or `@opencode` makes it a
 *    request, sent through the comment-task ledger as any comment is; the host names the slide in the message's chip.
 *  - **While a card is open,** what it is on has a thin amber ring.
 *  - **Markers:** a saved comment is an amber speech bubble at the top right of what it is on, on the stage only. The
 *    strip and the deck's bar count them; nothing else draws them (the renderer draws no comment).
 *
 * The comments are the slide editor's own document (`commentMark`, `commentNode`), saved in the slide's Markdown in the
 * handout's notation (`blocks/slideCommentPlace.ts`). This layer only reads the document and the DOM.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Editor as TipTapEditor } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'
import { anchorLine } from '../../../../src/decks/blocks/slideComments'
import {
  CommentNode,
  commentBoxStorage,
  liftCommentLine,
  nextRailBox,
  startComment,
  yieldOpenBox,
  type OpenCommentBox,
} from '../../extensions/comment/CommentNode'
import {
  CommentBubble,
  CommentIcon,
  ComposeBubble,
  applyCommentNote,
  recoverCommentTask,
  removeComment,
  sendCommentTask,
  type ComposeBoxHandle,
  type SendState,
} from '../MarginCommentRail'
import { onDocChanged } from '../../lib/docChange'
import { Tooltip } from '../ui/tooltip'
import { placeSlideNote, slideMarkersOf, topBlockAt, type SlideMarker, type SlideTarget } from './blocks/slideCommentPlace'

/**
 * The slide editor's comment node: the handout's own (`commentNode`: its notation, its load and save, its `///` line),
 * with storage of its own, so a slide's one open box is that slide's. ⌘/ is the slide's (`startSlideComment`): the
 * handout's would put a note at the caret, inside the words. On the stage a note is hidden, so the caret and the arrows
 * never select it (`selectable: false`), and Backspace and Delete go past it (`notesOutOfTheWay`).
 */
export const SlideCommentNode = CommentNode.extend({
  selectable: false,
  addKeyboardShortcuts() {
    return { Enter: () => liftCommentLine(this.editor) }
  },
})

/** The card's width (the prototype's `.ccm`, frame 28). */
const CARD_WIDTH = 290
/** Room between what a comment is on and its card, and from the window's edges. */
const CARD_GAP = 12
const EDGE = 8

/** What ⌘/ comments on: the selected words, or the block holding the caret. */
export function caretTarget(editor: TipTapEditor): SlideTarget {
  const { selection, doc } = editor.state
  if (!selection.empty) return { kind: 'words' }
  const top = topBlockAt(doc, selection.from)
  return top === null ? { kind: 'slide' } : { kind: 'block', pos: top }
}

/**
 * What a right-click comments on: the selected words when the click is on them, the top-level block clicked, or the
 * whole slide when the click is on its background (between blocks, the slide's margins, its picture).
 */
export function clickTarget(editor: TipTapEditor, event: { clientX: number; clientY: number; target: EventTarget | null }): SlideTarget {
  const view = editor.view
  const { selection } = editor.state
  if (!selection.empty) {
    const at = view.posAtCoords({ left: event.clientX, top: event.clientY })
    if (at && at.pos >= selection.from && at.pos <= selection.to) return { kind: 'words' }
  }
  const root = view.dom
  let element = event.target instanceof Element ? event.target : null
  if (!element || element === root || !root.contains(element)) return { kind: 'slide' }
  while (element && element.parentElement !== root) element = element.parentElement
  if (!element) return { kind: 'slide' }
  let pos: number
  try {
    pos = view.posAtDOM(element, 0)
  } catch {
    return { kind: 'slide' }
  }
  const top = topBlockAt(editor.state.doc, pos)
  return top === null ? { kind: 'slide' } : { kind: 'block', pos: top }
}

/**
 * Start a comment on the slide (the right-click menu's Comment, ⌘/). The handout's open box gives way first, as any
 * other box does (#687): an empty one closes, one with unsaved words comes forward and nothing new opens. Then the
 * handout's one door: words get the comment mark; a block or the whole slide gets a note in its place.
 */
export function startSlideComment(editor: TipTapEditor, target: SlideTarget, outer?: TipTapEditor | null): boolean {
  if (editor.isDestroyed) return false
  const outerBox = outer && !outer.isDestroyed ? commentBoxStorage(outer)?.openBox ?? null : null
  if (outer && outerBox && yieldOpenBox(outer, outerBox.key) === null) return true
  if (target.kind === 'words' && !editor.state.selection.empty) return startComment(editor)
  // A block or the whole slide: the words selected aren't what it is on, so the selection collapses to its caret.
  const { selection } = editor.state
  if (!selection.empty) editor.view.dispatch(editor.state.tr.setSelection(TextSelection.near(selection.$head)))
  return startComment(editor, placeSlideNote(target.kind === 'block' ? target : { kind: 'slide' }))
}

/** Where things are drawn: markers and the ring inside the slide's frame, the card in the window. */
interface Layout {
  markers: Record<string, { left: number; top: number }>
  ring: { left: number; top: number; width: number; height: number } | null
  card: { left: number; top: number } | null
}

const NO_LAYOUT: Layout = { markers: {}, ring: null, card: null }

/** A comment's target on screen: its words, its block (a text block's words, tight), or the slide. */
function targetRect(editor: TipTapEditor, frame: HTMLElement, marker: SlideMarker): DOMRect | null {
  const view = editor.view
  const target = marker.target
  if (target.kind === 'slide') return frame.getBoundingClientRect()
  try {
    if (target.kind === 'words') {
      const ranges = marker.ranges ?? [{ from: target.from, to: target.to }]
      let rect: DOMRect | null = null
      for (const range of ranges) {
        const start = view.domAtPos(range.from)
        const end = view.domAtPos(range.to)
        const dom = document.createRange()
        dom.setStart(start.node, start.offset)
        dom.setEnd(end.node, end.offset)
        const box = dom.getBoundingClientRect()
        if (!box.width && !box.height) continue
        rect = rect ? union(rect, box) : box
      }
      return rect
    }
    const dom = view.nodeDOM(target.pos)
    if (!(dom instanceof HTMLElement)) return null
    const node = editor.state.doc.nodeAt(target.pos)
    if (node?.isTextblock && node.content.size > 0) {
      // A title or a line: its words' own box, so the marker sits at their end (frame 27), not at the slide's edge.
      const words = document.createRange()
      words.selectNodeContents(dom)
      const box = words.getBoundingClientRect()
      if (box.width || box.height) return box
    }
    return dom.getBoundingClientRect()
  } catch {
    return null
  }
}

function union(a: DOMRect, b: DOMRect): DOMRect {
  const left = Math.min(a.left, b.left)
  const top = Math.min(a.top, b.top)
  return new DOMRect(left, top, Math.max(a.right, b.right) - left, Math.max(a.bottom, b.bottom) - top)
}

export interface SlideCommentsProps {
  /** The slide editor. */
  editor: TipTapEditor | null
  /** The slide's frame (`.deck-slide`): markers and the ring are drawn in it. */
  frame: HTMLElement | null
  /** The slide's number, from 1, for the card's head. */
  slideNumber: number
  /** Open a saved comment, latched (the deck's bar, Prev and Next): its place among the slide's comments; a new serial asks again. */
  open?: { ordinal: number; serial: number } | null
}

export function SlideComments({ editor, frame, slideNumber, open }: SlideCommentsProps) {
  const [markers, setMarkers] = useState<SlideMarker[]>([])
  /** A saved comment's card, opened by a click (on its marker or its words), the bar, or the door. */
  const [openKey, setOpenKey] = useState<string | null>(null)
  /** The one open box (#687): a new comment's composer, or a saved one's Edit. */
  const [composeKey, setComposeKey] = useState<string | null>(null)
  const [sendStates, setSendStates] = useState<Record<string, SendState>>({})
  const [layout, setLayout] = useState<Layout>(NO_LAYOUT)
  const [cardHeight, setCardHeight] = useState(180)
  const boxDirty = useRef(false)
  const boxHandle = useRef<ComposeBoxHandle | null>(null)
  const firstShown = useRef(false)
  const cardRef = useRef<HTMLDivElement | null>(null)

  const rescan = useCallback(() => {
    if (!editor || editor.isDestroyed) return
    setMarkers(slideMarkersOf(editor.state.doc))
  }, [editor])

  useEffect(() => {
    if (!editor) return
    rescan()
    return onDocChanged(editor, rescan)
  }, [editor, rescan])

  // The door asks to open a comment without changing the document (a saved one, latched): it wakes the layer itself.
  useEffect(() => {
    const storage = commentBoxStorage(editor)
    if (!storage) return
    storage.notifyRail = rescan
    return () => {
      if (storage.notifyRail === rescan) storage.notifyRail = null
    }
  }, [editor, rescan])

  // Which marker is the box, as the rail decides it (`nextRailBox`): the door's request wins once its comment is there.
  useEffect(() => {
    const storage = commentBoxStorage(editor)
    const next = nextRailBox({ current: composeKey, markers, request: storage?.openRequest ?? null, firstShown: firstShown.current })
    firstShown.current = next.firstShown
    if (next.tookRequest && storage) storage.openRequest = null
    if (next.composeKey !== composeKey) setComposeKey(next.composeKey)
    if (next.latch) setOpenKey(next.latch)
  }, [editor, markers, composeKey])

  // A box that opens leaves no other card open beside it.
  useEffect(() => {
    if (composeKey) setOpenKey(key => (key === composeKey ? key : null))
  }, [composeKey])

  const boxMarker = composeKey ? markers.find(marker => marker.key === composeKey) : undefined
  const openMarker = boxMarker ?? (openKey ? markers.find(marker => marker.key === openKey) : undefined)

  // Tell the door which box is open, how dirty it is, and how to bring it forward or close it (#687).
  useEffect(() => {
    const storage = commentBoxStorage(editor)
    if (!storage || !boxMarker) return
    const key = boxMarker.key
    const entry: OpenCommentBox = {
      key,
      commentId: boxMarker.commentId,
      kind: boxMarker.note === '' ? 'new' : 'edit',
      anchor: boxMarker.kind,
      from: boxMarker.ranges?.[0]?.from,
      to: boxMarker.ranges?.[boxMarker.ranges.length - 1]?.to,
      nodePos: boxMarker.nodePos,
      get dirty() {
        return boxDirty.current
      },
      bringForward: () => boxHandle.current?.focusEnd(),
      close: () => setComposeKey(current => (current === key ? null : current)),
    }
    storage.openBox = entry
    return () => {
      if (storage.openBox === entry) storage.openBox = null
    }
  }, [editor, boxMarker])

  /** Open a saved comment's card, once the open box gives way (#687). */
  const openSaved = useCallback((key: string) => {
    if (!editor) return
    const target = composeKey && editor ? yieldOpenBox(editor, key) : key
    if (!target) return
    const marker = markers.find(candidate => candidate.key === target)
    if (marker && marker.note === '') {
      setComposeKey(target)
      return
    }
    setOpenKey(current => (current === target ? null : target))
  }, [editor, composeKey, markers])

  // The bar's Prev and Next: a saved comment of this slide, by its place.
  // Taken once per serial: a slide just made current asks again when its markers arrive, never after.
  const takenSerial = useRef<number | null>(null)
  useEffect(() => {
    if (!open || !editor || takenSerial.current === open.serial) return
    const saved = markers.filter(marker => marker.note.trim())
    const marker = saved[open.ordinal]
    if (!marker) return
    takenSerial.current = open.serial
    const target = composeKey ? yieldOpenBox(editor, marker.key) : marker.key
    if (target) setOpenKey(target)
  }, [open, editor, markers, composeKey])

  // A click on a comment's words opens its card, as a click on its highlight does in the handout.
  useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom
    const onClick = (event: MouseEvent) => {
      const mark = event.target instanceof Element ? event.target.closest('mark[data-comment]') : null
      if (!mark) return
      const id = mark.getAttribute('data-comment-id')
      const marker = id
        ? markers.find(candidate => candidate.commentId === id)
        : markers.find(candidate => {
          if (candidate.kind !== 'mark') return false
          try {
            const pos = editor.view.posAtDOM(mark, 0)
            return candidate.ranges?.some(range => pos >= range.from && pos <= range.to) ?? false
          } catch {
            return false
          }
        })
      if (marker && marker.key !== composeKey) openSaved(marker.key)
    }
    dom.addEventListener('click', onClick)
    return () => dom.removeEventListener('click', onClick)
  }, [editor, markers, composeKey, openSaved])

  // A saved comment's card closes on a click elsewhere and on Esc (the popup rule); a box closes with its own buttons.
  useEffect(() => {
    if (!openKey || composeKey) return
    const onPointer = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('.deck-comment-card, .deck-comment-marker, mark[data-comment], [data-radix-popper-content-wrapper]')) return
      setOpenKey(null)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenKey(null)
    }
    document.addEventListener('mousedown', onPointer, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [openKey, composeKey])

  // Where everything is drawn, measured from the slide as it is now: after each change, and when the window moves.
  const measure = useCallback(() => {
    if (!editor || editor.isDestroyed || !frame) { setLayout(NO_LAYOUT); return }
    const frameRect = frame.getBoundingClientRect()
    const placed: Layout['markers'] = {}
    const taken: Array<{ left: number; top: number }> = []
    for (const marker of markers) {
      if (!marker.note.trim() && marker.key !== composeKey) continue
      const rect = targetRect(editor, frame, marker)
      if (!rect) continue
      let left = marker.target.kind === 'slide' ? frameRect.width - 36 : rect.right - frameRect.left - 10
      const top = marker.target.kind === 'slide' ? 10 : Math.max(2, rect.top - frameRect.top - 14)
      left = Math.min(left, frameRect.width - 28)
      // Two comments on the same thing stand side by side.
      while (taken.some(spot => Math.abs(spot.left - left) < 20 && Math.abs(spot.top - top) < 20)) left -= 30
      taken.push({ left, top })
      placed[marker.key] = { left, top }
    }
    let ring: Layout['ring'] = null
    let card: Layout['card'] = null
    if (openMarker) {
      const rect = targetRect(editor, frame, openMarker)
      if (rect) {
        ring = openMarker.target.kind === 'slide'
          ? { left: 3, top: 3, width: frameRect.width - 6, height: frameRect.height - 6 }
          : { left: rect.left - frameRect.left - 4, top: rect.top - frameRect.top - 4, width: rect.width + 8, height: rect.height + 8 }
        const width = window.innerWidth
        const height = window.innerHeight
        const left = Math.max(EDGE, Math.min(rect.right - CARD_WIDTH, width - CARD_WIDTH - EDGE))
        let top = rect.bottom + CARD_GAP
        if (top + cardHeight > height - EDGE) top = Math.max(EDGE, Math.min(height - cardHeight - EDGE, rect.top - cardHeight - CARD_GAP))
        card = { left, top }
      }
    }
    setLayout({ markers: placed, ring, card })
  }, [editor, frame, markers, openMarker, composeKey, cardHeight])

  useLayoutEffect(() => { measure() }, [measure])
  useEffect(() => {
    if (!editor || !frame) return
    const again = () => measure()
    window.addEventListener('resize', again)
    window.addEventListener('scroll', again, true)
    const observer = new ResizeObserver(again)
    observer.observe(frame)
    editor.on('update', again)
    document.fonts?.addEventListener?.('loadingdone', again)
    return () => {
      window.removeEventListener('resize', again)
      window.removeEventListener('scroll', again, true)
      observer.disconnect()
      editor.off('update', again)
      document.fonts?.removeEventListener?.('loadingdone', again)
    }
  }, [editor, frame, measure])
  // The card's own height, for room under or over what it is on.
  useLayoutEffect(() => {
    const bubble = cardRef.current?.querySelector<HTMLElement>('.rm-bubble')
    if (bubble && Math.abs(bubble.offsetHeight - cardHeight) > 1) setCardHeight(bubble.offsetHeight)
  })

  const setSendState = useCallback((key: string, state: SendState | null) => {
    setSendStates(current => {
      const next = { ...current }
      if (state) next[key] = state
      else delete next[key]
      return next
    })
  }, [])

  const onBoxDirtyChange = useCallback((dirty: boolean) => { boxDirty.current = dirty }, [])

  if (!editor || !frame) return null

  const card: ReactNode = openMarker && layout.card ? createPortal(
    <div ref={cardRef} className="deck-comment-card" style={{ left: layout.card.left, top: layout.card.top, width: CARD_WIDTH }}>
      {boxMarker ? (
        <ComposeBubble
          key={boxMarker.key}
          initial={boxMarker.note}
          width={CARD_WIDTH}
          offset={0}
          on={anchorLine(boxMarker.anchor, slideNumber)}
          handleRef={boxHandle}
          onDirtyChange={onBoxDirtyChange}
          onSave={text => {
            applyCommentNote(editor, boxMarker, text)
            setComposeKey(null)
            rescan()
          }}
          onCancel={() => {
            // A new comment's box: its empty comment goes. An Edit: back to how it was.
            if (boxMarker.note === '') applyCommentNote(editor, boxMarker, '')
            setComposeKey(null)
            rescan()
          }}
        />
      ) : (
        <CommentBubble
          key={openMarker.key}
          note={openMarker.note}
          commentId={openMarker.commentId}
          width={CARD_WIDTH}
          offset={0}
          on={anchorLine(openMarker.anchor, slideNumber)}
          sendState={sendStates[openMarker.key]}
          onEdit={() => {
            const target = yieldOpenBox(editor, openMarker.key)
            if (target) setComposeKey(target)
          }}
          onRemove={() => {
            removeComment(editor, openMarker)
            setOpenKey(null)
            rescan()
          }}
          onSend={() => void sendCommentTask(editor, openMarker.key, {
            state: setSendState,
            moved: (from, to) => setOpenKey(current => (current === from ? to : current)),
          })}
          onRecovery={recoverCommentTask}
        />
      )}
    </div>,
    document.body,
  ) : null

  return (
    <div className="deck-comments-layer" aria-hidden={false}>
      {layout.ring ? <div className="deck-comment-ring" style={layout.ring} /> : null}
      {markers.filter(marker => layout.markers[marker.key] && marker.note.trim()).map(marker => {
        const spot = layout.markers[marker.key]
        const preview = marker.note.length > 40 ? `${marker.note.slice(0, 39)}…` : marker.note
        return (
          <div key={marker.key} className="deck-comment-spot" style={{ left: spot.left, top: spot.top }}>
            <Tooltip label={`Comment: ${preview}`}>
              <button
                type="button"
                className={`deck-comment-marker${openMarker?.key === marker.key ? ' is-open' : ''}`}
                aria-label={`Comment: ${preview}`}
                aria-expanded={openMarker?.key === marker.key}
                onMouseDown={event => event.preventDefault()}
                onClick={() => openSaved(marker.key)}
              >
                <CommentIcon size={14} />
              </button>
            </Tooltip>
          </div>
        )
      })}
      {card}
    </div>
  )
}
