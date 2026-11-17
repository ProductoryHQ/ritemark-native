/**
 * Sprint 159 (PR 5): the wall's keys, the go-to box, and ⌘↩ / ⇧⌘↩ in the deck view.
 * Run with `npx tsx webview/src/components/decks/present/wallKeys.test.ts`.
 */
import { strict as assert } from 'node:assert'
import { blankKeyOf, blankNow, settleAsked, clockText, countLabel, fillKeyOf, goToKey, MAX_GOTO_DIGITS, presentKeyOf, spotClickOf, spotKeyOf, timeOfDayText, wallKeyOf, wallSlideSize, wallBleed } from './wallKeys'

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

// ---- A clicker (small details, item 1): Page Down and Page Up step as → and ← do, on the wall and in the presenter view
assert.deepEqual(wallKeyOf({ key: 'PageDown' }), wallKeyOf({ key: 'ArrowRight' }), "a clicker's forward is →")
assert.deepEqual(wallKeyOf({ key: 'PageUp' }), wallKeyOf({ key: 'ArrowLeft' }), "a clicker's back is ←")

// ---- B or "." blanks the wall to the theme's ground, W to white
for (const key of ['b', 'B', '.']) assert.deepEqual(blankKeyOf({ key }, null), { type: 'blank', to: 'ground' }, key)
for (const key of ['w', 'W']) assert.deepEqual(blankKeyOf({ key }, null), { type: 'blank', to: 'white' }, key)
for (const key of ['ArrowRight', 'PageDown', ' ', 'Enter', 'Escape', '4', 'a', 'Shift']) assert.equal(blankKeyOf({ key }, null), null, `${key} is not a blank key`)
assert.equal(blankKeyOf({ key: 'b', metaKey: true }, null), null, "⌘B is the app's")
assert.equal(blankKeyOf({ key: 'w', metaKey: true }, null), null, '⌘W closes the window, never blanks')
assert.equal(blankKeyOf({ key: '.', ctrlKey: true }, null), null)
// While blank, any key brings the slide back and does nothing else: never a step, a stop or the go-to box.
for (const blank of ['ground', 'white'] as const) {
  for (const key of ['b', 'B', '.', 'w', 'W', 'ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp', ' ', 'Enter', 'Escape', 'Home', 'End', '4', 'x', 'F5']) {
    assert.deepEqual(blankKeyOf({ key }, blank), { type: 'show' }, `${key} on a ${blank} wall shows the slide`)
  }
  for (const key of ['Shift', 'Meta', 'Control', 'Alt', 'CapsLock']) assert.equal(blankKeyOf({ key }, blank), null, `${key} alone does nothing`)
  assert.equal(blankKeyOf({ key: 'q', metaKey: true }, blank), null, "⌘Q is still the app's")
}
// ---- Small details item 3: Q shows the published page's QR code; an unpublished deck's Q is no key of the wall's
for (const key of ['q', 'Q']) {
  assert.deepEqual(blankKeyOf({ key }, null, true), { type: 'blank', to: 'page' }, `${key} on a published deck shows the code`)
  assert.equal(blankKeyOf({ key }, null, false), null, `${key} on an unpublished deck does nothing`)
  assert.equal(blankKeyOf({ key }, null), null, `${key} with no page said does nothing`)
}
assert.equal(blankKeyOf({ key: 'q', metaKey: true }, null, true), null, "⌘Q quits, never shows the code")
// While the code shows, any key (Q too) brings the slide back and does nothing else.
for (const key of ['q', 'Q', 'b', 'w', 'ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp', ' ', 'Enter', 'Escape', 'Home', 'End', '4', 'x']) {
  assert.deepEqual(blankKeyOf({ key }, 'page', true), { type: 'show' }, `${key} on the code shows the slide`)
}
for (const key of ['Shift', 'Meta', 'Alt']) assert.equal(blankKeyOf({ key }, 'page', true), null, `${key} alone does nothing`)
// Q on a blank wall brings the slide back (one key, one change), never the code over the blank.
assert.deepEqual(blankKeyOf({ key: 'q' }, 'ground', true), { type: 'show' })
// The wall and the presenter view ask blankKeyOf first, and a key it takes goes no further: this is their order.
{
  const route = (key: string, blank: 'ground' | 'white' | 'page' | null) => {
    const step = blankKeyOf({ key }, blank, true)
    if (step) return step
    if (goToKey(null, { key }).handled) return 'go-to box'
    return wallKeyOf({ key })
  }
  assert.deepEqual(route('ArrowRight', 'ground'), { type: 'show' }, '→ on a blank wall does not also step')
  assert.deepEqual(route('PageDown', 'white'), { type: 'show' }, 'a clicker on a blank wall does not also step')
  assert.deepEqual(route('Escape', 'ground'), { type: 'show' }, 'Esc on a blank wall does not stop')
  assert.deepEqual(route('4', 'ground'), { type: 'show' }, 'a digit on a blank wall does not open the box')
  assert.deepEqual(route('ArrowRight', 'page'), { type: 'show' }, '→ on the code does not also step')
  assert.deepEqual(route('PageDown', 'page'), { type: 'show' }, 'a clicker on the code does not also step')
  assert.deepEqual(route('Escape', 'page'), { type: 'show' }, 'Esc on the code does not stop')
  assert.deepEqual(route('PageDown', null), { type: 'next' }, 'on the slide, Page Down steps')
  assert.equal(route('4', null), 'go-to box')
}

// ---- A key right after another, before the host answers, is read against what this window asked for
assert.equal(blankNow(null, null), null)
assert.equal(blankNow('ground', null), 'ground')
assert.equal(blankNow(null, { to: 'ground' }), 'ground', '"." then Page Down at once: the wall is taken as blank')
assert.deepEqual(blankKeyOf({ key: 'PageDown' }, blankNow(null, { to: 'ground' })), { type: 'show' }, 'so Page Down shows it and does not step')
assert.deepEqual(blankKeyOf({ key: '.' }, blankNow(null, { to: 'ground' })), { type: 'show' }, 'and a second "." shows it again')
assert.equal(blankNow('ground', { to: null }), null)
assert.deepEqual(settleAsked({ to: 'ground' }, null), { to: 'ground' }, 'a state from before the ask keeps it')
assert.equal(settleAsked({ to: 'ground' }, 'ground'), null, 'the state that carries it settles it')
assert.equal(settleAsked({ to: null }, null), null)
assert.equal(settleAsked(null, 'white'), null)
// A Q the host refused (the deck has no page now): settled, so the next key is read against the slide, not the code.
assert.deepEqual(settleAsked({ to: 'page' }, null), { to: 'page' }, 'a state from before Q keeps it')
assert.equal(settleAsked({ to: 'page' }, null, false), null, 'refused: no page, so no code to dismiss')
assert.equal(settleAsked({ to: 'page' }, 'page', true), null)
assert.deepEqual(blankKeyOf({ key: 'ArrowRight' }, blankNow(null, settleAsked({ to: 'page' }, null, false)), false), null, '→ after a refused Q is a step again')

// ---- The time of day, in the locale's own format and the system's 12- or 24-hour choice
{
  const afternoon = new Date(2026, 10, 17, 14, 5)
  const morning = new Date(2026, 10, 17, 9, 5)
  // A 12-hour locale (ICU's space before PM may be a narrow no-break space).
  assert.match(timeOfDayText(afternoon, { locale: 'en-US', hourCycle: null }), /^2:05\sPM$/u)
  assert.match(timeOfDayText(morning, { locale: 'en-US', hourCycle: null }), /^9:05\sAM$/u)
  // A 24-hour locale.
  assert.equal(timeOfDayText(afternoon, { locale: 'et-EE', hourCycle: null }), '14:05')
  assert.equal(timeOfDayText(afternoon, { locale: 'de-DE', hourCycle: null }), '14:05')
  // The system's switch over the locale's own: 24-hour English, 12-hour British.
  assert.equal(timeOfDayText(afternoon, { locale: 'en-US', hourCycle: 'h23' }), '14:05')
  assert.match(timeOfDayText(afternoon, { locale: 'en-GB', hourCycle: 'h12' }), /^2:05\s?pm$/iu)
  // A tag the webview can't read falls back to its own format; no clock yet is its own format too.
  const own = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(afternoon)
  assert.equal(timeOfDayText(afternoon, { locale: 'not a locale!', hourCycle: null }), own)
  assert.equal(timeOfDayText(afternoon, null), own)
}

// ---- Decks README item 16: the spotlight's click rule (the wall's and the presenter view's Now)
{
  const box = (item: number) => ({ item, picture: false })
  const picture = (item: number) => ({ item, picture: true })
  // A click on an item spotlights it, on the wall and in Now.
  assert.deepEqual(spotClickOf(box(1), null, 'next'), { type: 'spot', item: 1 }, 'an item: spotlit')
  assert.deepEqual(spotClickOf(box(1), null, 'none'), { type: 'spot', item: 1 })
  // A click on another item moves the spotlight there.
  assert.deepEqual(spotClickOf(box(2), 1, 'next'), { type: 'spot', item: 2 }, 'another item: the spotlight moves')
  assert.deepEqual(spotClickOf(picture(0), 2, 'next'), { type: 'spot', item: 0 }, 'a picture not spotlit is spotlit first')
  // A click on the spotlit item clears it.
  assert.deepEqual(spotClickOf(box(2), 2, 'next'), { type: 'clear' }, 'the same item: cleared')
  // Outside any item: cleared; with no spotlight the wall goes on, as before, and Now does nothing.
  assert.deepEqual(spotClickOf(null, 2, 'next'), { type: 'clear' }, 'outside: cleared, not a step')
  assert.deepEqual(spotClickOf(null, 2, 'none'), { type: 'clear' })
  assert.deepEqual(spotClickOf(null, null, 'next'), { type: 'next' }, 'no spotlight, outside: the wall goes on')
  assert.equal(spotClickOf(null, null, 'none'), null, 'no spotlight, outside Now: nothing')
  // Item 11: a click on a spotlit picture fills the wall.
  assert.deepEqual(spotClickOf(picture(3), 3, 'next'), { type: 'fill', item: 3 }, 'a spotlit picture fills the wall')
  assert.deepEqual(spotClickOf(picture(3), 3, 'none'), { type: 'fill', item: 3 }, 'from Now too')
  // A picture alone on its slide (only the title beside it) fills the wall at the first click, on the wall and in Now.
  const lone = { item: 0, picture: true, alone: true }
  assert.deepEqual(spotClickOf(lone, null, 'next'), { type: 'fill', item: 0 }, 'a lone picture: one click fills the wall')
  assert.deepEqual(spotClickOf(lone, null, 'none'), { type: 'fill', item: 0 }, 'from Now too')
  assert.deepEqual(spotClickOf(lone, 0, 'next'), { type: 'fill', item: 0 }, 'already spotlit (F): fills too')
  // Alone but not a picture (one box, a table), or a picture among other items: the two-click rule holds.
  assert.deepEqual(spotClickOf({ item: 0, picture: false, alone: true }, null, 'next'), { type: 'spot', item: 0 }, 'a lone box is spotlit')
  assert.deepEqual(spotClickOf({ item: 1, picture: true, alone: false }, null, 'next'), { type: 'spot', item: 1 }, 'a picture among others: spotlit first')
}

// ---- Item 16's keys: F, Tab, Shift+Tab, Esc; → and a clicker only step
{
  assert.deepEqual(spotKeyOf({ key: 'f' }, null, 4), { type: 'spot', item: 0 }, 'F spotlights the first item')
  assert.deepEqual(spotKeyOf({ key: 'F', shiftKey: true }, 2, 4), { type: 'spot', item: 0 })
  assert.equal(spotKeyOf({ key: 'f' }, null, 0), null, 'a slide with no items: F does nothing')
  assert.deepEqual(spotKeyOf({ key: 'Tab' }, 0, 4), { type: 'spot', item: 1 }, 'Tab: the next item')
  assert.deepEqual(spotKeyOf({ key: 'Tab', shiftKey: true }, 2, 4), { type: 'spot', item: 1 }, 'Shift+Tab: the one before')
  assert.deepEqual(spotKeyOf({ key: 'Tab' }, 3, 4), { type: 'spot', item: 3 }, 'Tab stops at the last item')
  assert.deepEqual(spotKeyOf({ key: 'Tab', shiftKey: true }, 0, 4), { type: 'spot', item: 0 }, 'Shift+Tab stops at the first')
  assert.deepEqual(spotKeyOf({ key: 'Tab' }, 9, 4), { type: 'spot', item: 3 }, 'a place past the slide (edited) comes back to its last item')
  assert.equal(spotKeyOf({ key: 'Tab' }, null, 4), null, 'without a spotlight Tab is the window\'s own')
  assert.deepEqual(spotKeyOf({ key: 'Escape' }, 1, 4), { type: 'clear' }, 'Esc clears the spotlight')
  assert.equal(spotKeyOf({ key: 'Escape' }, null, 4), null, 'without one Esc stops, as before')
  assert.deepEqual(wallKeyOf({ key: 'Escape' }), { type: 'stop' })
  assert.equal(spotKeyOf({ key: 'f', metaKey: true }, null, 4), null, '⌘F is the app\'s')
  assert.equal(spotKeyOf({ key: 'Tab', ctrlKey: true }, 1, 4), null)
  // → and a clicker (Page Down, Page Up) are never the spotlight's: they step once, and the host's move clears it.
  for (const key of ['ArrowRight', 'PageDown', 'PageUp', ' ', 'Enter', 'ArrowLeft']) {
    assert.equal(spotKeyOf({ key }, 1, 4), null, key)
    assert.notEqual(wallKeyOf({ key }), null, key)
  }
  assert.deepEqual(wallKeyOf({ key: 'ArrowRight' }), { type: 'next' }, '→ goes on in one press')
  assert.deepEqual(wallKeyOf({ key: 'PageDown' }), { type: 'next' }, 'a clicker press only steps')
}

// ---- Item 11: a filled wall returns with any key, and that key does nothing else
{
  for (const key of ['ArrowRight', 'PageDown', 'Escape', 'b', 'f', 'Tab', '4', ' ']) assert.equal(fillKeyOf({ key }, 2), 'return', key)
  for (const key of ['Shift', 'Meta', 'Alt', 'Control']) assert.equal(fillKeyOf({ key }, 2), null, `${key} alone`)
  assert.equal(fillKeyOf({ key: 'w', metaKey: true }, 2), null, '⌘W is the app\'s')
  assert.equal(fillKeyOf({ key: 'ArrowRight' }, null), null, 'not filled: the key does what it does')
  // The ask kept until the host's state carries it works for an item's place too.
  assert.equal(blankNow<number | null>(null, { to: 2 }), 2)
  assert.equal(settleAsked<number | null>({ to: 2 }, 2), null)
  assert.deepEqual(settleAsked<number | null>({ to: 2 }, null), { to: 2 })
}

console.log('wallKeys: all tests passed')
