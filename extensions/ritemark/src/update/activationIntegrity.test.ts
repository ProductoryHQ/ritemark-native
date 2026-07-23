/**
 * Tests for the rollback-safety mechanism (Sprint 93 R9): N-1 retention in
 * cleanupOldVersions(), quarantine of a repeat-failing version, and the
 * ActivationIntegrityTracker's started/confirmed bookkeeping.
 *
 * Run: npx tsx src/update/activationIntegrity.test.ts
 */

// ── Minimal vscode stub (UserExtensionInstaller imports vscode) ─────────────
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require('module') as {
  _resolveFilename: (request: string, parent: unknown, isMain: boolean) => string;
};
const vscodeMod = {
  window: { showInformationMessage: async () => undefined },
  commands: { executeCommand: async () => undefined },
};
const _originalResolve = Module._resolveFilename.bind(Module);
Module._resolveFilename = function (request: string, ...rest: [unknown, boolean]) {
  if (request === 'vscode') { return '__vscode_stub__'; }
  return _originalResolve(request, ...rest);
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(require as any).cache['__vscode_stub__'] = {
  id: '__vscode_stub__', filename: '__vscode_stub__', loaded: true, children: [], paths: [], exports: vscodeMod,
};

import * as assert from 'assert';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { UserExtensionInstaller } = require('./userExtensionInstaller') as typeof import('./userExtensionInstaller');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ActivationIntegrityTracker } = require('./activationIntegrity') as typeof import('./activationIntegrity');

function createMemento() {
  const store = new Map<string, unknown>();
  return {
    get: (key: string, def?: unknown) => (store.has(key) ? store.get(key) : def),
    update: async (key: string, value: unknown) => { store.set(key, value); },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const tempRoot = join(tmpdir(), `ritemark-activation-integrity-test-${process.pid}`);

async function run() {
  // Test 1: cleanupOldVersions keeps ALL versions passed, deletes the rest.
  {
    const extDir = join(tempRoot, 'extensions');
    mkdirSync(join(extDir, 'ritemark-1.0.0'), { recursive: true });
    mkdirSync(join(extDir, 'ritemark-1.0.1'), { recursive: true });
    mkdirSync(join(extDir, 'ritemark-1.0.2'), { recursive: true });

    const installer = new UserExtensionInstaller(tempRoot);
    await installer.cleanupOldVersions(['1.0.1', '1.0.2']);

    assert.strictEqual(existsSync(join(extDir, 'ritemark-1.0.0')), false, '1.0.0 must be removed (not in keep list)');
    assert.strictEqual(existsSync(join(extDir, 'ritemark-1.0.1')), true, '1.0.1 must be kept (N-1)');
    assert.strictEqual(existsSync(join(extDir, 'ritemark-1.0.2')), true, '1.0.2 must be kept (current)');
    console.log('✓ Test 1: cleanupOldVersions keeps exactly the N versions passed');
  }

  // Test 1b (#142 bug B): cleanup must NOT delete a staged version newer than
  // everything in the keep list. The built-in floor's own activation passes
  // keepVersions = ['1.8.2-0']; the freshly-staged '1.8.2-ext.1' must survive
  // so a pending restart can load it.
  {
    rmSync(tempRoot, { recursive: true, force: true });
    const extDir = join(tempRoot, 'extensions');
    mkdirSync(join(extDir, 'ritemark-1.8.2-ext.1'), { recursive: true });
    mkdirSync(join(extDir, 'ritemark-1.8.1'), { recursive: true });

    const installer = new UserExtensionInstaller(tempRoot);
    await installer.cleanupOldVersions(['1.8.2-0']);

    assert.strictEqual(existsSync(join(extDir, 'ritemark-1.8.2-ext.1')), true, 'staged newer version must be preserved (not deleted by the floor cleanup)');
    assert.strictEqual(existsSync(join(extDir, 'ritemark-1.8.1')), false, 'a genuinely older version must still be removed');
    console.log('✓ Test 1b: cleanupOldVersions preserves a staged version newer than all keeps (#142 bug B)');
  }

  // Test 2: removeInstalledVersion quarantines a single specific version.
  {
    rmSync(tempRoot, { recursive: true, force: true });
    const extDir = join(tempRoot, 'extensions');
    mkdirSync(join(extDir, 'ritemark-2.0.0-ext.1'), { recursive: true });
    mkdirSync(join(extDir, 'ritemark-1.9.0'), { recursive: true });

    const installer = new UserExtensionInstaller(tempRoot);
    await installer.removeInstalledVersion('2.0.0-ext.1');

    assert.strictEqual(existsSync(join(extDir, 'ritemark-2.0.0-ext.1')), false, 'quarantined version must be removed');
    assert.strictEqual(existsSync(join(extDir, 'ritemark-1.9.0')), true, 'other versions must be untouched');
    console.log('✓ Test 2: removeInstalledVersion quarantines only the named version');
  }

  // Test 3: ActivationIntegrityTracker — fresh state never reports a failure.
  {
    const tracker = new ActivationIntegrityTracker(createMemento());
    assert.strictEqual(tracker.didPreviousAttemptFail('1.0.0'), false, 'fresh state must not report a failure');
    console.log('✓ Test 3: fresh ActivationIntegrityTracker reports no failure');
  }

  // Test 4: attempted-but-never-confirmed for the SAME version -> failure detected.
  {
    const tracker = new ActivationIntegrityTracker(createMemento());
    await tracker.setLastAttemptedVersion('1.0.1');
    // No setLastConfirmedVersion call — simulates a crash mid-activation.
    assert.strictEqual(tracker.didPreviousAttemptFail('1.0.1'), true, 'dangling attempt for the same version must report a failure');
    console.log('✓ Test 4: dangling attempt (no confirmation) for the same version is detected');
  }

  // Test 5: a CONFIRMED version does not report a failure, even on repeat launches.
  {
    const tracker = new ActivationIntegrityTracker(createMemento());
    await tracker.setLastAttemptedVersion('1.0.1');
    await tracker.setLastConfirmedVersion('1.0.1');
    assert.strictEqual(tracker.didPreviousAttemptFail('1.0.1'), false, 'a confirmed version must never report a failure');
    console.log('✓ Test 5: a confirmed version never reports a failure');
  }

  // Test 6: a dangling attempt for a DIFFERENT version than the one currently
  // loading does not false-positive (e.g. current launch is a brand-new
  // version that was never attempted before).
  {
    const tracker = new ActivationIntegrityTracker(createMemento());
    await tracker.setLastAttemptedVersion('1.0.1');
    // 1.0.1 never confirmed, but we're now loading 1.0.2 (a newer version) -
    // that's a normal new-version launch, not a repeat failure of 1.0.2.
    assert.strictEqual(tracker.didPreviousAttemptFail('1.0.2'), false, "a different (newer) version must not inherit a prior version's failure");
    console.log('✓ Test 6: a dangling attempt for a different version does not false-positive');
  }

  console.log('\nAll 7 tests passed!');
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });
