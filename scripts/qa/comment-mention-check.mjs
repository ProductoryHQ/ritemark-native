#!/usr/bin/env node
/**
 * Sprint 143 (#513, R5, S18–S22): choosing an agent from a comment's mention
 * list assigns the comment, as typing "@claude " does.
 *
 * One hidden launch on a scratch folder with one document. For each way, a
 * word is double-clicked, Comment chosen in the formatting toolbar, and the
 * comment written: "@" then a click on @claude, @codex or @opencode in the
 * list (with what lies under the option's centre recorded first), "@" then
 * Enter, or "@claude …" typed. Enter saves; the file must hold the comment
 * with its address and its agent. On 2.0's main the click lands on the
 * formatting toolbar, which stayed up over the list (#513).
 *
 * Usage (from the repository root, with the dev tree built):
 *   node scripts/qa/comment-mention-check.mjs [--port 9244] [--out <json>]
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const option = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : fallback; };
const REPO = option('repo', path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'));
const PORT = Number(option('port', '9363'));
const PROFILE = option('profile', '/private/tmp/claude-501/rm-mentions');
const OUT = option('out', `${PROFILE}-report.json`);
const SHOTS = option('screenshots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!PROFILE.startsWith('/private/tmp/') || PROFILE.split('/').length < 5) throw new Error('--profile must be under /private/tmp');

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
async function page() { const t = (await targets()).find((c) => c.type === 'page' && c.url.startsWith('vscode-file://')); if (!t) throw new Error('no workbench page'); return t; }
const workbench = async (expression) => evaluate((await page()).webSocketDebuggerUrl, expression);
async function webview(probe) {
  for (const t of (await targets()).filter((c) => c.type === 'iframe' && c.url.startsWith('vscode-webview://'))) {
    const ok = await evaluate(t.webSocketDebuggerUrl, `(function(){const af=document.getElementById('active-frame'); if(!af||!af.contentWindow) return false; const w=af.contentWindow, d=af.contentDocument; return Boolean(${probe});})()`).catch(() => false);
    if (ok) return t;
  }
  return null;
}
async function inFrame(probe, body) { const t = await webview(probe); if (!t) return null; return evaluate(t.webSocketDebuggerUrl, `(async function(){const af=document.getElementById('active-frame'); const w=af.contentWindow, d=af.contentDocument; ${body}})()`); }
async function waitFor(probe, body, seconds) { const end = Date.now() + seconds * 1000; while (Date.now() < end) { const v = await inFrame(probe, body).catch(() => null); if (v) return v; await sleep(700); } return null; }
async function mouse(x, y, clickCount = 1) { const c = await connect((await page()).webSocketDebuggerUrl); try { for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await c.send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount }); } finally { c.close(); } }
async function rectIn(probe, el) {
  const t = await webview(probe); if (!t) return null;
  const rect = await evaluate(t.webSocketDebuggerUrl, `(function(){const af=document.getElementById('active-frame'); const w=af.contentWindow, d=af.contentDocument; const el=(${el}); if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  if (!rect) return null;
  const id = /[?&]id=([^&]+)/.exec(t.url)?.[1] ?? '';
  const frame = await workbench(`(function(){const f=[...document.querySelectorAll('iframe')].find(i=>i.src.includes(${JSON.stringify(id)})); if(!f) return null; const r=f.getBoundingClientRect(); return {x:r.x,y:r.y};})()`);
  return frame ? { x: frame.x + rect.x, y: frame.y + rect.y, inner: rect } : null;
}
async function insertText(text) { const c = await connect((await page()).webSocketDebuggerUrl); try { await c.send('Input.insertText', { text }); } finally { c.close(); } }
async function press(key, code, keyCode, modifiers = 0) { const c = await connect((await page()).webSocketDebuggerUrl); try { await c.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode: keyCode, modifiers }); await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode, modifiers }); } finally { c.close(); } }
async function screenshot(file) { const c = await connect((await page()).webSocketDebuggerUrl); try { const { data } = await c.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(file, Buffer.from(data, 'base64')); } finally { c.close(); } }
const portBusy = () => spawnSync('lsof', ['-i', `:${PORT}`, '-sTCP:LISTEN'], { encoding: 'utf8' }).stdout.trim().length > 0;

// ── the instance ───────────────────────────────────────────────────────────
const WS = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'rm-mentions-'));
const DOC = path.join(WS, 'Mention test.md');
const ways = [
  { name: 'S18 @claude by click', steps: ['@', 'click:claude', 'Make this warmer'], alias: 'claude', text: 'Make this warmer' },
  { name: 'S22 @codex by click', steps: ['@', 'click:codex', 'Add an example'], alias: 'codex', text: 'Add an example' },
  { name: 'S22 @opencode by click', steps: ['@', 'click:opencode', 'Shorten it'], alias: 'opencode', text: 'Shorten it' },
  { name: 'S19 @claude by Enter', steps: ['@', 'enter', 'Check the dates'], alias: 'claude', text: 'Check the dates' },
  { name: 'S20 typed by hand', steps: ['@claude Make this typed'], alias: 'claude', text: 'Make this typed' },
];
fs.writeFileSync(DOC, `# Mention test\n\n${ways.map((_, i) => `Paragraph ${i + 1} has a word to comment on.`).join('\n\n')}\n`);
fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(path.join(PROFILE, 'ud', 'User'), { recursive: true });
fs.writeFileSync(path.join(PROFILE, 'ud/User/settings.json'), JSON.stringify({ 'window.confirmBeforeClose': 'never', 'ritemark.updates.enabled': false, 'files.autoSave': 'afterDelay', 'files.autoSaveDelay': 500 }, null, 2));
if (portBusy()) throw new Error(`port ${PORT} is in use`);
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
execFileSync('open', ['-n', '-g', '-j', '-a', path.join(REPO, 'vscode/.build/electron/Ritemark.app'),
  '--env', 'NODE_ENV=development', '--env', 'VSCODE_DEV=1', '--env', 'VSCODE_CLI=1', '--env', 'RITEMARK_BUILD_CHANNEL=test',
  '--stdout', path.join(PROFILE, 'launch.log'), '--stderr', path.join(PROFILE, 'launch.log'),
  '--args', path.join(REPO, 'vscode'), WS, DOC,
  '--disable-extension=vscode.vscode-api-tests', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${path.join(PROFILE, 'ud')}`, `--extensions-dir=${path.join(PROFILE, 'ext')}`, `--shared-data-dir=${path.join(PROFILE, 'shared')}`,
  '--use-mock-keychain', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling'], { env });
for (let i = 0; i < 60 && !(await fetch(`http://127.0.0.1:${PORT}/json/version`).then(() => true, () => false)); i += 1) await sleep(1000);

const EDITOR = "d.querySelector('.ProseMirror')";
const report = { ways: [] };
let failed = 0;
try {
  if (!(await waitFor(EDITOR, 'return true', 60))) throw new Error('the document did not open in the editor');
  await sleep(1500);
  // A first click into the editor, so the webview has the focus before the first way starts.
  const heading = await rectIn(EDITOR, "d.querySelector('.ProseMirror h1')");
  if (heading) { await mouse(heading.x, heading.y); await sleep(500); }
  for (const [index, way] of ways.entries()) {
    const word = await rectIn(EDITOR, `(function(){const p=[...d.querySelectorAll('.ProseMirror p')][${index}]; const t=p.firstChild; const r=d.createRange(); const i=t.textContent.indexOf('word'); r.setStart(t,i); r.setEnd(t,i+4); return r;})()`);
    await mouse(word.x, word.y, 2); await sleep(900);
    // The first click into a webview after it loads can only focus it: try Comment twice before giving up.
    let box = null;
    for (let attempt = 0; attempt < 2 && !box; attempt += 1) {
      const commentButton = await rectIn(EDITOR, "d.querySelector('button[title=\"Add comment\"]')");
      if (!commentButton) { await mouse(word.x, word.y, 2); await sleep(900); continue; }
      await mouse(commentButton.x, commentButton.y);
      box = await waitFor("d.querySelector('textarea[aria-label=\"Comment text\"]')", 'return true', 5);
    }
    if (!box) throw new Error(`${way.name}: the comment's box did not open`);
    const record = { name: way.name, steps: [] };
    for (const step of way.steps) {
      if (step.startsWith('click:')) {
        const alias = step.slice('click:'.length);
        const option = `[...d.querySelectorAll('.rm-mention-opt')].find(o=>o.innerText.startsWith('@${alias}'))`;
        await waitFor(`d.querySelector('[role=listbox][aria-label="Assign an agent"]')`, 'return true', 5);
        const under = await inFrame(EDITOR, `const o=${option}; if(!o) return null; const r=o.getBoundingClientRect(); const e=d.elementFromPoint(r.x+r.width/2,r.y+r.height/2); return {isOption: !!(e&&e.closest('.rm-mention-opt')), under: e? e.tagName+'.'+String(e.className).slice(0,40):null, toolbarShown: !![...d.querySelectorAll('button[title="Add comment"]')].find(b=>b.offsetParent!==null)};`);
        record.steps.push({ click: alias, ...under });
        const at = await rectIn(EDITOR, option);
        if (at) await mouse(at.x, at.y);
        if (SHOTS && alias === 'claude' && index === 0) await screenshot(path.join(SHOTS, 'mention-list-click.png'));
      } else if (step === 'enter') {
        await waitFor(`d.querySelector('[role=listbox][aria-label="Assign an agent"]')`, 'return true', 5);
        await press('Enter', 'Enter', 13);
      } else {
        if (SHOTS && index === 0 && step === '@') {
          await insertText(step); await sleep(600);
          await screenshot(path.join(SHOTS, 'mention-list-open.png'));
          continue;
        }
        await insertText(step);
      }
      await sleep(500);
    }
    record.box = await inFrame(EDITOR, "const t=d.querySelector('textarea[aria-label=\"Comment text\"]'); return t? {value:t.value, pill:(d.querySelector('.rm-agent-pill')||{}).innerText||null}: null");
    if (SHOTS && index === 0) await screenshot(path.join(SHOTS, 'mention-assigned.png'));
    await press('Enter', 'Enter', 13);
    // Autosave writes it within a second or two.
    let paragraph = '';
    for (let i = 0; i < 12; i += 1) {
      await sleep(500);
      paragraph = fs.readFileSync(DOC, 'utf8').split('\n\n').find((block) => block.startsWith(`Paragraph ${index + 1} `)) ?? '';
      if (paragraph.includes('<mark ')) break;
    }
    const tag = /<mark ([^>]*)>/.exec(paragraph)?.[1] ?? '';
    const note = /data-comment="([^"]*)"/.exec(tag)?.[1];
    const agent = /data-agent="([^"]*)"/.exec(tag)?.[1] ?? null;
    record.saved = note !== undefined ? { note, agent } : null;
    record.ok = note === `@${way.alias} ${way.text}` && agent === way.alias;
    if (!record.ok) failed += 1;
    console.log(`${record.ok ? 'PASS' : 'FAIL'}  ${way.name}: ${JSON.stringify(record.saved)}`);
    report.ways.push(record);
    await press('Escape', 'Escape', 27); await sleep(400);
  }
} catch (error) {
  report.error = String(error?.stack ?? error);
  failed += 1;
  console.log(`FAIL  ${report.error}`);
} finally {
  fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
  try { await mouse(291, 26); await press('q', 'KeyQ', 81, 4); } catch { /* gone */ }
  // ⌘Q can be missed, and one SIGTERM can leave the main process respawning helpers: end only this run's own processes.
  const mine = () => spawnSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8' }).stdout.split('\n')
    .filter((line) => line.includes(`--user-data-dir=${path.join(PROFILE, 'ud')}`))
    .map((line) => Number(line.trim().split(/\s+/)[0])).filter(Boolean);
  for (let i = 0; i < 30 && (portBusy() || mine().length); i += 1) await sleep(1000);
  for (const signal of ['SIGTERM', 'SIGKILL']) {
    if (!portBusy() && !mine().length) break;
    for (const pid of mine()) try { process.kill(pid, signal); } catch { /* gone */ }
    for (let i = 0; i < 10 && (portBusy() || mine().length); i += 1) await sleep(1000);
  }
  fs.rmSync(WS, { recursive: true, force: true });
}
console.log(`${ways.length - Math.min(failed, ways.length)} of ${ways.length} ways assigned the comment (report: ${OUT})`);
if (failed) process.exitCode = 1;
