import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { cellRulesForVersion, compileCellRules, dataBarPaint, ruleCellStyle, ruleCellText, ruleTextColor, visibleCellRules } from './cellRules'
import { keptNotice } from './keptNotice'
import { cellKey, readWorkbook } from './readWorkbook'
import { buildLayout, fontCss } from './sheetLayout'
import { compileRules } from './ruleEngine'
import { readRules } from './readRules'
import { colorContext } from './excelStyles'
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
  rulesFor = cellRulesForVersion(model, today)
  assert.equal(lookup(sheet.name)(3, 2).style?.fill, '#FFD966')
  source.restore(sheet.name, 0, 1, previous)
  rulesFor = cellRulesForVersion(model, today)
  assert.equal(lookup(sheet.name)(3, 2).style?.fill, '#FFC7CE')

  const cell = sheet.cells.get(cellKey(3, 2))!
  const format = { dxf: { numberFormat: { id: 0, code: '0.000' } } }
  assert.equal(ruleCellText(cell, format, model).text, Number(cell.value).toFixed(3))

  // Open Excel question: does the number format's [Red] override a conditional font colour?
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
