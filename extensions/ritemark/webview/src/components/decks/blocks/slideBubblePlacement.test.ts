import assert from 'node:assert/strict'
import { createPopper } from '@popperjs/core'
import * as domino from '@mixmark-io/domino'
import type { Editor } from '@tiptap/core'
import { slideBubblePopperOptions, slideBubbleReference } from './slideBubblePlacement'

const { createWindow } = domino as unknown as { createWindow(html: string): Window & typeof globalThis }
const window = createWindow('<!doctype html><html><body><div id="stage"><div id="editor">Chosen words</div></div><div id="bubble"></div></body></html>')
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
const editor = doc.getElementById('editor')!
const bubble = doc.getElementById('bubble')!
const text = editor.firstChild!
const stageRect = rect(200, 100, 600, 400)
layout(doc.documentElement, rect(0, 0, 1200, 900))
layout(stage, stageRect)
layout(bubble, rect(0, 0, 240, 40))
bubble.style.position = 'fixed'
const computedStyle = window.getComputedStyle.bind(window)
Object.defineProperty(window, 'getComputedStyle', { value: (element: Element) => {
  const style = computedStyle(element)
  // Domino omits computed defaults that Popper uses to detect fixed containing blocks.
  return { position: style.position || 'static', transform: 'none', perspective: 'none', direction: 'ltr' } as CSSStyleDeclaration
} })

function place(selection: DOMRect, scale = 1) {
  // Stub the browser's range measurement, which already applies the canvas transform.
  Object.defineProperty(doc, 'createRange', { configurable: true, value: () => ({
    setStart: (node: Node, offset: number) => assert.deepEqual([node, offset], [text, 0]),
    setEnd: (node: Node, offset: number) => assert.deepEqual([node, offset], [text, 6]),
    getBoundingClientRect: () => rect(
      stageRect.left + selection.left * scale, stageRect.top + selection.top * scale,
      selection.width * scale, selection.height * scale,
    ),
  }) })
  const reference = slideBubbleReference({
    view: {
      dom: editor,
      state: { selection: { from: 1, to: 7 } },
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
    return { left: x, top: y }
  } finally {
    popper.destroy()
  }
}

assert.deepEqual(place(rect(100, 160, 80, 20)), { left: 300, top: 210 })
assert.deepEqual(place(rect(100, 4, 80, 20)), { left: 300, top: 134 })
assert.deepEqual(place(rect(540, 160, 50, 20)), { left: 555, top: 210 })
assert.deepEqual(place(rect(100, 160, 80, 20), 0.5), { left: 250, top: 130 })
assert.deepEqual(place(rect(100, 160, 80, 20), 1.5), { left: 350, top: 290 })

console.log('slideBubblePlacement: passed')
