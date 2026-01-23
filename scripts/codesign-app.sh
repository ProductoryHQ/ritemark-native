#!/bin/bash
#
# codesign-app.sh - Code sign RiteMark.app with Developer ID
#
# SMART SIGNING: Discovers and signs ALL native binaries inside the app bundle.
# Uses Mach-O detection to find executables that need signing.
# Verifies each binary individually for notarization compliance.
#

# Don't use set -e as it causes issues with arithmetic when count=0
# We handle errors explicitly

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
APP_PATH="$PROJECT_ROOT/VSCode-darwin-arm64/RiteMark.app"
ENTITLEMENTS_PATH="$PROJECT_ROOT/branding/entitlements.plist"

# Counters (using temp files to persist across subshells)
SIGNED_FILE=$(mktemp)
FAILED_FILE=$(mktemp)
echo "0" > "$SIGNED_FILE"
echo "0" > "$FAILED_FILE"

increment_signed() {
    local count=$(cat "$SIGNED_FILE")
    echo $((count + 1)) > "$SIGNED_FILE"
}

increment_failed() {
    local count=$(cat "$FAILED_FILE")
    echo $((count + 1)) > "$FAILED_FILE"
}

get_signed() {
    cat "$SIGNED_FILE"
}

get_failed() {
    cat "$FAILED_FILE"
}

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}RiteMark Native - Smart Code Signing${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# =============================================================================
# Step 1: Check prerequisites
# =============================================================================
echo "[1/7] Checking prerequisites..."

if [ ! -d "$APP_PATH" ]; then
    echo -e "${RED}ERROR: App not found at $APP_PATH${NC}"
    exit 1
fi
echo "  ✓ App bundle found"

CONFIG_FILE="$PROJECT_ROOT/.signing-config"
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
fi

if [ -z "$APPLE_TEAM_ID" ]; then
    echo -e "${RED}ERROR: APPLE_TEAM_ID not set${NC}"
    echo "  Create .signing-config with: APPLE_TEAM_ID=YOUR_TEAM_ID"
    exit 1
fi
echo "  ✓ Team ID: $APPLE_TEAM_ID"

SIGNING_IDENTITY="Developer ID Application: Jarmo Tuisk ($APPLE_TEAM_ID)"

if ! security find-identity -v -p codesigning | grep -q "$APPLE_TEAM_ID"; then
    echo -e "${RED}ERROR: Certificate not found in Keychain${NC}"
    exit 1
fi
echo "  ✓ Certificate found in Keychain"

# =============================================================================
# Step 2: Verify entitlements
# =============================================================================
echo ""
echo "[2/7] Checking entitlements..."

if [ ! -f "$ENTITLEMENTS_PATH" ]; then
    echo -e "${RED}ERROR: Entitlements file not found at $ENTITLEMENTS_PATH${NC}"
    echo "  Create branding/entitlements.plist with required entitlements."
    exit 1
fi
echo "  ✓ Entitlements file found: $ENTITLEMENTS_PATH"
echo "  Entitlements:"
grep "<key>" "$ENTITLEMENTS_PATH" | sed 's/.*<key>/    - /; s/<\/key>//'
# =============================================================================
# Step 3: Clean up unnecessary files (webview node_modules, etc.)
# =============================================================================
echo ""
echo "[3/7] Cleaning up unnecessary files..."

# Remove webview node_modules if present (shouldn't be in production bundle)
WEBVIEW_NODE_MODULES="$APP_PATH/Contents/Resources/app/extensions/ritemark/webview/node_modules"
if [ -d "$WEBVIEW_NODE_MODULES" ]; then
    echo "  Removing webview node_modules..."
    rm -rf "$WEBVIEW_NODE_MODULES"
    echo -e "  ${GREEN}✓ Removed webview node_modules${NC}"
else
    echo "  ✓ No webview node_modules to remove"
fi

# Clear extended attributes and quarantine flags
xattr -cr "$APP_PATH" 2>/dev/null || true
echo "  ✓ Cleared extended attributes"

# =============================================================================
# Step 4: Discover ALL native binaries
# =============================================================================
echo ""
echo "[4/7] Discovering all native binaries..."

# Create temp file for binary list
BINARY_LIST=$(mktemp)
trap "rm -f $BINARY_LIST $SIGNED_FILE $FAILED_FILE" EXIT

# Find all Mach-O binaries and libraries
# This catches: executables, .node files, .dylib files, and any other native code
find "$APP_PATH" -type f \( \
    -name "*.node" -o \
    -name "*.dylib" -o \
    -name "rg" -o \
    -name "spawn-helper" -o \
    -name "chrome_crashpad_handler" -o \
    -name "ShipIt" -o \
    -perm +111 \
\) -print0 2>/dev/null | while IFS= read -r -d '' file; do
    # Check if it's actually a Mach-O binary
    if file "$file" 2>/dev/null | grep -q "Mach-O"; then
        echo "$file" >> "$BINARY_LIST"
    fi
done

# Also find .app bundles and .framework bundles
find "$APP_PATH/Contents/Frameworks" -maxdepth 1 -name "*.app" -type d 2>/dev/null >> "$BINARY_LIST" || true
find "$APP_PATH/Contents/Frameworks" -maxdepth 1 -name "*.framework" -type d 2>/dev/null >> "$BINARY_LIST" || true

BINARY_COUNT=$(wc -l < "$BINARY_LIST" | tr -d ' ')
echo "  Found $BINARY_COUNT items to sign"

# =============================================================================
# Step 5: Sign all discovered binaries (inside-out order)
# =============================================================================
echo ""
echo "[5/7] Signing all native binaries..."

# Function to sign a single item
sign_item() {
    local item="$1"
    local use_entitlements="$2"

    if [ "$use_entitlements" = "true" ]; then
        codesign --force --options runtime --timestamp \
            --sign "$SIGNING_IDENTITY" \
            --entitlements "$ENTITLEMENTS_PATH" \
            "$item" 2>&1
    else
        codesign --force --options runtime --timestamp \
            --sign "$SIGNING_IDENTITY" \
            "$item" 2>&1
    fi
}

# Function to verify a signed item
verify_item() {
    local item="$1"
    codesign --verify --strict "$item" 2>&1
}

# 5a. Sign all .node files first (deepest level)
echo "  [5a] Signing .node files..."
while IFS= read -r -d '' nodefile; do
    if file "$nodefile" 2>/dev/null | grep -q "Mach-O"; then
        basename_file=$(basename "$nodefile")
        if sign_item "$nodefile" "false" > /dev/null 2>&1; then
            increment_signed
        else
            echo -e "    ${RED}FAILED: $basename_file${NC}"
            increment_failed
        fi
    fi
done < <(find "$APP_PATH" -name "*.node" -type f -print0 2>/dev/null)
echo "    ✓ .node files signed"

# 5b. Sign all .dylib files
echo "  [5b] Signing .dylib files..."
while IFS= read -r -d '' dylibfile; do
    basename_file=$(basename "$dylibfile")
    if sign_item "$dylibfile" "false" > /dev/null 2>&1; then
        increment_signed
    else
        echo -e "    ${RED}FAILED: $basename_file${NC}"
        increment_failed
    fi
done < <(find "$APP_PATH" -name "*.dylib" -type f -print0 2>/dev/null)
echo "    ✓ .dylib files signed"

# 5c. Sign standalone executables (ripgrep, spawn-helper, crashpad, etc.)
echo "  [5c] Signing standalone executables..."

# ripgrep (rg)
while IFS= read -r -d '' rgfile; do
    if sign_item "$rgfile" "true" > /dev/null 2>&1; then
        echo "    ✓ Signed: rg"
        increment_signed
    else
        echo -e "    ${RED}FAILED: rg${NC}"
        increment_failed
    fi
done < <(find "$APP_PATH" -name "rg" -type f -print0 2>/dev/null)

# spawn-helper (node-pty)
while IFS= read -r -d '' spawnfile; do
    if sign_item "$spawnfile" "true" > /dev/null 2>&1; then
        echo "    ✓ Signed: spawn-helper"
        increment_signed
    else
        echo -e "    ${RED}FAILED: spawn-helper${NC}"
        increment_failed
    fi
done < <(find "$APP_PATH" -name "spawn-helper" -type f -print0 2>/dev/null)

# esbuild binary
while IFS= read -r -d '' esbuildfile; do
    if sign_item "$esbuildfile" "true" > /dev/null 2>&1; then
        echo "    ✓ Signed: esbuild"
        increment_signed
    else
        echo -e "    ${RED}FAILED: esbuild${NC}"
        increment_failed
    fi
done < <(find "$APP_PATH" -name "esbuild" -type f -print0 2>/dev/null)

# chrome_crashpad_handler
while IFS= read -r -d '' crashfile; do
    if sign_item "$crashfile" "true" > /dev/null 2>&1; then
        echo "    ✓ Signed: chrome_crashpad_handler"
        increment_signed
    else
        echo -e "    ${RED}FAILED: chrome_crashpad_handler${NC}"
        increment_failed
    fi
done < <(find "$APP_PATH" -name "chrome_crashpad_handler" -type f -print0 2>/dev/null)

# ShipIt (in Squirrel.framework)
SHIPIT="$APP_PATH/Contents/Frameworks/Squirrel.framework/Versions/A/Resources/ShipIt"
if [ -f "$SHIPIT" ]; then
    if sign_item "$SHIPIT" "true" > /dev/null 2>&1; then
        echo "    ✓ Signed: ShipIt"
        increment_signed
    else
        echo -e "    ${RED}FAILED: ShipIt${NC}"
        increment_failed
    fi
fi

# 5d. Sign frameworks (after their contents are signed)
echo "  [5d] Signing frameworks..."
for fw in Squirrel Mantle ReactiveObjC; do
    FW_PATH="$APP_PATH/Contents/Frameworks/${fw}.framework"
    if [ -d "$FW_PATH" ]; then
        if sign_item "$FW_PATH" "false" > /dev/null 2>&1; then
            echo "    ✓ Signed: ${fw}.framework"
            increment_signed
        else
            echo -e "    ${RED}FAILED: ${fw}.framework${NC}"
            increment_failed
        fi
    fi
done

# Electron Framework (special handling)
ELECTRON_FW="$APP_PATH/Contents/Frameworks/Electron Framework.framework"
if [ -d "$ELECTRON_FW" ]; then
    if sign_item "$ELECTRON_FW" "false" > /dev/null 2>&1; then
        echo "    ✓ Signed: Electron Framework.framework"
        increment_signed
    else
        echo -e "    ${RED}FAILED: Electron Framework.framework${NC}"
        increment_failed
    fi
fi

# 5e. Sign helper apps
echo "  [5e] Signing helper apps..."
while IFS= read -r -d '' helperapp; do
    basename_app=$(basename "$helperapp")
    if sign_item "$helperapp" "true" > /dev/null 2>&1; then
        echo "    ✓ Signed: $basename_app"
        increment_signed
    else
        echo -e "    ${RED}FAILED: $basename_app${NC}"
        increment_failed
    fi
done < <(find "$APP_PATH/Contents/Frameworks" -maxdepth 1 -name "*.app" -type d -print0 2>/dev/null)

echo ""
echo "  Summary: $(get_signed) signed, $(get_failed) failed"

# =============================================================================
# Step 6: Sign the main app bundle
# =============================================================================
echo ""
echo "[6/7] Signing main application bundle..."

if codesign --force --options runtime --timestamp \
    --sign "$SIGNING_IDENTITY" \
    --entitlements "$ENTITLEMENTS_PATH" \
    "$APP_PATH"; then
    echo -e "  ${GREEN}✓ Main application signed${NC}"
else
    echo -e "  ${RED}ERROR: Failed to sign main app${NC}"
    exit 1
fi

# =============================================================================
# Step 7: Comprehensive verification
# =============================================================================
echo ""
echo "[7/7] Verifying all signatures..."

# 7a. Verify main bundle
echo "  Verifying main bundle..."
if codesign --verify --deep --strict "$APP_PATH" 2>&1; then
    echo -e "  ${GREEN}✓ Deep verification passed${NC}"
else
    echo -e "  ${YELLOW}Warning: Deep verification has issues, checking individual components...${NC}"
fi

# 7b. Scan for any unsigned Mach-O binaries
echo ""
echo "  Scanning for unsigned binaries..."
UNSIGNED_FILE=$(mktemp)
echo "0" > "$UNSIGNED_FILE"

while IFS= read -r -d '' file; do
    if file "$file" 2>/dev/null | grep -q "Mach-O"; then
        if ! codesign --verify "$file" 2>/dev/null; then
            echo -e "    ${RED}UNSIGNED: $file${NC}"
            count=$(cat "$UNSIGNED_FILE")
            echo $((count + 1)) > "$UNSIGNED_FILE"
        fi
    fi
done < <(find "$APP_PATH" -type f \( -name "*.node" -o -name "*.dylib" -o -perm +111 \) -print0 2>/dev/null)

UNSIGNED_COUNT=$(cat "$UNSIGNED_FILE")
rm -f "$UNSIGNED_FILE"

if [ "$UNSIGNED_COUNT" -gt 0 ]; then
    echo -e "  ${RED}ERROR: Found $UNSIGNED_COUNT unsigned binaries!${NC}"
    echo "  These will cause notarization to fail."
    exit 1
else
    echo -e "  ${GREEN}✓ All binaries are signed${NC}"
fi

# 7c. Check for hardened runtime and timestamp
echo ""
echo "  Verifying hardened runtime..."
CODESIGN_INFO=$(codesign -dvv "$APP_PATH" 2>&1)
if echo "$CODESIGN_INFO" | grep -q "flags=0x10000(runtime)"; then
    echo -e "  ${GREEN}✓ Hardened runtime enabled${NC}"
else
    echo -e "  ${RED}ERROR: Hardened runtime not enabled${NC}"
    exit 1
fi

if echo "$CODESIGN_INFO" | grep -q "Timestamp="; then
    echo -e "  ${GREEN}✓ Secure timestamp present${NC}"
else
    echo -e "  ${RED}ERROR: No secure timestamp${NC}"
    exit 1
fi

FINAL_SIGNED=$(get_signed)
FINAL_FAILED=$(get_failed)

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Code Signing Complete${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Signed: $FINAL_SIGNED components"
echo "Failed: $FINAL_FAILED components"
echo ""
if [ "$FINAL_FAILED" -gt 0 ]; then
    echo -e "${YELLOW}Warning: Some components failed to sign.${NC}"
    echo "Review the output above and fix issues before notarizing."
    exit 1
fi
echo "Next step: Notarize the app"
echo "  ./scripts/notarize-app.sh"
echo ""
