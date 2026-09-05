#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256Tree } from './tree-sha256.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
let mode = 'write';
let repo = process.cwd();
let target = 'darwin-arm64';
let appPath = '';
let extensionInput = '';
let expectedExtensionSha = '';
let expectedExtensionAuthenticodeSha = '';
let verifyRecordedExtensionAuthenticode = false;
let releaseCommit = '';

function usage() {
  console.log(`Usage: node scripts/build-provenance.mjs --write|--verify --target TARGET --app PATH [--repo PATH]
       [--extension-input PATH --expected-extension-sha SHA256 --expected-extension-authenticode-sha SHA256]
       [--verify-recorded-extension-authenticode]
       [--release-commit SHA40]

Writes or verifies the immutable input manifest embedded in a release build.

--release-commit anchors verification to the approved release source commit
instead of this checkout's working tree. Use it to sign or package an artifact
that CI built on another machine: the recorded source, VS Code gitlink, patch
set, and lock inputs are checked against that commit's git objects, and the
build machine's local VS Code state digest is required but not recomputed.`);
}

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--write') mode = 'write';
  else if (arg === '--verify') mode = 'verify';
  else if (arg === '--repo') repo = args[++index];
  else if (arg === '--target') target = args[++index];
  else if (arg === '--app') appPath = args[++index];
  else if (arg === '--extension-input') extensionInput = args[++index];
  else if (arg === '--expected-extension-sha') expectedExtensionSha = args[++index];
  else if (arg === '--expected-extension-authenticode-sha') expectedExtensionAuthenticodeSha = args[++index];
  else if (arg === '--verify-recorded-extension-authenticode') verifyRecordedExtensionAuthenticode = true;
  else if (arg === '--release-commit') releaseCommit = args[++index];
  else if (arg === '--help' || arg === '-h') {
    usage();
    process.exit(0);
  } else {
    console.error(`ERROR: unknown argument: ${arg}`);
    process.exit(2);
  }
}

if (!appPath || !repo || !target) {
  usage();
  process.exit(2);
}

repo = fs.realpathSync(repo);
appPath = path.resolve(repo, appPath);
if (extensionInput) extensionInput = path.resolve(repo, extensionInput);

for (const [option, digest] of [
  ['--expected-extension-sha', expectedExtensionSha],
  ['--expected-extension-authenticode-sha', expectedExtensionAuthenticodeSha]
]) {
  if (digest && !/^[a-f0-9]{64}$/.test(digest)) {
    console.error(`ERROR: ${option} must be a lowercase SHA-256 digest`);
    process.exit(2);
  }
}
if ((expectedExtensionSha || expectedExtensionAuthenticodeSha) && !extensionInput && !verifyRecordedExtensionAuthenticode) {
  console.error('ERROR: expected extension digests require --extension-input or --verify-recorded-extension-authenticode');
  process.exit(2);
}
if (verifyRecordedExtensionAuthenticode && (mode !== 'verify' || target !== 'win32-x64')) {
  console.error('ERROR: --verify-recorded-extension-authenticode is only valid for Windows verification');
  process.exit(2);
}
if (releaseCommit) {
  if (mode !== 'verify') {
    console.error('ERROR: --release-commit is only valid for verification; a build always records its own checkout');
    process.exit(2);
  }
  if (!/^[0-9a-fA-F]{40}$/.test(releaseCommit)) {
    console.error('ERROR: --release-commit must be an exact 40-character commit SHA');
    process.exit(2);
  }
  releaseCommit = releaseCommit.toLowerCase();
}

function git(gitArgs, cwd = repo) {
  return execFileSync('git', ['-C', cwd, ...gitArgs], { encoding: 'utf8' }).trim();
}

function sha256File(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function sha256Directory(directory) {
  const hash = createHash('sha256');
  const walk = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(current, entry.name);
      const relative = path.relative(directory, absolute).split(path.sep).join('/');
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) {
        hash.update(relative);
        hash.update('\0');
        hash.update(fs.readFileSync(absolute));
        hash.update('\0');
      }
    }
  };
  walk(directory);
  return hash.digest('hex');
}

function derivedVscodeState() {
  const output = execFileSync(process.execPath, [
    path.join(scriptDirectory, 'vscode-derived-state.mjs'),
    '--print',
    '--repo',
    repo
  ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(output);
}

function builtExtensionPath() {
  if (target.startsWith('darwin-')) {
    return path.join(appPath, 'Contents', 'Resources', 'app', 'extensions', 'ritemark');
  }
  if (target === 'win32-x64') {
    return path.join(appPath, 'resources', 'app', 'extensions', 'ritemark');
  }
  throw new Error(`unsupported target: ${target}`);
}

function verifiedExtensionPayload() {
  if (!extensionInput) return null;

  const stagedSha256 = sha256Tree(extensionInput);
  const stagedAuthenticodeSha256 = sha256Tree(extensionInput, { normalizeAuthenticode: true });
  if (expectedExtensionSha && stagedSha256 !== expectedExtensionSha) {
    throw new Error(`staged extension changed after its release digest was recorded: expected ${expectedExtensionSha}, got ${stagedSha256}`);
  }
  if (expectedExtensionAuthenticodeSha && stagedAuthenticodeSha256 !== expectedExtensionAuthenticodeSha) {
    throw new Error(`staged Authenticode-normalized extension payload changed after its release digest was recorded: expected ${expectedExtensionAuthenticodeSha}, got ${stagedAuthenticodeSha256}`);
  }

  const builtSha256 = sha256Tree(builtExtensionPath());
  const builtAuthenticodeSha256 = sha256Tree(builtExtensionPath(), { normalizeAuthenticode: true });
  if (stagedSha256 !== builtSha256) {
    throw new Error(`built extension does not match staged release payload: staged ${stagedSha256}, built ${builtSha256}`);
  }
  if (stagedAuthenticodeSha256 !== builtAuthenticodeSha256) {
    throw new Error(`built Authenticode-normalized extension payload does not match staging: staged ${stagedAuthenticodeSha256}, built ${builtAuthenticodeSha256}`);
  }

  return {
    sha256: stagedSha256,
    authenticodeSha256: stagedAuthenticodeSha256,
    verifiedTransition: 'staged-tree-to-final-copy-before-signing'
  };
}

const requiredInputFiles = {
  extensionLock: 'extensions/ritemark/package-lock.json',
  webviewLock: 'extensions/ritemark/webview/package-lock.json',
  vscodeLock: 'vscode/package-lock.json',
  runtimeManifest: 'extensions/ritemark/binaries/agents/manifest.json',
  branding: 'branding/product.json'
};

function inputs() {
  const hashes = {};
  for (const [name, relative] of Object.entries(requiredInputFiles)) {
    const absolute = path.join(repo, relative);
    if (!fs.existsSync(absolute)) throw new Error(`required provenance input is missing: ${relative}`);
    hashes[name] = { path: relative, sha256: sha256File(absolute) };
  }

  return {
    schemaVersion: 1,
    releaseCandidate: true,
    sourceCommit: git(['rev-parse', 'HEAD']),
    releaseRefCommit: git(['rev-parse', 'origin/main^{commit}']),
    vscodeCommit: git(['rev-parse', 'HEAD'], path.join(repo, 'vscode')),
    patchSetSha256: sha256Directory(path.join(repo, 'patches', 'vscode')),
    derivedVscodeState: derivedVscodeState(),
    inputs: hashes,
    target
  };
}

function gitBuffer(gitArgs, cwd = repo) {
  return execFileSync('git', ['-C', cwd, ...gitArgs], { maxBuffer: 256 * 1024 * 1024 });
}

// Key-order independent JSON so a manifest written by another tool version
// compares by content rather than by property insertion order.
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256DirectoryAtCommit(commit, relativeDirectory) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-provenance-'));
  try {
    const archive = gitBuffer(['archive', '--format=tar', commit, '--', relativeDirectory]);
    execFileSync('tar', ['-xf', '-', '-C', temporary], { input: archive });
    return sha256Directory(path.join(temporary, relativeDirectory));
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

// Canonical inputs taken from git objects at the approved release commit.
// Nothing here depends on this checkout's working tree, so an artifact that CI
// built from that commit verifies identically on any machine.
function anchoredInputs(commit) {
  let resolved;
  try {
    resolved = git(['rev-parse', '--verify', `${commit}^{commit}`]);
  } catch {
    throw new Error(`release commit ${commit} does not exist in this repository`);
  }
  if (resolved !== commit) throw new Error(`release commit ${commit} resolved to ${resolved}`);

  const mainCommit = git(['rev-parse', 'origin/main^{commit}']);
  try {
    execFileSync('git', ['-C', repo, 'merge-base', '--is-ancestor', commit, mainCommit], { stdio: 'ignore' });
  } catch {
    throw new Error(`release commit ${commit} is not on origin/main (${mainCommit})`);
  }

  const gitlink = git(['ls-tree', commit, '--', 'vscode']);
  const [gitlinkMode, gitlinkType, vscodeCommit] = gitlink.split('\t')[0].split(/\s+/);
  if (gitlinkMode !== '160000' || gitlinkType !== 'commit' || !/^[a-f0-9]{40}$/.test(vscodeCommit || '')) {
    throw new Error(`vscode is not a submodule gitlink at ${commit}`);
  }

  const patchSetSha256 = sha256DirectoryAtCommit(commit, 'patches/vscode');

  const hashes = {};
  for (const [name, relative] of Object.entries(requiredInputFiles)) {
    let blob;
    try {
      blob = relative.startsWith('vscode/')
        ? gitBuffer(['show', `${vscodeCommit}:${relative.slice('vscode/'.length)}`], path.join(repo, 'vscode'))
        : gitBuffer(['show', `${commit}:${relative}`]);
    } catch {
      throw new Error(`required provenance input is missing at the release commit: ${relative}`);
    }
    hashes[name] = { path: relative, sha256: createHash('sha256').update(blob).digest('hex') };
  }

  return {
    schemaVersion: 1,
    releaseCandidate: true,
    sourceCommit: commit,
    releaseRefCommit: commit,
    vscodeCommit,
    patchSetSha256,
    derivedVscodeState: {
      schemaVersion: 1,
      sourceCommit: commit,
      vscodeCommit,
      patchSetSha256
    },
    inputs: hashes,
    target
  };
}

function manifestPath() {
  if (target.startsWith('darwin-')) {
    return path.join(appPath, 'Contents', 'Resources', 'app', 'ritemark-build-provenance.json');
  }
  if (target === 'win32-x64') {
    return path.join(appPath, 'resources', 'app', 'ritemark-build-provenance.json');
  }
  throw new Error(`unsupported target: ${target}`);
}

try {
  const current = releaseCommit ? anchoredInputs(releaseCommit) : inputs();
  const output = manifestPath();

  if (current.sourceCommit !== current.releaseRefCommit) {
    throw new Error(`source commit ${current.sourceCommit} is not origin/main ${current.releaseRefCommit}`);
  }

  if (mode === 'write') {
    const extensionPayload = verifiedExtensionPayload();
    const manifest = {
      ...current,
      ...(extensionPayload ? { extensionPayload } : {}),
      buildEnvironment: { nodeVersion: process.version, nodeArch: process.arch },
      builtAt: new Date().toISOString()
    };
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`BUILD PROVENANCE WRITTEN: ${output}`);
  } else {
    const manifest = JSON.parse(fs.readFileSync(output, 'utf8'));
    const {
      builtAt: _builtAt,
      buildEnvironment: _buildEnvironment,
      extensionPayload,
      ...recorded
    } = manifest;
    let comparableRecorded = recorded;
    if (releaseCommit) {
      // The VS Code working-tree digest is a build-machine attestation: CI
      // builds with a physical extension copy while a development worktree
      // uses the symlink layout, so it is required to be recorded but is
      // never recomputed on another machine.
      const { vscodeStateSha256, ...recordedState } = recorded.derivedVscodeState || {};
      if (!/^[a-f0-9]{64}$/.test(vscodeStateSha256 || '')) {
        throw new Error('embedded build provenance is missing the build machine VS Code state digest');
      }
      comparableRecorded = { ...recorded, derivedVscodeState: recordedState };
    }
    if (canonicalJson(comparableRecorded) !== canonicalJson(current)) {
      const drifted = [...new Set([...Object.keys(comparableRecorded), ...Object.keys(current)])]
        .filter(key => canonicalJson(comparableRecorded[key]) !== canonicalJson(current[key]));
      const anchor = releaseCommit ? `release commit ${releaseCommit}` : 'the current canonical inputs';
      throw new Error(`embedded build provenance does not match ${anchor} (differs in: ${drifted.join(', ')})`);
    }
    if (target.startsWith('darwin-') && (
      !/^[a-f0-9]{64}$/.test(extensionPayload?.sha256 || '') ||
      !/^[a-f0-9]{64}$/.test(extensionPayload?.authenticodeSha256 || '') ||
      extensionPayload?.verifiedTransition !== 'staged-tree-to-final-copy-before-signing'
    )) {
      throw new Error('embedded macOS build provenance is missing a valid pre-sign extension payload attestation');
    }
    if (extensionInput) {
      if (!extensionPayload) {
        throw new Error('embedded build provenance is missing the staged extension payload digest');
      }
      const currentExtensionPayload = verifiedExtensionPayload();
      if (JSON.stringify(extensionPayload) !== JSON.stringify(currentExtensionPayload)) {
        throw new Error('embedded staged extension payload digest does not match');
      }
    }
    if (verifyRecordedExtensionAuthenticode) {
      if (!extensionPayload?.authenticodeSha256) {
        throw new Error('embedded build provenance is missing the required Authenticode-normalized extension payload digest');
      }
      if (extensionPayload.verifiedTransition !== 'staged-tree-to-final-copy-before-signing') {
        throw new Error('embedded extension payload has an invalid verification transition');
      }
      if (expectedExtensionSha && extensionPayload.sha256 !== expectedExtensionSha) {
        throw new Error(`embedded staged extension digest does not match the original pre-build digest: expected ${expectedExtensionSha}, got ${extensionPayload.sha256 || '<missing>'}`);
      }
      if (expectedExtensionAuthenticodeSha && extensionPayload.authenticodeSha256 !== expectedExtensionAuthenticodeSha) {
        throw new Error(`embedded Authenticode-normalized extension digest does not match the original pre-build digest: expected ${expectedExtensionAuthenticodeSha}, got ${extensionPayload.authenticodeSha256 || '<missing>'}`);
      }
      const currentAuthenticodeSha256 = sha256Tree(builtExtensionPath(), { normalizeAuthenticode: true });
      if (currentAuthenticodeSha256 !== extensionPayload.authenticodeSha256) {
        throw new Error(`signed build Authenticode-normalized extension payload changed after attestation: expected ${extensionPayload.authenticodeSha256}, got ${currentAuthenticodeSha256}`);
      }
    }
    console.log(`BUILD PROVENANCE VERIFIED: ${output}${releaseCommit ? ` (anchored to release commit ${releaseCommit})` : ''}`);
  }
} catch (error) {
  console.error(`BUILD PROVENANCE BLOCKED: ${error.message}`);
  process.exit(1);
}
