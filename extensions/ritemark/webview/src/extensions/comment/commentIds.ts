/**
 * commentIds — the dispatch-time stable-id upgrade (Sprint 117, R3 / D3).
 *
 * A comment created in Ritemark today is born with an id. A comment written
 * before Sprint 117 — every standalone `<!-- note -->`, and any anchored mark
 * predating #150 — has none, so it can only be identified by position. Position
 * does not survive an edit, which is why those comments used to dispatch with an
 * empty id list and show no status at all (audit F08, F09).
 *
 * The upgrade therefore runs at DISPATCH time, never on open: merely opening an
 * old document must not dirty it. When the user confirms Send, the calling
 * surface asks for ids for exactly the comments it is about to send, and this
 * module writes them in ONE TipTap transaction — one undo step, so a user who
 * changes their mind presses Cmd+Z once and the file is byte-identical again.
 *
 * Duplicates are repaired in the same transaction. Copy-pasting an anchored
 * comment duplicates its `data-comment-id`, and two different notes under one id
 * would make a task ambiguous (which note did the agent get?) — so the LATER
 * occurrence in document order is re-minted. The first keeps the id, because
 * that is the one any existing task is already bound to.
 *
 * Contract: docs/development/releases/v1.11.0/sprint-117-comment-agent-honesty/
 *   research/protocol-and-storage-decisions.md (D3)
 */
import type { Editor } from '@tiptap/core'
import { newCommentId } from './CommentMark'

/**
 * One comment as it exists in the document right now. A multi-block anchored
 * comment is ONE occurrence with several `ranges` (marks cannot span blocks);
 * a standalone note is one occurrence with the atom's own range.
 */
interface CommentOccurrence {
  kind: 'mark' | 'node'
  /** Rail/collector marker key: `c:<id>` | `m:<from>-<to>` | `n:<pos>`. */
  key: string
  id: string | null
  note: string
  /** Every fragment of this comment, in document order. */
  ranges: Array<{ from: number; to: number }>
  /** Attributes to preserve when rewriting the id. */
  attrs: Record<string, unknown>
}

/** Fragment-merge key. Fragments join only when they are the same comment: the
 *  same id AND the same note. Same id + different note is a copy-paste, which
 *  must stay two occurrences so the later one can be re-minted. */
function accumulatorKey(id: string | null, note: string, from: number, to: number): string {
  return id ? `c:${id}\u0000${note}` : `m:${from}-${to}`
}

/** Every comment in the document, in document order of its first fragment. */
function scanOccurrences(doc: Editor['state']['doc']): CommentOccurrence[] {
  const order: CommentOccurrence[] = []
  const markAcc = new Map<string, CommentOccurrence>()

  doc.descendants((node, pos) => {
    if (node.type.name === 'commentNode') {
      const id = (node.attrs.id as string | null) || null
      order.push({
        kind: 'node',
        // The rail identifies a standalone note by position, so that is the key
        // it will ask for; `resolveOccurrence` also accepts `c:<id>`.
        key: `n:${pos}`,
        id,
        note: String(node.attrs.note ?? ''),
        ranges: [{ from: pos, to: pos + node.nodeSize }],
        attrs: { ...node.attrs },
      })
      return
    }
    if (!node.isText) return
    const mark = node.marks.find((m) => m.type.name === 'commentMark')
    if (!mark) return
    const id = (mark.attrs.id as string | null) || null
    const note = String(mark.attrs.note ?? '')
    const from = pos
    const to = pos + node.nodeSize
    // An id-less mark split by formatting (bold, a link) renders as several
    // adjacent text nodes; they are one comment. Same rule the collector uses.
    const adjacent = !id
      ? [...markAcc.values()].find(
          (o) => !o.id && o.note === note && o.ranges.some((r) => r.to === from),
        )
      : undefined
    const accKey = adjacent
      ? accumulatorKey(adjacent.id, adjacent.note, adjacent.ranges[0].from, adjacent.ranges[0].to)
      : accumulatorKey(id, note, from, to)
    const existing = markAcc.get(accKey)
    if (existing) {
      existing.ranges.push({ from, to })
      return
    }
    const occurrence: CommentOccurrence = {
      kind: 'mark',
      key: id ? `c:${id}` : `m:${from}-${to}`,
      id,
      note,
      ranges: [{ from, to }],
      attrs: { ...mark.attrs },
    }
    markAcc.set(accKey, occurrence)
    order.push(occurrence)
  })

  return order
}

/**
 * Find the comment a requested marker key refers to. The rail and the collector
 * spell an id-less anchored comment slightly differently — the rail uses the FULL
 * mark range from `getMarkRange`, the collector the first fragment's range — so an
 * `m:` key is matched by range OVERLAP rather than equality.
 */
function resolveOccurrence(
  occurrences: CommentOccurrence[],
  key: string,
): CommentOccurrence | undefined {
  const exact = occurrences.find((o) => o.key === key)
  if (exact) return exact
  if (key.startsWith('c:')) {
    const id = key.slice(2)
    return occurrences.find((o) => o.id === id)
  }
  if (key.startsWith('n:')) {
    const pos = Number(key.slice(2))
    return Number.isFinite(pos)
      ? occurrences.find((o) => o.kind === 'node' && o.ranges[0].from === pos)
      : undefined
  }
  if (key.startsWith('m:')) {
    const m = /^m:(-?\d+)-(-?\d+)$/.exec(key)
    if (!m) return undefined
    const from = Number(m[1])
    const to = Number(m[2])
    return occurrences.find(
      (o) => o.kind === 'mark' && o.ranges.some((r) => r.from < to && r.to > from),
    )
  }
  return undefined
}

/**
 * Give every requested comment a stable id, in one undoable transaction.
 *
 * @param editor the TipTap editor holding the document being dispatched
 * @param keys   rail/collector marker keys (`c:<id>` | `m:<from>-<to>` | `n:<pos>`)
 * @returns marker key → comment id, for every requested key that resolves to a
 *          comment in the document. A key that resolves to nothing is OMITTED —
 *          the caller must treat a missing entry as "comment not found" and not
 *          dispatch it, rather than inventing an id for a comment that is gone.
 */
export function assignMissingCommentIds(editor: Editor, keys: string[]): Map<string, string> {
  const result = new Map<string, string>()
  const { state } = editor
  const markType = state.schema.marks.commentMark
  const occurrences = scanOccurrences(state.doc)

  // Plan first, mutate once. `pending` holds the new id for each occurrence that
  // needs one, so the transaction below is a single pass with no re-scanning.
  const pending = new Map<CommentOccurrence, string>()
  const idOf = (o: CommentOccurrence): string | null => pending.get(o) ?? o.id

  // 1. Duplicate repair. Walk in document order; the first occurrence of an id
  //    keeps it, every later one is re-minted. This runs over the whole document,
  //    not just the requested comments: a duplicate left behind would still be
  //    ambiguous the next time it is sent, and the host rejects it anyway
  //    (`duplicate-comment-id`).
  const seen = new Set<string>()
  for (const occurrence of occurrences) {
    if (!occurrence.id) continue
    if (seen.has(occurrence.id)) {
      pending.set(occurrence, newCommentId())
    } else {
      seen.add(occurrence.id)
    }
  }

  // 2. Mint for requested comments that have no id at all.
  for (const key of keys) {
    if (result.has(key)) continue
    const occurrence = resolveOccurrence(occurrences, key)
    if (!occurrence) continue
    if (!idOf(occurrence)) pending.set(occurrence, newCommentId())
    result.set(key, idOf(occurrence) as string)
  }

  if (pending.size === 0) return result

  // 3. One transaction → one undo step. Marks and attributes do not change the
  //    document size, so the positions captured during the scan stay valid for
  //    every step below.
  const tr = state.tr
  tr.setMeta('addToHistory', true)
  for (const [occurrence, id] of pending) {
    if (occurrence.kind === 'node') {
      const pos = occurrence.ranges[0].from
      const node = tr.doc.nodeAt(pos)
      if (!node || node.type.name !== 'commentNode') continue
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, id })
      continue
    }
    if (!markType) continue
    // Re-apply the mark carrying the new id over every fragment. `addMark`
    // replaces a mark of the same type (commentMark excludes itself), so the
    // note, alias, and any surrounding formatting are untouched.
    for (const range of occurrence.ranges) {
      tr.addMark(range.from, range.to, markType.create({ ...occurrence.attrs, id }))
    }
  }
  if (tr.steps.length > 0) editor.view.dispatch(tr)

  return result
}
