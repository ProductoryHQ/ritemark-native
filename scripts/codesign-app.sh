#!/bin/bash
#
# codesign-app.sh - Code sign RiteMark.app with Developer ID
#
# Usage: ./scripts/codesign-app.sh
#
# Prerequisites:
#   1. Apple Developer account enrolled
#   2. "Developer ID Application" certificate in Keychain
#   3. Environment variable or config: APPLE_TEAM_ID
#
# The script will:
#   - Sign all nested frameworks and binaries (--deep)
#   - Enable hardened runtime (required for notarization)
#   - Use secure timestamp
#

set -e

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
echo "[1/4] Checking prerequisites..."

# Check app exists
if [ ! -d "$APP_PATH" ]; then
    echo -e "${RED}ERROR: App not found at $APP_PATH${NC}"
    echo "Build first with: ./scripts/build-prod.sh"
    exit 1
fi
echo "  ✓ App bundle found"

# Check for Team ID
if [ -z "$APPLE_TEAM_ID" ]; then
    # Try to load from config file
    CONFIG_FILE="$PROJECT_ROOT/.signing-config"
    if [ -f "$CONFIG_FILE" ]; then
        source "$CONFIG_FILE"
    fi
fi

if [ -z "$APPLE_TEAM_ID" ]; then
    echo -e "${RED}ERROR: APPLE_TEAM_ID not set${NC}"
    echo ""
    echo "Set it via environment variable:"
    echo "  export APPLE_TEAM_ID=\"YOUR_TEAM_ID\""
    echo ""
    echo "Or create .signing-config file:"
    echo "  echo 'APPLE_TEAM_ID=\"YOUR_TEAM_ID\"' > .signing-config"
    echo ""
    echo "Find your Team ID at: https://developer.apple.com/account"
    echo "Or run: security find-identity -v -p codesigning"
    exit 1
fi
echo "  ✓ Team ID: $APPLE_TEAM_ID"

# Construct signing identity
SIGNING_IDENTITY="Developer ID Application: Jarmo Tuisk ($APPLE_TEAM_ID)"

# Check certificate exists in keychain
if ! security find-identity -v -p codesigning | grep -q "$APPLE_TEAM_ID"; then
    echo -e "${RED}ERROR: Certificate not found in Keychain${NC}"
    echo ""
    echo "Expected identity containing: $APPLE_TEAM_ID"
    echo ""
    echo "Available identities:"
    security find-identity -v -p codesigning
    exit 1
fi
echo "  ✓ Certificate found in Keychain"

# Check entitlements file
if [ ! -f "$ENTITLEMENTS_PATH" ]; then
    echo -e "${YELLOW}WARNING: Entitlements file not found, creating default...${NC}"
    mkdir -p "$(dirname "$ENTITLEMENTS_PATH")"
    cat > "$ENTITLEMENTS_PATH" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- Allow JIT compilation (needed for V8/Electron) -->
    <key>com.apple.security.cs.allow-jit</key>
    <true/>

    <!-- Allow unsigned executable memory (needed for Node.js) -->
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>

    <!-- Allow dyld environment variables (needed for some native modules) -->
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>

    <!-- Network access (for update checks, AI features) -->
    <key>com.apple.security.network.client</key>
    <true/>

    <!-- File access (for editing documents) -->
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
</dict>
</plist>
EOF
    echo "  ✓ Created default entitlements"
fi
echo "  ✓ Entitlements file ready"

# =============================================================================
# Step 2: Remove existing signatures and quarantine
# =============================================================================
echo ""
echo "[2/4] Preparing app for signing..."

# Remove quarantine attribute if present
xattr -cr "$APP_PATH" 2>/dev/null || true
echo "  ✓ Cleared extended attributes"

# Remove existing signatures (codesign --force will do this, but let's be explicit)
echo "  Removing any existing signatures..."
codesign --remove-signature "$APP_PATH" 2>/dev/null || true

# =============================================================================
# Step 3: Sign the app
# =============================================================================
echo ""
echo "[3/4] Signing application..."
echo "  Identity: $SIGNING_IDENTITY"
echo "  This may take a minute..."

# Sign with:
#   --force: Replace any existing signature
#   --deep: Sign nested code (frameworks, helpers)
#   --options runtime: Enable hardened runtime (required for notarization)
#   --timestamp: Include secure timestamp (required for notarization)
#   --entitlements: Apply entitlements for hardened runtime exceptions

codesign --force --deep --options runtime \
    --sign "$SIGNING_IDENTITY" \
    --entitlements "$ENTITLEMENTS_PATH" \
    --timestamp \
    "$APP_PATH"

echo -e "  ${GREEN}✓ Application signed${NC}"

# =============================================================================
# Step 4: Verify signature
# =============================================================================
echo ""
echo "[4/4] Verifying signature..."

# Verify the signature
if codesign --verify --deep --strict --verbose=2 "$APP_PATH" 2>&1 | grep -q "valid on disk"; then
    echo -e "  ${GREEN}✓ Signature valid${NC}"
else
    # Run again to show output
    codesign --verify --deep --strict --verbose=2 "$APP_PATH"
fi

# Check with spctl (Gatekeeper)
echo "  Checking Gatekeeper acceptance..."
if spctl --assess --type execute --verbose "$APP_PATH" 2>&1 | grep -q "accepted"; then
    echo -e "  ${GREEN}✓ Gatekeeper: accepted${NC}"
else
    echo -e "  ${YELLOW}⚠ Gatekeeper: requires notarization${NC}"
    echo "    Run ./scripts/notarize-app.sh next"
fi

# Summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Code Signing Complete${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Signed app: $APP_PATH"
echo ""
echo "Next step: Notarize the app"
echo "  ./scripts/notarize-app.sh"
echo ""
