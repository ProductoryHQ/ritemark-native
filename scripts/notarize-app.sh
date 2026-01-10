#!/bin/bash
#
# notarize-app.sh - Submit RiteMark.app to Apple for notarization
#
# Usage: ./scripts/notarize-app.sh
#
# Prerequisites:
#   1. App must be signed first (./scripts/codesign-app.sh)
#   2. App Store Connect API key OR Apple ID credentials
#   3. Environment variables:
#      - APPLE_TEAM_ID: Your team ID
#      - APPLE_ID: Your Apple ID email (for altool method)
#      - APPLE_APP_PASSWORD: App-specific password (for altool method)
#      OR
#      - NOTARIZE_KEY_ID: App Store Connect API key ID
#      - NOTARIZE_KEY_ISSUER: API key issuer ID
#      - NOTARIZE_KEY_PATH: Path to .p8 key file
#
# The script will:
#   - Create a ZIP of the app for upload
#   - Submit to Apple's notarization service
#   - Wait for completion (typically 2-5 minutes)
#   - Staple the notarization ticket to the app
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
ZIP_PATH="$PROJECT_ROOT/VSCode-darwin-arm64/RiteMark-notarize.zip"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}RiteMark Native - Notarization${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# =============================================================================
# Step 1: Check prerequisites
# =============================================================================
echo "[1/5] Checking prerequisites..."

# Check app exists
if [ ! -d "$APP_PATH" ]; then
    echo -e "${RED}ERROR: App not found at $APP_PATH${NC}"
    exit 1
fi
echo "  ✓ App bundle found"

# Load config if exists
CONFIG_FILE="$PROJECT_ROOT/.signing-config"
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
fi

# Check for credentials
if [ -z "$APPLE_TEAM_ID" ]; then
    echo -e "${RED}ERROR: APPLE_TEAM_ID not set${NC}"
    exit 1
fi
echo "  ✓ Team ID: $APPLE_TEAM_ID"

# Check which authentication method to use
if [ -n "$NOTARIZE_KEY_ID" ] && [ -n "$NOTARIZE_KEY_ISSUER" ] && [ -n "$NOTARIZE_KEY_PATH" ]; then
    AUTH_METHOD="apikey"
    echo "  ✓ Using App Store Connect API key"
elif [ -n "$APPLE_ID" ] && [ -n "$APPLE_APP_PASSWORD" ]; then
    AUTH_METHOD="password"
    echo "  ✓ Using Apple ID + app-specific password"
else
    echo -e "${RED}ERROR: No notarization credentials found${NC}"
    echo ""
    echo "Option 1 - App Store Connect API Key (recommended):"
    echo "  export NOTARIZE_KEY_ID=\"YOUR_KEY_ID\""
    echo "  export NOTARIZE_KEY_ISSUER=\"YOUR_ISSUER_ID\""
    echo "  export NOTARIZE_KEY_PATH=\"/path/to/AuthKey_XXX.p8\""
    echo ""
    echo "Option 2 - Apple ID with app-specific password:"
    echo "  export APPLE_ID=\"your@email.com\""
    echo "  export APPLE_APP_PASSWORD=\"xxxx-xxxx-xxxx-xxxx\""
    echo ""
    echo "Generate app-specific password at: https://appleid.apple.com"
    exit 1
fi

# Verify app is signed
echo "  Verifying app is signed..."
if ! codesign --verify --deep --strict "$APP_PATH" 2>/dev/null; then
    echo -e "${RED}ERROR: App is not properly signed${NC}"
    echo "Run ./scripts/codesign-app.sh first"
    exit 1
fi
echo "  ✓ App signature verified"

# =============================================================================
# Step 2: Create ZIP for upload
# =============================================================================
echo ""
echo "[2/5] Creating ZIP for upload..."

# Remove old ZIP if exists
rm -f "$ZIP_PATH"

# Create ZIP (ditto preserves code signatures better than zip)
ditto -c -k --keepParent "$APP_PATH" "$ZIP_PATH"

ZIP_SIZE=$(du -h "$ZIP_PATH" | cut -f1)
echo "  ✓ Created: $ZIP_PATH ($ZIP_SIZE)"

# =============================================================================
# Step 3: Submit for notarization
# =============================================================================
echo ""
echo "[3/5] Submitting for notarization..."
echo "  This upload may take a few minutes..."

if [ "$AUTH_METHOD" = "apikey" ]; then
    # Use notarytool with API key (modern method, Xcode 13+)
    xcrun notarytool submit "$ZIP_PATH" \
        --key "$NOTARIZE_KEY_PATH" \
        --key-id "$NOTARIZE_KEY_ID" \
        --issuer "$NOTARIZE_KEY_ISSUER" \
        --wait \
        --timeout 30m \
        2>&1 | tee /tmp/notarize-output.txt
else
    # Use notarytool with Apple ID (requires app-specific password)
    xcrun notarytool submit "$ZIP_PATH" \
        --apple-id "$APPLE_ID" \
        --password "$APPLE_APP_PASSWORD" \
        --team-id "$APPLE_TEAM_ID" \
        --wait \
        --timeout 30m \
        2>&1 | tee /tmp/notarize-output.txt
fi

# Check result
if grep -q "status: Accepted" /tmp/notarize-output.txt; then
    echo -e "  ${GREEN}✓ Notarization successful!${NC}"
elif grep -q "status: Invalid" /tmp/notarize-output.txt; then
    echo -e "${RED}ERROR: Notarization failed - Invalid${NC}"
    echo ""
    echo "Check the log for details:"
    # Extract submission ID and get log
    SUBMISSION_ID=$(grep "id:" /tmp/notarize-output.txt | head -1 | awk '{print $2}')
    if [ -n "$SUBMISSION_ID" ]; then
        echo "Fetching detailed log..."
        if [ "$AUTH_METHOD" = "apikey" ]; then
            xcrun notarytool log "$SUBMISSION_ID" \
                --key "$NOTARIZE_KEY_PATH" \
                --key-id "$NOTARIZE_KEY_ID" \
                --issuer "$NOTARIZE_KEY_ISSUER"
        else
            xcrun notarytool log "$SUBMISSION_ID" \
                --apple-id "$APPLE_ID" \
                --password "$APPLE_APP_PASSWORD" \
                --team-id "$APPLE_TEAM_ID"
        fi
    fi
    rm -f "$ZIP_PATH"
    exit 1
else
    echo -e "${YELLOW}WARNING: Unexpected notarization result${NC}"
    cat /tmp/notarize-output.txt
fi

# =============================================================================
# Step 4: Staple the ticket
# =============================================================================
echo ""
echo "[4/5] Stapling notarization ticket..."

xcrun stapler staple "$APP_PATH"

echo -e "  ${GREEN}✓ Ticket stapled to app${NC}"

# =============================================================================
# Step 5: Clean up and verify
# =============================================================================
echo ""
echo "[5/5] Cleaning up and verifying..."

# Remove temporary ZIP
rm -f "$ZIP_PATH"
echo "  ✓ Removed temporary ZIP"

# Final verification with Gatekeeper
echo "  Running Gatekeeper check..."
if spctl --assess --type execute --verbose "$APP_PATH" 2>&1 | grep -q "accepted"; then
    echo -e "  ${GREEN}✓ Gatekeeper: ACCEPTED${NC}"
else
    spctl --assess --type execute --verbose "$APP_PATH" 2>&1
fi

# Summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Notarization Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Your app is now signed and notarized."
echo "Users can download and run it without Gatekeeper warnings."
echo ""
echo "Next step: Create DMG"
echo "  ./scripts/create-dmg.sh"
echo ""
