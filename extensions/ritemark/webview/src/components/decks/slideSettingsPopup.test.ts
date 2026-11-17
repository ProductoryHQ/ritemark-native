/**
 * 17 November 2026 (Jarmo; the Experience lead, "Nothing around the slide but the slide"): Slide settings is in the
 * slide's own menu ("slaidi settings peaks olema siin: mitte kuskil ülal tööriistaribas"): a Radix Popover anchored
 * beside the thumbnail, the part number or the point it came from, that closes on a press outside and on Esc and gives
 * the focus back to where the menu was opened. The gear left the bar. The lines that sat under the slide are at the top
 * of its popup, Skip slide is only in the menu, and a library slide's thumbnail carries a badge.
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
const { DECK_LOOKS, DECK_LOOK_TIP, DeckLook, SlideAbout, SlideSettings, deckReach } = await import('./SlideSettings')
const { SourceLines } = await import('./library/SourceLines')
const { libraryBadge } = await import('./SlideStrip')

const noop = () => {}
const here = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const cardDeck = { count: 15, look: 'card' as const, onLook: noop }
const settings = (kind: string, data: Record<string, unknown>, about: unknown, deck: { count: number; look: 'card' | 'borderless'; onLook: (look: string) => void } = cardDeck, extra: Record<string, unknown> = {}) => parse(renderToStaticMarkup(createElement(SlideSettings, {
  number: 6, kind, data, onKind: noop, onChange: noop, onClose: noop, onUndo: noop, about: about as never, deck, ...extra,
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

// ---- The popover's order (README, "Nothing around the slide", 17 November): the library section, Picture, a Steps
// label, a table's Add a row and Add a column, then the deck's look last. Skip slide is only in the menu.
{
  let rows = 0
  let columns = 0
  const data = { from: 'Slide library/Agents.deck.md#p1 @k2' }
  const about = createElement(SlideAbout, { data, hidden: '' })
  const root = settings('', data, about, cardDeck, { stepsTag: { value: 'Exercise', onChange: noop }, table: { addRow: () => rows++, addColumn: () => columns++ } })
  const text = root.textContent
  const order = ['From the library · Agents', 'Picture', 'Label', 'Add a row', 'Add a column', 'This deck · all 15 slides'].map(words => {
    const at = text.indexOf(words)
    assert.ok(at >= 0, words)
    return at
  })
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'library, Picture, Label, the table, the deck')
  assert.ok(!text.includes('Skip slide'), 'Skip slide is only in the menu')
  assert.deepEqual(root.querySelectorAll('.deck-settings-table button').map(button => button.textContent), ['Add a row', 'Add a column'])
  assert.equal(rows + columns, 0)
  // The words a layout keeps for others stay at the top.
  const hidden = settings('table', {}, createElement(SlideAbout, { data: {}, hidden: '2 more items are kept for other layouts' }))
  assert.match(hidden.querySelector('.deck-settings-about')!.textContent, /2 more items are kept for other layouts/)
}

// ---- Nothing to say: no top section and no line; the settings start under the head.
{
  assert.equal(renderToStaticMarkup(createElement(SlideAbout, { data: {}, hidden: '' })), '')
  const root = settings('points', {}, null)
  assert.equal(root.querySelectorAll('.deck-settings-sep').length, 1, 'only the line above the deck')
  assert.ok(root.querySelector('section')!.childNodes.filter(node => node.nodeType === 1)
    .findIndex(node => ((node as { classNames?: string }).classNames ?? '').includes('deck-settings-sep')) > 1, 'no line under the head')
}

// ---- Card or Borderless (16 November, "Card or Borderless lives in the gear's popup"; the popover since 17 November):
// the popup's last section, under a line: the heading that names its reach, then the segment, the popup's full width.
{
  for (const [kind, data, about] of [
    ['boxes', {}, null],
    ['exercise', {}, null],
    ['picture', { skip: true }, null],
    ['', {}, null],
    ['table', {}, createElement(SlideAbout, { data: {}, hidden: '2 more items are kept for other layouts' })],
  ] as const) {
    const root = settings(kind, data, about, cardDeck, kind === 'table' ? { table: { addRow: noop, addColumn: noop } } : {})
    type El = { classNames?: string; textContent: string; childNodes: Array<{ nodeType: number }>; getAttribute(name: string): string | null; querySelector(s: string): El | null }
    const elements = (node: El) => node.childNodes.filter(child => child.nodeType === 1) as unknown as El[]
    const children = elements(root.querySelector('section') as unknown as El)
    const last = children.length - 1
    assert.ok(!root.textContent.includes('Skip slide'), `${kind}: no Skip slide (it's in the menu)`)
    assert.ok((children[last - 1].classNames ?? '').includes('deck-settings-sep'), `${kind}: a line, the deck's section, and nothing after it`)
    // The section is a group named by its heading (review, #764): a screen reader hears the reach with the choice.
    const section = children[last]
    assert.equal(section.getAttribute('role'), 'group')
    const [heading, tip] = elements(section)
    assert.equal(elements(section).length, 2, `${kind}: the heading, then the segment`)
    assert.equal(section.getAttribute('aria-labelledby'), heading.getAttribute('id'), `${kind}: named by its heading`)
    assert.equal(heading.getAttribute('id'), 'deck-reach-6')
    assert.ok((heading.classNames ?? '').includes('deck-settings-k'), `${kind}: the popup's small uppercase label`)
    assert.equal(heading.textContent, 'This deck · all 15 slides', `${kind}: the heading with the count`)
    const group = tip.querySelector('[role="radiogroup"]')!
    assert.equal(group.getAttribute('aria-label'), 'How the slides look')
    assert.match(group.getAttribute('class') ?? '', /\bw-full\b/, `${kind}: the popup's full width`)
    assert.match(tip.getAttribute('class') ?? '', /\bw-full\b/, `${kind}: its tooltip's span too`)
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

// ---- A deck with no slides (#764): the popup is the deck's section alone, its heading "This deck · no slides yet", with
// Card | Borderless as anywhere else; no slide head, no slide sections, no line.
{
  let chosen = ''
  const root = parse(renderToStaticMarkup(createElement(DeckLook, { id: 'deck-reach-none', only: true, count: 0, look: 'card', onLook: look => { chosen = look } })))
  const group = root.childNodes.filter(node => node.nodeType === 1) as unknown as Array<{ getAttribute(name: string): string | null; classNames: string }>
  assert.equal(group.length, 1, 'one section and nothing else')
  assert.equal(group[0].getAttribute('role'), 'group')
  assert.equal(group[0].getAttribute('aria-labelledby'), 'deck-reach-none')
  assert.equal(group[0].classNames, 'deck-settings-only')
  assert.equal(root.querySelector('#deck-reach-none')!.textContent, 'This deck · no slides yet')
  assert.equal(root.querySelectorAll('.deck-settings-k').length, 1)
  assert.equal(root.querySelectorAll('.deck-settings-sep, section, header').length, 0, 'no line, no slide head, no slide section')
  assert.ok(!root.textContent.includes('Skip slide') && !root.textContent.includes('Layout'), "none of a slide's settings")
  assert.deepEqual(root.querySelectorAll('[aria-label="How the slides look"] input').map(input => [input.getAttribute('value'), input.hasAttribute('checked')]), [['card', true], ['borderless', false]])
  assert.equal(chosen, '', 'nothing chosen by drawing it')
  assert.equal(deckReach(0), 'This deck · no slides yet')
  assert.match(here('./decks.css'), /\n\.deck-settings-only > \.deck-settings-k \{ margin-top: 0; \}/, 'its heading at the top of the popup')
  // The same section, the same choice, the same `setLook`: the slide's popup draws it with the same component.
  assert.match(here('./SlideSettings.tsx'), /<DeckLook id=\{reachId\} \{\.\.\.deck\} \/>\n    <\/section>/)
}

// ---- The thumbnail's badge: quiet, amber when changed here or newer there, with a tooltip that says which.
assert.equal(libraryBadge(undefined), null)
assert.equal(libraryBadge({ library: false, newer: false }), null, "another deck's copy has no library badge")
assert.deepEqual(libraryBadge({ library: true, newer: false }), { label: 'From the library', amber: false })
assert.deepEqual(libraryBadge({ library: true, newer: false, changed: true }), { label: 'From the library, changed in this deck', amber: true })
assert.deepEqual(libraryBadge({ library: true, newer: true }), { label: 'From the library, which has a newer version', amber: true })

// ---- Where things are (17 November): no gear in the bar; the slide's own menus open Slide settings…, a popover
// anchored beside where it came from; nothing above or under the slide.
{
  const view = here('./DeckView.tsx')
  const bar = view.slice(view.indexOf('<header className="deck-bar">'), view.indexOf('</header>'))
  for (const gone of ['Popover', 'gear', 'Slide settings', 'deck-settings-button', 'SegmentedControl', 'Borderless', 'How the slides look', 'deck-look']) {
    assert.ok(!bar.includes(gone), `nothing of "${gone}" in the bar`)
  }
  // The bar's left side: the strip button and "Slide N of M" (then the bar's notices); the right: Saved, Publish, Present.
  assert.ok(bar.indexOf('aria-label="Slides"') < bar.indexOf('className="deck-count"') && bar.indexOf('className="deck-count"') < bar.indexOf('deck-notice'))
  assert.ok(!here('./decks.css').includes('.deck-settings-button'), "the gear's rules are gone")
  // The popover: anchored (never a trigger), beside where it came from, top-aligned, closing on a press outside and on
  // Esc (Radix), and giving the focus back to where the menu was opened.
  const popover = view.slice(view.indexOf('<Popover open={settingsFor !== null}'), view.indexOf('</Popover>'))
  assert.ok(popover.length > 0, 'the popover')
  assert.match(popover, /^<Popover open=\{settingsFor !== null\} onOpenChange=\{open => \{ if \(!open\) setSettingsFor\(null\) \}\}>/)
  assert.match(popover, /<PopoverAnchor virtualRef=\{settingsAnchor\} \/>/)
  assert.doesNotMatch(popover, /PopoverTrigger/)
  assert.match(popover, /side=\{settingsFor\?\.side \?\? 'right'\}\s+align="start"/, 'beside, top-aligned')
  assert.match(popover, /onCloseAutoFocus=\{event => \{[\s\S]*?back\.focus\(/, 'the focus back to where the menu was opened')
  assert.match(popover, /<PopoverContent[^>]*className="deck-settings"/, 'the popup carries the scroll rule')
  // Its anchors: beside the thumbnail (right), beside the part number (left), at the slide's right-click point.
  assert.match(view, /settings: index => openSettings\(index, \(\) => \{\s+const thumb = stripRef\.current\?\.querySelector<HTMLElement>\(`\[data-thumb="\$\{index\}"\] \.deck-thumb-slide`\)\s+return thumb \? \{ anchor: thumb, side: 'right', back: stripRef\.current \} : null/)
  assert.match(view, /const partSettings = useCallback\(\(index: number, slot: PartMenuSlot\) => openSettings\(index, \(\) => \(\s+slot\.element\.isConnected\s+\? \{ anchor: slot\.element\.parentElement\?\.querySelector<HTMLElement>\('\.deck-part-number'\) \?\? slot\.element, side: 'left', back: slot\.element\.querySelector\('button'\) \}/)
  assert.match(view, /anchor: \{ getBoundingClientRect: \(\) => new DOMRect\(at\.x, at\.y, 0, 0\) \}/)
  assert.match(view, /onSlideSettings=\{stageSettings\}/)
  // The stage's right-click menu: Slide settings… at its end, after Comment, under a line.
  const editor = here('./blocks/SlideEditor.tsx')
  const menu = editor.slice(editor.indexOf('<ContextMenuContent'), editor.indexOf('</ContextMenuContent>'))
  assert.ok(menu.indexOf('Comment') < menu.indexOf('Slide settings…'), 'after Comment')
  assert.match(menu, /<ContextMenuSeparator \/>\s+<ContextMenuItem className="gap-2" onSelect=\{\(\) => \{ pendingSettings\.current = true \}\}>\s+<Icon name="gear" size=\{14\} tone="inherit" \/>\s+Slide settings…\s+<\/ContextMenuItem>\s+<\/>\s+\) : null\}\s+$/, 'the last item, under a line')
  // Skip slide is in the menu only; every setting stays reachable (HARD RULE #1): the switch is gone from the popover,
  // and the menu's Skip slide / Show slide does what it did.
  assert.ok(!/deck-skip-|<Switch|>Skip slide</.test(here('./SlideSettings.tsx')), 'no Skip slide in the popover')
  assert.match(here('./slideMenuItems.ts'), /label: skipped \? 'Show slide' : 'Skip slide'/)
  // A deck with no slides (#764): no thumbnail and no menu, so the strip's + menu at the end offers Deck look…, whose
  // popover is the deck's section alone.
  const stripSource = here('./SlideStrip.tsx')
  assert.match(stripSource, /\{count === 0 \? \([\s\S]*?<DropdownMenuItem onSelect=\{\(\) => actions\.deckLook\(\)\}>[\s\S]*?Deck look…/)
  assert.match(view, /deckLook: \(\) => openSettings\(-1,/)
  assert.match(popover, /\{slide \? \(\s+<SlideSettings[\s\S]*\) : \(\s+<DeckLook id="deck-reach-none" only \{\.\.\.deckLook\} \/>\s+\)\}\s+<\/PopoverContent>\s+$/, "a slide's settings, or the deck's section alone")
  assert.match(popover, /deck=\{deckLook\}/)
  assert.match(view, /const deckLook = \{ count, look: borderless \? 'borderless' as const : 'card' as const, onLook: setLook \}/)
  assert.match(view, /const count = slides\.length/)
  assert.match(view, /const setLook = useCallback\(\(look: string\) => \{\s+const next: DocumentProperties = \{ \.\.\.properties \}\s+if \(look === 'borderless'\) next\.look = 'borderless'\s+else delete next\.look\s+onPropertiesChange\(next\)/, 'the front matter is written as before')
  assert.ok(!here('./decks.css').includes('.deck-look'), "the bar's segment rule is gone")
  // Review, #764: the popup never grows past the room it has; it scrolls, so its last section stays reachable.
  assert.match(here('./decks.css'), /\n\.deck-settings:not\(\.deck-addlib\) \{ max-height: var\(--radix-popover-content-available-height\); overflow-y: auto; \}/)
  assert.match(here('./library/AddToLibrarySheet.tsx'), /className="deck-settings deck-addlib"/)
  // Settings belong to their slide: another slide made current closes them; a slide that goes leaves the deck's section.
  assert.match(view, /if \(open\.index < 0\) return count === 0 \? open : null\s+return open\.index === shown && \(open\.id === undefined \|\| open\.id === shownSlideId\) \? open : null/, 'by the slide id, never another slide at its number')
  assert.doesNotMatch(view, /settingsReady|The deck has no slides yet|Show the slide to change its settings/, 'no disabled state or its words')
  for (const line of view.split('\n').filter(text => text.includes('setSettingsFor(null)'))) {
    assert.doesNotMatch(line, /slideShown|fold|'slide'/, `nothing about the fold closes Settings: ${line.trim()}`)
  }
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
