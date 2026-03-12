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
VSCODE_TAG="1.109.5"
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
cp "$PROJECT_ROOT/scripts/apply-patches.sh" "$TMP_ROOT/scripts/"
cp -R "$PROJECT_ROOT/patches/vscode" "$TMP_ROOT/patches/"
cp "$PROJECT_ROOT/branding/product.json" "$TMP_ROOT/branding/"

if [ -d "$PROJECT_ROOT/branding/welcome" ]; then
  cp -R "$PROJECT_ROOT/branding/welcome" "$TMP_ROOT/branding/"
fi

cp "$PROJECT_ROOT/extensions/ritemark/webview/src/assets/fonts/SofiaSans-latin.woff2" \
   "$TMP_ROOT/extensions/ritemark/webview/src/assets/fonts/"
cp "$PROJECT_ROOT/extensions/ritemark/webview/src/assets/fonts/SofiaSans-latin-ext.woff2" \
   "$TMP_ROOT/extensions/ritemark/webview/src/assets/fonts/"

cp -R "$VANILLA_CACHE" "$TMP_ROOT/vscode"

# Match CI more closely: VS Code deps/install ensures codicon.ttf is present.
if [ -f "$PROJECT_ROOT/vscode/src/vs/base/browser/ui/codicons/codicon/codicon.ttf" ]; then
  mkdir -p "$TMP_ROOT/vscode/src/vs/base/browser/ui/codicons/codicon"
  cp "$PROJECT_ROOT/vscode/src/vs/base/browser/ui/codicons/codicon/codicon.ttf" \
     "$TMP_ROOT/vscode/src/vs/base/browser/ui/codicons/codicon/"
fi

# Simulate CI: extension deps live inside vscode/extensions/ritemark, not repo root.
mkdir -p "$TMP_ROOT/vscode/extensions/ritemark/node_modules/lucide-static/font"
cp "$PROJECT_ROOT/extensions/ritemark/node_modules/lucide-static/font/lucide.woff2" \
   "$TMP_ROOT/vscode/extensions/ritemark/node_modules/lucide-static/font/"

(cd "$TMP_ROOT" && bash ./scripts/apply-patches.sh >/dev/null)

for path in \
  "$TMP_ROOT/vscode/src/vs/workbench/browser/media/fonts/SofiaSans-latin.woff2" \
  "$TMP_ROOT/vscode/src/vs/workbench/browser/media/fonts/SofiaSans-latin-ext.woff2" \
  "$TMP_ROOT/vscode/src/vs/base/browser/ui/codicons/codicon/lucide.woff2"
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
