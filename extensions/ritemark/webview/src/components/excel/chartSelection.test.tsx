import { compileCellRules } from './cellRules'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createDocument } from '@mixmark-io/domino'
import * as React from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { readWorkbook } from './readWorkbook'
import { SheetGrid } from './SheetGrid'
import { chartShortcutDescription, isChartShortcut } from './chartSelection'
import { isMac } from '../../hooks/usePlatform'

Object.assign(globalThis, { React })

async function withGrid(run: (ui: { host: Element; dispatch: (target: Element, type: string, props?: Record<string, unknown>) => Event; focused: () => Element | undefined }) => void, variant?: 'frozen' | 'untitled' | 'adjacent' | 'separated') {
  const fixture = new URL(
    '../../../../../../docs/development/releases/v2.3.0/sprint-158-excel/research/spike/fixtures/sales-report.xlsx', import.meta.url,
  )
  const model = await readWorkbook(readFileSync(fixture))
  const sheet = model.sheets.find(({ name }) => name === 'Sales 2026')!
  const drawing = sheet.layout.drawings.find(({ what }) => what === 'chart')!
  if (variant === 'frozen') {
    sheet.layout.frozen = { rows: 2, cols: 2 }
    drawing.anchor = { pos: { x: 0, y: 0 }, size: { width: 400, height: 260 } }
    sheet.layout.drawings.push({ ...drawing, anchor: { pos: { x: 400, y: 300 }, size: { width: 400, height: 260 } } })
  }
  if (variant === 'untitled' && drawing.chart?.supported) {
    drawing.chart.title = { text: '' }
    drawing.chart.axes[0].title = { text: 'Axis title' }
  }
  if ((variant === 'adjacent' || variant === 'separated') && drawing.chart?.supported) {
    const chart = drawing.chart
    chart.kind = 'combo'
    const [plot] = chart.plots
    const [series] = plot.series
    series.val = { ...series.val!, formula: "'Sales 2026'!$B$2:$B$7" }
    const column = variant === 'adjacent' ? 'C' : 'D'
    chart.plots.push({ ...plot, kind: 'line', series: [
      { ...series, val: { ...series.val, formula: `'sales 2026'!$${column}$2:$${column}$7` } },
    ] })
  }
  const doc = createDocument('<!doctype html><html><body></body></html>') as unknown as Document
  let active: Element | undefined
  const createElement = doc.createElement.bind(doc)
  doc.createElement = ((tag: string) => {
    if (tag === 'canvas') return { getContext: () => null }
    const element = createElement(tag)
    if (tag === 'div') Object.defineProperty(element, 'focus', { value: () => {
      if (element === active) return
      active = element
      const event = doc.createEvent('Event')
      event.initEvent('focusin', true, false)
      element.dispatchEvent(event)
    } })
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
  try {
    flushSync(() => root.render(<SheetGrid model={model} sheet={sheet} version={0} editable cellRules={compileCellRules(model, sheet)}
      onEdit={() => edits++} getInput={() => ''} getFormula={() => undefined} onOpenInExcel={() => {}} openInLabel="Open in Excel" />))
    run({ host, dispatch, focused: () => active })
    assert.equal(edits, 0)
  } finally {
    await new Promise<void>((resolve) => setImmediate(resolve))
    root.unmount()
    for (const key of Object.keys(globals)) Reflect.deleteProperty(globalThis, key)
  }
}

test('worksheet chart choosing updates the formula bar until Escape or an outside click', () => withGrid(({ host, dispatch }) => {
  const selected = () => host.querySelector('[data-sheet-chart][aria-pressed="true"]') ?? null
  const formula = () => host.querySelector('textarea')!
  const chart = host.querySelector('[data-sheet-chart][tabindex="0"]')!
  assert.equal(chart.getAttribute('aria-label'), 'Column chart: Revenue by region')
  assert.equal(selected(), null)
  assert.ok(formula().previousElementSibling?.querySelector('svg'))
  dispatch(chart, 'click', { button: 0 })
  assert.equal(selected(), chart)
  assert.equal(formula().getAttribute('aria-label'), 'Chart details')
  assert.equal(formula().value, 'Revenue by region · a column chart from Q5:Q7. Change it in Excel.')
  assert.ok(formula().readOnly)
  assert.ok(!(formula().parentNode as Element).querySelector('svg'))
  dispatch(formula(), 'pointerdown', { button: 0 })
  dispatch(formula(), 'click', { button: 0 })
  assert.equal(selected(), chart)
  assert.match(host.textContent!, /Chart/)
  assert.ok(!host.querySelector('.sg-selection'))

  dispatch(chart, 'keydown', { key: 'Escape' })
  assert.equal(selected(), null)
  assert.ok(host.querySelector('.sg-selection'))

  dispatch(chart, 'keydown', { key: 'Enter' })
  assert.equal(selected(), chart)
  dispatch(host.ownerDocument!.body.querySelector('button')!, 'click')
  assert.equal(selected(), null)

  dispatch(chart, 'keydown', { key: ' ' })
  assert.equal(selected(), chart)
  dispatch(host.querySelector('.sg-scroller')!, 'mousedown', { button: 0, clientX: 75, clientY: 50, detail: 1 })
  assert.equal(selected(), null)
}))

test('Tab steps cells on a chart worksheet and Shift+Tab at A1 stays in the grid', () => withGrid(({ host, dispatch }) => {
  const grid = host.querySelector('.sg-scroller')!
  const bar = host.querySelector('textarea')!
  assert.ok(dispatch(grid, 'keydown', { key: 'Tab', shiftKey: true }).defaultPrevented)
  assert.equal(bar.getAttribute('aria-label'), 'What A1 holds')
  assert.ok(dispatch(grid, 'keydown', { key: 'Tab' }).defaultPrevented)
  assert.equal(bar.getAttribute('aria-label'), 'What B1 holds')
  assert.ok(dispatch(grid, 'keydown', { key: 'Tab', shiftKey: true }).defaultPrevented)
  assert.equal(bar.getAttribute('aria-label'), 'What A1 holds')
}))

test('choosing a frozen copy focuses its main chart and keyboard navigation clears the old choice', () => withGrid(({ host, dispatch, focused }) => {
  const grid = host.querySelector('.sg-scroller')!
  const [first, second] = host.querySelectorAll('[data-sheet-chart][tabindex="0"]')
  const copy = host.querySelector('[data-sheet-chart][aria-hidden="true"]')!
  dispatch(copy, 'click', { button: 0 })
  assert.ok(focused() === first, 'focus moves to the first target')
  assert.equal(first.getAttribute('aria-pressed'), 'true')
  dispatch(first, 'keydown', { key: 'Tab' })
  assert.ok(focused() === second, 'focus moves to the second target')
  assert.equal(first.getAttribute('aria-pressed'), 'false')
  dispatch(second, 'keydown', { key: 'Enter' })
  dispatch(second, 'keydown', { key: 'Tab' })
  assert.ok(focused() === grid, 'focus moves to the grid target')
  assert.equal(dispatch(grid, 'keydown', { key: 'F6' }).defaultPrevented, false)
  assert.equal(dispatch(grid, 'keydown', { key: 'F6', shiftKey: true }).defaultPrevented, false)
  assert.ok(focused() === grid)
  assert.equal(grid.getAttribute('aria-description'), chartShortcutDescription())
  const objectShortcut = { key: '5', code: 'Digit5', ctrlKey: !isMac, metaKey: isMac, altKey: true }
  assert.ok(dispatch(grid, 'keydown', { ...objectShortcut, shiftKey: true }).defaultPrevented)
  assert.ok(focused() === second, 'focus moves to the second target')
  dispatch(second, 'keydown', { key: 'Escape' })
  assert.ok(focused() === grid, 'focus moves to the grid target')
  assert.ok(dispatch(grid, 'keydown', { ...objectShortcut, key: '∞' }).defaultPrevented)
  assert.ok(focused() === first, 'focus moves to the first target')
  flushSync(() => (second as HTMLElement).focus())
  dispatch(second, 'keydown', { key: 'Enter' })
  flushSync(() => (first as HTMLElement).focus())
  assert.equal(second.getAttribute('aria-pressed'), 'false')
}, 'frozen'))

test('an empty chart title leaves the axis title out of the formula bar', () => withGrid(({ host, dispatch }) => {
  const chart = host.querySelector('[data-sheet-chart]')!
  assert.match(chart.textContent!, /Axis title/)
  dispatch(chart, 'click', { button: 0 })
  assert.equal(host.querySelector('textarea')!.value, 'a column chart from Q5:Q7. Change it in Excel.')
}, 'untitled'))

for (const [variant, expected] of [['adjacent', 'B2:C7'], ['separated', 'B2:B7, D2:D7']] as const) {
  test(`the combo chart bar formats ${variant} series`, () => withGrid(({ host, dispatch }) => {
    dispatch(host.querySelector('[data-sheet-chart]')!, 'click', { button: 0 })
    assert.equal(host.querySelector('textarea')!.value, `Revenue by region · a combo chart from ${expected}. Change it in Excel.`)
  }, variant))
}

test('chart cycling uses the platform modifier and ignores AltGraph', () => {
  const windows = { code: 'Digit5', ctrlKey: true, altKey: true, metaKey: false, getModifierState: () => false }
  const mac = { ...windows, ctrlKey: false, metaKey: true }
  assert.equal(isChartShortcut(windows, false), true)
  assert.equal(isChartShortcut(windows, true), false)
  assert.equal(isChartShortcut(mac, true), true)
  assert.equal(isChartShortcut(mac, false), false)
  assert.equal(isChartShortcut({ ...windows, getModifierState: () => true }, false), false)
  assert.match(chartShortcutDescription(true), /Cmd\+Option\+5.*Shift/)
  assert.match(chartShortcutDescription(false), /Ctrl\+Alt\+5.*Shift/)
})

test('the chart-sheet formula bar is mounted independently of chart selection', () => {
  const source = readFileSync(new URL('../SpreadsheetViewer.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /chosen\s*&&\s*<SheetFormulaBar/)
  assert.match(source, /showFormulaIcon=\{false\}/)
  assert.match(source, /value=\{chartSelection\.chosen\?\.text \?\? ''\}/)
})

test('chart selection draws a square ring on an overlay outside pointer-mode outline suppression', () => {
  const css = readFileSync(new URL('./sheetGrid.css', import.meta.url), 'utf8')
  assert.match(css, /\.sg-chart\[aria-pressed="true"\]::after,\s*[^\n]*data-input-mode[^\n]*:focus-visible::after\s*\{([^}]+)/)
  const ring = css.match(/:focus-visible::after\s*\{([^}]+)/)![1]
  assert.match(ring, /pointer-events: none/)
  assert.match(ring, /outline: 2px solid/)
  assert.doesNotMatch(ring, /border-radius|overflow/)
})
