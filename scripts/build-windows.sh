#!/bin/bash
#
# build-windows.sh - Cross-compile RiteMark Native for Windows x64 from macOS
#
# Usage: ./scripts/build-windows.sh
#
# This script builds a portable Windows application bundle that can be
# distributed as a ZIP file. No installer is created (requires Wine).
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VSCODE_DIR="$PROJECT_ROOT/vscode"
OUTPUT_DIR="$PROJECT_ROOT/VSCode-win32-x64"
DIST_DIR="$PROJECT_ROOT/dist"
ICON_ICO="$PROJECT_ROOT/branding/icons/icon.ico"

echo "========================================"
echo "RiteMark Native - Windows x64 Builder"
echo "========================================"
echo

# Pre-flight checks
echo "[1/6] Running pre-flight checks..."

# Check Node version
NODE_VERSION=$(node -v)
if [[ ! "$NODE_VERSION" =~ ^v2[0-9]\. ]]; then
    echo -e "${YELLOW}WARNING: Node $NODE_VERSION detected. VS Code requires Node 20.x${NC}"
fi
echo "  ✓ Node.js: $NODE_VERSION"

# Check we're in the right place
if [ ! -d "$VSCODE_DIR" ]; then
    echo -e "${RED}ERROR: vscode directory not found${NC}"
    exit 1
fi
echo "  ✓ VS Code directory found"

# Check icon exists
if [ ! -f "$ICON_ICO" ]; then
    echo -e "${YELLOW}WARNING: icon.ico not found. Creating from PNG...${NC}"
    if command -v magick &> /dev/null; then
        magick "$PROJECT_ROOT/branding/icons/Icon-256.png" \
            -define icon:auto-resize=256,128,64,48,32,16 \
            "$ICON_ICO"
        echo "  ✓ Created icon.ico"
    elif command -v convert &> /dev/null; then
        convert "$PROJECT_ROOT/branding/icons/Icon-256.png" \
            -define icon:auto-resize=256,128,64,48,32,16 \
            "$ICON_ICO"
        echo "  ✓ Created icon.ico"
    else
        echo -e "${RED}ERROR: ImageMagick not installed. Run: brew install imagemagick${NC}"
        exit 1
    fi
else
    echo "  ✓ Windows icon found"
fi

# Copy icon to VS Code resources
echo
echo "[2/6] Setting up Windows resources..."
mkdir -p "$VSCODE_DIR/resources/win32"
cp "$ICON_ICO" "$VSCODE_DIR/resources/win32/code.ico"
echo "  ✓ Copied icon to vscode/resources/win32/code.ico"

# Extract version
echo
echo "[3/6] Extracting version..."
VERSION=$(node -p "require('$VSCODE_DIR/package.json').version")
echo "  Version: $VERSION"

# Clean previous build
echo
echo "[4/6] Cleaning previous Windows build..."
if [ -d "$OUTPUT_DIR" ]; then
    rm -rf "$OUTPUT_DIR"
    echo "  ✓ Removed previous build"
else
    echo "  ✓ No previous build to clean"
fi

# Build
echo
echo "[5/6] Building Windows x64 application..."
echo "  This will take 20-30 minutes..."
echo
cd "$VSCODE_DIR"
yarn gulp vscode-win32-x64

# Verify build
if [ ! -d "$OUTPUT_DIR" ]; then
    echo -e "${RED}ERROR: Build failed - output directory not found${NC}"
    exit 1
fi

# Create ZIP distribution
echo
echo "[6/6] Creating ZIP distribution..."
mkdir -p "$DIST_DIR"

ZIP_NAME="RiteMark-Native-${VERSION}-win32-x64.zip"
ZIP_PATH="$DIST_DIR/$ZIP_NAME"

# Remove existing ZIP
rm -f "$ZIP_PATH"

# Create ZIP
cd "$PROJECT_ROOT"
zip -r -q "$ZIP_PATH" "VSCode-win32-x64"

# Generate checksum
CHECKSUM_PATH="$ZIP_PATH.sha256"
shasum -a 256 "$ZIP_PATH" | awk '{print $1}' > "$CHECKSUM_PATH"
CHECKSUM=$(cat "$CHECKSUM_PATH")

# Summary
echo
echo "========================================"
echo -e "${GREEN}✓ Windows build completed!${NC}"
echo "========================================"
echo
echo "Output:"
echo "  App:      $OUTPUT_DIR/"
echo "  ZIP:      $ZIP_PATH"
echo "  Checksum: $CHECKSUM_PATH"
echo
echo "Details:"
echo "  Version:  $VERSION"
echo "  App Size: $(du -sh "$OUTPUT_DIR" | cut -f1)"
echo "  ZIP Size: $(du -h "$ZIP_PATH" | cut -f1)"
echo "  SHA256:   $CHECKSUM"
echo
echo "To test on Windows:"
echo "  1. Copy ZIP to Windows machine"
echo "  2. Extract ZIP"
echo "  3. Run: VSCode-win32-x64/Code - OSS.exe"
echo
