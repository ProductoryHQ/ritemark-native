/**
 * Sprint 163 PR 3 (the decks README, "The Button block"): what the Button block's keys, its bar and its address sheet
 * do to an editor's document, a slide's or a Text document's. Pure ProseMirror, so the tests drive the same steps.
 *
 * Every change of the block carries `deckSlideCommand` (the slide editor's `SLIDE_COMMAND`): on a slide it is written to
 * the deck as an undo step of its own, so one ⌘Z takes the address, the new button or the deleted one back. A Text
 * document's history takes it as any change.
 */
import type { Node as PMNode, ResolvedPos, Schema } from '@tiptap/pm/model'
import { closeHistory, undo, undoDepth } from '@tiptap/pm/history'
import { ReplaceStep } from '@tiptap/pm/transform'
import { NodeSelection, Selection, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state'
import { buttonDestination, isButtonAddress } from '../../../../src/decks/blocks/buttonBlock'
import { SLIDE_COMMAND, placeBlock } from '../blockPlacement'

/** The slide editor's meta for an undo step of its own. */
const OWN_STEP = SLIDE_COMMAND

/** Meta on the transaction that adds a button: its address sheet opens at once (`ButtonBlockTools`). */
export const BUTTON_ASK = 'buttonAskAddress'
/** Meta on the transaction that takes away a new button left without an address (`dropNewButton`): a slide writes it
 *  to the deck out of the undo history too. */
export const BUTTON_DROP = 'buttonDropNew'

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
 * A press on the button outside its words (#848: its icon, or the pill's edge): the caret goes to the end of the
 * button's own words, from `inside`, a place in them. Null when `inside` isn't in a button's words.
 */
export function caretOnLabel(state: EditorState, inside: number): Transaction | null {
  if (!Number.isInteger(inside) || inside < 0 || inside > state.doc.content.size) return null
  const $inside = state.doc.resolve(inside)
  const button = $inside.parent.type.name === BUTTON_LABEL_NODE ? buttonAround($inside) : null
  return button ? state.tr.setSelection(TextSelection.create(state.doc, labelEnd(button.node, button.pos))) : null
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
 * Put a new button where the / was typed (`at`), in a Text document, by the slide's own rule (`placeBlock`): in place of
 * the empty line it stood on, else after the line the caret is in; never inside a table cell (a Markdown cell holds one
 * line), but after the table. The caret goes into its words; the address sheet opens (`BUTTON_ASK`).
 */
export function insertButton(tr: Transaction, at: number): Transaction {
  const placed = placeBlock(tr, at, buttonNode(tr.doc.type.schema))
  if (placed < 0) return tr
  tr.setSelection(TextSelection.create(tr.doc, placed + 2))
  // An undo step of its own in a Text document (never joined to the typing before it), so a new button left without an
  // address can be taken back exactly (`takeBackNewButton`).
  closeHistory(tr)
  return tr.setMeta(OWN_STEP, true).setMeta(BUTTON_ASK, true).scrollIntoView()
}

/** The address sheet's width (`buttonBlock.css`: 360, never wider than the window less 8 a side). */
export function sheetWidth(windowWidth: number): number {
  return Math.max(0, Math.min(360, windowWidth - 16))
}

/**
 * Where the address sheet's left edge goes (the smoke run of 19 November; the Experience lead): under the button's card,
 * lined up with its left edge; where that would run past the editor's right edge (a card in a right-hand box), lined up
 * with the card's right edge instead. Never out of the editor's visible area (`bounds`, 8 in from the window's edges), so
 * Done is always in view.
 */
export function sheetLeft(card: { left: number; right: number }, width: number, bounds: { left: number; right: number }): number {
  const left = card.left + width <= bounds.right ? card.left : card.right - width
  return Math.max(bounds.left, Math.min(left, bounds.right - width))
}

/**
 * A new button left before it has an address (its sheet closed with Esc or a press elsewhere): taken away as if it had
 * never been added, so no empty button is written. Out of the undo history (`addToHistory: false`), so ⌘Z never brings
 * the empty button back. Null when the button has an address, or isn't there.
 */
export function dropNewButton(state: EditorState, pos: number): Transaction | null {
  const node = buttonAtPos(state, pos)
  if (!node || String(node.attrs.href ?? '')) return null
  const tr = deleteButton(state, pos)
  return tr ? tr.setMeta(OWN_STEP, false).setMeta('addToHistory', false).setMeta(BUTTON_DROP, true) : null
}

/**
 * A new button as it was added (`BUTTON_ASK`): where, the editor's undo depth just after it (0 with no history of its
 * own: a slide's, whose history is the deck's), and the `/` words its adding took away, if any.
 */
export interface NewButton {
  pos: number
  depth: number
  query: { from: number; to: number; text: string } | null
}

/** Read off the transaction that added a button, in the state just after it. */
export function newButtonOf(transaction: Transaction, after: EditorState, pos: number): NewButton {
  const first = transaction.steps[0]
  const query = first instanceof ReplaceStep && first.slice.size === 0 && first.from < first.to
    ? { from: first.from, to: first.to, text: transaction.docs[0].textBetween(first.from, first.to) }
    : null
  return { pos, depth: undoDepth(after), query }
}

/**
 * A new button left before it has an address (the smoke run of 19 November; the Experience lead: no dead ⌘Z). When
 * nothing has changed since it was added, its own undo step is undone, and the `/` words that step had taken away go
 * again, out of the history: no step is left, and the next ⌘Z brings back the person's last change. Otherwise (an edit
 * came in meanwhile, or the editor keeps no history) it goes as `dropNewButton` takes it; but when words were typed on
 * it or beside it (#848: they can be while its sheet is open), it goes as a step of its own, so ⌘Z brings it back with
 * them and nothing typed is lost. False: it was not there.
 */
export function takeBackNewButton(view: { state: EditorState; dispatch: (tr: Transaction) => void }, added: NewButton, exact: boolean): boolean {
  const node = buttonAtPos(view.state, added.pos)
  if (!node || String(node.attrs.href ?? '')) return false
  if (exact && added.depth > 0 && undoDepth(view.state) === added.depth && undo(view.state, view.dispatch)) {
    const query = added.query
    const state = view.state
    if (query && query.to <= state.doc.content.size && state.doc.textBetween(query.from, query.to) === query.text) {
      // The `/` words came back with that undo. Typed as a step of their own, they are undone too; typed with other
      // words, they go out of the history, and the step keeps the other words for the next ⌘Z.
      let typed: Transaction | null = null
      undo(state, tr => { typed = tr })
      const step = (typed as Transaction | null)?.steps.length === 1 ? (typed as unknown as Transaction).steps[0] : null
      if (typed && step instanceof ReplaceStep && step.from === query.from && step.to === query.to && step.slice.size === 0) view.dispatch(typed)
      else {
        const tr = state.tr.delete(query.from, query.to).setMeta('addToHistory', false)
        view.dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(query.from))))
      }
    }
    return true
  }
  if (node.textContent) {
    const gone = deleteButton(view.state, added.pos)
    if (!gone) return false
    // Never joined to the typing just before it: ⌘Z brings the button back with its words.
    closeHistory(gone)
    view.dispatch(gone)
    return true
  }
  const drop = dropNewButton(view.state, added.pos)
  if (!drop) return false
  view.dispatch(drop)
  return true
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
