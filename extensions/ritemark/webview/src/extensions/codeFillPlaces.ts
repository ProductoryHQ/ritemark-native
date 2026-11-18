/**
 * Sprint 163 PR 1 (the decks README: "Places to fill in, `[like this]`, are highlighted in the code"): the slide
 * editor and the Text editor mark a code block's places to fill in as the slide renderer does
 * (`codeTools.fillPlaces`, the class `cb-fill`), so the stage, the strip, the wall, the page and a Text document show
 * the same marks. Decorations only: nothing is written to the file.
 */
import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { fillPlaces, marksFillPlaces } from '../../../src/decks/blocks/codeTools'

const key = new PluginKey<DecorationSet>('codeFillPlaces')

/** The marks for every place to fill in in the document's code blocks (in a block whose language is words). */
export function fillPlaceDecorations(doc: PMNode): DecorationSet {
  const decorations: Decoration[] = []
  doc.descendants((node, pos) => {
    if (node.type.name !== 'codeBlock') return true
    if (marksFillPlaces(node.attrs.language as string | null)) {
      for (const place of fillPlaces(node.textContent)) {
        decorations.push(Decoration.inline(pos + 1 + place.from, pos + 1 + place.to, { nodeName: 'mark', class: 'cb-fill' }))
      }
    }
    return false
  })
  return DecorationSet.create(doc, decorations)
}

export const CodeFillPlaces = Extension.create({
  name: 'codeFillPlaces',
  addProseMirrorPlugins() {
    return [new Plugin<DecorationSet>({
      key,
      state: {
        init: (_config, state) => fillPlaceDecorations(state.doc),
        apply: (tr, old) => (tr.docChanged ? fillPlaceDecorations(tr.doc) : old),
      },
      props: {
        decorations: state => key.getState(state),
      },
    })]
  },
})
