#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
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

function usage() {
  console.log(`Usage: node scripts/build-provenance.mjs --write|--verify --target TARGET --app PATH [--repo PATH]
       [--extension-input PATH --expected-extension-sha SHA256]

Writes or verifies the immutable input manifest embedded in a release build.`);
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

if (expectedExtensionSha && !/^[a-f0-9]{64}$/.test(expectedExtensionSha)) {
  console.error('ERROR: --expected-extension-sha must be a lowercase SHA-256 digest');
  process.exit(2);
}
if (expectedExtensionSha && !extensionInput) {
  console.error('ERROR: --expected-extension-sha requires --extension-input');
  process.exit(2);
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
  if (expectedExtensionSha && stagedSha256 !== expectedExtensionSha) {
    throw new Error(`staged extension changed after its release digest was recorded: expected ${expectedExtensionSha}, got ${stagedSha256}`);
  }

  const builtSha256 = sha256Tree(builtExtensionPath());
  if (stagedSha256 !== builtSha256) {
    throw new Error(`built extension does not match staged release payload: staged ${stagedSha256}, built ${builtSha256}`);
  }

  return {
    sha256: stagedSha256,
    verifiedTransition: 'staged-tree-to-final-copy-before-signing'
  };
}

function inputs() {
  const requiredFiles = {
    extensionLock: 'extensions/ritemark/package-lock.json',
    webviewLock: 'extensions/ritemark/webview/package-lock.json',
    vscodeLock: 'vscode/package-lock.json',
    runtimeManifest: 'extensions/ritemark/binaries/agents/manifest.json',
    branding: 'branding/product.json'
  };

  const hashes = {};
  for (const [name, relative] of Object.entries(requiredFiles)) {
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
  const current = inputs();
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
    if (JSON.stringify(recorded) !== JSON.stringify(current)) {
      throw new Error('embedded build provenance does not match the current canonical inputs');
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
    console.log(`BUILD PROVENANCE VERIFIED: ${output}`);
  }
} catch (error) {
  console.error(`BUILD PROVENANCE BLOCKED: ${error.message}`);
  process.exit(1);
}
