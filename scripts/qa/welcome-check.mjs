#!/usr/bin/env node
/**
 * welcome-check.mjs - check the welcome in a running window (Sprint 133, E3).
 *
 * Usage: node scripts/qa/welcome-check.mjs --port <cdp-port> --expect <alone|landing|update>
 *          [--usage on|off|default] [--placeholder "<text>"] [--out <file.json>]
 *
 * Connects over the Chrome DevTools Protocol to a Ritemark dev instance started with
 * --remote-debugging-port (`open -n -g`, an isolated --user-data-dir; never Jarmo's own profile) and
 * checks the window against the sprint's spec:
 *   alone    the welcome alone on the ground (R1, S1, S48): no columns, tabs or status bar; the sheet
 *            640 wide and centred; no Getting Started page (R12)
 *   update   the update welcome (R10, S33): alone, "Welcome to Ritemark 2.0", the switch as --usage says
 *            (on: 1.x's OK carried over; off: 1.x's Opt Out; default: no answer, on by default since 19 October)
 *   landing  after the landing (R6, S21): Documents and the AI's sheet open, the welcome gone, the empty
 *            desk's three tiles; with --placeholder, the AI's message box says it
 * Every check prints PASS, FAIL or SKIP; the exit code is the number of failures.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => {
	const index = args.indexOf(`--${name}`);
	return index === -1 ? fallback : args[index + 1];
};
const port = option('port');
const expect = option('expect');
const usage = option('usage');
const placeholder = option('placeholder');
const out = option('out');
if (!port || !['alone', 'landing', 'update'].includes(expect)) {
	console.error('usage: node scripts/qa/welcome-check.mjs --port <cdp-port> --expect <alone|landing|update> [--usage on|off|default] [--placeholder "<text>"] [--out <file.json>]');
	process.exit(2);
}

async function evaluate(target, expression) {
	const socket = new WebSocket(target.webSocketDebuggerUrl);
	await new Promise((resolve, reject) => {
		socket.addEventListener('open', resolve, { once: true });
		socket.addEventListener('error', reject, { once: true });
	});
	try {
		return await new Promise((resolve, reject) => {
			socket.addEventListener('message', event => {
				const message = JSON.parse(event.data);
				if (message.id === 1) {
					message.error || message.result.exceptionDetails ? reject(new Error(JSON.stringify(message.error ?? message.result.exceptionDetails))) : resolve(message.result.result.value);
				}
			});
			socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
		});
	} finally {
		socket.close();
	}
}

/** Run an expression in the first webview whose page matches the selector; `doc` is that page's document. */
async function inWebview(targets, selector, body) {
	for (const target of targets.filter(t => t.type === 'iframe')) {
		const value = await evaluate(target, `(() => {
			const frame = document.getElementById('active-frame');
			const doc = frame && frame.contentDocument;
			if (!doc || !doc.querySelector(${JSON.stringify(selector)})) { return undefined; }
			const win = frame.contentWindow;
			${body}
		})()`).catch(() => undefined);
		if (value !== undefined) {
			return value;
		}
	}
	return undefined;
}

const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = targets.find(target => target.type === 'page' && target.url.includes('workbench'));
if (!page) {
	console.error(`no workbench page on port ${port}`);
	process.exit(2);
}

const workbench = await evaluate(page, `(() => {
	const box = element => { if (!element) { return null; } const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
	const wb = document.querySelector('.monaco-workbench');
	const visible = element => !!element && getComputedStyle(element).visibility !== 'hidden' && element.offsetParent !== null;
	return {
		window: { w: innerWidth, h: innerHeight },
		alone: wb.classList.contains('ritemark-welcome-alone'),
		nosidebar: wb.classList.contains('nosidebar'),
		noauxiliarybar: wb.classList.contains('noauxiliarybar'),
		statusbarVisible: visible(document.querySelector('.part.statusbar')),
		visibleTabs: [...document.querySelectorAll('.tabs-container > .tab')].filter(visible).map(t => t.getAttribute('aria-label')),
		tabs: [...document.querySelectorAll('.tabs-container > .tab')].map(t => t.getAttribute('aria-label')),
		gettingStarted: !!document.querySelector('.gettingStartedContainer'),
		editor: box(document.querySelector('.part.editor .editor-container')),
		emptyDeskTiles: [...document.querySelectorAll('.ritemark-empty-desk-tile')].filter(visible).map(t => t.querySelector('b')?.textContent),
		explorerVisible: visible(document.querySelector('.part.sidebar .explorer-folders-view')),
		auxiliaryVisible: visible(document.querySelector('.part.auxiliarybar')),
	};
})()`);

const welcome = await inWebview(targets, '.rw-sheet', `
	const r = doc.querySelector('.rw-sheet').getBoundingClientRect();
	const sw = doc.querySelector('.rw-usage [role=switch]');
	return { sheet: { x: r.x, y: r.y, w: r.width, h: r.height }, frameWidth: win.innerWidth, title: doc.querySelector('h1')?.textContent ?? null,
		usage: sw ? sw.getAttribute('aria-checked') : null, usageWords: doc.querySelector('#rw-usage-words')?.textContent ?? null };
`);
const composer = placeholder ? await inWebview(targets, 'textarea', `return doc.querySelector('textarea').getAttribute('placeholder');`) : undefined;

const results = [];
const check = (name, ok, actual, expected) => results.push({ name, result: ok === null ? 'SKIP' : ok ? 'PASS' : 'FAIL', actual, expected });

check('R12 no Getting Started page', !workbench.gettingStarted, workbench.gettingStarted, false);
if (expect === 'alone' || expect === 'update') {
	check('R1 the welcome is alone (class)', workbench.alone, workbench.alone, true);
	check('R1 both columns closed', workbench.nosidebar && workbench.noauxiliarybar, `${workbench.nosidebar}/${workbench.noauxiliarybar}`, 'true/true');
	check('R1 no status bar', !workbench.statusbarVisible, workbench.statusbarVisible, false);
	check('R1 no tabs drawn', workbench.visibleTabs.length === 0, workbench.visibleTabs.join(', '), '(none)');
	check('R1 the welcome page is open', !!welcome, !!welcome, true);
	if (welcome) {
		check('R1 the sheet is 640 wide', Math.abs(welcome.sheet.w - 640) <= 1, welcome.sheet.w, 640);
		const sheetCentre = welcome.sheet.x + welcome.sheet.w / 2;
		check('R1 the sheet is centred', Math.abs(sheetCentre - welcome.frameWidth / 2) <= 1, Math.round(sheetCentre), welcome.frameWidth / 2);
	}
}
if (expect === 'update') {
	check('R10 "Welcome to Ritemark 2.0"', welcome?.title === 'Welcome to Ritemark 2.0', welcome?.title, 'Welcome to Ritemark 2.0');
	if (usage) {
		const checked = usage === 'off' ? 'false' : 'true';
		check(`R7 the switch is ${usage}`, welcome?.usage === checked, welcome?.usage, checked);
		const words = usage === 'on' ? 'On, as you chose in Ritemark 1. Never your documents, chats or names.'
			: usage === 'default' ? 'On. Anonymous: never your documents, chats or names. You can turn it off here or in Settings.'
			: 'Off. Turn it on to share anonymous usage data. Never your documents, chats or names.';
		check('R7 the switch\'s words', welcome?.usageWords === words, welcome?.usageWords, words);
	}
}
if (expect === 'landing') {
	check('R6 the welcome is gone', !welcome && !workbench.alone, !!welcome, false);
	check('R6 Documents is open', workbench.explorerVisible, workbench.explorerVisible, true);
	check('R6 the AI\'s sheet is open', workbench.auxiliaryVisible, workbench.auxiliaryVisible, true);
	const tiles = workbench.emptyDeskTiles.join(', ');
	check('R6 the empty desk offers Text, Table and Web page', workbench.tabs.length > 0 ? null : tiles === 'Text, Table, Web page', tiles, 'Text, Table, Web page');
	if (placeholder) {
		check('R6 the message box', composer === placeholder, composer, placeholder);
	}
}

const failures = results.filter(r => r.result === 'FAIL').length;
for (const r of results) {
	console.log(`${r.result.padEnd(4)}  ${r.name}${r.result === 'PASS' ? '' : `: measured ${r.actual}, expected ${r.expected}`}`);
}
console.log(`\nwelcome (${expect}): ${results.filter(r => r.result === 'PASS').length} pass, ${failures} fail, ${results.filter(r => r.result === 'SKIP').length} skipped (window ${workbench.window.w}x${workbench.window.h})`);
if (out) {
	mkdirSync(dirname(out), { recursive: true });
	writeFileSync(out, JSON.stringify({ expect, workbench, welcome, composer, results }, null, '\t') + '\n');
}
process.exit(failures);
