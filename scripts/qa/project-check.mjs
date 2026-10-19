#!/usr/bin/env node
/**
 * project-check.mjs - check the project at the centre in a running window (Sprint 134, E3).
 *
 * Usage: node scripts/qa/project-check.mjs --port <cdp-port> [--user-data-dir <dir>] [--close-all]
 *          [--switch-to <folder name>] [--share-question] [--board-off]
 *
 * Connects over the Chrome DevTools Protocol to a Ritemark dev instance started with --remote-debugging-port (see
 * .claude/skills/ritemark-automation; launch it with `open -n -g` and an isolated --user-data-dir, never on Jarmo's
 * own profile) with a project open, and checks:
 *
 * - Home and Tasks: the first two tabs are Home and the Task board, pinned (R5; Home alone with --board-off). Run it
 *   after a fresh window, after a restart and, with --close-all, after View: Close All Editors (S18–S20).
 * - The count: the Tasks tab's count is the Tasks place's (R6, S8).
 * - The splash (with --user-data-dir): the colours saved for the next window's splash are the window's ground, so a
 *   switch shows the ground, not a dark block (R9, S30).
 * - Switching (with --switch-to): File ▸ Open Recent to that folder switches in place onto its Home, which says
 *   "Switched to …" (S32); Open Recent back restores the first project's tabs in their order (R9, S30). Nothing may
 *   be working in a chat, or Ritemark asks.
 * - The share question (with --share-question): a page served by this script, opened from Browser's New page, asks on
 *   the AI's sheet, and while it waits the tab row works: Home comes forward and the + opens its menu (R20, S55, #455).
 *   On a profile that shares pages without asking, the question does not come and the check is SKIPPED.
 *
 * Every check prints PASS, FAIL or SKIP with what it saw; the exit code is the number of failures. Each step that
 * changes the window says so; the window is left on the first project, with Home in front.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'node:http';

const args = process.argv.slice(2);
const option = (name, fallback) => {
	const index = args.indexOf(`--${name}`);
	return index === -1 ? fallback : args[index + 1];
};
const flag = name => args.includes(`--${name}`);
const port = option('port');
const userDataDir = option('user-data-dir');
const switchTo = option('switch-to');
const boardOff = flag('board-off');
if (!port) {
	console.error('usage: node scripts/qa/project-check.mjs --port <cdp-port> [--user-data-dir <dir>] [--close-all] [--switch-to <folder name>] [--share-question] [--board-off]');
	process.exit(2);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// ── One CDP session on the workbench page, made again after a reload ──

let socket;
let nextId = 0;
const pending = new Map();

async function connect(titleIncludes) {
	for (let tries = 0; tries < 60; tries++) {
		try {
			const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
			const page = list.find(target => target.type === 'page' && target.url.includes('workbench') && (!titleIncludes || target.title.includes(titleIncludes)));
			if (page) {
				socket?.close();
				socket = new WebSocket(page.webSocketDebuggerUrl);
				await new Promise((resolve, reject) => {
					socket.addEventListener('open', resolve, { once: true });
					socket.addEventListener('error', reject, { once: true });
				});
				socket.addEventListener('message', event => {
					const message = JSON.parse(event.data);
					if (message.id && pending.has(message.id)) {
						const { resolve, reject } = pending.get(message.id);
						pending.delete(message.id);
						message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
					}
				});
				// The workbench is ready when its tab row is drawn
				for (let wait = 0; wait < 40; wait++) {
					if (await evaluate(`!!document.querySelector('.part.editor .tabs-container > .tab')`).catch(() => false)) {
						return page.title;
					}
					await sleep(500);
				}
				return page.title;
			}
		} catch {
			// the page is reloading
		}
		await sleep(500);
	}
	throw new Error(`no workbench page${titleIncludes ? ` titled "…${titleIncludes}…"` : ''} on port ${port}`);
}

const send = (method, params = {}) => new Promise((resolve, reject) => {
	const id = ++nextId;
	pending.set(id, { resolve, reject });
	socket.send(JSON.stringify({ id, method, params }));
});
async function evaluate(expression) {
	const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
	if (exceptionDetails) {
		throw new Error(JSON.stringify(exceptionDetails));
	}
	return result.value;
}

let MOD = 4;
async function key(code, modifiers = 0, keyName = code.replace(/^Key/, '').toLowerCase()) {
	const virtualKey = { Escape: 27, Enter: 13 }[code] ?? keyName.toUpperCase().charCodeAt(0);
	await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', modifiers, code, key: keyName, windowsVirtualKeyCode: virtualKey });
	await send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers, code, key: keyName, windowsVirtualKeyCode: virtualKey });
}
async function clickAt(x, y) {
	await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
	await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
	await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}
async function click(what, elementExpression) {
	const centre = await evaluate(`(() => { const element = ${elementExpression}; if (!element) { return null; } const r = element.getBoundingClientRect(); return r.width ? [r.x + r.width / 2, r.y + r.height / 2] : null; })()`);
	if (!centre) {
		throw new Error(`nothing to click: ${what}`);
	}
	await clickAt(...centre);
}
async function pickRow(label) {
	await click(`the row "${label}"`, `[...document.querySelectorAll('.quick-input-widget .quick-input-list .monaco-list-row')].find(row => { const aria = row.getAttribute('aria-label') || ''; return aria === ${JSON.stringify(label)} || aria.startsWith(${JSON.stringify(label + ',')}) || aria.startsWith(${JSON.stringify(label + ' ')}); })`);
}
/**
 * Types only where it means to. After a reload the AI's sheet can take the focus a moment later, and text typed
 * there followed by Enter is a message to the AI: so text and Enter go only to a focused quick pick (or, for the
 * browser's address, a focused input on the desk), never into a webview. Anything else stops the run.
 */
const FOCUS = `(() => { const element = document.activeElement; if (!element || element.tagName === 'IFRAME' || element.closest('.webview, .part.auxiliarybar')) { return 'elsewhere'; } if (element.closest('.quick-input-widget') && element.tagName === 'INPUT') { return 'quick-input'; } if (element.tagName === 'INPUT' && element.closest('.part.editor')) { return 'desk-input'; } return 'elsewhere'; })()`;
async function typeInto(where, text, enter = false) {
	for (let wait = 0; wait < 10 && await evaluate(FOCUS) !== where; wait++) {
		await sleep(300);
	}
	const focus = await evaluate(FOCUS);
	if (focus !== where) {
		throw new Error(`stopped before typing "${text}": the focus is ${focus}, not the ${where}`);
	}
	await send('Input.insertText', { text });
	if (enter) {
		await sleep(900);
		if (await evaluate(FOCUS) !== where) {
			throw new Error(`stopped before Enter after "${text}": the focus left the ${where}`);
		}
		await key('Enter', 0, 'Enter');
	}
}
async function command(label) {
	await key('KeyP', MOD | 8, 'p');
	await sleep(600);
	await typeInto('quick-input', label);
	await sleep(900);
	await pickRow(label);
	await sleep(1200);
}

/** The first line of text in any webview (the AI's sheet, Home) that contains `needle`, or null. */
async function webviewLine(needle) {
	const frames = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
	for (const frame of frames.filter(target => target.type === 'iframe')) {
		const probe = new WebSocket(frame.webSocketDebuggerUrl);
		try {
			await new Promise((resolve, reject) => { probe.addEventListener('open', resolve, { once: true }); probe.addEventListener('error', reject, { once: true }); });
			const line = await new Promise(resolve => {
				probe.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.id === 1) { resolve(message.result?.result?.value ?? null); } });
				probe.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { returnByValue: true, expression: `[document, ...[...document.querySelectorAll('iframe')].map(f => { try { return f.contentDocument; } catch { return null; } })].flatMap(d => (d?.body?.innerText ?? '').split('\\n')).find(line => line.includes(${JSON.stringify(needle)})) ?? null` } }));
				setTimeout(() => resolve(null), 1500);
			});
			if (line) {
				return line;
			}
		} catch {
			// a frame that went away
		} finally {
			probe.close();
		}
	}
	return null;
}

// ── What the checks read ──

const TABS = `[...document.querySelectorAll('.part.editor .editor-group-container')].filter(group => group.offsetParent)[0]?.querySelectorAll('.tabs-container > .tab') ?? []`;
const tabs = () => evaluate(`[...${TABS}].map(tab => ({ label: tab.getAttribute('aria-label') || '', active: tab.classList.contains('active'), count: tab.querySelector(':scope > .ritemark-tab-count')?.textContent ?? null }))`);
const tasksPlaceCount = () => evaluate(`(() => { const item = [...document.querySelectorAll('.part.sidebar > .header-or-footer .composite-bar .action-item')].find(item => (item.querySelector('.action-label')?.getAttribute('aria-label') || '').startsWith('Tasks')); if (!item) { return undefined; } const badge = item.querySelector('.badge .badge-content'); return badge && badge.offsetParent && badge.textContent ? badge.textContent : null; })()`);

const results = [];
function check(name, ok, seen, expected) {
	const result = ok === null ? 'SKIP' : ok ? 'PASS' : 'FAIL';
	results.push({ name, result });
	console.log(`${result.padEnd(4)}  ${name}: ${seen}${ok === false && expected ? ` (expected ${expected})` : ''}`);
}

async function checkPermanent(when) {
	const row = await tabs();
	const first = row[0]?.label ?? '(none)';
	const second = row[1]?.label ?? '(none)';
	const homeFirst = first.startsWith('Home, pinned');
	if (boardOff) {
		const anyBoard = row.some(tab => tab.label.startsWith('Task board'));
		check(`Home alone first ${when}`, homeFirst && !anyBoard, `first "${first}", ${anyBoard ? 'a Task board tab' : 'no Task board tab'}`, 'Home, pinned, and no Task board');
	} else {
		check(`Home and Tasks first ${when}`, homeFirst && second.startsWith('Task board, pinned'), `"${first}", "${second}"`, '"Home, pinned…", "Task board, pinned…"');
	}
	return row;
}

// ── The run ──

await connect();
MOD = await evaluate(`document.querySelector('.monaco-workbench').classList.contains('mac')`) ? 4 : 2;
await key('Escape', 0, 'Escape');

const startTitle = await evaluate('document.title');
const before = await checkPermanent('now');

// The count
if (boardOff) {
	check('the Tasks tab\'s count is the place\'s', null, 'the board is off');
} else {
	const board = before.find(tab => tab.label.startsWith('Task board'));
	const place = await tasksPlaceCount();
	if (place === undefined) {
		check('the Tasks tab\'s count is the place\'s', false, 'no Tasks place in the places row');
	} else {
		const tab = board?.count ?? null;
		check('the Tasks tab\'s count is the place\'s', tab === place, `tab ${tab ?? 'none'}, place ${place ?? 'none'}`);
	}
}

// The splash
if (userDataDir) {
	try {
		const stored = JSON.parse(readFileSync(join(userDataDir, 'User', 'globalStorage', 'storage.json'), 'utf8'));
		const ground = (await evaluate(`getComputedStyle(document.querySelector('.monaco-workbench')).getPropertyValue('--vscode-ritemark-ground').trim()`)).toLowerCase();
		const splash = stored.windowSplash?.colorInfo ?? {};
		const saved = [stored.themeBackground, splash.background, splash.editorBackground].map(value => (value ?? '').toLowerCase());
		check('the splash is the ground', !!ground && saved.every(value => value.startsWith(ground.slice(0, 7))), `ground ${ground || 'unknown'}; saved ${saved.join(', ')}`);
	} catch (error) {
		check('the splash is the ground', false, `could not read the profile's storage.json: ${error.message}`);
	}
} else {
	check('the splash is the ground', null, 'needs --user-data-dir');
}

// Close all
if (flag('close-all')) {
	console.log('…  View: Close All Editors (closes this window\'s documents)');
	await command('View: Close All Editors');
	await sleep(1500);
	const after = await checkPermanent('after Close all');
	check('Close all leaves only Home and Tasks', after.length === (boardOff ? 1 : 2), `${after.length} tabs: ${after.map(tab => `"${tab.label}"`).join(', ')}`);
}

// Switching both ways
if (switchTo) {
	const order = (await tabs()).map(tab => tab.label.replace(/, (pinned|preview|modified).*$/, ''));
	const here = startTitle.split(' — ').pop();
	console.log(`…  File ▸ Open Recent → ${switchTo}`);
	await command('File: Open Recent...');
	await typeInto('quick-input', switchTo, true);
	const there = await connect(switchTo);
	await sleep(2500); // the permanent tabs' check runs after the restore
	const landed = await tabs();
	check(`switched in place to ${switchTo}`, there.includes(switchTo) && landed[0]?.label.startsWith('Home') && (landed.find(tab => tab.active)?.label ?? '').startsWith('Home'), `title "${there}", in front "${landed.find(tab => tab.active)?.label ?? '(none)'}"`, `${switchTo}'s Home in front`);
	await checkPermanent(`in ${switchTo}`);
	let note = null;
	for (let wait = 0; wait < 10 && !note; wait++) {
		note = await webviewLine('is kept as you left it');
		if (!note) {
			await sleep(500);
		}
	}
	check('Home says where it switched from, after Open Recent', note?.startsWith('Switched to ') ?? false, note ? `"${note}"` : 'no note on Home', '"Switched to … is kept as you left it."');
	console.log(`…  File ▸ Open Recent → ${here}`);
	await sleep(3000); // the AI's sheet restores its chat after the reload, and may take the focus once
	await command('File: Open Recent...');
	await typeInto('quick-input', here, true);
	const back = await connect(here);
	await sleep(2500);
	const restored = (await tabs()).map(tab => tab.label.replace(/, (pinned|preview|modified).*$/, ''));
	check(`back in ${here}, its tabs as they were`, back.includes(here) && JSON.stringify(restored) === JSON.stringify(order), `${restored.length} tabs${JSON.stringify(restored) === JSON.stringify(order) ? ', same order' : `: ${restored.join(' | ')}`}`, order.join(' | '));
}

// The share question while the tab row works
if (flag('share-question')) {
	const server = createServer((request, response) => {
		response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
		response.end('<!doctype html><title>Project check page</title><h1>Project check page</h1><p>A page served by project-check.mjs.</p>');
	});
	await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
	const url = `http://127.0.0.1:${server.address().port}/`;
	console.log(`…  Browser ▸ New page → ${url}`);
	await command('Ritemark Browser: New Browser Tab');
	await sleep(1500);
	// The address field shows as text until it is clicked, as a person would
	await click('the address', `[...document.querySelectorAll('.part.editor .editor-group-container.active .browser-url-display, .part.editor .editor-group-container.active .browser-url-input')].find(element => element.getBoundingClientRect().width)`);
	await sleep(500);
	await typeInto('desk-input', url, true);
	// The question is drawn in the AI's sheet, a webview
	let asked = false;
	for (let wait = 0; wait < 20 && !asked; wait++) {
		await sleep(500);
		asked = (await webviewLine('Share this page with')) !== null;
	}
	if (!asked) {
		check('the tab row works while the share question waits', null, 'no question came: this profile shares pages without asking, or the page did not load');
	} else {
		await click('Home\'s tab', `[...${TABS}].find(tab => (tab.getAttribute('aria-label') || '').startsWith('Home'))`);
		await sleep(800);
		const homeInFront = ((await tabs()).find(tab => tab.active)?.label ?? '').startsWith('Home');
		await click('the +', `document.querySelector('.part.editor .ritemark-new-tab')`);
		await sleep(800);
		const menuOpen = await evaluate(`!!document.querySelector('.context-view .ritemark-new-tab-menu')`);
		await key('Escape', 0, 'Escape');
		check('the tab row works while the share question waits', homeInFront && menuOpen, `Home came forward: ${homeInFront}; the +'s menu opened: ${menuOpen}`);
	}
	// Close the page's tab
	await click('the page\'s tab', `[...${TABS}].find(tab => (tab.getAttribute('aria-label') || '').includes('Project check page') || (tab.getAttribute('aria-label') || '').includes('127.0.0.1'))`).catch(() => { });
	await sleep(500);
	await key('KeyW', MOD, 'w');
	server.close();
}

// Leave the window on Home
await click('Home\'s tab', `[...${TABS}].find(tab => (tab.getAttribute('aria-label') || '').startsWith('Home'))`).catch(() => { });
socket.close();
const failures = results.filter(result => result.result === 'FAIL').length;
console.log(`\n${results.length} checks: ${results.filter(result => result.result === 'PASS').length} pass, ${failures} fail, ${results.filter(result => result.result === 'SKIP').length} skipped`);
process.exit(failures);
