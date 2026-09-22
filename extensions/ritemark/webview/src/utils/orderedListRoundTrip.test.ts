/**
 * Sprint 120 (#280) — what a numbered line means once it is written to disk.
 *
 * The bound in `extensions/BoundedOrderedList.ts` decides what *typing* a
 * number does. This file pins the other half: what the Markdown file can hold,
 * so a later change cannot quietly make the editor promise something the format
 * will not keep. The pipeline is the editor's own — `marked` on load,
 * `createTurndownService()` on save.
 */
import { strict as assert } from 'node:assert'
import { DOMParser } from '@xmldom/xmldom'
import { Marked } from 'marked'
import { createTurndownService } from './turndownService'

/** The editor's load path (Editor.tsx `editorMarked`). */
const editorMarked = new Marked({ breaks: true, gfm: true })
/** The editor's save path. */
const turndown = createTurndownService()

const parse = (markdown: string): Element =>
  new DOMParser().parseFromString(`<div>${editorMarked.parse(markdown) as string}</div>`, 'text/html')
    .documentElement

const lists = (root: Element): Element[] => Array.from(root.getElementsByTagName('ol'))
const items = (list: Element): Element[] => Array.from(list.getElementsByTagName('li'))
const text = (element: Element): string => (element.textContent ?? '').replace(/\s+/g, ' ').trim()

{
  // --- prose that starts with a year stays prose through save and reopen
  const markdown = turndown.turndown('<p>2026. was the year we shipped.</p>')
  assert.ok(markdown.startsWith('2026\\.'), `the number is escaped on save, got ${JSON.stringify(markdown)}`)

  const reopened = parse(markdown)
  assert.equal(lists(reopened).length, 0, 'a year does not come back as a list')
  assert.equal(text(reopened), '2026. was the year we shipped.', 'the sentence is unchanged, escape included')
}

{
  // --- a deliberate list keeps its numbering through save and reopen
  const markdown = turndown.turndown('<ol start="5"><li><p>five</p></li><li><p>six</p></li></ol>')
  const [list, ...rest] = lists(parse(markdown))

  assert.equal(rest.length, 0, 'one list in, one list out')
  assert.equal(list.getAttribute('start'), '5', 'the start number survives')
  assert.deepEqual(items(list).map(text), ['five', 'six'], 'the items survive')
}

{
  // --- the bound is on typing only: a file may still start a list at any
  // number, and the editor must keep reading it. (Sprint 120 changes the input
  // rule, never the load path.)
  const [list] = lists(parse('2026. a\n2027. b\n'))
  assert.equal(list.getAttribute('start'), '2026', 'an authored list starting at 2026 still loads as a list')
  assert.deepEqual(items(list).map(text), ['a', 'b'])
}

{
  // --- Markdown cannot hold two adjacent ordered lists with different starts.
  // Whatever the editor shows while typing, this is what the file means: one
  // list, numbered from the first marker. It is why the editor joins adjacent
  // ordered lists instead of keeping them apart and diverging from the file.
  const authored = parse('5. a\n\n2026. b\n')
  assert.equal(lists(authored).length, 1, 'two markers, one list')
  assert.equal(lists(authored)[0].getAttribute('start'), '5', 'the first marker wins; 2026 is not kept')
  assert.deepEqual(items(lists(authored)[0]).map(text), ['a', 'b'])

  // …and it is not an artefact of the parser: saving two separate lists
  // produces a file that reads back as one.
  const saved = turndown.turndown('<ol start="5"><li><p>a</p></li></ol><ol start="2026"><li><p>b</p></li></ol>')
  const reopened = parse(saved)
  assert.equal(lists(reopened).length, 1, 'two lists saved, one list reopened')
  assert.equal(lists(reopened)[0].getAttribute('start'), '5')
  assert.deepEqual(items(lists(reopened)[0]).map(text), ['a', 'b'])
}

console.log('orderedListRoundTrip.test.ts: all tests passed')
