/**
 * Sprint 157: the handout can't break the deck file. Run with `npx tsx webview/src/components/decks/handout/deckGuard.test.ts`.
 */
import { strict as assert } from 'node:assert'
import { getSchema } from '@tiptap/core'
import { EditorState, NodeSelection, TextSelection } from '@tiptap/pm/state'
import { createEditorSchemaExtensions } from '../../../utils/editorMarkdown'
import { installTestDocument } from '../../../utils/markdownFidelity'
import { parseSlideBody } from '../../../../../src/decks/deckFormat'
import { DeckSlide } from './deckSchema'
import { DECK_OPERATION, guardFixes, isTrustedDeckTransaction, removesSlides } from './deckGuard'

installTestDocument()
const schema = getSchema(createEditorSchemaExtensions({ deck: [DeckSlide] }))
const slide = (id: string) => schema.nodes.deckSlide.create({ kind: 'points', body: `id: ${id}\ntitle: Slide ${id}`, notes: null })
const paragraph = (text: string) => schema.nodes.paragraph.create(null, text ? schema.text(text) : null)
const doc = schema.nodes.doc.create(null, [slide('aaaa'), paragraph('One'), slide('bbbb'), paragraph('Two')])
const state = EditorState.create({ doc })

// Backspace onto a selected slide, or a selection across a slide: refused.
{
  const deleteSlide = state.tr.setSelection(NodeSelection.create(doc, 0)).deleteSelection()
  assert.ok(removesSlides(doc, deleteSlide.doc))
  const across = state.tr.setSelection(TextSelection.create(doc, 3, doc.content.size - 2)).deleteSelection()
  assert.ok(removesSlides(doc, across.doc))
  // The person's typing in a part is fine.
  const typing = state.tr.insertText('!', 4)
  assert.ok(!removesSlides(doc, typing.doc))
}

// A slide moved inside a list item no longer starts a part: refused.
{
  const listItem = schema.nodes.listItem.create(null, [paragraph('item'), slide('cccc')])
  const list = schema.nodes.bulletList.create(null, [listItem])
  const buried = state.tr.insert(doc.content.size, list)
  assert.ok(removesSlides(doc, buried.doc))
}

// The host's updates, undo and the deck view's own operations are let through.
{
  assert.ok(isTrustedDeckTransaction(state.tr.setMeta('ritemarkDocumentRevision', 3)))
  assert.ok(isTrustedDeckTransaction(state.tr.setMeta('history$', { redo: false })))
  assert.ok(isTrustedDeckTransaction(state.tr.setMeta(DECK_OPERATION, true)))
  assert.ok(!isTrustedDeckTransaction(state.tr))
}

// A pasted copy of a slide gets a new id; the original keeps its own.
{
  const pasted = state.tr.insert(doc.content.size, slide('aaaa'))
  const fix = EditorState.create({ doc: pasted.doc }).tr
  assert.ok(guardFixes(doc, pasted.doc, fix, () => 0.5))
  const ids: string[] = []
  fix.doc.forEach(node => { if (node.type.name === 'deckSlide') ids.push(parseSlideBody(node.attrs.body).id!) })
  assert.deepEqual(ids, ['aaaa', 'bbbb', 'iiii'])
}

// A code block typed as `slide` or `notes` loses that language; other languages stay.
{
  const typed = state.tr.insert(doc.content.size, [
    schema.nodes.codeBlock.create({ language: 'slide' }, schema.text('x')),
    schema.nodes.codeBlock.create({ language: 'js' }, schema.text('y')),
  ])
  const fix = EditorState.create({ doc: typed.doc }).tr
  assert.ok(guardFixes(doc, typed.doc, fix))
  const languages: unknown[] = []
  fix.doc.forEach(node => { if (node.type.name === 'codeBlock') languages.push(node.attrs.language) })
  assert.deepEqual(languages, [null, 'js'])
  // Nothing to fix: no transaction.
  assert.ok(!guardFixes(doc, state.tr.insertText('!', 4).doc, EditorState.create({ doc }).tr))
}

console.log('deckGuard: passed')
