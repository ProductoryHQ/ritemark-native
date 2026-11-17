/**
 * Sprint 159 (PR 5): the wall's keys, the go-to box, and ⌘↩ / ⇧⌘↩ in the deck view.
 * Run with `npx tsx webview/src/components/decks/present/wallKeys.test.ts`.
 */
import { strict as assert } from 'node:assert'
import { clockText, countLabel, goToKey, MAX_GOTO_DIGITS, presentKeyOf, wallKeyOf, wallSlideSize, wallBleed } from './wallKeys'

// ---- On, back, the ends, stop
for (const key of ['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter']) assert.deepEqual(wallKeyOf({ key }), { type: 'next' }, key)
for (const key of ['ArrowLeft', 'ArrowUp', 'PageUp']) assert.deepEqual(wallKeyOf({ key }), { type: 'back' }, key)
assert.deepEqual(wallKeyOf({ key: 'Home' }), { type: 'first' })
assert.deepEqual(wallKeyOf({ key: 'End' }), { type: 'last' })
assert.deepEqual(wallKeyOf({ key: 'Escape' }), { type: 'stop' })
assert.deepEqual(wallKeyOf({ key: '4' }), { type: 'digit', digit: '4' })
assert.equal(wallKeyOf({ key: 'a' }), null)
// ⌘W, ⌘Q and the like are the app's.
assert.equal(wallKeyOf({ key: 'ArrowRight', metaKey: true }), null)
assert.equal(wallKeyOf({ key: 'Escape', ctrlKey: true }), null)
assert.equal(wallKeyOf({ key: '4', altKey: true }), null)

// ---- The go-to box
assert.deepEqual(goToKey(null, { key: '4' }), { digits: '4', handled: true }, 'a digit opens it')
assert.deepEqual(goToKey(null, { key: 'ArrowRight' }), { digits: null, handled: false }, 'closed, other keys are not its')
assert.deepEqual(goToKey('1', { key: '2' }), { digits: '12', handled: true })
assert.equal(goToKey('9'.repeat(MAX_GOTO_DIGITS), { key: '1' }).digits, '9'.repeat(MAX_GOTO_DIGITS), 'at most four digits')
assert.deepEqual(goToKey('12', { key: 'Backspace' }), { digits: '1', handled: true })
assert.deepEqual(goToKey('1', { key: 'Backspace' }), { digits: null, handled: true }, 'the last digit taken back closes it')
assert.deepEqual(goToKey('4', { key: 'Enter' }), { digits: null, go: 4, handled: true }, 'Return goes there')
assert.deepEqual(goToKey('4', { key: 'Escape' }), { digits: null, handled: true }, 'Esc closes the box and does not stop')
assert.deepEqual(goToKey('4', { key: 'ArrowRight' }), { digits: null, handled: false }, 'another key closes it and then does what it does')
assert.deepEqual(goToKey('4', { key: 'Enter', metaKey: true }), { digits: '4', handled: false })

// ---- n of N
assert.equal(countLabel(3, 6, false), '3 of 6')
assert.equal(countLabel(null, 6, true), 'Skipped slide')
assert.equal(countLabel(null, 6, false), '– of 6', 'a slide deleted while on the wall is not called skipped')

// ---- The slide at 16:9, as large as fits, with bands
assert.deepEqual(wallSlideSize(1440, 900), { width: 1440, height: 810, left: 0, top: 45 }, '16:10: bands above and below')
assert.deepEqual(wallSlideSize(1920, 1080), { width: 1920, height: 1080, left: 0, top: 0 }, '16:9: no bands')
assert.deepEqual(wallSlideSize(1600, 600), { width: 1067, height: 600, left: 267, top: 0 }, 'wide: bands on the sides')

// ---- The ground and the side picture run past the 16:9 area to the screen's edges (canvas pixels, a pixel over)
assert.deepEqual(wallBleed(wallSlideSize(1440, 900), 960), { x: 0, y: 31 }, '16:10: 45 screen px above and below')
assert.deepEqual(wallBleed(wallSlideSize(1728, 1080), 960), { x: 0, y: 31 }, 'the Mac below its notch: 54 px')
assert.deepEqual(wallBleed(wallSlideSize(1920, 1080), 960), { x: 0, y: 0 }, '16:9: nothing to run past')
assert.deepEqual(wallBleed(wallSlideSize(1600, 600), 960), { x: 242, y: 0 }, 'wide: to the sides')
assert.deepEqual(wallBleed({ width: 0, left: 0, top: 0 }, 960), { x: 0, y: 0 }, 'a window not laid out yet')

// ---- ⌘↩ presents from this slide, ⇧⌘↩ from the start; ⇧↩ stays the handout's line break
assert.equal(presentKeyOf({ key: 'Enter', metaKey: true }, true), 'here')
assert.equal(presentKeyOf({ key: 'Enter', metaKey: true, shiftKey: true }, true), 'start')
assert.equal(presentKeyOf({ key: 'Enter', shiftKey: true }, true), null)
assert.equal(presentKeyOf({ key: 'Enter' }, true), null)
assert.equal(presentKeyOf({ key: 'Enter', ctrlKey: true }, true), null, 'Ctrl is not ⌘ on a Mac')
assert.equal(presentKeyOf({ key: 'Enter', metaKey: true, altKey: true }, true), null)
assert.equal(presentKeyOf({ key: 'Enter', ctrlKey: true }, false), 'here', 'Ctrl on Windows')
assert.equal(presentKeyOf({ key: 'Enter', ctrlKey: true, shiftKey: true }, false), 'start')
assert.equal(presentKeyOf({ key: 'Enter', metaKey: true }, false), null)
assert.equal(presentKeyOf({ key: 'a', metaKey: true }, true), null)

// ---- The presenter view's clock
assert.equal(clockText(0), '0:00')
assert.equal(clockText(-500), '0:00')
assert.equal(clockText(760_000), '12:40', 'the drawing\'s 12:40')
assert.equal(clockText(3_725_000), '1:02:05')

console.log('wallKeys: all tests passed')
