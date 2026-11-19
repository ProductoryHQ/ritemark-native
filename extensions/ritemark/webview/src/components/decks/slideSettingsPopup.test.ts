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
const { SlideAbout, SlideSettings } = await import('./SlideSettings')
const { SourceLines } = await import('./library/SourceLines')
const { libraryBadge } = await import('./SlideStrip')

const noop = () => {}
const here = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const settings = (kind: string, data: Record<string, unknown>, about: unknown) => parse(renderToStaticMarkup(createElement(SlideSettings, {
  number: 6, kind, data, onKind: noop, onChange: noop, onClose: noop, about: about as never,
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

// ---- The popover's order (README, "Nothing around the slide", 17 November): the library section, then Picture (the
// deck's look left for the Theme menu in Sprint 162). Skip slide is only in the menu. A table's rows and columns are the
// table's own + bars and grips (experience 48): Settings has no Add a row or Add a column. Sprint 164 PR 3 (Jarmo's yes
// by name, 19 November): no Label row, for a block slide with Steps or an old Exercise slide; the Label is a block.
{
  const data = { from: 'Slide library/Agents.deck.md#p1 @k2' }
  const about = createElement(SlideAbout, { data, hidden: '' })
  const root = settings('', data, about)
  const text = root.textContent
  const order = ['From the library · Agents', 'Picture'].map(words => {
    const at = text.indexOf(words)
    assert.ok(at >= 0, words)
    return at
  })
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'library, then Picture')
  for (const kind of ['', 'exercise']) {
    const shown = settings(kind, { tag: 'Harjutus' }, null)
    assert.ok(!shown.textContent.includes('Label') && !shown.textContent.includes('Harjutus'), `${kind || 'block slide'}: no Label row`)
    assert.equal(shown.querySelectorAll('input').filter(input => input.getAttribute('type') !== 'radio').length, 0, `${kind || 'block slide'}: no field to type in`)
  }
  assert.doesNotMatch(here('./SlideSettings.tsx'), /function LabelRow|deck-settings-tag/, 'the row is gone from the popover')
  assert.ok(!text.includes('This deck'), 'no deck section')
  assert.ok(!text.includes('Skip slide'), 'Skip slide is only in the menu')
  assert.ok(!text.includes('Add a row') && !text.includes('Add a column'), 'no Add a row or Add a column: the table has its + bars')
  assert.equal(root.querySelectorAll('.deck-settings-table').length, 0)
  // The words a layout keeps for others stay at the top.
  const hidden = settings('table', {}, createElement(SlideAbout, { data: {}, hidden: '2 more items are kept for other layouts' }))
  assert.match(hidden.querySelector('.deck-settings-about')!.textContent, /2 more items are kept for other layouts/)
}

// ---- Nothing to say: no top section and no line; the settings start under the head.
{
  assert.equal(renderToStaticMarkup(createElement(SlideAbout, { data: {}, hidden: '' })), '')
  const root = settings('points', {}, null)
  assert.equal(root.querySelectorAll('.deck-settings-sep').length, 0, 'no line at all')
}

// ---- Sprint 162 (step-3-themes.md): the popover keeps only the slide's own settings. Card | Borderless left its
// "This deck" section for the Theme menu on the deck's bar (themeMenu.test.ts), so no kind of slide shows it here.
{
  for (const [kind, data, about] of [
    ['boxes', {}, null],
    ['exercise', {}, null],
    ['picture', { skip: true }, null],
    ['', {}, null],
    ['table', {}, createElement(SlideAbout, { data: {}, hidden: '2 more items are kept for other layouts' })],
  ] as const) {
    const root = settings(kind, data, about)
    assert.ok(!root.textContent.includes('This deck'), `${kind}: no deck section`)
    assert.equal(root.querySelectorAll('[aria-label="How the slides look"]').length, 0, `${kind}: no Card | Borderless`)
    assert.ok(!root.textContent.includes('Borderless'), `${kind}: no Borderless`)
    const children = root.querySelector('section')!.childNodes.filter(node => node.nodeType === 1) as Array<{ classNames?: string }>
    assert.ok(!(children[children.length - 1].classNames ?? '').includes('deck-settings-sep'), `${kind}: no line left at the end`)
  }
  const source = here('./SlideSettings.tsx')
  assert.doesNotMatch(source, /DeckLook|deckReach|DECK_LOOK|deck: DeckLookChoice/, 'the section and its parts are gone from the popover')
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
  // Its anchors: beside the thumbnail (right), beside the part number (right: the number is on the rail at the handout's left), at the slide's right-click point.
  assert.match(view, /settings: index => openSettings\(index, \(\) => \{\s+const thumb = stripRef\.current\?\.querySelector<HTMLElement>\(`\[data-thumb="\$\{index\}"\] \.deck-thumb-slide`\)\s+return thumb \? \{ anchor: thumb, side: 'right', back: stripRef\.current \} : null/)
  assert.match(view, /const partSettings = useCallback\(\(index: number, slot: PartMenuSlot\) => openSettings\(index, \(\) => \(\s+slot\.element\.isConnected\s+\? \{ anchor: slot\.element\.parentElement\?\.querySelector<HTMLElement>\('\.deck-part-number'\) \?\? slot\.element, side: 'right', back: slot\.element\.querySelector\('button'\) \}/)
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
  // Sprint 162: a deck with no slides chooses its look on the bar's Theme menu, as every deck does, so the strip's +
  // menu at the end no longer offers Deck look…, and the popover is a slide's settings or nothing.
  const stripSource = here('./SlideStrip.tsx')
  assert.doesNotMatch(stripSource, /Deck look…|actions\.deckLook/)
  assert.doesNotMatch(view, /deckLook|DeckLook|openSettings\(-1/)
  assert.match(popover, /\{slide \? \(\s+<SlideSettings[\s\S]*\) : null\}\s+<\/PopoverContent>\s+$/, "a slide's settings, or nothing")
  assert.match(view, /const count = slides\.length/)
  // Card | Borderless is in the Theme menu on the bar, and writes the front matter through the same `setLook`.
  assert.match(bar, /<ThemeMenu theme=\{theme\} named=\{properties\.theme\} look=\{borderless \? 'borderless' : 'card'\} onLook=\{setLook\} transition=\{transition\} onTransition=\{setTransition\} onPick=\{pickTheme\} newTheme=\{newTheme\} \/>/)
  // Since Sprint 162 the look is a step of the deck's Undo (themeMenu.test.ts writes it through the same join).
  assert.match(view, /const after = look === 'borderless' \? \{ present: true, value: 'borderless' \} : \{ present: false \}/, 'the same `look: borderless` line, or none')
  assert.match(view, /editor\.view\.dispatch\(propertyTransaction\(editor\.state, 'look', before, after\)\)/)
  assert.ok(!here('./decks.css').includes('.deck-look'), "the bar's segment rule is gone")
  // Review, #764: the popup never grows past the room it has; it scrolls, so its last section stays reachable.
  assert.match(here('./decks.css'), /\n\.deck-settings:not\(\.deck-addlib\) \{ max-height: var\(--radix-popover-content-available-height\); overflow-y: auto; \}/)
  assert.match(here('./library/AddToLibrarySheet.tsx'), /className="deck-settings deck-addlib"/)
  // Settings belong to their slide: another slide made current closes them, and so does the slide going.
  assert.match(view, /return open\.index === shown && open\.index < count && \(open\.id === undefined \|\| open\.id === shownSlideId\) \? open : null/, 'by the slide id, never another slide at its number')
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
