import assert from 'node:assert/strict'
import { parseFormulaRef, referenceBounds } from './formulaRef'

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
