#!/bin/bash
# =============================================================================
# RiteMark Native - Pre-Build Environment Validation
# =============================================================================
# Run this BEFORE starting a production build to catch issues early.
# A failed build wastes 25 minutes - this script fails in <30 seconds.
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "Pre-Build Environment Validation"
echo "========================================"
echo ""

ERRORS=0
WARNINGS=0

# -----------------------------------------------------------------------------
# Check 1: Node Version
# -----------------------------------------------------------------------------
echo -n "Checking Node version... "
REQUIRED_NODE="v20"
CURRENT_NODE=$(node -v 2>/dev/null || echo "not found")

if [[ $CURRENT_NODE == "not found" ]]; then
  echo -e "${RED}FAIL${NC}"
  echo "  Node.js not found. Install Node v20.x"
  ERRORS=$((ERRORS + 1))
elif [[ ! $CURRENT_NODE == $REQUIRED_NODE* ]]; then
  echo -e "${RED}FAIL${NC}"
  echo "  Expected: ${REQUIRED_NODE}.x"
  echo "  Found: ${CURRENT_NODE}"
  echo "  Fix: nvm use 20"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}OK${NC} ($CURRENT_NODE)"
fi

# -----------------------------------------------------------------------------
# Check 2: Node Architecture (must be arm64, not x64/Rosetta)
# -----------------------------------------------------------------------------
echo -n "Checking Node architecture... "
ARCH=$(node -p "process.arch" 2>/dev/null || echo "unknown")

if [[ $ARCH != "arm64" ]]; then
  echo -e "${RED}FAIL${NC}"
  echo "  Expected: arm64"
  echo "  Found: ${ARCH}"
  echo "  This means Node is running under Rosetta (x86_64 emulation)."
  echo "  Fix: Install arm64 Node: nvm install 20 --default"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}OK${NC} ($ARCH)"
fi

# -----------------------------------------------------------------------------
# Check 3: Symlink Integrity
# -----------------------------------------------------------------------------
echo -n "Checking extension symlink... "
SYMLINK_PATH="vscode/extensions/ritemark"

if [[ ! -L "$SYMLINK_PATH" ]]; then
  echo -e "${RED}FAIL${NC}"
  echo "  $SYMLINK_PATH is not a symlink"
  echo "  Fix: cd vscode/extensions && ln -s ../../extensions/ritemark ritemark"
  ERRORS=$((ERRORS + 1))
else
  TARGET=$(readlink "$SYMLINK_PATH")
  if [[ $TARGET != "../../extensions/ritemark" ]]; then
    echo -e "${YELLOW}WARN${NC}"
    echo "  Symlink points to: $TARGET"
    echo "  Expected: ../../extensions/ritemark"
    WARNINGS=$((WARNINGS + 1))
  else
    echo -e "${GREEN}OK${NC} (-> $TARGET)"
  fi
fi

# -----------------------------------------------------------------------------
# Check 4: Critical Source Files (not corrupted/0-byte)
# -----------------------------------------------------------------------------
check_file_size() {
  local file=$1
  local min_size=$2
  local name=$3

  echo -n "Checking $name... "

  if [[ ! -f "$file" ]]; then
    echo -e "${RED}FAIL${NC}"
    echo "  File not found: $file"
    ERRORS=$((ERRORS + 1))
    return
  fi

  local size=$(stat -f%z "$file" 2>/dev/null || echo 0)

  if [[ $size -lt $min_size ]]; then
    echo -e "${RED}FAIL${NC}"
    echo "  File corrupted: ${size} bytes (need >$min_size)"
    echo "  Fix: git checkout HEAD -- $file"
    ERRORS=$((ERRORS + 1))
  else
    echo -e "${GREEN}OK${NC} (${size} bytes)"
  fi
}

check_file_size "extensions/ritemark/media/webview.js" 500000 "webview.js"
check_file_size "extensions/ritemark/out/extension.js" 1000 "extension.js"
check_file_size "extensions/ritemark/out/ritemarkEditor.js" 1000 "ritemarkEditor.js"

# -----------------------------------------------------------------------------
# Check 5: Webview Config Files
# -----------------------------------------------------------------------------
echo -n "Checking vite.config.ts... "
VITE_CONFIG="extensions/ritemark/webview/vite.config.ts"
if [[ ! -s "$VITE_CONFIG" ]]; then
  echo -e "${RED}FAIL${NC}"
  echo "  vite.config.ts is empty or missing"
  echo "  Fix: git checkout HEAD -- $VITE_CONFIG"
  ERRORS=$((ERRORS + 1))
else
  SIZE=$(stat -f%z "$VITE_CONFIG")
  echo -e "${GREEN}OK${NC} (${SIZE} bytes)"
fi

echo -n "Checking postcss.config.js... "
POSTCSS_CONFIG="extensions/ritemark/webview/postcss.config.js"
if [[ ! -s "$POSTCSS_CONFIG" ]]; then
  echo -e "${RED}FAIL${NC}"
  echo "  postcss.config.js is empty or missing"
  echo "  Fix: git checkout HEAD -- $POSTCSS_CONFIG"
  ERRORS=$((ERRORS + 1))
else
  SIZE=$(stat -f%z "$POSTCSS_CONFIG")
  echo -e "${GREEN}OK${NC} (${SIZE} bytes)"
fi

# -----------------------------------------------------------------------------
# Check 6: Icon Files
# -----------------------------------------------------------------------------
echo -n "Checking icon files... "
ICON_DIR="extensions/ritemark/fileicons/icons"
ICON_COUNT=$(find "$ICON_DIR" -name "*.svg" -size +0 2>/dev/null | wc -l | tr -d ' ')

if [[ $ICON_COUNT -lt 10 ]]; then
  echo -e "${RED}FAIL${NC}"
  echo "  Only $ICON_COUNT valid icon files found (expected 12+)"
  echo "  Fix: git checkout HEAD -- extensions/ritemark/fileicons/"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}OK${NC} ($ICON_COUNT icons)"
fi

# -----------------------------------------------------------------------------
# Check 7: CSS Processing (webview.js shouldn't have raw @tailwind)
# -----------------------------------------------------------------------------
echo -n "Checking CSS processing... "
if grep -q "@tailwind base" "extensions/ritemark/media/webview.js" 2>/dev/null; then
  echo -e "${RED}FAIL${NC}"
  echo "  webview.js contains raw @tailwind directives (CSS not processed)"
  echo "  Fix: cd extensions/ritemark/webview && npm run build"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}OK${NC} (CSS processed)"
fi

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo ""
echo "========================================"
if [[ $ERRORS -gt 0 ]]; then
  echo -e "${RED}VALIDATION FAILED${NC}"
  echo "$ERRORS error(s), $WARNINGS warning(s)"
  echo ""
  echo "Fix the errors above before building."
  echo "========================================"
  exit 1
elif [[ $WARNINGS -gt 0 ]]; then
  echo -e "${YELLOW}VALIDATION PASSED WITH WARNINGS${NC}"
  echo "$WARNINGS warning(s)"
  echo ""
  echo "You can proceed, but review warnings above."
  echo "========================================"
  exit 0
else
  echo -e "${GREEN}VALIDATION PASSED${NC}"
  echo "Environment is ready for production build."
  echo "========================================"
  exit 0
fi
