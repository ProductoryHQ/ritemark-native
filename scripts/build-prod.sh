#!/bin/bash
# =============================================================================
# RiteMark Native - Master Production Build Script
# =============================================================================
# Single command to build a working production app.
# Validates environment, builds VS Code, copies extension, validates output.
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}RiteMark Native Production Build${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Project directory: $PROJECT_DIR"
echo ""

# =============================================================================
# Step 1: Pre-Build Validation
# =============================================================================
echo -e "${BLUE}Step 1/5: Pre-Build Validation${NC}"
echo "----------------------------------------"

if ! ./scripts/validate-build-env.sh; then
  echo ""
  echo -e "${RED}Pre-build validation failed!${NC}"
  echo "Fix the issues above before attempting a build."
  exit 1
fi

echo ""

# =============================================================================
# Step 2: Build VS Code
# =============================================================================
echo -e "${BLUE}Step 2/5: Building VS Code${NC}"
echo "----------------------------------------"
echo ""
echo "This will take approximately 25 minutes..."
echo "Started at: $(date '+%H:%M:%S')"
echo ""

cd vscode

# Use npm (VS Code switched from yarn)
npm run gulp vscode-darwin-arm64

cd "$PROJECT_DIR"

echo ""
echo "Build completed at: $(date '+%H:%M:%S')"
echo ""

# =============================================================================
# Step 3: Copy RiteMark Extension
# =============================================================================
echo -e "${BLUE}Step 3/5: Copying RiteMark Extension${NC}"
echo "----------------------------------------"

APP_PATH="VSCode-darwin-arm64/RiteMark Native.app"
EXT_DEST="$APP_PATH/Contents/Resources/app/extensions/ritemark"

if [[ ! -d "$APP_PATH" ]]; then
  echo -e "${RED}ERROR: App bundle not found at $APP_PATH${NC}"
  echo "The VS Code build may have failed."
  exit 1
fi

echo "Removing old extension (if exists)..."
rm -rf "$EXT_DEST"

echo "Copying extension from source..."
cp -R extensions/ritemark "$EXT_DEST"

echo -e "${GREEN}Extension copied successfully${NC}"
echo ""

# =============================================================================
# Step 4: Verify Extension Copy
# =============================================================================
echo -e "${BLUE}Step 4/5: Verifying Extension Copy${NC}"
echo "----------------------------------------"

# Quick sanity check
WEBVIEW_SIZE=$(stat -f%z "$EXT_DEST/media/webview.js" 2>/dev/null || echo 0)
if [[ $WEBVIEW_SIZE -lt 500000 ]]; then
  echo -e "${RED}ERROR: webview.js copy failed (${WEBVIEW_SIZE} bytes)${NC}"
  exit 1
fi
echo "webview.js: ${WEBVIEW_SIZE} bytes - OK"

ICON_COUNT=$(find "$EXT_DEST/fileicons/icons" -name "*.svg" -size +0 2>/dev/null | wc -l | tr -d ' ')
if [[ $ICON_COUNT -lt 10 ]]; then
  echo -e "${RED}ERROR: Only ${ICON_COUNT} icons copied${NC}"
  exit 1
fi
echo "Icons: ${ICON_COUNT} files - OK"

echo ""

# =============================================================================
# Step 5: Post-Build Validation
# =============================================================================
echo -e "${BLUE}Step 5/5: Post-Build Validation${NC}"
echo "----------------------------------------"

if ! ./scripts/validate-build-output.sh; then
  echo ""
  echo -e "${RED}Post-build validation failed!${NC}"
  echo "The build completed but has issues."
  exit 1
fi

echo ""

# =============================================================================
# Success
# =============================================================================
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}BUILD COMPLETE${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Production app ready at:"
echo "  $APP_PATH"
echo ""
echo "To launch:"
echo "  open \"$APP_PATH\""
echo ""
echo "Build finished at: $(date '+%H:%M:%S')"
echo ""
