/**
 * The deck view's `deck/current` (17 November): the slide the strip picked, the stage shows, or whose part holds the
 * handout's caret, with its id and title and nothing else; and the host decodes exactly that.
 * Run: `npx tsx webview/src/components/decks/currentSlideMessage.test.ts`
 */
import { strict as assert } from 'node:assert'
import { getSchema } from '@tiptap/core'
import { createEditorSchemaExtensions } from '../../utils/editorMarkdown'
import { installTestDocument } from '../../utils/markdownFidelity'
import { DeckSlide } from './handout/deckSchema'
import { partIndexAt, slidesOf } from './deckDocument'
import { currentSlideMessage } from './currentSlideMessage'
import { decodeDeckRequest } from '../../../../src/decks/deckProtocol'

installTestDocument()
const schema = getSchema(createEditorSchemaExtensions({ deck: [DeckSlide] }))
const slide = (body: string) => schema.nodes.deckSlide.create({ kind: 'points', body, notes: null })
const paragraph = (text: string) => schema.nodes.paragraph.create(null, schema.text(text))
const doc = schema.nodes.doc.create(null, [
  slide('id: aaaa\ntitle: Welcome'), paragraph('a text'),
  slide('id: bbbb\ntitle: "Two\\n  lines"\nitems:\n  - heading: Secret words'), paragraph('the handout of b'),
  slide('title: No id here'), paragraph('c text'),
  slide('items: []'), paragraph('d text'),
])
const slides = slidesOf(doc)

// The strip's pick and the stage both show slide `index`: the message names it by its place, id and title.
assert.deepEqual(currentSlideMessage(0, 4, slides), { index: 0, count: 4, slides: [{ index: 0, id: 'aaaa', title: 'Welcome' }] })
// A title is one line; a slide's words (items, the handout) never travel.
const second = currentSlideMessage(1, 4, slides)
assert.deepEqual(second, { index: 1, count: 4, slides: [{ index: 1, id: 'bbbb', title: 'Two lines' }] })
assert.ok(!JSON.stringify(second).includes('Secret') && !JSON.stringify(second).includes('handout'), 'only number, id and title travel')
// No id, no title: only what the slide has.
assert.deepEqual(currentSlideMessage(2, 4, slides).slides, [{ index: 2, title: 'No id here' }])
assert.deepEqual(currentSlideMessage(3, 4, slides).slides, [{ index: 3 }])
// No slides yet, or a place past the end: only the place, as before.
assert.deepEqual(currentSlideMessage(0, 0, []), { index: 0, count: 0 })
assert.deepEqual(currentSlideMessage(4, 4, slides), { index: 4, count: 4 })

// The handout's caret: the current slide is the one whose part holds it (the view's one rule, `partIndexAt`).
const caretInB = slides[1].pos + slides[1].node.nodeSize + 2
const caretPart = partIndexAt(doc, caretInB)
assert.equal(caretPart, 1)
assert.deepEqual(currentSlideMessage(caretPart!, slides.length, slides).slides, [{ index: 1, id: 'bbbb', title: 'Two lines' }])

// The host decodes the view's messages exactly.
for (const index of [0, 1, 2, 3]) {
  const message = currentSlideMessage(index, 4, slides)
  assert.deepEqual(decodeDeckRequest({ type: 'deck/current', ...message }), { type: 'deck/current', ...message })
}

console.log('currentSlideMessage tests passed')
