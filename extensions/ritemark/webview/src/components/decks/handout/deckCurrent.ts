/**
 * Sprint 157: the current slide's part head is marked in the handout (its number in the accent colour), as the
 * prototype's `.hpart.cur`, and the first slide's head says it holds the deck's title. The deck view sets the
 * current slide with `setCurrentSlide`; the marks are node decorations, so nothing in the document changes.
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

/** The current slide's head (`is-current`) and the first slide's (`is-first`, the deck's title). */
function decorations(doc: PMNode, current: number | null): DecorationSet {
  let index = -1
  const found: Decoration[] = []
  doc.forEach((node, pos) => {
    if (node.type.name !== 'deckSlide') return
    index++
    const classes = [index === 0 ? 'is-first' : '', index === current ? 'is-current' : ''].filter(Boolean).join(' ')
    if (classes) found.push(Decoration.node(pos, pos + node.nodeSize, { class: classes }))
  })
  return found.length ? DecorationSet.create(doc, found) : DecorationSet.empty
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
