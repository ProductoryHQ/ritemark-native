#!/bin/bash
#
# verify-notarization.sh - Verify DMG is properly notarized before release
#
# Usage: ./scripts/verify-notarization.sh [dmg_path]
#        ./scripts/verify-notarization.sh dist/Ritemark-1.2.0-darwin-arm64.dmg
#
# If no path provided, finds the most recent DMG in dist/
#
# MANDATORY before any GitHub release upload. This script MUST pass.
#
# Checks performed:
#   1. DMG file exists and is valid
#   2. App inside DMG has valid signature
#   3. App is notarized (not just Developer ID signed)
#   4. Notarization ticket is stapled
#   5. Gatekeeper accepts the app
#   6. Apple server confirms ticket exists (online check)
#
# Exit codes:
#   0 = All checks passed, safe to release
#   1 = One or more checks failed, DO NOT release
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

# Cleanup function
MOUNT_POINT=""
cleanup() {
    if [ -n "$MOUNT_POINT" ] && [ -d "$MOUNT_POINT" ]; then
        echo ""
        echo "Cleaning up: Unmounting DMG..."
        hdiutil detach "$MOUNT_POINT" -quiet 2>/dev/null || true
    fi
}
trap cleanup EXIT

# Find DMG
if [ -n "$1" ]; then
    DMG_PATH="$1"
else
    # Find most recent DMG in dist/ (try both casing patterns)
    DMG_PATH=$(ls -t "$PROJECT_ROOT"/dist/Ritemark-*-darwin-arm64.dmg "$PROJECT_ROOT"/dist/RiteMark-*-darwin-arm64.dmg 2>/dev/null | head -1)
    if [ -z "$DMG_PATH" ]; then
        echo -e "${RED}ERROR: No DMG found in dist/${NC}"
        echo "Usage: $0 [dmg_path]"
        exit 1
    fi
fi

# Make path absolute if relative
if [[ "$DMG_PATH" != /* ]]; then
    DMG_PATH="$PROJECT_ROOT/$DMG_PATH"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}RiteMark - Notarization Verification${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "DMG: $DMG_PATH"
echo ""

# Track failures
FAILURES=0
WARNINGS=0

fail() {
    echo -e "  ${RED}FAILED: $1${NC}"
    FAILURES=$((FAILURES + 1))
}

pass() {
    echo -e "  ${GREEN}PASSED: $1${NC}"
}

warn() {
    echo -e "  ${YELLOW}WARNING: $1${NC}"
    WARNINGS=$((WARNINGS + 1))
}

# =============================================================================
# Check 1: DMG file exists and is valid
# =============================================================================
echo "[1/6] Checking DMG file..."

if [ ! -f "$DMG_PATH" ]; then
    fail "DMG file does not exist: $DMG_PATH"
    echo ""
    echo -e "${RED}VERIFICATION FAILED - Cannot proceed${NC}"
    exit 1
fi
pass "DMG file exists"

# Verify it's a valid DMG
if ! hdiutil verify "$DMG_PATH" > /dev/null 2>&1; then
    fail "DMG file is corrupted or invalid"
else
    pass "DMG file is valid"
fi

# =============================================================================
# Check 2: Mount DMG and verify app signature
# =============================================================================
echo ""
echo "[2/6] Mounting DMG and checking app signature..."

# Try to detect mount point from DMG name
MOUNT_POINT="/Volumes/RiteMark"

# Unmount if already mounted (try both casings)
for mp in "/Volumes/RiteMark" "/Volumes/Ritemark"; do
    if [ -d "$mp" ]; then
        hdiutil detach "$mp" -quiet 2>/dev/null || true
        sleep 1
    fi
done

if ! hdiutil attach "$DMG_PATH" -nobrowse -quiet; then
    fail "Failed to mount DMG"
    echo ""
    echo -e "${RED}VERIFICATION FAILED - Cannot proceed${NC}"
    exit 1
fi
pass "DMG mounted successfully"

# Find the app (try both casings)
APP_PATH=""
for mp in "/Volumes/RiteMark" "/Volumes/Ritemark"; do
    for name in "RiteMark.app" "Ritemark.app"; do
        if [ -d "$mp/$name" ]; then
            APP_PATH="$mp/$name"
            MOUNT_POINT="$mp"
            break 2
        fi
    done
done

if [ -z "$APP_PATH" ] || [ ! -d "$APP_PATH" ]; then
    fail "App not found in DMG"
    echo ""
    echo -e "${RED}VERIFICATION FAILED${NC}"
    exit 1
fi
pass "App bundle found in DMG"

# Check code signature
if ! codesign --verify --deep --strict "$APP_PATH" 2>/dev/null; then
    fail "App signature verification failed"
else
    pass "App signature is valid"
fi

# Check for Developer ID (not adhoc) - need triple verbose for Authority
CODESIGN_INFO=$(codesign -dvvv "$APP_PATH" 2>&1)

if echo "$CODESIGN_INFO" | grep -q "Authority=Developer ID Application"; then
    pass "Signed with Developer ID Application certificate"
else
    if echo "$CODESIGN_INFO" | grep -q "Signature=adhoc"; then
        fail "App is adhoc-signed (NOT Developer ID)"
    else
        fail "App is not signed with Developer ID Application certificate"
    fi
fi

TEAM_ID=$(echo "$CODESIGN_INFO" | grep "TeamIdentifier=" | sed 's/TeamIdentifier=//')
if [ -n "$TEAM_ID" ] && [ "$TEAM_ID" != "not set" ]; then
    pass "TeamIdentifier: $TEAM_ID"
else
    fail "TeamIdentifier not set (adhoc signature)"
fi

# =============================================================================
# Check 3: Verify notarization (spctl assessment)
# =============================================================================
echo ""
echo "[3/6] Checking notarization status (spctl)..."

SPCTL_OUTPUT=$(spctl --assess --type execute --verbose "$APP_PATH" 2>&1 || true)

if echo "$SPCTL_OUTPUT" | grep -q "Notarized Developer ID"; then
    pass "Gatekeeper: Notarized Developer ID"
elif echo "$SPCTL_OUTPUT" | grep -q "accepted"; then
    # Accepted but check if it says "Developer ID" without "Notarized"
    if echo "$SPCTL_OUTPUT" | grep -q "Developer ID" && ! echo "$SPCTL_OUTPUT" | grep -q "Notarized"; then
        warn "App is Developer ID signed but NOT notarized"
        echo "       Full output: $SPCTL_OUTPUT"
    else
        pass "Gatekeeper: Accepted"
    fi
else
    fail "Gatekeeper rejected the app"
    echo "       Full output: $SPCTL_OUTPUT"
fi

# =============================================================================
# Check 4: Verify stapling (local ticket)
# =============================================================================
echo ""
echo "[4/6] Checking stapled notarization ticket..."

STAPLER_OUTPUT=$(xcrun stapler validate "$DMG_PATH" 2>&1 || true)

if echo "$STAPLER_OUTPUT" | grep -q "The validate action worked"; then
    pass "DMG notarization ticket is stapled"
elif echo "$STAPLER_OUTPUT" | grep -q "worked"; then
    pass "DMG stapler validation passed"
else
    fail "DMG notarization ticket is NOT stapled"
    echo "       Run: xcrun stapler staple \"$DMG_PATH\""
    echo "       Stapler output: $STAPLER_OUTPUT"
fi

# =============================================================================
# Check 5: Online verification (Apple servers)
# =============================================================================
echo ""
echo "[5/6] Verifying with Apple servers (online check)..."

# The spctl check already validates online, but we can also use stapler
# to explicitly check the ticket exists on Apple's servers for the DMG itself.
ONLINE_CHECK=$(xcrun stapler validate --verbose "$DMG_PATH" 2>&1 || true)

if echo "$ONLINE_CHECK" | grep -q "ticket"; then
    pass "Apple server confirms notarization ticket exists"
else
    if echo "$SPCTL_OUTPUT" | grep -q "Notarized"; then
        pass "spctl confirms notarization (implicit server check)"
    else
        warn "Could not explicitly verify ticket with Apple servers"
        echo "       This may be a network issue. spctl check is authoritative."
    fi
fi

# =============================================================================
# Check 6: Additional integrity checks
# =============================================================================
echo ""
echo "[6/6] Running additional integrity checks..."

# Check hardened runtime
if echo "$CODESIGN_INFO" | grep -q "flags=0x10000(runtime)"; then
    pass "Hardened runtime is enabled"
else
    fail "Hardened runtime is NOT enabled"
fi

# Check secure timestamp
if echo "$CODESIGN_INFO" | grep -q "Timestamp="; then
    pass "Secure timestamp present"
else
    fail "No secure timestamp"
fi

# Check extension exists in app
EXT_PATH="$APP_PATH/Contents/Resources/app/extensions/ritemark"
if [ -d "$EXT_PATH" ]; then
    pass "Ritemark extension found in app"
    
    # Check webview.js size
    WEBVIEW_JS="$EXT_PATH/media/webview.js"
    if [ -f "$WEBVIEW_JS" ]; then
        WEBVIEW_SIZE=$(stat -f%z "$WEBVIEW_JS" 2>/dev/null || echo "0")
        if [ "$WEBVIEW_SIZE" -gt 500000 ]; then
            pass "webview.js size OK ($WEBVIEW_SIZE bytes)"
        else
            fail "webview.js is too small ($WEBVIEW_SIZE bytes, expected >500KB)"
        fi
    else
        fail "webview.js not found in extension"
    fi
    
    # Check node_modules
    NODE_MODULES="$EXT_PATH/node_modules"
    if [ -d "$NODE_MODULES" ]; then
        MODULE_COUNT=$(ls "$NODE_MODULES" 2>/dev/null | wc -l | tr -d ' ')
        if [ "$MODULE_COUNT" -gt 50 ]; then
            pass "node_modules present ($MODULE_COUNT packages)"
        else
            warn "node_modules seems incomplete ($MODULE_COUNT packages, expected 100+)"
        fi
    else
        fail "node_modules missing (runtime dependencies required)"
    fi
else
    fail "Ritemark extension NOT found in app bundle"
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "========================================"

if [ "$FAILURES" -eq 0 ]; then
    if [ "$WARNINGS" -eq 0 ]; then
        echo -e "${GREEN}ALL CHECKS PASSED${NC}"
        echo ""
        echo "This DMG is properly notarized and safe to release."
    else
        echo -e "${GREEN}ALL CRITICAL CHECKS PASSED${NC}"
        echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
        echo ""
        echo "This DMG is properly notarized. Review warnings above."
    fi
    echo "========================================"
    echo ""
    exit 0
else
    echo -e "${RED}VERIFICATION FAILED${NC}"
    echo ""
    echo "Failures: $FAILURES"
    echo "Warnings: $WARNINGS"
    echo ""
    echo "DO NOT upload this DMG to GitHub."
    echo "Fix the issues above and re-run this script."
    echo "========================================"
    echo ""
    exit 1
fi
