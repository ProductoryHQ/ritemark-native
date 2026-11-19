/**
 * Sprint 143 (#513, R5): the formatting toolbar shows only while the editor or
 * the toolbar has the focus, so it never covers a comment's mention list.
 *
 * Run: npx tsx webview/src/components/formattingToolbar.test.ts
 */
import assert from 'node:assert/strict'
import { bubbleHost, formattingToolbarShows, toolbarHidesAfterClick } from './formattingToolbar'

const base = { empty: false, inCodeBlock: false, equationSelected: false, editorHasFocus: true, focusInToolbar: false }

// Text selected in the editor: the toolbar shows, as before.
assert.equal(formattingToolbarShows(base), true)
// A press on one of its own buttons: still shows.
assert.equal(formattingToolbarShows({ ...base, editorHasFocus: false, focusInToolbar: true }), true)
// #513: Comment chosen, the comment's box takes the focus, the word is still selected: the toolbar goes.
assert.equal(formattingToolbarShows({ ...base, editorHasFocus: false, focusInToolbar: false }), false)
// The rules that were there stay.
assert.equal(formattingToolbarShows({ ...base, empty: true }), false)
assert.equal(formattingToolbarShows({ ...base, inCodeBlock: true }), false)
// Experience 49: never over a picture; the picture's own bar opens under it.
assert.equal(formattingToolbarShows({ ...base, pictureSelected: true }), false)
assert.equal(formattingToolbarShows({ ...base, equationSelected: true }), false)

// #687: the re-check right after a click on a toolbar button.
// Comment brought an open box with unsaved words forward: the focus is in the box, so the toolbar hides.
assert.equal(toolbarHidesAfterClick({ editorHasFocus: false, focusInToolbar: false }), true)
// Bold, a heading, a new comment, or Link before its dialog takes the focus: the editor keeps it, the toolbar stays.
assert.equal(toolbarHidesAfterClick({ editorHasFocus: true, focusInToolbar: false }), false)
// The focus on the toolbar itself (keyboard use, or its own padding): it stays.
assert.equal(toolbarHidesAfterClick({ editorHasFocus: false, focusInToolbar: true }), false)
// The re-check and the show rule agree on focus.
for (const editorHasFocus of [true, false]) {
  for (const focusInToolbar of [true, false]) {
    assert.equal(
      toolbarHidesAfterClick({ editorHasFocus, focusInToolbar }),
      !formattingToolbarShows({ ...base, editorHasFocus, focusInToolbar }),
    )
  }
}

// #822: the slide's bubble leaves the scaled frame into the app's React root, never `document.body`, where React
// hears none of its buttons (none of B, I, H1–H3, the lists, quote, code or link changed the slide's words).
{
  const root = { id: 'root' } as unknown as Element
  const body = { id: 'body' } as unknown as Element
  const doc = { getElementById: (id: string) => (id === 'root' ? root : null), body }
  assert.equal(bubbleHost(doc), root, 'the bubble goes into the React root')
  assert.notEqual(bubbleHost(doc), body)
  // A page without the app's root (none today) still gets a place to draw it.
  assert.equal(bubbleHost({ getElementById: () => null, body }), body)
}

// #846: the bubble steps aside while its Link dialog is open, on a slide and in the Text editor alike.
// Open: never shows, whatever the focus and selection (the dialog's input has the focus, the words stay selected).
for (const editorHasFocus of [true, false]) {
  for (const focusInToolbar of [true, false]) {
    assert.equal(formattingToolbarShows({ ...base, editorHasFocus, focusInToolbar, linkDialogOpen: true }), false)
  }
}
assert.equal(formattingToolbarShows({ ...base, linkDialogOpen: false }), true, 'closed: the rule as before')
// Closed again: the editor has the focus back and the words are still selected, so it shows (Cancel or Esc).
assert.equal(formattingToolbarShows({ ...base, editorHasFocus: true, linkDialogOpen: false }), true)

console.log('formattingToolbar: all passed')
