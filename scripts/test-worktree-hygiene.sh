#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
TEST_ROOT="$(mktemp -d -t ritemark-worktree-hygiene-test.XXXXXX)"
TEST_ROOT="$(cd "$TEST_ROOT" && pwd -P)"
trap 'rm -rf "$TEST_ROOT"' EXIT

REPO="$TEST_ROOT/repo"
REMOTE="$TEST_ROOT/repo.git"
VSCODE_SOURCE="$TEST_ROOT/vscode-source"
VSCODE_REMOTE="$TEST_ROOT/vscode.git"

git init --initial-branch=main "$VSCODE_SOURCE" >/dev/null
git -C "$VSCODE_SOURCE" config user.name "Ritemark Hygiene Test"
git -C "$VSCODE_SOURCE" config user.email "hygiene-test@ritemark.local"
printf 'upstream\n' >"$VSCODE_SOURCE/file.txt"
git -C "$VSCODE_SOURCE" add file.txt
git -C "$VSCODE_SOURCE" commit -m "test: seed vscode" >/dev/null
git init --bare "$VSCODE_REMOTE" >/dev/null
git -C "$VSCODE_REMOTE" symbolic-ref HEAD refs/heads/main
git -C "$VSCODE_SOURCE" remote add origin "$VSCODE_REMOTE"
git -C "$VSCODE_SOURCE" push -u origin main >/dev/null

git init --initial-branch=main "$REPO" >/dev/null
git -C "$REPO" config user.name "Ritemark Hygiene Test"
git -C "$REPO" config user.email "hygiene-test@ritemark.local"
mkdir -p "$REPO/scripts" "$REPO/patches/vscode"
cp "$SCRIPT_DIR/vscode-derived-state.mjs" "$REPO/scripts/vscode-derived-state.mjs"
# Derived-path detection reads both the patch targets and the branding copies
# that apply-patches.sh performs, so the fixture must carry a stand-in.
printf -- '--- a/file.txt\n+++ b/file.txt\n' >"$REPO/patches/vscode/001-test.patch"
printf '#!/usr/bin/env bash\ncp "$BRANDING_DIR/logo.png" "$VSCODE_DIR/branded-asset.png"\n' >"$REPO/scripts/apply-patches.sh"
printf 'main\n' >"$REPO/file.txt"
git -C "$REPO" -c protocol.file.allow=always submodule add "$VSCODE_REMOTE" vscode >/dev/null
git -C "$REPO" add file.txt scripts/vscode-derived-state.mjs scripts/apply-patches.sh patches/vscode/001-test.patch .gitmodules vscode
git -C "$REPO" commit -m "test: seed main" >/dev/null
git init --bare "$REMOTE" >/dev/null
git -C "$REMOTE" symbolic-ref HEAD refs/heads/main
# The classifier asks GitHub about origin's owner/name; insteadOf keeps every
# push and fetch on the local bare remote.
GITHUB_URL="https://github.com/ritemark-test/fixture.git"
git -C "$REPO" remote add origin "$GITHUB_URL"
git -C "$REPO" config "url.$REMOTE.insteadOf" "$GITHUB_URL"
git -C "$REPO" push -u origin main >/dev/null

# Stand-in for the GitHub CLI. It answers the two calls the classifier makes
# from $FAKE_GH_FIXTURE and logs every call to $FAKE_GH_LOG.
mkdir -p "$TEST_ROOT/bin"
cat >"$TEST_ROOT/bin/gh" <<'FAKE_GH'
#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_GH_LOG, `${args.map(arg => arg.startsWith('query=') ? 'query=…' : arg).join(' ')}\n`);
const fail = message => { process.stderr.write(`${message}\n`); process.exit(1); };
const fixture = JSON.parse(fs.readFileSync(process.env.FAKE_GH_FIXTURE, 'utf8'));
if (fixture.unavailable) fail(fixture.unavailable);
if (args[0] !== 'api') fail(`unexpected gh call: ${args.join(' ')}`);
if (args[1] === 'graphql') {
  const fields = {};
  for (let index = 3; index < args.length; index += 2) {
    const separator = args[index].indexOf('=');
    fields[args[index].slice(0, separator)] = args[index].slice(separator + 1);
  }
  if (fields.owner !== 'ritemark-test' || fields.name !== 'fixture') fail('gh: Could not resolve to a Repository');
  process.stdout.write(JSON.stringify({ data: { repository: { pullRequests: { nodes: fixture.branches[fields.branch] || [] } } } }));
  process.exit(0);
}
const match = /^repos\/ritemark-test\/fixture\/commits\/([0-9a-f]{40})\/pulls$/.exec(args[1]);
if (!match) fail('gh: Not Found (HTTP 404)');
if (!fixture.commits[match[1]]) fail(`gh: No commit found for SHA: ${match[1]} (HTTP 422)`);
process.stdout.write(JSON.stringify(fixture.commits[match[1]]));
FAKE_GH
chmod +x "$TEST_ROOT/bin/gh"
export PATH="$TEST_ROOT/bin:$PATH"
export FAKE_GH_FIXTURE="$TEST_ROOT/github.json"
export FAKE_GH_LOG="$TEST_ROOT/gh-calls.log"

make_branch() {
  local branch="$1"
  git -C "$REPO" switch -c "$branch" main >/dev/null
  printf '%s\n' "$branch" >"$REPO/$branch.txt"
  git -C "$REPO" add "$branch.txt"
  git -C "$REPO" commit -m "test: $branch" >/dev/null
  git -C "$REPO" push -u origin "$branch" >/dev/null
  git -C "$REPO" switch main >/dev/null
}

make_branch merged-clean
git -C "$REPO" merge --no-ff merged-clean -m "test: merge clean" >/dev/null
git -C "$REPO" push origin main >/dev/null
git -C "$REPO" worktree add "$TEST_ROOT/wt-merged-clean" merged-clean >/dev/null
GIT_ALLOW_PROTOCOL=file git -C "$TEST_ROOT/wt-merged-clean" submodule update --init --checkout vscode >/dev/null
printf 'canonical derived change\n' >>"$TEST_ROOT/wt-merged-clean/vscode/file.txt"
node "$TEST_ROOT/wt-merged-clean/scripts/vscode-derived-state.mjs" \
  --write --repo "$TEST_ROOT/wt-merged-clean" >/dev/null

make_branch merged-dirty
git -C "$REPO" merge --no-ff merged-dirty -m "test: merge dirty" >/dev/null
git -C "$REPO" push origin main >/dev/null
git -C "$REPO" worktree add "$TEST_ROOT/wt-merged-dirty" merged-dirty >/dev/null
printf 'do not delete\n' >"$TEST_ROOT/wt-merged-dirty/local.txt"

make_branch active-unmerged
git -C "$REPO" worktree add "$TEST_ROOT/wt-active" active-unmerged >/dev/null

# Merged, and its remote branch deleted the way a squash/merge with
# --delete-branch leaves it. Being in main proves the commits survive, so the
# missing upstream must not block it.
make_branch merged-remote-gone
git -C "$REPO" merge --no-ff merged-remote-gone -m "test: merge remote-gone" >/dev/null
git -C "$REPO" push origin main >/dev/null
git -C "$REPO" worktree add "$TEST_ROOT/wt-remote-gone" merged-remote-gone >/dev/null
git -C "$REPO" push origin --delete merged-remote-gone >/dev/null
git -C "$REPO" branch --unset-upstream merged-remote-gone >/dev/null

# Merged and clean in Git, but holding build output that Git cannot see because
# dist/ is ignored. This is the release-worktree case.
make_branch merged-with-output
git -C "$REPO" merge --no-ff merged-with-output -m "test: merge with output" >/dev/null
git -C "$REPO" push origin main >/dev/null
git -C "$REPO" worktree add "$TEST_ROOT/wt-output" merged-with-output >/dev/null
mkdir -p "$TEST_ROOT/wt-output/dist"
printf 'notarized bytes\n' >"$TEST_ROOT/wt-output/dist/Ritemark-9.9.9-darwin-arm64.dmg"

# Merged and clean, but the vscode submodule carries a path no Ritemark command
# regenerates — possible hand-editing, must be held back.
make_branch merged-handedited
git -C "$REPO" merge --no-ff merged-handedited -m "test: merge handedited" >/dev/null
git -C "$REPO" push origin main >/dev/null
git -C "$REPO" worktree add "$TEST_ROOT/wt-handedited" merged-handedited >/dev/null
GIT_ALLOW_PROTOCOL=file git -C "$TEST_ROOT/wt-handedited" submodule update --init --checkout vscode >/dev/null
printf 'hand edit\n' >"$TEST_ROOT/wt-handedited/vscode/hand-edited.txt"

# Merged and clean, whose vscode dirt is only what apply-patches.sh reproduces:
# a patch target plus a copied branding asset. This is the ordinary development
# worktree the janitor previously refused to ever clean.
make_branch merged-derived
git -C "$REPO" merge --no-ff merged-derived -m "test: merge derived" >/dev/null
git -C "$REPO" push origin main >/dev/null
git -C "$REPO" worktree add "$TEST_ROOT/wt-derived" merged-derived >/dev/null
GIT_ALLOW_PROTOCOL=file git -C "$TEST_ROOT/wt-derived" submodule update --init --checkout vscode >/dev/null
printf 'patched\n' >>"$TEST_ROOT/wt-derived/vscode/file.txt"
printf 'branding\n' >"$TEST_ROOT/wt-derived/vscode/branded-asset.png"
mkdir -p "$TEST_ROOT/wt-derived/vscode/node_modules/dep"
printf 'dep\n' >"$TEST_ROOT/wt-derived/vscode/node_modules/dep/index.js"

# Merged and clean, but a commit was made inside the vscode submodule. Only the
# recorded commit is derived state; `git worktree remove` would delete that one.
make_branch merged-subcommit
git -C "$REPO" merge --no-ff merged-subcommit -m "test: merge subcommit" >/dev/null
git -C "$REPO" push origin main >/dev/null
git -C "$REPO" worktree add "$TEST_ROOT/wt-subcommit" merged-subcommit >/dev/null
GIT_ALLOW_PROTOCOL=file git -C "$TEST_ROOT/wt-subcommit" submodule update --init --checkout vscode >/dev/null
printf 'work inside vscode\n' >>"$TEST_ROOT/wt-subcommit/vscode/file.txt"
git -C "$TEST_ROOT/wt-subcommit/vscode" -c user.name="Ritemark Hygiene Test" -c user.email="hygiene-test@ritemark.local" \
  commit -am "test: commit inside vscode" >/dev/null

# Every PR on main is squash-merged, so a merged branch's commits never become
# ancestors of main. These land the change the way GitHub does.
squash_into_main() {
  git -C "$REPO" merge --squash "$1" >/dev/null
  git -C "$REPO" commit -m "test: squash $1" >/dev/null
  git -C "$REPO" push origin main >/dev/null
}
advance_main() {
  printf '%s\n' "$1" >"$REPO/$1.txt"
  git -C "$REPO" add "$1.txt"
  git -C "$REPO" commit -m "test: $1 on main" >/dev/null
  git -C "$REPO" push origin main >/dev/null
}
# What an archived session leaves behind: the worktree detached at the
# branch's last commit, the branch deleted locally and on the remote.
delete_branch() {
  git -C "$REPO" branch -D "$1" >/dev/null
  git -C "$REPO" push origin --delete "$1" >/dev/null 2>&1
}

make_branch squash-detached
SQUASH_DETACHED="$(git -C "$REPO" rev-parse squash-detached)"
squash_into_main squash-detached
git -C "$REPO" worktree add --detach "$TEST_ROOT/wt-squash" squash-detached >/dev/null
delete_branch squash-detached

# The #381/#382/#385 shape: the PR was rebased and force-pushed just before
# its squash merge, so GitHub links the worktree's commit to no PR. Only the
# PR's force-push event, found through the branch the HEAD reflog names, does.
# Its vscode carries the applied patch set, as every development worktree does.
git -C "$REPO" worktree add --detach "$TEST_ROOT/wt-forcepushed" main >/dev/null
git -C "$TEST_ROOT/wt-forcepushed" switch -c fix/forcepushed >/dev/null 2>&1
printf 'forcepushed\n' >"$TEST_ROOT/wt-forcepushed/forcepushed.txt"
git -C "$TEST_ROOT/wt-forcepushed" add forcepushed.txt
git -C "$TEST_ROOT/wt-forcepushed" commit -m "test: forcepushed" >/dev/null
git -C "$TEST_ROOT/wt-forcepushed" push -u origin fix/forcepushed >/dev/null 2>&1
FORCEPUSHED="$(git -C "$TEST_ROOT/wt-forcepushed" rev-parse HEAD)"
git -C "$TEST_ROOT/wt-forcepushed" switch --detach >/dev/null 2>&1
delete_branch fix/forcepushed
squash_into_main "$FORCEPUSHED"
GIT_ALLOW_PROTOCOL=file git -C "$TEST_ROOT/wt-forcepushed" submodule update --init --checkout vscode >/dev/null
printf 'patched\n' >>"$TEST_ROOT/wt-forcepushed/vscode/file.txt"

# The serene-heyrovsky shape: origin/main merged into the branch before the
# squash merge. The merge commit is in no PR; its clean tree proves it adds
# nothing of its own.
make_branch squash-mergemain
MERGEMAIN_WORK="$(git -C "$REPO" rev-parse squash-mergemain)"
advance_main mergemain-base
git -C "$REPO" worktree add "$TEST_ROOT/wt-mergemain" squash-mergemain >/dev/null
git -C "$TEST_ROOT/wt-mergemain" merge --no-edit origin/main >/dev/null
MERGEMAIN_MERGE="$(git -C "$TEST_ROOT/wt-mergemain" rev-parse HEAD)"
squash_into_main "$MERGEMAIN_WORK"
git -C "$TEST_ROOT/wt-mergemain" switch --detach >/dev/null 2>&1
delete_branch squash-mergemain

# The same, but the merge carries a hand-made change: not proven.
make_branch squash-evilmerge
EVIL_WORK="$(git -C "$REPO" rev-parse squash-evilmerge)"
advance_main evilmerge-base
git -C "$REPO" worktree add "$TEST_ROOT/wt-evilmerge" squash-evilmerge >/dev/null
git -C "$TEST_ROOT/wt-evilmerge" merge --no-commit --no-ff origin/main >/dev/null 2>&1
printf 'resolved by hand\n' >>"$TEST_ROOT/wt-evilmerge/squash-evilmerge.txt"
git -C "$TEST_ROOT/wt-evilmerge" add squash-evilmerge.txt
git -C "$TEST_ROOT/wt-evilmerge" commit --no-edit >/dev/null
EVIL_MERGE="$(git -C "$TEST_ROOT/wt-evilmerge" rev-parse HEAD)"
squash_into_main "$EVIL_WORK"
git -C "$TEST_ROOT/wt-evilmerge" switch --detach >/dev/null 2>&1
delete_branch squash-evilmerge

# Squash-merged, then a commit that never reached GitHub.
make_branch squash-extra
EXTRA_MERGED="$(git -C "$REPO" rev-parse squash-extra)"
squash_into_main squash-extra
git -C "$REPO" worktree add --detach "$TEST_ROOT/wt-squash-extra" squash-extra >/dev/null
printf 'after the merge\n' >"$TEST_ROOT/wt-squash-extra/after-merge.txt"
git -C "$TEST_ROOT/wt-squash-extra" add after-merge.txt
git -C "$TEST_ROOT/wt-squash-extra" commit -m "test: after the merge" >/dev/null
EXTRA_LOCAL="$(git -C "$TEST_ROOT/wt-squash-extra" rev-parse HEAD)"
delete_branch squash-extra

# Squash-merged but dirty: GitHub must not even be asked.
make_branch squash-dirty
SQUASH_DIRTY="$(git -C "$REPO" rev-parse squash-dirty)"
squash_into_main squash-dirty
git -C "$REPO" worktree add --detach "$TEST_ROOT/wt-squash-dirty" squash-dirty >/dev/null
delete_branch squash-dirty
printf 'unsaved notes\n' >"$TEST_ROOT/wt-squash-dirty/notes.txt"

# Squash-merged but holding build output.
make_branch squash-output
SQUASH_OUTPUT="$(git -C "$REPO" rev-parse squash-output)"
squash_into_main squash-output
git -C "$REPO" worktree add --detach "$TEST_ROOT/wt-squash-output" squash-output >/dev/null
delete_branch squash-output
mkdir -p "$TEST_ROOT/wt-squash-output/VSCode-darwin-arm64"
printf 'app\n' >"$TEST_ROOT/wt-squash-output/VSCode-darwin-arm64/Ritemark.app"

# The license-site-link shape: still on its branch, upstream intact, PR
# squash-merged. Previously KEEP — active/unmerged forever.
make_branch squash-branch
SQUASH_BRANCH="$(git -C "$REPO" rev-parse squash-branch)"
squash_into_main squash-branch
git -C "$REPO" worktree add "$TEST_ROOT/wt-squash-branch" squash-branch >/dev/null

ACTIVE="$(git -C "$REPO" rev-parse active-unmerged)"
merged_pr() {
  printf '[{"number": %s, "state": "closed", "merged_at": "2026-10-12T08:00:00Z", "base": {"ref": "main"}}]' "$1"
}
cat >"$FAKE_GH_FIXTURE" <<EOF
{
  "commits": {
    "$SQUASH_DETACHED": $(merged_pr 11),
    "$FORCEPUSHED": [],
    "$MERGEMAIN_WORK": $(merged_pr 13),
    "$SQUASH_BRANCH": $(merged_pr 14),
    "$EXTRA_MERGED": $(merged_pr 15),
    "$SQUASH_OUTPUT": $(merged_pr 16),
    "$SQUASH_DIRTY": $(merged_pr 17),
    "$EVIL_WORK": $(merged_pr 18),
    "$ACTIVE": [{"number": 7, "state": "open", "merged_at": null, "base": {"ref": "main"}}]
  },
  "branches": {
    "fix/forcepushed": [{
      "number": 12,
      "baseRefName": "main",
      "headRefOid": "1111111111111111111111111111111111111111",
      "timelineItems": {"nodes": [{"beforeCommit": {"oid": "$FORCEPUSHED"}}]}
    }]
  }
}
EOF

AUDIT_LOG="$TEST_ROOT/audit.log"
node "$SCRIPT_DIR/worktree-hygiene.mjs" --check --repo "$REPO" --no-sizes >"$AUDIT_LOG"
assert_contains() {
  local expected="$1" log="${2:-$AUDIT_LOG}"
  if ! grep -qF -- "$expected" "$log"; then
    echo "FAIL: output missing: $expected" >&2
    cat "$log" >&2
    exit 1
  fi
}
assert_contains "REVIEW   $TEST_ROOT/wt-merged-clean — fully pushed/merged with verified derived VS Code state"
assert_contains "BLOCKED  $TEST_ROOT/wt-merged-dirty — uncommitted superproject changes"
assert_contains "KEEP     $TEST_ROOT/wt-active — active/unmerged"
echo "PASS: audit classified clean, dirty, and active worktrees correctly"

# Build output is invisible to git status because dist/ is ignored; the audit
# must look at the filesystem or it will offer up notarized release artifacts.
assert_contains "BLOCKED  $TEST_ROOT/wt-output — build output present: dist/ (1 entry)"
echo "PASS: build output blocks an otherwise-clean merged worktree"

# A merged branch whose remote was deleted on merge is the normal post-merge
# state, not unpushed work.
assert_contains "REVIEW   $TEST_ROOT/wt-remote-gone — fully pushed and merged"
echo "PASS: a merged branch with no upstream is still reclaimable"

# vscode dirt that apply-patches.sh reproduces is derived state, not user work.
assert_contains "REVIEW   $TEST_ROOT/wt-derived — fully pushed and merged"
assert_contains "regenerated by apply-patches.sh"
echo "PASS: a patched vscode submodule no longer blocks a merged worktree"

# One path outside that set is possible hand-editing and must be held back.
assert_contains "BLOCKED  $TEST_ROOT/wt-handedited — local changes need review"
assert_contains "hand-edited.txt"
echo "PASS: an unexpected vscode path blocks the worktree"

assert_contains "BLOCKED  $TEST_ROOT/wt-subcommit — local changes need review — vscode is checked out at"
echo "PASS: a commit made inside the vscode submodule blocks the worktree"

# Squash merges: proven from GitHub, commit by commit.
assert_contains "REVIEW   $TEST_ROOT/wt-squash — squash-merged: the commit ahead of origin/main is in merged PR #11 ((detached))"
echo "PASS: a detached worktree whose commit is in a merged PR is reclaimable"

assert_contains "REVIEW   $TEST_ROOT/wt-forcepushed — squash-merged: the commit ahead of origin/main is in merged PR #12 (its head before a force-push) ((detached)); its 1 vscode changes are all regenerated by apply-patches.sh"
echo "PASS: a PR head replaced by a force-push before the merge is proven through the reflog's branch"

assert_contains "REVIEW   $TEST_ROOT/wt-mergemain — squash-merged: the 2 commits ahead of origin/main are in merged PR #13 or a clean merge of origin/main ((detached))"
if grep -qF "$MERGEMAIN_MERGE" "$FAKE_GH_LOG"; then
  echo "FAIL: the clean merge of origin/main was looked up on GitHub instead of proven locally" >&2
  exit 1
fi
echo "PASS: a clean merge of origin/main into the branch needs no PR"

assert_contains "BLOCKED  $TEST_ROOT/wt-evilmerge — unmerged branch has no upstream ((detached)); not a proven squash merge: ${EVIL_MERGE:0:8} is not on GitHub"
echo "PASS: a merge of origin/main carrying a hand-made change is not proven"

assert_contains "BLOCKED  $TEST_ROOT/wt-squash-extra — unmerged branch has no upstream ((detached)); not a proven squash merge: ${EXTRA_LOCAL:0:8} is not on GitHub"
echo "PASS: a commit after the squash merge keeps the worktree blocked"

assert_contains "BLOCKED  $TEST_ROOT/wt-squash-dirty — uncommitted superproject changes ((detached))"
if grep -qF "$SQUASH_DIRTY" "$FAKE_GH_LOG"; then
  echo "FAIL: GitHub was asked about a dirty worktree" >&2
  exit 1
fi
echo "PASS: a dirty squash-merged worktree stays blocked without asking GitHub"

assert_contains "BLOCKED  $TEST_ROOT/wt-squash-output — build output present: VSCode-darwin-arm64/ (1 entry)"
echo "PASS: build output blocks a squash-merged worktree"

assert_contains "REVIEW   $TEST_ROOT/wt-squash-branch — squash-merged: the commit ahead of origin/main is in merged PR #14 (squash-branch)"
assert_contains "KEEP     $TEST_ROOT/wt-active — active/unmerged (active-unmerged); not a proven squash merge: ${ACTIVE:0:8} is only in unmerged PR #7"
echo "PASS: a squash-merged branch is reclaimable; one with an open PR stays in use"

# GitHub unreachable or refusing: every verdict is what it was before the proof.
for unavailable in \
  "error connecting to api.github.com" \
  "gh: Bad credentials (HTTP 401)"; do
  OFFLINE_FIXTURE="$TEST_ROOT/github-unavailable.json"
  printf '{"unavailable": "%s"}\n' "$unavailable" >"$OFFLINE_FIXTURE"
  OFFLINE_LOG="$TEST_ROOT/audit-offline.log"
  FAKE_GH_FIXTURE="$OFFLINE_FIXTURE" node "$SCRIPT_DIR/worktree-hygiene.mjs" --check --repo "$REPO" --no-sizes >"$OFFLINE_LOG"
  assert_contains "BLOCKED  $TEST_ROOT/wt-squash — unmerged branch has no upstream ((detached)); squash merge not checked: GitHub unavailable ($unavailable)" "$OFFLINE_LOG"
  assert_contains "BLOCKED  $TEST_ROOT/wt-mergemain — unmerged branch has no upstream ((detached)); squash merge not checked" "$OFFLINE_LOG"
  assert_contains "KEEP     $TEST_ROOT/wt-squash-branch — active/unmerged (squash-branch); squash merge not checked: GitHub unavailable" "$OFFLINE_LOG"
  if grep -q "squash-merged" "$OFFLINE_LOG"; then
    echo "FAIL: a squash merge was claimed with GitHub unavailable ($unavailable)" >&2
    cat "$OFFLINE_LOG" >&2
    exit 1
  fi
done
echo "PASS: with gh offline or unauthenticated the previous verdicts stand"

REPORT_LOG="$TEST_ROOT/report.log"
node "$SCRIPT_DIR/worktree-hygiene.mjs" --report --repo "$REPO" --no-sizes >"$REPORT_LOG"
for expected in \
  "# Ritemark worktree report" \
  "Nothing has been deleted — this is a report." \
  "## Safe to remove — needs your go-ahead" \
  "## Held back — not touched" \
  "wt-output"; do
  if ! grep -qF "$expected" "$REPORT_LOG"; then
    echo "FAIL: report output missing: $expected" >&2
    cat "$REPORT_LOG" >&2
    exit 1
  fi
done
if grep -q "Worktree hygiene audit" "$REPORT_LOG"; then
  echo "FAIL: report mode leaked the audit header" >&2
  exit 1
fi
echo "PASS: report mode renders an email-ready summary"

node "$SCRIPT_DIR/worktree-hygiene.mjs" --clean --repo "$REPO" --no-sizes >/dev/null

if [[ -e "$TEST_ROOT/wt-merged-clean" ]]; then
  echo "FAIL: clean merged worktree was not removed" >&2
  exit 1
fi
if [[ ! -d "$TEST_ROOT/wt-merged-dirty" ]]; then
  echo "FAIL: dirty worktree was removed" >&2
  exit 1
fi
if [[ ! -d "$TEST_ROOT/wt-active" ]]; then
  echo "FAIL: active worktree was removed" >&2
  exit 1
fi

if [[ ! -d "$TEST_ROOT/wt-output/dist" ]]; then
  echo "FAIL: cleanup destroyed build output" >&2
  exit 1
fi
if [[ ! -d "$TEST_ROOT/wt-handedited" ]]; then
  echo "FAIL: cleanup removed a hand-edited worktree" >&2
  exit 1
fi
echo "PASS: cleanup preserved build output and hand-edited state"

for removed in wt-squash wt-forcepushed wt-mergemain wt-squash-branch; do
  if [[ -e "$TEST_ROOT/$removed" ]]; then
    echo "FAIL: proven squash-merged worktree $removed was not removed" >&2
    exit 1
  fi
done
for kept in wt-evilmerge wt-squash-extra wt-squash-dirty wt-squash-output/VSCode-darwin-arm64 wt-subcommit; do
  if [[ ! -d "$TEST_ROOT/$kept" ]]; then
    echo "FAIL: cleanup removed $kept" >&2
    exit 1
  fi
done
if ! git -C "$REPO" rev-parse --verify --quiet refs/heads/squash-branch >/dev/null; then
  echo "FAIL: cleanup deleted the squash-merged branch" >&2
  exit 1
fi
echo "PASS: cleanup removed proven squash merges and kept every unproven one"
echo "PASS: cleanup removed only the proven-safe worktrees"
echo "Worktree hygiene tests passed"
