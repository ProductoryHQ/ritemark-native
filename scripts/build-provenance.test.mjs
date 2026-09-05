import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { sha256Tree } from './tree-sha256.mjs';

const scripts = path.dirname(fileURLToPath(import.meta.url));
const provenance = path.join(scripts, 'build-provenance.mjs');

function git(cwd, ...args) {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
}

function write(root, relative, content) {
  const absolute = path.join(root, relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content);
}

function commitAll(cwd, message) {
  git(cwd, 'add', '-A');
  git(cwd, '-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', message);
  return git(cwd, 'rev-parse', 'HEAD');
}

// A release-shaped repository: an independent VS Code checkout recorded as a
// gitlink, the five canonical input files, a patch set, and an app whose
// extension tree doubles as the staged extension input (like the x64 workflow).
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-provenance-test-'));
  const repo = path.join(root, 'repo');
  const vscode = path.join(repo, 'vscode');
  fs.mkdirSync(vscode, { recursive: true });
  git(repo, 'init', '-q');
  git(vscode, 'init', '-q');
  write(vscode, 'package-lock.json', '{"name":"vscode"}\n');
  const vscodeCommit = commitAll(vscode, 'vscode');
  git(repo, 'update-index', '--add', '--cacheinfo', `160000,${vscodeCommit},vscode`);
  write(repo, 'extensions/ritemark/package-lock.json', '{"name":"ritemark"}\n');
  write(repo, 'extensions/ritemark/webview/package-lock.json', '{"name":"webview"}\n');
  write(repo, 'extensions/ritemark/binaries/agents/manifest.json', '{"agents":[]}\n');
  write(repo, 'branding/product.json', '{"ritemarkVersion":"1.10.0"}\n');
  write(repo, 'patches/vscode/001-test.patch', 'diff --git a/x b/x\n');
  write(repo, '.gitignore', 'VSCode-darwin-x64/\n');
  const releaseCommit = commitAll(repo, 'release source');
  git(repo, 'update-ref', 'refs/remotes/origin/main', releaseCommit);

  const app = path.join(repo, 'VSCode-darwin-x64', 'Ritemark.app');
  const extension = path.join(app, 'Contents', 'Resources', 'app', 'extensions', 'ritemark');
  write(extension, 'package.json', '{"name":"ritemark"}\n');
  const extensionSha = sha256Tree(extension);
  return { root, repo, vscode, app, extension, extensionSha, releaseCommit, vscodeCommit };
}

function run(cwd, ...args) {
  const result = spawnSync(process.execPath, [provenance, ...args], { cwd, encoding: 'utf8' });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

function writeManifest(f) {
  const written = run(f.repo, '--write', '--target', 'darwin-x64', '--app', f.app,
    '--extension-input', f.extension, '--expected-extension-sha', f.extensionSha);
  assert.equal(written.status, 0, written.output);
  return path.join(f.app, 'Contents', 'Resources', 'app', 'ritemark-build-provenance.json');
}

const verifyArgs = f => ['--verify', '--target', 'darwin-x64', '--app', f.app,
  '--extension-input', f.extension, '--expected-extension-sha', f.extensionSha];

test('same-machine verification still requires the exact working tree', () => {
  const f = fixture();
  try {
    writeManifest(f);
    assert.equal(run(f.repo, ...verifyArgs(f)).status, 0);

    // Another machine's VS Code working tree (CI copies the extension into
    // vscode/extensions; a dev worktree links it) changes the local digest.
    write(f.vscode, 'extensions/ritemark/copied.js', 'export {};\n');
    const drifted = run(f.repo, ...verifyArgs(f));
    assert.equal(drifted.status, 1);
    assert.match(drifted.output, /differs in: derivedVscodeState/);
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true });
  }
});

test('release-commit anchoring verifies a CI artifact from any working tree', () => {
  const f = fixture();
  try {
    const manifestPath = writeManifest(f);
    write(f.vscode, 'extensions/ritemark/copied.js', 'export {};\n');

    const anchored = run(f.repo, ...verifyArgs(f), '--release-commit', f.releaseCommit);
    assert.equal(anchored.status, 0, anchored.output);
    assert.match(anchored.output, new RegExp(`anchored to release commit ${f.releaseCommit}`));

    // main advancing after the build (a docs commit, a harness fix) must not
    // invalidate an artifact built from the approved release commit.
    write(f.repo, 'docs/after-release.md', 'later\n');
    const later = commitAll(f.repo, 'docs after release');
    git(f.repo, 'update-ref', 'refs/remotes/origin/main', later);
    const unanchored = run(f.repo, ...verifyArgs(f));
    assert.equal(unanchored.status, 1);
    assert.match(unanchored.output, /differs in: sourceCommit, releaseRefCommit/);
    assert.equal(run(f.repo, ...verifyArgs(f), '--release-commit', f.releaseCommit).status, 0);

    // The build machine's VS Code state digest is required even though it is
    // not recomputed here.
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.match(manifest.derivedVscodeState.vscodeStateSha256, /^[a-f0-9]{64}$/);
    const stripped = structuredClone(manifest);
    delete stripped.derivedVscodeState.vscodeStateSha256;
    fs.writeFileSync(manifestPath, JSON.stringify(stripped));
    const missing = run(f.repo, ...verifyArgs(f), '--release-commit', f.releaseCommit);
    assert.equal(missing.status, 1);
    assert.match(missing.output, /missing the build machine VS Code state digest/);
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true });
  }
});

test('release-commit anchoring rejects the wrong commit, a tampered manifest, and off-main commits', () => {
  const f = fixture();
  try {
    const manifestPath = writeManifest(f);

    const unknown = run(f.repo, ...verifyArgs(f), '--release-commit', 'f'.repeat(40));
    assert.equal(unknown.status, 1);
    assert.match(unknown.output, /does not exist in this repository/);

    const short = run(f.repo, ...verifyArgs(f), '--release-commit', f.releaseCommit.slice(0, 12));
    assert.equal(short.status, 2);

    // A commit that is not on origin/main is never a release source.
    git(f.repo, 'checkout', '-q', '-b', 'side');
    write(f.repo, 'patches/vscode/002-side.patch', 'diff --git a/y b/y\n');
    const side = commitAll(f.repo, 'side patch');
    git(f.repo, 'checkout', '-q', '-');
    const offMain = run(f.repo, ...verifyArgs(f), '--release-commit', side);
    assert.equal(offMain.status, 1);
    assert.match(offMain.output, /is not on origin\/main/);

    // Anchoring compares the recorded inputs against the commit's git objects,
    // so a manifest that lies about its patch set or lockfile is rejected.
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const tampered = structuredClone(manifest);
    tampered.patchSetSha256 = '0'.repeat(64);
    tampered.derivedVscodeState.patchSetSha256 = '0'.repeat(64);
    fs.writeFileSync(manifestPath, JSON.stringify(tampered));
    const rejected = run(f.repo, ...verifyArgs(f), '--release-commit', f.releaseCommit);
    assert.equal(rejected.status, 1);
    assert.match(rejected.output, /differs in: patchSetSha256, derivedVscodeState/);

    const lockTampered = structuredClone(manifest);
    lockTampered.inputs.vscodeLock.sha256 = '1'.repeat(64);
    fs.writeFileSync(manifestPath, JSON.stringify(lockTampered));
    assert.match(run(f.repo, ...verifyArgs(f), '--release-commit', f.releaseCommit).output, /differs in: inputs/);
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true });
  }
});

test('a build always records its own checkout; --release-commit is verification-only', () => {
  const f = fixture();
  try {
    const refused = run(f.repo, '--write', '--target', 'darwin-x64', '--app', f.app,
      '--extension-input', f.extension, '--expected-extension-sha', f.extensionSha,
      '--release-commit', f.releaseCommit);
    assert.equal(refused.status, 2);
    assert.match(refused.output, /only valid for verification/);
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true });
  }
});
