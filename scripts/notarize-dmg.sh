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
# Exit status: 0 only when Apple's final status is Accepted, the ticket is
# stapled, `stapler validate` passes and Gatekeeper accepts the app inside the
# DMG. Anything else exits 1 with an ERROR line: a refused request (HTTP 403 for
# an expired agreement, bad credentials), no submission id, status Invalid or
# Rejected, a wait that ended without a verdict (timeout), or a failed staple,
# validate, mount or Gatekeeper check. Never pipe this script into tee/tail when
# its exit status matters — the pipeline reports the last command's status.
#
# Test without an Apple submission: ./scripts/test-notarize-dmg.sh
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

# Temp state, removed on every exit
NOTARY_LOG=""
MOUNT_POINT=""
MOUNTED=0

# Print an ERROR line plus optional detail lines, then exit 1
fail() {
    echo -e "${RED}ERROR: $1${NC}"
    shift
    local line
    for line in "$@"; do
        echo "$line"
    done
    exit 1
}

detach_dmg() {
    if [ "$MOUNTED" = 1 ]; then
        hdiutil detach "$MOUNT_POINT" -quiet \
            || hdiutil detach "$MOUNT_POINT" -force -quiet \
            || echo -e "${YELLOW}WARNING: Could not detach $MOUNT_POINT${NC}"
        MOUNTED=0
    fi
    if [ -n "$MOUNT_POINT" ]; then
        rmdir "$MOUNT_POINT" 2>/dev/null || true
        MOUNT_POINT=""
    fi
}

cleanup() {
    detach_dmg
    if [ -n "$NOTARY_LOG" ]; then
        rm -f "$NOTARY_LOG"
    fi
}
trap cleanup EXIT

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

# notarytool's own exit status is taken from PIPESTATUS: the pipeline's
# status is tee's, which is 0 whatever Apple answered.
NOTARY_LOG="$(mktemp "${TMPDIR:-/tmp}/notarize-dmg-output.XXXXXX")"
xcrun notarytool submit "$DMG_PATH" \
    --apple-id "$APPLE_ID" \
    --password "$APPLE_APP_PASSWORD" \
    --team-id "$APPLE_TEAM_ID" \
    --wait \
    --timeout 30m \
    2>&1 | tee "$NOTARY_LOG"
NOTARY_EXIT=${PIPESTATUS[0]}

# notarytool prints "  id: <uuid>" once Apple creates the submission, and a
# final "  status: <Accepted|Invalid|Rejected|In Progress>" when --wait ends.
# The "Current status: ..." progress lines do not start with "status:".
SUBMISSION_ID=$(tr '\r' '\n' < "$NOTARY_LOG" \
    | sed -n 's/^[[:space:]]*id:[[:space:]]*\([^[:space:]]*\).*$/\1/p' | head -1)
NOTARY_RESULT=$(tr '\r' '\n' < "$NOTARY_LOG" \
    | sed -n 's/^[[:space:]]*status:[[:space:]]*//p' | tail -1 | sed 's/[[:space:]]*$//')

# Check result
if [ "$NOTARY_RESULT" = "Accepted" ] && [ "$NOTARY_EXIT" -eq 0 ]; then
    echo -e "  ${GREEN}Notarization successful!${NC}"
elif [ "$NOTARY_RESULT" = "Invalid" ] || [ "$NOTARY_RESULT" = "Rejected" ]; then
    echo -e "${RED}ERROR: Notarization failed - $NOTARY_RESULT${NC}"
    echo ""
    if [ -n "$SUBMISSION_ID" ]; then
        echo "Fetching detailed log..."
        xcrun notarytool log "$SUBMISSION_ID" \
            --apple-id "$APPLE_ID" \
            --password "$APPLE_APP_PASSWORD" \
            --team-id "$APPLE_TEAM_ID" \
            || echo -e "${YELLOW}WARNING: Could not fetch the log for submission $SUBMISSION_ID${NC}"
    fi
    exit 1
elif [ -z "$SUBMISSION_ID" ]; then
    # Apple refused the request before creating a submission: nothing was
    # uploaded, so the DMG is unchanged and a rerun is a fresh submission.
    if grep -qiE "status code: 403|required agreement" "$NOTARY_LOG"; then
        fail "Apple refused the submission (HTTP 403): a required agreement is missing or has expired" \
            "The Account Holder must accept the updated agreement at https://developer.apple.com/account," \
            "then rerun this script. No submission was created and the DMG is unchanged."
    fi
    fail "Apple did not accept the submission (notarytool exit $NOTARY_EXIT, no submission id)" \
        "See notarytool's output above. No submission was created and the DMG is unchanged."
elif [ -z "$NOTARY_RESULT" ] || [ "$NOTARY_RESULT" = "In Progress" ]; then
    fail "Notarization did not finish (last status: ${NOTARY_RESULT:-none}, notarytool exit $NOTARY_EXIT)" \
        "The 30m wait timed out or the connection dropped. Apple keeps processing submission $SUBMISSION_ID." \
        "Check it with: xcrun notarytool info $SUBMISSION_ID --apple-id \"\$APPLE_ID\" --team-id \"\$APPLE_TEAM_ID\" --password ..." \
        "Once it is Accepted, rerun this script (a new submission) or staple and verify by hand."
else
    fail "Unexpected notarization result (status: $NOTARY_RESULT, notarytool exit $NOTARY_EXIT)" \
        "Submission id: $SUBMISSION_ID. See notarytool's output above."
fi

# =============================================================================
# Step 3: Staple the ticket to DMG
# =============================================================================
echo ""
echo "[3/4] Stapling notarization ticket to DMG..."

if ! xcrun stapler staple "$DMG_PATH"; then
    fail "Stapling failed - the DMG has no notarization ticket attached" \
        "Apple accepted submission $SUBMISSION_ID; rerun 'xcrun stapler staple' once the ticket is available."
fi

echo -e "  ${GREEN}Ticket stapled to DMG${NC}"

# =============================================================================
# Step 4: Verify
# =============================================================================
echo ""
echo "[4/4] Verifying notarization..."

# Validate stapling
VALIDATE_EXIT=0
VALIDATE_OUTPUT=$(xcrun stapler validate "$DMG_PATH" 2>&1) || VALIDATE_EXIT=$?
if [ "$VALIDATE_EXIT" -eq 0 ] && grep -q "worked" <<< "$VALIDATE_OUTPUT"; then
    echo -e "  ${GREEN}Stapler validation: PASSED${NC}"
else
    echo "$VALIDATE_OUTPUT"
    fail "Stapler validation failed (exit $VALIDATE_EXIT)"
fi

# Verify with spctl (mount DMG and check app)
echo "  Mounting DMG for Gatekeeper check..."
MOUNT_POINT="$(mktemp -d "${TMPDIR:-/tmp}/ritemark-verify.XXXXXX")"
if ! hdiutil attach "$DMG_PATH" -mountpoint "$MOUNT_POINT" -nobrowse -quiet; then
    fail "Could not mount the DMG for the Gatekeeper check"
fi
MOUNTED=1

if [ ! -d "$MOUNT_POINT/Ritemark.app" ]; then
    fail "Ritemark.app not found in the DMG - Gatekeeper check could not run"
fi

SPCTL_EXIT=0
SPCTL_OUTPUT=$(spctl --assess --type execute --verbose "$MOUNT_POINT/Ritemark.app" 2>&1) || SPCTL_EXIT=$?
if [ "$SPCTL_EXIT" -eq 0 ] && grep -q ": accepted" <<< "$SPCTL_OUTPUT"; then
    echo -e "  ${GREEN}Gatekeeper: ACCEPTED${NC}"
else
    echo "$SPCTL_OUTPUT"
    fail "Gatekeeper rejected Ritemark.app (spctl exit $SPCTL_EXIT)"
fi

detach_dmg

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
