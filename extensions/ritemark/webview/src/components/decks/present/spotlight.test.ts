/**
 * Decks README item 16: which item a click hits (the wall's and the presenter view's Now).
 * Run with `npx tsx webview/src/components/decks/present/spotlight.test.ts`.
 */
import { strict as assert } from 'node:assert'
import { itemAt, type SpotRect } from './spotlight'

const rect = (left: number, top: number, right: number, bottom: number): SpotRect => ({ left, top, right, bottom })

// Three boxes side by side, in a row.
const boxes = [rect(0, 100, 300, 300), rect(320, 100, 620, 300), rect(640, 100, 940, 300)]
assert.equal(itemAt(boxes, 150, 200), 0, 'the first box')
assert.equal(itemAt(boxes, 500, 120), 1, 'the second box')
assert.equal(itemAt(boxes, 940, 300), 2, 'an edge is the box')
assert.equal(itemAt(boxes, 310, 200), null, 'the gap between boxes is outside any item')
assert.equal(itemAt(boxes, 150, 50), null, 'the title above them is outside any item')
assert.equal(itemAt([], 10, 10), null, 'a slide with no items')

// A list item inside a box, and a picture inside a column: the smallest holding the point.
const nested = [rect(0, 0, 400, 400), rect(20, 60, 380, 100), rect(20, 110, 380, 150)]
assert.equal(itemAt(nested, 100, 80), 1, 'the list item, not its box')
assert.equal(itemAt(nested, 100, 130), 2)
assert.equal(itemAt(nested, 100, 300), 0, 'the box around them')
// An item and the one inside it the same size (a picture's frame and a column that holds only it): the inner one.
assert.equal(itemAt([rect(0, 0, 100, 100), rect(0, 0, 100, 100)], 50, 50), 1)
// A side picture that runs past the slide's edge on the wall still holds the point.
assert.equal(itemAt([rect(-80, -40, 384, 580), rect(432, 100, 900, 300)], -20, 10), 0)

console.log('spotlight: all tests passed')
