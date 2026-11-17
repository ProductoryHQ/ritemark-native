/**
 * Experience 46, "Small details that do the right thing", item 8 (Keynote's slide navigator): several pictures dropped
 * on the strip make a Picture slide each, at the drop place, in the files' order. Each slide is titled from its file
 * name, the extension taken off and dashes and underscores turned into spaces; the pictures are copied into `images/`
 * beside the deck (the host's `deck/save-image`, as a pasted or dropped picture is), and the slides go in as one
 * transaction, so one Cmd+Z takes them all back. A single picture dropped on the strip behaves as before: the strip
 * doesn't take it.
 *
 * Pure: the document's side and the drop's reading. The deck view sends the pictures and inserts the slides.
 */
import type { Node as PMNode } from '@tiptap/pm/model'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import { closeHistory } from '@tiptap/pm/history'
import { newId, partHeadingLevel } from '../../../../src/decks/deckFormat'
import { blockSlideBody } from '../../../../src/decks/blocks/convertDeck'
import { legacyDataToBlocks } from '../../../../src/decks/blocks/legacyToBlocks'
import { DECK_OPERATION, slidesOf } from './deckDocument'

/** The strip takes a drop of this many pictures or more; fewer behave as before. */
export const STRIP_PICTURES_MIN = 2

/**
 * A slide's title from a picture's file name: the extension taken off, dashes and underscores turned into spaces, the
 * spaces run together. In NFC, so a name macOS hands over decomposed ("o" and a combining tilde) reads as "õ".
 */
export function pictureTitleOf(fileName: string): string {
  const name = fileName.normalize('NFC').replace(/^.*[\\/]/, '')
  return name.replace(/\.[^.\s]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/** The picture files of a drop, in the order the files came (anything that isn't a picture is left out). */
export function droppedPictures(transfer: Pick<DataTransfer, 'files'> | null): File[] {
  return Array.from(transfer?.files ?? []).filter(file => file.type.startsWith('image/'))
}

/**
 * While a drag is over the strip: how many pictures it carries (the files themselves are read only on the drop, but
 * their kinds and types are known on the way).
 */
export function draggedPictureCount(transfer: Pick<DataTransfer, 'items' | 'types'> | null): number {
  if (!transfer || !Array.from(transfer.types ?? []).includes('Files')) return 0
  return Array.from(transfer.items ?? []).filter(item => item.kind === 'file' && item.type.startsWith('image/')).length
}

/** One picture the host saved: the slide id it was saved for, its title and its path beside the deck. */
export interface SavedPicture {
  id: string
  title: string
  path: string
}

/** `count` new slide ids, none of them one the deck already has, nor each other. */
export function newSlideIds(doc: PMNode, count: number, random: () => number = Math.random): string[] {
  const taken = slidesOf(doc).map(slide => slide.data.id).filter((id): id is string => !!id)
  const ids: string[] = []
  for (let index = 0; index < count; index++) {
    const id = newId([...taken, ...ids], random)
    ids.push(id)
  }
  return ids
}

/** Where a part placed "before part `at`" goes: that part's start, or the document's end. */
function insertPoint(doc: PMNode, at: number): number {
  const slides = slidesOf(doc)
  if (at <= 0 && slides[0]) return slides[0].pos
  return slides[at]?.pos ?? doc.content.size
}

/**
 * The pictures as Picture slides before part `at` (at the end when `at` is the count), in their order: one block slide
 * each, its title and its picture, as an old Picture slide converts (`legacyToBlocks`). Each part has room for its
 * words; in a deck whose handout is a Text document (`handout: text`) it opens with its own heading, the slide's title.
 * One transaction, an undo step of its own. Null with no pictures, or when the slide id is already the deck's.
 */
export function insertPictureSlides(state: EditorState, at: number, pictures: readonly SavedPicture[], textHandout = false): Transaction | null {
  const { schema } = state
  const type = schema.nodes.deckSlide
  if (!type || pictures.length === 0) return null
  const taken = new Set(slidesOf(state.doc).map(slide => slide.data.id))
  if (pictures.some(picture => taken.has(picture.id))) return null
  const nodes: PMNode[] = []
  for (const picture of pictures) {
    const markdown = legacyDataToBlocks('picture', { title: picture.title || undefined, image: picture.path }).markdown
    nodes.push(type.create({ kind: '', body: blockSlideBody({ id: picture.id }, markdown), notes: null }))
    if (textHandout && schema.nodes.heading) {
      nodes.push(schema.nodes.heading.create({ level: partHeadingLevel('') }, picture.title ? schema.text(picture.title) : null))
    }
    nodes.push(schema.nodes.paragraph.create())
  }
  const clamped = Math.max(0, Math.min(at, slidesOf(state.doc).length))
  return closeHistory(state.tr.insert(insertPoint(state.doc, clamped), nodes)).setMeta(DECK_OPERATION, true)
}
