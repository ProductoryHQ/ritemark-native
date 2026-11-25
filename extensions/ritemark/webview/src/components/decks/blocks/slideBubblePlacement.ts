import type { Editor } from '@tiptap/core'
import type { Props } from 'tippy.js'

export function slideBubblePopperOptions(stage: HTMLElement): Props['popperOptions'] {
  return {
    strategy: 'fixed',
    modifiers: [
      { name: 'flip', options: { boundary: stage, fallbackPlacements: ['bottom-start'], altAxis: false } },
      { name: 'preventOverflow', options: { boundary: stage, tether: false, altAxis: true } },
      { name: 'computeStyles', options: { adaptive: false, roundOffsets: false } },
    ],
  }
}

export function slideBubbleReference(editor: Editor): NonNullable<Props['getReferenceClientRect']> {
  const { view } = editor
  return Object.assign(() => {
    const { from, to } = view.state.selection
    const start = view.domAtPos(from, 1)
    const end = view.domAtPos(to, -1)
    const range = view.dom.ownerDocument.createRange()
    range.setStart(start.node, start.offset)
    range.setEnd(end.node, end.offset)
    // Range geometry already includes the canvas transform. The popper is in the unscaled app root.
    return range.getBoundingClientRect()
  }, { contextElement: view.dom })
}
