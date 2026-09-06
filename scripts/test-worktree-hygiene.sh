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
git -C "$REPO" remote add origin "$REMOTE"
git -C "$REPO" push -u origin main >/dev/null

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

AUDIT_LOG="$TEST_ROOT/audit.log"
node "$SCRIPT_DIR/worktree-hygiene.mjs" --check --repo "$REPO" --no-sizes >"$AUDIT_LOG"
assert_contains() {
  local expected="$1"
  if ! grep -q "$expected" "$AUDIT_LOG"; then
    echo "FAIL: audit output missing: $expected" >&2
    cat "$AUDIT_LOG" >&2
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
echo "PASS: cleanup removed only the proven-safe worktree"
echo "Worktree hygiene tests passed"
