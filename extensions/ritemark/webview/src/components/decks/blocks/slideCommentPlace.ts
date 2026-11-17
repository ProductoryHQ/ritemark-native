/**
 * Sprint 161 (experience 46, "Comments on the slide, for Claude"): where a comment goes in the slide editor's document,
 * and what each one there is on. The notation is the handout's (`blocks/slideComments.ts` on the host side says it in
 * Markdown; this says it in the slide editor's ProseMirror document, which saves to that Markdown):
 *
 *  - on the words: the comment mark, as a selection gets it in the handout (`startComment`);
 *  - on a block: a standalone note (`commentNode`), put right before the block at the slide's top level;
 *  - on the whole slide: a standalone note at the slide's end.
 *
 * Pure over ProseMirror documents and transactions, so the tests drive the same rules the stage uses.
 */
import type { Node as PMNode } from '@tiptap/pm/model'
import { TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state'
import type { SlideAnchor, SlideBlockShape } from '../../../../../src/decks/blocks/slideComments'
import { OPEN_FENCE, parseFenceAttributes, slideBlockClassOf, type SlideBlockClass } from '../../../../../src/decks/blocks/fencedDiv'

/** What a new comment on the slide is on: the words selected, a block (its top-level position), or the whole slide. */
export type SlideTarget = { kind: 'words' } | { kind: 'block'; pos: number } | { kind: 'slide' }

/** The top-level block holding `pos`, as its position; null in an empty document. */
export function topBlockAt(doc: PMNode, pos: number): number | null {
  if (doc.childCount === 0) return null
  const clamped = Math.max(0, Math.min(doc.content.size, pos))
  const $pos = doc.resolve(clamped)
  if ($pos.depth === 0) {
    // Between two top-level blocks: the one after (or the last one at the end).
    const index = Math.min($pos.index(0), doc.childCount - 1)
    let at = 0
    for (let child = 0; child < index; child++) at += doc.child(child).nodeSize
    return at
  }
  return $pos.before(1)
}

const isNote = (node: PMNode | null | undefined) => node?.type.name === 'commentNode'

/**
 * A new, empty standalone note for a block or the whole slide: right before the block at the top level, or at the
 * slide's end. The selection stays where it was (mapped), so the words aren't moved.
 *
 * The block's position is the document's before the transaction: it is mapped through the transaction's own steps
 * (the one-box rule may have removed an empty note before it in the same transaction).
 */
export function placeSlideNote(target: Exclude<SlideTarget, { kind: 'words' }>) {
  return (tr: Transaction, id: string): void => {
    const type = tr.doc.type.schema.nodes.commentNode
    if (!type) return
    const note = type.create({ id, note: '', agentAlias: null })
    if (target.kind === 'block') {
      const pos = tr.mapping.map(target.pos)
      const node = tr.doc.nodeAt(pos)
      const top = tr.doc.resolve(pos)
      if (node && top.depth === 0) {
        tr.insert(pos, note)
        return
      }
    }
    tr.insert(tr.doc.content.size, note)
  }
}

/**
 * Backspace at the start of a block, or Delete at the end of one, next to a note it can't see (the notes are hidden on
 * the stage). Without this the key would take the hidden note, or do nothing.
 *
 *  - Backspace, with notes right before the block and a block before them: the notes move before that block, so the
 *    ordinary Backspace then joins the two blocks, and the comments are on the joined block, as they were on its words.
 *  - Delete, with notes right after the block and a block after them: the notes move before this block, and the
 *    ordinary Delete then joins the two.
 *  - Nothing to join with (the notes start or end the slide or a block): the key does nothing (`'stop'`): a note is
 *    never deleted by a key the person can't see it under.
 *
 * Returns the transaction that moves the notes, `'stop'`, or null when the key is the ordinary one.
 */
export function notesOutOfTheWay(state: EditorState, direction: 'backward' | 'forward'): Transaction | 'stop' | null {
  const { selection } = state
  if (!selection.empty) return null
  const $at = selection.$from
  if (!$at.parent.isTextblock) return null
  if (direction === 'backward' ? $at.parentOffset !== 0 : $at.parentOffset !== $at.parent.content.size) return null
  for (let depth = $at.depth; depth > 0; depth--) {
    const parent = $at.node(depth - 1)
    const index = $at.index(depth - 1)
    const neighbour = direction === 'backward' ? index - 1 : index + 1
    if (neighbour < 0 || neighbour >= parent.childCount) continue
    if (!isNote(parent.child(neighbour))) return null
    const start = $at.before(depth)
    const end = $at.after(depth)
    if (direction === 'backward') {
      let first = neighbour
      while (first > 0 && isNote(parent.child(first - 1))) first--
      if (first === 0) return 'stop'
      let notesFrom = start
      for (let child = first; child < index; child++) notesFrom -= parent.child(child).nodeSize
      const before = notesFrom - parent.child(first - 1).nodeSize
      const notes = state.doc.slice(notesFrom, start).content
      const tr = state.tr.delete(notesFrom, start).insert(before, notes)
      return tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map(selection.from)))
    }
    let last = neighbour
    while (last < parent.childCount - 1 && isNote(parent.child(last + 1))) last++
    if (last === parent.childCount - 1) return 'stop'
    let notesTo = end
    for (let child = neighbour; child <= last; child++) notesTo += parent.child(child).nodeSize
    const notes = state.doc.slice(end, notesTo).content
    const tr = state.tr.delete(end, notesTo).insert(start, notes)
    return tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map(selection.from)))
  }
  return null
}

/** What a note at `notePos` is on: the next block that isn't a note in its parent, or its parent (the slide, a block). */
export function noteTarget(doc: PMNode, notePos: number): { kind: 'block'; pos: number } | { kind: 'slide' } {
  const $note = doc.resolve(notePos)
  const parent = $note.parent
  let pos = notePos
  for (let index = $note.index(); index < parent.childCount; index++) {
    const child = parent.child(index)
    if (!isNote(child)) return { kind: 'block', pos }
    pos += child.nodeSize
  }
  return $note.depth === 0 ? { kind: 'slide' } : { kind: 'block', pos: $note.before() }
}

/** A `:::` block's class (columns, boxes, a box …), read from its opening line as written. */
function divClass(node: PMNode): SlideBlockClass | null {
  const open = OPEN_FENCE.exec(String(node.attrs.open ?? ''))
  const attrs = open ? parseFenceAttributes(open[2]) : null
  return attrs ? slideBlockClassOf(attrs) : null
}

/** Is the heading at `pos` the slide's title: the first H1 at the top level. */
function isTitle(doc: PMNode, pos: number): boolean {
  let first: number | null = null
  doc.forEach((child, offset) => {
    if (first === null && child.type.name === 'heading' && child.attrs.level === 1) first = offset
  })
  return first === pos
}

/** A block of the slide editor's document as a person names it (the host's `blockShapeOf`, from the document). */
export function shapeOfNode(doc: PMNode, pos: number): SlideBlockShape {
  const node = doc.nodeAt(pos)
  if (!node) return { kind: 'block' }
  switch (node.type.name) {
    case 'heading':
      return { kind: node.attrs.level === 1 && isTitle(doc, pos) ? 'title' : 'heading' }
    case 'paragraph':
      return { kind: 'text' }
    case 'image':
      return { kind: 'picture' }
    case 'bulletList':
    case 'orderedList':
    case 'taskList':
      return { kind: 'list' }
    case 'table':
      return { kind: 'table' }
    case 'blockquote':
      return { kind: 'quote' }
    case 'codeBlock':
      return { kind: 'code' }
    case 'horizontalRule':
      return { kind: 'rule' }
    case 'slideDiv': {
      const kind = divClass(node)
      if (kind === 'columns' || kind === 'boxes') {
        let count = 0
        node.forEach(child => { if (child.type.name === 'slideDiv') count++ })
        return { kind, count }
      }
      return { kind: kind ?? 'block' }
    }
    default:
      return { kind: 'text' }
  }
}

/** One comment on the slide, as the stage draws its marker, ring and card. */
export interface SlideMarker {
  /** The rail's marker key: `c:<id>`, or `m:<from>-<to>` / `n:<pos>` for a comment without an id. */
  key: string
  commentId?: string
  note: string
  kind: 'mark' | 'node'
  /** An anchored comment: every range of its words. */
  ranges?: { from: number; to: number }[]
  /** A standalone note: its position. */
  nodePos?: number
  /** What it is on, in the document: its words, a block (its position), or the whole slide. */
  target: { kind: 'words'; from: number; to: number } | { kind: 'block'; pos: number } | { kind: 'slide' }
  /** What it is on, as a person names it (`anchorLine`). */
  anchor: SlideAnchor
}

/** Every comment on the slide, in document order, with what it is on. */
export function slideMarkersOf(doc: PMNode): SlideMarker[] {
  const marks = new Map<string, SlideMarker>()
  const out: SlideMarker[] = []
  doc.descendants((node, pos) => {
    if (isNote(node)) {
      const id = (node.attrs.id as string | null) || undefined
      const target = noteTarget(doc, pos)
      out.push({
        key: id ? `c:${id}` : `n:${pos}`,
        commentId: id,
        note: String(node.attrs.note ?? ''),
        kind: 'node',
        nodePos: pos,
        target,
        anchor: target.kind === 'slide' ? { kind: 'slide' } : { kind: 'block', block: shapeOfNode(doc, target.pos) },
      })
      return false
    }
    if (!node.isText) return
    const mark = node.marks.find(candidate => candidate.type.name === 'commentMark')
    if (!mark) return
    const id = (mark.attrs.id as string | null) || undefined
    const from = pos
    const to = pos + node.nodeSize
    // A comment without an id: the fragments next to each other are one (the rail's positional identity).
    const adjacent = id ? undefined : [...marks.values()].find(marker => !marker.commentId && marker.ranges?.some(range => range.to === from))
    const key = id ? `c:${id}` : adjacent?.key ?? `m:${from}-${to}`
    const existing = marks.get(key)
    if (existing && existing.ranges && existing.target.kind === 'words') {
      existing.ranges.push({ from, to })
      existing.target = { kind: 'words', from: existing.target.from, to }
      if (!id) {
        // The positional key follows the merged range, as the rail's does.
        marks.delete(key)
        existing.key = `m:${existing.ranges[0].from}-${to}`
        marks.set(existing.key, existing)
      }
      return
    }
    const marker: SlideMarker = {
      key,
      commentId: id,
      note: String(mark.attrs.note ?? ''),
      kind: 'mark',
      ranges: [{ from, to }],
      target: { kind: 'words', from, to },
      anchor: { kind: 'words', words: '' },
    }
    marks.set(key, marker)
    out.push(marker)
  })
  for (const marker of out) {
    if (marker.kind !== 'mark' || !marker.ranges) continue
    marker.anchor = { kind: 'words', words: marker.ranges.map(range => doc.textBetween(range.from, range.to, ' ')).join(' ') }
  }
  return out.sort((a, b) => firstPos(a) - firstPos(b))
}

function firstPos(marker: SlideMarker): number {
  return marker.ranges?.[0]?.from ?? marker.nodePos ?? 0
}
