/**
 * The handout is a Text document, and a line starts a new slide (README decision 12; Jarmo, 15 and 16 November).
 *
 * A line (a horizontal rule) the person puts in the handout at the top level of a part — `***` with a space or Enter,
 * `---`, or Divider from the / menu — becomes a slide there, in the same step, so one Undo takes it back:
 *
 *  - the new slide is a Statement with a new id, waiting for its layout (Jarmo, 15 November: "las ootab");
 *  - the heading right after the line becomes its title, once, as it is made; after that the two never change each other;
 *  - with no heading after the line, the new part opens with an empty H2 and the caret goes there.
 *
 * A line inside a list, a quote or any other block stays a line, and so does a line that arrives by paste or drop
 * (pasted text with lines in it isn't turned into slides in this cut), by undo or redo, or from the host. A slide
 * block is never saved as a line: it is the slide block that marks a new slide in the file.
 */
import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state'
import { newId, writeSlideBody } from '../../../../../src/decks/deckFormat'
import { DECK_DERIVED, DECK_OPERATION, emptyPartHeading, isSlideNode, slideDataOf } from '../deckDocument'
import { isTrustedDeckTransaction } from './deckGuard'

export const deckLinesKey = new PluginKey('deckLines')

/** The kind a slide made from a line has, until the person (or Claude, asked) lays it out. */
export const LINE_SLIDE_KIND = 'statement'

/** A line typed on an empty line of its own: `***`, `---` or `___`. */
const LINE_TEXT = /^(?:\*{3,}|-{3,}|_{3,})$/

/** Did this transaction come from a paste or a drop (whose lines stay lines in this cut)? */
function pastedOrDropped(tr: Transaction): boolean {
  const event = tr.getMeta('uiEvent')
  return tr.getMeta('paste') === true || event === 'paste' || event === 'drop'
}

/**
 * The slides made from the lines the person just put in at the top level, as one transaction on `state`; null when
 * there are none. `before` is the document before the person's transactions: a line that was there already (written
 * in the file, say) stays a line.
 */
export function slidesFromLines(before: PMNode, state: EditorState, random: () => number = Math.random): Transaction | null {
  const slideType = state.schema.nodes.deckSlide
  if (!slideType) return null
  const kept = new Set<PMNode>()
  before.forEach(node => kept.add(node))
  const lines: number[] = []
  state.doc.forEach((node, pos) => {
    if (node.type.name === 'horizontalRule' && !kept.has(node)) lines.push(pos)
  })
  if (lines.length === 0) return null
  const taken: string[] = []
  state.doc.forEach(node => {
    const id = isSlideNode(node) ? slideDataOf(node.attrs.body).id : undefined
    if (id) taken.push(id)
  })
  const tr = state.tr
  let caret: number | null = null
  // From the last line to the first, so the earlier lines' positions still hold.
  for (const at of [...lines].reverse()) {
    const next = tr.doc.nodeAt(at + 1)
    const heading = next && next.type.name === 'heading' ? next : null
    const title = heading ? heading.textContent.trim() : ''
    const id = newId(taken, random)
    taken.push(id)
    const body = writeSlideBody('', title ? { id, title } : { id })
    tr.replaceWith(at, at + 1, slideType.create({ kind: LINE_SLIDE_KIND, body, notes: null }))
    if (heading) continue
    // No heading after the line: the new part opens with an empty one, for the person to write.
    const after = at + 1
    const following = tr.doc.nodeAt(after)
    const empty = emptyPartHeading(state, LINE_SLIDE_KIND)
    if (!empty) continue
    if (following && following.type.name === 'paragraph' && following.childCount === 0) {
      tr.setNodeMarkup(after, empty.type, empty.attrs)
    } else {
      tr.insert(after, empty)
    }
    if (caret === null) caret = after + 1
  }
  if (caret !== null) tr.setSelection(TextSelection.create(tr.doc, caret))
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
          tr.replaceWith(from, from + $from.parent.nodeSize, state.schema.nodes.horizontalRule.create())
          return true
        }).run()
      },
    }
  },

  addProseMirrorPlugins() {
    return [deckLinesPlugin()]
  },
})
