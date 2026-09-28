/**
 * Tests for CodexManager: the npm repair command for a system install, the
 * bundled runtime getting reinstall advice instead of npm, and the binary
 * probes running without blocking the extension host.
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
import * as fs from 'fs';
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
    // A native binary: no npm-install Node.js diagnostics.
    assert.ok(!status.diagnostics.some(line => /Global install|Node v/.test(line)), `got: ${status.diagnostics.join(' | ')}`);
  }

  // A system install that cannot start keeps its npm repair command.
  {
    preference = 'system';
    const binaryPath = path.join(os.tmpdir(), 'ritemark-codex-test', 'system', 'codex-app-server');
    const status = await managerResolving({ binaryPath, runtimeSource: 'system', launchMode: 'codex-app-server' }).getBinaryStatus();
    assert.strictEqual(status.runnable, false);
    assert.ok(status.repairCommand?.includes('npm install -g @openai/codex'), `got: ${status.repairCommand}`);
    assert.ok(!status.error?.includes('Reinstall Ritemark'), `a system install is not restored by reinstalling Ritemark, got: ${status.error}`);
    assert.ok(status.diagnostics.some(line => line.startsWith('Ritemark is running with Node v')), `got: ${status.diagnostics.join(' | ')}`);
  }
}

// ── Probes run asynchronously ──
// The extension host has one JS thread. An npm-installed Codex takes seconds to
// generate its protocol types, and a probe must never hold the thread for that.

// A fake Codex for either shape: the npm CLI (`codex`) or the app-server binary
// (`codex-app-server`). It reads its answers from files next to its bin/ folder
// and logs every run, so a test can see what ran and in which order.
const FAKE_CODEX = [
  '#!/bin/sh',
  'd="$(cd "$(dirname "$0")/.." && pwd)"',
  'echo "$*" >> "$d/calls"',
  'case "$1" in',
  '  --version)',
  '    sleep "$(cat "$d/version-delay")"',
  '    cat "$d/version-out"',
  '    cat "$d/version-err" >&2',
  '    exit "$(cat "$d/version-exit")"',
  '    ;;',
  '  --help)',
  '    exit "$(cat "$d/help-exit")"',
  '    ;;',
  'esac',
  'accepts=$(cat "$d/generate-accepts")',
  'if [ "$1 $2" = "app-server generate-ts" ] && [ "$accepts" = "app-server generate-ts" ]; then out="$4"',
  'elif [ "$1" = "generate-ts" ] && [ "$accepts" = "generate-ts" ]; then out="$3"',
  'else echo "error: unexpected argument \'$1\' found" >&2; exit 2',
  'fi',
  'sleep "$(cat "$d/generate-delay")"',
  'cp "$d/ServerRequest.ts" "$d/ServerNotification.ts" "$out/"',
  'mkdir -p "$out/v2" && echo "export {};" > "$out/v2/Extra.ts"',
  'echo "$out" > "$d/generated-to"',
  '',
].join('\n');

const FULL_REQUESTS = 'export type ServerRequest = { "method": "item/commandExecution/requestApproval" }'
  + ' | { "method": "item/fileChange/requestApproval" } | { "method": "item/tool/requestUserInput" };\n';
const FULL_NOTIFICATIONS = 'export type ServerNotification = { "method": "turn/plan/updated" };\n';

interface FakeCodexOptions {
  name: 'codex' | 'codex-app-server';
  versionOut?: string;
  versionErr?: string;
  versionExit?: number;
  versionDelay?: number;
  helpExit?: number;
  generateAccepts?: 'app-server generate-ts' | 'generate-ts' | 'none';
  generateDelay?: number;
  requests?: string;
}

/** Each fake has its own path, so the per-binary compatibility cache never carries over. */
function makeFakeCodex(options: FakeCodexOptions) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-fake-codex-'));
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  const binaryPath = path.join(bin, options.name);
  fs.writeFileSync(binaryPath, FAKE_CODEX, { mode: 0o755 });
  const answers: Record<string, string> = {
    'version-out': options.versionOut ?? `${options.name === 'codex' ? 'codex-cli' : 'codex-app-server'} 0.999.0`,
    'version-err': options.versionErr ?? '',
    'version-exit': String(options.versionExit ?? 0),
    'version-delay': String(options.versionDelay ?? 0),
    'help-exit': String(options.helpExit ?? 0),
    'generate-accepts': options.generateAccepts ?? (options.name === 'codex' ? 'app-server generate-ts' : 'generate-ts'),
    'generate-delay': String(options.generateDelay ?? 0),
    'ServerRequest.ts': options.requests ?? FULL_REQUESTS,
    'ServerNotification.ts': FULL_NOTIFICATIONS,
    calls: '',
  };
  for (const [name, value] of Object.entries(answers)) fs.writeFileSync(path.join(dir, name), value);
  const generatedTo = path.join(dir, 'generated-to');
  return {
    binaryPath,
    calls: () => fs.readFileSync(path.join(dir, 'calls'), 'utf-8')
      .split('\n').filter(Boolean).map((line) => line.replace(/--out \S+$/, '--out <dir>')),
    generatedTo: () => (fs.existsSync(generatedTo) ? fs.readFileSync(generatedTo, 'utf-8').trim() : null),
    remove: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

/** Runs `work` while a 10 ms timer measures the longest time the event loop could not turn. */
async function longestStall<T>(work: () => Promise<T>): Promise<{ result: T; longestMs: number }> {
  let last = performance.now();
  let longestMs = 0;
  const ticker = setInterval(() => {
    const now = performance.now();
    longestMs = Math.max(longestMs, now - last);
    last = now;
  }, 10);
  try {
    const result = await work();
    return { result, longestMs: Math.max(longestMs, performance.now() - last) };
  } finally {
    clearInterval(ticker);
  }
}

const COMPATIBLE = {
  state: 'compatible',
  summary: 'Codex lifecycle capabilities detected.',
  capabilities: { approvals: true, requestUserInput: true, planUpdates: true },
  limitations: [],
};

async function testProbesRunAsynchronously() {
  if (process.platform === 'win32') {
    console.log('Codex probe tests skipped (the fake Codex is a POSIX shell script)');
    return;
  }

  // An npm-installed Codex: `--version`, then `app-server generate-ts`, which
  // takes seconds for real. The event loop keeps turning throughout, and the
  // generated protocol files are gone before the status comes back.
  {
    preference = 'system';
    const fake = makeFakeCodex({ name: 'codex', versionDelay: 0.2, generateDelay: 0.6 });
    try {
      const manager = managerResolving({ binaryPath: fake.binaryPath, runtimeSource: 'system', launchMode: 'codex-cli' });
      const { result: status, longestMs } = await longestStall(() => manager.getBinaryStatus());
      assert.ok(longestMs < 200, `the event loop stalled ${Math.round(longestMs)} ms while the npm Codex was probed`);
      assert.strictEqual(status.available, true);
      assert.strictEqual(status.runnable, true);
      assert.strictEqual(status.version, '0.999.0');
      assert.strictEqual(status.error, null);
      assert.strictEqual(status.runtimeSource, 'system');
      assert.deepStrictEqual(status.compatibility, COMPATIBLE);
      assert.deepStrictEqual(fake.calls(), ['--version', 'app-server generate-ts --out <dir>']);
      const generatedTo = fake.generatedTo();
      assert.ok(generatedTo, 'generate-ts never wrote its files');
      assert.strictEqual(fs.existsSync(generatedTo), false, 'the generated protocol files were left behind');
    } finally {
      fake.remove();
    }
  }

  // The app-server shape (the bundled runtime's): `--version`, then `generate-ts`.
  {
    preference = 'bundled';
    const fake = makeFakeCodex({ name: 'codex-app-server', versionDelay: 0.4, generateDelay: 0.4 });
    try {
      const manager = managerResolving({ binaryPath: fake.binaryPath, runtimeSource: 'bundled', launchMode: 'codex-app-server' });
      const { result: status, longestMs } = await longestStall(() => manager.getBinaryStatus());
      assert.ok(longestMs < 200, `the event loop stalled ${Math.round(longestMs)} ms while codex-app-server was probed`);
      assert.strictEqual(status.runnable, true);
      assert.strictEqual(status.version, '0.999.0');
      assert.deepStrictEqual(status.compatibility, COMPATIBLE);
      assert.deepStrictEqual(fake.calls(), ['--version', 'generate-ts --out <dir>']);
    } finally {
      fake.remove();
    }
  }

  // Calls that overlap share one protocol probe, and later calls reuse its answer.
  // (Synchronous probes could never overlap; async ones can.)
  {
    preference = 'system';
    const fake = makeFakeCodex({ name: 'codex', generateDelay: 0.3 });
    try {
      const binary = { binaryPath: fake.binaryPath, runtimeSource: 'system', launchMode: 'codex-cli' } as const;
      const probes = () => fake.calls().filter((line) => line.includes('generate-ts')).length;
      const statuses = await Promise.all([1, 2, 3].map(() => managerResolving(binary).getBinaryStatus()));
      assert.strictEqual(probes(), 1, `overlapping calls ran generate-ts ${probes()} times`);
      assert.deepStrictEqual(statuses[1], statuses[0]);
      assert.deepStrictEqual(statuses[2], statuses[0]);
      assert.deepStrictEqual(statuses[0].compatibility, COMPATIBLE);
      await managerResolving(binary).getBinaryStatus();
      assert.strictEqual(probes(), 1, 'a later call probed again instead of using the cached answer');
    } finally {
      fake.remove();
    }
  }

  // A protocol without a capability Ritemark expects still reads as limited.
  {
    const fake = makeFakeCodex({
      name: 'codex',
      requests: 'export type ServerRequest = { "method": "item/commandExecution/requestApproval" }'
        + ' | { "method": "item/fileChange/requestApproval" };\n',
    });
    try {
      const status = await managerResolving({ binaryPath: fake.binaryPath, runtimeSource: 'system', launchMode: 'codex-cli' }).getBinaryStatus();
      assert.deepStrictEqual(status.compatibility, {
        state: 'limited',
        summary: 'Codex is runnable, but one or more lifecycle capabilities Ritemark expects were not detected.',
        capabilities: { approvals: true, requestUserInput: false, planUpdates: true },
        limitations: ['Interactive question prompts were not detected in the current Codex app-server protocol.'],
      });
    } finally {
      fake.remove();
    }
  }

  // No generate-ts at all (the bundled codex-app-server 0.154.0): both argv
  // shapes are tried, then Ritemark assumes a modern Codex.
  {
    preference = 'bundled';
    const fake = makeFakeCodex({ name: 'codex-app-server', generateAccepts: 'none' });
    try {
      const status = await managerResolving({ binaryPath: fake.binaryPath, runtimeSource: 'bundled', launchMode: 'codex-app-server' }).getBinaryStatus();
      assert.strictEqual(status.runnable, true);
      assert.deepStrictEqual(status.compatibility, COMPATIBLE);
      assert.deepStrictEqual(fake.calls(), ['--version', 'generate-ts --out <dir>', 'app-server generate-ts --out <dir>']);
    } finally {
      fake.remove();
    }
  }

  // An app-server that rejects --version (≤ 0.130.0) is checked with --help.
  {
    const fake = makeFakeCodex({ name: 'codex-app-server', versionOut: '', versionErr: "error: unexpected argument '--version' found", versionExit: 2 });
    try {
      const status = await managerResolving({ binaryPath: fake.binaryPath, runtimeSource: 'bundled', launchMode: 'codex-app-server' }).getBinaryStatus();
      assert.strictEqual(status.runnable, true);
      assert.strictEqual(status.version, null, 'no manifest next to the fake, so no version to report');
      assert.strictEqual(status.error, null);
      assert.deepStrictEqual(status.compatibility, COMPATIBLE);
      assert.deepStrictEqual(fake.calls(), ['--version', '--help', 'generate-ts --out <dir>']);
    } finally {
      fake.remove();
    }
  }

  // ... and one whose --help fails too cannot start.
  {
    const fake = makeFakeCodex({ name: 'codex-app-server', versionOut: '', versionExit: 2, helpExit: 1 });
    try {
      const status = await managerResolving({ binaryPath: fake.binaryPath, runtimeSource: 'bundled', launchMode: 'codex-app-server' }).getBinaryStatus();
      assert.strictEqual(status.runnable, false);
      assert.strictEqual(status.error, 'The bundled Codex runtime could not start (app-server --help exited 1). Reinstall Ritemark to restore it.');
      assert.strictEqual(status.compatibility, null);
      assert.deepStrictEqual(fake.calls(), ['--version', '--help']);
    } finally {
      fake.remove();
    }
  }

  // An npm Codex that fails reports the CLI's own error line, and is not probed further.
  {
    preference = 'system';
    const fake = makeFakeCodex({ name: 'codex', versionOut: '', versionErr: 'Error: Cannot find module @openai/codex-darwin-arm64', versionExit: 1 });
    try {
      const status = await managerResolving({ binaryPath: fake.binaryPath, runtimeSource: 'system', launchMode: 'codex-cli' }).getBinaryStatus();
      assert.strictEqual(status.available, true);
      assert.strictEqual(status.runnable, false);
      assert.strictEqual(status.error, 'Cannot find module @openai/codex-darwin-arm64');
      assert.strictEqual(status.compatibility, null);
      assert.deepStrictEqual(fake.calls(), ['--version']);
    } finally {
      fake.remove();
    }
  }

  // An npm Codex path that cannot be spawned reports the spawn error.
  {
    const binaryPath = path.join(os.tmpdir(), 'ritemark-codex-test', 'missing', 'codex');
    const status = await managerResolving({ binaryPath, runtimeSource: 'system', launchMode: 'codex-cli' }).getBinaryStatus();
    assert.strictEqual(status.runnable, false);
    assert.strictEqual(status.error, `spawn ${binaryPath} ENOENT`);
    assert.strictEqual(status.compatibility, null);
  }
}

async function main() {
  await testRuntimeSourcePolicy();
  await testProbesRunAsynchronously();
}

main()
  .then(() => console.log('codexManager.test.ts: all tests passed'))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
