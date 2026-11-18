/**
 * Decks README items 12 and 9 (17 November): the pointer dot and the timer for an exercise, in Present.
 * Run with `npx tsx webview/src/components/decks/present/pointerTimer.test.ts`.
 */
import { strict as assert } from 'node:assert'
import { dotPlace, isPointerKey, minutesIn, nearestTimerMinutes, pointerKeyStep, pointOnSlide, samePoint, stepsLabelOf, TIMER_DEFAULT, TIMER_MINUTES, TIMER_PULSE_MS, TIMER_PULSES, timerLook, timerNextTick, timerOfferOf, timerText } from './pointerTimer'
import { blankKeyOf, fillKeyOf, spotKeyOf, wallKeyOf } from './wallKeys'

// ---- Item 12: L down and up
assert.equal(isPointerKey({ key: 'l' }), true)
assert.equal(isPointerKey({ key: 'L' }), true, 'with Shift (or Caps Lock) too')
assert.equal(isPointerKey({ key: 'l', metaKey: true }), false, '⌘L is the app’s')
assert.equal(isPointerKey({ key: 'l', ctrlKey: true }), false)
assert.equal(isPointerKey({ key: 'l', altKey: true }), false)
assert.deepEqual(pointerKeyStep(false, 'down', { key: 'l' }), { held: true, take: true }, 'L down holds the dot')
assert.deepEqual(pointerKeyStep(true, 'down', { key: 'l', repeat: true }), { held: true, take: true }, 'its repeats change nothing')
assert.deepEqual(pointerKeyStep(true, 'up', { key: 'l' }), { held: false, take: true }, 'L up lets go')
assert.deepEqual(pointerKeyStep(true, 'up', { key: 'L', metaKey: true }), { held: false, take: true }, 'let go with ⌘ held, still let go')
assert.deepEqual(pointerKeyStep(false, 'up', { key: 'l' }), { held: false, take: false }, 'an L up never held is not taken')
assert.equal(pointerKeyStep(false, 'down', { key: 'k' }), null)
assert.equal(pointerKeyStep(true, 'up', { key: 'ArrowRight' }), null, 'another key up leaves the dot')
// L clashes with no key of the wall's: not a move, not a blank, not the spotlight's.
assert.equal(wallKeyOf({ key: 'l' }), null)
assert.equal(blankKeyOf({ key: 'l' }, null, true), null)
assert.equal(spotKeyOf({ key: 'l' }, 0, 3), null)
assert.equal(fillKeyOf({ key: 'l' }, null), null)
// While the wall is blank or a picture fills it, L brings the slide back, as any key does (and does nothing else).
assert.deepEqual(blankKeyOf({ key: 'l' }, 'ground'), { type: 'show' })
assert.equal(fillKeyOf({ key: 'l' }, 1), 'return')

// ---- Item 12: the dot's place, from the presenter view's Now to the wall
const now = { left: 32, top: 80, width: 960, height: 540 }
const wall = { left: 0, top: 45, width: 1440, height: 810 }
assert.deepEqual(pointOnSlide(now, 32, 80), { x: 0, y: 0 }, 'Now’s top left')
assert.deepEqual(pointOnSlide(now, 32 + 960, 80 + 540), { x: 1, y: 1 }, 'its bottom right')
const middle = pointOnSlide(now, 32 + 480, 80 + 270)
assert.deepEqual(middle, { x: 0.5, y: 0.5 })
assert.deepEqual(dotPlace(middle!, wall), { left: 720, top: 450 }, 'the same place on the wall')
const item = pointOnSlide(now, 32 + 240, 80 + 405)!
assert.deepEqual(item, { x: 0.25, y: 0.75 })
assert.deepEqual(dotPlace(item, wall), { left: 360, top: 45 + 608 }, 'a quarter across, three quarters down')
assert.equal(pointOnSlide(now, 31, 200), null, 'off Now, no dot')
assert.equal(pointOnSlide(now, 500, 80 + 541), null)
assert.equal(pointOnSlide({ left: 0, top: 0, width: 0, height: 0 }, 0, 0), null, 'a slide not drawn yet')
// The wall's own pointer on one display follows it into the bands around the slide.
const band = pointOnSlide(wall, 700, 10, true)!
assert.ok(band.y < 0)
assert.deepEqual(dotPlace(band, wall), { left: 700, top: 10 }, 'the dot is where the pointer is')
assert.equal(samePoint({ x: 0.5, y: 0.5 }, { x: 0.50001, y: 0.5 }), true, 'less than a pixel: not sent again')
assert.equal(samePoint({ x: 0.5, y: 0.5 }, { x: 0.51, y: 0.5 }), false)
assert.equal(samePoint(null, null), true)
assert.equal(samePoint(null, { x: 0, y: 0 }), false)

// ---- Item 9: the default from the label or the slide, in English and Estonian
assert.equal(minutesIn('20 min'), 20)
assert.equal(minutesIn('Exercise · 20 min'), 20)
assert.equal(minutesIn('20min'), 20)
assert.equal(minutesIn('20 mins'), 20)
assert.equal(minutesIn('20 minutes'), 20)
assert.equal(minutesIn('A 15-minute task'), 15)
assert.equal(minutesIn('Harjutus, 20 minutit'), 20)
assert.equal(minutesIn('Tehke 15 minuti jooksul'), 15)
assert.equal(minutesIn('Aega on 10 minutiks'), 10)
assert.equal(minutesIn('20 MIN'), 20)
assert.equal(minutesIn('Exercise'), null)
assert.equal(minutesIn('3 steps, 20 people'), null, 'a number that is no time')
assert.equal(minutesIn('20 minds'), null)
assert.equal(minutesIn('1.5 min'), null, 'not a whole number of minutes')
assert.equal(minutesIn('0 min'), null)
assert.equal(nearestTimerMinutes(20), 20)
assert.equal(nearestTimerMinutes(12), 10)
assert.equal(nearestTimerMinutes(25), 30, 'a tie goes to the longer')
assert.equal(nearestTimerMinutes(45), 30)
assert.equal(nearestTimerMinutes(2), 5)
assert.deepEqual([...TIMER_MINUTES], [5, 10, 15, 20, 30])

const steps = (open: string, body = '1. Write a prompt\n2. Try it\n3. Compare') => ({ kind: '', data: { markdown: `# Try it\n\n${open}\n${body}\n:::\n` } })
assert.equal(stepsLabelOf(steps('::: steps')), 'Exercise', 'a Steps block without a label has the default pill')
assert.equal(stepsLabelOf(steps('::: {.steps tag="Harjutus · 20 minutit"}')), 'Harjutus · 20 minutit')
assert.equal(stepsLabelOf({ kind: '', data: { markdown: '# Points\n\n- One\n- Two\n' } }), null, 'no Steps block, no timer')
assert.equal(stepsLabelOf({ kind: 'exercise', data: { tag: 'Pair work · 15 min' } }), 'Pair work · 15 min', 'a v1 Exercise read as it is')
assert.equal(stepsLabelOf({ kind: 'exercise', data: { tag: '  ' } }), '', 'a pill of spaces is no pill (exerciseTagOf)')
assert.equal(stepsLabelOf({ kind: 'exercise', data: {} }), 'Exercise')
assert.equal(timerOfferOf({ kind: '', data: { markdown: '# Points\n\n- One 20 min\n' } }), null)
assert.deepEqual(timerOfferOf(steps('::: {.steps tag="Exercise · 20 min"}')), { minutes: 20 }, 'English label')
assert.deepEqual(timerOfferOf(steps('::: {.steps tag="Harjutus · 20 minutit"}')), { minutes: 20 }, 'Estonian label')
assert.deepEqual(timerOfferOf(steps('::: {.steps tag="Exercise · 15 minutes"}')), { minutes: 15 })
assert.deepEqual(timerOfferOf(steps('::: steps', '1. Read the brief (5 minutes)\n2. Write for 30 minutes')), { minutes: 5 }, 'the slide’s first time, when the label names none')
assert.deepEqual(timerOfferOf(steps('::: {.steps tag="10 min"}', '1. Work for 30 minutes')), { minutes: 10 }, 'the label wins over the slide')
assert.deepEqual(timerOfferOf(steps('::: steps')), { minutes: TIMER_DEFAULT }, 'no time named: 10 min')
assert.deepEqual(timerOfferOf(steps('::: {.steps tag="25 min"}')), { minutes: 30 }, 'snapped to the offered')

// ---- Item 9: the countdown, with a fake clock
const start = 1_000_000
const timer = { endsAt: start + 20 * 60_000, minutes: 20 }
assert.equal(timerText(20 * 60_000), '20:00')
assert.equal(timerText(5 * 60_000), '05:00')
assert.equal(timerText(59_001), '01:00', 'counted up to the next whole second')
assert.equal(timerText(59_000), '00:59')
assert.equal(timerText(0), '00:00')
assert.equal(timerText(-5), '00:00')
assert.deepEqual(timerLook(timer, start, false), { text: '20:00', left: 20 * 60_000, done: false, pulse: false }, 'it starts at 20:00')
assert.equal(timerLook(timer, start + 1, false).text, '20:00')
assert.equal(timerLook(timer, start + 1000, false).text, '19:59')
assert.equal(timerLook(timer, start + 7 * 60_000 + 26_000, false).text, '12:34')
assert.equal(timerLook(timer, start + 20 * 60_000 - 1, false).text, '00:01')
assert.equal(timerNextTick(timer, start), 1000, 'the words change each second')
assert.equal(timerNextTick(timer, start + 250), 750)
// The timer is the host's: the same one on every slide (the wall keeps showing what it gets), until stopped.
const afterMoves = { ...timer }
assert.equal(timerLook(afterMoves, start + 60_000, false).text, timerLook(timer, start + 60_000, false).text, 'the same timer on the next slide')

// ---- Item 9: 00:00 pulses three times, and never with reduced motion
const end = timer.endsAt
const atEnd = timerLook(timer, end, false)
assert.equal(atEnd.text, '00:00')
assert.equal(atEnd.done, true)
assert.equal(atEnd.pulse, true, 'at 00:00 it pulses')
assert.equal(timerLook(timer, end + TIMER_PULSES * TIMER_PULSE_MS - 1, false).pulse, true, 'three pulses long')
assert.equal(timerLook(timer, end + TIMER_PULSES * TIMER_PULSE_MS, false).pulse, false, 'then it stays still at 00:00')
assert.equal(timerLook(timer, end + 60_000, false).text, '00:00', 'it stays at 00:00 until stopped')
assert.equal(timerLook(timer, end, true).pulse, false, 'reduced motion: no pulse')
assert.equal(timerLook(timer, end, true).done, true, 'still at 00:00')
assert.equal(timerLook(timer, end - 1000, false).pulse, false, 'no pulse before the end')
assert.equal(timerNextTick(timer, end), TIMER_PULSES * TIMER_PULSE_MS, 'drawn once more when the pulses end')
assert.equal(timerNextTick(timer, end + 60_000), 0, 'then never again')

console.log('pointerTimer.test.ts: ok')
