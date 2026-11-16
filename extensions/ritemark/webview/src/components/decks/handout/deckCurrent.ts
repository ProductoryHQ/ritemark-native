/**
 * Sprint 157: the current slide's part head is marked in the handout (its number in the accent colour), as the
 * prototype's `.hpart.cur`. The deck view sets the current slide with `setCurrentSlide`; the marks are node
 * decorations, so nothing in the document changes.
 *
 * 16 November (the handout is a Text document): the placeholders are marks too. A part's empty heading says "Heading",
 * and the current part's empty text says how to write on: "Write here. *** starts a new slide."
 */
import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { partHeadingAt } from '../deckDocument'

/** The placeholders, as the prototype words them (the Experience lead, 16 November). */
export const HEADING_PLACEHOLDER = 'Heading'
export const PART_PLACEHOLDER = 'Write here. *** starts a new slide.'

export const deckCurrentKey = new PluginKey<number | null>('deckCurrent')

/** A transaction that makes slide `index` the current one (no document change, never in the undo history). */
export function setCurrentSlide(tr: Transaction, index: number | null): Transaction {
  return tr.setMeta(deckCurrentKey, index).setMeta('addToHistory', false)
}

export function currentSlideOf(state: EditorState): number | null {
  return deckCurrentKey.getState(state) ?? null
}

/**
 * The current slide's head (`is-current`); each part's empty heading ("Heading"); and the current part's first empty
 * paragraph when the part has no words yet.
 */
export function deckDecorations(doc: PMNode, current: number | null): DecorationSet {
  const found: Decoration[] = []
  const slides: Array<{ pos: number; size: number }> = []
  doc.forEach((node, pos) => {
    if (node.type.name === 'deckSlide') slides.push({ pos, size: node.nodeSize })
  })
  slides.forEach((slide, index) => {
    if (index === current) found.push(Decoration.node(slide.pos, slide.pos + slide.size, { class: 'is-current' }))
    const heading = partHeadingAt(doc, slide.pos)
    if (heading && heading.node.childCount === 0) {
      found.push(Decoration.node(heading.pos, heading.pos + heading.node.nodeSize, { class: 'deck-empty', 'data-deck-placeholder': HEADING_PLACEHOLDER }))
    }
    if (index !== current) return
    // The part's own words: every block after its heading, up to the next slide. Empty: the first empty paragraph says how.
    const end = index + 1 < slides.length ? slides[index + 1].pos : doc.content.size
    let pos = heading ? heading.pos + heading.node.nodeSize : slide.pos + slide.size
    let first: { pos: number; size: number } | null = null
    while (pos < end) {
      const node = doc.nodeAt(pos)
      if (!node) break
      if (node.type.name !== 'paragraph' || node.childCount > 0) { first = null; break }
      if (!first) first = { pos, size: node.nodeSize }
      pos += node.nodeSize
    }
    if (first) found.push(Decoration.node(first.pos, first.pos + first.size, { class: 'deck-empty', 'data-deck-placeholder': PART_PLACEHOLDER }))
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
          decorations: state => deckDecorations(state.doc, currentSlideOf(state)),
        },
      }),
    ]
  },
})
