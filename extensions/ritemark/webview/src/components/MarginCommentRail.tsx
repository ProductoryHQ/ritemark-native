/**
 * MarginCommentRail — the right-margin comment layer (Sprint 94 #81).
 *
 * Reads the live ProseMirror DOM for anchored comments (`mark[data-comment]`)
 * and standalone notes (`ritemark-comment`), and renders a marker per comment in
 * a gutter aligned to the comment's vertical position — the margin model from
 * `ui-mock.html`. Hovering or focusing a marker opens the note; the trash icon
 * removes it.
 *
 * DOM-scan positioning (rather than ProseMirror decorations) keeps the rail
 * decoupled from the schema and re-aligns on every editor update / scroll /
 * resize.
 *
 * Sprint 117 (#292, #281) changed three things here:
 *  - Assignment comes from the comment BODY through the shared collector, not
 *    from the `data-agent` DOM attribute the rail used to read (audit F02).
 *  - Sending is honest: no "Sent" flash. The control goes to a pending state,
 *    the host answers, and the bubble then shows the task's real lifecycle from
 *    `comment-task/projection` (audit F18, R5–R7).
 *  - The gutter is width-aware, so a collapsed marker never covers document
 *    text, and the composer resizes with its controls always reachable (R10).
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { getMarkRange } from '@tiptap/core'
import type { Editor as TipTapEditor } from '@tiptap/react'
import {
  hasCommentTerminator,
  detectAgentAlias,
  ALIAS_LABEL,
  MENTION_SOURCE,
  type CommentAgentAlias,
} from '../extensions/comment/commentModel'
import { assignMissingCommentIds } from '../extensions/comment/commentIds'
import {
  commentBoxStorage,
  commentRangesById,
  composerIsDirty,
  leastScrollDelta,
  nextRailBox,
  yieldOpenBox,
  type OpenCommentBox,
  type ScreenSpan,
} from '../extensions/comment/CommentNode'
import { collectDocumentComments, type MinimalNode } from '../extensions/comment/commentIndex'
import {
  requestCommentTask,
  toRequestComment,
  useCommentTaskDestination,
  useCommentTaskProjection,
} from '../extensions/comment/commentTaskStatus'
import {
  destinationCaption,
  presentCommentTask,
  recoveryAction,
  type CommentTaskAction,
} from './comment/commentTaskCopy'
import {
  AgentMentionPicker,
  filterAgentOptions,
  findMentionQuery,
  insertMention,
  mentionKeyAction,
  mentionOptionId,
} from './comment/AgentMentionPicker'
import { ResizableComposer } from './comment/ResizableComposer'
import { Button } from './ui/button'
import { sendToExtension } from '../bridge'
import type { CommentTaskError } from '../../../src/commentTasks/protocol'
import { onDocChanged } from '../lib/docChange'
import { Tooltip } from './ui/tooltip'

interface RailMarker {
  key: string
  top: number
  note: string
  kind: 'mark' | 'node'
  el: HTMLElement
  /** Anchored mark: the FULL document range of the comment (mark). */
  from?: number
  to?: number
  /** Standalone note: the document position of the atom node. */
  nodePos?: number
  /**
   * Anchored mark with a shared id (#150): the comment may span multiple block
   * ranges. When set, remove/edit/send operate on ALL ranges carrying this id,
   * not just the representative from/to above (which is the topmost fragment).
   */
  commentId?: string
}

/**
 * All document ranges of a commentMark carrying the given shared id (#150).
 * A multi-block comment is several mark ranges (one per block) sharing one id;
 * returns a per-inline-node range list, safe to unset/re-set (marks don't
 * change doc size, so positions stay stable across the chained ops).
 */
function rangesByCommentId(editor: TipTapEditor, id: string): { from: number; to: number }[] {
  return commentRangesById(editor.state.doc, id)
}

/**
 * The document range(s) a rail marker operates on. A shared-id comment (#150)
 * resolves to every fragment; a legacy id-less comment (or one still being
 * measured) uses its single representative range.
 */
function markerRanges(editor: TipTapEditor, m: RailMarker): { from: number; to: number }[] {
  if (m.commentId) {
    const ranges = rangesByCommentId(editor, m.commentId)
    if (ranges.length) return ranges
  }
  return m.from != null && m.to != null ? [{ from: m.from, to: m.to }] : []
}

const MARKER_MIN_GAP = 8
const MARKER_HEIGHT = 30

// ── Gutter geometry (R10) ────────────────────────────────────────────────────
// The text column is `max-width: 900px; margin: 0 auto; padding-right: 2rem`
// (Editor.tsx), so the free margin is `(containerWidth - min(900, width)) / 2 +
// 32px`. A gutter wider than that overlaps the text — which is exactly what the
// fixed 210px rail did below ~1272px. These thresholds keep the COLLAPSED
// marker inside the free margin at every width: 210 + 8 fits from 1272px up,
// and 26 + 4 fits inside the 32px text padding even when the column fills the
// window. Measured against the CSS above; re-check them if the column changes.
export type RailDensity = 'wide' | 'medium' | 'compact'

/** Grace period before a hover-opened bubble closes (Sprint 126 follow-up).
 *  Long enough to cross the gap from the highlight to the rail, short enough
 *  that a bubble never feels stuck to the pointer. */
const HOVER_CLOSE_GRACE_MS = 220

const RAIL_WIDE_MIN_PX = 1280
const RAIL_MEDIUM_MIN_PX = 960

function railDensity(containerWidth: number): RailDensity {
  if (containerWidth >= RAIL_WIDE_MIN_PX) return 'wide'
  if (containerWidth >= RAIL_MEDIUM_MIN_PX) return 'medium'
  return 'compact'
}

function railGeometry(containerWidth: number, density: RailDensity) {
  // compact: 30px + the 2px inset = the 32px (2rem) right padding of the text
  // column exactly, so the marker sits in the padding and not on the words.
  const railWidth = density === 'wide' ? 210 : density === 'medium' ? 40 : 30
  // An expanded bubble needs to be legible, so below `wide` it is wider than
  // the gutter — and therefore opens BELOW the marker (design.md), never over
  // the line it annotates, and never with a negative offset into the column.
  const bubbleWidth =
    density === 'wide' ? 210 : Math.min(300, Math.max(180, Math.round(containerWidth) - 32))
  const bubbleOffset = density === 'wide' ? 0 : MARKER_HEIGHT - 4
  return { railWidth, bubbleWidth, bubbleOffset }
}

/** Resolve the document position of the standalone comment atom for a DOM node. */
function commentNodePos(editor: TipTapEditor, el: HTMLElement): number | null {
  const pos = editor.view.posAtDOM(el, 0)
  if (pos == null || pos < 0) return null
  const doc = editor.state.doc
  for (const p of [pos, pos - 1, pos + 1]) {
    if (p >= 0 && p <= doc.content.size) {
      const n = doc.nodeAt(p)
      if (n && n.type.name === 'commentNode') return p
    }
  }
  return null
}

/** Full document range of the comment mark covering the given DOM `<mark>`. */
function commentMarkRange(
  editor: TipTapEditor,
  el: HTMLElement,
): { from: number; to: number } | null {
  const markType = editor.schema.marks.commentMark
  if (!markType) return null
  const pos = editor.view.posAtDOM(el, 0)
  if (pos == null || pos < 0) return null
  const size = editor.state.doc.content.size
  for (const p of [pos, pos + 1]) {
    if (p < 0 || p > size) continue
    const range = getMarkRange(editor.state.doc.resolve(p), markType)
    if (range) return range
  }
  return null
}

function scan(editor: TipTapEditor, container: HTMLElement): RailMarker[] {
  const pm = container.querySelector('.ProseMirror')
  if (!pm) return []
  const cRect = container.getBoundingClientRect()
  const els = pm.querySelectorAll<HTMLElement>('mark[data-comment], ritemark-comment')
  const list: RailMarker[] = []
  const seen = new Set<string>()
  els.forEach((el) => {
    const isMark = el.tagName.toLowerCase() === 'mark'
    const note = (isMark ? el.getAttribute('data-comment') : el.getAttribute('data-note')) || ''

    // Identity is POSITIONAL, not text-based (audit H-A/H-B): a comment split
    // across formatting renders as several <mark> fragments that share ONE mark
    // range → one marker; two distinct comments with identical text keep their
    // own ranges/positions → separate markers.
    let identity: string
    let from: number | undefined
    let to: number | undefined
    let nodePos: number | undefined
    let commentId: string | undefined
    if (isMark) {
      const range = commentMarkRange(editor, el)
      if (!range) return
      from = range.from
      to = range.to
      // Group by shared id (#150): all fragments of a multi-block comment carry
      // the same data-comment-id, so they collapse to ONE marker. The first
      // `<mark>` in DOM order (topmost block) wins position + from/to. Comments
      // without an id (older docs) keep the positional identity — a single-block
      // comment still yields one marker.
      const cid = el.getAttribute('data-comment-id') || undefined
      commentId = cid
      identity = cid ? `c:${cid}` : `m:${from}-${to}`
    } else {
      const np = commentNodePos(editor, el)
      if (np == null) return
      nodePos = np
      const cid = el.getAttribute('data-comment-id') || undefined
      commentId = cid
      identity = cid ? `c:${cid}` : `n:${np}`
    }
    if (seen.has(identity)) return
    seen.add(identity)

    const r = el.getBoundingClientRect()
    list.push({
      key: identity,
      top: r.top - cRect.top + container.scrollTop,
      note,
      kind: isMark ? 'mark' : 'node',
      el,
      from,
      to,
      nodePos,
      commentId,
    })
  })
  // collision resolve — never overlap markers
  list.sort((a, b) => a.top - b.top)
  let prevBottom = -MARKER_MIN_GAP
  for (const m of list) {
    if (m.top < prevBottom + MARKER_MIN_GAP) m.top = prevBottom + MARKER_MIN_GAP
    prevBottom = m.top + MARKER_HEIGHT
  }
  return list
}

/**
 * The line a comment is about, on screen (#687, experience 11): the first line
 * of its highlighted words, or, for a margin note (no words in the text), its
 * marker's line in the rail. `item` is the comment's `.rm-rail-item`, whose top
 * is the marker's line.
 */
function commentLine(marker: RailMarker, item: Element | null): ScreenSpan | null {
  if (marker.kind === 'mark' && marker.el.isConnected) {
    const first = marker.el.getClientRects()[0]
    if (first) return { top: first.top, bottom: first.bottom }
  }
  if (!item) return null
  const top = item.getBoundingClientRect().top
  return { top, bottom: top + MARKER_HEIGHT }
}

/** Scroll the least it takes to show `box` and the line it is about (`leastScrollDelta`). */
function revealBoxAndLine(container: HTMLElement | null, box: HTMLElement | null, line: ScreenSpan | null) {
  if (!box) return
  if (!container) {
    box.scrollIntoView({ block: 'nearest' })
    return
  }
  const rect = container.getBoundingClientRect()
  const top = rect.top + container.clientTop
  const b = box.getBoundingClientRect()
  // One text line of room above the line (the Experience lead, experience 11):
  // the line before it shows as context, not flush under the document's head.
  const text = container.querySelector('.ProseMirror p') ?? container.querySelector('.ProseMirror')
  const lineHeight = text ? parseFloat(getComputedStyle(text).lineHeight) : NaN
  const room = Number.isFinite(lineHeight) ? lineHeight : 0
  const delta = leastScrollDelta({ top, bottom: top + container.clientHeight }, { top: b.top, bottom: b.bottom }, line, room)
  if (delta) container.scrollTop += delta
}

const CommentIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

const SendIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />
  </svg>
)

/**
 * Render a note's text with any `@claude`/`@codex`/`@opencode` mention shown
 * inline with a light-background chip (instead of a separate agent badge) — the
 * assignment lives in the text, not in extra chrome.
 */
function renderNoteWithMentions(note: string): ReactNode {
  const re = new RegExp(MENTION_SOURCE, 'gi')
  const out: ReactNode[] = []
  let last = 0
  let i = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(note)) !== null) {
    if (m.index > last) out.push(note.slice(last, m.index))
    out.push(
      <span key={i++} className="rm-mention">
        {m[0]}
      </span>,
    )
    last = m.index + m[0].length
  }
  if (last < note.length) out.push(note.slice(last))
  return out.length ? out : note
}

/** What the rail needs to bring its one open box forward (#687). */
interface ComposeBoxHandle {
  /** The box itself, to scroll into view with the line it is about. */
  box: () => HTMLElement | null
  /** The caret at the end of the box's text. */
  focusEnd: () => void
}

/** Compose bubble — used to create a new comment and to edit an existing one. */
function ComposeBubble({
  initial = '',
  width,
  offset,
  onSave,
  onCancel,
  handleRef,
  onDirtyChange,
}: {
  initial?: string
  width: number
  offset: number
  onSave: (text: string) => void
  onCancel: () => void
  /** Filled while this box is mounted, so the rail can bring it forward. */
  handleRef: { current: ComposeBoxHandle | null }
  /** Told whenever the box starts or stops holding words that aren't saved. */
  onDirtyChange: (dirty: boolean) => void
}) {
  const [text, setText] = useState(initial)
  const [caret, setCaret] = useState(initial.length)
  const [activeIndex, setActiveIndex] = useState(0)
  const [dismissedStart, setDismissedStart] = useState<number | null>(null)
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const listId = useId()

  const dirty = composerIsDirty(text, initial)
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  // Coming forward (#687): the rail scrolls the box in, then the caret goes to
  // the end of its text. The field's own focus ring is the only signal.
  useEffect(() => {
    const handle: ComposeBoxHandle = {
      box: () => boxRef.current,
      focusEnd: () => {
        const el = ref.current
        if (!el) return
        el.focus({ preventScroll: true })
        const end = el.value.length
        el.setSelectionRange(end, end)
        setCaret(end)
      },
    }
    handleRef.current = handle
    return () => {
      if (handleRef.current === handle) handleRef.current = null
    }
  }, [handleRef])

  const mention = findMentionQuery(text, caret)
  const options = useMemo(() => (mention ? filterAgentOptions(mention.query) : []), [mention])
  const pickerOpen = !!mention && options.length > 0 && mention.start !== dismissedStart

  const aliasSignature = options.map((o) => o.alias).join(',')
  useEffect(() => {
    setActiveIndex(0)
  }, [aliasSignature])

  const syncCaret = useCallback(() => {
    const el = ref.current
    if (el) setCaret(el.selectionStart ?? el.value.length)
  }, [])

  // H1: a literal `-->` cannot be stored inside an HTML comment — reject at input.
  const terminator = hasCommentTerminator(text)
  const alias = detectAgentAlias(text)
  const save = () => {
    if (terminator) return
    onSave(text)
  }

  const choose = (aliasToInsert: string) => {
    if (!mention) return
    const next = insertMention(text, mention, aliasToInsert)
    setText(next.text)
    setCaret(next.caret)
    setDismissedStart(null)
    requestAnimationFrame(() => {
      const el = ref.current
      if (!el) return
      el.focus()
      el.setSelectionRange(next.caret, next.caret)
    })
  }

  return (
    <div ref={boxRef} className="rm-bubble" style={{ width, top: offset }}>
      <div className="rm-bubble-head">
        <span className="rm-bubble-who">Comment</span>
      </div>
      <ResizableComposer
        value={text}
        autoFocus
        inputRef={ref}
        placeholder="Comment, or @claude to assign"
        onChange={(value) => {
          setText(value)
          const el = ref.current
          setCaret(el ? el.selectionStart ?? value.length : value.length)
        }}
        onKeyDown={(e) => {
          if (pickerOpen) {
            const action = mentionKeyAction(e.key, { count: options.length, activeIndex })
            if (action.kind !== 'ignore') {
              e.preventDefault()
              if (action.kind === 'move') setActiveIndex(action.index)
              else if (action.kind === 'insert') choose(options[action.index].alias)
              else setDismissedStart(mention ? mention.start : null)
              return
            }
          }
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            save()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            onCancel()
          }
        }}
        inputProps={{
          role: 'combobox',
          'aria-expanded': pickerOpen,
          'aria-controls': pickerOpen ? listId : undefined,
          'aria-autocomplete': 'list',
          'aria-activedescendant':
            pickerOpen && options[activeIndex] ? mentionOptionId(listId, options[activeIndex].alias) : undefined,
          'aria-label': 'Comment text',
          onKeyUp: syncCaret,
          onClick: syncCaret,
          onSelect: syncCaret,
        }}
        overlay={
          pickerOpen ? (
            <AgentMentionPicker
              options={options}
              activeIndex={activeIndex}
              listId={listId}
              onChoose={(option) => choose(option.alias)}
              onActiveIndexChange={setActiveIndex}
            />
          ) : null
        }
        error={terminator ? <div className="rm-compose-err">A comment can’t contain “--&gt;”.</div> : null}
        footer={
          <>
            {alias && <span className="rm-agent-pill">{ALIAS_LABEL[alias]}</span>}
            <span className="rm-grow" />
            <Button variant="ghost" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={onCancel}>
              Cancel
            </Button>
            <Button size="sm" onMouseDown={(e) => e.preventDefault()} onClick={save} disabled={terminator}>
              Comment
            </Button>
          </>
        }
      />
    </div>
  )
}

/** What this surface knows about its own in-flight accept — never more. */
type SendState = { status: 'pending' } | { status: 'rejected'; error: CommentTaskError }

function RailItem({
  marker,
  density,
  geometry,
  open,
  pinned,
  composing,
  sendState,
  onOpen,
  onClose,
  onTogglePin,
  onEdit,
  onRemove,
  onSave,
  onCancelCompose,
  onSend,
  onRecovery,
  boxHandle,
  onDirtyChange,
  reveal,
  onRevealed,
}: {
  marker: RailMarker
  density: RailDensity
  geometry: { railWidth: number; bubbleWidth: number; bubbleOffset: number }
  open: boolean
  /** Latched open by a click, so the pointer may leave without closing it. */
  pinned: boolean
  /** This marker is the rail's one open box (#687). */
  composing: boolean
  sendState: SendState | undefined
  onOpen: () => void
  onClose: () => void
  onTogglePin: () => void
  onEdit: () => void
  onRemove: () => void
  onSave: (text: string) => void
  onCancelCompose: () => void
  onSend: () => void
  onRecovery: (recovery: CommentTaskError['recovery'], alias: CommentAgentAlias | null) => void
  boxHandle: { current: ComposeBoxHandle | null }
  onDirtyChange: (dirty: boolean) => void
  /** Opened latched by the door (#687): the rail scrolls it in once, given this item. */
  reveal: boolean
  onRevealed: (item: HTMLElement) => void
}) {
  const itemRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (reveal && itemRef.current) onRevealed(itemRef.current)
  }, [reveal, onRevealed])
  const projection = useCommentTaskProjection(marker.commentId)
  const alias = detectAgentAlias(marker.note)
  const presentation = projection ? presentCommentTask(projection) : null
  const sending = sendState?.status === 'pending'
  const markerRef = useRef<HTMLButtonElement>(null)
  // The destination caption is only worth asking for while a Send control is
  // actually on screen and no task exists yet.
  const destination = useCommentTaskDestination(open && !!alias && !projection && !composing)

  const preview = marker.note.length > 24 ? marker.note.slice(0, 24) + '…' : marker.note
  const markerLabel = presentation
    ? `Comment: ${preview || 'empty'} — ${presentation.statusLine}`
    : `Comment: ${preview || 'empty'}`

  const runAction = (action: CommentTaskAction) => {
    if (!projection) return
    const type = action.kind === 'retry' ? 'comment-task/retry' : 'comment-task/open-conversation'
    void requestCommentTask(type, { taskId: projection.taskId })
  }

  const rejection = sendState?.status === 'rejected' ? sendState.error : null
  const recovery = rejection ? recoveryAction(rejection) : null

  // The wrapper toggles pin for clicks/keypresses on itself or the marker
  // button, but a bubble action (Send, Edit, Delete, Retry, Open conversation)
  // must reach its own handler instead of being swallowed into a pin toggle
  // (#318).
  const isBubbleAction = (target: EventTarget | null) => {
    // Any element: a click on a button's icon lands on its SVG, not an HTMLElement.
    const el = target instanceof Element ? target : null
    const interactive = el?.closest('button, a, input, textarea, [role="button"]') ?? null
    return interactive !== null && interactive !== markerRef.current
  }

  return (
    <div
      ref={itemRef}
      className={`rm-rail-item${pinned ? ' rm-rail-item-pinned' : ''}`}
      // Open bubble / compose sits ON TOP of neighbouring markers.
      style={{ top: marker.top, zIndex: open || composing ? 30 : 1 }}
      onClick={(e) => {
        if (composing || isBubbleAction(e.target)) return
        onTogglePin()
      }}
      // `onOpen` itself opens nothing while another box is open (#687).
      onMouseEnter={() => !composing && onOpen()}
      // A pinned bubble stays put; only hover-opened ones close on leave.
      onMouseLeave={() => !composing && !pinned && onClose()}
      onBlur={(e) => {
        if (composing) return
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onClose()
      }}
      onKeyDown={(e) => {
        if (composing) return
        if (e.key === 'Escape' && open) {
          e.stopPropagation()
          onClose()
        }
        // Keyboard parity with the click: Enter/Space latches the bubble open
        // so its actions are reachable without a pointer. A bubble action
        // button handles its own Enter/Space via the browser's native button
        // activation, so it must not be preempted here.
        if ((e.key === 'Enter' || e.key === ' ') && !isBubbleAction(e.target)) {
          e.preventDefault()
          e.stopPropagation()
          onTogglePin()
        }
      }}
    >
      {composing ? (
        <ComposeBubble
          initial={marker.note}
          width={geometry.bubbleWidth}
          offset={geometry.bubbleOffset}
          onSave={onSave}
          onCancel={onCancelCompose}
          handleRef={boxHandle}
          onDirtyChange={onDirtyChange}
        />
      ) : (
        <>
        {/* The marker stays mounted while the bubble is open: below the wide
            breakpoint the bubble is offset downwards, and an unmounted marker
            would leave a gap the pointer falls into, closing what it just
            opened. At `wide` the bubble simply covers it. */}
        <button
          ref={markerRef}
          className="rm-marker"
          aria-label={markerLabel}
          aria-expanded={open}
          title={markerLabel}
          onClick={onOpen}
          onFocus={onOpen}
        >
          <span className="rm-marker-ico"><CommentIcon /></span>
          {density === 'wide' && <span className="rm-marker-txt">{renderNoteWithMentions(preview)}</span>}
          {presentation && (
            <span className={`rm-task-dot rm-task-dot--${presentation.tone}`} aria-hidden="true" />
          )}
        </button>
        {open && (
        <div className="rm-bubble" style={{ width: geometry.bubbleWidth, top: geometry.bubbleOffset }}>
          <div className="rm-bubble-head">
            <span className="rm-bubble-who">Comment</span>
            <span className="rm-grow" />
            <Tooltip label="Edit comment">
              <button className="rm-bubble-del rm-bubble-edit" aria-label="Edit comment" onClick={onEdit}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                </svg>
              </button>
            </Tooltip>
            {/* The same action, named for what the user is actually doing.
                Jarmo, 2026-09-14: a red trash can on a comment the agent has
                just finished reads as "throw this away", when the intent is
                "this is handled". Once a task has completed, clearing the
                comment IS marking it done — Ritemark has always left clearing
                to the user, and the agent never removes a marker itself. Every
                other state keeps Delete, because nothing has been resolved. */}
            {presentation?.state === 'completed' ? (
              <Tooltip label="Mark as done — removes this comment from the document">
                <button
                  className="rm-bubble-del rm-bubble-done"
                  aria-label="Mark as done"
                  onClick={onRemove}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </button>
              </Tooltip>
            ) : (
              <Tooltip label="Delete comment">
                <button className="rm-bubble-del" aria-label="Delete comment" onClick={onRemove}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  </svg>
                </button>
              </Tooltip>
            )}
          </div>

          {/* The user's note stays primary; everything the agent adds stacks
              below it and never rewrites it (R7). */}
          <div className="rm-bubble-text">{renderNoteWithMentions(marker.note)}</div>

          {presentation && (
            <>
              <div className={`rm-task-status rm-task-status--${presentation.tone}`} role="status">
                <span className="rm-task-glyph" aria-hidden="true">{presentation.glyph}</span>
                <span>{presentation.statusLine}</span>
              </div>
              {presentation.destinationLine && (
                <div className="rm-task-dest">{presentation.destinationLine}</div>
              )}
              {presentation.detail && <p className="rm-task-reply">{presentation.detail}</p>}
            </>
          )}

          {sending && (
            <div className="rm-task-status rm-task-status--progress" role="status">
              <span className="rm-task-glyph" aria-hidden="true">◌</span>
              <span>Sending task…</span>
            </div>
          )}

          {rejection && (
            <div className="rm-task-status rm-task-status--error" role="status">
              <span className="rm-task-glyph" aria-hidden="true">!</span>
              <span>{rejection.message}</span>
            </div>
          )}

          {!projection && !sending && alias && destination && (
            <div className="rm-task-dest">
              {destinationCaption(destination.title, { alias, conversationRuntimeId: destination.runtimeId })}
            </div>
          )}

          {(presentation || alias) && (
            <div className="rm-bubble-foot">
              {presentation?.actions.map((action) => (
                <Button
                  key={action.kind}
                  size="sm"
                  variant={action.kind === 'open-conversation' ? 'default' : 'outline'}
                  onClick={() => runAction(action)}
                >
                  {action.label}
                </Button>
              ))}
              {recovery && (
                <Button
                  size="sm"
                  variant={recovery.kind === 'retry' ? 'default' : 'outline'}
                  onClick={() => (recovery.kind === 'retry' ? onSend() : onRecovery(recovery.recovery, alias))}
                >
                  {recovery.label}
                </Button>
              )}
              {!projection && alias && recovery?.kind !== 'retry' && (
                <Button size="sm" onClick={onSend} disabled={sending}>
                  <SendIcon />
                  {sending ? 'Sending…' : `Send to ${ALIAS_LABEL[alias]}`}
                </Button>
              )}
            </div>
          )}
        </div>
        )}
        </>
      )}
    </div>
  )
}

export function MarginCommentRail({
  editor,
  container,
}: {
  editor: TipTapEditor | null
  container: HTMLElement | null
}) {
  const [markers, setMarkers] = useState<RailMarker[]>([])
  const [openKey, setOpenKey] = useState<string | null>(null)
  /**
   * The rail's one open box (#687): a new comment's composer, or a saved comment
   * open for Edit. Explicit state, never "every marker with an empty note": it
   * is set by `startComment` (through the new comment's id), a click on an
   * empty marker, Edit, and the first scan. So when a box closes, another empty
   * comment never opens as a box by itself, and its composer never takes the
   * cursor where the person didn't ask for it.
   */
  const [composeKey, setComposeKey] = useState<string | null>(null)
  /** Whether the open box holds words that aren't saved, as its composer reports it. */
  const boxDirty = useRef(false)
  const boxHandle = useRef<ComposeBoxHandle | null>(null)
  /** The first scan that shows comments has run (see the compose-key effect). */
  const firstShown = useRef(false)
  /**
   * A comment the user CLICKED, rather than merely hovered (Sprint 126 follow-up).
   *
   * Hover alone cannot carry a primary action. The bubble holds "Send to
   * Claude", and reaching it means crossing the gap between the highlight and
   * the rail — where `mouseout`'s relatedTarget is the editor background, not
   * the rail, so the existing guard never fires and the button evaporates as
   * the pointer approaches it. Jarmo hit this in Gate 1, 2026-09-16.
   *
   * Pinning is the reliable path: it survives the pointer leaving entirely, and
   * clicking a highlight is what people try first anyway. Exactly one comment
   * is pinned at a time.
   */
  const [pinnedKey, setPinnedKey] = useState<string | null>(null)
  /** Grace period before a hover-opened bubble closes; cancelled on re-entry. */
  const closeTimer = useRef<number | null>(null)
  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }, [])
  useEffect(() => cancelClose, [cancelClose])
  const [sendStates, setSendStates] = useState<Record<string, SendState>>({})
  const [containerWidth, setContainerWidth] = useState(0)
  const rafRef = useRef<number | null>(null)

  const rescan = useCallback(() => {
    if (!editor || !container) return
    // Coalesce bursts with a 0ms timeout (works in background/headless tabs,
    // unlike rAF which the browser pauses when the tab isn't visible).
    if (rafRef.current) clearTimeout(rafRef.current)
    rafRef.current = window.setTimeout(() => {
      setMarkers(scan(editor, container))
      setContainerWidth(container.clientWidth)
    }, 0)
  }, [editor, container])

  useEffect(() => {
    if (!editor || !container) return
    rescan()
    const on = () => rescan()
    // Positions only change on content edits / scroll / resize — NOT on cursor
    // moves, so we intentionally do not listen to `selectionUpdate` (audit L-C).
    const offDocChanged = onDocChanged(editor, on)
    container.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    const ro = new ResizeObserver(on)
    ro.observe(container)
    return () => {
      offDocChanged()
      container.removeEventListener('scroll', on)
      window.removeEventListener('resize', on)
      ro.disconnect()
      if (rafRef.current) clearTimeout(rafRef.current)
    }
  }, [editor, container, rescan])

  /** A saved comment the door opened latched, to scroll the least it takes into view once. */
  const [revealKey, setRevealKey] = useState<string | null>(null)

  /**
   * Which marker is the box (#687), by `nextRailBox`: a request from the door
   * wins once its marker is there (a new comment's box, or a saved comment
   * opened latched); the first scan opens only the first empty comment; a box
   * whose comment is gone closes; nothing becomes a box by itself.
   */
  useEffect(() => {
    const storage = commentBoxStorage(editor)
    const next = nextRailBox({
      current: composeKey,
      markers,
      request: storage?.openRequest ?? null,
      firstShown: firstShown.current,
    })
    firstShown.current = next.firstShown
    if (next.tookRequest && storage) storage.openRequest = null
    if (next.composeKey !== composeKey) setComposeKey(next.composeKey)
    if (next.latch) {
      cancelClose()
      setOpenKey(next.latch)
      setPinnedKey(next.latch)
      setRevealKey(next.latch)
    }
  }, [editor, markers, composeKey, cancelClose])

  // The door asks to open a saved comment without changing the document, so it
  // wakes the rail itself: a rescan runs the rule above.
  useEffect(() => {
    const storage = commentBoxStorage(editor)
    if (!storage) return
    storage.notifyRail = rescan
    return () => {
      if (storage.notifyRail === rescan) storage.notifyRail = null
    }
  }, [editor, rescan])

  // A box that opens by any path (⌘/ on a keyboard selection too) leaves no
  // other bubble open beside it: a hover-opened one closes, and so does a
  // latched one that isn't the box's own comment.
  useEffect(() => {
    if (!composeKey) return
    setOpenKey((k) => (k === composeKey ? k : null))
    setPinnedKey((k) => (k === composeKey ? k : null))
  }, [composeKey])

  const boxMarker = composeKey ? markers.find((m) => m.key === composeKey) : undefined
  /** A box is open: hover opens nothing, and every other way of opening asks it first (#687). */
  const boxOpen = !!boxMarker

  // Tell the door (`startComment`) which box is open, how dirty it is, and how
  // to bring it forward or close it.
  useEffect(() => {
    const storage = commentBoxStorage(editor)
    if (!storage || !boxMarker) return
    const key = boxMarker.key
    const entry: OpenCommentBox = {
      key,
      commentId: boxMarker.commentId,
      kind: boxMarker.note === '' ? 'new' : 'edit',
      anchor: boxMarker.kind,
      from: boxMarker.from,
      to: boxMarker.to,
      nodePos: boxMarker.nodePos,
      get dirty() {
        return boxDirty.current
      },
      // The least scroll that shows the whole box and the line it is about
      // (experience 11), then the caret at the end of its text.
      bringForward: () => {
        const handle = boxHandle.current
        const box = handle?.box() ?? null
        revealBoxAndLine(container, box, commentLine(boxMarker, box?.closest('.rm-rail-item') ?? null))
        handle?.focusEnd()
      },
      close: () => setComposeKey((k) => (k === key ? null : k)),
    }
    storage.openBox = entry
    return () => {
      if (storage.openBox === entry) storage.openBox = null
    }
  }, [editor, container, boxMarker])

  const onBoxDirtyChange = useCallback((dirty: boolean) => {
    boxDirty.current = dirty
  }, [])
  // A saved comment opened latched: the least scroll that shows its bubble and
  // the line it is about, once.
  const onRevealed = useCallback(
    (item: HTMLElement) => {
      const marker = markers.find((m) => m.key === revealKey)
      setRevealKey(null)
      if (!marker) return
      revealBoxAndLine(container, item.querySelector<HTMLElement>('.rm-bubble') ?? item, commentLine(marker, item))
    },
    [container, markers, revealKey],
  )

  /**
   * Hovering the highlighted text opens that comment, the same way hovering its
   * gutter marker does.
   *
   * Jarmo, 2026-09-14, watching the first smoke test: "when I hover the
   * highlighted text I was expecting that the comment is also popped open."
   * The highlight and the marker are two halves of one object, and reaching for
   * the margin to read a note about the sentence under the cursor is a detour.
   *
   * Delegated from the container rather than bound per fragment, so a
   * multi-block or format-split comment needs no extra bookkeeping and the
   * listeners survive a rescan.
   */
  useEffect(() => {
    if (!container || markers.length === 0) return

    const byElement = new Map<Element, string>()
    for (const marker of markers) byElement.set(marker.el, marker.key)

    const keyFor = (target: EventTarget | null): string | null => {
      if (!(target instanceof Element)) return null
      const anchor = target.closest('mark[data-comment], ritemark-comment')
      if (!anchor) return null
      const direct = byElement.get(anchor)
      if (direct) return direct
      // Only the first fragment of a multi-block comment is a marker; the rest
      // resolve through the id they share (#150).
      const id = anchor.getAttribute('data-comment-id')
      if (!id) return null
      return markers.find((marker) => marker.commentId === id)?.key ?? null
    }

    const onOver = (event: MouseEvent) => {
      // While a box is open (a new comment or an Edit), hovering opens nothing
      // (#687): never cover or steal focus from a note being written.
      if (boxOpen) return
      const key = keyFor(event.target)
      if (key) {
        cancelClose()
        setOpenKey(key)
      }
    }

    // One click on the highlighted text latches the comment open, so the
    // pointer can travel to the bubble without racing a close.
    const onClick = (event: MouseEvent) => {
      const key = keyFor(event.target)
      if (!key) return
      // The open box's own highlight: it is open already.
      if (key === composeKey) return
      // Another comment opens only once the open box gives way (#687): a clean
      // one closes, one with unsaved words comes forward and this one stays shut.
      const empty = markers.find((marker) => marker.key === key)?.note === ''
      // The key comes back moved when closing the box shifted an id-less comment.
      const target = boxOpen && editor ? yieldOpenBox(editor, key) : key
      if (!target) return
      cancelClose()
      setOpenKey(target)
      // An empty comment opens as its box; a saved one latches its bubble open.
      if (empty) {
        setComposeKey(target)
        return
      }
      setPinnedKey((current) => (current === target ? null : target))
    }

    const onOut = (event: MouseEvent) => {
      if (boxOpen) return
      const key = keyFor(event.target)
      if (!key) return
      // A pinned comment ignores the pointer entirely.
      if (pinnedKey === key) return
      // Adjacent case: the pointer went straight into the rail.
      const next = event.relatedTarget
      if (next instanceof Element && next.closest('.rm-comment-rail')) return
      // Otherwise the pointer is crossing the gap between the highlight and the
      // rail, where relatedTarget is the editor background. Closing now is what
      // made the Send button unreachable, so the close waits out a short grace
      // period that entering either surface cancels.
      cancelClose()
      closeTimer.current = window.setTimeout(() => {
        closeTimer.current = null
        setOpenKey((current) => (current === key ? null : current))
      }, HOVER_CLOSE_GRACE_MS)
    }

    container.addEventListener('mouseover', onOver)
    container.addEventListener('mouseout', onOut)
    container.addEventListener('click', onClick)
    return () => {
      container.removeEventListener('mouseover', onOver)
      container.removeEventListener('mouseout', onOut)
      container.removeEventListener('click', onClick)
    }
  }, [container, editor, markers, composeKey, boxOpen, pinnedKey, cancelClose])

  /**
   * A click anywhere that is neither the rail nor a comment highlight releases
   * the latch. Without this the only way out is hitting the same highlight
   * again, which is not where anyone looks.
   */
  useEffect(() => {
    if (!pinnedKey) return
    const onDocClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('.rm-comment-rail')) return
      if (target.closest('mark[data-comment], ritemark-comment')) return
      setPinnedKey(null)
      setOpenKey(null)
    }
    // Capture so a stopPropagation inside the editor cannot strand the latch.
    document.addEventListener('click', onDocClick, true)
    return () => document.removeEventListener('click', onDocClick, true)
  }, [pinnedKey])

  const remove = useCallback(
    (m: RailMarker) => {
      if (!editor) return
      if (m.kind === 'mark') {
        // Clear the mark on EVERY range of the comment: the FULL mark range
        // (audit H-A) for a link-split fragment, and — for a multi-block
        // comment (#150) — every block's range sharing the id.
        const ranges = markerRanges(editor, m)
        if (!ranges.length) return
        let chain = editor.chain().focus()
        for (const r of ranges) chain = chain.setTextSelection(r).unsetMark('commentMark')
        chain.setTextSelection(ranges[ranges.length - 1].to).run()
      } else if (m.nodePos != null) {
        // standalone atom node — delete it whole
        const node = editor.state.doc.nodeAt(m.nodePos)
        editor.chain().focus().deleteRange({ from: m.nodePos, to: m.nodePos + (node?.nodeSize ?? 1) }).run()
      }
      setOpenKey(null)
      setPinnedKey(null)
      rescan()
    },
    [editor, rescan],
  )

  // Save (or cancel) a note into a freshly-created empty comment (mark or node).
  const applyNote = useCallback(
    (m: RailMarker, text: string) => {
      if (!editor) return
      const note = text.trim()
      const alias = note ? detectAgentAlias(note) : null
      if (m.kind === 'mark') {
        // Apply to EVERY range (audit H-A for link splits; #150 for multi-block)
        // so a comment fills/clears all its fragments, not just the first. The
        // shared id is preserved so the fragments stay one comment.
        const ranges = markerRanges(editor, m)
        if (!ranges.length) return
        const last = ranges[ranges.length - 1].to
        let chain = editor.chain().focus()
        if (!note) {
          // empty → discard the placeholder mark, keep the text
          for (const r of ranges) chain = chain.setTextSelection(r).unsetMark('commentMark')
        } else {
          for (const r of ranges) chain = chain.setTextSelection(r).setCommentMark({ id: m.commentId ?? null, note, agentAlias: alias })
        }
        chain.setTextSelection(last).run()
      } else if (m.nodePos != null) {
        if (!note) {
          // empty → remove the placeholder standalone note
          const node = editor.state.doc.nodeAt(m.nodePos)
          editor.chain().focus().deleteRange({ from: m.nodePos, to: m.nodePos + (node?.nodeSize ?? 1) }).run()
        } else {
          editor.chain().focus().setNodeSelection(m.nodePos).updateAttributes('commentNode', { note, agentAlias: alias }).run()
        }
      }
      rescan()
    },
    [editor, rescan],
  )

  const setSendState = useCallback((key: string, state: SendState | null) => {
    setSendStates((current) => {
      const next = { ...current }
      if (state) next[key] = state
      else delete next[key]
      return next
    })
  }, [])

  /**
   * Accept one comment as a task. The id upgrade runs FIRST (D3): a legacy
   * comment without an id is minted one in a single undoable transaction, and
   * only then is the request built from the shared collector — so the payload
   * is the same one the Comments menu would send for the same comment (R2).
   */
  const send = useCallback(
    async (m: RailMarker) => {
      if (!editor) return
      let key = m.key
      setSendState(key, { status: 'pending' })

      const localFailure = (message: string, error?: Partial<CommentTaskError>) =>
        setSendState(key, {
          status: 'rejected',
          error: { code: 'comment-not-found', message, retryable: false, recovery: 'none', ...error },
        })

      let commentId: string | undefined
      try {
        commentId = assignMissingCommentIds(editor, [m.key]).get(m.key)
      } catch {
        localFailure('This comment could not be prepared for sending. Reopen the document and try again.')
        return
      }
      if (!commentId) {
        localFailure('This comment no longer exists in the document.')
        return
      }

      // Minting an id changes the marker's identity (`m:12-30` → `c:<id>`), so
      // the in-flight state and the open bubble move with it.
      const mintedKey = `c:${commentId}`
      if (mintedKey !== key) {
        setSendState(key, null)
        setSendState(mintedKey, { status: 'pending' })
        setOpenKey((current) => (current === key ? mintedKey : current))
        key = mintedKey
      }

      const indexed = collectDocumentComments(editor.state.doc as unknown as MinimalNode).find(
        (comment) => comment.commentId === commentId,
      )
      if (!indexed) {
        localFailure('This comment no longer exists in the document.')
        return
      }
      if (!indexed.alias) {
        localFailure('Assign an agent with @claude, @codex, or @opencode before sending.', {
          code: 'unsupported-alias',
        })
        return
      }

      const outcome = await requestCommentTask('comment-task/accept', {
        batchId: null,
        surface: 'rail',
        alias: indexed.alias,
        // The webview does not know the host's TextDocument.version; the host
        // validates the request by comment id against the live document.
        documentVersion: 0,
        comments: [toRequestComment(indexed)],
      })
      // Success is not announced here: the host's projection is what says the
      // task exists, and it arrives on its own (audit F18).
      setSendState(key, outcome.ok ? null : { status: 'rejected', error: outcome.error })
    },
    [editor, setSendState],
  )

  const onRecovery = useCallback((recovery: CommentTaskError['recovery'], alias: CommentAgentAlias | null) => {
    // Sign-in / settings live on the host side; the editor only asks for them.
    sendToExtension('comment:recover', { recovery, alias })
  }, [])

  const density = railDensity(containerWidth)
  const geometry = railGeometry(containerWidth, density)

  if (!markers.length) return null

  return (
    <div
      className="rm-comment-rail"
      data-density={density}
      style={{ width: geometry.railWidth }}
      aria-hidden={false}
    >
      {markers.map((m) => {
        // One box at a time (#687): only the compose key's marker composes. A
        // saved note is an Edit; an empty one is a new comment's composer.
        const composing = composeKey === m.key
        const editing = composing && m.note !== ''
        return (
          <RailItem
            key={m.key}
            marker={m}
            density={density}
            geometry={geometry}
            open={composing || openKey === m.key || pinnedKey === m.key}
            pinned={pinnedKey === m.key}
            composing={composing}
            sendState={sendStates[m.key]}
            onOpen={() => {
              // Hover and focus open nothing while a box is open (#687).
              if (boxOpen) return
              cancelClose()
              setOpenKey(m.key)
            }}
            onClose={() => {
              // Escape and blur release the latch too — otherwise a pinned
              // bubble could only be dismissed by clicking, and a keyboard
              // user would be stuck with it open.
              setOpenKey((k) => (k === m.key ? null : k))
              setPinnedKey((k) => (k === m.key ? null : k))
            }}
            onTogglePin={() => {
              // A click opens another comment only once the open box gives
              // way (#687); one with unsaved words comes forward instead.
              // The key comes back moved when closing the box shifted an id-less comment.
              const target = boxOpen && editor ? yieldOpenBox(editor, m.key) : m.key
              if (!target) return
              cancelClose()
              setOpenKey(target)
              // An empty comment's marker opens as its box.
              if (m.note === '') {
                setComposeKey(target)
                return
              }
              setPinnedKey((k) => (k === target ? null : target))
            }}
            onEdit={() => {
              const target = boxOpen && editor ? yieldOpenBox(editor, m.key) : m.key
              if (!target) return
              setOpenKey(target)
              setComposeKey(target)
            }}
            onRemove={() => remove(m)}
            onSave={(text) => {
              applyNote(m, text)
              setComposeKey(null)
            }}
            onCancelCompose={() => {
              // Editing an existing note → revert to read; a brand-new
              // empty note → discard it.
              if (!editing) applyNote(m, '')
              setComposeKey(null)
            }}
            onSend={() => void send(m)}
            onRecovery={onRecovery}
            boxHandle={boxHandle}
            onDirtyChange={onBoxDirtyChange}
            reveal={revealKey === m.key}
            onRevealed={onRevealed}
          />
        )
      })}
    </div>
  )
}
