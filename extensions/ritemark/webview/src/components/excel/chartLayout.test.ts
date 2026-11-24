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
