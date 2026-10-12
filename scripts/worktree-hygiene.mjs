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
  --report             Human-readable Markdown report (for the scheduled janitor)
  --clean              Remove reviewed worktrees and prune stale metadata
  --repo PATH          Any worktree belonging to the repository
  --stale-days N       Flag unmerged worktrees older than N days (default: 7)
  --no-sizes           Skip disk-usage calculation
  -h, --help           Show this help

Safety contract:
  - the primary, current, and locked worktrees are never removed;
  - dirty, unpushed, upstream-less, and unmerged worktrees are never removed;
  - a worktree holding build output (a non-empty dist/ or VSCode-<target>/) is
    never removed, whatever its Git state says: that output is not in Git, can
    represent hours of compute plus notarization submissions, and is invisible
    to git status because it is ignored;
  - ordinary worktrees are removable only when HEAD is already in origin/main,
    or when GitHub proves it squash-merged: every commit ahead of origin/main
    is in a pull request GitHub reports as merged into main (or was its head
    before a force-push), or is a merge of origin/main that adds nothing of
    its own. With gh offline or unauthenticated the worktree keeps its
    unmerged verdict;
  - a modified vscode submodule is treated as derived state only when it sits
    at the commit the superproject records and every modified path belongs to
    the canonical patch set; one unexpected path or commit blocks the worktree
    as possible hand-editing.

--clean is a human-authorized operation. The scheduled janitor runs --report
and never deletes anything.`);
}

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--check') mode = 'check';
  else if (arg === '--report') mode = 'report';
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

// Build output lives outside Git: `dist/` and `VSCode-<target>/` are ignored, so
// `git status --untracked-files=all` reports a release worktree as pristine while
// it holds the only copy of signed, notarized artifacts. Look at the filesystem.
function buildOutput(target) {
  const found = [];
  for (const name of fs.existsSync(target) ? fs.readdirSync(target) : []) {
    if (name !== 'dist' && !name.startsWith('VSCode-')) continue;
    const absolute = path.join(target, name);
    try {
      if (!fs.statSync(absolute).isDirectory()) continue;
      const count = fs.readdirSync(absolute).length;
      if (count > 0) found.push(`${name}/ (${count} ${count === 1 ? 'entry' : 'entries'})`);
    } catch { /* unreadable entries are reported by the Git status checks */ }
  }
  return found;
}

// Everything inside vscode/ that Ritemark itself regenerates: the paths the
// patch files carry as text, plus the branding assets and the extension symlink
// that apply-patches.sh copies in (binary icons and fonts cannot travel in a
// text patch). Both sources are read from the repository, so this stays correct
// when branding changes instead of drifting against a hand-kept list.
function regeneratedVscodePaths(target) {
  const patchDirectory = path.join(target, 'patches', 'vscode');
  const applyScript = path.join(target, 'scripts', 'apply-patches.sh');
  if (!fs.existsSync(patchDirectory) || !fs.existsSync(applyScript)) return null;

  const exact = new Set();
  const prefixes = [];

  for (const file of fs.readdirSync(patchDirectory)) {
    if (!file.endsWith('.patch')) continue;
    for (const line of fs.readFileSync(path.join(patchDirectory, file), 'utf8').split('\n')) {
      const match = /^(?:\+\+\+|---) [ab]\/(.+?)\s*$/.exec(line);
      if (match && match[1] !== 'dev/null') exact.add(match[1]);
    }
  }

  for (const match of fs.readFileSync(applyScript, 'utf8').matchAll(/\$VSCODE_DIR\/([^"'\s]+)/g)) {
    const destination = match[1];
    if (destination.endsWith('/')) prefixes.push(destination);
    else exact.add(destination);
  }

  // Dependency and build directories are regenerated by npm ci / gulp.
  for (const generated of ['node_modules', 'out', 'out-build', 'out-vscode', '.build']) {
    exact.add(generated);
    prefixes.push(`${generated}/`);
  }

  return { exact, prefixes };
}

// True when every change inside the vscode submodule is something Ritemark
// regenerates, i.e. apply-patches.sh reproduces it exactly. Anything else is
// possible hand-editing and must not be classified as disposable.
function submoduleIsRegenerated(target) {
  const submodule = path.join(target, 'vscode');
  if (!fs.existsSync(submodule)) return { derived: false, reason: 'vscode submodule is missing' };
  const known = regeneratedVscodePaths(target);
  if (!known) return { derived: false, reason: 'patches/vscode or apply-patches.sh is missing' };
  const status = git(submodule, ['status', '--porcelain=v1', '--untracked-files=all'], { allowFailure: true });
  if (status.status !== 0) return { derived: false, reason: 'vscode status is unreadable' };

  const entries = (status.stdout || '')
    .split('\n')
    .filter(Boolean)
    .map(line => line.slice(3).trim())
    .map(entry => entry.includes(' -> ') ? entry.split(' -> ').pop() : entry)
    .map(entry => entry.replace(/^"|"$/g, ''));
  const unexpected = entries.filter(entry =>
    !known.exact.has(entry) && !known.prefixes.some(prefix => entry.startsWith(prefix)));

  if (unexpected.length > 0) {
    const sample = unexpected.slice(0, 3).join(', ');
    return {
      derived: false,
      reason: `${unexpected.length} vscode path(s) are not regenerated by apply-patches.sh, e.g. ${sample}`
    };
  }
  return { derived: true, count: entries.length };
}

// A vscode checkout moved off the commit the superproject records can hold
// commits made inside the submodule, and `git worktree remove` deletes them with
// the worktree's modules directory. Only the recorded commit is derived state.
// Returns a reason when the checkout is off that commit, otherwise null.
function vscodeOffRecordedCommit(target) {
  const submodule = path.join(target, 'vscode');
  if (!fs.existsSync(submodule)) return null;
  const top = git(submodule, ['rev-parse', '--show-toplevel'], { allowFailure: true });
  // Not an initialized checkout of its own; submoduleIsRegenerated reports it.
  if (top.status !== 0 || fs.realpathSync((top.stdout || '').trim()) !== fs.realpathSync(submodule)) return null;
  const [recorded, staged, checkedOut] = [
    git(target, ['rev-parse', 'HEAD:vscode'], { allowFailure: true }),
    git(target, ['rev-parse', ':vscode'], { allowFailure: true }),
    git(submodule, ['rev-parse', 'HEAD'], { allowFailure: true })
  ].map(result => result.status === 0 ? (result.stdout || '').trim() : null);
  if (!recorded || !staged || !checkedOut) return 'the vscode submodule commit is unreadable';
  if (staged !== recorded) return `the vscode gitlink is staged at ${staged.slice(0, 8)}, not the committed ${recorded.slice(0, 8)}`;
  if (checkedOut !== recorded) {
    return `vscode is checked out at ${checkedOut.slice(0, 8)}, not the recorded ${recorded.slice(0, 8)}, and may hold commits made inside it`;
  }
  return null;
}

function githubRepository(target) {
  // The raw configured URL, so a url.<base>.insteadOf rewrite does not hide it.
  const url = (git(target, ['config', '--get', 'remote.origin.url'], { allowFailure: true }).stdout || '').trim();
  const match = /github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(url);
  return match ? { owner: match[1], name: match[2] } : null;
}

// Set to the first gh failure that is not an answer from GitHub (gh missing,
// offline, unauthenticated, rate-limited); later calls in the run are skipped.
let githubUnavailable = null;

// `missing` means GitHub answered that it does not have the object (HTTP 404 or
// 422): a definite "not proven", not an outage.
function ghApi(ghArgs) {
  if (githubUnavailable) return { unavailable: githubUnavailable };
  const result = spawnSync('gh', ['api', ...ghArgs], { encoding: 'utf8', stdio: 'pipe', timeout: 30000 });
  if (result.status === 0) {
    try {
      return { answer: JSON.parse(result.stdout) };
    } catch {
      githubUnavailable = 'gh returned unreadable JSON';
      return { unavailable: githubUnavailable };
    }
  }
  const detail = (result.error?.message || result.stderr || result.stdout || `gh exited ${result.status}`)
    .trim().split('\n').filter(Boolean).slice(-1)[0];
  if (/\(HTTP (404|422)\)/.test(detail)) return { missing: true };
  githubUnavailable = detail;
  return { unavailable: detail };
}

function isAncestor(target, ancestor, descendant) {
  return git(target, ['merge-base', '--is-ancestor', ancestor, descendant], { allowFailure: true }).status === 0;
}

// Updating a branch from main before its squash merge leaves a merge commit
// that is in no pull request. It adds nothing of its own when its tree is
// exactly what Git's merge of its two parents produces; a hand-resolved
// conflict differs and is not proven.
function isCleanMergeOfMain(target, commit) {
  const parents = git(target, ['rev-list', '--parents', '-n', '1', commit]).split(/\s+/).slice(1);
  if (parents.length !== 2 || !isAncestor(target, parents[1], 'origin/main')) return false;
  const merged = git(target, ['merge-tree', '--write-tree', parents[0], parents[1]], { allowFailure: true });
  if (merged.status !== 0) return false;
  return (merged.stdout || '').split('\n')[0].trim() === git(target, ['rev-parse', `${commit}^{tree}`]);
}

// Branch names the worktree's commits may have been pushed under. A worktree
// that an archived session left detached still names its branch in its HEAD
// reflog. The names only select which pull requests to ask about; the proof is
// always an exact commit match.
function candidateBranches(target, entry) {
  const names = [];
  const add = name => {
    if (name && !/^[0-9a-f]{7,40}$/.test(name) && !names.includes(name)) names.push(name);
  };
  if (entry.branch) add(entry.branch.replace('refs/heads/', ''));
  const upstream = git(target, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], { allowFailure: true });
  if (upstream.status === 0) add((upstream.stdout || '').trim().replace(/^[^/]+\//, ''));
  const reflog = git(target, ['reflog', 'show', '--format=%gs', '-n', '200', 'HEAD'], { allowFailure: true });
  for (const line of (reflog.stdout || '').split('\n')) {
    if (names.length >= 5) break;
    const match = /^checkout: moving from .+ to (\S+)$/.exec(line) ||
      /^rebase.*\(finish\): returning to refs\/heads\/(\S+)$/.exec(line);
    if (match) add(match[1]);
  }
  return names;
}

const FORMER_HEADS_QUERY = `query($owner: String!, $name: String!, $branch: String!) {
  repository(owner: $owner, name: $name) {
    pullRequests(headRefName: $branch, states: MERGED, first: 20) {
      nodes {
        number
        baseRefName
        headRefOid
        timelineItems(itemTypes: [HEAD_REF_FORCE_PUSHED_EVENT], first: 100) {
          nodes { ... on HeadRefForcePushedEvent { beforeCommit { oid } } }
        }
      }
    }
  }
}`;

// Every PR on main is squash-merged, so a merged branch's commits never become
// ancestors of origin/main and the ancestry check alone keeps such worktrees
// forever. Prove the merge from GitHub instead. Each commit ahead of origin/main
// must be in a pull request merged into main, have been the head of one before
// a force-push replaced it (a rebase just before merging), be an ancestor of a
// commit already proven, or be a clean merge of origin/main. Returns
// { proven: true, summary } or { proven: false, note } naming what is missing.
function proveSquashMerge(target, entry, github) {
  if (!github) return { proven: false, note: 'squash merge not checked: origin is not a GitHub repository' };
  const commits = git(target, ['rev-list', '--topo-order', 'origin/main..HEAD']).split('\n').filter(Boolean);
  const provenTips = [];
  const pulls = new Map();
  let mergesOfMain = 0;
  let formerHeads = null;

  for (const commit of commits) {
    if (provenTips.some(tip => isAncestor(target, commit, tip))) continue;
    if (isCleanMergeOfMain(target, commit)) {
      mergesOfMain += 1;
      continue;
    }

    const lookup = ghApi([`repos/${github.owner}/${github.name}/commits/${commit}/pulls`]);
    if (lookup.unavailable) return { proven: false, note: `squash merge not checked: GitHub unavailable (${lookup.unavailable})` };
    const associated = Array.isArray(lookup.answer) ? lookup.answer : [];
    const merged = associated.find(pull => pull.merged_at && pull.base?.ref === 'main');
    if (merged) {
      provenTips.push(commit);
      pulls.set(merged.number, pulls.get(merged.number) || '');
      continue;
    }

    if (!formerHeads) {
      formerHeads = new Map();
      for (const branch of candidateBranches(target, entry)) {
        const result = ghApi(['graphql', '-f', `query=${FORMER_HEADS_QUERY}`,
          '-f', `owner=${github.owner}`, '-f', `name=${github.name}`, '-f', `branch=${branch}`]);
        if (result.unavailable) return { proven: false, note: `squash merge not checked: GitHub unavailable (${result.unavailable})` };
        for (const pull of result.answer?.data?.repository?.pullRequests?.nodes || []) {
          if (pull?.baseRefName !== 'main') continue;
          for (const event of pull.timelineItems?.nodes || []) {
            if (event?.beforeCommit?.oid) formerHeads.set(event.beforeCommit.oid, pull.number);
          }
        }
      }
    }
    const formerHead = [...formerHeads.keys()].find(head => head === commit || isAncestor(target, commit, head));
    if (formerHead) {
      provenTips.push(commit);
      pulls.set(formerHeads.get(formerHead), ' (its head before a force-push)');
      continue;
    }

    const open = associated.find(pull => !pull.merged_at);
    const why = lookup.missing ? 'is not on GitHub'
      : open ? `is only in unmerged PR #${open.number}`
        : 'is in no merged pull request';
    return { proven: false, note: `not a proven squash merge: ${commit.slice(0, 8)} ${why}` };
  }

  const sources = [];
  if (pulls.size > 0) {
    const list = [...pulls].sort(([a], [b]) => a - b).map(([number, how]) => `#${number}${how}`).join(', ');
    sources.push(`merged ${pulls.size === 1 ? 'PR' : 'PRs'} ${list}`);
  }
  if (mergesOfMain > 0) sources.push(`${mergesOfMain === 1 ? 'a clean merge' : `${mergesOfMain} clean merges`} of origin/main`);
  const ahead = commits.length === 1 ? 'the commit ahead of origin/main is' : `the ${commits.length} commits ahead of origin/main are`;
  return { proven: true, summary: `squash-merged: ${ahead} in ${sources.join(' or ')}` };
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
  const github = githubRepository(repo);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const removable = [];
  const rows = [];
  let reclaimableKib = 0;
  const record = (verdict, target, reason, size, extra = {}) => {
    rows.push({ verdict, target, reason, size, ...extra });
    if (mode !== 'report') console.log(`${verdict.padEnd(8)} ${target} — ${reason}${size ? `, ${size}` : ''}`);
  };

  if (mode !== 'report') {
    console.log(`Worktree hygiene ${mode === 'clean' ? 'cleanup' : 'audit'}`);
    console.log(`Repository: ${primaryPath}`);
    console.log(`Safety base: origin/main (${baseRef})`);
    console.log('');
  }

  for (const [index, entry] of entries.entries()) {
    const target = entry.worktree;
    const label = entry.branch?.replace('refs/heads/', '') || '(detached)';
    const exists = fs.existsSync(target);
    const size = physicalSize(target);
    const sizeLabel = size ? `, ${size}` : '';

    if (!exists) {
      record('PRUNE', target, 'working directory is missing', null);
      continue;
    }

    const physicalTarget = fs.realpathSync(target);
    if (index === 0 || physicalTarget === primaryPath) {
      record('KEEP', target, 'primary worktree', size);
      continue;
    }
    if (physicalTarget === currentPath) {
      record('KEEP', target, 'current worktree', size);
      continue;
    }
    if (entry.locked) {
      record('KEEP', target, `locked: ${entry.locked === true ? 'no reason recorded' : entry.locked}`, size);
      continue;
    }

    const head = git(target, ['rev-parse', 'HEAD']);
    const outerStatusResult = git(target, ['status', '--porcelain=v1', '--untracked-files=all', '--ignore-submodules=all'], { allowFailure: true });
    const completeStatusResult = git(target, ['status', '--porcelain=v1', '--untracked-files=all', '--ignore-submodules=none'], { allowFailure: true });
    if (outerStatusResult.status !== 0 || completeStatusResult.status !== 0) {
      const failedResult = outerStatusResult.status !== 0 ? outerStatusResult : completeStatusResult;
      const reason = (failedResult.stderr || failedResult.stdout || 'unknown Git status error')
        .trim().split('\n').slice(-1)[0];
      record('BLOCKED', target, `Git status is unreadable: ${reason} (${label})`, size);
      continue;
    }
    const outerStatus = (outerStatusResult.stdout || '').trim();
    const completeStatus = (completeStatusResult.stdout || '').trim();
    const output = buildOutput(target);
    if (output.length > 0) {
      record('BLOCKED', target, `build output present: ${output.join(', ')} — publish or move it before removing (${label})`, size);
      continue;
    }

    const releaseMarker = validReleaseMarker(target, head);
    const derivedVscodeMarker = completeStatus ? validDerivedVscodeMarker(target) : false;

    if (outerStatus) {
      record('BLOCKED', target, `uncommitted superproject changes (${label})`, size);
      continue;
    }
    const offRecordedCommit = completeStatus && !releaseMarker ? vscodeOffRecordedCommit(target) : null;
    if (offRecordedCommit) {
      record('BLOCKED', target, `local changes need review — ${offRecordedCommit} (${label})`, size);
      continue;
    }
    // A patched vscode submodule is derived state, not user work:
    // apply-patches.sh reproduces it exactly. Refusing every such worktree made
    // the janitor unable to clean any development worktree at all. Prove it
    // instead — one modified path outside the canonical patch set still blocks.
    let derivedNote = '';
    if (completeStatus && !releaseMarker && !derivedVscodeMarker) {
      const canonical = submoduleIsRegenerated(target);
      if (!canonical.derived) {
        record('BLOCKED', target, `local changes need review — ${canonical.reason} (${label})`, size);
        continue;
      }
      derivedNote = `; its ${canonical.count} vscode changes are all regenerated by apply-patches.sh`;
    }

    const merged = git(repo, ['merge-base', '--is-ancestor', head, 'origin/main'], { allowFailure: true }).status === 0;
    // Asked only of a clean worktree with no build output: the checks above
    // have already held back everything else.
    const squash = !releaseMarker && !merged ? proveSquashMerge(target, entry, github) : null;
    const squashNote = squash && !squash.proven ? `; ${squash.note}` : '';

    // Only an unmerged branch needs an upstream to prove its commits survive.
    // Once HEAD is an ancestor of origin/main the work is demonstrably in main,
    // and the remote branch is normally deleted by the merge itself.
    if (!releaseMarker && !merged && !squash.proven) {
      const upstreamResult = git(target, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], { allowFailure: true });
      if (upstreamResult.status !== 0) {
        record('BLOCKED', target, `unmerged branch has no upstream (${label})${squashNote}`, size);
        continue;
      }
      const upstream = (upstreamResult.stdout || '').trim();
      const ahead = Number(git(target, ['rev-list', '--count', `${upstream}..HEAD`]));
      if (ahead > 0) {
        record('BLOCKED', target, `${ahead} commit(s) are not pushed (${label})${squashNote}`, size);
        continue;
      }
    }

    if (!merged && !squash?.proven) {
      const commitSeconds = Number(git(target, ['show', '-s', '--format=%ct', 'HEAD']));
      const ageDays = Math.floor((nowSeconds - commitSeconds) / 86400);
      const staleLabel = ageDays >= staleDays ? `; review: ${ageDays} days since last commit` : '';
      record('KEEP', target, `active/unmerged (${label})${squashNote}${staleLabel}`, size);
      continue;
    }

    const kind = releaseMarker
      ? 'verified disposable release worktree'
      : squash?.proven
        ? squash.summary
        : derivedVscodeMarker
          ? 'fully pushed/merged with verified derived VS Code state'
          : 'fully pushed and merged';
    record('REVIEW', target, `${kind} (${label})${derivedNote}`, size, { removable: true });
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

  const reclaimableGib = (reclaimableKib / 1024 / 1024).toFixed(1);

  if (mode === 'report') {
    const of = verdict => rows.filter(row => row.verdict === verdict);
    const list = items => items.map(row =>
      `- **${path.basename(row.target)}**${row.size ? ` — ${row.size}` : ''}\n  ${row.reason}`).join('\n');

    const review = of('REVIEW');
    const blocked = of('BLOCKED');
    const keep = of('KEEP');
    const prune = of('PRUNE');

    console.log(`# Ritemark worktree report — ${new Date().toISOString().slice(0, 10)}`);
    console.log('');
    console.log(review.length === 0
      ? `Nothing to clean up. ${keep.length} worktree(s) in active use, ${blocked.length} held back.`
      : `**${review.length} worktree(s) can be removed, freeing about ${reclaimableGib} GiB.** Nothing has been deleted — this is a report.`);
    console.log('');
    console.log(`Repository: ${primaryPath}`);
    console.log(`Checked against origin/main (${baseRef.slice(0, 8)})`);
    console.log('');

    if (review.length > 0) {
      console.log('## Safe to remove — needs your go-ahead');
      console.log('');
      console.log('Each one is fully pushed, already in main (merged, or squash-merged through a pull request GitHub reports as merged), and holds no build output.');
      console.log('');
      console.log(list(review));
      console.log('');
      console.log('To remove them, reply to Claude with the go-ahead, or run:');
      console.log('');
      console.log('```bash');
      console.log(`cd ${primaryPath} && node ./scripts/worktree-hygiene.mjs --clean`);
      console.log('```');
      console.log('');
    }
    if (blocked.length > 0) {
      console.log('## Held back — not touched');
      console.log('');
      console.log(list(blocked));
      console.log('');
    }
    if (keep.length > 0) {
      console.log('## In active use');
      console.log('');
      console.log(list(keep));
      console.log('');
    }
    if (prune.length > 0) {
      console.log('## Missing directories (metadata only)');
      console.log('');
      console.log(list(prune));
      console.log('');
    }
    process.exit(0);
  }

  console.log('');
  console.log(`Summary: ${removable.length} worktree(s) removable after review${showSizes ? `, about ${reclaimableGib} GiB reclaimable` : ''}.`);

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
    console.log('Audit only: rerun with --clean to remove only the REVIEW entries.');
  }
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
}
