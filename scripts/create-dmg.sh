#!/bin/bash
#
# create-dmg.sh - Create macOS DMG installer for Ritemark Native
#
# Usage:
#   ./scripts/create-dmg.sh       # Create DMG for Apple Silicon (default)
#   ./scripts/create-dmg.sh x64   # Create DMG for Intel Mac
#
# Supported architectures:
#   arm64 (default) - Apple Silicon Mac (M1/M2/M3)
#   x64             - Intel Mac
#
# Requirements:
#   - brew install create-dmg
#   - Built app at VSCode-darwin-{arch}/Ritemark.app
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse architecture argument
ARCH="${1:-arm64}"

# Validate architecture
case "$ARCH" in
  arm64|x64)
    # Valid architectures
    ;;
  *)
    echo -e "${RED}ERROR: Invalid architecture '$ARCH'${NC}"
    echo "Supported architectures: arm64 (default), x64"
    echo ""
    echo "Usage:"
    echo "  ./scripts/create-dmg.sh       # Apple Silicon"
    echo "  ./scripts/create-dmg.sh x64   # Intel Mac"
    exit 1
    ;;
esac

# Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
APP_PATH="$PROJECT_ROOT/VSCode-darwin-$ARCH/Ritemark.app"
ICON_PATH="$PROJECT_ROOT/branding/icons/icon.icns"
OUTPUT_DIR="$PROJECT_ROOT/dist"

echo "========================================"
echo "Ritemark Native - DMG Creator"
echo "========================================"
echo "Architecture: darwin-$ARCH"
echo

# Pre-flight checks
echo "[1/5] Running pre-flight checks..."

# Check create-dmg is installed
if ! command -v create-dmg &> /dev/null; then
    echo -e "${RED}ERROR: create-dmg not found${NC}"
    echo "Install with: brew install create-dmg"
    exit 1
fi
echo "  ✓ create-dmg installed"

# Check app exists
if [ ! -d "$APP_PATH" ]; then
    echo -e "${RED}ERROR: App not found at $APP_PATH${NC}"
    echo "Build first with: ./scripts/build-prod.sh darwin-$ARCH"
    exit 1
fi
echo "  ✓ App bundle found"

# Check icon exists
if [ ! -f "$ICON_PATH" ]; then
    echo -e "${RED}ERROR: Icon not found at $ICON_PATH${NC}"
    exit 1
fi
echo "  ✓ Icon found"

# Extract ritemarkVersion from branding/product.json (Ritemark version, not VS Code)
echo
echo "[2/5] Extracting version..."
VERSION=$(grep '"ritemarkVersion"' "$PROJECT_ROOT/branding/product.json" | sed 's/.*"ritemarkVersion"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
if [ -z "$VERSION" ]; then
    echo -e "${RED}ERROR: Could not extract ritemarkVersion from branding/product.json${NC}"
    exit 1
fi
echo "  Version: $VERSION (from branding/product.json ritemarkVersion)"

# Create output directory
echo
echo "[3/5] Preparing output directory..."
mkdir -p "$OUTPUT_DIR"

# DMG filename
DMG_NAME="Ritemark-${VERSION}-darwin-$ARCH.dmg"
DMG_PATH="$OUTPUT_DIR/$DMG_NAME"

# Remove existing DMG if present
if [ -f "$DMG_PATH" ]; then
    echo "  Removing existing DMG..."
    rm -f "$DMG_PATH"
fi

# Create DMG
echo
echo "[4/5] Creating DMG..."
echo "  This may take a minute..."

create-dmg \
    --volname "Ritemark" \
    --volicon "$ICON_PATH" \
    --window-pos 200 120 \
    --window-size 800 400 \
    --icon-size 100 \
    --icon "Ritemark.app" 200 190 \
    --hide-extension "Ritemark.app" \
    --app-drop-link 600 185 \
    --no-internet-enable \
    "$DMG_PATH" \
    "$APP_PATH"

if [ ! -f "$DMG_PATH" ]; then
    echo -e "${RED}ERROR: DMG creation failed${NC}"
    exit 1
fi

# Sign the DMG if credentials available
CONFIG_FILE="$PROJECT_ROOT/.signing-config"
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
fi

if [ -n "$APPLE_TEAM_ID" ]; then
    echo
    echo "[4b/5] Signing DMG..."
    SIGNING_IDENTITY="Developer ID Application: Jarmo Tuisk ($APPLE_TEAM_ID)"

    if security find-identity -v -p codesigning | grep -q "$APPLE_TEAM_ID"; then
        codesign --force --sign "$SIGNING_IDENTITY" "$DMG_PATH"
        echo -e "  ${GREEN}✓ DMG signed${NC}"
    else
        echo -e "  ${YELLOW}⚠ Certificate not found, skipping DMG signing${NC}"
    fi
else
    echo
    echo -e "  ${YELLOW}⚠ No APPLE_TEAM_ID, skipping DMG signing${NC}"
fi

# Generate SHA256 checksum
echo
echo "[5/5] Generating checksum..."
CHECKSUM_PATH="$DMG_PATH.sha256"
shasum -a 256 "$DMG_PATH" | awk '{print $1}' > "$CHECKSUM_PATH"
CHECKSUM=$(cat "$CHECKSUM_PATH")

# Summary
echo
echo "========================================"
echo -e "${GREEN}✓ DMG created successfully!${NC}"
echo "========================================"
echo
echo "Output:"
echo "  DMG:      $DMG_PATH"
echo "  Checksum: $CHECKSUM_PATH"
echo
echo "Details:"
echo "  Version:  $VERSION"
echo "  Size:     $(du -h "$DMG_PATH" | cut -f1)"
echo "  SHA256:   $CHECKSUM"
echo
echo "To test installation:"
echo "  open \"$DMG_PATH\""
echo
