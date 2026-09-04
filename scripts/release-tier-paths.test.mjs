import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('Claude canon and extension preflight use the same shell-tier path list', () => {
  const claude = fs.readFileSync(path.join(repo, 'CLAUDE.md'), 'utf8');
  const preflight = fs.readFileSync(path.join(repo, 'scripts/release-extension-preflight.sh'), 'utf8');

  const canonBlock = claude.match(/## Release Tiers[^]*?\n```\n([^]*?)\n```/);
  assert.ok(canonBlock, 'CLAUDE.md Release Tiers code block must exist');
  const canonPaths = canonBlock[1].split('\n').filter(Boolean);

  const shellArray = preflight.match(/SHELL_TIER_PATHS=\(\n([^]*?)\n\)/);
  assert.ok(shellArray, 'release-extension-preflight shell-tier array must exist');
  const preflightPaths = [...shellArray[1].matchAll(/^\s+"([^"]+)"$/gm)].map(match => match[1]);

  assert.deepEqual(preflightPaths, canonPaths);
  assert.ok(
    canonPaths.includes('scripts/stage-extension-for-shell-build.sh'),
    'the Windows shell staging helper must force a full shell release',
  );
});
