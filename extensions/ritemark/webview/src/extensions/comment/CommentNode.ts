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
 */
import { Node, mergeAttributes } from '@tiptap/core'
import type { CommentAgentAlias } from './commentModel'
import { hasCommentTerminator, parseCommentBody } from './commentModel'

export interface CommentNodeAttrs {
  note: string
  agentAlias: CommentAgentAlias | null
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    commentNode: {
      /** Insert an empty standalone note at the cursor (opens compose in the rail). */
      insertCommentNode: () => ReturnType
    }
  }
}

export const CommentNode = Node.create({
  name: 'commentNode',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
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
            attrs: { note: '', agentAlias: null },
          }),
    }
  },

  addKeyboardShortcuts() {
    return {
      // Cmd/Ctrl+/ — comment the selection (anchored) or drop a standalone note.
      'Mod-/': () => {
        const { editor } = this
        const { empty } = editor.state.selection
        if (!empty) {
          return editor.commands.setCommentMark({ note: '', agentAlias: null })
        }
        return editor.commands.insertCommentNode()
      },
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
        const alias = note ? parseCommentBody(note).alias : null
        const start = $from.before()
        const end = $from.after()
        return editor
          .chain()
          .command(({ tr }) => {
            tr.replaceRangeWith(start, end, this.type.create({ note, agentAlias: alias }))
            return true
          })
          .run()
      },
    }
  },
})
