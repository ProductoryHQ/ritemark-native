/**
 * Tests for BrowserToolsInjector.getAcpMcpServers.
 *
 * Run: npx tsx src/runtime/BrowserToolsInjector.test.ts
 */

// ── Minimal vscode stub ──────────────────────────────────────────────────────
// BrowserToolsInjector → browserMcpServer → BrowserActionTools imports vscode.
// Pre-populate the require cache before any other imports.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require('module') as {
  _resolveFilename: (request: string, parent: unknown, isMain: boolean) => string;
  _cache: Record<string, unknown>;
};
const vscodeMod = {
  workspace: {
    getConfiguration: () => ({ get: (_key: string, def: unknown) => def }),
  },
  commands: {
    executeCommand: async () => undefined,
  },
};
const _originalResolve = Module._resolveFilename.bind(Module);
Module._resolveFilename = function (request: string, ...rest: [unknown, boolean]) {
  if (request === 'vscode') { return '__vscode_stub__'; }
  return _originalResolve(request, ...rest);
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(require as any).cache['__vscode_stub__'] = {
  id: '__vscode_stub__',
  filename: '__vscode_stub__',
  loaded: true,
  children: [],
  paths: [],
  exports: vscodeMod,
};

// ── Now safe to import vscode-dependent modules ──────────────────────────────
import * as assert from 'assert';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { BrowserToolsInjector } = require('./BrowserToolsInjector') as {
  BrowserToolsInjector: new () => import('./BrowserToolsInjector').BrowserToolsInjector;
};

const injector = new BrowserToolsInjector();

// Test 1: disabled flag returns empty array
{
  const result = injector.getAcpMcpServers(false, '/tmp/test.sock');
  assert.deepStrictEqual(result, [], 'disabled flag must return []');
  console.log('✓ Test 1: getAcpMcpServers(false, ...) returns []');
}

// Test 2: empty ipcPath returns empty array
{
  const result = injector.getAcpMcpServers(true, '');
  assert.deepStrictEqual(result, [], 'empty ipcPath must return []');
  console.log('✓ Test 2: getAcpMcpServers(true, "") returns []');
}

// Test 3: enabled + ipcPath returns a single descriptor with correct shape
{
  const ipcPath = '/tmp/test.sock';
  const result = injector.getAcpMcpServers(true, ipcPath);

  assert.strictEqual(result.length, 1, 'must return exactly one MCP server descriptor');

  const descriptor = result[0] as {
    name: string;
    command: string;
    args: string[];
    env: Array<{ name: string; value: string }>;
  };

  assert.strictEqual(descriptor.name, 'ritemark_browser', 'name must be ritemark_browser');
  assert.strictEqual(descriptor.command, process.execPath, 'command must be the node executable');
  assert.ok(Array.isArray(descriptor.args) && descriptor.args.length === 1, 'args must have one element');
  assert.ok(
    descriptor.args[0].endsWith(path.join('browser', 'browserMcpAdapter.js')),
    `args[0] must end with browser/browserMcpAdapter.js, got: ${descriptor.args[0]}`,
  );

  assert.ok(Array.isArray(descriptor.env) && descriptor.env.length === 1, 'env must have one element');
  assert.deepStrictEqual(descriptor.env[0], { name: 'RITEMARK_IPC', value: ipcPath });

  console.log('✓ Test 3: getAcpMcpServers(true, path) returns correct descriptor');
}

// Test 4: adapter path is an absolute path
{
  const result = injector.getAcpMcpServers(true, '/tmp/test.sock');
  const descriptor = result[0] as { args: string[] };
  assert.ok(path.isAbsolute(descriptor.args[0]), 'adapter path must be absolute');
  console.log('✓ Test 4: adapter path is absolute');
}

console.log('\nAll 4 tests passed!');
