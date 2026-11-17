/**
 * 17 November (Jarmo's deck, after a move): a picture whose file can't be found shows on the slide as missing, with its
 * file's name, instead of silently vanishing. The stage's own picture node and a decoration that marks the missing
 * ones; the stage lays Replace picture… over each (`SlideEditor`), which uses the / menu's file picker.
 *
 * The host says which pictures it looked for and didn't find (`deck/assets`' `missing`), so a picture whose address is
 * still on its way is never called missing.
 */
import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { editorImageOptions } from '../../../utils/editorMarkdown'
import { PictureImage, imagePathOf } from '../../../extensions/pictures/PictureNode'

export { imagePathOf }

/** A transaction with this meta reads the missing pictures again (they changed). */
export const SLIDE_MISSING_PICTURES = new PluginKey('slideMissingPictures')

/** The images on the slide whose files are missing, as node decorations the picture's view reads. */
export function missingDecorations(doc: PMNode, missing: ReadonlySet<string>): DecorationSet {
  if (!missing.size) return DecorationSet.empty
  const found: Decoration[] = []
  doc.descendants((node, pos) => {
    if (node.type.name !== 'image') return
    const path = imagePathOf(node.attrs)
    if (path && missing.has(path)) found.push(Decoration.node(pos, pos + node.nodeSize, {}, { missing: true }))
  })
  return DecorationSet.create(doc, found)
}

/** The decoration that marks missing pictures; `missing()` is read again on each transaction with the meta. */
export function slideMissingPictures(missing: () => ReadonlySet<string>) {
  return Extension.create({
    name: 'slideMissingPictures',
    addProseMirrorPlugins() {
      return [new Plugin<ReadonlySet<string>>({
        key: SLIDE_MISSING_PICTURES,
        state: {
          init: () => missing(),
          apply: (tr, value) => (tr.getMeta(SLIDE_MISSING_PICTURES) ? missing() : value),
        },
        props: {
          decorations(state: EditorState) {
            return missingDecorations(state.doc, SLIDE_MISSING_PICTURES.getState(state) ?? new Set())
          },
        },
      })]
    },
  })
}

/** The stage's image node: the one picture node both editors use (experience 49), drawn for a slide. */
export const SlidePicture = PictureImage.configure({ ...editorImageOptions, context: 'slide' })
