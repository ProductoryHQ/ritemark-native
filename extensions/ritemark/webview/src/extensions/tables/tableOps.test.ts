/**
 * Tables you can change (experience 48): every menu action, drag move, + bar and Tab-adds-row, in a Text document and on
 * a slide, through the editors' own load and save code:
 *  - writes a valid GFM table (read back by `marked`, the header and every row as wide as the table);
 *  - round-trips byte for byte (the saved file, opened and saved again, is the same bytes);
 *  - is one undo step (after typing, one Undo takes the change back and leaves the typing);
 *  - the header row never moves and is never deleted; sorting leaves it first; alignment is written as `:---`,
 *    `:---:` and `---:`, and the delimiter row keeps how it was written for the columns not touched;
 *  - a table the change didn't touch is unchanged, and so is a document opened and saved without a change;
 *  - a dragged handle's place on a scaled slide, divided by the scale, lands where it is drawn.
 * Run with `npx tsx webview/src/extensions/tables/tableOps.test.ts` (part of `test:editor-sync` and `test:decks`).
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Marked, type Tokens } from 'marked'
import type { Node as PMNode } from '@tiptap/pm/model'
import { EditorState, TextSelection, type Transaction } from '@tiptap/pm/state'
import { history, undo } from '@tiptap/pm/history'
import { CellSelection } from '@tiptap/pm/tables'
import { openDocument, saveDocument, installTestDocument } from '../../utils/markdownFidelity'
import { loadSlide, saveSlide } from '../../components/decks/blocks/slideEditorHarness'
import {
  TABLE_COMMAND,
  alignColumn,
  cellAtSelection,
  deleteColumn,
  deleteRow,
  deleteTable,
  insertColumn,
  insertRow,
  moveColumn,
  moveRow,
  nextCellOrNewRow,
  previousCell,
  setTint,
  sortByColumn,
  tableTintPlugin,
  tintDecorations,
  wholeTableChosen,
} from './tableOps'
import { dropTarget } from '../../components/tables/dropTarget'
import { blockSlideHtml } from '../../../../src/decks/blocks/slideRenderer'

installTestDocument()

const gfm = new Marked({ gfm: true })

/** The document's tables as `marked` reads them. */
function tables(markdown: string): Tokens.Table[] {
  return gfm.lexer(markdown).filter((token): token is Tokens.Table => token.type === 'table')
}

/** A valid GFM table: read as one, with every row as wide as its header. */
function assertGfm(markdown: string, label: string, count = 1): Tokens.Table[] {
  const found = tables(markdown)
  assert.equal(found.length, count, `${label}: ${count} table(s) read back\n${markdown}`)
  for (const table of found) {
    assert.ok(table.header.length > 0, `${label}: a header`)
    for (const row of table.rows) assert.equal(row.length, table.header.length, `${label}: every row as wide as the header`)
  }
  return found
}

const texts = (table: Tokens.Table) => [table.header.map(cell => cell.text), ...table.rows.map(row => row.map(cell => cell.text))]

/** The two editors, each with its own load and save. */
interface Surface {
  name: string
  open(markdown: string): PMNode
  save(doc: PMNode): string
}

const textDocument = (() => {
  let opened: ReturnType<typeof openDocument> | null = null
  return {
    name: 'Text document',
    open(markdown: string) {
      opened = openDocument(markdown)
      return opened.doc
    },
    save(doc: PMNode) {
      return saveDocument(opened!, doc)
    },
  } satisfies Surface
})()

const slide: Surface = { name: 'slide', open: loadSlide, save: saveSlide }

const SURFACES: Surface[] = [textDocument, slide]

function firstTablePos(doc: PMNode, nth = 0): number {
  let found = -1
  let seen = 0
  doc.descendants((node, pos) => {
    if (found >= 0) return false
    if (node.type.name === 'table') {
      if (seen === nth) found = pos
      seen++
      return false
    }
    return true
  })
  assert.ok(found >= 0, 'a table')
  return found
}

/** The caret at the end of a cell's words, by its text. */
function caretAfter(state: EditorState, text: string): EditorState {
  let at = -1
  state.doc.descendants((node, pos) => {
    if (at >= 0 || !node.isText) return
    const found = node.text!.indexOf(text)
    if (found >= 0) at = pos + found + text.length
  })
  assert.ok(at >= 0, text)
  return state.apply(state.tr.setSelection(TextSelection.create(state.doc, at)))
}

const DOC = [
  '# Tools',
  '',
  'Which tool for which job.',
  '',
  '| Tool | Files | Result |',
  '| --- | :-- | --: |',
  '| Work | The folder | Saved |',
  '| Chat | Uploaded | An answer |',
  '| Add-in | The document | A change |',
  '',
  'Between the tables.',
  '',
  '|a|b|',
  '|---|---|',
  '|1|2|',
  '',
].join('\n')

const SLIDE_MD = [
  '# Chat, add-in or Work',
  '',
  '| Tool | Files | Result |',
  '| --- | :-- | --: |',
  '| Work | The folder | Saved |',
  '| Chat | Uploaded | An answer |',
  '| Add-in | The document | A change |',
].join('\n')

interface Case {
  label: string
  make: (state: EditorState, tablePos: number) => Transaction | null
  /** The first table's cells after the change, as `marked` reads them. */
  cells: string[][]
  /** Its delimiter row after the change (the Text document's form). */
  delims?: string
}

const BEFORE = [
  ['Tool', 'Files', 'Result'],
  ['Work', 'The folder', 'Saved'],
  ['Chat', 'Uploaded', 'An answer'],
  ['Add-in', 'The document', 'A change'],
]

const CASES: Case[] = [
  {
    label: 'Insert left',
    make: (state, pos) => insertColumn(state, pos, 1, 0),
    cells: BEFORE.map(row => [row[0], '', row[1], row[2]]),
    delims: '| --- | --- | :-- | --: |',
  },
  {
    label: 'Insert right',
    make: (state, pos) => insertColumn(state, pos, 2, 0),
    cells: BEFORE.map(row => [row[0], row[1], '', row[2]]),
    delims: '| --- | :-- | --- | --: |',
  },
  {
    label: 'the right + bar (a column at the end)',
    make: (state, pos) => insertColumn(state, pos, 3, 0),
    cells: BEFORE.map(row => [...row, '']),
    delims: '| --- | :-- | --: | --- |',
  },
  {
    label: 'Move left',
    make: (state, pos) => moveColumn(state, pos, 1, 0),
    cells: BEFORE.map(row => [row[1], row[0], row[2]]),
    delims: '| :-- | --- | --: |',
  },
  {
    label: 'Move right',
    make: (state, pos) => moveColumn(state, pos, 0, 1),
    cells: BEFORE.map(row => [row[1], row[0], row[2]]),
    delims: '| :-- | --- | --: |',
  },
  {
    label: 'a column dragged from first to last',
    make: (state, pos) => moveColumn(state, pos, 0, 2),
    cells: BEFORE.map(row => [row[1], row[2], row[0]]),
    delims: '| :-- | --: | --- |',
  },
  {
    label: 'Align centre',
    make: (state, pos) => alignColumn(state, pos, 0, 'center'),
    cells: BEFORE,
    delims: '| :---: | :-- | --: |',
  },
  {
    label: 'Align right',
    make: (state, pos) => alignColumn(state, pos, 1, 'right'),
    cells: BEFORE,
    delims: '| --- | ---: | --: |',
  },
  {
    label: 'Align left',
    make: (state, pos) => alignColumn(state, pos, 2, 'left'),
    cells: BEFORE,
    delims: '| --- | :-- | :--- |',
  },
  {
    label: 'Sort A to Z',
    make: (state, pos) => sortByColumn(state, pos, 0, 'asc'),
    cells: [BEFORE[0], BEFORE[3], BEFORE[2], BEFORE[1]],
    delims: '| --- | :-- | --: |',
  },
  {
    label: 'Sort Z to A (⌥)',
    make: (state, pos) => sortByColumn(state, pos, 1, 'desc'),
    cells: [BEFORE[0], BEFORE[2], BEFORE[1], BEFORE[3]],
  },
  {
    label: 'Delete column',
    make: (state, pos) => deleteColumn(state, pos, 1),
    cells: BEFORE.map(row => [row[0], row[2]]),
    delims: '| --- | --: |',
  },
  {
    label: 'Insert above',
    make: (state, pos) => insertRow(state, pos, 2, 0),
    cells: [BEFORE[0], BEFORE[1], ['', '', ''], BEFORE[2], BEFORE[3]],
  },
  {
    label: 'Insert below',
    make: (state, pos) => insertRow(state, pos, 3, 0),
    cells: [BEFORE[0], BEFORE[1], BEFORE[2], ['', '', ''], BEFORE[3]],
  },
  {
    label: 'the bottom + bar (a row at the end)',
    make: (state, pos) => insertRow(state, pos, 4, 0),
    cells: [...BEFORE, ['', '', '']],
  },
  {
    label: 'Insert above the header row',
    make: (state, pos) => insertRow(state, pos, 0, 0),
    cells: [['', '', ''], ...BEFORE],
    delims: '| --- | :-- | --: |',
  },
  {
    label: 'Insert below the header row',
    make: (state, pos) => insertRow(state, pos, 1, 0),
    cells: [BEFORE[0], ['', '', ''], ...BEFORE.slice(1)],
  },
  {
    label: 'Move up',
    make: (state, pos) => moveRow(state, pos, 2, 1),
    cells: [BEFORE[0], BEFORE[2], BEFORE[1], BEFORE[3]],
  },
  {
    label: 'Move down',
    make: (state, pos) => moveRow(state, pos, 1, 2),
    cells: [BEFORE[0], BEFORE[2], BEFORE[1], BEFORE[3]],
  },
  {
    label: 'a row dragged from last to first',
    make: (state, pos) => moveRow(state, pos, 3, 1),
    cells: [BEFORE[0], BEFORE[3], BEFORE[1], BEFORE[2]],
  },
  {
    label: 'Delete row',
    make: (state, pos) => deleteRow(state, pos, 2),
    cells: [BEFORE[0], BEFORE[1], BEFORE[3]],
  },
  {
    label: 'Tab in the last cell (adds a row)',
    make: state => nextCellOrNewRow(caretAfter(state, 'A change')),
    cells: [...BEFORE, ['', '', '']],
  },
]

// ---- Every action, in a Text document and on a slide: valid GFM, byte for byte, one undo step.
for (const surface of SURFACES) {
  const source = surface === slide ? SLIDE_MD : DOC
  const baseline = surface.save(surface.open(source))
  assert.equal(baseline, source, `${surface.name}: opened and saved untouched, the same bytes`)
  const secondTable = surface === slide ? null : tables(source)[1].raw
  for (const testCase of CASES) {
    const label = `${surface.name}, ${testCase.label}`
    const doc = surface.open(source)
    let state = EditorState.create({ doc, plugins: [history()] })
    // Typing first, in the paragraph (or the title), so the undo shows the change is a step of its own.
    state = caretAfter(state, surface === slide ? 'Work' : 'job.')
    state = state.apply(state.tr.insertText('!'))
    const typed = state.doc
    const tablePos = firstTablePos(state.doc)
    const tr = testCase.make(state, tablePos)
    assert.ok(tr, `${label}: a change`)
    assert.equal(tr!.getMeta(TABLE_COMMAND), true, `${label}: marked as a table command (the slide's own undo step)`)
    state = state.apply(tr!)
    const saved = surface.save(state.doc)
    const [table] = assertGfm(saved, label, surface === slide ? 1 : 2)
    assert.deepEqual(texts(table), testCase.cells, `${label}: the cells\n${saved}`)
    if (testCase.delims && surface !== slide) assert.equal(saved.split('\n')[5], testCase.delims, `${label}: the delimiter row\n${saved}`)
    if (testCase.delims && surface === slide) assert.equal(saved.split('\n')[3], testCase.delims, `${label}: the delimiter row\n${saved}`)
    // Byte for byte: opened again and saved, the same.
    assert.equal(surface.save(surface.open(saved)), saved, `${label}: round-trips byte for byte`)
    // The other table is untouched.
    if (secondTable) assert.ok(saved.includes(secondTable.trimEnd()), `${label}: the untouched table is as it was\n${saved}`)
    // One undo step: one Undo takes the change back and leaves the typing.
    let undone = state
    assert.ok(undo(state, next => { undone = state.apply(next) }), `${label}: undoable`)
    assert.ok(undone.doc.eq(typed), `${label}: one Undo takes it back, and only it`)
    // The caret is in the table after it (an alignment leaves the selection as it was: its menu stays open).
    if (!testCase.label.startsWith('Align')) assert.ok(cellAtSelection(state), `${label}: the caret stays in the table`)
  }
}

// ---- Alignment written as GFM's markers on a compact table, and back to nothing changed when it already has it.
{
  const doc = textDocument.open(DOC)
  const state = EditorState.create({ doc })
  const pos = firstTablePos(doc, 1)
  const tr = alignColumn(state, pos, 1, 'center')!
  const saved = textDocument.save(state.apply(tr).doc)
  assert.ok(saved.includes('|a|b|\n|---|:---:|\n|1|2|'), saved)
  assert.equal(alignColumn(state.apply(tr), pos, 1, 'center'), null, 'already centred: nothing to do')
  const table = tables(saved)[1]
  assert.deepEqual(table.align, [null, 'center'])
}

// ---- A table with no delimiter row kept (no outer pipes): the save writes one from the cells' alignment.
{
  const source = 'a | b\n--|--:\n1 | 2\n'
  const doc = textDocument.open(source)
  const state = EditorState.create({ doc })
  const saved = textDocument.save(state.apply(alignColumn(state, firstTablePos(doc), 0, 'center')!).doc)
  assert.deepEqual(tables(saved)[0].align, ['center', 'right'], saved)
  assert.equal(textDocument.save(textDocument.open(saved)), saved, 'byte-stable')
}

// ---- The header row never moves and is never deleted; nothing is moved above it.
for (const surface of SURFACES) {
  const doc = surface.open(surface === slide ? SLIDE_MD : DOC)
  const state = EditorState.create({ doc })
  const pos = firstTablePos(doc)
  assert.equal(moveRow(state, pos, 0, 1), null, `${surface.name}: the header row doesn't move down`)
  assert.equal(moveRow(state, pos, 2, 0), null, `${surface.name}: no row moves above the header`)
  assert.equal(deleteRow(state, pos, 0), null, `${surface.name}: the header row isn't deleted`)
  // A drag of a row never lands above the header: its line stops under it.
  const rows = [0, 30, 60, 90].map(top => ({ left: 0, top, width: 300, height: 30 }))
  assert.deepEqual(dropTarget(rows, 'row', 2, -50), { to: 1, line: 30 }, 'the highest place a row lands is under the header')
}

// ---- Sorting reorders the body rows only: the header stays first; empty cells go last; ties keep their order.
{
  const source = '| Name | n |\n| --- | --- |\n| b | 10 |\n|  | 3 |\n| a | 2 |\n| B | 1 |\n'
  const doc = textDocument.open(source)
  const state = EditorState.create({ doc })
  const pos = firstTablePos(doc)
  const asc = textDocument.save(state.apply(sortByColumn(state, pos, 0, 'asc')!).doc)
  assert.deepEqual(texts(tables(asc)[0]).map(row => row[0]), ['Name', 'a', 'b', 'B', ''], asc)
  const numbers = textDocument.save(state.apply(sortByColumn(state, pos, 1, 'asc')!).doc)
  assert.deepEqual(texts(tables(numbers)[0]).map(row => row[1]), ['n', '1', '2', '3', '10'], 'numbers in their order')
  const desc = textDocument.save(state.apply(sortByColumn(state, pos, 0, 'desc')!).doc)
  assert.deepEqual(texts(tables(desc)[0]).map(row => row[0]), ['Name', 'b', 'B', 'a', ''], desc)
  const sorted = EditorState.create({ doc: textDocument.open(asc) })
  assert.equal(sortByColumn(sorted, firstTablePos(sorted.doc), 0, 'asc'), null, 'already in order: nothing to do')
}

// ---- Delete table, and a column's delete on a one-column table, take the table; the words around stay.
for (const surface of SURFACES) {
  const source = surface === slide ? SLIDE_MD : DOC
  const doc = surface.open(source)
  const state = EditorState.create({ doc })
  const saved = surface.save(state.apply(deleteTable(state, firstTablePos(doc))!).doc)
  assert.equal(tables(saved).length, surface === slide ? 0 : 1, `${surface.name}: the table is gone\n${saved}`)
  assert.ok(saved.startsWith(surface === slide ? '# Chat, add-in or Work' : '# Tools'), saved)
  const one = surface.open('# T\n\n| a |\n| --- |\n| 1 |')
  const oneState = EditorState.create({ doc: one })
  assert.equal(tables(surface.save(oneState.apply(deleteColumn(oneState, firstTablePos(one), 0)!).doc)).length, 0, `${surface.name}: the last column takes the table`)
}

// ---- Tab: the next cell, the next row's first cell, and in the last cell a new row; Shift+Tab goes back.
{
  const doc = textDocument.open(DOC)
  let state = caretAfter(EditorState.create({ doc }), 'Files')
  state = state.apply(nextCellOrNewRow(state)!)
  assert.deepEqual([cellAtSelection(state)!.row, cellAtSelection(state)!.col], [0, 2])
  state = caretAfter(state, 'Result')
  state = state.apply(nextCellOrNewRow(state)!)
  assert.deepEqual([cellAtSelection(state)!.row, cellAtSelection(state)!.col], [1, 0], 'the next row')
  state = state.apply(previousCell(state)!)
  assert.deepEqual([cellAtSelection(state)!.row, cellAtSelection(state)!.col], [0, 2], 'Shift+Tab: back')
  const outside = caretAfter(EditorState.create({ doc }), 'job.')
  assert.equal(nextCellOrNewRow(outside), null, 'outside a table, Tab is the editor\'s')
  const added = nextCellOrNewRow(caretAfter(EditorState.create({ doc }), 'A change'))!
  const after = EditorState.create({ doc }).apply(added)
  assert.deepEqual([cellAtSelection(after)!.row, cellAtSelection(after)!.col], [4, 0], 'the caret in the new row')
}

// ---- A chosen column or row (its grip clicked or dragged) is tinted by a decoration, not a selection: the caret stays,
// and one Undo after a change made from the menu gives back the caret, never a tint (the app run: the row came back
// selected, with the formatting bar over it). The whole table chosen (every cell) opens the table's own menu.
{
  const doc = textDocument.open(DOC)
  let state = caretAfter(EditorState.create({ doc, plugins: [history(), tableTintPlugin()] }), 'Uploaded')
  const caret = state.selection.from
  const pos = firstTablePos(doc)
  state = state.apply(setTint(state, { tablePos: pos, kind: 'column', index: 1 }))
  assert.equal(state.selection.from, caret, 'the caret stays where it was')
  assert.equal(tintDecorations(state.doc, { tablePos: pos, kind: 'column', index: 1 }).find().length, 4, 'the column\'s four cells')
  assert.equal(tintDecorations(state.doc, { tablePos: pos, kind: 'row', index: 2 }).find().length, 3, 'the row\'s three cells')
  state = state.apply(setTint(state, null).setMeta('addToHistory', false))
  state = state.apply(moveRow(state, pos, 2, 1)!)
  let undone = state
  undo(state, next => { undone = state.apply(next) })
  assert.ok(!(undone.selection instanceof CellSelection), 'Undo gives back a caret, not a chosen row')
  assert.equal(undone.selection.from, caret)
  const first = pos + 2
  let last = -1
  doc.nodeAt(pos)!.descendants((node, offset) => { if (node.type.name === 'tableCell') last = pos + 1 + offset })
  const plain = EditorState.create({ doc })
  const whole = plain.apply(plain.tr.setSelection(CellSelection.create(doc, first, last)))
  assert.equal(wholeTableChosen(whole)?.pos, pos, 'every cell chosen: the table')
  assert.equal(wholeTableChosen(plain.apply(plain.tr.setSelection(CellSelection.create(doc, first, first)))), null, 'one cell: not the table')
}

// ---- Alignment shows in the Text editor as the file reads (a cell keeps it as data-md-align), and a new row or column
// takes its column's alignment.
{
  const doc = textDocument.open(DOC)
  const state = EditorState.create({ doc })
  const pos = firstTablePos(doc)
  const next = state.apply(insertRow(state, pos, 4, 0)!)
  const row = next.doc.nodeAt(pos)!.child(4)
  assert.deepEqual([0, 1, 2].map(index => row.child(index).attrs.mdAlign), [null, 'left', 'right'])
}

// ---- A drag on a slide drawn at a third of its size: the pointer's place, divided by the scale, lands where the line
// is drawn (the smallest stage); and a column dragged onto its own place moves nothing.
{
  const cols = [{ left: 0, top: 0, width: 100, height: 30 }, { left: 100, top: 0, width: 160, height: 30 }, { left: 260, top: 0, width: 120, height: 30 }]
  for (const scale of [1, 0.6, 0.3]) {
    const boxLeft = 400
    // The pointer over the boundary between the second and third columns, in the window's (scaled) pixels.
    const clientX = boxLeft + 262 * scale
    const at = (clientX - boxLeft) / scale
    assert.deepEqual(dropTarget(cols, 'column', 0, at), { to: 1, line: 260 }, `scale ${scale}: lands between the second and the third`)
  }
  assert.equal(dropTarget(cols, 'column', 1, 105).to, 1, 'onto its own place: no move')
  assert.deepEqual(dropTarget(cols, 'column', 0, 1000), { to: 2, line: 380 }, 'past the end: last')
}

// ---- The Text editor never breaks a word in a cell, and a column is never narrower than its longest word: auto
// layout, words kept whole (the Editor's own table CSS).
{
  const editorSource = readFileSync(fileURLToPath(new URL('../../components/Editor.tsx', import.meta.url)), 'utf8')
  const tableRule = /table\.tiptap-table-node \{[^}]*\}/.exec(editorSource)?.[0] ?? ''
  assert.match(tableRule, /table-layout: auto/, 'columns take their width from their words')
  assert.doesNotMatch(tableRule, /table-layout: fixed/)
  const cellRule = /td\.tiptap-table-cell,\s*\.wysiwyg-editor \.ProseMirror th\.tiptap-table-header \{[^}]*\}/.exec(editorSource)?.[0] ?? ''
  assert.match(cellRule, /overflow-wrap: normal/)
  assert.match(cellRule, /word-break: normal/)
}

// ---- A slide's column alignment is drawn (the Experience lead on #772): the renderer writes it on every cell, and
// slide.css draws it, there and on the stage (the editor's `data-md-align`).
{
  const html = blockSlideHtml('# T\n\n| a | b | c |\n| :-- | :-: | --: |\n| 1 | 2 | 3 |')
  assert.ok(html.includes('<th align="center">b</th>') && html.includes('<td align="right">3</td>'), html)
  const css = readFileSync(fileURLToPath(new URL('../../components/decks/slide/slide.css', import.meta.url)), 'utf8')
  assert.match(css, /:is\(th, td\):is\(\[align="center"\], \[data-md-align="center"\]\) \{ text-align: center; \}/)
  assert.match(css, /:is\(th, td\):is\(\[align="right"\], \[data-md-align="right"\]\) \{ text-align: right; \}/)
}

console.log('tableOps: all checks passed')
