// Shared raw-CDP helpers for the Sprint 143 reproducers (one hidden dev instance).
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function lib(PORT) {
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
  async function workbench(expression) { return evaluate((await page()).webSocketDebuggerUrl, expression); }
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
    const rect = await evaluate(t.webSocketDebuggerUrl, `(function(){const af=document.getElementById('active-frame'); const w=af.contentWindow, d=af.contentDocument; const el=(${el}); if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height};})()`);
    if (!rect) return null;
    const id = /[?&]id=([^&]+)/.exec(t.url)?.[1] ?? '';
    const frame = await workbench(`(function(){const f=[...document.querySelectorAll('iframe')].find(i=>i.src.includes(${JSON.stringify(id)})); if(!f) return null; const r=f.getBoundingClientRect(); return {x:r.x,y:r.y};})()`);
    return frame ? { x: frame.x + rect.x, y: frame.y + rect.y } : null;
  }
  async function clickIn(probe, el) { const p = await rectIn(probe, el); if (!p) return false; await mouse(p.x, p.y); return true; }
  async function insertText(text) { const c = await connect((await page()).webSocketDebuggerUrl); try { await c.send('Input.insertText', { text }); } finally { c.close(); } }
  async function press(key, code, keyCode, modifiers = 0) { const c = await connect((await page()).webSocketDebuggerUrl); try { await c.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, modifiers }); await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, modifiers }); } finally { c.close(); } }
  function portBusy() { return spawnSync('lsof', ['-i', `:${PORT}`, '-sTCP:LISTEN'], { encoding: 'utf8' }).stdout.trim().length > 0; }
  async function launch({ repo, profile, args = [], log }) {
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    execFileSync('open', ['-n', '-g', '-j', '-a', path.join(repo, 'vscode/.build/electron/Ritemark.app'),
      '--env', 'NODE_ENV=development', '--env', 'VSCODE_DEV=1', '--env', 'VSCODE_CLI=1', '--env', 'RITEMARK_BUILD_CHANNEL=test',
      '--stdout', log, '--stderr', log,
      '--args', path.join(repo, 'vscode'), ...args,
      '--disable-extension=vscode.vscode-api-tests', `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${path.join(profile, 'ud')}`, `--extensions-dir=${path.join(profile, 'ext')}`, `--shared-data-dir=${path.join(profile, 'shared')}`,
      '--use-mock-keychain', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling'], { env });
    for (let i = 0; i < 60; i += 1) { if (await fetch(`http://127.0.0.1:${PORT}/json/version`).then(() => true, () => false)) return; await sleep(1000); }
    throw new Error('no CDP');
  }
  async function quit() {
    try { await mouse(291, 26); await press('q', 'KeyQ', 81, 4); } catch { /* gone */ }
    for (let i = 0; i < 30 && portBusy(); i += 1) await sleep(1000);
    if (portBusy()) {
      const pids = spawnSync('lsof', ['-t', '-i', `:${PORT}`, '-sTCP:LISTEN'], { encoding: 'utf8' }).stdout.trim().split('\n').filter(Boolean);
      for (const pid of pids) try { process.kill(Number(pid), 'SIGTERM'); } catch { /* gone */ }
      for (let i = 0; i < 20 && portBusy(); i += 1) await sleep(1000);
    }
  }
  async function screenshot(file) { const c = await connect((await page()).webSocketDebuggerUrl); try { const { data } = await c.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(file, Buffer.from(data, 'base64')); } finally { c.close(); } }
  return { targets, connect, evaluate, page, workbench, webview, inFrame, waitFor, mouse, rectIn, clickIn, insertText, press, portBusy, launch, quit, screenshot };
}

export function freshProfile(profile, settings) {
  if (!profile.startsWith('/private/tmp/') || profile.split('/').length < 5) throw new Error('profile must be under /private/tmp');
  fs.rmSync(profile, { recursive: true, force: true });
  fs.mkdirSync(path.join(profile, 'ud', 'User'), { recursive: true });
  fs.writeFileSync(path.join(profile, 'ud/User/settings.json'), JSON.stringify({ 'window.confirmBeforeClose': 'never', 'files.simpleDialog.enable': true, 'ritemark.updates.enabled': false, ...settings }, null, 2));
}
