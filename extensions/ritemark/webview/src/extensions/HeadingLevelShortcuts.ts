import { Extension } from '@tiptap/core'
import { setHeadingLevel } from '../lib/headingUtils'
import type { HeadingLevel } from '../lib/headingUtils'

/**
 * Sprint 72 R4/R5: usable global Mod-Alt-1..6 shortcut for heading level.
 *
 * The TipTap StarterKit Heading extension already registers Mod-Alt-1..6,
 * but it does so via `toggleHeading` — which converts a heading at the
 * target level into a paragraph. From the table-of-contents flow that is
 * the wrong mental model: "⌥⌘3 in the menu" should always _set_ the
 * heading to H3, never toggle it back to a paragraph.
 *
 * It also fails the common TOC interaction where the user clicks a TOC row,
 * the click handler runs `scrollToHeading` which puts the cursor at the
 * heading's _start boundary_ (the gap before the heading node opens), and
 * the StarterKit binding then sees no heading at the cursor and acts on the
 * empty paragraph (or does nothing).
 *
 * This extension fixes both:
 *
 * 1. It walks the selection's parent chain to find the nearest heading
 *    ancestor — covers the "cursor inside heading text" case.
 * 2. If no heading ancestor exists, it falls back to the node _at_ the
 *    cursor and the node immediately before it — covers the "cursor at
 *    heading boundary" case that the TOC click flow produces.
 * 3. When it finds a heading it calls `setHeadingLevel`, which does the
 *    change as a single `setNodeMarkup` transaction (one undo step) and
 *    preserves the editor scroll position across the level swap.
 * 4. When there is no heading at/around the cursor at all, the binding
 *    returns `false` so TipTap chains the keypress on to the StarterKit
 *    default behaviour (turn the current paragraph into a heading) instead
 *    of silently swallowing it.
 */
export const HeadingLevelShortcuts = Extension.create({
  name: 'headingLevelShortcuts',

  addKeyboardShortcuts() {
    const levels: HeadingLevel[] = [1, 2, 3, 4, 5, 6]
    const entries = levels.map((level) => {
      const shortcut = `Mod-Alt-${level}` as const
      return [
        shortcut,
        () => {
          const editor = this.editor
          const { state } = editor
          const { $from } = state.selection

          // 1) Walk up the parent chain for the nearest heading ancestor.
          for (let depth = $from.depth; depth >= 0; depth--) {
            const node = $from.node(depth)
            if (node && node.type.name === 'heading') {
              const pos = depth > 0 ? $from.before(depth) : 0
              return setHeadingLevel(editor, pos, level)
            }
          }

          // 2) Boundary case — cursor sits between blocks, with the heading
          //    immediately to the right (this is what TOC click produces).
          const nodeAt = state.doc.nodeAt($from.pos)
          if (nodeAt && nodeAt.type.name === 'heading') {
            return setHeadingLevel(editor, $from.pos, level)
          }

          // 3) Boundary case — heading immediately to the left.
          if ($from.pos > 0) {
            const nodeBefore = state.doc.nodeAt($from.pos - 1)
            if (nodeBefore && nodeBefore.type.name === 'heading') {
              return setHeadingLevel(editor, $from.pos - 1, level)
            }
          }

          // 4) No heading anywhere near the cursor — defer to StarterKit's
          //    default Heading binding (paragraph → heading conversion).
          return false
        },
      ] as const
    })
    return Object.fromEntries(entries)
  },
})
