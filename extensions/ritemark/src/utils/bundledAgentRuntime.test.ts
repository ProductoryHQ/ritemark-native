/**
 * Run: npx tsx src/utils/bundledAgentRuntime.test.ts
 */

import assert from 'assert';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  extensionRootFrom,
  findBundledAgentRuntime,
  findBundledOpenCodePathEntries,
  inferCodexRuntimeLaunchMode,
  isBundledAgentRuntimePath,
  readBundledRuntimeVersion,
} from './bundledAgentRuntime';

const tempRoot = join(tmpdir(), `ritemark-bundled-runtime-test-${process.pid}`);

try {
  const windowsRuntimeDir = join(tempRoot, 'binaries', 'agents', 'win32-x64');
  mkdirSync(windowsRuntimeDir, { recursive: true });
  writeFileSync(join(windowsRuntimeDir, 'claude.exe'), '');
  const codexBinDir = join(windowsRuntimeDir, 'codex', 'bin');
  mkdirSync(codexBinDir, { recursive: true });
  writeFileSync(join(codexBinDir, 'codex-app-server.exe'), '');
  writeFileSync(join(windowsRuntimeDir, 'opencode.exe'), '');
  mkdirSync(join(windowsRuntimeDir, 'opencode-path'), { recursive: true });
  writeFileSync(join(windowsRuntimeDir, 'opencode-path', 'rg.exe'), '');
  writeFileSync(join(tempRoot, 'binaries', 'agents', 'manifest.json'), JSON.stringify({
    runtimes: [{
      agent: 'codex', component: 'package', platform: 'win32', arch: 'x64', version: '0.154.0', installRoot: 'codex',
      members: [{ installPath: 'bin/codex-app-server.exe', version: '0.154.0' }],
    }],
  }));

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
  assert.strictEqual(codexAppServer.path, join(codexBinDir, 'codex-app-server.exe'));
  assert.strictEqual(inferCodexRuntimeLaunchMode(codexAppServer.path), 'codex-app-server');
  assert.strictEqual(readBundledRuntimeVersion(codexAppServer.path), '0.154.0');
  assert.deepStrictEqual(
    findBundledOpenCodePathEntries(join(windowsRuntimeDir, 'opencode.exe')),
    [join(windowsRuntimeDir, 'opencode-path')],
  );

  const missingCodexCli = findBundledAgentRuntime('codex-cli', {
    extensionRoot: tempRoot,
    platform: 'win32',
    arch: 'x64',
  });

  assert.strictEqual(missingCodexCli, null);
  assert.strictEqual(existsSync(join(tempRoot, 'missing')), false);

  // Sprint 92 R3: the no-override default resolves the extension root as ONE level
  // above the bundle's own directory (`out/`) — this is the exact math the
  // `bundledAgentRuntime.ts`/`BrowserToolsInjector.ts` __dirname landmines depend on
  // post-bundling. Regression-guard it directly so a future offset change (e.g. the
  // esbuild outdir moving deeper) fails loudly here instead of only in manual QA.
  const simulatedOutDir = join(tempRoot, 'out');
  mkdirSync(simulatedOutDir, { recursive: true });
  assert.strictEqual(extensionRootFrom(simulatedOutDir), tempRoot);

  console.log('bundledAgentRuntime.test.ts passed');
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
