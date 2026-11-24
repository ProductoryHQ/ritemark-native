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
const sentMessages: unknown[] = []
Object.assign(globalThis, {
  acquireVsCodeApi: () => ({ postMessage: (message: unknown) => sentMessages.push(message), getState: () => undefined, setState: () => {} }),
})
const React = await import('react')
;(globalThis as typeof globalThis & { React: typeof React }).React = React
const { createElement } = React
const { renderToStaticMarkup } = await import('react-dom/server')
const { parse } = await import('node-html-parser')
const { DeckPublishControl, measuredSteps, pdfRequest, publishRequest, savedNotice, publishedChip, publishedMenu, pauseWords, sendLiveAction } = await import('./DeckPublish')

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

// The bar (the Experience lead, frame 2): Saved · Publish · Present on the right (Card | Borderless moved into the gear's
// popup on 16 November, slideSettingsPopup.test.ts). Publish is outlined with the globe, its chip takes its place once
// published; Present is the bar's one primary, last; every control is 30 px from the shared sizes (Button `bar`,
// SplitButton `size="bar"`).
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
  assert.ok(at('className="flex-1"') < at('deck-saved') && at('deck-saved') < at('<DeckPublish ') && at('<DeckPublish ') < at('<PresentButton '), "the bar's order")
  assert.ok(/<PresentButton [^\n]*\/>\s*<\/header>/.test(view), 'Present is last on the bar')
}

// The fit steps: each measured slide's `data-step`, by its place; 0 where there is none, never outside 0 to 5 (a block
// slide has six steps, Sprint 161; the host holds a v1 slide to its three, `publicDeck`).
{
  const measured = parse(`<div class="deck-measure">
    <div data-measure="0"><div class="deck-slide" data-step="0"></div></div>
    <div data-measure="1"><div class="deck-slide" data-step="2"></div></div>
    <div data-measure="3"><div class="deck-slide" data-step="7"></div></div>
    <div data-measure="9"><div class="deck-slide" data-step="1"></div></div>
  </div>`)
  assert.deepEqual(measuredSteps(5, measured as unknown as ParentNode), [0, 2, 0, 5, 0])
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
  assert.deepEqual(decodeDeckRequest({ type: 'deck/live-fit', ...publishRequest({ text, borderless: true }, [0, 2]) }),
    { type: 'deck/live-fit', text, look: 'borderless', steps: [0, 2] })
}

// Sprint 170 (#881): where the app can save a PDF, Publish is a split button: Publish stays the main part, and the ▾
// is a part of its own (its own button, so its own hover and focus) that opens the menu. Without the print (an older
// shell) or without a way to save, Publish is as before: never a menu with nothing in it.
{
  const split = (state: DeckPageState, view: 'slide' | 'both' | 'handout' = 'both') => renderToStaticMarkup(createElement(DeckPublishControl, { state, view, onPublish: () => {}, onSavePdf: () => {}, onAction: () => {} }))
  const pdf = ['slides-and-handout' as const]
  const html = split({ ready: true, kind: 'unpublished', changed: false, pdf })
  const buttons = parse(html).querySelectorAll('button')
  assert.equal(buttons.length, 2)
  assert.deepEqual([buttons[0].text.trim(), buttons[0].classList.contains('deck-publish'), buttons[0].getAttribute('aria-haspopup')], ['Publish', true, undefined])
  assert.deepEqual([buttons[1].getAttribute('aria-label'), buttons[1].getAttribute('aria-haspopup')], ['Publish or save as PDF', 'menu'])
  assert.ok(parse(html).querySelector('.rm-split.deck-publish-split.deck-publish-slot'), 'one split button, in the bar\'s Publish slot')
  // No kind this app makes, or no way to save: the plain Publish.
  assert.equal(parse(split({ ready: true, kind: 'unpublished', changed: false, pdf: [] })).querySelectorAll('button').length, 1)
  assert.equal(parse(split({ ready: true, kind: 'unpublished', changed: false })).querySelectorAll('button').length, 1)
  assert.equal(parse(draw({ ready: true, kind: 'unpublished', changed: false, pdf })).querySelectorAll('button').length, 1)
  // Publish not reachable (off, or not ready yet): Publish stays hidden, and a plain Save as PDF keeps the PDF's place
  // (a local file; the Experience lead, 20 November). Nothing where the app makes no PDF.
  const off = parse(split({ ready: false, kind: 'unpublished', changed: false, pdf }))
  assert.deepEqual(off.querySelectorAll('button').map(b => [b.text.trim(), b.classList.contains('deck-save-pdf'), b.getAttribute('aria-haspopup')]), [['Save as PDF', true, undefined]])
  assert.ok(off.querySelector('.deck-publish-slot'), 'in Publish\'s place on the bar')
  assert.equal(split({ ready: false, kind: 'unpublished', changed: false, pdf: [] }), '')
  assert.equal(split({ ready: false, kind: 'unpublished', changed: false }), '')
  // The split button's hover is the whole button's (ui/split-button.tsx): decks.css gives no part a hover of its own.
  assert.doesNotMatch(readFileSync(new URL('./decks.css', import.meta.url), 'utf8'), /deck-publish-split[^{]*:hover/)
  // Published: the chip, its menu holding the item; busy: no PDF.
  assert.equal(words(split({ ready: true, kind: 'published', changed: false, pdf })), 'Published')
  assert.ok(button(split({ ready: true, kind: 'publishing', changed: false, pdf }))!.hasAttribute('disabled'))
  // What Save as PDF sends: the kind, and the same fields as Publish.
  const { decodeDeckRequest } = await import('../../../../src/decks/deckProtocol')
  const text = '```slide title\ntitle: A\n```\n'
  assert.deepEqual(decodeDeckRequest({ type: 'deck/save-pdf', ...pdfRequest('slides-and-handout', { text, borderless: true }, [1]) }), { type: 'deck/save-pdf', kind: 'slides-and-handout', text, look: 'borderless', steps: [1] })
  assert.throws(() => decodeDeckRequest({ type: 'deck/save-pdf', ...pdfRequest('poster' as 'slides', { text, borderless: true }, [1]) }))
  assert.deepEqual(decodeDeckRequest({ type: 'deck/pdf-show' }), { type: 'deck/pdf-show' })
  assert.throws(() => decodeDeckRequest({ type: 'deck/pdf-show', path: '/etc/passwd' }))
  assert.equal(savedNotice('Day one – slides and handout.pdf'), 'Saved as Day one – slides and handout.pdf')
  // The view reaches Publish, so the item names its kind (R2).
  const view = readFileSync(new URL('./DeckView.tsx', import.meta.url), 'utf8')
  assert.ok(/<DeckPublish [^\n]*view=\{viewShown\}/.test(view), 'the view as drawn reaches Publish')
}

// Sprint 175 PR 7: live states use the host's tooltip, and only Live and Paused use state colours.
{
  const base = { ready: true, kind: 'published', changed: true } as const
  const states = [
    ['live', 'Live', '--r-success', 'Open pages catch up within about 15 seconds.'],
    ['updating', 'Updating…', 'text-ink-strong', 'Updating the published page…'],
    ['paused', 'Paused', '--r-warning-ink', 'Open pages keep what they had.'],
    ['offline', 'Offline', 'text-ink-muted', 'Saves stay on this computer.'],
  ] as const
  for (const [state, label, colour, tooltip] of states) {
    const model = { ...base, live: { on: true as const, state, tooltip } }
    const html = draw(model)
    assert.equal(words(html), label)
    assert.ok(html.includes(colour))
    assert.equal(html.includes('--r-success'), state === 'live')
    assert.equal(html.includes('--r-warning'), state === 'paused')
    assert.equal(publishedChip(model).tip, tooltip)
  }
  const sending = draw({ ...base, kind: 'publishing', live: { on: true, state: 'updating', tooltip: '' } })
  assert.equal(words(sending), 'Updating…')
  assert.equal(button(sending)?.getAttribute('aria-haspopup'), 'menu')
  assert.match(draw(base), /deck-publish-chip/)
  assert.match(publishedChip(base).tip, /changed since it was published/)
}

// Radix portals the menu in the browser. Inspect its rows and invoke the same select handlers.
{
  const base = { ready: true, kind: 'published', changed: true, address: 'https://example.workers.dev' } as const
  type RowProps = { children?: React.ReactNode; tip?: string; disabled?: boolean; role?: string; 'aria-checked'?: boolean; onSelect?: () => void }
  const rowsOf = (node: React.ReactNode): React.ReactElement<RowProps>[] =>
    React.Children.toArray(node).flatMap(child => {
      if (!React.isValidElement<RowProps>(child)) return []
      return child.type === React.Fragment ? rowsOf(child.props.children) : [child]
    })
  const textOf = (node: React.ReactNode): string => React.Children.toArray(node).map(child =>
    React.isValidElement<RowProps>(child) ? textOf(child.props.children) : String(child),
  ).join('')
  const pdf = createElement('span', null, 'Save slides as PDF…')
  let showMessage: unknown
  const menu = (state: DeckPageState) => rowsOf(publishedMenu(state, pdf, () => {}, () => {}, sendLiveAction, target => { showMessage = target }))
  const labels = (rows: ReturnType<typeof menu>) => rows.map(row => textOf(row.props.children).trim()).filter(Boolean)
  const off = menu(base)
  const live = menu({ ...base, live: { on: true, state: 'live', tooltip: '' } })
  const actions = ['Update on every saveOpen pages catch up within about 15 seconds.', 'Copy link', 'See onlineexample.workers.dev', 'Save slides as PDF…']
  assert.deepEqual(labels(off), [...actions, 'Update the page', 'Unpublish'])
  assert.deepEqual(labels(live), [...actions, 'Unpublish'])
  assert.equal(off[0].props.role, 'menuitemcheckbox')
  assert.equal(off[0].props['aria-checked'], false)
  assert.equal(live[0].props['aria-checked'], true)
  assert.equal(off[0].props.tip, 'Open pages catch up within about 15 seconds.')
  off[0].props.onSelect?.()
  live[0].props.onSelect?.()

  const at = new Date(2026, 10, 24, 10, 42).getTime()
  const localTime = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(at)
  const location = { line: 32, column: 4, endColumn: 32 }
  const pause = { kind: 'key', at, detail: "Slide 6's text has what looks like a key.", slide: 6, location, keyPreview: 's…a' } as const
  const paused = menu({ ...base, live: { on: true, state: 'paused', tooltip: '', resumeBlocked: 'Take the key out first.', pause } })
  assert.deepEqual(labels(paused), [
    `Paused at ${localTime}. Slide 6's text has what looks like a key, s…a. Open pages keep what they had.`,
    'Show it on slide 6', 'Go onTake the key out first.', ...actions, 'Unpublish',
  ])
  assert.equal(paused[2].props.disabled, true)
  assert.equal(paused[2].props.tip, 'Take the key out first.')
  paused[1].props.onSelect?.()
  assert.deepEqual(showMessage, { slide: 6, location, keyPreview: 's…a' })
  assert.doesNotMatch(pauseWords({ ...pause, keyPreview: 'longer…preview' }), /longer|preview/)

  const outside = { kind: 'outside', at, slide: 9, detail: "Slide 9 shows a picture from outside the deck's folder.", outsideFiles: ['other/picture.png', 'elsewhere/graph.svg'] } as const
  const files = menu({ ...base, live: { on: true, state: 'paused', tooltip: '', pause: { ...outside, outsideFiles: [...outside.outsideFiles] } } })
  assert.match(labels(files)[0], /picture\.png, graph\.svg\. Open pages keep what they had\.$/)
  files[1].props.onSelect?.()
  assert.deepEqual(showMessage, { slide: 9, location: undefined, keyPreview: undefined })
  assert.equal(files[2].props.disabled, false)
  files[2].props.onSelect?.()
  const connection = menu({ ...base, live: { on: true, state: 'paused', tooltip: '', pause: { kind: 'connection', at, detail: 'Cloudflare needs you to connect again.' } } })
  assert.match(labels(connection)[0], /Cloudflare needs you to connect again\. Open pages keep what they had\.$/)
  assert.equal(labels(connection)[1], 'Go on')

  assert.deepEqual(sentMessages, ['on', 'off', 'resume'].map(action => ({ type: 'deck/live-action', action })))
}

console.log('DeckPublish: passed')
