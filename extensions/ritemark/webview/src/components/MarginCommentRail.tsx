/**
 * MarginCommentRail — the right-margin comment layer (Sprint 94 #81).
 *
 * Reads the live ProseMirror DOM for anchored comments (`mark[data-comment]`)
 * and standalone notes (`ritemark-comment`), and renders a marker per comment in
 * a gutter aligned to the comment's vertical position — the margin model from
 * `ui-mock.html`. Hovering a marker opens the note; the trash icon removes it.
 *
 * DOM-scan positioning (rather than ProseMirror decorations) keeps the rail
 * decoupled from the schema and re-aligns on every editor update / scroll /
 * resize.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { getMarkRange } from '@tiptap/core'
import type { Editor as TipTapEditor } from '@tiptap/react'
import {
  parseCommentBody,
  hasCommentTerminator,
  ALIAS_TO_AGENT_ID,
  type CommentAgentAlias,
} from '../extensions/comment/commentModel'
import { sendToExtension } from '../bridge'

interface RailMarker {
  key: string
  top: number
  note: string
  agent: string | null
  kind: 'mark' | 'node'
  el: HTMLElement
  /** Anchored mark: the FULL document range of the comment (mark). */
  from?: number
  to?: number
  /** Standalone note: the document position of the atom node. */
  nodePos?: number
}

const MARKER_MIN_GAP = 8
const MARKER_HEIGHT = 30

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
    const agent = el.getAttribute('data-agent')

    // Identity is POSITIONAL, not text-based (audit H-A/H-B): a comment split
    // across formatting renders as several <mark> fragments that share ONE mark
    // range → one marker; two distinct comments with identical text keep their
    // own ranges/positions → separate markers.
    let identity: string
    let from: number | undefined
    let to: number | undefined
    let nodePos: number | undefined
    if (isMark) {
      const range = commentMarkRange(editor, el)
      if (!range) return
      from = range.from
      to = range.to
      identity = `m:${from}-${to}`
    } else {
      const np = commentNodePos(editor, el)
      if (np == null) return
      nodePos = np
      identity = `n:${np}`
    }
    if (seen.has(identity)) return
    seen.add(identity)

    const r = el.getBoundingClientRect()
    list.push({
      key: identity,
      top: r.top - cRect.top + container.scrollTop,
      note,
      agent,
      kind: isMark ? 'mark' : 'node',
      el,
      from,
      to,
      nodePos,
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

/** Compose bubble — used to create a new comment and to edit an existing one. */
function ComposeBubble({
  initial = '',
  onSave,
  onCancel,
}: {
  initial?: string
  onSave: (text: string) => void
  onCancel: () => void
}) {
  const [text, setText] = useState(initial)
  const ref = useRef<HTMLTextAreaElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    // Place the cursor at the end when editing existing text.
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])
  // H1: a literal `-->` cannot be stored inside an HTML comment — reject at input.
  const terminator = hasCommentTerminator(text)
  const save = () => {
    if (terminator) return
    onSave(text)
  }
  return (
    <div className="rm-bubble">
      <div className="rm-bubble-head">
        <span className="rm-bubble-who">Comment</span>
      </div>
      <textarea
        ref={ref}
        className="rm-compose-input"
        rows={2}
        placeholder="Comment, or @claude to assign"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            save()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            onCancel()
          }
        }}
      />
      {terminator && <div className="rm-compose-err">A comment can’t contain “--&gt;”.</div>}
      <div className="rm-compose-foot">
        <button className="rm-btn-ghost" onMouseDown={(e) => e.preventDefault()} onClick={onCancel}>
          Cancel
        </button>
        <button className="rm-btn-primary" onMouseDown={(e) => e.preventDefault()} onClick={save} disabled={terminator}>
          Comment
        </button>
      </div>
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
  const [sentKey, setSentKey] = useState<string | null>(null)
  const [editKey, setEditKey] = useState<string | null>(null)
  const rafRef = useRef<number | null>(null)

  const rescan = useCallback(() => {
    if (!editor || !container) return
    // Coalesce bursts with a 0ms timeout (works in background/headless tabs,
    // unlike rAF which the browser pauses when the tab isn't visible).
    if (rafRef.current) clearTimeout(rafRef.current)
    rafRef.current = window.setTimeout(() => setMarkers(scan(editor, container)), 0)
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

  const remove = useCallback(
    (m: RailMarker) => {
      if (!editor) return
      if (m.kind === 'mark') {
        // Use the FULL mark range (audit H-A) — a comment split across a link
        // renders as several <mark> fragments; the range covers them all.
        if (m.from == null || m.to == null) return
        editor
          .chain()
          .focus()
          .setTextSelection({ from: m.from, to: m.to })
          .unsetMark('commentMark')
          .setTextSelection(m.to)
          .run()
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
      const alias = note ? parseCommentBody(note).alias : null
      if (m.kind === 'mark') {
        // Full mark range (audit H-A) so a link-spanning comment fills/clears
        // all its fragments, not just the first.
        if (m.from == null || m.to == null) return
        const { from, to } = m
        if (!note) {
          // empty → discard the placeholder mark, keep the text
          editor.chain().focus().setTextSelection({ from, to }).unsetMark('commentMark').setTextSelection(to).run()
        } else {
          editor.chain().focus().setTextSelection({ from, to }).setCommentMark({ note, agentAlias: alias }).setTextSelection(to).run()
        }
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

  // Hand an agent-assigned comment to the AI sidebar (Gate B relay).
  const sendToAI = useCallback(
    (m: RailMarker) => {
      if (!editor || !m.agent) return
      const agentId = ALIAS_TO_AGENT_ID[m.agent as CommentAgentAlias]
      if (!agentId) return
      const instruction = parseCommentBody(m.note).text || m.note
      let prompt = instruction
      if (m.kind === 'mark' && m.from != null && m.to != null) {
        const anchored = editor.state.doc.textBetween(m.from, m.to, ' ')
        if (anchored) {
          prompt = `${instruction}\n\n---\nThis comment refers to the following text:\n"${anchored}"`
        }
      }
      sendToExtension('comment:send-to-ai', { agentId, prompt })
      setSentKey(m.key)
      window.setTimeout(() => setSentKey((k) => (k === m.key ? null : k)), 2500)
    },
    [editor],
  )

  if (!markers.length) return null

  return (
    <div className="rm-comment-rail" aria-hidden={false}>
      {markers.map((m) => {
        // Compose when the note is empty (freshly created) OR the user chose Edit.
        const editing = editKey === m.key
        const composing = m.note === '' || editing
        const open = composing || openKey === m.key
        const assigned = !!m.agent
        const preview = m.note.length > 24 ? m.note.slice(0, 24) + '…' : m.note
        return (
          <div
            key={m.key}
            className="rm-rail-item"
            // Open bubble / compose sits ON TOP of neighbouring markers.
            style={{ top: m.top, zIndex: open ? 30 : 1 }}
            onMouseEnter={() => !composing && setOpenKey(m.key)}
            onMouseLeave={() => !composing && setOpenKey((k) => (k === m.key ? null : k))}
          >
            {composing ? (
              <ComposeBubble
                initial={m.note}
                onSave={(text) => {
                  applyNote(m, text)
                  setEditKey(null)
                }}
                onCancel={() => {
                  // Editing an existing note → revert to read; a brand-new
                  // empty note → discard it.
                  if (editing) setEditKey(null)
                  else applyNote(m, '')
                }}
              />
            ) : open ? (
              <div className="rm-bubble">
                <div className="rm-bubble-head">
                  {assigned && <span className="rm-agent-badge">{m.agent}</span>}
                  <span className="rm-bubble-who">{assigned ? '' : 'Comment'}</span>
                  <span className="rm-grow" />
                  <button
                    className="rm-bubble-del rm-bubble-edit"
                    title="Edit comment"
                    onClick={() => {
                      setOpenKey(m.key)
                      setEditKey(m.key)
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                    </svg>
                  </button>
                  <button
                    className="rm-bubble-del"
                    title="Delete comment"
                    onClick={() => remove(m)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    </svg>
                  </button>
                </div>
                <div className="rm-bubble-text">{m.note}</div>
                {assigned && (
                  <div className="rm-bubble-foot">
                    <button
                      className="rm-btn-primary rm-send"
                      onClick={() => sendToAI(m)}
                      disabled={sentKey === m.key}
                    >
                      {sentKey === m.key ? (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                          Sent
                        </>
                      ) : (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>
                          Send to AI
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button className="rm-marker" onClick={() => setOpenKey(m.key)}>
                <span className="rm-marker-ico"><CommentIcon /></span>
                <span className="rm-marker-txt">{preview}</span>
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
