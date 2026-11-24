import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { FORMULA_ERROR, readRuleFormula, runRuleFormula, UNREADABLE, type FormulaContext } from './ruleFormula'

const ctx: FormulaContext = {
  row: 2, col: 1, anchor: { top: 1, left: 0 }, today: new Date(2026, 10, 24), date1904: false,
  cellAt(sheet, row, col) {
    if (sheet === "Other's data") return 42
    if (row === 2 && col === 3) return 'Late'
    if (row === 0 && col === 0) return 3
    if (row === 1 && col === 0) return FORMULA_ERROR
    return null
  },
  *cellsIn() { yield* [2, 2, 4, '2x'] },
}
const cases = new Map<string, unknown>([
  ['=1+2*3^2-8/2', 15], ['(-2)^2', 4], ['=+2', 2], ['2^3^2', 64], ['1e2+.5', 100.5],
  ['"he said ""hi"""&TRUE', 'he said "hi"TRUE'],
  ['AND(1=1,2<>3,3<4,4<=4,5>4,6>=6)', true],
  ['IF(OR(FALSE,NOT(FALSE)),7,1/0)', 7], ['IF(FALSE,1/0)', false],
  ['AND(ISBLANK(A1),ISNUMBER($A$1),ISTEXT($D2),ISERROR($A$2),ISEVEN(4),ISODD(-3))', true],
  ['MOD(-3,2)+ABS(-4)+ROW()+COLUMN()', 10], ['ROW($A$1)+COLUMN($D$2)', 5],
  ['UPPER(LEFT("abc",2))&LOWER(RIGHT("XYZ",2))&MID("12345",2,3)&LEN("ab")', 'AByz2342'],
  ['SUM($A$1:$A$4)+AVERAGE($A$1:$A$4)+MIN($A$1:$A$4)+MAX($A$1:$A$4)', 8 + 8 / 3 + 2 + 4],
  ['COUNT($A$1:$A$4)+COUNTA($A$1:$A$4)', 7],
  ['COUNTIF($A$1:$A$4,2)', 2], ['COUNTIF($A$1:$A$4,">2")', 1],
  ['COUNTIF($A$1:$A$5,"")', 1], ['COUNTIF($A$1:$A$4,"?x")', 1],
  ['TODAY()=DATE(2026,11,24)', true], ['DATE(1900,2,29)', 60],
  [`'Other''s data'!A1+$A$1`, 45], ['=$D2="late"', true],
  ['1/0', FORMULA_ERROR], ['ISERROR(1/0)', true],
])
for (const [input, expected] of cases) {
  const parsed = readRuleFormula(input)
  assert.notEqual(parsed, UNREADABLE, input)
  assert.equal(runRuleFormula(parsed as Exclude<typeof parsed, typeof UNREADABLE>, ctx), expected, input)
}
for (const input of ['INDIRECT("A1")', 'LET(a,1,a)', '[Book.xlsx]Sheet!A1', 'Table1[Column]', 'NamedRange',
  '1%', 'A1#', 'SUM(1,)', 'SUM(1;2)', 'ROW(5)', 'COUNTIF(1,2)', '1E400', 'ABS()', '{1,2}', 'constructor(1)']) {
  assert.equal(readRuleFormula(input), UNREADABLE, input)
}
assert.doesNotMatch(readFileSync(new URL('./ruleFormula.ts', import.meta.url), 'utf8'), /\b(?:eval|Function)\b/)
console.log('ruleFormula: supported expressions, unreadable inputs and no dynamic code passed')
