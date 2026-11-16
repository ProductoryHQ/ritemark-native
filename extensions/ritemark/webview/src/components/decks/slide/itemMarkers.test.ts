/**
 * Sprint 159 (Jarmo, 16 November: "paranda topeltnumbrid kohe"): an item never shows its number twice. A layout that
 * draws its own number or dot for each item leaves out the list marker an item's words were written with ("1. Sisend"
 * shows as the drawn "1." and "Sisend"); the file keeps its words. Run with
 * `npx tsx webview/src/components/decks/slide/itemMarkers.test.ts`.
 */
import { strict as assert } from 'node:assert'
import type { SlideData } from '../../../../../src/decks/deckFormat'
import { BUILT_IN_THEME } from '../../../../../src/decks/deckTheme'
import { editedItemWords, layoutSlide, listMarkerOf, pastedItemWords, textBoxes, withoutListMarker, type TextBox } from './layoutSlide'
import { slideMarkup } from './slideMarkup'
import { convertKind } from './convertKind'

const headingBoxes = (kind: string, data: SlideData, editing = false) =>
  textBoxes(layoutSlide(kind, data, { editing })).filter(box => /^items\.\d+\.heading$/.test(box.path))
const headings = (kind: string, data: SlideData, editing = false) => headingBoxes(kind, data, editing).map(box => box.text)

const numbered: SlideData = { title: 'Töövoog', items: [{ heading: '1. Sisend' }, { heading: '2) Täpsusta', text: '1. a line under it' }, { heading: '3.  Kontrolli' }] }

// The marker leaves the drawn words, on the stage (editing) and off it (wall, strip, presenter).
for (const editing of [false, true]) {
  assert.deepEqual(headings('points', numbered, editing), ['Sisend', 'Täpsusta', 'Kontrolli'], `points, editing ${editing}`)
  assert.deepEqual(headings('exercise', numbered, editing), ['Sisend', 'Täpsusta', 'Kontrolli'], `exercise, editing ${editing}`)
  assert.deepEqual(headings('boxes', { ...numbered, look: 'steps' }, editing), ['Sisend', 'Täpsusta', 'Kontrolli'], `steps, editing ${editing}`)
}
// The steps look as a grid (more than four) draws its numbers too.
assert.deepEqual(headings('boxes', { look: 'steps', items: Array.from({ length: 6 }, (_, i) => ({ heading: `${i + 1}. Step` })) }), Array(6).fill('Step'))
// A bulleted list turned into points: its bullets go too, on a numbered kind and on the line's dots; a non-breaking
// space after the marker (as Word and Docs paste it) and an en dash as the bullet count.
assert.deepEqual(headings('points', { items: [{ heading: '- Sisend' }, { heading: '* Täpsusta' }, { heading: '• Kontrolli' }, { heading: '– Viimane' }, { heading: '5. Lõpp' }] }),
  ['Sisend', 'Täpsusta', 'Kontrolli', 'Viimane', 'Lõpp'])
assert.deepEqual(headings('boxes', { look: 'line', items: [{ heading: '- One' }, { heading: '2. Two' }] }), ['One', '2. Two'], 'the line draws dots, not numbers')
// The line under a point is not numbered: its words stay as written.
assert.ok(textBoxes(layoutSlide('points', numbered)).some(box => box.path === 'items.1.text' && box.text === '1. a line under it'))

// A number that is part of the words stays: only the list marker the layout draws itself is dropped. Estonian writes
// ordinals and dates with a dot ("15. november", "2026. aasta"): a number other than the item's own is words.
assert.deepEqual(headings('points', { items: [{ heading: '2026 plan' }, { heading: '3 hours' }, { heading: '1.5 litres' }, { heading: '4.Sisend' }, { heading: '-5 degrees' }, { heading: '6.' }, { heading: '7. ' }] }),
  ['2026 plan', '3 hours', '1.5 litres', '4.Sisend', '-5 degrees', '6.', '7. '])
assert.deepEqual(headings('points', { items: [{ heading: '15. november kohtumine' }, { heading: '2026. aasta plaan' }, { heading: '1. etapp' }] }),
  ['15. november kohtumine', '2026. aasta plaan', '1. etapp'])
assert.equal(withoutListMarker('10. Kümnes', 10, 'numbers'), 'Kümnes')
assert.equal(withoutListMarker('10. Kümnes', 1, 'numbers'), '10. Kümnes')
assert.equal(withoutListMarker('1. Sisend', 1, 'dots'), '1. Sisend')
assert.equal(withoutListMarker('1. Sisend', 1, null), '1. Sisend')
assert.equal(listMarkerOf('1234567890. Too long', 1234567890, 'numbers'), '')
assert.equal(withoutListMarker('', 1, 'numbers'), '')

// A layout that draws no marker keeps the words as written.
assert.deepEqual(headings('boxes', numbered), ['1. Sisend', '2) Täpsusta', '3.  Kontrolli'], 'boxes draw icons, not numbers')
assert.deepEqual(headings('boxes', { ...numbered, look: 'arrows' }), ['1. Sisend', '2) Täpsusta', '3.  Kontrolli'], 'arrows draw no numbers')
assert.deepEqual(headings('columns', numbered).slice(0, 2), ['1. Sisend', '2) Täpsusta'], 'columns draw headings, not numbers')

// The fit is measured on the words as drawn: a marker alone never steps the list down a size.
const longish = 'Words that just fill one line of a point, no more'  // 49 letters: one line at the largest size, two with "1. "
assert.equal(longish.length, 49)
const fit = (heading: (i: number) => string) => layoutSlide('points', { title: 'T', items: Array.from({ length: 6 }, (_, i) => ({ heading: heading(i) })) }).boxes.find(box => box.type === 'list')
const size = (list: ReturnType<typeof fit>) => list && list.type === 'list' ? { style: list.style, gap: list.gap, sub: list.subStyle } : null
assert.deepEqual(size(fit(i => `${i + 1}. ${longish}`)), size(fit(() => longish)), 'the same size with and without the markers')

// The learner page and the thumbnails draw from the same layout: one number per item.
const html = slideMarkup('points', numbered, { theme: BUILT_IN_THEME, borderless: false })
assert.ok(!html.includes('1. Sisend') && html.includes('>Sisend<'), 'the page draws "Sisend" once, after the list\'s own number')

// Laying a slide out writes nothing: the slide's words keep their marker.
assert.equal(numbered.items?.[0].heading, '1. Sisend')

// On the stage an edit changes only what the person changed: the hidden marker stays in the file.
const [first] = headingBoxes('points', numbered, true) as TextBox[]
assert.equal(first.marker, '1. ')
assert.equal(editedItemWords('Sisendx', first), '1. Sisendx')
assert.equal(editedItemWords('', first), '', 'emptied, the item is empty')
assert.equal(editedItemWords('1. Sisendx', first), '1. Sisendx', 'a marker the person typed is not doubled')
const plain = headingBoxes('points', { items: [{ heading: 'Sisend' }] }, true)[0]
assert.equal(plain.marker, undefined)
assert.equal(editedItemWords('Sisendx', plain), 'Sisendx')

// A paste at the start of such an item leaves its marker behind; after other words, or on a layout with no marks, it
// stays as it is.
assert.equal(pastedItemWords('1. Sisend', '', plain), 'Sisend')
assert.equal(pastedItemWords('- Sisend', '  ', plain), 'Sisend')
assert.equal(pastedItemWords('1. Sisend', 'Before ', plain), '1. Sisend')
assert.equal(pastedItemWords('15. november', '', plain), '15. november')
assert.equal(pastedItemWords('1. Sisend', '', headingBoxes('boxes', { items: [{ heading: '' }] }, true)[0]), '1. Sisend')

// A slide turned into an item kind from its table makes clean items (a write: the new items come out clean).
const fromTable = convertKind({ rows: [['Step', 'What'], ['1. Sisend', 'Read it'], ['2. Täpsusta', ''], ['15. november', '']] }, 'points')
assert.deepEqual(fromTable.items?.map(item => item.heading), ['Sisend', 'Täpsusta', '15. november'])
// Into a kind that draws no marker, the words stay as they were.
assert.deepEqual(convertKind({ rows: [['Step'], ['1. Sisend']] }, 'columns').items?.map(item => item.heading), ['1. Sisend'])
assert.deepEqual(convertKind({ subtitle: '2026 plan' }, 'points').items?.map(item => item.heading), ['2026 plan'])
// Items a slide already has are never rewritten by a change of layout.
assert.deepEqual(convertKind({ items: [{ heading: '1. Sisend' }] }, 'points').items?.map(item => item.heading), ['1. Sisend'])

console.log('itemMarkers: passed')
