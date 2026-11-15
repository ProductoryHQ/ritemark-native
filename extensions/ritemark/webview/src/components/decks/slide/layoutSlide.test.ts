/**
 * Sprint 157: the slide layout and the edits typing makes. Run with `npx tsx webview/src/components/decks/slide/layoutSlide.test.ts`.
 */
import { strict as assert } from 'node:assert'
import { SLIDE_KINDS, type SlideData } from '../../../../../src/decks/deckFormat'
import { BUILT_IN_THEME, parseTheme } from '../../../../../src/decks/deckTheme'
import { BOTTOM, fitSize, layoutSlide, linesOf, textBoxes, type GroupBox, type SlideBox } from './layoutSlide'
import { addColumn, addRow, insertItemAfter, isEmptyItem, nextCell, removeItem, setIcon, setPath } from './slideEdits'
import { contrast, themeVars } from '../theme/themeVars'
import { slideIcon } from './iconSet'

const long = 'A rather long title that keeps going well past what one line can hold on a slide, and then some more'
const items = (count: number, text = 'One line of text under it') =>
  Array.from({ length: count }, (_, index) => ({ heading: `Heading number ${index + 1} with words`, text, icon: 'list-checks' }))

/** Every box with a known top and height ends above BOTTOM. */
function assertFits(boxes: SlideBox[], label: string) {
  for (const box of boxes) {
    if (!('style' in box) || !box.style) continue
    const { top, height } = box.style
    if (typeof top === 'number' && typeof height === 'number') assert.ok(top + height <= BOTTOM + 0.5, `${label}: ${box.key} ends at ${top + height}`)
    if (typeof top === 'number') assert.ok(top < BOTTOM, `${label}: ${box.key} starts below the bottom`)
  }
}

// The estimates.
assert.equal(linesOf('', 20, 100), 1)
assert.equal(linesOf('a\nb', 20, 100), 2)
assert.equal(fitSize('short', [60, 52, 44], 832, 2, 0.6), 60)
assert.equal(fitSize(long + long, [60, 52, 44], 832, 2, 0.6), 44)
assert.equal(fitSize('short', [60, 52, 44], 832, 2, 0.6, 1), 52, 'a measuring step asks for one size smaller')

// Every kind, with long words and with none, at every picture place, lays out above the bottom.
for (const kind of SLIDE_KINDS) {
  for (const picture of ['none', 'left', 'right', 'behind']) {
    for (const data of [
      { title: long, subtitle: long, number: '12', items: items(8, long), rows: [['A', 'B', 'C'], ...Array.from({ length: 9 }, () => [long, 'x', 'y'])], picture } as SlideData,
      { picture } as SlideData,
    ]) {
      for (const look of ['boxes', 'steps', 'arrows', 'line']) {
        const layout = layoutSlide(kind, { ...data, look }, { editing: true })
        assert.ok(layout.known)
        assertFits(layout.boxes, `${kind}/${picture}/${look}`)
      }
    }
  }
}

// The kinds keep their words where the prototype puts them.
{
  const title = layoutSlide('title', { title: 'AI assistants', subtitle: 'Harbour' })
  assert.deepEqual(textBoxes(title).map(box => box.path), ['title', 'subtitle'])
  const boxes = layoutSlide('boxes', { title: 'Four parts', items: items(4) })
  assert.deepEqual(textBoxes(boxes).map(box => box.path), ['title', 'items.0.heading', 'items.0.text', 'items.1.heading', 'items.1.text', 'items.2.heading', 'items.2.text', 'items.3.heading', 'items.3.text'])
  // Five boxes go into a grid of two rows; beside a picture, into two columns.
  const grid = layoutSlide('boxes', { title: 'Five', items: items(5) }).boxes.filter(box => box.key.startsWith('box.'))
  assert.equal(new Set(grid.map(box => (box as GroupBox).style.top)).size, 2)
  // Columns draw the first two items, their lines kept.
  const columns = layoutSlide('columns', { title: 'A or B', items: [{ heading: 'A', text: 'one\ntwo' }, { heading: 'B' }, { heading: 'C' }] })
  assert.deepEqual(textBoxes(columns).map(box => box.path), ['title', 'items.0.heading', 'items.0.text', 'items.1.heading', 'items.1.text'])
  assert.ok(textBoxes(columns).find(box => box.path === 'items.0.text')?.multiline)
  // An unknown kind draws its title alone.
  const unknown = layoutSlide('gamma', { title: 'From Gamma' })
  assert.equal(unknown.known, false)
  assert.deepEqual(textBoxes(unknown).map(box => box.path), ['title'])
  // On the stage an item without an icon shows the place for one; a thumbnail doesn't.
  const noIcon = { title: 'T', items: [{ heading: 'A' }] }
  assert.ok(JSON.stringify(layoutSlide('boxes', noIcon, { editing: true })).includes('noic'))
  assert.ok(!JSON.stringify(layoutSlide('boxes', noIcon)).includes('noic'))
}

// Typing on the slide.
{
  const data: SlideData = { title: 'T', items: [{ heading: 'A', text: 'a' }, { heading: 'B' }] }
  assert.deepEqual(setPath(data, 'title', 'New').title, 'New')
  assert.equal(setPath(data, 'title', '').title, undefined)
  assert.deepEqual(setPath(data, 'items.1.text', 'b').items, [{ heading: 'A', text: 'a' }, { heading: 'B', text: 'b' }])
  assert.deepEqual(setPath(data, 'items.0.text', '').items, [{ heading: 'A' }, { heading: 'B' }])
  assert.deepEqual(insertItemAfter(data, 0).items, [{ heading: 'A', text: 'a' }, { heading: '' }, { heading: 'B' }])
  assert.deepEqual(removeItem(data, 0).items, [{ heading: 'B' }])
  assert.ok(isEmptyItem(insertItemAfter(data, 0), 1))
  assert.ok(!isEmptyItem(data, 1))
  assert.deepEqual(setIcon(data, 1, 'target').items![1], { heading: 'B', icon: 'target' })
  assert.deepEqual(setIcon(setIcon(data, 1, 'target'), 1, null).items![1], { heading: 'B' })
  assert.equal(data.items!.length, 2, 'the edits never change the data they are given')
}

// Tables: cells, Add a row, Add a column, and Tab and Enter moving on.
{
  const table: SlideData = { title: 'T', rows: [['Data', 'Chat'], ['Public', 'Yes']] }
  assert.deepEqual(setPath(table, 'rows.1.1', 'No').rows, [['Data', 'Chat'], ['Public', 'No']])
  assert.deepEqual(setPath({ title: 'New' }, 'rows.0.0', 'H').rows, [['H', ''], ['', '']], 'a new table starts with its empty cells')
  assert.deepEqual(addRow(table).rows, [['Data', 'Chat'], ['Public', 'Yes'], ['', '']])
  assert.deepEqual(addColumn(table).rows, [['Data', 'Chat', ''], ['Public', 'Yes', '']])
  assert.equal(nextCell(table, 'rows.0.0', 'tab')?.path, 'rows.0.1')
  assert.equal(nextCell(table, 'rows.0.1', 'tab')?.path, 'rows.1.0')
  assert.equal(nextCell(table, 'rows.1.0', 'shift-tab')?.path, 'rows.0.1')
  assert.equal(nextCell(table, 'rows.0.0', 'shift-tab'), null)
  const past = nextCell(table, 'rows.1.1', 'tab')!
  assert.equal(past.path, 'rows.2.0')
  assert.equal(past.data.rows!.length, 3, 'Tab past the last cell adds a row')
  assert.equal(nextCell(table, 'rows.0.1', 'enter')?.path, 'rows.1.1')
  assert.equal(nextCell(table, 'rows.1.1', 'enter')?.data.rows!.length, 3, 'Enter on the last row adds one')
}

// The theme: Evening built in, read back the same; a theme file's values, and its mistakes, as Evening's.
{
  assert.equal(BUILT_IN_THEME.name, 'Evening')
  assert.equal(BUILT_IN_THEME.bg, '#1C1F4A')
  assert.equal(BUILT_IN_THEME.borderless?.hd, '#1C1F4A')
  const paper = parseTheme('---\nname: Paper\nbackground: "#FFFFFF"\nheadings: "#14213D"\ntext: nonsense\ncorners: square\nboxes: outline\nsoft-light: false\n---\n')
  assert.equal(paper.name, 'Paper')
  assert.equal(paper.bg, '#FFFFFF')
  assert.equal(paper.text, '#E4E6F7', 'a malformed colour is the fallback')
  assert.equal(paper.round, 'square')
  assert.equal(paper.glow, false)
  assert.equal(paper.card, undefined)
  // Both looks keep text and headings readable on their ground (4.5 to 1).
  for (const theme of [BUILT_IN_THEME, paper]) {
    const card = themeVars(theme, false)
    const light = themeVars(theme, true)
    assert.ok(contrast(theme.head, theme.bg) >= 4.5, `${theme.name} card headings`)
    assert.ok(contrast(light.hd, '#FFFFFF') >= 4.5, `${theme.name} borderless headings`)
    assert.ok(contrast(light.tx, '#FFFFFF') >= 4.5, `${theme.name} borderless text`)
    assert.ok(card.bg.length > 0 && light.bg === 'transparent')
  }
}

// Icons by their Ritemark names, and the names other tools write.
assert.equal(slideIcon('list-checks')?.phosphor, 'list-checks')
assert.equal(slideIcon('chat')?.name, 'message-square')
assert.equal(slideIcon('nope'), null)

// An item kind with no items offers the first one on the stage (review of PR 2), but draws none on a thumbnail.
for (const kind of ['points', 'boxes', 'exercise']) {
  assert.ok(textBoxes(layoutSlide(kind, { title: 'T' }, { editing: true })).some(box => box.path === 'items.0.heading'), kind)
  assert.ok(!textBoxes(layoutSlide(kind, { title: 'T' })).some(box => box.path === 'items.0.heading'), kind)
}
assert.deepEqual(textBoxes(layoutSlide('columns', { title: 'T' }, { editing: true })).map(box => box.path), ['title', 'items.0.heading', 'items.0.text', 'items.1.heading', 'items.1.text'])

console.log('layoutSlide: passed')
