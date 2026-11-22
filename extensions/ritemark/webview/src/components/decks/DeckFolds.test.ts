/**
 * Slide, both or handout (experience 46; the view switch of 17 November, which replaced the fold arrows of 16 November):
 * the slide or the handout folds away, never both, chosen on the deck's bar; every deck opens in Slide only and the
 * choice lives only while it is open, never in the file or the view state (19 November); the line between the panes
 * only drags.
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
const { DeckViewSwitch, OPENING_FOLD, foldForFind, foldOfView, foldedSides, viewOfFold, viewParts } = await import('./DeckFolds')
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

// Every deck opens in Slide only (19 November), a new deck too: the start is a constant, and a fold an older build kept
// in the view state is never read. Nothing goes to the host or the file.
{
  assert.equal(viewOfFold(OPENING_FOLD), 'slide', 'Slide only')
  const folds = (await import('node:fs')).readFileSync(new URL('./DeckFolds.tsx', import.meta.url), 'utf8').replace(/\/\*\*[\s\S]*?\*\//g, '')
  assert.ok(!/deckFold|[Ss]toredFold|keepFold/.test(folds), 'nothing reads or keeps a fold')
  assert.deepEqual(posted, [], 'the view never reaches the host')
}

// Find borrows the handout: opened in Slide only it shows the handout beside, closed it goes back to Slide only; opened
// in another view it changes nothing; a view chosen while it is open (the loan cleared) holds when it closes.
{
  const open = foldForFind(true, 'handout', false)
  assert.deepEqual(open, { fold: null, borrowed: true }, 'Slide only: the handout comes in, on loan')
  assert.deepEqual(foldForFind(false, open.fold, open.borrowed), { fold: 'handout', borrowed: false }, 'closed: Slide only again')
  for (const fold of [null, 'slide'] as const) {
    const opened = foldForFind(true, fold, false)
    assert.deepEqual(opened, { fold, borrowed: false }, `${String(fold)}: nothing to borrow`)
    assert.deepEqual(foldForFind(false, opened.fold, opened.borrowed), { fold, borrowed: false }, `${String(fold)}: as it was`)
  }
  // No room for the handout (under 600 px): nothing to borrow. A deck with no slide left when Find closes keeps the handout.
  assert.deepEqual(foldForFind(true, 'handout', false, false), { fold: 'handout', borrowed: false }, 'no room: nothing borrowed')
  assert.deepEqual(foldForFind(false, null, true, true, false), { fold: null, borrowed: false }, 'no slide left: the handout stays')
  // The person picks Handout only while Find is open: chooseView clears the loan, and closing Find keeps that view.
  assert.deepEqual(foldForFind(false, 'slide', false), { fold: 'slide', borrowed: false }, 'the chosen view holds')
  // And picks Slide only while Find is open: the handout folds, and closing Find keeps Slide only.
  assert.deepEqual(foldForFind(false, 'handout', false), { fold: 'handout', borrowed: false })
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
  const bar = view.slice(view.indexOf('<header className="deck-bar"'), view.indexOf('</header>'))
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
  assert.ok(view.includes('useState<DeckFold>(OPENING_FOLD)'), 'Slide only at mount, every deck')
  assert.ok(/if \(slidesOf\(editor\.state\.doc\)\.length === 0\) setFold\(current => \(current === 'handout' \? null : current\)\)/.test(view), 'a deck with no slide opens with the handout')
  const findEffect = block('const next = foldForFind(')
  assert.ok(view.includes('const next = foldForFind(findOpen, seen.fold, findBorrowedHandout.current, seen.handoutRoom, seen.hasSlides)') && /pick\(currentRef\.current\)\) \}, \[findOpen\]\)/.test(view.slice(view.indexOf('const next = foldForFind('))), 'Find borrows the handout as it opens and closes, and only then')
  assert.ok(findEffect.length > 0)
  assert.ok(block('const chooseView = useCallback(').includes('findBorrowedHandout.current = false'), 'a view chosen while Find is open ends the loan')
  // The choice holds while the deck is open because its webview keeps its context when hidden.
  const provider = readFileSync(new URL('../../../../src/ritemarkEditor.ts', import.meta.url), 'utf8').replace(/\s+/g, ' ')
  assert.ok(provider.includes('webviewOptions: { retainContextWhenHidden: true }'), 'the deck keeps its view while hidden')
  const choose = block('const chooseView = useCallback(')
  assert.ok(choose.includes('setFold(next)') && !/keep|saveState|deckFold/.test(choose), 'held while open, never kept')
  assert.ok(!/deckFold|storedFold|keepFold/.test(view), 'nothing else reads or keeps the view')
  // The published page is the reader's: its code never reads the editor's view, so Slide and text stays its default.
  const { readdirSync } = await import('node:fs')
  const decksDir = new URL('../../../../src/decks/', import.meta.url)
  const pageSources = readdirSync(decksDir, { recursive: true }).map(String).filter(name => /\.tsx?$/.test(name) && !/\.test\./.test(name) && /^page\/|deckPublish|deckPages/.test(name))
  assert.ok(pageSources.includes('deckPublish.ts') && pageSources.includes('deckPages.ts'), 'the page code is read')
  for (const name of pageSources) assert.ok(!/DeckFolds|OPENING_FOLD|deckFold/.test(readFileSync(new URL(name, decksDir), 'utf8')), `${name} keeps its own default`)
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
  assert.ok(view.includes('const slideAlone = slideShown && !handoutShown') && view.includes('slideAlone ? fullSlideWidthFor(stageWidth, stageHeight, slideCardUnder) :'), 'the whole room in Slide only')
  // #917: a new deck's start card under the slide keeps its room (its rows don't wrap), so both fit without scrolling;
  // with no card the slide has the whole room again.
  assert.ok(view.includes("const startUnderSlide = startPlace === 'slide'") && view.includes('card.offsetHeight + START_CARD_SLIDE_GAP'), "the card's room under the slide")
  assert.ok(view.includes('Math.min(slideCardRoom, Math.max(0, Math.floor(stageHeight / 2)))'), 'at most half the stage, so a tall card never shrinks the slide to nothing')
  assert.ok(view.includes("${slideAlone ? ' is-alone' : ''}") && view.includes('above || slideAlone ? { width: bigWidth + STAGE_MARGIN * 2 }'), 'its group the slide\'s width')
  // A row under the slide scrolls with the stage; it never sizes the slide (review: it shrank as the row wrapped).
  assert.ok(view.includes('if (!above || slideAlone) return'), 'rows measured only above, beside the handout')
  assert.ok(css.includes('.deck-stage.is-alone { align-items: center; }') && css.includes('.deck-stage.is-alone .deck-stage-group { max-width: 100%; padding: 16px 0; }'), 'centred both ways')
}

console.log('DeckFolds: passed')
