/**
 * Removing a slide from the handout (experience 46, "Removing a slide from the handout"; Jarmo, 16 November: "jah, kõik
 * kolm sobivad"; joined for block slides on 17 November). Nothing goes silently: each way either removes nothing but an
 * empty slide, or warns first, and each ends with the bar's line and Undo.
 *
 *  - **Backspace in an empty part** removes that slide and its line in one step: the part has no text and its slide no
 *    words, picture or setting of its own. The bar says "Slide 14 is deleted." with Undo.
 *  - **Backspace at the very start of a part's first line** joins the part to the one above, in two presses. The first
 *    press only marks it: the line between the parts and the lower slide's thumbnail light up, with the note "Backspace
 *    again joins slide 14 into slide 13. Nothing is lost." Any other key, a click or Esc takes the mark away; nothing is
 *    written. The second press joins them in one transaction (`joinPartUp`): slide 14's blocks follow slide 13's (its
 *    title an H3, its slide-wide picture a Picture block at the end, its comments with their blocks: `joinSlides.ts`),
 *    its handout text follows on in part 13, and slide 13 keeps its own settings. The bar says "Slide 14 is joined to
 *    slide 13." with Undo.
 *  - **Typing never removes a slide** (the guard, `deckGuard.ts`): only these two, the part number's ⋯ and the strip.
 *
 * Each removal is one transaction of the deck view's kind (`DECK_OPERATION`), an undo step of its own on both sides
 * (`closeHistory` before it, and an empty `closeHistory` after it, so the typing that follows is a step of its own too),
 * so one Undo brings the file back as it was. A deck of today's slides converts in the same transaction first, as every
 * first real edit converts it (#765): one Undo takes back the join and the conversion together.
 */
import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, Selection, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { closeHistory } from '@tiptap/pm/history'
import { isBlockSlide, withBlockMarkdown } from '../../../../../src/decks/deckFormat'
import { blockDataOf, convertsToBlocks, drawsAsBlocks } from '../../../../../src/decks/blocks/convertDeck'
import { joinedSlideMarkdown, openEndingOf, slideHasNothing, type OpenEnding } from '../../../../../src/decks/blocks/joinSlides'
import { DECK_OPERATION, isSlideNode, partIndexAt, partRange, slidesOf, type DeckSlideEntry } from '../deckDocument'
import { convertDeckInto, writeDrawnHeadings } from './deckConvert'

export const deckRemoveKey = new PluginKey<JoinMark | null>('deckRemove')

/** Meta on a removal's transaction: what it did, for the deck view's line in the bar. */
export const DECK_REMOVED = 'deckRemoved'

/** What a removal did: slide `number` deleted, or joined into slide `into` (numbers from 1). */
export type DeckRemoval = { what: 'deleted'; number: number } | { what: 'joined'; number: number; into: number }

/** The first press of a join: the slide (by its place and its id) that the next Backspace joins up. */
export interface JoinMark {
  index: number
  id: string | undefined
  /** The join can't be made, and the note says why: the lower slide is skipped and the upper one isn't, or one of them
   *  ends inside a code box (or another part) that is never closed. */
  blocked?: JoinBlock
}

/** The bar's line for a removal. */
export function removalNotice(removal: DeckRemoval): string {
  return removal.what === 'deleted' ? `Slide ${removal.number} is deleted.` : `Slide ${removal.number} is joined to slide ${removal.into}.`
}

/** Why a join isn't made: the lower slide is skipped, or a slide (the upper one, or the lower) ends inside something open. */
export type JoinBlock = 'skipped' | { open: OpenEnding; upper: boolean }

/**
 * The note at the line on the first press (the numbers are the slides' own, from 1). In plain words (17 November): the
 * slide that ends inside something open is named, and what to do; never "block" or "fence".
 */
export function joinNote(index: number, blocked?: JoinBlock): string {
  if (blocked === 'skipped') return `Slide ${index + 1} is skipped, so it can't join slide ${index}. Show it first, from its ⋯.`
  if (blocked) {
    const slide = `Slide ${blocked.upper ? index : index + 1}`
    if (blocked.open === 'code') return `${slide} ends inside a code box, so it can't join yet. Close the code box first.`
    if (blocked.open === 'note') return `${slide} ends inside a comment that's never closed, so it can't join yet. Close the comment first.`
    return `${slide} ends with text that's left open, so it can't join yet. Close it first.`
  }
  return `Backspace again joins slide ${index + 1} into slide ${index}. Nothing is lost.`
}

/** The slide marked for a join, if any. */
export function joinMarkOf(state: EditorState): JoinMark | null {
  return deckRemoveKey.getState(state) ?? null
}

/** The Markdown a slide is drawn with: a block slide's own, a v1 slide's as the conversion writes it; null otherwise. */
function drawnMarkdownOf(entry: DeckSlideEntry): string | null {
  if (isBlockSlide(entry.kind)) return entry.data.markdown ?? ''
  if (convertsToBlocks(entry.kind)) return blockDataOf(entry.kind, entry.data).markdown ?? ''
  return null
}

/** Is part `index` empty: no text in its handout, and nothing of its slide's own (no words, picture or setting)? */
export function isEmptyPart(doc: PMNode, index: number): boolean {
  const entry = slidesOf(doc)[index]
  const range = partRange(doc, index)
  if (!entry || !range) return false
  const markdown = drawnMarkdownOf(entry)
  if (markdown === null || !slideHasNothing(markdown, entry.data, entry.notes)) return false
  let empty = true
  doc.nodesBetween(range.from + entry.node.nodeSize, range.to, node => {
    if (!empty) return false
    // Only empty lines and empty headings: anything else (words, a comment, a line, a picture) is the part's text.
    if ((node.type.name === 'paragraph' || node.type.name === 'heading') && node.childCount === 0) return false
    empty = false
    return false
  })
  return empty
}

/** Where part `index`'s first line starts: the first text position after its slide node, or null when it has none. */
export function partStartOf(doc: PMNode, index: number): number | null {
  const range = partRange(doc, index)
  const entry = slidesOf(doc)[index]
  if (!range || !entry) return null
  let pos = range.from + entry.node.nodeSize
  if (pos >= range.to) return null
  let node = doc.nodeAt(pos)
  // Into the part's first block, then its first child, until a line: a list's first item, a quote's first paragraph.
  while (node && !node.isTextblock) {
    if (node.isLeaf || node.childCount === 0 || isSlideNode(node)) return null
    pos += 1
    node = node.firstChild
  }
  return node ? pos + 1 : null
}

/** Can part `index` be joined into the one above: both slides drawn as blocks (a kind this build doesn't know stays)? */
export function canJoin(doc: PMNode, index: number): boolean {
  if (index < 1) return false
  const slides = slidesOf(doc)
  const upper = slides[index - 1]
  const lower = slides[index]
  return !!upper && !!lower && drawsAsBlocks(upper.kind) && drawsAsBlocks(lower.kind)
}

/**
 * Why a join of part `index` into the one above isn't made, or null when it can be. A skipped slide joined into a
 * shown one would put its words on the wall and the page, which a skipped slide's words never reach: it is shown
 * first, by the person, or deleted.
 */
export function joinBlocked(doc: PMNode, index: number): JoinBlock | null {
  const slides = slidesOf(doc)
  const upper = slides[index - 1]
  const lower = slides[index]
  if (!upper || !lower) return null
  if (lower.data.skip === true && upper.data.skip !== true) return 'skipped'
  // A code fence left open would take the other slide's words, comments too, into code, which the page shows as written.
  const above = openEndingOf(drawnMarkdownOf(upper) ?? '')
  if (above) return { open: above, upper: true }
  const below = openEndingOf(drawnMarkdownOf(lower) ?? '')
  return below ? { open: below, upper: false } : null
}

/** What Backspace means where the caret is: remove the empty part, mark or make a join, or nothing of the deck's. */
export function backspaceAt(state: EditorState): { what: 'remove' | 'join'; index: number; blocked?: JoinBlock } | null {
  const { selection, doc } = state
  if (!selection.empty || !(selection instanceof TextSelection)) return null
  const index = partIndexAt(doc, selection.from)
  if (index === null) return null
  const entry = slidesOf(doc)[index]
  if (!entry || selection.from <= entry.pos) return null
  if (slidesOf(doc).length > 1 && isEmptyPart(doc, index)) return { what: 'remove', index }
  if (partStartOf(doc, index) !== selection.from || !canJoin(doc, index)) return null
  const blocked = joinBlocked(doc, index)
  return blocked ? { what: 'join', index, blocked } : { what: 'join', index }
}

/** A caret in the line nearest `pos`, looking that way first (never a slide's node, which a caret can't stand in). */
function textSelectionNear(doc: PMNode, pos: number, bias: 1 | -1): Selection {
  const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)))
  return Selection.findFrom($pos, bias, true) ?? Selection.findFrom($pos, -bias as 1 | -1, true) ?? Selection.near($pos, bias)
}

/** The empty part `index` taken out, slide and line, as one undo step; the caret at the end of the part above. */
export function removeEmptyPart(state: EditorState, index: number): Transaction | null {
  if (slidesOf(state.doc).length < 2 || !isEmptyPart(state.doc, index)) return null
  const range = partRange(state.doc, index)
  if (!range) return null
  const tr = closeHistory(state.tr).delete(range.from, range.to)
  tr.setSelection(textSelectionNear(tr.doc, range.from, -1))
  const removal: DeckRemoval = { what: 'deleted', number: index + 1 }
  return tr.setMeta(DECK_OPERATION, true).setMeta(DECK_REMOVED, removal).scrollIntoView()
}

/**
 * Part `index` joined into part `index − 1`, as one undo step (the conversion of a deck of today's slides with it): the
 * upper slide's Markdown takes the lower one's blocks (`joinedSlideMarkdown`), its header (settings) as it was; the
 * lower slide's node goes, so its handout text follows on in the part above; the caret stays where it was, now in the
 * part above. Drawn headings are written, as with every edit of the handout's text. Null when the two can't be joined.
 */
export function joinPartUp(state: EditorState, index: number): Transaction | null {
  if (!canJoin(state.doc, index) || joinBlocked(state.doc, index)) return null
  const tr = closeHistory(state.tr)
  const caret = state.selection.from
  convertDeckInto(tr)
  // The positions below are read from the converted document: only the steps after the conversion move them.
  const converted = tr.steps.length
  const slides = slidesOf(tr.doc)
  const upper = slides[index - 1]
  const lower = slides[index]
  if (!upper || !lower || !isBlockSlide(upper.kind) || !isBlockSlide(lower.kind)) return null
  const markdown = joinedSlideMarkdown(upper.data.markdown ?? '', lower.data.markdown ?? '', lower.data)
  tr.setNodeMarkup(upper.pos, undefined, { ...upper.node.attrs, body: withBlockMarkdown(upper.node.attrs.body, markdown) })
  const lowerPos = tr.mapping.slice(converted).map(lower.pos)
  const lowerNode = tr.doc.nodeAt(lowerPos)
  if (!lowerNode || !isSlideNode(lowerNode)) return null
  tr.delete(lowerPos, lowerPos + lowerNode.nodeSize)
  // The parts' drawn headings (a deck written before 16 November) are their text now, written with the join, as the
  // conversion writes them.
  writeDrawnHeadings(tr)
  const at = Math.max(0, Math.min(tr.mapping.map(caret), tr.doc.content.size))
  tr.setSelection(textSelectionNear(tr.doc, at, 1))
  const removal: DeckRemoval = { what: 'joined', number: index + 1, into: index }
  return tr.setMeta(DECK_OPERATION, true).setMeta(DECK_REMOVED, removal).scrollIntoView()
}

/** A transaction that marks (or with null, unmarks) a join; no change to the document, never in the undo history. */
export function markJoin(tr: Transaction, mark: JoinMark | null): Transaction {
  return tr.setMeta(deckRemoveKey, { mark }).setMeta('addToHistory', false)
}

/** Dispatch a removal and close its undo step behind it, so the typing that follows is a step of its own. */
function dispatchRemoval(view: EditorView, tr: Transaction): void {
  view.dispatch(tr)
  view.dispatch(closeHistory(view.state.tr).setMeta('addToHistory', false))
}

/** The modifier keys alone: pressing one (on the way to ⇧⌫, say) isn't a key of its own. */
const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Fn', 'OS'])

/**
 * The handout's Backspace for removing a slide, as the plugin runs it (the tests call it with a state and a dispatch).
 * True when the deck took the key.
 */
export function handleRemoveKey(view: EditorView, event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'isComposing'>): boolean {
  const state = view.state
  const mark = joinMarkOf(state)
  const plainBackspace = event.key === 'Backspace' && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey
  if (event.isComposing || view.composing) return false
  if (!plainBackspace) {
    if (!mark || MODIFIERS.has(event.key)) return false
    // Any other key takes the mark away; Esc does only that, every other key also does what it does.
    view.dispatch(markJoin(state.tr, null))
    return event.key === 'Escape'
  }
  const at = backspaceAt(state)
  if (!at) {
    if (mark) view.dispatch(markJoin(state.tr, null))
    return false
  }
  if (at.what === 'remove') {
    const tr = removeEmptyPart(state, at.index)
    if (!tr) return false
    dispatchRemoval(view, tr)
    return true
  }
  const id = slidesOf(state.doc)[at.index]?.data.id
  // A join that can't be made: its note says why; another press changes nothing.
  if (at.blocked) {
    if (!mark || mark.index !== at.index || mark.id !== id) view.dispatch(markJoin(state.tr, { index: at.index, id, blocked: at.blocked }))
    return true
  }
  if (mark && mark.index === at.index && mark.id === id) {
    const tr = joinPartUp(state, at.index)
    if (!tr) {
      view.dispatch(markJoin(state.tr, null))
      return true
    }
    dispatchRemoval(view, tr)
    return true
  }
  view.dispatch(markJoin(state.tr, { index: at.index, id }))
  return true
}

/** The marked join's line and note, as decorations on the lower slide's part head. */
function joinDecorations(state: EditorState): DecorationSet {
  const mark = joinMarkOf(state)
  const entry = mark ? slidesOf(state.doc)[mark.index] : undefined
  if (!mark || !entry) return DecorationSet.empty
  return DecorationSet.create(state.doc, [
    Decoration.node(entry.pos, entry.pos + entry.node.nodeSize, { class: mark.blocked ? 'is-join is-blocked' : 'is-join', 'data-join-note': joinNote(mark.index, mark.blocked) }),
  ])
}

/** The plugin (the tests run it with the editor's own history and the deck's other plugins). */
export function deckRemovePlugin(): Plugin<JoinMark | null> {
  return new Plugin<JoinMark | null>({
    key: deckRemoveKey,
    state: {
      init: () => null,
      apply: (tr, value) => {
        const meta = tr.getMeta(deckRemoveKey) as { mark: JoinMark | null } | undefined
        if (meta) return meta.mark
        // A change of the document or the caret (a click, the arrows, typing, the host's revision) ends the mark.
        return value && (tr.docChanged || tr.selectionSet) ? null : value
      },
    },
    props: {
      handleKeyDown: (view, event) => handleRemoveKey(view, event),
      handleDOMEvents: {
        // A click anywhere in the handout ends the mark, and so does leaving it (a click on the slide or the strip).
        mousedown: view => {
          if (joinMarkOf(view.state)) view.dispatch(markJoin(view.state.tr, null))
          return false
        },
        blur: view => {
          if (joinMarkOf(view.state)) view.dispatch(markJoin(view.state.tr, null))
          return false
        },
      },
      decorations: joinDecorations,
    },
  })
}

export const DeckRemove = Extension.create({
  name: 'deckRemove',
  // Before the editor's own Backspace (its keymap, lists, comments), which would try to join into the slide's node.
  priority: 1000,

  addProseMirrorPlugins() {
    return [deckRemovePlugin()]
  },
})
