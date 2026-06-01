import { parseExpression } from 'cron-parser';

/** Parse and optionally humanize a 5-part cron expression.
 * Returns a human-readable string for common patterns, otherwise
 * returns the original expression after validating it is parseable.
 * Throws if the expression is invalid.
 */
export function parseCronExpression(expr: string): string {
  const trimmed = expr.trim();

  // Validate via cron-parser (throws on bad syntax)
  parseExpression(trimmed);

  const humanized = humanizeCron(trimmed);
  return humanized ?? trimmed;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function fmt(h: number, m: number): string {
  const hour = h % 12 || 12;
  const ampm = h < 12 ? 'AM' : 'PM';
  const min = m === 0 ? '' : `:${String(m).padStart(2, '0')}`;
  return `${hour}${min} ${ampm}`;
}

function humanizeCron(expr: string): string | undefined {
  const p = expr.split(/\s+/);
  if (p.length !== 5) return undefined;
  const [min, hour, dom, month, dow] = p;

  if (min === '*' && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    return 'Every minute';
  }

  const everyMin = min.match(/^\*\/(\d+)$/);
  if (everyMin && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    const n = parseInt(everyMin[1]);
    return `Every ${n} minute${n === 1 ? '' : 's'}`;
  }

  if (min === '0' && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    return 'Every hour';
  }

  const everyHour = hour.match(/^\*\/(\d+)$/);
  if (min === '0' && everyHour && dom === '*' && month === '*' && dow === '*') {
    const n = parseInt(everyHour[1]);
    return `Every ${n} hour${n === 1 ? '' : 's'}`;
  }

  const mNum = parseInt(min);
  const hNum = parseInt(hour);
  const fixedTime =
    !Number.isNaN(mNum) && !Number.isNaN(hNum) &&
    !min.includes('*') && !min.includes('/') &&
    !hour.includes('*') && !hour.includes('/');

  if (fixedTime) {
    const t = fmt(hNum, mNum);

    if (dom === '*' && month === '*' && dow === '*') return `Daily at ${t}`;
    if (dom === '*' && month === '*' && dow === '1-5') return `Weekdays at ${t}`;
    if (dom === '*' && month === '*' && (dow === '0,6' || dow === '6,0')) return `Weekends at ${t}`;

    const dowNum = parseInt(dow);
    if (dom === '*' && month === '*' && !Number.isNaN(dowNum) && !dow.includes(',') && !dow.includes('-') && !dow.includes('/')) {
      return `Every ${DAYS[dowNum % 7]} at ${t}`;
    }

    const domNum = parseInt(dom);
    if (!Number.isNaN(domNum) && !dom.includes('*') && !dom.includes('/') && month === '*' && dow === '*') {
      const sfx = domNum === 1 ? 'st' : domNum === 2 ? 'nd' : domNum === 3 ? 'rd' : 'th';
      return `Monthly on the ${domNum}${sfx} at ${t}`;
    }
  }

  return undefined;
}
