#!/usr/bin/env node
// Composer menu check — nothing that opens from the AI side bar's message box may be hidden.
//
//   node composer-menus-check.mjs --port <cdp port> --profile <part of its --user-data-dir>
//                                 [--width 300] [--shots <dir>]
//
// Drives a Ritemark instance that was launched with its own --remote-debugging-port and
// --user-data-dir (RUNDEV or a packaged build), with real mouse input:
//   1. drags the AI side bar to <width> px (default 300, the width a new profile starts with);
//   2. opens the model menu and the permission mode menu and checks that every line of text
//      and the check mark are inside the visible part of the menu — not outside the webview,
//      and not under the conversation rail when the rail paints above the menu;
//   3. types "/" and "@" into an empty message box and checks that each popup lies inside
//      the conversation column, then empties the box again;
//   4. checks that the footer's buttons (info, attach, send) are not under the rail.
// It never sends a prompt. One PASS/FAIL line per check; exit 0 when all pass, 1 on a
// failure, 2 when the side bar has no message box to check (no usable agent, or hidden).
//
// Why it exists: v1.12.0 shipped with both menus partly under the rail at the default
// width — the descriptions cut mid-word, the check mark gone — and the "/" popup cut off at
// the column's edge. The controls were inspected in the release pass, but at a wider side bar.
//
// Needs Node 22 (global fetch and WebSocket). No dependencies.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const PORT = Number(arg('port'));
const PROFILE = arg('profile');
const WIDTH = Number(arg('width', '300'));
const SHOTS = arg('shots');
if (!PORT) {
  console.error('usage: composer-menus-check.mjs --port <cdp port> --profile <part of its --user-data-dir> [--width 300] [--shots <dir>]');
  process.exit(2);
}

// The debugging port is whoever bound it first. Make sure it is the instance under test
// before sending it any input.
if (process.platform !== 'win32') {
  if (!PROFILE) {
    console.error('--profile is required: a part of the --user-data-dir of the instance under test');
    process.exit(2);
  }
  const pid = execFileSync('lsof', ['-nP', `-iTCP:${PORT}`, '-sTCP:LISTEN', '-t']).toString().trim().split('\n')[0];
  const command = execFileSync('ps', ['-o', 'command=', '-p', pid]).toString();
  if (!command.includes(PROFILE)) {
    console.error(`port ${PORT} belongs to another instance (its command line does not contain "${PROFILE}")`);
    process.exit(2);
  }
} else if (PROFILE) {
  console.log('note: the owner of the port is not verified on Windows');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pending = new Map();
    ws.addEventListener('error', () => reject(new Error(`cannot connect to ${url}`)));
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      const waiter = pending.get(message.id);
      if (!waiter) return;
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(`${waiter.method}: ${message.error.message}`));
      else waiter.resolve(message.result);
    });
    ws.addEventListener('open', () => resolve({
      send: (method, params = {}) => new Promise((res, rej) => {
        pending.set(++id, { resolve: res, reject: rej, method });
        ws.send(JSON.stringify({ id, method, params }));
      }),
      close: () => ws.close(),
    }));
  });
}

async function evaluate(connection, expression) {
  const result = await connection.send('Runtime.evaluate', { expression, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}

// A webview target's document is VS Code's wrapper; the page itself is in #active-frame.
const inWebview = (body) => `(function(){ const frame = document.getElementById('active-frame'); if (!frame || !frame.contentDocument) return null; const d = frame.contentDocument; const w = frame.contentWindow; ${body} })()`;

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = targets.find((t) => t.type === 'page' && /workbench/.test(t.url));
if (!page) {
  console.error('no workbench window on this port');
  process.exit(2);
}
const workbench = await connect(page.webSocketDebuggerUrl);

let sidebar = null;
for (const target of targets.filter((t) => t.type === 'iframe' && t.url.startsWith('vscode-webview://'))) {
  const connection = await connect(target.webSocketDebuggerUrl).catch(() => null);
  if (!connection) continue;
  const found = await evaluate(connection, inWebview(`return !!d.querySelector('aside[aria-label="Conversations"]') && !!d.querySelector('textarea[aria-label="Message"]');`)).catch(() => false);
  if (found) {
    sidebar = connection;
    break;
  }
  connection.close();
}
if (!sidebar) {
  console.log('BLOCKED the AI side bar shows no message box (no usable agent, a setup view, or the side bar is closed)');
  workbench.close();
  process.exit(2);
}
const inSidebar = (body) => evaluate(sidebar, inWebview(body));

// Workbench geometry in CSS px: the AI side bar and the webview inside it.
const geometry = () => evaluate(workbench, `(function(){
  const bar = document.querySelector('.part.auxiliarybar').getBoundingClientRect();
  const frame = [...document.querySelectorAll('iframe.webview')].map((f) => f.getBoundingClientRect()).find((b) => b.x >= bar.x - 1 && b.width > 0);
  return { window: [innerWidth, innerHeight], zoom: outerWidth / innerWidth, bar: { x: bar.x, y: bar.y, w: bar.width, h: bar.height }, frame: frame ? { x: frame.x, y: frame.y } : null };
})()`);

const mouse = (type, x, y, pressed = false) => workbench.send('Input.dispatchMouseEvent', {
  type, x, y, button: type === 'mouseMoved' && !pressed ? 'none' : 'left', buttons: pressed ? 1 : 0, clickCount: 1,
});
async function click(x, y) {
  await mouse('mouseMoved', x, y);
  await sleep(40);
  await mouse('mousePressed', x, y, true);
  await sleep(40);
  await mouse('mouseReleased', x, y);
}
async function drag(fromX, toX, y) {
  await mouse('mouseMoved', fromX, y);
  await sleep(120);
  await mouse('mousePressed', fromX, y, true);
  for (let step = 1; step <= 8; step++) {
    await mouse('mouseMoved', fromX + ((toX - fromX) * step) / 8, y, true);
    await sleep(30);
  }
  await mouse('mouseReleased', toX, y);
  await sleep(400);
}
const escape = async () => {
  for (const type of ['keyDown', 'keyUp']) {
    await workbench.send('Input.dispatchKeyEvent', { type, key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  }
  await sleep(350);
};

let passed = 0;
let failed = 0;
const report = (ok, name, detail = '') => {
  if (ok) passed++; else failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` :: ${detail}` : ''}`);
};

async function screenshot(name) {
  if (!SHOTS) return;
  const g = await geometry();
  const result = await workbench.send('Page.captureScreenshot', {
    format: 'png',
    // The clip is in device-independent px: CSS px times the window zoom.
    clip: { x: g.bar.x * g.zoom, y: g.bar.y * g.zoom, width: (g.window[0] - g.bar.x) * g.zoom, height: g.bar.h * g.zoom, scale: 1 },
  });
  fs.mkdirSync(SHOTS, { recursive: true });
  fs.writeFileSync(path.join(SHOTS, `${name}-${WIDTH}.png`), Buffer.from(result.data, 'base64'));
}

// ── 1. The side bar at the width under test ──

let g = await geometry();
for (let attempt = 0; attempt < 5 && Math.abs(g.bar.w - WIDTH) >= 0.5; attempt++) {
  const y = g.bar.y + g.bar.h / 2;
  // A drag of a few px does not register: step away first.
  if (Math.abs(g.bar.w - WIDTH) < 6) {
    await drag(g.bar.x, g.bar.x - 24, y);
    g = await geometry();
  }
  await drag(g.bar.x, g.bar.x + (g.bar.w - WIDTH), y);
  g = await geometry();
}
// Leave the sash: it stays highlighted until the pointer reaches another part of the workbench.
await mouse('mouseMoved', g.bar.x - 60, 52);
await mouse('mouseMoved', g.bar.x - 70, 54);
let webviewWidth = 0;
for (let i = 0; i < 20; i++) {
  webviewWidth = await inSidebar(`return w.innerWidth;`);
  if (Math.abs(webviewWidth - (g.bar.w - 1)) <= 1) break;
  await sleep(150);
}
if (Math.abs(g.bar.w - WIDTH) >= 0.5 || Math.abs(webviewWidth - (g.bar.w - 1)) > 1) {
  console.log(`BLOCKED the AI side bar is ${g.bar.w.toFixed(1)} px with a ${webviewWidth} px webview, not ${WIDTH} px (window too small, or another view is showing in the side bar)`);
  workbench.close();
  sidebar.close();
  process.exit(2);
}
report(true, `AI side bar is ${WIDTH} px wide`, `webview ${webviewWidth} px, window zoom ${g.zoom.toFixed(2)}`);

// ── 2. The two menus ──

const TRIGGERS = {
  model: `[...d.querySelectorAll('button[role="combobox"]')].find((b) => !b.getAttribute('aria-label'))`,
  permission: `d.querySelector('button[role="combobox"][aria-label^="Permission mode"]')`,
};

// Everything the menu shows, against the part of it that can be seen.
const MEASURE_MENU = `
  const menu = d.querySelector('[role="listbox"]');
  if (!menu) return { open: false };
  const wrapper = menu.closest('[data-radix-popper-content-wrapper]');
  const rail = d.querySelector('aside[aria-label="Conversations"]');
  const railBox = rail.getBoundingClientRect();
  const box = menu.getBoundingClientRect();
  const layer = (el) => Number(w.getComputedStyle(el).zIndex) || 0;
  const railOnTop = layer(rail) >= layer(wrapper || menu);
  const visibleLeft = Math.max(box.left, 0);
  const visibleRight = Math.min(box.right, w.innerWidth, railOnTop ? railBox.left : Infinity);
  const hidden = [];
  const walker = d.createTreeWalker(menu, w.NodeFilter.SHOW_TEXT);
  let lines = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.nodeValue.trim() || node.parentElement.closest('.sr-only')) continue;
    const range = d.createRange();
    range.selectNodeContents(node);
    for (const line of range.getClientRects()) {
      if (line.width < 0.5) continue;
      lines++;
      const cut = Math.max(line.right - visibleRight, visibleLeft - line.left);
      if (cut > 0.5) hidden.push(node.nodeValue.trim().slice(0, 40) + ' (' + cut.toFixed(1) + ' px)');
    }
  }
  const marks = [...menu.querySelectorAll('[role="option"][data-state="checked"] > span svg')].map((mark) => mark.getBoundingClientRect());
  const viewport = menu.querySelector('[data-radix-select-viewport]') || menu;
  return {
    open: true, lines, hidden,
    left: +box.left.toFixed(1), right: +box.right.toFixed(1), width: +box.width.toFixed(1),
    railLeft: +railBox.left.toFixed(1), railOnTop,
    underRail: +Math.max(0, Math.min(box.right, w.innerWidth) - railBox.left).toFixed(1),
    outside: +Math.max(0, box.right - w.innerWidth, -box.left).toFixed(1),
    marks: marks.length,
    marksHidden: marks.filter((mark) => mark.right - visibleRight > 0.5 || visibleLeft - mark.left > 0.5).length,
    scrollsSideways: viewport.scrollWidth > viewport.clientWidth + 1,
  };
`;

for (const [name, selector] of Object.entries(TRIGGERS)) {
  const trigger = await inSidebar(`const t = ${selector}; if (!t) return null; const b = t.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 };`);
  if (!trigger) {
    report(false, `${name} menu`, 'its button is not in the message box');
    continue;
  }
  let menu = { open: false };
  // The first click into a webview that does not have the focus only focuses it: try twice.
  for (let attempt = 0; attempt < 2 && !menu.open; attempt++) {
    await click(g.frame.x + trigger.x, g.frame.y + trigger.y);
    // The menu scales in; measure once it has stopped moving.
    for (let i = 0, previous = ''; i < 8; i++) {
      await sleep(150);
      menu = await inSidebar(MEASURE_MENU);
      const now = JSON.stringify([menu.left, menu.right]);
      if (menu.open && now === previous) break;
      previous = now;
    }
  }
  if (!menu.open) {
    report(false, `${name} menu`, 'did not open');
    continue;
  }
  await screenshot(`${name}-menu`);
  const where = `menu ${menu.left}–${menu.right} px, rail from ${menu.railLeft} px${menu.underRail ? `, ${menu.underRail} px over the rail (${menu.railOnTop ? 'rail on top' : 'menu on top'})` : ''}`;
  report(menu.hidden.length === 0, `${name} menu: all ${menu.lines} lines of text are visible`, menu.hidden.length ? `${menu.hidden.length} cut: ${menu.hidden.slice(0, 3).join('; ')} — ${where}` : where);
  report(menu.marks > 0 && menu.marksHidden === 0, `${name} menu: the check mark of the selected option is visible`, menu.marks === 0 ? 'no option is marked as selected' : menu.marksHidden ? where : '');
  report(menu.outside === 0 && !menu.scrollsSideways, `${name} menu: inside the webview, no sideways scrolling`, menu.outside ? `${menu.outside} px outside` : menu.scrollsSideways ? 'scrolls sideways' : '');
  await escape();
  if ((await inSidebar(MEASURE_MENU)).open) {
    await inSidebar(`d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); return true;`);
    await sleep(350);
  }
}

// ── 3. The "/" and "@" popups ──

const MEASURE_POPUP = `
  const box = d.querySelector('textarea[aria-label="Message"]');
  const popup = [...d.querySelectorAll('div.absolute')].find((el) => el.querySelector('[data-cmd-item]') || /^No (commands|agents) found$/.test(el.innerText.trim()) || (el.style.bottom === '100%' && el.querySelector('button')));
  if (!popup) return { value: box.value, popup: null };
  const column = d.querySelector('aside[aria-label="Conversations"]').getBoundingClientRect().left;
  const b = popup.getBoundingClientRect();
  return { value: box.value, popup: { left: +b.left.toFixed(1), right: +b.right.toFixed(1), width: +b.width.toFixed(1) }, column: +column.toFixed(1), cut: +Math.max(0, b.right - column, -b.left).toFixed(1), sideways: popup.scrollWidth > popup.clientWidth + 1 };
`;

const messageBox = await inSidebar(`const t = d.querySelector('textarea[aria-label="Message"]'); const b = t.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, value: t.value, disabled: t.disabled };`);
if (messageBox.value || messageBox.disabled) {
  console.log('SKIP "/" and "@" popups: the message box is not empty or not editable, and this check does not touch a draft');
} else {
  for (const [name, character] of [['slash command', '/'], ['@ mention', '@']]) {
    let state = { popup: null };
    for (let attempt = 0; attempt < 2 && !state.popup; attempt++) {
      await click(g.frame.x + messageBox.x, g.frame.y + messageBox.y);
      await sleep(200);
      if ((await inSidebar(`return d.querySelector('textarea[aria-label="Message"]').value;`)) === '') {
        await sidebar.send('Input.insertText', { text: character });
      }
      for (let i = 0; i < 10 && !state.popup; i++) {
        await sleep(150);
        state = await inSidebar(MEASURE_POPUP);
      }
    }
    await screenshot(`${name.replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')}-popup`);
    if (!state.popup) report(false, `${name} popup`, `typing "${character}" opened no popup`);
    else report(state.cut === 0 && !state.sideways, `${name} popup: inside the conversation column`, state.cut ? `popup ${state.popup.left}–${state.popup.right} px (${state.popup.width} px wide), column ends at ${state.column} px: ${state.cut} px cut off` : state.sideways ? 'scrolls sideways' : `popup ${state.popup.left}–${state.popup.right} px, column ends at ${state.column} px`);
    // Empty the message box again and prove it.
    await inSidebar(`const t = d.querySelector('textarea[aria-label="Message"]'); t.focus(); t.select(); return true;`);
    for (const type of ['keyDown', 'keyUp']) {
      await sidebar.send('Input.dispatchKeyEvent', { type, key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8, nativeVirtualKeyCode: 51 });
    }
    await sleep(300);
    const left = await inSidebar(`return d.querySelector('textarea[aria-label="Message"]').value;`);
    if (left !== '') {
      report(false, `${name} popup: message box emptied afterwards`, `still holds ${JSON.stringify(left)}`);
      break;
    }
  }
}

// ── 4. The footer's buttons ──

const footer = await inSidebar(`
  const model = ${TRIGGERS.model};
  if (!model) return null;
  const column = d.querySelector('aside[aria-label="Conversations"]').getBoundingClientRect().left;
  const buttons = [...model.parentElement.querySelectorAll('button')].map((b) => ({ name: b.getAttribute('aria-label') || b.getAttribute('title') || b.innerText.trim(), right: b.getBoundingClientRect().right }));
  const worst = buttons.reduce((a, b) => (b.right > a.right ? b : a), buttons[0]);
  return { column: +column.toFixed(1), count: buttons.length, worst: worst.name.slice(0, 40), over: +Math.max(0, worst.right - column).toFixed(1) };
`);
if (footer) report(footer.over === 0, `footer: all ${footer.count} buttons are inside the conversation column`, footer.over ? `"${footer.worst}" is ${footer.over} px under the rail` : '');

workbench.close();
sidebar.close();
console.log(`=== RESULT: ${passed} passed, ${failed} failed ===`);
process.exit(failed === 0 ? 0 : 1);
