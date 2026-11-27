/**
 * One picture editor (experience 49): the image node both editors use, the Text editor's and the slide's.
 *
 *  - Its view draws the picture with its look (`pictureLook.ts`): sized and placed, cropped in its box, with its
 *    caption, exactly as the slide renderer and the published page draw it, so the stage matches its thumbnail.
 *  - On a slide, a picture whose file the host didn't find is drawn as missing, with its file's name (#771).
 *  - A click selects it (ProseMirror's node selection); its ring, handles and crop frame are drawn by
 *    `PictureHandlesLayer`, its bar by `PictureBar`, never the text's bubble menu.
 *  - Crop mode lives in this plugin's state until Done (Enter) or Esc, so the frame being drawn is never an edit.
 *
 * The file is never changed: the old "Resize Image" dialog, which rewrote the picture's file (Sprint 26), is replaced by
 * the size kept beside the image line.
 */
import Image, { type ImageOptions } from '@tiptap/extension-image'
import type { Node as PMNode } from '@tiptap/pm/model'
import { NodeSelection, Plugin, type EditorState } from '@tiptap/pm/state'
import type { Decoration, DecorationSource, EditorView, NodeView } from '@tiptap/pm/view'
import { boxStyle, cropOfRegion, hasFrame, innerStyle, isPlainLook, lookOf, outerStyle, slideFrameStyle, type PictureContext } from '../../../../src/markdown/pictureLook'
import { missingHtml, picturePathOf } from '../../../../src/decks/blocks/slideRenderer'
import { isWebviewResourceUri, sameMarkdownImageFile } from '../../../../src/utils/imagePaths'
import { isRelativeTarget } from '../../../../src/decks/deckLibraryFormat'
import { PICTURE_CROP, cropMeta, cropOf, leavePicture, setPictureLook, type CropState } from './pictureCommands'

export interface PictureNodeOptions {
  context: PictureContext
  /** A draw.io diagram opens its own editor on a double click (Sprint 82). */
  openDiagram?: (relativePath: string) => void
}

/** The path an image node names: its title (where the editor keeps the path), or its source when that is a path. */
export function imagePathOf(attrs: Record<string, unknown>): string | null {
  for (const value of [attrs.title, attrs.src]) {
    if (typeof value !== 'string' || !value.trim()) continue
    const path = picturePathOf(value)
    if (isRelativeTarget(path)) return path
  }
  return null
}

/** Refresh the display URI while keeping the picture's Markdown attributes. */
export function refreshPictureSources(state: EditorState, changedPath: string, displaySrc: string) {
  const tr = state.tr
  state.doc.descendants((node, pos) => {
    if (node.type.name !== 'image') return
    // Only a picture the host mapped shows a webview URI. An unmapped one (its file was missing when the document
    // opened) keeps its written path: giving it a display URI here would make the save write the absolute local
    // path into the document (security review of #1115). It shows after the document is opened again.
    if (!isWebviewResourceUri(String(node.attrs.src ?? '').trim())) return
    const written = node.attrs.mdImageSrc ?? imagePathOf(node.attrs)
    if (typeof written === 'string' && sameMarkdownImageFile(written, changedPath)) {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: displaySrc })
    }
  })
  return tr.docChanged ? tr.setMeta('addToHistory', false) : null
}

const isMissing = (decorations: readonly Decoration[]) => decorations.some(decoration => (decoration.spec as { missing?: boolean }).missing === true)

function setStyle(element: HTMLElement, style: Record<string, string>) {
  for (const [key, value] of Object.entries(style)) element.style.setProperty(key, value)
}

/** Is this picture a draw.io diagram (its own editor opens on a double click)? */
export function isDiagram(attrs: Record<string, unknown>): boolean {
  const title = typeof attrs.title === 'string' ? attrs.title : ''
  const src = typeof attrs.src === 'string' ? attrs.src : ''
  return title.endsWith('.drawio.svg') || src.split('?')[0].endsWith('.drawio.svg')
}

/**
 * The picture's element with its look: the image itself, or its frame (`span.pic`) around the box that crops it and
 * its caption. The same structure as `pictureMarkup`.
 */
export function drawPicture(attributes: Record<string, unknown>, node: PMNode, context: PictureContext): { root: HTMLElement; image: HTMLImageElement } {
  const image = document.createElement('img')
  for (const [name, value] of Object.entries(attributes)) {
    // The title holds the picture's path for the save; it is no tooltip.
    if (name === 'title' || name === 'data-picture') continue
    if (value !== null && value !== undefined && value !== false) image.setAttribute(name, String(value))
  }
  image.draggable = false
  const look = lookOf(node.attrs.picture as string | null)
  if (isPlainLook(look)) return { root: image, image }
  if (!hasFrame(look)) {
    setStyle(image, outerStyle(look))
    return { root: image, image }
  }
  const frame = document.createElement('span')
  frame.className = `pic${context === 'slide' ? ' blk-pic' : ''}${look.caption ? ' has-caption' : ''}`
  setStyle(frame, { display: 'block', ...outerStyle(look), ...(context === 'slide' ? slideFrameStyle(look) : {}) })
  const box = document.createElement('span')
  box.className = 'pic-box'
  setStyle(box, boxStyle(look, context === 'slide'))
  setStyle(image, innerStyle(look, context === 'slide'))
  box.appendChild(image)
  frame.appendChild(box)
  const alt = String(node.attrs.alt ?? '')
  if (look.caption && alt) {
    const caption = document.createElement('span')
    caption.className = 'pic-cap'
    caption.textContent = alt
    frame.appendChild(caption)
  }
  return { root: frame, image }
}

/** The picture's view in either editor. */
class PictureView implements NodeView {
  dom: HTMLElement
  private readonly missing: boolean

  constructor(private node: PMNode, attributes: Record<string, unknown>, decorations: readonly Decoration[], options: PictureNodeOptions) {
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
    const { root, image } = drawPicture(attributes, node, options.context)
    if (options.context === 'document') {
      // A block of its own, so its size is a share of the column and its alignment a side of it.
      const block = document.createElement('div')
      block.className = 'pic-block'
      block.contentEditable = 'false'
      block.appendChild(root)
      this.dom = block
    } else {
      this.dom = root
    }
    if (isDiagram(node.attrs) && options.openDiagram) {
      const path = String(node.attrs.title ?? '')
      image.title = 'Double-click to edit the diagram in a new tab'
      image.classList.add('is-diagram')
      image.addEventListener('dblclick', () => { if (path) options.openDiagram?.(path) })
    }
  }

  update(node: PMNode, decorations: readonly Decoration[], _inner: DecorationSource): boolean {
    // Another picture, another source, look or words, or a picture found (or lost): drawn again.
    if (node.type !== this.node.type || isMissing(decorations) !== this.missing) return false
    for (const key of ['src', 'title', 'alt', 'picture']) if (node.attrs[key] !== this.node.attrs[key]) return false
    this.node = node
    return true
  }

  selectNode() { this.dom.classList.add('ProseMirror-selectednode', 'is-chosen') }
  deselectNode() { this.dom.classList.remove('ProseMirror-selectednode', 'is-chosen') }
  // The handles drawn inside the picture's block are its own: the editor never takes their presses.
  stopEvent(event: Event) { return !!(event.target as Element | null)?.closest?.('.pic-layer') }
  ignoreMutation() { return true }
}

/** Done (Enter) in crop mode: the frame is kept as the picture's crop, as one undo step. */
export function commitCrop(state: EditorState) {
  const crop = cropOf(state)
  if (!crop) return null
  const change = cropOfRegion(crop.region, crop.aspect)
  const tr = setPictureLook(state, crop.pos, { crop: change.crop, zoom: change.zoom, focus: change.focus }) ?? state.tr
  return tr.setMeta(PICTURE_CROP, { crop: null })
}

/** The crop plugin: the frame being drawn, which follows its picture through edits and ends when it is left. */
function cropPlugin() {
  return new Plugin<CropState | null>({
    key: PICTURE_CROP,
    state: {
      init: () => null,
      apply(tr, value) {
        const meta = tr.getMeta(PICTURE_CROP) as { crop: CropState | null } | undefined
        if (meta) return meta.crop
        if (!value) return null
        const pos = tr.mapping.map(value.pos)
        const node = tr.doc.nodeAt(pos)
        if (!node || node.type.name !== 'image') return null
        // A click elsewhere leaves crop mode, as Esc does.
        if (!(tr.selection instanceof NodeSelection) || tr.selection.from !== pos) return null
        return pos === value.pos ? value : { ...value, pos }
      },
    },
    props: {
      attributes: (state): Record<string, string> => (cropOf(state) ? { 'data-cropping': 'true' } : {}),
    },
  })
}

export const PictureImage = Image.extend<PictureNodeOptions & ImageOptions>({
  addOptions() {
    return { ...this.parent?.(), context: 'document' as PictureContext, openDiagram: undefined }
  },

  addNodeView() {
    const options = this.options
    return ({ node, HTMLAttributes, decorations }) => new PictureView(node, HTMLAttributes, decorations, options)
  },

  addProseMirrorPlugins() {
    return [...(this.parent?.() ?? []), cropPlugin()]
  },

  addKeyboardShortcuts() {
    const run = (view: EditorView, make: (state: EditorState) => ReturnType<typeof commitCrop>) => {
      const tr = make(view.state)
      if (!tr) return false
      view.dispatch(tr)
      return true
    }
    return {
      // Done, in crop mode.
      Enter: () => run(this.editor.view, commitCrop),
      // Esc: crop mode ends without a change; a chosen picture is left, the caret after it.
      Escape: () => run(this.editor.view, state => (cropOf(state) ? cropMeta(state, null) : leavePicture(state))),
    }
  },
})
