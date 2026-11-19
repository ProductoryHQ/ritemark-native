/**
 * The smoke run of 19 November (D): in Push, the pieces coming in are cut only by the window's edge, never by the words'
 * own box (`.blk-flow { overflow: hidden }`). For the row the flow clips above and below only; once the row has ended (or
 * was jumped to its end, or stopped) it is exactly as it was, so a slide's end state never changes: no scrollbars, no
 * overflow. Fade and Zoom, and a flow drawn unclipped (the page's reading layout), are left alone.
 *
 * Run: npx tsx webview/src/components/decks/present/rowArrival.test.ts
 */
import { strict as assert } from 'node:assert'
import { ROW_PLAYER, type RowTransition } from './rowArrival'

interface FakeAnimation { finished: Promise<void>; end(): void; stop(): void }

/** A slide with a block flow of `n` paragraphs, whose pieces' animations end when the test says. */
function slide(n: number, overflow = 'hidden') {
  const animations: FakeAnimation[] = []
  const attributes = new Map<string, string>()
  const piece = () => ({
    tagName: 'P',
    classList: { contains: () => false },
    hasAttribute: () => false,
    animate() {
      let end!: () => void, stop!: (reason: Error) => void
      const finished = new Promise<void>((resolve, reject) => { end = resolve; stop = reject })
      const made: FakeAnimation = { finished, end: () => end(), stop: () => stop(new Error('AbortError')) }
      animations.push(made)
      return made
    },
  })
  const flow = {
    children: Array.from({ length: n }, piece),
    style: { overflow: '', clipPath: '' } as Record<string, string>,
    getAttribute: (name: string) => attributes.get(name) ?? null,
    setAttribute: (name: string, value: string) => { attributes.set(name, value) },
    removeAttribute: (name: string) => { attributes.delete(name) },
    ownerDocument: { defaultView: { getComputedStyle: () => ({ overflow }) } },
  }
  const canvas = { getBoundingClientRect: () => ({ width: 1440 }) }
  const entering = {
    querySelector: (selector: string) => (selector.includes('blk-flow') ? flow : selector === '.deck-sl' ? canvas : null),
  }
  return { entering: entering as unknown as Element, flow, animations, attributes }
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0))

async function main() {
  // Push: unclipped sideways while the row plays, as it was once every piece is in.
  {
    const { entering, flow, animations, attributes } = slide(3)
    const played = ROW_PLAYER.play(entering, null, { transition: 'push', width: 1440 })
    assert.equal(played.animations.length, 3)
    assert.equal(flow.style.overflow, 'visible', 'the words\' box doesn\'t cut a piece coming in')
    assert.equal(flow.style.clipPath, 'inset(0px -100000px)', 'above and below, the flow still clips')
    animations[0].end(); animations[1].end()
    await settle()
    assert.equal(flow.style.overflow, 'visible', 'until the last piece is in')
    animations[2].end()
    await settle()
    assert.equal(flow.style.overflow, '', 'the end state is the slide as drawn: the flow clips again')
    assert.equal(flow.style.clipPath, '')
    assert.equal(attributes.size, 0, 'no mark left behind')
  }
  // A row stopped half-way (a jump, the slide left) puts the flow back too.
  {
    const { entering, flow, animations } = slide(2)
    ROW_PLAYER.play(entering, null, { transition: 'push', width: 1440 })
    animations[0].stop()
    await settle()
    assert.equal(flow.style.overflow, '')
    assert.equal(flow.style.clipPath, '')
  }
  // The same slide arriving again before its last row ended: only the latest row puts the flow back.
  {
    const { entering, flow, animations } = slide(1)
    ROW_PLAYER.play(entering, null, { transition: 'push', width: 1440 })
    ROW_PLAYER.play(entering, null, { transition: 'push', width: 1440 })
    animations[0].end()
    await settle()
    assert.equal(flow.style.overflow, 'visible', 'the second row is still coming in')
    animations[1].end()
    await settle()
    assert.equal(flow.style.overflow, '')
  }
  // Fade and Zoom don't move sideways: the flow is never touched. Nor is a flow that doesn't clip.
  for (const transition of ['fade', 'zoom'] as RowTransition[]) {
    const { entering, flow } = slide(2)
    ROW_PLAYER.play(entering, null, { transition, width: 1440 })
    assert.equal(flow.style.overflow, '', transition)
    assert.equal(flow.style.clipPath, '', transition)
  }
  {
    const { entering, flow } = slide(2, 'visible')
    ROW_PLAYER.play(entering, null, { transition: 'push', width: 1440 })
    assert.equal(flow.style.overflow, '', 'the page\'s reading layout keeps its own flow')
  }
  console.log('rowArrival: passed')
}

main().catch(error => { console.error(error); process.exit(1) })
