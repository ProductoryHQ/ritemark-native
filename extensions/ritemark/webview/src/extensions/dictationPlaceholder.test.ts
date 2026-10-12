/**
 * Sprint 129 R12 — dictation's note is a decoration, not document text.
 *
 * Ritemark autosaves a second after each edit; a text placeholder was saved into
 * the file for the whole "speak, then text" recording. These tests run the plugin
 * on a real ProseMirror state built from the editor's schema (no DOM needed).
 *
 * Run with `npx tsx webview/src/extensions/dictationPlaceholder.test.ts`.
 */
import assert from 'node:assert/strict'
import { getSchema } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { EditorState, TextSelection } from '@tiptap/pm/state'
import { dictationPlaceholderKey, dictationPlaceholderPlugin, dictationPlaceholderPos } from './DictationPlaceholder'

const schema = getSchema([StarterKit])
const doc = schema.node('doc', null, [schema.node('paragraph', null, [schema.text('Text goes here: ')])])
let state = EditorState.create({ schema, doc, plugins: [dictationPlaceholderPlugin()] })
const end = doc.content.size - 1 // the end of the paragraph's text
state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, end)))

const show = (text: string) => { state = state.apply(state.tr.setMeta(dictationPlaceholderKey, { pos: dictationPlaceholderPos(state) ?? state.selection.from, text })) }
const before = state.doc

show('🎤 Recording... your text appears after you stop')
assert.equal(dictationPlaceholderPos(state), end, 'shown at the cursor')
assert.ok(state.doc.eq(before), 'the document is unchanged, so nothing is saved')
assert.equal(state.doc.textContent, 'Text goes here: ')

show('⏳ Processing your recording. This usually takes about 20 seconds.')
assert.equal(dictationPlaceholderPos(state), end, 'a new text keeps the position')

// The user types earlier in the paragraph: the note moves with its text.
state = state.apply(state.tr.insertText('My ', 1))
assert.equal(dictationPlaceholderPos(state), end + 3)

// Dictated text inserted at the note goes in front of it.
const at = dictationPlaceholderPos(state)!
state = state.apply(state.tr.insertText('Tere. ', at))
assert.equal(state.doc.textContent, 'My Text goes here: Tere. ')
assert.equal(dictationPlaceholderPos(state), at + 'Tere. '.length, 'the note follows the new words')

state = state.apply(state.tr.setMeta(dictationPlaceholderKey, { pos: null, text: null }))
assert.equal(dictationPlaceholderPos(state), null)
assert.equal(state.doc.textContent, 'My Text goes here: Tere. ', 'clearing leaves the text alone')

console.log('dictationPlaceholder.test.ts: all tests passed')
