/**
 * Sprint 158 PR 2 (#711): what the grid gets from our reader's model: hidden rows and columns left out, rows named by
 * their sheet row, edits drawn in their cell's own number format, a refused edit put back.
 * Run: npx tsx webview/src/components/excel/sheetSource.test.ts
 */
import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cellKey, readWorkbook } from './readWorkbook'
import { modelSource } from './sheetSource'

const repo = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../../../..')
const spike = path.join(repo, 'docs/development/releases/v2.3.0/sprint-158-excel/research/spike/fixtures')
const open = async (name: string) => modelSource(await readWorkbook(new Uint8Array(fs.readFileSync(path.join(spike, name)))))

async function main() {
  // The training budget: row 14 is hidden, so the grid goes 13, 15; money is drawn as money
  {
    const source = await open('training-budget.xlsx')
    const view = source.extract(source.initial)
    assert.ok(view.rowLabels, 'rows are named by their sheet row')
    const i13 = view.rowLabels!.indexOf(13)
    assert.equal(view.rowLabels![i13 + 1], 15, 'row 14 is left out')
    assert.ok(!view.rowLabels!.includes(14))
    // B6 (Participants) is 12; C6 is drawn as money and edited as its digits
    assert.equal(view.rows[view.rowLabels!.indexOf(6)].B, '12')
    assert.match(String(view.rows[view.rowLabels!.indexOf(6)].C), /1,450\.00 €/)
    assert.equal(source.inputAt(source.initial, 5, 2), '1450')
    // an edit takes the cell's format: 14 in a money cell is drawn 14.00 €
    const previous = source.write(source.initial, 5, 2, 14)
    assert.match(String(source.extract(source.initial).rows[view.rowLabels!.indexOf(6)].C), /14\.00 €/)
    // a formula cell's formula is gone once it is typed over
    assert.ok(source.formulaAt(source.initial, 5, 3)?.startsWith('='), 'D6 has a formula')
    source.write(source.initial, 5, 3, 1)
    assert.equal(source.formulaAt(source.initial, 5, 3), undefined)
    // a refused edit is put back
    source.restore(source.initial, 5, 2, previous)
    assert.match(String(source.extract(source.initial).rows[view.rowLabels!.indexOf(6)].C), /1,450\.00 €/)
  }

  // The Estonian timesheet: hidden columns are not columns; a date typed in the file's order stays a date
  {
    const source = await open('estonian-timesheet.xlsx')
    const view = source.extract(source.initial)
    assert.ok(!view.columns.includes('I') || !view.columns.includes('J'), 'the hidden columns are left out')
    const dateRow = view.rows.findIndex((r) => r.A === '02.11.2026')
    assert.ok(dateRow >= 0, 'dates as the file writes them')
    const sheetRow = view.rowLabels![dateRow] - 1
    assert.equal(source.inputAt(source.initial, sheetRow, 0), '02.11.2026')
    const value = source.valueFor(source.initial, sheetRow, 0, '05.11.2026')
    assert.equal(typeof value, 'number', 'a typed date is a date, not text')
    source.write(source.initial, sheetRow, 0, value)
    assert.equal(source.extract(source.initial).rows[dateRow].A, '05.11.2026')
  }

  // The project plan: its hidden sheet has no tab
  {
    const model = await readWorkbook(new Uint8Array(fs.readFileSync(path.join(spike, 'project-plan.xlsx'))))
    const source = modelSource(model)
    const hidden = model.sheets.filter((s) => s.state !== 'visible').map((s) => s.name)
    assert.ok(hidden.length > 0)
    for (const name of hidden) assert.ok(!source.tabs.includes(name), `${name} has no tab`)
  }

  // Add row and the + column widen the grid
  {
    const source = await open('training-budget.xlsx')
    const before = source.extract(source.initial)
    source.widen(source.initial, 1, 0)
    source.widen(source.initial, 0, 1)
    const after = source.extract(source.initial)
    assert.equal(after.rows.length, before.rows.length + 1)
    assert.equal(after.columns.length, before.columns.length + 1)
  }

  // a cell typed into an empty spot takes its column's style, as the save writes it (review of #726)
  {
    const source = await open('training-budget.xlsx')
    const sheet = source.model!.sheets[0]
    sheet.layout.cols.push({ min: 12, max: 12, hidden: false, style: sheet.cells.get(cellKey(5, 2))!.s })
    assert.equal(source.valueFor(sheet.name, 40, 12, '14'), 14)
    source.write(sheet.name, 40, 12, 14)
    const cell = sheet.cells.get(cellKey(40, 12))!
    assert.equal(cell.s, sheet.cells.get(cellKey(5, 2))!.s, 'the column style')
    assert.match(cell.text, /14\.00 €/, 'drawn in the column format')
    // and with no row or column style, the default
    source.write(sheet.name, 40, 20, 'x')
    assert.equal(sheet.cells.get(cellKey(40, 20))!.s, 0)
  }

  console.log('sheetSource: all passed')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
