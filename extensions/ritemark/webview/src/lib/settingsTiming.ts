/**
 * Sprint 147, A1 (#593): the Settings page's timing marks, measurement only.
 *
 * On only when the host set `data-settings-timing` on #root (the host's `RITEMARK_SETTINGS_TIMING`); otherwise
 * nothing is sent. Each mark goes to the host, which writes it with the ms since the panel's creation, from the
 * page's own wall clock (same computer) and its time since the page's navigation started.
 */
import { vscode } from './vscode';

const sent = new Set<string>();

function enabled(): boolean {
  return typeof document !== 'undefined' && document.getElementById('root')?.dataset.settingsTiming === '1';
}

/** Sends one mark, once per page. */
export function settingsTimingMark(step: string): void {
  if (sent.has(step) || !enabled()) return;
  sent.add(step);
  vscode.postMessage({
    type: 'settings:timing',
    step,
    epoch: Date.now(),
    pageMs: performance.now(),
    originEpoch: performance.timeOrigin,
  });
}
