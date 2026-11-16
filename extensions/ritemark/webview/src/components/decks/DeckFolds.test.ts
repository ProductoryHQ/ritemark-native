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
  parse(renderToStaticMarkup(createElement(DeckFolds, { slideShown, handoutShown, left: 500, onToggle: () => {} })))
const labels = (slideShown: boolean, handoutShown: boolean) =>
  draw(slideShown, handoutShown).querySelectorAll('button').map(button => button.getAttribute('aria-label'))

// Both sides shown: the line carries one split control, a pill upright on the line: ‹ Hide the slide over › Hide the
// handout (Jarmo, 16 November: "see võiks olla split button").
{
  assert.deepEqual(labels(true, true), ['Hide the slide', 'Hide the handout'])
  const control = foldControl(true, true, 500)
  assert.equal(control.buttons.length, 2)
  assert.equal(control.left, 500, 'on the line')
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
    DeckFolds({ slideShown: true, handoutShown: true, left: 500, onToggle }).props.children as Half[]
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
  assert.ok(/\.deck-fold\.is-split \.deck-fold-button:hover, \.deck-fold\.is-split \.deck-fold-button:focus-visible \{ background: var\(--r-accent-soft\); color: var\(--r-accent\); \}/.test(css), 'the hover, and keyboard focus the same')
  assert.ok(/\.deck-fold\.is-split \.deck-fold-button:focus-visible \{ outline-offset: -2px; \}/.test(css), 'the focus ring inside its half')
}

// The slide hidden: one round › at the handout's left edge, Show the slide, and nothing to hide the handout with.
{
  assert.deepEqual(labels(false, true), ['Show the slide'])
  const control = foldControl(false, true, 132)
  assert.equal(control.buttons.length, 1)
  assert.ok(control.left > 132, "inside the handout's left edge")
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
  assert.equal(control.left, 878)
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
  const stage = block('{slideShown ? ( <div className={`deck-stage')
  assert.ok(stage.includes('<Stage') && stage.includes('notesOpen={notesOpen}'), 'the stage and its notes are drawn only while the slide shows')
  // 17 November: Slide settings is the bar's gear, ready only while the slide shows (folded away, it's disabled).
  assert.ok(view.includes('const settingsReady = slideShown && !!slide') && view.includes('<Popover open={settingsOpen && settingsReady}'), 'Settings go with the slide')
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
  assert.ok(/\.deck-handout\.is-solo \{[^}]*var\(--deck-text-column/.test(css) && !/760px/.test(css), 'the solo column takes it, with no second copy')
  // Add to library with the slide hidden opens beside its thumbnail in the strip.
  assert.ok(view.includes('[data-thumb="${addSheet.number - 1}"]'), "the sheet is anchored to its thumbnail")
}

console.log('DeckFolds: passed')
