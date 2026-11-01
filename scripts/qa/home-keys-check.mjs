#!/usr/bin/env node
/**
 * home-keys-check.mjs - the palette keys on Home (Sprint 145, A5, R11, S48, #507).
 *
 * Usage (from the repository root, with a built dev tree, or --app for an installed build):
 *   node scripts/qa/home-keys-check.mjs [--rounds 10] [--port 9355] [--vscode <dir> | --app <Ritemark.app>]
 *       [--profile /private/tmp/<dir>] [--attach --workspace <folder>] [--out <json>]
 *
 * The scripted twin of S48. A person at a real keyboard is the check that counts for #507 (Sprint 143: synthetic
 * presses never failed; the films that showed it sent keys through a script). This script is here so that the
 * next sighting has a reproducer that records what a person can't see: the workbench's and Home's active
 * elements before each press, and whether the palette opened.
 *
 * Without --attach it starts one hidden instance (`open -n -g -j`, --use-mock-keychain, the three backgrounding
 * flags, its own short profile, scratch homes for the AIs; HOME is not changed) on a scratch project and quits only
 * that instance. With --attach it uses an instance on --port whose window has --workspace open, on Home.
 *
 * Per round, ⌘⇧P (Ctrl+Shift+P on Windows) in each of S48's cases:
 *   a  after a click on Home's title          (and ⌘P, ⌘, in this case: Quick Open and Settings)
 *   b  after Tab to a control on Home
 *   c  in the line's input
 *   d  after Home redraws (a file added to the project)
 *   e  back on Home by its tab, from the Task board (no click inside)
 * Every press prints PASS or FAIL; the exit code is the number of FAILs.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const option = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : fallback; };
const REPO = option('repo', path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'));
const VSCODE = option('vscode', path.join(REPO, 'vscode'));
const APP = option('app');
const PORT = Number(option('port', '9355'));
// The profile is deleted and made again at start, so it must be a folder of its own under the temp folder.
// On the Mac that is /private/tmp (a short path: the IPC socket lives in it); elsewhere the system's.
const TEMP_ROOT = process.platform === 'darwin' ? '/private/tmp' : fs.realpathSync(os.tmpdir());
const PROFILE = path.resolve(option('profile', process.platform === 'darwin' ? '/private/tmp/claude-501/rm-home-keys' : path.join(TEMP_ROOT, 'rm-home-keys')));
const ATTACH = argv.includes('--attach');
const ROUNDS = Number(option('rounds', '10'));
const OUT = option('out', `${PROFILE}-report.json`);
const MAC = process.platform === 'darwin';
const MOD = MAC ? 4 : 2;
const SHIFT = 8;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!ATTACH && (path.dirname(PROFILE) === PROFILE || !PROFILE.startsWith(`${TEMP_ROOT}${path.sep}`) || path.relative(TEMP_ROOT, PROFILE).split(path.sep).length < 2)) {
  throw new Error(`--profile must be a folder at least two levels inside ${TEMP_ROOT} (it is deleted and made again)`);
}
if (!ATTACH && process.platform !== 'darwin') throw new Error('Starting an instance is Mac-only (open -n -g -j): start Ritemark yourself with --remote-debugging-port and use --attach --workspace <folder>');

// ── raw CDP ────────────────────────────────────────────────────────────────
const targets = async () => (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0; const pending = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); const w = pending.get(d.id); if (!w) return; pending.delete(d.id); d.error ? w.reject(new Error(JSON.stringify(d.error))) : w.resolve(d.result); };
  return { send: (method, params = {}) => new Promise((resolve, reject) => { const mid = ++id; pending.set(mid, { resolve, reject }); ws.send(JSON.stringify({ id: mid, method, params })); }), close: () => ws.close() };
}
async function evaluate(url, expression) {
  const c = await connect(url);
  try { const r = await c.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; } finally { c.close(); }
}
async function page() { const t = (await targets()).find((c) => c.type === 'page' && c.url.startsWith('vscode-file://') && c.url.includes('workbench')); if (!t) throw new Error('no workbench page'); return t; }
const workbench = async (expression) => evaluate((await page()).webSocketDebuggerUrl, expression);
async function webview(probe) {
  for (const t of (await targets()).filter((c) => c.type === 'iframe' && c.url.startsWith('vscode-webview://'))) {
    const ok = await evaluate(t.webSocketDebuggerUrl, `(function(){const af=document.getElementById('active-frame'); if(!af||!af.contentWindow) return false; const d=af.contentDocument; return Boolean(${probe});})()`).catch(() => false);
    if (ok) return t;
  }
  return null;
}
async function inFrame(probe, body) { const t = await webview(probe); if (!t) return null; return evaluate(t.webSocketDebuggerUrl, `(async function(){const af=document.getElementById('active-frame'); const w=af.contentWindow, d=af.contentDocument; ${body}})()`); }
async function withPage(fn) { const c = await connect((await page()).webSocketDebuggerUrl); try { return await fn(c); } finally { c.close(); } }
const mouse = (x, y) => withPage(async (c) => { for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await c.send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: 1 }); });
const press = (key, code, keyCode, modifiers = 0) => withPage(async (c) => {
  await c.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode: keyCode, modifiers });
  await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode, modifiers });
});
async function clickIn(probe, el) {
  const t = await webview(probe); if (!t) return false;
  const rect = await evaluate(t.webSocketDebuggerUrl, `(function(){const af=document.getElementById('active-frame'); const d=af.contentDocument; const el=(${el}); if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.x+Math.min(20,r.width/2),y:r.y+r.height/2};})()`);
  if (!rect) return false;
  const id = /[?&]id=([^&]+)/.exec(t.url)?.[1] ?? '';
  const frame = await workbench(`(function(){const f=[...document.querySelectorAll('iframe')].find(i=>i.src.includes(${JSON.stringify(id)})); if(!f) return null; const r=f.getBoundingClientRect(); return {x:r.x,y:r.y};})()`);
  if (!frame) return false;
  await mouse(frame.x + rect.x, frame.y + rect.y);
  return true;
}
const portBusy = () => spawnSync('lsof', ['-nP', `-iTCP:${PORT}`, '-sTCP:LISTEN'], { encoding: 'utf8' }).stdout.trim().length > 0;

// ── what a press is checked by ─────────────────────────────────────────────
const HOME = "d.querySelector('.rh-line') || d.querySelector('[aria-label=\"Bring work in\"]')";
const quickInputOpen = () => workbench("(function(){const q=document.querySelector('.quick-input-widget'); return !!q && getComputedStyle(q).display!=='none' && q.offsetHeight>0;})()");
const settingsOpen = () => workbench("[...document.querySelectorAll('.tab')].some(t => /Settings/.test(t.getAttribute('aria-label') || ''))");
const workbenchActive = () => workbench("(function(){const a=document.activeElement; return a? (a.tagName+'.'+String(a.className).slice(0,60)) : null;})()");
const homeActive = () => inFrame(HOME, "const a=d.activeElement; return {hasFocus: d.hasFocus(), active: a? (a.tagName+'.'+String(a.className).slice(0,40)+(a.getAttribute('aria-label')? ' ['+a.getAttribute('aria-label').slice(0,40)+']':'')) : null};");

const results = [];
let failures = 0;
async function check(label, keys) {
  const before = { workbench: await workbenchActive(), home: await homeActive().catch(() => null) };
  const { key, code, keyCode, modifiers, opened } = keys;
  await press(key, code, keyCode, modifiers);
  await sleep(900);
  const ok = await opened();
  if (!ok) failures++;
  results.push({ label, keys: keys.name, ok, before });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label} ${keys.name}${ok ? '' : ` ${JSON.stringify(before)}`}`);
  // Close what opened: Escape for the palette, the Settings tab with the editor's close.
  if (keys.name === 'Settings' && ok) await press('w', 'KeyW', 87, MOD);
  else if (ok) await press('Escape', 'Escape', 27);
  await sleep(500);
}
const PALETTE = { name: MAC ? '⌘⇧P' : 'Ctrl+Shift+P', key: 'P', code: 'KeyP', keyCode: 80, modifiers: MOD | SHIFT, opened: quickInputOpen };
const QUICK_OPEN = { name: MAC ? '⌘P' : 'Ctrl+P', key: 'p', code: 'KeyP', keyCode: 80, modifiers: MOD, opened: quickInputOpen };
const SETTINGS = { name: 'Settings', key: ',', code: 'Comma', keyCode: 188, modifiers: MOD, opened: settingsOpen };

// ── the instance ───────────────────────────────────────────────────────────
let workspace = option('workspace');
let launched = false;
if (!ATTACH) {
  workspace = path.join(PROFILE, 'ws');
  fs.rmSync(PROFILE, { recursive: true, force: true });
  for (const dir of ['ud/User', 'ext', 'shared', 'ws', 'ai/codex', 'ai/claude', 'ai/xdg/config', 'ai/xdg/data', 'ai/xdg/state', 'ai/xdg/cache']) fs.mkdirSync(path.join(PROFILE, dir), { recursive: true });
  fs.writeFileSync(path.join(workspace, 'README.md'), '# Home keys check\n\nA scratch project.\n');
  fs.writeFileSync(path.join(PROFILE, 'ud/User/settings.json'), JSON.stringify({ 'window.confirmBeforeClose': 'never', 'ritemark.updates.enabled': false, 'ritemark.features.analytics': false }, null, 2));
  if (portBusy()) throw new Error(`port ${PORT} is in use`);
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const ai = (p) => path.join(PROFILE, 'ai', p);
  const appArgs = APP ? [] : [VSCODE];
  execFileSync('open', ['-n', '-g', '-j', '-a', APP ?? path.join(VSCODE, '.build/electron/Ritemark.app'),
    ...(APP ? [] : ['--env', 'NODE_ENV=development', '--env', 'VSCODE_DEV=1', '--env', 'VSCODE_CLI=1']),
    '--env', 'RITEMARK_BUILD_CHANNEL=test',
    '--env', `CODEX_HOME=${ai('codex')}`, '--env', `CLAUDE_CONFIG_DIR=${ai('claude')}`,
    '--env', `XDG_CONFIG_HOME=${ai('xdg/config')}`, '--env', `XDG_DATA_HOME=${ai('xdg/data')}`, '--env', `XDG_STATE_HOME=${ai('xdg/state')}`, '--env', `XDG_CACHE_HOME=${ai('xdg/cache')}`,
    '--stdout', path.join(PROFILE, 'launch.log'), '--stderr', path.join(PROFILE, 'launch.log'),
    '--args', ...appArgs, workspace,
    ...(APP ? [] : ['--disable-extension=vscode.vscode-api-tests']), `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${path.join(PROFILE, 'ud')}`, `--extensions-dir=${path.join(PROFILE, 'ext')}`, `--shared-data-dir=${path.join(PROFILE, 'shared')}`,
    '--use-mock-keychain', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling'], { env });
  launched = true;
  for (let i = 0; i < 90 && !(await fetch(`http://127.0.0.1:${PORT}/json/version`).then(() => true, () => false)); i += 1) await sleep(1000);
}
if (!workspace) throw new Error('--attach needs --workspace <the folder open in that window>');

try {
  for (let i = 0; i < 60 && !(await webview(HOME)); i++) await sleep(1000);
  if (!(await webview(HOME))) throw new Error('Home did not show');
  await sleep(2500);
  const title = "d.querySelector('h1, .rh-title, h2')";
  for (let round = 1; round <= ROUNDS; round++) {
    await clickIn(HOME, title); await sleep(400);
    await check(`r${round} a: after a click on Home's title`, PALETTE);
    if (round === 1) {
      await clickIn(HOME, title); await sleep(400);
      await check(`r${round} a: after a click on Home's title`, QUICK_OPEN);
      await clickIn(HOME, title); await sleep(400);
      await check(`r${round} a: after a click on Home's title`, SETTINGS);
    }
    await clickIn(HOME, title); await sleep(300);
    await press('Tab', 'Tab', 9); await sleep(300);
    await check(`r${round} b: after Tab to a control`, PALETTE);
    if (await clickIn(HOME, "d.querySelector('.rh-line')")) {
      await sleep(500);
      await check(`r${round} c: in the line's input`, PALETTE);
      await press('Escape', 'Escape', 27); await sleep(300);
    }
    await clickIn(HOME, title); await sleep(300);
    fs.writeFileSync(path.join(workspace, `home-keys-note-${round}.md`), `# Note ${round}\n`);
    await sleep(2500);
    await check(`r${round} d: after Home redrew`, PALETTE);
    const tab = (pattern) => workbench(`(function(){const t=[...document.querySelectorAll('.tab')].find(x=>${pattern}.test(x.getAttribute('aria-label')||x.textContent)); if(!t) return null; const r=t.getBoundingClientRect(); return [r.x+r.width/2,r.y+r.height/2];})()`);
    const board = await tab('/Task board|Tasks/');
    if (board) { await mouse(...board); await sleep(1200); }
    const home = await tab('/^Home/');
    if (home) { await mouse(...home); await sleep(1200); }
    await check(`r${round} e: back on Home by its tab`, PALETTE);
  }
} catch (error) {
  failures++;
  results.push({ error: String(error?.message ?? error) });
  console.log(`FAIL  ${error?.message ?? error}`);
} finally {
  fs.writeFileSync(OUT, JSON.stringify({ platform: process.platform, rounds: ROUNDS, results }, null, 1));
  if (launched) {
    try { await press('q', 'KeyQ', 81, MOD); } catch { /* gone */ }
    const mine = () => spawnSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8' }).stdout.split('\n')
      .filter((line) => line.includes(`--user-data-dir=${path.join(PROFILE, 'ud')}`))
      .map((line) => Number(line.trim().split(/\s+/)[0])).filter(Boolean);
    for (let i = 0; i < 20 && (portBusy() || mine().length); i += 1) await sleep(1000);
    for (const signal of ['SIGTERM', 'SIGKILL']) {
      if (!portBusy() && !mine().length) break;
      for (const pid of mine()) try { process.kill(pid, signal); } catch { /* gone */ }
      for (let i = 0; i < 10 && (portBusy() || mine().length); i += 1) await sleep(1000);
    }
  }
}
console.log(`${results.filter((r) => r.ok).length} of ${results.filter((r) => 'ok' in r).length} presses opened what they should (report: ${OUT})`);
process.exitCode = failures;
