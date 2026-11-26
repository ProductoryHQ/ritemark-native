/**
 * Sprint 167 PR 3 (decks README item A, `block-details.html`; #837): Slide settings' Content row, Top · Middle · Bottom,
 * as tiles like Picture's, after it. It shows the slide's own default chosen when its header says nothing (a title or
 * section slide Bottom, a picture alone Middle, the rest Top); choosing another writes `valign:`, and choosing the
 * default again takes the line out, so the file is as it was.
 *
 * Run: npx tsx webview/src/components/decks/slideContentPlace.test.ts
 */
import assert from 'node:assert/strict'
import { register } from 'node:module'

// SlideSettings imports style sheets through its controls, which Node cannot load: for this run, a sheet is an empty module.
register(`data:text/javascript,${encodeURIComponent(
  "export async function load(url, context, next) { return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context) }",
)}`)
Object.assign(globalThis, { acquireVsCodeApi: () => ({ postMessage: () => {}, getState: () => undefined, setState: () => {} }) })
const React = await import('react')
;(globalThis as typeof globalThis & { React: typeof React }).React = React
const { createElement } = React
const { renderToStaticMarkup } = await import('react-dom/server')
const { parse } = await import('node-html-parser')
const { SlideSettings, contentPlaceChange } = await import('./SlideSettings')
const { slideDataOf, writeSlideData } = await import('../../../../src/decks/deckFormat')

const noop = () => {}
const settings = (kind: string, data: Record<string, unknown>) => parse(renderToStaticMarkup(createElement(SlideSettings, {
  number: 3, kind, data, onKind: noop, onChange: noop, onClose: noop,
})))
const contentRow = (root: ReturnType<typeof settings>) => root.querySelector('[aria-label="Where the content sits"]')
const chosen = (root: ReturnType<typeof settings>) => contentRow(root)?.querySelectorAll('input').find(input => input.hasAttribute('checked'))?.getAttribute('value')

const CONTENT = '# Three berths, one plan\n\nEach crew owns one berth for the season.\n\n- North\n- East\n- South'
const TITLE = '# Agents at work, day 2\n\nHarbour Logistics · 12 November'

// ---- The row: after Picture, three tiles in their order, each a picture over its one word.
{
  const root = settings('', { markdown: CONTENT })
  const heads = root.querySelectorAll('.deck-settings-k').map(head => head.text)
  assert.deepEqual(heads, ['Picture', 'Content'], 'Content comes after Picture')
  const row = contentRow(root)!
  assert.ok(row.classList.contains('deck-settings-pics'), "Picture's tiles")
  assert.ok(row.classList.contains('deck-settings-places'))
  assert.equal(row.getAttribute('role'), 'radiogroup')
  assert.deepEqual(row.querySelectorAll('input').map(input => input.getAttribute('value')), ['top', 'middle', 'bottom'])
  assert.deepEqual(row.querySelectorAll('label').map(label => label.text.trim()), ['Top', 'Middle', 'Bottom'])
  assert.equal(row.querySelectorAll('.deck-pic-pic').length, 3, 'each tile has its picture')
  // A slide drawn by an old layout this build doesn't draw as blocks has no Content row (its layout places its words).
  assert.equal(contentRow(settings('mystery', {})), null)
}

// ---- What it shows: the slide's own default with no line, the line's place when written.
{
  assert.equal(chosen(settings('', { markdown: CONTENT })), 'top', 'a slide with words: Top')
  assert.equal(chosen(settings('', { markdown: CONTENT, valign: 'middle' })), 'middle')
  assert.equal(chosen(settings('', { markdown: CONTENT, valign: 'bottom' })), 'bottom')
  assert.equal(chosen(settings('', { markdown: TITLE })), 'bottom', 'a title slide reads as Bottom')
  assert.equal(chosen(settings('', { markdown: '2\n\n# The afternoon', section: true })), 'bottom', 'a section slide too')
  assert.equal(chosen(settings('', { markdown: TITLE, valign: 'top' })), 'top', 'and can be changed')
  assert.equal(chosen(settings('', { markdown: '![Dock](images/dock.jpg)' })), 'middle', 'a picture alone is drawn in the middle')
  assert.equal(chosen(settings('', { markdown: CONTENT, valign: 'sideways' })), 'top', 'a word that names no place: the default')
}

// ---- What a choice writes: nothing for the default, the place otherwise; Bottom again on a title slide takes it out.
{
  assert.deepEqual(contentPlaceChange({ markdown: CONTENT }, 'top'), { valign: undefined })
  assert.deepEqual(contentPlaceChange({ markdown: '# The dock\n\n![Dock](images/dock.jpg)' }, 'top'), { valign: 'top' })
  assert.deepEqual(contentPlaceChange({ markdown: CONTENT }, 'middle'), { valign: 'middle' })
  assert.deepEqual(contentPlaceChange({ markdown: CONTENT }, 'bottom'), { valign: 'bottom' })
  assert.deepEqual(contentPlaceChange({ markdown: TITLE }, 'bottom'), { valign: undefined }, "a title slide's Bottom is its default")
  assert.deepEqual(contentPlaceChange({ markdown: TITLE }, 'top'), { valign: 'top' })
  assert.deepEqual(contentPlaceChange({ markdown: TITLE }, 'middle'), { valign: 'middle' })
  // Through the file: Top on a title slide, then Bottom again, gives the slide back byte for byte.
  const body = `---\nid: t1\n---\n${TITLE}`
  const data = slideDataOf('', body)
  const top = writeSlideData('', body, { ...data, ...contentPlaceChange(data, 'top') })
  assert.equal(top, `---\nid: t1\nvalign: top\n---\n${TITLE}`)
  const back = slideDataOf('', top)
  assert.equal(writeSlideData('', top, { ...back, ...contentPlaceChange(back, 'bottom') }), body)
  // A slide whose words picked the default write nothing at all.
  const plain = `---\nid: c1\n---\n${CONTENT}`
  const plainData = slideDataOf('', plain)
  assert.equal(writeSlideData('', plain, { ...plainData, ...contentPlaceChange(plainData, 'top') }), plain)
}

console.log('slide content place (Settings): passed')
