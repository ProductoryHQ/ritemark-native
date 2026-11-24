import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { serialize } from 'node:v8'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { parse } from 'node-html-parser'
import { ChartView } from './ChartView'
import { DrawingView } from './DrawingView'
import { drawsChart, layoutChart } from './chartLayout'
import { resolveSeries } from './chartSeries'
import { keptNotice } from './keptNotice'
import { readWorkbook, type SheetModel, type WorkbookModel } from './readWorkbook'
import { modelSource } from './sheetSource'

Object.assign(globalThis, { React })

const open = (file: string) => readWorkbook(readFileSync(new URL(`../../../../src/excel/fixtures/excel-174/${file}.xlsx`, import.meta.url)))
const drawingOf = (sheet: SheetModel) => sheet.layout.drawings.find(({ what }) => what === 'chart')!
const measure = (text: string) => text.length * 6
function forSheet(book: WorkbookModel, sheet: SheetModel) {
  const { chart } = drawingOf(sheet)
  assert.ok(drawsChart(chart))
  const [series] = resolveSeries(chart, book.sheets, book)
  return layoutChart(chart, series, 480, 288, measure, book.date1904)
}
const markupOf = (layout: ReturnType<typeof layoutChart>) => parse(renderToStaticMarkup(React.createElement(ChartView, { layout })))
const chartGroup = (group: string) => `[data-chart="${group}"]`
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-8, `${a} ≈ ${b}`)

const kinds = await open('charts-all-kinds')
const before = serialize(kinds)
const barCases = new Map([
  ['Clustered column', [70, 10]],
  ['Stacked column', [140, 20]],
  ['100% stacked column', [1, .1]],
  ['Bar', [70, 10]],
  ['Stacked bar', [140, 20]],
  ['100% stacked bar', [1, .1]],
])
for (const sheet of kinds.sheets.slice(0, 8)) {
  const layout = forSheet(kinds, sheet)
  const markup = markupOf(layout)
  const labels = markup.querySelector(chartGroup('axis-labels'))!.querySelectorAll('text').map((el) => el.text)
  assert.ok(labels.includes('Jan') && labels.includes('Jun'), sheet.name)
  assert.ok(markup.querySelector(chartGroup('gridlines'))!.querySelectorAll('line').length > 1)
  assert.ok(markup.querySelector(chartGroup('axes'))!.querySelectorAll('line').length >= 2)
  const horizontal = sheet.name.toLowerCase().endsWith('bar')
  close(layout.categoryBand, (horizontal ? layout.plot.height : layout.plot.width) / 6)
  assert.equal(layout.legend?.position, 'b')
  assert.equal(layout.legend?.entries.length, 3)
  assert.ok(layout.legend.bounds.y > layout.plot.y + layout.plot.height)
  assert.equal(keptNotice(sheet.layout), undefined)

  const expected = barCases.get(sheet.name)
  if (expected) {
    const [max, step] = expected
    assert.equal(layout.scale.max, max, sheet.name)
    assert.equal(layout.scale.step, step, sheet.name)
    assert.equal(layout.scale.min, 0)
    assert.equal(markup.querySelector(chartGroup('bars'))!.querySelectorAll('rect').length, 18)
    assert.ok(labels.includes(max === 1 ? '100%' : String(max)))
    const first = layout.bars.filter(({ index }) => index === 0)
    const thickness = horizontal ? first[0].height : first[0].width
    close(thickness, layout.categoryBand / (1 + 2 * 1.27 + 2.19))
    const gap = horizontal ? first[0].y - first[1].y : first[1].x - first[0].x
    close(gap / thickness, 1.27)
    if (sheet.name.toLowerCase().includes('stacked')) {
      for (let i = 0; i < 6; i++) {
        const parts = layout.bars.filter(({ index }) => index === i)
        close(parts[1].from, parts[0].to)
        close(parts[2].from, parts[1].to)
        if (max === 1) close(parts[2].to, 1)
        else close(parts[2].to, [95, 102, 104, 111, 117, 127][i])
      }
    }
  } else {
    assert.deepEqual(layout.scale.ticks, [0, 10, 20, 30, 40, 50, 60, 70])
    const lines = markup.querySelector(chartGroup('lines'))!.querySelectorAll('polyline')
    assert.equal(lines.length, 3)
    for (const line of lines) assert.equal(line.getAttribute('points')?.split(' ').length, 6)
    assert.equal(markup.querySelector(chartGroup('markers'))!.children.length, sheet.name === 'Line' ? 0 : 18)
  }
}
assert.deepEqual(serialize(kinds), before, 'drawing must leave workbook cells and metadata intact')

const threeD = await open('charts-3d')
for (const sheet of threeD.sheets.slice(0, 3)) {
  const layout = forSheet(threeD, sheet)
  const markup = markupOf(layout)
  if (sheet.name.endsWith('line')) assert.equal(markup.querySelectorAll('polyline').length, 3)
  else assert.equal(markup.querySelector(chartGroup('bars'))!.querySelectorAll('rect').length, 18)
}
const pie = drawingOf(threeD.sheets[3])
const fallback = renderToStaticMarkup(React.createElement(DrawingView, {
  drawing: pie, style: {}, workbook: threeD, version: 0, width: 480, height: 288,
}))
assert.match(fallback, /class="sg-object"/)
assert.match(fallback, /Chart: Handovers by depot/)
assert.match(fallback, /Kept in the file\. Open in Excel to see it\./)
const worksheet = kinds.sheets[0]
assert.equal(keptNotice({ drawings: [drawingOf(worksheet), pie], conditionalFormats: 0 }),
  "This sheet has a chart. It's kept in the file; Open in Excel to see it.")
assert.equal(keptNotice({ drawings: [drawingOf(worksheet), { ...pie, what: 'image' }], conditionalFormats: 1 }),
  "This sheet has a picture and colour rules. They're kept in the file; Open in Excel to see them.")

const colours = await open('charts-colours')
const tints = forSheet(colours, colours.sheets[0])
assert.equal(tints.legend?.entries.length, 8)
assert.deepEqual(tints.bars.filter(({ index }) => index === 0).map(({ color }) => color), tints.legend.entries.map(({ color }) => color))
assert.equal(new Set(tints.bars.map(({ color }) => color)).size, 7)
const set = forSheet(colours, colours.sheets[1])
assert.notDeepEqual(set.bars.map(({ color }) => color), forSheet(colours, colours.sheets[2]).bars.map(({ color }) => color))
const automatic = forSheet(colours, colours.sheets[2])
assert.equal(automatic.legend?.position, 'r')
assert.ok(automatic.legend.bounds.x > automatic.plot.x + automatic.plot.width)
const labels = forSheet(colours, colours.sheets[3])
assert.equal(labels.legend?.position, 't')
assert.deepEqual(labels.scale.ticks, [.74, .76, .78, .8, .82, .84, .86, .88, .9, .92, .94])
assert.ok(labels.legend.bounds.y < labels.plot.y)
assert.deepEqual(labels.titles.map(({ text }) => text), ['On-time share against target', 'Month', 'On time'])
assert.deepEqual(labels.dataLabels.map(({ text }) => text), ['81%', '84%', '83%', '88%', '90%', '92%'])
assert.match(markupOf(labels).querySelector('svg')!.getAttribute('style')!, /background:#ffffff/)

const sales = await readWorkbook(readFileSync(new URL(
  '../../../../../../docs/development/releases/v2.3.0/sprint-158-excel/research/spike/fixtures/sales-report.xlsx', import.meta.url,
)))
const salesSheet = sales.sheets.find(({ name }) => name === 'Sales 2026')!
const drawing = drawingOf(salesSheet)
const renderDrawing = (version: number) => parse(renderToStaticMarkup(React.createElement(DrawingView, {
  drawing, style: {}, workbook: sales, version, width: 480, height: 288,
})))
assert.equal(renderDrawing(0).querySelector('svg')!.getAttribute('aria-label'), 'Column chart: Revenue by region')
const bar = (version: number) => Number(renderDrawing(version).querySelector(chartGroup('bars'))!.querySelectorAll('rect')[1].getAttribute('height'))
const oldHeight = bar(0)
const source = modelSource(sales)
source.write(salesSheet.name, 5, 16, source.valueFor(salesSheet.name, 5, 16, '9,999'))
assert.ok(bar(1) < oldHeight)
assert.equal(forSheet(sales, salesSheet).bars[1].to, 9999)

const chartSheets = await open('chart-sheet')
const revenue = chartSheets.sheets.find(({ name }) => name === 'Revenue trend')!
assert.equal(revenue.kind, 'chartsheet')
assert.equal(forSheet(chartSheets, revenue).name, 'Line chart: Revenue trend')
const lost = chartSheets.sheets.find(({ name }) => name === 'Lost source')!
const lostChart = drawingOf(lost).chart
assert.ok(drawsChart(lostChart))
const cached = lostChart.plots[0].series[0].val!.points.get(0)
assert.equal(forSheet(chartSheets, lost).bars[0].to, cached)
const unnamed = { ...lostChart, title: undefined }
assert.equal(layoutChart(unnamed, resolveSeries(unnamed, chartSheets.sheets, chartSheets)[0], 480, 288, measure).name, 'Column chart')

const values = new Map(Array.from({ length: 6000 }, (_, i) => [i, i === 101 ? 1000 : i === 102 ? -1000 : 0]))
const long = { ...unnamed, kind: 'line' as const, plots: [{ ...unnamed.plots[0], kind: 'line' as const }] }
const sparse = { ...unnamed.plots[0].series[0], val: { type: 'number' as const, points: values } }
const thinned = layoutChart(long, [sparse], 480, 288, measure)
const positions = thinned.lines[0].segments.flat().map(({ y }) => y)
assert.ok(positions.length <= 5000)
assert.ok(thinned.axisLabels.length < 50, 'category labels thin as the bands shrink')
assert.ok(Math.min(...positions) < thinned.plot.y + thinned.plot.height / 2)
assert.ok(Math.max(...positions) > thinned.plot.y + thinned.plot.height / 2)

console.log('chartLayout and ChartView: all passed')
