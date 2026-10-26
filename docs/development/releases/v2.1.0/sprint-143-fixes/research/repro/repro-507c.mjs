#!/usr/bin/env node
// #507 with the films' exact method (the Social manager, 27 October): Playwright connectOverCDP to the
// app's port, then page.mouse.click inside Home's webview and page.keyboard.press('Meta+Shift+p') on the
// main workbench page, at once. Ten tries each for ⌘⇧P and ⌘P; a control with the click on the window chrome.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { lib, freshProfile, sleep } from './cdp-lib.mjs';

const argv = process.argv.slice(2);
const option = (n, f) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : f; };
const REPO = option('repo'); const PORT = Number(option('port', '9244')); const PROFILE = option('profile', '/private/tmp/claude-501/r143-keys');
const WS = option('ws', '/private/tmp/r143-keys-ws'); const OUT = option('out');
const require = createRequire(path.join(REPO, 'vscode', 'package.json'));
const { chromium } = require('playwright-core');
const c = lib(PORT);
const report = { cases: [] };
fs.mkdirSync(WS, { recursive: true });
fs.writeFileSync(path.join(WS, 'README.md'), '# Keys\n');
freshProfile(PROFILE, { 'ritemark.analytics.enabled': false });
if (c.portBusy()) throw new Error('port busy');
const APP = option('app');
if (APP) {
  // The installed, signed app, on its own short profile (memory: installed-app isolated CDP repro).
  const { execFileSync } = await import('node:child_process');
  execFileSync('open', ['-n', '-g', '-j', '-a', APP, '--env', 'RITEMARK_BUILD_CHANNEL=test', '--args', WS,
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${path.join(PROFILE, 'ud')}`, `--extensions-dir=${path.join(PROFILE, 'ext')}`,
    `--shared-data-dir=${path.join(PROFILE, 'shared')}`, '--use-mock-keychain',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling']);
  for (let i = 0; i < 60 && !(await fetch(`http://127.0.0.1:${PORT}/json/version`).then(() => true, () => false)); i += 1) await sleep(1000);
} else {
  await c.launch({ repo: REPO, profile: PROFILE, args: [WS], log: path.join(PROFILE, 'launch.log') });
}
const HOME = "d.querySelector('.rh-line') || d.querySelector('[aria-label=\"Bring work in\"]')";
let browser;
try {
  report.home = Boolean(await c.waitFor(HOME, 'return true', 60));
  await sleep(2500);
  report.timeFormat = await c.inFrame(HOME, "return new Date(2026, 9, 27, 15, 12).toLocaleTimeString(undefined, { timeStyle: 'short' }) + ' | ' + navigator.language");
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
  const pages = browser.contexts().flatMap((context) => context.pages());
  const workbench = pages.find((p) => p.url().startsWith('vscode-file://'));
  if (!workbench) throw new Error('no workbench page through Playwright');
  const paletteOpen = () => workbench.evaluate(() => { const q = document.querySelector('.quick-input-widget'); return !!q && getComputedStyle(q).display !== 'none' && q.offsetHeight > 0; });
  const title = await c.rectIn(HOME, "d.querySelector('h1, .rh-title, h2')");
  for (const keys of ['Meta+Shift+p', 'Meta+p']) {
    for (let i = 1; i <= 10; i += 1) {
      await workbench.mouse.click(title.x, title.y);
      await workbench.keyboard.press(keys);
      await sleep(900);
      const opened = await paletteOpen();
      report.cases.push({ keys, i, opened });
      if (opened) { await workbench.keyboard.press('Escape'); await sleep(400); }
    }
  }
  // Control: the click on the window chrome (the tab row), then the keys.
  await workbench.mouse.click(700, 26);
  await workbench.keyboard.press('Meta+Shift+p');
  await sleep(900);
  report.control = await paletteOpen();
} catch (error) {
  report.error = String(error?.stack ?? error);
} finally {
  fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
  try { await browser?.close(); } catch { /* the app stays for ⌘Q */ }
  await c.quit();
}
const summary = {};
for (const item of report.cases) summary[item.keys] = (summary[item.keys] ?? 0) + (item.opened ? 1 : 0);
console.log(JSON.stringify({ home: report.home, timeFormat: report.timeFormat, opened: summary, of: 10, control: report.control, error: report.error }, null, 1));
