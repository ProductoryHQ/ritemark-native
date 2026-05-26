import type { Editor } from '@tiptap/react'

export interface Heading {
  level: number
  text: string
  pos: number
  id?: string
}

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

export function getHeadings(editor: Editor): Heading[] {
  const headings: Heading[] = []
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      headings.push({
        level: node.attrs.level as number,
        text: node.textContent,
        pos,
      })
    }
  })
  return headings
}

export function scrollToHeading(editor: Editor, pos: number): void {
  editor.chain().focus().setTextSelection(pos).run()

  const view = editor.view
  try {
    const coords = view.coordsAtPos(pos)
    const editorScrollContainer = view.dom.closest('.overflow-y-auto')
    if (editorScrollContainer) {
      const containerRect = editorScrollContainer.getBoundingClientRect()
      const scrollTop = editorScrollContainer.scrollTop
      const targetTop = coords.top - containerRect.top + scrollTop - 80 // offset for header
      editorScrollContainer.scrollTo({ top: targetTop, behavior: 'smooth' })
    }
  } catch {
    // Fallback
    const domAtPos = view.domAtPos(pos)
    if (domAtPos.node instanceof HTMLElement) {
      domAtPos.node.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }
}

/**
 * Change the level of a heading node at a known ProseMirror position.
 *
 * Sprint 72 R4/R5: TOC context-menu and Cmd/Ctrl+Alt+1-6 keyboard shortcut
 * pivot through this helper.
 *
 * Guarantees:
 * - Single editor transaction → one undo step (Cmd+Z reverts the level change).
 * - Editor scroll position of the surrounding scroll container is preserved
 *   across the transaction (no jarring jumps when changing a heading far above
 *   the current viewport).
 * - Editor selection is NOT moved — the caller decides whether to focus the
 *   heading after a successful change (TOC rows intentionally keep focus).
 *
 * Returns true if the heading level changed, false if the position does not
 * point at a heading node or the level was already the requested one.
 */
export function setHeadingLevel(
  editor: Editor,
  pos: number,
  level: HeadingLevel
): boolean {
  const node = editor.state.doc.nodeAt(pos)
  if (!node || node.type.name !== 'heading') return false
  if (node.attrs.level === level) return false

  const view = editor.view
  const scrollContainer = view.dom.closest('.overflow-y-auto') as HTMLElement | null
  const savedScrollTop = scrollContainer?.scrollTop ?? null
  const wasEditorFocused = view.hasFocus()

  const headingType = editor.schema.nodes.heading
  if (!headingType) return false

  const tr = view.state.tr.setNodeMarkup(pos, headingType, { ...node.attrs, level })
  view.dispatch(tr)

  // Restore scroll synchronously — setNodeMarkup can shift line metrics when the
  // heading level changes font-size, which would otherwise yank the viewport.
  if (scrollContainer && savedScrollTop !== null) {
    scrollContainer.scrollTop = savedScrollTop
  }

  // Don't steal focus from a TOC row that triggered the change. Only re-focus
  // the editor if it already had focus before the call (e.g. keyboard path
  // initiated from inside the editor itself).
  if (wasEditorFocused) {
    view.focus()
  }

  return true
}
