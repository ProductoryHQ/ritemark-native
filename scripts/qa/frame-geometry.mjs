#!/usr/bin/env node
/**
 * frame-geometry.mjs - measure Ritemark 2.0's frame in a running window (Sprint 132, E3).
 *
 * Usage: node scripts/qa/frame-geometry.mjs --port <cdp-port> [--label <name>] [--out <file.json>]
 *
 * Connects over the Chrome DevTools Protocol to a Ritemark dev instance that was started with
 * --remote-debugging-port (see .claude/skills/ritemark-automation; launch it with `open -n -g` and
 * an isolated --user-data-dir, never on Jarmo's own profile), reads the frame's boxes from the DOM
 * of the main window, and checks them against the numbers in the sprint's spec (R1, R5, R7, R10) and
 * the Experience lead's kit (ritemark-dev: product/design/experience/kit/ritemark.css,
 * surfaces/README.md "Measurements").
 *
 * Every check prints PASS or FAIL with the measured and expected values; the exit code is the number
 * of failures (0 when all pass). With --out, the measurements and results are written as JSON.
 * Checks that need a state the window is not in (a hidden column, no open document) are SKIPPED.
 *
 * Numbers are CSS pixels at zoom level 0. The traffic lights and Windows' buttons are drawn by the
 * system, outside the page, so the strip's line is checked through the page's own controls.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => {
	const index = args.indexOf(`--${name}`);
	return index === -1 ? fallback : args[index + 1];
};
const port = option('port');
const label = option('label', 'frame');
const out = option('out');
if (!port) {
	console.error('usage: node scripts/qa/frame-geometry.mjs --port <cdp-port> [--label <name>] [--out <file.json>]');
	process.exit(2);
}

// What runs in the page: read every box the checks need, in one pass.
const MEASURE = `(() => {
	const box = element => {
		if (!element) { return null; }
		const r = element.getBoundingClientRect();
		if (!r.width && !r.height) { return null; }
		return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
	};
	const all = selector => [...document.querySelectorAll(selector)];
	const workbench = document.querySelector('.monaco-workbench');
	const visibleTabs = all('.part.editor .editor-group-container .tabs-container > .tab').filter(tab => tab.offsetParent && !tab.classList.contains('ritemark-folded'));
	const editorGroups = all('.part.editor .editor-group-container').filter(group => group.offsetParent);
	return {
		window: { w: innerWidth, h: innerHeight, zoom: getComputedStyle(document.querySelector('.part.editor')).getPropertyValue('--ritemark-zoom-factor').trim() || '1' },
		classes: { nosidebar: workbench.classList.contains('nosidebar'), noauxiliarybar: workbench.classList.contains('noauxiliarybar'), mac: workbench.classList.contains('mac'), windows: workbench.classList.contains('windows') },
		titlebarShown: !!box(document.querySelector('.part.titlebar')),
		sidebar: box(document.querySelector('.part.sidebar')),
		auxiliarybar: box(document.querySelector('.part.auxiliarybar')),
		aiContent: box(document.querySelector('.part.auxiliarybar > .content')),
		editor: box(document.querySelector('.part.editor')),
		statusbar: box(document.querySelector('.part.statusbar')),
		leftStrip: box(document.querySelector('.part.sidebar > .ritemark-frame-strip')),
		leftToggle: box(document.querySelector('.part.sidebar > .ritemark-frame-strip a.ritemark-frame-button')),
		aiToggle: box(document.querySelector('.part.auxiliarybar > .ritemark-frame-strip a.ritemark-frame-button')),
		you: box(document.querySelector('.part.auxiliarybar > .ritemark-frame-strip a.ritemark-you')),
		deskLeftStrip: box(document.querySelector('.part.editor > .ritemark-frame-strip.on-desk.left')),
		deskLeftToggle: box(document.querySelector('.part.editor > .ritemark-frame-strip.on-desk.left a.ritemark-frame-button')),
		deskAiToggle: box(document.querySelector('.part.editor > .ritemark-frame-strip.on-desk.right a.ritemark-frame-button')),
		deskYou: box(document.querySelector('.part.editor > .ritemark-frame-strip.on-desk.right a.ritemark-you')),
		deskRightStrip: box(document.querySelector('.part.editor > .ritemark-frame-strip.on-desk.right')),
		desks: editorGroups.map(group => ({ group: box(group), sheet: box(group.querySelector(':scope > .editor-container')), title: box(group.querySelector(':scope > .title .tabs-and-actions-container')) })),
		tabs: visibleTabs.map(tab => ({ ...box(tab), active: tab.classList.contains('active'), sticky: tab.classList.contains('sticky-compact'), label: box(tab.querySelector('.label-name')) })),
		newTab: box(document.querySelector('.ritemark-new-tab')),
		folded: box(document.querySelector('.ritemark-more-tabs')),
		places: all('.part.sidebar > .header-or-footer .composite-bar .action-item').map(item => ({ ...box(item), fill: box(item), label: item.querySelector('.action-label')?.getAttribute('aria-label') })),
		projectHead: box(document.querySelector('.part.sidebar .ritemark-project-head')),
		projectRows: all('.part.sidebar > .ritemark-project-rows .ritemark-project-row').map(box),
		documentsLabel: box(document.querySelector('.part.sidebar > .ritemark-project-rows .ritemark-project-group')),
		treeRows: all('.part.sidebar .explorer-folders-view .monaco-list-row').map(box).filter(Boolean),
	};
})()`;

async function measure() {
	const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
	const page = list.find(target => target.type === 'page' && target.url.includes('workbench'));
	if (!page) {
		throw new Error(`no workbench page on port ${port}`);
	}
	const socket = new WebSocket(page.webSocketDebuggerUrl);
	await new Promise((resolve, reject) => {
		socket.addEventListener('open', resolve, { once: true });
		socket.addEventListener('error', reject, { once: true });
	});
	const result = await new Promise((resolve, reject) => {
		socket.addEventListener('message', event => {
			const message = JSON.parse(event.data);
			if (message.id === 1) {
				message.error || message.result.exceptionDetails ? reject(new Error(JSON.stringify(message.error ?? message.result.exceptionDetails))) : resolve(message.result.result.value);
			}
		});
		socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: MEASURE, returnByValue: true } }));
	});
	socket.close();
	return result;
}

const m = await measure();
const results = [];
const near = (actual, expected, tolerance = 1) => typeof actual === 'number' && Math.abs(actual - expected) <= tolerance;
const check = (name, ok, actual, expected) => results.push({ name, result: ok === null ? 'SKIP' : ok ? 'PASS' : 'FAIL', actual, expected });
const round = value => typeof value === 'number' ? Math.round(value * 10) / 10 : value;

const STRIP = 44;
const LINE = 26;
const GAP = 8;
const STATUS = 24;
const deskBottom = m.window.h - STATUS - GAP;

// R1: no title row; the strip and its one line
check('R1 the main window has no title row', !m.titlebarShown, m.titlebarShown, false);
check('R1 the left strip is 44 high', m.leftStrip ? near(m.leftStrip.h, STRIP) : null, round(m.leftStrip?.h), STRIP);
check('R1 the left toggle sits on the line (26)', m.leftToggle ? near(m.leftToggle.cy, LINE) : null, round(m.leftToggle?.cy), LINE);
check('R1 the AI toggle sits on the line (26)', m.aiToggle ? near(m.aiToggle.cy, LINE) : null, round(m.aiToggle?.cy), LINE);
check('R11 You sits on the line (26)', m.you ? near(m.you.cy, LINE) : null, round(m.you?.cy), LINE);
check('R11 You is a 28 circle', m.you ? near(m.you.w, 28) && near(m.you.h, 28) : null, m.you && `${round(m.you.w)}x${round(m.you.h)}`, '28x28');
check('R11 You ends 8 from the window\'s right edge (the Mac)', m.you && m.classes.mac ? near(m.you.right, m.window.w - GAP) : null, round(m.you?.right), m.window.w - GAP);
for (const [index, tab] of m.tabs.entries()) {
	check(`R7 tab ${index + 1} is 36 high from 8`, near(tab.y, 8) && near(tab.h, 36), `${round(tab.y)}+${round(tab.h)}`, '8+36');
	check(`R1 tab ${index + 1}'s label sits on the line (26)`, tab.label ? near(tab.label.cy, LINE, 1.5) : null, round(tab.label?.cy), LINE);
	if (!tab.sticky) {
		check(`R7 tab ${index + 1} is 120 to 200 wide`, tab.w >= 119.5 && tab.w <= 200.5, round(tab.w), '120..200');
	}
}
if (m.newTab) {
	check('R7 the + sits on the line (26)', near(m.newTab.cy, LINE), round(m.newTab.cy), LINE);
}

// R1: the sheets and their gaps
const desk = m.desks[0]?.sheet;
check('R1 the desk starts at 44', desk ? near(desk.y, STRIP) : null, round(desk?.y), STRIP);
check('R1 the desk ends 8 above the status bar', desk ? near(desk.bottom, deskBottom) : null, round(desk?.bottom), deskBottom);
check('R1 the status bar is 24', m.statusbar ? near(m.statusbar.h, STATUS) : null, round(m.statusbar?.h), STATUS);
if (m.aiContent && desk && m.desks.length === 1) {
	check('R1 the AI\'s sheet starts 8 from the desk', near(m.aiContent.x - desk.right, GAP), round(m.aiContent.x - desk.right), GAP);
	check('R1 the AI\'s sheet starts at 44', near(m.aiContent.y, STRIP), round(m.aiContent.y), STRIP);
	check('R1 the AI\'s sheet ends 8 above the status bar', near(m.aiContent.bottom, deskBottom), round(m.aiContent.bottom), deskBottom);
}
if (m.classes.nosidebar && desk) {
	check('R1 with the left column hidden, the desk sits 8 from the window\'s left edge', near(desk.x, GAP), round(desk.x), GAP);
}
if (m.classes.noauxiliarybar && desk && m.desks.length === 1) {
	check('R1 with the AI hidden, the desk sits 8 from the window\'s right edge', near(m.window.w - desk.right, GAP), round(m.window.w - desk.right), GAP);
}
if (m.desks.length === 2) {
	const [a, b] = m.desks.map(d => d.sheet).sort((p, q) => p.x - q.x || p.y - q.y);
	const apart = b.x > a.right - 1 ? b.x - a.right : b.y - a.bottom;
	check('R1 two desks lie 8 apart', near(apart, GAP), round(apart), GAP);
}

// R5: the places row (in the left column, so only while it is shown)
const firstPlace = m.classes.nosidebar ? undefined : m.places[0];
check('R5 the places are 32 high', firstPlace ? near(firstPlace.h, 32) : null, round(firstPlace?.h), 32);
check('R5 the places row sits at 48 (centre 64)', firstPlace ? near(firstPlace.cy, 64) : null, round(firstPlace?.cy), 64);
check('R5 the first place\'s fill starts 8 into the column (its icon on the text edge, 16)', firstPlace && m.sidebar ? near(firstPlace.x + 1 - m.sidebar.x, 8) : null, round(firstPlace && m.sidebar ? firstPlace.x + 1 - m.sidebar.x : undefined), 8);
if (firstPlace && m.places.length > 1) {
	check('R5 places sit 34 apart (kit: ritemark.js, Ritemark.more)', near(m.places[1].x - m.places[0].x, 34), round(m.places[1].x - m.places[0].x), 34);
}
if (desk && m.tabs[0] && !m.classes.nosidebar) {
	check('R7 the tabs start 16 into the desk (kit: .tabs at 272)', near(m.tabs[0].x - desk.x, 16), round(m.tabs[0].x - desk.x), 16);
}
if (m.classes.nosidebar && m.deskLeftStrip && m.tabs[0]) {
	check('R1 with the left column hidden, its controls sit on the desk\'s strip and the tabs start after them', m.tabs[0].x >= m.deskLeftStrip.right - 0.5, round(m.tabs[0].x), `>= ${round(m.deskLeftStrip.right)}`);
}
for (const [name, control] of [['left toggle', m.deskLeftToggle], ['AI toggle', m.deskAiToggle], ['You', m.deskYou]]) {
	if (control) {
		check(`R1 the desk strip's ${name} sits on the line (26)`, near(control.cy, LINE), round(control.cy), LINE);
	}
}
if (m.classes.nosidebar && m.deskLeftToggle && m.classes.mac) {
	check('R1 the left toggle keeps its place when the column hides (84, after the traffic lights)', near(m.deskLeftToggle.x, 84), round(m.deskLeftToggle.x), 84);
}
if (m.classes.noauxiliarybar && m.deskYou && m.classes.mac) {
	check('R1 You keeps its place when the AI hides (8 from the right edge)', near(m.deskYou.right, m.window.w - GAP), round(m.deskYou.right), m.window.w - GAP);
}
if (m.classes.noauxiliarybar && m.deskRightStrip) {
	const lastTab = m.tabs[m.tabs.length - 1];
	check('R1 with the AI hidden, its controls sit on the desk\'s strip and the + stops before them', m.newTab ? m.newTab.right <= m.deskRightStrip.x + 0.5 : null, round(m.newTab?.right), `<= ${round(m.deskRightStrip.x)}`);
	check('R1 ... and so do the tabs', lastTab ? lastTab.right <= m.deskRightStrip.x + 0.5 : null, round(lastTab?.right), `<= ${round(m.deskRightStrip.x)}`);
}
if (m.aiToggle && m.you) {
	check('R11 You sits 8 after the AI toggle (kit: 1368 and 1404)', near(m.you.x - m.aiToggle.right, 8), round(m.you.x - m.aiToggle.right), 8);
}

// R10: the left column's head on Documents
if (m.projectRows.length === 2 && m.documentsLabel) {
	check('R10 New at 136', near(m.projectRows[0].y, 136), round(m.projectRows[0].y), 136);
	check('R10 Search at 168', near(m.projectRows[1].y, 168), round(m.projectRows[1].y), 168);
	check('R10 Documents at 214', near(m.documentsLabel.y, 214), round(m.documentsLabel.y), 214);
	check('R10 the tree from 236', m.treeRows[0] ? near(m.treeRows[0].y, 236) : null, round(m.treeRows[0]?.y), 236);
	check('R10 the project\'s name centred at 110 (92 + 36 / 2)', m.projectHead ? near(m.projectHead.cy, 110) : null, round(m.projectHead?.cy), 110);
}
for (const [index, row] of m.treeRows.slice(0, 3).entries()) {
	check(`R1 tree row ${index + 1} is 32 high`, near(row.h, 32), round(row.h), 32);
}

const failures = results.filter(r => r.result === 'FAIL').length;
for (const r of results) {
	console.log(`${r.result.padEnd(4)}  ${r.name}${r.result === 'PASS' ? '' : `: measured ${r.actual}, expected ${r.expected}`}`);
}
console.log(`\n${label}: ${results.filter(r => r.result === 'PASS').length} pass, ${failures} fail, ${results.filter(r => r.result === 'SKIP').length} skipped (window ${m.window.w}x${m.window.h}, zoom ${m.window.zoom})`);
if (out) {
	mkdirSync(dirname(out), { recursive: true });
	writeFileSync(out, JSON.stringify({ label, measured: m, results }, null, '\t') + '\n');
	console.log(`written ${out}`);
}
process.exit(failures);
