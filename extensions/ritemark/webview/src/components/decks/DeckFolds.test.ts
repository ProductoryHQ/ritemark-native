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
const { DeckFolds, foldButtons, foldFrom, foldedSides, keepDeckViewState, keepFold, storedFold, toggledFold } = await import('./DeckFolds')

const draw = (slideShown: boolean, handoutShown: boolean) =>
  parse(renderToStaticMarkup(createElement(DeckFolds, { slideShown, handoutShown, left: 500, onToggle: () => {} })))
const labels = (slideShown: boolean, handoutShown: boolean) =>
  draw(slideShown, handoutShown).querySelectorAll('button').map(button => button.getAttribute('aria-label'))

// Both sides shown: the line carries two round buttons, ‹ Hide the slide over › Hide the handout, at the line.
{
  assert.deepEqual(labels(true, true), ['Hide the slide', 'Hide the handout'])
  const [upper, lower] = foldButtons(true, true, 500)
  assert.equal(upper.left, 500)
  assert.equal(lower.left, 500)
  assert.ok(upper.bottom > lower.bottom, 'Hide the slide is above Hide the handout')
  assert.equal(lower.bottom, 28, 'Hide the handout stays where the one fold was')
  assert.equal(upper.icon, 'caret-left')
  assert.equal(lower.icon, 'caret-right')
  // Each is the shared round fold button, with the shared tooltip and never a native title.
  const html = draw(true, true)
  assert.equal(html.querySelectorAll('.deck-fold-button').length, 2)
  assert.equal(html.querySelectorAll('[title]').length, 0, 'no native title')
}

// The slide hidden: one › at the handout's left edge, Show the slide, and nothing to hide the handout with.
{
  assert.deepEqual(labels(false, true), ['Show the slide'])
  const [show] = foldButtons(false, true, 132)
  assert.ok(show.left > 132, "inside the handout's left edge")
  assert.equal(show.icon, 'caret-right')
}

// The handout hidden: as today, one ‹ Show the handout at the line, and nothing to hide the slide with.
{
  assert.deepEqual(labels(true, false), ['Show the handout'])
  const [show] = foldButtons(true, false, 900)
  assert.equal(show.left, 878)
  assert.equal(show.bottom, 28)
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
  assert.ok(stage.includes('<Stage') && stage.includes('notesOpen={notesOpen}') && stage.includes('onSettings='), 'the stage, its notes and its Settings button are drawn only while the slide shows')
  assert.ok(block('{settingsOpen && slideShown').includes('<SlideSettings'), 'Settings go with the slide')
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
}

console.log('DeckFolds: passed')
