import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { serialize } from 'node:v8'
import { resolveSeries } from './chartSeries'
import { readChart } from './readChart'
import { cellKey, emptyLayout, type SheetModel, type WorkbookModel } from './readWorkbook'
import { readStyles } from './excelStyles'

const xml = readFileSync(new URL('../../../../src/excel/fixtures/synthetic-column-clustered.xml', import.meta.url), 'utf8')
const chart = readChart(xml)
assert.ok(chart.supported)
const sheet: SheetModel = {
  name: 'Sample Sheet',
  state: 'visible',
  kind: 'worksheet',
  maxR: 3,
  maxC: 1,
  cells: new Map([
    [cellKey(0, 1), { kind: 's', value: 'Edited title', text: 'Edited title', s: 0 }],
    [cellKey(1, 0), { kind: 's', value: 'Edited category', text: 'Edited category', s: 0 }],
    [cellKey(1, 1), { kind: 'n', value: 45, text: '45.00', s: 0, formula: 'SUM(D2:E2)' }],
    [cellKey(2, 1), { kind: 'n', value: 0, text: '0', s: 0 }],
  ]),
  hiddenRows: new Set(),
  hiddenCols: new Set(),
  layout: emptyLayout(),
}
const book: WorkbookModel = { sheets: [sheet], activeSheet: 0, styles: readStyles(''), date1904: false }
const hash = () => createHash('sha256').update(serialize([chart, book])).digest('hex')
const before = hash()
const [[series]] = resolveSeries(chart, book.sheets, book)
assert.equal(series.tx?.points.get(0), 'Edited title')
assert.equal(series.cat?.points.get(0), 'Edited category')
assert.equal(series.cat?.points.get(1), 'Beta')
assert.deepEqual(series.val?.points, new Map([[0, 45], [1, 0], [2, 36]]))
assert.equal(hash(), before)

const editedSheet = { ...sheet, cells: new Map(sheet.cells) }
editedSheet.cells.set(cellKey(1, 1), { kind: 'n', value: 9999, text: '9,999', s: 0 })
editedSheet.cells.set(cellKey(3, 1), { kind: 'e', value: '#N/A', text: '#N/A', s: 0 })
const [[edited]] = resolveSeries(chart, [editedSheet], book)
assert.deepEqual(edited.val?.points, new Map([[0, 9999], [1, 0]]))
assert.deepEqual(resolveSeries(chart, [], book)[0][0].val?.points, new Map([[0, 12], [2, 36]]))
assert.equal(resolveSeries(chart, [], book)[0][0].val?.points.has(1), false)
const external = readChart(xml.replace(/'Sample Sheet'!/g, "'[External.xlsx]Sample Sheet'!"))
assert.equal(resolveSeries(external, book.sheets, book)[0][0].val?.points.get(0), 12)
const wholeColumn = readChart(xml.replace('$B$2:$B$4', '$B:$B'))
assert.deepEqual(resolveSeries(wholeColumn, book.sheets, book)[0][0].val?.points, new Map([[1, 45], [2, 0]]))
const wholeRow = readChart(xml.replace("'Sample Sheet'!$B$2:$B$4", '$2:$2'))
assert.deepEqual(resolveSeries(wholeRow, book.sheets, book)[0][0].val?.points, new Map([[1, 45], [2, 36]]))
const named = readChart(xml.replace("'Sample Sheet'!$B$2:$B$4", 'Amounts'))
assert.equal(resolveSeries(named, book.sheets, book)[0][0].val?.points.get(0), 12)
assert.deepEqual(resolveSeries({ supported: false, kind: 'chartex' }, book.sheets, book), [])
console.log('chartSeries: all passed')
