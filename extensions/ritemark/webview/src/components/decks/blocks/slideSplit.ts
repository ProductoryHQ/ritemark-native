/**
 * Sprint 161 (PR 3; frames 22 and 24): Split slide here, on the deck. The slide editor cuts the slide at the caret
 * (`slideCommands.splitSlideHalves`) and gives its two halves as Markdown; here the deck keeps the first half on the
 * slide and puts the second on a new slide right after the slide's part, with an empty part of its own. One
 * transaction, the strip's kind (`DECK_OPERATION`), so one Undo gives the slide back whole. A deck of today's slides is
 * converted in the same step first, as every first real edit converts it.
 */
import type { EditorState, Transaction } from '@tiptap/pm/state'
import { closeHistory } from '@tiptap/pm/history'
import { isBlockSlide, newId, withBlockMarkdown } from '../../../../../src/decks/deckFormat'
import { blockSlideBody } from '../../../../../src/decks/blocks/convertDeck'
import { DECK_OPERATION, emptyPartHeading, slidesOf } from '../deckDocument'
import { convertDeckInto } from '../handout/deckConvert'

/**
 * Part `index`'s slide split: its Markdown becomes `before`, and a new block slide holding `after` stands after its
 * part. `textHandout`: the deck writes its parts' headings (`handout: text`), so the new part opens with an empty one.
 * Null when there is no such slide.
 */
export function splitSlide(state: EditorState, index: number, before: string, after: string, random: () => number = Math.random, textHandout = false): Transaction | null {
  const entry = slidesOf(state.doc)[index]
  const type = state.schema.nodes.deckSlide
  if (!entry || !type) return null
  // An undo step of its own, never joined to the typing just before it on the same slide (Codex on #769).
  const tr = closeHistory(state.tr)
  convertDeckInto(tr)
  const pos = tr.mapping.map(entry.pos)
  const node = tr.doc.nodeAt(pos)
  if (!node || node.type !== type || !isBlockSlide(node.attrs.kind)) return null
  tr.setNodeMarkup(pos, undefined, { ...node.attrs, body: withBlockMarkdown(node.attrs.body, before) })
  const slides = slidesOf(tr.doc)
  const next = slides[index + 1]
  const end = next ? next.pos : tr.doc.content.size
  const id = newId(slides.map(slide => slide.data.id).filter((value): value is string => !!value), random)
  const slide = type.create({ kind: '', body: blockSlideBody({ id }, after), notes: null })
  const heading = textHandout ? emptyPartHeading(state, '') : null
  tr.insert(end, [slide, ...(heading ? [heading] : []), state.schema.nodes.paragraph.create()])
  return tr.setMeta(DECK_OPERATION, true)
}
