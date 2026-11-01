/**
 * Sprint 145 R4 (#571), review round 1: a Flow's writes are never dropped, and Cmd+S saves what the editor shows.
 *
 * Until R4, a look (a click, a measurement) marked the flow dirty, and the next autosave happened to write any edit an
 * earlier write had missed. R4 took that away, which uncovered two gaps in `FlowEditorProvider`:
 * - a `flow:save` that came while another was being written was dropped (`isUpdating`), with no `flow:saved`, so the
 *   webview took the first write's answer as its own and marked the newer edit clean;
 * - Cmd+S (`flow:requestSave`) saved the document without the edit the autosave hadn't sent yet, and its `flow:saved`
 *   then marked that edit clean.
 * Now the writes run one after another, and Cmd+S carries the pending flow, written before the save. (The webview's
 * half, a `flow:saved` for an older copy writing again, is in `FlowEditor.tsx`.)
 *
 * Run: npx tsx src/flows/flowSaves.test.ts
 */

// ── Minimal vscode stub (the geminiCallSites.test.ts technique) ──────────────
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require('module') as {
  _resolveFilename: (request: string, parent: unknown, isMain: boolean) => string;
};
const log: string[] = [];
let applyDelayMs = 40;
class WorkspaceEdit {
  content = '';
  replace(_uri: unknown, _range: unknown, content: string) { this.content = content; }
  renameFile() { /* not reached: the test's file has no short id */ }
}
const vscodeMod = {
  workspace: {
    getConfiguration: () => ({ get: (_key: string, def: unknown) => def }),
    workspaceFolders: undefined,
    applyEdit: async (edit: WorkspaceEdit) => {
      await new Promise((resolve) => setTimeout(resolve, applyDelayMs));
      log.push(`apply ${(JSON.parse(edit.content) as { name: string }).name}`);
      return true;
    },
  },
  window: { showErrorMessage: () => undefined },
  commands: { executeCommand: async () => undefined },
  Uri: { parse: (s: string) => s, file: (s: string) => ({ fsPath: s }), joinPath: (...parts: unknown[]) => parts.join('/') },
  Range: class { constructor(..._args: unknown[]) {} },
  WorkspaceEdit,
  EventEmitter: class { event = () => ({ dispose() {} }); fire() {} dispose() {} },
  Disposable: class { constructor(private readonly fn: () => void) {} dispose() { this.fn(); } },
};
const originalResolve = Module._resolveFilename.bind(Module);
Module._resolveFilename = function (request: string, ...rest: [unknown, boolean]) {
  if (request === 'vscode') return '__vscode_stub__';
  return originalResolve(request, ...rest);
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(require as any).cache['__vscode_stub__'] = {
  id: '__vscode_stub__', filename: '__vscode_stub__', loaded: true, children: [], paths: [], exports: vscodeMod,
};

import assert from 'node:assert/strict';
import type * as vscode from 'vscode';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { FlowEditorProvider } = require('./FlowEditorProvider') as typeof import('./FlowEditorProvider');

const state = new Map<string, unknown>();
const extensionContext = {
  secrets: { get: async () => undefined, onDidChange: () => ({ dispose() {} }) },
  workspaceState: { get: (key: string) => state.get(key), update: async (key: string, value: unknown) => { state.set(key, value); } },
  subscriptions: [],
} as unknown as vscode.ExtensionContext;

type Handler = (message: Record<string, unknown>) => Promise<void>;

/** An open flow editor: its message handler, what it posted, and its document's saves in `log`. */
async function openEditor(): Promise<{ send: Handler; posted: string[] }> {
  let handler: Handler | undefined;
  const posted: string[] = [];
  const panel = {
    webview: {
      asWebviewUri: (uri: unknown) => uri,
      cspSource: 'test',
      options: {},
      html: '',
      onDidReceiveMessage: (listener: Handler) => { handler = listener; return { dispose() {} }; },
      postMessage: async (message: { type: string }) => { posted.push(message.type); return true; },
    },
    onDidDispose: () => ({ dispose() {} }),
  };
  const document = {
    uri: { fsPath: '/tmp/flows/weekly.flow.json' },
    lineCount: 1,
    getText: () => '',
    save: async () => { log.push('save'); return true; },
  };
  await new FlowEditorProvider(extensionContext).resolveCustomTextEditor(
    document as unknown as vscode.TextDocument,
    panel as unknown as vscode.WebviewPanel,
    {} as vscode.CancellationToken,
  );
  assert.ok(handler, 'the editor listens to its webview');
  return { send: handler, posted };
}

const flow = (name: string) => ({ id: 'weekly', name, description: '', version: 1, created: '', modified: '', inputs: [], nodes: [], edges: [] });
const saved = (posted: string[]) => posted.filter((type) => type === 'flow:saved').length;

let failures = 0;
async function test(name: string, fn: () => Promise<void>): Promise<void> {
  log.length = 0;
  try {
    await fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL ${name}\n       ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function main(): Promise<void> {
  console.log('Sprint 145 R4: a Flow\'s writes');

  await test('a save that comes while another is written is written after it, not dropped', async () => {
    const editor = await openEditor();
    const first = editor.send({ type: 'flow:save', flow: flow('A') });
    const second = editor.send({ type: 'flow:save', flow: flow('B') });
    await Promise.all([first, second]);
    assert.deepEqual(log, ['apply A', 'apply B'], 'both copies, in order: the newer one last');
    assert.equal(saved(editor.posted), 2, 'one answer for each');
  });

  await test("Cmd+S writes the edit the autosave hadn't sent, then saves", async () => {
    const editor = await openEditor();
    await editor.send({ type: 'flow:requestSave', flow: flow('C') });
    assert.deepEqual(log, ['apply C', 'save'], 'the pending copy is in the document before it is saved');
    assert.equal(saved(editor.posted), 1);
  });

  await test('Cmd+S during an autosave saves after that write', async () => {
    const editor = await openEditor();
    const autosave = editor.send({ type: 'flow:save', flow: flow('D') });
    const saveNow = editor.send({ type: 'flow:requestSave' });
    await Promise.all([autosave, saveNow]);
    assert.deepEqual(log, ['apply D', 'save'], "the save holds the autosave's copy");
  });

  await test('Cmd+S with nothing pending saves as before', async () => {
    applyDelayMs = 0;
    const editor = await openEditor();
    await editor.send({ type: 'flow:requestSave' });
    assert.deepEqual(log, ['save']);
    assert.equal(saved(editor.posted), 1);
  });

  if (failures > 0) {
    console.error(`\n${failures} test(s) failed`);
    process.exit(1);
  }
  console.log('flowSaves.test.ts passed');
}

void main();
