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
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
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
	const virtualKey = { Escape: 27, Enter: 13, Backquote: 192 }[code] ?? keyName.toUpperCase().charCodeAt(0);
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

/** Picks a quick pick's row by its exact label (never a near match). */
async function pickRow(label) {
	await click(`the row "${label}"`, `[...document.querySelectorAll('.quick-input-widget .quick-input-list .monaco-list-row')].find(row => { const aria = row.getAttribute('aria-label') || ''; return aria === ${JSON.stringify(label)} || aria.startsWith(${JSON.stringify(label + ',')}); })`);
}

async function type(text) {
	await send('Input.insertText', { text });
}

async function command(label) {
	await key('KeyP', MOD | 8, 'p');
	await sleep(600);
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

async function capture(name) {
	await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 600 }); // the pointer off every control, on the left column's edge
	await sleep(1200);
	const { w, h, ratio } = await evaluate(`({ w: innerWidth, h: innerHeight, ratio: devicePixelRatio })`);
	const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: w, height: h, scale: 1 / ratio } });
	writeFileSync(join(out, `${name}.png`), Buffer.from(data, 'base64'));
	console.log(`captured ${name} (${w}x${h})`);
}

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
		// The scene is the terminal's tab and bar. Its text (the shell's prompt, with the computer's and the account's
		// names, and the first-run hint) differs from machine to machine, so it is blanked while the scene is taken.
		await evaluate(`(() => { const style = document.createElement('style'); style.id = 'frame-screenshots-terminal'; style.textContent = '.part.editor .xterm-screen { visibility: hidden !important; }'; document.head.append(style); })()`);
		return async () => {
			await evaluate(`document.getElementById('frame-screenshots-terminal')?.remove()`);
			await key('KeyW', MOD, 'w');
		};
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
