/**
 * 17 November: the handout's number rail and a slide with no handout. Run with
 * `npx tsx webview/src/components/decks/handout/partRail.test.ts`.
 */
import { strict as assert } from 'node:assert'
import { getSchema } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { createEditorSchemaExtensions } from '../../../utils/editorMarkdown'
import { installTestDocument } from '../../../utils/markdownFidelity'
import { DeckSlide } from './deckSchema'
import { TRACK_MIN, TRACK_TAIL, railPick, rowCaret, trackHeight } from './partRail'
import { blocksAreBare, deckDecorations, slideOnlyParts } from './deckCurrent'
import { withDrawnHeadings } from '../deckDocument'

installTestDocument()
const schema = getSchema(createEditorSchemaExtensions({ deck: [DeckSlide] }))
const slide = (id: string, title: string) => schema.nodes.deckSlide.create({ kind: 'points', body: `id: ${id}\ntitle: ${title}`, notes: null })
const paragraph = (text = '') => schema.nodes.paragraph.create(null, text ? schema.text(text) : null)
const heading = (text = '') => schema.nodes.heading.create({ level: 2 }, text ? schema.text(text) : null)
const docOf = (nodes: PMNode[]) => schema.nodes.doc.create(null, nodes)

// The track: from its top to the end of its part's text and a little past it, never shorter than its number needs.
assert.equal(trackHeight(100, 400), 400 + TRACK_TAIL - 100)
assert.equal(trackHeight(100, 101), TRACK_MIN, 'a part with no height still has room for its number')
assert.equal(trackHeight(10.4, 60.2), Math.round(60.2 + TRACK_TAIL - 10.4), 'whole pixels')

// A click on a track makes its slide the current one, as a thumbnail does; on the current slide's own track nothing
// moves (the handout stays where it is being read), and a track that isn't a part does nothing.
assert.equal(railPick(2, 0, 5), 2)
assert.equal(railPick(0, 3, 5), 0)
assert.equal(railPick(3, 3, 5), null, 'the current slide')
assert.equal(railPick(-1, 0, 5), null, 'not a part')
assert.equal(railPick(5, 0, 5), null, 'past the last part')
assert.equal(railPick(1.5, 0, 5), null)

// The folded row's click: the caret into the part's first block, or nowhere when it has none.
assert.equal(rowCaret([40, 42]), 41)
assert.equal(rowCaret([]), null)

// "Is slide-only": no heading and no text. An empty heading or empty paragraphs (a line break is no text) are bare;
// any words, in the heading or under it, or a block that isn't a paragraph or heading, are not.
assert.equal(blocksAreBare([]), true, 'nothing at all')
assert.equal(blocksAreBare([paragraph()]), true)
assert.equal(blocksAreBare([heading(), paragraph(), paragraph()]), true)
assert.equal(blocksAreBare([schema.nodes.paragraph.create(null, [schema.text(' '), schema.nodes.hardBreak.create()])]), true, 'spaces and a line break')
assert.equal(blocksAreBare([heading('Why'), paragraph()]), false, 'a heading')
assert.equal(blocksAreBare([heading(), paragraph('Ask the room.')]), false, 'text')
assert.equal(blocksAreBare([schema.nodes.codeBlock.create()]), false, 'a code block is a block of the handout')

{
  // A deck written with its own headings: the emptied part is slide-only, the others aren't.
  const doc = docOf([slide('a1', 'Welcome'), heading('Welcome'), paragraph('Hello.'), slide('b2', 'Copilot or Cursor?'), heading(), paragraph(), slide('c3', 'Next'), paragraph('More.')])
  assert.deepEqual(slideOnlyParts(doc), [1])
  // Folded while it isn't the current one: its head is marked and its empty blocks fold away.
  const marks = (current: number | null) => deckDecorations(doc, current).find().map(deco => ({ from: deco.from, cls: (deco as unknown as { type: { attrs: { class?: string } } }).type.attrs.class }))
  const folded = marks(0)
  const second = doc.child(0).nodeSize + doc.child(1).nodeSize + doc.child(2).nodeSize
  assert.ok(folded.some(mark => mark.from === second && mark.cls === 'is-only'), 'the head says it is a slide with no handout')
  assert.equal(folded.filter(mark => mark.cls === 'deck-only-fold').length, 2, 'its heading and paragraph fold away')
  // The current part opens, with its placeholders, as any part does.
  const open = marks(1)
  assert.ok(!open.some(mark => mark.cls === 'is-only' || mark.cls === 'deck-only-fold'), 'open while current')
  assert.ok(open.some(mark => mark.cls === 'is-current'))
  assert.ok(open.some(mark => mark.cls === 'deck-empty'), 'its placeholders')
}

{
  // A deck written before 16 November: each part shows its slide's title as a drawn heading until the first edit, so
  // a part with nothing written under it is not a slide with no handout.
  const old = withDrawnHeadings(docOf([slide('a1', 'Welcome'), paragraph('Hello.'), slide('b2', 'Copilot or Cursor?'), slide('c3', 'Next'), paragraph('More.')]))
  assert.deepEqual(slideOnlyParts(old), [], 'the slide\'s title is its heading')
  // Once the person empties it (its heading deleted), it is one.
  const emptied = docOf([slide('a1', 'Welcome'), paragraph('Hello.'), slide('b2', 'Copilot or Cursor?'), paragraph(), slide('c3', 'Next'), paragraph('More.')])
  assert.deepEqual(slideOnlyParts(emptied), [1])
}

console.log('partRail: passed')
