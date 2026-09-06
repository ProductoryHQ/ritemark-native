#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
let mode = 'check';
let repo = process.cwd();
let staleDays = 7;
let showSizes = true;

function usage() {
  console.log(`Usage: node scripts/worktree-hygiene.mjs [options]

Options:
  --check              Audit only (default)
  --clean              Remove only proven-safe worktrees and prune stale metadata
  --repo PATH          Any worktree belonging to the repository
  --stale-days N       Flag unmerged worktrees older than N days (default: 7)
  --no-sizes           Skip disk-usage calculation
  -h, --help           Show this help

Safety contract:
  - the primary, current, and locked worktrees are never removed;
  - dirty, unpushed, upstream-less, and unmerged worktrees are never removed;
  - ordinary worktrees are removable only when HEAD is already in origin/main;
  - marked release worktrees may contain generated VS Code/build state, but their
    tracked superproject source must still be clean and match the marker.`);
}

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--check') mode = 'check';
  else if (arg === '--clean') mode = 'clean';
  else if (arg === '--repo') repo = args[++index];
  else if (arg === '--stale-days') staleDays = Number(args[++index]);
  else if (arg === '--no-sizes') showSizes = false;
  else if (arg === '--help' || arg === '-h') {
    usage();
    process.exit(0);
  } else {
    console.error(`ERROR: unknown argument: ${arg}`);
    usage();
    process.exit(2);
  }
}

if (!repo || !Number.isFinite(staleDays) || staleDays < 0) {
  console.error('ERROR: --repo needs a path and --stale-days needs a non-negative number');
  process.exit(2);
}

function git(cwd, gitArgs, options = {}) {
  const result = spawnSync('git', ['-C', cwd, ...gitArgs], {
    encoding: 'utf8',
    stdio: options.inherit ? 'inherit' : 'pipe'
  });
  if (options.allowFailure) return result;
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new Error(`git ${gitArgs.join(' ')} failed${detail ? `: ${detail}` : ''}`);
  }
  return (result.stdout || '').trim();
}

function parseWorktrees(raw) {
  return raw.split('\0\0').filter(Boolean).map(record => {
    const entry = {};
    for (const field of record.split('\0').filter(Boolean)) {
      const separator = field.indexOf(' ');
      if (separator === -1) entry[field] = true;
      else entry[field.slice(0, separator)] = field.slice(separator + 1);
    }
    return entry;
  });
}

function physicalSize(target) {
  if (!showSizes || !fs.existsSync(target)) return null;
  const result = spawnSync('du', ['-sk', target], { encoding: 'utf8' });
  if (result.status !== 0) return null;
  const kib = Number((result.stdout || '').trim().split(/\s+/)[0]);
  if (!Number.isFinite(kib)) return null;
  const gib = kib / 1024 / 1024;
  return gib >= 0.1 ? `${gib.toFixed(1)} GiB` : `${Math.ceil(kib / 1024)} MiB`;
}

function worktreeGitDir(target) {
  const raw = git(target, ['rev-parse', '--git-dir']);
  return path.resolve(target, raw);
}

function validReleaseMarker(target, head) {
  try {
    const markerPath = path.join(worktreeGitDir(target), 'ritemark-release-worktree.json');
    const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    return marker.schemaVersion === 1 &&
      marker.purpose === 'disposable-release-build' &&
      marker.sourceCommit === head;
  } catch {
    return false;
  }
}

function validDerivedVscodeMarker(target) {
  const verifier = path.join(target, 'scripts', 'vscode-derived-state.mjs');
  if (!fs.existsSync(verifier)) return false;
  return spawnSync(process.execPath, [verifier, '--verify', '--repo', target], {
    encoding: 'utf8',
    stdio: 'pipe'
  }).status === 0;
}

try {
  repo = fs.realpathSync(repo);
  const entries = parseWorktrees(execFileSync('git', ['-C', repo, 'worktree', 'list', '--porcelain', '-z'], { encoding: 'utf8' }));
  const primaryPath = entries[0]?.worktree ? fs.realpathSync(entries[0].worktree) : null;
  const currentPath = fs.realpathSync(git(repo, ['rev-parse', '--show-toplevel']));
  const baseRefResult = git(repo, ['rev-parse', '--verify', 'origin/main^{commit}'], { allowFailure: true });

  if (baseRefResult.status !== 0) {
    throw new Error('origin/main is unavailable; fetch before auditing worktrees');
  }

  const baseRef = (baseRefResult.stdout || '').trim();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const removable = [];
  let reclaimableKib = 0;

  console.log(`Worktree hygiene ${mode === 'clean' ? 'cleanup' : 'audit'}`);
  console.log(`Repository: ${primaryPath}`);
  console.log(`Safety base: origin/main (${baseRef})`);
  console.log('');

  for (const [index, entry] of entries.entries()) {
    const target = entry.worktree;
    const label = entry.branch?.replace('refs/heads/', '') || '(detached)';
    const exists = fs.existsSync(target);
    const size = physicalSize(target);
    const sizeLabel = size ? `, ${size}` : '';

    if (!exists) {
      console.log(`PRUNE    ${target} — working directory is missing`);
      continue;
    }

    const physicalTarget = fs.realpathSync(target);
    if (index === 0 || physicalTarget === primaryPath) {
      console.log(`KEEP     ${target} — primary worktree${sizeLabel}`);
      continue;
    }
    if (physicalTarget === currentPath) {
      console.log(`KEEP     ${target} — current worktree${sizeLabel}`);
      continue;
    }
    if (entry.locked) {
      console.log(`KEEP     ${target} — locked: ${entry.locked === true ? 'no reason recorded' : entry.locked}${sizeLabel}`);
      continue;
    }

    const head = git(target, ['rev-parse', 'HEAD']);
    const outerStatusResult = git(target, ['status', '--porcelain=v1', '--untracked-files=all', '--ignore-submodules=all'], { allowFailure: true });
    const completeStatusResult = git(target, ['status', '--porcelain=v1', '--untracked-files=all', '--ignore-submodules=none'], { allowFailure: true });
    if (outerStatusResult.status !== 0 || completeStatusResult.status !== 0) {
      const failedResult = outerStatusResult.status !== 0 ? outerStatusResult : completeStatusResult;
      const reason = (failedResult.stderr || failedResult.stdout || 'unknown Git status error')
        .trim().split('\n').slice(-1)[0];
      console.log(`BLOCKED  ${target} — Git status is unreadable: ${reason} (${label})${sizeLabel}`);
      continue;
    }
    const outerStatus = (outerStatusResult.stdout || '').trim();
    const completeStatus = (completeStatusResult.stdout || '').trim();
    const releaseMarker = validReleaseMarker(target, head);
    const derivedVscodeMarker = completeStatus ? validDerivedVscodeMarker(target) : false;

    if (outerStatus) {
      console.log(`BLOCKED  ${target} — uncommitted superproject changes (${label})${sizeLabel}`);
      continue;
    }
    if (completeStatus && !releaseMarker && !derivedVscodeMarker) {
      console.log(`BLOCKED  ${target} — submodule/local changes need review (${label})${sizeLabel}`);
      continue;
    }

    if (!releaseMarker) {
      const upstreamResult = git(target, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], { allowFailure: true });
      if (upstreamResult.status !== 0) {
        console.log(`BLOCKED  ${target} — branch has no upstream (${label})${sizeLabel}`);
        continue;
      }
      const upstream = (upstreamResult.stdout || '').trim();
      const ahead = Number(git(target, ['rev-list', '--count', `${upstream}..HEAD`]));
      if (ahead > 0) {
        console.log(`BLOCKED  ${target} — ${ahead} commit(s) are not pushed (${label})${sizeLabel}`);
        continue;
      }
    }

    const merged = git(repo, ['merge-base', '--is-ancestor', head, 'origin/main'], { allowFailure: true }).status === 0;
    if (!merged) {
      const commitSeconds = Number(git(target, ['show', '-s', '--format=%ct', 'HEAD']));
      const ageDays = Math.floor((nowSeconds - commitSeconds) / 86400);
      const staleLabel = ageDays >= staleDays ? `; review: ${ageDays} days since last commit` : '';
      console.log(`KEEP     ${target} — active/unmerged (${label})${staleLabel}${sizeLabel}`);
      continue;
    }

    const kind = releaseMarker
      ? 'verified disposable release worktree'
      : derivedVscodeMarker
        ? 'fully pushed/merged with verified derived VS Code state'
        : 'fully pushed and merged';
    console.log(`REMOVE   ${target} — ${kind} (${label})${sizeLabel}`);
    const hasInitializedSubmodule = git(target, ['submodule', 'status', '--recursive'], { allowFailure: true }).stdout?.trim().length > 0;
    // Git refuses to remove any worktree containing an initialized submodule
    // without --force, even when both trees are clean. The checks above prove
    // the ordinary case clean; a valid release marker proves generated state
    // disposable. The exact worktree path is still passed after `--`.
    removable.push({ target, force: releaseMarker || derivedVscodeMarker || hasInitializedSubmodule, size });
    if (size) {
      const match = size.match(/^([0-9.]+) (GiB|MiB)$/);
      if (match) reclaimableKib += Number(match[1]) * (match[2] === 'GiB' ? 1024 * 1024 : 1024);
    }
  }

  console.log('');
  console.log(`Summary: ${removable.length} proven-safe worktree(s) removable${showSizes ? `, about ${(reclaimableKib / 1024 / 1024).toFixed(1)} GiB reclaimable` : ''}.`);

  if (mode === 'clean') {
    for (const item of removable) {
      const removeArgs = ['worktree', 'remove'];
      if (item.force) removeArgs.push('--force');
      removeArgs.push('--', item.target);
      git(repo, removeArgs, { inherit: true });
      console.log(`REMOVED  ${item.target}`);
    }
    git(repo, ['worktree', 'prune', '--expire', 'now'], { inherit: true });
    console.log('Stale worktree metadata pruned. Branches were intentionally retained.');
  } else if (removable.length > 0) {
    console.log('Audit only: rerun with --clean to remove only the REMOVE entries.');
  }
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
}
