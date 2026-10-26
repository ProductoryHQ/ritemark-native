/**
 * The link dialog's Update changes the link (#502). Run with
 * `npx tsx webview/src/lib/linkEdit.test.ts`.
 *
 * Clicking a link leaves a collapsed cursor inside it, or at its edge; the
 * dialog's Update used to set the new address only for future typing. These
 * run the dialog's own edit (`applyLinkEdit`) on the editor's schema, and save
 * the result the way the editor does.
 */
import { strict as assert } from 'node:assert'
import { EditorState, TextSelection } from '@tiptap/pm/state'
import { applyLinkEdit, linkRangeAt } from './linkEdit'
import { editorMarkdown, openDocument } from '../utils/markdownFidelity'

const SOURCE = 'Read the [old report](https://example.com/old) today.\n'
const opened = openDocument(SOURCE)
// + 1 for the paragraph's opening position
const linkStart = opened.doc.textContent.indexOf('old report') + 1
const linkEnd = linkStart + 'old report'.length

function stateAt(from: number, to = from): EditorState {
  const state = EditorState.create({ doc: opened.doc })
  return state.apply(state.tr.setSelection(TextSelection.create(state.doc, from, to)))
}

function edit(from: number, to: number, href: string, displayText: string, clickedHref?: string): string {
  const state = stateAt(from, to)
  const tr = state.tr
  assert.equal(applyLinkEdit(state, tr, href, displayText, clickedHref), true)
  return editorMarkdown(state.apply(tr).doc)
}

// The usual case: same text, new address, from a click inside the link.
assert.equal(
  edit(linkStart + 3, linkStart + 3, 'https://example.com/new', 'old report', 'https://example.com/old'),
  'Read the [old report](https://example.com/new) today.',
  'a collapsed cursor inside the link updates the whole link',
)
// A click at the link's last character can land after it.
assert.equal(
  edit(linkEnd, linkEnd, 'https://example.com/new', 'old report', 'https://example.com/old'),
  'Read the [old report](https://example.com/new) today.',
  'a cursor at the link\'s end edge updates it too',
)
assert.equal(
  edit(linkStart, linkStart, 'https://example.com/new', 'old report', 'https://example.com/old'),
  'Read the [old report](https://example.com/new) today.',
  'and at its start edge',
)
// A selection spanning the link.
assert.equal(
  edit(linkStart, linkEnd, 'https://example.com/new', 'old report'),
  'Read the [old report](https://example.com/new) today.',
  'a selection over the link updates it',
)
// New display text replaces the link's text.
assert.equal(
  edit(linkStart + 3, linkStart + 3, 'https://example.com/new', 'new report', 'https://example.com/old'),
  'Read the [new report](https://example.com/new) today.',
  'new display text replaces the text',
)
// S28: a link into a folder can be set from the dialog (R6).
assert.equal(
  edit(linkStart + 3, linkStart + 3, 'notes/report.md', 'old report', 'https://example.com/old'),
  'Read the [old report](notes/report.md) today.',
  'the dialog can set a link into a folder',
)
// The range, which also decides the dialog's title: the edge counts as on the link.
assert.deepEqual(
  linkRangeAt(stateAt(linkEnd), 'https://example.com/old'),
  { from: linkStart, to: linkEnd, href: 'https://example.com/old' },
)
assert.equal(linkRangeAt(stateAt(2)), null, 'plain text is no link')
assert.equal(linkRangeAt(stateAt(linkStart, linkEnd)), null, 'a real selection is the person\'s own range')
// Plain text and no display text: the address is for what is typed next, as before.
{
  const state = stateAt(2)
  const tr = state.tr
  applyLinkEdit(state, tr, 'https://example.com/x', '')
  assert.equal(editorMarkdown(state.apply(tr).doc), SOURCE.trim(), 'nothing in the document changes')
  assert.ok(tr.storedMarks?.some(mark => mark.type.name === 'link'), 'the link mark waits for typing')
}

console.log('linkEdit.test.ts — all assertions passed')
