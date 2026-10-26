#!/usr/bin/env node
/**
 * markdown-roundtrip-check.mjs — open, edit and save Markdown files in a running Ritemark window, and read the
 * bytes back (Sprint 137, R9 and the S-scenarios that need the real webview, bridge and host).
 *
 * Usage:
 *   node scripts/qa/markdown-roundtrip-check.mjs --port <cdp-port> --workspace <folder> [--out <dir>]
 *        [--mode touch|word|none] [--saves <n>] [--expect same|word] [--observe <seconds>] [--keep-open] [--hidden-update] <file> [<file> ...]
 *
 * The window is a dev instance started with --remote-debugging-port, an isolated --user-data-dir, the workspace
 * folder open and auto-save as shipped (see .claude/skills/ritemark-automation). Files are paths relative to the
 * workspace. For each file the check:
 *
 *   1. opens it from the Documents place's tree (mouse input reaches a window behind other windows; keyboard
 *      shortcuts do not), and waits for Ritemark's editor to show it;
 *   2. edits it inside the editor's own webview, the way typing does (`execCommand('insertText')` at the end of the
 *      last paragraph, so ProseMirror sees DOM input):
 *        touch — types one character and deletes it again ("open and save" in scenarios.md);
 *        word  — types " EDITED";
 *        none  — opens only;
 *   3. waits for auto-save, and reads the file's bytes; with --saves 2 it saves again: the edit again in touch
 *      mode, a touch after the word in word mode;
 *   4. closes the editor (with --keep-open, leaves the last file's editor open).
 *
 * With --out, every file's bytes after each save are written there (`<name>.save1.md`, …) beside the original
 * (`<name>.orig.md`). The check prints, per file and save, whether the bytes are the original's, and with
 * --expect word whether the first save changed exactly one line, by the word, and every later save wrote the
 * first save's bytes again. The exit code is the number of files that did not meet --expect
 * (default: none expected, report only).
 *
 * With --observe, the check also watches the document's bar for that many seconds after opening and after each
 * save, and reports every time it shows "Retry document update" (the `apply-error` state, #512) or "Review
 * changes" (a conflict); with --expect, a Retry seen is a failure.
 *
 * With --hidden-update (#512), after the saves the check gives the editor's document the one property of a window
 * that is not visible — behind other windows, minimized, on another space: its animation frames never run (Electron
 * has no CDP call to hide the window) — then writes a changed copy of the file from outside, as an agent would. It
 * watches the bar for 12 s and reports whether the editor shows the new text and whether "Retry document update"
 * appeared. The file is put back afterwards. With --expect, a Retry is a failure.
 */

import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => {
	const index = args.indexOf(`--${name}`);
	return index === -1 ? fallback : args[index + 1];
};
const valueOptions = new Set(['port', 'workspace', 'out', 'mode', 'saves', 'expect', 'observe']);
const files = args.filter((arg, index) => !arg.startsWith('--') && !(index > 0 && valueOptions.has(args[index - 1].replace(/^--/, ''))));
const port = option('port');
const workspace = option('workspace');
const outDir = option('out');
const mode = option('mode', 'touch');
const saves = Number(option('saves', '1'));
const expect = option('expect');
const observeSeconds = Number(option('observe', '0'));
const keepOpen = args.includes('--keep-open');
const hiddenUpdate = args.includes('--hidden-update');
if (!port || !workspace || files.length === 0) {
	console.error('usage: node scripts/qa/markdown-roundtrip-check.mjs --port <cdp-port> --workspace <folder> [--out <dir>] [--mode touch|word|none] [--saves <n>] [--expect same|word] <file> ...');
	process.exit(2);
}
if (outDir) {
	mkdirSync(outDir, { recursive: true });
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// ── CDP sessions: one per target ──

class Session {
	static async open(url) {
		const session = new Session();
		session.socket = new WebSocket(url);
		session.nextId = 0;
		session.pending = new Map();
		await new Promise((resolve, reject) => {
			session.socket.addEventListener('open', resolve, { once: true });
			session.socket.addEventListener('error', reject, { once: true });
		});
		session.socket.addEventListener('message', event => {
			const message = JSON.parse(event.data);
			if (message.id && session.pending.has(message.id)) {
				const { resolve, reject } = session.pending.get(message.id);
				session.pending.delete(message.id);
				message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
			}
		});
		return session;
	}
	send(method, params = {}) {
		return new Promise((resolve, reject) => {
			const id = ++this.nextId;
			this.pending.set(id, { resolve, reject });
			this.socket.send(JSON.stringify({ id, method, params }));
		});
	}
	async evaluate(expression) {
		const { result, exceptionDetails } = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
		if (exceptionDetails) {
			throw new Error(JSON.stringify(exceptionDetails).slice(0, 400));
		}
		return result.value;
	}
	close() {
		this.socket.close();
	}
}

async function targets() {
	return (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
}

async function workbench() {
	for (let tries = 0; tries < 60; tries++) {
		const page = (await targets()).find(target => target.type === 'page' && target.url.includes('workbench'));
		if (page) {
			return Session.open(page.webSocketDebuggerUrl);
		}
		await sleep(500);
	}
	throw new Error(`no workbench page on port ${port}`);
}

const META = 4;
async function key(session, code, keyName, modifiers = 0) {
	const virtualKey = { Escape: 27, Enter: 13 }[code] ?? keyName.toUpperCase().charCodeAt(0);
	await session.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', modifiers, code, key: keyName, windowsVirtualKeyCode: virtualKey });
	await session.send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers, code, key: keyName, windowsVirtualKeyCode: virtualKey });
}

// ── Opening a file, finding its editor ──

async function click(session, x, y) {
	await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
	await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
	await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}

/** The centre of the explorer row labelled `label`, scrolling the tree until it is drawn. */
async function explorerRow(session, label) {
	// Drawn, wholly inside the tree's visible area, and the element a click there would hit.
	const find = `(() => { const list = document.querySelector('.explorer-folders-view .monaco-list'); const row = [...document.querySelectorAll('.explorer-folders-view .monaco-list-row')].find(r => r.getAttribute('aria-label') === ${JSON.stringify(label)}); if (!row || !list) return null; const r = row.getBoundingClientRect(); const l = list.getBoundingClientRect(); const x = r.x + Math.min(r.width / 2, 80); const y = r.y + r.height / 2; const hit = document.elementFromPoint(x, y); return r.height && r.top >= l.top && r.bottom <= l.bottom && hit && hit.closest('.monaco-list-row') === row ? [x, y, row.getAttribute('aria-expanded')] : null; })()`;
	const firstRow = `(document.querySelector('.explorer-folders-view .monaco-list-row') || {}).getAttribute?.('aria-label') ?? ''`;
	let direction = -1;
	let previousFirst = null;
	for (let scroll = 0; scroll < 80; scroll++) {
		const found = await session.evaluate(find);
		if (found) {
			return found;
		}
		// Scroll up until the top, then down a little at a time.
		const list = await session.evaluate(`(() => { const l = document.querySelector('.explorer-folders-view .monaco-list'); if (!l) return null; const r = l.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
		if (!list) {
			return null;
		}
		const first = await session.evaluate(firstRow);
		if (direction < 0 && first === previousFirst) {
			direction = 1;
		}
		previousFirst = first;
		await session.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: list[0], y: list[1], deltaX: 0, deltaY: direction < 0 ? -600 : 200 });
		await sleep(150);
	}
	return null;
}

/**
 * Open a file from the Documents place's tree. Mouse input reaches a window that runs behind other windows
 * (launched with `open -g`); keyboard shortcuts such as Quick Open do not.
 */
async function openFile(session, relativePath) {
	const name = basename(relativePath);
	const visibleTree = `!!document.querySelector('.explorer-folders-view .monaco-list-row')`;
	if (!(await session.evaluate(visibleTree))) {
		const documents = await session.evaluate(`(() => { const e = [...document.querySelectorAll('.action-item [aria-label]')].find(x => /^Documents/.test(x.getAttribute('aria-label'))); if (!e) return null; const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
		if (!documents) {
			throw new Error('no Documents place to open files from');
		}
		await click(session, documents[0], documents[1]);
		for (let wait = 0; wait < 20 && !(await session.evaluate(visibleTree)); wait++) {
			await sleep(150);
		}
	}
	for (const folder of relativePath.split('/').slice(0, -1)) {
		const row = await explorerRow(session, folder);
		if (!row) {
			throw new Error(`no folder ${folder} in the tree`);
		}
		if (row[2] !== 'true') {
			await click(session, row[0], row[1]);
			await sleep(400);
		}
	}
	const row = await explorerRow(session, name);
	if (!row) {
		throw new Error(`no ${relativePath} in the tree`);
	}
	const opened = async () => {
		for (let wait = 0; wait < 20; wait++) {
			if (await session.evaluate(`document.title.startsWith(${JSON.stringify(name)})`)) {
				return true;
			}
			await sleep(150);
		}
		return false;
	};
	// A first click can only focus the tree; a double click opens the file.
	await click(session, row[0], row[1]);
	if (await opened()) {
		return;
	}
	await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: row[0], y: row[1], button: 'left', clickCount: 1 });
	await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: row[0], y: row[1], button: 'left', clickCount: 1 });
	await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: row[0], y: row[1], button: 'left', clickCount: 2 });
	await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: row[0], y: row[1], button: 'left', clickCount: 2 });
	if (await opened()) {
		return;
	}
	throw new Error(`could not open ${relativePath}`);
}

/** Close the active editor with its tab's close button (Cmd+W does not reach a background window). */
async function closeActiveEditor(session) {
	const button = await session.evaluate(`(() => { const tab = document.querySelector('.tabs-container .tab.active'); const close = tab && [...tab.querySelectorAll('[aria-label]')].find(e => /^Close/.test(e.getAttribute('aria-label'))); if (!close) return null; const r = close.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
	if (button) {
		await click(session, button[0], button[1]);
	} else {
		await key(session, 'KeyW', 'w', META);
	}
}

/** The text that identifies a document in its editor: its first non-empty line, without Markdown punctuation. */
function fingerprint(markdown) {
	const body = markdown.replace(/^---\n[\s\S]*?\n---\n/, '');
	const line = body.split('\n').find(l => l.replace(/[#>*_\-`[\]()!|:]/g, '').trim().length > 3) ?? '';
	return line.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#>*_`|]/g, '').replace(/^\s*([-+]|\d+[.)])\s+(\[[ xX]\]\s+)?/, '').trim().slice(0, 24);
}

async function editorFor(markdown) {
	const want = fingerprint(markdown);
	for (let wait = 0; wait < 60; wait++) {
		for (const target of await targets()) {
			if (target.type !== 'iframe' || !target.url.startsWith('vscode-webview://') || target.url.includes('purpose=webviewView')) {
				continue;
			}
			let session;
			try {
				session = await Session.open(target.webSocketDebuggerUrl);
				const text = await session.evaluate(`(() => { const af = document.getElementById('active-frame'); const pm = af && af.contentDocument && af.contentDocument.querySelector('.ProseMirror'); return pm ? pm.innerText : null })()`);
				if (typeof text === 'string' && text.replace(/\s+/g, ' ').includes(want.replace(/\s+/g, ' '))) {
					return session;
				}
			} catch {
				// a webview that is going away
			}
			session?.close();
		}
		await sleep(250);
	}
	throw new Error(`no Ritemark editor showing "${want}"`);
}

/** Type `text` at the end of the document's last text block, inside the editor's own document. */
const typeAtEnd = text => `(async () => {
	const af = document.getElementById('active-frame');
	const d = af.contentDocument;
	const w = af.contentWindow;
	const pm = d.querySelector('.ProseMirror');
	pm.focus();
	const blocks = [...pm.querySelectorAll('p, h1, h2, h3, h4, h5, h6')].filter(b => b.textContent.trim() && !b.closest('table') && !b.closest('pre'));
	const last = blocks[blocks.length - 1];
	const walker = d.createTreeWalker(last, w.NodeFilter.SHOW_TEXT);
	let node, lastText = null;
	while ((node = walker.nextNode())) lastText = node;
	const selection = w.getSelection();
	selection.collapse(lastText, lastText.length);
	await new Promise(r => setTimeout(r, 120));
	const ok = d.execCommand('insertText', false, ${JSON.stringify(text)});
	await new Promise(r => setTimeout(r, 120));
	return ok;
})()`;
const deleteBackward = `(async () => {
	const d = document.getElementById('active-frame').contentDocument;
	const ok = d.execCommand('delete', false);
	await new Promise(r => setTimeout(r, 120));
	return ok;
})()`;

/** What the document's bar asks for, sampled for `seconds`: each distinct label with when it was first seen. */
async function observeBar(editor, seconds) {
	const seen = [];
	const start = Date.now();
	while (Date.now() - start < seconds * 1000) {
		const labels = await editor.evaluate(`(() => { const d = document.getElementById('active-frame').contentDocument; return [...d.querySelectorAll('button')].map(b => ((b.textContent || '') + ' ' + (b.getAttribute('aria-label') || '')).trim()).filter(t => /Retry document update|Document update failed|Review changes/.test(t)) })()`).catch(() => []);
		for (const label of labels) {
			if (!seen.some(entry => entry.label === label)) {
				seen.push({ label, atSeconds: Math.round((Date.now() - start) / 100) / 10 });
			}
		}
		await sleep(500);
	}
	return seen;
}

async function waitForSave(path, previous) {
	// Auto-save runs a second after the last edit. Wait for the bytes to move, then for them to settle.
	let last = readFileSync(path, 'utf8');
	let stableSince = Date.now();
	const start = Date.now();
	while (Date.now() - start < 8000) {
		await sleep(250);
		const now = readFileSync(path, 'utf8');
		if (now !== last) {
			last = now;
			stableSince = Date.now();
		} else if (Date.now() - stableSince > 1800 && (now !== previous || Date.now() - start > 4000)) {
			return now;
		}
	}
	return last;
}

const visible = text => text.replace(/\t/g, '^I').replace(/\r/g, '^M').split('\n').map(line => `${line}$`).join('\n');

function changedLines(before, after) {
	const a = before.split('\n');
	const b = after.split('\n');
	let start = 0;
	while (start < a.length && start < b.length && a[start] === b[start]) {
		start++;
	}
	let endA = a.length - 1;
	let endB = b.length - 1;
	while (endA >= start && endB >= start && a[endA] === b[endB]) {
		endA--;
		endB--;
	}
	return { removed: a.slice(start, endA + 1), added: b.slice(start, endB + 1) };
}

// ── The run ──

const bench = await workbench();
let failures = 0;
for (const relativePath of files) {
	const path = join(workspace, relativePath);
	const original = readFileSync(path, 'utf8');
	const name = relativePath.replace(/[\\/]/g, '__').replace(/\.md$/, '');
	if (outDir) {
		writeFileSync(join(outDir, `${name}.orig.md`), original);
	}
	await openFile(bench, relativePath);
	const editor = await editorFor(original);
	await sleep(600);
	const barSeen = [];
	if (observeSeconds) {
		barSeen.push(...(await observeBar(editor, observeSeconds)).map(entry => ({ ...entry, after: 'open' })));
	}
	let previous = original;
	const results = [];
	for (let save = 1; save <= saves; save++) {
		const mtime = statSync(path).mtimeMs;
		if (mode === 'touch') {
			await editor.evaluate(typeAtEnd('x'));
			await editor.evaluate(deleteBackward);
		} else if (mode === 'word' && save === 1) {
			await editor.evaluate(typeAtEnd(' EDITED'));
		} else if (mode === 'word') {
			await editor.evaluate(typeAtEnd('x'));
			await editor.evaluate(deleteBackward);
		}
		const bytes = mode === 'none' ? readFileSync(path, 'utf8') : await waitForSave(path, previous);
		const written = statSync(path).mtimeMs !== mtime;
		if (outDir) {
			writeFileSync(join(outDir, `${name}.save${save}.md`), bytes);
			writeFileSync(join(outDir, `${name}.save${save}.cat-A.txt`), visible(bytes));
		}
		const { removed, added } = changedLines(original, bytes);
		results.push({ save, written, same: bytes === original, removed, added, bytes });
		previous = bytes;
		if (observeSeconds) {
			barSeen.push(...(await observeBar(editor, observeSeconds)).map(entry => ({ ...entry, after: `save ${save}` })));
		}
	}
	let hidden = null;
	if (hiddenUpdate) {
		await editor.evaluate(`(() => { const w = document.getElementById('active-frame').contentWindow; w.__rmQueuedFrames = []; w.requestAnimationFrame = callback => { w.__rmQueuedFrames.push(callback); return w.__rmQueuedFrames.length; }; return true })()`);
		const before = readFileSync(path, 'utf8');
		const marker = 'An agent added this paragraph.';
		writeFileSync(path, before.replace(/\n*$/, `\n\n${marker}\n`));
		const seen = await observeBar(editor, 12);
		const shows = await editor.evaluate(`document.getElementById('active-frame').contentDocument.querySelector('.ProseMirror').innerText.includes(${JSON.stringify(marker)})`);
		const frames = await editor.evaluate(`(document.getElementById('active-frame').contentWindow.__rmQueuedFrames || []).length`);
		writeFileSync(path, before);
		await sleep(2500);
		hidden = { shows, seen, frames };
	}
	const tabs = await editor.evaluate(`(() => { const d = document.getElementById('active-frame').contentDocument; return { links: [...d.querySelectorAll('.ProseMirror a')].map(a => a.getAttribute('href')), images: d.querySelectorAll('.ProseMirror img').length, bold: [...d.querySelectorAll('.ProseMirror strong')].map(s => s.textContent) } })()`);
	editor.close();
	if (!(keepOpen && relativePath === files[files.length - 1])) {
		await closeActiveEditor(bench);
		await sleep(400);
	}

	let ok = true;
	for (const result of results) {
		const lines = [...result.removed.map(line => `  - ${JSON.stringify(line)}`), ...result.added.map(line => `  + ${JSON.stringify(line)}`)];
		console.log(`${relativePath} save ${result.save}: ${result.same ? 'BYTE-IDENTICAL' : 'CHANGED'}${result.written ? '' : ' (file not rewritten)'}`);
		if (!result.same) {
			console.log(lines.join('\n'));
		}
	}
	console.log(`${relativePath} editor: links ${JSON.stringify(tabs.links)}, images ${tabs.images}, bold ${JSON.stringify(tabs.bold)}`);
	if (observeSeconds) {
		console.log(`${relativePath} bar: ${barSeen.length ? barSeen.map(entry => `"${entry.label}" ${entry.atSeconds}s after ${entry.after}`).join('; ') : 'no question, no retry'}`);
	}
	if (expect === 'same') {
		ok = results.every(result => result.same);
	} else if (expect === 'word') {
		const [first, ...rest] = results;
		// The word lands where the caret was: before a CRLF line's `\r`, or inside the mark that ends the paragraph
		// (`*text EDITED*`), as typing there does.
		ok = first.removed.length === 1 && first.added.length === 1 && first.added[0].includes(' EDITED')
			&& first.added[0].replace(' EDITED', '') === first.removed[0]
			// Each later save is a touch (a character typed and deleted): it must write exactly the first save's bytes.
			&& rest.every(result => result.bytes === first.bytes);
	}
	if (hidden) {
		console.log(`${relativePath} hidden update: editor shows the new text: ${hidden.shows ? 'yes' : 'NO'}; frames held back: ${hidden.frames}; bar: ${hidden.seen.length ? hidden.seen.map(entry => `"${entry.label}" after ${entry.atSeconds}s`).join('; ') : 'no question, no retry'}`);
	}
	if (observeSeconds && barSeen.some(entry => /Retry|failed/.test(entry.label))) {
		ok = false;
	}
	if (hidden && (!hidden.shows || hidden.seen.some(entry => /Retry|failed/.test(entry.label)))) {
		ok = false;
	}
	if (expect) {
		console.log(`${ok ? 'PASS' : 'FAIL'}: ${relativePath} (${expect})`);
		failures += ok ? 0 : 1;
	}
}
bench.close();
process.exit(failures);
