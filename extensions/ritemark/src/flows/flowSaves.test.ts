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
let openDocument: { isClosed: boolean } | undefined;
class WorkspaceEdit {
  content = '';
  renamedTo: { fsPath: string } | undefined;
  replace(_uri: unknown, _range: unknown, content: string) { this.content = content; }
  renameFile(_from: unknown, to: { fsPath: string }) { this.renamedTo = to; }
}
const vscodeMod = {
  workspace: {
    getConfiguration: () => ({ get: (_key: string, def: unknown) => def }),
    workspaceFolders: undefined,
    openTextDocument: async (uri: { fsPath: string }) => ({ save: async () => { log.push(`save ${uri.fsPath}`); return true; } }),
    applyEdit: async (edit: WorkspaceEdit) => {
      await new Promise((resolve) => setTimeout(resolve, applyDelayMs));
      if (edit.renamedTo) {
        // VS Code closes the renamed file's old document and opens the new one
        if (openDocument) openDocument.isClosed = true;
        log.push(`rename ${edit.renamedTo.fsPath}`);
      } else {
        log.push(`apply ${(JSON.parse(edit.content) as { name: string }).name}`);
      }
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
type Posted = { type: string; seq?: unknown };

/** An open flow editor: its message handler, what it posted, and its document's saves in `log`. */
async function openEditor(fsPath = '/tmp/flows/weekly.flow.json'): Promise<{ send: Handler; posted: Posted[] }> {
  let handler: Handler | undefined;
  const posted: Posted[] = [];
  const panel = {
    webview: {
      asWebviewUri: (uri: unknown) => uri,
      cspSource: 'test',
      options: {},
      html: '',
      onDidReceiveMessage: (listener: Handler) => { handler = listener; return { dispose() {} }; },
      postMessage: async (message: Posted) => { posted.push(message); return true; },
    },
    onDidDispose: () => ({ dispose() {} }),
  };
  const document = {
    uri: { fsPath },
    lineCount: 1,
    isClosed: false,
    getText: () => '',
    save: async () => { log.push(document.isClosed ? 'save on a closed document' : 'save'); return !document.isClosed; },
  };
  openDocument = document;
  await new FlowEditorProvider(extensionContext).resolveCustomTextEditor(
    document as unknown as vscode.TextDocument,
    panel as unknown as vscode.WebviewPanel,
    {} as vscode.CancellationToken,
  );
  assert.ok(handler, 'the editor listens to its webview');
  return { send: handler, posted };
}

const flow = (name: string) => ({ id: 'weekly', name, description: '', version: 1, created: '', modified: '', inputs: [], nodes: [], edges: [] });
const saved = (posted: Posted[]) => posted.filter((m) => m.type === 'flow:saved');

let failures = 0;
async function test(name: string, fn: () => Promise<void>): Promise<void> {
  log.length = 0;
  applyDelayMs = 40; // every case writes slowly enough to overlap, unless it says otherwise
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
    assert.equal(saved(editor.posted).length, 2, 'one answer for each');
  });

  await test("Cmd+S writes the edit the autosave hadn't sent, then saves", async () => {
    const editor = await openEditor();
    await editor.send({ type: 'flow:requestSave', flow: flow('C'), seq: 7 });
    assert.deepEqual(log, ['apply C', 'save'], 'the pending copy is in the document before it is saved');
    assert.deepEqual(saved(editor.posted).map((m) => m.seq), [7], 'its answer names the request');
    assert.ok(editor.posted.some((m) => m.type === 'flow:validation'), "the flow's warnings follow the write, as after an autosave");
  });

  await test('Cmd+S during an autosave saves after that write', async () => {
    const editor = await openEditor();
    const autosave = editor.send({ type: 'flow:save', flow: flow('D') });
    const saveNow = editor.send({ type: 'flow:requestSave' });
    await Promise.all([autosave, saveNow]);
    assert.deepEqual(log, ['apply D', 'save'], "the save holds the autosave's copy");
  });

  await test('Cmd+S with nothing pending saves as before', async () => {
    const editor = await openEditor();
    await editor.send({ type: 'flow:requestSave', seq: 1 });
    assert.deepEqual(log, ['save']);
    assert.equal(saved(editor.posted).length, 1);
    assert.ok(!editor.posted.some((m) => m.type === 'flow:validation'), 'nothing written, nothing to check');
  });

  await test("each answer names the request it answers, so an older one can't mark a newer one saved", async () => {
    const editor = await openEditor();
    await Promise.all([editor.send({ type: 'flow:save', flow: flow('E'), seq: 1 }), editor.send({ type: 'flow:save', flow: flow('F'), seq: 2 })]);
    assert.deepEqual(saved(editor.posted).map((m) => m.seq), [1, 2]);
  });

  await test('Cmd+S with a new name saves the renamed file', async () => {
    // A file with a short id is renamed after its flow's name; the rename closes the document the editor opened
    const editor = await openEditor('/tmp/flows/weekly-ab12.flow.json');
    await editor.send({ type: 'flow:requestSave', flow: { ...flow('Monthly'), id: 'weekly-ab12' }, seq: 3 });
    assert.deepEqual(log, ['apply Monthly', 'rename /tmp/flows/monthly-ab12.flow.json', 'save /tmp/flows/monthly-ab12.flow.json'],
      'written, renamed, and the renamed file saved, not the closed document');
    assert.deepEqual(saved(editor.posted).map((m) => m.seq), [3]);
  });

  if (failures > 0) {
    console.error(`\n${failures} test(s) failed`);
    process.exit(1);
  }
  console.log('flowSaves.test.ts passed');
}

void main();
