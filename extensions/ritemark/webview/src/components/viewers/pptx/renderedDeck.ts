/**
 * Sprint 125 (#285) R4 — finding words in the slides the renderer has drawn.
 *
 * `renderSlide` appends, in order, the background, the master's and the layout's
 * shapes, then one element per `slide.nodes` entry. The slide's own shapes are
 * therefore its last `nodes.length` children — the same text `deckSearch` counts,
 * without the footers every slide repeats. Paragraphs are `div`s, table cells
 * `td`/`th`: a match never crosses from one into the next.
 */
import { findDocumentMatches, type TextChunk } from '../documentSearch'

const BLOCK = 'div, td, th, p'

function chunksOf(roots: readonly Element[]): { nodes: Text[]; chunks: TextChunk[] } {
  const nodes: Text[] = []
  const chunks: TextChunk[] = []
  let previousBlock: Element | null = null
  for (const root of roots) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => (node.parentElement?.closest('style, script') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    })
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const block = node.parentElement?.closest(BLOCK) ?? null
      nodes.push(node as Text)
      chunks.push({ text: node.nodeValue ?? '', newBlock: block !== previousBlock })
      previousBlock = block
    }
    previousBlock = null
  }
  return { nodes, chunks }
}

function rangesIn(roots: readonly Element[], query: string): Range[] {
  const { nodes, chunks } = chunksOf(roots)
  return findDocumentMatches(chunks, query).map((m) => {
    const range = document.createRange()
    range.setStart(nodes[m.start.chunk], m.start.offset)
    range.setEnd(nodes[m.end.chunk], m.end.offset)
    return range
  })
}

/** Matches in a drawn slide's own shapes, in drawing order. */
export function slideRanges(slideElement: Element, ownNodeCount: number, query: string): Range[] {
  const children = Array.from(slideElement.children)
  return rangesIn(children.slice(Math.max(0, children.length - ownNodeCount)), query)
}

/** Matches in a slide's speaker notes. */
export function notesRanges(notesElement: Element, query: string): Range[] {
  return rangesIn([notesElement], query)
}
