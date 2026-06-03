/**
 * Tests for Sprint 69 browser action tools.
 *
 * Mocks `vscode.commands.executeCommand` to verify each tool dispatches to
 * the correct workbench command, returns typed results, and never throws on
 * workbench errors. Also exercises codexBrowserTools dispatcher routing.
 */

import { strict as assert } from 'node:assert';
import Module from 'node:module';

// Mock 'vscode' before requiring the units under test. The mock must be
// installed BEFORE the test imports BrowserActionTools (which transitively
// requires 'vscode') — we use require() with this setup at top-level.
interface ExecuteCommandCall {
  command: string;
  args: unknown[];
}
const calls: ExecuteCommandCall[] = [];
let nextReturn: unknown = { pageId: 'p1', url: 'about:blank', summary: 'ok' };
let nextThrow: Error | null = null;

const vscodeStub = {
  commands: {
    executeCommand: async (command: string, ...args: unknown[]) => {
      calls.push({ command, args });
      if (nextThrow) {
        const err = nextThrow;
        nextThrow = null;
        throw err;
      }
      return nextReturn;
    },
  },
};

const moduleAny = Module as unknown as {
  _load: (request: string, parent: unknown, isMain?: boolean) => unknown;
};
const originalLoad = moduleAny._load.bind(Module);
moduleAny._load = (request: string, parent: unknown, isMain?: boolean): unknown => {
  if (request === 'vscode') return vscodeStub;
  return originalLoad(request, parent, isMain);
};

// Require AFTER the mock is installed so import statements don't try to
// resolve 'vscode' before our hook is active.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const actions = require('./BrowserActionTools') as typeof import('./BrowserActionTools');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const codexTools = require('./codexBrowserTools') as typeof import('./codexBrowserTools');

const {
  browserNavigate,
  browserClick,
  browserFill,
  browserType,
  browserScroll,
  browserSnapshot,
  ensureBrowserControlConsent,
  formatActionResultForAgent,
} = actions;

const {
  CODEX_BROWSER_TOOL_NAMES,
  isCodexBrowserToolCall,
  buildCodexBrowserDynamicTools,
  dispatchCodexBrowserToolCall,
} = codexTools;

function resetCalls() {
  calls.length = 0;
  nextReturn = { pageId: 'p1', url: 'about:blank', summary: 'ok' };
  nextThrow = null;
}

async function runTests() {
  // 1. Each tool dispatches to the correct command id with its args.
  resetCalls();
  await browserNavigate({ url: 'https://example.com', type: 'url' });
  assert.equal(calls[0].command, 'workbench.action.browser.agentNavigate');
  assert.deepEqual(calls[0].args[0], { url: 'https://example.com', type: 'url' });

  resetCalls();
  await browserClick({ ref: '@e12', button: 'left' });
  assert.equal(calls[0].command, 'workbench.action.browser.agentClick');
  assert.deepEqual(calls[0].args[0], { ref: '@e12', button: 'left' });

  resetCalls();
  await browserFill({ ref: '@e8', value: 'hello' });
  assert.equal(calls[0].command, 'workbench.action.browser.agentFill');
  assert.deepEqual(calls[0].args[0], { ref: '@e8', value: 'hello' });

  resetCalls();
  await browserType({ text: 'abc' });
  assert.equal(calls[0].command, 'workbench.action.browser.agentType');
  assert.deepEqual(calls[0].args[0], { text: 'abc' });

  resetCalls();
  await browserScroll({ direction: 'down', amount: 400 });
  assert.equal(calls[0].command, 'workbench.action.browser.agentScroll');
  assert.deepEqual(calls[0].args[0], { direction: 'down', amount: 400 });

  resetCalls();
  await browserSnapshot();
  assert.equal(calls[0].command, 'workbench.action.browser.agentSnapshot');
  assert.equal(calls[0].args.length, 0);

  resetCalls();
  await ensureBrowserControlConsent();
  assert.equal(calls[0].command, 'workbench.action.browser.ensureActiveBrowserControlShared');
  assert.equal(calls[0].args.length, 0);

  // 2. Workbench errors surface as `error` on the result (no exception).
  resetCalls();
  nextThrow = new Error('boom from workbench');
  const errored = await browserClick({ ref: '@e1' });
  assert.equal(errored.error, 'boom from workbench');
  assert.equal(errored.summary, undefined);

  // 3. Non-object workbench result surfaces as a typed error string.
  resetCalls();
  nextReturn = 'not an object';
  const malformed = await browserNavigate({ url: 'x' });
  assert.ok(malformed.error && malformed.error.includes('unexpected result'));

  // 4. formatActionResultForAgent produces a human-readable block.
  const formattedOk = formatActionResultForAgent({
    pageId: 'p1',
    url: 'https://example.com',
    title: 'Example',
    summary: '- heading "Hello"',
  });
  assert.ok(formattedOk.includes('URL: https://example.com'));
  assert.ok(formattedOk.includes('Page summary after action'));
  assert.ok(formattedOk.includes('Hello'));

  const formattedErr = formatActionResultForAgent({ error: 'Bad' });
  assert.ok(formattedErr.startsWith('Error: Bad'));

  // 5. Codex dynamicTools list shape.
  const dynamicTools = buildCodexBrowserDynamicTools();
  assert.equal(dynamicTools.length, 6);
  for (const tool of dynamicTools) {
    assert.match(tool.name, /^[a-zA-Z0-9_-]+$/, `tool name ${tool.name} must match Codex naming rule`);
    assert.ok(tool.name.startsWith('ritemark_browser_'), `tool name ${tool.name} must use ritemark_browser_ prefix`);
    assert.equal(typeof tool.description, 'string');
    assert.equal(tool.inputSchema.type, 'object');
  }

  // 6. isCodexBrowserToolCall narrows the toolName union correctly.
  assert.equal(isCodexBrowserToolCall('ritemark_browser_click'), true);
  assert.equal(isCodexBrowserToolCall('browser_click'), false);
  assert.equal(isCodexBrowserToolCall('shell'), false);

  // 7. dispatchCodexBrowserToolCall routes by name, returns { text, success }.
  resetCalls();
  nextReturn = { pageId: 'p1', url: 'https://example.com', summary: 'after-click' };
  const dispatched = await dispatchCodexBrowserToolCall('ritemark_browser_click', { ref: '@e3' });
  assert.equal(dispatched.success, true);
  assert.ok(dispatched.text.includes('after-click'));
  assert.equal(calls[0].command, 'workbench.action.browser.agentClick');

  // 8. dispatchCodexBrowserToolCall reports failure as success=false.
  resetCalls();
  nextReturn = { error: 'no consent' };
  const failed = await dispatchCodexBrowserToolCall('ritemark_browser_navigate', { url: 'x' });
  assert.equal(failed.success, false);
  assert.ok(failed.text.includes('no consent'));

  // 8b. ritemark_browser_snapshot dispatches to agentSnapshot (no args needed).
  resetCalls();
  nextReturn = { pageId: 'p1', url: 'https://example.com', title: 'Example', summary: 'snapshot-tree' };
  const snapshotResult = await dispatchCodexBrowserToolCall('ritemark_browser_snapshot', {});
  assert.equal(snapshotResult.success, true);
  assert.ok(snapshotResult.text.includes('snapshot-tree'));
  assert.equal(calls[0].command, 'workbench.action.browser.agentSnapshot');

  // 9. CODEX_BROWSER_TOOL_NAMES is the same set surfaced by buildCodexBrowserDynamicTools().
  const namesFromTools = dynamicTools.map((t) => t.name);
  assert.deepEqual([...CODEX_BROWSER_TOOL_NAMES].sort(), namesFromTools.slice().sort());

  console.log('All browser action tool tests passed.');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
