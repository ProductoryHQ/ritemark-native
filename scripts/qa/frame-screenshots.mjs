#!/usr/bin/env node
/**
 * frame-screenshots.mjs - capture Ritemark 2.0's frame in fixed scenes, light and dark (Sprint 132, E3).
 *
 * Usage: node scripts/qa/frame-screenshots.mjs --port <cdp-port> --out <dir> [--size 1440x900] [--compare <baseline-dir>]
 *
 * Connects over the Chrome DevTools Protocol to a Ritemark dev instance started with --remote-debugging-port
 * (see .claude/skills/ritemark-automation; launch it with `open -n -g` and an isolated --user-data-dir, never on
 * Jarmo's own profile), with the sample project open: a folder of Markdown documents. For the baseline, use a
 * fresh profile and zoom level 0. The page is laid out at --size (1440 x 900 unless given) for the whole run, whatever
 * the window's own size, so captures from different screens compare.
 *
 * It drives the window as a person would (the command palette by its exact row, the strip's toggles, the + and
 * More) and captures each scene in Ritemark Light and Ritemark Dark as <out>/<theme>-<scene>.png, at the page's
 * CSS size. The run leaves the window in Ritemark Light with one desk.
 *
 * With --compare, each capture is compared with the same file in <baseline-dir> inside the running instance (no
 * image library needed): the share of pixels that differ is printed per scene, and <out>/compare.html shows the
 * baseline, the capture and their difference side by side. The exit code is the number of scenes that differ by
 * more than 0.5% or are missing from the baseline.
 *
 * The set approved at merge 2 is the baseline for the later steps of 2.0 and for update-vscode.sh's checklist.
 *
 * Sprint 134 (E3) adds the project at the centre: Home with the projects list, the head's Switch project flyout, the
 * Tasks, Browser, Transcribe and Agents places with their heads, the foot of Ritemark Settings, and the share question
 * on the AI's sheet for a page this script serves itself. What moved needs a Ritemark 1 profile and is not a scene. A
 * project window now opens on Home, so the run first chooses Documents, where the base scene's document is opened.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => {
	const index = args.indexOf(`--${name}`);
	return index === -1 ? fallback : args[index + 1];
};
const port = option('port');
const out = option('out');
const baseline = option('compare');
const [width, height] = option('size', '1440x900').split('x').map(Number);
if (!port || !out) {
	console.error('usage: node scripts/qa/frame-screenshots.mjs --port <cdp-port> --out <dir> [--size 1440x900] [--compare <baseline-dir>]');
	process.exit(2);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// One CDP session on the workbench page
const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = list.find(target => target.type === 'page' && target.url.includes('workbench'));
if (!page) {
	console.error(`no workbench page on port ${port}`);
	process.exit(2);
}
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
	socket.addEventListener('open', resolve, { once: true });
	socket.addEventListener('error', reject, { once: true });
});
let nextId = 0;
const pending = new Map();
socket.addEventListener('message', event => {
	const message = JSON.parse(event.data);
	if (message.id && pending.has(message.id)) {
		const { resolve, reject } = pending.get(message.id);
		pending.delete(message.id);
		message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
	}
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
	const id = ++nextId;
	pending.set(id, { resolve, reject });
	socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
	const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
	if (exceptionDetails) {
		throw new Error(JSON.stringify(exceptionDetails));
	}
	return result.value;
};

await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 0, mobile: false });
await sleep(1500);
const isMac = await evaluate(`document.querySelector('.monaco-workbench').classList.contains('mac')`);
const MOD = isMac ? 4 : 2; // CDP modifiers: 2 Ctrl, 4 Meta, 8 Shift

async function key(code, modifiers = 0, keyName = code.replace(/^Key/, '').toLowerCase()) {
	const virtualKey = { Escape: 27, Enter: 13, Backquote: 192, Comma: 188, End: 35 }[code] ?? keyName.toUpperCase().charCodeAt(0);
	await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', modifiers, code, key: keyName, windowsVirtualKeyCode: virtualKey });
	await send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers, code, key: keyName, windowsVirtualKeyCode: virtualKey });
}

async function clickAt(x, y) {
	await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
	await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
	await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}

/** Clicks the first visible element the expression returns; fails the run if there is none. */
async function click(what, elementExpression) {
	const centre = await evaluate(`(() => { const element = ${elementExpression}; if (!element) { return null; } const r = element.getBoundingClientRect(); return r.width ? [r.x + r.width / 2, r.y + r.height / 2] : null; })()`);
	if (!centre) {
		throw new Error(`nothing to click: ${what}`);
	}
	await clickAt(...centre);
}

const byLabel = (selector, label) => `[...document.querySelectorAll(${JSON.stringify(selector)})].find(element => element.getBoundingClientRect().width && (element.getAttribute('aria-label') || '').startsWith(${JSON.stringify(label)}))`;

/**
 * Picks a quick pick's row by its exact label (never a near match). The list can take a moment to fill (VS Code 1.142's
 * palette lists more rows than 1.117's), so it waits up to 5 seconds for the row before it fails the run.
 */
async function pickRow(label) {
	const row = `[...document.querySelectorAll('.quick-input-widget .quick-input-list .monaco-list-row')].find(row => { const aria = row.getAttribute('aria-label') || ''; return aria === ${JSON.stringify(label)} || aria.startsWith(${JSON.stringify(label + ',')}); })`;
	for (let waited = 0; waited < 5000 && !(await evaluate(`!!(${row})?.getBoundingClientRect().width`)); waited += 250) {
		await sleep(250);
	}
	await click(`the row "${label}"`, row);
}

async function type(text) {
	await send('Input.insertText', { text });
}

async function command(label) {
	await key('KeyP', MOD | 8, 'p');
	await sleep(600);
	// In a background window, the key can go nowhere right after a new desk's document takes focus (seen on
	// VS Code 1.142): then put focus on the status bar, as a click anywhere would, and press again
	if (!(await evaluate(`document.querySelector('.quick-input-widget')?.style.display !== 'none'`))) {
		const bar = await evaluate(`(() => { const r = document.querySelector('.part.statusbar')?.getBoundingClientRect(); return r ? [r.x + r.width / 2, r.y + r.height / 2] : null; })()`);
		if (bar) {
			await clickAt(...bar);
			await sleep(300);
		}
		await key('KeyP', MOD | 8, 'p');
		await sleep(600);
	}
	await type(label);
	await sleep(900);
	await pickRow(label);
	await sleep(1200);
}

async function theme(name) {
	await command('Preferences: Color Theme');
	await type(name);
	await sleep(900);
	await pickRow(name);
	await sleep(2000);
}

/**
 * What a webview shows (a document, Ritemark Settings, the AI's sheet): each one is a frame of its own, reached
 * through the debugging port's list. Runs `expression` (with `doc`, the frame's document) in the first frame whose
 * text has `text`, and returns its value, or undefined when no frame has the text.
 */
async function inWebview(text, expression = 'true') {
	const targets = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).filter(target => target.type === 'iframe');
	for (const target of targets) {
		const frame = new WebSocket(target.webSocketDebuggerUrl);
		try {
			await new Promise((resolve, reject) => { frame.addEventListener('open', resolve, { once: true }); frame.addEventListener('error', reject, { once: true }); });
			const value = await new Promise(resolve => {
				frame.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.id === 1) { resolve(message.result?.result?.value); } });
				frame.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { returnByValue: true, expression: `(() => { const doc = [document, ...[...document.querySelectorAll('iframe')].map(f => { try { return f.contentDocument; } catch { return null; } })].find(d => d?.body?.innerText.includes(${JSON.stringify(text)})); return doc ? (${expression}) : undefined; })()` } }));
				setTimeout(() => resolve(undefined), 1500);
			});
			if (value !== undefined) {
				return value;
			}
		} catch {
			// a frame that went away
		} finally {
			frame.close();
		}
	}
	return undefined;
}

async function capture(name) {
	// A webview keeps the hover it last saw until the pointer moves inside it again: the document's block handle (+ ⋮⋮)
	// can stay beside a line. The pointer passes over an empty corner of the desk first, then rests off every control.
	const corner = await evaluate(`(() => { const r = document.querySelector('.part.editor').getBoundingClientRect(); return [r.right - 40, r.bottom - 40]; })()`);
	await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: corner[0], y: corner[1] });
	await sleep(300);
	await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 600 }); // the pointer off every control, on the left column's edge
	// The keyboard out of the AI's sheet: a scene that leaves it there (a webview taking the focus as it closes) would
	// draw the sheet's + with its tooltip and focus ring, which no scene is about
	await evaluate(`(() => { const element = document.activeElement; if (element && element.closest('.part.auxiliarybar')) { element.blur(); } })()`);
	// From VS Code 1.142 a tooltip of the sheet's own (the + "New conversation") can stay open with neither focus nor
	// hover, once a synthetic pointer passed it: close a tooltip left open in the AI's sheet, as Escape would
	await inWebview('interacting with AI', `(() => { if (!doc.querySelector('[role=tooltip]')) { return false; } doc.activeElement?.blur?.(); doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })); return true; })()`);
	await sleep(1200);
	const { w, h, ratio } = await evaluate(`({ w: innerWidth, h: innerHeight, ratio: devicePixelRatio })`);
	const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: w, height: h, scale: 1 / ratio } });
	writeFileSync(join(out, `${name}.png`), Buffer.from(data, 'base64'));
	console.log(`captured ${name} (${w}x${h})`);
}

const placeLabel = name => byLabel('.part.sidebar .composite-bar .action-item .action-label', name);
async function place(name) {
	await click(`the ${name} place`, placeLabel(name));
	await sleep(1800);
}

// Sprint 134: a project window opens on Home; the base scene is Documents with a document in front
await place('Documents');

const DOCUMENTS = `[...document.querySelectorAll('.part.sidebar .explorer-folders-view .monaco-list-row')].map(row => row.getAttribute('aria-label') || '').filter(label => /\\.md\\b/.test(label)).map(label => label.split(',')[0])`;
const documents = await evaluate(DOCUMENTS);
if (!documents.length) {
	console.error('no Markdown documents at the top of the tree: open the sample project first');
	process.exit(2);
}

async function openDocument(label) {
	await click(`the document ${label}`, byLabel('.part.sidebar .explorer-folders-view .monaco-list-row', label));
	await sleep(1500);
}

/** Back to the base: Documents chosen, the first document in front. */
async function backToBase() {
	await place('Documents');
	await openDocument(documents[0]);
}

/** A page for the share question, served by this run on this computer (no network, the same every time). */
const pageServer = createServer((request, response) => {
	response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
	response.end('<!doctype html><title>Harbour Logistics</title><body style="font:16px/1.5 -apple-system,sans-serif;margin:48px"><h1>Harbour Logistics</h1><p>Six one-day modules for twelve new shift leaders.</p></body>');
});
// A fixed port, so the address bar reads the same in every run (any free one if it is taken)
await new Promise(resolve => {
	pageServer.once('error', () => pageServer.listen(0, '127.0.0.1', resolve));
	pageServer.listen(47134, '127.0.0.1', resolve);
});
const pageUrl = `http://127.0.0.1:${pageServer.address().port}/`;

const LEFT_TOGGLE = byLabel('a.ritemark-frame-button', 'Show or Hide the Left Column');
const AI_TOGGLE = byLabel('a.ritemark-frame-button', 'Show or Hide the AI');

/** Each scene sets itself up from the base window and leaves it as it found it. */
const SCENES = [
	['base', async () => { }],
	['two-desks', async () => {
		await command('View: Split Editor Right');
		await sleep(2500);
		// Close the new desk (a pinned Task board cannot be joined into it, R9)
		return async () => command('View: Close Editor Group');
	}],
	['left-hidden', async () => {
		await click('the left column\'s toggle', LEFT_TOGGLE);
		return async () => click('the left column\'s toggle', LEFT_TOGGLE);
	}],
	['ai-hidden', async () => {
		await click('the AI\'s toggle', AI_TOGGLE);
		return async () => click('the AI\'s toggle', AI_TOGGLE);
	}],
	['both-hidden', async () => {
		await click('the left column\'s toggle', LEFT_TOGGLE);
		await sleep(500);
		await click('the AI\'s toggle', AI_TOGGLE);
		return async () => {
			await click('the left column\'s toggle', LEFT_TOGGLE);
			await sleep(500);
			await click('the AI\'s toggle', AI_TOGGLE);
		};
	}],
	['new-tab-menu', async () => {
		await click('the +', `document.querySelector('.part.editor .ritemark-new-tab')`);
		return async () => key('Escape', 0, 'Escape');
	}],
	['more-menu', async () => {
		await click('More', byLabel('.part.sidebar .composite-bar .action-item .action-label', 'More'));
		return async () => key('Escape', 0, 'Escape');
	}],
	['terminal', async () => {
		await key('Backquote', 2, '`'); // Ctrl+` on every platform (⌃` on the Mac)
		await sleep(2500);
		// The new terminal's tab is in front. Once (Sprint 134's second baseline run) the Task board was in front
		// instead, and could not be reproduced: say so loudly, and bring the terminal forward so the scene stays true.
		const TERMINAL_TAB = `[...document.querySelectorAll('.part.editor .tabs-container > .tab')].find(tab => /^(Terminal|zsh|bash|fish|pwsh|powershell)\\b/i.test(tab.getAttribute('aria-label') || ''))`;
		if (!await evaluate(`${TERMINAL_TAB}?.classList.contains('active') ?? false`)) {
			console.log(`NOTE     the terminal's tab was not in front after Ctrl+\` (in front: ${await evaluate(`document.querySelector('.part.editor .tabs-container > .tab.active')?.getAttribute('aria-label') ?? 'none'`)}); bringing it forward`);
			await click('the terminal\'s tab', TERMINAL_TAB);
			await sleep(1000);
		}
		// The scene is the terminal's tab and bar. Its text (the shell's prompt, with the computer's and the account's
		// names, and the first-run hint) differs from machine to machine, so it is blanked while the scene is taken.
		await evaluate(`(() => { const style = document.createElement('style'); style.id = 'frame-screenshots-terminal'; style.textContent = '.part.editor .xterm-screen { visibility: hidden !important; }'; document.head.append(style); })()`);
		return async () => {
			await evaluate(`document.getElementById('frame-screenshots-terminal')?.remove()`);
			// Close the terminal by its own tab: ⌘W would close whatever is in front
			await click('the terminal tab\'s close button', `${TERMINAL_TAB}?.querySelector('.tab-actions .action-label')`);
		};
	}],
	// Sprint 134: the project at the centre
	['home', async () => {
		await place('Home');
		return backToBase;
	}],
	['switcher', async () => {
		await click('the project\'s head', `document.querySelector('.part.sidebar .ritemark-project-head')`);
		await sleep(800);
		await click('Switch project', `[...document.querySelectorAll('.ritemark-menu-item')].find(row => row.getAttribute('aria-label') === 'Switch project')`);
		await sleep(1200);
		return async () => {
			await key('Escape', 0, 'Escape');
			await sleep(300);
			await key('Escape', 0, 'Escape');
		};
	}],
	...['Tasks', 'Browser', 'Transcribe', 'Agents'].map(name => [name.toLowerCase(), async () => {
		await place(name);
		return backToBase;
	}]),
	['settings-foot', async () => {
		await key('Comma', MOD, ',');
		// Wait for the page to be drawn whole, its components' readiness settled (no "Checking"), so its height is the
		// same in every run; then scroll it to its foot, where Advanced settings is (R23)
		let settled = false;
		for (let wait = 0; wait < 30 && !settled; wait++) {
			await sleep(500);
			settled = await inWebview('Advanced settings', `!doc.body.innerText.includes('Checking')`) === true;
		}
		if (!settled) {
			throw new Error('Ritemark Settings did not settle (Advanced settings drawn, nothing "Checking")');
		}
		const centre = await evaluate(`(() => { const r = document.querySelector('.part.editor .editor-container').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
		for (let i = 0; i < 12; i++) {
			await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: centre[0], y: centre[1], deltaX: 0, deltaY: 2000 });
			await sleep(100);
		}
		await sleep(800);
		const inView = await inWebview('Advanced settings', `(() => { const link = [...doc.querySelectorAll('a, button')].find(element => element.textContent.trim() === 'Advanced settings'); const r = link?.getBoundingClientRect(); return !!r && r.bottom <= doc.defaultView.innerHeight && r.top >= 0; })()`);
		if (!inView) {
			throw new Error('Advanced settings is not in view after scrolling Ritemark Settings to its foot');
		}
		return async () => key('KeyW', MOD, 'w');
	}],
	['share-question', async () => {
		await command('Ritemark Browser: New Browser Tab');
		await sleep(1500);
		await click('the address', `[...document.querySelectorAll('.part.editor .editor-group-container.active .browser-url-display, .part.editor .editor-group-container.active .browser-url-input')].find(element => element.getBoundingClientRect().width)`);
		await sleep(500);
		// VS Code 1.117 focused an input; from 1.142 a click on the address opens a picker (a quick input) with the
		// address selected, and typing replaces it
		const focused = await evaluate(`(() => { const active = document.activeElement; return !!active && (active.classList.contains('browser-url-input') || active.classList.contains('browser-url-display') || !!active.closest('.quick-input-widget')); })()`);
		if (!focused) {
			throw new Error('the browser\'s address did not take the keyboard');
		}
		await type(pageUrl);
		await key('Enter', 0, 'Enter');
		await sleep(4000);
		return async () => key('KeyW', MOD, 'w');
	}],
	['many-tabs', async () => {
		// Open the folders, so there are enough documents to fold the row
		for (let folder; (folder = await evaluate(`[...document.querySelectorAll('.part.sidebar .explorer-folders-view .monaco-list-row[aria-expanded="false"]')].map(row => (row.getAttribute('aria-label') || '').split(',')[0])[0] || null`));) {
			await click(`the folder ${folder}`, byLabel('.part.sidebar .explorer-folders-view .monaco-list-row', folder));
			await sleep(600);
		}
		const all = await evaluate(DOCUMENTS);
		for (const label of all.slice(0, 12)) {
			await openDocument(label);
		}
		await openDocument(documents[0]);
		return async () => {
			await command('View: Close Other Editors in Group');
			await command('Collapse Folders in Explorer');
		};
	}],
];

mkdirSync(out, { recursive: true });
await command('Notifications: Clear All Notifications'); // a fresh profile's notices would cover the corner
await openDocument(documents[0]);
for (const themeName of ['Ritemark Light', 'Ritemark Dark']) {
	await theme(themeName);
	const prefix = themeName === 'Ritemark Light' ? 'light' : 'dark';
	for (const [scene, setUp] of SCENES) {
		const restore = await setUp();
		await sleep(1500);
		await capture(`${prefix}-${scene}`);
		if (restore) {
			await restore();
			await sleep(1200);
		}
	}
}
await theme('Ritemark Light');
await send('Emulation.clearDeviceMetricsOverride');
pageServer.close();

let differing = 0;
if (baseline) {
	const rows = [];
	for (const themeName of ['light', 'dark']) {
		for (const [scene] of SCENES) {
			const name = `${themeName}-${scene}`;
			const before = join(baseline, `${name}.png`);
			const now = readFileSync(join(out, `${name}.png`)).toString('base64');
			if (!existsSync(before)) {
				console.log(`MISSING  ${name}: not in the baseline`);
				differing++;
				rows.push({ name, missing: true, now });
				continue;
			}
			const then = readFileSync(before).toString('base64');
			// Compare in the page: decode both, count the pixels that differ, draw them in red over a faint copy
			const result = await evaluate(`(async () => {
				const load = data => { const binary = atob(data); const bytes = new Uint8Array(binary.length); for (let i = 0; i < binary.length; i++) { bytes[i] = binary.charCodeAt(i); } return createImageBitmap(new Blob([bytes], { type: 'image/png' })); };
				const [a, b] = await Promise.all([load(${JSON.stringify(then)}), load(${JSON.stringify(now)})]);
				if (a.width !== b.width || a.height !== b.height) { return { size: [a.width, a.height, b.width, b.height] }; }
				const pixels = image => { const canvas = new OffscreenCanvas(image.width, image.height); const context = canvas.getContext('2d'); context.drawImage(image, 0, 0); return context.getImageData(0, 0, image.width, image.height); };
				const pa = pixels(a), pb = pixels(b);
				const diff = new OffscreenCanvas(a.width, a.height); const context = diff.getContext('2d'); const image = context.createImageData(a.width, a.height);
				let changed = 0;
				for (let i = 0; i < pa.data.length; i += 4) {
					const delta = Math.abs(pa.data[i] - pb.data[i]) + Math.abs(pa.data[i + 1] - pb.data[i + 1]) + Math.abs(pa.data[i + 2] - pb.data[i + 2]);
					if (delta > 24) { changed++; image.data.set([220, 38, 38, 255], i); } else { const grey = (pb.data[i] + pb.data[i + 1] + pb.data[i + 2]) / 3; image.data.set([grey, grey, grey, 40], i); }
				}
				context.putImageData(image, 0, 0);
				const blob = await diff.convertToBlob({ type: 'image/png' });
				const bytes = new Uint8Array(await blob.arrayBuffer()); let binary = ''; for (let i = 0; i < bytes.length; i += 32768) { binary += String.fromCharCode(...bytes.subarray(i, i + 32768)); }
				return { share: changed / (pa.data.length / 4), diff: btoa(binary) };
			})()`);
			if (result.size) {
				console.log(`SIZE     ${name}: baseline ${result.size[0]}x${result.size[1]}, now ${result.size[2]}x${result.size[3]}`);
				differing++;
				rows.push({ name, missing: true, now });
				continue;
			}
			const percent = Math.round(result.share * 10000) / 100;
			const differs = percent > 0.5;
			differing += differs ? 1 : 0;
			console.log(`${differs ? 'DIFFERS' : 'SAME   '}  ${name}: ${percent}% of pixels changed`);
			rows.push({ name, percent, then, now, diff: result.diff });
		}
	}
	const image = data => `<img src="data:image/png;base64,${data}">`;
	writeFileSync(join(out, 'compare.html'), `<!doctype html><meta charset="utf-8"><title>Frame screenshots compared</title>
<style>body{font:14px/1.4 -apple-system,'Segoe UI',sans-serif;margin:24px;background:#F1F5F9;color:#1E1B4B}h2{font-size:15px;margin:24px 0 8px}div{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}img{width:100%;border:1px solid #E2E8F0;background:#fff}span{color:#617187}</style>
<h1>Frame screenshots: baseline, now, difference</h1>
${rows.map(row => `<h2>${row.name} <span>${row.missing ? 'not in the baseline' : `${row.percent}% changed`}</span></h2><div>${row.missing ? `<p></p>${image(row.now)}<p></p>` : image(row.then) + image(row.now) + image(row.diff)}</div>`).join('\n')}`);
	console.log(`\n${differing} of ${rows.length} scenes differ; written ${join(out, 'compare.html')}`);
}

socket.close();
process.exit(differing);
