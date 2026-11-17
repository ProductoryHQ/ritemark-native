/**
 * Where the slide goes: split along the long side (experience 46, 16 November). Beside while a 400 px slide and 600 px
 * of handout text both fit (a room of 1,100), above when the room is narrower, with a little hysteresis; each
 * orientation keeps its own share in the view state; opening a deck writes nothing.
 *
 * Run: npx tsx webview/src/components/decks/deckLayout.test.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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

const {
  ABOVE_PANE_MIN, ABOVE_RATIO_DEFAULT, ABOVE_STAGE_ROOM, rowsUnder, ABOVE_RATIO_MAX, ABOVE_RATIO_MIN, BESIDE_ROOM, BESIDE_SLIDE_MIN, BESIDE_TEXT_MIN,
  BIG_MAX, ORIENTATION_HYSTERESIS, aboveLineFor, clampAboveRatio, fullSlideWidthFor, initialAboveRatio, orientationFor, slideWidthFor,
} = await import('./deckLayout')
const { deckViewState, keepDeckViewState, keepFold } = await import('./DeckFolds')
const { initialRatio, DEFAULT_RATIO } = await import('./deckDocument')

// The rule: beside from a room of 1,100 (a 400 px slide and 600 px of text), above under it.
{
  assert.equal(BESIDE_ROOM, 1100)
  assert.ok(BESIDE_SLIDE_MIN + BESIDE_TEXT_MIN <= BESIDE_ROOM)
  // The first decision, as the deck opens: the threshold alone.
  assert.equal(orientationFor(1440, null), 'beside', 'a 1920 px display with the AI open')
  assert.equal(orientationFor(1244, null), 'beside', 'a 1440 laptop, every panel folded')
  assert.equal(orientationFor(1100, null), 'beside', 'exactly 1,100 fits')
  assert.equal(orientationFor(1099, null), 'above', 'one pixel less does not')
  assert.equal(orientationFor(900, null), 'above', 'the AI open on a laptop')
  assert.equal(orientationFor(996, null), 'above', 'the left column open on a laptop')
  assert.equal(orientationFor(500, null), 'above')
  // Not measured yet: what is shown stays.
  assert.equal(orientationFor(0, null), 'beside')
  assert.equal(orientationFor(0, 'above'), 'above')
  assert.equal(orientationFor(Number.NaN, 'above'), 'above')
}

// Hysteresis: beside never shows under 1,100; once above, the room must reach 1,100 + 24 before it goes beside again,
// so a window dragged at the boundary doesn't flicker.
{
  assert.equal(ORIENTATION_HYSTERESIS, 24)
  // From beside, shrinking: beside down to 1,100, above at 1,099.
  for (const room of [1300, 1124, 1110, 1101, 1100]) assert.equal(orientationFor(room, 'beside'), 'beside', `beside at ${room}`)
  for (const room of [1099, 1080, 1000]) assert.equal(orientationFor(room, 'beside'), 'above', `above at ${room}`)
  // From above, growing: above up to 1,123, beside at 1,124.
  for (const room of [1099, 1100, 1110, 1123]) assert.equal(orientationFor(room, 'above'), 'above', `still above at ${room}`)
  for (const room of [1124, 1200]) assert.equal(orientationFor(room, 'above'), 'beside', `beside again at ${room}`)
  // A window jittering across 1,100 by a few pixels moves the slide once, not on every frame.
  let shown: 'beside' | 'above' | null = null
  const seen: string[] = []
  for (const room of [1110, 1098, 1102, 1097, 1105, 1099, 1112, 1101]) {
    const next: 'beside' | 'above' = orientationFor(room, shown)
    if (next !== shown) seen.push(next)
    shown = next
  }
  assert.deepEqual(seen, ['beside', 'above'], 'one change across the jitter')
  // The decision is a fixed point: deciding again with the same room changes nothing.
  for (const room of [900, 1099, 1100, 1110, 1123, 1124, 1500]) {
    for (const before of [null, 'beside', 'above'] as const) {
      const once = orientationFor(room, before)
      assert.equal(orientationFor(room, once), once, `${room} from ${before}`)
    }
  }
}

// Above: the level line at half the height by default, never leaving a pane under 160 px when the room has the height.
{
  assert.equal(ABOVE_RATIO_DEFAULT, 0.5)
  assert.equal(aboveLineFor(800, 0.5), 400)
  assert.equal(aboveLineFor(800, ABOVE_RATIO_MIN), 200)
  assert.equal(aboveLineFor(500, ABOVE_RATIO_MIN), ABOVE_PANE_MIN, 'the slide keeps 160')
  assert.equal(aboveLineFor(500, ABOVE_RATIO_MAX), 500 - ABOVE_PANE_MIN, 'the handout keeps 160')
  assert.equal(aboveLineFor(800, 0.1), 200, 'a share out of bounds is held to them')
  assert.equal(aboveLineFor(0, 0.5), 0)
  assert.equal(clampAboveRatio(0.9), ABOVE_RATIO_MAX)
  assert.equal(clampAboveRatio(Number.NaN), ABOVE_RATIO_DEFAULT)
}

// The slide's width: beside, the width alone (the stage scrolls); above, centred and capped by its pane's height too.
{
  assert.equal(slideWidthFor(500, 300, false), 452)
  assert.equal(slideWidthFor(2000, 300, false), BIG_MAX, 'at most 900')
  // 1440 × 900 with the AI open (the dev window's desk: 900 × 780 beside the strip), the line at half: the slide takes
  // the pane's height less 32, at 16:9 (the Experience lead measured 636, up from 498 with the rows around it).
  const line = aboveLineFor(780, 0.5)
  assert.equal(line, 390)
  assert.equal(slideWidthFor(900, line, true), 636)
  assert.equal(slideWidthFor(1000, 800, true), 900, 'a tall pane: the width and 900 cap it')
  assert.equal(slideWidthFor(600, 800, true), 552, 'a narrow pane: the width caps it')
  assert.equal(slideWidthFor(1000, 20, true), 0, 'never negative')
  // A row still under the slide (today the speaker notes', 48 px with its margin), measured from the stage as drawn:
  // the slide shrinks so the stage fits its pane, never overflowing it. With no row, it is the pane less 32 again.
  // Slide only fills the room (Jarmo, 17 November: "align slide to center... and fill the space"): his ~2000 px
  // window, the AI folded, the strip open: no 900 cap; bound by the height on a wide room, by the width on a tall one.
  assert.equal(fullSlideWidthFor(1810, 860), Math.floor(((860 - ABOVE_STAGE_ROOM) * 16) / 9), 'a wide room: the height binds')
  assert.ok(fullSlideWidthFor(1810, 860) > BIG_MAX, 'past the side-by-side cap')
  assert.equal(fullSlideWidthFor(700, 900), 700 - 48, 'a tall room: the width binds')
  assert.equal(fullSlideWidthFor(1810, 860, 40), Math.floor(((860 - ABOVE_STAGE_ROOM - 40) * 16) / 9), 'a row under it')
  assert.equal(fullSlideWidthFor(30, 20), 0, 'never negative')
  assert.equal(rowsUnder(16 + 358 + 48 + 16, 358), 48, 'the notes row, measured')
  assert.equal(rowsUnder(16 + 358 + 16, 358), 0, 'no row')
  assert.equal(rowsUnder(300, 358), 0, 'never negative')
  assert.equal(rowsUnder(Number.NaN, 358), 0)
  const withRow = slideWidthFor(900, 390, true, 48)
  assert.equal(withRow, 551, 'a row present: (390 - 32 - 48) × 16/9')
  assert.ok(Math.round(withRow * 9 / 16) + ABOVE_STAGE_ROOM + 48 <= 390, 'the stage fits its pane: no overflow, no scrollbar')
  assert.equal(slideWidthFor(900, 390, true, 0), 636, 'the row gone: back to the pane less 32')
  assert.equal(slideWidthFor(900, 390, true, -5), 636, 'a negative row counts as none')
  // The handout hidden, above: the full room, the slide bound by the width, the row under it fits.
  assert.equal(slideWidthFor(900, 780, true, 48), 852)
  assert.ok(Math.round(852 * 9 / 16) + ABOVE_STAGE_ROOM + 48 <= 780)
  // Beside, the row changes nothing: the slide is bound by its width and its pane scrolls as before.
  assert.equal(slideWidthFor(517, 780, false, 48), 469)
  // The deck view measures it from the stage as drawn, above only, and only a real change moves the slide.
  const viewSource = readFileSync(new URL('./DeckView.tsx', import.meta.url), 'utf8').replace(/\s+/g, ' ')
  assert.ok(viewSource.includes('slideWidthFor(stageWidth, stageHeight, above, aboveUnder)'))
  assert.ok(viewSource.includes('const under = rowsUnder(group.offsetHeight, big.offsetHeight)') && viewSource.includes('if (Math.abs(under - aboveUnder) > 1) setAboveUnder(under)'))
  // Above, the slide always fits its pane's height, with 32 to spare.
  for (const height of [200, 300, 414, 600]) assert.ok(Math.round(slideWidthFor(1200, height, true) * 9 / 16) + ABOVE_STAGE_ROOM <= height)
}

// Each orientation keeps its own share in the view state, beside the fold, and both come back after a reload (the
// webview's state outlives a reload; the view reads it again at mount).
{
  viewState = undefined
  assert.equal(initialRatio(deckViewState().deckRatio), DEFAULT_RATIO, 'nothing kept: 40 to 60 beside')
  assert.equal(initialAboveRatio(deckViewState().deckAboveRatio), ABOVE_RATIO_DEFAULT, 'nothing kept: half above')
  keepDeckViewState({ deckRatio: 0.55 })
  keepDeckViewState({ deckAboveRatio: 0.35 })
  keepFold('handout')
  assert.deepEqual(viewState, { deckRatio: 0.55, deckAboveRatio: 0.35, deckFold: 'handout' }, 'one never overwrites the other')
  keepDeckViewState({ deckRatio: 0.6 })
  assert.deepEqual(viewState, { deckRatio: 0.6, deckAboveRatio: 0.35, deckFold: 'handout' }, 'dragging beside keeps the share above')
  // The reload: the state is read again from scratch.
  const reloaded = JSON.parse(JSON.stringify(viewState))
  viewState = reloaded
  assert.equal(initialRatio(deckViewState().deckRatio), 0.6)
  assert.equal(initialAboveRatio(deckViewState().deckAboveRatio), 0.35)
  // A kept share out of bounds, or not a number, opens with the default.
  for (const stored of [0.1, 0.9, '0.4', null, Number.NaN]) assert.equal(initialAboveRatio(stored), ABOVE_RATIO_DEFAULT)
  assert.deepEqual(posted, [], 'the shares never reach the host')
}

// The deck view (its editor can't be drawn here, so its source is read): it measures its own box, never the window;
// the orientation is never kept anywhere; each share is kept only when its line's drag ends; so opening a deck writes
// nothing.
{
  const view = readFileSync(new URL('./DeckView.tsx', import.meta.url), 'utf8').replace(/\s+/g, ' ')
  assert.ok(!/window\.inner(Width|Height)|screen\.(width|height)/.test(view), 'never the window')
  assert.ok(view.includes('new ResizeObserver(measure)') && view.includes('setDeskWidth(desk.clientWidth)') && view.includes('setDeskHeight(desk.clientHeight)'), "the desk's own box")
  assert.ok(view.includes('orientationFor(avail, shownNow)'), 'the room is the desk less the strip')
  assert.ok(/const avail = Math\.max\(0, deskWidth - stripWidth\)/.test(view))
  assert.ok(!/keep\w*\([^)]*orientation/i.test(view) && !/deckOrientation/.test(view), 'the orientation is never kept')
  assert.ok(!/sendToExtension\([^)]*(orientation|Ratio)/.test(view), 'nor sent to the host')
  // keepRatio and keepAboveRatio are called once each, in the drag's end, and nowhere else.
  const calls = (name: string) => view.split(`${name}(`).length - 1
  assert.equal(calls('keepRatio'), 1, 'called once')
  assert.equal(calls('keepAboveRatio'), 1, 'called once')
  const up = view.slice(view.indexOf('const up = () => {'), view.indexOf('const up = () => {') + 300)
  assert.ok(up.includes('if (above) keepAboveRatio(aboveRatioRef.current) else keepRatio(ratioRef.current)'), 'kept when the drag ends')
  // The share kept is the line as it was shown (held 160 px from either edge), so it comes back where it was seen.
  assert.ok(view.includes('setAboveRatio(clampAboveRatio(aboveLineFor(box.height, (moveEvent.clientY - box.top) / box.height) / box.height))'))
  const kept = clampAboveRatio(aboveLineFor(500, 0.25) / 500)
  assert.equal(aboveLineFor(500, kept), 160, 'on the same window, the same line')
  assert.equal(aboveLineFor(1000, kept), 320, 'on a taller one, the same share of it, not 25 %')
  assert.ok(view.includes('useState(() => initialAboveRatio(storedAboveRatio()))') && view.includes('useState(() => initialRatio(storedRatio()))'), 'both read at mount')
  // Moving between beside and above keeps the part being read at the top, but not as the deck opens.
  assert.ok(/if \(before === null \|\| before === orientation\) return/.test(view))
}

console.log('deckLayout: passed')
