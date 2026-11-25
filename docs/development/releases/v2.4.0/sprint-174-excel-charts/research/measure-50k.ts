/**
 * Node-side preview timings. Pass the generated rules-50k.xlsx and a source root.
 * Use --before for the pre-PR 6 checkout or --whole-columns for eight full-column rules.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

type Reader = typeof import('../../../../../../extensions/ritemark/webview/src/components/excel/readWorkbook')
type Layout = typeof import('../../../../../../extensions/ritemark/webview/src/components/excel/sheetLayout')
type Source = typeof import('../../../../../../extensions/ritemark/webview/src/components/excel/sheetSource')
type Rules = typeof import('../../../../../../extensions/ritemark/webview/src/components/excel/cellRules')

async function main() {
  const [file, root, mode] = process.argv.slice(2)
  const modules = resolve(root, 'extensions/ritemark/webview/src/components/excel')
  const load = (name: string) => import(pathToFileURL(join(modules, name + '.ts')).href)
  const { readWorkbook, cellKey }: Reader = await load('readWorkbook')
  const { buildLayout, fontShorthand, styleIndexOf, styleOf }: Layout = await load('sheetLayout')
  const { modelSource }: Source = await load('sheetSource')
  const rulesModule: Rules | undefined = mode === '--before' ? undefined : await load('cellRules')
  const today = new Date(2026, 10, 24)
  const bytes = new Uint8Array(readFileSync(file))
  const start = performance.now()
  const model = await readWorkbook(bytes)
  const read = performance.now() - start
  const sheet = model.sheets[model.activeSheet]
  assert.equal(sheet.cells.size, 1_000_000)
  assert.equal(sheet.maxR, 49_999)
  if (mode === '--whole-columns') {
    const original = sheet.layout.rules
    sheet.layout.rules = Array.from({ length: 8 }, (_, i) => {
      const col = i + 1
      const letter = String.fromCharCode(65 + col)
      return { ...original[i % original.length], priority: i + 1, sqref: `${letter}:${letter}`,
        areas: [{ top: 0, bottom: 1_048_575, left: col, right: col }] }
    })
  }
  const source = modelSource(model)

  const options = { minWidth: 1400, minHeight: 900 }
  const layoutStart = performance.now()
  let layout = buildLayout(sheet, model.styles, options)
  const layoutMs = performance.now() - layoutStart
  const compileStart = performance.now()
  const cache = rulesModule?.createCellRuleCache(model)
  const rulesFor = () => cache?.forSheet(sheet, today)
  const initialRules = rulesFor()
  const compileMs = performance.now() - compileStart

  function windowAt(first: number) {
    const window = { i0: first, i1: first + 39, c0: 0, c1: 19 }
    const rules = rulesFor()
    const painted = rulesModule?.visibleCellRules(rules, layout, window, sheet, model)
    // SheetGrid asks for cells and fonts during measurement, then reuses the paint when drawing.
    let checksum = 0
    for (let i = window.i0; i <= window.i1; i++) {
      const row = layout.rowOf[i]
      for (let col = 0; col <= window.c1; col++) {
        const entry = painted?.at(i, col)
        const cell = entry?.cell ?? sheet.cells.get(cellKey(row, col))
        const style = entry?.style ?? styleOf(model.styles, styleIndexOf(sheet, row, col))
        checksum += (cell?.text.length ?? 0) + fontShorthand(style?.font, model.styles.baseFont).length
      }
    }
    for (let i = window.i0; i <= window.i1; i++) {
      for (let col = 0; col <= window.c1; col++) {
        checksum += painted?.at(i, col)?.paint?.fill.width?.toString().length ?? 0
      }
    }
    return checksum
  }
  assert.ok(windowAt(0))
  const first = performance.now() - start
  const lastRow = sheet.maxR
  const lastFirst = lastRow - 39
  const scrollStart = performance.now()
  assert.ok(windowAt(lastFirst))
  const scroll = performance.now() - scrollStart
  assert.equal(rulesFor(), initialRules, 'the last window reuses the initial range facts')
  if (rulesModule) {
    assert.ok(initialRules?.styleAt(lastRow, 1).colorScale)
    assert.ok(initialRules?.styleAt(lastRow, 2).dataBar)
    assert.equal(initialRules?.styleAt(lastRow, 3).dxf?.fill, '#FFC7CE')
  }

  function editAt(col: number) {
    const start = performance.now()
    const value = source.valueFor(sheet.name, lastRow, col, '20000')
    source.write(sheet.name, lastRow, col, value)
    cache?.invalidate(sheet.name, lastRow, col)
    layout = buildLayout(sheet, model.styles, options)
    assert.ok(windowAt(lastFirst))
    const elapsed = performance.now() - start
    assert.equal(sheet.cells.get(cellKey(lastRow, col))?.value, 20000)
    return elapsed
  }
  const outside = editAt(9)
  assert.equal(rulesFor(), initialRules, 'outside edits reuse the compiled rules')
  const inside = editAt(1)
  if (rulesModule) {
    assert.notEqual(rulesFor(), initialRules)
    assert.equal(rulesFor()?.styleAt(lastRow, 1).colorScale, '#63BE7B')
  }
  console.log(JSON.stringify({ read, layout: layoutMs, compile: compileMs, first, scroll, outside, inside }))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
