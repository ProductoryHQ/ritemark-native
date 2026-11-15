/**
 * Sprint 157: the deck as the editor's document holds it. The strip and the stage are drawn from the editor's own
 * document: its slide nodes, in order. A part is a slide node and the blocks after it up to the next slide node;
 * blocks before the first slide are the preamble, kept as written.
 */
import type { Node as PMNode } from '@tiptap/pm/model'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import { newId, parseSlideBody, writeSlideBody, type SlideData } from '../../../../src/decks/deckFormat'

/** Meta on the deck view's own transactions (the strip's operations): the guard lets them through. */
export const DECK_OPERATION = 'deckOperation'

export interface DeckSlideEntry {
  /** The slide's place in the deck, from 0. */
  index: number
  /** The slide node's position in the document. */
  pos: number
  node: PMNode
  kind: string
  data: SlideData
  notes: string | null
}

const parsed = new Map<string, SlideData>()

/** A slide body's data, read once per distinct body (the deck is read again on every keystroke). */
export function slideDataOf(body: string): SlideData {
  let data = parsed.get(body)
  if (!data) {
    if (parsed.size > 2000) parsed.clear()
    data = parseSlideBody(body)
    parsed.set(body, data)
  }
  return data
}

export function isSlideNode(node: PMNode | null | undefined): boolean {
  return node?.type.name === 'deckSlide'
}

/** The deck's slides, in order, from the editor's document. Only top-level slide nodes start a part. */
export function slidesOf(doc: PMNode): DeckSlideEntry[] {
  const slides: DeckSlideEntry[] = []
  doc.forEach((node, pos) => {
    if (!isSlideNode(node)) return
    slides.push({ index: slides.length, pos, node, kind: node.attrs.kind, data: slideDataOf(node.attrs.body), notes: node.attrs.notes })
  })
  return slides
}

/** Which part holds this document position: the slide index, or null in the preamble. */
export function partIndexAt(doc: PMNode, pos: number): number | null {
  let index = -1
  let found: number | null = null
  doc.forEach((node, offset) => {
    if (found !== null) return
    if (isSlideNode(node)) index++
    if (pos < offset + node.nodeSize) found = index
  })
  if (found === null) found = index
  return found < 0 ? null : found
}

/** A slide's title as the strip and the part head show it. */
export function slideTitle(data: SlideData): string {
  return (data.title ?? '').trim()
}

// ---------------------------------------------------------------------------
// The strip's operations: each one transaction, with the guard's pass, so one undo step
// ---------------------------------------------------------------------------

/** Where part `index` lies: its slide node and the blocks after it, up to the next slide. */
export function partRange(doc: PMNode, index: number): { from: number; to: number } | null {
  const slides = slidesOf(doc)
  const slide = slides[index]
  if (!slide) return null
  const next = slides[index + 1]
  return { from: slide.pos, to: next ? next.pos : doc.content.size }
}

/** Where a part placed "before part `at`" goes: that part's start, or the document's end. */
function insertPoint(doc: PMNode, at: number): number {
  const slides = slidesOf(doc)
  if (at <= 0 && slides[0]) return slides[0].pos
  return slides[at]?.pos ?? doc.content.size
}

const operation = (tr: Transaction) => tr.setMeta(DECK_OPERATION, true)

/** The ids the deck's slides carry. */
function idsOf(doc: PMNode): string[] {
  return slidesOf(doc).map(slide => slide.data.id).filter((id): id is string => !!id)
}

/** Move part `from` so it stands before part `to` (or at the end when `to` is the count). */
export function moveSlide(state: EditorState, from: number, to: number): Transaction | null {
  if (from === to || from + 1 === to) return null
  const range = partRange(state.doc, from)
  if (!range) return null
  const slice = state.doc.slice(range.from, range.to)
  const target = insertPoint(state.doc, to)
  const tr = state.tr
  // Insert first when the target lies after the part, so the part's positions stay valid for the delete.
  if (target >= range.to) {
    tr.insert(target, slice.content)
    tr.delete(range.from, range.to)
  } else {
    tr.delete(range.from, range.to)
    tr.insert(target, slice.content)
  }
  return operation(tr)
}

/** A copy of part `index` right after it, its slide with a new id. */
export function duplicateSlide(state: EditorState, index: number, random: () => number = Math.random): Transaction | null {
  const range = partRange(state.doc, index)
  if (!range) return null
  const content = state.doc.slice(range.from, range.to).content
  const first = content.firstChild
  if (!first || !isSlideNode(first)) return null
  const id = newId(idsOf(state.doc), random)
  const copy = first.type.create({ ...first.attrs, body: writeSlideBody(first.attrs.body, { ...slideDataOf(first.attrs.body), id }) })
  const tr = state.tr.insert(range.to, content.replaceChild(0, copy))
  return operation(tr)
}

/** Take part `index` out: the slide and its handout. Never the deck's last slide. */
export function deleteSlide(state: EditorState, index: number): Transaction | null {
  if (slidesOf(state.doc).length < 2) return null
  const range = partRange(state.doc, index)
  if (!range) return null
  return operation(state.tr.delete(range.from, range.to))
}

/** A new empty slide of `kind` before part `at` (at the end when `at` is the count); returns where it went. */
export function insertSlide(state: EditorState, at: number, kind: string, random: () => number = Math.random): Transaction | null {
  const type = state.schema.nodes.deckSlide
  if (!type) return null
  const body = writeSlideBody('', { id: newId(idsOf(state.doc), random) })
  const slide = type.create({ kind, body, notes: null })
  const point = insertPoint(state.doc, at)
  return operation(state.tr.insert(point, [slide, state.schema.nodes.paragraph.create()]))
}

/** Change part `index`'s slide: its data (written line by line), and its kind when given. */
export function updateSlide(state: EditorState, index: number, data: SlideData, kind?: string): Transaction | null {
  const slide = slidesOf(state.doc)[index]
  if (!slide) return null
  const body = writeSlideBody(slide.node.attrs.body, data)
  const nextKind = kind ?? slide.kind
  if (body === slide.node.attrs.body && nextKind === slide.kind) return null
  return state.tr.setNodeMarkup(slide.pos, undefined, { ...slide.node.attrs, body, kind: nextKind })
}
