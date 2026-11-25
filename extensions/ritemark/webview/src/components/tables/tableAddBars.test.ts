import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { watchTableAddBars } from './tableAddBars'

const win = new EventTarget()
const frame = {
  parentElement: null,
  clientLeft: 0, clientTop: 0,
  clientWidth: 400, clientHeight: 500,
  offsetWidth: 400, offsetHeight: 500,
  getBoundingClientRect: () => ({ left: 0, top: 50, width: 400, height: 500 }),
}
Object.assign(win, { getComputedStyle: () => ({ overflowX: 'auto', overflowY: 'auto' }) })
const originalObserver = globalThis.ResizeObserver
globalThis.ResizeObserver = class {
  observe() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

let scrollTop = 0
let scrollLeft = 0
const table = {
  ownerDocument: { defaultView: win, documentElement: { clientWidth: 800, clientHeight: 700 } },
  getBoundingClientRect: () => ({
    top: 50 - scrollTop, bottom: 950 - scrollTop,
    left: -scrollLeft, right: 500 - scrollLeft,
  }),
}
const row = { style: { visibility: '' } }
const column = { style: { visibility: '' } }
try {
  const stop = watchTableAddBars(
    table as unknown as HTMLTableElement, frame as unknown as HTMLElement,
    row as unknown as HTMLElement, column as unknown as HTMLElement,
  )
  assert.equal(row.style.visibility, 'hidden', 'the bottom of a tall table is below the scrollport')
  assert.equal(column.style.visibility, 'hidden', 'the right edge of a wide table is outside the scrollport')

  scrollTop = 395
  win.dispatchEvent(new Event('scroll'))
  assert.equal(row.style.visibility, 'hidden', 'a partially exposed bar stays hidden while its real edge is below the clip')

  scrollTop = 400
  scrollLeft = 100
  win.dispatchEvent(new Event('scroll'))
  assert.equal(row.style.visibility, 'visible', 'the bottom edge is in view immediately on scroll')
  assert.equal(column.style.visibility, 'visible', 'the right edge is in view immediately on scroll')

  scrollTop = 200
  win.dispatchEvent(new Event('scroll'))
  assert.equal(row.style.visibility, 'hidden', 'scrolling back hides the row bar immediately')
  stop()
  scrollTop = 400
  win.dispatchEvent(new Event('scroll'))
  assert.equal(row.style.visibility, 'hidden', 'cleanup removes the scroll listener')
} finally {
  globalThis.ResizeObserver = originalObserver
}

// Both spots use table-local coordinates and share the table's absolute overlay.
const layer = readFileSync(new URL('./TableHandlesLayer.tsx', import.meta.url), 'utf8')
assert.match(layer, /ref=\{addRow\}\s+style=\{\{ left: box.left, top: tableBottom - bar,/)
assert.match(layer, /ref=\{addColumn\}\s+style=\{\{ left: tableRight - bar, top: box.top,/)
const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8')
assert.match(css, /\.rm-table-add-spot \{ position: absolute;/)

console.log('tableAddBars: passed')
