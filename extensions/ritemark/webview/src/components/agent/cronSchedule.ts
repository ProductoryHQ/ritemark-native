/**
 * cronSchedule.ts — pure cron ↔ UI-schedule conversion helpers.
 *
 * Supported cron patterns:
 *   interval minutes  →  `*\/N * * * *`
 *   interval hours    →  `0 *\/N * * *`
 *   days              →  `MM HH * * DOW`
 *     where MM, HH are plain integers, dom=`*`, mon=`*`
 *     and DOW is `*`, a comma-list of ints, or a single `a-b` range
 *
 * Anything else → cronToUi returns null (caller opens Advanced mode).
 */

export type ScheduleMode = 'interval' | 'days'

export interface UiSchedule {
  mode: ScheduleMode
  intervalN: number            // interval mode: step value
  intervalUnit: 'minutes' | 'hours'
  days: number[]               // days mode: cron dow numbers 0..6 (0=Sun); [] or all 7 => every day
  time: string                 // days mode: 'HH:MM' zero-padded
}

// ── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_UI_SCHEDULE: UiSchedule = {
  mode: 'days',
  intervalN: 15,
  intervalUnit: 'minutes',
  days: [1, 2, 3, 4, 5],      // weekdays
  time: '09:00',
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/** Expand an `a-b` range string like "1-5" into [1,2,3,4,5]. */
function expandRange(s: string): number[] | null {
  const m = s.match(/^(\d+)-(\d+)$/)
  if (!m) return null
  const lo = parseInt(m[1], 10)
  const hi = parseInt(m[2], 10)
  if (lo > hi) return null
  const out: number[] = []
  for (let i = lo; i <= hi; i++) out.push(i)
  return out
}

/** Parse a DOW field (`*`, comma list of ints, or single `a-b` range) into a sorted int array or null. */
function parseDow(s: string): number[] | null {
  if (s === '*') return []          // [] = every day (no restriction)

  // comma list (may be a single item)
  if (/^[\d,]+$/.test(s)) {
    const nums = s.split(',').map(n => parseInt(n, 10))
    if (nums.some(n => isNaN(n) || n < 0 || n > 6)) return null
    return [...new Set(nums)].sort((a, b) => a - b)
  }

  // single range  e.g. "1-5"
  const expanded = expandRange(s)
  if (expanded !== null) {
    if (expanded.some(n => n < 0 || n > 6)) return null
    return expanded
  }

  return null
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Convert a UiSchedule to a 5-field cron string.
 */
export function uiToCron(ui: UiSchedule): string {
  if (ui.mode === 'interval') {
    if (ui.intervalUnit === 'minutes') {
      return `*/${ui.intervalN} * * * *`
    }
    // hours
    return `0 */${ui.intervalN} * * *`
  }

  // days mode
  const [hhStr, mmStr] = ui.time.split(':')
  const hh = parseInt(hhStr ?? '9', 10)
  const mm = parseInt(mmStr ?? '0', 10)
  const minuteStr = String(mm)
  const hourStr = String(hh)

  const hasAll7 = ui.days.length === 0 || ui.days.length === 7
  const dow = hasAll7 ? '*' : ui.days.slice().sort((a, b) => a - b).join(',')

  return `${minuteStr} ${hourStr} * * ${dow}`
}

/**
 * Parse a 5-field cron string into a UiSchedule, or return null if the
 * expression cannot be represented by the two picker modes.
 */
export function cronToUi(cron: string): UiSchedule | null {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return null

  const [min, hour, dom, mon, dow] = parts

  // dom and mon must be `*` for both modes
  if (dom !== '*' || mon !== '*') return null

  // ── interval minutes: `*/N * * * *` ──
  const intervalMinMatch = min.match(/^\*\/(\d+)$/)
  if (intervalMinMatch && hour === '*' && dow === '*') {
    const n = parseInt(intervalMinMatch[1], 10)
    if (isNaN(n) || n <= 0) return null
    return {
      mode: 'interval',
      intervalN: n,
      intervalUnit: 'minutes',
      days: [],
      time: '09:00',
    }
  }

  // ── interval hours: `0 */N * * *` ──
  const intervalHrMatch = hour.match(/^\*\/(\d+)$/)
  if (intervalHrMatch && min === '0' && dow === '*') {
    const n = parseInt(intervalHrMatch[1], 10)
    if (isNaN(n) || n <= 0) return null
    return {
      mode: 'interval',
      intervalN: n,
      intervalUnit: 'hours',
      days: [],
      time: '09:00',
    }
  }

  // ── days: `MM HH * * DOW` where MM and HH are plain ints ──
  const mmVal = parseInt(min, 10)
  const hhVal = parseInt(hour, 10)
  if (
    !isNaN(mmVal) && String(mmVal) === min &&
    !isNaN(hhVal) && String(hhVal) === hour
  ) {
    const dowNums = parseDow(dow)
    if (dowNums === null) return null
    const mm2 = String(mmVal).padStart(2, '0')
    const hh2 = String(hhVal).padStart(2, '0')
    return {
      mode: 'days',
      intervalN: 15,
      intervalUnit: 'minutes',
      days: dowNums,
      time: `${hh2}:${mm2}`,
    }
  }

  return null
}
