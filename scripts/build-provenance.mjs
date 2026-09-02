#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
let mode = 'write';
let repo = process.cwd();
let target = 'darwin-arm64';
let appPath = '';

function usage() {
  console.log(`Usage: node scripts/build-provenance.mjs --write|--verify --target TARGET --app PATH [--repo PATH]

Writes or verifies the immutable input manifest embedded in a release build.`);
}

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--write') mode = 'write';
  else if (arg === '--verify') mode = 'verify';
  else if (arg === '--repo') repo = args[++index];
  else if (arg === '--target') target = args[++index];
  else if (arg === '--app') appPath = args[++index];
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
    const manifest = {
      ...current,
      buildEnvironment: { nodeVersion: process.version, nodeArch: process.arch },
      builtAt: new Date().toISOString()
    };
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`BUILD PROVENANCE WRITTEN: ${output}`);
  } else {
    const manifest = JSON.parse(fs.readFileSync(output, 'utf8'));
    const { builtAt: _builtAt, buildEnvironment: _buildEnvironment, ...recorded } = manifest;
    if (JSON.stringify(recorded) !== JSON.stringify(current)) {
      throw new Error('embedded build provenance does not match the current canonical inputs');
    }
    console.log(`BUILD PROVENANCE VERIFIED: ${output}`);
  }
} catch (error) {
  console.error(`BUILD PROVENANCE BLOCKED: ${error.message}`);
  process.exit(1);
}
