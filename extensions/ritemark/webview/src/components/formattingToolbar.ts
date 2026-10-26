/**
 * When the formatting toolbar (FormattingBubbleMenu) shows. Pure, so it can be
 * tested without an editor.
 *
 * Sprint 143 (#513): the toolbar used to ask only for a non-empty selection
 * outside a code block, so it stayed up while a comment's box had the focus,
 * with the word still selected, and covered the mention list's first option
 * (@claude): the click landed on the toolbar. It now also asks for the focus,
 * as TipTap's own default does: the editor's, or the toolbar's own (its
 * buttons keep the editor's focus on mouse down anyway).
 */
export function formattingToolbarShows(input: {
  /** The selection is empty. */
  empty: boolean
  /** The selection is in a code block, which has its own controls. */
  inCodeBlock: boolean
  /** An equation is selected (Sprint 138): it has its own focus ring. */
  equationSelected: boolean
  /** The editor's view has the keyboard focus. */
  editorHasFocus: boolean
  /** The focus is inside the toolbar itself. */
  focusInToolbar: boolean
}): boolean {
  if (!input.editorHasFocus && !input.focusInToolbar) return false
  if (input.empty) return false
  if (input.inCodeBlock) return false
  if (input.equationSelected) return false
  return true
}
