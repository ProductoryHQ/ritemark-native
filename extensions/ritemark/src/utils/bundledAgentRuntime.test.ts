/**
 * Run: npx tsx src/utils/bundledAgentRuntime.test.ts
 */

import assert from 'assert';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  findBundledAgentRuntime,
  inferCodexRuntimeLaunchMode,
  isBundledAgentRuntimePath,
} from './bundledAgentRuntime';

const tempRoot = join(tmpdir(), `ritemark-bundled-runtime-test-${process.pid}`);

try {
  const windowsRuntimeDir = join(tempRoot, 'binaries', 'agents', 'win32-x64');
  mkdirSync(windowsRuntimeDir, { recursive: true });
  writeFileSync(join(windowsRuntimeDir, 'claude.exe'), '');
  writeFileSync(join(windowsRuntimeDir, 'codex-app-server.exe'), '');

  const claude = findBundledAgentRuntime('claude', {
    extensionRoot: tempRoot,
    platform: 'win32',
    arch: 'x64',
  });

  assert.ok(claude);
  assert.strictEqual(claude.path, join(windowsRuntimeDir, 'claude.exe'));
  assert.strictEqual(claude.kind, 'claude');
  assert.strictEqual(isBundledAgentRuntimePath(claude.path), true);

  const codexAppServer = findBundledAgentRuntime('codex-app-server', {
    extensionRoot: tempRoot,
    platform: 'win32',
    arch: 'x64',
  });

  assert.ok(codexAppServer);
  assert.strictEqual(codexAppServer.path, join(windowsRuntimeDir, 'codex-app-server.exe'));
  assert.strictEqual(inferCodexRuntimeLaunchMode(codexAppServer.path), 'codex-app-server');

  const missingCodexCli = findBundledAgentRuntime('codex-cli', {
    extensionRoot: tempRoot,
    platform: 'win32',
    arch: 'x64',
  });

  assert.strictEqual(missingCodexCli, null);
  assert.strictEqual(existsSync(join(tempRoot, 'missing')), false);

  console.log('bundledAgentRuntime.test.ts passed');
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
