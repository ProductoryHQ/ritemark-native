/**
 * Sprint 143 (#513, R5): the formatting toolbar shows only while the editor or
 * the toolbar has the focus, so it never covers a comment's mention list.
 *
 * Run: npx tsx webview/src/components/formattingToolbar.test.ts
 */
import assert from 'node:assert/strict'
import { formattingToolbarShows } from './formattingToolbar'

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
assert.equal(formattingToolbarShows({ ...base, equationSelected: true }), false)

console.log('formattingToolbar: all passed')
