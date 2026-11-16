/**
 * Sprint 157: the deck as the editor's document holds it. The strip and the stage are drawn from the editor's own
 * document: its slide nodes, in order. A part is a slide node and the blocks after it up to the next slide node;
 * blocks before the first slide are the preamble, kept as written.
 */
import type { Fragment, Node as PMNode } from '@tiptap/pm/model'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import { derivedHeading, newId, parseSlideBody, partHeadingLevel, writeSlideBody, type SlideData } from '../../../../src/decks/deckFormat'

/** Meta on the deck view's own transactions (the strip's operations): the guard lets them through. */
export const DECK_OPERATION = 'deckOperation'

/**
 * Meta on the transaction that draws an older deck's part headings from its slides' titles (16 November). It is no
 * edit: never in the undo history, never published as a change, and the deck view doesn't save what it alone adds.
 */
export const DECK_DERIVED = 'deckDerivedHeadings'

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

// ---------------------------------------------------------------------------
// The handout's width
// ---------------------------------------------------------------------------

/**
 * The slide's share of the room beside the strip: 40 to the handout's 60 (16 November, the handout is a Text document).
 * A share the person dragged to is kept, in the view's own state, over this default.
 */
export const DEFAULT_RATIO = 0.4
export const RATIO_MIN = 0.3
export const RATIO_MAX = 0.82

/** The slide's share to start with: the one the person dragged to and the view kept, else the default. */
export function initialRatio(stored: unknown): number {
  return typeof stored === 'number' && Number.isFinite(stored) && stored >= RATIO_MIN && stored <= RATIO_MAX ? stored : DEFAULT_RATIO
}

// ---------------------------------------------------------------------------
// The part's own heading (16 November: the handout is a Text document)
// ---------------------------------------------------------------------------

function isEmptyParagraph(node: PMNode): boolean {
  return node.type.name === 'paragraph' && node.childCount === 0
}

/**
 * The part's own heading: an H1 or H2 as the first block after its slide node (empty paragraphs before it are no
 * blocks of the file). Null when the part opens with anything else.
 */
export function partHeadingAt(doc: PMNode, slidePos: number): { node: PMNode; pos: number } | null {
  const slide = doc.nodeAt(slidePos)
  if (!slide) return null
  let pos = slidePos + slide.nodeSize
  while (pos < doc.content.size) {
    const node = doc.nodeAt(pos)
    if (!node || isSlideNode(node)) return null
    if (isEmptyParagraph(node)) { pos += node.nodeSize; continue }
    return node.type.name === 'heading' && node.attrs.level <= 2 ? { node, pos } : null
  }
  return null
}

/**
 * The headings of the parts that have none of their own (every part of a deck written before 16 November), drawn from
 * their slides' titles: an H1 for a section, an H2 for every other kind, and an empty paragraph under a heading that
 * has nothing under it, for the part's words. Null when every part has its heading.
 *
 * The transaction is no edit (`DECK_DERIVED`, out of the history, no update), and the headings are marked as drawn
 * (`handout/drawnHeadings.ts`): the save leaves them out, so opening a deck writes nothing. They reach the file with the
 * person's first edit of the handout, as ordinary text from then on.
 */
export function derivedHeadings(state: EditorState): Transaction | null {
  const { doc, schema } = state
  if (!schema.nodes.heading) return null
  const tr = state.tr
  const slides = slidesOf(doc)
  // From the last part to the first, so each slide's position still holds.
  for (let index = slides.length - 1; index >= 0; index--) {
    const slide = slides[index]
    if (partHeadingAt(doc, slide.pos)) continue
    const after = slide.pos + slide.node.nodeSize
    const text = derivedHeading(slide.data)
    // Marked as drawn where the deck's schema has the mark (the deck view's always does).
    const drawn = schema.nodes.heading.spec.attrs?.deckDrawn ? { deckDrawn: true } : {}
    const heading = schema.nodes.heading.create({ level: partHeadingLevel(slide.kind), ...drawn }, text ? schema.text(text) : null)
    const next = doc.nodeAt(after)
    const nodes = [heading]
    if (!next || isSlideNode(next)) nodes.push(schema.nodes.paragraph.create())
    tr.insert(after, nodes)
  }
  if (!tr.docChanged) return null
  return tr.setMeta(DECK_DERIVED, true).setMeta('addToHistory', false).setMeta('preventUpdate', true)
}

/** The empty heading a new part opens with, for its kind. */
export function emptyPartHeading(state: EditorState, kind: string): PMNode | null {
  return state.schema.nodes.heading?.create({ level: partHeadingLevel(kind) }) ?? null
}

/**
 * Does the handout hold anything: a block outside the slide nodes that isn't an empty paragraph (words, a picture, a
 * line). A part's own heading is its heading, not its text, so a deck with only its title or heading typed holds none
 * (the start card).
 */
export function handoutHasText(doc: PMNode): boolean {
  let found = false
  // Right after a slide node, until the part's first block that isn't an empty paragraph: where its heading may stand.
  let headingMayFollow = false
  doc.forEach(node => {
    if (found) return
    if (isSlideNode(node)) { headingMayFollow = true; return }
    if (headingMayFollow && node.type.name === 'heading' && node.attrs.level <= 2) { headingMayFollow = false; return }
    if (!isEmptyParagraph(node)) headingMayFollow = false
    if (node.type.name !== 'paragraph') { found = true; return }
    node.forEach(child => {
      if (child.isText ? !!child.text?.trim() : child.type.name !== 'hardBreak') found = true
    })
  })
  return found
}

/** A slide's title as the strip and the stage show it. */
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

/** The content of part `index` (its slide and handout), to put back later with `restoreSlide`. */
export function partContent(doc: PMNode, index: number): Fragment | null {
  const range = partRange(doc, index)
  return range ? doc.slice(range.from, range.to).content : null
}

/** Put a deleted part back before part `at` (the delete's own Undo: whatever was done since stays). */
export function restoreSlide(state: EditorState, at: number, content: Fragment): Transaction {
  return operation(state.tr.insert(insertPoint(state.doc, at), content))
}

/** A new empty slide of `kind` before part `at` (at the end when `at` is the count); returns where it went. */
export function insertSlide(state: EditorState, at: number, kind: string, random: () => number = Math.random): Transaction | null {
  const type = state.schema.nodes.deckSlide
  if (!type) return null
  const body = writeSlideBody('', { id: newId(idsOf(state.doc), random) })
  const slide = type.create({ kind, body, notes: null })
  const point = insertPoint(state.doc, at)
  // A new part opens with its heading, empty until the person writes it, and room for its words.
  const heading = emptyPartHeading(state, kind)
  return operation(state.tr.insert(point, [slide, ...(heading ? [heading] : []), state.schema.nodes.paragraph.create()]))
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

/** Put `content` in place of part `index` (the library's version of a copy, or the copy back again), as one step. */
export function replacePart(state: EditorState, index: number, content: Fragment): Transaction | null {
  const range = partRange(state.doc, index)
  if (!range) return null
  return operation(state.tr.replaceWith(range.from, range.to, content))
}
