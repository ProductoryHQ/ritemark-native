/**
 * Sprint 152 (R7): this extension fills the frame its shell draws (`branding/product.json`'s `ritemarkFrame`), by the
 * release check's own rules (`scripts/check-frame-manifest.mjs`): its view containers, head rows, permanent tabs, desk
 * front, welcome and Home's place, and its defaults for the shell's frame-shaping settings.
 * Run: npx tsx src/frameIdentifiers.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

async function main(): Promise<void> {
  const extensionDir = path.resolve(__dirname, '..');
  const root = path.resolve(extensionDir, '..', '..');
  const { frameMismatches, readFrameIdentifiers } = await import(pathToFileURL(path.join(root, 'scripts', 'check-frame-manifest.mjs')).href);
  const pkg = JSON.parse(readFileSync(path.join(extensionDir, 'package.json'), 'utf8'));
  const product = JSON.parse(readFileSync(path.join(root, 'branding', 'product.json'), 'utf8'));
  const identifiers = readFrameIdentifiers(readFileSync(path.join(extensionDir, 'src', 'frameIdentifiers.ts'), 'utf8'));
  assert.ok(product.ritemarkFrame?.settings?.length, 'the manifest names the frame-shaping settings');
  assert.deepEqual(frameMismatches(product, pkg, identifiers), []);
  console.log('frameIdentifiers: all assertions passed');
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
