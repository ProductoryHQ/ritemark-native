import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { basename } from 'node:path'
import { chartsKeepFixtures } from '../../../../src/excel/chartsKeepFixtures.test'
import { createCellRuleCache, watchRuleDay, compileCellRules, dataBarPaint, ruleCellStyle, ruleCellText, ruleTextColor, visibleCellRules } from './cellRules'
import { drawsChart } from './chartLayout'
import { keptNotice } from './keptNotice'
import { cellKey, readWorkbook } from './readWorkbook'
import { buildLayout, fontCss, styleIndexOf, styleOf } from './sheetLayout'
import { compileRules, createRuleCache } from './ruleEngine'
import { readRules } from './readRules'
import { colorContext } from './excelStyles'
import { calendarDay, excelDay } from './ruleFormula'
import { modelSource } from './sheetSource'

const load = async (name: string) => readWorkbook(await readFile(new URL(
  `../../../../src/excel/fixtures/excel-174/${name}.xlsx`, import.meta.url,
)))
const today = new Date(2026, 10, 24)

async function main() {
  const model = await load('rules-all-kinds')
  const cache = createCellRuleCache(model)
  const rulesFor = (sheet: (typeof model.sheets)[number]) => cache.forSheet(sheet, today)
  const lookup = (name: string) => {
    const sheet = model.sheets.find((item) => item.name === name)!
    const layout = buildLayout(sheet, model.styles, { minWidth: 0, minHeight: 0 })
    const { at } = visibleCellRules(rulesFor(sheet), layout,
      { i0: 0, i1: layout.rows - 1, c0: 0, c1: layout.cols - 1 }, sheet, model)
    return (row: number, col: number) => {
      const entry = at(layout.displayOf.get(row)!, col)
      return { style: entry?.style, bar: entry?.rule.dataBar }
    }
  }
  const cellValue = lookup('Cell value')
  assert.equal(cellValue(1, 1).style?.fill, '#FFC7CE')
  assert.equal(cellValue(1, 1).style?.font.color, '#9C0006')
  assert.equal(cellValue(2, 2).style?.fill, '#C6EFCE')
  assert.equal(cellValue(2, 3).style?.font.bold, true)
  assert.equal(cellValue(2, 5).style?.font.italic, true)
  assert.equal(cellValue(2, 5).style?.font.underline, 'single')
  assert.equal(cellValue(8, 4).style?.border?.right?.color, '#C00000')
  const text = lookup('Text and blanks')
  assert.equal(text(3, 0).style?.font.strike, true)
  assert.equal(text(5, 0).style?.fill, '#FFC7CE')
  const top = lookup('Top and average')
  assert.equal(top(3, 1).style?.fill, '#C6EFCE')
  assert.equal(top(4, 1).style?.font.strike, true)
  assert.equal(top(4, 1).style?.font.italic, true)
  assert.equal(lookup('Dates')(22, 4).style?.fill, '#C6EFCE')
  const scales = lookup('Scales')
  assert.equal(scales(1, 1).style?.fill, '#F8696B')
  assert.equal(scales(10, 2).style?.fill, '#9DC3E6')
  assert.equal(scales(10, 4).style?.fill, '#BF8F00')
  const bars = lookup('Data bars')
  assert.equal(bars(1, 1).bar?.color, '#638EC6')
  const negative = bars(2, 1).bar!
  assert.ok(Math.abs(negative.fraction - 0.077) < 0.001)
  assert.equal(negative.color, '#FF0000')
  assert.match(String(dataBarPaint(negative).fill.background), /^linear-gradient\(to left, #FF0000/)
  assert.ok(dataBarPaint(negative).axis)
  const solid = bars(1, 2).bar!
  assert.equal(solid.fraction, 0.55)
  assert.equal(dataBarPaint(solid).fill.background, solid.color)
  assert.equal(dataBarPaint(solid).fill.border, `1px solid ${solid.borderColor}`)
  assert.ok(solid.borderColor && solid.showValue)
  assert.equal(bars(1, 3).bar?.showValue, false)
  const priority = lookup('Priority')
  assert.equal(priority(3, 1).style?.fill, '#FFC7CE')
  assert.equal(priority(3, 1).style?.font.bold, false)
  assert.equal(priority(4, 2).style?.font.bold, true)

  const sheet = model.sheets.find((item) => item.name === 'Other cells')!
  const source = modelSource(model)
  assert.equal(lookup(sheet.name)(3, 2).style?.fill, '#FFC7CE')
  assert.equal(lookup(sheet.name)(3, 4).style?.fill, '#FFD966')
  const originalRules = rulesFor(sheet)
  assert.equal(rulesFor(sheet), originalRules)
  const previous = source.write(sheet.name, 0, 1, source.valueFor(sheet.name, 0, 1, '99999'))
  cache.invalidate(sheet.name, 0, 1)
  assert.equal(lookup(sheet.name)(3, 2).style?.fill, '#FFD966')
  source.restore(sheet.name, 0, 1, previous)
  cache.invalidate(sheet.name, 0, 1)
  assert.equal(lookup(sheet.name)(3, 2).style?.fill, '#FFC7CE')

  const cell = sheet.cells.get(cellKey(3, 2))!
  const format = { dxf: { numberFormat: { id: 0, code: '0.000' } } }
  assert.equal(ruleCellText(cell, format, model).text, Number(cell.value).toFixed(3))

  // The Experience lead’s 25 Nov Excel render of rules-format-colour.xlsx confirms that
  // the rule’s font colour wins when set. Otherwise the number format’s colour stays.
  const red = { dxf: { numberFormat: { id: 0, code: '[Red]0' }, font: { color: '#008000' } } }
  const redCell = ruleCellText(cell, red, model)
  assert.equal(redCell.color?.toLowerCase(), '#ff0000')
  const redStyle = ruleCellStyle(undefined, red, model.styles.baseFont)
  const styleColor = fontCss(redStyle?.font, model.styles.baseFont).color
  assert.equal(ruleTextColor(redCell, undefined, styleColor), redCell.color)
  assert.equal(ruleTextColor(redCell, red.dxf.font, styleColor), '#008000')

  const colors = colorContext(model.styles, '')
  const extensionOnly = readRules(`<worksheet xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main"
      xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main">
    <extLst><ext><x14:conditionalFormattings><x14:conditionalFormatting>
      <x14:cfRule type="expression" priority="1" id="{ABC}"><xm:f>A1&gt;0</xm:f></x14:cfRule>
      <xm:sqref>A1</xm:sqref>
    </x14:conditionalFormatting></x14:conditionalFormattings></ext></extLst>
  </worksheet>`, colors)
  assert.equal(extensionOnly.length, 1)
  const ctx = { today, date1904: model.date1904, styles: model.styles }
  const unsupported = compileRules(sheet, extensionOnly, ctx)
  assert.deepEqual(unsupported.styleAt(0, 0), {})
  assert.equal(keptNotice({ drawings: [] }, unsupported),
    "This sheet has a colour rule it can't read. It's kept in the file; Open in Excel to see it.")

  for (const [direction, sign] of [['leftToRight', -1], ['rightToLeft', 1]] as const) {
    const rules = readRules(`<worksheet><conditionalFormatting sqref="A1:A3">
      <cfRule type="dataBar"><dataBar minLength="0" maxLength="100">
        <cfvo type="min"/><cfvo type="max"/><color rgb="FF008000"/>
      </dataBar><extLst><ext><x14:id>bar</x14:id></ext></extLst></cfRule>
      </conditionalFormatting><extLst><ext><x14:conditionalFormattings><x14:conditionalFormatting>
        <x14:cfRule type="dataBar" id="BAR"><x14:dataBar direction="${direction}"/></x14:cfRule>
      </x14:conditionalFormatting></x14:conditionalFormattings></ext></extLst>
    </worksheet>`, colors)
    const cells = new Map([1, 5, 10].map((value, row) =>
      [cellKey(row, 0), { ...cell, kind: 'n' as const, value: sign * value }]))
    const compiled = compileRules({ name: 'Bars', cells }, rules, ctx)
    assert.equal(compiled.unreadable.length, 0)
    for (let row = 0; row < 3; row++) {
      const bar = compiled.styleAt(row, 0).dataBar!
      assert.equal(bar.growsLeft, true)
      assert.match(String(dataBarPaint(bar).fill.background), /^linear-gradient\(to left,/)
      if (row === 2) assert.equal(bar.from, 0)
    }
  }

  const calls: number[][] = []
  const { at } = visibleCellRules({ iconSets: [], unreadable: [], styleAt: (r, c) => { calls.push([r, c]); return { dxf: { font: { bold: true } } } } },
    { rowOf: Int32Array.of(0, 10, 11, 12, 13), rowH: Float64Array.of(20, 20, 20, 0, 20),
      colW: Float64Array.of(80, 80, 80, 0, 80), frozenRows: 1, frozenCols: 1 },
    { i0: 2, i1: 3, c0: 2, c1: 3 }, sheet, model)
  const painted = at(2, 2)
  assert.equal(at(2, 2), painted)
  at(1, 2)
  at(2, 1)
  at(4, 2)
  at(2, 4)
  at(3, 2)
  at(2, 3)
  at(0, 2)
  at(2, 0)
  const spilled = at(2, 1, 11, 1, true)
  assert.equal(spilled?.style?.font.bold, true)
  assert.equal(at(2, 1, 11, 1, true), spilled)
  assert.deepEqual(calls, [[11, 2], [0, 2], [11, 0], [11, 1]])

  console.log('cellRules tests passed')
}
test('conditional cell rendering and cache reuse', main)


test('scenario 26: an unreadable formula leaves its cells plain and is named', async () => {
  const model = await load('rules-icons-unreadable')
  const sheet = model.sheets[1]
  const rules = compileCellRules(model, sheet, today)!
  assert.deepEqual(rules.styleAt(4, 2), {})
  assert.equal(rules.styleAt(4, 1).dxf?.fill, '#C6EFCE')
  assert.equal(keptNotice(sheet.layout, rules),
    "This sheet has a colour rule it can't read. It's kept in the file; Open in Excel to see it.")
})

test('scenario 31: icon sets keep cell values and do not block a colour rule', async () => {
  const model = await load('rules-icons-unreadable')
  const sheet = model.sheets[0]
  const layout = buildLayout(sheet, model.styles, { minWidth: 0, minHeight: 0 })
  const window = { i0: 0, i1: 10, c0: 0, c1: 3 }
  const rules = compileCellRules(model, sheet, today)!
  const { at } = visibleCellRules(rules, layout, window, sheet, model)
  for (let row = 1; row <= 10; row++) {
    for (const col of [1, 2]) {
      assert.equal(at(row, col), undefined, 'the grid falls back to the original cell and style')
      const cell = sheet.cells.get(cellKey(row, col))!
      assert.equal(cell.text, String(cell.value))
    }
  }
  assert.equal(at(1, 3)?.style?.fill, '#C6EFCE')
  const [icons, , colour] = sheet.layout.rules
  const extension = readRules(`<worksheet xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main"
    xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main"><extLst><ext>
    <x14:conditionalFormattings><x14:conditionalFormatting><x14:cfRule type="iconSet" priority="4">
    <x14:iconSet iconSet="3Stars" showValue="0"><x14:cfvo type="percent"><xm:f>0</xm:f></x14:cfvo></x14:iconSet>
    </x14:cfRule><xm:sqref>B2:B11</xm:sqref></x14:conditionalFormatting></x14:conditionalFormattings>
    </ext></extLst></worksheet>`, colorContext(model.styles, ''))
  const x14 = compileRules(sheet, extension, { today, date1904: model.date1904, styles: model.styles })
  assert.equal(x14.iconSets[0]?.icons?.name, '3Stars')
  assert.equal(keptNotice(sheet.layout, x14),
    "This sheet has an icon set. It's kept in the file; Open in Excel to see it.")
  assert.equal(visibleCellRules(x14, layout, window, sheet, model).at(1, 1), undefined)
  const overlap = compileRules(sheet, [{ ...icons, areas: colour.areas, sqref: colour.sqref, stopIfTrue: true }, colour],
    { today, date1904: model.date1904, styles: model.styles })
  assert.equal(visibleCellRules(overlap, layout, window, sheet, model).at(1, 3)?.style?.fill, '#C6EFCE')
  assert.equal(keptNotice(sheet.layout, rules),
    "This sheet has 2 icon sets. They're kept in the file; Open in Excel to see them.")
})

test('Excel number format colours survive fill-only rules and yield to rule font colours', async () => {
  const model = await load('rules-format-colour')
  const sheet = model.sheets.find(({ name }) => name === 'Format colour')!
  const layout = buildLayout(sheet, model.styles, { minWidth: 0, minHeight: 0 })
  const rules = compileCellRules(model, sheet, today)
  assert.ok(rules)
  const { at } = visibleCellRules(rules, layout, { i0: 0, i1: 5, c0: 0, c1: 1 }, sheet, model)
  for (const [row, color, fill] of [
    [1, '#006100', '#C6EFCE'],
    [2, '#FF0000', '#C6EFCE'],
    [3, '#7030A0', undefined],
    [4, '#006100', '#C6EFCE'],
    [5, '#FF0000', undefined],
  ] as const) {
    const entry = at(layout.displayOf.get(row)!, 1)
    const cell = entry?.cell ?? sheet.cells.get(cellKey(row, 1))!
    const style = entry?.style ?? styleOf(model.styles, styleIndexOf(sheet, row, 1))
    const font = fontCss(style?.font, model.styles.baseFont)
    assert.equal(ruleTextColor(cell, entry?.rule.dxf?.font, font.color).toUpperCase(), color, `B${row + 1} text`)
    assert.equal(style?.fill, fill, `B${row + 1} fill`)
  }
})

test('scenario 32: a drawn chart and drawn rules leave no quiet line', async () => {
  const charts = await load('charts-all-kinds')
  const model = await load('rules-all-kinds')
  const sheet = model.sheets[0]
  const rules = compileCellRules(model, sheet, today)!
  const layout = { ...sheet.layout, drawings: charts.sheets[0].layout.drawings }
  assert.ok(layout.drawings.length)
  assert.ok(rules.styleAt(1, 1).dxf?.fill)
  assert.equal(keptNotice(layout, rules), undefined)
})

test('quiet line on every available fixture sheet', async () => {
  const chart = "This sheet has a chart. It's kept in the file; Open in Excel to see it."
  const picture = "This sheet has a picture. It's kept in the file; Open in Excel to see it."
  const named: Record<string, Record<string, string>> = {
    'rich.xlsx': { Budget: picture },
    'rich-excelish.xlsx': { Budget: picture },
    'rules-icons-unreadable.xlsx': {
      'Icon sets': "This sheet has 2 icon sets. They're kept in the file; Open in Excel to see them.",
      'Unreadable formula': "This sheet has a colour rule it can't read. It's kept in the file; Open in Excel to see it.",
    },
  }
  for (const { file } of chartsKeepFixtures) {
    const model = await readWorkbook(await readFile(file))
    for (const sheet of model.sheets) {
      const undrawn = sheet.layout.drawings.filter((drawing) => drawing.what === 'chart' && !drawsChart(drawing.chart))
      const expected = named[basename(file)]?.[sheet.name] ?? (undrawn.length ? chart : undefined)
      assert.equal(keptNotice(sheet.layout, compileCellRules(model, sheet, today)),
        expected, `${basename(file)} / ${sheet.name}`)
    }
  }
})

test('quiet line combines undrawn charts, pictures and shapes', async () => {
  const model = await load('charts-3d')
  const [drawn] = model.sheets[0].layout.drawings
  const undrawn = { ...drawn, chart: { supported: false, kind: 'unknown' } } as const
  assert.equal(keptNotice({ drawings: [drawn, undrawn, { ...drawn, what: 'image' }, { ...drawn, what: 'shape' }] }),
    "This sheet has a chart, a picture and a shape. They're kept in the file; Open in Excel to see them.")
})

test('a chart-sheet notice counts drawing failures and unsupported charts', async () => {
  const model = await load('chart-sheet')
  const sheet = model.sheets.find((item) => item.kind === 'chartsheet')!
  const [drawing] = sheet.layout.drawings
  const notice = "This sheet has a chart. It's kept in the file; Open in Excel to see it."
  assert.ok(drawsChart(drawing.chart))
  assert.equal(keptNotice(sheet.layout), undefined)
  assert.equal(keptNotice({ drawings: [{ ...drawing, chart: undefined }] }), notice)
  assert.equal(keptNotice(sheet.layout, undefined, new Set([drawing])), notice)
})

test('edits evict the touched facts and cross-sheet formula ranges only', async () => {
  const model = await load('rules-all-kinds')
  const [sheet, sourceSheet] = model.sheets
  sheet.layout.rules = readRules(`<worksheet>
    <conditionalFormatting sqref="A1:A2"><cfRule type="duplicateValues" priority="1" dxfId="0"/></conditionalFormatting>
    <conditionalFormatting sqref="B1:B2"><cfRule type="expression" priority="2" dxfId="0">
    <formula>SUM('${sourceSheet.name}'!$A$1:$A$2)=3</formula></cfRule></conditionalFormatting>
    </worksheet>`, colorContext(model.styles, ''))
  const source = modelSource(model)
  source.write(sheet.name, 0, 0, 1)
  source.write(sheet.name, 1, 0, 1)
  source.write(sourceSheet.name, 0, 0, 1)
  source.write(sourceSheet.name, 1, 0, 2)
  const cache = createCellRuleCache(model)
  const initial = cache.forSheet(sheet, today)!
  assert.ok(initial.styleAt(0, 0).dxf)
  assert.ok(initial.styleAt(0, 1).dxf)
  cache.invalidate(sheet.name, 0, 2)
  assert.equal(cache.forSheet(sheet, today), initial)
  source.write(sourceSheet.name, 0, 0, 2)
  cache.invalidate(sourceSheet.name, 0, 0)
  assert.equal(cache.forSheet(sheet, today)?.styleAt(0, 1).dxf, undefined)
  const previous = source.write(sheet.name, 0, 0, 0)
  cache.invalidate(sheet.name, 0, 0)
  assert.equal(cache.forSheet(sheet, today)?.styleAt(1, 0).dxf, undefined)
  source.restore(sheet.name, 0, 0, previous)
  cache.invalidate(sheet.name, 0, 0)
  assert.ok(cache.forSheet(sheet, today)?.styleAt(1, 0).dxf)
})

test('recompiling a threshold keeps the unrelated matcher and range facts', async () => {
  const model = await load('rules-all-kinds')
  const [sheet, other] = model.sheets
  const source = modelSource(model)
  source.write(sheet.name, 0, 0, 5)
  source.write(sheet.name, 1, 0, 10)
  source.write(sheet.name, 0, 1, 1)
  source.write(sheet.name, 1, 1, 1)
  source.write(other.name, 0, 0, 10)
  const rules = readRules(`<worksheet>
    <conditionalFormatting sqref="A1:A2"><cfRule type="colorScale" priority="1"><colorScale>
    <cfvo type="num" val="0"/><cfvo type="formula"><f>MAX('${other.name}'!$A$1:$A$1)</f></cfvo>
    <color rgb="FF000000"/><color rgb="FFFFFFFF"/></colorScale></cfRule></conditionalFormatting>
    <conditionalFormatting sqref="B1:B2"><cfRule type="duplicateValues" priority="2" dxfId="0"/></conditionalFormatting>
    </worksheet>`, colorContext(model.styles, ''))
  const cache = createRuleCache(sheet.name)
  const context = { ...model, today }
  const first = compileRules(sheet, rules, context, cache)
  assert.equal(first.styleAt(0, 0).colorScale, '#808080')
  const unaffected = cache.matchers.get(rules[1])
  const facts = cache.facts.get(rules[0].sqref)
  assert.ok(unaffected && facts)
  source.write(other.name, 0, 0, 5)
  assert.ok(cache.invalidate(other.name, 0, 0))
  const updated = compileRules(sheet, rules, context, cache)
  assert.equal(updated.styleAt(0, 0).colorScale, '#FFFFFF')
  assert.equal(cache.matchers.get(rules[1]), unaffected)
  assert.equal(cache.facts.get(rules[0].sqref), facts)
})

test('the local rule day refreshes at midnight and on focus', async () => {
  const model = await load('rules-all-kinds')
  const sheet = model.sheets[0]
  const source = modelSource(model)
  const cache = createCellRuleCache(model)
  sheet.layout.rules = readRules(`<worksheet><conditionalFormatting sqref="A1:A2">
    <cfRule type="timePeriod" timePeriod="today" priority="1" dxfId="0"/>
    </conditionalFormatting></worksheet>`, colorContext(model.styles, ''))
  source.write(sheet.name, 0, 0, excelDay(calendarDay(today), model.date1904))
  source.write(sheet.name, 1, 0, excelDay(calendarDay(new Date(2026, 10, 25)), model.date1904))
  let now = new Date(2026, 10, 24, 23, 59, 59, 900)
  let tick: (() => void) | undefined
  const events = new EventTarget()
  const days: Array<[number, boolean, boolean]> = []
  const stop = watchRuleDay((day) => {
    const rules = cache.forSheet(sheet, day)!
    days.push([day.getDate(), !!rules.styleAt(0, 0).dxf, !!rules.styleAt(1, 0).dxf])
  }, {
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    setTimeout(callback, delay) {
      assert.equal(delay, new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime())
      tick = callback
      return 1
    },
    clearTimeout() { tick = undefined },
  }, () => now)
  now = new Date(2026, 10, 25)
  tick!()
  now = new Date(2026, 10, 27, 10)
  events.dispatchEvent(new Event('focus'))
  assert.deepEqual(days, [[24, true, false], [25, false, true], [27, false, false]])
  stop()
  assert.equal(tick, undefined)
})
