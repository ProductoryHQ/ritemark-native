import { test } from 'node:test'
import { createDocument } from '@mixmark-io/domino'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { serialize } from 'node:v8'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { parse } from 'node-html-parser'
import { ChartView } from './ChartView'
import { DrawingView } from './DrawingView'
import { drawsChart, layoutChart } from './chartLayout'
import { readChart } from './readChart'
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
const combo = drawingOf(kinds.sheets.find(({ name }) => name === 'Combo') ?? kinds.sheets[kinds.sheets.length - 1])
assert.equal(combo.chart?.kind, 'combo')
const fallback = renderToStaticMarkup(React.createElement(DrawingView, {
  drawing: combo, style: {}, workbook: kinds, version: 0, width: 480, height: 288,
}))
assert.match(fallback, /class="sg-object"/)
assert.match(fallback, /Kept in the file\. Open in Excel to see it\./)
const worksheet = kinds.sheets[0]
assert.equal(keptNotice({ drawings: [drawingOf(worksheet), combo], conditionalFormats: 0 }),
  "This sheet has a chart. It's kept in the file; Open in Excel to see it.")
assert.equal(keptNotice({ drawings: [drawingOf(worksheet), { ...combo, what: 'image' }], conditionalFormats: 1 }),
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

const synthetic = (kind: 'column' | 'bar' | 'line', plot = '', cat = '', val = '', extra = '') => {
  const node = kind === 'line' ? 'lineChart' : 'barChart'
  const chart = readChart(`<chartSpace><chart><plotArea><${node}>
    <barDir val="${kind === 'bar' ? 'bar' : 'col'}"/>${plot}<axId val="1"/><axId val="2"/>
    </${node}><catAx><axId val="1"/>${cat}</catAx><valAx><axId val="2"/>${val}</valAx></plotArea>${extra}</chart></chartSpace>`)
  assert.ok(drawsChart(chart))
  return chart
}
const seriesOf = (values: (number | undefined)[], name = 'Revenue', category = 'Category') => ({
  pointStyles: [],
  tx: { type: 'string' as const, points: new Map([[0, name]]) },
  cat: { type: 'string' as const, points: new Map(values.map((_, i) => [i, `${category} ${i + 1}`])) },
  val: { type: 'number' as const, pointCount: values.length,
    points: new Map(values.flatMap((value, i) => value === undefined ? [] : [[i, value] as const])) },
})
const draw = (model: ReturnType<typeof synthetic>, series = [seriesOf([30, 80, 60])], width = 480) =>
  layoutChart(model, series, width, 288, measure)

test('automatic rotation fits horizontal labels or tilts crowded categories', () => {
  for (const rotation of [-60000000, 5400001]) {
    const model = synthetic('column', '', `<txPr><bodyPr rot="${rotation}"/></txPr>`)
    const wide = draw(model)
    assert.ok(wide.axisLabels.every(({ style }) => !style.rotation))
    const narrow = draw(model, undefined, 150)
    const categories = narrow.axisLabels.filter(({ text }) => text.startsWith('Category'))
    assert.ok(categories.length > 1 && categories.every(({ style }) => style.rotation === -45))
    assert.ok(narrow.plot.y + narrow.plot.height < wide.plot.y + wide.plot.height)
  }
  assert.ok(forSheet(chartSheets, revenue).axisLabels.every(({ style }) => !style.rotation))
  const explicit = draw(synthetic('column', '', '<txPr><bodyPr rot="1800000"/></txPr>'))
  assert.equal(explicit.axisLabels.find(({ text }) => text === 'Category 1')!.style.rotation, 30)
})

test('3-D lines use ribbon fill for flat strokes and ignore the series axis', () => {
  const layout = forSheet(threeD, threeD.sheets[2])
  const lines = markupOf(layout).querySelectorAll('polyline')
  assert.equal(lines.length, 3)
  assert.ok(lines.every((line) => line.getAttribute('stroke') !== 'none'))
  assert.deepEqual(layout.axisLabels.filter(({ text }) => /^[A-Z]/.test(text)).map(({ text }) => text),
    ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'])
})

test('Automatic fixture draws the right legend, title and default outlines', () => {
  const svg = markupOf(automatic)
  assert.deepEqual(svg.querySelector(chartGroup('legend'))!.querySelectorAll('text').map(({ text }) => text), ['North', 'Riverside', 'East'])
  assert.equal(automatic.titles[0].style.bold, true)
  assert.ok(svg.querySelector(chartGroup('chart-border')))
  assert.ok(svg.querySelector(chartGroup('axes'))!.querySelectorAll('line').every((line) => line.getAttribute('stroke') !== 'none'))
})

test('explicit plot and axis shape properties, and rich title overrides', () => {
  const model = readChart(`<chartSpace><chart><title><tx><rich><p><r><rPr b="1" sz="1800"/><t>Styled</t></r></p></rich></tx>
    <txPr><p><pPr><defRPr sz="1200" i="1"/></pPr></p></txPr></title>
    <plotArea><spPr><ln w="19050"><solidFill><srgbClr val="123456"/></solidFill></ln></spPr>
    <barChart><axId val="1"/><axId val="2"/></barChart>
    <catAx><axId val="1"/><spPr><ln><noFill/></ln></spPr></catAx>
    <valAx><axId val="2"/><spPr><ln><solidFill><srgbClr val="654321"/></solidFill></ln></spPr></valAx>
    </plotArea></chart></chartSpace>`)
  assert.ok(drawsChart(model))
  const layout = draw(model)
  assert.equal(layout.titles[0].style.size, 18)
  assert.equal(layout.titles[0].style.bold, true)
  assert.equal(layout.titles[0].style.italic, true)
  const svg = markupOf(layout)
  const outline = svg.querySelector(chartGroup('plot-area'))!
  assert.equal(outline.getAttribute('stroke'), '#123456')
  assert.equal(outline.getAttribute('stroke-width'), '2')
  assert.deepEqual(svg.querySelector(chartGroup('axes'))!.querySelectorAll('line').map((line) => line.getAttribute('stroke')), ['none', '#654321'])
})

test('line labels default to the right and support explicit dLblPos', () => {
  for (const [i, label] of labels.dataLabels.entries()) {
    assert.ok(label.x > labels.markers[i].x)
    close(label.y, labels.markers[i].y)
  }
  for (const [position, xDirection, yDirection] of [
    ['r', 1, 0], ['l', -1, 0], ['t', 0, -1], ['b', 0, 1],
    ['ctr', 0, 1], ['outEnd', 0, -1], ['inEnd', 0, 1], ['inBase', 0, 1],
  ] as const) {
    const layout = draw(synthetic('column', `<dLbls><showVal val="1"/><dLblPos val="${position}"/></dLbls>`))
    const bar = layout.bars[1]
    const label = layout.dataLabels[1]
    close(Math.sign(label.x - (bar.x + bar.width / 2)), xDirection)
    close(Math.sign(label.y - bar.y), yDirection)
    if (position === 'ctr') close(label.y, bar.y + bar.height / 2)
    if (position === 'inBase') assert.ok(label.y > bar.y + bar.height / 2)
  }
  const centred = draw(synthetic('line', '<dLbls><showVal val="1"/><dLblPos val="ctr"/></dLbls>'))
  close(centred.dataLabels[1].y, centred.lines[0].segments[0][1].y)
})

test('unstacked bars start at the clamped category-axis crossing', () => {
  for (const kind of ['bar', 'column'] as const) {
    const layout = draw(synthetic(kind, '', '<crossesAt val="50"/>', '<scaling><min val="10"/><max val="90"/></scaling>'))
    assert.equal(layout.bars[0].from, 50)
    for (const bar of layout.bars) {
      const cross = layout.axes[0].from
      const ends = kind === 'column' ? [bar.y, bar.y + bar.height] : [bar.x, bar.x + bar.width]
      assert.ok(ends.some((end) => Math.abs(end - (kind === 'column' ? cross.y : cross.x)) < 1e-8))
    }
  }
})

test('stacked lines run through negative values and blanks at the stack level', () => {
  for (const [grouping, expected] of [['stacked', [3, 5]], ['percentStacked', [3 / 7, 1]]] as const) {
    const layout = draw(synthetic('line', `<grouping val="${grouping}"/>`, '', '', '<dispBlanksAs val="zero"/>'),
      [seriesOf([5, 5]), seriesOf([-2, undefined])])
    const { min, max } = layout.scale
    layout.lines[1].segments[0].forEach(({ y }, i) =>
      close(min + (1 - (y - layout.plot.y) / layout.plot.height) * (max - min), expected[i]))
  }
})

test('category reversal reverses order within each bar cluster', () => {
  for (const kind of ['bar', 'column'] as const) {
    const series = [seriesOf([10, 20]), seriesOf([15, 25])]
    const normal = draw(synthetic(kind), series)
    const reversed = draw(synthetic(kind, '', '<scaling><orientation val="maxMin"/></scaling>'), series)
    const offset = ({ bars }: typeof normal) => kind === 'bar' ? bars[2].y - bars[0].y : bars[2].x - bars[0].x
    close(offset(normal), -offset(reversed))
    assert.ok(offset(normal) !== 0)
  }
})

test('automatic chart titles are visible and accessible', () => {
  const model = synthetic('column', '', '', '', '<title/>')
  for (const [series, title] of [[[seriesOf([2])], 'Revenue'], [[seriesOf([2]), seriesOf([3])], 'Chart Title']] as const) {
    const layout = draw(model, [...series])
    assert.equal(layout.titles[0]?.text, title)
    assert.equal(markupOf(layout).querySelector('svg')!.getAttribute('aria-label'), `Column chart: ${title}`)
  }
})

test('value axis crosses at the near boundary of the specified category', () => {
  for (const reversed of [false, true]) {
    const layout = draw(synthetic('column', '', reversed ? '<scaling><orientation val="maxMin"/></scaling>' : '', '<crossesAt val="2"/>'))
    close(layout.axes[1].from.x, layout.plot.x + layout.categoryBand * (reversed ? 2 : 1))
  }
})

async function withMountedDrawing(run: (render: (version: number, drawing?: ReturnType<typeof drawingOf>) => void, host: HTMLElement) => void) {
  const doc = createDocument('<!doctype html><html><body></body></html>') as unknown as Document
  const createElement = doc.createElement.bind(doc)
  doc.createElement = ((tag: string) => tag === 'canvas' ? { getContext: () => null } : createElement(tag)) as typeof doc.createElement
  Object.assign(globalThis, { document: doc, window: globalThis, HTMLIFrameElement: class {} })
  const { createRoot } = await import('react-dom/client')
  const { flushSync } = await import('react-dom')
  const host = doc.createElement('div')
  doc.body.appendChild(host)
  const root = createRoot(host)
  const style = {}
  try {
    run((version, drawing = drawingOf(salesSheet)) => {
      flushSync(() => root.render(React.createElement('section', null,
        React.createElement('span', null, 'Worksheet still visible'),
        React.createElement(DrawingView, { drawing, style, workbook: sales, version, width: 480, height: 288 }),
      )))
    }, host)
  } finally {
    root.unmount()
    delete (globalThis as { document?: Document }).document
  }
}

test('R7 redraws the mounted SVG after a version bump', async () => {
  await withMountedDrawing((render, host) => {
    render(0)
    const svg = host.querySelector('svg')!
    assert.equal(svg.getAttribute('aria-label'), 'Column chart: Revenue by region')
    const bar = () => Number(host.querySelector(chartGroup('bars'))!.querySelectorAll('rect')[1].getAttribute('height'))
    const oldHeight = bar()
    const source = modelSource(sales)
    source.write(salesSheet.name, 5, 16, source.valueFor(salesSheet.name, 5, 16, '9,999'))
    render(0)
    close(bar(), oldHeight)
    render(1)
    assert.equal(host.querySelector('svg'), svg)
    assert.ok(bar() < oldHeight)
    assert.equal(forSheet(sales, salesSheet).bars[1].to, 9999)
  })
})

test('drawing failure falls back to the existing card and preserves the worksheet', async () => {
  const drawing = drawingOf(salesSheet)
  assert.ok(drawsChart(drawing.chart))
  const broken = { ...drawing, chart: { ...drawing.chart, plots: [] } }
  await withMountedDrawing((render, host) => {
    render(0, broken)
    assert.match(host.querySelector('.sg-object')!.textContent!, /Kept in the file/)
    assert.match(host.textContent!, /Worksheet still visible/)
    render(1)
    assert.equal(host.querySelector('svg[role=img]')?.getAttribute('aria-label'), 'Column chart: Revenue by region')
  })
})

const sheetNamed = (name: string) => kinds.sheets.find((sheet) => sheet.name === name)!
const pieChart = drawingOf(sheetNamed('Pie')).chart
assert.ok(drawsChart(pieChart))
const scatterChart = drawingOf(sheetNamed('Scatter')).chart
assert.ok(drawsChart(scatterChart))
const areaChart = drawingOf(sheetNamed('Area')).chart
assert.ok(drawsChart(areaChart))

test('pie follows point order, rotation, colour and explosion with category legend and percent labels', () => {
  const model = { ...pieChart, plots: [{ ...pieChart.plots[0], firstSliceAng: 90, varyColors: true,
    labels: { showPercent: true, position: 'outEnd' } }] }
  const series = seriesOf([1, 1, 1])
  series.val.points = new Map([...series.val.points].reverse())
  const layout = layoutChart(model, [{ ...series, pointStyles: [{ index: 1, explosion: 20 }] }], 480, 288, measure)
  const slices = layout.slices!
  assert.deepEqual(slices.map(({ index }) => index), [0, 1, 2])
  close(slices[0].start, 0)
  close(slices[1].start, 2 * Math.PI / 3)
  close(slices[2].end, 2 * Math.PI)
  close(Math.hypot(slices[1].center.x - slices[0].center.x, slices[1].center.y - slices[0].center.y), slices[1].radius / 5)
  assert.deepEqual(slices.map(({ color }) => color), model.accentColors.slice(0, 3))
  assert.deepEqual(layout.legend?.entries.map(({ label }) => label.text), ['Category 1', 'Category 2', 'Category 3'])
  assert.equal(layout.dataLabels.reduce((sum, { text }) => sum + parseInt(text, 10), 0), 100)
  assert.equal(layout.leaders?.length, 3)
  assert.equal(markupOf(layout).querySelectorAll('[data-chart="leader-lines"] line').length, 3)
})

test('doughnut has a real hole and a single point draws two arcs per edge', () => {
  const model = { ...pieChart, kind: 'doughnut' as const, plots: [{ ...pieChart.plots[0], kind: 'doughnut' as const, holeSize: 65 }] }
  const layout = layoutChart(model, [seriesOf([1])], 480, 288, measure)
  close(layout.slices![0].innerRadius / layout.slices![0].radius, .65)
  assert.equal(markupOf(layout).querySelector('[data-chart="slices"] path')!.getAttribute('d')!.match(/A /g)?.length, 4)
  const fixture = forSheet(kinds, sheetNamed('Doughnut'))
  close(fixture.slices![0].innerRadius / fixture.slices![0].radius, .5)
})

test('area closes its fill at the configured crossing and handles blanks and stacks', () => {
  const crossing = { ...areaChart, axes: areaChart.axes.map((axis) => axis.kind === 'category' ? { ...axis, crossesAt: 15 } : axis) }
  const series = [seriesOf([20, undefined, 30, 40])]
  for (const displayBlanksAs of ['gap', 'span', 'zero']) {
    const layout = layoutChart({ ...crossing, displayBlanksAs }, series, 480, 288, measure)
    const segments = layout.areas![0].segments
    assert.deepEqual(segments.map(({ top }) => top.length), displayBlanksAs === 'gap' ? [1, 2] : displayBlanksAs === 'span' ? [3] : [4])
    for (const { base } of segments) for (const p of base) close(p.y, layout.axes[0].from.y)
    assert.match(markupOf(layout).querySelector('[data-chart="areas"] path')!.getAttribute('d')!, / Z$/)
  }
  const stacked = forSheet(kinds, sheetNamed('Stacked area'))
  assert.deepEqual(stacked.areas![1].segments[0].base, stacked.areas![0].segments[0].top)
  const percentModel = { ...areaChart, plots: [{ ...areaChart.plots[0], grouping: 'percentStacked' }] }
  const percent = layoutChart(percentModel, [seriesOf([1, 3]), seriesOf([2, 1])], 480, 288, measure)
  assert.equal(percent.scale.max, 1)
  percent.areas![1].segments[0].top.forEach(({ y }) => close(y, percent.plot.y))
})

test('scatter uses two numeric scales and draws each scatter style', () => {
  const { val: xVal } = seriesOf([10, 50, 30])
  const { val: yVal } = seriesOf([1, 4, 2])
  for (const [scatterStyle, markers, path] of [
    ['marker', 3, undefined], ['lineMarker', 3, 'polyline'], ['line', 0, 'polyline'],
    ['smooth', 0, 'path'], ['smoothMarker', 3, 'path'],
  ] as const) {
    const model = { ...scatterChart, plots: [{ ...scatterChart.plots[0], scatterStyle }] }
    const layout = layoutChart(model, [{ xVal, yVal, pointStyles: [] }], 480, 288, measure)
    assert.ok(layout.xScale!.ticks.length > 2 && layout.scale.ticks.length > 2)
    assert.notDeepEqual(layout.xScale!.ticks, layout.scale.ticks)
    assert.equal(layout.markers.length, markers)
    const svg = markupOf(layout)
    const rendered = svg.querySelector(chartGroup('lines'))!.children
    assert.equal(rendered[0]?.rawTagName, path)
    if (path === 'path') assert.match(rendered[0].getAttribute('d')!, / C /)
    if (markers) assert.ok(layout.markers[1].x > layout.markers[2].x && layout.markers[2].x > layout.markers[0].x)
  }
  const fixture = forSheet(kinds, sheetNamed('Scatter'))
  assert.equal(fixture.markers.length, 24)
  assert.equal(new Set(fixture.markers.map(({ x }) => x)).size, 12)
})

test('the quiet line skips the new chart kinds, including flat 3-D pie', () => {
  for (const name of ['Pie', 'Doughnut', 'Area', 'Stacked area', 'Scatter']) {
    assert.equal(keptNotice(sheetNamed(name).layout), undefined)
  }
  const flat = forSheet(threeD, threeD.sheets[3])
  assert.equal(flat.slices?.length, 4)
  assert.equal(keptNotice(threeD.sheets[3].layout), undefined)
})

test('zero and nonfinite pie values draw no SVG and show a card with a reason', () => {
  const series = seriesOf([0, NaN, Infinity])
  const layout = layoutChart(pieChart, [series], 480, 288, measure)
  assert.equal(layout.slices?.length, 0)
  assert.equal(markupOf(layout).querySelector('svg'), null)
  const drawing = { ...drawingOf(sheetNamed('Pie')), chart: {
    ...pieChart, plots: [{ ...pieChart.plots[0], series: [series] }],
  } }
  const card = renderToStaticMarkup(React.createElement(DrawingView, {
    drawing, style: {}, workbook: kinds, version: 0, width: 480, height: 288,
  }))
  assert.match(card, /sg-object/)
  assert.match(card, /no nonzero values/)
  assert.doesNotMatch(card, /<svg[^>]*role="img"/)
})

test('pie label positions use the slice centre, inner edge or an outside leader', () => {
  for (const position of ['ctr', 'inEnd', 'outEnd', 'bestFit']) {
    const model = { ...pieChart, plots: [{ ...pieChart.plots[0], labels: { showCatName: true, position } }] }
    const layout = layoutChart(model, [seriesOf([100, 1], 'Total', 'Depot')], 480, 288, measure)
    const [large, small] = layout.slices!
    const [first, second] = layout.dataLabels
    const distance = (slice: typeof large, label: typeof first) => Math.hypot(label.x - slice.center.x, label.y - slice.center.y)
    if (position === 'ctr') close(distance(large, first), large.radius / 2)
    if (position === 'inEnd') assert.ok(distance(small, second) < small.radius)
    if (position === 'outEnd') assert.ok(distance(large, first) > large.radius)
    assert.equal(layout.leaders?.length, position === 'outEnd' ? 2 : position === 'bestFit' ? 1 : 0)
  }
})

test('a single plot with an additional value axis keeps its card', () => {
  const normal = synthetic('column')
  const extra = { ...normal, axes: [...normal.axes, { kind: 'value' as const, id: 3 }],
    plots: [{ ...normal.plots[0], axisIds: [1, 2, 3] }] }
  assert.equal(drawsChart(extra), false)
})
