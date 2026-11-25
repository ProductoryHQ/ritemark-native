import assert from 'node:assert/strict';
import path from 'node:path';
import type * as vscode from 'vscode';
import { makeTempDir } from './testing/tempDir';
import { rmSync } from 'node:fs';

const Module = require('node:module') as { _resolveFilename(request: string, ...rest: unknown[]): string };
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  return request === 'vscode' ? '__vscode_stub__' : resolveFilename.call(this, request, ...rest);
};
function stubModule(id: string, exports: unknown): void {
  require.cache[id] = { id, filename: id, loaded: true, exports } as NodeJS.Module;
}

const disposable = () => ({ dispose() {} });
const uri = (fsPath: string) => ({ fsPath, scheme: 'file', toString: () => `file://${fsPath}` });
function statusItem(priority: number) {
  return {
    priority, text: '', visible: false,
    show() { this.visible = true; },
    hide() { this.visible = false; },
    dispose() { this.hide(); },
  };
}
const items: ReturnType<typeof statusItem>[] = [];
let provider: vscode.CustomTextEditorProvider;
stubModule('__vscode_stub__', {
  Uri: { file: uri, joinPath: (base: { fsPath: string }, ...parts: string[]) => uri(path.join(base.fsPath, ...parts)) },
  RelativePattern: class {},
  EventEmitter: class { fire() {} dispose() {} },
  StatusBarAlignment: { Right: 2 },
  window: {
    createStatusBarItem: (...args: unknown[]) => {
      const item = statusItem(args.at(-1) as number);
      items.push(item);
      return item;
    },
    registerCustomEditorProvider: (_id: string, editor: vscode.CustomTextEditorProvider) => {
      provider = editor;
      return disposable();
    },
  },
  workspace: {
    getConfiguration: () => ({ get: (key: string) => key === 'decks' ? true : undefined }),
    getWorkspaceFolder: () => undefined,
    onDidRenameFiles: disposable,
    onDidSaveTextDocument: disposable,
    onDidChangeTextDocument: disposable,
    registerTextDocumentContentProvider: disposable,
    createFileSystemWatcher: () => ({ ...disposable(), onDidChange: disposable, onDidDelete: disposable }),
  },
  commands: { registerCommand: disposable },
});
stubModule(require.resolve('./analytics/posthog'), { trackEvent() {} });
const { DeckPages } = require('./decks/deckPages') as typeof import('./decks/deckPages');
const pages = new DeckPages();
stubModule(require.resolve('./extension'), { decks: { pages } });
const { RitemarkEditorProvider } = require('./ritemarkEditor') as typeof import('./ritemarkEditor');

function panelFixture() {
  const viewStateListeners: Array<(event: { webviewPanel: unknown }) => void> = [];
  let receive: (message: unknown) => void;
  let dispose: () => void;
  const panel = {
    active: false,
    webview: {
      asWebviewUri: (value: unknown) => value,
      onDidReceiveMessage: (listener: typeof receive) => { receive = listener; return disposable(); },
    },
    onDidChangeViewState: (listener: typeof viewStateListeners[number]) => {
      viewStateListeners.push(listener);
      return disposable();
    },
    onDidDispose: (listener: () => void) => { dispose = listener; return disposable(); },
  };
  return {
    panel: panel as unknown as vscode.WebviewPanel,
    active(value: boolean) {
      panel.active = value;
      for (const listen of viewStateListeners) listen({ webviewPanel: panel });
    },
    count: () => receive({ type: 'wordCountChanged', wordCount: 42, equationCount: 1 }),
    dispose: () => dispose?.(),
  };
}

async function main(): Promise<void> {
  const root = makeTempDir('rm-word-count-');
  const subscriptions: vscode.Disposable[] = [];
  const context = { extensionUri: uri(root), subscriptions } as unknown as vscode.ExtensionContext;
  const notes = panelFixture();
  const deck = panelFixture();
  const document = (name: string, text: string) => ({
    uri: uri(path.join(root, name)), getText: () => text,
  }) as unknown as vscode.TextDocument;
  try {
    subscriptions.push(RitemarkEditorProvider.register(context, {} as never));
    const token = {} as vscode.CancellationToken;
    await provider.resolveCustomTextEditor(document('Notes.md', 'Notes'), notes.panel, token);
    await provider.resolveCustomTextEditor(document('Training.rtms', '```slide points\ntitle: Practice\n```\n'), deck.panel, token);
    const [words] = items;
    notes.active(true);
    notes.count();
    assert.equal(words.visible, true);
    assert.equal(words.text, '42 words · 1 equation');
    notes.active(false);
    deck.active(true);
    deck.count();
    const [, length] = items;
    assert.equal(words.visible, false, 'a deck word count must stay hidden');
    assert.equal(length.visible, true);
    assert.equal(length.text, '1 slide');
    assert.equal(length.priority, words.priority);
    deck.active(false);
    notes.active(true);
    assert.equal(length.visible, false);
    assert.equal(words.visible, true);
    assert.equal(words.text, '42 words · 1 equation');
  } finally {
    deck.dispose();
    notes.dispose();
    for (const subscription of subscriptions) subscription.dispose();
    pages.dispose();
    rmSync(root, { recursive: true, force: true });
  }
}

void main().then(() => console.log('editor status bar: deck length and document counts passed')).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
