/**
 * README item 20: how a slide arrived decides whether its content comes in a row or the slide shows whole, the one
 * rule for the wall and the page (`slideArrival.ts`).
 *
 * Run: npx tsx src/decks/present/slideArrival.test.ts
 */
import { strict as assert } from 'node:assert';
import { arrivalOfMove, opensOnward, rowPlays, slideArrivalOf, type SlideArrival } from './slideArrival';
import { revealOnArrival } from './revealSteps';

// The host's moves: → going on, Home, ← back, End and a number (the go-to box, the grid, the presenter view's row) a jump.
assert.deepEqual((['next', 'first', 'back', 'last', 'go'] as const).map(arrivalOfMove), ['next', 'home', 'back', 'jump', 'jump']);

// As the wall may be sent it: the five, else nothing (the same slide drawn again).
for (const arrival of ['next', 'home', 'back', 'jump', 'start']) assert.equal(slideArrivalOf(arrival), arrival);
for (const other of [null, undefined, '', 'NEXT', 'first', 'go', 1, {}, ['next']]) assert.equal(slideArrivalOf(other), null, String(other));

// Every arrival, with motion, in each transition that moves: a press going on, Home and the start come in a row; going
// back, a jump and the same slide shown again (blank, the QR code, the spotlight, a filled picture: null) show it whole.
const ROW: Array<SlideArrival> = ['next', 'home', 'start'];
const WHOLE: Array<SlideArrival | null> = ['back', 'jump', null];
for (const transition of ['fade', 'push', 'zoom']) {
  for (const arrival of ROW) assert.equal(rowPlays(opensOnward(arrival), transition, false, false), true, `${arrival} in ${transition}: a row`);
  for (const arrival of WHOLE) assert.equal(rowPlays(opensOnward(arrival), transition, false, false), false, `${arrival} in ${transition}: whole`);
}

// Never a row with reduced motion, in a deck whose transition is None, or on a covered wall (blank, the QR code, a
// filled picture), whatever the arrival.
for (const arrival of [...ROW, ...WHOLE]) {
  for (const transition of ['fade', 'push', 'zoom']) {
    assert.equal(rowPlays(opensOnward(arrival), transition, true, false), false, `${arrival} in ${transition}, reduced motion`);
    assert.equal(rowPlays(opensOnward(arrival), transition, false, true), false, `${arrival} in ${transition}, covered`);
  }
  assert.equal(rowPlays(opensOnward(arrival), 'none', false, false), false, `${arrival} with None`);
}

// The same arrival decides how a One by one slide opens (README item 18): with its first item where the row plays,
// whole where the slide shows whole, so the row stops at the block's first item.
for (const arrival of ROW) assert.deepEqual(revealOnArrival(4, opensOnward(arrival) ? 'first' : 'whole'), { shown: 1, count: 4 });
for (const arrival of WHOLE) assert.deepEqual(revealOnArrival(4, opensOnward(arrival) ? 'first' : 'whole'), { shown: 4, count: 4 });

// Self-contained, so the page can carry their source as it is: each runs alone, with no module around it.
for (const fn of [opensOnward, rowPlays]) {
  const alone = new Function(`return (${String(fn)});`)() as typeof fn;
  assert.equal(typeof alone, 'function');
  assert.ok(!/[^\x00-\x7f]/.test(String(fn)), 'plain ASCII');
}

console.log('slideArrival: every arrival decides row or whole; reduced motion, None and a covered wall mean no row');
