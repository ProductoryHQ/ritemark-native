/**
 * Sprint 149 (PR 3): the Publish sheet's host side and its dev harness.
 * - The harness runs only in a development build (`VSCODE_DEV=1`) started with its setting.
 * - The sheet gets the model and no real path; Cancel and closing the tab answer cancel; a plain Publish never skips
 *   a key warning, and nothing over a limit can be confirmed (decision 2, S14, S15, S16); Open script.js opens only a
 *   hit of the plan's own list; anything else the page sends is ignored.
 * - Open closes the sheet without publishing and opens the file's text (a page's too) as a tab on the sheet's desk,
 *   with the key selected when its columns are known, else the caret at the line's start (the lead, 5 November).
 *
 * Run: npx tsx src/publish/devSheetHarness.test.ts
 */

import assert from 'node:assert/strict';
import Module from 'node:module';

type Listener = (m: unknown) => void;
interface FakePanel {
  posted: unknown[];
  disposed: boolean;
  send(m: unknown): void;
  dispose(): void;
}
const panels: FakePanel[] = [];
const opened: unknown[][] = [];

const vscodeStub = {
  Uri: {
    joinPath: (base: { path: string }, ...parts: string[]) => ({ path: [base.path, ...parts].join('/') }),
    file: (p: string) => ({ fsPath: p, path: p }),
  },
  ViewColumn: { Active: -1, Beside: -2 },
  Position: class { constructor(public line: number, public character: number) {} },
  Range: class { constructor(public start: unknown, public end: unknown) {} },
  commands: { executeCommand: async (...args: unknown[]) => { opened.push(args); } },
  window: {
    createWebviewPanel: () => {
      let onMessage: Listener = () => {};
      let onDispose: () => void = () => {};
      const panel: FakePanel = {
        posted: [],
        disposed: false,
        send: (m) => onMessage(m),
        dispose: () => { if (!panel.disposed) { panel.disposed = true; onDispose(); } },
      };
      panels.push(panel);
      return {
        webview: {
          html: '',
          cspSource: 'vscode-resource:',
          asWebviewUri: (uri: { path: string }) => `webview:${uri.path}`,
          postMessage: async (m: unknown) => { panel.posted.push(m); return true; },
          onDidReceiveMessage: (l: Listener) => { onMessage = l; return { dispose() {} }; },
        },
        onDidDispose: (l: () => void) => { onDispose = l; return { dispose() {} }; },
        dispose: () => panel.dispose(),
        viewColumn: 2,
      };
    },
  },
};
const load = (Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown })._load;
(Module as unknown as { _load: unknown })._load = (request: string, ...rest: unknown[]) => (request === 'vscode' ? vscodeStub : load(request, ...rest));

type Plan = import('./types').PublishPlan;

async function main(): Promise<void> {
  const { harnessPages } = await import('./devSheetHarness');
  const { showPublishSheet } = await import('./PublishSheetPanel');

  // --- the harness runs only in a development build with its setting ---
  assert.deepEqual(harnessPages({ RITEMARK_PUBLISH_SHEET_HARNESS: '/p/a.html' }), [], 'an installed Ritemark (no VSCODE_DEV) never opens it');
  assert.deepEqual(harnessPages({ VSCODE_DEV: '1' }), []);
  assert.deepEqual(harnessPages({ VSCODE_DEV: '1', RITEMARK_PUBLISH_SHEET_HARNESS: '/p/a.html:/p/b.html' }, ':'), ['/p/a.html', '/p/b.html']);

  // --- the sheet's host side ---
  const context = { extensionUri: { path: '/ext' } } as never;
  function plan(over: Partial<Plan> = {}): Plan {
    return {
      pagePath: '/Users/mari/Leadership programme/Harbour programme.html',
      projectFolder: '/Users/mari/Leadership programme',
      root: '/Users/mari/Leadership programme',
      files: [{ relPath: 'Harbour programme.html', projectPath: 'Harbour programme.html', realPath: '/Users/mari/Leadership programme/Harbour programme.html', kind: 'page', size: 10, sha256: 'a' }],
      leftOut: [],
      scriptBuilt: false,
      tooBig: [],
      tooMany: false,
      keyHits: [],
      contentHash: 'h',
      ...over,
    };
  }

  // Ready → the model, with no real path in it
  {
    const answer = showPublishSheet(context, plan());
    const panel = panels.at(-1)!;
    panel.send({ type: 'publish:sheetReady' });
    assert.equal(panel.posted.length, 1);
    assert.ok(!JSON.stringify(panel.posted).includes('/Users/mari'), 'no real path reaches the sheet');
    panel.send({ type: 'publish:cancel' });
    assert.deepEqual(await answer, { kind: 'cancel' }, 'S16: Cancel answers cancel');
    assert.equal(panel.disposed, true);
  }

  // Closing the tab is Cancel
  {
    const answer = showPublishSheet(context, plan());
    panels.at(-1)!.dispose();
    assert.deepEqual(await answer, { kind: 'cancel' });
  }

  type Opened = { selection: { start: { line: number; character: number }; end: { line: number; character: number } }; viewColumn: number; preview: boolean };
  const keyHits = [
    { projectPath: 'js/script.js', realPath: '/Users/mari/Leadership programme/js/script.js', line: 12, column: 11, endColumn: 59, rule: 'anthropic' },
    { projectPath: 'Harbour programme.html', realPath: '/Users/mari/Leadership programme/Harbour programme.html', line: 3, rule: 'assignment' },
  ];

  // A key-shaped hit: a plain Publish is ignored; only "Publish anyway" answers
  {
    const answer = showPublishSheet(context, plan({ keyHits }));
    const panel = panels.at(-1)!;
    panel.send({ type: 'publish:confirm', anyway: false });
    assert.equal(panel.disposed, false, 'decision 2: one press never publishes past a key warning');
    panel.send({ type: 'publish:openHit', index: 5 });
    panel.send({ type: 'publish:openHit', index: '/etc/passwd' });
    panel.send({ type: 'openFile', path: '/etc/passwd' });
    assert.equal(opened.length, 0, 'nothing but a hit of this plan can be opened');
    assert.equal(panel.disposed, false);
    panel.send({ type: 'publish:confirm', anyway: true });
    assert.deepEqual(await answer, { kind: 'publishAnyway', pagePart: undefined });
  }

  // Open: closes the sheet without publishing; the file's text on the sheet's desk, the key selected as Find does
  {
    const answer = showPublishSheet(context, plan({ keyHits }));
    const panel = panels.at(-1)!;
    panel.send({ type: 'publish:openHit', index: 0 });
    assert.deepEqual(await answer, { kind: 'cancel' }, 'Open answers cancel: nothing is published');
    assert.equal(panel.disposed, true, 'and the sheet is gone');
    panel.send({ type: 'publish:confirm', anyway: true });
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(opened.length, 1);
    assert.equal((opened[0][1] as { fsPath: string }).fsPath, '/Users/mari/Leadership programme/js/script.js');
    assert.equal(opened[0][2], 'default', 'opened as text');
    const o = opened[0][3] as Opened;
    assert.deepEqual([o.selection.start.line, o.selection.start.character, o.selection.end.line, o.selection.end.character], [11, 11, 11, 59], 'the key selected on line 12');
    assert.equal(o.viewColumn, 2, "on the sheet's desk, not beside it");
    assert.equal(o.preview, false, 'a tab of its own');
  }

  // Open on the page's own file: its text in the text editor (not the browser), the caret at the line's start
  {
    const answer = showPublishSheet(context, plan({ keyHits }));
    panels.at(-1)!.send({ type: 'publish:openHit', index: 1 });
    assert.deepEqual(await answer, { kind: 'cancel' });
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(opened.length, 2);
    assert.equal((opened[1][1] as { fsPath: string }).fsPath, '/Users/mari/Leadership programme/Harbour programme.html');
    assert.equal(opened[1][2], 'default', "the page's text, not the page");
    const o = opened[1][3] as Opened;
    assert.deepEqual([o.selection.start.line, o.selection.start.character, o.selection.end.character], [2, 0, 0], 'no columns: the caret at the line start');
  }

  // Over a limit: nothing can be confirmed
  {
    const answer = showPublishSheet(context, plan({ tooBig: [{ projectPath: 'clip.mp4', size: 30 * 1024 * 1024 }] }));
    const panel = panels.at(-1)!;
    panel.send({ type: 'publish:confirm', anyway: true });
    panel.send({ type: 'publish:confirm', anyway: false });
    assert.equal(panel.disposed, false, 'S15: nothing is sent over a limit');
    panel.send({ type: 'publish:cancel' });
    assert.deepEqual(await answer, { kind: 'cancel' });
  }

  // No hits: Publish answers publish
  {
    const answer = showPublishSheet(context, plan(), { address: { page: 'harbour-programme-7f3a2c', suffix: '.pages-4821.workers.dev' } });
    panels.at(-1)!.send({ type: 'publish:confirm', anyway: false, pagePart: 'harbour-programme-7f3a2c' });
    assert.deepEqual(await answer, { kind: 'publish', pagePart: 'harbour-programme-7f3a2c' });
  }

  console.log('devSheetHarness.test: passed');
  finished = true;
}

// A sheet that never answers leaves a promise pending and Node would end quietly with 0: that is a failure here
let finished = false;
process.on('beforeExit', () => {
  if (!finished) {
    console.error('FAIL devSheetHarness.test: a sheet never answered');
    process.exit(1);
  }
});

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
