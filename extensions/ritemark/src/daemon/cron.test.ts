/**
 * Unit tests for the minimal cron engine (matchField + computeNextFire).
 * Run: npx tsx src/daemon/cron.test.ts
 *
 * Dates are built with the local-time Date constructor and asserted with local
 * getters, so the suite is timezone-independent. June 8 2026 is a Monday.
 */
import * as assert from 'assert';
import { matchField, computeNextFire } from './cron';

// --- matchField -------------------------------------------------------------

// wildcard
assert.strictEqual(matchField(5, '*', 0, 59), true);

// exact
assert.strictEqual(matchField(5, '5', 0, 59), true);
assert.strictEqual(matchField(6, '5', 0, 59), false);

// range
assert.strictEqual(matchField(10, '5-15', 0, 59), true);
assert.strictEqual(matchField(20, '5-15', 0, 59), false);

// list
assert.strictEqual(matchField(17, '9,17', 0, 23), true);
assert.strictEqual(matchField(12, '9,17', 0, 23), false);

// step on wildcard: */5
assert.strictEqual(matchField(10, '*/5', 0, 59), true);
assert.strictEqual(matchField(11, '*/5', 0, 59), false);

// step on range: 10-30/5 (matches 10,15,20,25,30)
assert.strictEqual(matchField(20, '10-30/5', 0, 59), true);
assert.strictEqual(matchField(22, '10-30/5', 0, 59), false);
assert.strictEqual(matchField(35, '10-30/5', 0, 59), false); // outside range

// --- computeNextFire --------------------------------------------------------

// invalid field count → undefined
assert.strictEqual(computeNextFire('0 9 * *', new Date(2026, 5, 8, 10, 0, 0)), undefined);
assert.strictEqual(computeNextFire('* * * * * *', new Date(2026, 5, 8, 10, 0, 0)), undefined);

// daily 09:00 — today's 09:00 already passed at 10:30 → fires next day
{
  const next = computeNextFire('0 9 * * *', new Date(2026, 5, 8, 10, 30, 0));
  assert.ok(next);
  assert.strictEqual(next!.getDate(), 9);
  assert.strictEqual(next!.getHours(), 9);
  assert.strictEqual(next!.getMinutes(), 0);
}

// every 15 minutes — from 10:30 → 10:45 same hour
{
  const next = computeNextFire('*/15 * * * *', new Date(2026, 5, 8, 10, 30, 0));
  assert.ok(next);
  assert.strictEqual(next!.getHours(), 10);
  assert.strictEqual(next!.getMinutes(), 45);
}

// hour list 9,17 — from 10:30 → 17:00 same day
{
  const next = computeNextFire('0 9,17 * * *', new Date(2026, 5, 8, 10, 30, 0));
  assert.ok(next);
  assert.strictEqual(next!.getDate(), 8);
  assert.strictEqual(next!.getHours(), 17);
  assert.strictEqual(next!.getMinutes(), 0);
}

// weekdays only (Mon-Fri 09:00) — from Saturday Jun 6 → Monday Jun 8 09:00
{
  const next = computeNextFire('0 9 * * 1-5', new Date(2026, 5, 6, 12, 0, 0));
  assert.ok(next);
  assert.strictEqual(next!.getDate(), 8);
  assert.strictEqual(next!.getDay(), 1); // Monday
  assert.strictEqual(next!.getHours(), 9);
}

// specific day-of-month + month — 14:30 on June 8, from earlier that day
{
  const next = computeNextFire('30 14 8 6 *', new Date(2026, 5, 8, 10, 0, 0));
  assert.ok(next);
  assert.strictEqual(next!.getMonth(), 5); // June (0-based)
  assert.strictEqual(next!.getDate(), 8);
  assert.strictEqual(next!.getHours(), 14);
  assert.strictEqual(next!.getMinutes(), 30);
}

console.log('✅ All cron tests passed!');
