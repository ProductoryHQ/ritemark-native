import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { revealTableAddBar, watchTableAddBars } from './tableAddBars'

const win = new EventTarget()
let scale = 1
let overflowX = 'auto'
let overflowY = 'auto'
const frame = {
  parentElement: null,
  clientLeft: 0, clientTop: 0,
  clientWidth: 400, clientHeight: 500,
  offsetWidth: 400, offsetHeight: 500,
  getBoundingClientRect: () => ({ left: 0, top: 50, width: 400 * scale, height: 500 * scale }),
}
Object.assign(win, { getComputedStyle: () => ({ overflowX, overflowY }) })
const originalObserver = globalThis.ResizeObserver
globalThis.ResizeObserver = class {
  observe() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

let scrollTop = 0
let scrollLeft = 0
let tableBottom = 950
let tableRight = 500
const table = {
  ownerDocument: { defaultView: win, documentElement: { clientWidth: 800, clientHeight: 700 } },
}
const spot = (left: () => number, top: () => number, width: number, height: number) => ({
  style: { visibility: '' },
  getBoundingClientRect: () => ({
    left: left(), top: top(), right: left() + width * scale, bottom: top() + height * scale,
  }),
  scrollIntoView(options: ScrollIntoViewOptions) {
    assert.deepEqual(options, { block: 'nearest', inline: 'nearest' })
    const rect = this.getBoundingClientRect()
    scrollTop += Math.max(0, rect.bottom - 550)
    scrollLeft += Math.max(0, rect.right - 400)
  },
})
const row = spot(() => -scrollLeft, () => tableBottom + 4 * scale - scrollTop, 500, 14)
const column = spot(() => tableRight + 4 * scale - scrollLeft, () => 50 - scrollTop, 14, 900)
const grip = spot(() => 300, () => 60 - scrollTop, 28, 14)
const element = (control: ReturnType<typeof spot>) => control as unknown as HTMLElement
const watch = () => watchTableAddBars(table as unknown as HTMLTableElement, frame as unknown as HTMLElement, () => [
  { element: element(row), axis: 'y' },
  { element: element(column), axis: 'x' },
  { element: element(grip) },
])
const scroll = () => win.dispatchEvent(new Event('scroll'))

try {
  const watcher = watch()
  assert.equal(row.style.visibility, 'hidden', 'the tall table ends below the scrollport')
  assert.equal(column.style.visibility, 'hidden', 'the wide table ends outside the scrollport')
  assert.equal(grip.style.visibility, '', 'the grip starts in view')

  scrollTop = 400
  scrollLeft = 100
  scroll()
  assert.equal(row.style.visibility, 'hidden', 'the bottom edge alone does not expose the row bar')
  assert.equal(column.style.visibility, 'hidden', 'the right edge alone does not expose the column bar')
  assert.equal(grip.style.visibility, 'hidden', 'scrolling the grip out of view hides it immediately')

  scrollTop = 417
  scrollLeft = 117
  scroll()
  assert.equal(row.style.visibility, '', 'the row bar fits within one pixel')
  assert.equal(column.style.visibility, '', 'the column bar fits within one pixel')

  tableBottom += 25
  tableRight += 25
  watcher.update()
  assert.equal(row.style.visibility, 'hidden')
  assert.equal(column.style.visibility, 'hidden')
  revealTableAddBar(element(row))
  revealTableAddBar(element(column))
  scroll()
  assert.equal(row.style.visibility, '', 'revealing the new row bar scrolls it into view')
  assert.equal(column.style.visibility, '', 'revealing the new column bar scrolls it into view')

  watcher.stop()
  scrollTop = 0
  scroll()
  assert.equal(row.style.visibility, '', 'cleanup removes the scroll listener')

  scale = 0.6
  overflowX = 'visible'
  overflowY = 'clip'
  scrollLeft = 0
  tableBottom = 345
  tableRight = 300
  const slide = watch()
  assert.equal(row.style.visibility, 'hidden', 'the scaled row bar crosses the scaled vertical clip')
  assert.equal(column.style.visibility, '', 'the y-only clip allows the column bar outside its horizontal span')
  assert.equal(grip.style.visibility, '', 'the y-only clip also allows the grip outside its horizontal span')
  tableBottom = 340
  slide.update()
  assert.equal(row.style.visibility, '', 'the scaled row bar now fits')
  slide.stop()
} finally {
  globalThis.ResizeObserver = originalObserver
}

const layer = readFileSync(new URL('./TableHandlesLayer.tsx', import.meta.url), 'utf8')
assert.match(layer, /ref=\{addRow\}\s+style=\{\{ left: box.left, top: tableBottom \+ gap,/)
assert.match(layer, /const columnBarLeft = clamp\(tableRight \+ gap,/)
assert.match(layer, /ref=\{addColumn\}\s+style=\{\{ left: columnBarLeft, top: box.top,/)
assert.match(layer, /if \(spot\) revealTableAddBar\(spot\)/)
assert.match(layer, /run\(insertRow\([^\n]+\), 'row'\)/)
assert.match(layer, /run\(insertColumn\([^\n]+\), 'column'\)/)
const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8')
assert.match(css, /\.rm-table-add-spot \{ position: absolute;/)

console.log('tableAddBars: passed')
