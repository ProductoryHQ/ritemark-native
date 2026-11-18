/**
 * Pictures with ChatGPT, end to end in the editor's host with the dev run's stand-in (no AI is asked): the check, a
 * picture made for a deck (told as a saved picture first, then its status), one for a document, Cancel, a closed
 * editor, the signed-out path that opens ChatGPT's sign-in card, and the stand-in only in a development build.
 *
 * Run: npx tsx src/pictures/chatgptPictureHost.test.ts
 */

// ── Minimal vscode stub, before anything imports vscode (the pattern of CodexRuntime.test.ts) ──────────────────────
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require('module') as { _resolveFilename: (request: string, ...rest: unknown[]) => string };
let workspaceRoot = '';
const vscodeStub = {
  Uri: { file: (fsPath: string) => ({ fsPath, scheme: 'file', toString: () => `file://${fsPath}` }) },
  workspace: {
    getWorkspaceFolder: () => ({ uri: { fsPath: workspaceRoot } }),
    getConfiguration: () => ({ get: (_key: string, fallback: unknown) => fallback }),
  },
  window: {},
  commands: { executeCommand: async () => undefined },
  EventEmitter: class { event = () => ({ dispose: () => undefined }); fire() {} dispose() {} },
};
const originalResolve = Module._resolveFilename.bind(Module);
Module._resolveFilename = function (request: string, ...rest: unknown[]) {
  if (request === 'vscode') return '__vscode_stub__';
  return originalResolve(request, ...rest);
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(require as any).cache['__vscode_stub__'] = { id: '__vscode_stub__', filename: '__vscode_stub__', loaded: true, children: [], paths: [], exports: vscodeStub };

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { makeTempDir } from '../testing/tempDir';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ChatgptPictureHost, pictureStandIn } = require('./chatgptPictureHost') as typeof import('./chatgptPictureHost');

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('the stand-in')]);

interface Posted { type: string; [key: string]: unknown }

function webview(): { posted: Posted[]; view: import('vscode').Webview } {
  const posted: Posted[] = [];
  const view = {
    postMessage: async (message: Posted) => { posted.push(message); return true; },
    asWebviewUri: (uri: { fsPath: string }) => ({ toString: () => `vscode-webview://test${uri.fsPath}` }),
  } as unknown as import('vscode').Webview;
  return { posted, view };
}

const until = async (check: () => boolean, ms = 3000): Promise<void> => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise(resolve => setTimeout(resolve, 5));
  }
};

async function main(): Promise<void> {
  const root = makeTempDir('rm-chatgpt-host-');
  workspaceRoot = root;
  const fixture = path.join(root, 'stand-in.png');
  fs.writeFileSync(fixture, PNG);
  const deckFile = path.join(root, 'Training.deck.md');
  const docFile = path.join(root, 'notes', 'Notes.md');
  fs.mkdirSync(path.dirname(docFile));
  const deck = { uri: { scheme: 'file', fsPath: deckFile } } as unknown as import('vscode').TextDocument;
  const doc = { uri: { scheme: 'file', fsPath: docFile } } as unknown as import('vscode').TextDocument;
  const signIns: string[] = [];
  const sheet = {
    runtimeAvailability: async () => ({ state: 'needs-auth', usable: false }),
    oneShotSettings: async () => { throw new Error('the stand-in never asks an AI'); },
    openLandingChat: async (runtimeId: string) => { signIns.push(runtimeId); },
  } as unknown as import('./chatgptPictureHost').PictureSheet;
  const env = { VSCODE_DEV: '1', RITEMARK_PICTURE_STANDIN: fixture } as NodeJS.ProcessEnv;
  // The stand-in answers at once in tests.
  const host = new ChatgptPictureHost(() => sheet, env, 5);

  // ── Only in a development build, and only an absolute path.
  assert.strictEqual(pictureStandIn({ RITEMARK_PICTURE_STANDIN: fixture }), null, 'never in an installed Ritemark');
  assert.strictEqual(pictureStandIn({ VSCODE_DEV: '1', RITEMARK_PICTURE_STANDIN: 'relative.png' }), null);
  assert.strictEqual(pictureStandIn(env), fixture);

  // ── The check: ready.
  {
    const { posted, view } = webview();
    assert.strictEqual(host.handle(deck, view, { type: 'picture/check', requestId: 'c1' }), true);
    await until(() => posted.length === 1);
    assert.deepStrictEqual(posted[0], { type: 'picture/status', requestId: 'c1', state: 'ready' });
    assert.strictEqual(host.handle(deck, view, { type: 'deck/save-image' }), false, 'not this host\'s message');
    console.log('✓ the check: ChatGPT ready');
  }

  // ── A deck: the picture saved into images/ beside the deck, told first as a saved picture for its slide.
  {
    const { posted, view } = webview();
    host.handle(deck, view, { type: 'picture/make', requestId: 'm1', mode: 'new', description: 'Three robots', name: 'Where agents work', slideId: 's-2' } as never);
    await until(() => posted.length === 1);
    const url = `vscode-webview://test${path.join(root, 'images', 'where-agents-work.png')}`;
    // Only the status: the slide editor that asked places it (never the shared paste channel, deck/image-saved).
    assert.deepStrictEqual(posted[0], { type: 'picture/status', requestId: 'm1', state: 'made', path: 'images/where-agents-work.png', url });
    assert.deepStrictEqual(fs.readFileSync(path.join(root, 'images', 'where-agents-work.png')), PNG);
    // Change on a picture the host can't send (a web address: no path): answered, so the strip never waits forever.
    host.handle(deck, view, { type: 'picture/make', requestId: 'm0', mode: 'change', description: 'Night' } as never);
    await until(() => posted.length === 2);
    assert.deepStrictEqual(posted[1], { type: 'picture/status', requestId: 'm0', state: 'failed', problem: 'ChatGPT can\'t change this picture: it isn\'t a file in this project.' });
    host.handle(deck, view, { type: 'picture/make', requestId: 'm00', mode: 'new', description: '   ' } as never);
    await until(() => posted.length === 3);
    assert.match(String(posted[2].problem), /Describe the picture/, 'an empty request is told so, not "not a file"');
    console.log('✓ a deck: saved in images/, placed as a saved picture; a request it can\'t take is answered');
  }

  // ── Try another in a document: a new file next to the document, `./images/…`, the first one kept.
  {
    const { posted, view } = webview();
    fs.mkdirSync(path.join(path.dirname(docFile), 'images'));
    fs.writeFileSync(path.join(path.dirname(docFile), 'images', 'old.png'), PNG);
    host.handle(doc, view, { type: 'picture/make', requestId: 'm2', mode: 'change', description: 'At night', source: './images/old.png' } as never);
    await until(() => posted.length === 1);
    host.handle(doc, view, { type: 'picture/make', requestId: 'm3', mode: 'change', description: 'At night', source: './images/old.png' } as never);
    await until(() => posted.length === 2);
    assert.strictEqual(posted[0].path, './images/at-night.png');
    assert.strictEqual(posted[1].path, './images/at-night-2.png');
    assert.ok(posted.every(message => message.type === 'picture/status'), 'a document is told only the status');
    assert.ok(fs.existsSync(path.join(path.dirname(docFile), 'images', 'old.png')), 'the old picture stays');
    console.log('✓ a document: ./images/, and Try another keeps the first');
  }

  // ── Cancel, and an editor closed while a picture is made.
  {
    const slowHost = new ChatgptPictureHost(() => sheet, env, 10_000);
    const { posted, view } = webview();
    slowHost.handle(doc, view, { type: 'picture/make', requestId: 'm4', mode: 'new', description: 'Slow' } as never);
    await new Promise(resolve => setTimeout(resolve, 20));
    slowHost.handle(doc, view, { type: 'picture/cancel', requestId: 'm4' });
    await until(() => posted.length === 1);
    assert.deepStrictEqual(posted[0], { type: 'picture/status', requestId: 'm4', state: 'cancelled' });
    const closed = webview();
    slowHost.handle(doc, closed.view, { type: 'picture/make', requestId: 'm5', mode: 'new', description: 'Closed' } as never);
    await new Promise(resolve => setTimeout(resolve, 20));
    slowHost.disposeFor(closed.view);
    await until(() => closed.posted.length === 1);
    assert.strictEqual(closed.posted[0].state, 'cancelled');
    assert.ok(!fs.existsSync(path.join(path.dirname(docFile), 'images', 'slow.png')));
    console.log('✓ Cancel and a closed editor stop the picture');
  }

  // ── Signed out: ChatGPT's sign-in card on the AI's sheet; nothing is made.
  {
    fs.writeFileSync(`${fixture}.signed-out`, '');
    const { posted, view } = webview();
    host.handle(deck, view, { type: 'picture/check', requestId: 'c2' });
    await until(() => posted.length === 1);
    assert.deepStrictEqual(posted[0], { type: 'picture/status', requestId: 'c2', state: 'sign-in' });
    host.handle(deck, view, { type: 'picture/make', requestId: 'm6', mode: 'new', description: 'Signed out', slideId: 's-1' } as never);
    await until(() => posted.length === 2);
    assert.deepStrictEqual(posted[1], { type: 'picture/status', requestId: 'm6', state: 'sign-in' });
    assert.deepStrictEqual(signIns, ['codex', 'codex'], 'ChatGPT\'s sign-in card, each time');
    assert.ok(!fs.existsSync(path.join(root, 'images', 'signed-out.png')));
    console.log('✓ signed out: ChatGPT\'s sign-in card, nothing made');
  }

  // ── Signed in with an API key: the check says ChatGPT needs a ChatGPT account, before any words are typed.
  {
    fs.rmSync(`${fixture}.signed-out`);
    const keyed = new ChatgptPictureHost(() => ({ ...sheet, runtimeAvailability: async () => ({ state: 'ready', usable: true }), codexAuthMethod: async () => 'apiKey' }) as never, {}, 5);
    const { posted, view } = webview();
    keyed.handle(doc, view, { type: 'picture/check', requestId: 'c3' });
    await until(() => posted.length === 1);
    assert.equal(posted[0].state, 'failed');
    assert.match(String(posted[0].problem), /ChatGPT account, not an API key/);
    console.log('✓ an API-key Codex is told at once');
  }

  // ── A sheet that can ring the card opens ChatGPT's card with its ring (#800).
  {
    const rung: string[] = [];
    const ringing = new ChatgptPictureHost(() => ({ ...sheet, openChatgptSignIn: async (placeholder: string) => { rung.push(placeholder); } }) as never, {}, 5);
    const { posted, view } = webview();
    ringing.handle(doc, view, { type: 'picture/check', requestId: 'c4' });
    await until(() => posted.length === 1);
    assert.equal(posted[0].state, 'sign-in');
    assert.equal(rung.length, 1, 'the card is opened with its ring');
    console.log('✓ not signed in: ChatGPT\'s card is opened with its ring');
  }

  // ── Without the stand-in, the real path asks the AI's sheet whether ChatGPT is ready (here: signed out).
  {
    const real = new ChatgptPictureHost(() => sheet, {});
    const { posted, view } = webview();
    real.handle(doc, view, { type: 'picture/make', requestId: 'm7', mode: 'new', description: 'Real' } as never);
    await until(() => posted.length === 1);
    assert.strictEqual(posted[0].state, 'sign-in');
    console.log('✓ the real path: the sheet\'s ChatGPT availability decides');
  }

  console.log('\nAll ChatGPT picture host tests passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
