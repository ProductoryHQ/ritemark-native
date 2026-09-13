import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { listInstalledRuntimeFiles } from './list-agent-runtime-files.mjs';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'extensions/ritemark/binaries/agents/manifest.json'), 'utf8'));

test('schema-v3 package rows expand to every installed target file', () => {
  const arm = listInstalledRuntimeFiles(manifest, 'darwin', 'arm64');
  const intel = listInstalledRuntimeFiles(manifest, 'darwin', 'x64');
  const windows = listInstalledRuntimeFiles(manifest, 'win32', 'x64');
  assert.equal(arm.length, 8);
  assert.equal(intel.length, 8);
  assert.equal(windows.length, 9);
  assert.ok(arm.some(file => file.path === 'codex/codex-package.json' && !file.executable));
  assert.ok(arm.some(file => file.path === 'codex/codex-resources/zsh/bin/zsh' && file.executable));
  assert.ok(windows.some(file => file.path === 'codex/codex-resources/codex-command-runner.exe'));
  assert.ok(windows.some(file => file.path === 'opencode-path/rg.exe'));
  for (const file of [...arm, ...intel, ...windows]) assert.match(file.sha256, /^[a-f0-9]{64}$/);
});
