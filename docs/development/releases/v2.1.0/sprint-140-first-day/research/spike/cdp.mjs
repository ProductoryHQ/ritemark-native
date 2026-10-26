// Small CDP helpers for the Sprint 140 dev instance (port 9232). Node 22+: global fetch and WebSocket.
import { writeFileSync } from 'node:fs';

export const PORT = Number(process.env.CDP_PORT || 9232);
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function targets() {
	return (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
}

export class Session {
	constructor(target) {
		this.target = target;
		this.nextId = 0;
		this.pending = new Map();
		this.listeners = [];
	}
	async open() {
		this.socket = new WebSocket(this.target.webSocketDebuggerUrl);
		await new Promise((resolve, reject) => {
			this.socket.addEventListener('open', resolve, { once: true });
			this.socket.addEventListener('error', reject, { once: true });
		});
		this.socket.addEventListener('message', event => {
			const message = JSON.parse(event.data);
			if (message.id && this.pending.has(message.id)) {
				const { resolve, reject } = this.pending.get(message.id);
				this.pending.delete(message.id);
				message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
			} else if (message.method) {
				for (const listener of this.listeners) listener(message);
			}
		});
		return this;
	}
	send(method, params = {}) {
		return new Promise((resolve, reject) => {
			const id = ++this.nextId;
			this.pending.set(id, { resolve, reject });
			this.socket.send(JSON.stringify({ id, method, params }));
		});
	}
	async eval(expression) {
		const { result, exceptionDetails } = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
		if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || JSON.stringify(exceptionDetails));
		return result.value;
	}
	close() { this.socket?.close(); }
}

export async function workbench() {
	const list = await targets();
	const page = list.find(t => t.type === 'page' && t.url.includes('workbench'));
	if (!page) throw new Error('no workbench page');
	return new Session(page).open();
}

/** A webview whose #active-frame document matches `probe` (an expression over `d`, the frame's document). */
export async function webview(probe, { tries = 20 } = {}) {
	for (let attempt = 0; attempt < tries; attempt++) {
		const list = await targets();
		for (const target of list.filter(t => t.type === 'iframe' && t.url.startsWith('vscode-webview://'))) {
			const session = await new Session(target).open().catch(() => null);
			if (!session) continue;
			const ok = await session.eval(`(() => { const f = document.getElementById('active-frame'); const d = f && f.contentDocument; if (!d) return false; return !!(${probe}); })()`).catch(() => false);
			if (ok) return session;
			session.close();
		}
		await sleep(500);
	}
	throw new Error(`no webview matching ${probe}`);
}

/** Evaluate inside a webview session's #active-frame: `body` sees d (document) and w (window). */
export function frameEval(session, body) {
	return session.eval(`(async () => { const f = document.getElementById('active-frame'); const d = f.contentDocument; const w = f.contentWindow; ${body} })()`);
}

export async function clickAt(session, x, y) {
	await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
	await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
	await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}

export async function screenshot(session, file, clip) {
	const { data } = await session.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
	writeFileSync(file, Buffer.from(data, 'base64'));
	return file;
}

export async function key(session, keyName, { code = keyName, modifiers = 0, vk } = {}) {
	const allowed = { Enter: 13, Escape: 27, Tab: 9, Backspace: 8, ArrowDown: 40, ArrowUp: 38, Space: 32 };
	const windowsVirtualKeyCode = vk ?? allowed[keyName] ?? keyName.toUpperCase().charCodeAt(0);
	await session.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', modifiers, code, key: keyName, windowsVirtualKeyCode });
	await session.send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers, code, key: keyName, windowsVirtualKeyCode });
}
