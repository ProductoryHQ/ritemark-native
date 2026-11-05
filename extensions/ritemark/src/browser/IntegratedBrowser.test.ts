/**
 * Sprint 149, PR 2, round 2b: "Ritemark Browser: Open in System Browser" with an address typed into its box never
 * hands a file on this computer to the system's opener; it goes through `ritemark.page.openInSystemBrowser`.
 *
 * Run: npx tsx src/browser/IntegratedBrowser.test.ts
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require('module') as {
  _resolveFilename: (request: string, parent: unknown, isMain: boolean) => string;
};

const calls: string[] = [];
const vscodeMod = {
  commands: {
    executeCommand: async (command: string, ...args: unknown[]) => { calls.push(`command ${command} ${args.map(String).join(' ')}`.trim()); },
  },
  env: {
    openExternal: async (uri: { toString(): string }) => { calls.push(`openExternal ${uri.toString()}`); return true; },
  },
  Uri: { parse: (value: string) => ({ toString: () => value }) },
};
const _originalResolve = Module._resolveFilename.bind(Module);
Module._resolveFilename = function (request: string, ...rest: [unknown, boolean]) {
  if (request === 'vscode') { return '__vscode_stub__'; }
  return _originalResolve(request, ...rest);
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(require as any).cache['__vscode_stub__'] = {
  id: '__vscode_stub__', filename: '__vscode_stub__', loaded: true, children: [], paths: [], exports: vscodeMod,
};

import * as assert from 'assert';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const browser = require('./IntegratedBrowser') as typeof import('./IntegratedBrowser');

async function run(): Promise<void> {
  await browser.openIntegratedBrowserUrlExternally('file:///Users/mari/proj/index.html');
  await browser.openIntegratedBrowserUrlExternally('  FILE:///Users/mari/proj/run.command ');
  await browser.openIntegratedBrowserUrlExternally('example.com/page');
  await browser.openIntegratedBrowserUrlExternally();
  assert.deepStrictEqual(calls, [
    'command ritemark.page.openInSystemBrowser file:///Users/mari/proj/index.html',
    'command ritemark.page.openInSystemBrowser FILE:///Users/mari/proj/run.command',
    'openExternal https://example.com/page',
    'command workbench.action.browser.openExternal', // the tab's address, routed in patch 010
  ]);
  console.log('IntegratedBrowser.test.ts: all passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
