/**
 * Minimal 5-field cron support (minute hour day-of-month month day-of-week) with
 * no external dependency. Supports `*`, exact numbers, `a-b` ranges, `a,b,c`
 * lists, and `*​/n` / `a-b/n` steps in each field.
 *
 * Pure and deterministic: `computeNextFire` takes the reference instant
 * explicitly rather than reading the clock, so it is unit-testable without
 * mocking time. All comparisons use local time (the same wall clock the user
 * authored the schedule against).
 */
export function computeNextFire(expr: string, from: Date): Date | undefined {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    return undefined;
  }
  const [minPart, hourPart, domPart, monPart, dowPart] = parts;

  const candidate = new Date(from);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1); // start from the next minute

  const limit = new Date(from);
  limit.setFullYear(limit.getFullYear() + 1); // give up after one year

  while (candidate < limit) {
    if (
      matchField(candidate.getMinutes(), minPart, 0, 59) &&
      matchField(candidate.getHours(), hourPart, 0, 23) &&
      matchField(candidate.getDate(), domPart, 1, 31) &&
      matchField(candidate.getMonth() + 1, monPart, 1, 12) &&
      matchField(candidate.getDay(), dowPart, 0, 6)
    ) {
      return candidate;
    }
    candidate.setMinutes(candidate.getMinutes() + 1);
  }
  return undefined;
}

export function matchField(value: number, expr: string, min: number, max: number): boolean {
  if (expr === '*') {
    return true;
  }
  for (const part of expr.split(',')) {
    if (part.includes('/')) {
      const [range, stepStr] = part.split('/');
      const step = parseInt(stepStr, 10);
      const [lo, hi] = range === '*'
        ? [min, max]
        : range.split('-').map(Number);
      if (value >= lo && value <= hi && (value - lo) % step === 0) {
        return true;
      }
    } else if (part.includes('-')) {
      const [lo, hi] = part.split('-').map(Number);
      if (value >= lo && value <= hi) {
        return true;
      }
    } else {
      if (parseInt(part, 10) === value) {
        return true;
      }
    }
  }
  return false;
}
