/**
 * Sprint 168 PR 1 (#863, the decks README "A quote is a voice, not a box"): on the stage, a quote's attribution carries
 * the class the renderer writes on it (`QUOTE_BY_CLASS`), so slide.css draws it alike on the stage, the strip, the wall,
 * the presenter view and the page, live as it is typed. The attribution is the quote's last paragraph when that opens
 * with "— " or "– " and something is drawn above it in the same quote; a quote of that one line is its words.
 * Decorations only: in the file it is just the quote's last line.
 */
import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { QUOTE_BY_CLASS, isQuoteByWords } from '../../../../../src/decks/blocks/slideRenderer'

const key = new PluginKey<DecorationSet>('slideQuoteBy')

/** What a quote holds that draws nothing (the renderer draws none of it): an empty line, an empty Label, a comment. */
function drawsNothing(node: PMNode): boolean {
  if (node.type.name === 'commentNode') return true
  return (node.type.name === 'paragraph' || node.type.name === 'slideLabel') && node.childCount === 0
}

/** The offset of a quote's attribution inside it, or null when it has none. */
export function quoteByOffset(quote: PMNode): number | null {
  const drawn: Array<{ node: PMNode; offset: number }> = []
  quote.forEach((node, offset) => { if (!drawsNothing(node)) drawn.push({ node, offset }) })
  const last = drawn[drawn.length - 1]
  if (drawn.length < 2 || last.node.type.name !== 'paragraph' || !isQuoteByWords(last.node.textContent)) return null
  return last.offset
}

/** The attribution of every quote on the slide, in a column, a box or a tab's pane too. */
export function quoteByDecorations(doc: PMNode): DecorationSet {
  const found: Decoration[] = []
  doc.descendants((node, pos) => {
    if (node.type.name !== 'blockquote') return node.isBlock && !node.isTextblock
    const offset = quoteByOffset(node)
    const by = offset === null ? null : node.nodeAt(offset)
    if (offset !== null && by) found.push(Decoration.node(pos + 1 + offset, pos + 1 + offset + by.nodeSize, { class: QUOTE_BY_CLASS }))
    return true
  })
  return DecorationSet.create(doc, found)
}

export const SlideQuoteBy = Extension.create({
  name: 'slideQuoteBy',
  addProseMirrorPlugins() {
    return [new Plugin<DecorationSet>({
      key,
      state: {
        init: (_config, state) => quoteByDecorations(state.doc),
        apply: (tr, old) => (tr.docChanged ? quoteByDecorations(tr.doc) : old),
      },
      props: {
        decorations: state => key.getState(state),
      },
    })]
  },
})
