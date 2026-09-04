import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { isPortableExecutable, sha256Tree } from './tree-sha256.mjs';

function minimalPe(marker) {
  const content = Buffer.alloc(128);
  content.write('MZ', 0, 'ascii');
  content.writeInt32LE(64, 0x3c);
  content.write('PE\0\0', 64, 'binary');
  content.write(marker, 80, 'utf8');
  return content;
}

test('PE-normalized digest delegates PE bytes to Authenticode but binds every other byte', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-tree-sha256-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const pePath = path.join(root, 'runtime.exe');
  const jsPath = path.join(root, 'extension.js');
  fs.writeFileSync(pePath, minimalPe('unsigned'));
  fs.writeFileSync(jsPath, 'export const state = "original";\n');

  assert.equal(isPortableExecutable(fs.readFileSync(pePath)), true);
  const originalFull = sha256Tree(root);
  const originalNonPe = sha256Tree(root, { omitPortableExecutableBytes: true });

  fs.writeFileSync(pePath, minimalPe('signed'));
  assert.notEqual(sha256Tree(root), originalFull, 'full pre-sign digest must bind PE bytes');
  assert.equal(
    sha256Tree(root, { omitPortableExecutableBytes: true }),
    originalNonPe,
    'post-sign digest must tolerate only PE byte changes',
  );

  fs.appendFileSync(jsPath, '// unexpected mutation\n');
  assert.notEqual(
    sha256Tree(root, { omitPortableExecutableBytes: true }),
    originalNonPe,
    'post-sign digest must reject non-PE changes',
  );
});
