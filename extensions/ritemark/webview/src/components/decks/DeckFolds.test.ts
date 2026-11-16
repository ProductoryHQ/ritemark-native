/**
 * Fold either side (experience 46, 16 November): the slide or the handout folds away, never both, and each deck keeps
 * its choice in its own view state, never in the file.
 *
 * Run: npx tsx webview/src/components/decks/DeckFolds.test.ts
 */
import assert from 'node:assert/strict'
import { register } from 'node:module'

register(`data:text/javascript,${encodeURIComponent(
  "export async function load(url, context, next) { return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context) }",
)}`)

// The view's state and what the view sends its host, as the webview's API holds them.
let viewState: unknown = undefined
const posted: unknown[] = []
Object.assign(globalThis, {
  acquireVsCodeApi: () => ({
    postMessage: (message: unknown) => { posted.push(message) },
    getState: () => viewState,
    setState: (state: unknown) => { viewState = state },
  }),
})
const React = await import('react')
;(globalThis as typeof globalThis & { React: typeof React }).React = React
const { createElement } = React
const { renderToStaticMarkup } = await import('react-dom/server')
const { parse } = await import('node-html-parser')
const { DeckFolds, foldControl, foldFrom, foldedSides, keepDeckViewState, keepFold, storedFold, toggledFold } = await import('./DeckFolds')

const draw = (slideShown: boolean, handoutShown: boolean) =>
  parse(renderToStaticMarkup(createElement(DeckFolds, { slideShown, handoutShown, line: 500, onToggle: () => {} })))
const labels = (slideShown: boolean, handoutShown: boolean) =>
  draw(slideShown, handoutShown).querySelectorAll('button').map(button => button.getAttribute('aria-label'))

// Both sides shown: the line carries one split control, a pill upright on the line: ‹ Hide the slide over › Hide the
// handout (Jarmo, 16 November: "see võiks olla split button").
{
  assert.deepEqual(labels(true, true), ['Hide the slide', 'Hide the handout'])
  const control = foldControl(true, true, 500)
  assert.equal(control.buttons.length, 2)
  assert.equal(control.at, 500, 'on the line')
  assert.deepEqual(control.buttons.map(b => [b.side, b.icon]), [['slide', 'caret-left'], ['handout', 'caret-right']], 'upper half first')
  // Both halves are inside one control: one group with both buttons in it, and no second control beside it.
  const html = draw(true, true)
  const groups = html.querySelectorAll('.deck-fold')
  assert.equal(groups.length, 1, 'one control')
  const pill = groups[0]
  assert.ok(pill.classList.contains('is-split'))
  assert.equal(pill.getAttribute('role'), 'group')
  assert.equal(pill.querySelectorAll('button.deck-fold-button').length, 2, 'two halves in it')
  // Each half names its end of the pill itself, not through the Tooltip's wrapper.
  assert.deepEqual(pill.querySelectorAll('button').map(b => [b.classList.contains('is-upper'), b.classList.contains('is-lower')]), [[true, false], [false, true]])
  // Each half stays a real button with its own label.
  assert.deepEqual(pill.querySelectorAll('button').map(b => b.getAttribute('aria-label')), ['Hide the slide', 'Hide the handout'])
  assert.equal(html.querySelectorAll('[title]').length, 0, 'no native title')
  // The tooltips: the shared Tooltip around each half, with that half's words (its content draws only on hover or
  // focus, so the element tree is read rather than the markup).
  const { Tooltip } = await import('../ui/tooltip')
  type Half = { type: unknown; props: { label: string; children: { props: { onClick: () => void } } } }
  const halves = (onToggle: (side: 'slide' | 'handout') => void) =>
    DeckFolds({ slideShown: true, handoutShown: true, line: 500, onToggle }).props.children as Half[]
  assert.ok(halves(() => {}).every(half => half.type === Tooltip), 'each half is in the shared Tooltip')
  assert.deepEqual(halves(() => {}).map(half => half.props.label), ['Hide the slide', 'Hide the handout'])
  // Each half folds its own side.
  const pressed: string[] = []
  for (const half of halves(side => { pressed.push(side) })) half.props.children.props.onClick()
  assert.deepEqual(pressed, ['slide', 'handout'])
  // The pill's look (decks.css): the desk's colour in a 1 px strong-hairline ring with a small shadow, 26×28 halves
  // with a hairline between, and a hover in the accent's soft fill with the icon in the accent.
  const { readFileSync } = await import('node:fs')
  const css = readFileSync(new URL('./decks.css', import.meta.url), 'utf8').replace(/\s+/g, ' ')
  assert.ok(/\.deck-fold\.is-split \{[^}]*flex-direction: column;[^}]*border-radius: 13px;[^}]*background: var\(--r-surface\);[^}]*box-shadow: 0 0 0 1px var\(--r-hairline-strong\), 0 2px 6px/.test(css), 'the pill')
  assert.ok(/\.deck-fold\.is-split \.deck-fold-button \{ width: 26px; height: 28px;[^}]*transform: none;/.test(css), '26×28 halves that a press does not shrink')
  assert.ok(/\.deck-fold\.is-split \.deck-fold-button\.is-upper \{ border-radius: 13px 13px 0 0; \}/.test(css), "the upper half takes the pill's top")
  assert.ok(/\.deck-fold\.is-split \.deck-fold-button\.is-lower \{ border-radius: 0 0 13px 13px; box-shadow: inset 0 1px 0 var\(--r-hairline-strong\); \}/.test(css), 'a hairline between')
  assert.ok(!/\.is-split > span/.test(css), "nothing hangs on the Tooltip's wrapper")
  assert.ok(/\.deck-fold\.is-split \.deck-fold-button:hover \{ background: var\(--r-accent-soft\); color: var\(--r-accent\); \}/.test(css), 'the hover')
  // Keyboard focus looks the same, only in keyboard mode (the input-mode prefix every hand-written :focus-visible
  // carries, inputMode.test.ts), with the focus ring inside its half.
  assert.ok(/:where\(:root:not\(\[data-input-mode="pointer"\]\)\) \.deck-fold\.is-split \.deck-fold-button:focus-visible \{ background: var\(--r-accent-soft\); color: var\(--r-accent\); outline-offset: -2px; \}/.test(css), 'keyboard focus the same, the ring inside its half')
}

// The slide hidden: one round › at the handout's left edge, Show the slide, and nothing to hide the handout with.
{
  assert.deepEqual(labels(false, true), ['Show the slide'])
  const control = foldControl(false, true, 132)
  assert.equal(control.buttons.length, 1)
  assert.ok(control.at > 132, "inside the handout's left edge")
  assert.equal(control.buttons[0].icon, 'caret-right')
  const html = draw(false, true)
  assert.equal(html.querySelectorAll('.is-split').length, 0, 'no pill')
  assert.equal(html.querySelectorAll('[role=group]').length, 0)
  assert.equal(html.querySelectorAll('[title]').length, 0, 'no native title')
}

// The handout hidden: as today, one round ‹ Show the handout at the line, and nothing to hide the slide with.
{
  assert.deepEqual(labels(true, false), ['Show the handout'])
  const control = foldControl(true, false, 900)
  assert.equal(control.at, 878)
  assert.equal(control.buttons.length, 1)
}

// The two sides can't both be hidden: one fold value, and a press of either button brings its side back or folds it.
{
  assert.equal(toggledFold(null, 'slide'), 'slide')
  assert.equal(toggledFold('slide', 'slide'), null, 'Show the slide brings it back')
  assert.equal(toggledFold(null, 'handout'), 'handout')
  assert.equal(toggledFold('handout', 'handout'), null, 'Show the handout brings it back')
  assert.equal(toggledFold('handout', 'slide'), 'slide', 'folding the slide shows the handout again')
  for (const fold of [null, 'slide', 'handout'] as const) {
    for (const room of [true, false]) {
      const sides = foldedSides(fold, room)
      assert.ok(sides.slideShown || sides.handoutShown, `${fold}, room ${room}: one side always shows`)
    }
  }
  assert.deepEqual(foldedSides(null, true), { slideShown: true, handoutShown: true })
  assert.deepEqual(foldedSides('slide', true), { slideShown: false, handoutShown: true })
  assert.deepEqual(foldedSides('handout', true), { slideShown: true, handoutShown: false })
  // A desk too narrow for the handout folds it by itself; the slide then stays, whatever the deck kept.
  assert.deepEqual(foldedSides('slide', false), { slideShown: true, handoutShown: false })
}

// Each deck keeps its choice in its own view state, beside the divider's share; nothing goes to the host or the file.
{
  viewState = { deckRatio: 0.55 }
  assert.equal(storedFold(), null)
  keepFold('slide')
  assert.deepEqual(viewState, { deckRatio: 0.55, deckFold: 'slide' })
  assert.equal(storedFold(), 'slide')
  keepFold('handout')
  assert.deepEqual(viewState, { deckRatio: 0.55, deckFold: 'handout' })
  keepFold(null)
  assert.deepEqual(viewState, { deckRatio: 0.55 }, 'both sides shown is no entry at all')
  keepFold('handout')
  keepDeckViewState({ deckRatio: 0.5 })
  assert.deepEqual(viewState, { deckRatio: 0.5, deckFold: 'handout' }, "dragging the divider keeps the fold")
  viewState = undefined
  keepFold('slide')
  assert.deepEqual(viewState, { deckFold: 'slide' })
  assert.deepEqual(posted, [], 'the fold never reaches the host')
  // What the view kept is read strictly: anything else opens with both sides.
  assert.equal(foldFrom('slide'), 'slide')
  assert.equal(foldFrom('handout'), 'handout')
  for (const stored of [undefined, null, '', 'both', 1, true, {}]) assert.equal(foldFrom(stored), null)
}

// The deck view (its editor can't be drawn here, so its source is read): with the slide hidden, the stage, its
// Settings and the speaker notes in it go, and the divider's drag with them; the strip stays; the fold is read from the
// view state at mount and written only there, so opening a deck writes nothing.
{
  const { readFileSync } = await import('node:fs')
  // Whitespace folded to one space, so a reformat doesn't fail the test. `block` is the JSX expression `{…}` that opens
  // with the given words, to its matching brace.
  const view = readFileSync(new URL('./DeckView.tsx', import.meta.url), 'utf8').replace(/\s+/g, ' ')
  const block = (open: string) => {
    const at = view.indexOf(open)
    assert.ok(at >= 0, open)
    let depth = 0
    for (let i = at; i < view.length; i++) {
      if (view[i] === '{') depth++
      else if (view[i] === '}' && --depth === 0) return view.slice(at, i + 1)
    }
    return view.slice(at)
  }
  const stage = block('{slideShown ? ( <div ref={stageRef} className={`deck-stage')
  assert.ok(stage.includes('<Stage'), 'the stage is drawn only while the slide shows (Sprint 161: no notes fold under it)')
  // 17 November: Slide settings is the bar's gear. 16 November (the Experience lead): hiding the slide hides the stage,
  // not the current slide, so the gear stays ready and opens the same popup (and a deck with no slides opens its look, #764).
  assert.ok(view.includes('<Popover open={settingsOpen} onOpenChange={setSettingsOpen}>') && !view.includes('settingsReady'), 'Settings go with the current slide, shown or hidden')
  assert.ok(!block('const toggleFold = useCallback(').includes('setSettingsOpen'), 'hiding the slide leaves Settings as they are')
  assert.ok(block('{handoutShown && slideShown ? (').includes('deck-divider'), 'nothing to drag with one side')
  assert.ok(block('{stripShown ? ( <SlideStrip').length > 0 && !block('{stripShown ? ( <SlideStrip').includes('slideShown'), 'the strip stays, whatever the fold')
  assert.ok(view.includes('useState<DeckFold>(storedFold)'), 'the fold the view kept, at mount')
  assert.ok(view.includes('onToggle={toggleFold}') && block('const toggleFold = useCallback(').includes('keepFold(next)'), 'kept when a fold button is pressed')
  assert.ok(!/sendToExtension\([^)]*fold/i.test(view), 'never sent to the host')
  // A slide added from the strip with the slide hidden puts the caret in its part's first line, in the handout.
  const insert = block('insert: (at, kind) => {')
  assert.ok(/if \(slideShownRef\.current\) \{[^}]*setFocusTitleOf/.test(insert) && insert.includes('setTextSelection(pos)'), 'the caret goes to the handout')
  // The divider's share goes through the same view state as the fold.
  assert.ok(view.includes('keepDeckViewState({ deckRatio: ratio })'))
  // The handout alone is a Text document's column: the width is the editor's own, one number in Editor.tsx.
  assert.ok(view.includes("['--deck-text-column' as string]: `${TEXT_COLUMN_WIDTH}px`"), "the deck passes the editor's width")
  const editorSource = readFileSync(new URL('../Editor.tsx', import.meta.url), 'utf8')
  assert.ok(editorSource.includes('export const TEXT_COLUMN_WIDTH = 900') && editorSource.includes('max-width: ${TEXT_COLUMN_WIDTH}px !important'), "the Text editor's own rule uses the same number")
  const css = readFileSync(new URL('./decks.css', import.meta.url), 'utf8')
  assert.ok(/\.deck-handout\.is-solo, \.deck-handout\.is-above \{[^}]*var\(--deck-text-column/.test(css) && !/760px/.test(css), 'the solo column takes it, with no second copy')
  // Add to library with the slide hidden opens beside its thumbnail in the strip.
  assert.ok(view.includes('[data-thumb="${addSheet.number - 1}"]'), "the sheet is anchored to its thumbnail")
}

// With the slide above the handout (split along the long side, 16 November), the pill lies flat at the level line's
// right end: ˄ Hide the slide, then ˅ Hide the handout, each with its tooltip; the CSS turns the halves to 28×26 with a
// hairline between them. With one side hidden, the one round button stands at the handout's top right or at the slide's
// bottom right.
{
  const drawAbove = (slideShown: boolean, handoutShown: boolean) =>
    parse(renderToStaticMarkup(createElement(DeckFolds, { slideShown, handoutShown, line: 380, above: true, onToggle: () => {} })))
  const control = foldControl(true, true, 380, true)
  assert.equal(control.at, 380, 'on the level line')
  assert.deepEqual(control.buttons.map(b => [b.label, b.icon, b.side]), [['Hide the slide', 'caret-up', 'slide'], ['Hide the handout', 'caret-down', 'handout']])
  const pill = drawAbove(true, true).querySelector('.deck-fold')
  assert.ok(pill && pill.classList.contains('is-split') && pill.classList.contains('is-above'), 'the flat pill')
  assert.match(pill.getAttribute('style') ?? '', /top:\s*380px/, 'placed by its top, at the line')
  assert.doesNotMatch(pill.getAttribute('style') ?? '', /left/, 'never by its left: it sits at the right end (CSS)')
  assert.deepEqual(pill.querySelectorAll('button').map(b => b.getAttribute('aria-label')), ['Hide the slide', 'Hide the handout'])
  assert.equal(drawAbove(true, true).querySelectorAll('[title]').length, 0, 'no native title')
  const { Tooltip } = await import('../ui/tooltip')
  type Half = { type: unknown; props: { label: string; side: string } }
  const halves = DeckFolds({ slideShown: true, handoutShown: true, line: 380, above: true, onToggle: () => {} }).props.children as Half[]
  assert.ok(halves.every(half => half.type === Tooltip))
  assert.deepEqual(halves.map(half => [half.props.label, half.props.side]), [['Hide the slide', 'top'], ['Hide the handout', 'top']], 'tooltips over the flat pill')
  // Beside stays upright, placed by its left.
  const upright = draw(true, true).querySelector('.deck-fold')
  assert.ok(upright && !upright.classList.contains('is-above'))
  assert.match(upright.getAttribute('style') ?? '', /left:\s*500px/)
  const { readFileSync } = await import('node:fs')
  const css = readFileSync(new URL('./decks.css', import.meta.url), 'utf8').replace(/\s+/g, ' ')
  assert.ok(/\.deck-fold\.is-above \{ right: 28px; bottom: auto; margin-left: 0; margin-top: -13px; \}/.test(css), "at the line's right end, centred on it")
  assert.ok(/\.deck-fold\.is-split\.is-above \{ flex-direction: row; \}/.test(css), 'lying flat')
  assert.ok(/\.deck-fold\.is-split\.is-above \.deck-fold-button \{ width: 28px; height: 26px; \}/.test(css), '28×26 halves')
  assert.ok(/\.deck-fold\.is-split\.is-above \.deck-fold-button\.is-upper \{ border-radius: 13px 0 0 13px; \}/.test(css))
  assert.ok(/\.deck-fold\.is-split\.is-above \.deck-fold-button\.is-lower \{ border-radius: 0 13px 13px 0; box-shadow: inset 1px 0 0 var\(--r-hairline-strong\); \}/.test(css), 'an upright hairline between')
  assert.ok(/\.deck-divider\.is-above \{[^}]*right: 0;[^}]*cursor: row-resize;/.test(css), 'a level line, edge to edge, that drags')
  // One line, not two: above, the handout's top 8 px (more than the scroll rule's 6 px gap and the head's 1 px border)
  // are the desk's colour, over the text and under the line, so a part head's hairline never runs just under it.
  assert.ok(/\.deck-handout\.is-above::before \{[^}]*top: 0; height: 8px; z-index: 1; background: var\(--r-surface\); pointer-events: none; \}/.test(css), 'the handout top masked above')
  const { PART_TOP_GAP } = await import('./scrollRule')
  assert.ok(PART_TOP_GAP + 1 < 8, 'the mask covers the current head\'s border')
  assert.ok(!/\.deck-handout:not\(\.is-above\)::before|\.deck-handout::before/.test(css), 'beside keeps its handout as it was')

  // The slide hidden, above: ˅ Show the slide at the handout's top edge (the line at the room's top).
  const slideHidden = foldControl(false, true, 0, true)
  assert.deepEqual(slideHidden.buttons.map(b => [b.label, b.icon]), [['Show the slide', 'caret-down']])
  assert.equal(slideHidden.at, 22, "inside the handout's top edge")
  const one = drawAbove(false, true).querySelector('.deck-fold')
  assert.ok(one && !one.classList.contains('is-split') && one.classList.contains('is-above'))
  assert.equal(drawAbove(false, true).querySelectorAll('button').length, 1)
  // At the handout's top right, where the flat pill stood (the Experience lead, 17 November: the hand returns to the
  // same spot): placed by its top only, so it takes the pill's right 28 px (CSS), never by a left.
  const topRight = parse(renderToStaticMarkup(createElement(DeckFolds, { slideShown: false, handoutShown: true, line: 0, above: true, onToggle: () => {} }))).querySelector('.deck-fold')
  assert.match(topRight?.getAttribute('style') ?? '', /top:\s*22px/)
  assert.doesNotMatch(topRight?.getAttribute('style') ?? '', /left/)
  assert.ok(!/is-start/.test(css), 'no top-left place of its own')
  // The handout hidden, above: ˄ Show the handout at the slide's bottom end (the line at the room's bottom).
  const handoutHidden = foldControl(true, false, 700, true)
  assert.deepEqual(handoutHidden.buttons.map(b => [b.label, b.icon]), [['Show the handout', 'caret-up']])
  assert.equal(handoutHidden.at, 678)
  // Beside, the same states keep today's buttons.
  assert.deepEqual(foldControl(false, true, 132).buttons.map(b => b.icon), ['caret-right'])
  assert.deepEqual(foldControl(true, false, 900).buttons.map(b => b.icon), ['caret-left'])
}

console.log('DeckFolds: passed')
