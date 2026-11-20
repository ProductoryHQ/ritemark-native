/**
 * The handout is a Text document, and a line starts a new slide (README decision 12; Jarmo, 15 and 16 November).
 *
 * A line (a horizontal rule) the person puts in the handout at the top level of a part — `***` with a space or Enter,
 * `---`, or Divider from the / menu — becomes a slide there, in the same step, so one Undo takes it back:
 *
 *  - the new slide is a block slide with a new id (Sprint 161, PR 2: it was a Statement waiting for its layout);
 *  - the heading right after the line (an H1 or H2, the part's own) becomes its title (`# `), once, as it is made;
 *    after that the two never change each other;
 *  - with no such heading after the line, the new part opens with an empty H2 and the caret goes there; the slide then
 *    waits, and takes the first heading the person writes in its part as its title, once (`firstHeadingTitlePlugin`,
 *    as every slide with no title does).
 *
 * A line inside a list, a quote or any other block stays a line, and so does a line that arrives by paste or drop
 * (pasted text with lines in it isn't turned into slides in this cut), by undo or redo, from the host, or from a
 * tool's insert or replace (more than one line at once, or one away from the caret). A slide block is never saved as a
 * line: it is the slide block that marks a new slide in the file.
 */
import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state'
import { headingMarkdown, isBlockSlide, newId, withBlockMarkdown, writeSlideBody } from '../../../../../src/decks/deckFormat'
import { blockSlideBody } from '../../../../../src/decks/blocks/convertDeck'
import { DECK_DERIVED, DECK_OPERATION, emptyPartHeading, isSlideNode, partHeadingAt, slideDataOf, slidesOf } from '../deckDocument'
import { passes } from './drawnHeadings'
import { isTrustedDeckTransaction } from './deckGuard'

export const deckLinesKey = new PluginKey('deckLines')

/** The kind a slide made from a line has: a bare block slide (Sprint 161, PR 2; technical plan §6). */
export const LINE_SLIDE_KIND = ''

/** A line typed on an empty line of its own: `***`, `---` or `___`. */
const LINE_TEXT = /^(?:\*{3,}|-{3,}|_{3,})$/

/** Did this transaction come from a paste or a drop (whose lines stay lines in this cut), or replace the content
 *  without an update (`setContent`, a tool's)? */
function pastedOrDropped(tr: Transaction): boolean {
  const event = tr.getMeta('uiEvent')
  return tr.getMeta('paste') === true || event === 'paste' || event === 'drop' || tr.getMeta('preventUpdate') === true
}

/** A heading that can be a part's own: an H1 or an H2. */
function isPartHeading(node: PMNode | null | undefined): node is PMNode {
  return !!node && node.type.name === 'heading' && node.attrs.level <= 2
}

/**
 * The slide made from the line the person just put in at the top level, as one transaction on `state`; null when
 * there is none. `before` is the document before the person's transactions: a line that was anywhere in it already
 * (written in the file, or lifted out of a quote or a list) stays a line. Only one new line, with the caret in the block
 * right after it, is the person's: that is what typing `***`, `---` or Divider leaves. Several lines at once, or one
 * away from the caret, came from somewhere else (a tool's insert, a replace) and stay lines.
 */
export function slidesFromLines(before: PMNode, state: EditorState, random: () => number = Math.random): Transaction | null {
  const slideType = state.schema.nodes.deckSlide
  if (!slideType) return null
  const kept = new Set<PMNode>()
  before.descendants(node => {
    if (node.type.name === 'horizontalRule') kept.add(node)
    return !node.isTextblock
  })
  const lines: Array<{ pos: number; index: number }> = []
  state.doc.forEach((node, pos, index) => {
    if (node.type.name === 'horizontalRule' && !kept.has(node)) lines.push({ pos, index })
  })
  if (lines.length !== 1) return null
  const [{ pos: at, index }] = lines
  if (state.selection.$from.index(0) !== index + 1) return null
  // Only inside a part: a line in the text before the first slide stays a line.
  let inPart = false
  state.doc.forEach((node, pos) => { if (pos < at && isSlideNode(node)) inPart = true })
  if (!inPart) return null

  const taken: string[] = []
  state.doc.forEach(node => {
    const id = isSlideNode(node) ? slideDataOf(node.attrs.kind, node.attrs.body).id : undefined
    if (id) taken.push(id)
  })
  const tr = state.tr
  // The heading right under the line is the new part's, and the slide's title, once. Typing `***` on an empty line over
  // a heading leaves an empty paragraph between them: it goes.
  let next = tr.doc.nodeAt(at + 1)
  const after = next ? tr.doc.nodeAt(at + 1 + next.nodeSize) : null
  if (next && next.type.name === 'paragraph' && next.childCount === 0 && isPartHeading(after)) {
    tr.delete(at + 1, at + 1 + next.nodeSize)
    next = tr.doc.nodeAt(at + 1)
  }
  const heading = isPartHeading(next) ? next : null
  // A two-line heading's break (#923) is a space in the title it gives.
  const title = heading ? heading.textBetween(0, heading.content.size, ' ', ' ').replace(/\s+/g, ' ').trim() : ''
  const id = newId(taken, random)
  const body = blockSlideBody({ id }, title ? `# ${headingMarkdown(title)}` : '')
  tr.replaceWith(at, at + 1, slideType.create({ kind: LINE_SLIDE_KIND, body, notes: null }))
  const start = at + 1
  if (heading) {
    // The caret at the end of the heading, ready to go on into the text.
    tr.setSelection(TextSelection.create(tr.doc, start + heading.nodeSize - 1))
    return tr.setMeta(DECK_OPERATION, true)
  }
  // No heading under the line: the new part opens with an empty one, for the person to write, and the caret goes there.
  const empty = emptyPartHeading(state, LINE_SLIDE_KIND)
  if (empty) {
    const following = tr.doc.nodeAt(start)
    if (following && following.type.name === 'paragraph' && following.childCount === 0) tr.setNodeMarkup(start, empty.type, empty.attrs)
    else tr.insert(start, empty)
    tr.setSelection(TextSelection.create(tr.doc, start + 1))
  }
  return tr.setMeta(DECK_OPERATION, true)
}

/** The plugin that makes a slide of a line the person puts in (the tests run it with the editor's own history). */
export function deckLinesPlugin(random: () => number = Math.random): Plugin {
  return new Plugin({
    key: deckLinesKey,
    appendTransaction(transactions, oldState, newState) {
      const own = transactions.filter(tr => tr.docChanged && !isTrustedDeckTransaction(tr) && tr.getMeta(DECK_DERIVED) !== true)
      if (own.length === 0 || own.some(pastedOrDropped)) return null
      return slidesFromLines(oldState.doc, newState, random)
    },
  })
}

// ---------------------------------------------------------------------------
// A slide with no title takes the first heading written in its part (16 November, the Experience lead)
// ---------------------------------------------------------------------------

/** Which slides wait for a title from their part's first heading, and which never will again (by slide id). */
export interface TitleWaiting {
  waiting: ReadonlySet<string>
  /** Slides that had a title once, or got one from a heading: "once" is per slide, for the whole session. */
  done: ReadonlySet<string>
}

export const firstHeadingTitleKey = new PluginKey<TitleWaiting>('deckFirstHeadingTitle')

/** A part's own heading, written (not drawn), with words: its text, and where it lies. */
function writtenHeadingOf(doc: PMNode, slidePos: number): { text: string; from: number; to: number } | null {
  const heading = partHeadingAt(doc, slidePos)
  if (!heading || heading.node.attrs.deckDrawn === true) return null
  const text = heading.node.textBetween(0, heading.node.content.size, ' ', ' ').replace(/\s+/g, ' ').trim()
  return text ? { text, from: heading.pos, to: heading.pos + heading.node.nodeSize } : null
}

/**
 * The slides waiting for a title from their part's first heading: a slide with no title, and never one before, whose
 * part's own heading the person just wrote or changed. Its title is set once the caret has left that heading (so a
 * heading typed letter by letter gives its whole words), and never again for that slide: a title is never overwritten,
 * and one the person clears stays cleared. A slide stops waiting when its heading is emptied, and on any change the
 * person didn't make (undo, redo, the host's updates, drawn headings), so a heading from an AI or the file never fills
 * a title.
 */
export function waitingAfter(state: TitleWaiting, tr: Transaction, before: PMNode, after: PMNode): TitleWaiting {
  if (!tr.docChanged) return state
  const person = !passes(tr)
  let done: Set<string> | null = null
  const waiting = new Set<string>()
  let beforeById: Map<string, number> | null = null
  for (const slide of slidesOf(after)) {
    const id = slide.data.id
    if (!id || state.done.has(id)) continue
    if ((slide.data.title ?? '').trim()) {
      done ??= new Set(state.done)
      done.add(id)
      continue
    }
    if (!person) continue
    const heading = writtenHeadingOf(after, slide.pos)
    if (!heading) continue
    if (state.waiting.has(id)) { waiting.add(id); continue }
    if (!beforeById) {
      beforeById = new Map()
      for (const entry of slidesOf(before)) if (entry.data.id) beforeById.set(entry.data.id, entry.pos)
    }
    const was = beforeById.get(id)
    if (heading.text !== (was === undefined ? '' : writtenHeadingOf(before, was)?.text ?? '')) waiting.add(id)
  }
  const sameWaiting = waiting.size === state.waiting.size && [...waiting].every(id => state.waiting.has(id))
  return sameWaiting && !done ? state : { waiting: sameWaiting ? state.waiting : waiting, done: done ?? state.done }
}

/** The titles of the waiting slides whose heading the caret has left, as one transaction; null when there are none. */
export function titlesFromHeadings(state: EditorState): Transaction | null {
  const titles = firstHeadingTitleKey.getState(state)
  if (!titles || titles.waiting.size === 0) return null
  const tr = state.tr
  const { from, to } = state.selection
  for (const slide of slidesOf(state.doc)) {
    const id = slide.data.id
    if (!id || !titles.waiting.has(id) || (slide.data.title ?? '').trim()) continue
    // A block slide's title is its own first heading (Sprint 161): the handout's heading gives one only to a slide with
    // no heading at all (a line's, a new Boxes slide's, PR 2), as its `# ` title over its blocks.
    const heading = writtenHeadingOf(state.doc, slide.pos)
    if (!heading || (from >= heading.from && to <= heading.to)) continue
    const markdown = (slide.data.markdown ?? '').replace(/^\s+/, '')
    const body = isBlockSlide(slide.kind)
      ? withBlockMarkdown(slide.node.attrs.body, `# ${headingMarkdown(heading.text)}${markdown ? `\n\n${markdown}` : ''}`)
      : writeSlideBody(slide.node.attrs.body, { ...slide.data, title: heading.text })
    tr.setNodeMarkup(slide.pos, undefined, { ...slide.node.attrs, body })
  }
  return tr.docChanged ? tr.setMeta(DECK_OPERATION, true) : null
}

/** The plugin that gives a slide with no title its part's first heading (the tests run it with the editor's history). */
export function firstHeadingTitlePlugin(): Plugin<TitleWaiting> {
  return new Plugin<TitleWaiting>({
    key: firstHeadingTitleKey,
    state: {
      init: () => ({ waiting: new Set<string>(), done: new Set<string>() }),
      apply: (tr, value, oldState, newState) => waitingAfter(value, tr, oldState.doc, newState.doc),
    },
    appendTransaction: (_transactions, _oldState, newState) => titlesFromHeadings(newState),
  })
}

export const DeckLines = Extension.create({
  name: 'deckLines',

  addKeyboardShortcuts() {
    return {
      // `***` (or `---`, `___`) and Enter on a line of its own at the top level is a line, as `*** ` is.
      Enter: ({ editor }) => {
        const { state } = editor
        const { $from, empty } = state.selection
        if (!empty || $from.depth !== 1 || $from.parent.type.name !== 'paragraph') return false
        if (!LINE_TEXT.test($from.parent.textContent) || $from.parentOffset !== $from.parent.content.size) return false
        if (!state.schema.nodes.horizontalRule) return false
        const from = $from.before()
        return editor.chain().command(({ tr }) => {
          // The line, then the caret in the block after it (a new paragraph at the end), as the `*** ` rule leaves it.
          tr.replaceWith(from, from + $from.parent.nodeSize, state.schema.nodes.horizontalRule.create())
          const after = from + 1
          if (!tr.doc.nodeAt(after)?.isTextblock) tr.insert(after, state.schema.nodes.paragraph.create())
          tr.setSelection(TextSelection.create(tr.doc, after + 1))
          return true
        }).run()
      },
    }
  },

  addProseMirrorPlugins() {
    return [deckLinesPlugin(), firstHeadingTitlePlugin()]
  },
})
