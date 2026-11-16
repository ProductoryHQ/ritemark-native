/**
 * The full slide view (Jarmo, 16 November): with the handout hidden, the wheel and the keys move between slides. One
 * slide per wheel gesture; keys never from an editable box or with a modifier; with the handout shown, nothing changes.
 *
 * Run: npx tsx webview/src/components/decks/slideNav.test.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { NO_GESTURE, WHEEL_QUIET_MS, WHEEL_STEP, slideKeyOf, slideKeyTarget, wheelPixels, wheelStep, type WheelGesture } from './slideNav'

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
  // After 400 ms of stillness the next gesture moves again.
  assert.deepEqual(moves([[60, 0], [60, 16], [60, 16 + WHEEL_QUIET_MS], [60, 2000]]), [1, 1, 1])
  assert.deepEqual(moves([[60, 0], [60, WHEEL_QUIET_MS - 1]]), [1], 'just under 400 ms: the same gesture')
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
  assert.equal(slideKeyTarget(el('BUTTON', ['.deck-fold', 'button']), body), 'button', 'the fold button that just hid the handout')
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
  assert.ok(view.includes("stage.addEventListener('wheel', onWheel, { passive: false })"), 'the wheel over the slide')
  // The handout's wheel rule is still there for the handout.
  assert.ok(view.includes('const stop = wheelStop(state, delta, currentRef.current)'))
}

console.log('slideNav: passed')
