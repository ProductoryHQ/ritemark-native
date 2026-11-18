/**
 * Pictures with ChatGPT on a slide that isn't shown (Jarmo's test of #800: "Change this picture" was lost when he moved
 * to another slide): the made picture goes into the deck's document itself, on the slide and in the place it was asked
 * for, as the stage would have written it. One transaction, an undo step of its own; null when the place is gone (the
 * slide deleted, the picture replaced by hand meanwhile), and then nothing is written.
 *
 * Pure: the slide's words are loaded and saved with the stage's own schema and Markdown (`SlideDocKit`), so the
 * written slide is the one the stage would have written.
 */
import type { Node as PMNode } from '@tiptap/pm/model'
import { EditorState, type Transaction } from '@tiptap/pm/state'
import { closeHistory } from '@tiptap/pm/history'
import { isBlockSlide, slideDataOf, withBlockMarkdown, writeSlideData, type SlideData } from '../../../../../src/decks/deckFormat'
import { blockDataOf } from '../../../../../src/decks/blocks/convertDeck'
import { sidePictureOf } from '../../../../../src/decks/blocks/slideRenderer'
import { sameRelativeImagePath } from '../../../../../src/utils/imagePaths'
import { imagePathOf } from '../../../extensions/pictures/PictureNode'
import { replacePictureKeepingCaret } from '../../../extensions/pictures/pictureCommands'
import { slidesOf, type DeckSlideEntry } from '../deckDocument'
import { convertDeckInto } from '../handout/deckConvert'

/** A slide by its id, else by its place (as the stage finds its own). */
export interface SlideRef {
  id?: string
  index: number
}

/**
 * The picture a request was for: the slide's own beside or behind (`path` the picture there, '' an empty place), or
 * the `nth` picture in the slide's words with that path (`pictureIdOf`).
 */
export type SlidePictureTarget = { slide: SlideRef; side: true; path: string } | { slide: SlideRef; side: false; path: string; nth: number }

/** The stage's load and save of a slide's words. */
export interface SlideDocKit {
  load: (markdown: string) => PMNode
  save: (doc: PMNode) => string
}

/**
 * What goes into the place: a picture, its description from the one standing there now (its words and path), or (the
 * strip's Undo) the one that stood there before, as it was.
 */
export type SlidePictureChange =
  | { picture: { path: string; url: string; describe: (currentAlt: string, currentPath: string | null) => string } }
  | { restore: { side: Pick<SlideData, 'image' | 'alt' | 'focus'> } | { attrs: Record<string, unknown> } }

/** What stood in the place before: for the strip's Undo when other edits came after the picture. */
export type SlidePictureBefore = { side: Pick<SlideData, 'image' | 'alt' | 'focus'> } | { attrs: Record<string, unknown> }

/** A picture's identity in the words: its path in the project, else the address it is written with. */
export function pictureIdOf(attrs: Record<string, unknown>): string {
  return imagePathOf(attrs) ?? (typeof attrs.src === 'string' ? attrs.src.trim() : '')
}

function samePicture(attrs: Record<string, unknown>, id: string): boolean {
  const own = imagePathOf(attrs)
  return own ? sameRelativeImagePath(own, id) : typeof attrs.src === 'string' && attrs.src.trim() === id
}

/** Which of the pictures with this identity the one at `pos` is, in the words' order (null: no picture there). */
export function pictureNthAt(doc: PMNode, pos: number): { id: string; nth: number } | null {
  const node = doc.nodeAt(pos)
  if (!node || node.type.name !== 'image') return null
  const id = pictureIdOf(node.attrs)
  if (!id) return null
  let nth = 0
  doc.nodesBetween(0, pos, (other, at) => {
    if (at < pos && other.type.name === 'image' && samePicture(other.attrs, id)) nth += 1
  })
  return { id, nth }
}

/** The `nth` picture with this identity in the words, or null. */
export function picturePosOf(doc: PMNode, id: string, nth: number): number | null {
  let found: number | null = null
  let count = 0
  doc.descendants((node, pos) => {
    if (found !== null) return false
    if (node.type.name === 'image' && samePicture(node.attrs, id)) {
      if (count === nth) found = pos
      count += 1
    }
    return true
  })
  return found
}

function slideOf(doc: PMNode, ref: SlideRef): DeckSlideEntry | undefined {
  const slides = slidesOf(doc)
  return (ref.id ? slides.find(entry => entry.data.id === ref.id) : undefined) ?? (ref.id ? undefined : slides[ref.index])
}

const headerOf = (entry: DeckSlideEntry): SlideData => (isBlockSlide(entry.kind) ? entry.data : blockDataOf(entry.kind, entry.data))
const sameSidePath = (a: string | undefined, b: string) => {
  const now = a?.trim() ?? ''
  return now === b || (!!now && !!b && sameRelativeImagePath(now, b))
}

/**
 * The deck's transaction that puts `change` in the target's place, with what stood there before; null when the place
 * is gone (nothing is written then). The deck is converted first when it holds v1 slides, as any write from the stage.
 */
export function putSlidePicture(state: EditorState, target: SlidePictureTarget, change: SlidePictureChange, kit: SlideDocKit): { tr: Transaction; before: SlidePictureBefore; nth: number } | null {
  const entry = slideOf(state.doc, target.slide)
  if (!entry) return null
  const header = headerOf(entry)
  let before: SlidePictureBefore
  let markdown: string | null = null
  let nth = 0
  let sideAlt = ''
  if (target.side) {
    if (!sidePictureOf(header) || !sameSidePath(header.image, target.path)) return null
    before = { side: { image: header.image, alt: header.alt, focus: header.focus } }
    if ('picture' in change) sideAlt = change.picture.describe(header.alt ?? '', header.image?.trim() || null)
  } else {
    const doc = kit.load(header.markdown ?? '')
    const pos = picturePosOf(doc, target.path, target.nth)
    if (pos === null) return null
    const node = doc.nodeAt(pos)!
    before = { attrs: { ...node.attrs } }
    const words = EditorState.create({ doc })
    let tr: Transaction | null
    if ('picture' in change) {
      const alt = change.picture.describe(String(node.attrs.alt ?? ''), imagePathOf(node.attrs))
      tr = replacePictureKeepingCaret(words, pos, { src: change.picture.url, title: change.picture.path }, alt)
    } else if ('attrs' in change.restore) {
      tr = words.tr.setNodeMarkup(pos, undefined, change.restore.attrs)
    } else {
      return null
    }
    if (!tr) return null
    markdown = kit.save(tr.doc)
    const placed = pictureNthAt(tr.doc, pos)
    nth = placed?.nth ?? 0
  }

  const tr = state.tr
  closeHistory(tr)
  convertDeckInto(tr)
  const pos = tr.mapping.map(entry.pos)
  const node = tr.doc.nodeAt(pos)
  if (!node || node.type.name !== 'deckSlide' || !isBlockSlide(node.attrs.kind)) return null
  let body = String(node.attrs.body ?? '')
  if (markdown !== null) {
    body = withBlockMarkdown(body, markdown)
  } else {
    const side = 'picture' in change
      ? { image: change.picture.path, alt: sideAlt || undefined, focus: undefined }
      : 'side' in change.restore ? change.restore.side : null
    if (!side) return null
    body = writeSlideData(node.attrs.kind, body, { ...slideDataOf(node.attrs.kind, body), image: side.image || undefined, alt: side.alt, focus: side.focus })
  }
  if (body === node.attrs.body) return null
  tr.setNodeMarkup(pos, undefined, { ...node.attrs, body })
  return { tr, before, nth }
}
