#!/usr/bin/env node
/**
 * welcome-screenshots.mjs - capture the welcome's frames, light and dark (Sprint 133, E3).
 *
 * Usage: node scripts/qa/welcome-screenshots.mjs --port <cdp-port> --out <dir> --scene <name>
 *          [--then-skip] [--size 1440x900]
 *
 * Connects over CDP to a Ritemark dev instance (`open -n -g`, an isolated --user-data-dir; never Jarmo's own
 * profile) that shows the welcome, lays the page out at --size, and captures the sheet in Ritemark Light and
 * Ritemark Dark as <out>/<theme>-welcome-<scene>.png. With --then-skip (a fresh profile on step 1), it presses
 * Skip for now afterwards and captures step 2 as <theme>-welcome-step-2.png. The run leaves the window in
 * Ritemark Light.
 *
 * The welcome's scenes in the frame baseline (docs/development/frame-baseline):
 *   step-1, step-2   a fresh profile, no folder (--scene step-1 --then-skip)
 *   update-on        a v1.14.0 profile whose notice was answered OK (--scene update-on)
 *   update-off       a v1.14.0 profile that opted out (--scene update-off)
 *   start            a finished profile's new window with no folder (--scene start)
 * Compare with the baseline by eye or with frame-screenshots.mjs's compare page; the welcome's provider rows
 * depend on what this computer is signed in to, so a capture is checked against the baseline, not diffed to 0.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => {
	const index = args.indexOf(`--${name}`);
	return index === -1 ? fallback : args[index + 1];
};
const port = option('port');
const out = option('out');
const scene = option('scene');
const thenSkip = args.includes('--then-skip');
const [width, height] = option('size', '1440x900').split('x').map(Number);
if (!port || !out || !scene) {
	console.error('usage: node scripts/qa/welcome-screenshots.mjs --port <cdp-port> --out <dir> --scene <name> [--then-skip] [--size 1440x900]');
	process.exit(2);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function connect(target) {
	const socket = new WebSocket(target.webSocketDebuggerUrl);
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
	return { send, evaluate, close: () => socket.close() };
}

const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const pageTarget = targets.find(target => target.type === 'page' && target.url.includes('workbench'));
if (!pageTarget) {
	console.error(`no workbench page on port ${port}`);
	process.exit(2);
}
const page = await connect(pageTarget);
await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 0, mobile: false });
await sleep(1500);
const MOD = (await page.evaluate(`document.querySelector('.monaco-workbench').classList.contains('mac')`)) ? 4 : 2;

async function key(code, modifiers = 0, keyName = code.replace(/^Key/, '').toLowerCase()) {
	const virtualKey = { Escape: 27, Enter: 13 }[code] ?? keyName.toUpperCase().charCodeAt(0);
	await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', modifiers, code, key: keyName, windowsVirtualKeyCode: virtualKey });
	await page.send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers, code, key: keyName, windowsVirtualKeyCode: virtualKey });
}

async function pickRow(label) {
	const centre = await page.evaluate(`(() => { const row = [...document.querySelectorAll('.quick-input-widget .quick-input-list .monaco-list-row')].find(r => { const aria = r.getAttribute('aria-label') || ''; return aria === ${JSON.stringify(label)} || aria.startsWith(${JSON.stringify(label + ',')}); }); if (!row) { return null; } const b = row.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; })()`);
	if (!centre) {
		throw new Error(`no row "${label}"`);
	}
	for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
		await page.send('Input.dispatchMouseEvent', { type, x: centre[0], y: centre[1], button: 'left', clickCount: 1 });
	}
}

async function theme(name) {
	await key('KeyP', MOD | 8, 'p');
	await sleep(600);
	await page.send('Input.insertText', { text: 'Preferences: Color Theme' });
	await sleep(900);
	await pickRow('Preferences: Color Theme');
	await sleep(1200);
	await page.send('Input.insertText', { text: name });
	await sleep(900);
	await pickRow(name);
	await sleep(2000);
}

async function capture(name) {
	await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 600 });
	await sleep(1200);
	const { w, h, ratio } = await page.evaluate(`({ w: innerWidth, h: innerHeight, ratio: devicePixelRatio })`);
	const { data } = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: w, height: h, scale: 1 / ratio } });
	writeFileSync(join(out, `${name}.png`), Buffer.from(data, 'base64'));
	console.log(`captured ${name} (${w}x${h})`);
}

/** Press the welcome's Skip for now, inside its webview. */
async function skip() {
	for (const target of (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).filter(t => t.type === 'iframe')) {
		const frame = await connect(target);
		try {
			const done = await frame.evaluate(`(() => { const d = document.getElementById('active-frame')?.contentDocument; const b = d && [...d.querySelectorAll('button')].find(x => x.textContent.trim() === 'Skip for now'); if (!b) { return false; } b.click(); return true; })()`).catch(() => false);
			if (done) {
				return;
			}
		} finally {
			frame.close();
		}
	}
	throw new Error('no Skip for now on the page');
}

mkdirSync(out, { recursive: true });
const order = thenSkip ? [['Ritemark Light', 'light'], ['Ritemark Dark', 'dark']] : [['Ritemark Light', 'light'], ['Ritemark Dark', 'dark']];
for (const [themeName, prefix] of order) {
	await theme(themeName);
	await capture(`${prefix}-welcome-${scene}`);
}
if (thenSkip) {
	await skip();
	await sleep(1200);
	await capture('dark-welcome-step-2');
	await theme('Ritemark Light');
	await capture('light-welcome-step-2');
} else {
	await theme('Ritemark Light');
}
await page.send('Emulation.clearDeviceMetricsOverride');
page.close();
