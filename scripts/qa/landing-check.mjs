#!/usr/bin/env node
/**
 * Sprint 143 (#551, R2, S3): the welcome finished with ChatGPT lands the
 * project's first chat on ChatGPT, every time.
 *
 * Each run: a fresh profile, the welcome's step-1 cards, Continue on ChatGPT
 * (signed in on this computer; this check never signs in), Open a folder…
 * through the simple dialog, the reload into the project, then the AI sheet's
 * composer read every 500 ms for 45 s. One hidden launch per run, quit with
 * ⌘Q. Nothing is sent. Exits 1 if any run's chat isn't on ChatGPT with
 * "Ask ChatGPT about this project".
 *
 * Usage (from the repository root, with the dev tree built: vscode/.build and
 * extensions/ritemark/out):
 *   node scripts/qa/landing-check.mjs --runs 10 [--updates on] [--port 9244] --out <json>
 * `--updates on` shows "Ritemark x is available" when the dev tree's
 * product.json names an older version than the feed.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const option = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : fallback; };
const REPO = option('repo', path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'));
const WORKSPACE = option('workspace', fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'rm-landing-')));
if (!fs.existsSync(path.join(WORKSPACE, 'README.md'))) fs.writeFileSync(path.join(WORKSPACE, 'README.md'), '# Landing check\n');
const RUNS = Number(option('runs', '5'));
const PORT = Number(option('port', '9343'));
const PROFILE = option('profile', '/private/tmp/claude-501/rm-landing');
const OUT = option('out', path.join(PROFILE + '-report.json'));
const UPDATES = option('updates', 'off') === 'on';
const SLASH = option('slash', 'on') === 'on';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!PROFILE.startsWith('/private/tmp/') || PROFILE.split('/').length < 5) throw new Error('profile must be under /private/tmp');

async function targets() { return (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); }
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
async function page() { const t = (await targets()).find((c) => c.type === 'page' && c.url.startsWith('vscode-file://')); if (!t) throw new Error('no workbench page'); return t; }
async function webview(probe) {
  for (const t of (await targets()).filter((c) => c.type === 'iframe' && c.url.startsWith('vscode-webview://'))) {
    const ok = await evaluate(t.webSocketDebuggerUrl, `(function(){const af=document.getElementById('active-frame'); if(!af||!af.contentWindow) return false; const w=af.contentWindow, d=af.contentDocument; return Boolean(${probe});})()`).catch(() => false);
    if (ok) return t;
  }
  return null;
}
async function inFrame(probe, body) { const t = await webview(probe); if (!t) return null; return evaluate(t.webSocketDebuggerUrl, `(async function(){const af=document.getElementById('active-frame'); const w=af.contentWindow, d=af.contentDocument; ${body}})()`); }
async function waitFor(probe, body, seconds) { const end = Date.now() + seconds * 1000; while (Date.now() < end) { const v = await inFrame(probe, body).catch(() => null); if (v) return v; await sleep(1000); } return null; }
async function mouse(x, y) { const c = await connect((await page()).webSocketDebuggerUrl); try { for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await c.send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: 1 }); } finally { c.close(); } }
async function clickIn(probe, el) {
  const t = await webview(probe); if (!t) return false;
  const rect = await evaluate(t.webSocketDebuggerUrl, `(function(){const af=document.getElementById('active-frame'); const w=af.contentWindow, d=af.contentDocument; const el=(${el}); if(!el) return null; el.scrollIntoView({block:'center'}); const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  if (!rect) return false;
  const id = /[?&]id=([^&]+)/.exec(t.url)?.[1] ?? '';
  const frame = await evaluate((await page()).webSocketDebuggerUrl, `(function(){const f=[...document.querySelectorAll('iframe')].find(i=>i.src.includes(${JSON.stringify(id)})); if(!f) return null; const r=f.getBoundingClientRect(); return {x:r.x,y:r.y};})()`);
  if (!frame) return false; await mouse(frame.x + rect.x, frame.y + rect.y); return true;
}
async function insertText(text) { const c = await connect((await page()).webSocketDebuggerUrl); try { await c.send('Input.insertText', { text }); } finally { c.close(); } }
async function press(key, code, keyCode, modifiers = 0) { const c = await connect((await page()).webSocketDebuggerUrl); try { await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: keyCode, modifiers }); await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode, modifiers }); } finally { c.close(); } }
function portBusy() { return spawnSync('lsof', ['-i', `:${PORT}`, '-sTCP:LISTEN'], { encoding: 'utf8' }).stdout.trim().length > 0; }
async function launch(log) {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  execFileSync('open', ['-n', '-g', '-j', '-a', path.join(REPO, 'vscode/.build/electron/Ritemark.app'),
    '--env', 'NODE_ENV=development', '--env', 'VSCODE_DEV=1', '--env', 'VSCODE_CLI=1', '--env', 'RITEMARK_BUILD_CHANNEL=test',
    '--stdout', log, '--stderr', log,
    '--args', path.join(REPO, 'vscode'),
    '--disable-extension=vscode.vscode-api-tests', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${path.join(PROFILE, 'ud')}`, `--extensions-dir=${path.join(PROFILE, 'ext')}`, `--shared-data-dir=${path.join(PROFILE, 'shared')}`,
    '--use-mock-keychain', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling'], { env });
  for (let i = 0; i < 60; i += 1) { if (await fetch(`http://127.0.0.1:${PORT}/json/version`).then(() => true, () => false)) return; await sleep(1000); }
  throw new Error('no CDP');
}
/** This run's own processes: every process whose command line names this run's profile. */
function profilePids() {
  return spawnSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8' }).stdout.split('\n')
    .filter((line) => line.includes(`--user-data-dir=${path.join(PROFILE, 'ud')}`))
    .map((line) => Number(line.trim().split(/\s+/)[0])).filter(Boolean);
}
async function quit() {
  try { await mouse(291, 26); await press('q', 'KeyQ', 81, 4); } catch { /* gone */ }
  for (let i = 0; i < 30 && (portBusy() || profilePids().length); i += 1) await sleep(1000);
  // ⌘Q can be missed, and one SIGTERM can leave the main process respawning helpers: end only this run's own processes.
  for (const signal of ['SIGTERM', 'SIGKILL']) {
    if (!portBusy() && !profilePids().length) break;
    for (const pid of profilePids()) try { process.kill(pid, signal); } catch { /* gone */ }
    for (let i = 0; i < 10 && (portBusy() || profilePids().length); i += 1) await sleep(1000);
  }
  if (portBusy()) throw new Error(`port ${PORT} is still in use after quitting: stopping rather than talking to the wrong instance`);
}
const SHEET = "d.querySelector('textarea') && d.querySelector('[aria-label=\"New conversation\"]')";
const SNAP = "const ta=d.querySelector('textarea'); const rt=[...d.querySelectorAll('button')].map(b=>b.getAttribute('aria-label')||'').find(t=>/, thinking effort /.test(t))||null; return {runtime: rt, placeholder: ta? ta.placeholder: null};";

async function one(index) {
  if (portBusy()) throw new Error(`port ${PORT} is in use: not this run's instance`);
  fs.rmSync(PROFILE, { recursive: true, force: true });
  fs.mkdirSync(path.join(PROFILE, 'ud', 'User'), { recursive: true });
  fs.writeFileSync(path.join(PROFILE, 'ud/User/settings.json'), JSON.stringify({ 'window.confirmBeforeClose': 'never', 'files.simpleDialog.enable': true, 'ritemark.updates.enabled': UPDATES }, null, 2));
  const log = path.join(PROFILE, 'launch.log');
  const t0 = Date.now(); const at = () => Date.now() - t0;
  const result = { index, updates: UPDATES, slash: SLASH, steps: [] };
  await launch(log);
  try {
    const WELCOME = "d.body.innerText.includes('Which AI do you use?')";
    const cards = await waitFor(WELCOME, "const c=[...d.querySelectorAll('.rw-choice')].map(c=>c.innerText.replace(/\\n+/g,' | ')); return c.length && !c.some(t=>t.includes('Checking'))? c: null", 60);
    result.steps.push({ at: at(), cards });
    const ok = await clickIn(WELCOME, "[...d.querySelectorAll('.rw-choice')].find(c=>c.querySelector('.name').innerText==='ChatGPT').querySelector('button')");
    result.steps.push({ at: at(), continued: ok });
    await waitFor("d.body.innerText.includes('Where is your work?')", 'return true', 20);
    await clickIn("d.body.innerText.includes('Where is your work?')", "[...d.querySelectorAll('button')].find(b=>b.innerText.includes('Open a folder'))");
    await sleep(1500);
    const pageUrl = (await page()).webSocketDebuggerUrl;
    await evaluate(pageUrl, "(function(){const i=document.querySelector('.quick-input-widget input'); i.focus(); i.select(); return true;})()");
    await insertText(`${WORKSPACE.replace(/\/$/, '')}${SLASH ? '/' : ''}`);
    await sleep(500);
    const open = await evaluate(pageUrl, "(function(){const b=[...document.querySelectorAll('.quick-input-widget .monaco-button')].find(x=>x.textContent==='Open'); const r=b.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
    await mouse(open.x, open.y);
    result.steps.push({ at: at(), opened: true });
    const folderName = path.basename(WORKSPACE.replace(/\/$/, ''));
    for (let i = 0; i < 60; i += 1) { const title = await page().then((t) => evaluate(t.webSocketDebuggerUrl, 'document.title')).catch(() => ''); if (String(title).includes(folderName)) { result.steps.push({ at: at(), reloaded: title }); break; } await sleep(1000); }
    const timeline = [];
    let last = '';
    const sheetFrom = Date.now();
    while (Date.now() - sheetFrom < 45_000) {
      const s = await inFrame(SHEET, SNAP).catch(() => null);
      const key = JSON.stringify(s);
      if (key !== last) { timeline.push({ at: at(), ...(s ?? { runtime: null }) }); last = key; }
      await sleep(500);
    }
    result.timeline = timeline;
    const final = timeline[timeline.length - 1] ?? {};
    result.final = final;
    result.verdict = /^ChatGPT,/.test(final.runtime ?? '') ? 'chatgpt' : /^Claude/.test(final.runtime ?? '') ? 'claude' : 'other';
    const notice = await evaluate((await page()).webSocketDebuggerUrl, "[...document.querySelectorAll('.notification-toast, .notifications-toasts .monaco-list-row')].map(n=>n.innerText.slice(0,120))").catch(() => []);
    result.toasts = notice;
  } catch (error) {
    result.error = String(error?.message ?? error);
  } finally {
    await quit();
  }
  return result;
}

const results = [];
if (portBusy()) throw new Error(`port ${PORT} busy`);
for (let i = 1; i <= RUNS; i += 1) {
  const r = await one(i);
  results.push(r);
  const ok = r.verdict === 'chatgpt' && r.final?.placeholder === 'Ask ChatGPT about this project';
  console.log(`${ok ? 'PASS' : 'FAIL'}  run ${i}: ${r.final?.runtime ?? 'no chat'} | ${r.final?.placeholder ?? ''}${r.error ? ` | ${r.error}` : ''}`);
  fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
}
fs.rmSync(PROFILE, { recursive: true, force: true });
const passed = results.filter((r) => r.verdict === 'chatgpt' && r.final?.placeholder === 'Ask ChatGPT about this project').length;
console.log(`${passed} of ${results.length} landed on ChatGPT (report: ${OUT})`);
if (passed !== results.length) process.exitCode = 1;
