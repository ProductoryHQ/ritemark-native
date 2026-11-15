/**
 * Sprint 158 PR 3 (#711): the sheet grid's geometry, from the spike's workbooks, and the styles it draws with.
 * Run: npx tsx webview/src/components/excel/sheetLayout.test.ts
 */
import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readWorkbook, cellKey } from './readWorkbook'
import { GRID_SANS, GRID_SERIF, buildLayout, cellPadding, fontCss, fontShorthand, indexAt, mergeIndex, setFontTwins, sortRefusal, sortedRows, styleIndexOf, styleOf } from './sheetLayout'
import { applyTint, colorOf, readTheme } from './excelStyles'
import { columnPixels, columnScale, maxDigitWidth } from './columnWidth'
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
  // Excel for Mac counts points with the digit at 72 dpi (6 pt): the training budget's columns as its window shows
  // them, in points, A 204, B 72, D 84, E 75, K 60 and the default 53 (reference/excel-training-budget.jpg)
  {
    const calibri = { name: 'Calibri', size: 11 }
    const mac = columnScale(calibri, 'mac')
    const win = columnScale(calibri, 'windows')
    for (const [chars, points] of [[34, 204], [12, 72], [14, 84], [12.5, 75], [10, 60]]) assert.equal(mac.pixels(chars), Math.round((points * 4) / 3), `${chars} characters`)
    assert.equal(mac.defaultPixels(undefined, 8), Math.round((53 * 4) / 3))
    // the timesheet's Normal font is Aptos Narrow: 5.3 pt, rounded up to 6 as Excel for Mac does; A 69, B 33, H 276
    const narrow = columnScale({ name: 'Aptos Narrow', size: 11 }, 'mac')
    for (const [chars, points] of [[11.5, 69], [5.5, 33], [46, 276]]) assert.equal(narrow.pixels(chars), Math.round((points * 4) / 3), `${chars} characters`)
    assert.equal(win.pixels(12.5), 87)
    // eight Calibri digits (7.43 px each) fit Windows' 64 px default column only with its 2 px inset
    assert.equal(cellPadding('windows'), 2)
    assert.ok(8 * 7.43 + 2 * cellPadding('windows') <= 64.5)
    assert.equal(cellPadding('mac'), 3)
    assert.equal(win.defaultPixels(undefined, 8), 64)
  }

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

  // A whole sheet merged (a few bytes in a file) is a range, not billions of cells (Codex on #724)
  {
    const t0 = performance.now()
    const index = mergeIndex([[0, 0, 1_048_575, 16_383], [2, 1, 3, 2]])
    assert.ok(performance.now() - t0 < 50, 'indexed at once')
    assert.equal(index.get(cellKey(500_000, 9_000)), 0)
    assert.equal(index.get(cellKey(3, 2)), 1, 'a small merge inside it is found first')
    assert.ok(index.has(cellKey(0, 0)))
    const model = await open('training-budget.xlsx')
    const sheet = model.sheets[0]
    const huge = { ...sheet, layout: { ...sheet.layout, merges: [[0, 0, 1_048_575, 16_383] as [number, number, number, number]] } }
    const t1 = performance.now()
    const L = buildLayout(huge, model.styles, opts)
    assert.ok(performance.now() - t1 < 500, 'laid out quickly')
    assert.ok(L.rows < 1000, 'the drawn area follows the cells, not the huge merge')
  }

  // Tab colours
  {
    const model = await open('project-plan.xlsx')
    assert.ok(model.sheets.some((s) => s.layout.tabColor), 'a tab colour')
  }

  // Calibri and Cambria by their bundled twins where the grid found them missing (PR 4); others keep their own name
  {
    const base = { name: 'Calibri', size: 11, bold: false, italic: false, strike: false }
    assert.match(fontCss(undefined, base).fontFamily, /^'Calibri', 'Carlito'/, 'no twins set: the family itself')
    setFontTwins([['Calibri', GRID_SANS], ['Cambria', GRID_SERIF]])
    assert.equal(fontCss(undefined, base).fontFamily, `'${GRID_SANS}', Arial, sans-serif`)
    assert.equal(fontCss({ name: 'CAMBRIA' }, base).fontFamily, `'${GRID_SERIF}', Arial, sans-serif`)
    assert.match(fontCss({ name: 'Verdana' }, base).fontFamily, /^'Verdana'/)
    assert.equal(fontShorthand({ bold: true }, base), `normal 700 ${44 / 3}px '${GRID_SANS}', Arial, sans-serif`)
    setFontTwins([])
    // Cambria's widest digit is Caladea's: 11 pt is 8 px, 12 pt is 8 px (0.55 made it 9)
    assert.equal(maxDigitWidth({ name: 'Cambria', size: 11 }), 8)
    assert.equal(maxDigitWidth({ name: 'Cambria', size: 12 }), 8)
  }

  console.log('sheetLayout: all passed')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
