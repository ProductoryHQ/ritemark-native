/**
 * A host update the editor applies structurally (Editor.tsx). Run with
 * `npx tsx webview/src/lib/documentUpdate.test.ts`.
 *
 * Found in Sprint 137: an agent removing the paragraph "An agent added this
 * paragraph." after "The agent's last paragraph." froze the editor at full CPU,
 * on main too. The diff from the front and the diff from the back overlapped
 * (both paragraphs end in " paragraph."), and `tr.replace` with an end before
 * its start never finished fitting.
 */
import { strict as assert } from 'node:assert'
import { EditorState } from '@tiptap/pm/state'
import { documentReplacement } from './documentUpdate'
import { openDocument } from '../utils/markdownFidelity'

const BASE = "# Doc two\n\nLine in doc two.\nAgent edit verified.\n\nThe agent's last paragraph.\n"
const ADDED = `${BASE}\nAn agent added this paragraph.\n`

function apply(fromText: string, toText: string): void {
  const current = openDocument(fromText).doc
  const next = openDocument(toText).doc
  const replacement = documentReplacement(current, next)
  assert.ok(replacement, 'the documents differ')
  assert.ok(replacement.from <= replacement.to, 'the range does not run backwards')
  const state = EditorState.create({ doc: current })
  const result = state.apply(state.tr.replace(replacement.from, replacement.to, replacement.slice)).doc
  assert.ok(result.eq(next), `the replacement reproduces the host's document: ${JSON.stringify(toText.slice(-40))}`)
}

{
  // The reported case: the overlap is real, and the raw diff runs backwards.
  const current = openDocument(ADDED).doc
  const next = openDocument(BASE).doc
  const start = current.content.findDiffStart(next.content)!
  const end = current.content.findDiffEnd(next.content)!
  assert.ok(end.b < start, 'ProseMirror\'s two diffs overlap here (the end is before the start)')
  apply(ADDED, BASE)
}

// The other directions and shapes.
apply(BASE, ADDED)
apply(BASE, BASE.replace('Line in doc two.', 'Line in doc 2.'))
apply('- a\n- a\n- a\n', '- a\n- a\n')
apply('- a\n- a\n', '- a\n- a\n- a\n')
apply('Same.\n\nSame.\n\nSame.\n', 'Same.\n\nSame.\n')
apply('One paragraph.\n\nTwo paragraph.\n', 'One paragraph.\n')
assert.equal(documentReplacement(openDocument(BASE).doc, openDocument(BASE).doc), null, 'equal documents need nothing')

console.log('documentUpdate.test.ts — all assertions passed')
