/**
 * A wide table's soft edges (the Experience lead on #781): which side of a scrolling frame fades, the watcher that
 * keeps the frame's classes in step (the editor's and the published page's copy, run through the same steps), its
 * clean-up, and the handout's CSS.
 *
 * Run: npx tsx webview/src/extensions/tables/tableEdges.test.ts
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { EDGE_SLACK, tableEdges, watchTableEdges, type EdgeWindow } from './tableEdges'
import { PAGE_EDGE_RULE } from '../../../../src/decks/page/pageScript'

// ---- the rule: a 720 px frame over an 820 px table
assert.deepEqual(tableEdges(0, 820, 720), { left: false, right: true }, 'at the start: the right side fades')
assert.deepEqual(tableEdges(50, 820, 720), { left: true, right: true }, 'in the middle: both sides fade')
assert.deepEqual(tableEdges(100, 820, 720), { left: true, right: false }, 'at the end: the left side fades')
assert.deepEqual(tableEdges(99.5, 820, 720), { left: true, right: false }, 'half a pixel short of the end is the end')
assert.deepEqual(tableEdges(0.5, 820, 720), { left: false, right: true }, 'half a pixel in is the start')
assert.deepEqual(tableEdges(0, 720, 720), { left: false, right: false }, 'a table that fits never fades')
assert.deepEqual(tableEdges(0, 720 + EDGE_SLACK, 720), { left: false, right: false }, 'a pixel of rounding is not a scroll')
assert.deepEqual(tableEdges(0, 500, 720), { left: false, right: false }, 'a narrow table never fades')
assert.deepEqual(tableEdges(-100, 820, 720), { left: true, right: false }, 'a right-to-left frame counts from its own start')

// ---- the watcher, in the editor's copy and the page's
type Listener = () => void
class FakeFrame {
  scrollLeft = 0
  scrollWidth = 820
  clientWidth = 720
  offsetHeight = 120
  clientHeight = 120
  overflowX = 'auto'
  isConnected = true
  classes = new Set<string>()
  vars = new Map<string, string>()
  listeners = new Map<string, Listener[]>()
  classList = {
    toggle: (name: string, on: boolean) => { if (on) this.classes.add(name); else this.classes.delete(name); return on },
  }
  style = {
    setProperty: (name: string, value: string) => { this.vars.set(name, value) },
    removeProperty: (name: string) => { this.vars.delete(name) },
  }
  addEventListener(type: string, listener: Listener, options?: { passive?: boolean }) {
    assert.equal(options?.passive, true, 'the scroll listener is passive')
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }
  removeEventListener(type: string, listener: Listener) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter(other => other !== listener))
  }
  scrollTo(left: number) {
    this.scrollLeft = left
    for (const listener of this.listeners.get('scroll') ?? []) listener()
  }
  shown() { return [...this.classes].sort().join(' ') }
}

/** A window whose animation frames run when told, and whose observers can be fired and counted. */
function fakeWindow() {
  const frames = new Map<number, () => void>()
  const observers: { callback: () => void; targets: unknown[]; connected: boolean }[] = []
  let ids = 0
  const win = {
    getComputedStyle: (element: unknown) => ({ overflowX: (element as FakeFrame).overflowX }),
    requestAnimationFrame(callback: () => void) { frames.set(++ids, callback); return ids },
    cancelAnimationFrame(handle: number) { frames.delete(handle) },
    ResizeObserver: class {
      record: { callback: () => void; targets: unknown[]; connected: boolean }
      constructor(callback: () => void) { this.record = { callback, targets: [], connected: true }; observers.push(this.record) }
      observe(target: unknown) { this.record.targets.push(target) }
      disconnect() { this.record.connected = false; this.record.targets = [] }
    },
  }
  return {
    win,
    observers,
    pending: () => frames.size,
    flush() { const now = [...frames.values()]; frames.clear(); now.forEach(run => run()) },
    resize() { observers.filter(o => o.connected).forEach(o => o.callback()) },
  }
}

const pageWatch = new Function(`${PAGE_EDGE_RULE}\nreturn watchTableEdges;`)() as typeof watchTableEdges

for (const [name, watch] of [['editor', watchTableEdges], ['page', pageWatch]] as const) {
  const frame = new FakeFrame()
  const table = {}
  const view = fakeWindow()
  const stop = watch(frame as unknown as HTMLElement, table as Element, view.win as unknown as EdgeWindow)
  assert.equal(frame.shown(), '', `${name}: nothing before the first frame`)
  view.flush()
  assert.equal(frame.shown(), 'is-scrollable-right', `${name}: at the start, the right side fades`)
  assert.deepEqual(view.observers[0].targets, [frame, table], `${name}: the frame's and the table's widths are watched`)

  // Many scroll events in one frame draw once.
  frame.scrollTo(20)
  frame.scrollTo(50)
  assert.equal(view.pending(), 1, `${name}: one frame for many scroll events`)
  view.flush()
  assert.equal(frame.shown(), 'is-scrollable-left is-scrollable-right', `${name}: in the middle, both sides fade`)

  frame.scrollTo(100)
  view.flush()
  assert.equal(frame.shown(), 'is-scrollable-left', `${name}: at the end, only the left side fades`)

  // The handout gets wider (or the table narrower): the table fits, and the fade goes.
  frame.clientWidth = 820
  frame.scrollLeft = 0
  view.resize()
  view.flush()
  assert.equal(frame.shown(), '', `${name}: a table that fits has no fade`)

  // A classic scrollbar's height is kept whole by the mask; an overlay scrollbar has none.
  frame.clientWidth = 720
  frame.offsetHeight = 131
  view.resize()
  view.flush()
  assert.equal(frame.vars.get('--rm-fade-bar'), '11px', `${name}: the scrollbar's height`)
  frame.offsetHeight = 120
  view.resize()
  view.flush()
  assert.equal(frame.vars.has('--rm-fade-bar'), false, `${name}: no scrollbar of its own, no strip`)

  // A frame that doesn't scroll (a Text document's table, a slide's) gets no class, however wide its table.
  frame.overflowX = 'visible'
  view.resize()
  view.flush()
  assert.equal(frame.shown(), '', `${name}: a frame that doesn't scroll has no fade`)
  frame.overflowX = 'auto'

  // The clean-up: the listener, the observer and a waiting frame all go, and nothing draws after it.
  frame.scrollTo(50)
  assert.equal(view.pending(), 1)
  stop()
  assert.equal(view.pending(), 0, `${name}: a waiting frame is cancelled`)
  assert.equal(frame.listeners.get('scroll')?.length, 0, `${name}: the scroll listener is removed`)
  assert.equal(view.observers[0].connected, false, `${name}: the observer is disconnected`)
  const before = frame.shown()
  frame.scrollTo(70)
  view.resize()
  view.flush()
  assert.equal(frame.shown(), before, `${name}: nothing draws after the clean-up`)
}

// A browser without ResizeObserver still follows the scroll.
{
  const frame = new FakeFrame()
  const view = fakeWindow()
  const win = { ...view.win, ResizeObserver: undefined }
  const stop = watchTableEdges(frame as unknown as HTMLElement, {} as Element, win as unknown as EdgeWindow)
  view.flush()
  assert.equal(frame.shown(), 'is-scrollable-right')
  stop()
}

// ---- the handout's CSS: a mask on the frame, chosen by the two classes, and nothing that moves
{
  const css = readFileSync(fileURLToPath(new URL('../../components/decks/decks.css', import.meta.url)), 'utf8')
  const frame = '.deck-handout .wysiwyg-editor .ProseMirror > .rm-table'
  const rule = (selector: string) => {
    const at = css.indexOf(`${selector} {`)
    assert.ok(at >= 0, `decks.css has ${selector}`)
    return css.slice(at, css.indexOf('}', at))
  }
  const fade = rule(`${frame}:is(.is-scrollable-left, .is-scrollable-right)`)
  assert.match(fade, /mask: linear-gradient\(to right, var\(--rm-fade-l\) 6px, #000 30px, #000 calc\(100% - 24px\), var\(--rm-fade-r\)\)/, 'a 24 px fade, the left one from the clip in')
  assert.match(fade, /linear-gradient\(#000 0 0\) bottom \/ 100% var\(--rm-fade-bar, 0px\) no-repeat/, 'the scrollbar stays whole')
  assert.match(rule(`${frame}.is-scrollable-left`), /--rm-fade-l: transparent/)
  assert.match(rule(`${frame}.is-scrollable-right`), /--rm-fade-r: transparent/)
  assert.ok(!/\.rm-table[^{]*\{[^}]*(transition|animation)/.test(css), 'the fade appears and goes with no animation')
}

console.log('tableEdges: passed')
