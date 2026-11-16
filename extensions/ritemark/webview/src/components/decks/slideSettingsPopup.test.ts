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
const { SlideAbout, SlideSettings } = await import('./SlideSettings')
const { SourceLines } = await import('./library/SourceLines')
const { libraryBadge } = await import('./SlideStrip')

const noop = () => {}
const settings = (kind: string, data: Record<string, unknown>, about: unknown) => parse(renderToStaticMarkup(createElement(SlideSettings, {
  number: 6, kind, data, onKind: noop, onChange: noop, onClose: noop, onUndo: noop, about: about as never,
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
  assert.equal(root.querySelectorAll('.deck-settings-sep').length, 1, 'only the line above Skip slide')
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
  // Sprint 161 (PR 2; Jarmo, 17 November): the Speaker notes fold under the slide is gone, so nothing is under it.
  assert.ok(!stage.includes('deck-under'), 'nothing under the slide')
  assert.ok(!stage.includes('Speaker notes') && !stage.includes('notesOpen') && !stage.includes('writeNotes'), 'no Speaker notes fold')
  assert.ok(!view.includes('notesOpen') && !view.includes('deck-notes'), 'the deck view keeps no notes fold')
  const css = here('./decks.css')
  assert.ok(!css.includes('.deck-sethead'), 'no row above the slide')
  assert.ok(!css.includes('.deck-notes') && !css.includes('.deck-under'), 'and no notes row under it')
  assert.ok(!css.includes('deck-thumb-dot'), 'the badge replaces the newer-version dot')
}

console.log('slideSettingsPopup: all checks passed')
