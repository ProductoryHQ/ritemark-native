import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
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

test('the preflight tier guard matches entries at the start of a path, not anywhere in it', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'release-tier-paths-'));
  try {
    const git = (...args) => execFileSync('git', [
      '-c', 'user.name=test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args,
    ], { cwd: fixture, stdio: 'ignore' });
    const write = relPath => {
      fs.mkdirSync(path.dirname(path.join(fixture, relPath)), { recursive: true });
      fs.writeFileSync(path.join(fixture, relPath), `${relPath}\n`);
    };

    write('scripts/create-dmg.sh');
    fs.copyFileSync(
      path.join(repo, 'scripts/release-extension-preflight.sh'),
      path.join(fixture, 'scripts/release-extension-preflight.sh'),
    );
    git('init', '-q');
    git('add', '-A');
    git('commit', '-qm', 'shell release');
    git('tag', 'v1.0.0');

    // Contain an entry without starting with it: extension-tier, not flagged.
    const lookalikes = [
      'extensions/ritemark/src/googleDocs/vscodeGoogleDocs.ts',
      'extensions/ritemark/webview/src/lib/vscode.ts',
      'extensions/ritemark/webview/patches/@tiptap+core+2.27.2.patch',
      '.claude/skills/vscode-development/SKILL.md',
      'docs/scripts/build-prod.sh',
    ];
    // Start with an entry: shell-tier.
    const shellTier = [
      '.github/workflows/build-windows.yml',
      'branding/product.json',
      'extensions/ritemark/binaries/agents/manifest.json',
      'installer/windows/ritemark.iss',
      'patches/vscode/017-ritemark-ä.patch',
      'scripts/build-prod.sh',
    ];
    for (const file of [...lookalikes, ...shellTier]) write(file);
    // A shell-tier file moved away still counts, under its old path.
    fs.mkdirSync(path.join(fixture, 'tools'));
    fs.renameSync(path.join(fixture, 'scripts/create-dmg.sh'), path.join(fixture, 'tools/create-dmg.sh'));
    git('add', '-A');
    // The submodule pointer itself (an uninitialised gitlink).
    fs.mkdirSync(path.join(fixture, 'vscode'));
    git('update-index', '--add', '--cacheinfo', `160000,${'a'.repeat(40)},vscode`);
    git('commit', '-qm', 'changes');

    const result = spawnSync('/bin/bash', ['scripts/release-extension-preflight.sh'], { cwd: fixture, encoding: 'utf8' });
    const output = result.stdout.replace(/\x1b\[[0-9;]*m/g, '');
    const block = output.match(/FAIL: shell-tier path\(s\) changed since v1\.0\.0[^\n]*\n((?: {2}[^\n]*\n)*)/);
    assert.ok(block, output);
    const flagged = block[1].split('\n').filter(Boolean).map(line => line.slice(2));
    assert.deepEqual(flagged.sort(), [...shellTier, 'scripts/create-dmg.sh', 'vscode'].sort());
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
