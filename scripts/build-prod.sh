#!/bin/bash
# =============================================================================
# RiteMark Native - Master Production Build Script
# =============================================================================
# Single command to build a working production app.
# Validates environment, builds VS Code, copies extension, validates output.
#
# Usage:
#   ./scripts/build-prod.sh              # Build for Apple Silicon (default)
#   ./scripts/build-prod.sh darwin-x64   # Build for Intel Mac
#
# Supported targets:
#   darwin-arm64 (default) - Apple Silicon Mac (M1/M2/M3)
#   darwin-x64             - Intel Mac
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse target argument
TARGET="${1:-darwin-arm64}"

# Validate target
case "$TARGET" in
  darwin-arm64|darwin-x64)
    # Valid targets
    ;;
  *)
    echo -e "${RED}ERROR: Invalid target '$TARGET'${NC}"
    echo "Supported targets: darwin-arm64 (default), darwin-x64"
    echo ""
    echo "Usage:"
    echo "  ./scripts/build-prod.sh              # Apple Silicon"
    echo "  ./scripts/build-prod.sh darwin-x64   # Intel Mac"
    exit 1
    ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}RiteMark Native Production Build${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Project directory: $PROJECT_DIR"
echo "Target platform:   $TARGET"
echo ""

# =============================================================================
# Step 1: Pre-Build Validation
# =============================================================================
echo -e "${BLUE}Step 1/7: Pre-Build Validation${NC}"
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
echo -e "${BLUE}Step 2/7: Backing Up & Building VS Code${NC}"
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
# Build for specified target
npm run gulp vscode-$TARGET

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
echo -e "${BLUE}Step 3/7: Copying RiteMark Extension${NC}"
echo "----------------------------------------"

APP_PATH="$PROJECT_DIR/VSCode-$TARGET/Ritemark.app"
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

# Remove dev dependencies that shouldn't be in production
echo "Removing webview dev dependencies..."
rm -rf "$EXT_DEST/webview/node_modules" 2>/dev/null || true
rm -rf "$EXT_DEST/webview/src" 2>/dev/null || true

echo -e "${GREEN}Extension copied successfully${NC}"
echo ""

# Add ritemarkVersion field to product.json from branding
# NOTE: We keep VS Code's "version" field intact (1.94.0) for internal compatibility
# RiteMark uses "ritemarkVersion" for update checking
PRODUCT_JSON="$APP_PATH/Contents/Resources/app/product.json"
RITEMARK_VERSION=$(grep '"ritemarkVersion"' branding/product.json | sed 's/.*"ritemarkVersion"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
echo "Adding RiteMark version: $RITEMARK_VERSION"

# Add ritemarkVersion field using Python for proper JSON handling
python3 -c '
import json
with open("'"$PRODUCT_JSON"'", "r") as f:
    data = json.load(f)
data["ritemarkVersion"] = "'"$RITEMARK_VERSION"'"
with open("'"$PRODUCT_JSON"'", "w") as f:
    json.dump(data, f, indent=2)
'

# Verify the ritemarkVersion was added and JSON is valid
if python3 -c "import json; data = json.load(open('$PRODUCT_JSON')); assert 'ritemarkVersion' in data" 2>/dev/null; then
  echo -e "${GREEN}RiteMark version $RITEMARK_VERSION added to product.json${NC}"
else
  echo -e "${RED}ERROR: Failed to add ritemarkVersion to product.json${NC}"
  exit 1
fi
echo ""

# =============================================================================
# Step 4: Verify Extension Copy (GUARDRAIL)
# =============================================================================
echo -e "${BLUE}Step 4/7: Verifying Extension Copy${NC}"
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
echo -e "${BLUE}Step 5/7: Post-Build Validation${NC}"
echo "----------------------------------------"

if ! ./scripts/validate-build-output.sh "$TARGET"; then
  echo ""
  echo -e "${RED}Post-build validation failed!${NC}"
  echo "The build completed but has issues."
  exit 1
fi

echo ""

# =============================================================================
# Step 6: Fix Timestamps
# =============================================================================
echo -e "${BLUE}Step 6/7: Fixing Timestamps${NC}"
echo "----------------------------------------"

# VS Code build sets creation dates to 1980 (ZIP epoch) - fix to current time
echo "Setting app bundle timestamps to current time..."
touch "$APP_PATH"
# SetFile -d sets the creation date (touch only sets modification/access times)
if command -v SetFile &>/dev/null; then
  CURRENT_DATE=$(date '+%m/%d/%Y %H:%M:%S')
  SetFile -d "$CURRENT_DATE" "$APP_PATH"
  echo -e "${GREEN}Timestamps updated (including creation date)${NC}"
else
  echo -e "${YELLOW}WARNING: SetFile not found - creation date may show 1980${NC}"
  echo "Install Xcode Command Line Tools to fix: xcode-select --install"
fi
echo ""

# =============================================================================
# Step 7: Success
# =============================================================================
echo -e "${BLUE}Step 7/7: Build Complete${NC}"
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
