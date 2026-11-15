/**
 * Run: npx tsx src/agent/setup.test.ts
 */

import assert from 'assert';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { delimiter, join } from 'path';
import { __testOnly, detectClaudeAuthMethod, type ClaudeAuthCheck, type ClaudeAuthEvidence } from './setup';

const {
  deriveClaudeSetupStatus,
  recommendedEnvironmentAction,
  systemRuntimeToolsRequired,
  parseClaudeAuthStatusJson,
  checkClaudeAuthStatus,
  describeUnusableAuthCheck,
} = __testOnly;

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

// ── Claude's sign-in decision (Sprint 160, technical plan §2; #703, #541) ──
{
  const unusable: ClaudeAuthCheck = { unusable: { reason: 'no-json', status: 0, elapsedMs: 12, stdoutBytes: 40, stderrBytes: 0 } };
  const said = (method: 'claude-oauth' | 'api-key' | null): ClaudeAuthCheck => ({ method });
  const rows: Array<[string, Partial<ClaudeAuthEvidence> & Pick<ClaudeAuthEvidence, 'platform' | 'cli'>, 'claude-oauth' | 'api-key' | null]> = [
    ['CLI signed in with Claude.ai + saved key: the sign-in wins', { platform: 'darwin', cli: said('claude-oauth'), keySaved: true }, 'claude-oauth'],
    ['the same on Windows', { platform: 'win32', cli: said('claude-oauth'), keySaved: true }, 'claude-oauth'],
    ['CLI signed in on its own key', { platform: 'darwin', cli: said('api-key') }, 'api-key'],
    ['#541: CLI signed out + saved key', { platform: 'darwin', cli: said(null), keySaved: true }, 'api-key'],
    ['#541: the same on Windows', { platform: 'win32', cli: said(null), keySaved: true }, 'api-key'],
    ['CLI signed out, no key: the Keychain and the environment do not count', { platform: 'darwin', cli: said(null), keychainSignedIn: true, envApiKey: true }, null],
    ['no CLI answer + saved key', { platform: 'win32', cli: unusable, keySaved: true }, 'api-key'],
    ['no CLI answer + saved key on macOS: the key before the Keychain', { platform: 'darwin', cli: unusable, keySaved: true, keychainSignedIn: true }, 'api-key'],
    ['no CLI answer on macOS: the Keychain item', { platform: 'darwin', cli: unusable, keychainSignedIn: true }, 'claude-oauth'],
    ['#703: no CLI answer on Windows, no key: signed out (cmdkey no longer counts)', { platform: 'win32', cli: unusable, keychainSignedIn: true }, null],
    ['no CLI answer, ANTHROPIC_API_KEY in the environment', { platform: 'win32', cli: unusable, envApiKey: true }, 'api-key'],
    ['no CLI answer on macOS, no Keychain item, ANTHROPIC_API_KEY', { platform: 'darwin', cli: unusable, keychainSignedIn: false, envApiKey: true }, 'api-key'],
    ['no CLI answer and nothing else', { platform: 'darwin', cli: unusable, keychainSignedIn: false }, null],
  ];
  for (const [name, evidence, expected] of rows) {
    assert.strictEqual(detectClaudeAuthMethod({ keySaved: false, envApiKey: false, ...evidence }), expected, name);
  }

  // The reason line carries the measurements, never the output.
  assert.strictEqual(
    describeUnusableAuthCheck({ reason: 'timeout', status: null, elapsedMs: 5004, stdoutBytes: 0, stderrBytes: 12 }),
    "Claude's sign-in check gave no usable answer: timeout (exit none, 5004 ms, stdout 0 bytes, stderr 12 bytes).",
  );
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
  registerAnthropicKeyReader,
  setAnthropicKeyAvailable,
  setClaudePendingReload,
} from './setup';

// A placeholder, not a credential: the tests check it never leaves setup.ts.
const PLACEHOLDER_KEY = 'sk-ant-test-placeholder-0000';

/** Run `action`, collecting what it writes with console.warn. */
async function captureWarnings<T>(action: () => Promise<T>): Promise<{ result: T; warnings: string[] }> {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => { warnings.push(args.map(String).join(' ')); };
  try {
    return { result: await action(), warnings };
  } finally {
    console.warn = original;
  }
}

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

  // hasAnthropicKey comes from the key reader, not from a flag a surface may have left behind
  {
    const notInstalled = {
      cliInstalled: false, runnable: false, authenticated: false, authMethod: null, state: 'not-installed' as const,
      diagnostics: [], repairAction: 'install' as const, error: null,
    };
    registerAnthropicKeyReader(async () => PLACEHOLDER_KEY);
    assert.strictEqual((await getOnboardingStatus({ setupStatus: notInstalled })).hasAnthropicKey, true);
    registerAnthropicKeyReader(async () => undefined);
    assert.strictEqual((await getOnboardingStatus({ setupStatus: notInstalled })).hasAnthropicKey, false);
    registerAnthropicKeyReader(null);
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
  const originalEnvKey = process.env.ANTHROPIC_API_KEY;
  process.env.PATH = `${bin}${delimiter}${originalPath}`;
  process.env.RITEMARK_FAKE_CLAUDE = dir;
  delete process.env.ANTHROPIC_API_KEY;
  // Never the developer's own Keychain: the fake answers and counts its calls.
  let keychainAnswer = false;
  let keychainCalls = 0;
  __testOnly.setKeychainCheck(async () => { keychainCalls += 1; return keychainAnswer; });
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

    // ── Sprint 160: one source per state (#541, #703) ──
    assert.strictEqual(keychainCalls, 0, 'every answer so far was usable: the Keychain was never read');

    // #541: the CLI says signed out and a key is saved in Ritemark: ready on the key.
    set({
      version: '2.1.999 (Claude Code)', 'version-stderr': '', 'version-exit': '0', 'version-delay': '0',
      auth: loggedOut, 'auth-delay': '0', calls: '',
    });
    let keyReads = 0;
    registerAnthropicKeyReader(async () => { keyReads += 1; return PLACEHOLDER_KEY; });
    const onKey = await getSetupStatus();
    assert.strictEqual(onKey.state, 'ready', '#541: a saved key makes Claude ready although the CLI is signed out');
    assert.strictEqual(onKey.authMethod, 'api-key');
    assert.strictEqual(onKey.authenticated, true);
    assert.strictEqual(keyReads, 1, 'the probe asked the key reader');
    assert.ok(!JSON.stringify(onKey).includes(PLACEHOLDER_KEY), 'the key never enters the status');

    // Each probe asks again: a key removed since reads as none.
    registerAnthropicKeyReader(async () => undefined);
    assert.strictEqual((await getSetupStatus()).state, 'needs-auth');
    registerAnthropicKeyReader(async () => PLACEHOLDER_KEY);

    // A Claude.ai sign-in still wins over the saved key, and the diagnostics say so from this probe's own answer.
    set({ auth: loggedIn });
    clearSetupCache();
    const oauthWithKey = await getSetupStatus();
    assert.strictEqual(oauthWithKey.authMethod, 'claude-oauth');
    assert.ok(oauthWithKey.diagnostics.includes('Anthropic API key is configured, but Claude.ai credentials are active and take precedence.'));

    // A surface's word about the key drops only a status decided with the other answer.
    set({ calls: '' });
    setAnthropicKeyAvailable(true);
    assert.strictEqual(await getSetupStatus(), oauthWithKey, 'the same answer keeps the cached status');
    assert.deepStrictEqual(calls(), []);
    setAnthropicKeyAvailable(false);
    assert.notStrictEqual(await getSetupStatus(), oauthWithKey, 'the other answer drops it');
    assert.deepStrictEqual(calls(), ['--version', 'auth status --json']);

    // A key that can't be read counts as none, and the log says so.
    set({ auth: loggedOut });
    registerAnthropicKeyReader(async () => { throw new Error('secret store locked'); });
    const unreadable = await captureWarnings(() => getSetupStatus());
    assert.strictEqual(unreadable.result.state, 'needs-auth');
    assert.ok(unreadable.result.diagnostics.includes('The saved Anthropic API key could not be read, so it counts as none.'));
    assert.ok(unreadable.warnings.some((line) => line.startsWith('[ritemark] Claude check: the saved Anthropic key could not be read')));
    registerAnthropicKeyReader(null);
    assert.strictEqual(keychainCalls, 0, 'the CLI answered each time: still no Keychain read');

    // #703: an answer that isn't JSON. The reason, its exit status, time and sizes reach the log and the
    // diagnostics; the output (which can hold the account's e-mail) reaches neither.
    const notJson = 'Signed in as jane@example.com';
    set({ auth: notJson });
    clearSetupCache();
    const noJson = await captureWarnings(() => getSetupStatus());
    assert.strictEqual(noJson.result.state, 'needs-auth', 'no usable answer and nothing else: signed out');
    const reason = noJson.result.diagnostics.find((line) => line.startsWith("Claude's sign-in check gave no usable answer: no-json (exit 0, "));
    assert.ok(reason, `the reason is in the diagnostics: ${noJson.result.diagnostics.join(' | ')}`);
    assert.ok(reason.endsWith(`ms, stdout ${Buffer.byteLength(notJson)} bytes, stderr 0 bytes).`), reason);
    assert.ok(noJson.warnings.includes(`[ritemark] ${reason}`), 'and in the log');
    assert.ok(!JSON.stringify(noJson.result).includes('jane@example.com'), 'the output is not in the status');
    assert.ok(!noJson.warnings.join('\n').includes('jane@example.com'), 'nor in the log');
    assert.strictEqual(keychainCalls, 1, 'on macOS an unusable answer reads the Keychain');

    // The macOS Keychain fallback stays, and is logged when used.
    keychainAnswer = true;
    clearSetupCache();
    const fromKeychain = await captureWarnings(() => getSetupStatus());
    assert.strictEqual(fromKeychain.result.state, 'ready');
    assert.strictEqual(fromKeychain.result.authMethod, 'claude-oauth');
    const keychainLine = 'Claude counts as signed in from its macOS Keychain item, since its own check gave no usable answer.';
    assert.ok(fromKeychain.result.diagnostics.includes(keychainLine));
    assert.ok(fromKeychain.warnings.includes(`[ritemark] ${keychainLine}`));

    // With a key saved, the key decides and the Keychain isn't read.
    registerAnthropicKeyReader(async () => PLACEHOLDER_KEY);
    const keychainBefore = keychainCalls;
    assert.strictEqual((await captureWarnings(() => getSetupStatus())).result.authMethod, 'api-key', 'no CLI answer + a saved key');
    assert.strictEqual(keychainCalls, keychainBefore);
    registerAnthropicKeyReader(null);

    // ANTHROPIC_API_KEY in the environment is the last resort.
    keychainAnswer = false;
    process.env.ANTHROPIC_API_KEY = PLACEHOLDER_KEY;
    clearSetupCache();
    assert.strictEqual((await captureWarnings(() => getSetupStatus())).result.authMethod, 'api-key');
    delete process.env.ANTHROPIC_API_KEY;

    // A slow answer, with an injected time limit: `timeout`.
    set({ auth: loggedIn, 'auth-delay': '2' });
    __testOnly.setAuthCheckTimeout(200);
    const slow = await captureWarnings(() => getSetupStatus());
    __testOnly.setAuthCheckTimeout(null);
    assert.strictEqual(slow.result.state, 'needs-auth');
    assert.ok(
      slow.result.diagnostics.some((line) => line.startsWith("Claude's sign-in check gave no usable answer: timeout (exit none, ")),
      slow.result.diagnostics.join(' | '),
    );
  } finally {
    process.env.PATH = originalPath;
    delete process.env.RITEMARK_FAKE_CLAUDE;
    if (originalEnvKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalEnvKey;
    registerAnthropicKeyReader(null);
    __testOnly.setKeychainCheck(null);
    __testOnly.setAuthCheckTimeout(null);
    clearSetupCache();
    rmSync(dir, { recursive: true, force: true });
  }

  // winget is Windows-only; elsewhere the answer is an immediate false.
  assert.strictEqual(await checkWingetAvailable(), false);

  console.log('getSetupStatus probe tests passed');
}

// Why `claude auth status --json` gave no usable answer (#703), one small script per case. POSIX scripts: macOS.
async function testAuthCheckReasons() {
  if (process.platform !== 'darwin') {
    console.log('auth check reason tests skipped (macOS only)');
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), 'ritemark-auth-check-'));
  const script = (name: string, body: string, mode = 0o755) => {
    const path = join(dir, name);
    writeFileSync(path, `#!/bin/sh\n${body}\n`, { mode });
    return path;
  };
  try {
    // A notice printed before the JSON makes it unusable (one of the plan's likely causes on a cold start).
    const notice = await checkClaudeAuthStatus(script('notice', `printf 'Update available\\n{"loggedIn":true}'`));
    assert.ok('unusable' in notice && notice.unusable.reason === 'no-json', JSON.stringify(notice));
    assert.strictEqual(notice.unusable.status, 0);
    assert.strictEqual(notice.unusable.stdoutBytes, Buffer.byteLength('Update available\n{"loggedIn":true}'));

    // Nothing printed and a failing exit: no-json with the exit status.
    const silent = await checkClaudeAuthStatus(script('silent', 'exit 3'));
    assert.deepStrictEqual('unusable' in silent && [silent.unusable.reason, silent.unusable.status, silent.unusable.stdoutBytes, silent.unusable.stderrBytes], ['no-json', 3, 0, 0]);

    // JSON on stderr still counts, as before.
    assert.deepStrictEqual(await checkClaudeAuthStatus(script('stderr', `printf '{"loggedIn":true,"authMethod":"apiKey"}' >&2; exit 1`)), { method: 'api-key' });

    // An answer printed before the time limit counts, even though the process is then stopped. (A generous limit: a
    // script's first run can be slow while macOS checks the new file.)
    __testOnly.setAuthCheckTimeout(2000);
    assert.deepStrictEqual(await checkClaudeAuthStatus(script('answers-then-hangs', `printf '{"loggedIn":false}'; exec sleep 8`)), { method: null });
    __testOnly.setAuthCheckTimeout(300);
    const hung = await checkClaudeAuthStatus(script('hangs', 'exec sleep 5'));
    __testOnly.setAuthCheckTimeout(null);
    assert.ok('unusable' in hung && hung.unusable.reason === 'timeout', JSON.stringify(hung));
    assert.strictEqual(hung.unusable.status, null);
    assert.ok(hung.unusable.elapsedMs >= 300, `the time limit was kept (${hung.unusable.elapsedMs} ms)`);

    // A CLI that can't start: spawn-error with its code.
    const missing = await checkClaudeAuthStatus(join(dir, 'not-there'));
    assert.ok('unusable' in missing && missing.unusable.reason === 'spawn-error:ENOENT', JSON.stringify(missing));
    const notExecutable = await checkClaudeAuthStatus(script('not-executable', 'exit 0', 0o644));
    assert.ok('unusable' in notExecutable && notExecutable.unusable.reason === 'spawn-error:EACCES', JSON.stringify(notExecutable));
  } finally {
    __testOnly.setAuthCheckTimeout(null);
    rmSync(dir, { recursive: true, force: true });
  }
  console.log('auth check reason tests passed');
}

// #703 end to end, as Windows runs it: Claude at its Windows install path answers its sign-in check with no JSON, and
// cmdkey, the old fallback, prints what it really prints on a PC with no Claude credential: its filter repeated in
// the header, then "* NONE *", exit 0. That used to read as signed in. Run on macOS with `process.platform` set to
// win32 and the programs faked (POSIX scripts), cmd.exe too: Node runs a Windows shell command as
// `cmd.exe /d /s /c "<command>"`, so main's cmdkey call reaches the fake and this test fails on main.
async function testWindowsColdStart() {
  if (process.platform !== 'darwin') {
    console.log('Windows cold-start test skipped (runs on macOS with fakes)');
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), 'ritemark-fake-windows-'));
  const bin = join(dir, 'bin');
  const claudeDir = join(dir, 'Programs', 'Claude');
  mkdirSync(bin);
  mkdirSync(claudeDir, { recursive: true });
  const claude = join(claudeDir, 'claude.exe');
  writeFileSync(claude, FAKE_CLAUDE, { mode: 0o755 });
  writeFileSync(join(bin, 'cmd.exe'), [
    '#!/bin/sh',
    'command=$(printf \'%s\' "$4" | sed \'s/^"//; s/"$//\')',
    'exec /bin/sh -c "$command"',
    '',
  ].join('\n'), { mode: 0o755 });
  writeFileSync(join(bin, 'cmdkey'), [
    '#!/bin/sh',
    'echo "$*" >> "$RITEMARK_FAKE_CLAUDE/cmdkey-calls"',
    "printf '\\r\\nCurrently stored credentials for Claude*:\\r\\n\\r\\n* NONE *\\r\\n'",
    'exit 0',
    '',
  ].join('\n'), { mode: 0o755 });
  for (const [name, value] of Object.entries({
    version: '2.1.999 (Claude Code)', 'version-stderr': '', 'version-exit': '0', 'version-delay': '0',
    auth: 'Welcome to Claude Code', 'auth-delay': '0', calls: '', 'cmdkey-calls': '',
  })) writeFileSync(join(dir, name), value);

  const saved = {
    platform: process.platform,
    PATH: process.env.PATH,
    LOCALAPPDATA: process.env.LOCALAPPDATA,
    APPDATA: process.env.APPDATA,
    USERPROFILE: process.env.USERPROFILE,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  };
  const restore = (name: 'PATH' | 'LOCALAPPDATA' | 'APPDATA' | 'USERPROFILE' | 'ANTHROPIC_API_KEY') => {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  };
  Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
  process.env.PATH = `${bin}${delimiter}${saved.PATH}`;
  process.env.LOCALAPPDATA = dir;
  process.env.APPDATA = dir;
  process.env.USERPROFILE = dir;
  process.env.RITEMARK_FAKE_CLAUDE = dir;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    clearSetupCache();
    const status = await captureWarnings(() => getSetupStatus());
    assert.strictEqual(status.result.binaryPath, claude, 'the fake Claude at its Windows install path ran');
    assert.strictEqual(status.result.state, 'needs-auth', '#703: no usable answer and no key on Windows is signed out, not signed in');
    assert.strictEqual(status.result.authMethod, null);
    assert.ok(status.result.diagnostics.some((line) => line.startsWith("Claude's sign-in check gave no usable answer: no-json")));
    assert.strictEqual(readFileSync(join(dir, 'cmdkey-calls'), 'utf-8'), '', 'cmdkey is no longer asked');

    // A key saved in Ritemark still makes it ready.
    registerAnthropicKeyReader(async () => PLACEHOLDER_KEY);
    assert.strictEqual((await captureWarnings(() => getSetupStatus())).result.authMethod, 'api-key');
  } finally {
    Object.defineProperty(process, 'platform', { value: saved.platform, configurable: true });
    for (const name of ['PATH', 'LOCALAPPDATA', 'APPDATA', 'USERPROFILE', 'ANTHROPIC_API_KEY'] as const) restore(name);
    delete process.env.RITEMARK_FAKE_CLAUDE;
    registerAnthropicKeyReader(null);
    clearSetupCache();
    rmSync(dir, { recursive: true, force: true });
  }
  console.log('Windows cold-start test passed');
}

async function main() {
  await testOnboardingStatus();
  await testSetupStatusProbe();
  await testAuthCheckReasons();
  await testWindowsColdStart();
  console.log('setup.test.ts passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
