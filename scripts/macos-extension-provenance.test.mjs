import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

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
