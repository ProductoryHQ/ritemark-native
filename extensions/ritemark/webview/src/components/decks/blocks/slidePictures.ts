/**
 * 17 November (Jarmo's deck, after a move): a picture whose file can't be found shows on the slide as missing, with its
 * file's name, instead of silently vanishing. The stage's own picture node and a decoration that marks the missing
 * ones; the stage lays Replace picture… over each (`SlideEditor`), which uses the / menu's file picker.
 *
 * The host says which pictures it looked for and didn't find (`deck/assets`' `missing`), so a picture whose address is
 * still on its way is never called missing.
 */
import Image from '@tiptap/extension-image'
import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type DecorationSource, type NodeView } from '@tiptap/pm/view'
import { missingHtml, picturePathOf } from '../../../../../src/decks/blocks/slideRenderer'
import { isRelativeTarget } from '../../../../../src/decks/deckLibraryFormat'
import { editorImageOptions } from '../../../utils/editorMarkdown'

/** A transaction with this meta reads the missing pictures again (they changed). */
export const SLIDE_MISSING_PICTURES = new PluginKey('slideMissingPictures')

/** The path an image node names: its title (where the editor keeps the path), or its source when that is a path. */
export function imagePathOf(attrs: Record<string, unknown>): string | null {
  for (const value of [attrs.title, attrs.src]) {
    if (typeof value !== 'string' || !value.trim()) continue
    const path = picturePathOf(value)
    if (isRelativeTarget(path)) return path
  }
  return null
}

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

const isMissing = (decorations: readonly Decoration[]) => decorations.some(decoration => (decoration.spec as { missing?: boolean }).missing === true)

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

/** A picture on the stage: the image, or its missing place with the file's name (as the renderer draws it). */
class SlidePictureView implements NodeView {
  dom: HTMLElement
  private readonly missing: boolean

  constructor(private node: PMNode, attributes: Record<string, unknown>, decorations: readonly Decoration[]) {
    this.missing = isMissing(decorations)
    const path = imagePathOf(node.attrs)
    if (this.missing && path) {
      const place = document.createElement('span')
      place.className = 'blk-pic empty is-missing'
      place.contentEditable = 'false'
      place.setAttribute('data-picture', path)
      place.innerHTML = missingHtml(path)
      this.dom = place
      return
    }
    const image = document.createElement('img')
    for (const [name, value] of Object.entries(attributes)) {
      if (value !== null && value !== undefined && value !== false) image.setAttribute(name, String(value))
    }
    this.dom = image
  }

  update(node: PMNode, decorations: readonly Decoration[], _inner: DecorationSource): boolean {
    // Another picture, another source or a picture found (or lost): drawn again.
    if (node.type !== this.node.type || isMissing(decorations) !== this.missing) return false
    if (node.attrs.src !== this.node.attrs.src || node.attrs.title !== this.node.attrs.title || node.attrs.alt !== this.node.attrs.alt) return false
    this.node = node
    return true
  }

  selectNode() { this.dom.classList.add('ProseMirror-selectednode') }
  deselectNode() { this.dom.classList.remove('ProseMirror-selectednode') }
  ignoreMutation() { return true }
}

/** The stage's image node: the editor's own, drawn by `SlidePictureView`. */
export const SlidePicture = Image.extend({
  addNodeView() {
    return ({ node, HTMLAttributes, decorations }) => new SlidePictureView(node, HTMLAttributes, decorations)
  },
}).configure(editorImageOptions)
