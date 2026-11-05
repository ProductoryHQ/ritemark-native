/**
 * Sprint 149 (PR 3): the Publish sheet's host side and its dev harness.
 * - The harness runs only in a development build (`VSCODE_DEV=1`) started with its setting.
 * - The sheet gets the model and no real path; Cancel and closing the tab answer cancel; a plain Publish never skips
 *   a key warning, and nothing over a limit can be confirmed (decision 2, S14, S15, S16); Open script.js opens only a
 *   hit of the plan's own list, at its line; anything else the page sends is ignored.
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

  // A key-shaped hit: a plain Publish is ignored; only "Publish anyway" answers; Open opens by index, at the line
  {
    const hits = plan({ keyHits: [{ projectPath: 'js/script.js', realPath: '/Users/mari/Leadership programme/js/script.js', line: 12, rule: 'anthropic' }] });
    const answer = showPublishSheet(context, hits);
    const panel = panels.at(-1)!;
    panel.send({ type: 'publish:confirm', anyway: false });
    assert.equal(panel.disposed, false, 'decision 2: one press never publishes past a key warning');
    panel.send({ type: 'publish:openHit', index: 5 });
    panel.send({ type: 'publish:openHit', index: '/etc/passwd' });
    panel.send({ type: 'openFile', path: '/etc/passwd' });
    assert.equal(opened.length, 0, 'nothing but a hit of this plan can be opened');
    panel.send({ type: 'publish:openHit', index: 0 });
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(opened.length, 1);
    assert.equal((opened[0][1] as { fsPath: string }).fsPath, '/Users/mari/Leadership programme/js/script.js');
    assert.equal(opened[0][2], 'default', 'opened as text');
    assert.equal(((opened[0][3] as { selection: { start: { line: number } } }).selection.start.line), 11, 'at line 12');
    panel.send({ type: 'publish:confirm', anyway: true });
    assert.deepEqual(await answer, { kind: 'publishAnyway', pagePart: undefined });
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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
