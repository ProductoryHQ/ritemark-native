/**
 * Sprint 149 (PR 3): the Publish sheet's host side and its dev harness.
 * - The harness runs only in a development build (`VSCODE_DEV=1`) started with its setting.
 * - The sheet shows over the whole window (PR 5: `_ritemark.webviewSheet`), never as a tab; a shell without it
 *   answers cancel. The sheet gets the model and no real path; Cancel and closing the sheet answer cancel; a plain Publish never skips
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
  html: string;
  send(m: unknown): void;
  /** The workbench closed the sheet (Escape): the view goes and the open command resolves. */
  dispose(): void;
}
const panels: FakePanel[] = [];
const opened: unknown[][] = [];
const sheetCommands: string[] = [];

// The workbench's sheet (patch 018) as far as the extension sees it: a webview view of the registered provider,
// opened by `_ritemark.webviewSheet.open`, gone (onDidDispose) when it closes, the open command then resolving
let provider: { resolveWebviewView(view: unknown): void } | undefined;
let showing: { panel: FakePanel; close(outcome: string): void } | undefined;
function openSheet(request: { viewType: string }): Promise<string> {
  if (showing || !provider || request.viewType !== 'ritemark.sheet.publish') return Promise.resolve('refused');
  return new Promise<string>((resolveOpen) => {
    let onMessage: Listener = () => {};
    const onDispose: Array<() => void> = [];
    const panel: FakePanel = {
      posted: [],
      disposed: false,
      html: '',
      send: (m) => onMessage(m),
      dispose: () => close('escape'),
    };
    const close = (outcome: string) => {
      if (panel.disposed) return;
      panel.disposed = true;
      showing = undefined;
      for (const l of onDispose) l();
      resolveOpen(outcome);
    };
    showing = { panel, close };
    panels.push(panel);
    provider!.resolveWebviewView({
      webview: {
        set html(value: string) { panel.html = value; },
        options: {},
        cspSource: 'vscode-resource:',
        asWebviewUri: (uri: { path: string }) => `webview:${uri.path}`,
        postMessage: async (m: unknown) => { panel.posted.push(m); return true; },
        onDidReceiveMessage: (l: Listener) => { onMessage = l; return { dispose() {} }; },
      },
      onDidDispose: (l: () => void) => { onDispose.push(l); return { dispose() {} }; },
    });
  });
}

const vscodeStub = {
  Uri: {
    joinPath: (base: { path: string }, ...parts: string[]) => ({ path: [base.path, ...parts].join('/') }),
    file: (p: string) => ({ fsPath: p, path: p }),
  },
  ViewColumn: { Active: -1, Beside: -2 },
  Position: class { constructor(public line: number, public character: number) {} },
  Range: class { constructor(public start: unknown, public end: unknown) {} },
  commands: {
    getCommands: async () => ['_ritemark.webviewSheet.open', '_ritemark.webviewSheet.close'],
    executeCommand: async (...args: unknown[]) => {
      if (args[0] === '_ritemark.webviewSheet.open') { sheetCommands.push('open'); return openSheet(args[1] as { viewType: string }); }
      if (args[0] === '_ritemark.webviewSheet.close') {
        sheetCommands.push('close');
        if (!showing) return false;
        showing.close('closed');
        return true;
      }
      opened.push(args);
    },
  },
  window: {
    // the desk the sheet opens over: the active group
    tabGroups: { activeTabGroup: { viewColumn: 2 } },
    registerWebviewViewProvider: (viewType: string, p: { resolveWebviewView(view: unknown): void }) => {
      assert.equal(viewType, 'ritemark.sheet.publish');
      assert.equal(provider, undefined, 'one provider for every sheet');
      provider = p;
      return { dispose() { provider = undefined; } };
    },
    createWebviewPanel: () => { throw new Error('the Publish sheet is never a tab'); },
  },
};
const load = (Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown })._load;
(Module as unknown as { _load: unknown })._load = (request: string, ...rest: unknown[]) => (request === 'vscode' ? vscodeStub : load(request, ...rest));

type Plan = import('./types').PublishPlan;

async function main(): Promise<void> {
  const { harnessPages, openExternalStubbed } = await import('./devSheetHarness');
  assert.equal(openExternalStubbed({ RITEMARK_PUBLISH_STUB_OPEN_EXTERNAL: '1' }), false, 'an installed Ritemark always opens the system browser');
  assert.equal(openExternalStubbed({ VSCODE_DEV: '1' }), false);
  assert.equal(openExternalStubbed({ VSCODE_DEV: '1', RITEMARK_PUBLISH_STUB_OPEN_EXTERNAL: 'yes' }), false);
  assert.equal(openExternalStubbed({ VSCODE_DEV: '1', RITEMARK_PUBLISH_STUB_OPEN_EXTERNAL: '1' }), true);
  const { showPublishSheet } = await import('./PublishSheetPanel');

  // --- the harness runs only in a development build with its setting ---
  assert.deepEqual(harnessPages({ RITEMARK_PUBLISH_SHEET_HARNESS: '/p/a.html' }), [], 'an installed Ritemark (no VSCODE_DEV) never opens it');
  assert.deepEqual(harnessPages({ VSCODE_DEV: '1' }), []);
  assert.deepEqual(harnessPages({ VSCODE_DEV: '1', RITEMARK_PUBLISH_SHEET_HARNESS: '/p/a.html:/p/b.html' }, ':'), ['/p/a.html', '/p/b.html']);

  // --- the sheet's host side ---
  const context = { extensionUri: { path: '/ext' }, subscriptions: [] as unknown[] } as never;
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

  const tick = () => new Promise((r) => setTimeout(r, 0));
  async function shown(): Promise<FakePanel> {
    await tick();
    await tick();
    const panel = panels.at(-1)!;
    assert.ok(panel && !panel.disposed, 'the sheet shows');
    return panel;
  }

  // Ready → the model, with no real path in it; the page is the sheet's (its own height, no background)
  {
    const answer = showPublishSheet(context, plan());
    const panel = await shown();
    assert.ok(panel.html.includes('data-editor-type="publish-sheet"'));
    assert.ok(!/min-height:\s*100%/.test(panel.html), 'the page keeps its own height: the sheet is as tall as the page');
    panel.send({ type: 'publish:sheetReady' });
    assert.equal(panel.posted.length, 1);
    assert.ok(!JSON.stringify(panel.posted).includes('/Users/mari'), 'no real path reaches the sheet');
    panel.send({ type: 'publish:cancel' });
    assert.deepEqual(await answer, { kind: 'cancel' }, 'S16: Cancel answers cancel');
    assert.equal(panel.disposed, true);
  }

  // Closing the sheet (Escape in the workbench) is Cancel
  {
    const answer = showPublishSheet(context, plan());
    (await shown()).dispose();
    assert.deepEqual(await answer, { kind: 'cancel' });
  }

  // A shell without the sheet: no tab instead, the answer is cancel
  {
    const getCommands = vscodeStub.commands.getCommands;
    vscodeStub.commands.getCommands = async () => [];
    assert.deepEqual(await showPublishSheet(context, plan()), { kind: 'cancel' });
    vscodeStub.commands.getCommands = getCommands;
  }

  // A shell without the sheet, as it really answers: its `_ritemark.webviewSheet.*` commands don't exist, so running
  // one rejects. Nothing tries to close a sheet that never opened, and no rejection is left unhandled (Codex on #672)
  {
    const getCommands = vscodeStub.commands.getCommands;
    const executeCommand = vscodeStub.commands.executeCommand;
    vscodeStub.commands.getCommands = async () => [];
    vscodeStub.commands.executeCommand = async (...args: unknown[]) => {
      if (String(args[0]).startsWith('_ritemark.webviewSheet.')) throw new Error(`command '${String(args[0])}' not found`);
      return executeCommand(...args);
    };
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => { unhandled.push(reason); };
    process.on('unhandledRejection', onUnhandled);
    const before = sheetCommands.length;
    assert.deepEqual(await showPublishSheet(context, plan()), { kind: 'cancel' });
    // the close wrapper itself never rejects there: false, whoever calls it
    const { closeWebviewSheet } = await import('../webviewSheet/webviewSheet');
    const closed = await closeWebviewSheet('ritemark.sheet.publish').catch((e: unknown) => `rejected: ${String(e)}`);
    await new Promise((r) => setTimeout(r, 20));
    process.off('unhandledRejection', onUnhandled);
    vscodeStub.commands.getCommands = getCommands;
    vscodeStub.commands.executeCommand = executeCommand;
    assert.deepEqual(unhandled.map(String), [], 'no unhandled rejection on a shell without the sheet');
    assert.equal(sheetCommands.length, before, 'no sheet command runs there');
    assert.equal(closed, false, 'the close wrapper answers false on a shell without the sheet');
  }

  // A quick double press: the second request answers cancel at once and never touches the first, which keeps its
  // sheet, its model and its answer (Codex on #672)
  {
    const opens = sheetCommands.filter((c) => c === 'open').length;
    const firstPlan = plan({ pagePath: '/Users/mari/Leadership programme/First.html' });
    const first = showPublishSheet(context, firstPlan, { address: { page: 'first', suffix: '.x' } });
    const second = showPublishSheet(context, plan(), { address: { page: 'second', suffix: '.x' } });
    assert.deepEqual(await second, { kind: 'cancel' }, 'the second press answers at once');
    const panel = await shown();
    assert.equal(sheetCommands.filter((c) => c === 'open').length, opens + 1, 'one sheet opened, not two');
    panel.send({ type: 'publish:sheetReady' });
    assert.equal((panel.posted[0] as { model: { address: { page: string } } }).model.address.page, 'first', "the sheet shows the first request's page");
    await tick();
    assert.equal(panel.disposed, false, 'the first sheet stays open');
    panel.send({ type: 'publish:confirm', anyway: false, pagePart: 'first' });
    const firstAnswer = await first;
    assert.ok(firstAnswer.kind === 'publish' && firstAnswer.plan === firstPlan, 'and its own answer comes back');
    // once answered, the next request opens its own sheet again
    const third = showPublishSheet(context, plan());
    const again = await shown();
    assert.notEqual(again, panel);
    again.send({ type: 'publish:cancel' });
    assert.deepEqual(await third, { kind: 'cancel' });
  }

  type Opened = { selection: { start: { line: number; character: number }; end: { line: number; character: number } }; viewColumn: number; preview: boolean };
  const keyHits = [
    { projectPath: 'js/script.js', realPath: '/Users/mari/Leadership programme/js/script.js', line: 12, column: 11, endColumn: 59, rule: 'anthropic' },
    { projectPath: 'Harbour programme.html', realPath: '/Users/mari/Leadership programme/Harbour programme.html', line: 3, rule: 'assignment' },
  ];

  // A key-shaped hit: a plain Publish is ignored; only "Publish anyway" answers
  {
    const answer = showPublishSheet(context, plan({ keyHits }));
    const panel = await shown();
    panel.send({ type: 'publish:confirm', anyway: false });
    assert.equal(panel.disposed, false, 'decision 2: one press never publishes past a key warning');
    panel.send({ type: 'publish:openHit', index: 5 });
    panel.send({ type: 'publish:openHit', index: '/etc/passwd' });
    panel.send({ type: 'openFile', path: '/etc/passwd' });
    assert.equal(opened.length, 0, 'nothing but a hit of this plan can be opened');
    assert.equal(panel.disposed, false);
    panel.send({ type: 'publish:confirm', anyway: true });
    const anyway = await answer;
    assert.equal(anyway.kind, 'publishAnyway');
    assert.equal(anyway.kind !== 'cancel' && anyway.pagePart, undefined);
  }

  // Open: closes the sheet without publishing; the file's text on the sheet's desk, the key selected as Find does
  {
    const answer = showPublishSheet(context, plan({ keyHits }));
    const panel = await shown();
    panel.send({ type: 'publish:openHit', index: 0 });
    assert.deepEqual(await answer, { kind: 'cancel' }, 'Open answers cancel: nothing is published');
    await tick();
    assert.equal(panel.disposed, true, 'and the sheet is gone');
    assert.deepEqual(sheetCommands.slice(-1), ['close'], 'closed before the file opens, so the file takes the focus');
    panel.send({ type: 'publish:confirm', anyway: true });
    await tick();
    assert.equal(opened.length, 1);
    assert.equal((opened[0][1] as { fsPath: string }).fsPath, '/Users/mari/Leadership programme/js/script.js');
    assert.equal(opened[0][2], 'default', 'opened as text');
    const o = opened[0][3] as Opened;
    assert.deepEqual([o.selection.start.line, o.selection.start.character, o.selection.end.line, o.selection.end.character], [11, 11, 11, 59], 'the key selected on line 12');
    assert.equal(o.viewColumn, 2, "on the desk the sheet opened over, not beside it");
    assert.equal(o.preview, false, 'a tab of its own');
  }

  // Open on the page's own file: its text in the text editor (not the browser), the caret at the line's start
  {
    const answer = showPublishSheet(context, plan({ keyHits }));
    (await shown()).send({ type: 'publish:openHit', index: 1 });
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
    const panel = await shown();
    panel.send({ type: 'publish:confirm', anyway: true });
    panel.send({ type: 'publish:confirm', anyway: false });
    assert.equal(panel.disposed, false, 'S15: nothing is sent over a limit');
    panel.send({ type: 'publish:cancel' });
    assert.deepEqual(await answer, { kind: 'cancel' });
  }

  // No hits: Publish answers publish, with the plan it showed
  {
    const showedPlan = plan();
    const answer = showPublishSheet(context, showedPlan, { address: { page: 'harbour-programme-7f3a2c', suffix: '.pages-4821.workers.dev', editable: true } });
    (await shown()).send({ type: 'publish:confirm', anyway: false, pagePart: 'harbour-programme-7f3a2c' });
    const done = await answer;
    assert.equal(done.kind, 'publish');
    assert.ok(done.kind !== 'cancel' && done.pagePart === 'harbour-programme-7f3a2c' && done.plan === showedPlan);
  }

  // PR 4: the page part is checked on the host before anything sees it (PR 3's blocking item)
  {
    const answer = showPublishSheet(context, plan(), { address: { page: 'harbour-programme-7f3a2c', suffix: '.pages-4821.workers.dev', editable: true } });
    const panel = await shown();
    for (const bad of ['Harbour', 'harbour-programme', '../x-7f3a2c', 'a'.repeat(60) + '-7f3a2c', 'x-7F3A2C', '-x-7f3a2c', 'x--7f3a2c\n', 'x.y-7f3a2c']) {
      panel.posted.length = 0;
      panel.send({ type: 'publish:confirm', anyway: false, pagePart: bad });
      assert.equal(panel.disposed, false, `${bad}: refused`);
      assert.deepEqual(panel.posted, [{ type: 'publish:refused', reason: 'addressInvalid' }], `${bad}: the sheet says so`);
    }
    panel.send({ type: 'publish:confirm', anyway: false });
    assert.equal(panel.disposed, false, 'no page part at all: refused');
    panel.send({ type: 'publish:cancel' });
    assert.deepEqual(await answer, { kind: 'cancel' });
  }

  // PR 4: onConfirm keeps the sheet open on a refusal, and closes it on its word
  {
    const replies: Array<'refuse' | 'close'> = ['refuse', 'close'];
    const seen: unknown[] = [];
    const answer = showPublishSheet(context, plan(), {
      address: { page: 'harbour-programme-7f3a2c', suffix: '.pages-4821.workers.dev', editable: true },
      nameRow: { suggestion: 'pages-4821' },
      onConfirm: async (c) => {
        seen.push(c);
        const r = replies.shift()!;
        return r === 'refuse' ? { kind: 'refuse', reason: 'nameTaken' } : { kind: 'close' };
      },
    });
    const panel = await shown();
    panel.send({ type: 'publish:confirm', anyway: false, pagePart: 'harbour-programme-7f3a2c', subdomain: 'pages-1111' });
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(panel.disposed, false, 'taken: the sheet stays');
    assert.deepEqual(panel.posted.at(-1), { type: 'publish:refused', reason: 'nameTaken' });
    panel.send({ type: 'publish:confirm', anyway: false, pagePart: 'harbour-programme-7f3a2c', subdomain: 'pages-4822' });
    const done = await answer;
    assert.equal(done.kind, 'publish');
    assert.deepEqual(seen, [
      { anyway: false, pagePart: 'harbour-programme-7f3a2c', subdomain: 'pages-1111' },
      { anyway: false, pagePart: 'harbour-programme-7f3a2c', subdomain: 'pages-4822' },
    ]);
  }

  // PR 4: frame 2 first; Set up carries no value. The sheet steps away while the host's password box asks (the box is
  // VS Code's quick input, which the whole-window sheet would cover), and comes back at the frame it got to
  {
    const settle = () => new Promise((r) => setTimeout(r, 20));
    let runs = 0;
    const sheetWhileAsking: boolean[] = [];
    const later = plan();
    const answer = showPublishSheet(context, null, {
      setup: {
        title: 'Harbour programme',
        run: async () => {
          sheetWhileAsking.push(showing !== undefined);
          return ++runs === 1 ? null : { plan: later, options: {} };
        },
      },
    });
    let panel = await shown();
    panel.send({ type: 'publish:sheetReady' });
    assert.deepEqual(panel.posted.at(-1), { type: 'publish:setup', setup: { waiting: false, line: null } });
    panel.send({ type: 'publish:confirm', anyway: false });
    assert.equal(panel.disposed, false, 'nothing to publish before Set up');
    panel.send({ type: 'publish:setUp' });
    await settle();
    assert.equal(panel.disposed, true, 'Set up: the sheet steps away');
    const first = panel;
    // a second press on the bar while the box asks answers cancel and opens nothing
    assert.deepEqual(await showPublishSheet(context, plan()), { kind: 'cancel' });
    panel = await shown();
    assert.notEqual(panel, first, 'not connected: the sheet comes back');
    first.send({ type: 'publish:confirm', anyway: false });
    panel.send({ type: 'publish:sheetReady' });
    assert.deepEqual(panel.posted.at(-1), { type: 'publish:setup', setup: { waiting: false, line: null } }, 'at frame 2');
    panel.send({ type: 'publish:setUp' });
    await settle();
    panel = await shown();
    panel.send({ type: 'publish:sheetReady' });
    assert.equal((panel.posted.at(-1) as { type: string }).type, 'publish:sheet', 'connected: the sheet comes back at the plan');
    assert.deepEqual(sheetWhileAsking, [false, false], 'no sheet over the password box');
    panel.send({ type: 'publish:confirm', anyway: false });
    const done = await answer;
    assert.ok(done.kind === 'publish' && done.plan === later);
  }

  // Set up's box stopped (the flag went off) or failed: cancel, and the sheet doesn't come back
  for (const run of [async () => ({ stop: true as const }), async () => { throw new Error('box'); }]) {
    const answer = showPublishSheet(context, null, { setup: { title: 'Harbour programme', run } });
    const panel = await shown();
    const opens = sheetCommands.filter((c) => c === 'open').length;
    panel.send({ type: 'publish:setUp' });
    assert.deepEqual(await answer, { kind: 'cancel' });
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(sheetCommands.filter((c) => c === 'open').length, opens, 'no sheet opened again');
    assert.equal(showing, undefined);
  }

  // Escape on frame 2 before Set up is still Cancel
  {
    const answer = showPublishSheet(context, null, { setup: { title: 'Harbour programme', run: async () => null } });
    (await shown()).dispose();
    assert.deepEqual(await answer, { kind: 'cancel' });
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
