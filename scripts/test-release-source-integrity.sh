#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
TEST_ROOT="$(mktemp -d -t ritemark-release-source-test.XXXXXX)"
TEST_ROOT="$(cd "$TEST_ROOT" && pwd -P)"
trap 'rm -rf "$TEST_ROOT"' EXIT

git_identity() {
  git -C "$1" config user.name "Ritemark Guard Test"
  git -C "$1" config user.email "guard-test@ritemark.local"
}

expect_failure() {
  local expected="$1"
  shift
  local log="$TEST_ROOT/failure.log"
  if "$@" >"$log" 2>&1; then
    echo "FAIL: command unexpectedly succeeded: $*" >&2
    exit 1
  fi
  if ! grep -q "$expected" "$log"; then
    echo "FAIL: expected failure text not found: $expected" >&2
    cat "$log" >&2
    exit 1
  fi
  echo "PASS: rejected $expected"
}

VSCODE_SOURCE="$TEST_ROOT/vscode-source"
VSCODE_REMOTE="$TEST_ROOT/vscode.git"
SUPER="$TEST_ROOT/ritemark"
SUPER_REMOTE="$TEST_ROOT/ritemark.git"

git init --initial-branch=main "$VSCODE_SOURCE" >/dev/null
git_identity "$VSCODE_SOURCE"
mkdir -p "$VSCODE_SOURCE/extensions"
printf '22.21.1\n' >"$VSCODE_SOURCE/.nvmrc"
printf '{}\n' >"$VSCODE_SOURCE/package-lock.json"
git -C "$VSCODE_SOURCE" add .
git -C "$VSCODE_SOURCE" commit -m "test: seed vscode" >/dev/null
git init --bare "$VSCODE_REMOTE" >/dev/null
git -C "$VSCODE_REMOTE" symbolic-ref HEAD refs/heads/main
git -C "$VSCODE_SOURCE" remote add origin "$VSCODE_REMOTE"
git -C "$VSCODE_SOURCE" push -u origin main >/dev/null

git init --initial-branch=main "$SUPER" >/dev/null
git_identity "$SUPER"
mkdir -p \
  "$SUPER/extensions/ritemark/webview" \
  "$SUPER/extensions/ritemark/binaries/agents" \
  "$SUPER/patches/vscode" \
  "$SUPER/scripts"
cp "$SCRIPT_DIR/verify-release-source.sh" "$SUPER/scripts/verify-release-source.sh"
cp "$SCRIPT_DIR/create-release-worktree.sh" "$SUPER/scripts/create-release-worktree.sh"
cp "$SCRIPT_DIR/vscode-derived-state.mjs" "$SUPER/scripts/vscode-derived-state.mjs"
cp "$SCRIPT_DIR/apply-patches.sh" "$SUPER/scripts/apply-patches.sh"
chmod +x \
  "$SUPER/scripts/verify-release-source.sh" \
  "$SUPER/scripts/create-release-worktree.sh" \
  "$SUPER/scripts/apply-patches.sh" \
  "$SUPER/scripts/vscode-derived-state.mjs"
printf '{}\n' >"$SUPER/extensions/ritemark/package-lock.json"
printf '{}\n' >"$SUPER/extensions/ritemark/webview/package-lock.json"
printf '{"runtimes":[]}\n' >"$SUPER/extensions/ritemark/binaries/agents/manifest.json"
printf '{"ritemarkVersion":"0.0.0-test"}\n' >"$SUPER/branding.json"
mkdir -p "$SUPER/branding"
mv "$SUPER/branding.json" "$SUPER/branding/product.json"
printf '%s\n' \
  'diff --git a/package-lock.json b/package-lock.json' \
  '--- a/package-lock.json' \
  '+++ b/package-lock.json' \
  '@@ -1 +1 @@' \
  '-{}' \
  '+{"step":1}' >"$SUPER/patches/vscode/001-test.patch"
printf '%s\n' \
  'diff --git a/package-lock.json b/package-lock.json' \
  '--- a/package-lock.json' \
  '+++ b/package-lock.json' \
  '@@ -1 +1 @@' \
  '-{"step":1}' \
  '+{"step":2}' >"$SUPER/patches/vscode/002-test.patch"
printf 'VSCode-*\n' >"$SUPER/.gitignore"
git -C "$SUPER" -c protocol.file.allow=always submodule add "$VSCODE_REMOTE" vscode >/dev/null
git -C "$SUPER" add .
git -C "$SUPER" commit -m "test: seed release source" >/dev/null
git init --bare "$SUPER_REMOTE" >/dev/null
git -C "$SUPER_REMOTE" symbolic-ref HEAD refs/heads/main
git -C "$SUPER" remote add origin "$SUPER_REMOTE"
git -C "$SUPER" push -u origin main >/dev/null

if git -C "$SUPER/vscode" apply --check "$SUPER/patches/vscode/002-test.patch" 2>/dev/null; then
  echo "FAIL: dependent test patch unexpectedly applies to pristine HEAD" >&2
  exit 1
fi
"$SUPER/scripts/apply-patches.sh" --dry-run >/dev/null
echo "PASS: dry-run validates dependent patches sequentially without changing the worktree"

"$SCRIPT_DIR/verify-release-source.sh" --repo "$SUPER" --expected-ref origin/main >/dev/null
echo "PASS: accepted clean exact main source"

mkdir -p "$SUPER/vscode/extensions"
ln -s ../../extensions/ritemark "$SUPER/vscode/extensions/ritemark"
expect_failure "extension must already be staged outside VS Code" \
  "$SUPER/scripts/apply-patches.sh" --extension-layout absent
rm "$SUPER/vscode/extensions/ritemark"
mkdir -p "$SUPER/vscode/src/vs/base/browser/ui/codicons/codicon"
printf 'test phosphor font\n' >"$SUPER/vscode/src/vs/base/browser/ui/codicons/codicon/phosphor.woff2"
"$SUPER/scripts/apply-patches.sh" --extension-layout absent >/dev/null
"$SCRIPT_DIR/verify-release-source.sh" \
  --repo "$SUPER" --expected-ref origin/main --phase patched \
  --extension-layout absent >/dev/null
git -C "$SUPER/vscode" restore package-lock.json
rm -rf "$SUPER/vscode/product.json" "$SUPER/vscode/src"
node "$SCRIPT_DIR/vscode-derived-state.mjs" --clear --repo "$SUPER" >/dev/null
echo "PASS: patch applicator records only an already-staged absent-extension layout"

printf 'derived patch state\n' >>"$SUPER/vscode/package-lock.json"
node "$SCRIPT_DIR/vscode-derived-state.mjs" --write --repo "$SUPER" >/dev/null
node "$SCRIPT_DIR/vscode-derived-state.mjs" --verify --repo "$SUPER" >/dev/null
printf 'unexpected patch mutation\n' >>"$SUPER/patches/vscode/001-test.patch"
expect_failure "differs from its recorded canonical derived state" \
  node "$SCRIPT_DIR/vscode-derived-state.mjs" --verify --repo "$SUPER"
git -C "$SUPER" restore patches/vscode/001-test.patch
printf 'manual unrecorded edit\n' >>"$SUPER/vscode/package-lock.json"
expect_failure "differs from its recorded canonical derived state" \
  node "$SCRIPT_DIR/vscode-derived-state.mjs" --verify --repo "$SUPER"
git -C "$SUPER/vscode" restore package-lock.json
node "$SCRIPT_DIR/vscode-derived-state.mjs" --clear --repo "$SUPER" >/dev/null
echo "PASS: derived VS Code marker detects later manual edits"

printf 'canonical derived patch\n' >>"$SUPER/vscode/package-lock.json"
mkdir -p "$SUPER/vscode/extensions"
ln -s ../../extensions/ritemark "$SUPER/vscode/extensions/ritemark"
node "$SCRIPT_DIR/vscode-derived-state.mjs" --write --repo "$SUPER" >/dev/null
"$SCRIPT_DIR/verify-release-source.sh" \
  --repo "$SUPER" --expected-ref origin/main --phase patched >/dev/null
printf 'unrecorded unrelated edit\n' >"$SUPER/vscode/manual-edit.txt"
expect_failure "canonical patch set or patched vscode differs from the state recorded" \
  "$SCRIPT_DIR/verify-release-source.sh" \
    --repo "$SUPER" --expected-ref origin/main --phase patched
rm "$SUPER/vscode/manual-edit.txt" "$SUPER/vscode/extensions/ritemark"
expect_failure "canonical patch set or patched vscode differs from the state recorded" \
  "$SCRIPT_DIR/verify-release-source.sh" \
    --repo "$SUPER" --expected-ref origin/main --phase patched \
    --extension-layout absent
node "$SCRIPT_DIR/vscode-derived-state.mjs" --write --repo "$SUPER" >/dev/null
"$SCRIPT_DIR/verify-release-source.sh" \
  --repo "$SUPER" --expected-ref origin/main --phase patched \
  --extension-layout absent >/dev/null
mkdir -p "$SUPER/vscode/extensions/ritemark"
printf 'unexpected extension return\n' >"$SUPER/vscode/extensions/ritemark/package.json"
expect_failure "patched vscode still contains the extension during the staged shell build" \
  "$SCRIPT_DIR/verify-release-source.sh" \
    --repo "$SUPER" --expected-ref origin/main --phase patched \
    --extension-layout absent
rm -rf "$SUPER/vscode/extensions/ritemark"
git -C "$SUPER/vscode" restore package-lock.json
node "$SCRIPT_DIR/vscode-derived-state.mjs" --clear --repo "$SUPER" >/dev/null
echo "PASS: patched release gate binds the exact extension layout and rejects unrelated edits"

CREATED_RELEASE="$TEST_ROOT/created-release"
GIT_ALLOW_PROTOCOL=file "$SUPER/scripts/create-release-worktree.sh" \
  --path "$CREATED_RELEASE" --skip-dependencies >/dev/null
if [[ -L "$CREATED_RELEASE/vscode" ]] || \
   [[ ! -d "$CREATED_RELEASE/vscode/.git" && ! -f "$CREATED_RELEASE/vscode/.git" ]]; then
  echo "FAIL: release creator did not materialize a physical submodule" >&2
  exit 1
fi
CREATED_GIT_DIR="$(git -C "$CREATED_RELEASE" rev-parse --git-dir)"
if [[ "$CREATED_GIT_DIR" != /* ]]; then
  CREATED_GIT_DIR="$CREATED_RELEASE/$CREATED_GIT_DIR"
fi
if [[ ! -f "$CREATED_GIT_DIR/ritemark-release-worktree.json" ]]; then
  echo "FAIL: release creator did not write its disposable-worktree marker" >&2
  exit 1
fi
git -C "$SUPER" worktree remove --force "$CREATED_RELEASE"
echo "PASS: release creator produced a new detached physical checkout"

mkdir -p "$TEST_ROOT/shared-dependencies"
ln -s "$TEST_ROOT/shared-dependencies" "$SUPER/extensions/ritemark/node_modules"
expect_failure "dependency directory is shared through a symlink" \
  "$SCRIPT_DIR/verify-release-source.sh" --repo "$SUPER" --expected-ref origin/main
rm "$SUPER/extensions/ritemark/node_modules"

mkdir -p "$SUPER/VSCode-darwin-arm64"
expect_failure "old build output exists" \
  "$SCRIPT_DIR/verify-release-source.sh" --repo "$SUPER" --expected-ref origin/main
rmdir "$SUPER/VSCode-darwin-arm64"

git -C "$SUPER" switch -c feature-test >/dev/null
expect_failure "release builds may only use main" \
  "$SCRIPT_DIR/verify-release-source.sh" --repo "$SUPER" --expected-ref origin/main
git -C "$SUPER" switch main >/dev/null
git -C "$SUPER" branch -D feature-test >/dev/null

printf 'dirty\n' >"$SUPER/uncommitted.txt"
expect_failure "release sources contain tracked or untracked changes" \
  "$SCRIPT_DIR/verify-release-source.sh" --repo "$SUPER" --expected-ref origin/main
rm "$SUPER/uncommitted.txt"

git -C "$SUPER" submodule deinit -f vscode >/dev/null
rm -rf "$SUPER/vscode"
ln -s "$VSCODE_SOURCE" "$SUPER/vscode"
expect_failure "vscode is a symlink" \
  "$SCRIPT_DIR/verify-release-source.sh" --repo "$SUPER" --expected-ref origin/main
rm "$SUPER/vscode"
git -C "$SUPER" -c protocol.file.allow=always submodule update --init --checkout vscode >/dev/null

APP="$SUPER/VSCode-darwin-arm64/Ritemark.app"
APP_EXTENSION="$APP/Contents/Resources/app/extensions/ritemark"
mkdir -p "$APP_EXTENSION/out"
printf 'built extension\n' >"$APP_EXTENSION/out/extension.js"
STAGED_EXTENSION="$TEST_ROOT/staged-extension"
cp -R "$APP_EXTENSION" "$STAGED_EXTENSION"
STAGED_EXTENSION_SHA="$(node "$SCRIPT_DIR/tree-sha256.mjs" "$STAGED_EXTENSION")"
node "$SCRIPT_DIR/vscode-derived-state.mjs" --write --repo "$SUPER" >/dev/null
node "$SCRIPT_DIR/build-provenance.mjs" \
  --write --repo "$SUPER" --target darwin-arm64 --app "$APP" \
  --extension-input "$STAGED_EXTENSION" \
  --expected-extension-sha "$STAGED_EXTENSION_SHA" >/dev/null
node "$SCRIPT_DIR/build-provenance.mjs" \
  --verify --repo "$SUPER" --target darwin-arm64 --app "$APP" \
  --extension-input "$STAGED_EXTENSION" \
  --expected-extension-sha "$STAGED_EXTENSION_SHA" >/dev/null
echo "PASS: build provenance round-trip"

printf 'staged mutation\n' >>"$STAGED_EXTENSION/out/extension.js"
expect_failure "staged extension changed after its release digest was recorded" \
  node "$SCRIPT_DIR/build-provenance.mjs" \
    --verify --repo "$SUPER" --target darwin-arm64 --app "$APP" \
    --extension-input "$STAGED_EXTENSION" \
    --expected-extension-sha "$STAGED_EXTENSION_SHA"
printf 'built extension\n' >"$STAGED_EXTENSION/out/extension.js"
echo "PASS: build provenance rejects staged extension drift after digest recording"

printf 'mutated built extension\n' >>"$APP_EXTENSION/out/extension.js"
expect_failure "built extension does not match staged release payload" \
  node "$SCRIPT_DIR/build-provenance.mjs" \
    --verify --repo "$SUPER" --target darwin-arm64 --app "$APP" \
    --extension-input "$STAGED_EXTENSION" \
    --expected-extension-sha "$STAGED_EXTENSION_SHA"
printf 'built extension\n' >"$APP_EXTENSION/out/extension.js"
echo "PASS: build provenance binds the final extension payload"

printf 'manual change after build\n' >>"$SUPER/vscode/package-lock.json"
expect_failure "embedded build provenance does not match" \
  node "$SCRIPT_DIR/build-provenance.mjs" \
    --verify --repo "$SUPER" --target darwin-arm64 --app "$APP"
git -C "$SUPER/vscode" restore package-lock.json
echo "PASS: build provenance binds the actual derived VS Code state"

printf '{"ritemarkVersion":"changed"}\n' >"$SUPER/branding/product.json"
expect_failure "embedded build provenance does not match" \
  node "$SCRIPT_DIR/build-provenance.mjs" \
    --verify --repo "$SUPER" --target darwin-arm64 --app "$APP"

if ! grep -Fq 'codesign --verify --deep --strict "$APP_PATH"' "$SCRIPT_DIR/create-dmg.sh"; then
  echo "FAIL: DMG creator does not enforce the post-sign app integrity boundary" >&2
  exit 1
fi
echo "PASS: DMG packaging requires a valid deep app signature"

echo "Release source integrity tests passed"
