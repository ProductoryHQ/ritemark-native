#!/bin/bash
set -euo pipefail

# Sprint 129 W8 stage B: package this branch's extension for a test inside an
# INSTALLED Windows Ritemark, without touching the installed app.
#
# build-windows.yml builds only the exact main commit, so a sprint branch cannot
# produce a Windows installer. This zip holds what differs on the branch:
# compiled out/, the webview bundles, package.json with a test version (higher
# than any release, so it wins over the built-in copy), and the Windows whisper
# engine. scripts/qa/windows-branch-test.ps1 lays it over a copy of the installed
# extension and starts the installed Ritemark with that copy and a fresh profile.
#
# Usage: scripts/qa/make-windows-test-overlay.sh [--out DIR]   (default: dist/qa)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
EXT="$ROOT/extensions/ritemark"
OUT="$ROOT/dist/qa"
[[ "${1:-}" == "--out" ]] && OUT="$2"

SHA="$(git -C "$ROOT" rev-parse --short HEAD)"
if [[ -n "$(git -C "$ROOT" status --porcelain -- extensions/ritemark/src extensions/ritemark/webview/src)" ]]; then
  echo "Note: uncommitted source changes are included; the zip is named after $SHA plus 'dirty'."
  SHA="$SHA-dirty"
fi

echo "Compiling the extension and building the webview bundles..."
(cd "$EXT" && npm run compile >/dev/null)
(cd "$EXT/webview" && npm run build >/dev/null)

STAGE="$(mktemp -d "${TMPDIR:-/tmp}/rm-overlay.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/media" "$STAGE/binaries"
cp -R "$EXT/out" "$STAGE/out"
cp "$EXT/media/webview.js" "$EXT/media/office-preview.js" "$STAGE/media/"
cp -R "$EXT/binaries/win32-x64" "$STAGE/binaries/win32-x64"
cp "$EXT/binaries/whisper-manifest.json" "$STAGE/binaries/"
# 1.99.x sorts above every release, so VS Code picks this copy over the built-in one.
node -e '
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
pkg.version = "1.99." + Math.floor(Date.now() / 1000);
fs.writeFileSync(process.argv[2], JSON.stringify(pkg, null, 2) + "\n");
console.log("Test version " + pkg.version);
' "$EXT/package.json" "$STAGE/package.json"

mkdir -p "$OUT"
ZIP="$OUT/ritemark-windows-test-overlay-$SHA.zip"
rm -f "$ZIP"
(cd "$STAGE" && zip -qr "$ZIP" .)
echo "Done: $ZIP ($(du -h "$ZIP" | cut -f1))"
echo "On Windows: powershell -ExecutionPolicy Bypass -File windows-branch-test.ps1 -Overlay <that zip>"
