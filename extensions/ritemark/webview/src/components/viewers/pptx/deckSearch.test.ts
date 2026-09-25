/**
 * Sprint 125 (#285) R4 — counting matches in a deck.
 * Run: npx tsx webview/src/components/viewers/pptx/deckSearch.test.ts
 */
import assert from 'node:assert/strict'
import { countIn, deckMatches, firstMatchFrom, slideParagraphs } from './deckSearch'

// The index lists master and layout shapes on every slide; only the slide's own count.
const paragraphs = slideParagraphs(
  [
    { slideIndex: 0, nodePath: 'slides/0/master/nodes/Footer', text: 'Harbour Report' },
    { slideIndex: 0, nodePath: 'slides/0/layout/nodes/Date', text: 'Harbour 2026' },
    { slideIndex: 0, nodePath: 'slides/0/nodes/Title 1', text: 'The harbour' },
    { slideIndex: 0, nodePath: 'slides/0/nodes/Content 2', text: 'Harbour fees\nNight shift' },
    { slideIndex: 1, nodePath: 'slides/1/nodes/Table 3/rows/0/cells/1', text: 'harbourmaster' },
    { slideIndex: 1, nodePath: 'slides/1/nodes/Group 4/children/0/Shape 5', text: 'Channel' },
  ],
  3,
)
assert.deepEqual(paragraphs, [['The harbour', 'Harbour fees', 'Night shift'], ['harbourmaster', 'Channel'], []])

// A match never runs from one paragraph into the next.
assert.equal(countIn(['fees', 'night'], 'fees night'), 0)
assert.equal(countIn(['Harbour HARBOUR'], 'harbour'), 2)

const text = {
  slides: paragraphs,
  notes: [['Mention the harbour fees.'], [], ['The harbour closes at night.', 'Harbour again']],
}
assert.deepEqual(deckMatches(text, '  HARBOUR '), [
  { slide: 0, where: 'slide', ordinal: 0 },
  { slide: 0, where: 'slide', ordinal: 1 },
  { slide: 0, where: 'notes', ordinal: 0 },
  { slide: 1, where: 'slide', ordinal: 0 },
  { slide: 2, where: 'notes', ordinal: 0 },
  { slide: 2, where: 'notes', ordinal: 1 },
])
assert.deepEqual(deckMatches(text, ''), [])
assert.deepEqual(deckMatches(text, 'lighthouse'), [])

// A new search starts from the slide being read, wrapping to the first match.
const matches = deckMatches(text, 'harbour')
assert.equal(firstMatchFrom(matches, 0), 0)
assert.equal(firstMatchFrom(matches, 1), 3)
assert.equal(firstMatchFrom(matches, 2), 4)
assert.equal(firstMatchFrom([], 1), -1)
assert.equal(firstMatchFrom(deckMatches(text, 'harbourmaster'), 2), 0)

console.log('deckSearch.test.ts: all passed')
