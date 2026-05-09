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
NVMRC_PATH="$PROJECT_DIR/vscode/.nvmrc"

use_repo_node() {
  local required_version
  required_version="$(tr -d '[:space:]' < "$NVMRC_PATH" 2>/dev/null || true)"
  local nvm_sh="${NVM_DIR:-$HOME/.nvm}/nvm.sh"

  if [[ -z "$required_version" || ! -s "$nvm_sh" ]]; then
    return
  fi

  local current_version
  current_version=$(node -v 2>/dev/null || true)
  if [[ "$current_version" == "v$required_version" ]]; then
    return
  fi

  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck disable=SC1090
  source "$nvm_sh"
  nvm use "$required_version" >/dev/null
}

cd "$PROJECT_DIR"
use_repo_node

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
echo -e "${BLUE}Step 1/8: Pre-Build Validation${NC}"
echo "----------------------------------------"

if ! ./scripts/validate-build-env.sh; then
  echo ""
  echo -e "${RED}Pre-build validation failed!${NC}"
  echo "Fix the issues above before attempting a build."
  exit 1
fi

echo ""

# =============================================================================
# Step 2: Bundled Agent Runtimes (manifest-driven)
# =============================================================================
echo -e "${BLUE}Step 2/8: Bundled Agent Runtimes${NC}"
echo "----------------------------------------"

# Materialise Codex + Claude runtimes for the build target before any gulp
# work runs. The extension copy in Step 4 picks these up from
# extensions/ritemark/binaries/agents/<platform>-<arch>/. Without this step,
# the .app would ship without app-owned agent runtimes and clean installs
# would fall back to system PATH lookups.
ARCH="${TARGET#darwin-}"
if ! ./scripts/fetch-agent-runtimes.sh --platform darwin --arch "$ARCH"; then
  echo ""
  echo -e "${RED}Bundled agent runtime fetch/verify failed!${NC}"
  echo "See manifest: extensions/ritemark/binaries/agents/manifest.json"
  exit 1
fi

echo ""


# =============================================================================
# Step 3: Backup & Build VS Code
# =============================================================================
echo -e "${BLUE}Step 3/8: Backing Up & Building VS Code${NC}"
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
# Step 4: Copy RiteMark Extension
# =============================================================================
echo -e "${BLUE}Step 4/8: Copying RiteMark Extension${NC}"
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

# Strip foreign-platform agent runtimes from the .app extension copy.
# Sprint 64 fetches Codex + Claude binaries for ALL supported targets into
# extensions/ritemark/binaries/agents/<platform>-<arch>/. Without this strip,
# a darwin-arm64 build would ship win32-x64 (and other) agent trees, bloating
# the .app by hundreds of MB. The script is allowlist-based and idempotent.
KEEP_ARCH="${TARGET#darwin-}"
echo "Stripping foreign-platform agent runtimes (keeping darwin-${KEEP_ARCH})..."
"$PROJECT_DIR/scripts/strip-foreign-agent-runtimes.sh" "$EXT_DEST" darwin "$KEEP_ARCH"

echo -e "${GREEN}Extension copied successfully${NC}"
echo ""

echo "Copying Welcome media assets into app bundle..."
WELCOME_DEST="$APP_PATH/Contents/Resources/app/out/vs/workbench/contrib/welcomeGettingStarted/browser/media"

if "$PROJECT_DIR/scripts/copy-welcome-assets.sh" "$WELCOME_DEST"; then
  echo -e "${GREEN}Welcome media assets copied successfully${NC}"
else
  echo -e "${RED}ERROR: Failed to copy Welcome media assets${NC}"
  exit 1
fi
echo ""

# Add ritemarkVersion field to product.json from branding
# NOTE: We keep VS Code's upstream "version" field intact for internal compatibility
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
import os, pathlib
branding = json.load(open(pathlib.Path("'"$(pwd)"'") / "branding" / "product.json"))
for key in ("posthogProjectApiKey", "posthogHost", "builtInExtensionsEnabledWithAutoUpdates"):
    if key in branding:
        data[key] = branding[key]
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
# Step 4.5: Remove unwanted built-in extensions (VS Code 1.117+)
# Microsoft started bundling GitHub Copilot Chat + Mermaid Chat Features as
# first-party built-in extensions. Ritemark does not ship these — they pollute
# the activity bar with a "Chat Debug" item and inject chat tools we don't use.
# =============================================================================
EXTENSIONS_DIR="$APP_PATH/Contents/Resources/app/extensions"
for unwanted_ext in copilot mermaid-chat-features; do
  if [[ -d "$EXTENSIONS_DIR/$unwanted_ext" ]]; then
    rm -rf "$EXTENSIONS_DIR/$unwanted_ext"
    echo -e "${GREEN}Removed unwanted built-in extension: $unwanted_ext${NC}"
  fi
done

# Belt-and-suspenders: hide chat activity bar icon via CSS in case the view
# container registration leaks through a partially-applied patch 003.
CSS_FILE="$APP_PATH/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.css"
if [[ -f "$CSS_FILE" ]]; then
  printf '\n/* Ritemark: hide VS Code chat view container from activity bar */\n.activitybar .action-item a[class*="workbench-panel-chat"] { display: none !important; }\n.activitybar .action-item:has(a[class*="workbench-panel-chat"]) { display: none !important; }\n.activitybar .action-item a[class*="copilot-chat"] { display: none !important; }\n.activitybar .action-item:has(a[class*="copilot-chat"]) { display: none !important; }\n' >> "$CSS_FILE"
  echo -e "${GREEN}Chat activity bar CSS hide rule appended${NC}"
fi
echo ""

# =============================================================================
# Step 5: Verify Extension Copy (GUARDRAIL)
# =============================================================================
echo -e "${BLUE}Step 5/8: Verifying Extension Copy${NC}"
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

# Check Welcome assets are present in build output
WELCOME_LOGO="$WELCOME_DEST/ritemark-welcome-logo-full.svg"
WELCOME_BG="$WELCOME_DEST/ritemark-welcome-hero-bg.png"
if [[ -f "$WELCOME_LOGO" ]] && [[ -f "$WELCOME_BG" ]]; then
  echo -e "${GREEN}OK${NC}: Welcome assets copied"
else
  echo -e "${RED}FAIL: Welcome assets missing from build output${NC}"
  VALIDATION_FAILED=1
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
# Step 6: Post-Build Validation
# =============================================================================
echo -e "${BLUE}Step 6/8: Post-Build Validation${NC}"
echo "----------------------------------------"

if ! ./scripts/validate-build-output.sh "$TARGET"; then
  echo ""
  echo -e "${RED}Post-build validation failed!${NC}"
  echo "The build completed but has issues."
  exit 1
fi

echo ""

# =============================================================================
# Step 7: Fix Timestamps
# =============================================================================
echo -e "${BLUE}Step 7/8: Fixing Timestamps${NC}"
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
# Step 8: Success
# =============================================================================
echo -e "${BLUE}Step 8/8: Build Complete${NC}"
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
