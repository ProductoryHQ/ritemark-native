#!/usr/bin/env node
/**
 * Sprint 146, A1 (R1, S1–S8): #585's audit, run live. Where the focus and the ring end up after a menu or a Select
 * closes, by the mouse and by the keyboard, on a running dev instance.
 *
 * Real input only: every click and key goes through `Input.dispatchMouseEvent` / `Input.dispatchKeyEvent` on the
 * workbench page, so Chromium's own focus rules run. The page is only read (`activeElement`, `:focus-visible`, the open
 * tooltip); nothing in it is clicked or focused by script. Focus emulation is on, so a hidden window draws its focus as a
 * front one.
 *
 * Usage: start a dev instance hidden on a free CDP port, with its own short profile and scratch homes for the AIs
 * (`research/menu-focus-audit.md` says how), open a folder in it, then:
 *   node menu-focus-audit.mjs --port 9271 --settings <profile>/ud/User/settings.json --out <dir> [--themes light,dark] [--rows a,b] [--pad 28]
 * It writes `<dir>/audit.json` and one crop per step (`<theme>-<row>-<step>.png`, device pixels), and prints a table.
 * Exit code: 1 when any step's result isn't the rule's (R1), 0 otherwise; the count is printed.
 */
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const option = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : fallback; };
const PORT = Number(option('port', '9271'));
const SETTINGS = option('settings', null);
const OUT = option('out', '/private/tmp/rm146/audit');
const THEMES = option('themes', 'light,dark').split(',');
const ONLY = option('rows', '')?.split(',').filter(Boolean);
const PAD = Number(option('pad', '28')); // CSS px of room round the trigger in each crop
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

// ── CDP plumbing ──────────────────────────────────────────────────────────────
async function targets() { return (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); }
async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0; const pending = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); const w = pending.get(d.id); if (!w) return; pending.delete(d.id); clearTimeout(w.timer); d.error ? w.reject(new Error(JSON.stringify(d.error))) : w.resolve(d.result); };
  // A webview that goes away mid-step closes its socket: its calls fail rather than wait for ever
  ws.onclose = () => { for (const w of pending.values()) { clearTimeout(w.timer); w.reject(new Error('target closed')); } pending.clear(); };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id;
    const timer = setTimeout(() => { pending.delete(mid); reject(new Error(`${method} timed out`)); }, 15000);
    pending.set(mid, { resolve, reject, timer });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  const evaluate = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
  return { send, evaluate, close: () => ws.close() };
}
let wb = null;
async function workbench() {
  if (wb) return wb;
  const t = (await targets()).find((c) => c.type === 'page' && c.url.startsWith('vscode-file://'));
  if (!t) throw new Error('no workbench page');
  wb = await connect(t.webSocketDebuggerUrl);
  await wb.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  return wb;
}
// The document editors draw `<App />` with no editor type of their own: each is told by what it holds.
const PROBES = {
  'agents-panel': `/AGENTS/.test(d.body.innerText) && /FLOWS/.test(d.body.innerText)`,
  'agent-configurator': `Boolean(d.querySelector('[role="combobox"][aria-label="Model"]'))`,
  'pdf-viewer': `d.title === 'PDF Preview'`,
  'docx-viewer': `Boolean(d.querySelector('[aria-label="More ways to use this document"]'))`,
  markdown: `Boolean(d.querySelector('.ProseMirror') && d.querySelector('[data-share-button]'))`,
};
const IN_FRAME = (body) => `(async () => { const af = document.getElementById('active-frame'); const d = af && af.contentDocument; const w = af && af.contentWindow; if (!d) return null; ${body} })()`;
/** The webview whose root says `data-editor-type="<kind>"` (or, for the document editors, where `probe` is true), as a
 * connection and its offset in the window. */
async function frame(kind) {
  // A tab's webview can take a moment to load after its tab is chosen
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const f = await findFrame(kind);
    if (f) return f;
    await sleep(1000);
  }
  return null;
}
async function findFrame(kind) {
  const probe = PROBES[kind] ?? `d.querySelector('#root')?.dataset.editorType === ${JSON.stringify(kind)}`;
  for (const t of (await targets()).filter((c) => c.type === 'iframe' && c.url.startsWith('vscode-webview://'))) {
    const c = await connect(t.webSocketDebuggerUrl).catch(() => null);
    if (!c) continue;
    const ok = await c.evaluate(IN_FRAME(`return Boolean(${probe})`)).catch(() => false);
    if (!ok) { c.close(); continue; }
    const id = /[?&]id=([^&]+)/.exec(t.url)?.[1] ?? '';
    const offset = await (await workbench()).evaluate(`(() => { const f = [...document.querySelectorAll('iframe')].find((i) => i.src.includes(${JSON.stringify(id)}) && i.getBoundingClientRect().width > 0 && i.getBoundingClientRect().top < innerHeight - 40 && i.checkVisibility({ visibilityProperty: true, opacityProperty: true })); if (!f) return null; const r = f.getBoundingClientRect(); return { x: r.x, y: r.y }; })()`);
    if (!offset) { c.close(); continue; }
    await c.send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});
    return { ...c, offset, read: (body) => c.evaluate(IN_FRAME(body)) };
  }
  return null;
}
async function rectOf(f, expr) {
  const r = await f.read(`const el = (${expr}); if (!el) return null; const b = el.getBoundingClientRect(); if (!b.width) return null; return { x: b.x, y: b.y, w: b.width, h: b.height }`);
  return r && { x: f.offset.x + r.x, y: f.offset.y + r.y, w: r.w, h: r.h, cx: f.offset.x + r.x + r.w / 2, cy: f.offset.y + r.y + r.h / 2 };
}
async function mouseMove(x, y) { await (await workbench()).send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' }); }
async function click(x, y) {
  const c = await workbench();
  await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' });
  await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
  await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
}
const KEYS = { Escape: [27, 'Escape'], Enter: [13, 'Enter'], Tab: [9, 'Tab'], ArrowDown: [40, 'ArrowDown'], ArrowUp: [38, 'ArrowUp'], ' ': [32, 'Space'] };
async function key(name, modifiers = 0) {
  const c = await workbench();
  const [vk, code] = KEYS[name];
  const text = name === 'Enter' ? '\r' : name === ' ' ? ' ' : undefined;
  await c.send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', key: name, code, windowsVirtualKeyCode: vk, modifiers, text });
  await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code, windowsVirtualKeyCode: vk, modifiers });
}
async function crop(file, r, pad = PAD) {
  if (!r) return null;
  const { data } = await (await workbench()).send('Page.captureScreenshot', { format: 'png', clip: { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: r.w + pad * 2, height: r.h + pad * 2, scale: 1 } });
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  return path.basename(file);
}
async function clickTab(label) {
  const r = await (await workbench()).evaluate(`(() => { const t = [...document.querySelectorAll('.tabs-container .tab')].find((x) => (x.getAttribute('aria-label') || '').startsWith(${JSON.stringify(label)})); if (!t) return null; const b = t.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
  if (!r) throw new Error(`no tab ${label}`);
  await click(r.x, r.y); await sleep(1200);
}
/** A place in the left column's row (Home, Documents, Tasks, …): the projects list shows only on Home. */
async function clickPlace(label) {
  const r = await (await workbench()).evaluate(`(() => { const e = [...document.querySelectorAll('[aria-label]')].find((x) => x.getAttribute('aria-label') === ${JSON.stringify(label)} && x.getBoundingClientRect().width && x.getBoundingClientRect().y < 90); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
  if (!r) throw new Error(`no place ${label}`);
  await click(r.x, r.y); await sleep(1500);
}
async function clickIn(kind, expr) {
  const f = await frame(kind);
  const r = f && await rectOf(f, expr);
  f?.close();
  if (!r) throw new Error(`nothing to click in ${kind}`);
  await click(r.cx, r.cy); await sleep(900);
}
async function openFromHome(name) {
  await clickTab('Home');
  const f = await frame('home');
  const r = await rectOf(f, `[...d.querySelectorAll('button, a, [role=button], li')].find((e) => e.innerText && e.innerText.trim().startsWith(${JSON.stringify(name)}))`);
  f.close();
  if (!r) throw new Error(`no ${name} on Home`);
  await click(r.cx, r.cy); await sleep(3500);
}

// ── What a step reads ─────────────────────────────────────────────────────────
/** What the trigger draws round itself (its outline, its shadow rings, its border): read at rest and after a step. */
// An outline that draws nothing (\`outline-none\` is a 2 px transparent one) counts as none.
const LOOK = (trigger) => `const t = (${trigger}); if (!t) return null; const c = w.getComputedStyle(t); const clear = c.outlineStyle === 'none' || /rgba\\(.*, 0\\)$|transparent/.test(c.outlineColor) || parseFloat(c.outlineWidth) === 0; return [clear ? 'no outline' : [c.outlineStyle, c.outlineWidth, c.outlineColor].join(' '), c.boxShadow, c.borderColor].join(' / ');`;
const STATE = (trigger) => `
  const look = (() => { ${LOOK(trigger)} })();
  const t = (${trigger}); const a = d.activeElement;
  const onTrigger = Boolean(t && a && (a === t || t.contains(a)));
  const cs = a ? w.getComputedStyle(a) : null;
  const tips = [...d.querySelectorAll('[role="tooltip"]')].map((x) => x.textContent.trim()).filter(Boolean);
  return {
    active: a ? (a.getAttribute('aria-label') || a.tagName.toLowerCase() + (a.className && typeof a.className === 'string' ? '.' + a.className.split(' ')[0] : '')) : null,
    onTrigger, focusVisible: Boolean(onTrigger && a.matches(':focus-visible')),
    outline: cs && cs.outlineStyle !== 'none' ? cs.outlineWidth + ' ' + cs.outlineStyle : 'none',
    ring: cs && cs.boxShadow !== 'none' ? 'box-shadow' : 'none',
    tooltip: tips.join(' | ') || null,
    open: Boolean(d.querySelector('[role="menu"], [role="listbox"]')),
    look,
    hasFocus: d.hasFocus(),
  };`;

// ── The rows: #585's table, the ones a scratch profile can reach ──────────────
const PAGE_COUNT = `[...d.querySelectorAll('span, div')].find((e) => !e.children.length && /^Page \\d+ of/.test(e.textContent.trim())) || d.body`;
// The document's save state, beside Share: a blank spot outside the editor, so no key goes into the text
const SAVED = `[...d.querySelectorAll('span, div')].find((e) => !e.children.length && /^(Saved|Saving…|Not saved)$/.test(e.textContent.trim())) || d.body`;
const ROWS = [
  {
    id: 'home-askwith', name: 'Home first-day card, "Ask with" caret', kind: 'menu', frame: 'home', prep: () => clickTab('Home'),
    trigger: `d.querySelector('.rh-split [aria-label="Ask with"]')`,
    blank: `d.querySelector('.rh-guide-body')`,
    item: null, noPick: 'every AI row starts a sign-in or the key sheet in a scratch home',
  },
  {
    id: 'projects-add', name: 'Projects list, "Add a project…"', kind: 'menu', frame: 'projects', prep: () => clickPlace('Home'),
    trigger: `d.querySelector('.rp-add')`,
    blank: `d.querySelector('.rp-head, h2, h3') || d.body`,
    item: null, noPick: 'both items open a folder picker or a new window',
  },
  {
    id: 'board-doing-limit', name: 'Task board, "Doing limit"', kind: 'menu', frame: 'task-board',
    prep: async () => { await clickTab('Task board'); await clickIn('task-board', `[...d.querySelectorAll('[role="tab"], button')].find((e) => e.textContent.trim() === 'Board')`); },
    trigger: `d.querySelector('[aria-label="Doing limit"]')`,
    blank: `[...d.querySelectorAll('h2, h3, [role=heading]')].find((e) => /Doing|Ready|Done/.test(e.textContent)) || d.body`,
    item: `[...d.querySelectorAll('[role="menuitemradio"]')].find((e) => e.textContent.trim() === '3')`,
  },
  {
    id: 'board-card-more', name: 'Task board, a card\'s "More actions"', kind: 'menu', frame: 'task-board',
    prep: async () => { await clickTab('Task board'); await clickIn('task-board', `[...d.querySelectorAll('[role="tab"], button')].find((e) => e.textContent.trim() === 'Board')`); },
    trigger: `d.querySelector('[aria-label="More actions for Tidy the audit notes"]')`,
    blank: `[...d.querySelectorAll('h2, h3, [role=heading]')].find((e) => /Doing|Ready|Done/.test(e.textContent)) || d.body`,
    item: null, noPick: 'its items open a conversation, a card page or a sub-menu',
  },
  {
    id: 'pdf-zoom', name: 'PDF viewer, zoom menu', kind: 'menu', frame: 'pdf-viewer', prep: () => openFromHome('notes.pdf'),
    trigger: `d.querySelector('[aria-label^="Zoom: "]')`,
    blank: PAGE_COUNT,
    item: `[...d.querySelectorAll('[role="menuitem"], [role="menuitemradio"]')].find((e) => /^100\\s?%/.test(e.textContent.trim()))`,
  },
  {
    id: 'pdf-share', name: 'PDF viewer, Share', kind: 'menu', frame: 'pdf-viewer', prep: () => openFromHome('notes.pdf'),
    trigger: `[...d.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || b.textContent).trim() === 'Share')`,
    blank: PAGE_COUNT,
    item: null, noPick: 'its items copy to the system clipboard or open a save dialog',
  },
  {
    id: 'docx-open-in', name: 'Word, "Open in …" caret', kind: 'menu', frame: 'docx-viewer', prep: () => openFromHome('smoke.docx'),
    trigger: `d.querySelector('[aria-label="More ways to use this document"]')`,
    blank: PAGE_COUNT,
    item: null, noPick: 'its items open another app',
  },
  {
    id: 'doc-share', name: 'Document Share (ExportMenu)', kind: 'share', frame: 'markdown', prep: () => openFromHome('README.md'),
    trigger: `d.querySelector('[data-share-button]')`,
    blank: SAVED,
    item: null, noPick: 'its items copy to the system clipboard or open a save dialog',
  },
  {
    id: 'doc-dictation', name: 'Dictation language caret (hand-rolled)', kind: 'own', frame: 'markdown', prep: () => openFromHome('README.md'),
    trigger: `d.querySelector('[aria-label="Dictation language"]')`,
    blank: SAVED,
    item: `d.querySelector('.dictation-dropdown-item.active')`,
    noKeyPick: 'its own menu has no arrow keys: Enter on the caret only opens and closes it (#585\'s note on Tab into its rows)',
  },
  {
    id: 'flow-model-select', name: 'Flow step, model Select', kind: 'select', frame: 'flow',
    prep: async () => {
      // From the Agents place: with this many tabs open, the flow's own tab is folded into the tab row's list
      await clickPlace('Agents');
      await clickIn('agents-panel', `[...d.querySelectorAll('*')].filter((e) => /^audit-.*\\.flow\\.json$/.test(e.textContent.trim())).pop()`);
    },
    // Escape (each step's reset) clears the canvas's selection, and the step's panel with it: select the step again
    beforeStep: () => clickIn('flow', `d.querySelector('.react-flow__node[data-id="node-2"]')`),
    trigger: `d.querySelectorAll('.rm-flow-props [role="combobox"]')[1]`,
    blank: `[...d.querySelectorAll('.rm-flow-props span')].find((e) => e.textContent.trim() === 'LLM prompt')`,
    item: `[...d.querySelectorAll('[role="option"]')].find((o) => o.getAttribute('aria-selected') !== 'true')`,
  },
  {
    id: 'agent-model-select', name: 'Agent configurator, model Select (the base `focus:` frame)', kind: 'select', frame: 'agent-configurator',
    prep: () => clickTab('helper.md'),
    trigger: `d.querySelector('[role="combobox"][aria-label="Model"]')`,
    blank: `[...d.querySelectorAll('h2')].find((e) => e.textContent.trim() === 'Agent')`,
    item: `[...d.querySelectorAll('[role="option"]')].find((o) => o.getAttribute('aria-selected') !== 'true')`,
  },
];

// ── The steps ─────────────────────────────────────────────────────────────────
async function reset(f, row) {
  await key('Escape'); await sleep(150); await key('Escape'); await sleep(250);
  if (row.beforeStep) await row.beforeStep();
  const blank = await rectOf(f, row.blank);
  if (blank) { await click(blank.x + 4, blank.y + Math.min(6, blank.h / 2)); await sleep(250); }
  await mouseMove(4, 880); await sleep(200);
  row.restLook = await f.read(LOOK(row.trigger));
}
/** Tab (then Shift+Tab, for a trigger before the blank spot) until the trigger has the focus; the number of presses. */
async function tabTo(f, row) {
  const on = () => f.read(`const t = (${row.trigger}); return Boolean(t && (d.activeElement === t || t.contains(d.activeElement)))`);
  for (let i = 0; i < 30; i += 1) { if (await on()) return i; await key('Tab'); await sleep(90); }
  await reset(f, row);
  for (let i = 0; i < 30; i += 1) { if (await on()) return -i; await key('Tab', 8); await sleep(90); }
  return null;
}
async function openByMouse(f, row) {
  const r = await rectOf(f, row.trigger);
  if (!r) throw new Error(`${row.id}: no trigger`);
  await click(r.cx, r.cy); await sleep(450);
  return r;
}
const STEPS = {
  async mousePick(f, row) {
    if (!row.item) return { notRun: row.noPick };
    const r = await openByMouse(f, row);
    const item = await rectOf(f, row.item);
    if (!item) return { notRun: 'the item to pick was not found in the open menu', r };
    await click(item.cx, item.cy); await sleep(700);
    return { r };
  },
  async mouseOutside(f, row) {
    const r = await openByMouse(f, row);
    const blank = await rectOf(f, row.blank);
    await click(blank.x + 4, blank.y + Math.min(6, blank.h / 2)); await sleep(700);
    await mouseMove(4, 880); await sleep(300);
    return { r };
  },
  async escapeAfterMouse(f, row) {
    const r = await openByMouse(f, row);
    await mouseMove(4, 880); await sleep(200);
    await key('Escape'); await sleep(700);
    return { r };
  },
  async keyPick(f, row) {
    if (!row.item) return { notRun: row.noPick };
    if (row.noKeyPick) return { notRun: row.noKeyPick };
    const tabs = await tabTo(f, row);
    if (tabs === null) return { notRun: 'Tab never reached the trigger' };
    const r = await rectOf(f, row.trigger);
    await key('Enter'); await sleep(450); await key('ArrowDown'); await sleep(150); await key('Enter'); await sleep(700);
    return { r, tabs };
  },
  async keyEscape(f, row) {
    const tabs = await tabTo(f, row);
    if (tabs === null) return { notRun: 'Tab never reached the trigger' };
    const r = await rectOf(f, row.trigger);
    await key('Enter'); await sleep(450); await key('Escape'); await sleep(700);
    return { r, tabs };
  },
  async keyTabOut(f, row) {
    if (row.kind !== 'share') return { notRun: 'Share only (S6)' };
    const r = await openByMouse(f, row);
    await mouseMove(4, 880); await sleep(200);
    await key('Tab'); await sleep(700);
    return { r };
  },
};
/**
 * The rule (R1): no ring and no tooltip after the mouse; the trigger focused with its ring after the keyboard. A ring is
 * what the trigger draws: `:focus-visible` on it, or its outline, shadow or border changed from its look at rest (a
 * Select's trigger frames any focus, `focus:`). Focus left on the trigger with nothing drawn is noted, not failed.
 */
function verdict(step, row, s) {
  if (s.open) return 'menu still open';
  const drawn = s.onTrigger && (s.focusVisible || (row.restLook !== null && s.look !== row.restLook));
  // Escape after a mouse open is a keyboard close: the trigger has the focus, with its ring (S3)
  if (step.startsWith('mouse')) {
    if (drawn) return 'ring on the trigger';
    if (s.tooltip) return `tooltip open: ${s.tooltip}`;
    return s.onTrigger ? 'ok (the focus stays on the trigger; nothing is drawn)' : 'ok';
  }
  return s.onTrigger && s.focusVisible ? 'ok' : 'no focus ring on the trigger';
}

async function setTheme(theme) {
  if (!SETTINGS) return;
  const j = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
  j['window.autoDetectColorScheme'] = false;
  j['workbench.colorTheme'] = theme === 'dark' ? 'ritemark-dark' : 'ritemark-light'; // a contributed theme's settings value is its id
  fs.writeFileSync(SETTINGS, JSON.stringify(j, null, 2));
  await sleep(2500);
}

const results = [];
let failures = 0;
for (const theme of THEMES) {
  await setTheme(theme);
  for (const row of ROWS.filter((r) => !ONLY.length || ONLY.includes(r.id))) {
    try { await row.prep(); } catch (error) { results.push({ theme, row: row.id, name: row.name, step: '*', notRun: String(error.message) }); continue; }
    for (const step of Object.keys(STEPS)) {
      const f = await frame(row.frame);
      if (!f) { results.push({ theme, row: row.id, name: row.name, step, notRun: `no ${row.frame} webview` }); continue; }
      try {
        await reset(f, row);
        const done = await STEPS[step](f, row);
        if (done.notRun) { results.push({ theme, row: row.id, name: row.name, step, notRun: done.notRun }); continue; }
        const s = await f.read(STATE(row.trigger));
        const v = verdict(step, row, s);
        if (!v.startsWith('ok')) failures += 1;
        const file = await crop(path.join(OUT, `${theme}-${row.id}-${step}.png`), done.r);
        results.push({ theme, row: row.id, name: row.name, step, verdict: v, ...s, tabs: done.tabs, crop: file });
      } catch (error) {
        results.push({ theme, row: row.id, name: row.name, step, notRun: `error: ${String(error.message).slice(0, 200)}` });
      } finally { f.close(); }
    }
  }
}
await key('Escape');
fs.writeFileSync(path.join(OUT, 'audit.json'), JSON.stringify({ at: new Date().toISOString(), port: PORT, results }, null, 2));
for (const r of results) {
  console.log([r.theme, r.row, r.step, r.notRun ? `not run: ${r.notRun}` : r.verdict, r.notRun ? '' : `active=${r.active} fv=${r.focusVisible} tooltip=${r.tooltip ?? '-'}`].join(' | '));
}
console.log(`steps that break the rule: ${failures}`);
wb?.close();
process.exit(failures ? 1 : 0); // 1 when any step breaks the rule (a raw count wraps at 256)
