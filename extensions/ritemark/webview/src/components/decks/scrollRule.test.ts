/**
 * Sprint 157: the handout's scroll rule. Run with `npx tsx webview/src/components/decks/scrollRule.test.ts`.
 */
import { strict as assert } from 'node:assert'
import { currentPart, scrollTopFor, wheelStop } from './scrollRule'

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

// A short part (part 2, a title alone, 900 to 980) is never skipped and the slide never goes back while scrolling
// down. Part 2 starts where its head crosses the line (732); part 3 only once part 2's head has left the top (920).
const short = { partTops: [10, 400, 900, 980, 1500], clientHeight: 600, scrollHeight: 3000, writing: null }
assert.equal(currentPart({ ...short, scrollTop: 600 }), 1, '600 + 168 = 768: part 1')
assert.equal(currentPart({ ...short, scrollTop: 850 }), 2, 'part 3 has crossed the line, but part 2 is still at the top')
assert.equal(currentPart({ ...short, scrollTop: 894 }), 2, 'part 2 scrolled to the top, as a thumbnail does')
assert.equal(currentPart({ ...short, scrollTop: 950 }), 3)
let last = 0
for (let top = 0; top <= 2400; top++) {
  const part = currentPart({ ...short, scrollTop: top })!
  assert.ok(part === last || part === last + 1, `scrolling down at ${top}: ${last} → ${part}`)
  last = part
}
assert.equal(last, 4, 'every part was shown on the way down')
// Each part scrolled to the top by its thumbnail is the current one.
short.partTops.forEach((top, index) => assert.equal(currentPart({ ...short, scrollTop: scrollTopFor(top) }), index))
// One wheel turn moves the slide on by one at most: from 600 (part 1), a 400 px turn would land on part 3.
const stop = wheelStop({ ...short, scrollTop: 600 }, 400, 1)
assert.ok(stop !== null && stop > 600 && stop < 1000)
assert.equal(currentPart({ ...short, scrollTop: stop! }), 2)
const after = wheelStop({ ...short, scrollTop: stop! }, 400, 2) ?? stop! + 400
assert.equal(currentPart({ ...short, scrollTop: after }), 3)
// A turn that skips nothing goes as it would.
assert.equal(wheelStop({ ...base, scrollTop: 500 }, 100, 1), null)
// Up as down: from part 3 at 1000, a 400 px turn back would reach part 1 (600); it stops on part 2.
const up = wheelStop({ ...short, scrollTop: 1000 }, -400, 3)
assert.ok(up !== null)
assert.equal(currentPart({ ...short, scrollTop: up! }), 2)

console.log('scrollRule: passed')
