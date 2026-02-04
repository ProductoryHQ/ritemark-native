#!/bin/bash
#
# notarize-dmg.sh - Submit DMG to Apple for notarization
#
# Usage: ./scripts/notarize-dmg.sh <dmg-path>
#        ./scripts/notarize-dmg.sh dist/Ritemark-1.3.0-darwin-arm64.dmg
#
# Prerequisites:
#   1. DMG must be code-signed (create-dmg.sh signs automatically)
#   2. Environment variables (from .signing-config):
#      - APPLE_TEAM_ID: Your team ID
#      - APPLE_ID: Your Apple ID email
#      - APPLE_APP_PASSWORD: App-specific password
#
# The script will:
#   - Submit DMG to Apple's notarization service
#   - Wait for completion (typically 2-10 minutes)
#   - Staple the notarization ticket to the DMG
#
# IMPORTANT: Always notarize the DMG, not the .app!
# This ensures the downloaded file includes the ticket.
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

# Arguments
DMG_PATH="$1"

if [ -z "$DMG_PATH" ]; then
    echo -e "${RED}ERROR: DMG path required${NC}"
    echo ""
    echo "Usage: $0 <dmg-path>"
    echo "       $0 dist/Ritemark-1.3.0-darwin-arm64.dmg"
    exit 1
fi

# Resolve to absolute path
if [[ "$DMG_PATH" != /* ]]; then
    DMG_PATH="$PROJECT_ROOT/$DMG_PATH"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}RiteMark Native - DMG Notarization${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# =============================================================================
# Step 1: Check prerequisites
# =============================================================================
echo "[1/4] Checking prerequisites..."

# Check DMG exists
if [ ! -f "$DMG_PATH" ]; then
    echo -e "${RED}ERROR: DMG not found at $DMG_PATH${NC}"
    exit 1
fi
echo "  DMG: $DMG_PATH"

# Load config if exists
CONFIG_FILE="$PROJECT_ROOT/.signing-config"
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
fi

# Check for credentials
if [ -z "$APPLE_TEAM_ID" ]; then
    echo -e "${RED}ERROR: APPLE_TEAM_ID not set${NC}"
    echo "Create .signing-config with your Apple credentials"
    exit 1
fi
echo "  Team ID: $APPLE_TEAM_ID"

if [ -z "$APPLE_ID" ] || [ -z "$APPLE_APP_PASSWORD" ]; then
    echo -e "${RED}ERROR: Apple credentials not found${NC}"
    echo ""
    echo "Required in .signing-config:"
    echo "  APPLE_ID=\"your@email.com\""
    echo "  APPLE_APP_PASSWORD=\"xxxx-xxxx-xxxx-xxxx\""
    echo ""
    echo "Generate app-specific password at: https://appleid.apple.com"
    exit 1
fi
echo "  Apple ID: $APPLE_ID"

# Verify DMG is signed
echo "  Verifying DMG is signed..."
if ! codesign --verify "$DMG_PATH" 2>/dev/null; then
    echo -e "${RED}ERROR: DMG is not properly signed${NC}"
    echo "The create-dmg.sh script should sign the DMG automatically."
    echo "Check that your signing certificate is available."
    exit 1
fi
echo -e "  ${GREEN}DMG signature verified${NC}"

# =============================================================================
# Step 2: Submit for notarization
# =============================================================================
echo ""
echo "[2/4] Submitting DMG for notarization..."
echo "  This may take several minutes..."

xcrun notarytool submit "$DMG_PATH" \
    --apple-id "$APPLE_ID" \
    --password "$APPLE_APP_PASSWORD" \
    --team-id "$APPLE_TEAM_ID" \
    --wait \
    --timeout 30m \
    2>&1 | tee /tmp/notarize-dmg-output.txt

# Check result
if grep -q "status: Accepted" /tmp/notarize-dmg-output.txt; then
    echo -e "  ${GREEN}Notarization successful!${NC}"
elif grep -q "status: Invalid" /tmp/notarize-dmg-output.txt; then
    echo -e "${RED}ERROR: Notarization failed - Invalid${NC}"
    echo ""
    # Extract submission ID and get log
    SUBMISSION_ID=$(grep "id:" /tmp/notarize-dmg-output.txt | head -1 | awk '{print $2}')
    if [ -n "$SUBMISSION_ID" ]; then
        echo "Fetching detailed log..."
        xcrun notarytool log "$SUBMISSION_ID" \
            --apple-id "$APPLE_ID" \
            --password "$APPLE_APP_PASSWORD" \
            --team-id "$APPLE_TEAM_ID"
    fi
    exit 1
else
    echo -e "${YELLOW}WARNING: Unexpected notarization result${NC}"
    cat /tmp/notarize-dmg-output.txt
fi

# =============================================================================
# Step 3: Staple the ticket to DMG
# =============================================================================
echo ""
echo "[3/4] Stapling notarization ticket to DMG..."

xcrun stapler staple "$DMG_PATH"

echo -e "  ${GREEN}Ticket stapled to DMG${NC}"

# =============================================================================
# Step 4: Verify
# =============================================================================
echo ""
echo "[4/4] Verifying notarization..."

# Validate stapling
if xcrun stapler validate "$DMG_PATH" 2>&1 | grep -q "worked"; then
    echo -e "  ${GREEN}Stapler validation: PASSED${NC}"
else
    echo -e "${YELLOW}WARNING: Stapler validation unclear${NC}"
    xcrun stapler validate "$DMG_PATH"
fi

# Verify with spctl (mount DMG and check app)
echo "  Mounting DMG for Gatekeeper check..."
MOUNT_POINT="/tmp/ritemark-verify-$$"
mkdir -p "$MOUNT_POINT"
hdiutil attach "$DMG_PATH" -mountpoint "$MOUNT_POINT" -nobrowse -quiet

if [ -d "$MOUNT_POINT/Ritemark.app" ]; then
    if spctl --assess --type execute --verbose "$MOUNT_POINT/Ritemark.app" 2>&1 | grep -q "accepted"; then
        echo -e "  ${GREEN}Gatekeeper: ACCEPTED${NC}"
    else
        echo -e "${YELLOW}WARNING: Gatekeeper check:${NC}"
        spctl --assess --type execute --verbose "$MOUNT_POINT/Ritemark.app" 2>&1
    fi
fi

hdiutil detach "$MOUNT_POINT" -quiet
rmdir "$MOUNT_POINT" 2>/dev/null || true

# Summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}DMG Notarization Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "DMG: $DMG_PATH"
echo ""
echo "The DMG is now:"
echo "  - Notarized by Apple"
echo "  - Has ticket stapled (works offline)"
echo "  - Ready for distribution"
echo ""
echo "Users can download and open without Gatekeeper warnings."
echo ""
