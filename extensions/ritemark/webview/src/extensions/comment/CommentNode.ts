/**
 * CommentNode — the standalone `///` note (Sprint 94 #81).
 *
 * A block-level ATOM whose note lives in the `note` attribute (not editable
 * content) — the same "note in an attribute" model as CommentMark, so:
 *  - it is margin-only (no inline editing, hidden by CSS, shown by the rail),
 *  - multi-line bodies survive (an attribute keeps `\n`, no whitespace collapse),
 *  - the `-->` guard is uniform with the anchored path.
 *
 * `/// ` at line start lifts the line into a comment: with text → a saved note,
 * empty → an empty note whose box opens. A line holding `-->` isn't lifted.
 * `Cmd/Ctrl+/` comments the current selection (anchored) or inserts a standalone
 * note at the cursor.
 *
 * #687: one comment box at a time. Every new empty comment comes through one
 * door (`startComment`, and `liftCommentLine` for `///`), which first asks the
 * margin rail (through this extension's storage) which box is open.
 */
import { Node, getMarkRange, mergeAttributes, selectionToInsertionEnd, type Editor } from '@tiptap/core'
import { TextSelection, type Transaction } from '@tiptap/pm/state'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { CommentAgentAlias } from './commentModel'
import { hasCommentTerminator, detectAgentAlias } from './commentModel'
import { newCommentId } from './CommentMark'

export interface CommentNodeAttrs {
  /**
   * Stable comment id (Sprint 117 D3), minted by the same `newCommentId()` the
   * anchored mark uses. Before this, a standalone note had only a positional
   * identity, so dispatching one sent an empty id list and the user got no
   * status at all (audit F08). Persisted in Markdown as the leading
   * `<!-- {id:<id>} body -->` token.
   */
  id: string | null
  note: string
  agentAlias: CommentAgentAlias | null
}

/**
 * The one comment box open in the margin rail (#687). A box is a new comment's
 * composer (an empty comment), or a saved comment open for Edit.
 * `MarginCommentRail` registers it in `editor.storage.commentNode.openBox` and
 * clears it when the box closes or the rail unmounts.
 */
export interface OpenCommentBox {
  /** The rail's marker key: `c:<id>`, or `m:<from>-<to>` / `n:<pos>` for a comment without an id. */
  key: string
  commentId?: string
  /** `new`: an empty comment's composer. `edit`: a saved comment open for Edit. */
  kind: 'new' | 'edit'
  /** Where the comment lives: an anchored mark, or a standalone margin note. */
  anchor: 'mark' | 'node'
  /** A comment without an id is found by position: its mark range, or its note's position. */
  from?: number
  to?: number
  nodePos?: number
  /** Typed text that isn't saved (`composerIsDirty`). */
  readonly dirty: boolean
  /** Scroll the box into view with the least scroll and put the caret at the end of its text. */
  bringForward: () => void
  /**
   * Close the box in the rail's state only, never in the document. For `new`,
   * whoever closes it removes the empty comment itself (`removeEmptyComment`).
   */
  close: () => void
}

/**
 * TipTap 2 keeps an extension's storage on the extension instance, so it is
 * shared by every editor built with `CommentNode`. A webview has one such
 * editor (`Editor.tsx`); `getSchema` users never touch the storage.
 */
export interface CommentNodeStorage {
  /** The open box, or null when none is open (#687). */
  openBox: OpenCommentBox | null
  /**
   * A comment the rail opens next. The door sets it; the rail takes it once
   * the comment's marker is there, so which marker is a box is explicit
   * state, never "every comment with an empty note".
   */
  openRequest: CommentOpenRequest | null
  /**
   * Set by the rail: look at `openRequest` now. The door calls it after
   * asking, since a saved comment's open changes nothing in the document and
   * so would not start a rescan by itself.
   */
  notifyRail: (() => void) | null
  /**
   * Set by the formatting toolbar: hide it, until the next selection change or
   * editor focus. The door calls it when it opens a saved comment latched: the
   * selection and the editor's focus stay, so the toolbar would otherwise stay
   * up and cover the bubble.
   */
  hideToolbar: (() => void) | null
}

/** A comment for the rail to open (#687), by its marker key. */
export interface CommentOpenRequest {
  /** The rail's marker key: `c:<id>`, or `m:<from>-<to>` for an anchored comment without an id. */
  key: string
  /**
   * `box`: a new empty comment's box opens. `latched`: a saved comment opens
   * latched, as a click opens it, scrolled the least it takes into view.
   */
  as: 'box' | 'latched'
}

/** What starting another comment does to the open box (#687, the Experience lead's rule). */
export type NewBoxDecision =
  /** No box is open: the new one opens. */
  | 'open'
  /** The open box is clean: it closes the way Cancel closes it, and the new one opens. */
  | 'replace'
  /** The open box holds words that aren't saved: it comes forward and nothing new opens. */
  | 'bring-forward'

/**
 * Whether a box holds words that aren't saved: its trimmed text differs from
 * its trimmed saved note. An empty new box with only spaces is clean, and so is
 * an Edit whose text is unchanged.
 */
export function composerIsDirty(text: string, savedNote: string): boolean {
  return text.trim() !== savedNote.trim()
}

export function decideNewBox(box: OpenCommentBox | null): NewBoxDecision {
  if (!box) return 'open'
  return box.dirty ? 'bring-forward' : 'replace'
}

/** The comment extension's storage, or undefined when comments are off. */
export function commentBoxStorage(editor: Pick<Editor, 'storage'> | null | undefined): CommentNodeStorage | undefined {
  return editor?.storage?.commentNode as CommentNodeStorage | undefined
}

/**
 * Every inline range carrying the comment mark with this id: a link split, and
 * each block of a multi-block comment (#150), share the one id.
 */
export function commentRangesById(doc: PMNode, id: string): { from: number; to: number }[] {
  const markType = doc.type.schema.marks.commentMark
  if (!markType) return []
  const ranges: { from: number; to: number }[] = []
  doc.descendants((node, pos) => {
    if (!node.isInline) return
    if (node.marks.some((mk) => mk.type === markType && mk.attrs.id === id)) {
      ranges.push({ from: pos, to: pos + node.nodeSize })
    }
  })
  return ranges
}

/** A new box's empty comment mark, range by range: by id, or by its range for a comment without one. */
function emptyMarkRanges(doc: PMNode, box: OpenCommentBox): { from: number; to: number }[] {
  const markType = doc.type.schema.marks.commentMark
  if (!markType) return []
  const ranges = box.commentId
    ? commentRangesById(doc, box.commentId)
    : box.from != null && box.to != null && box.from >= 0 && box.to <= doc.content.size
      ? [{ from: box.from, to: box.to }]
      : []
  // Only the box's own empty comment goes: never a comment that has a note.
  const onlyThisEmptyComment = (r: { from: number; to: number }) => {
    let mine = false
    let other = false
    doc.nodesBetween(r.from, r.to, (node) => {
      if (!node.isInline) return
      const mark = node.marks.find((mk) => mk.type === markType)
      if (!mark) return
      if (mark.attrs.note === '' && (mark.attrs.id ?? undefined) === box.commentId) mine = true
      else other = true
    })
    return mine && !other
  }
  return ranges.filter(onlyThisEmptyComment)
}

/** A new box's empty margin note: by id, or by its position for a note without one. */
function emptyNotePos(doc: PMNode, box: OpenCommentBox): number | null {
  let at: number | null = null
  if (box.commentId) {
    doc.descendants((node, pos) => {
      if (at !== null) return false
      if (node.type.name === 'commentNode' && node.attrs.id === box.commentId) at = pos
    })
  } else if (box.nodePos != null && box.nodePos >= 0 && box.nodePos < doc.content.size) {
    const node = doc.nodeAt(box.nodePos)
    if (node && node.type.name === 'commentNode' && !node.attrs.id) at = box.nodePos
  }
  if (at === null) return null
  return doc.nodeAt(at)?.attrs.note === '' ? at : null
}

/**
 * Add the steps that close a clean new box the way Cancel closes it: its empty
 * comment mark is removed on every range, or its empty margin note is deleted.
 * An Edit has nothing to remove: it closes in the rail's state only.
 */
export function removeEmptyComment(tr: Transaction, box: OpenCommentBox): void {
  if (box.kind !== 'new') return
  if (box.anchor === 'mark') {
    const markType = tr.doc.type.schema.marks.commentMark
    for (const r of emptyMarkRanges(tr.doc, box)) tr.removeMark(r.from, r.to, markType)
    return
  }
  const pos = emptyNotePos(tr.doc, box)
  if (pos === null) return
  const node = tr.doc.nodeAt(pos)
  tr.delete(pos, pos + (node?.nodeSize ?? 1))
}

/** Does the document hold a comment (mark or margin note) with this id? */
function hasComment(doc: PMNode, id: string): boolean {
  let found = false
  doc.descendants((node) => {
    if (found) return false
    if (node.type.name === 'commentNode' && node.attrs.id === id) found = true
    else if (node.marks.some((mk) => mk.type.name === 'commentMark' && mk.attrs.id === id)) found = true
  })
  return found
}

/**
 * Add a new empty comment on the transaction's selection, which ProseMirror has
 * already mapped through the steps in `tr`. A selection gets an anchored mark,
 * as `setCommentMark` gives it. An empty selection gets a margin note, as
 * `insertCommentNode` (`insertContent`) gives it: the note takes an empty
 * paragraph's place, and the cursor goes to the end of what was inserted.
 */
function addEmptyComment(tr: Transaction, id: string): void {
  const schema = tr.doc.type.schema
  const attrs = { id, note: '', agentAlias: null }
  const { selection } = tr
  if (!selection.empty) {
    const mark = schema.marks.commentMark.create(attrs)
    for (const range of selection.ranges) tr.addMark(range.$from.pos, range.$to.pos, mark)
    return
  }
  let { from, to } = selection
  const { parent } = tr.doc.resolve(from)
  if (parent.isTextblock && !parent.type.spec.code && !parent.childCount) {
    from -= 1
    to += 1
  }
  tr.replaceWith(from, to, schema.nodes.commentNode.create(attrs))
  selectionToInsertionEnd(tr, tr.steps.length - 1, -1)
}

/**
 * The first saved comment (a comment mark with a note) that shares at least one
 * character with the transaction's selection, as the rail's marker key. A
 * selection that only meets a highlight at its edge doesn't touch it.
 */
function touchedSavedComment(tr: Transaction): string | null {
  const { doc, selection } = tr
  const markType = doc.type.schema.marks.commentMark
  if (!markType || selection.empty) return null
  let first: { start: number; at: number; id: string | null } | null = null
  for (const range of selection.ranges) {
    const from = range.$from.pos
    const to = range.$to.pos
    doc.nodesBetween(from, to, (node, pos) => {
      if (!node.isInline) return
      if (pos + node.nodeSize <= from || pos >= to) return
      const mark = node.marks.find((mk) => mk.type === markType && mk.attrs.note)
      if (mark && (!first || pos < first.start)) {
        first = { start: pos, at: Math.max(pos, from), id: (mark.attrs.id as string | null) || null }
      }
    })
  }
  if (!first) return null
  // Re-typed: TypeScript can't see the assignment made inside the callback.
  const found: { start: number; at: number; id: string | null } = first
  if (found.id) return `c:${found.id}`
  // A comment without an id: the same full mark range the rail keys it by.
  const range = getMarkRange(doc.resolve(found.at), markType)
  return range ? `m:${range.from}-${range.to}` : null
}

/** Ask the rail to open a comment, send the edit (if any), and close a clean box. */
function finishStart(
  editor: Editor,
  tr: Transaction,
  box: OpenCommentBox | null,
  request: CommentOpenRequest | null,
): void {
  const storage = commentBoxStorage(editor)
  if (storage && request) storage.openRequest = request
  if (tr.docChanged) editor.view.dispatch(tr)
  if (box) box.close()
  // A saved comment opens latched while the selection and the editor's focus
  // stay, so the formatting toolbar would stay up over its bubble: hide it
  // (after the dispatch, so the hide holds for the selection as it now is).
  // A new box needs nothing: its focus and its edit already hide the toolbar.
  if (request?.as === 'latched') storage?.hideToolbar?.()
  if (request) storage?.notifyRail?.()
}

/**
 * The one door for every new empty comment (#687): the bubble menu's Comment,
 * ⌘/ (a selection gets an anchored comment; no selection, a margin note), and
 * Enter on an empty `///` line (`liftCommentLine`).
 *
 * - The one-box rule comes first. A box with words that aren't saved comes
 *   forward, and nothing else happens: no transaction, the selection stays.
 *   A clean box closes the way Cancel closes it (a clean Edit, in the rail's
 *   state only).
 * - A selection that touches a saved comment makes no new comment: the first
 *   such comment in document order opens latched instead (the Experience
 *   lead's choice), and the document's selection stays as it was.
 * - Otherwise the new comment is made and its box opens.
 *
 * Closing an empty box and what follows are ONE transaction, so one undo
 * brings back the old empty comment and never two boxes. Returns false only
 * when no comment can be made here (the document is then untouched), so ⌘/
 * falls through as it did before.
 */
export function startComment(editor: Editor): boolean {
  const box = commentBoxStorage(editor)?.openBox ?? null
  const decision = decideNewBox(box)
  if (decision === 'bring-forward' && box) {
    box.bringForward()
    return true
  }
  const closing = decision === 'replace' ? box : null
  const tr = editor.state.tr
  if (closing) removeEmptyComment(tr, closing)
  const saved = touchedSavedComment(tr)
  if (saved) {
    finishStart(editor, tr, closing, { key: saved, as: 'latched' })
    return true
  }
  const id = newCommentId()
  addEmptyComment(tr, id)
  if (!hasComment(tr.doc, id)) return false
  finishStart(editor, tr, closing, { key: `c:${id}`, as: 'box' })
  return true
}

/**
 * Enter on a `/// …` line lifts it into a standalone margin note. With text,
 * the line becomes a saved note. Empty, it becomes an empty note whose box
 * opens, through the same rule as `startComment` (#687): a clean box closes in
 * the same transaction, and a box with unsaved words comes forward while the
 * line stays as typed. A `-->` can't be stored in a comment, so a line holding
 * one isn't lifted: Enter works normally and the words stay as text.
 *
 * Returns false when it doesn't apply, so normal Enter runs.
 */
export function liftCommentLine(editor: Editor): boolean {
  const { state } = editor
  const { $from, empty } = state.selection
  if (!empty) return false
  const parent = $from.parent
  if (!parent.isTextblock || parent.type.name !== 'paragraph') return false
  const m = /^\/\/\/\s?([\s\S]*)$/.exec(parent.textContent)
  if (!m) return false
  const noteType = state.schema.nodes.commentNode
  // Only lift where replacing the paragraph with a block atom is schema-valid.
  // A list item's first child MUST be a paragraph (`paragraph block*`), so
  // replacing it throws — bail and let normal Enter run (audit H-C).
  const container = $from.node(-1)
  const index = $from.index(-1)
  if (!container || !container.canReplaceWith(index, index + 1, noteType)) return false
  if (hasCommentTerminator(m[1])) return false
  const note = m[1].trim()

  // A saved note opens no box, so only the empty lift asks the open box.
  const box = note ? null : (commentBoxStorage(editor)?.openBox ?? null)
  const decision = decideNewBox(box)
  if (decision === 'bring-forward' && box) {
    box.bringForward()
    return true
  }
  const closing = decision === 'replace' ? box : null
  const tr = state.tr
  if (closing) removeEmptyComment(tr, closing)
  const start = tr.mapping.map($from.before())
  const end = tr.mapping.map($from.after())
  const created = noteType.create({ id: newCommentId(), note, agentAlias: note ? detectAgentAlias(note) : null })
  tr.replaceRangeWith(start, end, created)
  // Collapse to a text cursor after the note so the atom doesn't stay
  // node-selected (which would raise the formatting toolbar).
  const after = Math.min(start + created.nodeSize, tr.doc.content.size)
  tr.setSelection(TextSelection.near(tr.doc.resolve(after)))
  finishStart(editor, tr, closing, note ? null : { key: `c:${created.attrs.id}`, as: 'box' })
  return true
}

/** A rail marker, as far as choosing its box goes. */
export interface ComposeCandidate {
  key: string
  note: string
  /** Document position: an anchored comment's first range, or a margin note's position. */
  from?: number
  nodePos?: number
}

/**
 * The rail's rule for which marker is its one box, after each scan or change
 * (#687). Pure, so it is tested without React.
 *
 * - A request the door made wins once its marker is there: a new comment's box
 *   opens, or a saved comment opens latched (and no box is open).
 * - The first scan that shows comments opens only the first empty one in
 *   document order; the rest stay plain markers that open on a click.
 * - Otherwise the box stays as it is, and closes when its comment is gone. No
 *   empty comment ever becomes a box by itself after a close or an undo.
 */
export function nextRailBox(input: {
  current: string | null
  markers: ComposeCandidate[]
  request: CommentOpenRequest | null
  firstShown: boolean
}): { composeKey: string | null; latch: string | null; tookRequest: boolean; firstShown: boolean } {
  const { current, markers, request } = input
  if (request && markers.some((m) => m.key === request.key)) {
    return request.as === 'box'
      ? { composeKey: request.key, latch: null, tookRequest: true, firstShown: true }
      : { composeKey: null, latch: request.key, tookRequest: true, firstShown: true }
  }
  if (!input.firstShown && markers.length) {
    const docPos = (m: ComposeCandidate) => m.from ?? m.nodePos ?? 0
    const first = markers
      .filter((m) => m.note === '')
      .reduce<ComposeCandidate | null>((a, b) => (!a || docPos(b) < docPos(a) ? b : a), null)
    if (first) return { composeKey: first.key, latch: null, tookRequest: false, firstShown: true }
  }
  const stays = current !== null && markers.some((m) => m.key === current)
  return {
    composeKey: stays ? current : null,
    latch: null,
    tookRequest: false,
    firstShown: input.firstShown || markers.length > 0,
  }
}

/** A vertical span on screen, in CSS px (top edge above bottom edge). */
export interface ScreenSpan {
  top: number
  bottom: number
}

/** How far `block: 'nearest'` would scroll `view` to show `target` (CSSOM): positive scrolls down. */
function nearestDelta(view: ScreenSpan, target: ScreenSpan): number {
  const above = target.top < view.top
  const below = target.bottom > view.bottom
  if (above === below) return 0 // already in view, or it already spans the whole view
  const taller = target.bottom - target.top > view.bottom - view.top
  return (above && !taller) || (below && taller) ? target.top - view.top : target.bottom - view.bottom
}

/**
 * The least scroll that shows a comment's box together with the line it is
 * about (#687; the Experience lead, experience 11): the first line of its
 * highlighted words, or a margin note's marker line. Below the `wide` rail the
 * box opens under its marker, and showing the box alone could leave those
 * words just out of view.
 *
 * When the box and the line fit in the view together, it scrolls as
 * `block: 'nearest'` would on both; when they don't, the box wins. Nothing
 * scrolls when both are in view already. Returns the change to the scroll
 * container's `scrollTop`.
 */
export function leastScrollDelta(view: ScreenSpan, box: ScreenSpan, line: ScreenSpan | null): number {
  const both = line ? { top: Math.min(box.top, line.top), bottom: Math.max(box.bottom, line.bottom) } : box
  const fits = both.bottom - both.top <= view.bottom - view.top
  return nearestDelta(view, fits ? both : box)
}

/**
 * The same rule for the rail's own ways of opening another comment: Edit, and a
 * click on a highlight or a marker. `key` is the marker the caller wants to open.
 * Returns that marker's key once the caller may open it: no box was open, or a
 * clean one closed (an empty new comment is removed in a transaction of its own,
 * as Cancel removes it). Returns null when the open box holds words that aren't
 * saved: it comes forward instead.
 *
 * A comment without an id (written before Sprint 117) is keyed by its position,
 * and removing an empty margin note above it moves that position, so the key
 * comes back mapped through the removal: the rescan finds the comment under it.
 */
export function yieldOpenBox(editor: Editor, key: string): string | null {
  const box = commentBoxStorage(editor)?.openBox ?? null
  const decision = decideNewBox(box)
  if (!box || decision === 'open') return key
  if (decision === 'bring-forward') {
    box.bringForward()
    return null
  }
  const tr = editor.state.tr
  removeEmptyComment(tr, box)
  if (tr.docChanged) editor.view.dispatch(tr)
  box.close()
  return remapMarkerKey(key, tr.mapping)
}

/** A rail marker's key after `mapping`: `c:<id>` stays; `m:<from>-<to>` and `n:<pos>` move with the document. */
export function remapMarkerKey(key: string, mapping: Transaction['mapping']): string {
  const mark = /^m:(\d+)-(\d+)$/.exec(key)
  if (mark) return `m:${mapping.map(Number(mark[1]), 1)}-${mapping.map(Number(mark[2]), -1)}`
  const note = /^n:(\d+)$/.exec(key)
  if (note) return `n:${mapping.map(Number(note[1]), 1)}`
  return key
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    commentNode: {
      /**
       * Insert an empty standalone note at the cursor. No box opens for it:
       * Ritemark's own ways of making a comment go through `startComment` (#687).
       */
      insertCommentNode: () => ReturnType
    }
  }
}

export const CommentNode = Node.create<Record<string, never>, CommentNodeStorage>({
  name: 'commentNode',
  group: 'block',
  atom: true,
  selectable: true,

  addStorage() {
    return { openBox: null, openRequest: null, notifyRail: null, hideToolbar: null }
  },

  addAttributes() {
    return {
      // Mirrors CommentMark's `id` attribute exactly — same carrier attribute
      // name, same "omit when null" render rule, so both comment kinds are
      // identified the same way on load, save, and dispatch.
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-comment-id') || null,
        renderHTML: (attrs) => (attrs.id ? { 'data-comment-id': attrs.id } : {}),
      },
      note: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-note') || '',
        renderHTML: (attrs) => ({ 'data-note': attrs.note ?? '' }),
      },
      agentAlias: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-agent') || null,
        renderHTML: (attrs) =>
          attrs.agentAlias ? { 'data-agent': attrs.agentAlias } : {},
      },
    }
  },

  parseHTML() {
    return [{ tag: 'ritemark-comment' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    // Emit the note as text content too (not just the attribute) so Turndown
    // doesn't treat the element as blank and drop it before the comment rule
    // runs. The rule (and this node) read the `data-note` attribute; the text is
    // hidden by CSS and ignored on parse (this is an atom).
    return ['ritemark-comment', mergeAttributes(HTMLAttributes), node.attrs.note || '']
  },

  addCommands() {
    return {
      insertCommentNode:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            // Mint the id at creation (D3) — a note born without one is a note
            // whose task status cannot survive the next edit.
            attrs: { id: newCommentId(), note: '', agentAlias: null },
          }),
    }
  },

  addKeyboardShortcuts() {
    return {
      // Cmd/Ctrl+/ — comment the selection (anchored) or drop a standalone note,
      // through the one door that keeps one box open at a time (#687).
      'Mod-/': () => startComment(this.editor),
      // Enter on a `/// …` line lifts it into a standalone margin note. Registered
      // here (not a raw ProseMirror plugin) so it wins over StarterKit's default
      // Enter/splitBlock. Returns false when it doesn't apply, so normal Enter
      // still works everywhere else.
      Enter: () => liftCommentLine(this.editor),
    }
  },
})
