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
 * empty (or containing `-->`) → an empty note the margin rail opens for compose.
 * `Cmd/Ctrl+/` comments the current selection (anchored) or inserts a standalone
 * note at the cursor.
 *
 * #687: one comment box at a time. Every new empty comment comes through one
 * door, `startComment`, which first asks the margin rail (through this
 * extension's storage) which box is open.
 */
import { Node, mergeAttributes, selectionToInsertionEnd, type Editor } from '@tiptap/core'
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
   * The id of a new empty comment whose box opens next. `startComment` sets it;
   * the rail takes it once the comment's marker appears, so which marker is a
   * box is explicit state, never "every comment with an empty note".
   */
  openRequest: string | null
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
 * The one door for every new empty comment (#687): the bubble menu's Comment,
 * and ⌘/ (a selection gets an anchored comment; no selection, a margin note).
 *
 * - No box open: the new comment is made and its box opens.
 * - A clean box open: it closes the way Cancel closes it and the new comment is
 *   made, in ONE transaction, so one undo brings back the old empty comment and
 *   never two boxes. A clean Edit closes in the rail's state only.
 * - A box with words that aren't saved: nothing is made, and the document and
 *   its selection stay as they are. That box comes forward instead.
 *
 * Returns false only when no comment can be made here (the document is then
 * untouched), so ⌘/ falls through as it did before.
 */
export function startComment(editor: Editor): boolean {
  const storage = commentBoxStorage(editor)
  const box = storage?.openBox ?? null
  const decision = decideNewBox(box)
  if (decision === 'bring-forward' && box) {
    box.bringForward()
    return true
  }
  const tr = editor.state.tr
  if (decision === 'replace' && box) removeEmptyComment(tr, box)
  const id = newCommentId()
  addEmptyComment(tr, id)
  if (!hasComment(tr.doc, id)) return false
  if (storage) storage.openRequest = id
  editor.view.dispatch(tr)
  if (decision === 'replace' && box) box.close()
  return true
}

/**
 * The same rule for the rail's own ways of opening another comment: Edit, and a
 * click on a highlight or a marker. Returns true when the caller may open it: no
 * box was open, or a clean one closed (an empty new comment is removed in a
 * transaction of its own, as Cancel removes it). Returns false when the open box
 * holds words that aren't saved: it comes forward instead.
 */
export function yieldOpenBox(editor: Editor): boolean {
  const box = commentBoxStorage(editor)?.openBox ?? null
  const decision = decideNewBox(box)
  if (!box || decision === 'open') return true
  if (decision === 'bring-forward') {
    box.bringForward()
    return false
  }
  const tr = editor.state.tr
  removeEmptyComment(tr, box)
  if (tr.docChanged) editor.view.dispatch(tr)
  box.close()
  return true
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    commentNode: {
      /** Insert an empty standalone note at the cursor (opens compose in the rail). */
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
    return { openBox: null, openRequest: null }
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
      Enter: () => {
        const { editor } = this
        const { $from, empty } = editor.state.selection
        if (!empty) return false
        const parent = $from.parent
        if (!parent.isTextblock || parent.type.name !== 'paragraph') return false
        const m = /^\/\/\/\s?([\s\S]*)$/.exec(parent.textContent)
        if (!m) return false
        // Only lift where replacing the paragraph with a block atom is schema-valid.
        // A list item's first child MUST be a paragraph (`paragraph block*`), so
        // replacing it throws — bail and let normal Enter run (audit H-C).
        const container = $from.node(-1)
        const index = $from.index(-1)
        if (!container || !container.canReplaceWith(index, index + 1, this.type)) {
          return false
        }
        // A `-->` can't be stored → lift to an empty note so the rail's compose
        // bubble surfaces the error rather than saving a broken comment.
        const raw = m[1]
        const note = hasCommentTerminator(raw) ? '' : raw.trim()
        const alias = note ? detectAgentAlias(note) : null
        const start = $from.before()
        const end = $from.after()
        return editor
          .chain()
          .command(({ tr }) => {
            const created = this.type.create({ id: newCommentId(), note, agentAlias: alias })
            tr.replaceRangeWith(start, end, created)
            // Collapse to a text cursor after the note so the atom doesn't stay
            // node-selected (which would raise the formatting toolbar).
            const after = Math.min(start + created.nodeSize, tr.doc.content.size)
            tr.setSelection(TextSelection.near(tr.doc.resolve(after)))
            // An empty lift still opens its box, now as an explicit request
            // (#687), and only while no other box is open.
            const storage = commentBoxStorage(editor)
            if (!note && storage && !storage.openBox) storage.openRequest = created.attrs.id
            return true
          })
          .run()
      },
    }
  },
})
