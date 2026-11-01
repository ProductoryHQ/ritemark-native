#!/usr/bin/env node
/**
 * flow-step-check.mjs - a Flow is written only by an edit, and a step without its key says so (Sprint 145, R4 #571,
 * R5 #580).
 *
 * Usage:
 *   node scripts/qa/flow-step-check.mjs --make-flow <ws>/.ritemark/flows/key-check.flow.json
 *   node scripts/qa/flow-step-check.mjs --port <cdp-port> --flow <that file> [--shots <dir>] [--edits]
 *
 * --make-flow writes the check's flow: a trigger, an AI step on OpenAI and one on Gemini, an image step on each, and a
 * Save File step (no model saved, so each runs on its default). Then start a dev instance hidden, on an isolated
 * profile with --use-mock-keychain and no keys stored, with the project and that file open (positional arguments
 * after the VS Code folder), and CDP on a port checked to be free (see .claude/skills/ritemark-automation: `open -n
 * -g -j`, scratch homes for the AIs, never Jarmo's profile). The check attaches over CDP and:
 *
 * - S29 (R4): the file's modified time is unchanged 3 s after the flow is drawn, and after each step is selected.
 * - S30-S32 (R5): each step's panel reads its key's sentence, with "Add it in Settings" as a link whose tooltip names
 *   the key (hovered); the AI steps say it too (they had no key check before Sprint 145). The OpenAI image step's
 *   model list no longer says "OpenAI API key not configured".
 * - S30, S32: the link opens Settings with that key's card at the top of the page.
 * - S33: the Google image step's sentence is Sprint 144's.
 * - S28 (with --edits, last, because it changes the flow): a step's label typed in its panel writes the file, and a
 *   step deleted from its panel writes it again.
 *
 * Screenshots go to --shots (the window with each panel, the tooltip, and Settings at each key). Every check prints
 * PASS or FAIL with what it saw; the exit code is the number of failures. The window is left open: quit it yourself.
 */

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => {
	const index = args.indexOf(`--${name}`);
	return index === -1 ? fallback : args[index + 1];
};
const flag = name => args.includes(`--${name}`);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const OPENAI = 'This step needs an OpenAI API key to run. Add it in Settings';
const GOOGLE = 'This step needs a Google AI API key to run. Add it in Settings';
const STEPS = [
	{ id: 'llm-openai', what: 'the AI step on OpenAI', sentence: OPENAI, tooltip: 'Open Settings at the OpenAI API key', section: 'openai-api-key' },
	{ id: 'llm-gemini', what: 'the AI step on Gemini', sentence: GOOGLE, tooltip: 'Open Settings at the Google AI API key', section: 'google-ai-key' },
	{ id: 'image-openai', what: 'the OpenAI image step', sentence: OPENAI, tooltip: 'Open Settings at the OpenAI API key', section: 'openai-api-key' },
	{ id: 'image-gemini', what: 'the Google image step', sentence: GOOGLE, tooltip: 'Open Settings at the Google AI API key', section: 'google-ai-key' },
];

const makeFlow = option('make-flow');
if (makeFlow) {
	const step = (id, type, y, data) => ({ id, type, position: { x: 120, y }, data });
	const llm = provider => ({ label: `Write (${provider})`, provider, model: '', systemPrompt: '', userPrompt: 'Write one line about {Topic}.', temperature: 0.7, maxTokens: 2000 });
	const image = provider => ({ label: `Picture (${provider})`, provider, model: '', prompt: 'A watercolour of {Topic}', inputImages: [], action: 'auto', inputFidelity: 'low', size: '1024x1024', quality: 'standard', style: 'natural' });
	const flow = {
		id: path.basename(makeFlow, '.flow.json'),
		name: 'Key check',
		description: 'Sprint 145 R4 and R5',
		version: 1,
		created: '2026-11-01T08:00:00.000Z',
		modified: '2026-11-01T08:00:00.000Z',
		inputs: [{ id: 'input-topic', type: 'text', label: 'Topic', required: true }],
		nodes: [
			step('trigger-1', 'trigger', 0, { label: 'Trigger', inputs: [{ id: 'input-topic', type: 'text', label: 'Topic', required: true, defaultValue: '' }] }),
			step('llm-openai', 'llm-prompt', 160, llm('openai')),
			step('llm-gemini', 'llm-prompt', 320, llm('gemini')),
			step('image-openai', 'image-prompt', 480, image('openai')),
			step('image-gemini', 'image-prompt', 640, image('gemini')),
			step('save-1', 'save-file', 800, { label: 'Save it', format: 'markdown', folder: '', filename: 'key-check.md', sourceNodeId: 'llm-openai' }),
		],
		edges: [
			{ id: 'e1', source: 'trigger-1', target: 'llm-openai' },
			{ id: 'e2', source: 'llm-openai', target: 'llm-gemini' },
			{ id: 'e3', source: 'llm-gemini', target: 'image-openai' },
			{ id: 'e4', source: 'image-openai', target: 'image-gemini' },
			{ id: 'e5', source: 'image-gemini', target: 'save-1' },
		],
	};
	fs.mkdirSync(path.dirname(makeFlow), { recursive: true });
	fs.writeFileSync(makeFlow, JSON.stringify(flow, null, 2) + '\n');
	console.log(`wrote ${makeFlow}`);
	process.exit(0);
}

const port = option('port');
const flowFile = option('flow');
const shots = option('shots');
if (!port || !flowFile) {
	console.error('usage: node scripts/qa/flow-step-check.mjs --port <cdp-port> --flow <file.flow.json> [--shots <dir>] [--edits]');
	process.exit(2);
}
if (shots) fs.mkdirSync(shots, { recursive: true });

// ── CDP ─────────────────────────────────────────────────────────────────────

async function attach(webSocketDebuggerUrl) {
	const socket = new WebSocket(webSocketDebuggerUrl);
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
		if (exceptionDetails) throw new Error(JSON.stringify(exceptionDetails));
		return result.value;
	};
	return { send, evaluate, close: () => socket.close() };
}

const targets = async () => (await fetch(`http://127.0.0.1:${port}/json/list`)).json();

/** Runs `body` with `d` (the webview's own document) and `w` (its window) in scope. */
const inFrame = body => `(() => { const af = document.getElementById('active-frame'); const d = af && af.contentDocument; const w = af && af.contentWindow; if (!d) return null; return (${body}); })()`;

/** The webview whose page has `#root[data-editor-type=<kind>]`. */
async function webview(kind, timeoutMs = 20000) {
	for (const started = Date.now(); Date.now() - started < timeoutMs; await sleep(250)) {
		for (const target of await targets()) {
			if (target.type !== 'iframe' || !target.url.startsWith('vscode-webview://')) continue;
			const session = await attach(target.webSocketDebuggerUrl).catch(() => null);
			if (!session) continue;
			const found = await session.evaluate(inFrame(`d.querySelector('#root')?.dataset.editorType ?? null`)).catch(() => null);
			if (found === kind) return { ...session, url: target.url };
			session.close();
		}
	}
	throw new Error(`no ${kind} webview within ${timeoutMs} ms`);
}

const workbenchTarget = (await targets()).find(target => target.type === 'page' && target.url.includes('workbench'));
if (!workbenchTarget) throw new Error(`no workbench page on port ${port}`);
const workbench = await attach(workbenchTarget.webSocketDebuggerUrl);

let failures = 0;
const check = (ok, name, seen) => {
	if (!ok) failures++;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${seen === undefined ? '' : ` — ${typeof seen === 'string' ? seen : JSON.stringify(seen)}`}`);
};
async function shot(name) {
	if (!shots) return;
	const { data } = await workbench.send('Page.captureScreenshot', { format: 'png' });
	const file = path.join(shots, name);
	fs.writeFileSync(file, Buffer.from(data, 'base64'));
	console.log(`     saved ${file}`);
}
const mtime = () => fs.statSync(flowFile).mtimeMs;

/** Brings the flow's tab to the front (Settings opens beside it). */
async function frontFlowTab() {
	const name = path.basename(flowFile);
	await workbench.evaluate(`(() => { const tab = [...document.querySelectorAll('.part.editor .tab')].find(t => (t.getAttribute('aria-label') || '').includes(${JSON.stringify(name)}) || (t.textContent || '').includes('Key check')); if (tab) tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })); return !!tab; })()`);
	await sleep(800);
}

// ── The flow, opened ───────────────────────────────────────────────────────

const flow = await webview('flow');
for (let i = 0; i < 80 && !(await flow.evaluate(inFrame(`!!d.querySelector('.react-flow__node[data-id="llm-openai"]')`))); i++) await sleep(250);
const opened = mtime();
await sleep(3000);
check(mtime() === opened, 'S29: opening the flow writes nothing (3 s after it is drawn)', `modified ${new Date(mtime()).toISOString()}`);

const MODEL_NOTE = inFrame(`(() => {
	const panel = d.querySelector('.rm-flow-props');
	const label = panel && [...panel.querySelectorAll('label')].find(l => l.textContent.trim() === 'Model');
	const note = label && label.parentElement.querySelector('p');
	if (!note) return null;
	const link = note.querySelector('button');
	return { text: note.textContent.replace(/\\s+/g, ' ').trim(), link: link ? link.textContent.trim() : null, title: link ? link.getAttribute('title') : null };
})()`);

for (const step of STEPS) {
	const selectedAt = mtime();
	const clicked = await flow.evaluate(inFrame(`(() => { const el = d.querySelector('.react-flow__node[data-id="${step.id}"]'); if (!el) return false; el.click(); return true; })()`));
	if (!clicked) {
		check(false, `${step.what}: the step is on the canvas`, step.id);
		continue;
	}
	let note = null;
	for (let i = 0; i < 40; i++) {
		note = await flow.evaluate(MODEL_NOTE);
		if (note && note.text && note.text !== 'Loading models...') break;
		await sleep(250);
	}
	check(note?.text === step.sentence, `S30-S32: ${step.what}'s panel says its key's sentence`, note?.text ?? 'no note');
	check(note?.link === 'Add it in Settings' && !note?.title, `${step.what}: "Add it in Settings" is the link, with no native title`, note?.link ?? 'no link');
	check(!/not configured|⚠/.test(note?.text ?? ''), `${step.what}: no "not configured", no warning sign`);
	await sleep(1500);
	check(mtime() === selectedAt, `S29: selecting ${step.what} writes nothing`, `modified ${new Date(mtime()).toISOString()}`);

	// The tooltip opens on hover (Radix listens for pointermove on its trigger)
	await flow.evaluate(inFrame(`(() => { const panel = d.querySelector('.rm-flow-props'); const link = [...panel.querySelectorAll('p button')].find(b => b.textContent.trim() === 'Add it in Settings'); const trigger = link && link.closest('span'); if (trigger) trigger.dispatchEvent(new w.PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse' })); return !!trigger; })()`));
	let tooltip = null;
	for (let i = 0; i < 12 && !tooltip; i++) {
		await sleep(150);
		// Radix draws the words twice: on screen, and in a visually hidden role=tooltip copy for screen readers
		tooltip = await flow.evaluate(inFrame(`d.querySelector('[data-radix-popper-content-wrapper] [role="tooltip"]')?.textContent.trim() ?? null`));
	}
	check(tooltip === step.tooltip, `${step.what}: the link's tooltip names the key`, tooltip ?? 'no tooltip');
	await shot(`r5-${step.id}-panel.png`);
	await flow.evaluate(inFrame(`(() => { const panel = d.querySelector('.rm-flow-props'); const link = [...panel.querySelectorAll('p button')].find(b => b.textContent.trim() === 'Add it in Settings'); const trigger = link && link.closest('span'); if (trigger) trigger.dispatchEvent(new w.PointerEvent('pointerleave', { bubbles: true, pointerType: 'mouse' })); return true; })()`));
	await sleep(300);
}

// ── The link opens Settings at the key ─────────────────────────────────────

for (const step of [STEPS[0], STEPS[1]]) {
	await frontFlowTab();
	await flow.evaluate(inFrame(`(() => { const el = d.querySelector('.react-flow__node[data-id="${step.id}"]'); if (el) el.click(); return true; })()`));
	for (let i = 0; i < 40 && (await flow.evaluate(MODEL_NOTE))?.link !== 'Add it in Settings'; i++) await sleep(250);
	await flow.evaluate(inFrame(`(() => { const panel = d.querySelector('.rm-flow-props'); const link = [...panel.querySelectorAll('p button')].find(b => b.textContent.trim() === 'Add it in Settings'); if (link) link.click(); return !!link; })()`));
	let settings = null;
	try {
		settings = await webview('settings', 15000);
	} catch (error) {
		check(false, `${step.what}: the link opens Settings`, String(error.message ?? error));
		continue;
	}
	let at = null;
	for (let i = 0; i < 30; i++) {
		await sleep(250);
		at = await settings.evaluate(inFrame(`(() => { const card = d.getElementById('settings-section-${step.section}'); if (!card) return null; const r = card.getBoundingClientRect(); return { top: Math.round(r.top), viewport: w.innerHeight, scrollY: Math.round(w.scrollY || d.scrollingElement.scrollTop), heading: card.querySelector('label')?.textContent.replace(/\\s+/g, ' ').trim() }; })()`));
		if (at && i > 6) break; // the scroll is smooth: give it a moment
	}
	check(Boolean(at) && at.top >= 0 && at.top <= 48, `S30/S32: Settings opens with ${step.section}'s card at the top`, at ?? 'no card');
	await shot(`r5-settings-${step.section}.png`);
	settings.close();
}

// ── S28: an edit still writes ──────────────────────────────────────────────

if (flag('edits')) {
	await frontFlowTab();
	await flow.evaluate(inFrame(`(() => { const el = d.querySelector('.react-flow__node[data-id="llm-openai"]'); if (el) el.click(); return true; })()`));
	await sleep(800);
	const beforeLabel = mtime();
	const typed = await flow.evaluate(inFrame(`(() => {
		const panel = d.querySelector('.rm-flow-props');
		const label = panel && [...panel.querySelectorAll('label')].find(l => l.textContent.trim() === 'Label');
		const input = label && label.parentElement.querySelector('input');
		if (!input) return false;
		const set = Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set;
		set.call(input, 'Write (openai), renamed');
		input.dispatchEvent(new w.Event('input', { bubbles: true }));
		return true;
	})()`));
	for (let i = 0; i < 20 && mtime() === beforeLabel; i++) await sleep(250);
	const saved = JSON.parse(fs.readFileSync(flowFile, 'utf8'));
	check(typed && mtime() !== beforeLabel && saved.nodes.find(n => n.id === 'llm-openai')?.data.label === 'Write (openai), renamed', "S28: a step's label typed in its panel is written", `typed=${typed}`);

	await sleep(1500);
	const beforeDelete = mtime();
	const asked = await flow.evaluate(inFrame(`(() => { const panel = d.querySelector('.rm-flow-props'); const button = panel && [...panel.querySelectorAll('button')].find(b => /^Delete/.test(b.textContent.trim())); if (button) button.click(); return button ? button.textContent.trim() : null; })()`));
	await sleep(400);
	const confirmed = await flow.evaluate(inFrame(`(() => { const buttons = [...d.querySelectorAll('button')].filter(b => /^(Delete|Remove)/.test(b.textContent.trim())); const last = buttons[buttons.length - 1]; if (last) last.click(); return last ? last.textContent.trim() : null; })()`));
	for (let i = 0; i < 20 && mtime() === beforeDelete; i++) await sleep(250);
	const afterDelete = JSON.parse(fs.readFileSync(flowFile, 'utf8'));
	check(mtime() !== beforeDelete && !afterDelete.nodes.some(n => n.id === 'llm-openai'), 'S28: a step deleted from its panel is written', { asked, confirmed });
}

flow.close();
workbench.close();
console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exitCode = failures;
