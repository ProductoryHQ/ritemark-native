#!/bin/bash
# Sync branding and version across all files from source of truth
# Run: ./scripts/sync-branding.sh
#
# Source of truth:
#   branding/VERSION      - version number (e.g., 1.1.1)
#   branding/BRANDING.json - product name and other constants

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Source of truth
VERSION_FILE="$ROOT_DIR/branding/VERSION"
BRANDING_FILE="$ROOT_DIR/branding/BRANDING.json"

if [ ! -f "$VERSION_FILE" ]; then
    echo "ERROR: $VERSION_FILE not found"
    exit 1
fi

if [ ! -f "$BRANDING_FILE" ]; then
    echo "ERROR: $BRANDING_FILE not found"
    exit 1
fi

VERSION=$(cat "$VERSION_FILE" | tr -d '\n')
PRODUCT_NAME=$(grep '"productName"' "$BRANDING_FILE" | sed 's/.*: *"\([^"]*\)".*/\1/')

echo "========================================"
echo "Syncing Branding & Version"
echo "========================================"
echo "Source of truth:"
echo "  Product: $PRODUCT_NAME"
echo "  Version: $VERSION"
echo ""

# 1. Update extensions/ritemark/package.json
echo "Updating extensions/ritemark/package.json..."
EXT_PKG="$ROOT_DIR/extensions/ritemark/package.json"
if [ -f "$EXT_PKG" ]; then
    # Update version
    sed -i.bak 's/"version": *"[^"]*"/"version": "'"$VERSION"'"/' "$EXT_PKG"
    # Update displayName to use correct capitalization
    sed -i.bak 's/"displayName": *"RiteMark/"displayName": "'"$PRODUCT_NAME"'/' "$EXT_PKG"
    rm -f "$EXT_PKG.bak"
    echo "  OK"
fi

# 2. Update branding/product.json
echo "Updating branding/product.json..."
PRODUCT_JSON="$ROOT_DIR/branding/product.json"
if [ -f "$PRODUCT_JSON" ]; then
    sed -i.bak 's/"ritemarkVersion": *"[^"]*"/"ritemarkVersion": "'"$VERSION"'"/' "$PRODUCT_JSON"
    sed -i.bak 's/"nameShort": *"[^"]*"/"nameShort": "'"$PRODUCT_NAME"'"/' "$PRODUCT_JSON"
    sed -i.bak 's/"nameLong": *"[^"]*"/"nameLong": "'"$PRODUCT_NAME"'"/' "$PRODUCT_JSON"
    sed -i.bak 's/"win32DirName": *"[^"]*"/"win32DirName": "'"$PRODUCT_NAME"'"/' "$PRODUCT_JSON"
    sed -i.bak 's/"win32NameVersion": *"[^"]*"/"win32NameVersion": "'"$PRODUCT_NAME"'"/' "$PRODUCT_JSON"
    sed -i.bak 's/"win32RegValueName": *"[^"]*"/"win32RegValueName": "'"$PRODUCT_NAME"'"/' "$PRODUCT_JSON"
    rm -f "$PRODUCT_JSON.bak"
    echo "  OK"
fi

# 3. Update installer/windows/ritemark.iss
echo "Updating installer/windows/ritemark.iss..."
ISS_FILE="$ROOT_DIR/installer/windows/ritemark.iss"
if [ -f "$ISS_FILE" ]; then
    sed -i.bak 's/#define AppVersion "[^"]*"/#define AppVersion "'"$VERSION"'"/' "$ISS_FILE"
    sed -i.bak 's/#define AppName "[^"]*"/#define AppName "'"$PRODUCT_NAME"'"/' "$ISS_FILE"
    sed -i.bak 's/AppExeName "[^"]*"/AppExeName "'"$PRODUCT_NAME"'.exe"/' "$ISS_FILE"
    sed -i.bak 's/OutputBaseFilename=RiteMark-/OutputBaseFilename='"$PRODUCT_NAME"'-/' "$ISS_FILE"
    # Fix registry entries
    sed -i.bak 's/RiteMark\.md/'"$PRODUCT_NAME"'.md/g' "$ISS_FILE"
    rm -f "$ISS_FILE.bak"
    echo "  OK"
fi

# 4. Update branding/BRANDING.json version
echo "Updating branding/BRANDING.json..."
if [ -f "$BRANDING_FILE" ]; then
    sed -i.bak 's/"version": *"[^"]*"/"version": "'"$VERSION"'"/' "$BRANDING_FILE"
    rm -f "$BRANDING_FILE.bak"
    echo "  OK"
fi

echo ""
echo "========================================"
echo "Sync complete!"
echo ""
echo "Files updated:"
echo "  - extensions/ritemark/package.json"
echo "  - branding/product.json"
echo "  - branding/BRANDING.json"
echo "  - installer/windows/ritemark.iss"
echo ""
echo "Run ./scripts/check-branding.sh to verify"
