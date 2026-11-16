/**
 * Sprint 158 PR 4: how long the preview's reader takes on a large workbook, and its layout. Node, not the webview's
 * Chromium, so it is a lower bound; perf-50k.ts writes the workbook.
 *   npx tsx ../../docs/development/releases/v2.3.0/sprint-158-excel/research/proof/read-50k.ts <file.xlsx>
 */
import * as fs from 'node:fs'
import { readWorkbook } from '../../../../../../../extensions/ritemark/webview/src/components/excel/readWorkbook'
import { buildLayout } from '../../../../../../../extensions/ritemark/webview/src/components/excel/sheetLayout'

async function main() {
  const bytes = new Uint8Array(fs.readFileSync(process.argv[2]))
  const t0 = performance.now()
  const model = await readWorkbook(bytes)
  const t1 = performance.now()
  const sheet = model.sheets[model.activeSheet]
  const layout = buildLayout(sheet, model.styles, { minWidth: 1400, minHeight: 900 })
  const t2 = performance.now()
  console.log(`read: ${(t1 - t0).toFixed(0)} ms, ${sheet.cells.size.toLocaleString('en-US')} cells, ${sheet.maxR + 1} rows`)
  console.log(`layout: ${(t2 - t1).toFixed(0)} ms, ${layout.rows} rows drawn to ${(layout.Y[layout.rows] / 1e6).toFixed(2)} M px`)
  console.log(`heap used: ${(process.memoryUsage().heapUsed / 1e6).toFixed(0)} MB`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
