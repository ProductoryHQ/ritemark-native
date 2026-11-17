/**
 * Slide, both or handout (experience 46; the view switch of 17 November, which replaced the fold arrows of 16 November):
 * the slide or the handout folds away, never both, chosen on the deck's bar; each deck keeps its choice in its own view
 * state, never in the file; the line between the panes only drags.
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
const { DeckViewSwitch, foldFrom, foldOfView, foldedSides, keepDeckViewState, keepFold, storedFold, viewOfFold, viewParts } = await import('./DeckFolds')
type DeckViewMode = 'slide' | 'both' | 'handout'

const draw = (view: DeckViewMode, above = false) =>
  parse(renderToStaticMarkup(createElement(DeckViewSwitch, { view, above, onView: () => {} })))

// The switch: one segment of three buttons, in order Slide only, Slide and handout, Handout only, each with its words
// and its icon; the chosen one raised (`data-state="active"`, `aria-pressed`). Layout glyphs, never arrows.
{
  for (const view of ['slide', 'both', 'handout'] as const) {
    const html = draw(view)
    const group = html.querySelectorAll('.deck-view-switch')
    assert.equal(group.length, 1, 'one segment')
    assert.equal(group[0].getAttribute('role'), 'group')
    const buttons = group[0].querySelectorAll('button')
    assert.deepEqual(buttons.map(button => button.getAttribute('aria-label')), ['Slide only', 'Slide and handout', 'Handout only'])
    assert.deepEqual(buttons.map(button => button.getAttribute('aria-pressed')), ['slide', 'both', 'handout'].map(each => String(each === view)), `${view}: the chosen one pressed`)
    assert.deepEqual(buttons.map(button => button.getAttribute('data-state') ?? ''), ['slide', 'both', 'handout'].map(each => (each === view ? 'active' : '')), `${view}: the chosen one raised`)
    assert.equal(html.querySelectorAll('[title]').length, 0, 'no native title: the shared Tooltip')
  }
  // The icons: the easel, two panes drawn the way the room is split now, and a page of lines.
  assert.deepEqual(viewParts(false).map(part => part.icon), ['presentation', 'square-split-horizontal', 'article'], 'side by side')
  assert.deepEqual(viewParts(true).map(part => part.icon), ['presentation', 'square-split-vertical', 'article'], 'the slide above')
  for (const part of [...viewParts(false), ...viewParts(true)]) assert.ok(!/caret|arrow|chevron/.test(part.icon), 'no arrow')
  // Each part in the shared Tooltip with its words, and each press chooses its view.
  const { Tooltip } = await import('../ui/tooltip')
  type Part = { type: unknown; props: { label: string; children: { props: { onClick: () => void } } } }
  const chosen: string[] = []
  const parts = DeckViewSwitch({ view: 'both', above: false, onView: view => { chosen.push(view) } }).props.children as Part[]
  assert.ok(parts.every(part => part.type === Tooltip), 'each part in the shared Tooltip')
  assert.deepEqual(parts.map(part => part.props.label), ['Slide only', 'Slide and handout', 'Handout only'])
  for (const part of parts) part.props.children.props.onClick()
  assert.deepEqual(chosen, ['slide', 'both', 'handout'], 'every view is reachable from the switch')
  // Its look (decks.css): the ground's segment, 30×24 parts, the chosen one on the desk's white with a hairline.
  const { readFileSync } = await import('node:fs')
  const css = readFileSync(new URL('./decks.css', import.meta.url), 'utf8').replace(/\s+/g, ' ')
  assert.ok(/\.deck-bar \.deck-view-switch \{[^}]*border-radius: 8px;[^}]*background: var\(--r-surface-muted\);/.test(css), 'the segment')
  assert.ok(/\.deck-view-part \{ width: 30px; height: 24px;/.test(css), '30×24 parts')
  assert.ok(/\.deck-view-part\[data-state="active"\] \{ background: var\(--r-surface\);[^}]*0 0 0 1px var\(--r-hairline\)/.test(css), 'the chosen one raised')
  // The fold arrows are gone: nothing of theirs is drawn or styled.
  assert.ok(!/deck-fold/.test(css), 'no fold control left in the CSS')
}

// The views and the fold: one value, so the two sides can never both be hidden.
{
  assert.equal(viewOfFold(null), 'both')
  assert.equal(viewOfFold('handout'), 'slide', 'the handout folded away is Slide only')
  assert.equal(viewOfFold('slide'), 'handout', 'the slide folded away is Handout only')
  for (const view of ['slide', 'both', 'handout'] as const) assert.equal(viewOfFold(foldOfView(view)), view, `${view} round trip`)
  for (const fold of [null, 'slide', 'handout'] as const) {
    for (const room of [true, false]) {
      const sides = foldedSides(fold, room)
      assert.ok(sides.slideShown || sides.handoutShown, `${fold}, room ${room}: one side always shows`)
    }
  }
  assert.deepEqual(foldedSides(null, true), { slideShown: true, handoutShown: true })
  assert.deepEqual(foldedSides('slide', true), { slideShown: false, handoutShown: true })
  assert.deepEqual(foldedSides('handout', true), { slideShown: true, handoutShown: false })
  // A desk too narrow for the handout (under 600 px) shows the slide only, whatever the deck kept.
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
  assert.deepEqual(viewState, { deckRatio: 0.5, deckFold: 'handout' }, 'dragging the divider keeps the view')
  viewState = undefined
  keepFold('slide')
  assert.deepEqual(viewState, { deckFold: 'slide' })
  assert.deepEqual(posted, [], 'the view never reaches the host')
  // What the view kept is read strictly: anything else (a deck opened again has nothing kept) opens with both.
  assert.equal(foldFrom('slide'), 'slide')
  assert.equal(foldFrom('handout'), 'handout')
  for (const stored of [undefined, null, '', 'both', 1, true, {}]) assert.equal(foldFrom(stored), null)
}

// The deck view (its editor can't be drawn here, so its source is read): the switch on the bar right after the strip's
// button and before "Slide N of M", only where the handout has room; the line between the panes is a separator with
// nothing on it; with the slide hidden, the stage goes and the strip stays.
{
  const { readFileSync } = await import('node:fs')
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
  const bar = view.slice(view.indexOf('<header className="deck-bar">'), view.indexOf('</header>'))
  const strip = bar.indexOf("aria-label=\"Slides\"")
  const switchAt = bar.indexOf('<DeckViewSwitch')
  const count = bar.indexOf('className="deck-count"')
  assert.ok(strip >= 0 && switchAt > strip && count > switchAt, "after the strip's button, before Slide N of M")
  assert.ok(bar.includes('{deskWidth >= NARROWEST_DESK ? <DeckViewSwitch view={viewShown} above={above} onView={chooseView} /> : null}'), 'only where the handout has room (under 600 px: Slide only)')
  assert.ok(view.includes("const viewShown: DeckViewMode = !handoutShown ? 'slide' : !slideShown ? 'handout' : 'both'"), 'the view as drawn')
  assert.ok(!view.includes('<DeckFolds') && !view.includes('toggleFold') && !view.includes('foldLine'), 'the fold arrows are gone')
  // The divider: a separator that drags, with no button on it or beside it.
  const divider = block('{handoutShown && slideShown ? (')
  assert.ok(divider.includes('deck-divider') && divider.includes('role="separator"') && divider.includes('onPointerDown={onDividerDown}'))
  assert.ok(!/<Button|<button|onClick/.test(divider), 'nothing on the line')
  const css = readFileSync(new URL('./decks.css', import.meta.url), 'utf8').replace(/\s+/g, ' ')
  assert.ok(/\.deck-divider \{[^}]*cursor: col-resize;/.test(css) && /\.deck-divider\.is-above \{[^}]*cursor: row-resize;/.test(css), 'a resize cursor')
  const stage = block('{slideShown ? ( <div ref={stageRef} className={`deck-stage')
  assert.ok(stage.includes('<Stage'), 'the stage is drawn only while the slide shows')
  assert.ok(view.includes('<Popover open={settingsFor !== null}') && !view.includes('settingsReady'), 'Settings go with their slide, shown or hidden')
  assert.ok(!block('const chooseView = useCallback(').includes('setSettingsFor'), 'hiding the slide leaves Settings as they are')
  assert.ok(block('{stripShown ? ( <SlideStrip').length > 0 && !block('{stripShown ? ( <SlideStrip').includes('slideShown'), 'the strip stays, whatever the view')
  assert.ok(view.includes('useState<DeckFold>(storedFold)'), 'the view the deck kept, at mount')
  assert.ok(block('const chooseView = useCallback(').includes('keepFold(next)'), 'kept when a part is pressed')
  assert.ok(!/sendToExtension\([^)]*fold/i.test(view), 'never sent to the host')
  const insert = block('insert: (at, kind) => {')
  assert.ok(/if \(slideShownRef\.current\) \{[^}]*setFocusTitleOf/.test(insert) && insert.includes('setTextSelection(pos)'), 'the caret goes to the handout')
  assert.ok(view.includes('keepDeckViewState({ deckRatio: ratio })'))
  assert.ok(view.includes("['--deck-text-column' as string]: `${TEXT_COLUMN_WIDTH}px`"), "the deck passes the editor's width")
  const editorSource = readFileSync(new URL('../Editor.tsx', import.meta.url), 'utf8')
  assert.ok(editorSource.includes('export const TEXT_COLUMN_WIDTH = 900') && editorSource.includes('max-width: ${TEXT_COLUMN_WIDTH}px !important'), "the Text editor's own rule uses the same number")
  assert.ok(/\.deck-handout\.is-solo, \.deck-handout\.is-above \{[^}]*var\(--deck-text-column/.test(css) && !/760px/.test(css), 'the solo column takes it, with no second copy')
  assert.ok(view.includes('[data-thumb="${addSheet.number - 1}"]'), 'the sheet is anchored to its thumbnail')
  assert.ok(/\.deck-handout\.is-above::before \{[^}]*top: 0; height: 8px; z-index: 1; background: var\(--r-surface\); pointer-events: none; \}/.test(css), 'the handout top masked above')
  // Slide only fills the room and sits in its middle (Jarmo, 17 November: "align slide to center... and fill the
  // space"): the whole-room size (`fullSlideWidthFor`, deckLayout.test.ts), the group the slide's own width, centred.
  assert.ok(view.includes('const slideAlone = slideShown && !handoutShown') && view.includes('slideAlone ? fullSlideWidthFor(stageWidth, stageHeight) :'), 'the whole room in Slide only')
  assert.ok(view.includes("${slideAlone ? ' is-alone' : ''}") && view.includes('above || slideAlone ? { width: bigWidth + STAGE_MARGIN * 2 }'), 'its group the slide\'s width')
  // A row under the slide scrolls with the stage; it never sizes the slide (review: it shrank as the row wrapped).
  assert.ok(view.includes('if (!above || slideAlone) return'), 'rows measured only above, beside the handout')
  assert.ok(css.includes('.deck-stage.is-alone { align-items: center; }') && css.includes('.deck-stage.is-alone .deck-stage-group { max-width: 100%; padding: 16px 0; }'), 'centred both ways')
}

console.log('DeckFolds: passed')
