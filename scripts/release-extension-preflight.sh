#!/bin/bash
#
# release-extension-preflight.sh - Gate checks before an extension-only release
#
# Run before scripts/release-extension.sh ever touches the filesystem. Fails
# fast (non-zero exit) with a named reason on ANY check failure.
#
# Usage:
#   ./scripts/release-extension-preflight.sh [--ref <git-ref>] [--allow-unshipped]
#
# --ref sets the base for the release-tier and unshipped-changes diffs
# (default: the latest vX.Y.Z shell-release tag reachable from HEAD, falling
# back to HEAD~50 if no tag exists yet).
#
# --allow-unshipped turns Check 6 into a warning: the release goes out without
# the changes it lists, which then wait for the next shell release. Pass it only
# after Jarmo has agreed to that.
#
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

REF=""
ALLOW_UNSHIPPED=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref) REF="$2"; shift 2 ;;
    --allow-unshipped) ALLOW_UNSHIPPED=true; shift ;;
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
warn() {
  echo -e "${YELLOW}WARN${NC}: $1"
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
  ".github/workflows/build-"
  "scripts/build-prod.sh"
  "scripts/build-prod-windows.sh"
  "scripts/google-oauth-release-env.sh"
  "scripts/build-provenance.mjs"
  "scripts/tree-sha256.mjs"
  "scripts/stage-extension-for-shell-build.sh"
  "scripts/extract-macos-x64-artifact.sh"
  "scripts/codesign-app.sh"
  "scripts/create-dmg.sh"
  "scripts/create-release-worktree.sh"
  "scripts/apply-patches.sh"
  "scripts/release-preflight.sh"
  "scripts/verify-release-source.sh"
  "scripts/worktree-hygiene.mjs"
  "scripts/vscode-derived-state.mjs"
  "scripts/validate-build-output.sh"
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
  # An entry matches a changed path that STARTS with it: a file, a folder
  # (trailing /) or a filename prefix (.github/workflows/build-). A substring
  # match used to flag any path merely containing an entry, such as `vscode` in
  # extensions/ritemark/src/googleDocs/vscodeGoogleDocs.ts. --no-renames lists a
  # shell-tier file that moved away under its old path too; quotepath=off keeps
  # non-ASCII paths unquoted so they compare as written.
  CHANGED_FILES=$(git -c core.quotepath=off diff --name-only --no-renames "$REF"..HEAD)
  TIER_VIOLATION=""
  while IFS= read -r file; do
    for entry in "${SHELL_TIER_PATHS[@]}"; do
      if [[ "$file" == "$entry"* ]]; then
        TIER_VIOLATION="${TIER_VIOLATION}${file}\n"
        break
      fi
    done
  done <<< "$CHANGED_FILES"
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

# Sprint 124: the Office preview (Word) is its own bundle, and ships alongside.
OFFICE_JS="extensions/ritemark/media/office-preview.js"
OFFICE_SIZE=$(file_size "$OFFICE_JS")
if [[ ! -f "$OFFICE_JS" ]]; then
  fail "$OFFICE_JS does not exist — run: cd extensions/ritemark/webview && npm run build"
elif [[ $OFFICE_SIZE -lt 200000 ]]; then
  fail "$OFFICE_JS too small (${OFFICE_SIZE} bytes, need >200KB) — stale or stubbed build"
elif ! grep -q "ritemark-docx" "$OFFICE_JS"; then
  fail "$OFFICE_JS missing the Word viewer (ritemark-docx) — stale or stubbed build"
else
  ok "office-preview.js present (${OFFICE_SIZE} bytes), contains the Word viewer"
fi

# -----------------------------------------------------------------------------
# Check 6: changes an extension release cannot deliver
#
# Extension-tier by path does not mean an extension release carries it. The
# release ships out/**/*.js plus a few files, laid over the app's bundled
# extension; any other change under extensions/ritemark/ since $REF (icons,
# fonts, themes, the starter pack, a package loaded from node_modules) reaches
# users only with the next shell release. Last, so the list sits right above
# the summary. The rules live in scripts/list-unshipped-extension-changes.mjs.
# -----------------------------------------------------------------------------
UNSHIPPED_LOG=/tmp/release-extension-preflight-unshipped.log
UNSHIPPED_COUNT=0
if UNSHIPPED=$(node scripts/list-unshipped-extension-changes.mjs --ref "$REF" 2>"$UNSHIPPED_LOG"); then
  UNSHIPPED_COUNT=$(echo "$UNSHIPPED" | sed '/^$/d' | wc -l | tr -d ' ')
  if [[ $UNSHIPPED_COUNT -eq 0 ]]; then
    ok "every extension change since $REF ships in an extension release"
  elif [[ "$ALLOW_UNSHIPPED" == true ]]; then
    warn "$UNSHIPPED_COUNT change(s) since $REF are NOT in this extension release (--allow-unshipped); they ship with the next shell release:"
    echo "$UNSHIPPED" | sed 's/^/  /'
  else
    fail "$UNSHIPPED_COUNT change(s) since $REF cannot reach users through an extension release; they ship with the next shell release:"
    echo "$UNSHIPPED" | sed 's/^/  /'
    echo "  Deliver them: make this a shell release."
    echo "  Release without them (only with Jarmo's OK): re-run with --allow-unshipped."
  fi
else
  fail "could not list the changes an extension release cannot deliver:"
  sed '/^$/d; s/^/  /' "$UNSHIPPED_LOG"
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
if [[ $UNSHIPPED_COUNT -gt 0 ]]; then
  echo -e "${YELLOW}...without the $UNSHIPPED_COUNT change(s) in the WARN above (--allow-unshipped)${NC}"
fi
echo "========================================"
exit 0
