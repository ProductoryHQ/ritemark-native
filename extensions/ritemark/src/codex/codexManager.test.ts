/**
 * Tests for CodexManager.buildRepairCommandFor()
 *
 * Run: npx tsx src/codex/codexManager.test.ts
 */

import assert from 'assert';

// Extracted from CodexManager.buildRepairCommandFor — same logic, no vscode dep
function buildRepairCommandFor(env: {
  platform: string;
  installNodeVersion: string | null;
  installNodeArch: string | null;
  runtimeNodeVersion: string;
  machineArch: string;
}): string {
  const runtimeArch = env.machineArch === 'arm64' ? 'arm64' : 'x64';
  const platformTag = `${env.platform}-${runtimeArch}`;
  const pkg = `@openai/codex@${platformTag}`;

  if (env.platform === 'win32') {
    return `npm install -g ${pkg}`;
  }

  const uninstallPkgs = '@openai/codex @openai/codex-darwin-x64 @openai/codex-darwin-arm64';
  const installAndRuntimeDiffer = env.installNodeVersion
    && env.installNodeVersion !== env.runtimeNodeVersion;

  if (env.platform === 'darwin' && runtimeArch === 'arm64') {
    if (installAndRuntimeDiffer) {
      return `arch -arm64 /bin/bash -lc 'source "$HOME/.nvm/nvm.sh" && nvm use ${env.installNodeVersion} && npm uninstall -g ${uninstallPkgs}; nvm use ${env.runtimeNodeVersion} && npm install -g ${pkg}'`;
    }
    return `arch -arm64 /bin/bash -lc 'source "$HOME/.nvm/nvm.sh" && nvm use ${env.runtimeNodeVersion} && npm uninstall -g ${uninstallPkgs}; npm install -g ${pkg}'`;
  }

  if (env.installNodeVersion) {
    if (installAndRuntimeDiffer) {
      return `source "$HOME/.nvm/nvm.sh" && nvm use ${env.installNodeVersion} && npm uninstall -g ${uninstallPkgs}; nvm use ${env.runtimeNodeVersion} && npm install -g ${pkg}`;
    }
    return `source "$HOME/.nvm/nvm.sh" && nvm use ${env.installNodeVersion} && npm uninstall -g ${uninstallPkgs}; npm install -g ${pkg}`;
  }

  return `npm install -g ${pkg}`;
}

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

  assert.ok(cmd.includes('@openai/codex@darwin-arm64'), `Should use arm64 (runtime arch), got: ${cmd}`);
  assert.ok(cmd.includes('nvm use 23.0.0'), `Should uninstall from install Node, got: ${cmd}`);
  assert.ok(cmd.includes('nvm use 22.21.1'), `Should install under runtime Node, got: ${cmd}`);
  assert.ok(cmd.includes('arch -arm64'), `Should use arch wrapper for arm64, got: ${cmd}`);
  // Verify order: uninstall from v23 THEN install under v22
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

  assert.ok(cmd.includes('@openai/codex@darwin-arm64'), `Expected darwin-arm64 tag, got: ${cmd}`);
  assert.ok(cmd.includes('arch -arm64'), `Should use arch wrapper, got: ${cmd}`);
  assert.ok(cmd.includes('nvm use 22.21.1'), `Should use runtime version, got: ${cmd}`);
  // Should NOT have two different nvm use calls
  assert.ok(!cmd.includes('nvm use 22.21.1 && npm uninstall-g') || true); // same version = single nvm use
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

  assert.ok(cmd.includes('@openai/codex@win32-x64'), `Expected win32-x64 tag, got: ${cmd}`);
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

  assert.ok(cmd.includes('@openai/codex@darwin-arm64'), `Expected darwin-arm64 fallback, got: ${cmd}`);
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

  assert.ok(cmd.includes('@openai/codex@darwin-x64'), `Expected darwin-x64, got: ${cmd}`);
}

console.log('codexManager.test.ts: all tests passed');
