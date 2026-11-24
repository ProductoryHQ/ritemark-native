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
put(7, 15, 'On time')
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
  [13, [3, 4]], [16, [1, 3]], [23, [1, 3, 4]],
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
assert.deepEqual(styleAt(7, 14), {})
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

const multi = { name: 'Multi', cells: new Map<number, CellModel>() }
const set = (r: number, c: number, value: number | string) =>
  multi.cells.set(cellKey(r, c), { kind: typeof value === 'number' ? 'n' : 's', value, text: '', s: 0 })
set(1, 1, 'Late')
set(6, 1, 'On time')
const anchored = compileRules(multi, wrap('A2:A4 A7:A9',
  '<cfRule type="expression" dxfId="0"><formula>$B2="Late"</formula></cfRule>'), ctx)
assert.equal(anchored.styleAt(1, 0).dxf?.fill, '#FF0000')
assert.deepEqual(anchored.styleAt(6, 0), {})

set(0, 0, 'apple')
set(0, 2, 'apple')
set(1, 0, 1)
set(1, 2, 100)
const multiRules = wrap('A1:A2 C1:C2', '<cfRule type="duplicateValues" dxfId="0"/>' +
  '<cfRule type="colorScale"><colorScale><cfvo type="min"/><cfvo type="max"/>' +
  '<color rgb="FF000000"/><color rgb="FFFFFFFF"/></colorScale></cfRule>')
const multiStyle = compileRules(multi, multiRules, ctx).styleAt
assert.equal(multiStyle(0, 0).dxf?.fill, '#FF0000')
assert.equal(multiStyle(0, 2).dxf?.fill, '#FF0000')
assert.equal(multiStyle(1, 0).colorScale, '#000000')
assert.equal(multiStyle(1, 2).colorScale, '#FFFFFF')
for (const attributes of ['type="top10" rank="1"', 'type="aboveAverage"']) {
  const check = compileRules(multi, wrap('A1:A2 C1:C2', `<cfRule ${attributes} dxfId="0"/>`), ctx)
  assert.deepEqual(check.styleAt(1, 0), {})
  assert.equal(check.styleAt(1, 2).dxf?.fill, '#FF0000')
}

put(0, 1, 0)
put(0, 2, 2)
for (const [op, expected] of [['between', [1, 3]], ['notBetween', [2, 4]]] as const) {
  for (const bounds of [[0, 2], [2, 0], ['$B$1', '$C$1'], ['$C$1', '$B$1']]) {
    const r = wrap('A2:A5', `<cfRule type="cellIs" operator="${op}" dxfId="0">` +
      bounds.map((bound) => `<formula>${bound}</formula>`).join('') + '</cfRule>')
    const check = compileRules(sheet, r, ctx)
    assert.deepEqual([1, 2, 3, 4].filter((row) => check.styleAt(row, 0).dxf?.fill), expected)
  }
}
put(4, 23, '#N/A', true)
assert.equal(compileRules(sheet, rules, ctx).styleAt(4, 23).dxf?.fill, '#FF0000')

for (const [type, value, expected] of [
  ['num', 'B1+1', '#000000'], ['percent', 'B1+100', '#000000'], ['percentile', 'B1+100', '#000000'],
  ['num', '$C$2', '#000000'], ['num', '1/0', undefined], ['percent', 'B2', undefined],
] as const) {
  const rule = wrap('A2 C2', `<cfRule type="colorScale"><colorScale><cfvo type="min"/><cfvo type="${type}" val="${value}"/>` +
    '<color rgb="FF000000"/><color rgb="FFFFFFFF"/></colorScale></cfRule>')
  const check = compileRules(multi, rule, ctx)
  assert.equal(check.styleAt(1, 0).colorScale, expected)
  assert.equal(check.unreadable.length, expected === undefined ? 1 : 0)
}

const countif = wrap('A1:A50000', '<cfRule type="expression" dxfId="0">' +
  '<formula>=COUNTIF($A$1:$A$50000,A1)&gt;1</formula></cfRule>')
large.cells.reads = 0
const countifStyle = compileRules(large, countif, ctx).styleAt
assert.equal(large.cells.reads, 50_000)
// R24 measured 0.281 ms for these 50 lookups after compilation.
const started = performance.now()
for (let row = 0; row < 50; row++) assert.equal(countifStyle(row, 0).dxf?.fill, '#FF0000')
const elapsed = performance.now() - started
console.log(`R24 COUNTIF 50 visible cells: ${elapsed.toFixed(3)} ms`)
assert.ok(elapsed < 50)
assert.equal(large.cells.reads, 50_100)

const x14 = readRules(`<worksheet><conditionalFormatting sqref="A2:C2">
  <cfRule type="dataBar"><dataBar/><extLst><ext><x14:id>bar</x14:id></ext></extLst></cfRule>
</conditionalFormatting><x14:conditionalFormattings><x14:conditionalFormatting>
  <x14:cfRule type="dataBar" id="bar"><x14:dataBar minLength="0" maxLength="100" axisPosition="none">
    <x14:cfvo type="num"><xm:f>A2</xm:f></x14:cfvo>
    <x14:cfvo type="num"><xm:f>C2</xm:f></x14:cfvo>
    <x14:fillColor rgb="FF008000"/>
  </x14:dataBar></x14:cfRule>
</x14:conditionalFormatting></x14:conditionalFormattings></worksheet>`, colors)
const x14Bar = compileRules(multi, x14, ctx)
assert.equal(x14Bar.styleAt(1, 0).dataBar?.fraction, 0)
assert.equal(x14Bar.styleAt(1, 2).dataBar?.fraction, 1)

const aggregateFormula = ['SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT'].map((name, i) =>
  `${name}($A$1:$A$50000)=${[2475000, 49.5, 0, 99, 50000][i]}`).join(',')
large.cells.reads = 0
const aggregateStyle = compileRules(large, wrap('A1:A50000',
  `<cfRule type="expression" dxfId="0"><formula>AND(${aggregateFormula})</formula></cfRule>`), ctx).styleAt
assert.equal(large.cells.reads, 50_000)
for (let row = 0; row < 50; row++) assert.equal(aggregateStyle(row, 0).dxf?.fill, '#FF0000')
assert.equal(large.cells.reads, 50_050)

async function checkExcelReferences() {
  // Expected matches were transcribed from the Excel captures. Overlapping DXFs
  // are checked individually here and the composed priority result is checked below.
  const red = { fill: '#FFC7CE', font: { color: '#9C0006' } }
  const green = { fill: '#C6EFCE', font: { color: '#006100' } }
  const amber = { fill: '#FFEB9C', font: { color: '#9C5700' } }
  const yellow = { fill: '#FFD966' }
  const blue = { fill: '#DDEBF7' }
  const bold = { font: { bold: true } }
  const italic = { font: { italic: true, underline: 'single' } }
  const strike = { font: { strike: true, color: '#7F7F7F' } }
  const border = { width: 1, style: 'solid', color: '#C00000' }
  const vertical = (col: string, first: number, last: number) =>
    Array.from({ length: last - first + 1 }, (_, i) => col + (i + first)).join(' ')
  const dxfCases = {
    'Cell value': [
      [1, red, 'B2 B4 B6 B8'], [2, green, 'C3 C4 C6'], [3, blue, 'D4'],
      [4, amber, 'E4 E7 E8 E9'], [5, bold, 'D3 D9'], [6, italic, 'F3 F5 F6 F8 F9'],
      [7, { border: { left: border, right: border, top: border, bottom: border } }, 'E9'],
    ],
    'Text and blanks': [
      [1, yellow, 'A2 A7 A9'], [2, bold, 'A5'], [3, strike, 'A4'], [4, red, 'A6'],
      [5, amber, 'B2 B4 B5 B7 B9'], [6, red, 'C4 C8'], [7, green, 'C2 C3 C5 C6 C7 C9'],
      [8, blue, 'E2 E3 E5 E6 E8 E9'],
    ],
    'Top and average': [
      [1, green, 'B4 B8 B10'], [2, blue, 'C6'], [3, italic, 'B3 B5 B7 B9 B11 B13'],
      [4, red, 'C3 C5 C7 C10 C12'], [5, amber, 'D2 D3 D4 D5 D7 D9 D12'],
      [6, bold, 'D6 D8 D10 D11 D13'], [7, strike, 'B5 B13'],
    ],
    'Dates': [
      [1, yellow, vertical('B', 17, 23)], [2, red, 'E22'], [3, green, 'E23'], [4, blue, 'E24'],
      [5, bold, vertical('E', 21, 25)], [6, amber, ''], [7, strike, ''], [8, italic, vertical('E', 2, 25)],
    ],
    'Other cells': [
      [1, red, 'C4 C6 C7 C10 C11 C13 C14 C17 C19'],
      [2, yellow, [4, 7, 10, 14, 17].flatMap((row) => [...'ABCDEF'].map((col) => col + row)).join(' ')],
      [3, bold, vertical('E', 3, 20)],
    ],
    'Priority': [
      [1, red, 'B4 B5 B7 B9 B11'], [2, green, vertical('B', 3, 11)],
      [3, amber, 'C3 C5 C8 C11'], [4, bold, 'A5 B5 C5 A7 B7 C7 A9 B9 C9'],
    ],
    'Icon sets': [[3, green, 'D2 D4 D6 D8 D10']],
    'Unreadable formula': [[2, green, 'B4 B5 B7 B9 B11']],
  } as const
  for (const file of ['rules-all-kinds', 'rules-icons-unreadable']) {
    const workbook = await readWorkbook(readFileSync(new URL(`../../../../src/excel/fixtures/excel-174/${file}.xlsx`, import.meta.url)))
    for (const target of workbook.sheets) {
      const all = target.layout.rules
      const context = { ...workbook, today }
      const compiled = compileRules(target, all, context)
      const at = (ref: string) => compiled.styleAt(Number(ref.slice(1)) - 1, ref.charCodeAt(0) - 65)
      const cases = dxfCases[target.name as keyof typeof dxfCases]
      if (cases) {
        const deferred = target.name === 'Icon sets' ? [1, 2] : target.name === 'Unreadable formula' ? [1] : []
        assert.deepEqual(all.map((r) => r.priority).sort(), [...cases.map(([priority]) => priority), ...deferred].sort())
        for (const [priority, dxf, refs] of cases) {
          const rule = all.find((r) => r.priority === priority)!
          const isolated = compileRules(target, [rule], context)
          const wanted = new Set(refs.split(' ').filter(Boolean))
          for (const area of rule.areas) {
            for (let r = area.top; r <= area.bottom; r++) {
              for (let c = area.left; c <= area.right; c++) {
                const ref = String.fromCharCode(65 + c) + (r + 1)
                assert.deepEqual(isolated.styleAt(r, c), wanted.delete(ref) ? { dxf } : {}, `${target.name} rule ${priority} ${ref}`)
              }
            }
          }
          assert.equal(wanted.size, 0)
        }
      }
      switch (target.name) {
        case 'Scales': {
          assert.equal(all.length, 4)
          const samples = [
            ['B2', '#F8696B', '#F8696B'], ['B11', '#FFE483', '#FEE481'], ['B12', '#F7E984', '#F8E884'],
            ['B21', '#63BE7B', '#63BE7B'], ['C2', '#FFFFFF', '#FFFFFF'], ['C11', '#9DC3E6', '#9DC4E7'],
            ['C12', '#97BEE2', '#97BEE2'], ['C21', '#1F4E78', '#204E78'], ['D2', '#FCFCFF', '#FCFCFF'],
            ['D4', '#FCF4F7', '#FCF5F8'], ['D21', '#F8696B', '#F8696B'],
            ['E6', '#F5E2AC', '#F5E3AC'], ['E11', '#BF8F00', '#BF8F00'], ['E17', '#E4C874', '#E4C875'],
          ]
          for (const [ref, expected, excel] of samples) {
            const actual = at(ref).colorScale
            assert.equal(actual, expected, ref)
            for (const i of [1, 3, 5]) assert.ok(Math.abs(parseInt(actual.slice(i, i + 2), 16) - parseInt(excel.slice(i, i + 2), 16)) <= 2, ref)
          }
          for (const ref of ['D3', 'D5', 'D8', 'D10', 'D13', 'D16', 'D19']) assert.deepEqual(at(ref), {}, ref)
          assert.ok(target.hiddenRows.has(8))
          assert.equal(at('E9').colorScale, '#D6B249')
          break
        }
        case 'Data bars':
          assert.equal(all.length, 3)
          for (const [ref, fraction, pixels, gradient, showValue] of [
            ['B2', 12 / 65, 35, true, true], ['B3', 5 / 65, 15, true, true],
            ['B11', 40 / 65, 113, true, true], ['B13', 25 / 65, 69, true, true],
            ['C2', .55, 100, false, true], ['C11', 1, 182, false, true],
            ['D2', .55, 100, false, false], ['D11', 1, 182, false, false],
          ] as const) {
            const result = at(ref).dataBar!
            assert.ok(Math.abs(result.fraction - fraction) < 1e-12, ref)
            assert.ok(Math.abs(result.fraction - pixels / 182) < .012, ref)
            assert.equal(result.gradient, gradient)
            assert.equal(result.showValue, showValue)
            assert.ok(result.borderColor)
          }
          break
        case 'Priority':
          assert.deepEqual(at('B5'), { dxf: red })
          assert.deepEqual(at('B6'), { dxf: green })
          assert.deepEqual(at('C5'), { dxf: { ...amber, font: { ...amber.font, bold: true } } })
          assert.deepEqual(at('A7'), { dxf: bold })
          break
        case 'Other cells':
          assert.deepEqual(at('C4'), { dxf: red })
          assert.deepEqual(at('E4'), { dxf: { ...yellow, ...bold } })
          break
        case 'Icon sets':
          assert.deepEqual(compiled.iconSets.map((r) => r.priority), [1, 2])
          for (const col of ['B', 'C']) for (let row = 2; row <= 11; row++) assert.deepEqual(at(col + row), {})
          break
        case 'Unreadable formula':
          assert.deepEqual(compiled.unreadable.map((r) => r.priority), [1])
          for (let row = 2; row <= 11; row++) assert.deepEqual(at('C' + row), {})
          break
      }
    }
  }
  console.log('ruleEngine: all 49 Excel-made rules checked against the reference captures')
}
void checkExcelReferences()
