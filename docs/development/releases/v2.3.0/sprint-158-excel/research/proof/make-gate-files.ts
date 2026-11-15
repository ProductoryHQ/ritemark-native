/**
 * Sprint 158: the saved files Jarmo opens in Excel and Numbers at the gate, one for each point the plan's risks name
 * (an appended shared string, a formula overwritten and its calculation chain dropped, a shared formula split up, a
 * value in a sheet Excel wrote). Each is made by the same save the editor runs (applyCellEdits).
 *   npx tsx ../../docs/development/releases/v2.3.0/sprint-158-excel/research/proof/make-gate-files.ts <out-dir>
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { createRequire } from 'node:module'
import { applyCellEdits } from '../../../../../../../extensions/ritemark/src/excel/applyCellEdits'

const repo = path.resolve(__dirname, '../../../../../../..')
const JSZip = createRequire(path.join(repo, 'extensions/ritemark/package.json'))('jszip') as typeof import('jszip')
const read = (p: string) => new Uint8Array(fs.readFileSync(path.join(repo, p)))

async function main() {
  const out = process.argv[2]
  fs.mkdirSync(out, { recursive: true })
  const spike = 'docs/development/releases/v2.3.0/sprint-158-excel/research/spike/fixtures/'
  const save = async (name: string, bytes: Uint8Array, edits: Parameters<typeof applyCellEdits>[1], what: string) => {
    const { bytes: saved, report } = await applyCellEdits(bytes, edits)
    fs.writeFileSync(path.join(out, name), saved)
    console.log(`${name}: ${what} (changed ${report.touched.join(', ')}${report.calcChainDropped ? '; calculation chain dropped' : ''})`)
  }

  await save('1-budget-value.xlsx', read(spike + 'training-budget.xlsx'), [{ sheet: 'Budget 2027', ref: 'B6', value: 14 }],
    'Participants for New manager programme 12 -> 14; Planned should become 20,300.00 € when Excel recalculates')
  await save('2-timesheet-text-and-date.xlsx', read(spike + 'estonian-timesheet.xlsx'), [
    { sheet: 'November 2026', ref: 'H7', value: 'Uus märkus: õ ä ö ü š ž' },
    { sheet: 'November 2026', ref: 'A5', value: 46327 },
  ], 'a note with Estonian letters (inline text, as this file stores its text) and a date typed over (02.11.2026 -> 01.11.2026)')
  await save('3-rich-formula-overwritten.xlsx', read('extensions/ritemark/src/excel/fixtures/rich-excelish.xlsx'), [{ sheet: 'Budget', ref: 'B11', value: 2000 }],
    'the Total formula typed over with 2000: the calculation chain goes, the chart and colour rules stay')

  // a shared formula (as Excel writes a fill-down), its middle cell typed over: the group is split
  const zip = await JSZip.loadAsync(read('docs/development/sprints/sprint-81-excel-editing/test-workbook.xlsx'))
  const sheet = (await zip.file('xl/worksheets/sheet1.xml')!.async('string'))
    .replace('<f>B3*C3</f>', '<f t="shared" ref="D3:D6" si="0">B3*C3</f>')
    .replace('<f>B4*C4</f>', '<f t="shared" si="0"/>')
    .replace('<f>B5*C5</f>', '<f t="shared" si="0"/>')
    .replace('<f>B6*C6</f>', '<f t="shared" si="0"/>')
  zip.file('xl/worksheets/sheet1.xml', sheet)
  const shared = new Uint8Array(await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }))
  await save('4-mac-excel-shared-formula.xlsx', shared, [{ sheet: 'Sales', ref: 'D5', value: 999 }],
    'a filled-down formula typed over in its middle (D5): D3, D4 and D6 keep their formulas')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
