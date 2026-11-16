/**
 * 17 November 2026 (Jarmo; the Experience lead, "Nothing around the slide but the slide"): Slide settings is a gear in
 * the deck's bar, a Radix Popover that closes on a press outside and on Esc and gives the gear the focus back. The lines
 * that sat under the slide are at the top of its popup, and a library slide's thumbnail carries a badge.
 *
 * Run: npx tsx webview/src/components/decks/slideSettingsPopup.test.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { register } from 'node:module'
import { fileURLToPath } from 'node:url'

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
const { DECK_LOOKS, DECK_LOOK_TIP, SlideAbout, SlideSettings, deckReach } = await import('./SlideSettings')
const { SourceLines } = await import('./library/SourceLines')
const { libraryBadge } = await import('./SlideStrip')

const noop = () => {}
const cardDeck = { count: 15, look: 'card' as const, onLook: noop }
const settings = (kind: string, data: Record<string, unknown>, about: unknown, deck: { count: number; look: 'card' | 'borderless'; onLook: (look: string) => void } = cardDeck) => parse(renderToStaticMarkup(createElement(SlideSettings, {
  number: 6, kind, data, onKind: noop, onChange: noop, onClose: noop, onUndo: noop, about: about as never, deck,
})))

// ---- A changed library slide: its line, the sentence and the buttons first, then a line, then the slide's settings.
{
  const data = { id: 'b006', title: 'An assistant', from: 'Slide library/AI assistants.deck.md#b006 @k1' }
  const source = { id: 'b006', library: true, sourceName: 'AI assistants', changed: true, newer: false, missing: false }
  const about = createElement(SlideAbout, {
    data,
    hidden: '',
    sourceLines: createElement(SourceLines, { source, kept: false, justUpdated: false, busy: false, actions: { keepHere: noop, updateLibrary: noop, useLibrary: noop } }),
  })
  const root = settings('boxes', data, about)
  const text = root.textContent
  const at = (words: string) => { const i = text.indexOf(words); assert.ok(i >= 0, words); return i }
  assert.ok(at('Slide 6') < at('From the library · AI assistants'))
  assert.ok(at('From the library · AI assistants') < at("Changed in this deck; the library's slide is as it was."))
  assert.ok(at('Keep it here') < at('Layout') && at('Update the library') < at('Layout'), 'the buttons come before the settings')
  const children = root.querySelector('section')!.childNodes.filter(node => node.nodeType === 1) as Array<{ classNames?: string; rawAttrs?: string }>
  const about0 = children.findIndex(node => (node.classNames ?? '').includes('deck-settings-about'))
  assert.ok(about0 === 1, 'the about section sits right under the head')
  assert.ok((children[about0 + 1].classNames ?? '').includes('deck-settings-sep'), 'then a line')
}

// ---- Before the host has read the copy: the plain line. Another deck's copy: "From <deck>".
{
  const library = settings('points', {}, createElement(SlideAbout, { data: { from: 'Slide library/Agents.deck.md#p1 @k2' }, hidden: '' }))
  assert.match(library.textContent, /From the library · Agents/)
  const deck = settings('points', {}, createElement(SlideAbout, { data: { from: 'Northwind/Data in Excel.deck.md#p1 @k2' }, hidden: '' }))
  assert.match(deck.textContent, /From Data in Excel/)
}

// ---- A table slide: Add a row · Add a column at the top. The words a layout keeps for others too.
{
  let rows = 0
  let columns = 0
  const about = createElement(SlideAbout, { data: {}, hidden: '2 more items are kept for other layouts', table: { addRow: () => rows++, addColumn: () => columns++ } })
  const root = settings('table', {}, about)
  const buttons = root.querySelectorAll('.deck-settings-about button').map(button => button.textContent)
  assert.deepEqual(buttons, ['Add a row', 'Add a column'])
  assert.match(root.querySelector('.deck-settings-about')!.textContent, /2 more items are kept for other layouts/)
  assert.equal(rows + columns, 0)
}

// ---- Nothing to say: no top section and no line; the settings start under the head.
{
  assert.equal(renderToStaticMarkup(createElement(SlideAbout, { data: {}, hidden: '' })), '')
  const root = settings('points', {}, null)
  assert.equal(root.querySelectorAll('.deck-settings-sep').length, 2, 'only the lines above Skip slide and above the deck')
  assert.ok(root.querySelector('section')!.childNodes.filter(node => node.nodeType === 1)
    .findIndex(node => ((node as { classNames?: string }).classNames ?? '').includes('deck-settings-sep')) > 1, 'no line under the head')
}

// ---- Card or Borderless (16 November, "Card or Borderless lives in the gear's popup"): the popup's last section,
// under a line after Skip slide: the heading that names its reach, then the segment, the popup's full width.
{
  for (const [kind, data, about] of [
    ['boxes', {}, null],
    ['exercise', {}, null],
    ['picture', { skip: true }, null],
    ['', {}, null],
    ['table', {}, createElement(SlideAbout, { data: {}, hidden: '', table: { addRow: noop, addColumn: noop } })],
  ] as const) {
    const root = settings(kind, data, about)
    const children = root.querySelector('section')!.childNodes.filter(node => node.nodeType === 1) as unknown as Array<{ classNames?: string; textContent: string; querySelector(s: string): { getAttribute(name: string): string | null } | null }>
    const last = children.length - 1
    const skip = children.findIndex(node => node.textContent.includes('Skip slide'))
    assert.ok(skip > 0, `${kind}: Skip slide`)
    assert.equal(last - skip, 3, `${kind}: Skip slide, a line, the heading, the segment, and nothing after it`)
    assert.ok((children[skip + 1].classNames ?? '').includes('deck-settings-sep'), `${kind}: a line after Skip slide`)
    assert.ok((children[skip + 2].classNames ?? '').includes('deck-settings-k'), `${kind}: the popup's small uppercase label`)
    assert.equal(children[skip + 2].textContent, 'This deck · all 15 slides', `${kind}: the heading with the count`)
    const group = children[last].querySelector('[role="radiogroup"]')!
    assert.equal(group.getAttribute('aria-label'), 'How the slides look')
    assert.match(group.getAttribute('class') ?? '', /\bw-full\b/, `${kind}: the popup's full width`)
    assert.match((children[last] as unknown as { getAttribute(name: string): string | null }).getAttribute('class') ?? '', /\bw-full\b/, `${kind}: its tooltip's span too`)
  }
  const radios = (look: 'card' | 'borderless') => settings('points', {}, null, { count: 15, look, onLook: noop })
    .querySelectorAll('[role="radiogroup"][aria-label="How the slides look"] input[type="radio"]')
  assert.deepEqual(radios('card').map(input => [input.getAttribute('value'), input.hasAttribute('checked')]), [['card', true], ['borderless', false]])
  assert.deepEqual(radios('borderless').map(input => [input.getAttribute('value'), input.hasAttribute('checked')]), [['card', false], ['borderless', true]])
  assert.deepEqual(settings('points', {}, null).querySelectorAll('[aria-label="How the slides look"] label').map(label => label.textContent), ['Card', 'Borderless'])
  // The same words and tooltip as the bar's segment had.
  assert.deepEqual(DECK_LOOKS, [{ value: 'card', label: 'Card' }, { value: 'borderless', label: 'Borderless' }])
  assert.equal(DECK_LOOK_TIP, 'How the slides look: as a card, or the whole column as the stage')
  // Its reach, live: the deck's own count, and one slide said as one.
  assert.equal(deckReach(15), 'This deck · all 15 slides')
  assert.equal(deckReach(2), 'This deck · all 2 slides')
  assert.equal(deckReach(1), 'This deck · 1 slide')
  assert.equal(settings('points', {}, null, { count: 3, look: 'card', onLook: noop }).querySelectorAll('.deck-settings-k').pop()!.textContent, 'This deck · all 3 slides')
}

// ---- The thumbnail's badge: quiet, amber when changed here or newer there, with a tooltip that says which.
assert.equal(libraryBadge(undefined), null)
assert.equal(libraryBadge({ library: false, newer: false }), null, "another deck's copy has no library badge")
assert.deepEqual(libraryBadge({ library: true, newer: false }), { label: 'From the library', amber: false })
assert.deepEqual(libraryBadge({ library: true, newer: false, changed: true }), { label: 'From the library, changed in this deck', amber: true })
assert.deepEqual(libraryBadge({ library: true, newer: true }), { label: 'From the library, which has a newer version', amber: true })

// ---- Where things are: the gear in the bar after the count, nothing above or under the slide but the notes.
const here = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
{
  const view = here('./DeckView.tsx')
  const bar = view.slice(view.indexOf('<header className="deck-bar">'), view.indexOf('</header>'))
  const count = bar.indexOf('className="deck-count"')
  const gear = bar.slice(bar.indexOf('<Popover open='), bar.indexOf('</Popover>'))
  assert.ok(count >= 0 && bar.indexOf('<Popover open=') > count && bar.indexOf('<Popover open=') < bar.indexOf('deck-notice'), 'the gear comes right after "Slide 6 of 13"')
  assert.match(gear, /<Tooltip label=\{settingsReady \? 'Slide settings'/)
  assert.match(gear, /aria-label="Slide settings"/)
  assert.match(gear, /variant="ghost"\s+size="icon-xs"/, 'a 28 px ghost icon button')
  assert.match(gear, /<Icon name="gear" size=\{16\}/, 'a gear (Jarmo: "gear-icon"), the one the old Settings button drew')
  assert.match(gear, /<PopoverContent\s+align="start"/, 'the popup opens under the gear, left-aligned to it')
  assert.match(gear, /data-state=\{settingsOpen && settingsReady \? 'active'/, 'its on state while the popup is open')
  assert.doesNotMatch(gear, /\btitle=/, 'a tooltip, never a native title')
  // Card or Borderless (16 November): off the bar, into the popup, written by the same `setLook` with the live count.
  for (const gone of ['SegmentedControl', 'Borderless', 'How the slides look', 'deck-look']) {
    assert.ok(!bar.replace(gear, '').includes(gone), `nothing of "${gone}" on the bar outside the popup`)
  }
  assert.match(gear, /deck=\{\{ count, look: borderless \? 'borderless' : 'card', onLook: setLook \}\}/)
  assert.match(view, /const count = slides\.length/)
  assert.match(view, /const setLook = useCallback\(\(look: string\) => \{\s+const next: DocumentProperties = \{ \.\.\.properties \}\s+if \(look === 'borderless'\) next\.look = 'borderless'\s+else delete next\.look\s+onPropertiesChange\(next\)/, 'the front matter is written as before')
  assert.ok(!here('./decks.css').includes('.deck-look'), "the bar's segment rule is gone")
  // Review, PR 759: Settings with no slide to belong to close, so they never reopen by themselves when it returns.
  assert.match(view, /useEffect\(\(\) => \{ if \(!slideShown \|\| !slides\[shown\]\) setSettingsOpen\(false\) \}, \[slideShown, slides, shown\]\)/)
  // The Add to library sheet alone is placed by the desk's measure now.
  assert.match(view, /if \(!addSheet\) \{ setSettingsAt\(null\); return \}/)
  // The thumbnail's badge goes in as plain values, so the memoised thumbnail keeps its memo.
  const strip = here('./SlideStrip.tsx')
  assert.match(strip, /badgeLabel=\{[^}]*\}\s+badgeAmber=\{/)
  assert.doesNotMatch(strip, /badge=\{/)
  assert.match(here('../ui/button.tsx'), /"icon-xs": "size-7"/, 'the 28 px icon button is a size of the shared Button')

  const stage = here('./Stage.tsx')
  for (const gone of ['deck-sethead', 'onSettings', 'sourceLines', 'write(addRow)', 'hiddenNote', '`From the library']) {
    assert.ok(!stage.includes(gone), `nothing of "${gone}" on the stage`)
  }
  const under = stage.slice(stage.indexOf('<div className="deck-under">'))
  assert.ok(under.includes('Speaker notes'), 'under the slide, only the speaker notes')
  const css = here('./decks.css')
  assert.ok(!css.includes('.deck-sethead'), 'no row above the slide')
  assert.ok(!css.includes('deck-thumb-dot'), 'the badge replaces the newer-version dot')
}

console.log('slideSettingsPopup: all checks passed')
