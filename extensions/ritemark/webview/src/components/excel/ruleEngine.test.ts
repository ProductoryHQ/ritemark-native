import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { colorContext, readStyles } from './excelStyles'
import { readRules } from './readRules'
import { compileRules } from './ruleEngine'
import { excelDay } from './ruleFormula'
import { cellKey, readWorkbook, type CellModel } from './readWorkbook'

const fixture = (name: string) => readFileSync(new URL(`./fixtures/synthetic-rules/${name}`, import.meta.url), 'utf8')
const stylesXml = fixture('styles.xml')
const styles = readStyles(stylesXml)
const colors = colorContext(styles, stylesXml)
const rules = readRules(fixture('synthetic-rules-all-kinds.xml'), colors)
const today = new Date(2026, 10, 24)
const ctx = { today, date1904: false, styles }
const sheet = { name: 'Synthetic', cells: new Map<number, CellModel>() }
function put(row: number, col: number, value: number | string | boolean, error = false) {
  const kind = error ? 'e' : typeof value === 'number' ? 'n' : typeof value === 'boolean' ? 'b' : 's'
  sheet.cells.set(cellKey(row, col), { kind, value, text: String(value), s: 0 })
}
const start = excelDay(Date.UTC(2026, 10, 17), false)
const grid: Array<Array<number | string | null>> = [
  [2, 5, 0, -1], ['Late order', 'early', 'RELATE', null], ['Abc', 'cab', 'AB', null], ['axy', 'xyz', 'XY', null],
  [null, '', '  ', 'x'], [null, '', '  ', 'x'], ['#DIV/0!', 5, null, '#N/A'], ['#N/A', 5, null, 'text'],
  ['Alpha', 'alpha', 'beta', null], ['Alpha', 'alpha', 'beta', null],
  [7, 7, 6, 1], [1, 1, 4, 6], [0, 2, 4, null],
  [start - 0.01, start, start + 6.99, start + 7], [null, null, null, null], ['Late', 'On time', 'LATE', null],
  ['A', 'b', 'a', 7], [1, 2, 3, 4],
  [0, 50, 100, '100'], [0, 20, 80, null],
  [-50, -25, 0, 100], [-50, -25, 0, 100], [10, 20, 30, 40], ['Early', 'Late', null, 'Done'], [0, 25, 50, 110],
]
put(0, 0, 4)
put(7, 15, 'Late')
put(8, 15, 'On time')
grid.forEach((column, col) => column.forEach((value, i) => {
  if (value !== null) put(i + 1, col, value, typeof value === 'string' && value.startsWith('#'))
}))

const compiled = compileRules(sheet, rules, ctx)
const { styleAt } = compiled
const highlight = (col: number) => [1, 2, 3, 4].filter((row) => styleAt(row, col).dxf?.fill === '#FF0000')
const expected = [
  [3, [1, 3]], [4, [1, 2, 3]], [5, [4]], [6, [1, 4]], [7, [2, 3, 4]],
  [8, [1, 2]], [9, [3]], [10, [1, 2]], [11, [1, 2]], [12, [2, 3]],
  [13, [2, 3]], [16, [1, 3]], [23, [1, 4]],
] as const
for (const [col, rows] of [[1, [1, 3]], [2, [1, 3]], ...expected] as const) assert.deepEqual(highlight(col), rows, `column ${col}`)
assert.deepEqual(styleAt(1, 0).dxf, {
  ...styles.dxfs[1], fill: '#FFBF00', border: { ...styles.dxfs[2].border, ...styles.dxfs[1].border },
})
assert.deepEqual(styleAt(2, 0), { dxf: { fill: '#FF0000' } })
assert.deepEqual(styleAt(3, 0), {})
assert.deepEqual(styleAt(1, 14).dxf, styles.dxfs[2])
assert.deepEqual(styleAt(3, 15).dxf, styles.dxfs[2])
assert.deepEqual(styleAt(2, 14), {})
assert.deepEqual(styleAt(7, 14).dxf, styles.dxfs[2])
assert.deepEqual(styleAt(8, 14), {})
assert.deepEqual(compiled.unreadable.map((r) => r.priority), [19])
assert.deepEqual(styleAt(1, 17), {})
assert.deepEqual(styleAt(2, 17), { dxf: { font: { bold: true } } })
assert.equal(compiled.iconSets[0].icons?.name, '3Arrows')
assert.deepEqual(styleAt(1, 22), {})
const scale = (col: number) => [1, 2, 3, 4].map((row) => styleAt(row, col).colorScale)
assert.deepEqual(scale(18), ['#FF0000', '#FFFF00', '#00FF00', undefined])
assert.equal(styleAt(2, 18).dxf?.fill, undefined)
assert.equal(styleAt(2, 18).dxf?.font?.italic, true)
assert.deepEqual(scale(19), ['#000000', '#404040', '#FFFFFF', undefined])
assert.deepEqual(scale(24), ['#000000', '#404040', '#808080', '#FFFFFF'])
const negative = styleAt(2, 20).dataBar!
assert.ok(Math.abs(negative.fraction - 1 / 6) < 1e-12)
assert.ok(Math.abs(negative.from - 1 / 6) < 1e-12)
assert.equal(negative.negative, true)
assert.equal(negative.gradient, true)
assert.equal(negative.color, '#FF0000')
assert.equal(styleAt(3, 20).dataBar?.fraction, 0)
assert.ok(Math.abs(styleAt(4, 20).dataBar!.fraction - 2 / 3) < 1e-12)
assert.deepEqual(styleAt(1, 21).dataBar, {
  fraction: 0.25, from: 0.25, negative: true, gradient: false, color: '#FFAA00', showValue: false,
  borderColor: '#987654', axis: 0.5, axisColor: '#000000',
})
assert.equal(styleAt(4, 21).dataBar?.borderColor, '#123456')
put(0, 0, 1)
assert.deepEqual(compileRules(sheet, rules, ctx).styleAt(1, 0), { dxf: { fill: '#FF0000' } })

const wrap = (sqref: string, content: string) => readRules(
  `<worksheet><conditionalFormatting sqref="${sqref}">${content}</conditionalFormatting></worksheet>`, colors)
const average = wrap('A2:A5', '<cfRule type="aboveAverage" priority="1" aboveAverage="0" dxfId="0"/>')
assert.equal(compileRules(sheet, average, ctx).styleAt(4, 0).dxf?.fill, '#FF0000')
for (const [op, values, wanted] of [
  ['equal', [0], [3]], ['notEqual', [0], [1, 2, 4]], ['lessThan', [0], [4]],
  ['lessThanOrEqual', [0], [3, 4]], ['greaterThanOrEqual', [2], [1, 2]],
  ['between', [0, 2], [1, 3]], ['notBetween', [0, 2], [2, 4]],
] as const) {
  const r = wrap('A2:A5', `<cfRule type="cellIs" priority="1" operator="${op}" dxfId="0">${values.map((n) => `<formula>${n}</formula>`).join('')}</cfRule>`)
  const check = compileRules(sheet, r, ctx)
  assert.deepEqual([1, 2, 3, 4].filter((row) => check.styleAt(row, 0).dxf?.fill), wanted, op)
}
const dateOnly = { name: 'Dates', cells: new Map<number, CellModel>() }
const date1904 = { ...ctx, date1904: true }
for (const [period, y, m, d] of [
  ['yesterday', 2026, 10, 23], ['today', 2026, 10, 24], ['tomorrow', 2026, 10, 25],
  ['lastWeek', 2026, 10, 15], ['thisWeek', 2026, 10, 22], ['nextWeek', 2026, 10, 29],
  ['lastMonth', 2026, 9, 1], ['thisMonth', 2026, 10, 1], ['nextMonth', 2026, 11, 1],
] as const) {
  const value = excelDay(Date.UTC(y, m, d), true)
  dateOnly.cells.set(0, { kind: 'n', value, text: '', s: 0 })
  const r = wrap('A1', `<cfRule type="timePeriod" timePeriod="${period}" dxfId="0"/>`)
  assert.equal(compileRules(dateOnly, r, date1904).styleAt(0, 0).dxf?.fill, '#FF0000', period)
}

// A scale, bar and duplicate rule on one 50,000-row range share one scan.
class CountedCells extends Map<number, CellModel> {
  reads = 0
  override get(key: number) {
    this.reads++
    return super.get(key)
  }
}
const large = { name: 'Large', cells: new CountedCells() }
for (let row = 0; row < 50_000; row++) {
  large.cells.set(cellKey(row, 0), { kind: 'n', value: row % 100, text: '', s: 0 })
}
const largeRules = ['colorScale', 'dataBar', 'duplicateValues'].map((type) => ({
  ...rules.find((rule) => rule.type === type)!,
  sqref: 'A1:A50000', areas: [{ top: 0, left: 0, bottom: 49_999, right: 0 }],
}))
const largeCompiled = compileRules(large, largeRules, ctx)
assert.equal(large.cells.reads, 50_000)
for (let row = 0; row < 100; row++) largeCompiled.styleAt(row, 0)
assert.equal(large.cells.reads, 50_100)

async function checkWorkbooks() {
  for (const name of ['rich', 'rich-excelish']) {
    const workbook = await readWorkbook(readFileSync(new URL(`../../../../src/excel/fixtures/${name}.xlsx`, import.meta.url)))
    const first = workbook.sheets[0]
    const compiled = compileRules(first, first.layout.rules, { ...workbook, today })
    const cell = (r: number, c: number) => Number(first.cells.get(cellKey(r, c))?.value)
    // The plain openpyxl fixture has formulas with no cached margin values.
    const fills = Array.from({ length: 8 }, (_, i) => compiled.styleAt(i + 2, 2).colorScale)
    assert.deepEqual(fills, name === 'rich' ? Array(8).fill(undefined) : [
      '#63BE7B', '#B88D72', '#EE6F6C', '#E7736D', '#F26C6C', '#F8696B', '#CC8270', '#F06E6C',
    ])
    for (let row = 2; row < 10; row++) {
      assert.equal(compiled.styleAt(row, 1).dxf?.fill, cell(row, 1) > 400 ? workbook.styles.dxfs[0].fill : undefined)
      assert.equal(compiled.styleAt(row, 1).dataBar?.color, '#638EC6')
    }
  }
  console.log('ruleEngine: synthetic rule outcomes and both bundled workbooks passed')
}
void checkWorkbooks()
