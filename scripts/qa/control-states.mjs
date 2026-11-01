#!/usr/bin/env node
/**
 * control-states.mjs - every shared control in every state, against the images the Experience lead approved
 * (Sprint 146, R4; the review process's Step 8).
 *
 * Usage: node scripts/qa/control-states.mjs --port <cdp-port> --out <dir> [--compare docs/development/control-baseline]
 *          [--only <row>[,<row>…]] [--themes light,dark] [--size 1440x900] [--share 0.0003]
 *
 * Connects over the Chrome DevTools Protocol to a Ritemark dev instance or an installed build (a release candidate)
 * started with RITEMARK_CONTROL_CATALOGUE=1 and --remote-debugging-port (launch it hidden: `open -n -g -j`, its own
 * --user-data-dir and --shared-data-dir, --use-mock-keychain, and for an installed build RITEMARK_BUILD_CHANNEL=test;
 * never on Jarmo's own profile). The setting opens the control catalogue as a tab (src/views/ControlCataloguePanel.ts).
 *
 * Real input only. Each state is reached as a person reaches it, with Input.dispatchMouseEvent and
 * Input.dispatchKeyEvent on the window: a hover is the pointer moved onto the control, a press is held, the keyboard's
 * focus is a click on the cell's start mark and Tab, a pick is a click on an item or Enter. The page is only read and
 * scrolled, never clicked or focused by script (a unit test holds the source to that). The debugging protocol's focus
 * emulation is on, so a hidden window draws its focus as a front one.
 *
 * Each cell is captured at device pixels, in Ritemark Light and Ritemark Dark (switched through the palette), as
 * <out>/<theme>-<cell>.png, and <out>/sheet.html lays the captures out as the catalogue's grid, for the Experience
 * lead. With --compare, each capture is compared with the same file in the approved set inside the running instance
 * (no image library), and <out>/compare.html shows each differing state's approved image, capture and difference.
 * The exit code is 1 when any state differs from its approved image or has none, and 0 otherwise; the count is printed
 * (an exit status holds only 0-255, so a count could read as a pass).
 *
 * docs/development/control-baseline/README.md says how to take a new set and who approves it.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => {
	const index = args.indexOf(`--${name}`);
	return index === -1 ? fallback : args[index + 1];
};
const port = option('port');
const out = option('out');
const baseline = option('compare');
const only = (option('only', '') || '').split(',').filter(Boolean);
const themes = option('themes', 'light,dark').split(',');
const [width, height] = option('size', '1440x900').split('x').map(Number);
if (!port || !out) {
	console.error('usage: node scripts/qa/control-states.mjs --port <cdp-port> --out <dir> [--compare <approved-dir>] [--only <row>] [--themes light,dark] [--size 1440x900]');
	process.exit(2);
}
mkdirSync(out, { recursive: true });

// A pixel differs when its channels move by more than this in all; a state differs when more than this share of its
// pixels do (A3: five runs of the same cells on one instance, research/catalogue-capture.md)
const PIXEL_DELTA = 24;
const STATE_SHARE = Number(option('share', '0.0003')); // 0.03%: a 37 px shift of the page moved up to 0.02% (anti-aliasing), a radio's dot is 0.06%
if (!Number.isFinite(STATE_SHARE) || STATE_SHARE < 0 || STATE_SHARE >= 1) {
	console.error('--share takes a share of a state\'s pixels, from 0 up to 1 (0.0003 by default)');
	process.exit(2);
}
const SETTLE_MS = 650; // a tooltip's 300 ms delay and its first paint, a menu's mount
const THEME_LABEL = { light: 'Ritemark Light', dark: 'Ritemark Dark' };
const THEME_ID = { light: 'ritemark-light', dark: 'ritemark-dark' };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// ── CDP plumbing ──────────────────────────────────────────────────────────────
async function targets() {
	return (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
}
async function connect(url) {
	const socket = new WebSocket(url);
	await new Promise((resolve, reject) => {
		socket.addEventListener('open', resolve, { once: true });
		socket.addEventListener('error', reject, { once: true });
	});
	let nextId = 0;
	const pending = new Map();
	socket.addEventListener('message', event => {
		const message = JSON.parse(event.data);
		const waiting = pending.get(message.id);
		if (!waiting) {
			return;
		}
		pending.delete(message.id);
		clearTimeout(waiting.timer);
		message.error ? waiting.reject(new Error(JSON.stringify(message.error))) : waiting.resolve(message.result);
	});
	socket.addEventListener('close', () => {
		for (const waiting of pending.values()) {
			clearTimeout(waiting.timer);
			waiting.reject(new Error('target closed'));
		}
		pending.clear();
	});
	const send = (method, params = {}) => new Promise((resolve, reject) => {
		const id = ++nextId;
		const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 20000);
		pending.set(id, { resolve, reject, timer });
		socket.send(JSON.stringify({ id, method, params }));
	});
	const evaluate = async expression => {
		const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
		if (exceptionDetails) {
			throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
		}
		return result.value;
	};
	return { send, evaluate, close: () => socket.close() };
}

const pageTarget = (await targets()).find(target => target.type === 'page' && target.url.startsWith('vscode-file://'));
if (!pageTarget) {
	console.error(`no workbench page on port ${port}`);
	process.exit(2);
}
const page = await connect(pageTarget.webSocketDebuggerUrl);
await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 0, mobile: false });
await page.send('Emulation.setFocusEmulationEnabled', { enabled: true });
await sleep(1000);
const isMac = await page.evaluate(`document.querySelector('.monaco-workbench').classList.contains('mac')`);
const MOD = isMac ? 4 : 2; // CDP modifiers: 2 Ctrl, 4 Meta, 8 Shift

// ── Real input on the window ──────────────────────────────────────────────────
const KEYS = { Escape: [27, 'Escape'], Enter: [13, 'Enter'], Tab: [9, 'Tab'], ArrowDown: [40, 'ArrowDown'] };
async function key(name, modifiers = 0) {
	const [code, keyCode] = KEYS[name] ? [KEYS[name][1], KEYS[name][0]] : [`Key${name.toUpperCase()}`, name.toUpperCase().charCodeAt(0)];
	const text = name === 'Enter' ? '\r' : undefined;
	await page.send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', modifiers, code, key: name, windowsVirtualKeyCode: keyCode, text });
	await page.send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers, code, key: name, windowsVirtualKeyCode: keyCode });
}
async function move(x, y, buttons = 0) {
	await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: buttons ? 'left' : 'none', buttons });
}
async function press(x, y, button = 'left') {
	await move(x, y);
	await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button, buttons: button === 'left' ? 1 : 2, clickCount: 1 });
}
async function release(x, y, button = 'left') {
	await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button, buttons: 0, clickCount: 1 });
}
async function clickAt(x, y, button = 'left') {
	await press(x, y, button);
	await release(x, y, button);
}
async function type(text) {
	await page.send('Input.insertText', { text });
}

// ── The workbench: the palette and the theme (frame-screenshots.mjs' way) ─────
async function pickRow(label) {
	const row = `[...document.querySelectorAll('.quick-input-widget .quick-input-list .monaco-list-row')].find(row => { const aria = row.getAttribute('aria-label') || ''; return aria === ${JSON.stringify(label)} || aria.startsWith(${JSON.stringify(label + ',')}); })`;
	for (let waited = 0; waited < 5000; waited += 250) {
		const centre = await page.evaluate(`(() => { const element = ${row}; if (!element) { return null; } const r = element.getBoundingClientRect(); return r.width ? [r.x + r.width / 2, r.y + r.height / 2] : null; })()`);
		if (centre) {
			await clickAt(...centre);
			return;
		}
		await sleep(250);
	}
	throw new Error(`no palette row "${label}"`);
}
async function command(label) {
	await key('p', MOD | 8);
	await sleep(600);
	if (!(await page.evaluate(`document.querySelector('.quick-input-widget')?.style.display !== 'none'`))) {
		const bar = await page.evaluate(`(() => { const r = document.querySelector('.part.statusbar')?.getBoundingClientRect(); return r ? [r.x + r.width / 2, r.y + r.height / 2] : null; })()`);
		if (bar) {
			await clickAt(...bar);
			await sleep(300);
		}
		await key('p', MOD | 8);
		await sleep(600);
	}
	await type(label);
	await sleep(900);
	await pickRow(label);
	await sleep(1200);
}
/** The theme the catalogue's page is drawn in now: VS Code marks a webview's body with its theme's id. */
async function themeNow() {
	return frame.read(`return d.body.dataset.vscodeThemeId || null;`);
}
async function theme(name) {
	if ((await themeNow()) === THEME_ID[name]) {
		return;
	}
	for (let attempt = 1; ; attempt++) {
		await command('Preferences: Color Theme');
		await type(THEME_LABEL[name]);
		await sleep(900);
		try {
			await pickRow(THEME_LABEL[name]);
			await sleep(2000);
			if ((await themeNow()) !== THEME_ID[name]) {
				throw new Error(`the catalogue is not in ${THEME_LABEL[name]}`);
			}
			return;
		} catch (error) {
			if (attempt === 2) {
				throw error;
			}
			await key('Escape');
			await sleep(1500);
		}
	}
}

// ── The catalogue's webview ───────────────────────────────────────────────────
const IN_PAGE = body => `(() => { const af = document.getElementById('active-frame'); const d = af && af.contentDocument; if (!d) { return null; } ${body} })()`;
async function catalogue() {
	for (let attempt = 0; attempt < 20; attempt++) {
		for (const target of (await targets()).filter(t => t.type === 'iframe' && t.url.startsWith('vscode-webview://'))) {
			const frame = await connect(target.webSocketDebuggerUrl).catch(() => null);
			if (!frame) {
				continue;
			}
			const ready = await frame.evaluate(IN_PAGE(`return d.querySelector('#root')?.dataset.editorType === 'control-catalogue' && Boolean(d.querySelector('.rm-cat-box'));`)).catch(() => false);
			if (!ready) {
				frame.close();
				continue;
			}
			const id = /[?&]id=([^&]+)/.exec(target.url)?.[1] ?? '';
			await frame.send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});
			return { ...frame, id, read: body => frame.evaluate(IN_PAGE(body)) };
		}
		// Its tab may be behind another: choose it in the tab row
		const tab = await page.evaluate(`(() => { const t = [...document.querySelectorAll('.tabs-container .tab')].find(x => (x.getAttribute('aria-label') || '').startsWith('Control catalogue')); if (!t) { return null; } const r = t.getBoundingClientRect(); return r.width ? [r.x + r.width / 2, r.y + r.height / 2] : null; })()`);
		if (tab) {
			await clickAt(...tab);
		}
		await sleep(1000);
	}
	throw new Error('no control catalogue: start Ritemark with RITEMARK_CONTROL_CATALOGUE=1');
}
const frame = await catalogue();
async function frameOrigin() {
	const origin = await page.evaluate(`(() => { const f = [...document.querySelectorAll('iframe')].find(i => i.src.includes(${JSON.stringify(frame.id)}) && i.checkVisibility()); if (!f) { return null; } const r = f.getBoundingClientRect(); return { x: r.x, y: r.y }; })()`);
	if (!origin) {
		throw new Error('the catalogue is not on show');
	}
	return origin;
}

/** The page's cells, with what each one needs, in the page's order. */
const cells = (await frame.read(`return [...d.querySelectorAll('.rm-cat-box[data-cell]')].map(box => ({
	name: box.dataset.cell, state: box.dataset.state, target: box.dataset.targetSelector, tabs: Number(box.dataset.tabs || 1),
	item: box.dataset.item || null, capture: box.dataset.capture || null, rightClick: box.hasAttribute('data-right-click'),
	closeOutside: box.hasAttribute('data-close-outside'),
	caption: box.parentElement.querySelector('.rm-cat-caption')?.textContent || box.dataset.state,
	variant: box.closest('.rm-cat-variant')?.querySelector('h3')?.textContent || '',
	row: box.closest('.rm-cat-row')?.dataset.row || '', rowTitle: box.closest('.rm-cat-row')?.querySelector('h2')?.textContent || '',
}));`)).filter(cell => !only.length || only.includes(cell.row));
if (!cells.length) {
	console.error('no cells to capture');
	process.exit(2);
}

/** A rectangle in the window: the cell's box, its control, its start mark, an item of an open menu, the open dialog. */
async function rectOf(cell, what) {
	const r = await frame.read(`
		const box = d.querySelector('[data-cell=${JSON.stringify(cell.name)}]');
		const pick = {
			box: () => box,
			start: () => box.querySelector('[data-start]'),
			target: () => box.querySelector(${JSON.stringify(cell.target)}),
			item: () => ${cell.item ? `d.querySelector(${JSON.stringify(cell.item)})` : `d.querySelector('[data-radix-popper-content-wrapper] [role^="menuitem"]:not([data-disabled]), [data-radix-popper-content-wrapper] [role="option"]:not([data-disabled])')`},
			dialog: () => d.querySelector('[role="dialog"]'),
		}[${JSON.stringify(what)}];
		const element = pick && pick();
		if (!element) { return null; }
		const b = element.getBoundingClientRect();
		return b.width ? { x: b.x, y: b.y, w: b.width, h: b.height } : null;`);
	if (!r) {
		return null;
	}
	const origin = await frameOrigin();
	return { x: origin.x + r.x, y: origin.y + r.y, w: r.w, h: r.h, cx: origin.x + r.x + r.w / 2, cy: origin.y + r.y + r.h / 2 };
}
async function centre(cell, what) {
	const r = await rectOf(cell, what);
	if (!r) {
		throw new Error(`${cell.name}: no ${what}`);
	}
	return [r.cx, r.cy];
}

/** The pointer on the page's left margin, beside the cell: over no control. */
async function park(cell) {
	const origin = await frameOrigin();
	const box = await rectOf(cell, 'box');
	await move(origin.x + 4, box ? box.y + 4 : origin.y + 4);
}
/** The catalogue's tab is the chosen one: another tab (Home) can come forward during a run, and its page then lies
 * over the catalogue's at the same place. */
async function ensureShown() {
	const state = await page.evaluate(`(() => { const tabs = [...document.querySelectorAll('.tabs-container .tab')]; const ours = tabs.find(t => (t.getAttribute('aria-label') || '').startsWith('Control catalogue')); if (!ours) { return null; } const r = ours.getBoundingClientRect(); return { active: ours.classList.contains('active'), x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }; })()`);
	if (!state) {
		throw new Error('the control catalogue\'s tab is gone');
	}
	if (!state.active && state.w) {
		await clickAt(state.x, state.y);
		await sleep(800);
	}
}
/** Before each cell: menus and dialogs closed, the catalogue on show, the focus on the page, the pointer on the margin. */
async function reset(cell) {
	await key('Escape');
	await sleep(80);
	await key('Escape');
	await sleep(120);
	await ensureShown();
	// The page shows the cell (scrolling is no state: nothing in the cell is touched). Its top 48 px below the page's top,
	// clear of the desk's hairline over the webview's first row: the catalogue lays out in whole pixels, so every cell
	// lands on whole device pixels wherever the rows above it end, and a row added above moves no cell's anti-aliasing
	await frame.read(`const box = d.querySelector('[data-cell=${JSON.stringify(cell.name)}]'); const view = d.defaultView; view.scrollTo(0, Math.max(0, Math.round(box.getBoundingClientRect().top + view.scrollY) - 48)); return true;`);
	await sleep(150);
	const origin = await frameOrigin();
	const box = await rectOf(cell, 'box');
	await clickAt(origin.x + 4, box ? box.y + 4 : origin.y + 4);
	await sleep(120);
}
async function tabs(count) {
	for (let n = 0; n < count; n++) {
		await key('Tab');
		await sleep(90);
	}
}
async function startThenTab(cell) {
	await clickAt(...(await centre(cell, 'start')));
	await sleep(80);
	await tabs(cell.tabs);
}
async function open(cell) {
	const [x, y] = await centre(cell, 'target');
	await clickAt(x, y, cell.rightClick ? 'right' : 'left');
	await sleep(350);
}

/** Reaches the cell's state with real input; returns what to do after the capture, if anything. */
async function reach(cell) {
	switch (cell.state) {
		case 'hover':
			await move(...(await centre(cell, 'target')));
			return null;
		case 'pressed': {
			const [x, y] = await centre(cell, 'target');
			await press(x, y);
			return async () => {
				const origin = await frameOrigin();
				await move(origin.x + 4, y, 1);
				await release(origin.x + 4, y);
			};
		}
		case 'focus':
		case 'focus-caret':
			await startThenTab(cell);
			return null;
		case 'click':
			await clickAt(...(await centre(cell, 'target')));
			if (cell.closeOutside) {
				// A Select's click opens its list; a click on the page's margin closes it, as a person would
				await sleep(350);
				const origin = await frameOrigin();
				const box = await rectOf(cell, 'box');
				await clickAt(origin.x + 4, box.y + 4);
			}
			await park(cell);
			return null;
		case 'open':
			await open(cell);
			await park(cell);
			return null;
		case 'mouse-pick':
			await open(cell);
			await clickAt(...(await centre(cell, 'item')));
			await park(cell);
			return null;
		case 'escape':
			await open(cell);
			await park(cell);
			await key('Escape');
			return null;
		case 'key-pick':
			await startThenTab(cell);
			await key('Enter');
			await sleep(350);
			await key('ArrowDown');
			await sleep(90);
			await key('Enter');
			return null;
		case 'item-hover':
		case 'submenu':
			await open(cell);
			await move(...(await centre(cell, 'item')));
			return null;
		case 'item-key':
			if (cell.rightClick) {
				await open(cell);
			} else {
				await startThenTab(cell);
				await key('Enter');
				await sleep(350);
			}
			await key('ArrowDown');
			return null;
		case 'close-hover':
		case 'button-hover':
			await open(cell);
			await park(cell);
			await move(...(await centre(cell, 'item')));
			return null;
		case 'close-focus':
		case 'button-focus':
			await open(cell);
			await park(cell);
			await tabs(cell.tabs);
			return null;
		default: // rest, disabled, busy, on, filled, long, narrow: props, at rest
			await park(cell);
			return null;
	}
}

// The window's pixel ratio at the start: a capture at another ratio (a display that slept or a window moved to another
// screen) would compare as a different image, so it fails that state with the reason instead
const RATIO = await page.evaluate('devicePixelRatio');
async function capture(cell, file) {
	const ratio = await page.evaluate('devicePixelRatio');
	if (ratio !== RATIO) {
		throw new Error(`the window's pixel ratio is ${ratio}, not ${RATIO}: a display slept or the window moved`);
	}
	const r = await rectOf(cell, cell.capture === 'dialog' ? 'dialog' : 'box');
	if (!r) {
		throw new Error(`${cell.name}: nothing to capture`);
	}
	// The dialog's own box: round it, the blurred page under the scrim changes with whatever the page shows behind it
	const pad = 0;
	const { data } = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: r.x - pad, y: r.y - pad, width: r.w + pad * 2, height: r.h + pad * 2, scale: 1 } });
	writeFileSync(join(out, file), Buffer.from(data, 'base64'));
}

// ── The run ───────────────────────────────────────────────────────────────────
const failures = [];
for (const name of themes) {
	await theme(name);
	// Every cell mounted afresh: a run starts from controls no one has touched
	await frame.read(`d.querySelector('[data-redraw]').scrollIntoView({ block: 'center' }); return true;`);
	await sleep(200);
	const redraw = await frame.read(`const b = d.querySelector('[data-redraw]').getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2];`);
	const origin = await frameOrigin();
	await clickAt(origin.x + redraw[0], origin.y + redraw[1]);
	await sleep(800);
	for (const cell of cells) {
		const file = `${name}-${cell.name}.png`;
		rmSync(join(out, file), { force: true }); // a capture left by an earlier run never stands in for this one
		let after = null;
		try {
			await reset(cell);
			after = await reach(cell);
			await sleep(SETTLE_MS);
			await capture(cell, file);
		} catch (error) {
			failures.push(`${file}: ${error.message}`);
			console.log(`FAILED   ${file}: ${error.message}`);
		} finally {
			// A held press is released whatever happened, so it never carries into the next cell
			if (after) {
				await after().catch(() => {});
			}
		}
	}
	console.log(`captured ${cells.length} cells in ${THEME_LABEL[name]}`);
}
await key('Escape');
await theme('light').catch(error => console.warn(`could not switch back to Ritemark Light: ${error.message}`));
await page.send('Emulation.clearDeviceMetricsOverride');

// The sheet: the captures as the catalogue's grid, for the Experience lead's approval
const escapeHtml = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const groups = [];
for (const cell of cells) {
	let group = groups.find(g => g.row === cell.row && g.variant === cell.variant);
	if (!group) {
		group = { row: cell.row, rowTitle: cell.rowTitle, variant: cell.variant, cells: [] };
		groups.push(group);
	}
	group.cells.push(cell);
}
const sheetFor = name => groups.map((group, index) => `${index === 0 || groups[index - 1].row !== group.row ? `<h2>${escapeHtml(group.rowTitle)}</h2>` : ''}
<h3>${escapeHtml(group.variant)}</h3><div class="cells">${group.cells.map(cell => `<figure><figcaption>${escapeHtml(cell.caption)}</figcaption>${existsSync(join(out, `${name}-${cell.name}.png`)) ? `<img src="${name}-${cell.name}.png" onload="this.style.width = this.naturalWidth / 2 + 'px'">` : '<p>not captured</p>'}<figcaption class="file">${escapeHtml(cell.name)}</figcaption></figure>`).join('')}</div>`).join('\n');
writeFileSync(join(out, 'sheet.html'), `<!doctype html><meta charset="utf-8"><title>Control catalogue: the states</title>
<style>body{font:13px/1.4 -apple-system,'Segoe UI',sans-serif;margin:24px;background:#F1F5F9;color:#1E1B4B}h1{font-size:18px}h2{font-size:15px;margin:28px 0 6px}h3{font-size:12px;color:#617187;margin:10px 0 4px;font-weight:500}.cells{display:flex;flex-wrap:wrap;gap:12px}figure{margin:0}img{display:block;border:1px solid #CBD5E1}figcaption{font-size:11px;color:#617187}.file{color:#94A3B8}.themes{display:grid;grid-template-columns:1fr 1fr;gap:32px}</style>
<h1>Control catalogue: every state, at device pixels</h1>
<p>Each image is one cell of the catalogue, reached with real input. The Experience lead approves each one once, in both themes.</p>
<div class="themes">${themes.map(name => `<section><h1>${THEME_LABEL[name]}</h1>${sheetFor(name)}</section>`).join('')}</div>`);
console.log(`written ${join(out, 'sheet.html')}`);

// The comparison, inside the running instance: decode both, count the pixels that differ, draw them in red
let differing = 0;
if (baseline) {
	const rows = [];
	for (const name of themes) {
		for (const cell of cells) {
			const file = `${name}-${cell.name}.png`;
			const nowPath = join(out, file);
			const thenPath = join(baseline, file);
			if (!existsSync(nowPath)) {
				differing++;
				console.log(`MISSING  ${file}: not captured`);
				continue;
			}
			const now = readFileSync(nowPath).toString('base64');
			if (!existsSync(thenPath)) {
				differing++;
				console.log(`NEW      ${file}: no approved image`);
				rows.push({ file, missing: true, now });
				continue;
			}
			const then = readFileSync(thenPath).toString('base64');
			const result = await page.evaluate(`(async () => {
				const load = data => { const binary = atob(data); const bytes = new Uint8Array(binary.length); for (let i = 0; i < binary.length; i++) { bytes[i] = binary.charCodeAt(i); } return createImageBitmap(new Blob([bytes], { type: 'image/png' })); };
				const [a, b] = await Promise.all([load(${JSON.stringify(then)}), load(${JSON.stringify(now)})]);
				if (a.width !== b.width || a.height !== b.height) { return { size: [a.width, a.height, b.width, b.height] }; }
				const pixels = image => { const canvas = new OffscreenCanvas(image.width, image.height); const context = canvas.getContext('2d'); context.drawImage(image, 0, 0); return context.getImageData(0, 0, image.width, image.height); };
				const pa = pixels(a), pb = pixels(b);
				const diff = new OffscreenCanvas(a.width, a.height); const context = diff.getContext('2d'); const image = context.createImageData(a.width, a.height);
				let changed = 0;
				for (let i = 0; i < pa.data.length; i += 4) {
					const delta = Math.abs(pa.data[i] - pb.data[i]) + Math.abs(pa.data[i + 1] - pb.data[i + 1]) + Math.abs(pa.data[i + 2] - pb.data[i + 2]);
					if (delta > ${PIXEL_DELTA}) { changed++; image.data.set([220, 38, 38, 255], i); } else { const grey = (pb.data[i] + pb.data[i + 1] + pb.data[i + 2]) / 3; image.data.set([grey, grey, grey, 40], i); }
				}
				context.putImageData(image, 0, 0);
				const blob = await diff.convertToBlob({ type: 'image/png' });
				const bytes = new Uint8Array(await blob.arrayBuffer()); let binary = ''; for (let i = 0; i < bytes.length; i += 32768) { binary += String.fromCharCode(...bytes.subarray(i, i + 32768)); }
				return { share: changed / (pa.data.length / 4), diff: btoa(binary) };
			})()`);
			if (result.size) {
				differing++;
				console.log(`SIZE     ${file}: approved ${result.size[0]}x${result.size[1]}, now ${result.size[2]}x${result.size[3]}`);
				rows.push({ file, missing: true, now });
				continue;
			}
			const differs = result.share > STATE_SHARE;
			if (differs) {
				differing++;
				const percent = Math.round(result.share * 10000) / 100;
				console.log(`DIFFERS  ${file}: ${percent}% of pixels changed`);
				rows.push({ file, percent, then, now, diff: result.diff });
			}
		}
	}
	const image = data => `<img src="data:image/png;base64,${data}" onload="this.style.width = this.naturalWidth / 2 + 'px'">`;
	writeFileSync(join(out, 'compare.html'), `<!doctype html><meta charset="utf-8"><title>Control states compared</title>
<style>body{font:14px/1.4 -apple-system,'Segoe UI',sans-serif;margin:24px;background:#F1F5F9;color:#1E1B4B}h2{font-size:15px;margin:24px 0 8px}div{display:flex;gap:12px;align-items:flex-start}img{border:1px solid #E2E8F0;background:#fff}span{color:#617187}</style>
<h1>Control states: approved, now, difference</h1>
${rows.length ? '' : '<p>Every state matches its approved image.</p>'}
${rows.map(row => `<h2>${escapeHtml(row.file)} <span>${row.missing ? 'no approved image of this size' : `${row.percent}% changed`}</span></h2><div>${row.missing ? image(row.now) : image(row.then) + image(row.now) + image(row.diff)}</div>`).join('\n')}`);
	console.log(`written ${join(out, 'compare.html')}`);
}

for (const failure of failures) {
	console.log(`not captured: ${failure}`);
}
const bad = differing + (baseline ? 0 : failures.length);
console.log(baseline
	? `${differing} of ${cells.length * themes.length} states differ from their approved image or have none`
	: `${cells.length * themes.length - failures.length} states captured, ${failures.length} not`);
page.close();
frame.close();
process.exit(bad ? 1 : 0);
