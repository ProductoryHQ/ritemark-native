/**
 * Sprint 159 PR 4: Publish on the deck's bar, each state as it draws, and the fit steps it sends.
 *
 * Run: npx tsx webview/src/components/decks/DeckPublish.test.ts
 */
import assert from 'node:assert/strict'
import { register } from 'node:module'
import type { DeckPageState } from '../../../../src/decks/deckProtocol'

register(`data:text/javascript,${encodeURIComponent(
  "export async function load(url, context, next) { return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context) }",
)}`)
Object.assign(globalThis, {
  acquireVsCodeApi: () => ({ postMessage: () => {}, getState: () => undefined, setState: () => {} }),
})
const React = await import('react')
;(globalThis as typeof globalThis & { React: typeof React }).React = React
const { createElement } = React
const { renderToStaticMarkup } = await import('react-dom/server')
const { parse } = await import('node-html-parser')
const { DeckPublishControl, measuredSteps } = await import('./DeckPublish')

const draw = (state: DeckPageState | null) => renderToStaticMarkup(createElement(DeckPublishControl, { state, onPublish: () => {}, onAction: () => {} }))
const words = (html: string) => parse(html).text.trim()
const button = (html: string) => parse(html).querySelector('button')

// Hidden until Publish can be reached, as the browser bar's Publish is.
assert.equal(draw(null), '')
assert.equal(draw({ ready: false, kind: 'unpublished', changed: false }), '')
assert.equal(draw({ ready: false, kind: 'published', changed: true }), '')

// Each state's words, one line each.
assert.equal(words(draw({ ready: true, kind: 'unpublished', changed: false })), 'Publish')
assert.equal(words(draw({ ready: true, kind: 'published', changed: false })), 'Published')
assert.equal(words(draw({ ready: true, kind: 'published', changed: true })), 'Published · changed')
assert.equal(words(draw({ ready: true, kind: 'publishing', changed: false })), 'Publishing…')
assert.equal(words(draw({ ready: true, kind: 'unpublishing', changed: false })), 'Unpublishing…')
// Publishing… and Unpublishing… can't be pressed; Publish and the chip can, the chip opening its menu.
assert.ok(button(draw({ ready: true, kind: 'publishing', changed: false }))!.hasAttribute('disabled'))
assert.ok(!button(draw({ ready: true, kind: 'unpublished', changed: false }))!.hasAttribute('disabled'))
assert.equal(button(draw({ ready: true, kind: 'published', changed: false }))!.getAttribute('aria-haspopup'), 'menu')
// The chip is the accent's (decks.css), the Publish button the bar's own.
assert.ok(button(draw({ ready: true, kind: 'published', changed: false }))!.classList.contains('deck-publish-chip'))
assert.ok(button(draw({ ready: true, kind: 'unpublished', changed: false }))!.classList.contains('deck-publish'))

// The fit steps: each measured slide's `data-step`, by its place; 0 where there is none, never outside 0 to 3.
{
  const measured = parse(`<div class="deck-measure">
    <div data-measure="0"><div class="deck-slide" data-step="0"></div></div>
    <div data-measure="1"><div class="deck-slide" data-step="2"></div></div>
    <div data-measure="3"><div class="deck-slide" data-step="7"></div></div>
    <div data-measure="9"><div class="deck-slide" data-step="1"></div></div>
  </div>`)
  assert.deepEqual(measuredSteps(5, measured as unknown as ParentNode), [0, 2, 0, 3, 0])
  assert.deepEqual(measuredSteps(0, measured as unknown as ParentNode), [])
}

console.log('DeckPublish: passed')
