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
echo -e "${BLUE}Step 1/6: Pre-Build Validation${NC}"
echo "----------------------------------------"

if ! ./scripts/validate-build-env.sh; then
  echo ""
  echo -e "${RED}Pre-build validation failed!${NC}"
  echo "Fix the issues above before attempting a build."
  exit 1
fi

echo ""

# =============================================================================
# Step 2: Backup & Build VS Code
# =============================================================================
echo -e "${BLUE}Step 2/6: Backing Up & Building VS Code${NC}"
echo "----------------------------------------"
echo ""

# GUARDRAIL: Backup ritemark extension before build
# VS Code gulp build can corrupt files via symlink
BACKUP_DIR="$PROJECT_DIR/.ritemark-backup-$$"
echo "Creating backup of ritemark extension..."
cp -R "$PROJECT_DIR/extensions/ritemark" "$BACKUP_DIR"
echo "Backup created at: $BACKUP_DIR"
echo ""

echo "This will take approximately 25 minutes..."
echo "Started at: $(date '+%H:%M:%S')"
echo ""

cd vscode

# Use npm (VS Code switched from yarn)
npm run gulp vscode-darwin-arm64

cd "$PROJECT_DIR"

# GUARDRAIL: Check if extension was corrupted during build
echo ""
echo "Checking for build-time corruption..."
WEBVIEW_AFTER=$(stat -f%z "$PROJECT_DIR/extensions/ritemark/media/webview.js" 2>/dev/null || echo 0)
EXTENSION_AFTER=$(stat -f%z "$PROJECT_DIR/extensions/ritemark/out/extension.js" 2>/dev/null || echo 0)

if [[ $WEBVIEW_AFTER -lt 500000 ]] || [[ $EXTENSION_AFTER -lt 1000 ]]; then
  echo -e "${YELLOW}WARNING: Extension files corrupted during build!${NC}"
  echo "Restoring from backup..."
  rm -rf "$PROJECT_DIR/extensions/ritemark"
  cp -R "$BACKUP_DIR" "$PROJECT_DIR/extensions/ritemark"
  echo -e "${GREEN}Extension restored from backup${NC}"
else
  echo "Extension files intact after build"
fi

# Clean up backup
rm -rf "$BACKUP_DIR"

echo ""
echo "Build completed at: $(date '+%H:%M:%S')"
echo ""

# =============================================================================
# Step 3: Copy RiteMark Extension
# =============================================================================
echo -e "${BLUE}Step 3/6: Copying RiteMark Extension${NC}"
echo "----------------------------------------"

APP_PATH="VSCode-darwin-arm64/RiteMark.app"
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
# Step 4: Verify Extension Copy (GUARDRAIL)
# =============================================================================
echo -e "${BLUE}Step 4/6: Verifying Extension Copy${NC}"
echo "----------------------------------------"

VALIDATION_FAILED=0

# Check webview.js (must be >500KB)
WEBVIEW_SIZE=$(stat -f%z "$EXT_DEST/media/webview.js" 2>/dev/null || echo 0)
if [[ $WEBVIEW_SIZE -lt 500000 ]]; then
  echo -e "${RED}FAIL: webview.js (${WEBVIEW_SIZE} bytes, need >500000)${NC}"
  VALIDATION_FAILED=1
else
  echo -e "${GREEN}OK${NC}: webview.js (${WEBVIEW_SIZE} bytes)"
fi

# Check extension.js (must be >1KB)
EXTENSION_SIZE=$(stat -f%z "$EXT_DEST/out/extension.js" 2>/dev/null || echo 0)
if [[ $EXTENSION_SIZE -lt 1000 ]]; then
  echo -e "${RED}FAIL: extension.js (${EXTENSION_SIZE} bytes, need >1000)${NC}"
  VALIDATION_FAILED=1
else
  echo -e "${GREEN}OK${NC}: extension.js (${EXTENSION_SIZE} bytes)"
fi

# Check ritemarkEditor.js (must be >1KB)
EDITOR_SIZE=$(stat -f%z "$EXT_DEST/out/ritemarkEditor.js" 2>/dev/null || echo 0)
if [[ $EDITOR_SIZE -lt 1000 ]]; then
  echo -e "${RED}FAIL: ritemarkEditor.js (${EDITOR_SIZE} bytes, need >1000)${NC}"
  VALIDATION_FAILED=1
else
  echo -e "${GREEN}OK${NC}: ritemarkEditor.js (${EDITOR_SIZE} bytes)"
fi

# Check icons (must have 10+)
ICON_COUNT=$(find "$EXT_DEST/fileicons/icons" -name "*.svg" -size +0 2>/dev/null | wc -l | tr -d ' ')
if [[ $ICON_COUNT -lt 10 ]]; then
  echo -e "${RED}FAIL: Only ${ICON_COUNT} icons (need 10+)${NC}"
  VALIDATION_FAILED=1
else
  echo -e "${GREEN}OK${NC}: ${ICON_COUNT} icons"
fi

if [[ $VALIDATION_FAILED -eq 1 ]]; then
  echo ""
  echo -e "${RED}Extension copy validation FAILED!${NC}"
  echo "The build output is corrupt and should NOT be distributed."
  exit 1
fi

echo ""
echo -e "${GREEN}All extension files validated successfully${NC}"

echo ""

# =============================================================================
# Step 5: Post-Build Validation
# =============================================================================
echo -e "${BLUE}Step 5/6: Post-Build Validation${NC}"
echo "----------------------------------------"

if ! ./scripts/validate-build-output.sh; then
  echo ""
  echo -e "${RED}Post-build validation failed!${NC}"
  echo "The build completed but has issues."
  exit 1
fi

echo ""

# =============================================================================
# Step 6: Success
# =============================================================================
echo -e "${BLUE}Step 6/6: Build Complete${NC}"
echo "----------------------------------------"
echo ""
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
