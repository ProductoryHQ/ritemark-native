import assert from 'node:assert/strict'
import { EXCEL_COLS, EXCEL_ROWS, parseFormulaRef, refArea } from './formulaRef'

const quoted = parseFormulaRef("='Quarter ''A''!'!\$A2:B\$4")!
assert.equal(quoted.sheet, "Quarter 'A'!")
assert.deepEqual(refArea(quoted, 1, 2), { top: 2, left: 0, bottom: 3, right: 3 })
assert.deepEqual(refArea(parseFormulaRef('Sheet1!B:D')!), { top: 0, left: 1, bottom: EXCEL_ROWS - 1, right: 3 })
assert.deepEqual(refArea(parseFormulaRef('\$1:3')!, 2, 1), { top: 0, left: 0, bottom: 4, right: EXCEL_COLS - 1 })
assert.deepEqual(refArea(parseFormulaRef('XFD1048576')!), { top: EXCEL_ROWS - 1, left: EXCEL_COLS - 1, bottom: EXCEL_ROWS - 1, right: EXCEL_COLS - 1 })
for (const bad of ['XFE1', 'A0', 'A1048577', 'A1:B', 'A1,A2', "'[Other.xlsx]Sheet'!A1", 'A1#']) {
  assert.equal(parseFormulaRef(bad), undefined, bad)
}
assert.equal(refArea(parseFormulaRef('A1')!, -1, 0), undefined)
console.log('formulaRef: A1 cells, ranges, quoted sheets and bounds passed')
