/**
 * Sprint 148, PR 4 (R9): the pages' side of "a document opens at its passage".
 * The message decoded as untrusted text, the match landed on, and — in a real ProseMirror state with the
 * editor's search plugin and undo history — that opening the find bar on a match changes nothing in the
 * document and adds nothing to undo, including when the text arrives after the request.
 *
 * Run: npx tsx webview/src/utils/findRequest.test.ts
 */
import { strict as assert } from 'node:assert'
import { getSchema } from '@tiptap/core'
import { EditorState, type Transaction } from '@tiptap/pm/state'
import { history, undoDepth } from '@tiptap/pm/history'
import type { Plugin } from '@tiptap/pm/state'
import { SearchExtension, searchPluginKey } from '../extensions/SearchExtension'
import { createEditorSchemaExtensions } from './editorMarkdown'
import { MAX_FIND_TEXT, decodeFindOpen, isRequestQuery, landingIndex } from './findRequest'

let failures = 0
function test(name: string, run: () => void): void {
  try {
    run()
    console.log(`  ✓ ${name}`)
  } catch (error) {
    failures++
    console.error(`  ✗ ${name}\n    ${(error as Error).stack ?? (error as Error).message}`)
  }
}

console.log('decodeFindOpen')

test('a well-formed message: its text as sent, its occurrence, its page', () => {
  assert.deepEqual(decodeFindOpen({ type: 'find:open', text: 'Annual', occurrence: 3 }, 7), { text: 'Annual', occurrence: 3, id: 7 })
  assert.deepEqual(decodeFindOpen({ type: 'find:open', text: 'x', occurrence: 0, page: 30 }, 1), { text: 'x', occurrence: 0, page: 30, id: 1 })
})

test('anything else is ignored', () => {
  for (const message of [
    null,
    'find:open',
    { type: 'load', text: 'x' },
    { type: 'find:open' },
    { type: 'find:open', text: 42 },
    { type: 'find:open', text: '  ' },
    { type: 'find:open', text: 'a\u0000b' },
    { type: 'find:open', text: 'x'.repeat(MAX_FIND_TEXT + 1) },
  ]) {
    assert.equal(decodeFindOpen(message, 1), null, JSON.stringify(message))
  }
})

test('markup and pattern characters stay plain text; a bad occurrence or page is dropped', () => {
  const text = '<b onclick=x>(a|b)*</b>'
  const request = decodeFindOpen({ type: 'find:open', text, occurrence: -2, page: 0 }, 1)
  assert.deepEqual(request, { text, occurrence: 0, id: 1 })
})

console.log('landingIndex')

test('the occurrence; the last match when the page has fewer; -1 with none', () => {
  const request = { text: 'a', occurrence: 2, id: 1 }
  assert.equal(landingIndex(request, 5), 2)
  assert.equal(landingIndex(request, 2), 1)
  assert.equal(landingIndex(request, 0), -1)
})

test('PDF: the occurrence when it is on the passage’s page, else the first match at or after that page', () => {
  const pages = [1, 2, 3, 3, 5]
  const pageOf = (i: number) => pages[i]
  assert.equal(landingIndex({ text: 'a', occurrence: 3, page: 3, id: 1 }, pages.length, pageOf), 3)
  // The preview counted footers the index left out: occurrence 1 is on page 2, the passage on page 3.
  assert.equal(landingIndex({ text: 'a', occurrence: 1, page: 3, id: 1 }, pages.length, pageOf), 2)
  assert.equal(landingIndex({ text: 'a', occurrence: 9, page: 3, id: 1 }, pages.length, pageOf), 2)
  assert.equal(landingIndex({ text: 'a', occurrence: 9, page: 4, id: 1 }, pages.length, pageOf), 4)
  assert.equal(landingIndex({ text: 'a', occurrence: 0, page: 9, id: 1 }, pages.length, pageOf), 0, 'no match that late: the occurrence')
})

test('isRequestQuery: the same words, whatever their case or surrounding space; not other words', () => {
  const request = { text: 'Annual', occurrence: 0, id: 1 }
  assert.equal(isRequestQuery(request, ' annual '), true)
  assert.equal(isRequestQuery(request, 'annua'), false)
})

console.log('The Markdown editor: nothing in the document changes')

const schema = getSchema(createEditorSchemaExtensions())
type Ext = { config: { addProseMirrorPlugins: () => Plugin[]; addCommands: () => Record<string, (...args: unknown[]) => (props: { tr: Transaction; dispatch?: (tr: Transaction) => void }) => boolean> } }
const ext = SearchExtension as unknown as Ext
const plugins = ext.config.addProseMirrorPlugins.call({})
const commands = ext.config.addCommands.call({})

const para = (text: string) => schema.node('paragraph', null, text ? [schema.text(text)] : [])
const docOf = (...texts: string[]) => schema.node('doc', null, texts.map(para))

function run(state: EditorState, name: string, ...args: unknown[]): EditorState {
  let next = state
  commands[name](...args)({ tr: state.tr, dispatch: (tr) => { next = state.apply(tr) } })
  return next
}

test('find bar opened on the third "annual": the doc is the same node, undo is empty, the third is current', () => {
  let state = EditorState.create({ schema, doc: docOf('Annual report', 'The annual plan', 'Another annual report'), plugins: [history(), ...plugins] })
  const before = state.doc
  state = run(state, 'setSearchTerm', 'annual')
  assert.equal(searchPluginKey.getState(state)?.results.length, 3)
  state = run(state, 'goToSearchResult', 2)
  assert.equal(searchPluginKey.getState(state)?.activeIndex, 2)
  assert.equal(state.doc, before, 'the very same document')
  assert.equal(undoDepth(state), 0)
  state = run(state, 'goToSearchResult', 99)
  assert.equal(searchPluginKey.getState(state)?.activeIndex, 2, 'clamped to the last match')
  state = run(state, 'clearSearch')
  assert.equal(state.doc, before)
  assert.equal(undoDepth(state), 0)
})

test('the request before the text: the matches come when the text does, still without an undo step', () => {
  let state = EditorState.create({ schema, doc: docOf(''), plugins: [history(), ...plugins] })
  state = run(state, 'setSearchTerm', 'annual')
  assert.equal(searchPluginKey.getState(state)?.results.length, 0)
  // The editor's load: a content replace kept out of history, as the editor loads a file.
  const load = state.tr.replaceWith(0, state.doc.content.size, docOf('Annual', 'annual').content).setMeta('addToHistory', false)
  state = state.apply(load)
  assert.equal(searchPluginKey.getState(state)?.results.length, 2)
  const loaded = state.doc
  state = run(state, 'goToSearchResult', 1)
  assert.equal(searchPluginKey.getState(state)?.activeIndex, 1)
  assert.equal(state.doc, loaded)
  assert.equal(undoDepth(state), 0)
})

test('goToSearchResult with no matches is a no-op', () => {
  let state = EditorState.create({ schema, doc: docOf('Nothing here'), plugins: [history(), ...plugins] })
  state = run(state, 'setSearchTerm', 'annual')
  state = run(state, 'goToSearchResult', 0)
  assert.equal(searchPluginKey.getState(state)?.activeIndex, -1)
})

if (failures) {
  console.error(`\n${failures} failed`)
  process.exit(1)
}
console.log('\nall passed')
