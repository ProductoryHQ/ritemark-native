import assert from 'node:assert/strict'
import { joinAdjacentRefs, parseFormulaRef, refArea, referenceBounds } from './formulaRef'

assert.deepEqual(parseFormulaRef('A1')?.start, { row: 0, col: 0, absoluteRow: false, absoluteCol: false })
assert.deepEqual(parseFormulaRef('=Sheet1!$C7')?.start, { row: 6, col: 2, absoluteRow: false, absoluteCol: true })
assert.equal(parseFormulaRef('=Sheet1!$C7')?.sheet, 'Sheet1')
const quoted = parseFormulaRef("'Sample ''24'!c$5:$e$7")!
assert.equal(quoted.sheet, "Sample '24")
assert.deepEqual(quoted.start, { row: 4, col: 2, absoluteRow: true, absoluteCol: false })
assert.deepEqual(quoted.end, { row: 6, col: 4, absoluteRow: true, absoluteCol: true })
assert.deepEqual(referenceBounds(quoted), { top: 4, bottom: 6, left: 2, right: 4 })
assert.equal(parseFormulaRef("'Sample! Sheet'!A1")?.sheet, 'Sample! Sheet')
assert.deepEqual(referenceBounds(parseFormulaRef('$D:B')!, 7), { top: 0, bottom: 7, left: 1, right: 3 })
assert.deepEqual(referenceBounds(parseFormulaRef('Sheet1!$3:5')!, 10, 9), { top: 2, bottom: 4, left: 0, right: 9 })
assert.equal(parseFormulaRef('XFD1048576')?.start.col, 16383)
for (const bad of ['XFE1', 'A1048577', 'A0', 'A', '1', 'A:5', 'A1:B', 'A1,B2', 'A1:', 'OFFSET(A1)', '[Other.xlsx]Sheet1!A1', "'[Other.xlsx]Sheet 1'!A1", 'S1:S2!A1']) {
  assert.equal(parseFormulaRef(bad), undefined, bad)
}
console.log('formulaRef: all passed')

const anchored = parseFormulaRef("'Other sheet'!$B2:C$5")!
assert.deepEqual(refArea(anchored, 2, 3), { top: 3, bottom: 4, left: 1, right: 5 })
assert.equal(refArea(anchored, -2), undefined)
assert.deepEqual(refArea(parseFormulaRef('$B:$C')!, 20, 20), { top: 0, bottom: 1048575, left: 1, right: 2 })

const upper = parseFormulaRef('Sheet1!B2:C7')!
const lower = parseFormulaRef('sheet1!C10:B8')!
assert.deepEqual(referenceBounds(joinAdjacentRefs(lower, upper)!), { top: 1, bottom: 9, left: 1, right: 2 })
assert.equal(joinAdjacentRefs(upper, parseFormulaRef('Sheet2!D2:D7')!), undefined)
assert.equal(joinAdjacentRefs(upper, parseFormulaRef('Sheet1!D3:D7')!), undefined)
