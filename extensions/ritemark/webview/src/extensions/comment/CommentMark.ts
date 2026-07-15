/**
 * CommentMark — the anchored comment (select text → Comment). A ProseMirror
 * Mark over a text range; the note travels in `data-comment`, the derived agent
 * alias in `data-agent`. Renders `<mark data-comment>` — which `marked` passes
 * through on load and `commentTurndownRules` re-emits on save, so it round-trips.
 *
 * The mark only carries data + the highlight class; the margin marker/bubble is
 * drawn by the MarginCommentRail from the mark's document position.
 */
import { Mark, mergeAttributes } from '@tiptap/core'
import type { CommentAgentAlias } from './commentModel'

export interface CommentMarkAttrs {
  note: string
  agentAlias: CommentAgentAlias | null
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    commentMark: {
      /** Anchor a comment on the current selection. */
      setCommentMark: (attrs: CommentMarkAttrs) => ReturnType
      /** Remove the comment anchoring from the current selection/mark (text stays). */
      unsetCommentMark: () => ReturnType
    }
  }
}

export const CommentMark = Mark.create({
  name: 'commentMark',
  // Default `excludes` (self only) already keeps one comment anchor per range.
  // Do NOT use `excludes: '_'` — that strips bold/italic/link from the anchored
  // text (audit H3). A comment must coexist with formatting.
  inclusive: false,

  addAttributes() {
    return {
      note: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-comment') || '',
        // ProseMirror's DOMSerializer escapes this attribute value for us.
        renderHTML: (attrs) => ({ 'data-comment': attrs.note ?? '' }),
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
    return [{ tag: 'mark[data-comment]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'mark',
      mergeAttributes(HTMLAttributes, { class: 'ritemark-comment-mark' }),
      0,
    ]
  },

  addCommands() {
    return {
      setCommentMark:
        (attrs) =>
        ({ commands }) =>
          commands.setMark(this.name, attrs),
      unsetCommentMark:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    }
  },
})
