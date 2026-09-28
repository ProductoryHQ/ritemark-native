/**
 * Run: npx tsx src/agent/setup.test.ts
 */

import assert from 'assert';
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

import { getOnboardingStatus } from './setup';

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

testOnboardingStatus();

console.log('setup.test.ts passed');
