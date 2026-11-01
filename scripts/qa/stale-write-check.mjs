#!/usr/bin/env node
/**
 * stale-write-check.mjs - a writer's older copy over words Ritemark just saved (Sprint 145, A1, R1, #588).
 *
 * Usage (from the repository root, with a built dev tree):
 *   node scripts/qa/stale-write-check.mjs [--cases s1,s2,...] [--runs 10] [--delay 1000] [--port 9351]
 *       [--vscode <dir>] [--profile /private/tmp/<dir>] [--attach --workspace <folder>] [--out <json>]
 *
 * Without --attach it starts one hidden dev instance (`open -n -g -j`, --use-mock-keychain, the three
 * backgrounding flags, its own short profile, scratch homes for the AIs; HOME is not changed), runs every case in
 * it and quits only that instance. With --attach it uses an instance already listening on --port whose window has
 * --workspace open (the check writes its files there and opens them with Quick Open).
 *
 * Each run uses a new file in Ritemark's editor. "Typing" is CDP text input at the end of the file's last
 * paragraph; "auto-save" is waiting until the file on disk holds the typed words (the profile keeps the shipped
 * files.autoSaveDelay). "The writer" is this script: it reads the file with fs.readFileSync and writes with
 * fs.writeFileSync. No AI is involved.
 *
 * Cases (scenarios.md; "fixed" is R1 as revised on 1 November: both changes stay, merged by paragraph):
 *   s1      type A, auto-save; the writer reads; type B, auto-save; wait --delay; the writer writes its read with
 *           line 1 changed. main: B is gone from the editor and the file, no question. Fixed: no question, the
 *           editor and the file hold A, B and the writer's line 1.
 *   s2      type A, auto-save; the writer reads; 5 s later it writes its read with line 1 changed. Silent import.
 *   s3      type A, auto-save; the writer reads; type B and write at once, before the auto-save (#454). main: the
 *           whole-document question. Fixed: no question, the editor and the file hold A, B and the writer's line 1.
 *   s4      type A, auto-save; the writer reads and replaces sentence A with other words. Ritemark can't tell
 *           whether the writer saw A: fixed keeps the person's paragraph and shows Review changes for it.
 *   s5crlf  type A, auto-save; the writer rewrites the same words with CRLF endings. Silent, words kept.
 *   s5bom   the same with a UTF-8 byte order mark. Silent, words kept.
 *   s6      type A, auto-save; only the file's modified time changes. Silent.
 *   s7fm    s1 on a file with front matter.      s7fm2  s2 on it.
 *   s7crlf  s1 on a file with CRLF endings.      s7crlf2 s2 on it.
 *   s8      type A, auto-save; the writer rewrites the whole file (no block in common) at once: no base, so the
 *           fallback: the whole-document question within 30 s, the words kept.
 * After a run that lost words, Cmd+Z (Ctrl+Z on Windows) is pressed once in the editor, and the record says whether
 * the lost words came back. With --answer keep-local|use-disk|compare (the whole-document question) or
 * keep-mine|use-theirs (a paragraph both changed), a run that asked opens Review changes from the document's bar,
 * records the button's tooltip and the dialog's words (and screenshots with --screenshot <path>), chooses the
 * answer and records the file and the editor 3 s later. With --undo, a run that merged (s1, s3, s7fm, s7crlf)
 * presses Cmd+Z (Ctrl+Z) once in the editor and records whether the writer's change went and the person's words
 * stayed, and whether the file followed (S62). --theme light|dark fixes the colour theme of the instance it starts;
 * --keep-open leaves that instance running for later --attach runs (quit it yourself).
 *
 * Every run prints one line and the report (JSON) holds what was seen: the disk and editor text, whether Review
 * changes showed, the delay between the last save and the write, and the [EditorSync] log lines in that time. The
 * exit code is the number of runs whose result differs from --expect (main|fixed), when --expect is given.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const option = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : fallback; };
const flag = (name) => argv.includes(`--${name}`);
const REPO = option('repo', path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'));
const VSCODE = option('vscode', path.join(REPO, 'vscode'));
const PORT = Number(option('port', '9351'));
// The profile is deleted and made again at start, so it must be a folder of its own under the temp folder.
// On the Mac that is /private/tmp (a short path: the IPC socket lives in it); elsewhere the system's.
const TEMP_ROOT = process.platform === 'darwin' ? '/private/tmp' : fs.realpathSync(os.tmpdir());
const PROFILE = path.resolve(option('profile', process.platform === 'darwin' ? '/private/tmp/claude-501/rm-stale' : path.join(TEMP_ROOT, 'rm-stale')));
const ATTACH = flag('attach');
const CASES = option('cases', 's1').split(',').map((c) => c.trim()).filter(Boolean);
const RUNS = Number(option('runs', '1'));
const DELAY = Number(option('delay', '1000'));
const EXPECT = option('expect');
const OUT = option('out', `${PROFILE}-report.json`);
const ANSWER = option('answer'); // keep-local | use-disk | compare | keep-mine | use-theirs: open Review changes and choose it
const SHOT = option('screenshot'); // with --answer: a screenshot of the review, <path>-<run>.png
const UNDO = flag('undo'); // after a merge: one Cmd+Z, and what it undid
const THEME = option('theme'); // light | dark: the instance's colour theme, not the system's
const KEEP_OPEN = flag('keep-open'); // leave the started instance running
const MOD = process.platform === 'darwin' ? 4 : 2; // meta on the Mac, ctrl elsewhere
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
  let id = 0; const pending = new Map(); const listeners = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.method) { for (const l of listeners) l(d); return; }
    const w = pending.get(d.id); if (!w) return; pending.delete(d.id);
    d.error ? w.reject(new Error(JSON.stringify(d.error))) : w.resolve(d.result);
  };
  return {
    send: (method, params = {}) => new Promise((resolve, reject) => { const mid = ++id; pending.set(mid, { resolve, reject }); ws.send(JSON.stringify({ id: mid, method, params })); }),
    on: (listener) => listeners.push(listener),
    close: () => ws.close(),
  };
}
async function evaluate(url, expression) {
  const c = await connect(url);
  try { const r = await c.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; } finally { c.close(); }
}
async function page() { const t = (await targets()).find((c) => c.type === 'page' && c.url.startsWith('vscode-file://') && c.url.includes('workbench')); if (!t) throw new Error('no workbench page'); return t; }
const workbench = async (expression) => evaluate((await page()).webSocketDebuggerUrl, expression);
async function webview(probe) {
  for (const t of (await targets()).filter((c) => c.type === 'iframe' && c.url.startsWith('vscode-webview://'))) {
    const ok = await evaluate(t.webSocketDebuggerUrl, `(function(){const af=document.getElementById('active-frame'); if(!af||!af.contentWindow) return false; const w=af.contentWindow, d=af.contentDocument; return Boolean(${probe});})()`).catch(() => false);
    if (ok) return t;
  }
  return null;
}
async function inFrame(probe, body) { const t = await webview(probe); if (!t) return null; return evaluate(t.webSocketDebuggerUrl, `(async function(){const af=document.getElementById('active-frame'); const w=af.contentWindow, d=af.contentDocument; ${body}})()`); }
async function waitFor(probe, body, seconds) { const end = Date.now() + seconds * 1000; while (Date.now() < end) { const v = await inFrame(probe, body).catch(() => null); if (v) return v; await sleep(400); } return null; }
async function withPage(fn) { const c = await connect((await page()).webSocketDebuggerUrl); try { return await fn(c); } finally { c.close(); } }
const mouse = (x, y) => withPage(async (c) => { for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await c.send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: 1 }); });
const insertText = (text) => withPage((c) => c.send('Input.insertText', { text }));
const press = (key, code, keyCode, modifiers = 0) => withPage(async (c) => {
  await c.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode: keyCode, modifiers });
  await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode, modifiers });
});
async function rectIn(probe, el) {
  const t = await webview(probe); if (!t) return null;
  const rect = await evaluate(t.webSocketDebuggerUrl, `(function(){const af=document.getElementById('active-frame'); const w=af.contentWindow, d=af.contentDocument; const el=(${el}); if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height};})()`);
  if (!rect) return null;
  const id = /[?&]id=([^&]+)/.exec(t.url)?.[1] ?? '';
  const frame = await workbench(`(function(){const f=[...document.querySelectorAll('iframe')].find(i=>i.src.includes(${JSON.stringify(id)})); if(!f) return null; const r=f.getBoundingClientRect(); return {x:r.x,y:r.y};})()`);
  return frame ? { x: frame.x + rect.x, y: frame.y + rect.y, w: rect.w, h: rect.h } : null;
}
const screenshot = (file) => withPage(async (c) => { const { data } = await c.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(file, Buffer.from(data, 'base64')); });
const portBusy = () => spawnSync('lsof', ['-nP', `-iTCP:${PORT}`, '-sTCP:LISTEN'], { encoding: 'utf8' }).stdout.trim().length > 0;

// ── Quick Open, typing only into the quick input ─────────────────────────────
const FOCUS = `(() => { const e = document.activeElement; if (e && e.closest('.quick-input-widget') && e.tagName === 'INPUT') return 'quick-input'; if (e && e.tagName === 'IFRAME' && e.classList.contains('webview')) return 'webview:' + e.src; return 'elsewhere'; })()`;
async function quickOpen(fileName) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await press('p', 'KeyP', 80, MOD);
    await sleep(700);
    if (await workbench(FOCUS) === 'quick-input') break;
    const bar = await workbench(`(() => { const r = document.querySelector('.part.statusbar')?.getBoundingClientRect(); return r ? [r.x + r.width / 2, r.y + r.height / 2] : null; })()`);
    if (bar) { await mouse(...bar); await sleep(300); }
  }
  if (await workbench(FOCUS) !== 'quick-input') throw new Error(`Quick Open did not take the focus for ${fileName}`);
  await insertText(fileName);
  const row = `[...document.querySelectorAll('.quick-input-widget .quick-input-list .monaco-list-row')].find(r => (r.getAttribute('aria-label') || '').startsWith(${JSON.stringify(fileName)}))`;
  for (let waited = 0; waited < 6000 && !(await workbench(`!!(${row})`)); waited += 250) await sleep(250);
  const centre = await workbench(`(() => { const r = (${row})?.getBoundingClientRect(); return r && r.width ? [r.x + r.width / 2, r.y + r.height / 2] : null; })()`);
  if (!centre) throw new Error(`Quick Open has no row for ${fileName}`);
  await mouse(...centre);
}

// ── the files ──────────────────────────────────────────────────────────────
function fileFor(kind, n) {
  const title = `# Stale write ${kind} ${n}`;
  if (kind.startsWith('s7fm')) return { name: `stale-${kind}-${n}.md`, eol: '\n', bom: false, text: `---\ntitle: Run ${n}\ntags: [check]\n---\n\n${title}\n\nThe second line of run ${n}.\n\nThe third line of run ${n}.\n`, title };
  if (kind.startsWith('s7crlf')) return { name: `stale-${kind}-${n}.md`, eol: '\r\n', bom: false, text: `${title}\r\n\r\nThe second line of run ${n}.\r\n\r\nThe third line of run ${n}.\r\n`, title };
  return { name: `stale-${kind}-${n}.md`, eol: '\n', bom: false, text: `${title}\n\nThe second line of run ${n}.\n\nThe third line of run ${n}.\n`, title };
}
const logical = (text) => text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
const editorProbe = (n) => `d.querySelector('.ProseMirror') && d.querySelector('.ProseMirror').innerText.includes(${JSON.stringify(`third line of run ${n}`)})`;

async function focusEnd(probe) {
  // The first click into a webview can only focus it: try up to three times before stopping.
  let lastSeen;
  for (let attempt = 0; attempt < 3; attempt++) {
    const last = await rectIn(probe, "[...d.querySelectorAll('.ProseMirror > p')].pop()");
    if (!last) throw new Error('no last paragraph to type into');
    await mouse(last.x + Math.max(4, last.w - 4), last.y + last.h / 2);
    await sleep(300 + attempt * 400);
    // The caret at the very end of the last paragraph, whatever the click hit.
    await inFrame(probe, `const p=[...d.querySelectorAll('.ProseMirror > p')].pop(); const r=d.createRange(); r.selectNodeContents(p); r.collapse(false); const s=w.getSelection(); s.removeAllRanges(); s.addRange(r); return true;`);
    await sleep(250);
    // The focused frame must be this document's webview (not the AI's sheet), and its editor must have the focus.
    const target = await webview(probe);
    const id = target ? /[?&]id=([^&]+)/.exec(target.url)?.[1] : undefined;
    const focus = await workbench(FOCUS);
    const focused = !!id && focus.startsWith('webview:') && focus.includes(id) && await inFrame(probe, `return !!(d.activeElement && d.activeElement.closest('.ProseMirror'));`);
    if (focused) return;
    lastSeen = { id, focus: focus.slice(0, 160), inner: await inFrame(probe, `return d.activeElement ? d.activeElement.tagName + '.' + String(d.activeElement.className).slice(0, 40) : null;`) };
  }
  throw new Error(`stopped before typing: the editor does not have the focus ${JSON.stringify(lastSeen)}`);
}
async function typeAt(probe, text) { await focusEnd(probe); await insertText(text); }
async function waitDisk(file, needle, seconds = 8) {
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) { if (fs.readFileSync(file, 'utf8').includes(needle)) return Date.now(); await sleep(100); }
  return null;
}
const editorText = (probe) => inFrame(probe, `return d.querySelector('.ProseMirror')?.innerText ?? null;`);
const reviewShown = (probe) => inFrame(probe, `return [...d.querySelectorAll('button')].some(b => b.offsetParent && /Review changes/.test(b.innerText));`);

// ── one run ────────────────────────────────────────────────────────────────
async function run(kind, n, workspace, log) {
  const doc = fileFor(kind, n);
  const file = path.join(workspace, doc.name);
  fs.writeFileSync(file, doc.text);
  await quickOpen(doc.name);
  const probe = editorProbe(n);
  if (!(await waitFor(probe, 'return true', 30))) throw new Error(`${doc.name} did not open in Ritemark's editor`);
  await sleep(1500);
  const A = ` Alpha words ${n} typed first.`;
  const B = ` Bravo words ${n} typed second.`;
  const record = { case: kind, run: n, file: doc.name };
  const base = kind.replace(/2$/, '');
  const s1Like = base === 's1' || kind === 's7fm' || kind === 's7crlf';
  const s2Like = kind === 's2' || kind === 's7fm2' || kind === 's7crlf2';

  await typeAt(probe, A);
  const savedA = await waitDisk(file, A.trim());
  if (!savedA) throw new Error('A was not auto-saved');
  await sleep(300);
  const read = fs.readFileSync(file, 'utf8');
  let writeAt; let lastSaveAt = savedA; let expectQuestion = false; let expectKept = [];
  // R1 as revised (1 November): what the writer changed must reach the editor too, and the merge the file.
  let expectWriter = false; let expectOnDisk = [];
  const changeTitle = (text) => text.replace(doc.title, `${doc.title}, edited by the writer`);

  if (s1Like) {
    await typeAt(probe, B);
    const savedB = await waitDisk(file, B.trim());
    if (!savedB) throw new Error('B was not auto-saved');
    lastSaveAt = savedB;
    await sleep(DELAY);
    log.mark();
    writeAt = Date.now();
    fs.writeFileSync(file, changeTitle(read));
    expectQuestion = false; expectKept = [A.trim(), B.trim()]; expectWriter = true;
    expectOnDisk = [A.trim(), B.trim(), 'edited by the writer'];
  } else if (s2Like) {
    await sleep(5000);
    log.mark();
    writeAt = Date.now();
    fs.writeFileSync(file, changeTitle(read));
    expectQuestion = false; expectKept = [A.trim()]; expectWriter = true;
  } else if (kind === 's3') {
    await typeAt(probe, B);
    log.mark();
    writeAt = Date.now();
    fs.writeFileSync(file, changeTitle(read));
    expectQuestion = false; expectKept = [A.trim(), B.trim()]; expectWriter = true;
    expectOnDisk = [A.trim(), B.trim(), 'edited by the writer'];
  } else if (kind === 's4') {
    await sleep(DELAY);
    log.mark();
    writeAt = Date.now();
    fs.writeFileSync(file, read.replace(A.trim(), `The writer's own words ${n}.`));
    expectQuestion = true; expectKept = [A.trim()];
  } else if (kind === 's5crlf' || kind === 's5bom') {
    await sleep(DELAY);
    log.mark();
    writeAt = Date.now();
    const text = logical(read);
    fs.writeFileSync(file, kind === 's5crlf' ? text.replace(/\n/g, '\r\n') : `﻿${text}`);
    expectQuestion = false; expectKept = [A.trim()];
  } else if (kind === 's8') {
    await sleep(DELAY);
    log.mark();
    writeAt = Date.now();
    fs.writeFileSync(file, `# Rewritten ${n}\n\nNothing here is what it was.\n\nNot one paragraph in common.\n`);
    expectQuestion = true; expectKept = [A.trim()];
  } else if (kind === 's6') {
    await sleep(DELAY);
    log.mark();
    writeAt = Date.now();
    const now = new Date();
    fs.utimesSync(file, now, now);
    expectQuestion = false; expectKept = [A.trim()];
  } else {
    throw new Error(`unknown case ${kind}`);
  }

  await sleep(4000);
  const disk = fs.readFileSync(file, 'utf8');
  const editor = await editorText(probe);
  record.delayAfterLastSaveMs = writeAt - lastSaveAt;
  record.review = await reviewShown(probe);
  record.diskHas = Object.fromEntries([A.trim(), B.trim(), 'edited by the writer', `The writer's own words ${n}.`].map((s) => [s, disk.includes(s)]));
  record.editorHas = Object.fromEntries([A.trim(), B.trim(), 'edited by the writer', `The writer's own words ${n}.`].map((s) => [s, (editor ?? '').includes(s)]));
  record.lost = expectKept.filter((s) => !(editor ?? '').includes(s));
  record.syncLog = log.since();
  if (record.lost.length && !record.review) {
    // Does Undo bring the lost words back?
    await focusEnd(probe);
    await press('z', 'KeyZ', 90, MOD);
    await sleep(1500);
    const afterUndo = (await editorText(probe)) ?? '';
    record.undoBrings = record.lost.map((s) => [s, afterUndo.includes(s)]);
  }
  if (UNDO && expectOnDisk.length && record.editorHas['edited by the writer'] && !record.review) {
    // S62: one Cmd+Z undoes the merge (the writer's change) and nothing of the person's.
    await focusEnd(probe);
    await press('z', 'KeyZ', 90, MOD);
    await sleep(1500);
    const afterUndo = (await editorText(probe)) ?? '';
    record.undoMerge = { writerGone: !afterUndo.includes('edited by the writer'), kept: expectKept.map((s) => [s, afterUndo.includes(s)]) };
    await sleep(2500);
    const diskAfterUndo = fs.readFileSync(file, 'utf8');
    record.undoMerge.diskWriterGone = !diskAfterUndo.includes('edited by the writer');
    record.undoMerge.diskKept = expectKept.map((s) => [s, diskAfterUndo.includes(s)]);
  }
  if (record.review && ANSWER) {
    // Open Review changes from the document's bar and answer it.
    const button = await rectIn(probe, `[...d.querySelectorAll('button')].find(b => b.offsetParent && /Review changes/.test(b.innerText))`);
    // The tooltip first: hover the button and read what shows (experience 44, frame 2).
    await withPage((c) => c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: button.x + button.w / 2, y: button.y + button.h / 2, button: 'none' }));
    await sleep(1200);
    record.tooltip = await inFrame(probe, `return [...d.querySelectorAll('[role=tooltip]')].map(t => t.innerText).join(' | ') || null;`);
    if (SHOT) await screenshot(SHOT.replace(/(\.png)?$/, `-${n}-tooltip.png`));
    await mouse(button.x + button.w / 2, button.y + button.h / 2);
    const dialog = await waitFor(probe, `return !!d.querySelector('[role=dialog]');`, 5);
    record.dialog = await inFrame(probe, `return d.querySelector('[role=dialog]')?.innerText ?? null;`);
    if (SHOT && dialog) await screenshot(SHOT.replace(/(\.png)?$/, `-${n}.png`));
    const label = { 'keep-local': 'Keep my version', 'use-disk': 'Use disk version', compare: 'Compare changes', 'keep-mine': 'Keep mine', 'use-theirs': 'Use the other copy' }[ANSWER];
    const choice = await rectIn(probe, `[...d.querySelectorAll('[role=dialog] button')].find(b => b.innerText.trim() === ${JSON.stringify(label)})`);
    if (choice) await mouse(choice.x + choice.w / 2, choice.y + choice.h / 2);
    else await press('Escape', 'Escape', 27); // the other dialog: close it unanswered
    await sleep(3000);
    const diskAfter = fs.readFileSync(file, 'utf8');
    const editorAfter = (await editorText(probe)) ?? '';
    record.answer = {
      choice: label,
      diskHas: Object.fromEntries([A.trim(), B.trim(), 'edited by the writer', `The writer's own words ${n}.`].map((s) => [s, diskAfter.includes(s)])),
      editorHas: Object.fromEntries([A.trim(), B.trim(), 'edited by the writer', `The writer's own words ${n}.`].map((s) => [s, editorAfter.includes(s)])),
      diskIsTheWritersCopy: diskAfter === changeTitle(read),
      reviewStillShown: await reviewShown(probe),
      diffOpen: await workbench(`[...document.querySelectorAll('.tab')].some(t => /My version/.test(t.getAttribute('aria-label') || ''))`),
    };
  }
  record.result = record.review ? 'question' : record.lost.length ? 'lost' : record.editorHas['edited by the writer'] && expectWriter ? 'merged' : 'silent';
  const writerOk = !expectWriter || record.editorHas['edited by the writer'];
  const diskOk = expectOnDisk.every((s) => record.diskHas[s]);
  record.matchesFixed = (expectQuestion ? record.review : !record.review) && record.lost.length === 0 && writerOk && diskOk;
  return record;
}

// ── the instance ───────────────────────────────────────────────────────────
let workspace = option('workspace');
let launched = false;
if (!ATTACH) {
  workspace = path.join(PROFILE, 'ws');
  // Nothing may still run on this port or this profile before the profile is deleted.
  if (portBusy()) throw new Error(`port ${PORT} is in use`);
  const live = spawnSync('ps', ['-axo', 'command='], { encoding: 'utf8' }).stdout.split('\n').some((line) => line.includes(`--user-data-dir=${path.join(PROFILE, 'ud')}`));
  if (live) throw new Error(`an instance still runs on ${PROFILE}: quit it first`);
  fs.rmSync(PROFILE, { recursive: true, force: true });
  for (const dir of ['ud/User', 'ext', 'shared', 'ws', 'ai/codex', 'ai/claude', 'ai/xdg/config', 'ai/xdg/data', 'ai/xdg/state', 'ai/xdg/cache']) fs.mkdirSync(path.join(PROFILE, dir), { recursive: true });
  fs.writeFileSync(path.join(PROFILE, 'ws/README.md'), '# Stale write check\n');
  const theme = THEME ? { 'window.autoDetectColorScheme': false, 'workbench.colorTheme': THEME === 'dark' ? 'ritemark-dark' : 'ritemark-light' } : {};
  fs.writeFileSync(path.join(PROFILE, 'ud/User/settings.json'), JSON.stringify({ 'window.confirmBeforeClose': 'never', 'ritemark.updates.enabled': false, 'ritemark.features.analytics': false, ...theme }, null, 2));
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const ai = (p) => path.join(PROFILE, 'ai', p);
  execFileSync('open', ['-n', '-g', '-j', '-a', path.join(VSCODE, '.build/electron/Ritemark.app'),
    '--env', 'NODE_ENV=development', '--env', 'VSCODE_DEV=1', '--env', 'VSCODE_CLI=1', '--env', 'RITEMARK_BUILD_CHANNEL=test',
    '--env', `CODEX_HOME=${ai('codex')}`, '--env', `CLAUDE_CONFIG_DIR=${ai('claude')}`,
    '--env', `XDG_CONFIG_HOME=${ai('xdg/config')}`, '--env', `XDG_DATA_HOME=${ai('xdg/data')}`, '--env', `XDG_STATE_HOME=${ai('xdg/state')}`, '--env', `XDG_CACHE_HOME=${ai('xdg/cache')}`,
    '--stdout', path.join(PROFILE, 'launch.log'), '--stderr', path.join(PROFILE, 'launch.log'),
    '--args', VSCODE, workspace,
    // The dev tree doesn't build these two built-ins (their `out/` is missing: activation fails with "Cannot find
    // module" and puts two error toasts over the screenshots); the check uses neither.
    '--disable-extension=vscode.vscode-api-tests', '--disable-extension=vscode.markdown-language-features', '--disable-extension=vscode.extension-editing',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${path.join(PROFILE, 'ud')}`, `--extensions-dir=${path.join(PROFILE, 'ext')}`, `--shared-data-dir=${path.join(PROFILE, 'shared')}`,
    '--use-mock-keychain', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling'], { env });
  launched = true;
  for (let i = 0; i < 90 && !(await fetch(`http://127.0.0.1:${PORT}/json/version`).then(() => true, () => false)); i += 1) await sleep(1000);
  await sleep(8000);
}
if (!workspace) throw new Error('--attach needs --workspace <the folder open in that window>');

// The [EditorSync] lines the extension host logs reach the workbench's console in a dev build.
const consoleConnection = await connect((await page()).webSocketDebuggerUrl);
const lines = [];
consoleConnection.on((event) => {
  if (event.method !== 'Runtime.consoleAPICalled') return;
  const text = event.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
  if (text.includes('[EditorSync]')) lines.push({ at: Date.now(), text: text.replace(/%c/g, '').replace(/\s*\(at console\.[^)]*\)\)?/g, '').replace(/\s*color:[^;]*;?/g, '').trim() });
});
await consoleConnection.send('Runtime.enable');
let markAt = 0;
const log = { mark: () => { markAt = Date.now(); }, since: () => lines.filter((l) => l.at >= markAt).map((l) => `+${l.at - markAt}ms ${l.text.replace(/^.*\[EditorSync\]/, '[EditorSync]')}`) };

const report = { started: new Date().toISOString(), delayMs: DELAY, cases: CASES, runs: [] };
let mismatches = 0;
try {
  const stamp = Date.now().toString(36).slice(-4);
  for (const [caseIndex, kind] of CASES.entries()) {
    for (let n = 1; n <= RUNS; n++) {
      try {
        // Unique per case and run: the editor is found by its text, and earlier runs' webviews stay open.
        const record = await run(kind, `${stamp}c${caseIndex}r${n}`, workspace, log);
        report.runs.push(record);
        if (EXPECT === 'fixed' && !record.matchesFixed) mismatches++;
        if (EXPECT === 'main' && record.matchesFixed && ['s1', 's7fm', 's7crlf', 's3', 's4'].includes(kind)) mismatches++;
        console.log(`${record.result.padEnd(8)} ${kind} #${n}: review=${record.review} lost=${JSON.stringify(record.lost)} delay=${record.delayAfterLastSaveMs}ms${record.undoBrings ? ` undo=${JSON.stringify(record.undoBrings)}` : ''}${record.undoMerge ? ` undoMerge=${JSON.stringify(record.undoMerge)}` : ''}${record.answer ? ` answer=${JSON.stringify(record.answer)}` : ''} log=${JSON.stringify(record.syncLog.map((l) => l.replace(/ file=\S+ session=\S+/, '')))}`);
      } catch (error) {
        mismatches++;
        report.runs.push({ case: kind, run: n, error: String(error?.message ?? error) });
        console.log(`ERROR    ${kind} #${n}: ${error?.message ?? error}`);
      }
    }
  }
} finally {
  consoleConnection.close();
  fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
  if (launched && KEEP_OPEN) console.log(`kept open: port ${PORT}, workspace ${workspace}`);
  if (launched && !KEEP_OPEN) {
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
console.log(`report: ${OUT}`);
process.exitCode = mismatches;
