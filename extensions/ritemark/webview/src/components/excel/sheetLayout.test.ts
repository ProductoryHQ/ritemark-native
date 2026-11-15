/**
 * Sprint 158 PR 3 (#711): the sheet grid's geometry, from the spike's workbooks, and the styles it draws with.
 * Run: npx tsx webview/src/components/excel/sheetLayout.test.ts
 */
import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readWorkbook, cellKey } from './readWorkbook'
import { buildLayout, fontCss, indexAt, sortRefusal, sortedRows, styleIndexOf, styleOf } from './sheetLayout'
import { applyTint, colorOf, readTheme } from './excelStyles'
import { columnPixels, maxDigitWidth } from './columnWidth'
import { compareCells } from '../sheetSort'

const repo = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../../../..')
const spike = path.join(repo, 'docs/development/releases/v2.3.0/sprint-158-excel/research/spike/fixtures')
const open = (name: string) => readWorkbook(new Uint8Array(fs.readFileSync(path.join(spike, name))))
const letters = (c: number) => String.fromCharCode(65 + c)
const opts = { minWidth: 0, minHeight: 0 }

async function main() {
  // Tints in HLS, as Excel computes them (the study's vectors), and theme index 0–3 swapped
  assert.equal(applyTint('4F81BD', 0.4), '95B3D7')
  assert.equal(applyTint('F79646', -0.25), 'E46C0A')
  const theme = readTheme('<a:clrScheme><a:dk1><a:sysClr lastClr="000000"/></a:dk1><a:lt1><a:sysClr lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F497D"/></a:dk2><a:lt2><a:srgbClr val="EEECE1"/></a:lt2><a:accent1><a:srgbClr val="4F81BD"/></a:accent1></a:clrScheme>')
  assert.equal(colorOf('<color theme="0"/>', { theme, indexed: [] }), '#FFFFFF', 'theme 0 is lt1')
  assert.equal(colorOf('<color theme="1"/>', { theme, indexed: [] }), '#000000', 'theme 1 is dk1')
  assert.equal(colorOf('<color theme="4" tint="0.3999755851924192"/>', { theme, indexed: [] }), '#95B3D7')
  assert.equal(colorOf('<color auto="1"/>', { theme, indexed: [] }), undefined)
  // Column widths by the widest digit: Calibri 11 is 7 px, so Excel's default 8.43 characters (stored with its
  // padding as 9.140625) is 64 px
  assert.equal(maxDigitWidth({ name: 'Calibri', size: 11 }), 7)
  assert.equal(columnPixels(9.140625, 7), 64)

  // The training budget: frozen at B5, widths from the file, row 14 hidden, A1's title in its own font
  {
    const model = await open('training-budget.xlsx')
    const sheet = model.sheets[0]
    const L = buildLayout(sheet, model.styles, opts)
    assert.deepEqual([L.frozenRows, L.frozenCols], [4, 1])
    assert.equal(L.rowH[L.displayOf.get(13)!], 0, 'row 14 is hidden')
    assert.ok(L.colW[0] > L.colW[1], 'A is wider than B, as the file sets')
    assert.equal(L.headerH, 22)
    const title = styleOf(model.styles, styleIndexOf(sheet, 0, 0))!
    assert.ok(title.font.bold && title.font.size > 11, 'the title is bold and larger')
    const css = fontCss(title.font, model.styles.baseFont)
    assert.equal(css.fontWeight, '700')
    // the header row's fill
    assert.ok(styleOf(model.styles, styleIndexOf(sheet, 3, 0))?.fill, 'row 4 has a fill')
    // a cell's position from a pixel, as the grid finds it
    assert.equal(indexAt(L.X, L.cols, L.X[2] + 1), 2)
    assert.equal(indexAt(L.Y, L.rows, 0), 0)
  }

  // The grid runs to the paper's edges: as many rows and columns as fill it
  {
    const model = await open('training-budget.xlsx')
    const L = buildLayout(model.sheets[0], model.styles, { minWidth: 3000, minHeight: 3000 })
    assert.ok(L.X[L.cols] >= 3000 && L.Y[L.rows] >= 3000)
    const more = buildLayout(model.sheets[0], model.styles, { ...opts, extraRows: 2, extraCols: 1 })
    const plain = buildLayout(model.sheets[0], model.styles, opts)
    assert.equal(more.rows, plain.rows + 2)
    assert.equal(more.cols, plain.cols + 1)
  }

  // The project plan: merges, rotated heads, no sort with merged cells across the rows
  {
    const model = await open('project-plan.xlsx')
    const sheet = model.sheets[model.activeSheet]
    const L = buildLayout(sheet, model.styles, opts)
    assert.ok(L.merges.length > 0)
    const [r1, c1, r2, c2] = L.merges.find(([a, , b]) => b > a)!
    assert.equal(L.mergeAt.get(cellKey(r2, c2)), L.mergeAt.get(cellKey(r1, c1)), 'every cell of a merge names it')
    assert.ok([...sheet.cells.values()].some((c) => (styleOf(model.styles, c.s)?.align.rotation ?? 0) > 0), 'rotated heads')
    assert.match(sortRefusal(sheet, letters) ?? '', /merged cells in the Phase column/)
  }

  // A sort is a view: the frozen rows stay, the rest are reordered, empty cells last
  {
    const model = await open('training-budget.xlsx')
    const sheet = model.sheets[0]
    assert.equal(sortRefusal(sheet, letters), undefined)
    const rows = sortedRows(sheet, 1, -1, compareCells)
    const L = buildLayout(sheet, model.styles, { ...opts, rowOrder: rows })
    assert.deepEqual([...L.rowOf.slice(0, 4)], [0, 1, 2, 3], 'the frozen rows stay')
    const firstSorted = L.rowOf[4]
    const values = [...L.rowOf.slice(4, sheet.maxR + 1)].map((r) => sheet.cells.get(cellKey(r, 1))?.value).filter((v) => typeof v === 'number') as number[]
    assert.deepEqual(values, [...values].sort((a, b) => b - a), 'Participants high to low')
    assert.equal(sheet.cells.get(cellKey(firstSorted, 1))?.value, Math.max(...values))
    assert.equal(L.displayOf.get(L.rowOf[10]), 10)
    // an edit after the sort doesn't move its row: the order chosen with the sort is kept
    const top = L.rowOf[4]
    sheet.cells.set(cellKey(top, 1), { kind: 'n', value: 0, text: '0', s: sheet.cells.get(cellKey(top, 1))!.s })
    const again = buildLayout(sheet, model.styles, { ...opts, rowOrder: rows })
    assert.equal(again.rowOf[4], top, 'the edited row stays where it was')
    // every row is still there once
    assert.equal(new Set(again.rowOf).size, again.rows)
  }

  // The sales report: a chart in its place, colour rules counted, a chart sheet with its chart's title
  {
    const model = await open('sales-report.xlsx')
    const sheet = model.sheets[model.activeSheet]
    assert.ok(sheet.layout.drawings.some((d) => d.what === 'chart' && d.anchor.from), 'a chart with its anchor')
    assert.ok(sheet.layout.conditionalFormats > 0, 'colour rules')
    const chartSheet = model.sheets.find((s) => s.kind === 'chartsheet')!
    assert.ok(chartSheet.layout.drawings[0]?.what === 'chart')
  }

  // Tab colours
  {
    const model = await open('project-plan.xlsx')
    assert.ok(model.sheets.some((s) => s.layout.tabColor), 'a tab colour')
  }

  console.log('sheetLayout: all passed')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
