import assert from 'node:assert/strict'
import { createPopper } from '@popperjs/core'
import * as domino from '@mixmark-io/domino'
import type { Editor } from '@tiptap/core'
import { slideBubblePopperOptions, slideBubbleReference } from './slideBubblePlacement'

const { createWindow } = domino as unknown as { createWindow(html: string): Window & typeof globalThis }
const window = createWindow('<!doctype html><html><body><div id="stage"><div id="slide"><div id="editor">Chosen words</div></div></div><div id="bubble"></div></body></html>')
Object.assign(globalThis, { window, document: window.document, Element: window.Element, HTMLElement: window.HTMLElement })

function rect(left: number, top: number, width: number, height: number): DOMRect {
  const bounds = { left, top, width, height, x: left, y: top, right: left + width, bottom: top + height }
  return { ...bounds, toJSON: () => bounds }
}

function layout(element: HTMLElement, bounds: DOMRect) {
  Object.defineProperties(element, {
    getBoundingClientRect: { value: () => bounds },
    clientWidth: { value: bounds.width },
    clientHeight: { value: bounds.height },
    clientLeft: { value: 0 },
    clientTop: { value: 0 },
    offsetWidth: { value: bounds.width },
    offsetHeight: { value: bounds.height },
    offsetLeft: { value: 0 },
    offsetTop: { value: 0 },
  })
}

const doc = window.document
Object.defineProperties(window, { pageXOffset: { value: 0 }, pageYOffset: { value: 0 } })
const stage = doc.getElementById('stage')!
const slide = doc.getElementById('slide')!
const editor = doc.getElementById('editor')!
const bubble = doc.getElementById('bubble')!
const text = editor.firstChild!
const stageRect = rect(200, 100, 600, 400)
layout(doc.documentElement, rect(0, 0, 1200, 900))
layout(stage, stageRect)
layout(bubble, rect(0, 0, 240, 40))
Object.defineProperties(slide, {
  clientWidth: { value: 960 },
  clientHeight: { value: 540 },
  clientLeft: { value: 0 },
  clientTop: { value: 0 },
})
slide.style.overflow = 'hidden'
bubble.style.position = 'fixed'
const computedStyle = window.getComputedStyle.bind(window)
Object.defineProperty(window, 'getComputedStyle', { value: (element: Element) => {
  const style = computedStyle(element)
  // Domino omits computed defaults that Popper uses to detect fixed containing blocks.
  return { position: style.position || 'static', overflow: style.overflow, transform: 'none', perspective: 'none', direction: 'ltr' } as CSSStyleDeclaration
} })

function place(selection: DOMRect, scale = 1, ranges = [{ $from: { pos: 1 }, $to: { pos: 7 } }], scrollTop = 0) {
  Object.defineProperty(slide, 'getBoundingClientRect', {
    configurable: true,
    value: () => rect(stageRect.left, stageRect.top - scrollTop, 960 * scale, 540 * scale),
  })
  // Stub the browser's range measurement, which already applies the canvas transform.
  Object.defineProperty(doc, 'createRange', { configurable: true, value: () => ({
    setStart: (node: Node, offset: number) => assert.deepEqual([node, offset], [text, 0]),
    setEnd: (node: Node, offset: number) => assert.deepEqual([node, offset], [text, 6]),
    getBoundingClientRect: () => selection.width === 0 && selection.height === 0 ? selection : rect(
      stageRect.left + selection.left * scale, stageRect.top + selection.top * scale - scrollTop,
      selection.width * scale, selection.height * scale,
    ),
  }) })
  const reference = slideBubbleReference({
    view: {
      dom: editor,
      state: {
        doc: { content: { size: text.textContent!.length } },
        selection: { from: ranges[0].$from.pos, to: ranges[0].$to.pos, ranges },
      },
      coordsAtPos: (position: number, side?: number) => {
        assert.deepEqual([position, side], position === 1 ? [1, undefined] : [7, -1])
        return rect(position === 1 ? 300 : 380, 260, 0, 20)
      },
      domAtPos: (position: number) => ({ node: text, offset: position - 1 }),
    },
  } as unknown as Editor)
  const options = slideBubblePopperOptions(stage)
  const popper = createPopper({ getBoundingClientRect: reference, contextElement: editor }, bubble, {
    ...options,
    placement: 'top-start',
    modifiers: [
      ...options.modifiers!,
      { name: 'offset', options: { offset: [0, 10] } },
      { name: 'preventOverflow', options: { padding: { top: 2, bottom: 2, left: 5, right: 5 } } },
      { name: 'flip', options: { padding: 5 } },
      { name: 'eventListeners', enabled: false },
      { name: 'applyStyles', enabled: false },
    ],
  })
  try {
    popper.forceUpdate()
    const { x, y } = popper.state.modifiersData.popperOffsets!
    return {
      left: x,
      top: y,
      hidden: popper.state.attributes.popper['data-popper-reference-hidden'],
    }
  } finally {
    popper.destroy()
  }
}

assert.deepEqual(place(rect(100, 160, 80, 20)), { left: 300, top: 210, hidden: false })
assert.deepEqual(place(rect(100, 4, 80, 20)), { left: 300, top: 134, hidden: false })
assert.deepEqual(place(rect(540, 160, 50, 20)), { left: 555, top: 210, hidden: false })
assert.deepEqual(place(rect(100, 160, 80, 20), 0.5), { left: 250, top: 130, hidden: false })
assert.deepEqual(place(rect(100, 160, 80, 20), 1.5), { left: 350, top: 290, hidden: false })

for (const scale of [0.5, 1, 1.5]) {
  const selection = rect(Math.min(900, 540 / scale), 500, 20, 20)
  // At 1.5× these words are drawn below the slide's unscaled clientHeight.
  assert.equal(place(selection, scale, undefined, 520 * scale - 200).hidden, false)
  assert.equal(place(selection, scale, undefined, 520 * scale - 1).hidden, false)
  assert.equal(place(selection, scale, undefined, 520 * scale).hidden, true)
}

// An empty DOM range at a block boundary uses the editor's endpoint geometry.
assert.deepEqual(place(rect(0, 0, 0, 0)), { left: 300, top: 210, hidden: false })

// CellSelection puts the head cell first, even when it is last in document order.
assert.deepEqual(place(rect(100, 160, 80, 20), 1, [
  { $from: { pos: 5 }, $to: { pos: 7 } },
  { $from: { pos: 1 }, $to: { pos: 3 } },
]), { left: 300, top: 210, hidden: false })

console.log('slideBubblePlacement: passed')
