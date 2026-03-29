/**
 * Unit tests for scheduled flow timing logic.
 * Run: npx tsx src/flows/flowSchedule.test.ts
 */

import * as assert from 'assert';
import type { FlowSchedule } from './types';
import {
  SCHEDULE_GRACE_MS,
  getDueScheduledRun,
  getIsoWeekday,
  getNextScheduledRun,
  isValidFlowSchedule,
  parseScheduleTime,
} from './flowSchedule';

function createSchedule(overrides: Partial<FlowSchedule> = {}): FlowSchedule {
  return {
    enabled: true,
    type: 'daily',
    time: '09:00',
    ...overrides,
  };
}

console.log('Testing flow schedule utilities...');

// Test 1: HH:mm parsing
assert.deepStrictEqual(parseScheduleTime('09:00'), { hours: 9, minutes: 0 });
assert.deepStrictEqual(parseScheduleTime('23:59'), { hours: 23, minutes: 59 });
assert.strictEqual(parseScheduleTime('9:00'), null);
assert.strictEqual(parseScheduleTime('24:00'), null);
console.log('  ✓ Schedule time parsing is correct');

// Test 2: ISO weekday mapping
assert.strictEqual(getIsoWeekday(new Date(2026, 2, 23, 12, 0)), 1); // Monday
assert.strictEqual(getIsoWeekday(new Date(2026, 2, 29, 12, 0)), 7); // Sunday
console.log('  ✓ ISO weekday mapping is correct');

// Test 3: Weekly schedules require ISO days
assert.strictEqual(
  isValidFlowSchedule(createSchedule({ type: 'weekly', days: [1, 3, 5] })),
  true
);
assert.strictEqual(
  isValidFlowSchedule(createSchedule({ type: 'weekly', days: [] })),
  false
);
console.log('  ✓ Weekly schedule validation is correct');

// Test 4: Next run for daily schedule later today
const nextDaily = getNextScheduledRun(
  createSchedule({ type: 'daily', time: '09:00' }),
  new Date(2026, 2, 28, 8, 30)
);
assert.ok(nextDaily);
assert.strictEqual(nextDaily?.getHours(), 9);
assert.strictEqual(nextDaily?.getMinutes(), 0);
assert.strictEqual(nextDaily?.getDate(), 28);
console.log('  ✓ Daily next-run calculation works');

// Test 5: Weekdays skip weekend
const nextWeekday = getNextScheduledRun(
  createSchedule({ type: 'weekdays', time: '09:00' }),
  new Date(2026, 2, 28, 10, 0) // Saturday
);
assert.ok(nextWeekday);
assert.strictEqual(getIsoWeekday(nextWeekday!), 1); // Monday
assert.strictEqual(nextWeekday?.getDate(), 30);
console.log('  ✓ Weekdays schedule skips weekend');

// Test 6: Weekly next run uses configured ISO weekday
const nextWeekly = getNextScheduledRun(
  createSchedule({ type: 'weekly', time: '09:00', days: [2] }),
  new Date(2026, 2, 28, 10, 0) // Saturday
);
assert.ok(nextWeekly);
assert.strictEqual(getIsoWeekday(nextWeekly!), 2); // Tuesday
assert.strictEqual(nextWeekly?.getDate(), 31);
console.log('  ✓ Weekly schedule uses configured ISO weekday');

// Test 7: Due run fires within grace window
const dueWithinGrace = getDueScheduledRun(
  createSchedule({ type: 'daily', time: '09:00' }),
  new Date(2026, 2, 28, 9, 3),
  null,
  SCHEDULE_GRACE_MS
);
assert.ok(dueWithinGrace);
assert.strictEqual(dueWithinGrace?.getHours(), 9);
assert.strictEqual(dueWithinGrace?.getMinutes(), 0);
console.log('  ✓ Due run fires within grace window');

// Test 8: Stale slot is skipped outside grace window
const staleDue = getDueScheduledRun(
  createSchedule({ type: 'daily', time: '09:00' }),
  new Date(2026, 2, 28, 9, 10),
  null,
  SCHEDULE_GRACE_MS
);
assert.strictEqual(staleDue, null);
console.log('  ✓ Stale slot is skipped outside grace window');

// Test 9: Duplicate scheduled slot is suppressed
const todaySlot = new Date(2026, 2, 28, 9, 0, 0, 0).toISOString();
const duplicateDue = getDueScheduledRun(
  createSchedule({ type: 'daily', time: '09:00' }),
  new Date(2026, 2, 28, 9, 2),
  todaySlot,
  SCHEDULE_GRACE_MS
);
assert.strictEqual(duplicateDue, null);
console.log('  ✓ Duplicate scheduled slot is suppressed');

// Test 10: Weekday due run does not fire on weekend
const weekendDue = getDueScheduledRun(
  createSchedule({ type: 'weekdays', time: '09:00' }),
  new Date(2026, 2, 28, 9, 1), // Saturday
  null,
  SCHEDULE_GRACE_MS
);
assert.strictEqual(weekendDue, null);
console.log('  ✓ Weekday schedule does not fire on weekend');

console.log('\n✅ All flow schedule tests passed!');
