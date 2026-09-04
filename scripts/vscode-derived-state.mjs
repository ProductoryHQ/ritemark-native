#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
let mode = 'verify';
let repo = process.cwd();
const ephemeralExtensionPath = 'extensions/ritemark';

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--write') mode = 'write';
  else if (arg === '--verify') mode = 'verify';
  else if (arg === '--clear') mode = 'clear';
  else if (arg === '--print') mode = 'print';
  else if (arg === '--repo') repo = args[++index];
  else {
    console.error(`Usage: node scripts/vscode-derived-state.mjs --write|--verify|--clear|--print [--repo PATH]`);
    process.exit(2);
  }
}

function git(cwd, gitArgs, options = {}) {
  return execFileSync('git', ['-C', cwd, ...gitArgs], {
    encoding: options.encoding || 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
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

function vscodeState(vscodePath) {
  const hash = createHash('sha256');
  // Ritemark's target-specific extension copy is a build input, not part of
  // the patched VS Code shell. CI compiles/prunes/stages that tree separately,
  // so the derived-state fingerprint must remain stable across those explicit
  // lifecycle transitions while still rejecting every other VS Code change.
  hash.update(git(vscodePath, [
    'diff', '--binary', 'HEAD', '--', '.', `:(exclude)${ephemeralExtensionPath}`
  ], { encoding: 'buffer' }));

  const untracked = git(vscodePath, ['ls-files', '--others', '--exclude-standard', '-z'])
    .split('\0')
    .filter(Boolean)
    .filter(relative => relative !== ephemeralExtensionPath && !relative.startsWith(`${ephemeralExtensionPath}/`))
    .sort();
  for (const relative of untracked) {
    const absolute = path.join(vscodePath, relative);
    hash.update(relative);
    hash.update('\0');
    if (fs.lstatSync(absolute).isSymbolicLink()) hash.update(fs.readlinkSync(absolute));
    else hash.update(fs.readFileSync(absolute));
    hash.update('\0');
  }
  return hash.digest('hex');
}

try {
  repo = fs.realpathSync(repo);
  const vscodePath = path.join(repo, 'vscode');
  if (fs.lstatSync(vscodePath).isSymbolicLink()) throw new Error('vscode is a symlink');
  const vscodeTop = fs.realpathSync(git(vscodePath, ['rev-parse', '--show-toplevel']).trim());
  if (vscodeTop !== vscodePath) throw new Error('vscode is not an independent Git checkout');

  let gitDir = git(repo, ['rev-parse', '--git-dir']).trim();
  gitDir = path.resolve(repo, gitDir);
  const markerPath = path.join(gitDir, 'ritemark-vscode-derived-state.json');

  if (mode === 'clear') {
    fs.rmSync(markerPath, { force: true });
    console.log('VS CODE DERIVED STATE CLEARED');
    process.exit(0);
  }

  const current = {
    schemaVersion: 2,
    sourceCommit: git(repo, ['rev-parse', 'HEAD']).trim(),
    vscodeCommit: git(vscodePath, ['rev-parse', 'HEAD']).trim(),
    patchSetSha256: sha256Directory(path.join(repo, 'patches', 'vscode')),
    excludedPaths: [ephemeralExtensionPath],
    vscodeStateSha256: vscodeState(vscodePath)
  };

  if (mode === 'print') {
    process.stdout.write(`${JSON.stringify(current)}\n`);
  } else if (mode === 'write') {
    fs.writeFileSync(markerPath, `${JSON.stringify(current, null, 2)}\n`);
    console.log(`VS CODE DERIVED STATE RECORDED: ${markerPath}`);
  } else {
    const recorded = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    if (JSON.stringify(recorded) !== JSON.stringify(current)) {
      throw new Error('current VS Code state differs from its recorded canonical derived state');
    }
    console.log('VS CODE DERIVED STATE VERIFIED');
  }
} catch (error) {
  console.error(`VS CODE DERIVED STATE BLOCKED: ${error.message}`);
  process.exit(1);
}
