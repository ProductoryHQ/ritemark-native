/**
 * Tests for UserExtensionInstaller.applyUpdate — the copy-then-overlay install
 * path introduced in Sprint 98.
 *
 * These cover the incident that motivated the rewrite (v1.8.3-ext.1, issue #142):
 * an update whose manifest lists only a handful of files used to produce an
 * extension directory containing ONLY those files, so the extension threw at
 * module load and could not recover itself. The installer now clones the bundled
 * extension first and overlays the delta on top.
 *
 * Run: npx tsx src/update/applyUpdate.test.ts
 */

// ── Minimal vscode stub (the installer chain imports vscode) ────────────────
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require('module') as {
  _resolveFilename: (request: string, parent: unknown, isMain: boolean) => string;
};
const vscodeMod = {
  window: { showInformationMessage: async () => undefined },
  commands: { executeCommand: async () => undefined },
  env: { appRoot: '__APP_ROOT_NOT_SET__' },
  extensions: { getExtension: () => undefined },
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
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { UserExtensionInstaller } = require('./userExtensionInstaller') as typeof import('./userExtensionInstaller');
import type { UpdateManifest } from './updateManifest';

const tempRoot = join(tmpdir(), `ritemark-apply-update-test-${process.pid}`);
const appRoot = join(tempRoot, 'app');
const userData = join(tempRoot, 'userdata');

const DIR_NAME = 'ritemark-1.9.9-ext.1';

/** Files the "bundled" extension ships that no delta ever mentions. */
const BUNDLED_ONLY = [
  ['node_modules/pdfkit/package.json', '{"name":"pdfkit"}'],
  ['themes/ritemark-light.json', '{"name":"Ritemark Light"}'],
  ['media/logo.svg', '<svg/>'],
] as const;

function sha256(content: string): string {
  return createHash('sha256').update(Buffer.from(content)).digest('hex');
}

function writeFileDeep(target: string, content: string): void {
  mkdirSync(join(target, '..'), { recursive: true });
  writeFileSync(target, content);
}

/** Build a fake app bundle whose built-in extension is complete. */
function createBundledExtension(): void {
  writeFileDeep(join(appRoot, 'product.json'), '{"ritemarkVersion":"1.9.9"}');
  const bundled = join(appRoot, 'extensions', 'ritemark');
  writeFileDeep(join(bundled, 'package.json'), '{"name":"ritemark","version":"1.9.9-0"}');
  writeFileDeep(join(bundled, 'out/extension.js'), 'module.exports = { old: true };');
  for (const [rel, content] of BUNDLED_ONLY) {
    writeFileDeep(join(bundled, rel), content);
  }
}

/**
 * A delta-only manifest of exactly the shape that shipped in the incident:
 * the compiled output and package.json, and nothing else.
 */
function incidentShapedManifest(files: Array<{ path: string; content?: string; op?: 'write' | 'delete' }>): UpdateManifest {
  return {
    version: '1.9.9-ext.1',
    appVersion: '1.9.9',
    extensionVersion: '1.9.9-ext.1',
    type: 'extension',
    extensionDirName: DIR_NAME,
    releaseDate: new Date(0).toISOString(),
    releaseNotes: 'test',
    files: files.map(f => f.op === 'delete'
      ? { path: f.path, op: 'delete' as const }
      : {
        path: f.path,
        url: `data:${f.path}`,
        sha256: sha256(f.content ?? ''),
        size: Buffer.from(f.content ?? '').length,
      }),
  };
}

/** Serve manifest files from memory instead of the network. */
function stubDownloads(installer: InstanceType<typeof UserExtensionInstaller>, contents: Record<string, string>): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (installer as any).downloadFile = async (url: string) => {
    const key = url.replace(/^data:/, '');
    if (!(key in contents)) {
      throw new Error(`Unexpected download: ${url}`);
    }
    return Buffer.from(contents[key]);
  };
}

function freshInstaller(): InstanceType<typeof UserExtensionInstaller> {
  return new UserExtensionInstaller(userData);
}

function installedPath(...parts: string[]): string {
  return join(userData, 'extensions', DIR_NAME, ...parts);
}

async function run() {
  rmSync(tempRoot, { recursive: true, force: true });
  createBundledExtension();
  vscodeMod.env.appRoot = appRoot;

  // Test 1: THE INCIDENT. A delta-only manifest must still yield a COMPLETE
  // extension directory — the bundled files it never mentions must be present.
  {
    rmSync(userData, { recursive: true, force: true });
    const installer = freshInstaller();
    const manifest = incidentShapedManifest([
      { path: 'out/extension.js', content: 'module.exports = { updated: true };' },
      { path: 'package.json', content: '{"name":"ritemark","version":"1.9.9-ext.1"}' },
    ]);
    stubDownloads(installer, {
      'out/extension.js': 'module.exports = { updated: true };',
      'package.json': '{"name":"ritemark","version":"1.9.9-ext.1"}',
    });

    const result = await installer.applyUpdate(manifest);
    assert.strictEqual(result.success, true, `install failed: ${result.error}`);

    for (const [rel] of BUNDLED_ONLY) {
      assert.ok(existsSync(installedPath(rel)), `bundled file missing after update: ${rel}`);
    }
    assert.strictEqual(
      readFileSync(installedPath('out/extension.js'), 'utf-8'),
      'module.exports = { updated: true };',
      'delta did not overlay the bundled file'
    );
    console.log('✓ Test 1: delta-only manifest still produces a complete extension dir (#142 incident)');
  }

  // Test 2: a previously installed BROKEN directory must not short-circuit a
  // corrected re-release of the same version.
  {
    rmSync(userData, { recursive: true, force: true });
    const broken = installedPath();
    writeFileDeep(join(broken, 'package.json'), '{"name":"ritemark"}');
    writeFileDeep(join(broken, 'out/extension.js'), 'broken');
    assert.ok(!existsSync(join(broken, 'node_modules')), 'fixture should have no node_modules');

    const installer = freshInstaller();
    const manifest = incidentShapedManifest([
      { path: 'out/extension.js', content: 'repaired' },
    ]);
    stubDownloads(installer, { 'out/extension.js': 'repaired' });

    const result = await installer.applyUpdate(manifest);
    assert.strictEqual(result.success, true, `install failed: ${result.error}`);
    assert.notStrictEqual(result.error, 'Already installed', 'broken install short-circuited a repair');
    assert.ok(existsSync(installedPath('node_modules/pdfkit/package.json')), 'repair did not restore deps');
    assert.strictEqual(readFileSync(installedPath('out/extension.js'), 'utf-8'), 'repaired');
    console.log('✓ Test 2: a broken install is replaced, not skipped as "Already installed"');
  }

  // Test 3: a healthy install of the same version is still a no-op.
  {
    rmSync(userData, { recursive: true, force: true });
    const installer = freshInstaller();
    const manifest = incidentShapedManifest([{ path: 'out/extension.js', content: 'v1' }]);
    stubDownloads(installer, { 'out/extension.js': 'v1' });
    await installer.applyUpdate(manifest);

    const second = freshInstaller();
    stubDownloads(second, {});   // any download would throw
    const result = await second.applyUpdate(manifest);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.error, 'Already installed');
    console.log('✓ Test 3: a healthy install of the same version stays a no-op');
  }

  // Test 4: minimumAppVersion is enforced at the installer, the last gate before disk.
  {
    rmSync(userData, { recursive: true, force: true });
    const installer = freshInstaller();
    const manifest = incidentShapedManifest([{ path: 'out/extension.js', content: 'v1' }]);
    manifest.minimumAppVersion = '99.0.0';
    stubDownloads(installer, {});

    const result = await installer.applyUpdate(manifest);
    assert.strictEqual(result.success, false);
    assert.match(result.error ?? '', /requires app version 99\.0\.0, but this app is 1\.9\.9/);
    assert.ok(!existsSync(installedPath()), 'refused install still touched the extensions dir');
    console.log('✓ Test 4: minimumAppVersion is refused before anything is written');
  }

  // Test 5: op:'delete' removes a file the bundled copy still ships.
  {
    rmSync(userData, { recursive: true, force: true });
    const installer = freshInstaller();
    const manifest = incidentShapedManifest([
      { path: 'out/extension.js', content: 'v2' },
      { path: 'themes/ritemark-light.json', op: 'delete' },
    ]);
    stubDownloads(installer, { 'out/extension.js': 'v2' });

    const result = await installer.applyUpdate(manifest);
    assert.strictEqual(result.success, true, `install failed: ${result.error}`);
    assert.ok(!existsSync(installedPath('themes/ritemark-light.json')), 'deleted file survived');
    assert.ok(existsSync(installedPath('media/logo.svg')), 'delete removed an unrelated file');
    console.log('✓ Test 5: op:delete removes an inherited bundled file');
  }

  // Test 6: a manifest path that escapes the extension directory is refused.
  {
    rmSync(userData, { recursive: true, force: true });
    const installer = freshInstaller();
    const manifest = incidentShapedManifest([{ path: 'out/extension.js', content: 'v1' }]);
    // Bypass validateManifest the way a hand-rolled caller would.
    manifest.files!.push({ path: '../../escaped.js', url: 'data:escape', sha256: sha256('x'), size: 1 });
    stubDownloads(installer, { 'out/extension.js': 'v1', escape: 'x' });

    const result = await installer.applyUpdate(manifest);
    assert.strictEqual(result.success, false);
    assert.match(result.error ?? '', /outside the extension directory/);
    assert.ok(!existsSync(join(userData, 'escaped.js')), 'path traversal wrote outside staging');
    assert.ok(!existsSync(installedPath()), 'failed install left a directory behind');
    console.log('✓ Test 6: a path escaping the extension directory is refused');
  }

  // Test 7: fail closed when the bundled extension cannot be located.
  {
    rmSync(userData, { recursive: true, force: true });
    vscodeMod.env.appRoot = join(tempRoot, 'does-not-exist');
    const installer = freshInstaller();
    const manifest = incidentShapedManifest([{ path: 'out/extension.js', content: 'v1' }]);
    stubDownloads(installer, {});

    const result = await installer.applyUpdate(manifest);
    assert.strictEqual(result.success, false);
    assert.match(result.error ?? '', /bundled extension/);
    assert.ok(!existsSync(installedPath()), 'install proceeded without a base layer');
    vscodeMod.env.appRoot = appRoot;
    console.log('✓ Test 7: install fails closed when the bundled copy is missing');
  }

  // Test 8: a checksum mismatch leaves nothing installed and no staging behind.
  {
    rmSync(userData, { recursive: true, force: true });
    const installer = freshInstaller();
    const manifest = incidentShapedManifest([{ path: 'out/extension.js', content: 'expected' }]);
    stubDownloads(installer, { 'out/extension.js': 'tampered' });

    const result = await installer.applyUpdate(manifest);
    assert.strictEqual(result.success, false);
    assert.match(result.error ?? '', /Checksum mismatch/);
    assert.ok(!existsSync(installedPath()), 'checksum failure still installed');
    assert.ok(!existsSync(join(userData, 'staging', DIR_NAME)), 'staging not cleaned up');
    console.log('✓ Test 8: checksum mismatch installs nothing and cleans staging');
  }

  rmSync(tempRoot, { recursive: true, force: true });
  console.log('\nAll 8 tests passed!');
}

run().catch((err) => {
  console.error(err);
  rmSync(tempRoot, { recursive: true, force: true });
  process.exit(1);
});
