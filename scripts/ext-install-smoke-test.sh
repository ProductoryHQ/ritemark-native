#!/bin/bash
#
# ext-install-smoke-test.sh - Blocking pre-publish gate for extension-only releases.
#
# Sprint 98 (issue #142). This is the single check that would have caught the
# 1.8.3-ext.1 incident: the release shipped a 4-file delta, the installer wrote
# ONLY those files, and the extension threw `Cannot find module 'pdfkit'` at
# MODULE LOAD — before activate(), so every in-extension rescue path was dead too.
#
# What it does, in the same order the shipped installer does it
# (src/update/userExtensionInstaller.ts applyUpdate):
#   1. clone the BUNDLED (built-in) extension of the locally installed prod app,
#   2. overlay the staged manifest delta on top (honouring op: 'delete'),
#   3. prove the result LOADS — require() out/extension.js in a bare Node process
#      with a `vscode` stub (scripts/lib/vscode-stub.js).
#
# activate() is deliberately NOT called: module load is precisely where the
# incident died, and calling activate() would start real services.
#
# Side-effect free: everything happens in a mktemp -d that a trap removes on any
# exit path. It never writes to ~/.ritemark/ and never modifies the installed app.
#
# Usage:
#   ./scripts/ext-install-smoke-test.sh [--staged <dir>] [--bundled <dir>] [--skip-clone]
#
#   --staged      staged upload dir containing update-manifest.json + assets
#                 (default: release-staging/upload)
#   --bundled     bundled extension dir of the installed production app
#                 (default: /Applications/Ritemark.app/Contents/Resources/app/extensions/ritemark)
#   --skip-clone  overlay onto an EMPTY dir instead of a clone — reproduces the
#                 1.8.3-ext.1 delta-only failure mode. Expected to FAIL; used to
#                 prove this gate actually catches the incident.
#
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

STAGED_DIR="$ROOT_DIR/release-staging/upload"
BUNDLED_DIR="/Applications/Ritemark.app/Contents/Resources/app/extensions/ritemark"
SKIP_CLONE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --staged) STAGED_DIR="$2"; shift 2 ;;
    --bundled) BUNDLED_DIR="$2"; shift 2 ;;
    --skip-clone) SKIP_CLONE=true; shift ;;
    -h|--help) sed -n '2,40p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo -e "${RED}Unknown argument: $1${NC}"; exit 1 ;;
  esac
done

fail() {
  echo -e "${RED}SMOKE TEST FAILED${NC}: $1"
  exit 1
}
ok() {
  echo -e "${GREEN}OK${NC}: $1"
}

echo "========================================"
echo "Extension Install-and-Activate Smoke Test"
echo "========================================"
echo "Staged:  $STAGED_DIR"
echo "Bundled: $BUNDLED_DIR"
echo ""

MANIFEST="$STAGED_DIR/update-manifest.json"
[[ -d "$STAGED_DIR" ]] || fail "staged dir does not exist: $STAGED_DIR"
[[ -f "$MANIFEST" ]] || fail "no update-manifest.json in $STAGED_DIR"
[[ -d "$BUNDLED_DIR" ]] || fail "bundled extension dir does not exist: $BUNDLED_DIR (install the production app first)"
[[ -f "$BUNDLED_DIR/package.json" ]] || fail "$BUNDLED_DIR is not an extension directory (no package.json)"
[[ -f "$SCRIPT_DIR/lib/vscode-stub.js" ]] || fail "missing scripts/lib/vscode-stub.js"

# -----------------------------------------------------------------------------
# Scratch dir — removed on EVERY exit path (success, failure, interrupt).
# -----------------------------------------------------------------------------
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/ritemark-ext-smoke.XXXXXX")"
cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT INT TERM
TARGET="$WORK_DIR/ritemark"

# -----------------------------------------------------------------------------
# Step 1: clone the bundled extension (what applyUpdate does before overlaying)
# -----------------------------------------------------------------------------
if [[ "$SKIP_CLONE" == "true" ]]; then
  echo -e "${YELLOW}--skip-clone: overlaying onto an EMPTY dir (1.8.3-ext.1 reproduction)${NC}"
  mkdir -p "$TARGET"
else
  echo "Cloning bundled extension..."
  # macOS `cp -c` clones on APFS and automatically falls back to copyfile(2)
  # elsewhere, so no explicit fallback branch is needed (Sprint 98 Phase 1).
  if ! cp -c -R "$BUNDLED_DIR" "$TARGET" 2>/dev/null; then
    cp -R "$BUNDLED_DIR" "$TARGET" || fail "could not clone $BUNDLED_DIR"
  fi
  ok "bundled extension cloned"
fi

# -----------------------------------------------------------------------------
# Step 2: overlay the staged delta
# -----------------------------------------------------------------------------
ENTRIES=$(node -e '
  const fs = require("fs");
  const path = require("path");
  const manifest = JSON.parse(fs.readFileSync(process.argv[1], "utf-8"));
  for (const file of manifest.files || []) {
    const op = file.op || "write";
    const asset = file.url ? path.basename(new URL(file.url).pathname) : "";
    process.stdout.write([op, file.path, asset, file.sha256 || ""].join("\t") + "\n");
  }
' "$MANIFEST") || fail "could not parse $MANIFEST"

[[ -n "$ENTRIES" ]] || fail "manifest lists no files"

WRITE_COUNT=0
DELETE_COUNT=0
while IFS=$'\t' read -r OP REL_PATH ASSET SHA; do
  [[ -n "$REL_PATH" ]] || continue

  # Containment: mirror the installer's resolveInStaging / isContainedRelativePath.
  case "$REL_PATH" in
    /*|*..*) fail "manifest path escapes the extension directory: $REL_PATH" ;;
  esac

  DEST="$TARGET/$REL_PATH"

  if [[ "$OP" == "delete" ]]; then
    rm -rf "$DEST"
    DELETE_COUNT=$((DELETE_COUNT + 1))
    continue
  fi

  SRC="$STAGED_DIR/$ASSET"
  [[ -n "$ASSET" ]] || fail "manifest entry '$REL_PATH' has no url to derive an asset name from"
  [[ -f "$SRC" ]] || fail "manifest entry '$REL_PATH' references staged asset '$ASSET' which is not in $STAGED_DIR"

  if [[ -n "$SHA" ]]; then
    ACTUAL=$(shasum -a 256 "$SRC" | cut -d' ' -f1)
    if [[ "$ACTUAL" != "$SHA" ]]; then
      fail "checksum mismatch for '$REL_PATH' (asset $ASSET): manifest $SHA, actual $ACTUAL"
    fi
  fi

  mkdir -p "$(dirname "$DEST")"
  cp "$SRC" "$DEST"
  WRITE_COUNT=$((WRITE_COUNT + 1))
done <<< "$ENTRIES"

ok "delta overlaid ($WRITE_COUNT written, $DELETE_COUNT deleted)"

# -----------------------------------------------------------------------------
# Step 3: prove the result loads
# -----------------------------------------------------------------------------
ENTRY="$TARGET/out/extension.js"
[[ -f "$ENTRY" ]] || fail "no out/extension.js in the resulting extension directory"

echo "Loading out/extension.js in a bare Node process..."
LOAD_LOG="$WORK_DIR/load.log"
if node -e '
  const Module = require("module");
  const stub = require(process.argv[2]);
  const originalResolve = Module._resolveFilename.bind(Module);
  Module._resolveFilename = function (request, ...rest) {
    if (request === "vscode") { return "__vscode_stub__"; }
    return originalResolve(request, ...rest);
  };
  require.cache["__vscode_stub__"] = {
    id: "__vscode_stub__", filename: "__vscode_stub__", loaded: true,
    children: [], paths: [], exports: stub
  };
  const mod = require(process.argv[1]);
  if (typeof mod.activate !== "function") {
    throw new Error("extension.js loaded but exports no activate() function");
  }
  console.log("extension.js loaded; activate() exported");
' "$ENTRY" "$SCRIPT_DIR/lib/vscode-stub.js" >"$LOAD_LOG" 2>&1; then
  ok "$(cat "$LOAD_LOG")"
else
  echo ""
  echo -e "${RED}--- module load output ---${NC}"
  sed 's/^/  /' "$LOAD_LOG"
  echo -e "${RED}--------------------------${NC}"
  echo ""
  fail "the installed extension does not load — publishing is blocked. This is the 1.8.3-ext.1 failure class: the host throws before activate(), so the in-app updater cannot rescue affected users."
fi

echo ""
echo "========================================"
echo -e "${GREEN}SMOKE TEST PASSED${NC}"
echo "========================================"
exit 0
