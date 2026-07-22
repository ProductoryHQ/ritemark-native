#!/bin/bash
#
# check-bundled-extension-complete.sh - Verify the BUNDLED extension inside a built
# app is runtime-complete.
#
# Sprint 98 (issue #142). The 1.8.3-ext.1 incident shipped an extension directory
# with no node_modules; the host threw `Cannot find module 'pdfkit'` at module load
# and the extension never activated, so none of the in-extension rescue paths could
# run. The copy-then-overlay installer now clones the BUNDLED copy and overlays the
# delta on top — which means the bundled copy is the floor of every future ext
# update. If it is incomplete, every ext update built on top of it is incomplete.
#
# This check therefore runs against the BUILT APP's copy, never the source tree
# (the source tree passes trivially because it has full node_modules). It belongs
# to the SHELL release, not to release-extension-preflight.sh.
#
# Usage:
#   ./scripts/check-bundled-extension-complete.sh [<bundled-extension-dir>]
#
# Default dir: VSCode-darwin-arm64/Ritemark.app/Contents/Resources/app/extensions/ritemark
# (the EXT_DEST that scripts/build-prod.sh produces).
#
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

EXT_DIR="${1:-$ROOT_DIR/VSCode-darwin-arm64/Ritemark.app/Contents/Resources/app/extensions/ritemark}"

ERRORS=0
fail() {
  echo -e "${RED}FAIL${NC}: $1"
  ERRORS=$((ERRORS + 1))
}
ok() {
  echo -e "${GREEN}OK${NC}: $1"
}

echo "========================================"
echo "Bundled Extension Completeness Check"
echo "========================================"
echo "Target: $EXT_DIR"
echo ""

if [[ ! -d "$EXT_DIR" ]]; then
  echo -e "${RED}FAIL${NC}: bundled extension dir does not exist: $EXT_DIR"
  echo "========================================"
  echo -e "${RED}BUNDLED EXTENSION CHECK FAILED${NC}"
  exit 1
fi

if [[ ! -f "$EXT_DIR/package.json" ]]; then
  echo -e "${RED}FAIL${NC}: $EXT_DIR/package.json missing — that is not an extension directory"
  echo "========================================"
  echo -e "${RED}BUNDLED EXTENSION CHECK FAILED${NC}"
  exit 1
fi

# -----------------------------------------------------------------------------
# Check 1: compiled host entry points exist
# -----------------------------------------------------------------------------
for entry in "out/extension.js" "out/browser/browserMcpAdapter.js"; do
  if [[ -s "$EXT_DIR/$entry" ]]; then
    ok "$entry present"
  else
    fail "$entry missing or empty in the bundled extension"
  fi
done

# -----------------------------------------------------------------------------
# Check 2: version floor applied (scripts/floor-bundled-extension.sh ran)
#
# The bundled copy must be X.Y.Z-0 so that an over-the-air X.Y.Z-ext.N wins
# VS Code's scanner comparison (extensionsUtil.ts:26 `semver.gte(builtin, user)`).
# If the floor step is ever skipped, EVERY future ext update silently stops
# loading — no error, the user copy is just never picked. One-line guard against
# a completely silent class of failure.
# -----------------------------------------------------------------------------
BUNDLED_VERSION=$(node -pe "require('$EXT_DIR/package.json').version" 2>/dev/null || true)
if [[ -z "$BUNDLED_VERSION" ]]; then
  fail "could not read version from $EXT_DIR/package.json"
elif [[ "$BUNDLED_VERSION" == *-0 ]]; then
  ok "bundled version floored ($BUNDLED_VERSION)"
else
  fail "bundled version '$BUNDLED_VERSION' is not floored to X.Y.Z-0 — scripts/floor-bundled-extension.sh did not run; every future ext update would silently fail to load"
fi

# -----------------------------------------------------------------------------
# Check 3: every esbuild `external` is actually installed
#
# Reads the REAL array exported from esbuild.config.mjs (Sprint 98 made it an
# export precisely so this cannot drift). `vscode` is provided by the extension
# host and has no node_modules copy — exempt.
# -----------------------------------------------------------------------------
ESBUILD_CONFIG="$ROOT_DIR/extensions/ritemark/esbuild.config.mjs"
EXTERNALS=$(node --input-type=module -e "
  const m = await import('file://$ESBUILD_CONFIG');
  if (!Array.isArray(m.external)) { throw new Error('esbuild.config.mjs does not export an \`external\` array'); }
  console.log(m.external.join('\n'));
" 2>/dev/null || true)

if [[ -z "$EXTERNALS" ]]; then
  fail "could not read the \`external\` array from $ESBUILD_CONFIG (is it still exported?)"
else
  MISSING_EXTERNALS=""
  for mod in $EXTERNALS; do
    if [[ "$mod" == "vscode" ]]; then
      continue
    fi
    if [[ ! -f "$EXT_DIR/node_modules/$mod/package.json" ]]; then
      MISSING_EXTERNALS="$MISSING_EXTERNALS $mod"
    fi
  done
  if [[ -n "$MISSING_EXTERNALS" ]]; then
    fail "esbuild external(s) missing from the bundled extension's node_modules:$MISSING_EXTERNALS"
    echo "  The extension host will throw at module load. A full (shell) release that"
    echo "  installs these dependencies into the bundled copy is required."
  else
    ok "all esbuild externals present in bundled node_modules"
  fi
fi

# -----------------------------------------------------------------------------
# Check 4: static-require sweep over the shipped bundle
#
# Catches BOTH failure shapes Check 3 cannot see:
#   - a module added to `external` but never installed (also caught above), and
#   - a module never added to `external` at all that still ends up as a literal
#     require in the emitted bundle (esbuild leaves unresolvable requires alone).
# Every non-builtin survivor must resolve under the bundled node_modules.
# -----------------------------------------------------------------------------
BUILTINS=$(node -pe "require('module').builtinModules.join('\n')")

REQUIRED_MODULES=$(grep -oE 'require\("([^".][^"]*)"\)' "$EXT_DIR/out/extension.js" 2>/dev/null \
  | sed -E 's/^.*require\("//; s/"\)$//' \
  | sort -u || true)

MISSING_REQUIRES=""
for mod in $REQUIRED_MODULES; do
  # Strip a node: prefix, then reduce to the package root (@scope/name or name).
  bare="${mod#node:}"
  if [[ "$bare" == @* ]]; then
    root=$(echo "$bare" | cut -d/ -f1-2)
  else
    root=$(echo "$bare" | cut -d/ -f1)
  fi

  # Node built-in (with or without the node: prefix)?
  if echo "$BUILTINS" | grep -qxF "$bare" || echo "$BUILTINS" | grep -qxF "$root"; then
    continue
  fi
  # Host-provided.
  if [[ "$root" == "vscode" ]]; then
    continue
  fi

  if [[ ! -f "$EXT_DIR/node_modules/$root/package.json" ]]; then
    MISSING_REQUIRES="$MISSING_REQUIRES $root"
  fi
done

if [[ -n "$MISSING_REQUIRES" ]]; then
  fail "out/extension.js statically requires module(s) not present in the bundled node_modules:$MISSING_REQUIRES"
  echo "  A shipped extension that cannot resolve a static require dies at MODULE LOAD,"
  echo "  before activate() — exactly the 1.8.3-ext.1 failure mode. Full release required."
else
  ok "every non-builtin static require in out/extension.js resolves under node_modules/"
fi

# -----------------------------------------------------------------------------
# Check 5: sentinel runtime assets present and non-empty
#
# Same sentinel style as release-extension-preflight.sh Check 5: don't try to
# enumerate everything, assert the asset families the incident proved are load
# bearing but invisible to a JS-only file list.
# -----------------------------------------------------------------------------
count_glob() {
  # $1 = directory, $2 = find predicate pattern
  find "$1" -maxdepth 1 -type f -name "$2" 2>/dev/null | wc -l | tr -d ' '
}

THEME_COUNT=$(count_glob "$EXT_DIR/themes" '*.json')
if [[ "$THEME_COUNT" -gt 0 ]]; then
  ok "themes/ contains $THEME_COUNT .json theme(s)"
else
  fail "themes/*.json missing from the bundled extension"
fi

SVG_COUNT=$(count_glob "$EXT_DIR/media" '*.svg')
if [[ "$SVG_COUNT" -gt 0 ]]; then
  ok "media/ contains $SVG_COUNT .svg asset(s)"
else
  fail "media/*.svg missing from the bundled extension"
fi

STARTER_COUNT=$(find "$EXT_DIR/starter-pack" -mindepth 1 2>/dev/null | wc -l | tr -d ' ')
if [[ "$STARTER_COUNT" -gt 0 ]]; then
  ok "starter-pack/ non-empty ($STARTER_COUNT entries)"
else
  fail "starter-pack/ missing or empty in the bundled extension"
fi

WEBVIEW_JS="$EXT_DIR/media/webview.js"
if [[ ! -f "$WEBVIEW_JS" ]]; then
  fail "media/webview.js missing from the bundled extension"
elif ! grep -q "ai-sidebar" "$WEBVIEW_JS"; then
  fail "media/webview.js missing the ai-sidebar sentinel (stale or stubbed bundle)"
else
  ok "media/webview.js present with ai-sidebar sentinel"
fi

echo ""
echo "========================================"
if [[ $ERRORS -gt 0 ]]; then
  echo -e "${RED}BUNDLED EXTENSION CHECK FAILED: $ERRORS error(s)${NC}"
  echo "========================================"
  exit 1
fi
echo -e "${GREEN}BUNDLED EXTENSION CHECK PASSED${NC}"
echo "========================================"
exit 0
