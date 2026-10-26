// One #497 spike run in the dev instance: a new chat with an AI, a mode, one message; waits for the turn to end and
// saves the chat's record and a summary.
// node spike-run.mjs <profile> <run-name> <runtimeId> <auto|ask> '<message>' [--open <file relative to the project>]
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { webview, frameEval, sleep, Session } from './cdp.mjs';

const [profile, name, runtimeId, mode, message, ...rest] = process.argv.slice(2);
const openIndex = rest.indexOf('--open');
const openFile = openIndex >= 0 ? rest[openIndex + 1] : null;
const records = `/private/tmp/s140/${profile}/ud/User/globalStorage/ritemark.ritemark/conversations/v1/records`;
const outDir = '/private/tmp/s140/runs';
mkdirSync(outDir, { recursive: true });

async function exthost(expression) {
	const log = readFileSync(`/private/tmp/s140/${profile}/launch.log`, 'utf8');
	const port = [...log.matchAll(/debugger listening on port (\d+)/g)].map(m => m[1]).at(-1);
	const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
	const session = await new Session(list[0]).open();
	const prelude = `const m = process.getBuiltinModule('module'); const vscode = m.createRequire('/Users/jarmotuisk/Projects/ritemark-dev/ritemark-native/.claude/worktrees/agent-a5c48759a389647e0/vscode/extensions/ritemark/out/extension.js')('vscode');`;
	const { result, exceptionDetails } = await session.send('Runtime.evaluate', { expression: `(async () => { ${prelude} ${expression} })()`, awaitPromise: true, returnByValue: true });
	session.close();
	if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || 'exthost eval failed');
	return result.value;
}

const SIDEBAR = `d.querySelector('textarea[aria-label="Message"]')`;

if (openFile) {
	await exthost(`const folder = vscode.workspace.workspaceFolders[0].uri; await vscode.commands.executeCommand('vscode.open', vscode.Uri.joinPath(folder, ${JSON.stringify(openFile)})); return true;`);
	await sleep(4000);
} else {
	// Home in front, nothing else open
	await exthost(`await vscode.commands.executeCommand('workbench.action.closeAllEditors'); await vscode.commands.executeCommand('ritemark.openHome').catch(() => {}); return true;`).catch(() => {});
	await sleep(1500);
}

const sidebar = await webview(SIDEBAR);
await frameEval(sidebar, `w.dispatchEvent(new MessageEvent('message', { data: { type: 'landing:new-chat', runtimeId: ${JSON.stringify(runtimeId)}, placeholder: '' } })); return true;`);
await sleep(2500);

// The mode: open the select and choose by its words
const wanted = mode === 'ask' ? 'Manual' : 'Auto';
const current = await frameEval(sidebar, `return d.querySelector('[aria-label^="Permission mode:"]')?.getAttribute('aria-label')`);
if (!current?.endsWith(wanted)) {
	await frameEval(sidebar, `const t = d.querySelector('[aria-label^="Permission mode:"]'); t.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })); return true;`);
	await sleep(600);
	await frameEval(sidebar, `const o = [...d.querySelectorAll('[role="option"]')].find(o => o.textContent.trim().startsWith(${JSON.stringify(wanted)})); if (!o) return false; o.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' })); o.click(); return true;`);
	await sleep(600);
}
const modeNow = await frameEval(sidebar, `return d.querySelector('[aria-label^="Permission mode:"]')?.getAttribute('aria-label')`);
const runtimeNow = await frameEval(sidebar, `return [...d.querySelectorAll('button')].map(b => b.getAttribute('aria-label') || '').find(l => /thinking effort/.test(l)) || ''`);

await frameEval(sidebar, `w.__spike = []; if (!w.__spikeHooked) { w.__spikeHooked = true; w.addEventListener('message', (e) => { const t = e.data && e.data.type; if (t && /progress|codex|agent-|tool|approval/.test(t)) { try { w.__spike.push(JSON.parse(JSON.stringify(e.data))); } catch {} } }); } return true;`);
const before = new Set(existsSync(records) ? readdirSync(records) : []);
const started = Date.now();
await frameEval(sidebar, `const t = ${SIDEBAR}; const set = Object.getOwnPropertyDescriptor(w.HTMLTextAreaElement.prototype, 'value').set; set.call(t, ${JSON.stringify(message)}); t.dispatchEvent(new Event('input', { bubbles: true })); return true;`);
await sleep(500);
const sent = await frameEval(sidebar, `const b = d.querySelector('button[aria-label="Send"]'); if (!b || b.disabled) return false; b.click(); return true;`);
if (!sent) throw new Error('Send was not available');

// Find the chat's record and wait for the turn to end
let file = null;
let record = null;
let attentionSeenAt = null;
const LIMIT_MS = 6 * 60 * 1000;
while (Date.now() - started < LIMIT_MS) {
	await sleep(3000);
	if (!file && existsSync(records)) {
		for (const candidate of readdirSync(records)) {
			const path = join(records, candidate);
			if (statSync(path).mtimeMs < started - 1000) continue;
			try {
				const parsed = JSON.parse(readFileSync(path, 'utf8'));
				if (parsed.events?.some(e => e.kind === 'user-message' && e.text.includes(message.slice(0, 40)) && Date.parse(e.occurredAt) >= started - 2000)) file = path;
			} catch { /* being written */ }
		}
	}
	if (!file) continue;
	try { record = JSON.parse(readFileSync(file, 'utf8')); } catch { continue; }
	const state = record.lifecycle?.state;
	if (state === 'needs-user' && !attentionSeenAt) attentionSeenAt = Date.now();
	if (attentionSeenAt && Date.now() - attentionSeenAt > 15000) {
		// Manual: it asked; stop the turn rather than answer for the person
		await frameEval(sidebar, `const b = d.querySelector('button[aria-label="Stop"]'); if (b) b.click(); return !!b;`);
		await sleep(4000);
		try { record = JSON.parse(readFileSync(file, 'utf8')); } catch { /* keep the last */ }
		break;
	}
	if (state === 'idle' || state === 'interrupted') break;
}
const elapsedMs = Date.now() - started;
const trace = await frameEval(sidebar, `return (w.__spike || []).slice(0, 2000)`).catch(() => []);
writeFileSync(join(outDir, `${name}.trace.json`), JSON.stringify(trace, null, 1));
const events = record?.events ?? [];
const summary = {
	name,
	runtimeId,
	mode: modeNow,
	runtime: runtimeNow,
	openFile,
	message,
	elapsedMs,
	timedOut: elapsedMs >= LIMIT_MS,
	lifecycle: record?.lifecycle ?? null,
	activities: events.filter(e => e.kind === 'activity').map(e => ({ title: e.title, status: e.status, files: e.fileReferences })),
	attentions: events.filter(e => e.kind === 'attention').map(e => ({ kind: e.attentionKind, prompt: e.prompt.slice(0, 300), state: e.attentionState })),
	boundaries: events.filter(e => e.kind === 'boundary').map(e => ({ kind: e.boundaryKind, message: e.message, failureKind: e.failureKind })),
	answer: events.filter(e => e.kind === 'assistant-message').map(e => ({ status: e.terminalStatus, content: e.content })).at(-1) ?? null,
};
writeFileSync(join(outDir, `${name}.record.json`), JSON.stringify(record, null, 1));
writeFileSync(join(outDir, `${name}.summary.json`), JSON.stringify(summary, null, 1));
appendFileSync(join(outDir, 'index.log'), `${new Date().toISOString()} ${name} ${runtimeId} ${modeNow} ${Math.round(elapsedMs / 1000)}s state=${summary.lifecycle?.state} answer=${summary.answer?.status}\n`);
console.log(JSON.stringify({ name, elapsed: Math.round(elapsedMs / 1000), state: summary.lifecycle?.state, answer: summary.answer?.status, activities: summary.activities.length, attentions: summary.attentions.length }));
sidebar.close();
process.exit(0);
