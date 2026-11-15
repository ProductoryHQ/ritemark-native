/**
 * Sprint 157: the current slide's part head is marked in the handout (its number in the accent colour), as the
 * prototype's `.hpart.cur`. The deck view sets the current slide with `setCurrentSlide`; the mark is a node
 * decoration, so nothing in the document changes.
 */
import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export const deckCurrentKey = new PluginKey<number | null>('deckCurrent')

/** A transaction that makes slide `index` the current one (no document change, never in the undo history). */
export function setCurrentSlide(tr: Transaction, index: number | null): Transaction {
  return tr.setMeta(deckCurrentKey, index).setMeta('addToHistory', false)
}

export function currentSlideOf(state: EditorState): number | null {
  return deckCurrentKey.getState(state) ?? null
}

function decorations(doc: PMNode, current: number | null): DecorationSet {
  if (current === null) return DecorationSet.empty
  let index = -1
  let found: Decoration | null = null
  doc.forEach((node, pos) => {
    if (found || node.type.name !== 'deckSlide') return
    index++
    if (index === current) found = Decoration.node(pos, pos + node.nodeSize, { class: 'is-current' })
  })
  return found ? DecorationSet.create(doc, [found]) : DecorationSet.empty
}

export const DeckCurrent = Extension.create({
  name: 'deckCurrent',

  addProseMirrorPlugins() {
    return [
      new Plugin<number | null>({
        key: deckCurrentKey,
        state: {
          init: () => null,
          apply: (tr, value) => {
            const next = tr.getMeta(deckCurrentKey)
            return next === undefined ? value : next
          },
        },
        props: {
          decorations: state => decorations(state.doc, currentSlideOf(state)),
        },
      }),
    ]
  },
})
