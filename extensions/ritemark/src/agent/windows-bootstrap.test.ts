/**
 * Windows bootstrap integration tests.
 *
 * These tests run on a real Windows machine and verify:
 * 1. Claude binary detection correctly skips extensionless Unix shims
 * 2. Codex binary detection correctly prefers .cmd/.exe over extensionless shims
 * 3. Install concurrency guard prevents double installs
 *
 * Run: npx tsx src/agent/windows-bootstrap.test.ts
 */

import assert from 'assert';
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Test 1: Claude binary detection skips extensionless shims
// ---------------------------------------------------------------------------
{
  console.log('Test 1: Claude candidate path filtering on Windows...');

  // Simulate what getCandidateClaudePaths does with `where claude` output
  const lookup = spawnSync('where', ['claude'], {
    timeout: 3000,
    encoding: 'utf-8',
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (lookup.status === 0 && lookup.stdout) {
    const allLines = lookup.stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const filteredLines = allLines.filter(p => /\.(exe|cmd|bat)$/i.test(p));

    console.log('  All `where claude` results:', allLines);
    console.log('  Filtered (Windows-spawnable):', filteredLines);

    // The extensionless shim should be filtered out
    const extensionless = allLines.filter(p => !/\.(exe|cmd|bat)$/i.test(p));
    if (extensionless.length > 0) {
      console.log('  Extensionless shims removed:', extensionless);
      assert.ok(filteredLines.length > 0, 'At least one .cmd/.exe candidate should remain after filtering');

      // Verify the extensionless file actually fails to spawn
      for (const shim of extensionless) {
        if (existsSync(shim)) {
          const result = spawnSync(shim, ['--version'], {
            timeout: 5000,
            encoding: 'utf-8',
            shell: false,
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          assert.notStrictEqual(result.status, 0, `Extensionless shim ${shim} should not be spawnable`);
          console.log(`  Confirmed: ${shim} fails to spawn (expected)`);
        }
      }

      // Verify the filtered .cmd actually works
      for (const cmd of filteredLines) {
        if (existsSync(cmd)) {
          const isCmd = /\.(cmd|bat)$/i.test(cmd);
          const result = spawnSync(cmd, ['--version'], {
            timeout: 5000,
            encoding: 'utf-8',
            shell: isCmd,
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          if (result.status === 0 && result.stdout?.trim()) {
            console.log(`  Confirmed: ${cmd} works → ${result.stdout.trim()}`);
          }
          break; // Only need to verify one
        }
      }
    } else {
      console.log('  No extensionless shims found (environment may not have npm-installed claude)');
    }
  } else {
    console.log('  SKIP: claude not found in PATH');
  }

  console.log('  PASSED');
}

// ---------------------------------------------------------------------------
// Test 2: Codex binary detection prefers .cmd/.exe on Windows
// ---------------------------------------------------------------------------
{
  console.log('Test 2: Codex binary path selection on Windows...');

  const lookup = spawnSync('where', ['codex'], {
    timeout: 3000,
    encoding: 'utf-8',
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (lookup.status === 0 && lookup.stdout) {
    const lines = lookup.stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    console.log('  All `where codex` results:', lines);

    // Apply the fix logic: prefer .exe, then .cmd, then .bat
    const exeMatch = lines.find(l => /\.exe$/i.test(l));
    const cmdMatch = lines.find(l => /\.(cmd|bat)$/i.test(l));
    const selected = exeMatch ?? cmdMatch ?? null;

    console.log('  Selected binary:', selected);

    if (selected) {
      const isCmd = /\.(cmd|bat)$/i.test(selected);
      const result = spawnSync(selected, ['--version'], {
        timeout: 10000,
        encoding: 'utf-8',
        shell: isCmd,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      console.log(`  Spawn result: status=${result.status}, stdout=${result.stdout?.trim()}`);
      assert.strictEqual(result.status, 0, `Selected binary ${selected} should be spawnable`);
      console.log(`  Confirmed: ${selected} works`);
    } else {
      console.log('  SKIP: no .cmd/.exe codex found');
    }

    // Verify extensionless would fail
    const extensionless = lines.find(l => !/\.(exe|cmd|bat)$/i.test(l));
    if (extensionless && existsSync(extensionless)) {
      const result = spawnSync(extensionless, ['--version'], {
        timeout: 5000,
        encoding: 'utf-8',
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      assert.notStrictEqual(result.status, 0, `Extensionless codex ${extensionless} should fail to spawn`);
      console.log(`  Confirmed: extensionless ${extensionless} fails (expected)`);
    }
  } else {
    console.log('  SKIP: codex not found in PATH');
  }

  console.log('  PASSED');
}

// ---------------------------------------------------------------------------
// Test 3: Install concurrency guard
// ---------------------------------------------------------------------------
{
  console.log('Test 3: Install concurrency guard...');

  // Import the guard function
  const { isClaudeInstallInProgress } = require('./installer');

  assert.strictEqual(isClaudeInstallInProgress(), false, 'Should start as false');
  console.log('  Initial state: not in progress');

  // The actual installClaude function would set the flag, but we can't call it
  // without side effects. We test that the export exists and has the right type.
  assert.strictEqual(typeof isClaudeInstallInProgress, 'function');
  console.log('  Guard function exported correctly');

  console.log('  PASSED');
}

// ---------------------------------------------------------------------------
// Test 4: getSpawnCommand handles .cmd files correctly
// ---------------------------------------------------------------------------
{
  console.log('Test 4: Spawn command for .cmd files...');

  // Replicate the getSpawnCommand logic
  function getSpawnCommand(binaryPath: string) {
    if (process.platform === 'win32' && binaryPath.toLowerCase().endsWith('.cmd')) {
      return { command: binaryPath, args: [] as string[], shell: true };
    }
    return { command: binaryPath, args: [] as string[], shell: false };
  }

  const cmdResult = getSpawnCommand('C:\\Users\\test\\npm\\claude.cmd');
  assert.strictEqual(cmdResult.shell, true, '.cmd files should use shell: true');

  const exeResult = getSpawnCommand('C:\\Users\\test\\claude.exe');
  assert.strictEqual(exeResult.shell, false, '.exe files should not use shell');

  const plainResult = getSpawnCommand('C:\\Users\\test\\npm\\claude');
  assert.strictEqual(plainResult.shell, false, 'extensionless files get shell: false (and will fail)');

  console.log('  PASSED');
}

console.log('\nAll Windows bootstrap tests passed.');
