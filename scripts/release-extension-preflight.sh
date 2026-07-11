#!/bin/bash
#
# release-extension-preflight.sh - Gate checks before an extension-only release
#
# Run before scripts/release-extension.sh ever touches the filesystem. Fails
# fast (non-zero exit) with a named reason on ANY check failure.
#
# Usage:
#   ./scripts/release-extension-preflight.sh [--ref <git-ref>]
#
# --ref sets the base for the release-tier diff (default: the latest vX.Y.Z
# shell-release tag reachable from HEAD, falling back to HEAD~50 if no tag
# exists yet).
#
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

REF=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref) REF="$2"; shift 2 ;;
    *) echo -e "${RED}Unknown argument: $1${NC}"; exit 1 ;;
  esac
done

ERRORS=0
fail() {
  echo -e "${RED}FAIL${NC}: $1"
  ERRORS=$((ERRORS + 1))
}
ok() {
  echo -e "${GREEN}OK${NC}: $1"
}

file_size() {
  stat -f%z "$1" 2>/dev/null || stat -c%s "$1" 2>/dev/null || echo 0
}

echo "========================================"
echo "Extension Release Preflight"
echo "========================================"
echo ""

# -----------------------------------------------------------------------------
# Check 1: clean git tree
# -----------------------------------------------------------------------------
if [[ -n "$(git status --porcelain)" ]]; then
  fail "working tree is not clean (git status --porcelain is non-empty)"
else
  ok "working tree clean"
fi

# -----------------------------------------------------------------------------
# Check 2: release-tier guard (R4)
#
# This denylist MUST be textually identical to CLAUDE.md's "Release tiers"
# section — copy-paste, never independently re-derived. If you're editing one,
# edit the other in the same commit.
# -----------------------------------------------------------------------------
SHELL_TIER_PATHS=(
  "patches/"
  "vscode"
  "branding/product.json"
  "extensions/ritemark/binaries/agents/"
  "scripts/build-prod.sh"
  "scripts/codesign-app.sh"
  "scripts/create-dmg.sh"
  "scripts/apply-patches.sh"
  "scripts/update-vscode.sh"
  "scripts/create-patch.sh"
  "installer/windows/ritemark.iss"
  "scripts/codesign-windows.sh"
)

if [[ -z "$REF" ]]; then
  # --merged HEAD matters: a stray/mistaken tag elsewhere in the repo's history
  # (not an ancestor of HEAD) can still sort "highest" by version number alone
  # and silently pick the wrong diff base. Only consider tags actually in HEAD's
  # ancestry.
  REF=$(git tag --list --merged HEAD 'v[0-9]*.[0-9]*.[0-9]*' --sort=-v:refname | head -1)
  if [[ -z "$REF" ]]; then
    REF="HEAD~50"
  fi
fi

if git rev-parse --verify "$REF" >/dev/null 2>&1; then
  CHANGED_FILES=$(git diff --name-only "$REF"..HEAD)
  TIER_VIOLATION=""
  for path in "${SHELL_TIER_PATHS[@]}"; do
    MATCH=$(echo "$CHANGED_FILES" | grep -F "$path" || true)
    if [[ -n "$MATCH" ]]; then
      TIER_VIOLATION="${TIER_VIOLATION}${MATCH}\n"
    fi
  done
  if [[ -n "$TIER_VIOLATION" ]]; then
    fail "shell-tier path(s) changed since $REF — this must ship as a shell release, not an extension release:"
    echo -e "$TIER_VIOLATION" | sed '/^$/d' | sed 's/^/  /'
  else
    ok "no shell-tier paths changed since $REF"
  fi
else
  fail "release-tier diff base '$REF' does not resolve to a valid git ref"
fi

# -----------------------------------------------------------------------------
# Check 3: engines.vscode floor vs shipped VS Code version (R5)
# -----------------------------------------------------------------------------
version_le() {
  # Portable numeric MAJOR.MINOR.PATCH compare — returns 0 (true) if $1 <= $2.
  local IFS=.
  local -a a=($1) b=($2)
  for i in 0 1 2; do
    local ai=${a[i]:-0} bi=${b[i]:-0}
    if (( ai < bi )); then return 0; fi
    if (( ai > bi )); then return 1; fi
  done
  return 0
}

ENGINES_RAW=$(node -pe "require('./extensions/ritemark/package.json').engines.vscode" 2>/dev/null || true)
ENGINES_FLOOR=$(echo "$ENGINES_RAW" | sed 's/^[^0-9]*//')
SHIPPED_VERSION=$(node -pe "require('./vscode/package.json').version" 2>/dev/null || true)

if [[ -z "$ENGINES_FLOOR" || -z "$SHIPPED_VERSION" ]]; then
  fail "could not read engines.vscode ('$ENGINES_RAW') or shipped VS Code version ('$SHIPPED_VERSION')"
elif version_le "$ENGINES_FLOOR" "$SHIPPED_VERSION"; then
  ok "engines.vscode floor $ENGINES_FLOOR <= shipped $SHIPPED_VERSION"
else
  fail "engines.vscode floor $ENGINES_FLOOR exceeds shipped VS Code $SHIPPED_VERSION — bump the shell first"
fi

# -----------------------------------------------------------------------------
# Check 4: extension compiles clean
# -----------------------------------------------------------------------------
if (cd extensions/ritemark && npm run compile --silent) >/tmp/release-extension-preflight-compile.log 2>&1; then
  ok "extension compiles clean"
else
  fail "extension compile failed — see /tmp/release-extension-preflight-compile.log"
  tail -20 /tmp/release-extension-preflight-compile.log | sed 's/^/  /'
fi

# -----------------------------------------------------------------------------
# Check 5: webview bundle present, fresh, not stubbed
# (same sentinel logic as .claude/hooks/pre-commit-validator.sh Check 2/6,
# adapted from "staged vs committed" to "built artifact is real" since a
# release preflight cares about the artifact on disk, not the git index)
# -----------------------------------------------------------------------------
WEBVIEW_JS="extensions/ritemark/media/webview.js"
WEBVIEW_SIZE=$(file_size "$WEBVIEW_JS")
if [[ ! -f "$WEBVIEW_JS" ]]; then
  fail "$WEBVIEW_JS does not exist — run: cd extensions/ritemark/webview && npm run build"
elif [[ $WEBVIEW_SIZE -lt 500000 ]]; then
  fail "$WEBVIEW_JS too small (${WEBVIEW_SIZE} bytes, need >500KB) — stale or stubbed build"
elif ! grep -q "ai-sidebar" "$WEBVIEW_JS"; then
  fail "$WEBVIEW_JS missing ai-sidebar routing key (bundle stale or AI panel removed)"
else
  ok "webview.js present, fresh (${WEBVIEW_SIZE} bytes), contains ai-sidebar sentinel"
fi

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo ""
echo "========================================"
if [[ $ERRORS -gt 0 ]]; then
  echo -e "${RED}PREFLIGHT FAILED: $ERRORS error(s)${NC}"
  echo "========================================"
  exit 1
fi
echo -e "${GREEN}PREFLIGHT PASSED${NC}"
echo "========================================"
exit 0
