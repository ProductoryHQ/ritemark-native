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
// A right-to-left frame starts at its right edge (scrollLeft 0) and goes negative to the left.
assert.deepEqual(tableEdges(0, 820, 720, true), { left: true, right: false }, 'right-to-left, at the start: the left side fades')
assert.deepEqual(tableEdges(-50, 820, 720, true), { left: true, right: true }, 'right-to-left, in the middle: both')
assert.deepEqual(tableEdges(-100, 820, 720, true), { left: false, right: true }, 'right-to-left, at the end: the right side fades')

// ---- the watcher, in the editor's copy and the page's
type Listener = () => void
class FakeFrame {
  scrollLeft = 0
  scrollWidth = 820
  clientWidth = 720
  offsetHeight = 120
  clientHeight = 120
  overflowX = 'auto'
  direction = 'ltr'
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
  const observers: { callback: () => void; targets: unknown[]; options: unknown[]; connected: boolean }[] = []
  let ids = 0
  let styleReads = 0
  const win = {
    getComputedStyle: (element: unknown) => { styleReads++; return { overflowX: (element as FakeFrame).overflowX, direction: (element as FakeFrame).direction } },
    requestAnimationFrame(callback: () => void) { frames.set(++ids, callback); return ids },
    cancelAnimationFrame(handle: number) { frames.delete(handle) },
    ResizeObserver: class {
      record: { callback: () => void; targets: unknown[]; options: unknown[]; connected: boolean }
      constructor(callback: () => void) { this.record = { callback, targets: [], options: [], connected: true }; observers.push(this.record) }
      observe(target: unknown, options?: unknown) { this.record.targets.push(target); this.record.options.push(options) }
      disconnect() { this.record.connected = false; this.record.targets = [] }
    },
  }
  return {
    win,
    observers,
    pending: () => frames.size,
    styleReads: () => styleReads,
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
  assert.deepEqual(view.observers[0].targets, [frame, table], `${name}: the frame's and the table's sizes are watched`)
  assert.deepEqual(view.observers[0].options[0], { box: 'border-box' }, `${name}: the frame's border box, so a scrollbar appearing counts`)

  // Many scroll events in one frame draw once.
  frame.scrollTo(20)
  frame.scrollTo(50)
  assert.equal(view.pending(), 1, `${name}: one frame for many scroll events`)
  view.flush()
  assert.equal(frame.shown(), 'is-scrollable-left is-scrollable-right', `${name}: in the middle, both sides fade`)

  frame.scrollTo(100)
  view.flush()
  assert.equal(frame.shown(), 'is-scrollable-left', `${name}: at the end, only the left side fades`)

  // The handout gets wider (or the table narrower): the table fits, and the fade goes at once, before the frame is
  // painted (the observer draws in its own callback, not a frame later).
  frame.clientWidth = 820
  frame.scrollLeft = 0
  view.resize()
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

  assert.equal(view.styleReads(), 1, `${name}: the frame's style is read once, not on every draw`)

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

// A frame that doesn't scroll (a Text document's table, a slide's) gets no class however wide its table, and the
// watcher stops at its first draw: no listener or observer stays behind. A frame not yet in the page waits for it.
for (const [name, watch] of [['editor', watchTableEdges], ['page', pageWatch]] as const) {
  const frame = new FakeFrame()
  frame.overflowX = 'visible'
  frame.isConnected = false
  const view = fakeWindow()
  watch(frame as unknown as HTMLElement, {} as Element, view.win as unknown as EdgeWindow)
  view.flush()
  assert.equal(view.observers[0].connected, true, `${name}: a frame not yet in the page is still watched`)
  frame.isConnected = true
  view.resize()
  assert.equal(frame.shown(), '', `${name}: a frame that doesn't scroll has no fade`)
  assert.equal(frame.listeners.get('scroll')?.length, 0, `${name}: and no scroll listener`)
  assert.equal(view.observers[0].connected, false, `${name}: and no observer`)
}

// A right-to-left frame, through both copies: at its start (its right edge) the left side fades.
for (const [name, watch] of [['editor', watchTableEdges], ['page', pageWatch]] as const) {
  const frame = new FakeFrame()
  frame.direction = 'rtl'
  const view = fakeWindow()
  watch(frame as unknown as HTMLElement, {} as Element, view.win as unknown as EdgeWindow)
  view.flush()
  assert.equal(frame.shown(), 'is-scrollable-left', `${name}: right-to-left start`)
  frame.scrollTo(-100)
  view.flush()
  assert.equal(frame.shown(), 'is-scrollable-right', `${name}: right-to-left end`)
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
