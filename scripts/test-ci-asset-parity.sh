#!/usr/bin/env bash
#
# test-ci-asset-parity.sh - Simulate the CI patch/apply asset path flow locally.
#
# Purpose:
# - catch missing asset copies that only show up on remote vanilla VS Code builds
# - verify patched CSS file references resolve after apply-patches.sh runs
#
# This intentionally simulates CI layout where extension deps exist inside
# vscode/extensions/ritemark, while repo-root extension node_modules may not.
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
# The VS Code release Ritemark builds on: the version in package.json at the committed submodule pin (Sprint 135; this was
# a fixed "1.117.0" that a VS Code update had to remember, and E5 after the 1.142 update found it stale)
VSCODE_PIN=$(git -C "$PROJECT_ROOT" ls-tree HEAD vscode 2>/dev/null | awk '{print $3}')
VSCODE_TAG=$(git -C "$PROJECT_ROOT/vscode" show "$VSCODE_PIN:package.json" 2>/dev/null | sed -n 's/^  "version": "\([^"]*\)".*/\1/p' | head -1)
if [ -z "$VSCODE_TAG" ] && [ -f "$PROJECT_ROOT/vscode/package.json" ]; then
  VSCODE_TAG=$(sed -n 's/^  "version": "\([^"]*\)".*/\1/p' "$PROJECT_ROOT/vscode/package.json" | head -1)
fi
VANILLA_CACHE="/tmp/vscode-vanilla-$VSCODE_TAG"
TMP_ROOT="$(mktemp -d /tmp/ritemark-ci-assets.XXXXXX)"
trap 'rm -rf "$TMP_ROOT"' EXIT

echo "Simulating CI asset parity..."

if [ ! -d "$VANILLA_CACHE/.git" ]; then
  echo "ERROR: Missing cached vanilla VS Code at $VANILLA_CACHE"
  echo "Run ./scripts/release-preflight.sh once first."
  exit 1
fi

mkdir -p "$TMP_ROOT/scripts" "$TMP_ROOT/patches" "$TMP_ROOT/branding" "$TMP_ROOT/extensions/ritemark/webview/src/assets/fonts"
git -C "$TMP_ROOT" init -q
git -C "$TMP_ROOT" config user.email "ci-asset-parity@ritemark.invalid"
git -C "$TMP_ROOT" config user.name "Ritemark CI Asset Parity"
git -C "$TMP_ROOT" commit --allow-empty -qm "Initialize CI asset parity fixture"

cp "$PROJECT_ROOT/scripts/apply-patches.sh" "$TMP_ROOT/scripts/"
cp "$PROJECT_ROOT/scripts/vscode-derived-state.mjs" "$TMP_ROOT/scripts/"
cp -R "$PROJECT_ROOT/patches/vscode" "$TMP_ROOT/patches/"
cp "$PROJECT_ROOT/branding/product.json" "$TMP_ROOT/branding/"

cp "$PROJECT_ROOT/extensions/ritemark/webview/src/assets/fonts/SofiaSans-latin.woff2" \
   "$TMP_ROOT/extensions/ritemark/webview/src/assets/fonts/"
cp "$PROJECT_ROOT/extensions/ritemark/webview/src/assets/fonts/SofiaSans-latin-ext.woff2" \
   "$TMP_ROOT/extensions/ritemark/webview/src/assets/fonts/"

cp -R "$VANILLA_CACHE" "$TMP_ROOT/vscode"
git -C "$TMP_ROOT/vscode" checkout -f . >/dev/null 2>&1
git -C "$TMP_ROOT/vscode" clean -fd >/dev/null 2>&1

# Match CI: VS Code dependencies provide codicon.ttf, while a previous compile
# may already have copied it beside codicon.css. Fresh release worktrees must
# support the former path and reused developer trees may use the latter.
CODICON_SOURCE="$PROJECT_ROOT/vscode/src/vs/base/browser/ui/codicons/codicon/codicon.ttf"
if [ ! -f "$CODICON_SOURCE" ]; then
  CODICON_SOURCE="$PROJECT_ROOT/vscode/node_modules/@vscode/codicons/dist/codicon.ttf"
fi
if [ ! -f "$CODICON_SOURCE" ]; then
  echo "ERROR: Missing codicon.ttf from VS Code's materialized dependencies"
  echo "Run npm ci in $PROJECT_ROOT/vscode before the asset parity check."
  exit 1
fi
mkdir -p "$TMP_ROOT/vscode/src/vs/base/browser/ui/codicons/codicon"
cp "$CODICON_SOURCE" "$TMP_ROOT/vscode/src/vs/base/browser/ui/codicons/codicon/codicon.ttf"

# Simulate CI: extension deps live inside vscode/extensions/ritemark, not repo root.
mkdir -p "$TMP_ROOT/vscode/extensions/ritemark/node_modules/@phosphor-icons/web/src/regular"
cp "$PROJECT_ROOT/extensions/ritemark/node_modules/@phosphor-icons/web/src/regular/Phosphor.woff2" \
   "$TMP_ROOT/vscode/extensions/ritemark/node_modules/@phosphor-icons/web/src/regular/"

(cd "$TMP_ROOT" && bash ./scripts/apply-patches.sh >/dev/null)

for path in \
  "$TMP_ROOT/vscode/src/vs/workbench/browser/media/fonts/SofiaSans-latin.woff2" \
  "$TMP_ROOT/vscode/src/vs/workbench/browser/media/fonts/SofiaSans-latin-ext.woff2" \
  "$TMP_ROOT/vscode/src/vs/base/browser/ui/codicons/codicon/phosphor.woff2"
do
  if [ ! -f "$path" ]; then
    echo "ERROR: Missing expected asset: $path"
    exit 1
  fi
done

ESBUILD_BIN="$PROJECT_ROOT/extensions/ritemark/node_modules/.bin/esbuild"
if [ ! -x "$ESBUILD_BIN" ]; then
  echo "ERROR: esbuild not found at $ESBUILD_BIN"
  exit 1
fi

run_css_bundle_check() {
  local input_css="$1"
  local output_css="$2"

  "$ESBUILD_BIN" "$input_css" \
    --bundle \
    --loader:.woff2=file \
    --loader:.ttf=file \
    --outfile="$output_css" \
    >/dev/null
}

run_css_bundle_check \
  "$TMP_ROOT/vscode/src/vs/workbench/browser/media/style.css" \
  "$TMP_ROOT/style.bundle.css"

run_css_bundle_check \
  "$TMP_ROOT/vscode/src/vs/base/browser/ui/codicons/codicon/codicon.css" \
  "$TMP_ROOT/codicon.bundle.css"

echo "CI asset parity OK"
