import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { colorContext, readStyles } from './excelStyles'
import { readRules } from './readRules'
import { readWorkbook } from './readWorkbook'

async function main() {
  const xml = readFileSync(new URL('./fixtures/synthetic-rules/synthetic-rules-all-kinds.xml', import.meta.url), 'utf8')
  const rules = readRules(xml, colorContext(readStyles(''), ''))
  assert.deepEqual([...new Set(rules.map((r) => r.type))], [
    'cellIs', 'containsText', 'beginsWith', 'endsWith', 'containsBlanks', 'notContainsBlanks',
    'containsErrors', 'notContainsErrors', 'duplicateValues', 'uniqueValues', 'top10', 'aboveAverage',
    'timePeriod', 'expression', 'colorScale', 'dataBar', 'iconSet', 'notContainsText',
  ])
  assert.equal(rules.length, 28)
  const first = rules.find((r) => r.priority === 1)!
  assert.equal(first.stopIfTrue, true)
  assert.equal(first.dxfId, 0)
  assert.equal(first.sqref, 'A2:A5')
  assert.deepEqual(first.formulas, ['$A$1'])
  assert.deepEqual(rules.find((r) => r.sqref.includes(' '))?.areas, [
    { top: 1, left: 14, bottom: 4, right: 15 }, { top: 7, left: 14, bottom: 8, right: 15 },
  ])
  assert.equal(rules.find((r) => r.type === 'iconSet')?.icons?.name, '3Arrows')
  assert.deepEqual(rules.find((r) => r.sqref === 'V2:V5')?.bar, {
    id: '{819E1892-DB77-442E-A43A-1D8064E60E5F}',
    stops: [{ type: 'autoMin', value: undefined, inclusive: true }, { type: 'autoMax', value: undefined, inclusive: true }],
    color: '#4472C4', minLength: 0, maxLength: 100, showValue: false, gradient: false, border: true,
    borderColor: '#123456', negativeColor: '#FFAA00', negativeBorderColor: '#987654',
    axisColor: '#000000', axisPosition: 'middle', direction: 'context',
  })

  for (const name of ['rich', 'rich-excelish']) {
    const bytes = readFileSync(new URL(`../../../../src/excel/fixtures/${name}.xlsx`, import.meta.url))
    const workbook = await readWorkbook(bytes)
    const { layout } = workbook.sheets[0]
    assert.equal(layout.conditionalFormats, 2)
    assert.deepEqual(layout.rules.map((r) => r.type).sort(), ['cellIs', 'colorScale', 'dataBar'])
    assert.equal(layout.rules.find((r) => r.type === 'dataBar')?.bar?.gradient, name === 'rich')
    assert.equal(layout.rules.find((r) => r.type === 'dataBar')?.bar?.negativeColor, name === 'rich' ? undefined : '#FF0000')
    assert.ok(workbook.styles.dxfs[0].fill)
    assert.ok(workbook.sheets.slice(1).every((sheet) => sheet.layout.rules.length === 0))
  }
  console.log('readRules: all synthetic kinds, rich, rich-excelish, and x14 twins passed')
}
void main()
