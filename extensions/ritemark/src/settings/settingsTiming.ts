/**
 * Sprint 147, A1 (#593): timing lines for the Settings tab's draw. Measurement only: no behaviour changes.
 *
 * Off unless the app starts with `RITEMARK_SETTINGS_TIMING=1`. Then each step writes one line,
 *   [settings-timing] run=<n> step=<name> ms=<ms since the panel's creation>
 * to the extension host's console and appended to `RITEMARK_SETTINGS_TIMING_FILE` (default: the system temp
 * folder's `ritemark-settings-timing.log`). `scripts/qa/settings-timing.mjs` reads that file.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export const SETTINGS_TIMING_PREFIX = '[settings-timing]';

const enabled = Boolean(process.env.RITEMARK_SETTINGS_TIMING) && process.env.RITEMARK_SETTINGS_TIMING !== '0';
const logFile = process.env.RITEMARK_SETTINGS_TIMING_FILE || path.join(os.tmpdir(), 'ritemark-settings-timing.log');

let run = 0;
let originEpoch = 0;
const counts = new Map<string, number>();

export function settingsTimingEnabled(): boolean {
  return enabled;
}

function write(step: string, ms: number, extra = ''): void {
  const line = `${SETTINGS_TIMING_PREFIX} run=${run} step=${step} ms=${ms.toFixed(1)}${extra}`;
  console.log(line);
  try {
    fs.appendFileSync(logFile, `${line}\n`);
  } catch {
    // measurement only: a log that can't be written changes nothing
  }
}

/** The clock's zero: a new Settings panel, created or restored. */
export function settingsTimingStart(how: 'created' | 'restored'): void {
  if (!enabled) return;
  run = Date.now();
  originEpoch = run;
  counts.clear();
  write(`panel-${how}`, 0);
}

/** One host step; a step seen again in the same run gets #2, #3… */
export function settingsTimingMark(step: string): void {
  if (!enabled || !originEpoch) return;
  const seen = (counts.get(step) ?? 0) + 1;
  counts.set(step, seen);
  write(seen > 1 ? `${step}#${seen}` : step, Date.now() - originEpoch);
}

/** Times one probe: its line is written when it settles. */
export function settingsTimed<T>(step: string, work: Promise<T>): Promise<T> {
  if (!enabled) return work;
  return work.finally(() => settingsTimingMark(`probe:${step}`));
}

/** A page mark (the page's `settings:timing` message), on the host's clock; `page=` is the page's own ms since its navigation. */
export function settingsTimingPage(message: { step?: unknown; epoch?: unknown; pageMs?: unknown; originEpoch?: unknown }): void {
  if (!enabled || !originEpoch || typeof message.step !== 'string' || typeof message.epoch !== 'number') return;
  const step = `page:${message.step.replace(/[^\w:-]/g, '')}`;
  if (message.step === 'script-start' && typeof message.originEpoch === 'number') {
    write('page:navigation-start', message.originEpoch - originEpoch);
  }
  write(step, message.epoch - originEpoch, typeof message.pageMs === 'number' ? ` page=${message.pageMs.toFixed(1)}` : '');
}
