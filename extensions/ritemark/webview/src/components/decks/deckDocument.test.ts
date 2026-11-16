/**
 * Sprint 157: the strip's operations and the change of kind. Run with `npx tsx webview/src/components/decks/deckDocument.test.ts`.
 */
import { strict as assert } from 'node:assert'
import { getSchema } from '@tiptap/core'
import { EditorState } from '@tiptap/pm/state'
import type { Node as PMNode } from '@tiptap/pm/model'
import { createEditorSchemaExtensions } from '../../utils/editorMarkdown'
import { editorMarkdown, installTestDocument } from '../../utils/markdownFidelity'
import { DeckSlide } from './handout/deckSchema'
import { removesSlides } from './handout/deckGuard'
import { DEFAULT_RATIO, initialRatio } from './deckDocument'
import { deckDecorations } from './handout/deckCurrent'
import { DECK_OPERATION, deleteSlide, duplicateSlide, handoutHasText, insertSlide, moveSlide, partContent, partIndexAt, partRange, restoreSlide, slidesOf, updateSlide } from './deckDocument'
import { convertKind, hiddenNote } from './slide/convertKind'

installTestDocument()
const schema = getSchema(createEditorSchemaExtensions({ deck: [DeckSlide] }))
const slide = (id: string, title: string) => schema.nodes.deckSlide.create({ kind: 'points', body: `id: ${id}\ntitle: ${title}`, notes: null })
const paragraph = (text: string) => schema.nodes.paragraph.create(null, schema.text(text))
const doc = schema.nodes.doc.create(null, [
  paragraph('Preamble'),
  slide('aaaa', 'A'), paragraph('a text'),
  slide('bbbb', 'B'), paragraph('b text'), paragraph('b more'),
  slide('cccc', 'C'), paragraph('c text'),
])
const state = EditorState.create({ doc })
const order = (next: PMNode) => {
  const out: string[] = []
  next.forEach(node => out.push(node.type.name === 'deckSlide' ? `[${(node.attrs.body as string).split('title: ')[1]}]` : node.textContent))
  return out
}

// Parts and where a position falls.
assert.deepEqual(partRange(doc, 1), { from: slidesOf(doc)[1].pos, to: slidesOf(doc)[2].pos })
assert.equal(partIndexAt(doc, 1), null, 'the preamble is no part')
assert.equal(partIndexAt(doc, slidesOf(doc)[1].pos + 3), 1)

// Move a part, with its handout, down and up; one transaction each, marked as the deck view's own.
{
  const down = moveSlide(state, 0, 3)!
  assert.equal(down.getMeta(DECK_OPERATION), true)
  assert.deepEqual(order(down.doc), ['Preamble', '[B]', 'b text', 'b more', '[C]', 'c text', '[A]', 'a text'])
  const up = moveSlide(state, 2, 0)!
  assert.deepEqual(order(up.doc), ['Preamble', '[C]', 'c text', '[A]', 'a text', '[B]', 'b text', 'b more'])
  assert.equal(moveSlide(state, 1, 1), null)
  assert.equal(moveSlide(state, 1, 2), null, 'before the next one is where it is')
  assert.ok(!removesSlides(doc, down.doc))
}

// Duplicate: the part after itself, its slide with a new id; the handout copied too.
{
  const tr = duplicateSlide(state, 1, () => 0.5)!
  assert.deepEqual(order(tr.doc), ['Preamble', '[A]', 'a text', '[B]', 'b text', 'b more', '[B]', 'b text', 'b more', '[C]', 'c text'])
  assert.deepEqual(slidesOf(tr.doc).map(entry => entry.data.id), ['aaaa', 'bbbb', 'niii', 'cccc'])
}

// Delete: the slide and its handout; never the last slide.
{
  const tr = deleteSlide(state, 1)!
  assert.deepEqual(order(tr.doc), ['Preamble', '[A]', 'a text', '[C]', 'c text'])
  // The delete's Undo puts the part itself back, after a later change too.
  const content = partContent(doc, 1)!
  const later = EditorState.create({ doc: tr.doc }).tr.insertText('!', slidesOf(tr.doc)[0].pos + slidesOf(tr.doc)[0].node.nodeSize + 1)
  const back = restoreSlide(EditorState.create({ doc: later.doc }), 1, content)
  assert.deepEqual(order(back.doc), ['Preamble', '[A]', '!a text', '[B]', 'b text', 'b more', '[C]', 'c text'])
  const one = EditorState.create({ doc: schema.nodes.doc.create(null, [slide('aaaa', 'A')]) })
  assert.equal(deleteSlide(one, 0), null)
}

// Insert: a new empty slide (and a paragraph for its text) before a part, or at the end.
{
  const tr = insertSlide(state, 1, 'boxes', () => 0.5)!
  const kinds = slidesOf(tr.doc).map(entry => entry.kind)
  assert.deepEqual(kinds, ['points', 'boxes', 'points', 'points'])
  assert.equal(slidesOf(tr.doc)[1].data.id, 'niii')
  const end = insertSlide(state, 3, 'exercise')!
  assert.equal(slidesOf(end.doc)[3].kind, 'exercise')
  const first = insertSlide(state, 0, 'points')!
  assert.deepEqual(order(first.doc).slice(0, 2), ['Preamble', '[undefined]'], 'before slide 1 is after the preamble')
}

// Update: the data written line by line, and the kind.
{
  const tr = updateSlide(state, 2, { id: 'cccc', title: 'C!', skip: true }, 'boxes')!
  assert.equal(slidesOf(tr.doc)[2].kind, 'boxes')
  assert.equal(slidesOf(tr.doc)[2].node.attrs.body, 'id: cccc\ntitle: C!\nskip: true')
  assert.equal(updateSlide(state, 2, { id: 'cccc', title: 'C' }), null, 'no change, no transaction')
  assert.ok(editorMarkdown(tr.doc).includes('```slide boxes\nid: cccc\ntitle: C!\nskip: true\n```'))
}

// A change of layout keeps the words (README frame 4).
{
  const boxes = { title: 'T', items: [{ heading: 'One', text: 'a' }, { heading: 'Two' }, { heading: 'Three' }] }
  const table = convertKind(boxes, 'table')
  assert.deepEqual(table.rows, [['', ''], ['One', 'a'], ['Two', ''], ['Three', '']])
  assert.deepEqual(table.items, boxes.items, 'the items stay for the way back')
  assert.deepEqual(convertKind(table, 'boxes').items, boxes.items, 'and going back loses nothing')
  assert.deepEqual(convertKind({ title: 'T', rows: [['H', 'X'], ['a', 'b'], ['c', '']] }, 'points').items, [{ heading: 'a', text: 'b' }, { heading: 'c' }])
  assert.deepEqual(convertKind({ title: 'T', subtitle: 'S' }, 'boxes').items, [{ heading: 'S' }])
  assert.equal(convertKind({ title: 'T' }, 'section').number, '1')
  assert.equal(hiddenNote('columns', boxes), '1 more item is kept for other layouts')
  assert.equal(hiddenNote('title', boxes), '3 items are kept for other layouts')
  assert.equal(hiddenNote('boxes', boxes), '')
}

// The start card (16 November): a new deck's handout holds nothing but an empty paragraph; a word, a line or a list is
// handout text. The slide's title is in its node and never counts.
{
  const empty = schema.nodes.doc.create(null, [slide('aaaa', 'The deck title typed'), schema.nodes.paragraph.create()])
  assert.equal(handoutHasText(empty), false)
  const spaces = schema.nodes.doc.create(null, [slide('aaaa', 'T'), schema.nodes.paragraph.create(null, [schema.text('  '), schema.nodes.hardBreak.create()])])
  assert.equal(handoutHasText(spaces), false, 'blanks and a line break are no text')
  assert.equal(handoutHasText(schema.nodes.doc.create(null, [slide('aaaa', 'T'), paragraph('Welcome')])), true)
  assert.equal(handoutHasText(schema.nodes.doc.create(null, [slide('aaaa', 'T'), schema.nodes.horizontalRule.create()])), true)
  assert.equal(handoutHasText(doc), true)
}

// 16 November: a part's own heading is its heading, not its text: typing it keeps the start card.
{
  const heading = (level: number, text: string) => schema.nodes.heading.create({ level }, text ? schema.text(text) : null)
  assert.equal(handoutHasText(schema.nodes.doc.create(null, [slide('aaaa', 'T'), heading(2, 'Welcome'), schema.nodes.paragraph.create()])), false)
  assert.equal(handoutHasText(schema.nodes.doc.create(null, [slide('aaaa', 'T'), heading(2, 'Welcome'), paragraph('Words.')])), true)
  assert.equal(handoutHasText(schema.nodes.doc.create(null, [slide('aaaa', 'T'), heading(3, 'Smaller')])), true, 'an H3 is text')
  // A new part is its slide and room for its words: its heading is drawn by the view (drawnHeadings.ts), following
  // the title typed on the slide, until the person writes in the handout.
  const made = insertSlide(state, 3, 'section', () => 0.5)!
  const names: string[] = []
  made.doc.forEach(node => names.push(node.type.name === 'heading' ? `h${node.attrs.level}` : node.type.name))
  assert.deepEqual(names.slice(-2), ['deckSlide', 'paragraph'])
}

// The handout's placeholders: "Heading" on every part's empty heading; "Write here. *** starts a new slide." only on
// the current part's empty text.
{
  const heading = (level: number, text: string) => schema.nodes.heading.create({ level }, text ? schema.text(text) : null)
  const deck = schema.nodes.doc.create(null, [slide('aaaa', 'A'), heading(2, ''), schema.nodes.paragraph.create(), slide('bbbb', 'B'), heading(2, 'B'), schema.nodes.paragraph.create()])
  // A node decoration's attributes (prosemirror-view keeps them on its `type`).
  const attrsOf = (found: unknown) => (found as { type: { attrs: Record<string, string> } }).type.attrs
  const marks = (current: number | null) => deckDecorations(deck, current).find().map(found => attrsOf(found)['data-placeholder'] ?? attrsOf(found).class)
  assert.deepEqual(marks(1).filter(Boolean).sort(), ['Heading', 'Write here. *** starts a new slide.', 'is-current'].sort())
  assert.deepEqual(marks(0).filter(Boolean).sort(), ['Heading', 'Write here. *** starts a new slide.', 'is-current'].sort())
  assert.deepEqual(marks(null).filter(Boolean), ['Heading'], 'no current part: only the empty heading says so')
  const written = schema.nodes.doc.create(null, [slide('aaaa', 'A'), heading(2, 'A'), paragraph('Words.')])
  assert.deepEqual(deckDecorations(written, 0).find().length, 1, 'a written part: only its current mark')
}

// The handout's width: 60 % by default (the slide 40 %), and a share the person dragged to is kept over it.
{
  assert.equal(DEFAULT_RATIO, 0.4)
  assert.equal(initialRatio(undefined), 0.4)
  assert.equal(initialRatio(0.55), 0.55, 'a stored share stands')
  assert.equal(initialRatio(0.6), 0.6, "even the old default's share, once the person chose it")
  assert.equal(initialRatio('0.5'), 0.4)
  assert.equal(initialRatio(0.95), 0.4, 'a share out of range is no share')
  assert.equal(initialRatio(Number.NaN), 0.4)
}


console.log('deckDocument: passed')
