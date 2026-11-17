/**
 * A wide table that scrolls keeps sensible column widths (the Experience lead on #780, 17 November 2026):
 *  - each column keeps at least its widest word: a column of numbers or single words gets no floor, so the browser's
 *    own minimum (its widest word) is all it keeps, and no floor ever goes under it (a floor is only ever a minimum);
 *  - a text column keeps at least about 200 px, or its stored width when larger, never more than its longest note on
 *    one line;
 *  - the editor reads the floors from the table's own cells (the header doesn't count) and its stored widths, the same
 *    way the published page does (`pageHtml.test.ts`).
 * Run with `npx tsx webview/src/extensions/tables/tableColumns.test.ts` (part of `test:decks`).
 */
import { strict as assert } from 'node:assert'
import type { Node as PMNode } from '@tiptap/pm/model'
import { openDocument, installTestDocument } from '../../utils/markdownFidelity'
import { TEXT_COLUMN_MIN, columnFloors, floorCss, isProse } from '../../../../src/markdown/tableColumns'
import { columnWidths } from './tableOps'
import { bodyTexts, columnFloorsCss } from './TableHandles'

installTestDocument()

// ---- The rule, on cells' words.
const NOTE = 'Most replies needed one edit before sending'
const rows = [
  ['412', '38', 'Errors', NOTE],
  ['268', '1 200 €', 'Kontrollimisprotseduur', 'Fine'],
]

// Numbers stay narrow, and a column of single words keeps only its widest word: neither has a floor.
assert.equal(isProse('412'), false)
assert.equal(isProse('1 200 €'), false, 'a number written with a space is no note')
assert.equal(isProse('Kontrollimisprotseduur'), false, 'one long word is its own widest word')
assert.equal(isProse('two words'), true)
const floors = columnFloors(rows, 4, null)
assert.deepEqual(floors.slice(0, 3), [null, null, null], 'numbers and single words: no floor, only the widest word')

// A text column: about 200 px, capped at its longest note on one line.
assert.deepEqual(floors[3], { share: 0, chars: NOTE.length })
assert.equal(TEXT_COLUMN_MIN, 200)
assert.equal(floorCss(floors[3]!), `min(200px, calc(${NOTE.length}ch + 2em))`)

// A short note never asks for more than it needs on one line.
assert.equal(floorCss(columnFloors([['New York']], 1, null)[0]!), 'min(200px, calc(8ch + 2em))')

// The stored width (a share of the width the table has when it fits) wins when it is larger than 200 px.
const stored = columnFloors(rows, 4, [10, 10, 20, 60])
assert.deepEqual(stored[3], { share: 60, chars: NOTE.length })
assert.equal(floorCss(stored[3]!), `min(max(200px, 60cqw), calc(${NOTE.length}ch + 2em))`)
assert.equal(stored[0], null, 'a number column with a stored share still has no floor')

// White space in a cell counts once; an empty column has no floor; a missing cell is empty.
assert.deepEqual(columnFloors([['  two \n  words  ']], 2, null), [{ share: 0, chars: 9 }, null])

// ---- The editor: the node view's floors come from the table's body cells and its stored widths.
function firstTable(doc: PMNode): PMNode {
  let table: PMNode | null = null
  doc.descendants(node => {
    if (table) return false
    if (node.type.name === 'table') { table = node; return false }
    return true
  })
  assert.ok(table)
  return table
}

const markdown = (delimiter: string) => [
  '| Mail drafted | Notes from the pilot week, a long header |',
  delimiter,
  `| 412 | ${NOTE} |`,
  '| 268 | **Summaries** of long proposals |',
  '',
].join('\n')

{
  const table = firstTable(openDocument(markdown('| --- | --- |')).doc)
  assert.deepEqual(bodyTexts(table), [['412', NOTE], ['268', 'Summaries of long proposals']], 'the header is not read')
  assert.deepEqual(columnFloorsCss(table, columnWidths(table)), ['', `min(200px, calc(${NOTE.length}ch + 2em))`])
}
{
  // #772's form: 24 + 56 dashes, 30 % and 70 %.
  const table = firstTable(openDocument(markdown(`|${'-'.repeat(24)}|${'-'.repeat(56)}|`)).doc)
  assert.deepEqual(columnWidths(table), [30, 70])
  assert.deepEqual(columnFloorsCss(table, columnWidths(table)), ['', `min(max(200px, 70cqw), calc(${NOTE.length}ch + 2em))`])
}
{
  // A header-only table, or one of numbers: no floors.
  assert.deepEqual(columnFloorsCss(firstTable(openDocument('| A | B |\n| --- | --- |\n| 1 | 2 |\n').doc), null), ['', ''])
}

console.log('tableColumns: passed')
