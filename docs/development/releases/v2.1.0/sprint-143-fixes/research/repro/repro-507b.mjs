#!/usr/bin/env node
// #507 with the tool the films were driven by: agent-browser's `press Meta+Shift+p`
// (Playwright keyboard over CDP) after a click inside Home, against raw CDP keys.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { lib, freshProfile, sleep } from './cdp-lib.mjs';

const argv = process.argv.slice(2);
const option = (n, f) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : f; };
const REPO = option('repo'); const PORT = Number(option('port', '9373')); const PROFILE = option('profile', '/private/tmp/claude-501/r143-d');
const WS = option('ws', '/private/tmp/r143-ws4'); const OUT = option('out'); const AB = option('ab');
const c = lib(PORT);
const report = { cases: [] };
const save = () => fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
fs.mkdirSync(WS, { recursive: true });
fs.writeFileSync(path.join(WS, 'README.md'), '# Keys\n');
freshProfile(PROFILE, {});
const ab = (...args) => { try { return execFileSync(AB, ['--session', 'r143keys', '--cdp', String(PORT), ...args], { encoding: 'utf8', timeout: 30000 }).trim(); } catch (e) { return `ERR ${String(e.stderr || e.message).slice(0, 200)}`; } };
await c.launch({ repo: REPO, profile: PROFILE, args: [WS], log: path.join(PROFILE, 'launch.log') });
const HOME = "d.querySelector('.rh-line') || d.querySelector('[aria-label=\"Bring work in\"]')";
const paletteOpen = () => c.workbench("(function(){const q=document.querySelector('.quick-input-widget'); return !!q && getComputedStyle(q).display!=='none' && q.offsetHeight>0;})()");
const closePalette = async () => { if (await paletteOpen()) { await c.press('Escape', 'Escape', 27); await sleep(500); } };
try {
  report.homeReady = Boolean(await c.waitFor(HOME, 'return true', 60));
  await sleep(2500);
  report.connect = ab('connect', String(PORT));
  report.pages = ab('tab');
  for (let round = 1; round <= 3; round += 1) {
    for (const how of ['agent-browser', 'raw-cdp']) {
      await c.clickIn(HOME, "d.querySelector('h1, .rh-title, h2')"); await sleep(500);
      const before = await c.workbench("(function(){const a=document.activeElement; return a? a.tagName+'.'+String(a.className).slice(0,40) : null;})()");
      let out = '';
      if (how === 'agent-browser') out = ab('press', 'Meta+Shift+p');
      else await c.press('P', 'KeyP', 80, 4 | 8);
      await sleep(1000);
      const opened = await paletteOpen();
      report.cases.push({ round, how, before, opened, out: out.slice(0, 120) });
      console.log(round, how, opened, before, out.slice(0, 80));
      save();
      await closePalette();
    }
  }
  // and from the workbench (the editor area's tab row) with agent-browser, as a control
  await c.mouse(700, 26); await sleep(500);
  const out = ab('press', 'Meta+Shift+p'); await sleep(1000);
  report.control = { opened: await paletteOpen(), out: out.slice(0, 120) };
  console.log('control (focus in the workbench)', report.control.opened);
  await closePalette();
} catch (error) { report.error = String(error?.stack ?? error); console.log('ERROR', report.error); }
finally { save(); await c.quit(); }
