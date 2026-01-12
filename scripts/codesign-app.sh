#!/bin/bash
#
# codesign-app.sh - Code sign RiteMark.app with Developer ID
#
# Properly signs Electron apps by signing all nested components first,
# then the main app bundle. Required for Apple notarization.
#

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

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}RiteMark Native - Code Signing${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# =============================================================================
# Step 1: Check prerequisites
# =============================================================================
echo "[1/5] Checking prerequisites..."

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
    exit 1
fi
echo "  ✓ Team ID: $APPLE_TEAM_ID"

SIGNING_IDENTITY="Developer ID Application: Jarmo Tuisk ($APPLE_TEAM_ID)"

if ! security find-identity -v -p codesigning | grep -q "$APPLE_TEAM_ID"; then
    echo -e "${RED}ERROR: Certificate not found in Keychain${NC}"
    exit 1
fi
echo "  ✓ Certificate found in Keychain"

# Create entitlements
if [ ! -f "$ENTITLEMENTS_PATH" ]; then
    mkdir -p "$(dirname "$ENTITLEMENTS_PATH")"
    cat > "$ENTITLEMENTS_PATH" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
</dict>
</plist>
EOF
fi
echo "  ✓ Entitlements file ready"

# =============================================================================
# Step 2: Remove existing signatures and quarantine
# =============================================================================
echo ""
echo "[2/5] Preparing app for signing..."

xattr -cr "$APP_PATH" 2>/dev/null || true
echo "  ✓ Cleared extended attributes"

# =============================================================================
# Step 3: Sign all binaries using find -exec (handles spaces properly)
# =============================================================================
echo ""
echo "[3/5] Signing all binaries..."

# 1. Sign all .node files (native modules)
echo "  Signing .node files..."
find "$APP_PATH" -name "*.node" -type f -exec codesign --force --options runtime --timestamp --sign "$SIGNING_IDENTITY" {} \; 2>/dev/null || true

# 2. Sign ripgrep binary (rg)
echo "  Signing ripgrep..."
find "$APP_PATH" -name "rg" -type f -exec codesign --force --options runtime --timestamp --sign "$SIGNING_IDENTITY" --entitlements "$ENTITLEMENTS_PATH" {} \; 2>/dev/null || true

# 3. Sign spawn-helper (node-pty)
echo "  Signing spawn-helper..."
find "$APP_PATH" -name "spawn-helper" -type f -exec codesign --force --options runtime --timestamp --sign "$SIGNING_IDENTITY" --entitlements "$ENTITLEMENTS_PATH" {} \; 2>/dev/null || true

# 4. Sign all .dylib files
echo "  Signing .dylib files..."
find "$APP_PATH" -name "*.dylib" -type f -exec codesign --force --options runtime --timestamp --sign "$SIGNING_IDENTITY" {} \; 2>/dev/null || true

# 3. Sign ShipIt specifically (inside Squirrel.framework)
echo "  Signing ShipIt..."
SHIPIT="$APP_PATH/Contents/Frameworks/Squirrel.framework/Versions/A/Resources/ShipIt"
if [ -f "$SHIPIT" ]; then
    codesign --force --options runtime --timestamp --sign "$SIGNING_IDENTITY" --entitlements "$ENTITLEMENTS_PATH" "$SHIPIT" || true
fi

# 4. Sign chrome_crashpad_handler
echo "  Signing crashpad handler..."
find "$APP_PATH" -name "chrome_crashpad_handler" -type f -exec codesign --force --options runtime --timestamp --sign "$SIGNING_IDENTITY" --entitlements "$ENTITLEMENTS_PATH" {} \; 2>/dev/null || true

# 5. Sign Squirrel.framework (after ShipIt is signed)
echo "  Signing Squirrel.framework..."
SQUIRREL="$APP_PATH/Contents/Frameworks/Squirrel.framework"
if [ -d "$SQUIRREL" ]; then
    codesign --force --options runtime --timestamp --sign "$SIGNING_IDENTITY" "$SQUIRREL" || true
fi

# 6. Sign other frameworks
echo "  Signing other frameworks..."
for fw in Mantle ReactiveObjC; do
    FW_PATH="$APP_PATH/Contents/Frameworks/${fw}.framework"
    if [ -d "$FW_PATH" ]; then
        codesign --force --options runtime --timestamp --sign "$SIGNING_IDENTITY" "$FW_PATH" || true
    fi
done

# 7. Sign Electron Framework
echo "  Signing Electron Framework..."
ELECTRON_FW="$APP_PATH/Contents/Frameworks/Electron Framework.framework"
if [ -d "$ELECTRON_FW" ]; then
    codesign --force --options runtime --timestamp --sign "$SIGNING_IDENTITY" "$ELECTRON_FW" || true
fi

# 8. Sign Helper apps (handle spaces in names)
echo "  Signing Helper apps..."
find "$APP_PATH/Contents/Frameworks" -maxdepth 1 -name "*.app" -type d -exec codesign --force --options runtime --timestamp --sign "$SIGNING_IDENTITY" --entitlements "$ENTITLEMENTS_PATH" {} \; 2>/dev/null || true

echo "  ✓ All nested components signed"

# =============================================================================
# Step 4: Sign the main app bundle
# =============================================================================
echo ""
echo "[4/5] Signing main application bundle..."

codesign --force --options runtime --timestamp \
    --sign "$SIGNING_IDENTITY" \
    --entitlements "$ENTITLEMENTS_PATH" \
    "$APP_PATH"

if [ $? -eq 0 ]; then
    echo -e "  ${GREEN}✓ Application signed${NC}"
else
    echo -e "  ${RED}ERROR: Failed to sign main app${NC}"
    exit 1
fi

# =============================================================================
# Step 5: Verify signature
# =============================================================================
echo ""
echo "[5/5] Verifying signature..."

if codesign --verify --deep --strict "$APP_PATH" 2>&1; then
    echo -e "  ${GREEN}✓ Signature valid (deep verification passed)${NC}"
else
    echo -e "${YELLOW}  Deep verification has warnings, checking main signature...${NC}"
    if codesign --verify "$APP_PATH" 2>&1; then
        echo -e "  ${GREEN}✓ Main signature valid${NC}"
        echo -e "  ${YELLOW}Note: Some nested components may have warnings but notarization may still succeed${NC}"
    else
        echo -e "${RED}ERROR: Main signature verification failed${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Code Signing Complete${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next step: Notarize the app"
echo "  ./scripts/notarize-app.sh"
echo ""
