/**
 * The presenter view's time of day (decks README, small details item 2, 17 November): in the system's 12- or 24-hour
 * format. The webview's own locale is Ritemark's display language (English), not the system's region, so the host
 * reads the system's: on macOS its region (`AppleLocale`) and its 24-hour switch (`AppleICUForce24HourTime`, or
 * `AppleICUForce12HourTime` the other way); elsewhere the extension host's own locale. The webview formats the time
 * with it (`timeOfDayText`).
 */
import { execFile } from 'child_process';
import type { ClockLocale } from './presentProtocol';

/** How long one `defaults read` may take before the clock does without it. */
const READ_MS = 1500;

/**
 * A macOS region (`AppleLocale`) as a locale tag: `et_EE` → `et-EE`; `en_US@rg=eezzzz` (English with the region set to
 * Estonia) → `en-EE`. Null when it is not one.
 */
export function localeTagOf(appleLocale: string | null | undefined): string | null {
  if (!appleLocale) return null;
  const [base, ...keywords] = appleLocale.trim().split('@');
  let tag = base.replace(/_/g, '-');
  const region = keywords.join(';').match(/(?:^|;)rg=([a-z]{2})zzzz/i);
  if (region) tag = tag.replace(/-[A-Za-z]{2}$/, '') + '-' + region[1].toUpperCase();
  try {
    return Intl.getCanonicalLocales(tag)[0] ?? null;
  } catch {
    return null;
  }
}

/** The system's clock from what macOS says: a forced 24- or 12-hour time over the region's own. */
export function clockLocaleOf(read: { appleLocale?: string | null; force24?: string | null; force12?: string | null }): ClockLocale {
  const on = (value: string | null | undefined) => value?.trim() === '1' || value?.trim().toLowerCase() === 'true';
  const hourCycle = on(read.force24) ? 'h23' : on(read.force12) ? 'h12' : null;
  return { locale: localeTagOf(read.appleLocale), hourCycle };
}

function readDefault(key: string): Promise<string | null> {
  return new Promise(resolve => {
    try {
      execFile('defaults', ['read', '-g', key], { timeout: READ_MS }, (error, stdout) => resolve(error ? null : String(stdout)));
    } catch {
      resolve(null);
    }
  });
}

/** The system's clock, read once per presentation. Never fails: without an answer, the host's own locale. */
export async function readSystemClock(platform: NodeJS.Platform = process.platform): Promise<ClockLocale> {
  const own = (): ClockLocale => {
    try {
      return { locale: Intl.DateTimeFormat().resolvedOptions().locale ?? null, hourCycle: null };
    } catch {
      return { locale: null, hourCycle: null };
    }
  };
  if (platform !== 'darwin') return own();
  const [appleLocale, force24, force12] = await Promise.all(['AppleLocale', 'AppleICUForce24HourTime', 'AppleICUForce12HourTime'].map(readDefault));
  const clock = clockLocaleOf({ appleLocale, force24, force12 });
  return clock.locale ? clock : { ...own(), hourCycle: clock.hourCycle };
}
