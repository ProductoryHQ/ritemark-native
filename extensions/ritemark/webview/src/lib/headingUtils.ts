import type { Editor } from '@tiptap/react'

export interface Heading {
  level: number
  text: string
  pos: number
  id?: string
}

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
