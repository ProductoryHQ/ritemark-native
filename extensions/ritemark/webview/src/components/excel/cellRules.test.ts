import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { cellRulesForVersion, compileCellRules, dataBarPaint, ruleCellStyle, ruleCellText, visibleCellRules } from './cellRules'
import { keptNotice } from './keptNotice'
import { cellKey, readWorkbook } from './readWorkbook'
import { buildLayout, styleIndexOf, styleOf } from './sheetLayout'
import { modelSource } from './sheetSource'

const load = async (name: string) => readWorkbook(await readFile(new URL(
  `../../../../src/excel/fixtures/excel-174/${name}.xlsx`, import.meta.url,
)))
const today = new Date(2026, 10, 24)

async function main() {
  const model = await load('rules-all-kinds')
  let rulesFor = cellRulesForVersion(model, today)
  const lookup = (name: string) => {
    const sheet = model.sheets.find((item) => item.name === name)!
    const layout = buildLayout(sheet, model.styles, { minWidth: 0, minHeight: 0 })
    const at = visibleCellRules(rulesFor(sheet), layout,
      { i0: 0, i1: layout.rows - 1, c0: 0, c1: layout.cols - 1 })
    return (row: number, col: number) => {
      const rule = at(layout.displayOf.get(row)!, col)
      const base = styleOf(model.styles, styleIndexOf(sheet, row, col))
      return { style: ruleCellStyle(base, rule, model.styles.baseFont), bar: rule?.dataBar }
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
  rulesFor = cellRulesForVersion(model, today)
  assert.equal(lookup(sheet.name)(3, 2).style?.fill, '#FFD966')
  source.restore(sheet.name, 0, 1, previous)
  rulesFor = cellRulesForVersion(model, today)
  assert.equal(lookup(sheet.name)(3, 2).style?.fill, '#FFC7CE')

  const cell = sheet.cells.get(cellKey(3, 2))!
  const format = { dxf: { numberFormat: { id: 0, code: '0.000' } } }
  assert.equal(ruleCellText(cell, format, model).text, Number(cell.value).toFixed(3))

  const calls: number[][] = []
  const at = visibleCellRules({ iconSets: [], unreadable: [], styleAt: (r, c) => { calls.push([r, c]); return {} } },
    { rowOf: Int32Array.of(0, 10, 11, 12, 13), rowH: Float64Array.of(20, 20, 20, 0, 20),
      colW: Float64Array.of(80, 80, 80, 0, 80), frozenRows: 1, frozenCols: 1 },
    { i0: 2, i1: 3, c0: 2, c1: 3 })
  at(2, 2)
  at(2, 2)
  at(1, 2)
  at(2, 1)
  at(4, 2)
  at(2, 4)
  at(3, 2)
  at(2, 3)
  at(0, 2)
  at(2, 0)
  assert.deepEqual(calls, [[11, 2], [0, 2], [11, 0]])

  assert.equal(keptNotice(sheet.layout, compileCellRules(model, sheet, today)), undefined)
  const deferred = await load('rules-icons-unreadable')
  const [icons, unreadable] = deferred.sheets
  const iconRules = compileCellRules(deferred, icons, today)!
  assert.deepEqual(iconRules.styleAt(1, 1), {})
  assert.equal(keptNotice(icons.layout, iconRules), "This sheet has 2 icon sets. They're kept in the file; Open in Excel to see them.")
  const unreadableRules = compileCellRules(deferred, unreadable, today)!
  assert.deepEqual(unreadableRules.styleAt(4, 2), {})
  assert.equal(unreadableRules.styleAt(4, 1).dxf?.fill, '#C6EFCE')
  assert.equal(keptNotice(unreadable.layout, unreadableRules), "This sheet has a colour rule it can't read. It's kept in the file; Open in Excel to see it.")
  console.log('cellRules tests passed')
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
