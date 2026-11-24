/**
 * Sprint 158 PR 2 (#711): the preview's reader against SheetJS on every fixture, and what SheetJS got wrong.
 * Run: npx tsx webview/src/components/excel/readWorkbook.test.ts
 */
import assert from 'node:assert/strict'
import { serialize } from 'node:v8'
import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import { resolveSeries } from './chartSeries'
import { chartsKeepFixtures } from '../../../../src/excel/chartsKeepFixtures.test'
import { cellKey, readWorkbook } from './readWorkbook'
import { compileRules } from './ruleEngine'

const repo = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../../../..')
const spike = path.join(repo, 'docs/development/releases/v2.3.0/sprint-158-excel/research/spike/fixtures')
const fixtures: Array<[string, string]> = [
  ...['training-budget.xlsx', 'estonian-timesheet.xlsx', 'project-plan.xlsx'].map((n) => [n, path.join(spike, n)] as [string, string]),
  ...chartsKeepFixtures.map(({ file }): [string, string] => [path.basename(file), file]),
  ['Excel for Mac', path.join(repo, 'docs/development/sprints/sprint-81-excel-editing/test-workbook.xlsx')],
]

// R21. PR 1 and PR 5 add readChart and compileRules adapters here.
const workbookByteReaders = [
  { name: 'readWorkbook', read: readWorkbook },
]
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')

async function main() {
  for (const [label, file] of fixtures) {
    for (const { name, read } of workbookByteReaders) {
      const bytes = new Uint8Array(fs.readFileSync(file))
      const before = sha256(bytes)
      await read(bytes)
      assert.equal(sha256(bytes), before, `${label}: ${name} changed input bytes`)
    }
  }
  console.log(`  R21: the reader does not mutate its input on ${fixtures.length} workbooks`)

  for (const [label, file] of fixtures) {
    const bytes = new Uint8Array(fs.readFileSync(file))
    const hash = () => createHash('sha256').update(bytes).digest('hex')
    const before = hash()
    const model = await readWorkbook(bytes)
    assert.equal(hash(), before, `${label}: reading the workbook and its chart parts changes no byte`)
    for (const sheet of model.sheets) {
      for (const drawing of sheet.layout.drawings) {
        if (!drawing.chart) continue
        const before = sha256(serialize([drawing.chart, model.sheets]))
        resolveSeries(drawing.chart, model.sheets, model)
        assert.equal(sha256(serialize([drawing.chart, model.sheets])), before, `${label}: resolveSeries changed the chart or sheets`)
      }
    }
    assert.equal(hash(), before, `${label}: resolving chart series changes no byte`)
    for (const sheet of model.sheets) {
      const compiled = compileRules(sheet, sheet.layout.rules, { ...model, today: new Date(2026, 10, 24) })
      for (const rule of sheet.layout.rules) {
        for (const { top, left } of rule.areas) compiled.styleAt(top, left)
      }
    }
    assert.equal(hash(), before, `${label}: reading and applying rule styles preserve the input bytes`)
    const book = XLSX.read(bytes, { type: 'array', cellFormula: true })
    assert.deepEqual(model.sheets.map((s) => s.name), book.SheetNames, `${label}: the sheets`)
    let compared = 0
    for (const sheet of model.sheets) {
      const ws = book.Sheets[sheet.name]
      if (sheet.kind !== 'worksheet' || !ws) continue
      for (const key of Object.keys(ws)) {
        if (key[0] === '!') continue
        const { r, c } = XLSX.utils.decode_cell(key)
        const theirs = ws[key]
        const ours = sheet.cells.get(cellKey(r, c))
        if (theirs.t === 'z') continue
        assert.ok(ours, `${label} ${sheet.name}!${key}: SheetJS reads it, we don't`)
        if (theirs.t !== 'e') {
          const want = theirs.t === 'n' || theirs.t === 'b' || theirs.t === 's' ? theirs.v : theirs.v
          const got = typeof want === 'number' && typeof ours.value === 'number' ? Math.abs(ours.value - want) < 1e-9 : ours.value === want
          assert.ok(got, `${label} ${sheet.name}!${key}: ${JSON.stringify(ours.value)} ≠ SheetJS ${JSON.stringify(want)}`)
        }
        if (theirs.f) assert.equal(ours.formula, theirs.f, `${label} ${sheet.name}!${key}: the formula`)
        compared++
      }
      // and nothing SheetJS doesn't read
      for (const [key, cell] of sheet.cells) {
        const addr = XLSX.utils.encode_cell({ r: Math.floor(key / 16384), c: key % 16384 })
        if (!ws[addr] && cell.value !== '') assert.fail(`${label} ${sheet.name}!${addr}: we read ${JSON.stringify(cell.value)}, SheetJS nothing`)
      }
    }
    console.log(`  ${label}: ${compared} cells match SheetJS`)
  }

  // The Estonian timesheet: dates as written, durations, hidden columns
  {
    const model = await readWorkbook(new Uint8Array(fs.readFileSync(path.join(spike, 'estonian-timesheet.xlsx'))))
    const sheet = model.sheets[model.activeSheet]
    const texts = [...sheet.cells.values()].map((c) => c.text)
    assert.ok(texts.includes('02.11.2026'), 'a date as the file writes it')
    assert.ok(texts.includes('8:15'), 'a duration')
    assert.ok(!texts.some((t) => /^\d{1,2}\/\d{1,2}\/\d{2}$/.test(t)), 'no m/d/yy dates')
    assert.ok(sheet.hiddenCols.size >= 1, 'hidden columns')
  }

  // The training budget: a hidden row, money, the red negative
  {
    const model = await readWorkbook(new Uint8Array(fs.readFileSync(path.join(spike, 'training-budget.xlsx'))))
    const sheet = model.sheets[0]
    assert.ok(sheet.hiddenRows.has(13), 'row 14 is hidden')
    // an accounting format: padded at both ends, as Excel pads it
    assert.equal(sheet.cells.get(cellKey(5, 2))?.text.trim(), '1,450.00 €')
    const red = [...sheet.cells.values()].find((c) => c.text.trim() === '-360.00 €')
    assert.equal(red?.color, '#FF0000')
  }

  // A workbook whose <sheet> tags quote r:id with single quotes is still read (Codex on #725)
  {
    const zip = await JSZip.loadAsync(fs.readFileSync(path.join(spike, 'training-budget.xlsx')))
    const wb = await zip.file('xl/workbook.xml')!.async('string')
    zip.file('xl/workbook.xml', wb.replace(/<sheet [^>]*\/>/g, (m) => m.replace(/"/g, "'")))
    const model = await readWorkbook(new Uint8Array(await zip.generateAsync({ type: 'uint8array' })))
    assert.equal(model.sheets[0].kind, 'worksheet')
    assert.equal(model.sheets[0].cells.get(cellKey(5, 2))?.text.trim(), '1,450.00 €')
  }

  // The project plan: a hidden sheet, a sheet that opens first
  {
    const model = await readWorkbook(new Uint8Array(fs.readFileSync(path.join(spike, 'project-plan.xlsx'))))
    assert.ok(model.sheets.some((s) => s.state !== 'visible'), 'a hidden sheet')
    assert.equal(model.sheets[model.activeSheet].state, 'visible')
  }

  // The sales report: a chart sheet is a sheet without cells
  {
    const model = await readWorkbook(new Uint8Array(fs.readFileSync(path.join(spike, 'sales-report.xlsx'))))
    const chartSheet = model.sheets.find((s) => s.kind === 'chartsheet')
    assert.ok(chartSheet, 'a chart sheet')
    assert.equal(chartSheet.cells.size, 0)
    assert.ok(chartSheet.layout.drawings.some((drawing) => drawing.chart?.supported), 'a parsed chart on the chart sheet')
  }

  // Shared formulas: each cell gets the anchor's formula, moved
  {
    const zip = await JSZip.loadAsync(fs.readFileSync(path.join(repo, 'docs/development/sprints/sprint-81-excel-editing/test-workbook.xlsx')))
    const xml = (await zip.file('xl/worksheets/sheet1.xml')!.async('string'))
      .replace('<f>B3*C3</f>', '<f t="shared" ref="D3:D6" si="0">B3*C3</f>')
      .replace('<f>B4*C4</f>', '<f t="shared" si="0"/>')
      .replace('<f>B5*C5</f>', '<f t="shared" si="0"/>')
    zip.file('xl/worksheets/sheet1.xml', xml)
    const model = await readWorkbook(new Uint8Array(await zip.generateAsync({ type: 'uint8array' })))
    assert.equal(model.sheets[0].cells.get(cellKey(4, 3))?.formula, 'B5*C5')
  }

  // An ISO date (t="d") in a 1904-system workbook reads as the same day (Codex on #723)
  {
    const zip = await JSZip.loadAsync(fs.readFileSync(path.join(repo, 'docs/development/sprints/sprint-81-excel-editing/test-workbook.xlsx')))
    const wb = (await zip.file('xl/workbook.xml')!.async('string')).replace(/<workbookPr([^>]*?)\/>/, '<workbookPr$1 date1904="1"/>')
    zip.file('xl/workbook.xml', /date1904/.test(wb) ? wb : wb.replace('<sheets>', '<workbookPr date1904="1"/><sheets>'))
    const sheet = (await zip.file('xl/worksheets/sheet1.xml')!.async('string')).replace('</sheetData>', '<row r="40"><c r="A40" t="d" s="0"><v>2026-01-03T00:00:00Z</v></c></row></sheetData>')
    zip.file('xl/worksheets/sheet1.xml', sheet)
    const model = await readWorkbook(new Uint8Array(await zip.generateAsync({ type: 'uint8array' })))
    assert.ok(model.date1904)
    const cell = model.sheets[0].cells.get(cellKey(39, 0))!
    assert.equal(cell.value, 46025 - 1462, 'a serial in the 1904 system')
    const { formatCellValue } = await import('./numberFormat')
    assert.equal(formatCellValue(cell.value as number, 'dd.mm.yyyy', true).text, '03.01.2026')
  }

  // Not a workbook: thrown, for the SheetJS fallback
  await assert.rejects(readWorkbook(new Uint8Array([1, 2, 3])))

  console.log('readWorkbook: all passed')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
