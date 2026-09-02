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
printf 'canonical patch bytes\n' >"$REPO/patches/vscode/001-test.patch"
printf 'main\n' >"$REPO/file.txt"
git -C "$REPO" -c protocol.file.allow=always submodule add "$VSCODE_REMOTE" vscode >/dev/null
git -C "$REPO" add file.txt scripts/vscode-derived-state.mjs patches/vscode/001-test.patch .gitmodules vscode
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
assert_contains "REMOVE   $TEST_ROOT/wt-merged-clean — fully pushed/merged with verified derived VS Code state"
assert_contains "BLOCKED  $TEST_ROOT/wt-merged-dirty — uncommitted superproject changes"
assert_contains "KEEP     $TEST_ROOT/wt-active — active/unmerged"
echo "PASS: audit classified clean, dirty, and active worktrees correctly"

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

echo "PASS: cleanup removed only the proven-safe worktree"
echo "Worktree hygiene tests passed"
