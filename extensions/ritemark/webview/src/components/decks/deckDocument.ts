/**
 * Sprint 157: the deck as the editor's document holds it. The strip and the stage are drawn from the editor's own
 * document: its slide nodes, in order. A part is a slide node and the blocks after it up to the next slide node;
 * blocks before the first slide are the preamble, kept as written.
 */
import type { Node as PMNode } from '@tiptap/pm/model'
import { parseSlideBody, type SlideData } from '../../../../src/decks/deckFormat'

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
