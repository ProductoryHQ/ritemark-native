import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import JSZip from 'jszip'
import type { ChartModel, ChartPlot } from './chartModel'
import { chartTitle, readChart } from './readChart'
import { resolveSeries } from './chartSeries'
import { chartsKeepFixtures } from '../../../../src/excel/chartsKeepFixtures.test'
import { readWorkbook } from './readWorkbook'
import { readTheme } from './excelStyles'

const fixtures = new URL('../../../../src/excel/fixtures/', import.meta.url)
const expected: Record<string, [ChartPlot['kind'] | 'combo', string?, boolean?]> = {
  'area': ['area', 'standard'],
  'area-3d': ['area', 'standard'],
  'area-stacked': ['area', 'stacked'],
  'bar-3d': ['bar', 'clustered'],
  'bar-clustered': ['bar', 'clustered'],
  'bar-percent': ['bar', 'percentStacked'],
  'bar-stacked': ['bar', 'stacked'],
  'column-3d': ['column', 'clustered'],
  'column-clustered': ['column', 'clustered'],
  'column-percent': ['column', 'percentStacked'],
  'column-stacked': ['column', 'stacked'],
  'combo': ['combo'],
  'doughnut': ['doughnut'],
  'line': ['line', 'standard', false],
  'line-3d': ['line', 'standard'],
  'line-markers': ['line', 'standard', true],
  'pie': ['pie'],
  'pie-3d': ['pie'],
  'scatter': ['scatter'],
}
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
const proof = process.argv.includes('--proof')
const sheet = "'Sample Sheet'!"

function report(file: string, chart: ChartModel) {
  if (!proof) return
  const series = chart.supported ? chart.plots.flatMap((plot) => plot.series) : []
  const title = chart.supported ? chart.title?.text : undefined
  const ranges = series.map(({ tx, cat, val, xVal, yVal }) =>
    [tx, cat, val, xVal, yVal].flatMap((data) => data?.formula ? [`\`${data.formula}\``] : []).join(', '))
  console.log(`| \`${file}\` | ${chart.kind} | ${series.length} | ${title ?? '—'} | ${ranges.join('<br>') || '—'} | |`)
}

type ExpectedChart = [sheet: string, kind: ChartPlot['kind'] | 'combo', title: string | undefined,
  columns?: string, lastRow?: number, grouping?: string]

const standardTitle = 'Trucks per day'
const stackedTitle = 'Trucks per day, all depots'
const shareTitle = 'Share of trucks by depot'
const excelCharts: Record<string, ExpectedChart[]> = {
  'charts-all-kinds': [
    ['Clustered column', 'column', standardTitle, 'BCD', 7, 'clustered'],
    ['Stacked column', 'column', stackedTitle, 'BCD', 7, 'stacked'],
    ['100% stacked column', 'column', shareTitle, 'BCD', 7, 'percentStacked'],
    ['Bar', 'bar', standardTitle, 'BCD', 7, 'clustered'],
    ['Stacked bar', 'bar', stackedTitle, 'BCD', 7, 'stacked'],
    ['100% stacked bar', 'bar', shareTitle, 'BCD', 7, 'percentStacked'],
    ['Line', 'line', standardTitle],
    ['Line with markers', 'line', standardTitle],
    ['Area', 'area', undefined],
    ['Stacked area', 'area', stackedTitle, 'BCD', 7, 'stacked'],
    ['Pie', 'pie', 'Handovers by depot', 'B', 5],
    ['Doughnut', 'doughnut', 'Why trucks were late', 'B', 5],
    // The fixture README tracks the Experience lead's rebuild with one series and explicit X values.
    ['Scatter', 'scatter', 'Distance and lateness', 'AB', 13],
    ['Combo', 'combo', 'Trucks and on-time share', 'BC'],
  ],
  'charts-3d': [
    ['3-D column', 'column', standardTitle], ['3-D bar', 'bar', standardTitle],
    ['3-D line', 'line', standardTitle], ['3-D pie', 'pie', 'Handovers by depot', 'B', 5],
  ],
  'charts-colours': [
    ['Theme tints', 'column', 'Trucks per year by depot'],
    ['Set colours', 'column', 'Trucks per day, house colours'],
    ['Automatic', 'column', 'Trucks per day, automatic colours'],
    ['Labels and axes', 'line', 'On-time share against target', 'BC'],
  ],
  'chart-sheet': [
    ['Revenue trend', 'line', 'Revenue trend', 'D'],
    ['Lost source', 'column', 'Trucks per day (old data)'],
  ],
}

async function checkExcelCharts() {
  for (const [file, expected] of Object.entries(excelCharts)) {
    const book = await readWorkbook(readFileSync(new URL(`excel-174/${file}.xlsx`, fixtures)))
    assert.deepEqual(book.sheets.flatMap((sheet) =>
      sheet.layout.drawings.filter(({ what }) => what === 'chart').map(() => sheet.name)),
    expected.map(([name]) => name), file)
    for (const [name, kind, title, columns = 'BCD', lastRow = 7, grouping] of expected) {
      const sheet = book.sheets.find((sheet) => sheet.name === name)!
      const drawing = sheet.layout.drawings.find(({ what }) => what === 'chart')!
      const chart = drawing.chart
      const label = `${file}.xlsx / ${name}`
      assert.ok(chart?.supported, label)
      assert.equal(chart.kind, kind, label)
      assert.equal(chart.title?.text, title, label)
      assert.equal(drawing.title, title, label)
      if (grouping) assert.equal(chart.plots[0].grouping, grouping, label)
      const series = chart.plots.flatMap((plot) => plot.series)
      const ranges = series.map(({ tx, cat, val, xVal, yVal }) =>
        [tx?.formula, cat?.formula, val?.formula, xVal?.formula, yVal?.formula])
      const source = name === 'Revenue trend' ? 'Data' : name === 'Lost source' ? "'[1]Old data'"
        : name.includes(' ') ? `'${name}'` : name
      const expectedRanges = name === 'Theme tints'
        ? Array.from({ length: 8 }, (_, index) => {
          const row = index + 2
          return [`${source}!$A$${row}`, `${source}!$B$1:$D$1`, `${source}!$B$${row}:$D$${row}`, undefined, undefined]
        })
        : [...columns].map((col) => {
          const values = `${source}!$${col}$2:$${col}$${lastRow}`
          return kind === 'scatter'
            ? [`${source}!$${col}$1`, undefined, undefined, undefined, values]
            : [`${source}!$${col}$1`, `${source}!$A$2:$A$${lastRow}`, values, undefined, undefined]
        })
      assert.deepEqual(ranges, expectedRanges, label)
      if (name === 'Revenue trend') {
        assert.equal(sheet.kind, 'chartsheet')
        assert.equal(resolveSeries(chart, book.sheets, book)[0][0].val?.points.get(0), 38950)
      }
      if (name === 'Lost source') {
        const resolved = resolveSeries(chart, book.sheets, book)[0]
        assert.deepEqual(resolved.map((series) => [...series.val!.points.values()]), [
          [42, 47, 45, 51, 55, 58], [31, 29, 34, 36, 33, 38], [22, 26, 25, 24, 29, 31],
        ])
      }
      if (name === 'Theme tints') assert.deepEqual(series.map(({ shape }) => shape?.fill),
        ['#70AD47', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47', '#264478', '#9E480E'])
      if (name === 'Set colours') assert.deepEqual(series.map(({ shape }) => shape?.fill),
        ['#1F6F78', '#E07A2E', '#9AA0A6'])
      if (name === 'Automatic') {
        assert.ok(series.every(({ shape }) => shape === undefined))
        assert.deepEqual(series.map(({ automaticColor }) => automaticColor), ['#4472C4', '#ED7D31', '#A5A5A5'])
      }
      report(label, chart)
    }
  }
}

async function main() {
  const files = readdirSync(fixtures).filter((name) => /^synthetic-.*\.xml$/.test(name)).sort()
  assert.deepEqual(files, [...Object.keys(expected), 'chartex', 'unknown'].map((name) => `synthetic-${name}.xml`).sort())
  for (const file of files) {
    const bytes = readFileSync(new URL(file, fixtures))
    const before = hash(bytes)
    const chart = readChart(bytes.toString('utf8'))
    assert.equal(hash(bytes), before, file)
    report(file, chart)
    const name = file.slice('synthetic-'.length, -'.xml'.length)
    if (name === 'chartex' || name === 'unknown') {
      assert.deepEqual(chart, name === 'chartex'
        ? { supported: false, kind: 'chartex', extendedKinds: ['waterfall'] }
        : { supported: false, kind: 'radarChart' })
      continue
    }
    const [kind, grouping, marker] = expected[name]
    assert.ok(chart.supported, file)
    assert.equal(chart.kind, kind)
    assert.equal(chart.title?.text, name[0].toUpperCase() + name.slice(1).replace(/-/g, ' '))
    assert.equal(chart.title?.reference?.formula, sheet + '$F$1')
    assert.equal(chart.title?.style?.size, 12)
    assert.equal(chart.textStyle?.rotation, 1)
    assert.equal(chart.legend?.position, 'r')
    assert.equal(chart.legend?.entries[0].deleted, true)
    assert.equal(chart.style, 10)
    assert.equal(chart.accentColors.length, 6)
    const [plot, secondary] = chart.plots
    assert.equal(chart.plots.length, kind === 'combo' ? 2 : 1)
    assert.equal(plot.grouping, kind === 'combo' ? 'clustered' : grouping)
    assert.equal(plot.marker, marker)
    assert.equal(plot.series.length, 1)
    const [series] = plot.series
    assert.equal(series.tx?.formula, sheet + '$B$1')
    assert.equal(series.tx?.points.get(0), 'Amount')
    assert.equal(series.shape?.fill, '#203864')
    assert.equal(series.shape?.line, '#112233')
    assert.equal(series.shape?.lineWidth, 2)
    const values = kind === 'scatter' ? series.yVal : series.val
    assert.equal(values?.formula, sheet + '$B$2:$B$4')
    assert.equal(values?.formatCode, '0.0')
    assert.equal(values?.pointCount, 3)
    assert.deepEqual(values?.points, new Map([[0, 12], [2, 36]]))
    if (kind === 'scatter') {
      assert.equal(plot.scatterStyle, 'lineMarker')
      assert.equal(series.xVal?.formula, sheet + '$D$2:$D$4')
      assert.equal(series.marker?.symbol, 'circle')
      assert.deepEqual(chart.axes.map((axis) => axis.kind), ['value', 'value'])
    } else {
      assert.equal(series.cat?.formula, sheet + '$A$2:$A$4')
      assert.equal(series.cat?.points.get(1), 'Beta')
    }
    if (kind === 'bar' || kind === 'column') {
      assert.equal(plot.barDir, kind === 'bar' ? 'bar' : 'col')
      assert.equal(plot.gapWidth, 125)
      if (!name.endsWith('-3d')) {
        assert.equal(plot.overlap, grouping === 'clustered' ? 0 : 100)
        assert.equal(plot.varyColors, false)
      }
    }
    if (kind === 'line') assert.equal(series.marker?.size, marker ? 7 : undefined)
    if (kind === 'pie' || kind === 'doughnut') {
      assert.equal(plot.varyColors, true)
      assert.deepEqual(plot.axisIds, [])
      assert.equal(plot.firstSliceAng, name.endsWith('-3d') ? undefined : 35)
      assert.equal(plot.holeSize, kind === 'doughnut' ? 60 : undefined)
      assert.equal(plot.labels?.showPercent, true)
      assert.equal(plot.labels?.showVal, false)
      assert.equal(plot.labels?.separator, ' / ')
      assert.equal(plot.labels?.entries?.[0].index, 1)
      assert.equal(plot.labels?.leaderLines?.line, '#112233')
      assert.deepEqual(plot.labels?.numberFormat, { formatCode: '0%', sourceLinked: true })
    } else {
      assert.deepEqual(plot.axisIds, [10, 20])
      const axis = chart.axes.find((candidate) => candidate.id === 20)
      assert.equal(axis?.crossAxisId, 10)
      assert.equal(axis?.title?.text, 'Amount')
      assert.equal(axis?.majorUnit, 20)
      assert.equal(axis?.min, 0)
      assert.equal(axis?.max, 100)
      assert.deepEqual(axis?.numberFormat, { formatCode: '0.0 "units"', sourceLinked: false })
      assert.equal(axis?.majorGridlines?.line, '#112233')
      assert.deepEqual(axis?.minorGridlines, {})
    }
    if (kind === 'combo') {
      assert.equal(secondary.kind, 'line')
      assert.equal(secondary.series.length, 1)
      assert.deepEqual(secondary.axisIds, [30, 40])
      assert.equal(secondary.series[0].val?.formula, sheet + '$C$2:$C$4')
      assert.equal(chart.axes.find((axis) => axis.id === 30)?.kind, 'date')
      assert.equal(chart.axes.find((axis) => axis.id === 40)?.position, 'r')
    }
  }

  const column = readFileSync(new URL('synthetic-column-clustered.xml', fixtures), 'utf8')
  const mixed = column.replace('</c:barChart>', '</c:barChart><c:bubbleChart/>')
  assert.deepEqual(readChart(mixed), { supported: false, kind: 'bubbleChart' })
  const unstyled = readChart(column
    .replace(/<c:title>[\s\S]*?<\/c:title>/, '')
    .replace(/<c:val>[\s\S]*?<\/c:val>/, '<c:val><c:numLit><c:pt idx="0"><c:v>0</c:v></c:pt></c:numLit></c:val>'))
  assert.ok(unstyled.supported)
  assert.equal(unstyled.title, undefined)
  assert.equal(unstyled.plots[0].series[0].val?.points.get(0), 0)
  assert.equal(unstyled.plots[0].series[0].val?.formula, undefined)
  const mixedLuminance = column.replace('<a:lumMod val="50000"/>', '<a:lumMod val="80000"/><a:lumOff val="20000"/>')
  const theme = readTheme('<a:clrScheme><a:accent1><a:srgbClr val="808080"/></a:accent1></a:clrScheme>')
  const themed = readChart(mixedLuminance, { theme, indexed: [] })
  assert.ok(themed.supported)
  assert.equal(themed.plots[0].series[0].shape?.fill, '#999999')
  assert.equal(themed.accentColors[0], '#808080')

  const transformed = readChart(column.replace(/<a:schemeClr val="accent1">[\s\S]*?<\/a:schemeClr>/,
    '<a:prstClr val="red"><a:shade val="50000"/><a:tint val="50000"/><a:satMod val="0"/>'
    + '<a:lumOff val="25000"/><a:lumMod val="50000"/></a:prstClr>'))
  assert.ok(transformed.supported)
  assert.equal(transformed.plots[0].series[0].shape?.fill, '#707070')
  for (const [system, expected] of [['val="windowText" lastClr="123456"', '#123456'], ['val="windowText"', '#000000']]) {
    const chart = readChart(column.replace('<a:srgbClr val="112233"/>', `<a:sysClr ${system}/>`))
    assert.ok(chart.supported)
    assert.equal(chart.plots[0].series[0].shape?.line, expected)
  }
  const oneSeries = /<c:ser>[\s\S]*?<\/c:ser>/.exec(column)![0]
  const automatic = readChart(column.replace(oneSeries, Array.from({ length: 13 }, (_, index) =>
    oneSeries.replace('<c:order val="0"/>', `<c:order val="${index}"/>`).replace(/<c:spPr>[\s\S]*?<\/c:spPr>/, '')).join('')))
  assert.ok(automatic.supported)
  assert.deepEqual(automatic.plots[0].series.slice(0, 6).map(({ automaticColor }) => automaticColor), automatic.accentColors)
  assert.equal(automatic.plots[0].series[6].automaticColor, '#264478')
  assert.equal(automatic.plots[0].series[12].automaticColor, '#698ED0')

  for (const file of ['rich.xlsx', 'rich-excelish.xlsx']) {
    const book = await readWorkbook(readFileSync(new URL(file, fixtures)))
    const drawings = book.sheets.flatMap((sheet) => sheet.layout.drawings).filter(({ what }) => what === 'chart')
    assert.equal(drawings.length, 1)
    const [drawing] = drawings
    const chart = drawing.chart
    assert.equal(drawing.title, 'Spend')
    assert.ok(chart?.supported)
    assert.equal(chart.title?.text, 'Spend')
    assert.equal(chart.kind, 'column')
    assert.equal(chart.plots[0].series.length, 1)
    assert.equal(chart.plots[0].series[0].val?.formula, "'Budget'!$B$3:$B$10")
    report(file, chart)
  }
  const zip = await JSZip.loadAsync(readFileSync(new URL('rich.xlsx', fixtures)))
  const relsPath = 'xl/drawings/_rels/drawing1.xml.rels'
  const relations = await zip.file(relsPath)!.async('string')
  zip.file(relsPath, relations.replace('/relationships/chart"', '/relationships/chartEx"'))
  zip.file('xl/charts/chart1.xml', readFileSync(new URL('synthetic-chartex.xml', fixtures)))
  const extended = await readWorkbook(await zip.generateAsync({ type: 'uint8array' }))
  const drawing = extended.sheets.flatMap((sheet) => sheet.layout.drawings).find(({ what }) => what === 'chart')
  assert.deepEqual(drawing?.chart, { supported: false, kind: 'chartex', extendedKinds: ['waterfall'] })

  zip.file(relsPath, relations)
  zip.file('xl/charts/chart1.xml', column.replace('<c:v>12</c:v>', '<c:v>&#x110000;</c:v>'))
  const malformed = await readWorkbook(await zip.generateAsync({ type: 'uint8array' }))
  const brokenCard = malformed.sheets.flatMap((sheet) => sheet.layout.drawings).find(({ what }) => what === 'chart')
  assert.ok(brokenCard?.anchor)
  assert.deepEqual(brokenCard.chart, { supported: false, kind: 'unknown' })

  const rich = '<c:rich><a:p><a:r><a:t xml:space="preserve">First</a:t></a:r><a:br/><a:r><a:t>line</a:t></a:r></a:p>'
    + '<a:p><a:r><a:t>Second</a:t></a:r></a:p></c:rich>'
  const richChartXml = column.replace(/<c:tx>[\s\S]*?<\/c:tx>/, `<c:tx>${rich}</c:tx>`)
  const richChart = readChart(richChartXml)
  assert.ok(richChart.supported)
  assert.equal(richChart.title?.text, 'First line Second')
  assert.equal(chartTitle(richChartXml), 'First line Second')

  await checkExcelCharts()
  const sales = await readWorkbook(readFileSync(chartsKeepFixtures.find(({ file }) => file.endsWith('/sales-report.xlsx'))!.file))
  for (const [sheetName, expectedTitle] of [['Sales 2026', 'Revenue by region'], ['Revenue trend', 'Revenue per month']]) {
    const chart = sales.sheets.find(({ name }) => name === sheetName)?.layout.drawings[0].chart
    assert.ok(chart?.supported)
    assert.equal(chart.title?.text, expectedTitle)
    const [[series]] = resolveSeries(chart, sales.sheets, sales)
    if (sheetName === 'Sales 2026') assert.deepEqual([...series.cat!.points.values()], ['North', 'South', 'Baltics'])
    else {
      assert.equal(series.cat?.points.get(0), 46023)
      assert.equal(series.cat?.pointCount, 10)
      assert.equal(series.cat?.formatCode, 'mmm yy')
    }
  }

  if (!proof) console.log('readChart: all synthetic parts and chart workbooks passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
