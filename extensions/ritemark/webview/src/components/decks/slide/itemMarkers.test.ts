/**
 * Sprint 159 (Jarmo, 16 November: "paranda topeltnumbrid kohe"): an item never shows its number twice. A layout that
 * draws its own number or dot for each item leaves out a list marker the item's words were written with ("1. Sisend"
 * shows as "1." drawn + "Sisend"); the file keeps its words. Run with
 * `npx tsx webview/src/components/decks/slide/itemMarkers.test.ts`.
 */
import { strict as assert } from 'node:assert'
import type { SlideData } from '../../../../../src/decks/deckFormat'
import { layoutSlide, textBoxes, withoutListMarker } from './layoutSlide'
import { slideMarkup } from './slideMarkup'
import { convertKind } from './convertKind'
import { BUILT_IN_THEME } from '../../../../../src/decks/deckTheme'

const headings = (kind: string, data: SlideData, editing = false) =>
  textBoxes(layoutSlide(kind, data, { editing })).filter(box => /^items\.\d+\.heading$/.test(box.path)).map(box => box.text)

const numbered: SlideData = { title: 'Töövoog', items: [{ heading: '1. Sisend' }, { heading: '2) Täpsusta', text: '1. a line under it' }, { heading: '3.  Kontrolli' }] }

// The marker leaves the drawn words, on the stage (editing) and off it (wall, strip, presenter).
for (const editing of [false, true]) {
  assert.deepEqual(headings('points', numbered, editing), ['Sisend', 'Täpsusta', 'Kontrolli'], `points, editing ${editing}`)
  assert.deepEqual(headings('exercise', numbered, editing), ['Sisend', 'Täpsusta', 'Kontrolli'], `exercise, editing ${editing}`)
  assert.deepEqual(headings('boxes', { ...numbered, look: 'steps' }, editing), ['Sisend', 'Täpsusta', 'Kontrolli'], `steps, editing ${editing}`)
}
// The steps look as a grid (more than four) draws its numbers too.
assert.deepEqual(headings('boxes', { look: 'steps', items: Array.from({ length: 6 }, (_, i) => ({ heading: `${i + 1}. Step` })) }), Array(6).fill('Step'))
// A bulleted list turned into points: its bullets go too, on a numbered kind and on the line's dots.
assert.deepEqual(headings('points', { items: [{ heading: '- Sisend' }, { heading: '* Täpsusta' }, { heading: '• Kontrolli' }] }), ['Sisend', 'Täpsusta', 'Kontrolli'])
assert.deepEqual(headings('boxes', { look: 'line', items: [{ heading: '- One' }, { heading: '1. Two' }] }), ['One', 'Two'])
// The line under a point is not numbered: its words stay as written.
assert.ok(textBoxes(layoutSlide('points', numbered)).some(box => box.path === 'items.1.text' && box.text === '1. a line under it'))

// A number that is part of the words stays: only a leading list marker followed by a space is dropped.
assert.deepEqual(headings('points', { items: [{ heading: '2026 plan' }, { heading: '3 hours' }, { heading: '1.5 litres' }, { heading: '1.Sisend' }, { heading: '-5 degrees' }, { heading: '1.' }, { heading: '12. ' }] }),
  ['2026 plan', '3 hours', '1.5 litres', '1.Sisend', '-5 degrees', '1.', '12. '])
assert.equal(withoutListMarker('10. Kümnes'), 'Kümnes')
assert.equal(withoutListMarker('1234567890. Too long to be a list number'), '1234567890. Too long to be a list number')
assert.equal(withoutListMarker(''), '')

// A layout that draws no marker keeps the words as written.
assert.deepEqual(headings('boxes', numbered), ['1. Sisend', '2) Täpsusta', '3.  Kontrolli'], 'boxes draw icons, not numbers')
assert.deepEqual(headings('columns', numbered).slice(0, 2), ['1. Sisend', '2) Täpsusta'], 'columns draw headings, not numbers')

// The learner page and the thumbnails draw from the same layout: one number per item.
const html = slideMarkup('points', numbered, { theme: BUILT_IN_THEME, borderless: false })
assert.ok(!html.includes('1. Sisend') && html.includes('>Sisend<'), 'the page draws "Sisend" once, after the list\'s own number')

// Laying a slide out writes nothing: the slide's words keep their marker.
assert.equal(numbered.items?.[0].heading, '1. Sisend')

// A slide turned into an item kind from its table makes clean items (a write: the new items come out clean).
const fromTable = convertKind({ rows: [['Step', 'What'], ['1. Sisend', 'Read it'], ['2. Täpsusta', '']] }, 'points')
assert.deepEqual(fromTable.items?.map(item => item.heading), ['Sisend', 'Täpsusta'])
// Into a kind that draws no marker, the words stay as they were.
assert.deepEqual(convertKind({ rows: [['Step'], ['1. Sisend']] }, 'columns').items?.map(item => item.heading), ['1. Sisend'])
assert.deepEqual(convertKind({ subtitle: '2026 plan' }, 'points').items?.map(item => item.heading), ['2026 plan'])

console.log('itemMarkers: passed')
