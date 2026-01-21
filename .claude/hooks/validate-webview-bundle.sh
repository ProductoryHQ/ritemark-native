#!/bin/bash
# =============================================================================
# Webview Bundle Validation Hook
# =============================================================================
# Ensures webview.js bundle is up-to-date with source files before commit.
# Prevents committing stale bundles that don't reflect source changes.
#
# Usage: Called automatically by Claude Code pre-commit hook
# Exit 0 = OK, Exit 1 = Block commit
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Paths (relative to project root)
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"
WEBVIEW_SRC="$PROJECT_DIR/extensions/ritemark/webview/src"
WEBVIEW_BUNDLE="$PROJECT_DIR/extensions/ritemark/media/webview.js"

# Check if webview source directory exists
if [[ ! -d "$WEBVIEW_SRC" ]]; then
  # No webview source, nothing to validate
  exit 0
fi

# Check if bundle exists
if [[ ! -f "$WEBVIEW_BUNDLE" ]]; then
  echo -e "${RED}ERROR: webview.js bundle not found!${NC}"
  echo "Run: cd extensions/ritemark/webview && npm run build"
  exit 1
fi

# Get staged webview source files
STAGED_WEBVIEW_FILES=$(git diff --cached --name-only -- "$WEBVIEW_SRC" 2>/dev/null || true)

if [[ -z "$STAGED_WEBVIEW_FILES" ]]; then
  # No webview source files staged, nothing to validate
  exit 0
fi

# Check if webview.js is also staged
STAGED_BUNDLE=$(git diff --cached --name-only -- "$WEBVIEW_BUNDLE" 2>/dev/null || true)

if [[ -z "$STAGED_BUNDLE" ]]; then
  echo -e "${RED}ERROR: Webview source files changed but bundle not updated!${NC}"
  echo ""
  echo "Changed source files:"
  echo "$STAGED_WEBVIEW_FILES" | sed 's/^/  /'
  echo ""
  echo -e "${YELLOW}Fix: Rebuild webview before committing:${NC}"
  echo "  cd extensions/ritemark/webview && npm run build"
  echo "  git add extensions/ritemark/media/webview.js"
  exit 1
fi

# Verify bundle contains expected components by checking for key markers
# These are CSS class names that should be in the bundle
REQUIRED_MARKERS=(
  "document-header"
  "header-btn"
)

# Optional markers - warn if missing but don't block
OPTIONAL_MARKERS=(
  "dictation-split-btn"
  "dictation-settings"
)

MISSING_REQUIRED=()
MISSING_OPTIONAL=()

for marker in "${REQUIRED_MARKERS[@]}"; do
  if ! grep -q "$marker" "$WEBVIEW_BUNDLE"; then
    MISSING_REQUIRED+=("$marker")
  fi
done

for marker in "${OPTIONAL_MARKERS[@]}"; do
  if ! grep -q "$marker" "$WEBVIEW_BUNDLE"; then
    MISSING_OPTIONAL+=("$marker")
  fi
done

if [[ ${#MISSING_REQUIRED[@]} -gt 0 ]]; then
  echo -e "${RED}ERROR: Bundle missing required components!${NC}"
  echo "Missing: ${MISSING_REQUIRED[*]}"
  echo ""
  echo "This suggests the bundle is corrupted or incomplete."
  echo -e "${YELLOW}Fix: Rebuild webview:${NC}"
  echo "  cd extensions/ritemark/webview && npm run build"
  exit 1
fi

if [[ ${#MISSING_OPTIONAL[@]} -gt 0 ]]; then
  echo -e "${YELLOW}WARNING: Bundle missing optional components:${NC}"
  echo "Missing: ${MISSING_OPTIONAL[*]}"
  echo ""
  echo "This may be intentional if these features are disabled."
fi

echo -e "${GREEN}Webview bundle validation passed${NC}"
exit 0
