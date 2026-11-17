/**
 * One picture editor (experience 49): Place on a slide, In text · Left · Right · Behind. One click moves the same
 * picture between the slide's words and its slide-wide place (the header's `picture:` and `image:`), with its
 * description (`alt:`) and, from a crop, its focus point (`focus:`), so nothing of it is lost on the way. A picture
 * moved to a place that already holds one swaps with it: the old one goes into the words where the moved one was.
 *
 * Pure: the slide editor writes what these return (`SlideEditor`), as one undo step in the deck.
 */
import type { Node as PMNode } from '@tiptap/pm/model'
import type { EditorState } from '@tiptap/pm/state'
import type { SlideData } from '../../../../../src/decks/deckFormat'
import { pictureTarget } from '../../../../../src/decks/blocks/legacyToBlocks'
import { lookOf, markdownAlt } from '../../../../../src/markdown/pictureLook'
import { imagePathOf } from '../../../extensions/pictures/PictureNode'
import { removePicture } from '../../../extensions/pictures/pictureCommands'

export type SidePlace = 'left' | 'right' | 'behind'

/** The header keys a side picture carries, all of them, so a change names each one (undefined takes it out). */
export type SideHeader = Pick<SlideData, 'picture' | 'image' | 'alt' | 'focus'>

/** A picture's image line, its description written as the editors' save writes it (`markdownAlt`). */
export function pictureLine(path: string, alt = ''): string {
  return `![${markdownAlt(alt)}](${pictureTarget(path)})`
}

/** The slide's words with a picture line after them, a block of its own. */
export function withPictureLine(markdown: string, line: string): string {
  const words = markdown.replace(/\s+$/, '')
  return words ? `${words}\n\n${line}` : line
}

/**
 * A picture in the words moved to a side place: the document without it (or with the place's old picture where it
 * was), and the header that puts it in the place. Null when the node isn't a picture beside the deck.
 */
export function flowToSide(
  state: EditorState,
  pos: number,
  place: SidePlace,
  current: { image?: string; alt?: string; url?: string },
): { doc: PMNode; header: SideHeader } | null {
  const node = state.doc.nodeAt(pos)
  if (!node || node.type.name !== 'image') return null
  const path = imagePathOf(node.attrs)
  if (!path) return null
  const look = lookOf(node.attrs.picture as string | null)
  // A cropped picture keeps what it showed in view: its focus point is the place's.
  const focus = (look.crop || look.zoom) && look.focus ? `${look.focus.x},${look.focus.y}` : undefined
  const alt = String(node.attrs.alt ?? '').trim()
  const header: SideHeader = { picture: place, image: path, alt: alt || undefined, focus }
  const old = current.image?.trim()
  if (old) {
    // The place's picture comes into the words where this one was.
    const tr = state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: current.url ?? old, title: old, alt: current.alt ?? '', picture: null })
    return { doc: tr.doc, header }
  }
  const tr = removePicture(state, pos)
  return tr ? { doc: tr.doc, header } : null
}

/**
 * The side picture moved into the words (In text): its line at the end of the slide's words, and the header without a
 * place. An empty place (its picture removed) just goes.
 */
export function sideToText(markdown: string, data: SideHeader): { markdown: string | null; header: SideHeader } {
  const header: SideHeader = { picture: undefined, image: undefined, alt: undefined, focus: undefined }
  const path = data.image?.trim()
  if (!path) return { markdown: null, header }
  return { markdown: withPictureLine(markdown, pictureLine(path, data.alt ?? '')), header }
}

/** Remove on the side picture: the place stays, empty ("Paste or drop a picture"); only Picture: None takes it away. */
export const EMPTY_SIDE: SideHeader = { image: undefined, alt: undefined, focus: undefined }
