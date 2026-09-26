/**
 * Tests for CodexManager: the npm repair command for a system install, and the
 * bundled runtime getting reinstall advice instead of npm.
 *
 * Run: npx tsx src/codex/codexManager.test.ts
 */

// ── Minimal vscode stub ──────────────────────────────────────────────────────
// featureGate.ts does `import * as vscode from 'vscode'` at module load, and the
// runtime preference is read from settings; stub both before loading the module
// (same pattern as CodexRuntime.test.ts).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require('module') as {
  _resolveFilename: (request: string, parent: unknown, isMain: boolean) => string;
};
let preference: 'bundled' | 'system' = 'bundled';
const vscodeMod = {
  workspace: {
    getConfiguration: () => ({
      get: (key: string, def: unknown) => (key === 'agentRuntime.preference' ? preference : def),
    }),
  },
};
const _originalResolve = Module._resolveFilename.bind(Module);
Module._resolveFilename = function (request: string, ...rest: [unknown, boolean]) {
  if (request === 'vscode') return '__vscode_stub__';
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

import assert from 'assert';
import * as os from 'os';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { CodexManager } = require('./codexManager') as typeof import('./codexManager');

const buildRepairCommandFor = CodexManager.buildRepairCommandFor;

// ── BUG REPRO: Apple Silicon Mac, x64 Node v23 via Rosetta ──
// Codex installed under x64 Node v23, Ritemark runs arm64 Node v22.
// Must: uninstall from v23, install @darwin-arm64 under v22.
{
  const cmd = buildRepairCommandFor({
    platform: 'darwin',
    installNodeVersion: '23.0.0',
    installNodeArch: 'x86_64',
    runtimeNodeVersion: '22.21.1',
    machineArch: 'arm64',
  });

  assert.ok(cmd.includes('npm install -g @openai/codex\''), `Should install plain @openai/codex (no platform tag), got: ${cmd}`);
  assert.ok(!cmd.includes('@darwin-arm64'), `Must NOT use platform tag (only installs addon, not CLI), got: ${cmd}`);
  assert.ok(cmd.includes('nvm use 23.0.0'), `Should uninstall from install Node, got: ${cmd}`);
  assert.ok(cmd.includes('nvm use 22.21.1'), `Should install under runtime Node, got: ${cmd}`);
  assert.ok(cmd.includes('arch -arm64'), `Should use arch wrapper for arm64, got: ${cmd}`);
  const uninstallPos = cmd.indexOf('nvm use 23.0.0');
  const installPos = cmd.indexOf('nvm use 22.21.1');
  assert.ok(uninstallPos < installPos, `Uninstall (v23) must come before install (v22), got: ${cmd}`);
}

// ── Apple Silicon Mac, native arm64 Node, same version ──
{
  const cmd = buildRepairCommandFor({
    platform: 'darwin',
    installNodeVersion: '22.21.1',
    installNodeArch: 'arm64',
    runtimeNodeVersion: '22.21.1',
    machineArch: 'arm64',
  });

  assert.ok(cmd.includes('npm install -g @openai/codex\''), `Should install plain package, got: ${cmd}`);
  assert.ok(cmd.includes('arch -arm64'), `Should use arch wrapper, got: ${cmd}`);
}

// ── Windows ──
{
  const cmd = buildRepairCommandFor({
    platform: 'win32',
    installNodeVersion: null,
    installNodeArch: null,
    runtimeNodeVersion: '22.21.1',
    machineArch: 'x64',
  });

  assert.ok(cmd.includes('npm install -g @openai/codex'), `Should install plain package, got: ${cmd}`);
  assert.ok(!cmd.includes('nvm'), `Windows should not use nvm, got: ${cmd}`);
}

// ── Fresh install (no existing codex) ──
{
  const cmd = buildRepairCommandFor({
    platform: 'darwin',
    installNodeVersion: null,
    installNodeArch: null,
    runtimeNodeVersion: '22.21.1',
    machineArch: 'arm64',
  });

  assert.ok(cmd.includes('npm install -g @openai/codex'), `Should install plain package, got: ${cmd}`);
  assert.ok(cmd.includes('arch -arm64'), `Should use arch wrapper, got: ${cmd}`);
}

// ── Intel Mac ──
{
  const cmd = buildRepairCommandFor({
    platform: 'darwin',
    installNodeVersion: '20.0.0',
    installNodeArch: 'x86_64',
    runtimeNodeVersion: '20.0.0',
    machineArch: 'x86_64',
  });

  assert.ok(cmd.includes('npm install -g @openai/codex'), `Should install plain package, got: ${cmd}`);
}

// ── Bundled vs system: npm advice belongs to the user's own install only ──

type Resolved = {
  binaryPath: string;
  runtimeSource: 'bundled' | 'system';
  launchMode: 'codex-app-server' | 'codex-cli';
} | null;

/** A manager whose resolver returns `binary`, so no real Codex is involved. */
function managerResolving(binary: Resolved) {
  const manager = new CodexManager();
  (manager as unknown as { findBinary: () => Promise<Resolved> }).findBinary = async () => binary;
  return manager;
}

async function testRuntimeSourcePolicy() {
  // The bundled copy is missing (default preference): reinstall Ritemark, no npm.
  {
    preference = 'bundled';
    const status = await managerResolving(null).getBinaryStatus();
    assert.strictEqual(status.available, false);
    assert.strictEqual(status.repairCommand, null, 'the bundled runtime has no repair command');
    assert.ok(status.error?.includes('Reinstall Ritemark'), `should advise reinstalling Ritemark, got: ${status.error}`);
    assert.ok(!status.error?.includes('npm'), `must not advise npm, got: ${status.error}`);
  }

  // Nothing found with the system preference: check your own install, or reinstall.
  {
    preference = 'system';
    const status = await managerResolving(null).getBinaryStatus();
    assert.strictEqual(status.available, false);
    assert.ok(status.repairCommand?.includes('npm install -g @openai/codex'), `got: ${status.repairCommand}`);
    assert.ok(status.error?.includes('npm install -g @openai/codex'), `got: ${status.error}`);
    assert.ok(status.error?.includes('reinstall Ritemark'), `got: ${status.error}`);
  }

  // A bundled runtime that cannot start: no npm command, and the error says how to restore it.
  {
    preference = 'bundled';
    const binaryPath = path.join(os.tmpdir(), 'ritemark-codex-test', 'binaries', 'agents', 'none', 'codex', 'bin', 'codex-app-server');
    const status = await managerResolving({ binaryPath, runtimeSource: 'bundled', launchMode: 'codex-app-server' }).getBinaryStatus();
    assert.strictEqual(status.available, true);
    assert.strictEqual(status.runnable, false);
    assert.strictEqual(status.repairCommand, null, 'the bundled runtime has no repair command');
    assert.ok(status.error?.includes('Reinstall Ritemark'), `should advise reinstalling Ritemark, got: ${status.error}`);
  }

  // A system install that cannot start keeps its npm repair command.
  {
    preference = 'system';
    const binaryPath = path.join(os.tmpdir(), 'ritemark-codex-test', 'system', 'codex-app-server');
    const status = await managerResolving({ binaryPath, runtimeSource: 'system', launchMode: 'codex-app-server' }).getBinaryStatus();
    assert.strictEqual(status.runnable, false);
    assert.ok(status.repairCommand?.includes('npm install -g @openai/codex'), `got: ${status.repairCommand}`);
    assert.ok(!status.error?.includes('Reinstall Ritemark'), `a system install is not restored by reinstalling Ritemark, got: ${status.error}`);
  }
}

testRuntimeSourcePolicy()
  .then(() => console.log('codexManager.test.ts: all tests passed'))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
