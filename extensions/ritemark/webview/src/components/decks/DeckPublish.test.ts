/**
 * Sprint 159 PR 4: Publish on the deck's bar, each state as it draws, and the fit steps and the look it sends.
 *
 * Run: npx tsx webview/src/components/decks/DeckPublish.test.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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
const { DeckPublishControl, measuredSteps, publishRequest } = await import('./DeckPublish')

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

// The bar (the Experience lead, frame 2): Card | Borderless · Saved · Publish · Present. Publish is outlined with the
// globe, its chip takes its place once published; Present is the bar's one primary, last; every control is 30 px from
// the shared sizes (Button `bar`, SplitButton `size="bar"`).
{
  const publish = button(draw({ ready: true, kind: 'unpublished', changed: false }))!
  assert.ok(publish.classList.contains('border') && publish.classList.contains('bg-background'), 'Publish is outlined')
  assert.ok(parse(draw({ ready: true, kind: 'unpublished', changed: false })).querySelector('svg'), 'with the globe')
  for (const state of [{ kind: 'unpublished' }, { kind: 'publishing' }, { kind: 'published' }, { kind: 'unpublishing' }] as const) {
    const control = button(draw({ ready: true, kind: state.kind, changed: false }))!
    assert.ok(control.classList.contains('h-[30px]'), `${state.kind}: 30 px`)
  }
  const { PresentButton } = await import('./present/PresentButton')
  const present = parse(renderToStaticMarkup(createElement(PresentButton, { slideNumber: 1, startNumber: 1, onPresent: () => {} }))).querySelector('.rm-split')!
  assert.equal(present.getAttribute('data-tone'), 'primary', 'Present is the filled primary')
  assert.ok(present.querySelectorAll('button').every((part) => part.classList.contains('h-[30px]')), 'Present: 30 px')
  const view = readFileSync(new URL('./DeckView.tsx', import.meta.url), 'utf8')
  const at = (marker: string) => { const index = view.indexOf(marker); assert.ok(index >= 0, marker); return index }
  assert.ok(at('className="deck-look"') < at('deck-saved') && at('deck-saved') < at('<DeckPublish ') && at('<DeckPublish ') < at('<PresentButton '), "the bar's order")
  assert.ok(/<PresentButton [^\n]*\/>\s*<\/header>/.test(view), 'Present is last on the bar')
}

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

// What Publish sends carries the look the view shows at the press (Codex on #737): a Card | Borderless change may still
// be on its way to the document. The host reads exactly these fields.
{
  const { decodeDeckRequest } = await import('../../../../src/decks/deckProtocol')
  const text = '```slide title\ntitle: A\n```\n'
  const sent = (borderless: boolean) => decodeDeckRequest({ type: 'deck/publish', ...publishRequest({ text, borderless }, [0, 2]) })
  assert.deepEqual(sent(true), { type: 'deck/publish', text, look: 'borderless', steps: [0, 2] })
  assert.deepEqual(sent(false), { type: 'deck/publish', text, look: 'card', steps: [0, 2] })
}

console.log('DeckPublish: passed')
