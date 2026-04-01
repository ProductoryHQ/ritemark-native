/**
 * Run: npx tsx src/agent/setup.test.ts
 */

import assert from 'assert';
import { __testOnly } from './setup';

const { deriveClaudeSetupStatus, recommendedEnvironmentAction } = __testOnly;

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
  const action = recommendedEnvironmentAction({
    platform: 'win32',
    gitInstalled: false,
    nodeInstalled: true,
    restartRequired: false,
  });

  assert.strictEqual(action, 'install-git');
}

{
  const action = recommendedEnvironmentAction({
    platform: 'win32',
    gitInstalled: true,
    nodeInstalled: false,
    restartRequired: false,
  });

  assert.strictEqual(action, 'install-node');
}

{
  const action = recommendedEnvironmentAction({
    platform: 'win32',
    gitInstalled: false,
    nodeInstalled: false,
    restartRequired: true,
  });

  assert.strictEqual(action, 'reload');
}

{
  const action = recommendedEnvironmentAction({
    platform: 'darwin',
    gitInstalled: true,
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
