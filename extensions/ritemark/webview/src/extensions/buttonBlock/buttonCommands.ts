/**
 * Sprint 163 PR 3 (the decks README, "The Button block"): what the Button block's keys, its bar and its address sheet
 * do to an editor's document, a slide's or a Text document's. Pure ProseMirror, so the tests drive the same steps.
 *
 * Every change of the block carries `deckSlideCommand` (the slide editor's `SLIDE_COMMAND`): on a slide it is written to
 * the deck as an undo step of its own, so one ⌘Z takes the address, the new button or the deleted one back. A Text
 * document's history takes it as any change.
 */
import type { Node as PMNode, ResolvedPos, Schema } from '@tiptap/pm/model'
import { NodeSelection, Selection, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state'
import { buttonDestination, isButtonAddress } from '../../../../src/decks/blocks/buttonBlock'

/** The slide editor's meta for an undo step of its own (`slideCommands.SLIDE_COMMAND`, the same string). */
const OWN_STEP = 'deckSlideCommand'

/** Meta on the transaction that adds a button: its address sheet opens at once (`ButtonBlockTools`). */
export const BUTTON_ASK = 'buttonAskAddress'

export const BUTTON_NODE = 'buttonBlock'
export const BUTTON_WORDS_NODE = 'buttonWords'
export const BUTTON_LABEL_NODE = 'buttonLabel'

/** A new button: no words beside it, no words on it, no address yet (the sheet asks for it). */
export function buttonNode(schema: Schema): PMNode {
  return schema.nodes[BUTTON_NODE].create(null, [schema.nodes[BUTTON_WORDS_NODE].create(), schema.nodes[BUTTON_LABEL_NODE].create()])
}

/** A button and its place. */
export interface PlacedButton {
  pos: number
  node: PMNode
}

/** The button around a resolved place (the innermost), or null. */
function buttonAround($pos: ResolvedPos): PlacedButton | null {
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth)
    if (node.type.name === BUTTON_NODE) return { pos: $pos.before(depth), node }
  }
  return null
}

/** The chosen button: the one the selection is in (both its ends), or the one selected whole. Null otherwise. */
export function buttonAt(state: EditorState): PlacedButton | null {
  const selection = state.selection
  if (selection instanceof NodeSelection && selection.node.type.name === BUTTON_NODE) return { pos: selection.from, node: selection.node }
  const from = buttonAround(selection.$from)
  if (!from) return null
  const to = selection.empty ? from : buttonAround(selection.$to)
  return to && to.pos === from.pos ? from : null
}

/** The button at `pos`, when there is one. */
function buttonAtPos(state: EditorState, pos: number): PMNode | null {
  const node = state.doc.nodeAt(pos)
  return node && node.type.name === BUTTON_NODE ? node : null
}

/** Where the button's own words end (the caret goes there after its address is set): inside its label. */
export function labelEnd(node: PMNode, pos: number): number {
  const words = node.child(0)
  const label = node.child(1)
  return pos + 1 + words.nodeSize + 1 + label.content.size
}

/**
 * The address sheet's Done: the button at `pos` takes `typed` as its address (a full https one, else null: the sheet
 * says why), and the caret goes onto its words. Empty: the address stays as it was, and only the caret moves.
 */
export function setButtonAddress(state: EditorState, pos: number, typed: string): Transaction | null {
  const node = buttonAtPos(state, pos)
  if (!node) return null
  const href = typed.trim()
  const tr = state.tr
  if (href && href !== node.attrs.href) {
    if (!isButtonAddress(href)) return null
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, href, dest: buttonDestination(href, node.attrs.title ?? null) })
    tr.setMeta(OWN_STEP, true)
  } else if (href && !isButtonAddress(href)) {
    return null
  }
  const after = tr.doc.nodeAt(pos)!
  tr.setSelection(TextSelection.create(tr.doc, labelEnd(after, pos)))
  return tr
}

/** The bar's Delete: the button goes; a block that would be left empty keeps an empty line. */
export function deleteButton(state: EditorState, pos: number): Transaction | null {
  const node = buttonAtPos(state, pos)
  if (!node) return null
  const $pos = state.doc.resolve(pos)
  const tr = state.tr
  if ($pos.parent.childCount === 1) tr.replaceWith(pos, pos + node.nodeSize, state.schema.nodes.paragraph.create())
  else tr.delete(pos, pos + node.nodeSize)
  tr.setSelection(Selection.near(tr.doc.resolve(Math.min(pos, tr.doc.content.size)), -1))
  return tr.setMeta(OWN_STEP, true).scrollIntoView()
}

/**
 * Put a new button where the / was typed (`at`), in a Text document: in place of the empty line it stood on, else after
 * the line the caret is in. Never inside a table cell (a Markdown cell holds one line): after the table. The caret goes
 * into its words; the address sheet opens (`BUTTON_ASK`). The slide editor places its blocks its own way
 * (`insertSlideBlock`), with the same node and meta.
 */
export function insertButton(tr: Transaction, at: number): Transaction {
  const node = buttonNode(tr.doc.type.schema)
  const $pos = tr.doc.resolve(Math.max(0, Math.min(at, tr.doc.content.size)))
  let depth = $pos.depth
  for (let up = 1; up <= $pos.depth; up++) {
    if (typeof $pos.node(up).type.spec.tableRole === 'string') { depth = up - 1; break }
  }
  let placed = -1
  if (depth === $pos.depth && depth > 0 && $pos.parent.type.name === 'paragraph' && $pos.parent.content.size === 0) {
    const holder = $pos.node(depth - 1)
    const index = $pos.index(depth - 1)
    if (holder.canReplaceWith(index, index + 1, node.type)) {
      placed = $pos.before(depth)
      tr.replaceWith(placed, $pos.after(depth), node)
    }
  }
  for (let level = Math.min(depth, $pos.depth) - 1; placed < 0 && level >= 0; level--) {
    const index = $pos.index(level) + 1
    if (!$pos.node(level).canReplaceWith(index, index, node.type)) continue
    placed = $pos.after(level + 1)
    tr.insert(placed, node)
  }
  if (placed < 0) return tr
  tr.setSelection(TextSelection.create(tr.doc, placed + 2))
  return tr.setMeta(OWN_STEP, true).setMeta(BUTTON_ASK, true).scrollIntoView()
}

/** Where the caret is: in a button's words beside it, or on its button, with the button around it. */
function caretIn(state: EditorState): { where: 'words' | 'label'; button: PlacedButton; $from: ResolvedPos } | null {
  const { $from, empty } = state.selection
  if (!empty) return null
  const name = $from.parent.type.name
  if (name !== BUTTON_WORDS_NODE && name !== BUTTON_LABEL_NODE) return null
  const button = buttonAround($from)
  return button ? { where: name === BUTTON_WORDS_NODE ? 'words' : 'label', button, $from } : null
}

/**
 * Enter. In the button's words it ends them (the decks README): the caret goes to the line after the button, a new
 * empty one when nothing that takes words follows. In the words beside it, the caret goes on to the button's words.
 */
export function buttonEnter(state: EditorState): Transaction | null {
  const at = caretIn(state)
  if (!at) return null
  const { button } = at
  if (at.where === 'words') return state.tr.setSelection(TextSelection.create(state.doc, labelEnd(button.node, button.pos)))
  const after = button.pos + button.node.nodeSize
  const next = state.doc.resolve(after).nodeAfter
  const tr = state.tr
  if (next && next.isTextblock) return tr.setSelection(TextSelection.create(tr.doc, after + 1)).scrollIntoView()
  const $after = state.doc.resolve(after)
  const paragraph = state.schema.nodes.paragraph
  if (!$after.parent.canReplaceWith($after.index(), $after.index(), paragraph)) return tr.setSelection(Selection.near(tr.doc.resolve(after))).scrollIntoView()
  tr.insert(after, paragraph.create())
  return tr.setSelection(TextSelection.create(tr.doc, after + 1)).scrollIntoView()
}

/**
 * Backspace: at the start of the button's words, the caret goes back to the end of the words beside it (the block's two
 * parts never join). At the start of the words beside it, nothing: a button that holds nothing at all goes.
 */
export function buttonBackspace(state: EditorState): Transaction | null | 'stop' {
  const at = caretIn(state)
  if (!at || at.$from.parentOffset !== 0) return null
  const { button } = at
  if (at.where === 'label') return state.tr.setSelection(TextSelection.create(state.doc, button.pos + 1 + button.node.child(0).nodeSize - 1))
  if (!button.node.textContent && !button.node.attrs.href) return deleteButton(state, button.pos)
  return 'stop'
}

/** Delete: at the end of the words beside it, the caret goes on to the button's words; at the end of those, nothing. */
export function buttonDelete(state: EditorState): Transaction | null | 'stop' {
  const at = caretIn(state)
  if (!at || at.$from.parentOffset !== at.$from.parent.content.size) return null
  const { button } = at
  if (at.where === 'words') return state.tr.setSelection(TextSelection.create(state.doc, button.pos + 1 + button.node.child(0).nodeSize + 1))
  return 'stop'
}
