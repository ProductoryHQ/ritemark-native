/**
 * The full slide view (Jarmo, 16 November): with the handout hidden, the wheel and the keys move between slides. One
 * slide per wheel gesture; keys never from an editable box or with a modifier; with the handout shown, nothing changes.
 *
 * Run: npx tsx webview/src/components/decks/slideNav.test.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { NO_GESTURE, WHEEL_QUIET_MS, WHEEL_STEP, boxScrolls, slideKeyOf, slideKeyTarget, wheelPixels, wheelRoute, wheelStep, wheelTaker, type WheelBox, type WheelGesture } from './slideNav'

/** A run of wheel events, `[delta, ms]`, from no gesture: the moves they make. */
function moves(events: Array<[number, number]>): number[] {
  let gesture: WheelGesture = NO_GESTURE
  const out: number[] = []
  for (const [delta, at] of events) {
    const step = wheelStep(gesture, delta, at)
    gesture = step.gesture
    if (step.move !== 0) out.push(step.move)
  }
  return out
}

// The wheel: the deltas add up to the step, then the slide moves once and the rest of the gesture is ignored.
{
  assert.equal(WHEEL_STEP, 40)
  assert.equal(WHEEL_QUIET_MS, 400)
  assert.deepEqual(moves([[10, 0], [10, 16], [10, 32]]), [], 'under the step: nothing')
  assert.deepEqual(moves([[10, 0], [10, 16], [10, 32], [10, 48]]), [1], 'the step reached: the next slide')
  assert.deepEqual(moves([[-25, 0], [-25, 16]]), [-1], 'up: the previous slide')
  assert.deepEqual(moves([[120, 0]]), [1], "one mouse wheel notch")
  // A trackpad flick: a burst and a long momentum tail, each event within 400 ms of the last. One slide, not ten.
  const flick: Array<[number, number]> = []
  for (let i = 0; i < 90; i++) flick.push([Math.max(1, 80 - i), i * 16])
  assert.deepEqual(moves(flick), [1], 'one slide per flick')
  // A mouse wheel turned notch by notch, about 120 ms apart: a slide a notch. Spun fast (16 ms apart), one.
  assert.deepEqual(moves([[100, 0], [100, 120], [100, 240], [100, 360]]), [1, 1, 1, 1], 'four notches, four slides')
  assert.deepEqual(moves([[100, 0], [100, 16], [100, 32], [100, 48]]), [1], 'a free spin is one gesture')
  assert.deepEqual(moves([[-3, 0], [-3, 120], [-3, 240]]), [], 'small slow deltas are not notches: they add up')
  // After 400 ms of stillness the next gesture moves again.
  assert.deepEqual(moves([[60, 0], [60, 16], [60, 16 + WHEEL_QUIET_MS], [60, 2000]]), [1, 1, 1])
  assert.deepEqual(moves([[60, 0], [10, WHEEL_QUIET_MS - 1]]), [1], 'a small delta just under 400 ms later: the same gesture')
  // Turning back before the step starts the sum again.
  assert.deepEqual(moves([[30, 0], [-30, 16], [-15, 32]]), [-1])
  assert.deepEqual(moves([[30, 0], [-5, 16], [30, 32]]), [], 'a wobble does not add up across directions')
  // Nothing from nothing.
  assert.deepEqual(moves([[0, 0], [Number.NaN, 16]]), [])
  // Lines and pages are turned into pixels.
  assert.equal(wheelPixels({ deltaY: 3, deltaMode: 1 }, 600), 120)
  assert.equal(wheelPixels({ deltaY: 1, deltaMode: 2 }, 600), 600)
  assert.equal(wheelPixels({ deltaY: 7, deltaMode: 0 }, 600), 7)
}

// What scrolls first (#824, Jarmo on 19 November: "Editori vaates raske navigeerida slaidide vahel"). Before, the stage
// took every wheel over the slide (a long column never scrolled: a flick over it went to the next slide) and, once the
// stage could scroll at all, gave the empty bands nothing to do at its end.
{
  // A fake box: its scroll, its overflow, its classes and its parent.
  type Box = WheelBox & { overflow: string; name: string }
  const box = (name: string, parent: Box | null, overflow = 'visible', scrollHeight = 100, clientHeight = 100, scrollTop = 0, classes: string[] = []): Box =>
    ({ name, overflow, scrollTop, scrollHeight, clientHeight, parentElement: parent, classList: { contains: (c: string) => classes.includes(c) } })
  const overflowOf = (b: Box) => b.overflow
  // The stage, in the full slide view: the slide alone fills it, so it has nothing to scroll.
  const stage = box('stage', null, 'auto', 780, 780)
  const group = box('group', stage)
  const big = box('big', group, 'hidden', 479, 479, 0, ['deck-big'])
  const words = box('words', big)
  // A column that holds more than its room (882 in 382), at its top; the same column at its end.
  const column = box('column', box('columns', big, 'hidden', 382, 382), 'auto', 882, 382, 0)
  const inColumn = box('li', column)
  const columnAtEnd = box('column', big, 'auto', 882, 382, 500)
  const inColumnAtEnd = box('li', columnAtEnd)

  // A box scrolls only when it scrolls (auto or scroll), holds more than its room, and has room left that way.
  assert.equal(boxScrolls(column, 'auto', 10), true)
  assert.equal(boxScrolls(column, 'auto', -10), false, 'at its top: nothing to scroll up')
  assert.equal(boxScrolls(columnAtEnd, 'auto', 10), false, 'at its end: nothing to scroll down')
  assert.equal(boxScrolls(columnAtEnd, 'auto', -10), true)
  assert.equal(boxScrolls(big, 'hidden', 10), false, 'a box that clips is never scrolled')
  assert.equal(boxScrolls({ scrollTop: 0, scrollHeight: 300, clientHeight: 100 }, 'hidden', 10), false, 'overflow hidden never scrolls')
  assert.equal(boxScrolls(stage, 'auto', 10), false, 'the stage that fits has nothing to scroll')
  assert.equal(boxScrolls(column, 'auto', 0), false)

  // Who takes the wheel: the column under the pointer while it can scroll that way, else the slide.
  assert.equal(wheelTaker(words, stage, 100, overflowOf), 'slide', 'over the words: the slide moves')
  assert.equal(wheelTaker(big, stage, 100, overflowOf), 'slide')
  assert.equal(wheelTaker(group, stage, 100, overflowOf), 'slide', 'over the empty band: the slide moves')
  assert.equal(wheelTaker(stage, stage, -100, overflowOf), 'slide', 'over the stage itself')
  assert.equal(wheelTaker(inColumn, stage, 100, overflowOf), 'box', 'a long column scrolls first')
  assert.equal(wheelTaker(inColumn, stage, -100, overflowOf), 'slide', 'at its top, up moves the slide back')
  assert.equal(wheelTaker(inColumnAtEnd, stage, 100, overflowOf), 'slide', 'at its end, down moves the slide on')
  assert.equal(wheelTaker(null, stage, 100, overflowOf), 'slide')
  // A stage taller than its room (a short window, a row under the slide): it scrolls first under the bands, to its end,
  // and then the bands move the slide; over the slide itself the slide moves, as before.
  const tall = box('stage', null, 'auto', 895, 780, 0)
  const tallGroup = box('group', tall)
  const tallBig = box('big', tallGroup, 'hidden', 479, 479, 0, ['deck-big'])
  assert.equal(wheelTaker(tallGroup, tall, 100, overflowOf), 'box', 'the band: the stage scrolls first')
  assert.equal(wheelTaker(tallBig, tall, 100, overflowOf), 'slide', 'the slide: it moves')
  const tallAtEnd = box('stage', null, 'auto', 895, 780, 115)
  assert.equal(wheelTaker(box('group', tallAtEnd), tallAtEnd, 100, overflowOf), 'slide', 'the band at the stage\'s end moves the slide (it did nothing)')
  assert.equal(wheelTaker(box('group', tallAtEnd), tallAtEnd, -100, overflowOf), 'box', 'and up scrolls the stage back')

  /** A run of wheel events, `[delta, ms, taker]`: the moves they make and how many the browser scrolls. */
  const route = (events: Array<[number, number, 'box' | 'slide']>) => {
    let gesture: WheelGesture = NO_GESTURE
    const out = { moves: [] as number[], scrolled: 0 }
    for (const [delta, at, taker] of events) {
      const step = wheelRoute(gesture, delta, at, taker)
      gesture = step.gesture
      if (step.move !== 0) out.moves.push(step.move)
      if (step.scroll) out.scrolled++
    }
    return out
  }
  // With nothing to scroll, the route is the slide's gesture, unchanged: one slide per gesture.
  const flick = (taker: 'box' | 'slide', from = 0): Array<[number, number, 'box' | 'slide']> =>
    Array.from({ length: 40 }, (_, i) => [Math.max(1, Math.round(24 * 0.9 ** i)), from + i * 16, taker])
  assert.deepEqual(route(flick('slide')), { moves: [1], scrolled: 0 }, 'a flick over the slide: one slide, nothing scrolls')
  assert.deepEqual(route([[100, 0, 'slide'], [100, 150, 'slide'], [-100, 300, 'slide']]).moves, [1, 1, -1], 'notches: a slide each')
  // A flick over a long column scrolls the column, and never the slide, even once the column reaches its end mid-flick.
  const intoEnd = flick('box').map(([d, t], i): [number, number, 'box' | 'slide'] => [d, t, i < 12 ? 'box' : 'slide'])
  assert.deepEqual(route(intoEnd), { moves: [], scrolled: 12 }, 'the column scrolls; its momentum never moves the slide')
  // The next flick, with the column at its end, moves the slide.
  assert.deepEqual(route([...intoEnd, ...flick('slide', 40 * 16 + WHEEL_QUIET_MS)]).moves, [1])
  // Mouse notches over a long column: each scrolls it while it can, and the notch at its end moves the slide.
  assert.deepEqual(route([[100, 0, 'box'], [100, 150, 'box'], [100, 300, 'box'], [100, 450, 'slide']]), { moves: [1], scrolled: 3 })
  // A gesture that moved the slide keeps the rest of it, even when the new slide brings a column under the pointer.
  assert.deepEqual(route([[30, 0, 'slide'], [30, 16, 'slide'], [20, 32, 'box'], [10, 48, 'box']]), { moves: [1], scrolled: 0 })
  // A first event with no delta decides nothing.
  assert.deepEqual(route([[0, 0, 'slide'], [30, 16, 'box']]), { moves: [], scrolled: 1 })
}

/** A fake element: its tag, whether it's editable, and the selectors it sits inside. */
function el(tagName: string, inside: string[], isContentEditable = false) {
  return { tagName, isContentEditable, closest: (selector: string) => (selector.split(',').some(one => inside.includes(one.trim())) ? {} : null) }
}
const body = { tagName: 'BODY', isContentEditable: false, closest: () => null }

// Where a key comes from.
{
  assert.equal(slideKeyTarget(body, body), 'page', 'nothing focused')
  assert.equal(slideKeyTarget(null, body), 'page')
  assert.equal(slideKeyTarget(el('DIV', ['.deck-stage']), body), 'page', 'the stage, outside its boxes')
  assert.equal(slideKeyTarget(el('BUTTON', ['.deck-stage', 'button']), body), 'button', 'Settings on the stage')
  assert.equal(slideKeyTarget(el('BUTTON', ['.deck-view-switch', 'button']), body), 'button', "the view switch's Slide only that just hid the handout (17 November)")
  assert.equal(slideKeyTarget(el('BUTTON', ['.deck-fold', 'button']), body), null, 'the fold control is gone')
  // Never from an editable box: a title or box being edited keeps its arrows for the caret.
  assert.equal(slideKeyTarget(el('DIV', ['.deck-stage'], true), body), null, 'a title being edited')
  assert.equal(slideKeyTarget(el('SPAN', ['.deck-stage', '[contenteditable="true"]']), body), null, 'inside one')
  assert.equal(slideKeyTarget(el('SPAN', ['.deck-stage', '[contenteditable="plaintext-only"]']), body), null, 'the speaker notes')
  assert.equal(slideKeyTarget(el('INPUT', ['.deck-stage']), body), null, 'a field')
  assert.equal(slideKeyTarget(el('TEXTAREA', []), body), null)
  // Nor from the strip (its own keys), a menu or a dialog, or the deck's bar.
  assert.equal(slideKeyTarget(el('DIV', ['.deck-strip']), body), null)
  assert.equal(slideKeyTarget(el('DIV', ['[role="menu"]', '.deck-stage']), body), null)
  assert.equal(slideKeyTarget(el('DIV', ['[role="dialog"]']), body), null)
  assert.equal(slideKeyTarget(el('BUTTON', ['.deck-bar', 'button']), body), null, 'Present, Publish, Card or Borderless keep theirs')
}

// The keys: ↓ → PageDown Space the next, ↑ ← PageUp the previous, Home and End the ends; clamped to the deck.
{
  const key = (k: string, extra: Record<string, boolean> = {}, from: 'page' | 'button' | null = 'page', count = 10, current = 4) =>
    slideKeyOf({ key: k, ...extra }, from, count, current)
  for (const k of ['ArrowDown', 'ArrowRight', 'PageDown', ' ']) assert.equal(key(k), 5, k)
  for (const k of ['ArrowUp', 'ArrowLeft', 'PageUp']) assert.equal(key(k), 3, k)
  assert.equal(key('Home'), 0)
  assert.equal(key('End'), 9)
  assert.equal(key('ArrowDown', {}, 'page', 10, 9), 9, 'the last stays the last')
  assert.equal(key('ArrowUp', {}, 'page', 10, 0), 0, 'the first stays the first')
  assert.equal(key('ArrowDown', {}, 'page', 3, 7), 2, 'a current past the end counts as the last')
  // Other keys are not ours.
  for (const k of ['Enter', 'Tab', 'a', 'Escape', 'Backspace']) assert.equal(key(k), null, k)
  // Never with a modifier: those are the app's and the system's (⌘↓, ⌥←, ⇧Space, Ctrl+PageDown…).
  for (const mod of ['metaKey', 'ctrlKey', 'altKey', 'shiftKey']) {
    for (const k of ['ArrowDown', 'ArrowUp', 'PageDown', ' ', 'Home', 'End']) assert.equal(key(k, { [mod]: true }), null, `${mod} ${k}`)
  }
  // Never while composing, never once handled, never from an editable box, never in an empty deck.
  assert.equal(key('ArrowDown', { isComposing: true }), null)
  assert.equal(key('ArrowDown', { defaultPrevented: true }), null)
  assert.equal(key('ArrowDown', {}, null), null, 'from a title being edited: the caret moves as now')
  assert.equal(key('ArrowDown', {}, 'page', 0, 0), null)
  // On a button, Space presses it; the arrows still move the slide.
  assert.equal(key(' ', {}, 'button'), null)
  assert.equal(key('ArrowRight', {}, 'button'), 5)
}

// The deck view (its source read): only with the handout hidden, through the strip's own path (pick), and the scroll
// rule untouched otherwise.
{
  const view = readFileSync(new URL('./DeckView.tsx', import.meta.url), 'utf8').replace(/\s+/g, ' ')
  assert.ok(view.includes('const fullSlide = slideShown && !handoutShown'))
  assert.ok(/if \(!fullSlide \|\| !stage\) return/.test(view) && /if \(!fullSlide\) return/.test(view), 'both listen only in the full slide view')
  assert.ok(/const goTo = useCallback\([^]*?pick\(next\)/.test(view), "the strip's own pick moves the slide")
  assert.ok(view.includes("stage.addEventListener('wheel', onWheel, { passive: false })"), 'the wheel over the stage')
  // #824: what scrolls first decides, and the bands are no longer left out once the stage can scroll.
  assert.ok(view.includes('const taker = wheelTaker(event.target as HTMLElement | null, stage, delta, box => getComputedStyle(box).overflowY)'))
  assert.ok(view.includes('const route = wheelRoute(gesture, delta, event.timeStamp, taker)') && view.includes('if (!route.scroll) event.preventDefault()'))
  assert.ok(!view.includes("!target?.closest?.('.deck-big')) return"), 'the early return for the bands is gone')
  // The handout's wheel rule is still there for the handout.
  assert.ok(view.includes('const stop = wheelStop(state, delta, currentRef.current)'))
}

console.log('slideNav: passed')
