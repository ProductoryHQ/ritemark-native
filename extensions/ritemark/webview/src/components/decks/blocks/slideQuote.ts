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
import { isEmptyLabel } from '../../../../../src/decks/blocks/labelBlock'

const key = new PluginKey<DecorationSet>('slideQuoteBy')

/**
 * What a quote holds that the renderer draws as nothing (`quoteHtml` counts only what draws): an empty line, an empty
 * Label (words of only spaces too, `isEmptyLabel`), a comment note. The parity test holds the two sides together.
 */
function drawsNothing(node: PMNode): boolean {
  if (node.type.name === 'commentNode') return true
  if (node.type.name === 'slideLabel') return isEmptyLabel(node.textContent)
  return node.type.name === 'paragraph' && node.childCount === 0
}

/** A quote's attribution, its paragraph and its offset inside the quote, or null when it has none. */
export function quoteBy(quote: PMNode): { node: PMNode; offset: number } | null {
  const drawn: Array<{ node: PMNode; offset: number }> = []
  quote.forEach((node, offset) => { if (!drawsNothing(node)) drawn.push({ node, offset }) })
  const last = drawn[drawn.length - 1]
  if (drawn.length < 2 || last.node.type.name !== 'paragraph' || !isQuoteByWords(last.node.textContent.trimStart())) return null
  return last
}

/** The attribution of every quote on the slide, in a column, a box or a tab's pane too. */
export function quoteByDecorations(doc: PMNode): DecorationSet {
  const found: Decoration[] = []
  doc.descendants((node, pos) => {
    if (node.type.name !== 'blockquote') return node.isBlock && !node.isTextblock
    const by = quoteBy(node)
    if (by) found.push(Decoration.node(pos + 1 + by.offset, pos + 1 + by.offset + by.node.nodeSize, { class: QUOTE_BY_CLASS }))
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
