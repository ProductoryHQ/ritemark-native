import assert from 'node:assert/strict';
import Module from 'node:module';
import { test } from 'node:test';
import type * as vscode from 'vscode';
import { OfficeDocument } from './officeDocument';

test('Office host accepts feedback for the current read-error card only', async () => {
  const commands: unknown[][] = [];
  const replies: Record<string, unknown>[] = [];
  let receive: (message: unknown) => Promise<void>;
  const watcher = { onDidChange() {}, onDidDelete() {}, dispose() {} };
  const stub = {
    Uri: { joinPath: () => 'office-preview.js' },
    RelativePattern: class {},
    workspace: { createFileSystemWatcher: () => watcher },
    commands: { executeCommand: async (...args: unknown[]) => { commands.push(args); } },
  };
  const loader = Module as unknown as { _load: (name: string, ...args: unknown[]) => unknown };
  const load = loader._load;
  loader._load = (name, ...args) => name === 'vscode' ? stub : load(name, ...args);
  try {
    const { OfficePreviewProvider, WORD_FORMAT, POWERPOINT_FORMAT } = await import('./officePreviewProvider');
    for (const format of [WORD_FORMAT, POWERPOINT_FORMAT]) {
      let enabled = false;
      const provider = new OfficePreviewProvider({} as vscode.ExtensionContext, { ...format, apps: [], enabled: () => enabled });
      const document = new OfficeDocument({ fsPath: '/project/Example.' + format.fileType } as vscode.Uri, Buffer.from('broken'));
      const panel = {
        onDidDispose() {},
        webview: {
          asWebviewUri: (uri: unknown) => uri,
          postMessage: (message: Record<string, unknown>) => { replies.push(message); },
          onDidReceiveMessage: (listener: typeof receive) => { receive = listener; },
        },
      } as unknown as vscode.WebviewPanel;
      await provider.resolveCustomEditor(document, panel, {} as vscode.CancellationToken);
      const request = (options: unknown) => receive({ type: 'office:openFailureFeedback', options });
      const count = commands.length;
      await receive!({ type: 'ready' });
      assert.equal(replies.at(-1)?.feedback, undefined);
      await request({ from: 'failure_card' });
      assert.equal(commands.length, count);

      enabled = true;
      await receive!({ type: 'ready' });
      const card = replies.at(-1)!;
      assert.equal(card.type, 'loadError');
      assert.equal(card.feedback, true);
      const options = { from: 'failure_card', quote: { title: card.title, line: card.detail } };
      for (const invalid of [null, { ...options, from: 'thumb' }, { ...options, quote: { title: 2, line: card.detail } },
        { ...options, quote: { title: card.title, line: 'Could not read /private/Example.docx' } },
        { ...options, quote: { title: card.title, line: 'Error: provider failed' } },
        { ...options, quote: { title: card.title, line: 'Arbitrary words' } }]) {
        await request(invalid);
      }
      assert.equal(commands.length, count);
      await request(options);
      assert.deepEqual(commands.at(-1), ['ritemark.feedback.open', options]);

      enabled = false;
      await receive!({ type: 'ready' });
      await request(options);
      assert.equal(commands.length, count + 1);
    }
  } finally {
    loader._load = load;
  }
});
