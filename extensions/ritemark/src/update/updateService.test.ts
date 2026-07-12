/**
 * Tests for UpdateService's mode-based silent-stage vs. notification branching
 * (Sprint 93 R6/R10).
 *
 * Run: npx tsx src/update/updateService.test.ts
 */

// ── Minimal vscode stub ──────────────────────────────────────────────────────
// UpdateService/UpdateStorage/UserExtensionInstaller all import vscode.
// Pre-populate the require cache before any other imports (same pattern as
// BrowserToolsInjector.test.ts).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require('module') as {
  _resolveFilename: (request: string, parent: unknown, isMain: boolean) => string;
  _cache: Record<string, unknown>;
};

let configuredMode = 'auto';
let informationMessageCalls = 0;
let mockCurrentExtensionVersion = '0.0.0';

const vscodeMod = {
  workspace: {
    getConfiguration: (section?: string) => ({
      get: (key: string, def: unknown) => {
        if (section === 'ritemark.updates' && key === 'mode') { return configuredMode; }
        if (section === 'ritemark.updates' && key === 'enabled') { return true; }
        return def;
      },
    }),
  },
  window: {
    showInformationMessage: async () => { informationMessageCalls++; return undefined; },
    withProgress: async (_opts: unknown, task: (p: { report: () => void }) => Promise<void>) =>
      task({ report: () => undefined }),
  },
  commands: {
    executeCommand: async () => undefined,
  },
  extensions: {
    getExtension: () => ({ packageJSON: { version: mockCurrentExtensionVersion } }),
  },
  env: {
    appRoot: '/tmp/ritemark-update-service-test-approot',
  },
};

const _originalResolve = Module._resolveFilename.bind(Module);
Module._resolveFilename = function (request: string, ...rest: [unknown, boolean]) {
  if (request === 'vscode') { return '__vscode_stub__'; }
  return _originalResolve(request, ...rest);
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(require as any).cache['__vscode_stub__'] = {
  id: '__vscode_stub__',
  filename: '__vscode_stub__',
  loaded: true,
  children: [],
  paths: [],
  exports: vscodeMod,
};

// getCurrentAppVersion() reads <appRoot>/product.json; give it a real (fake)
// one so the test output isn't full of harmless-but-noisy ENOENT warnings.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs') as typeof import('fs');
fs.mkdirSync(vscodeMod.env.appRoot, { recursive: true });
fs.writeFileSync(
  `${vscodeMod.env.appRoot}/product.json`,
  JSON.stringify({ ritemarkVersion: '1.8.1' })
);

// ── Now safe to import vscode-dependent modules ──────────────────────────────
// Runtime require() (not a static import) so tsx's ESM-aware resolver doesn't
// bypass the Module._resolveFilename stub above — matches
// BrowserToolsInjector.test.ts's working precedent.
import * as assert from 'assert';
import type { UpdateManifest } from './updateManifest';
import type { ResolvedUpdateResult } from './updateResolver';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { UpdateService } = require('./updateService') as typeof import('./updateService');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { UpdateStorage } = require('./updateStorage') as typeof import('./updateStorage');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { UserExtensionInstaller } = require('./userExtensionInstaller') as typeof import('./userExtensionInstaller');

function createMemento() {
  const store = new Map<string, unknown>();
  return {
    get: (key: string, def?: unknown) => (store.has(key) ? store.get(key) : def),
    update: async (key: string, value: unknown) => { store.set(key, value); },
    keys: () => Array.from(store.keys()),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function createManifest(): UpdateManifest {
  return {
    version: '1.8.2-ext.2',
    appVersion: '1.8.2',
    extensionVersion: '1.8.2-ext.2',
    type: 'extension',
    installType: 'user-extension',
    extensionId: 'ritemark',
    extensionDirName: 'ritemark-1.8.2-ext.2',
    releaseDate: '2026-07-12T00:00:00Z',
    minimumAppVersion: '1.8.2',
    files: []
  };
}

function createResolved(action: 'extension' | 'full'): ResolvedUpdateResult {
  return {
    action,
    currentAppVersion: '1.8.1',
    currentExtensionVersion: '1.8.1',
    targetVersion: '1.8.2-ext.2',
    manifest: createManifest()
  };
}

async function run() {
  // Test 1: mode 'auto' + action 'extension' + successful install -> silent
  // stage, no notification, pendingRestartVersion set, callback fired.
  {
    configuredMode = 'auto';
    informationMessageCalls = 0;
    let stagedVersion = '';
    const originalApplyUpdate = UserExtensionInstaller.prototype.applyUpdate;
    UserExtensionInstaller.prototype.applyUpdate = async () => ({ success: true, version: '1.8.2-ext.2' });

    const storage = new UpdateStorage(createMemento());
    const service = new UpdateService(storage, (v) => { stagedVersion = v; });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).lastResolved = createResolved('extension');
    const snapshot = await service.getStatusSnapshot();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).notifyIfNeeded(snapshot, false);

    assert.strictEqual(informationMessageCalls, 0, 'auto mode must not show a notification');
    assert.strictEqual(stagedVersion, '1.8.2-ext.2', 'onUpdateStagedSilently callback must fire with the target version');
    assert.strictEqual(storage.getPendingRestartVersion(), '1.8.2-ext.2', 'pendingRestartVersion must be set after silent success');

    UserExtensionInstaller.prototype.applyUpdate = originalApplyUpdate;
    console.log('✓ Test 1: mode=auto silent-success stages update, no notification');
  }

  // Test 2: mode 'auto' + action 'extension' + checksum failure -> no state
  // change, no notification.
  {
    configuredMode = 'auto';
    informationMessageCalls = 0;
    let callbackFired = false;
    const originalApplyUpdate = UserExtensionInstaller.prototype.applyUpdate;
    UserExtensionInstaller.prototype.applyUpdate = async () => ({ success: false, error: 'Checksum mismatch for out/extension.js' });

    const storage = new UpdateStorage(createMemento());
    const service = new UpdateService(storage, () => { callbackFired = true; });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).lastResolved = createResolved('extension');
    const snapshot = await service.getStatusSnapshot();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).notifyIfNeeded(snapshot, false);

    assert.strictEqual(informationMessageCalls, 0, 'auto mode must not show a notification even on failure');
    assert.strictEqual(callbackFired, false, 'onUpdateStagedSilently must not fire on failure');
    assert.strictEqual(storage.getPendingRestartVersion(), '', 'pendingRestartVersion must remain unset after a failed silent stage');

    UserExtensionInstaller.prototype.applyUpdate = originalApplyUpdate;
    console.log('✓ Test 2: mode=auto checksum-failure leaves state untouched');
  }

  // Test 3: mode 'prompt' + action 'extension' -> existing notification flow,
  // installer.applyUpdate is NOT called directly (no silent bypass).
  {
    configuredMode = 'prompt';
    informationMessageCalls = 0;
    let directApplyCalled = false;
    const originalApplyUpdate = UserExtensionInstaller.prototype.applyUpdate;
    UserExtensionInstaller.prototype.applyUpdate = async () => { directApplyCalled = true; return { success: true, version: '1.8.2-ext.2' }; };

    const storage = new UpdateStorage(createMemento());
    const service = new UpdateService(storage);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).lastResolved = createResolved('extension');
    const snapshot = await service.getStatusSnapshot();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).notifyIfNeeded(snapshot, false);

    assert.strictEqual(informationMessageCalls, 1, 'prompt mode must show the existing notification');
    assert.strictEqual(directApplyCalled, false, 'prompt mode must not call installer.applyUpdate directly (no silent bypass)');

    UserExtensionInstaller.prototype.applyUpdate = originalApplyUpdate;
    console.log('✓ Test 3: mode=prompt preserves the existing notification flow');
  }

  // Test 4: action 'full' is unaffected by mode — always the full-update
  // notification, even when mode is 'auto'.
  {
    configuredMode = 'auto';
    informationMessageCalls = 0;
    let directApplyCalled = false;
    const originalApplyUpdate = UserExtensionInstaller.prototype.applyUpdate;
    UserExtensionInstaller.prototype.applyUpdate = async () => { directApplyCalled = true; return { success: true, version: '1.8.2' }; };

    const storage = new UpdateStorage(createMemento());
    const service = new UpdateService(storage);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).lastResolved = createResolved('full');
    const snapshot = await service.getStatusSnapshot();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).notifyIfNeeded(snapshot, false);

    assert.strictEqual(informationMessageCalls, 1, 'full-app updates must always show the full-update notification');
    assert.strictEqual(directApplyCalled, false, "mode='auto' must not silently apply a full-app update");

    UserExtensionInstaller.prototype.applyUpdate = originalApplyUpdate;
    console.log("✓ Test 4: action='full' unaffected by mode='auto'");
  }

  // Test 5 (W3.4 regression guard): reconcilePendingRestartVersion must still
  // clear pendingRestartVersion once getCurrentVersion() matches/exceeds it,
  // under the NEW silent-stage path (not just the old notification path).
  // Simulates: a silent stage set pendingRestartVersion, the app restarted,
  // and VS Code's own extension-directory dedup (confirmed in tasks.md W3.4)
  // now resolves the active extension to that staged version.
  {
    mockCurrentExtensionVersion = '1.8.2-ext.2';
    const storage = new UpdateStorage(createMemento());
    await storage.setPendingRestartVersion('1.8.2-ext.2');
    assert.strictEqual(storage.getPendingRestartVersion(), '1.8.2-ext.2', 'precondition: pendingRestartVersion set before restart');

    const service = new UpdateService(storage);
    const snapshot = await service.getStatusSnapshot();

    assert.strictEqual(storage.getPendingRestartVersion(), '', 'pendingRestartVersion must clear once the current version matches the staged one');
    assert.notStrictEqual(snapshot.state, 'restart-required', 'status must no longer report restart-required after reconciliation');

    mockCurrentExtensionVersion = '0.0.0';
    console.log('✓ Test 5: reconcilePendingRestartVersion clears after a simulated restart onto the staged version');
  }

  console.log('\nAll 5 tests passed!');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
