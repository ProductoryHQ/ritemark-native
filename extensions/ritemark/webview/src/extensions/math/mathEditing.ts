/**
 * Sprint 138 (#481, R4, R5, R7): writing and editing equations in the editor.
 *
 *  - The math nodes with their views (`MathViews.tsx`).
 *  - Enter on a selected equation opens it.
 *  - Backspace or Delete beside an inline equation selects it first; the
 *    next press deletes it.
 *  - Typing the closing `$` of a valid `$…$` (R1's rules) makes an equation.
 *    The typed text and the conversion are separate undo steps, so ⌘Z right
 *    after brings the typed `$…$` back as text.
 *  - `$$` and Enter in an empty paragraph makes an equation block, open.
 *  - Pasted plain text with `$…$` in it makes equations by the same rules.
 */
import { Extension, PasteRule } from '@tiptap/core'
import { closeHistory } from '@tiptap/pm/history'
import { NodeSelection, Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import type { Node as PMNode } from '@tiptap/pm/model'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { MathBlock, MathInline } from './mathNodes'
import { MathBlockView, MathInlineView, OPEN_MATH_META } from './MathViews'
import { isEscapedAt, scanInlineMath, type InlineMathMatch } from './mathSyntax'

export const MathInlineWithView = MathInline.extend({
  addNodeView() {
    return ReactNodeViewRenderer(MathInlineView)
  },
})

export const MathBlockWithView = MathBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(MathBlockView)
  },
})

const MATH_NODES = new Set(['mathInline', 'mathBlock'])

/**
 * Every `$…$` or `$$…$$` in a run of text, scanning left to right as `marked`
 * does. `\(…\)` is left alone: typed or pasted as text, it is text.
 */
export function dollarMathIn(text: string): Array<{ index: number; match: InlineMathMatch }> {
  const found: Array<{ index: number; match: InlineMathMatch }> = []
  let at = text.indexOf('$')
  while (at >= 0) {
    const match = isEscapedAt(text, at) ? null : scanInlineMath(text, at)
    if (match && (match.delimiter === '$' || match.delimiter === '$$')) {
      found.push({ index: at, match })
      at = text.indexOf('$', at + match.raw.length)
    } else {
      at = text.indexOf('$', at + 1)
    }
  }
  return found
}

/** The text right before `pos` in its textblock, back to the nearest node that is not text. */
function textRunBefore(doc: PMNode, pos: number): { text: string; start: number } | null {
  const $pos = doc.resolve(pos)
  const parent = $pos.parent
  if (!parent.isTextblock || parent.type.spec.code) return null
  let text = ''
  let start = $pos.start()
  parent.forEach((child, offset) => {
    const childStart = $pos.start() + offset
    if (childStart >= pos) return
    if (child.isText) {
      if (child.marks.some(mark => mark.type.spec.code)) {
        text = ''
        start = childStart + child.nodeSize
        return
      }
      text += (child.text ?? '').slice(0, pos - childStart)
    } else {
      text = ''
      start = childStart + child.nodeSize
    }
  })
  return { text, start }
}

const mathInputKey = new PluginKey('ritemarkMathInput')

export const MathEditing = Extension.create({
  name: 'mathEditing',
  priority: 1000,

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { selection } = editor.state
        if (selection instanceof NodeSelection && MATH_NODES.has(selection.node.type.name)) {
          editor.view.dispatch(editor.state.tr.setMeta(OPEN_MATH_META, selection.from))
          return true
        }
        // `$$` and Enter in an otherwise empty paragraph: an equation block, open.
        const { $from, empty } = selection
        if (empty && $from.parent.type.name === 'paragraph' && $from.parent.textContent === '$$'
          && $from.parent.childCount === 1 && $from.parentOffset === 2) {
          return editor.chain()
            .command(({ tr }) => {
              tr.delete($from.start(), $from.end())
              return true
            })
            .insertMathBlock()
            .run()
        }
        return false
      },
      Backspace: ({ editor }) => {
        const { selection } = editor.state
        if (!selection.empty) return false
        const before = selection.$from.nodeBefore
        if (before?.type.name !== 'mathInline') return false
        editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, selection.from - before.nodeSize)))
        return true
      },
      Delete: ({ editor }) => {
        const { selection } = editor.state
        if (!selection.empty) return false
        const after = selection.$from.nodeAfter
        if (after?.type.name !== 'mathInline') return false
        editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, selection.from)))
        return true
      },
    }
  },

  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      new Plugin({
        key: mathInputKey,
        props: {
          handleTextInput(view, from, to, text) {
            if (text !== '$' || from !== to) return false
            const mathType = view.state.schema.nodes.mathInline
            if (!mathType || !editor.isEditable) return false
            const run = textRunBefore(view.state.doc, from)
            if (!run) return false
            const candidate = `${run.text}$`
            const last = dollarMathIn(candidate).find(({ index, match }) => index + match.raw.length === candidate.length)
            if (!last || last.match.delimiter !== '$') return false

            // First the dollar as typed, then the equation as its own undo step.
            view.dispatch(view.state.tr.insertText('$', from, to))
            const start = run.start + last.index
            const end = from + 1
            const node = mathType.create({ latex: last.match.latex, delimiter: '$' })
            let tr = closeHistory(view.state.tr).replaceWith(start, end, node)
            tr = tr.setSelection(TextSelection.near(tr.doc.resolve(start + node.nodeSize)))
            view.dispatch(tr)
            return true
          },
        },
      }),
    ]
  },

  addPasteRules() {
    const type = this.editor.schema.nodes.mathInline
    if (!type) return []
    return [
      new PasteRule({
        find: (text: string) => dollarMathIn(text).map(({ index, match }) => ({
          index,
          text: match.raw,
          data: { latex: match.latex, delimiter: match.delimiter },
        })),
        handler: ({ state, range, match }) => {
          const data = (match as { data?: { latex: string; delimiter: string } }).data
          if (!data) return
          state.tr.replaceWith(range.from, range.to, type.create({ latex: data.latex, delimiter: data.delimiter }))
        },
      }),
    ]
  },
})
