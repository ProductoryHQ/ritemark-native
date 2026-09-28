/**
 * Run: npx tsx src/agent/setup.test.ts
 */

import assert from 'assert';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { delimiter, join } from 'path';
import { __testOnly } from './setup';

const { deriveClaudeSetupStatus, recommendedEnvironmentAction, systemRuntimeToolsRequired, parseClaudeAuthStatusJson } = __testOnly;

{
  const status = deriveClaudeSetupStatus({
    binary: {
      installed: false,
      runnable: false,
      version: undefined,
      path: null,
      diagnostics: [],
      error: null,
    },
    authMethod: null,
    loginInProgress: false,
    pendingReload: false,
    pendingReloadDiagnostics: [],
  });

  assert.strictEqual(status.state, 'not-installed');
  assert.strictEqual(status.repairAction, 'install');
}

{
  const status = deriveClaudeSetupStatus({
    binary: {
      installed: true,
      runnable: false,
      version: '1.2.3',
      path: '/usr/local/bin/claude',
      diagnostics: ['Missing dependency'],
      error: 'Claude failed to start',
    },
    authMethod: null,
    loginInProgress: false,
    pendingReload: false,
    pendingReloadDiagnostics: [],
  });

  assert.strictEqual(status.state, 'broken-install');
  assert.strictEqual(status.repairAction, 'repair');
  assert.strictEqual(status.error, 'Claude failed to start');
}

{
  const status = deriveClaudeSetupStatus({
    binary: {
      installed: false,
      runnable: false,
      version: undefined,
      path: null,
      diagnostics: [],
      error: null,
    },
    authMethod: null,
    loginInProgress: false,
    pendingReload: true,
    pendingReloadDiagnostics: ['Reload to finish setup'],
  });

  assert.strictEqual(status.state, 'broken-install');
  assert.strictEqual(status.repairAction, 'reload');
  assert.ok(status.diagnostics.includes('Reload to finish setup'));
}

{
  const status = deriveClaudeSetupStatus({
    binary: {
      installed: true,
      runnable: true,
      version: '1.2.3',
      path: '/usr/local/bin/claude',
      diagnostics: [],
      error: null,
    },
    authMethod: null,
    loginInProgress: false,
    pendingReload: false,
    pendingReloadDiagnostics: [],
  });

  assert.strictEqual(status.state, 'needs-auth');
  assert.strictEqual(status.repairAction, null);
}

{
  const status = deriveClaudeSetupStatus({
    binary: {
      installed: true,
      runnable: true,
      version: '1.2.3',
      path: '/usr/local/bin/claude',
      diagnostics: [],
      error: null,
    },
    authMethod: null,
    loginInProgress: true,
    pendingReload: false,
    pendingReloadDiagnostics: [],
  });

  assert.strictEqual(status.state, 'auth-in-progress');
}

{
  const status = deriveClaudeSetupStatus({
    binary: {
      installed: true,
      runnable: true,
      version: '1.2.3',
      path: '/usr/local/bin/claude',
      diagnostics: [],
      error: null,
    },
    authMethod: 'api-key',
    loginInProgress: false,
    pendingReload: false,
    pendingReloadDiagnostics: [],
  });

  assert.strictEqual(status.state, 'ready');
  assert.strictEqual(status.authMethod, 'api-key');
}

{
  assert.strictEqual(
    parseClaudeAuthStatusJson('{"loggedIn":false,"authMethod":"none","apiProvider":"firstParty"}'),
    null
  );
  assert.strictEqual(
    parseClaudeAuthStatusJson('{"loggedIn":true,"authMethod":"oauth","apiProvider":"firstParty"}'),
    'claude-oauth'
  );
  assert.strictEqual(
    parseClaudeAuthStatusJson('{"loggedIn":true,"authMethod":"apiKey","apiProvider":"firstParty"}'),
    'api-key'
  );
  assert.strictEqual(parseClaudeAuthStatusJson('not json'), undefined);
}

// Git and Node.js are asked for only with a system-installed runtime on Windows:
// the bundled claude.exe and codex-app-server.exe need neither.
assert.strictEqual(systemRuntimeToolsRequired('win32', 'system'), true);
assert.strictEqual(systemRuntimeToolsRequired('win32', 'bundled'), false);
assert.strictEqual(systemRuntimeToolsRequired('darwin', 'system'), false);
assert.strictEqual(systemRuntimeToolsRequired('darwin', 'bundled'), false);

{
  const action = recommendedEnvironmentAction({
    gitRequired: true,
    gitInstalled: false,
    nodeRequired: true,
    nodeInstalled: true,
    restartRequired: false,
  });

  assert.strictEqual(action, 'install-git');
}

{
  const action = recommendedEnvironmentAction({
    gitRequired: true,
    gitInstalled: true,
    nodeRequired: true,
    nodeInstalled: false,
    restartRequired: false,
  });

  assert.strictEqual(action, 'install-node');
}

{
  const action = recommendedEnvironmentAction({
    gitRequired: true,
    gitInstalled: false,
    nodeRequired: true,
    nodeInstalled: false,
    restartRequired: true,
  });

  assert.strictEqual(action, 'reload');
}

// Bundled runtimes: missing Git and Node.js recommend nothing.
{
  const action = recommendedEnvironmentAction({
    gitRequired: false,
    gitInstalled: false,
    nodeRequired: false,
    nodeInstalled: false,
    restartRequired: false,
  });

  assert.strictEqual(action, null);
}

// ── getOnboardingStatus tests ──
// We can't fully mock checkCommandAvailable, but we can test the anyAgentReady logic
// by calling getOnboardingStatus with explicit options that override the async lookups.

import {
  checkWingetAvailable,
  clearClaudePendingReload,
  clearSetupCache,
  getOnboardingStatus,
  getSetupStatus,
  setClaudePendingReload,
} from './setup';

async function testOnboardingStatus() {
  // When Claude is authenticated, anyAgentReady should be true
  {
    const status = await getOnboardingStatus({
      setupStatus: {
        cliInstalled: true,
        runnable: true,
        cliVersion: '1.0.0',
        binaryPath: '/usr/bin/claude',
        authenticated: true,
        authMethod: 'api-key',
        state: 'ready',
        diagnostics: [],
        repairAction: null,
        error: null,
      },
      hasOpenAiKey: false,
      codexCliInstalled: false,
      codexCliAuthenticated: false,
    });

    assert.strictEqual(status.claudeCliInstalled, true);
    assert.strictEqual(status.claudeCliAuthenticated, true);
    assert.strictEqual(status.anyAgentReady, true);
    // Outside VS Code the preference reads as 'bundled', so onboarding lists no Git or Node.js.
    assert.strictEqual(status.gitRequired, false);
    assert.strictEqual(status.nodeRequired, false);
  }

  // When nothing is ready, anyAgentReady should be false
  {
    const status = await getOnboardingStatus({
      setupStatus: {
        cliInstalled: false,
        runnable: false,
        authenticated: false,
        authMethod: null,
        state: 'not-installed',
        diagnostics: [],
        repairAction: 'install',
        error: null,
      },
      hasOpenAiKey: false,
      codexCliInstalled: false,
      codexCliAuthenticated: false,
    });

    assert.strictEqual(status.claudeCliInstalled, false);
    assert.strictEqual(status.anyAgentReady, false);
  }

  // When Codex is authenticated, anyAgentReady should be true
  {
    const status = await getOnboardingStatus({
      setupStatus: {
        cliInstalled: false,
        runnable: false,
        authenticated: false,
        authMethod: null,
        state: 'not-installed',
        diagnostics: [],
        repairAction: 'install',
        error: null,
      },
      hasOpenAiKey: false,
      codexCliInstalled: true,
      codexCliAuthenticated: true,
    });

    assert.strictEqual(status.codexCliInstalled, true);
    assert.strictEqual(status.codexCliAuthenticated, true);
    assert.strictEqual(status.anyAgentReady, true);
  }

  // When only OpenAI key exists (Ritemark Agent), anyAgentReady should be true
  {
    const status = await getOnboardingStatus({
      setupStatus: {
        cliInstalled: false,
        runnable: false,
        authenticated: false,
        authMethod: null,
        state: 'not-installed',
        diagnostics: [],
        repairAction: 'install',
        error: null,
      },
      hasOpenAiKey: true,
      codexCliInstalled: false,
      codexCliAuthenticated: false,
    });

    assert.strictEqual(status.hasOpenAiKey, true);
    assert.strictEqual(status.anyAgentReady, true);
  }

  console.log('getOnboardingStatus tests passed');
}

// ── Probes run asynchronously ──
// (utils/runProcess is tested on its own; these tests watch a probe in flight.)

async function waitFor(condition: () => boolean, message: string): Promise<void> {
  const deadline = Date.now() + 5000;
  while (!condition()) {
    assert.ok(Date.now() < deadline, message);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

// A fake Claude CLI. Each run reads its answers before logging itself, so the
// test can change them without affecting a run that has already started.
const FAKE_CLAUDE = [
  '#!/bin/sh',
  'd="$RITEMARK_FAKE_CLAUDE"',
  'case "$1" in',
  '  --version)',
  '    out=$(cat "$d/version"); err=$(cat "$d/version-stderr"); code=$(cat "$d/version-exit"); delay=$(cat "$d/version-delay")',
  '    echo "$*" >> "$d/calls"',
  '    sleep "$delay"',
  '    [ -n "$out" ] && echo "$out"',
  '    [ -n "$err" ] && echo "$err" >&2',
  '    exit "$code"',
  '    ;;',
  '  auth)',
  '    out=$(cat "$d/auth"); delay=$(cat "$d/auth-delay")',
  '    echo "$*" >> "$d/calls"',
  '    sleep "$delay"',
  '    printf "%s" "$out"',
  '    ;;',
  'esac',
  '',
].join('\n');

// getSetupStatus end to end, against the fake Claude placed first on PATH. The
// fake is a POSIX shell script, so this part runs on macOS.
async function testSetupStatusProbe() {
  if (process.platform !== 'darwin') {
    console.log('getSetupStatus probe tests skipped (macOS only)');
    return;
  }

  const dir = mkdtempSync(join(tmpdir(), 'ritemark-fake-claude-'));
  const bin = join(dir, 'bin');
  const claude = join(bin, 'claude');
  mkdirSync(bin);
  writeFileSync(claude, FAKE_CLAUDE, { mode: 0o755 });
  const set = (values: Record<string, string>) => {
    for (const [name, value] of Object.entries(values)) writeFileSync(join(dir, name), value);
  };
  const calls = () => readFileSync(join(dir, 'calls'), 'utf-8').split('\n').filter(Boolean);
  const loggedIn = '{"loggedIn":true,"authMethod":"claude.ai","apiProvider":"firstParty"}';
  const loggedOut = '{"loggedIn":false,"authMethod":"none","apiProvider":"firstParty"}';

  const originalPath = process.env.PATH;
  process.env.PATH = `${bin}${delimiter}${originalPath}`;
  process.env.RITEMARK_FAKE_CLAUDE = dir;
  try {
    // Ready — and the event loop keeps turning while Claude answers.
    set({
      version: '2.1.999 (Claude Code)', 'version-stderr': '', 'version-exit': '0', 'version-delay': '0.3',
      auth: loggedIn, 'auth-delay': '0.3', calls: '',
    });
    clearSetupCache();
    let ticks = 0;
    const ticker = setInterval(() => { ticks++; }, 10);
    const ready = await getSetupStatus();
    clearInterval(ticker);
    assert.ok(ticks >= 20, `the event loop stalled while Claude was probed (${ticks} ticks in ~600 ms)`);
    assert.deepStrictEqual(ready, {
      cliInstalled: true,
      runnable: true,
      cliVersion: '2.1.999 (Claude Code)',
      binaryPath: claude,
      authenticated: true,
      authMethod: 'claude-oauth',
      state: 'ready',
      diagnostics: ['Version: 2.1.999 (Claude Code)', `Binary: ${claude}`],
      repairAction: null,
      error: null,
      runtimeSource: 'system',
    });
    assert.deepStrictEqual(calls(), ['--version', 'auth status --json']);

    // Cached afterwards; `refresh` probes again.
    assert.strictEqual(await getSetupStatus(), ready);
    assert.strictEqual(calls().length, 2);
    await getSetupStatus({ refresh: true });
    assert.strictEqual(calls().length, 4);

    // Concurrent callers share one probe, `refresh` included.
    set({ calls: '' });
    clearSetupCache();
    const [first, second, third] = await Promise.all([
      getSetupStatus(),
      getSetupStatus(),
      getSetupStatus({ refresh: true }),
    ]);
    assert.strictEqual(first, second);
    assert.strictEqual(first, third);
    assert.deepStrictEqual(calls(), ['--version', 'auth status --json']);

    // Signed out.
    set({ 'version-delay': '0', auth: loggedOut, 'auth-delay': '0' });
    clearSetupCache();
    const signedOut = await getSetupStatus();
    assert.strictEqual(signedOut.state, 'needs-auth');
    assert.strictEqual(signedOut.authMethod, null);
    assert.strictEqual(signedOut.authenticated, false);

    // A version printed before a non-zero exit still counts as runnable.
    set({ 'version-exit': '1', auth: loggedIn });
    clearSetupCache();
    assert.strictEqual((await getSetupStatus()).state, 'ready');

    // No version and an error on stderr: a second run captures the error.
    set({ version: '', 'version-stderr': 'boom', 'version-exit': '1', calls: '' });
    clearSetupCache();
    const broken = await getSetupStatus();
    assert.strictEqual(broken.state, 'broken-install');
    assert.strictEqual(broken.repairAction, 'repair');
    assert.strictEqual(broken.error, 'boom');
    assert.strictEqual(broken.binaryPath, claude);
    assert.deepStrictEqual(calls(), ['--version', '--version']);

    // A probe that started before an invalidation never replaces the newer
    // status, even when it finishes last.
    set({
      version: '2.1.999 (Claude Code)', 'version-stderr': '', 'version-exit': '0',
      auth: loggedOut, 'auth-delay': '0.8', calls: '',
    });
    clearSetupCache();
    const stale = getSetupStatus();
    await waitFor(() => calls().includes('auth status --json'), 'the first auth check never started');
    set({ auth: loggedIn, 'auth-delay': '0' });
    clearSetupCache(); // e.g. sign-in finished
    const fresh = await getSetupStatus();
    assert.strictEqual(fresh.state, 'ready');
    assert.strictEqual((await stale).state, 'needs-auth');
    assert.strictEqual(await getSetupStatus(), fresh);

    // Nor does it clear a pending reload set while it ran — e.g. an install that
    // needs a reload finished during a slow cold-start version check.
    set({ 'version-delay': '0.6', auth: loggedIn, 'auth-delay': '0', calls: '' });
    clearSetupCache();
    const overtaken = getSetupStatus();
    await waitFor(() => calls().includes('--version'), 'the first version check never started');
    set({ version: '', 'version-stderr': 'boom', 'version-exit': '1', 'version-delay': '0' });
    setClaudePendingReload(['Reload to finish setup']);
    assert.strictEqual((await overtaken).state, 'ready');
    const afterInstall = await getSetupStatus();
    assert.strictEqual(afterInstall.state, 'broken-install');
    assert.strictEqual(afterInstall.repairAction, 'reload');
    assert.ok(afterInstall.diagnostics.includes('Reload to finish setup'));
    clearClaudePendingReload();
  } finally {
    process.env.PATH = originalPath;
    delete process.env.RITEMARK_FAKE_CLAUDE;
    clearSetupCache();
    rmSync(dir, { recursive: true, force: true });
  }

  // winget is Windows-only; elsewhere the answer is an immediate false.
  assert.strictEqual(await checkWingetAvailable(), false);

  console.log('getSetupStatus probe tests passed');
}

async function main() {
  await testOnboardingStatus();
  await testSetupStatusProbe();
  console.log('setup.test.ts passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
