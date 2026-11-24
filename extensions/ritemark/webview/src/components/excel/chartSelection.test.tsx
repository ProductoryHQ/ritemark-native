import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createDocument } from '@mixmark-io/domino'
import * as React from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { readWorkbook } from './readWorkbook'
import { SheetGrid } from './SheetGrid'

Object.assign(globalThis, { React })

test('worksheet chart choosing updates the formula bar until Escape or an outside click', async () => {
  const fixture = new URL(
    '../../../../../../docs/development/releases/v2.3.0/sprint-158-excel/research/spike/fixtures/sales-report.xlsx', import.meta.url,
  )
  const model = await readWorkbook(readFileSync(fixture))
  const sheet = model.sheets.find(({ name }) => name === 'Sales 2026')!
  const doc = createDocument('<!doctype html><html><body></body></html>') as unknown as Document
  const createElement = doc.createElement.bind(doc)
  doc.createElement = ((tag: string) => {
    if (tag === 'canvas') return { getContext: () => null }
    const element = createElement(tag)
    if (tag === 'style') Object.defineProperty(element, 'dataset', { value: {} })
    return element
  }) as typeof doc.createElement
  const host = doc.createElement('div')
  const outside = doc.createElement('button')
  doc.body.appendChild(outside)
  doc.body.appendChild(host)
  const prototype = Object.getPrototypeOf(host)
  prototype.scrollTo = () => {}
  const getBoundingClientRect = () => ({ left: 0, top: 0 })
  prototype.getBoundingClientRect = getBoundingClientRect
  const globals = { document: doc, window: globalThis, HTMLIFrameElement: class {},
    ResizeObserver: class { observe() {} disconnect() {} } }
  Object.assign(globalThis, globals)
  const root = createRoot(host)
  let edits = 0
  const dispatch = (target: Element, type: string, props: Record<string, unknown> = {}) => {
    const event = doc.createEvent('Event')
    event.initEvent(type, true, true)
    Object.assign(event, props)
    flushSync(() => target.dispatchEvent(event))
    return event
  }
  const selected = () => host.querySelector('[data-sheet-chart][aria-pressed="true"]') ?? null
  const formula = () => host.querySelector('textarea')!
  try {
    flushSync(() => root.render(<SheetGrid model={model} sheet={sheet} version={0} editable
      onEdit={() => edits++} getInput={() => ''} getFormula={() => undefined} onOpenInExcel={() => {}} openInLabel="Open in Excel" />))
    const chart = host.querySelector('[data-sheet-chart][tabindex="0"]')!
    assert.equal(chart.getAttribute('aria-label'), 'Column chart: Revenue by region')
    assert.equal(selected(), null)
    dispatch(chart, 'click', { button: 0 })
    assert.equal(selected(), chart)
    assert.equal(formula().getAttribute('aria-label'), 'Chart details')
    assert.equal(formula().value, 'Revenue by region · a column chart from Q5:Q7. Change it in Excel.')
    assert.ok(formula().readOnly)
    assert.match(host.textContent!, /Chart/)
    assert.ok(!host.querySelector('.sg-selection'))

    dispatch(chart, 'keydown', { key: 'Escape' })
    assert.equal(selected(), null)
    assert.ok(host.querySelector('.sg-selection'))

    dispatch(chart, 'keydown', { key: 'Enter' })
    assert.equal(selected(), chart)
    dispatch(outside, 'click')
    assert.equal(selected(), null)

    dispatch(chart, 'keydown', { key: ' ' })
    assert.equal(selected(), chart)
    dispatch(host.querySelector('.sg-scroller')!, 'mousedown', { button: 0, clientX: 75, clientY: 50, detail: 1 })
    assert.equal(selected(), null)
    assert.equal(edits, 0)
  } finally {
    await new Promise<void>((resolve) => setImmediate(resolve))
    root.unmount()
    delete (globalThis as { document?: Document }).document
    for (const key of Object.keys(globals)) Reflect.deleteProperty(globalThis, key)
  }
})
