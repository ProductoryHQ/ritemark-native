/**
 * The full slide view (Jarmo, 16 November): with the handout hidden, the wheel and the keys move between slides. One
 * slide per wheel gesture; keys never from an editable box or with a modifier; with the handout shown, nothing changes.
 *
 * Run: npx tsx webview/src/components/decks/slideNav.test.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { NO_GESTURE, WHEEL_QUIET_MS, WHEEL_STEP, boxScrolls, slideKeyOf, slideKeyTarget, stageScrollAfter, stageWheelOf, wheelPixels, wheelRoute, wheelStep, wheelTaker, type WheelBox, type WheelGesture } from './slideNav'

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

  // Who takes the wheel: the column under the pointer while it can scroll that way, else nothing and the slide moves.
  const taker = (target: Box | null, on: Box, delta: number) => wheelTaker(target, on, delta, overflowOf)?.name ?? 'slide'
  assert.equal(taker(words, stage, 100), 'slide', 'over the words: the slide moves')
  assert.equal(taker(big, stage, 100), 'slide')
  assert.equal(taker(group, stage, 100), 'slide', 'over the empty band: the slide moves')
  assert.equal(taker(stage, stage, -100), 'slide', 'over the stage itself')
  assert.equal(taker(inColumn, stage, 100), 'column', 'a long column scrolls first')
  assert.equal(taker(inColumn, stage, -100), 'slide', 'at its top, up moves the slide back')
  assert.equal(taker(inColumnAtEnd, stage, 100), 'slide', 'at its end, down moves the slide on')
  assert.equal(taker(null, stage, 100), 'slide')
  // A stage taller than its room (a short window, a row under the slide): it scrolls first under the bands, to its end,
  // and then the bands move the slide; over the slide itself the slide moves, as before.
  const tall = box('stage', null, 'auto', 895, 780, 0)
  const tallGroup = box('group', tall)
  const tallBig = box('big', tallGroup, 'hidden', 479, 479, 0, ['deck-big'])
  assert.equal(taker(tallGroup, tall, 100), 'stage', 'the band: the stage scrolls first')
  assert.equal(taker(tallBig, tall, 100), 'slide', 'the slide: it moves')
  const tallAtEnd = box('stage', null, 'auto', 895, 780, 115)
  assert.equal(taker(box('group', tallAtEnd), tallAtEnd, 100), 'slide', "the band at the stage's end moves the slide (it did nothing)")
  assert.equal(taker(box('group', tallAtEnd), tallAtEnd, -100), 'stage', 'and up scrolls the stage back')

  // Slide and handout (#855, the Experience lead after Jarmo's "mina eelistan alati consistencyt"): a gesture means the
  // same in every view, by side of the room. Before, the stage's wheel listened in Slide only, so beside the handout
  // nothing on the slide's side moved the slide. Anywhere on the slide's side (the slide and the space around it in its
  // pane) a gesture means slides: a long column first, then the stage while it can scroll, then the slide, as in Slide
  // only. The handout's side means text (the scroll rule, untouched).
  const beside = (target: Box | null, on: Box, delta: number) => wheelTaker(target, on, delta, overflowOf, 'beside')?.name ?? 'slide'
  assert.equal(beside(words, stage, 100), 'slide', 'beside the handout, over the words: the slide moves')
  assert.equal(beside(big, stage, -100), 'slide')
  assert.equal(beside(inColumn, stage, 100), 'column', 'a long column scrolls first')
  assert.equal(beside(inColumn, stage, -100), 'slide', 'at its top, up moves the slide back')
  assert.equal(beside(inColumnAtEnd, stage, 100), 'slide', 'at its end, down moves the slide on')
  assert.equal(beside(group, stage, 100), 'slide', 'the band beside the handout: the slide moves (the stage fits)')
  assert.equal(beside(stage, stage, -100), 'slide', 'over the stage itself')
  assert.equal(beside(tallGroup, tall, 100), 'stage', 'a stage taller than its room scrolls first under the band')
  assert.equal(beside(box('group', tallAtEnd), tallAtEnd, 100), 'slide', "at the stage's end the band moves the slide on")
  assert.equal(beside(box('group', tallAtEnd), tallAtEnd, -100), 'stage', 'and up scrolls the stage back first')
  // Beside the handout the slide keeps its width in a short window, so it can be taller than the stage (review of #871):
  // over the slide the stage then scrolls first, as a long column does, so the slide's foot can be reached; at its end
  // the slide moves. In Slide only the slide fits the stage, and over it the slide moves, as before.
  assert.equal(beside(tallBig, tall, 100), 'stage', 'over the slide on a stage shorter than the slide: the stage scrolls first')
  const tallAtEndBig = box('big', box('group', tallAtEnd), 'hidden', 479, 479, 0, ['deck-big'])
  assert.equal(beside(tallAtEndBig, tallAtEnd, 100), 'slide', "at the stage's end the slide moves on")
  assert.equal(beside(tallAtEndBig, tallAtEnd, -100), 'stage', 'and up scrolls the stage back first')
  assert.equal(taker(tallBig, tall, 100), 'slide', 'Slide only: over the slide the slide moves, whatever the stage')
  assert.equal(wheelTaker(group, stage, 100, overflowOf, 'alone')?.name ?? 'slide', 'slide', "Slide only's bands are unchanged")
  // Which views route the stage's wheel: Slide only and Slide and handout, never Handout only (no slide on show).
  assert.equal(stageWheelOf(true, false), 'alone', 'Slide only')
  assert.equal(stageWheelOf(true, true), 'beside', "Slide and handout: the wheel on the slide's side moves it too")
  assert.equal(stageWheelOf(false, true), null, 'Handout only: no stage')
  assert.equal(stageWheelOf(false, false), null)

  /**
   * A run of wheel events, `[delta, ms, over]`, on a long column (882 in 382) and a tall stage, each scrolled as the
   * browser would when the route lets it (the latched box takes the delta, up to its end). The moves, how many events
   * the browser scrolled, where the column ended, and how often what's under the pointer was asked.
   */
  const route = (events: Array<[number, number, 'column' | 'slide' | 'band']>, columnTop = 0) => {
    const col = box('column', big, 'auto', 882, 382, columnTop)
    const tallStage = box('stage', null, 'auto', 895, 780, 0)
    let gesture: WheelGesture = NO_GESTURE
    const out = { moves: [] as number[], scrolled: 0, column: 0, asked: 0 }
    for (const [delta, at, over] of events) {
      const step = wheelRoute(gesture, delta, at, () => {
        out.asked++
        return over === 'column' && boxScrolls(col, 'auto', delta) ? col : over === 'band' && boxScrolls(tallStage, 'auto', delta) ? tallStage : null
      })
      const latched = gesture.held
      gesture = step.gesture
      if (step.move !== 0) out.moves.push(step.move)
      if (step.scroll) {
        out.scrolled++
        const scroller = (gesture.held ?? latched) as Box
        scroller.scrollTop = Math.max(0, Math.min(scroller.scrollHeight - scroller.clientHeight, scroller.scrollTop + delta))
      }
    }
    out.column = col.scrollTop
    return out
  }
  type Ev = [number, number, 'column' | 'slide' | 'band']
  const flick = (over: Ev[2], from = 0, scale = 1): Ev[] => Array.from({ length: 40 }, (_, i): Ev => [Math.max(1, Math.round(24 * scale * 0.9 ** i)), from + i * 16, over])
  // With nothing to scroll, the route is the slide's gesture, unchanged: one slide per gesture.
  assert.deepEqual(route(flick('slide')).moves, [1], 'a flick over the slide: one slide')
  assert.equal(route(flick('slide')).scrolled, 0, 'and nothing scrolls')
  assert.deepEqual(route([[100, 0, 'slide'], [100, 150, 'slide'], [-100, 300, 'slide']]).moves, [1, 1, -1], 'notches: a slide each')
  // A flick over a long column scrolls the column, and never the slide.
  const one = route(flick('column'))
  assert.deepEqual([one.moves, one.column], [[], 238], 'the column scrolls; the slide stays')
  // A big flick takes the column to its end; the rest of its momentum is ignored, never the next slide.
  const big3 = route(flick('column', 0, 3))
  assert.deepEqual([big3.moves, big3.column], [[], 500], 'at its end mid-flick: the slide still stays')
  // The next flick, with the column at its end, moves the slide.
  assert.deepEqual(route([...flick('column', 0, 3), ...flick('column', 40 * 16 + WHEEL_QUIET_MS)]).moves, [1])
  // Mouse notches over a long column: each scrolls it while it can, and the notch at its end moves the slide.
  const notches = route([[100, 0, 'column'], [100, 150, 'column'], [100, 300, 'column'], [100, 450, 'column'], [100, 600, 'column'], [100, 750, 'column']])
  assert.deepEqual([notches.moves, notches.column], [[1], 500], 'five notches to its end, the sixth moves the slide')
  // A few pixels the other way first (a trackpad's jitter at the column's top) don't give the gesture to the slide.
  const jitter = route([[-2, 0, 'column'], ...flick('column', 16)])
  assert.deepEqual([jitter.moves, jitter.column], [[], 238], 'jitter, then the flick: the column takes it')
  // The pointer drifting off the column in a gesture: the column keeps it (the browser stays latched to it), and the
  // stage under the band isn't scrolled in that gesture.
  const drift = route(flick('column').map(([d, t], i): Ev => [d, t, i < 10 ? 'column' : 'band']))
  assert.deepEqual([drift.moves, drift.column], [[], 238], 'the column keeps the gesture')
  // A gesture that moved the slide keeps the rest of it, even when the new slide brings a column under the pointer.
  assert.deepEqual(route([[30, 0, 'slide'], [30, 16, 'slide'], [20, 32, 'column'], [10, 48, 'column']]).scrolled, 0)
  // What's under the pointer is asked only while the gesture is undecided: once, for a flick a box takes; until the
  // step, for a flick that moves the slide.
  assert.equal(route(flick('column')).asked, 1)
  assert.equal(route(flick('slide')).asked, 2)
  // A first event with no delta decides nothing.
  assert.equal(route([[0, 0, 'slide'], [30, 16, 'column']]).column, 30)
  // Beside the handout (#855) the band is the slide's side of the room: a flick there moves one slide when the stage
  // fits, and when it is taller than its room the flick scrolls it first (its momentum stays with it) and the next
  // flick at its end moves the slide.
  {
    const run = (stageBox: Box, flicks: number) => {
      let gesture: WheelGesture = NO_GESTURE
      const out = { moves: 0, scrolled: 0 }
      for (let n = 0; n < flicks; n++) {
        for (const [delta, at] of flick('band', n * (40 * 16 + WHEEL_QUIET_MS))) {
          const step = wheelRoute(gesture, delta, at, () => wheelTaker(box('group', stageBox), stageBox, delta, overflowOf, 'beside'))
          const latched = gesture.held
          gesture = step.gesture
          out.moves += Math.abs(step.move)
          if (step.scroll) {
            out.scrolled++
            const scroller = (gesture.held ?? latched) as Box
            scroller.scrollTop = Math.max(0, Math.min(scroller.scrollHeight - scroller.clientHeight, scroller.scrollTop + delta))
          }
        }
      }
      return out
    }
    assert.deepEqual(run(box('stage', null, 'auto', 780, 780), 1), { moves: 1, scrolled: 0 }, 'a flick on the band beside the handout: one slide')
    const short = box('stage', null, 'auto', 895, 780, 0)
    assert.deepEqual(run(short, 2), { moves: 1, scrolled: 7 }, 'a stage taller than its room: the first flick scrolls it to its end, the second steps')
    assert.equal(short.scrollTop, 115)
  }
  // After a step the new slide is seen from where the gesture goes on (review of #871): the pane at its top going on,
  // at its end going back. Kept where it was, going on showed each new slide from its foot, and the next gesture
  // stepped again without showing its top.
  assert.equal(stageScrollAfter(1, { scrollHeight: 895, clientHeight: 780 }), 0, 'on: from the top')
  assert.equal(stageScrollAfter(-1, { scrollHeight: 895, clientHeight: 780 }), 115, 'back: from the end')
  assert.equal(stageScrollAfter(-1, { scrollHeight: 780, clientHeight: 780 }), 0, 'a pane that fits stays put')
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

// The deck view (its source read): the wheel whenever the slide is shown (#855), the keys only with the handout hidden,
// both through the strip's own path (pick), and the handout's scroll rule untouched.
{
  const view = readFileSync(new URL('./DeckView.tsx', import.meta.url), 'utf8').replace(/\s+/g, ' ')
  assert.ok(view.includes('const fullSlide = slideShown && !handoutShown'))
  assert.ok(view.includes('const stageWheel = stageWheelOf(slideShown, handoutShown)'), 'the views the wheel listens in')
  assert.ok(/if \(!stageWheel \|\| !stage\) return/.test(view), 'the wheel: in Slide only and in Slide and handout')
  assert.ok(!/if \(!fullSlide \|\| !stage\) return/.test(view), 'no longer in Slide only alone (#855)')
  assert.ok(/if \(!fullSlide\) return/.test(view), 'the keys: in Slide only, as before')
  assert.ok(/const goTo = useCallback\([^]*?pick\(next\)/.test(view), "the strip's own pick moves the slide (and scrolls the handout to its part)")
  assert.ok(view.includes("stage.addEventListener('wheel', onWheel, { passive: false })"), 'the wheel over the stage')
  // #824: what scrolls first decides, and the bands are no longer left out once the stage can scroll.
  // The wiring only (the rules are tested above): the stage's wheel asks wheelTaker through wheelRoute, and prevents the
  // default only when the route doesn't scroll a box.
  const wheel = /const onWheel = \(event: WheelEvent\) => \{([^]*?)\n?\s*\} stage\.addEventListener\('wheel'/.exec(view)?.[1] ?? ''
  assert.ok(/wheelTaker\(event\.target[^)]*, stage, delta, .*?, stageWheel\)/.test(wheel), 'what is under the pointer, up to the stage, by the view')
  assert.ok(/wheelRoute\(gesture, delta, event\.timeStamp, \w+\)/.test(wheel))
  assert.ok(/if \(!route\.scroll\) event\.preventDefault\(\)/.test(wheel) && !/^\s*event\.preventDefault\(\)/.test(wheel))
  // A step shows the new slide from where the gesture goes on, and only when the slide moved (not at the deck's ends).
  assert.ok(/const from = Math\.min\([^)]*\) goTo\(from \+ route\.move\) [^]*?if \(Math\.min\(currentRef\.current, countRef\.current - 1\) !== from\) stage\.scrollTop = stageScrollAfter\(route\.move, stage\)/.test(wheel), 'the pane after a step')
  // The slide's scrolling boxes keep a turn's rest to themselves in both views, so it never scrolls the stage.
  const css = readFileSync(new URL('./decks.css', import.meta.url), 'utf8')
  assert.ok(css.includes('.deck-stage .deck-big :is(.blk-column, .blk-tabpane) { overscroll-behavior-y: contain; }'))
  assert.ok(!view.includes("!target?.closest?.('.deck-big')) return"), 'the early return for the bands is gone')
  // The handout's wheel rule is still there for the handout.
  assert.ok(view.includes('const stop = wheelStop(state, delta, currentRef.current)'))
}

console.log('slideNav: passed')
