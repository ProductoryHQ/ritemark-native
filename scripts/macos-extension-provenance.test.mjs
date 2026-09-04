import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { sha256Tree } from './tree-sha256.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(repo, relative), 'utf8');

test('both macOS build paths record and verify the exact pre-sign extension payload', () => {
  for (const [relative, digestPath] of [
    ['scripts/build-prod.sh', 'ritemark-extension-pre-sign.sha256'],
    ['.github/workflows/build-macos-x64.yml', 'ritemark-extension-pre-sign.sha256'],
  ]) {
    const source = read(relative);
    assert.ok(source.includes(digestPath), `${relative} must retain an external pre-sign digest`);
    assert.match(source, /tree-sha256\.mjs[^\n]*"\$EXT(?:ENSION)?_DEST|tree-sha256\.mjs[^\n]*"\$EXT_PATH"/);
    assert.ok(source.includes('--extension-input'), `${relative} must attest the extension tree`);
    assert.ok(source.includes('--expected-extension-sha'), `${relative} must bind the external digest`);
  }
});

test('macOS signing verifies exact extension provenance after preparation and before codesign', () => {
  const source = read('scripts/codesign-app.sh');
  const preparation = source.indexOf('Normalized framework bundle symlinks');
  const exactVerification = source.indexOf('EXPECTED_EXTENSION_SHA=');
  const firstSigningMutation = source.indexOf('codesign --force');

  assert.ok(preparation >= 0 && exactVerification > preparation);
  assert.ok(firstSigningMutation > exactVerification);
  const boundary = source.slice(exactVerification, firstSigningMutation);
  assert.ok(boundary.includes('build-provenance.mjs'));
  assert.ok(boundary.includes('--verify'));
  assert.ok(boundary.includes('--extension-input "$EXTENSION_PATH"'));
  assert.ok(boundary.includes('--expected-extension-sha "$EXPECTED_EXTENSION_SHA"'));
  assert.ok(
    !source.includes('rm -rf "$WEBVIEW_NODE_MODULES"'),
    'signing must fail rather than rewrite the attested extension payload',
  );
});

test('DMG packaging relies on the post-sign deep app signature', () => {
  const source = read('scripts/create-dmg.sh');
  const provenance = source.indexOf('build-provenance.mjs');
  const signature = source.indexOf('codesign --verify --deep --strict');
  assert.ok(provenance >= 0 && signature > provenance);
});

test('x64 workflow uploads a symlink- and mode-preserving archive', () => {
  const source = read('.github/workflows/build-macos-x64.yml');
  const archive = source.indexOf('tar -czf ritemark-darwin-x64.tar.gz VSCode-darwin-x64');
  const upload = source.indexOf('path: r/ritemark-darwin-x64.tar.gz');
  assert.ok(archive >= 0 && upload > archive);
  assert.ok(!source.includes('path: r/VSCode-darwin-x64/'));
});

test('canonical release playbook extracts the verified x64 archive before signing', () => {
  const source = read('.claude/skills/release/SKILL.md');
  const download = source.indexOf('gh run download <run-id> --name ritemark-darwin-x64 --dir dist/x64-ci');
  const extract = source.indexOf('./scripts/extract-macos-x64-artifact.sh', download);
  const sign = source.indexOf('./scripts/codesign-app.sh darwin-x64', extract);
  assert.ok(download >= 0 && extract > download && sign > extract);

  const codexPlaybook = read('.agents/skills/release-process/SKILL.md');
  assert.ok(codexPlaybook.includes('./scripts/extract-macos-x64-artifact.sh'));
});

test('tar transport preserves extension symlinks, modes, and tree identity', {
  skip: process.platform === 'win32',
}, t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-x64-artifact-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, 'VSCode-darwin-x64');
  const extension = path.join(source, 'Ritemark.app', 'Contents', 'Resources', 'app', 'extensions', 'ritemark');
  const bin = path.join(extension, 'node_modules', '.bin');
  const packageRoot = path.join(extension, 'node_modules', 'fixture');
  fs.mkdirSync(bin, { recursive: true });
  fs.mkdirSync(packageRoot, { recursive: true });
  const runtime = path.join(packageRoot, 'runtime');
  fs.writeFileSync(runtime, '#!/bin/sh\nexit 0\n');
  fs.chmodSync(runtime, 0o755);
  fs.symlinkSync('../fixture/runtime', path.join(bin, 'runtime'));
  const originalDigest = sha256Tree(extension);
  fs.writeFileSync(path.join(source, 'ritemark-extension-pre-sign.sha256'), `${originalDigest}\n`);

  const archive = path.join(root, 'ritemark-darwin-x64.tar.gz');
  execFileSync('tar', ['-czf', archive, '-C', root, 'VSCode-darwin-x64']);
  const destination = path.join(root, 'verified-output');
  execFileSync(path.join(repo, 'scripts/extract-macos-x64-artifact.sh'), [archive, destination]);

  const extractedExtension = path.join(
    destination,
    'Ritemark.app',
    'Contents',
    'Resources',
    'app',
    'extensions',
    'ritemark',
  );
  assert.equal(sha256Tree(extractedExtension), originalDigest);
  assert.equal(fs.lstatSync(path.join(extractedExtension, 'node_modules', '.bin', 'runtime')).isSymbolicLink(), true);
  fs.accessSync(path.join(extractedExtension, 'node_modules', 'fixture', 'runtime'), fs.constants.X_OK);
});
