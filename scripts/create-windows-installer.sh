#!/bin/bash
#
# create-windows-installer.sh - Create Windows installer using Inno Setup via Docker
#
# Usage: ./scripts/create-windows-installer.sh
#
# Requirements:
#   - Docker Desktop running
#   - Built Windows app at VSCode-win32-x64/
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
WIN_BUILD="$PROJECT_ROOT/VSCode-win32-x64"
ISS_FILE="$PROJECT_ROOT/installer/windows/ritemark.iss"
DIST_DIR="$PROJECT_ROOT/dist"

echo "========================================"
echo "RiteMark - Windows Installer Creator"
echo "========================================"
echo

# Pre-flight checks
echo "[1/4] Running pre-flight checks..."

# Check Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}ERROR: Docker is not running${NC}"
    echo "Please start Docker Desktop and try again."
    exit 1
fi
echo "  ✓ Docker is running"

# Check Windows build exists
if [ ! -d "$WIN_BUILD" ]; then
    echo -e "${RED}ERROR: Windows build not found at $WIN_BUILD${NC}"
    echo "Run ./scripts/build-windows.sh first"
    exit 1
fi
echo "  ✓ Windows build found"

# Check .iss file exists
if [ ! -f "$ISS_FILE" ]; then
    echo -e "${RED}ERROR: Inno Setup script not found at $ISS_FILE${NC}"
    exit 1
fi
echo "  ✓ Inno Setup script found"

# Extract version
echo
echo "[2/4] Extracting version..."
VERSION=$(node -p "require('$PROJECT_ROOT/vscode/package.json').version")
echo "  Version: $VERSION"

# Create dist directory
mkdir -p "$DIST_DIR"

# Update version in .iss file (create temp copy)
echo
echo "[3/4] Preparing installer script..."
TEMP_ISS="$PROJECT_ROOT/installer/windows/ritemark-build.iss"
sed "s/#define AppVersion \".*\"/#define AppVersion \"$VERSION\"/" "$ISS_FILE" > "$TEMP_ISS"
echo "  ✓ Version updated in script"

# Run Inno Setup via Docker
echo
echo "[4/4] Building installer with Inno Setup..."
echo "  This may take a few minutes..."
echo

# Docker command
# Mount the entire project directory so Inno Setup can access all files
docker run --rm \
    -v "$PROJECT_ROOT:/work" \
    amake/innosetup \
    "installer/windows/ritemark-build.iss"

# Check if installer was created
INSTALLER_NAME="RiteMark-${VERSION}-win32-x64-setup.exe"
INSTALLER_PATH="$DIST_DIR/$INSTALLER_NAME"

if [ ! -f "$INSTALLER_PATH" ]; then
    echo -e "${RED}ERROR: Installer not created${NC}"
    echo "Check the Inno Setup output above for errors."
    rm -f "$TEMP_ISS"
    exit 1
fi

# Clean up temp file
rm -f "$TEMP_ISS"

# Generate checksum
echo
echo "Generating checksum..."
CHECKSUM_PATH="$INSTALLER_PATH.sha256"
shasum -a 256 "$INSTALLER_PATH" | awk '{print $1}' > "$CHECKSUM_PATH"
CHECKSUM=$(cat "$CHECKSUM_PATH")

# Summary
echo
echo "========================================"
echo -e "${GREEN}✓ Windows installer created!${NC}"
echo "========================================"
echo
echo "Output:"
echo "  Installer: $INSTALLER_PATH"
echo "  Checksum:  $CHECKSUM_PATH"
echo
echo "Details:"
echo "  Version:  $VERSION"
echo "  Size:     $(du -h "$INSTALLER_PATH" | cut -f1)"
echo "  SHA256:   $CHECKSUM"
echo
echo "To test:"
echo "  1. Copy installer to Windows machine"
echo "  2. Run: $INSTALLER_NAME"
echo
