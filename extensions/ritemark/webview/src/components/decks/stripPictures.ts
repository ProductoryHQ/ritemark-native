/**
 * Experience 46, "Small details that do the right thing", item 8 (Keynote's slide navigator): several pictures dropped
 * on the strip make a Picture slide each, at the drop place, in the files' order. Each slide is titled from its file
 * name, the extension taken off and dashes and underscores turned into spaces; the pictures are copied into the deck's own folder (the host's `deck/save-image`, as a pasted or dropped picture is), and the slides go in as one
 * transaction, so one Cmd+Z takes them all back. A single picture dropped on the strip behaves as before: the strip
 * doesn't take it.
 *
 * Pure: the document's side and the drop's reading. The deck view sends the pictures and inserts the slides.
 */
import type { Node as PMNode } from '@tiptap/pm/model'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import { closeHistory } from '@tiptap/pm/history'
import { newId } from '../../../../src/decks/deckFormat'
import { blockSlideBody } from '../../../../src/decks/blocks/convertDeck'
import { legacyDataToBlocks } from '../../../../src/decks/blocks/legacyToBlocks'
import { emptyPartHeading, idsOf, insertPoint, operation, slidesOf } from './deckDocument'

/** The strip takes a drop of this many pictures or more; fewer behave as before. */
export const STRIP_PICTURES_MIN = 2

/**
 * A slide's title from a picture's file name: the extension taken off, dashes and underscores turned into spaces, the
 * spaces run together, and its first letter a capital (the Experience lead, 18 November: "team-photo.png" is "Team
 * photo"); the rest stays as the name has it. In NFC, so a name macOS hands over decomposed ("o" and a combining tilde)
 * reads as "õ", which becomes "Õ".
 */
export function pictureTitleOf(fileName: string): string {
  const name = fileName.normalize('NFC').replace(/^.*[\\/]/, '')
  const title = name.replace(/\.[^.\s]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  // The first character whole (a letter outside the BMP is two code units), upper-cased for the person's language.
  const [first = ''] = Array.from(title)
  return first.toLocaleUpperCase() + title.slice(first.length)
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

/**
 * Where a drop's slides go once its pictures are saved: before the slide with id `before` (null: at the end), wherever
 * it stands now, so slides moved or deleted meanwhile don't move the drop place (review of #794). With that slide gone,
 * or no id to find it by (undefined), the place it was dropped at, within the deck.
 */
export function dropPlaceNow(ids: ReadonlyArray<string | undefined>, before: string | null | undefined, at: number): number {
  if (before === null) return ids.length
  const found = before === undefined ? -1 : ids.indexOf(before)
  return found >= 0 ? found : Math.max(0, Math.min(at, ids.length))
}

/** One picture the host saved: the slide id it was saved for, its title and its path beside the deck. */
export interface SavedPicture {
  id: string
  title: string
  path: string
}

/** `count` new slide ids, none of them one the deck already has, one in `pending` (another drop's), nor each other. */
export function newSlideIds(doc: PMNode, count: number, random: () => number = Math.random, pending: Iterable<string> = []): string[] {
  const taken = [...idsOf(doc), ...pending]
  const ids: string[] = []
  for (let index = 0; index < count; index++) {
    const id = newId([...taken, ...ids], random)
    ids.push(id)
  }
  return ids
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
  const taken = new Set(idsOf(state.doc))
  if (pictures.some(picture => taken.has(picture.id))) return null
  const nodes: PMNode[] = []
  for (const picture of pictures) {
    const markdown = legacyDataToBlocks('picture', { title: picture.title || undefined, image: picture.path }).markdown
    nodes.push(type.create({ kind: '', body: blockSlideBody({ id: picture.id }, markdown), notes: null }))
    // The empty heading a new part opens with, the slide's title written in it.
    const heading = textHandout ? emptyPartHeading(state, '') : null
    if (heading) nodes.push(picture.title ? heading.type.create(heading.attrs, schema.text(picture.title)) : heading)
    nodes.push(schema.nodes.paragraph.create())
  }
  const clamped = Math.max(0, Math.min(at, slidesOf(state.doc).length))
  return operation(closeHistory(state.tr.insert(insertPoint(state.doc, clamped), nodes)))
}
