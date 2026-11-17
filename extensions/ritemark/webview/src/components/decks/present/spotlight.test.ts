/**
 * Decks README item 16: which item a click hits (the wall's and the presenter view's Now).
 * Run with `npx tsx webview/src/components/decks/present/spotlight.test.ts`.
 */
import { strict as assert } from 'node:assert'
import { itemAt, spotDimmed, type SpotRect } from './spotlight'

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

// ---- What dims: siblings on the way up, never the title nor a picture behind the words (a small stand-in for the DOM).
class El {
  parentElement: El | null = null
  children: El[] = []
  classList: { contains: (name: string) => boolean }
  constructor(readonly tagName: string, classes: string[] = [], kids: El[] = []) {
    const set = new Set(classes)
    this.classList = { contains: name => set.has(name) }
    for (const kid of kids) { kid.parentElement = this; this.children.push(kid) }
  }
  contains(other: El | null): boolean {
    for (let node = other; node; node = node.parentElement) if (node === this) return true
    return false
  }
  closest(selector: string): El | null {
    const name = selector.replace(/^\./, '')
    for (let node: El | null = this; node; node = node.parentElement) if (node.classList.contains(name)) return node
    return null
  }
  querySelector(selector: string): El | null {
    const name = selector.replace(/^\./, '')
    for (const kid of this.children) {
      if (kid.classList.contains(name)) return kid
      const found = kid.querySelector(selector)
      if (found) return found
    }
    return null
  }
}
const dimmedOf = (item: El) => spotDimmed(item as unknown as HTMLElement) as unknown as El[]
{
  // Three boxes under the title: the other two boxes dim, the title doesn't.
  const title = new El('H1')
  const boxes = [new El('DIV', ['blk-box']), new El('DIV', ['blk-box']), new El('DIV', ['blk-box'])]
  const note = new El('P')
  const slide = new El('DIV', ['deck-sl', 'is-blocks'], [new El('DIV', ['blk-flow'], [title, new El('DIV', ['blk-boxes'], boxes), note])])
  assert.ok(slide)
  const dimmed = dimmedOf(boxes[1])
  assert.deepEqual(dimmed, [boxes[0], boxes[2], note], 'the other boxes and the words under them, not the title')
}
{
  // A side picture spotlit: the flow beside it dims, all but its title (review of #790).
  const title = new El('H1')
  const list = new El('UL')
  const words = new El('P')
  const photo = new El('DIV', ['photo'])
  const flow = new El('DIV', ['blk-flow'], [title, words, list])
  new El('DIV', ['deck-sl', 'is-blocks', 'pic-left'], [photo, flow])
  const dimmed = dimmedOf(photo)
  assert.deepEqual(dimmed, [words, list], 'the flow dims block by block, the title stays')
  assert.ok(!dimmed.includes(flow) && !dimmed.includes(title))
}
{
  // A picture behind the words is the slide's ground: never dimmed, nor its veil.
  const title = new El('H1')
  const step = new El('LI')
  const other = new El('LI')
  const photo = new El('DIV', ['photo'])
  const veil = new El('DIV', ['veil'])
  new El('DIV', ['deck-sl', 'is-blocks', 'pic-behind'], [photo, veil, new El('DIV', ['blk-flow'], [title, new El('DIV', ['blk-steps'], [new El('OL', [], [step, other])])])])
  const dimmed = dimmedOf(step)
  assert.deepEqual(dimmed, [other], 'only the other step')
}

console.log('spotlight: all tests passed')
