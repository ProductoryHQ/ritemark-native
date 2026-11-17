/**
 * The headings a deck view draws for parts that have none of their own (every part of a deck written before 16
 * November): an H1 for a section, an H2 for every other kind, its slide's title (`deckDocument.derivedHeadings`).
 *
 * A drawn heading is the editor's own heading node, marked `deckDrawn`, so it reads and moves like any other. Until it
 * is written it is the slide's, not the handout's:
 *
 *  - it is never saved: the save leaves a marked heading out (`addDeckTurndownRules`), so opening a deck, and anything
 *    the editor does meanwhile, writes nothing (README, 16 November: "Opening a deck writes nothing");
 *  - a change to a slide alone (its title on the stage, its layout) is saved without them, and a drawn heading follows
 *    its slide's title, so none is written stale;
 *  - the person's first edit of the handout's own text (typing, a heading of its own, a slide moved or added in the
 *    strip, which moves its handout) writes them all in the same step, as ordinary text from then on. Undo takes that
 *    step back whole, drawn headings included.
 */
import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state'
import { isHistoryTransaction } from '@tiptap/pm/history'
import { derivedHeading, partHeadingLevel } from '../../../../../src/decks/deckFormat'
import { DECK_DERIVED, isSlideNode, partHeadingAt, slidesOf } from '../deckDocument'

export const DRAWN_ATTRIBUTE = 'data-deck-drawn'
export const drawnHeadingsKey = new PluginKey('deckDrawnHeadings')

function isDrawn(node: PMNode): boolean {
  return node.type.name === 'heading' && node.attrs.deckDrawn === true
}

/** Does the document hold a drawn heading, one not written yet? */
export function hasDrawnHeadings(doc: PMNode): boolean {
  return drawnAt(doc).length > 0
}

/**
 * The deck's `handout: text` mark for an edit the editor reports (16 November): added with the first edit after which
 * no heading is drawn (its headings written), and taken out again only when an undo brings drawn headings back, if this
 * view added it. Null: the front matter stays as it is.
 */
export function handoutMarkFor(input: { marked: boolean; drawn: boolean; addedHere: boolean; undo: boolean }): 'add' | 'remove' | null {
  if (!input.marked && !input.drawn) return 'add'
  if (input.marked && input.drawn && input.addedHere && input.undo) return 'remove'
  return null
}

/** The drawn headings at the top level: each one's position. */
function drawnAt(doc: PMNode): number[] {
  const found: number[] = []
  doc.forEach((node, pos) => { if (isDrawn(node)) found.push(pos) })
  return found
}

/** A transaction the drawn headings leave alone: theirs, the host's, undo and redo. */
export function passes(tr: Transaction): boolean {
  return tr.getMeta(DECK_DERIVED) === true
    || tr.getMeta('ritemarkDocumentRevision') !== undefined
    || tr.getMeta('preventUpdate') === true
    || isHistoryTransaction(tr)
}

/** Did the handout's own text change between these documents: any top-level block but the slides' nodes? */
export function handoutChanged(before: PMNode, after: PMNode): boolean {
  if (before === after) return false
  const blocks = (doc: PMNode) => {
    const out: PMNode[] = []
    doc.forEach(node => { if (!isSlideNode(node)) out.push(node) })
    return out
  }
  const was = blocks(before)
  const is = blocks(after)
  return was.length !== is.length || was.some((node, index) => node !== is[index] && !node.eq(is[index]))
}

/**
 * What the person's transactions mean for the drawn headings: written all at once when the handout's own text changed,
 * else each one following its slide's title. Null when nothing is to be done.
 */
export function drawnHeadingsFollow(transactions: readonly Transaction[], state: EditorState): Transaction | null {
  const drawn = drawnAt(state.doc)
  if (drawn.length === 0) return null
  const own = transactions.filter(tr => tr.docChanged && !passes(tr))
  if (own.length === 0) return null
  const tr = state.tr
  if (own.some(step => handoutChanged(step.before, step.doc))) {
    // The first real edit of the handout: the headings are its text now, and saved with it.
    for (const pos of drawn) tr.setNodeMarkup(pos, undefined, { ...state.doc.nodeAt(pos)!.attrs, deckDrawn: false })
    return tr
  }
  // A slide changed alone: a drawn heading stays its slide's title, at its kind's level (a section's H1).
  for (const slide of [...slidesOf(state.doc)].reverse()) {
    const heading = partHeadingAt(state.doc, slide.pos)
    if (!heading || !isDrawn(heading.node)) continue
    const text = derivedHeading(slide.data)
    const level = partHeadingLevel(slide.kind, slide.data)
    if (heading.node.attrs.level !== level) tr.setNodeMarkup(heading.pos, undefined, { ...heading.node.attrs, level })
    if (heading.node.textContent === text) continue
    tr.replaceWith(heading.pos + 1, heading.pos + heading.node.nodeSize - 1, text ? state.schema.text(text) : [])
  }
  return tr.docChanged ? tr : null
}

export const DeckDrawnHeadings = Extension.create({
  name: 'deckDrawnHeadings',

  addGlobalAttributes() {
    return [
      {
        types: ['heading'],
        attributes: {
          deckDrawn: {
            default: false,
            keepOnSplit: false,
            parseHTML: element => element.hasAttribute(DRAWN_ATTRIBUTE),
            renderHTML: attributes => (attributes.deckDrawn ? { [DRAWN_ATTRIBUTE]: '' } : {}),
          },
        },
      },
    ]
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: drawnHeadingsKey,
        appendTransaction: (transactions, _oldState, newState) => drawnHeadingsFollow(transactions, newState),
      }),
    ]
  },
})
