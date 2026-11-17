/**
 * Sprint 157: the current slide's part head is marked in the handout (its number in the accent colour), as the
 * prototype's `.hpart.cur`. The deck view sets the current slide with `setCurrentSlide`; the marks are node
 * decorations, so nothing in the document changes.
 *
 * 16 November (the handout is a Text document): the placeholders are marks too. A part's empty heading says "Heading",
 * and the current part's empty text says how to write on: "Write here. *** starts a new slide."
 *
 * 17 November ("A slide with no handout"): a part with no heading and no text is a slide with no handout, as a slide
 * with no speaker notes simply has none. While it isn't the current one it folds to one thin row: its head is marked
 * `is-only` and its empty blocks `deck-only-fold` (decks.css). There's no switch: typing a heading or text makes it a
 * part again, and emptying it folds it again.
 */
import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'
import { partHeadingAt, partIndexAt } from '../deckDocument'

/** The placeholders, as the prototype words them (the Experience lead, 16 November). */
export const HEADING_PLACEHOLDER = 'Heading'
export const PART_PLACEHOLDER = 'Write here. *** starts a new slide.'

export const deckCurrentKey = new PluginKey<number | null>('deckCurrent')

/** A transaction that makes slide `index` the current one (no document change, never in the undo history). */
export function setCurrentSlide(tr: Transaction, index: number | null): Transaction {
  return tr.setMeta(deckCurrentKey, index).setMeta('addToHistory', false)
}

export function currentSlideOf(state: EditorState): number | null {
  return deckCurrentKey.getState(state) ?? null
}

/**
 * Is this run of a part's blocks empty: no heading and no text? Each block an empty paragraph or an empty heading (a
 * line break is no text), or a comment for the AI, which never reaches the published page either (so the editor and
 * the page agree: `isSlideOnly` in the page's HTML). A drawn heading (a deck written before 16 November shows its
 * slide's title until the first edit) is text, so such a part is never slide-only until the person empties it.
 */
export function blocksAreBare(blocks: readonly PMNode[]): boolean {
  return blocks.every(node => {
    if (node.type.name === 'commentNode') return true
    if (node.type.name !== 'paragraph' && node.type.name !== 'heading') return false
    let bare = true
    node.forEach(child => {
      if (child.isText ? !!child.text?.trim() : child.type.name !== 'hardBreak') bare = false
    })
    return bare
  })
}

/** The blocks of each part, in order: what follows each slide node, up to the next one. */
function partBlocks(doc: PMNode): Array<{ pos: number; size: number; blocks: Array<{ node: PMNode; pos: number }> }> {
  const parts: Array<{ pos: number; size: number; blocks: Array<{ node: PMNode; pos: number }> }> = []
  doc.forEach((node, pos) => {
    if (node.type.name === 'deckSlide') parts.push({ pos, size: node.nodeSize, blocks: [] })
    else parts[parts.length - 1]?.blocks.push({ node, pos })
  })
  return parts
}

/** The parts that are slides with no handout (no heading and no text), by their place. */
export function slideOnlyParts(doc: PMNode): number[] {
  return partBlocks(doc).flatMap((part, index) => (blocksAreBare(part.blocks.map(block => block.node)) ? [index] : []))
}

/**
 * The current slide's head (`is-current`); each part's empty heading ("Heading"); and the current part's first empty
 * paragraph when the part has no words yet. A slide with no handout folds, unless it is the current one or the caret
 * is in it (`writing`): text is never typed into a folded part.
 */
export function deckDecorations(doc: PMNode, current: number | null, writing: number | null = null): DecorationSet {
  const found: Decoration[] = []
  const slides = partBlocks(doc)
  slides.forEach((slide, index) => {
    if (index === current) found.push(Decoration.node(slide.pos, slide.pos + slide.size, { class: 'is-current' }))
    // A slide with no handout, not the current one: one thin row, its empty blocks folded away.
    const blocks = slide.blocks
    if (index !== current && index !== writing && blocksAreBare(blocks.map(block => block.node))) {
      found.push(Decoration.node(slide.pos, slide.pos + slide.size, { class: 'is-only' }))
      for (const block of blocks) found.push(Decoration.node(block.pos, block.pos + block.node.nodeSize, { class: 'deck-only-fold' }))
      return
    }
    const heading = partHeadingAt(doc, slide.pos)
    if (heading && heading.node.childCount === 0) {
      found.push(Decoration.node(heading.pos, heading.pos + heading.node.nodeSize, { class: 'deck-empty', 'data-deck-placeholder': HEADING_PLACEHOLDER }))
    }
    if (index !== current) return
    // The part's own words: every block after its heading, up to the next slide. Empty: the first empty paragraph says how.
    const end = index + 1 < slides.length ? slides[index + 1].pos : doc.content.size
    let pos = heading ? heading.pos + heading.node.nodeSize : slide.pos + slide.size
    let first: { pos: number; size: number } | null = null
    while (pos < end) {
      const node = doc.nodeAt(pos)
      if (!node) break
      if (node.type.name !== 'paragraph' || node.childCount > 0) { first = null; break }
      if (!first) first = { pos, size: node.nodeSize }
      pos += node.nodeSize
    }
    if (first) found.push(Decoration.node(first.pos, first.pos + first.size, { class: 'deck-empty', 'data-deck-placeholder': PART_PLACEHOLDER }))
  })
  return found.length ? DecorationSet.create(doc, found) : DecorationSet.empty
}

/** Whether the handout has the focus: only then can typing reach the part the caret is in. */
export const deckFocusKey = new PluginKey<boolean>('deckFocus')

/**
 * The part the caret is in while the handout has the focus, when it is in a part's text (not on a slide node, not in
 * the preamble). With the focus elsewhere (a thumbnail clicked) nothing can be typed there, so the part may fold.
 */
function writingPartOf(state: EditorState): number | null {
  if (deckFocusKey.getState(state) !== true) return null
  const { selection } = state
  if (!selection.empty || !selection.$from.parent.isTextblock) return null
  return partIndexAt(state.doc, selection.from)
}

/** Tells the plugins whether the handout has the focus (no document change, never in the undo history). */
function focusChanged(view: EditorView, focused: boolean) {
  if (deckFocusKey.getState(view.state) !== focused) view.dispatch(view.state.tr.setMeta(deckFocusKey, focused).setMeta('addToHistory', false))
  return false
}

export const DeckCurrent = Extension.create({
  name: 'deckCurrent',

  addProseMirrorPlugins() {
    return [
      new Plugin<number | null>({
        key: deckCurrentKey,
        state: {
          init: () => null,
          apply: (tr, value) => {
            const next = tr.getMeta(deckCurrentKey)
            return next === undefined ? value : next
          },
        },
        props: {
          decorations: state => deckDecorations(state.doc, currentSlideOf(state), writingPartOf(state)),
        },
      }),
      new Plugin<boolean>({
        key: deckFocusKey,
        state: {
          init: () => false,
          apply: (tr, value) => {
            const next = tr.getMeta(deckFocusKey)
            return next === undefined ? value : next === true
          },
        },
        props: {
          handleDOMEvents: {
            focus: view => focusChanged(view, true),
            blur: view => focusChanged(view, false),
          },
        },
      }),
    ]
  },
})
