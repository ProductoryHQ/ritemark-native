#!/bin/bash
set -euo pipefail

# Sprint 129 W8 stage B: package this branch's extension for a test inside an
# INSTALLED Windows Ritemark, without touching the installed app.
#
# build-windows.yml builds only the exact main commit, so a sprint branch cannot
# produce a Windows installer. This zip holds what differs on the branch:
# compiled out/, the webview bundles, the media icons, the welcome's media and the
# sample project (Sprint 133), Home's tab icons and the icon themes (Sprint 134), package.json with a test version (higher than any
# release, so it wins over the built-in copy), and the Windows whisper engine. scripts/qa/windows-branch-test.ps1 lays it over a copy of the installed
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
# The view and tab icons (44 KB): a branch that adds a view container or panel
# icon (Sprint 130's Tasks) shows it only if the icon file comes along.
cp "$EXT"/media/*.svg "$STAGE/media/"
# Sprint 133: the welcome's header picture, logo and font, and the sample project
# (with its .ritemark/tasks). An extension release would not ship either, and
# without them the welcome's header and Try the sample project fail.
cp -R "$EXT/media/welcome" "$STAGE/media/welcome"
# Sprint 134: Home's tab icons, and the two icon themes (About this project's
# book on AGENTS.md; the heads' Record, Transcribe a file…, About this project
# and Open in a new window glyphs). Without them those tabs and rows show no icon.
cp -R "$EXT/media/home" "$STAGE/media/home"
cp -R "$EXT/fileicons" "$STAGE/fileicons"
cp -R "$EXT/producticons" "$STAGE/producticons"
cp -R "$EXT/sample-project" "$STAGE/sample-project"
cp -R "$EXT/binaries/win32-x64" "$STAGE/binaries/win32-x64"
cp "$EXT/binaries/whisper-manifest.json" "$STAGE/binaries/"
# 99.0.x sorts above every release (1.99.x stopped doing so at 2.0, and VS Code then kept the built-in copy
# without a word, Sprint 145), so VS Code picks this copy over the built-in one.
node -e '
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
pkg.version = "99.0." + Math.floor(Date.now() / 1000);
fs.writeFileSync(process.argv[2], JSON.stringify(pkg, null, 2) + "\n");
console.log("Test version " + pkg.version);
' "$EXT/package.json" "$STAGE/package.json"

mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"  # zip runs inside the staging folder, so the path must be absolute
ZIP="$OUT/ritemark-windows-test-overlay-$SHA.zip"
rm -f "$ZIP"
if command -v zip >/dev/null 2>&1; then
  (cd "$STAGE" && zip -qr "$ZIP" .)
else
  # Git Bash on Windows has no zip: PowerShell's Compress-Archive makes the same archive
  powershell.exe -NoProfile -Command "Compress-Archive -Path '$(cygpath -w "$STAGE")\*' -DestinationPath '$(cygpath -w "$ZIP")' -Force"
fi
echo "Done: $ZIP ($(du -h "$ZIP" | cut -f1))"
echo "On Windows: powershell -ExecutionPolicy Bypass -File windows-branch-test.ps1 -Overlay <that zip>"
