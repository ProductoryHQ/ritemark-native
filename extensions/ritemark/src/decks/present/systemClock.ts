/**
 * The presenter view's time of day (decks README, small details item 2, 17 November): in the system's 12- or 24-hour
 * format. The webview's own locale is Ritemark's display language (English), not the system's region, so the host
 * reads the system's: on macOS its region (`AppleLocale`) and its 24-hour switch (`AppleICUForce24HourTime`, or
 * `AppleICUForce12HourTime` the other way); on Windows its region (`LocaleName`) and its short time format
 * (`sShortTime`, "HH:mm" or "h:mm tt"), from `HKCU\Control Panel\International`; elsewhere the extension host's own
 * locale. Read once per presentation, so a change in the system's settings shows at the next Present. The webview
 * formats the time with it (`timeOfDayFormat`).
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

/**
 * The system's clock from Windows' regional settings (`reg query "HKCU\Control Panel\International"`): `LocaleName`
 * as the locale, and `sShortTime`'s hours, `H` for 24-hour and `h` for 12-hour.
 */
export function windowsClockOf(regOutput: string | null): ClockLocale {
  const value = (name: string) => regOutput?.match(new RegExp(`^\\s*${name}\\s+REG_SZ\\s+(.+?)\\s*$`, 'mi'))?.[1] ?? null;
  const shortTime = value('sShortTime');
  // Literal text in a Windows time format is quoted ('h' 'Uhr'); only the pattern's letters count.
  const pattern = shortTime?.replace(/'[^']*'/g, '') ?? '';
  const hourCycle = /H/.test(pattern) ? 'h23' : /h/.test(pattern) ? 'h12' : null;
  return { locale: localeTagOf(value('LocaleName')), hourCycle };
}

function run(command: string, args: string[]): Promise<string | null> {
  return new Promise(resolve => {
    try {
      execFile(command, args, { timeout: READ_MS, windowsHide: true }, (error, stdout) => resolve(error ? null : String(stdout)));
    } catch {
      resolve(null);
    }
  });
}

function readDefault(key: string): Promise<string | null> {
  return run('defaults', ['read', '-g', key]);
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
  let clock: ClockLocale;
  if (platform === 'darwin') {
    const [appleLocale, force24, force12] = await Promise.all(['AppleLocale', 'AppleICUForce24HourTime', 'AppleICUForce12HourTime'].map(readDefault));
    clock = clockLocaleOf({ appleLocale, force24, force12 });
  } else if (platform === 'win32') {
    clock = windowsClockOf(await run('reg', ['query', 'HKCU\\Control Panel\\International']));
  } else {
    return own();
  }
  return clock.locale ? clock : { ...own(), hourCycle: clock.hourCycle };
}
