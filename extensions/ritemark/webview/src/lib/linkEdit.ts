/**
 * The link dialog's edit, as one transaction (#502).
 *
 * Clicking a link leaves a collapsed cursor inside it, or at its edge. The
 * dialog's Update used to run `setLink` on that collapsed selection, which only
 * sets a mark for future typing: the link kept its old address. The edit now
 * works on the link's whole range, found inside the link or at either edge.
 */
import { getMarkRange } from '@tiptap/core'
import type { EditorState, Transaction } from '@tiptap/pm/state'

export interface LinkRange {
  from: number
  to: number
  href: string
}

/**
 * The link at a collapsed cursor: the one it is inside, or the one it touches
 * at either edge (a click at a link's last character can land after it).
 * `href` prefers that link when two touch. Null when there is none, or when
 * the selection is not collapsed (a real selection is the person's range).
 */
export function linkRangeAt(state: EditorState, href?: string): LinkRange | null {
  const type = state.schema.marks.link
  const { selection, doc } = state
  if (!type || !selection.empty) return null
  const at = (position: number, attributes?: Record<string, unknown>): LinkRange | null => {
    if (position < 0 || position > doc.content.size) return null
    const range = getMarkRange(doc.resolve(position), type, attributes)
    if (!range) return null
    const mark = doc.nodeAt(range.from)?.marks.find(candidate => candidate.type === type)
    return mark ? { ...range, href: String(mark.attrs.href ?? '') } : null
  }
  const wanted = href ? { href } : undefined
  return at(selection.from, wanted) ?? at(selection.from - 1, wanted)
    ?? (href ? at(selection.from) ?? at(selection.from - 1) : null)
}

/**
 * Apply the dialog: set `href` on the link's whole range (or the selection),
 * replacing its text when the person changed the display text. With nothing
 * to link — an empty selection outside any link and no display text — the
 * address applies to what is typed next, as `setLink` did.
 */
export function applyLinkEdit(
  state: EditorState,
  tr: Transaction,
  href: string,
  displayText: string,
  clickedHref?: string,
): boolean {
  const type = state.schema.marks.link
  if (!type) return false
  const range = linkRangeAt(state, clickedHref)
  const from = range ? range.from : state.selection.from
  const to = range ? range.to : state.selection.to
  const selectedText = from !== to ? state.doc.textBetween(from, to, ' ') : ''
  const mark = type.create({ href })
  tr.setMeta('preventAutolink', true)
  const text = displayText.trim()
  if (text && text !== selectedText) {
    const node = state.schema.text(text, [mark])
    if (from !== to) tr.replaceWith(from, to, node)
    else tr.insert(from, node)
    return true
  }
  if (from === to) {
    tr.addStoredMark(mark)
    return true
  }
  tr.removeMark(from, to, type).addMark(from, to, mark)
  return true
}
