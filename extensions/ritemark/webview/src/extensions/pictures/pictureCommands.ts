/**
 * One picture editor (experience 49): what the picture's bar, its handles and its keys do, as ProseMirror
 * transactions. The same commands for the Text editor and the slide editor; each is one undo step of its own (the
 * document editor's history, or the deck's through the slide's `SLIDE_COMMAND`).
 *
 * A picture's file is never changed: size, alignment, crop and caption go into the image node's `picture` attribute
 * (its attribute block, `pictureLook.ts`), its description into `alt`, and Remove takes the node away, never the file.
 */
import type { Node as PMNode } from '@tiptap/pm/model'
import { NodeSelection, PluginKey, Selection, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state'
import { GapCursor } from '@tiptap/pm/gapcursor'
import { closeHistory } from '@tiptap/pm/history'
import { lookOf, withLook, type PictureLook, type Region } from '../../../../src/markdown/pictureLook'
// The slide editor's "an undo step of its own" meta, set by every command (harmless in the document editor).
import { SLIDE_COMMAND } from '../../components/decks/blocks/slideCommands'

/**
 * The `picture-editor` flag (the kill switch), as the host sent it with the document. Off, a picture has no ring,
 * handles or bar (`PictureTools` draws nothing); its look is still read, drawn and written back as it was.
 */
let pictureEditorOn = true

export function setPictureEditorEnabled(enabled: boolean): void {
  pictureEditorOn = enabled
}

export function pictureEditorEnabled(): boolean {
  return pictureEditorOn
}

export interface ChosenPicture {
  pos: number
  node: PMNode
}

/** The picture the selection holds (a click on a picture selects it whole), or null. */
export function chosenPicture(state: EditorState): ChosenPicture | null {
  const selection = state.selection
  if (!(selection instanceof NodeSelection) || selection.node.type.name !== 'image') return null
  return { pos: selection.from, node: selection.node }
}

/**
 * The chosen picture a drop lands on: only when the drop's target is inside the chosen picture's own element, so a
 * picture dropped elsewhere is inserted there and never replaces the chosen one (Codex on #774). A paste has no place:
 * it replaces the chosen picture.
 */
export function chosenPictureUnder(view: { state: EditorState; nodeDOM: (pos: number) => globalThis.Node | null }, target: EventTarget | null): ChosenPicture | null {
  const chosen = chosenPicture(view.state)
  if (!chosen) return null
  const dom = view.nodeDOM(chosen.pos)
  return dom && target instanceof globalThis.Node && dom.contains(target) ? chosen : null
}

/** Is the selection a picture? The text's bubble menu never shows over one (experience 49). */
export function isPictureSelection(selection: EditorState['selection']): boolean {
  return selection instanceof NodeSelection && selection.node.type.name === 'image'
}

function ownStep(tr: Transaction): Transaction {
  closeHistory(tr)
  tr.setMeta(SLIDE_COMMAND, true)
  return tr
}

function pictureAt(state: EditorState, pos: number): PMNode | null {
  const node = state.doc.nodeAt(pos)
  return node && node.type.name === 'image' ? node : null
}

/** The look with `change` laid over it; a key set to undefined goes. */
export function changedLook(look: PictureLook, change: Partial<PictureLook>): PictureLook {
  const next: PictureLook = { ...look }
  for (const [key, value] of Object.entries(change) as [keyof PictureLook, PictureLook[keyof PictureLook]][]) {
    if (value === undefined) delete next[key]
    else (next as Record<string, unknown>)[key] = value
  }
  return next
}

/** Set part of a picture's look (size, alignment, crop, caption). Null when nothing would change. */
export function setPictureLook(state: EditorState, pos: number, change: Partial<PictureLook>): Transaction | null {
  const node = pictureAt(state, pos)
  if (!node) return null
  const written = (node.attrs.picture as string | null) ?? ''
  const block = withLook(written, changedLook(lookOf(written), change))
  if (block === written) return null
  const tr = state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, picture: block || null })
  tr.setSelection(NodeSelection.create(tr.doc, pos))
  return ownStep(tr)
}

/** The picture's description (its `alt`): what a screen reader and a published page read, and its caption. */
export function setPictureAlt(state: EditorState, pos: number, alt: string): Transaction | null {
  const node = pictureAt(state, pos)
  const words = alt.replace(/[\r\n]+/g, ' ')
  if (!node || (node.attrs.alt ?? '') === words) return null
  const tr = state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, alt: words })
  tr.setSelection(NodeSelection.create(tr.doc, pos))
  return ownStep(tr)
}

/** The Description's Done: the words and whether they show as a caption, together, as one undo step. */
export function setPictureWords(state: EditorState, pos: number, alt: string, caption: boolean): Transaction | null {
  const node = pictureAt(state, pos)
  if (!node) return null
  const words = alt.replace(/[\r\n]+/g, ' ')
  const written = (node.attrs.picture as string | null) ?? ''
  const block = withLook(written, changedLook(lookOf(written), { caption: caption || undefined }))
  if ((node.attrs.alt ?? '') === words && block === written) return null
  const tr = state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, alt: words, picture: block || null })
  tr.setSelection(NodeSelection.create(tr.doc, pos))
  return ownStep(tr)
}

/** Remove the picture from the document (its file stays where it is); the caret goes where it was. */
export function removePicture(state: EditorState, pos: number): Transaction | null {
  const node = pictureAt(state, pos)
  if (!node) return null
  const tr = state.tr.delete(pos, pos + node.nodeSize)
  tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(pos, tr.doc.content.size))))
  return ownStep(tr)
}

/** A new source has no Markdown spelling inherited from the previous picture. */
export const newPictureSpelling = {
  mdImageLabel: null,
  mdImageTarget: null,
  mdImageSrc: null,
  mdImageAlt: null,
  mdImageTitle: null,
}

/**
 * Another picture in this one's place (Replace picture…, a double click, or a paste or drop onto it): its size and
 * alignment stay; its crop, focus point and description (with its caption) start fresh, since they were the old
 * picture's. One undo step brings the old picture back with all of them.
 */
export function replacePicture(state: EditorState, pos: number, picture: { src: string; title: string }): Transaction | null {
  const node = pictureAt(state, pos)
  if (!node) return null
  const written = (node.attrs.picture as string | null) ?? ''
  const block = withLook(written, changedLook(lookOf(written), { crop: undefined, zoom: undefined, focus: undefined, caption: undefined }))
  const tr = state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...newPictureSpelling, src: picture.src, title: picture.title, alt: '', picture: block || null })
  tr.setSelection(NodeSelection.create(tr.doc, pos))
  return ownStep(tr)
}

/**
 * Pictures with ChatGPT: a picture that comes back while the person works elsewhere takes its place as `replacePicture`
 * does, but the caret stays where it is (the AI never moves what the person works on): the new picture is chosen
 * only when the old one still was. Otherwise the next key typed would replace the chosen picture.
 */
export function replacePictureKeepingCaret(state: EditorState, pos: number, picture: { src: string; title: string }, alt?: string): Transaction | null {
  const tr = replacePicture(state, pos, picture)
  if (!tr) return null
  // The made picture's description (#800), in the same step.
  const placed = tr.doc.nodeAt(pos)
  if (alt !== undefined && placed) tr.setNodeMarkup(pos, undefined, { ...placed.attrs, alt: alt.replace(/[\r\n]+/g, ' ') })
  const before = state.selection
  if (!(before instanceof NodeSelection && before.from === pos)) tr.setSelection(before.map(tr.doc, tr.mapping))
  return tr
}

/**
 * Comment on a picture in a document: the caret just before the picture's top-level block, where the margin note goes
 * (`startComment` places a note only at a caret). With no words before it (the document's first block) the caret is a
 * gap cursor there (review of #774).
 */
export function caretBeforePicture(state: EditorState, pos: number): { tr: Transaction; top: number } {
  const { doc } = state
  const $pos = doc.resolve(pos)
  const top = $pos.depth === 0 ? pos : $pos.before(1)
  const near = Selection.near(doc.resolve(top), -1)
  return { tr: state.tr.setSelection(near.empty ? near : new GapCursor(doc.resolve(top))), top }
}

/** Esc on a chosen picture: the caret right after it, so typing goes on there. */
export function leavePicture(state: EditorState): Transaction | null {
  const chosen = chosenPicture(state)
  if (!chosen) return null
  const after = chosen.pos + chosen.node.nodeSize
  // A picture with no words after it (the last block) is left for a gap cursor after it, never chosen again.
  const near = TextSelection.near(state.doc.resolve(after), 1)
  return state.tr.setSelection(near.empty ? near : new GapCursor(state.doc.resolve(after)))
}

// ---------------------------------------------------------------------------
// Crop mode: a frame over the picture, kept outside the document until Done
// ---------------------------------------------------------------------------

export interface CropState {
  /** The picture being cropped. */
  pos: number
  /** The picture's own shape, width over height. */
  aspect: number
  /** The frame as it is being drawn. */
  region: Region
  /** The shape chosen (a preset's ratio, `null` for Original), or undefined for a free frame. */
  ratio: string | null | undefined
}

export const PICTURE_CROP = new PluginKey<CropState | null>('pictureCrop')

/** The crop being drawn, if any. */
export function cropOf(state: EditorState): CropState | null {
  return PICTURE_CROP.getState(state) ?? null
}

/** A transaction that starts, changes or ends crop mode (no change to the document, nothing to undo). */
export function cropMeta(state: EditorState, crop: CropState | null): Transaction {
  return state.tr.setMeta(PICTURE_CROP, { crop }).setMeta('addToHistory', false)
}
