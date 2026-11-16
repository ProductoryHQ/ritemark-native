/**
 * 16 November: the handout is a Text document, and a line starts a new slide. Run with
 * `npx tsx webview/src/components/decks/handout/deckLines.test.ts`.
 *
 * The editor's own pieces as the deck view runs them: the schema with the slide node, the history, the guard and the
 * line's plugin, and the save through the editor's own Markdown pipeline.
 */
import { strict as assert } from 'node:assert'
import { getSchema } from '@tiptap/core'
import { EditorState, TextSelection, type Transaction } from '@tiptap/pm/state'
import { history, undo } from '@tiptap/pm/history'
import { joinBackward, selectNodeBackward, deleteSelection, chainCommands } from '@tiptap/pm/commands'
import type { Node as PMNode } from '@tiptap/pm/model'
import { createEditorSchemaExtensions } from '../../../utils/editorMarkdown'
import { editorMarkdown, installTestDocument } from '../../../utils/markdownFidelity'
import { parseSlideBody } from '../../../../../src/decks/deckFormat'
import { DeckSlide } from './deckSchema'
import { deckGuardPlugin } from './deckGuard'
import { deckLinesPlugin } from './deckLines'

installTestDocument()
const schema = getSchema(createEditorSchemaExtensions({ deck: [DeckSlide] }))
const slide = (id: string, title: string, kind = 'points') => schema.nodes.deckSlide.create({ kind, body: `id: ${id}\ntitle: ${title}`, notes: null })
const paragraph = (text: string) => schema.nodes.paragraph.create(null, text ? schema.text(text) : null)
const heading = (level: number, text: string) => schema.nodes.heading.create({ level }, text ? schema.text(text) : null)
const line = () => schema.nodes.horizontalRule.create()

/** A state with the deck's plugins; the line's plugin draws ids from a fixed sequence. */
function stateOf(nodes: PMNode[]): EditorState {
  let seed = 0
  const random = () => ((seed++ * 7) % 36) / 36
  return EditorState.create({ doc: schema.nodes.doc.create(null, nodes), plugins: [history(), deckGuardPlugin(), deckLinesPlugin(random)] })
}

const slides = (doc: PMNode) => {
  const found: PMNode[] = []
  doc.forEach(node => { if (node.type.name === 'deckSlide') found.push(node) })
  return found
}

/** Where the top-level block `index` starts. */
function posOf(doc: PMNode, index: number): number {
  let pos = 0
  for (let at = 0; at < index; at++) pos += doc.child(at).nodeSize
  return pos
}

/** The input rule's own step: the paragraph it was typed in becomes a line with an empty paragraph after it. */
function typeLine(state: EditorState, blockIndex: number): EditorState {
  const from = posOf(state.doc, blockIndex)
  const to = from + state.doc.child(blockIndex).nodeSize
  return state.apply(state.tr.replaceWith(from, to, [line(), paragraph('')]))
}

const before = [slide('aaaa', 'One'), heading(2, 'One'), paragraph('First words.'), paragraph('---'), paragraph('Still in one.')]

// A line typed at the top level of a part makes a Statement slide there, in one undo step. With no heading after the
// line, the new part opens with an empty H2 (where the caret goes) and the slide has no title.
{
  const state = stateOf(before)
  const next = typeLine(state, 3)
  const made = slides(next.doc)
  assert.equal(made.length, 2, 'the line is a slide now')
  assert.equal(made[1].attrs.kind, 'statement')
  const data = parseSlideBody(made[1].attrs.body)
  assert.match(data.id ?? '', /^[a-z][0-9a-z]{3}$/)
  assert.notEqual(data.id, 'aaaa')
  assert.equal(data.title, undefined, 'no heading after the line: no title')
  let lines = 0
  next.doc.descendants(node => { if (node.type.name === 'horizontalRule') lines++ })
  assert.equal(lines, 0, 'the line is never kept as a line')
  const $caret = next.selection.$from
  assert.equal($caret.parent.type.name, 'heading', 'the caret is in the new part\'s heading')
  assert.equal($caret.parent.attrs.level, 2)
  // The bytes: the first part as it was, then the new slide's block, its empty heading (not written), its words.
  assert.equal(editorMarkdown(next.doc), [
    '```slide points\nid: aaaa\ntitle: One\n```',
    '## One',
    'First words.',
    `\`\`\`slide statement\nid: ${data.id}\n\`\`\``,
    'Still in one.',
  ].join('\n\n'))
  // Undo takes the line and the slide back at once.
  let undone: EditorState = next
  undo(next, (tr: Transaction) => { undone = next.apply(tr) })
  assert.equal(slides(undone.doc).length, 1, 'one undo: the slide is gone')
  assert.equal(undone.doc.child(3).textContent, '---', 'and the line typed is back as it was typed')
}

// The heading right after the line becomes the slide's title, once. Typing in the heading later changes only the
// heading; the slide block's bytes stay.
{
  const state = stateOf([slide('aaaa', 'One'), heading(2, 'One'), paragraph('Words.'), paragraph('***'), heading(2, 'Two'), paragraph('More.')])
  const from = posOf(state.doc, 3)
  const next = state.apply(state.tr.replaceWith(from, from + state.doc.child(3).nodeSize, line()))
  const made = slides(next.doc)
  assert.equal(made.length, 2)
  assert.equal(parseSlideBody(made[1].attrs.body).title, 'Two', 'the heading after the line is its title')
  const blockBefore = made[1].attrs.body
  // The heading is edited afterwards: the slide keeps its title, byte for byte.
  let headingPos = -1
  next.doc.forEach((node, pos) => { if (node.type.name === 'heading' && node.textContent === 'Two') headingPos = pos })
  const typed = next.apply(next.tr.insertText(' and three', headingPos + 4))
  assert.equal(slides(typed.doc)[1].attrs.body, blockBefore, 'a heading edit leaves the slide block as it was')
  assert.ok(editorMarkdown(typed.doc).includes('## Two and three'))
}

// A line inside a list, a quote or a code block stays a line (or text); so does a pasted one.
{
  const state = stateOf([slide('aaaa', 'One'), heading(2, 'One'), paragraph('x')])
  const end = state.doc.content.size
  const inList = state.apply(state.tr.insert(end, schema.nodes.bulletList.create(null, [schema.nodes.listItem.create(null, [paragraph('item'), line()])])))
  assert.equal(slides(inList.doc).length, 1, 'a line in a list stays a line')
  const inQuote = state.apply(state.tr.insert(end, schema.nodes.blockquote.create(null, [paragraph('quoted'), line()])))
  assert.equal(slides(inQuote.doc).length, 1, 'a line in a quote stays a line')
  const inCode = state.apply(state.tr.insert(end, schema.nodes.codeBlock.create(null, schema.text('***\n---'))))
  assert.equal(slides(inCode.doc).length, 1, 'a line in a code block is its text')
  const pasted = state.apply(state.tr.insert(end, [line(), paragraph('pasted')]).setMeta('paste', true).setMeta('uiEvent', 'paste'))
  assert.equal(slides(pasted.doc).length, 1, 'a pasted line stays a line in this cut')
}

// A line already in the file stays a line when the person types elsewhere.
{
  const state = stateOf([slide('aaaa', 'One'), heading(2, 'One'), paragraph('x'), line(), paragraph('y')])
  const typed = state.apply(state.tr.insertText('!', 6))
  assert.equal(slides(typed.doc).length, 1)
}

// Backspace at the start of the part after a line (until joining is built): the slide stays. The first Backspace
// selects the slide, the second is refused; nothing in the file's slide blocks changes.
{
  let state = typeLine(stateOf(before), 3)
  const count = slides(state.doc).length
  const blocks = slides(state.doc).map(node => node.attrs.body)
  const saved = editorMarkdown(state.doc)
  // The caret at the start of the new part's heading (right after the slide).
  let at = -1
  state.doc.forEach((node, pos) => { if (at < 0 && node.type.name === 'deckSlide' && node.attrs.kind === 'statement') at = pos + node.nodeSize + 1 })
  state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, at)))
  const backspace = chainCommands(deleteSelection, joinBackward, selectNodeBackward)
  for (let press = 0; press < 3; press++) {
    backspace(state, tr => { state = state.apply(tr) })
  }
  assert.equal(slides(state.doc).length, count, 'the slide count is unchanged')
  assert.deepEqual(slides(state.doc).map(node => node.attrs.body), blocks, 'and its block')
  assert.ok(editorMarkdown(state.doc).includes('```slide statement'), 'the slide block is still in the file')
  assert.equal(editorMarkdown(state.doc).split('```slide').length, saved.split('```slide').length)
}

console.log('deckLines: passed')
