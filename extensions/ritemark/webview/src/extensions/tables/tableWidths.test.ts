/**
 * Tables you can change (experience 48, "Column widths"): widths as the delimiter row's dashes, the way Pandoc reads
 * them, without ever changing how a person's untouched table looks.
 *  - a corpus of tables lined up by eye, written by AIs and written plainly: no widths read, the delimiter row back as
 *    written (and every byte, for a table without padded cells), nothing drawn differently (no column widths in the
 *    editor or on the slide);
 *  - widths set by a drag: written as 80 dashes in all (Pandoc's line-length condition holds), read back the same,
 *    byte for byte, one undo step, in a Text document and on a slide, and drawn by the slide renderer;
 *  - a double-click: back to automatic; a column added, deleted, moved or aligned keeps the widths;
 *  - the drag's math: 5 % steps, the pair's sum kept, never under a column's longest word.
 * Run with `npx tsx webview/src/extensions/tables/tableWidths.test.ts` (part of `test:editor-sync` and `test:decks`).
 */
import { strict as assert } from 'node:assert'
import { Marked, type Tokens } from 'marked'
import type { Node as PMNode } from '@tiptap/pm/model'
import { EditorState, TextSelection } from '@tiptap/pm/state'
import { history, undo } from '@tiptap/pm/history'
import { openDocument, saveDocument, installTestDocument } from '../../utils/markdownFidelity'
import { loadSlide, saveSlide } from '../../components/decks/blocks/slideEditorHarness'
import { blockSlideHtml } from '../../../../src/decks/blocks/slideRenderer'
import { PANDOC_COLUMNS, WIDTH_UNITS, delimiterUnits, heldWidths, percentsOf, snapPercents, tableHasWidths } from '../../../../src/markdown/tableWidths'
import { alignColumn, columnWidths, deleteColumn, insertColumn, moveColumn, setColumnWidths, tableAt } from './tableOps'
import { minPercent, resizePair } from '../../components/tables/columnResize'

installTestDocument()

const gfm = new Marked({ gfm: true })
const tablesOf = (markdown: string) => gfm.lexer(markdown).filter((token): token is Tokens.Table => token.type === 'table')

function tablePos(doc: PMNode): number {
  let found = -1
  doc.descendants((node, pos) => {
    if (found >= 0) return false
    if (node.type.name === 'table') { found = pos; return false }
    return true
  })
  assert.ok(found >= 0)
  return found
}

const surfaces = [
  (() => {
    let opened: ReturnType<typeof openDocument> | null = null
    return { name: 'Text document', open: (text: string) => (opened = openDocument(text)).doc, save: (doc: PMNode) => saveDocument(opened!, doc) }
  })(),
  { name: 'slide', open: loadSlide, save: saveSlide },
]

// ---- The corpus: tables people line up by eye, tables AIs write, plain tables. None has widths; each is unchanged.
const CORPUS: string[] = [
  // Lined up by eye, short.
  '| Name  | Qty |\n|-------|-----|\n| Apple | 3   |\n| Pear  | 12  |',
  // Lined up by eye, with alignment marks.
  '| Item        | Price | Notes          |\n|:------------|------:|:--------------:|\n| Coffee      |  2.50 | hot            |\n| Tea         |  2.00 | with milk      |',
  // Lined up by eye, wider than 72 characters (Pandoc would read widths here; Ritemark keeps the look it had).
  '| Step | What happens                                   | Who                       |\n|------|------------------------------------------------|---------------------------|\n| 1    | The agent reads the folder and makes a plan    | Claude                    |\n| 2    | The person reads the plan and says yes or no   | You                       |',
  // An AI's table: each header's dashes as long as its words, the body not lined up, a line over 72.
  '| Name | Description | Owner |\n|------|-------------|-------|\n| Intake | A long description of what the intake step does for the whole team every week | Ann |\n| Review | Short | Bo |',
  // An AI's table with spaces around its dashes.
  '| Feature | Status |\n| ------- | ------ |\n| Tables you can change, with grips, menus and plus bars on every edge of them | Done |',
  // Plain: equal dashes.
  '| a | b | c |\n| --- | --- | --- |\n| 1 | 2 | 3 |',
  // Compact, equal.
  '|a|b|\n|---|---|\n|1|2|',
  // Unequal but short (no line over 72): not widths, as Pandoc.
  '| a | b |\n|-|-----------|\n| 1 | 2 |',
  // A first body row lined up with the delimiter, the header not.
  '| A | B |\n|------------------------------------------|----------------------------------------------------|\n| one of the rows, written out to the line | and its neighbour, written out much longer than it |',
]

for (const [index, table] of CORPUS.entries()) {
  const raw = tablesOf(table)[0]?.raw
  assert.ok(raw, `corpus ${index}: a table`)
  assert.equal(tableHasWidths(raw!), false, `corpus ${index}: no widths read\n${table}`)
  for (const surface of surfaces) {
    const source = surface.name === 'slide' ? `# Table ${index}\n\n${table}` : `# Table ${index}\n\n${table}\n`
    const doc = surface.open(source)
    const saved = surface.save(doc)
    // The delimiter row as written; the rest as the editor has always written it (a padded cell's extra spaces are
    // outside the fidelity bound, `fidelity-corpus/known`), and the next save the same bytes.
    assert.equal(saved.split('\n')[3], table.split('\n')[1], `corpus ${index}, ${surface.name}: the delimiter row as written`)
    assert.equal(surface.save(surface.open(saved)), saved, `corpus ${index}, ${surface.name}: byte-stable`)
    if (!/\|[^|\n]*  \|/.test(table)) assert.equal(saved, source, `corpus ${index}, ${surface.name}: back byte for byte`)
    // Saved with an edit elsewhere (the save writes the rows without the spaces that lined them up) and opened again:
    // still no widths (review of #772: a wide table lined up by eye read as 5/60/35 % after one save).
    const edited = surface.name === 'slide' ? saved.replace(`# Table ${index}`, `# Table ${index}!`) : `${saved}\nMore words.\n`
    const again = surface.open(surface.save(surface.open(edited)))
    assert.equal(columnWidths(tableAt(again, tablePos(again))!.node), null, `corpus ${index}, ${surface.name}: no widths after a save`)
    assert.equal(tableHasWidths(tablesOf(surface.save(again))[0].raw), false, `corpus ${index}, ${surface.name}: the saved table reads without widths`)
    assert.equal(columnWidths(tableAt(doc, tablePos(doc))!.node), null, `corpus ${index}, ${surface.name}: drawn with automatic widths`)
  }
  assert.ok(!blockSlideHtml(`# T\n\n${table}`).includes('<colgroup'), `corpus ${index}: the slide renderer draws no widths`)
}

// ---- Widths set by a drag, in a Text document and on a slide.
for (const surface of surfaces) {
  const source = surface.name === 'slide'
    ? '# Tools\n\n| Tool | Files | Result |\n| --- | :-- | --: |\n| Work | The folder | Saved |'
    : '# Tools\n\n| Tool | Files | Result |\n| --- | :-- | --: |\n| Work | The folder | Saved |\n\nAfter.\n'
  let state = EditorState.create({ doc: surface.open(source), plugins: [history()] })
  const pos = tablePos(state.doc)
  const tr = setColumnWidths(state, pos, [20, 50, 30])!
  assert.ok(tr, `${surface.name}: a change`)
  state = state.apply(tr)
  const saved = surface.save(state.doc)
  const delimiter = saved.split('\n')[3]
  assert.equal(delimiter, '| ---------------- | :--------------------------------------- | -----------------------: |', `${surface.name}: the dashes are the widths, the marks and the spacing kept\n${saved}`)
  assert.deepEqual(delimiterUnits(delimiter), [16, 40, 24])
  assert.equal(delimiterUnits(delimiter)!.reduce((a, b) => a + b, 0), WIDTH_UNITS)
  assert.ok(delimiter.length > PANDOC_COLUMNS, 'Pandoc reads the widths too: the line is longer than 72')
  const table = tablesOf(saved)[0]
  assert.deepEqual(table.align, [null, 'left', 'right'], 'the alignment is unchanged')
  assert.equal(tableHasWidths(table.raw), true)
  // Read back the same, byte for byte.
  const reopened = surface.open(saved)
  assert.deepEqual(columnWidths(tableAt(reopened, tablePos(reopened))!.node), [20, 50, 30], `${surface.name}: read back`)
  assert.equal(surface.save(reopened), saved, `${surface.name}: byte for byte`)
  // One undo step.
  let undone = state
  undo(state, next => { undone = state.apply(next) })
  assert.equal(surface.save(undone.doc), source, `${surface.name}: one Undo takes the widths back`)
  // A double-click: automatic again, the plain delimiter row, alignment kept.
  const reset = state.apply(setColumnWidths(state, pos, null)!)
  const automatic = surface.save(reset.doc)
  assert.equal(automatic.split('\n')[3], '| --- | :--- | ---: |', automatic)
  assert.equal(columnWidths(tableAt(reset.doc, pos)!.node), null)
  assert.equal(setColumnWidths(reset, pos, null), null, 'already automatic: nothing to do')
  assert.equal(setColumnWidths(state, pos, [20, 50, 30]), null, 'the same widths: nothing to do')

  // A column added, moved, deleted or aligned keeps the table's widths.
  const added = surface.save(state.apply(insertColumn(state, pos, 3, 0)!).doc)
  const addedTable = tablesOf(added)[0]
  assert.equal(tableHasWidths(addedTable.raw), true, `${surface.name}: a new column, still widths\n${added}`)
  assert.equal(percentsOf(delimiterUnits(added.split('\n')[3])!).reduce((a, b) => a + b, 0), 100)
  const moved = surface.save(state.apply(moveColumn(state, pos, 1, 2, 0)!).doc)
  assert.deepEqual(percentsOf(delimiterUnits(moved.split('\n')[3])!), [20, 30, 50], `${surface.name}: a moved column takes its width with it`)
  const deleted = surface.save(state.apply(deleteColumn(state, pos, 0)!).doc)
  assert.deepEqual(percentsOf(delimiterUnits(deleted.split('\n')[3])!), [65, 35], `${surface.name}: the others share a deleted column's width, in proportion`)
  const aligned = surface.save(state.apply(alignColumn(state, pos, 1, 'center')!).doc)
  assert.equal(aligned.split('\n')[3], '| ---------------- | :--------------------------------------: | -----------------------: |', `${surface.name}: alignment keeps the width\n${aligned}`)
}

// ---- Equal shares are automatic widths (review of #772: [50, 50] was written as equal dashes, then read as automatic);
// a table of more than 20 columns has no widths (each column is at least 5 %).
{
  const doc = surfaces[0].open('| a | b |\n| --- | --- |\n| 1 | 2 |\n')
  const state = EditorState.create({ doc })
  assert.equal(setColumnWidths(state, tablePos(doc), [50, 50]), null, 'equal shares on an automatic table: nothing to do')
  const set = state.apply(setColumnWidths(state, tablePos(doc), [30, 70])!)
  const equal = set.apply(setColumnWidths(set, tablePos(doc), [50, 50])!)
  assert.equal(surfaces[0].save(equal.doc).split('\n')[1], '| --- | --- |', 'equal shares write the automatic row')
  const wide = '| ' + Array.from({ length: 22 }, (_, i) => `c${i}`).join(' | ') + ' |\n|' + Array.from({ length: 22 }, () => ' --- ').join('|') + '|\n'
  const wideDoc = surfaces[0].open(wide)
  const wideState = EditorState.create({ doc: wideDoc })
  assert.equal(setColumnWidths(wideState, tablePos(wideDoc), Array.from({ length: 22 }, (_, i) => (i === 0 ? 30 : 70 / 21))), null, '22 columns: no widths')
  assert.equal(snapPercents(Array.from({ length: 20 }, () => 1)).reduce((a, b) => a + b, 0), 100, '20 columns still add to 100')
}

// ---- A column added to a table with widths at 19 columns (Codex on #772): 20 columns of one step each, so the table is
// automatic again, and its widths never add up past 100.
{
  const header = '| ' + Array.from({ length: 19 }, (_, i) => `c${i}`).join(' | ') + ' |'
  const delimiter = '|' + Array.from({ length: 19 }, () => ' --- ').join('|') + '|'
  const doc = surfaces[0].open(`${header}\n${delimiter}\n`)
  let state = EditorState.create({ doc })
  state = state.apply(setColumnWidths(state, tablePos(doc), [10, ...Array.from({ length: 18 }, () => 5)])!)
  assert.equal(columnWidths(tableAt(state.doc, tablePos(doc))!.node)!.reduce((a, b) => a + b, 0), 100)
  state = state.apply(insertColumn(state, tablePos(doc), 19, 0)!)
  const saved = surfaces[0].save(state.doc)
  assert.equal(tableHasWidths(tablesOf(saved)[0].raw), false, '20 columns: automatic')
  assert.equal(columnWidths(tableAt(state.doc, tablePos(doc))!.node), null)
}

// ---- Only Ritemark's own form is read as widths: 80 units, each a multiple of 4. A long, unequal delimiter row that
// is not lined up but isn't in that form (a hand-written one) stays automatic.
{
  const handWritten = '| A | B |\n|' + '-'.repeat(50) + '|' + '-'.repeat(31) + '|\n| 1 | 2 |'
  assert.equal(tableHasWidths(tablesOf(handWritten)[0].raw), false)
  const ritemark = '| A | B |\n| ' + '-'.repeat(24) + ' | ' + '-'.repeat(56) + ' |\n| 1 | 2 |'
  assert.equal(tableHasWidths(tablesOf(ritemark)[0].raw), true)
}

// ---- The slide renderer draws the widths: the table at the slide's width, a column per share.
{
  const markdown = '# Tools\n\n| Tool | Files | Result |\n| ---------------- | :--------------------------------------- | -----------------------: |\n| Work | The folder | Saved |'
  const html = blockSlideHtml(markdown)
  assert.ok(html.includes('<table class="has-widths" style="width:100%">'), html)
  assert.ok(html.includes('<colgroup><col style="width:20%"><col style="width:50%"><col style="width:30%"></colgroup>'), html)
}

// ---- Alignment in a table lined up by eye keeps its line (the run's length), and a plain table gets GFM's marks.
{
  const doc = surfaces[0].open('| Item        | Price |\n|-------------|-------|\n| Coffee      | 2.50  |\n')
  const state = EditorState.create({ doc })
  const saved = surfaces[0].save(state.apply(alignColumn(state, tablePos(doc), 1, 'right')!).doc)
  assert.equal(saved.split('\n')[1], '|-------------|------:|', saved)
}

// ---- The drag's math.
{
  assert.deepEqual(resizePair([20, 50, 30], [5, 5, 5], 1, 33), [35, 35, 30], 'the left column snaps to 5 %, the pair keeps its sum')
  assert.deepEqual(resizePair([20, 50, 30], [5, 5, 5], 2, 61), [20, 60, 20])
  assert.deepEqual(resizePair([20, 50, 30], [15, 40, 5], 1, 2), [15, 55, 30], 'never under the longest word on the left')
  assert.deepEqual(resizePair([20, 50, 30], [15, 40, 5], 1, 60), [30, 40, 30], 'never under the longest word on the right')
  // A drag never lands on all-equal shares (the file says equal as automatic): one step to the side it came from
  // (review of #772, round 2).
  assert.deepEqual(resizePair([20, 80], [5, 5], 1, 50), [45, 55], 'dragged up to half: one step short')
  assert.deepEqual(resizePair([70, 30], [5, 5], 1, 50), [55, 45], 'dragged down to half: one step short')
  assert.deepEqual(heldWidths([50, 50]), null, 'equal shares are automatic')
  assert.deepEqual(heldWidths([45, 55]), [45, 55])
  assert.equal(heldWidths(Array.from({ length: 21 }, () => 1)), null, 'more than 20 columns: automatic')
  assert.equal(minPercent(90, 600), 15, 'a 90 px word in a 600 px table: 15 %')
  assert.equal(minPercent(1, 600), 5, 'never under one step')
  assert.deepEqual(snapPercents([1, 1, 1]), [35, 35, 30], 'equal thirds in 5 % steps add to 100')
  assert.deepEqual(snapPercents([97, 1, 1, 1]), [85, 5, 5, 5], 'each column at least one step')
  // The pointer on a slide drawn at a third of its size: divided by the scale, the same share.
  const tableLeft = 100
  const tableWidth = 600
  for (const scale of [1, 0.6, 0.3]) {
    const clientX = 400 + (tableLeft + 0.47 * tableWidth) * scale
    const at = (clientX - 400) / scale
    assert.deepEqual(resizePair([20, 50, 30], [5, 5, 5], 1, ((at - tableLeft) / tableWidth) * 100), [45, 25, 30], `scale ${scale}`)
  }
}

// ---- The caret stays put: a width change moves no words (typing after it lands where the person typed).
{
  const doc = surfaces[0].open('| a | b |\n| --- | --- |\n| 1 | 2 |\n')
  let state = EditorState.create({ doc })
  const at = state.doc.content.size - 6
  state = state.apply(state.tr.setSelection(TextSelection.near(state.doc.resolve(at))))
  const before = state.selection.from
  state = state.apply(setColumnWidths(state, tablePos(doc), [30, 70])!)
  assert.equal(state.selection.from, before)
}

console.log('tableWidths: all checks passed')
