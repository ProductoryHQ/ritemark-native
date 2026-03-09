/**
 * Run: npx tsx src/agent/installer.test.ts
 */

import assert from 'assert';
import { classifyClaudeInstallResult } from './installer';

{
  const result = classifyClaudeInstallResult({
    exitCode: 0,
    statusAfterInstall: {
      cliInstalled: true,
      runnable: true,
      cliVersion: '1.2.3',
      binaryPath: '/usr/local/bin/claude',
      authenticated: false,
      authMethod: null,
      state: 'needs-auth',
      diagnostics: [],
      repairAction: null,
      error: null,
    },
    stderrOutput: '',
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.outcome, 'installed');
}

{
  const result = classifyClaudeInstallResult({
    exitCode: 0,
    statusAfterInstall: {
      cliInstalled: false,
      runnable: false,
      cliVersion: undefined,
      binaryPath: undefined,
      authenticated: false,
      authMethod: null,
      state: 'not-installed',
      diagnostics: [],
      repairAction: 'install',
      error: null,
    },
    stderrOutput: '',
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.outcome, 'installed_needs_reload');
}

{
  const result = classifyClaudeInstallResult({
    exitCode: 0,
    statusAfterInstall: {
      cliInstalled: true,
      runnable: false,
      cliVersion: '1.2.3',
      binaryPath: '/usr/local/bin/claude',
      authenticated: false,
      authMethod: null,
      state: 'broken-install',
      diagnostics: ['Missing dependency'],
      repairAction: 'repair',
      error: 'Claude failed to start',
    },
    stderrOutput: '',
  });

  assert.strictEqual(result.success, false);
  assert.strictEqual(result.outcome, 'verification_failed');
  assert.strictEqual(result.error, 'Claude failed to start');
}

{
  const result = classifyClaudeInstallResult({
    exitCode: 1,
    statusAfterInstall: {
      cliInstalled: false,
      runnable: false,
      cliVersion: undefined,
      binaryPath: undefined,
      authenticated: false,
      authMethod: null,
      state: 'not-installed',
      diagnostics: [],
      repairAction: 'install',
      error: null,
    },
    stderrOutput: 'installer exploded',
  });

  assert.strictEqual(result.success, false);
  assert.strictEqual(result.outcome, 'install_failed');
  assert.strictEqual(result.error, 'installer exploded');
}

console.log('installer.test.ts passed');
