/**
 * Sprint 157: the handout's scroll rule. Run with `npx tsx webview/src/components/decks/scrollRule.test.ts`.
 */
import { strict as assert } from 'node:assert'
import { currentPart, scrollTopFor } from './scrollRule'

const base = { partTops: [10, 400, 900, 1500], clientHeight: 600, scrollHeight: 3000, writing: null }

assert.equal(currentPart({ ...base, partTops: [] , scrollTop: 0 }), null)
// Scrolled to the top: the first part.
assert.equal(currentPart({ ...base, scrollTop: 0 }), 0)
// A part that starts at the top of the view is the one being read.
assert.equal(currentPart({ ...base, scrollTop: 394 }), 1)
assert.equal(currentPart({ ...base, scrollTop: 380 }), 1, 'within 26 px of the top')
// Else the last part above the line 0.28 down: 500 + 168 = 668 → part 1.
assert.equal(currentPart({ ...base, scrollTop: 500 }), 1)
// 750 + 168 = 918 → part 2 has crossed the line.
assert.equal(currentPart({ ...base, scrollTop: 750 }), 2)
// The part being written in wins, wherever the handout is.
assert.equal(currentPart({ ...base, scrollTop: 0, writing: 3 }), 3)
assert.equal(currentPart({ ...base, scrollTop: 0, writing: 9 }), 0, 'a part that no longer exists is ignored')
// Scrolled to the end with the last part at the top: the last.
assert.equal(currentPart({ ...base, scrollTop: 2400 }), 3)
assert.equal(scrollTopFor(400), 394)
assert.equal(scrollTopFor(2), 0)

console.log('scrollRule: passed')
