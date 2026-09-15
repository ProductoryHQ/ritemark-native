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
  const markType = editor.schema.marks.commentMark
  if (!markType) return []
  const ranges: { from: number; to: number }[] = []
  editor.state.doc.descendants((node, pos) => {
    if (!node.isInline) return
    if (node.marks.some((mk) => mk.type === markType && mk.attrs.id === id)) {
      ranges.push({ from: pos, to: pos + node.nodeSize })
    }
  })
  return ranges
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

/** Compose bubble — used to create a new comment and to edit an existing one. */
function ComposeBubble({
  initial = '',
  width,
  offset,
  onSave,
  onCancel,
}: {
  initial?: string
  width: number
  offset: number
  onSave: (text: string) => void
  onCancel: () => void
}) {
  const [text, setText] = useState(initial)
  const [caret, setCaret] = useState(initial.length)
  const [activeIndex, setActiveIndex] = useState(0)
  const [dismissedStart, setDismissedStart] = useState<number | null>(null)
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const listId = useId()

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
    <div className="rm-bubble" style={{ width, top: offset }}>
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
  composing,
  sendState,
  onOpen,
  onClose,
  onEdit,
  onRemove,
  onSave,
  onCancelCompose,
  onSend,
  onRecovery,
}: {
  marker: RailMarker
  density: RailDensity
  geometry: { railWidth: number; bubbleWidth: number; bubbleOffset: number }
  open: boolean
  composing: boolean
  sendState: SendState | undefined
  onOpen: () => void
  onClose: () => void
  onEdit: () => void
  onRemove: () => void
  onSave: (text: string) => void
  onCancelCompose: () => void
  onSend: () => void
  onRecovery: (recovery: CommentTaskError['recovery'], alias: CommentAgentAlias | null) => void
}) {
  const projection = useCommentTaskProjection(marker.commentId)
  const alias = detectAgentAlias(marker.note)
  const presentation = projection ? presentCommentTask(projection) : null
  const sending = sendState?.status === 'pending'
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

  return (
    <div
      className="rm-rail-item"
      // Open bubble / compose sits ON TOP of neighbouring markers.
      style={{ top: marker.top, zIndex: open || composing ? 30 : 1 }}
      onMouseEnter={() => !composing && onOpen()}
      onMouseLeave={() => !composing && onClose()}
      onBlur={(e) => {
        if (composing) return
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onClose()
      }}
      onKeyDown={(e) => {
        if (!composing && e.key === 'Escape' && open) {
          e.stopPropagation()
          onClose()
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
        />
      ) : (
        <>
        {/* The marker stays mounted while the bubble is open: below the wide
            breakpoint the bubble is offset downwards, and an unmounted marker
            would leave a gap the pointer falls into, closing what it just
            opened. At `wide` the bubble simply covers it. */}
        <button
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
            <button className="rm-bubble-del rm-bubble-edit" title="Edit comment" aria-label="Edit comment" onClick={onEdit}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
              </svg>
            </button>
            {/* The same action, named for what the user is actually doing.
                Jarmo, 2026-09-14: a red trash can on a comment the agent has
                just finished reads as "throw this away", when the intent is
                "this is handled". Once a task has completed, clearing the
                comment IS marking it done — Ritemark has always left clearing
                to the user, and the agent never removes a marker itself. Every
                other state keeps Delete, because nothing has been resolved. */}
            {presentation?.state === 'completed' ? (
              <button
                className="rm-bubble-del rm-bubble-done"
                title="Mark as done — removes this comment from the document"
                aria-label="Mark as done"
                onClick={onRemove}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </button>
            ) : (
              <button className="rm-bubble-del" title="Delete comment" aria-label="Delete comment" onClick={onRemove}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                </svg>
              </button>
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
  const [editKey, setEditKey] = useState<string | null>(null)
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
    editor.on('update', on)
    container.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    const ro = new ResizeObserver(on)
    ro.observe(container)
    return () => {
      editor.off('update', on)
      container.removeEventListener('scroll', on)
      window.removeEventListener('resize', on)
      ro.disconnect()
      if (rafRef.current) clearTimeout(rafRef.current)
    }
  }, [editor, container, rescan])

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
      // Never steal focus from a note being written or edited.
      if (editKey) return
      const key = keyFor(event.target)
      if (key) setOpenKey(key)
    }

    const onOut = (event: MouseEvent) => {
      if (editKey) return
      const key = keyFor(event.target)
      if (!key) return
      // Moving from the text into the bubble must not close it — otherwise the
      // Send button is unreachable by mouse.
      const next = event.relatedTarget
      if (next instanceof Element && next.closest('.rm-comment-rail')) return
      setOpenKey((current) => (current === key ? null : current))
    }

    container.addEventListener('mouseover', onOver)
    container.addEventListener('mouseout', onOut)
    return () => {
      container.removeEventListener('mouseover', onOver)
      container.removeEventListener('mouseout', onOut)
    }
  }, [container, markers, editKey])

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
        // Compose when the note is empty (freshly created) OR the user chose Edit.
        const editing = editKey === m.key
        const composing = m.note === '' || editing
        return (
          <RailItem
            key={m.key}
            marker={m}
            density={density}
            geometry={geometry}
            open={composing || openKey === m.key}
            composing={composing}
            sendState={sendStates[m.key]}
            onOpen={() => setOpenKey(m.key)}
            onClose={() => setOpenKey((k) => (k === m.key ? null : k))}
            onEdit={() => {
              setOpenKey(m.key)
              setEditKey(m.key)
            }}
            onRemove={() => remove(m)}
            onSave={(text) => {
              applyNote(m, text)
              setEditKey(null)
            }}
            onCancelCompose={() => {
              // Editing an existing note → revert to read; a brand-new
              // empty note → discard it.
              if (editing) setEditKey(null)
              else applyNote(m, '')
            }}
            onSend={() => void send(m)}
            onRecovery={onRecovery}
          />
        )
      })}
    </div>
  )
}
