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
  /** A picture is selected (experience 49): it has its own bar, under it. */
  pictureSelected?: boolean
  /** The editor's view has the keyboard focus. */
  editorHasFocus: boolean
  /** The focus is inside the toolbar itself. */
  focusInToolbar: boolean
}): boolean {
  if (!input.editorHasFocus && !input.focusInToolbar) return false
  if (input.empty) return false
  if (input.inCodeBlock) return false
  if (input.equationSelected) return false
  if (input.pictureSelected) return false
  return true
}

/**
 * #687: the toolbar's focus rule, checked again right after a click on one of
 * its buttons. TipTap 2.27's BubbleMenu ignores the editor's next blur after a
 * press on the toolbar (`preventHide`, which keeps it up for its own buttons
 * and the link dialog) and checks `shouldShow` again only when the selection
 * or the document changes. So a button that moved the focus away without an
 * edit (Comment, bringing an open box forward) left the toolbar over the text.
 * True when neither the editor nor the toolbar has the focus: it hides.
 */
export function toolbarHidesAfterClick(input: { editorHasFocus: boolean; focusInToolbar: boolean }): boolean {
  return !input.editorHasFocus && !input.focusInToolbar
}

/**
 * Sprint 166 (#822): where a bubble that must leave its editor's frame goes: the app's React root (`#root`), not
 * `document.body`. React hears a press only inside the root it was mounted on, so a bubble in `body` drew its buttons
 * but their `onMouseDown` and `onClick` never ran: no B, I, heading, list or link changed the slide's words, and the
 * press blurred the slide. The root is outside the stage's scaled frame, so the bubble is still drawn at full size.
 */
export function bubbleHost(doc: { getElementById(id: string): Element | null; body: Element }): Element {
  return doc.getElementById('root') ?? doc.body
}
