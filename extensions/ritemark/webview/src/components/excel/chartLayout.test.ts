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
import { drawsChart, layoutChart as layoutPlots } from './chartLayout'
import { readChart } from './readChart'
import { resolveSeries } from './chartSeries'
import { keptNotice } from './keptNotice'
import { readWorkbook, type SheetModel, type WorkbookModel } from './readWorkbook'
import { modelSource } from './sheetSource'

Object.assign(globalThis, { React })

const open = (file: string) => readWorkbook(readFileSync(new URL(`../../../../src/excel/fixtures/excel-174/${file}.xlsx`, import.meta.url)))
const drawingOf = (sheet: SheetModel) => sheet.layout.drawings.find(({ what }) => what === 'chart')!
const measure = (text: string) => text.length * 6
const layoutChart = (model: Parameters<typeof layoutPlots>[0], series: Parameters<typeof layoutPlots>[1][number],
  ...dimensions: [number, number, typeof measure, boolean?]) => layoutPlots(model, [series], ...dimensions)
function forSheet(book: WorkbookModel, sheet: SheetModel) {
  const { chart } = drawingOf(sheet)
  assert.ok(drawsChart(chart))
  const series = resolveSeries(chart, book.sheets, book)
  return layoutPlots(chart, series, 480, 288, measure, book.date1904)
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
const comboSheet = kinds.sheets.find(({ name }) => name === 'Combo')!
const combo = drawingOf(comboSheet)
assert.equal(combo.chart?.kind, 'combo')
const worksheet = kinds.sheets[0]
test('the Excel combo draws columns and a line against two scales on opposite sides', () => {
  const layout = forSheet(kinds, comboSheet)
  const markup = markupOf(layout)
  assert.deepEqual(markup.querySelectorAll('[data-chart-plot]').map((plot) => plot.getAttribute('data-chart-plot')), ['column', 'line'])
  assert.deepEqual(layout.legend?.entries.map(({ label }) => label.text), ['Trucks', 'On time'])
  assert.deepEqual(layout.valueScales?.map(({ scale: { min, max, step } }) => [min, max, step]), [[0, 140, 20], [.74, .94, .02]])
  assert.ok(layout.axisLabels.some(({ x, text }) => x < layout.plot.x && text === '140'))
  assert.ok(layout.axisLabels.some(({ x, text }) => x > layout.plot.x + layout.plot.width && text === '94%'))
  assert.ok(layout.axes.some(({ from, to }) => from.x === to.x && from.x === layout.plot.x))
  assert.ok(layout.axes.some(({ from, to }) => from.x === to.x && from.x === layout.plot.x + layout.plot.width))
  const [bar] = layout.bars
  const [point] = layout.lines[0].segments[0]
  close(point.x, bar.x + bar.width / 2)
  close(point.y, layout.plot.y + layout.plot.height * ((.94 - .81) / (.94 - .74)))
  assert.equal(keptNotice(comboSheet.layout), undefined)
})

test('unsupported charts keep the card and the quiet line names the kinds once', () => {
  const draw = (xml: string, extended = false) => ({ ...combo, chart: readChart(xml, undefined, extended) })
  const waterfall = draw(readFileSync(new URL('../../../../src/excel/fixtures/synthetic-chartex.xml', import.meta.url), 'utf8'))
  const extended = ['treemap', 'clusteredColumn', 'funnel', 'boxWhisker'].map((kind) => draw(
    `<chartSpace><chart><plotArea><plotAreaRegion><series layoutId="${kind}"/></plotAreaRegion></plotArea></chart></chartSpace>`, true,
  ))
  const standard = ['radarChart', 'stockChart', 'surface3DChart', 'bubbleChart'].map((kind) => draw(
    `<chartSpace><chart><plotArea><${kind}/></plotArea></chart></chartSpace>`,
  ))
  const unsupported = [waterfall, ...extended, ...standard]
  for (const drawing of unsupported) {
    const fallback = renderToStaticMarkup(React.createElement(DrawingView, {
      drawing, style: {}, workbook: kinds, version: 0, width: 480, height: 288,
    }))
    assert.match(fallback, /class="sg-object\b/)
    assert.match(fallback, /Kept in the file\. Open in Excel to see it\./)
    assert.doesNotMatch(fallback, /<svg[^>]+role="img"/)
  }
  assert.equal(keptNotice({ drawings: [drawingOf(worksheet), combo, ...unsupported, waterfall], conditionalFormats: 0 }),
    "This sheet has 2 waterfall charts, a treemap chart, a histogram chart, a funnel chart, a box and whisker chart, a radar chart, a stock chart, a surface chart and a bubble chart. They're kept in the file; Open in Excel to see them.")
  assert.equal(keptNotice({ drawings: [drawingOf(worksheet), { ...combo, what: 'image' }], conditionalFormats: 1 }),
    "This sheet has a picture and colour rules. They're kept in the file; Open in Excel to see them.")
})

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
  assert.deepEqual([layout.scale.min, layout.scale.max], [0, 70])
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
  assert.equal(layout.titles[0].runs![0].style.size, 18)
  assert.equal(layout.titles[0].runs![0].style.bold, true)
  assert.equal(layout.titles[0].runs![0].style.italic, true)
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
  assert.deepEqual(layout.dataLabels.map(({ text }) => text), ['33%', '33%', '33%'])
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
    assert.deepEqual(segments.map(({ top }) => top.length), displayBlanksAs === 'span' ? [3] : [4])
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
    assert.equal(layout.leaders?.length, position === 'bestFit' ? 1 : 0)
  }
})

test('a single plot with an additional value axis keeps its card', () => {
  const normal = synthetic('column')
  const extra = { ...normal, axes: [...normal.axes, { kind: 'value' as const, id: 3 }],
    plots: [{ ...normal.plots[0], axisIds: [1, 2, 3] }] }
  assert.equal(drawsChart(extra), false)
})

test('Excel chart typography uses saved formatting and Excel defaults', () => {
  const check = (text: { style: { size?: number; color?: string; bold?: boolean } }, size: number, color: string, bold: boolean) => {
    assert.equal(text.style.size, size)
    assert.equal(text.style.color, color)
    assert.equal(text.style.bold, bold)
  }
  const styled = forSheet(kinds, kinds.sheets[0])
  for (const tick of styled.axisLabels) check(tick, 9, '#595959', false)
  for (const { label } of styled.legend!.entries) check(label, 9, '#595959', false)
  check(styled.titles[0].runs![0], 14, '#595959', false)
  const bar = forSheet(kinds, kinds.sheets[3])
  check(bar.titles.find(({ text }) => text === 'Trucks')!.runs![0], 10, '#595959', false)
  for (const tick of automatic.axisLabels) check(tick, 10, '#000000', false)
  for (const { label } of automatic.legend!.entries) check(label, 10, '#000000', false)
  check(automatic.titles[0].runs![0], 18, '#000000', true)
  assert.match(markupOf(styled).querySelector('[data-chart="axis-labels"] text')!.getAttribute('style')!, /font-size:12px/)
  assert.match(markupOf(automatic).querySelector('[data-chart="titles"] tspan')!.getAttribute('style')!, /font-size:24px/)
})

test('chart space, list, paragraph and run styles cascade independently', () => {
  const chart = readChart(`<c:chartSpace>
    <c:txPr><a:bodyPr rot="60000"/><a:lstStyle><a:defPPr><a:defRPr sz="1100" i="1">
      <a:solidFill><a:srgbClr val="123456"/></a:solidFill>
    </a:defRPr></a:defPPr></a:lstStyle><a:p><a:pPr><a:defRPr b="1"/></a:pPr></a:p></c:txPr>
    <c:chart><c:title><c:tx><c:rich><a:p>
      <a:pPr><a:defRPr sz="1300"/></a:pPr>
      <a:r><a:t>First </a:t></a:r><a:r><a:rPr b="0" i="0"/><a:t>second</a:t></a:r>
    </a:p></c:rich></c:tx></c:title><c:plotArea><c:barChart><c:barDir val="col"/></c:barChart></c:plotArea></c:chart>
  </c:chartSpace>`)
  assert.ok(drawsChart(chart))
  const layout = layoutChart(chart, [], 480, 288, measure)
  assert.deepEqual(layout.axisLabels[0].style, { size: 11, color: '#123456', bold: true, italic: true, rotation: 1 })
  assert.deepEqual(layout.titles[0].runs, [
    { text: 'First ', style: { size: 13, color: '#123456', bold: true, italic: true, rotation: 1 } },
    { text: 'second', style: { size: 13, color: '#123456', bold: false, italic: false, rotation: 1 } },
  ])
})

test('manual plot layout affects the plotted geometry and supports inner and outer targets', () => {
  const read = (target: string, modes = '<c:xMode val="edge"/><c:yMode val="edge"/><c:wMode val="edge"/>') => {
    const layout = target ? `<c:layout><c:manualLayout><c:layoutTarget val="${target}"/>${modes}
      <c:x val="0.2"/><c:y val="0.1"/><c:w val="0.7"/><c:h val="0.5"/>
    </c:manualLayout></c:layout>` : ''
    const chart = readChart(`<c:chartSpace><c:chart><c:plotArea>${layout}<c:barChart><c:barDir val="col"/>
      <c:ser><c:val><c:numLit><c:pt idx="0"><c:v>20</c:v></c:pt></c:numLit></c:val></c:ser>
    </c:barChart></c:plotArea></c:chart></c:chartSpace>`)
    assert.ok(drawsChart(chart))
    return layoutChart(chart, chart.plots[0].series, 500, 300, measure)
  }
  const inner = read('inner')
  assert.deepEqual(inner.plot, { x: 100, y: 30, width: 250, height: 150 })
  assert.equal(inner.bars[0].x + inner.bars[0].width / 2, 225)
  const outer = read('outer').plot
  assert.ok(outer.x > inner.plot.x && outer.width < inner.plot.width && outer.height < inner.plot.height)
  const auto = read('').plot
  const factor = read('inner', '<c:xMode val="factor"/><c:yMode val="factor"/>').plot
  assert.deepEqual(factor, { x: auto.x + 100, y: auto.y + 30, width: 350, height: 150 })
})

test('manual title and legend bounds position their rendered text and keys', () => {
  const manual = (x: number, y: number) => `<layout><manualLayout><xMode val="edge"/><yMode val="edge"/>
    <x val="${x}"/><y val="${y}"/><w val="0.2"/><h val="0.1"/>
  </manualLayout></layout>`
  const chart = readChart(`<chartSpace><chart><title>${manual(.1, .05)}</title>
    <legend><legendPos val="r"/>${manual(.7, .2)}</legend>
    <plotArea><barChart><ser/></barChart></plotArea>
  </chart></chartSpace>`)
  assert.ok(drawsChart(chart))
  const layout = layoutChart(chart, chart.plots[0].series, 500, 300, measure)
  assert.deepEqual([layout.titles[0].x, layout.titles[0].y], [100, 30])
  assert.deepEqual(layout.legend?.bounds, { x: 350, y: 60, width: 100, height: 30 })
  assert.equal(layout.legend?.entries[0].key.x, 350)
})

test('negative stacked area contributions lower the preceding total', () => {
  for (const grouping of ['stacked', 'percentStacked']) {
    const layout = layoutChart({ ...areaChart, plots: [{ ...areaChart.plots[0], grouping }] },
      [seriesOf([10, 10]), seriesOf([-3, -3])], 480, 288, measure)
    const [first, second] = layout.areas!.map(({ segments }) => segments[0])
    assert.deepEqual(second.base, first.top)
    const value = layout.scale.max - (second.top[0].y - layout.plot.y) / layout.plot.height * (layout.scale.max - layout.scale.min)
    close(value, grouping === 'stacked' ? 7 : 7 / 13)
  }
})

test('stacked area gaps taper to the previous total', () => {
  const model = { ...areaChart, displayBlanksAs: 'gap', plots: [{ ...areaChart.plots[0], grouping: 'stacked' }] }
  const layout = layoutChart(model, [seriesOf([5, 5, 5]), seriesOf([5, undefined, 5]), seriesOf([5, 5, 5])], 480, 288, measure)
  const [first, middle, last] = layout.areas!.map(({ segments }) => segments[0])
  assert.deepEqual(middle.top[1], first.top[1])
  assert.deepEqual(last.base, middle.top)
})

test('scatter uses point numbers for text and mixed X data', () => {
  const yVal = seriesOf([1, 4, 2]).val
  const expected = layoutChart(scatterChart, [{ yVal, pointStyles: [] }], 480, 288, measure)
  for (const type of ['string', 'number'] as const) {
    const xVal = { type, points: new Map<number, string | number>([[0, 100], [1, 'b'], [2, 300]]) }
    assert.deepEqual(layoutChart(scatterChart, [{ xVal, yVal, pointStyles: [] }], 480, 288, measure).markers, expected.markers)
  }
})

test('scatter applies the automatic minimum independently to both axes', () => {
  const layout = layoutChart(scatterChart, [{ xVal: seriesOf([2000, 2010, 2020]).val,
    yVal: seriesOf([21, 22, 25]).val, pointStyles: [] }], 480, 288, measure)
  assert.ok(layout.xScale!.min > 1900 && layout.xScale!.min <= 2000)
  assert.ok(layout.scale.min > 0 && layout.scale.min <= 21)
})

test('scatter keeps zero when positive values are below the five-sixths threshold', () => {
  const layout = layoutChart(scatterChart, [{ xVal: seriesOf([60, 90, 100]).val,
    yVal: seriesOf([60, 90, 100]).val, pointStyles: [] }], 480, 288, measure)
  assert.equal(layout.xScale!.min, 0)
  assert.equal(layout.scale.min, 0)
})

test('legend lists categories only for a single series with varyColors enabled', () => {
  for (const chart of [synthetic('column'), synthetic('bar'), pieChart, { ...pieChart, kind: 'doughnut' as const }]) {
    for (const varyColors of [true, false]) {
      const model = { ...chart, legend: { position: 'r', entries: [] }, plots: [{ ...chart.plots[0], varyColors }] }
      const data = [seriesOf([1, 2], 'Revenue')]
      const names = layoutChart(model, data, 480, 288, measure).legend!.entries.map(({ label }) => label.text)
      assert.deepEqual(names, varyColors ? ['Category 1', 'Category 2'] : ['Revenue'])
      const multi = layoutChart(model, [...data, seriesOf([2, 3], 'Cost')], 480, 288, measure)
      assert.deepEqual(multi.legend!.entries.map(({ label }) => label.text).sort(), ['Cost', 'Revenue'])
    }
  }
})

test('crowded outside pie labels stay apart and clear the legend and SVG edge', () => {
  const model = { ...pieChart, legend: { position: 'r', entries: [] }, plots: [{ ...pieChart.plots[0], varyColors: true,
    labels: { showCatName: true, position: 'outEnd' } }] }
  const layout = layoutChart(model, [seriesOf([100, 1, 1, 1, 1, 1, 1])], 480, 288, measure)
  const small = layout.dataLabels.slice(1).sort((a, b) => a.y - b.y)
  assert.equal(small.length, 6)
  for (const [i, label] of small.entries()) {
    assert.ok(label.x - label.width / 2 >= 0)
    assert.ok(label.x + label.width / 2 <= layout.legend!.bounds.x)
    assert.ok(label.y - label.height / 2 >= 0 && label.y + label.height / 2 <= layout.height)
    if (i) assert.ok(label.y - small[i - 1].y >= (label.height + small[i - 1].height) / 2 - 1e-9)
  }
  assert.ok(layout.leaders!.length > 0)
  for (const { to } of layout.leaders!) assert.ok(to.x >= 0 && to.x <= layout.width && to.y >= 0 && to.y <= layout.height)
})

test('large line, area and column series share the extrema sampler', () => {
  const values = Array<number>(6001).fill(3)
  values[121] = -10
  values[122] = 20
  const series = seriesOf(values)
  for (const model of [synthetic('line'), areaChart, synthetic('column')]) {
    const layout = layoutChart(model, [series], 480, 288, measure)
    const valueAtY = (y: number) =>
      layout.scale.max - (y - layout.plot.y) / layout.plot.height * (layout.scale.max - layout.scale.min)
    const retained = model.kind === 'column' ? layout.bars.map(({ to }) => to)
      : (model.kind === 'area' ? layout.areas![0].segments.flatMap(({ top }) => top)
        : layout.lines[0].segments.flat()).map(({ y }) => valueAtY(y))
    assert.ok(retained.length <= 5000, model.kind)
    close(Math.min(...retained), -10)
    close(Math.max(...retained), 20)
    assert.equal(series.val.points.size, values.length)
  }
  const gapped = values.map<number | undefined>((value, i) => i === 3000 ? undefined : value)
  assert.equal(layoutChart(synthetic('line'), [seriesOf(gapped)], 480, 288, measure).lines[0].segments.length, 2)
  assert.equal(layoutChart({ ...synthetic('line'), displayBlanksAs: 'span' }, [seriesOf(gapped)],
    480, 288, measure).lines[0].segments.length, 1)
  assert.equal(layoutChart(synthetic('column'), [seriesOf(values.slice(0, 5000))], 480, 288, measure).bars.length, 5000)
})

test('a combo shares a scale when its plots reference the same value axis', () => {
  const column = synthetic('column')
  const retitled = { ...column, kind: 'combo' as const, legend: { entries: [], position: 'b' },
    plots: [column.plots[0], { ...column.plots[0], kind: 'line' as const, grouping: 'standard' }] }
  const layout = layoutPlots(retitled, [[seriesOf([10, 20], 'First')], [seriesOf([50, 100], 'Second')]], 480, 288, measure)
  assert.equal(layout.valueScales?.length, 1)
  assert.ok(layout.scale.max >= 100)
  assert.equal(layout.axisLabels.filter(({ text }) => text === 'Category 1').length, 1)
  assert.deepEqual(layout.legend?.entries.map(({ label }) => label.text), ['First', 'Second'])
  const last = layout.lines[0].segments[0][1]
  close(last.y, layout.plot.y + layout.plot.height * (layout.scale.max - 100) / (layout.scale.max - layout.scale.min))
})

test('large scatter series keep line extrema and at most one marker per pixel', () => {
  const values = Array<number>(6001).fill(3)
  values[121] = -10
  values[122] = 20
  const model = { ...scatterChart, plots: [{ ...scatterChart.plots[0], scatterStyle: 'lineMarker' }] }
  const layout = layoutChart(model, [{ yVal: seriesOf(values).val, pointStyles: [] }], 480, 288, measure)
  const points = layout.lines[0].segments.flat()
  assert.ok(points.length <= 5000)
  const positions = points.map(({ y }) => y)
  const valueAtY = (y: number) =>
    layout.scale.max - (y - layout.plot.y) / layout.plot.height * (layout.scale.max - layout.scale.min)
  close(valueAtY(Math.max(...positions)), -10)
  close(valueAtY(Math.min(...positions)), 20)
  const pixels = new Set(layout.markers.map(({ x, y }) => `${Math.floor(x)},${Math.floor(y)}`))
  assert.equal(layout.markers.length, pixels.size)
})

test('deleted pie labels reserve no space and unstyled slices cycle through shades and tints', () => {
  const series = seriesOf(Array<number>(13).fill(1))
  const model = { ...pieChart, plots: [{ ...pieChart.plots[0], varyColors: true, labels: undefined }] }
  const plain = layoutChart(model, [series], 480, 288, measure)
  const deleted = layoutChart({ ...model, plots: [{ ...model.plots[0],
    labels: { entries: [{ index: 0, deleted: true, showVal: true, position: 'outEnd' }] } }] }, [series], 480, 288, measure)
  assert.equal(deleted.slices![0].radius, plain.slices![0].radius)
  assert.equal(deleted.dataLabels.length, 0)
  assert.notEqual(plain.slices![0].color, plain.slices![6].color)
  assert.notEqual(plain.slices![6].color, plain.slices![12].color)
})

test('default doughnut labels sit at the centre of their ring', () => {
  const model = { ...pieChart, kind: 'doughnut' as const, plots: [{ ...pieChart.plots[0], kind: 'doughnut' as const, holeSize: 50,
    labels: { showVal: true } }] }
  const layout = layoutChart(model, [seriesOf([1, 2, 3])], 480, 288, measure)
  layout.slices!.forEach(({ center, innerRadius, radius }, i) =>
    close(Math.hypot(layout.dataLabels[i].x - center.x, layout.dataLabels[i].y - center.y), (innerRadius + radius) / 2))
})

test('pie keeps saved chart text, rich label runs and the manual plot', () => {
  const chart = readChart(`<chartSpace>
    <txPr><a:bodyPr rot="120000"/><a:p><a:pPr><a:defRPr sz="1200"/></a:pPr></a:p></txPr>
    <chart><title/><legend/><plotArea>
      <layout><manualLayout><layoutTarget val="inner"/>
        <xMode val="edge"/><yMode val="edge"/><x val=".1"/><y val=".1"/>
        <w val=".5"/><h val=".5"/>
      </manualLayout></layout>
      <pieChart><varyColors val="1"/><ser><val><numLit><pt idx="0"><v>2</v></pt></numLit></val></ser>
        <dLbls><dLbl><idx val="0"/><dLblPos val="ctr"/><tx><rich><a:p>
          <a:r><a:rPr b="1"/><a:t>Saved label</a:t></a:r>
        </a:p></rich></tx></dLbl></dLbls>
      </pieChart>
    </plotArea></chart>
  </chartSpace>`)
  assert.ok(drawsChart(chart))
  const layout = layoutChart(chart, chart.plots[0].series, 400, 300, measure)
  assert.deepEqual(layout.plot, { x: 40, y: 30, width: 200, height: 150 })
  assert.equal(layout.titles[0].style.size, 12)
  assert.equal(layout.legend!.entries[0].label.style.size, 12)
  const label = layout.dataLabels[0]
  assert.equal(label.style.rotation, 2)
  assert.deepEqual(label.runs, [{ text: 'Saved label', style: { size: 12, rotation: 2, bold: true, italic: false, color: '#000000' } }])
  assert.equal(markupOf(layout).querySelector('[data-chart="data-labels"] tspan')!.textContent, 'Saved label')
})

test('grouped plots draw every series at the union of their bucket extrema', () => {
  const first = Array<number>(6001).fill(2)
  const second = Array<number>(6001).fill(3)
  first[1] = 80
  second[2] = 90
  const column = synthetic('column')
  for (const grouping of [undefined, 'clustered', 'stacked', 'percentStacked']) {
    const layout = layoutChart({ ...column, plots: [{ ...column.plots[0], grouping }] },
      [seriesOf(first), seriesOf(second)], 480, 288, measure)
    const indices = [0, 1].map((series) => layout.bars.filter((bar) => bar.series === series).map((bar) => bar.index))
    assert.deepEqual(indices[0], indices[1], grouping)
    for (const index of [1, 2]) assert.ok(indices[0].includes(index), grouping)
    assert.ok(indices[0].length <= 5000, grouping)
  }
})

test('combos containing a pie or doughnut keep their card and name the circular kind', () => {
  for (const [tag, kind] of [['pieChart', 'pie'], ['doughnutChart', 'doughnut']]) {
    const chart = readChart(`<chartSpace><chart><plotArea><barChart><barDir val="col"/></barChart><${tag}/></plotArea></chart></chartSpace>`)
    const drawing = { ...combo, chart }
    const fallback = renderToStaticMarkup(React.createElement(DrawingView, {
      drawing, style: {}, workbook: kinds, version: 0, width: 480, height: 288,
    }))
    assert.equal(drawsChart(chart), false)
    assert.match(fallback, /Kept in the file\. Open in Excel to see it\./)
    assert.match(keptNotice({ drawings: [drawing], conditionalFormats: 0 })!, new RegExp(`a ${kind} chart`))
  }
})

test('the quiet line describes unnamed charts alongside named kinds', () => {
  const draw = (tag: string) => ({ ...combo, chart: readChart(`<chartSpace><chart><plotArea><${tag}/></plotArea></chart></chartSpace>`) })
  const unknown = { ...combo, chart: readChart('<chartSpace><chart><plotArea/></chart></chartSpace>', undefined, true) }
  for (const others of [[unknown], [unknown, unknown]]) {
    assert.match(keptNotice({ drawings: [...others, draw('radarChart')], conditionalFormats: 0 })!,
      others.length === 1 ? /a radar chart and another chart\./ : /a radar chart and 2 other charts\./)
  }
  assert.match(keptNotice({ drawings: [unknown], conditionalFormats: 0 })!, /has a chart\./)
})
