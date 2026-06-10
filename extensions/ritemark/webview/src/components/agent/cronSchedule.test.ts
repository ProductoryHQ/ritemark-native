/**
 * Tests for cronSchedule.ts — cron ↔ UiSchedule round-trips.
 * Run: npx tsx webview/src/components/agent/cronSchedule.test.ts
 */
import assert from 'node:assert'
import { uiToCron, cronToUi } from './cronSchedule'

// ── interval minutes presets ─────────────────────────────────────────────────

for (const n of [5, 10, 15, 20, 30]) {
  const cron = `*/${n} * * * *`
  const ui = cronToUi(cron)
  assert.ok(ui !== null, `cronToUi('${cron}') should parse`)
  assert.strictEqual(ui!.mode, 'interval', `mode for ${cron}`)
  assert.strictEqual(ui!.intervalUnit, 'minutes', `unit for ${cron}`)
  assert.strictEqual(ui!.intervalN, n, `N for ${cron}`)
  assert.strictEqual(uiToCron(ui!), cron, `round-trip for ${cron}`)
}

// ── interval hours presets ───────────────────────────────────────────────────

for (const n of [1, 2, 3, 4, 6, 8, 12]) {
  const cron = `0 */${n} * * *`
  const ui = cronToUi(cron)
  assert.ok(ui !== null, `cronToUi('${cron}') should parse`)
  assert.strictEqual(ui!.mode, 'interval', `mode for ${cron}`)
  assert.strictEqual(ui!.intervalUnit, 'hours', `unit for ${cron}`)
  assert.strictEqual(ui!.intervalN, n, `N for ${cron}`)
  assert.strictEqual(uiToCron(ui!), cron, `round-trip for ${cron}`)
}

// ── days — weekday list (comma) ───────────────────────────────────────────────

const weekdayCron = '0 9 * * 1,2,3,4,5'
const weekdayUi = cronToUi(weekdayCron)
assert.ok(weekdayUi !== null, 'cronToUi weekday list should parse')
assert.strictEqual(weekdayUi!.mode, 'days')
assert.deepStrictEqual(weekdayUi!.days, [1, 2, 3, 4, 5])
assert.strictEqual(weekdayUi!.time, '09:00')
assert.strictEqual(uiToCron(weekdayUi!), weekdayCron, 'round-trip weekday list')

// ── days — all days → `*` ─────────────────────────────────────────────────────

const allDaysCron = '30 8 * * *'
const allDaysUi = cronToUi(allDaysCron)
assert.ok(allDaysUi !== null, 'cronToUi all-days should parse')
assert.strictEqual(allDaysUi!.mode, 'days')
assert.deepStrictEqual(allDaysUi!.days, [], 'all-days → empty array')
assert.strictEqual(allDaysUi!.time, '08:30')
// uiToCron with 0 days should produce `*`
assert.strictEqual(uiToCron(allDaysUi!), allDaysCron, 'round-trip all-days')

// ── days — `1-5` range expands to [1,2,3,4,5] ────────────────────────────────

const rangeCron = '0 9 * * 1-5'
const rangeUi = cronToUi(rangeCron)
assert.ok(rangeUi !== null, 'cronToUi range should parse')
assert.strictEqual(rangeUi!.mode, 'days')
assert.deepStrictEqual(rangeUi!.days, [1, 2, 3, 4, 5], 'range 1-5 expands correctly')
assert.strictEqual(rangeUi!.time, '09:00')
// uiToCron round-trip will produce comma form, not range — that is acceptable
// (the daemon engine supports both; the UI always writes comma lists)
const rangeRoundTrip = uiToCron(rangeUi!)
assert.strictEqual(rangeRoundTrip, '0 9 * * 1,2,3,4,5', 'range round-trip produces comma form')

// ── days — single day ─────────────────────────────────────────────────────────

const mondayCron = '0 10 * * 1'
const mondayUi = cronToUi(mondayCron)
assert.ok(mondayUi !== null, 'cronToUi single day should parse')
assert.deepStrictEqual(mondayUi!.days, [1])
assert.strictEqual(mondayUi!.time, '10:00')
assert.strictEqual(uiToCron(mondayUi!), mondayCron, 'round-trip single day')

// ── non-representable crons → null ───────────────────────────────────────────

// dom and mon are not `*`
assert.strictEqual(cronToUi('0 9 15 * 1-5'), null, 'specific dom → null')
assert.strictEqual(cronToUi('0 9 * 6 1-5'), null, 'specific mon → null')

// hour range — cannot be represented by either mode
assert.strictEqual(cronToUi('*/15 9-17 * * 1-5'), null, 'hour range → null')

// complex minute field
assert.strictEqual(cronToUi('0,30 9 * * *'), null, 'comma minute field → null')

// step on dow
assert.strictEqual(cronToUi('0 9 * * */2'), null, 'step on dow → null')

// completely invalid
assert.strictEqual(cronToUi('not a cron'), null, 'garbage → null')
assert.strictEqual(cronToUi('* * * *'), null, 'only 4 fields → null')

console.log('cronSchedule tests passed ✅')
