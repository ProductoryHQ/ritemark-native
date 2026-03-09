#!/bin/bash
#
# release-dmg.sh - Safe DMG release to GitHub with mandatory verification
#
# Usage: ./scripts/release-dmg.sh <version> [--dry-run]
#        ./scripts/release-dmg.sh 1.2.0
#        ./scripts/release-dmg.sh 1.2.0 --dry-run
#
# This script:
#   1. Runs verify-notarization.sh (MUST pass)
#   2. Creates stable Ritemark.dmg copy
#   3. Verifies release notes exist
#   4. Uploads to GitHub (jarmo-productory/ritemark-public)
#
# The verify-notarization.sh check is MANDATORY and cannot be skipped.
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
VERSION="$1"
DRY_RUN=""

if [ "$2" = "--dry-run" ]; then
    DRY_RUN="yes"
fi

if [ -z "$VERSION" ]; then
    echo -e "${RED}ERROR: Version required${NC}"
    echo ""
    echo "Usage: $0 <version> [--dry-run]"
    echo "       $0 1.2.0"
    echo "       $0 1.2.0 --dry-run"
    exit 1
fi

# Validate version format (X.Y.Z or X.Y.Z-ext.N)
if ! echo "$VERSION" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+(-ext\.[0-9]+)?$'; then
    echo -e "${RED}ERROR: Invalid version format: $VERSION${NC}"
    echo "Expected: X.Y.Z (e.g., 1.2.0) or X.Y.Z-ext.N (e.g., 1.2.0-ext.1)"
    exit 1
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}RiteMark - Release to GitHub${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Version: v$VERSION"
if [ -n "$DRY_RUN" ]; then
    echo -e "${YELLOW}Mode: DRY RUN (no actual upload)${NC}"
fi
echo ""

# =============================================================================
# Step 1: Find DMG (try both casings)
# =============================================================================
echo "[1/6] Locating DMG..."

DMG_PATH=""
# Try lowercase first
if [ -f "$PROJECT_ROOT/dist/Ritemark-${VERSION}-darwin-arm64.dmg" ]; then
    DMG_PATH="$PROJECT_ROOT/dist/Ritemark-${VERSION}-darwin-arm64.dmg"
# Then try title case
elif [ -f "$PROJECT_ROOT/dist/RiteMark-${VERSION}-darwin-arm64.dmg" ]; then
    DMG_PATH="$PROJECT_ROOT/dist/RiteMark-${VERSION}-darwin-arm64.dmg"
fi

if [ -z "$DMG_PATH" ]; then
    echo -e "${RED}ERROR: DMG not found${NC}"
    echo "Expected: dist/Ritemark-${VERSION}-darwin-arm64.dmg"
    echo "      or: dist/RiteMark-${VERSION}-darwin-arm64.dmg"
    echo ""
    echo "Run ./scripts/create-dmg.sh first"
    exit 1
fi
echo "  Found: $DMG_PATH"

# =============================================================================
# Step 2: MANDATORY notarization verification
# =============================================================================
echo ""
echo "[2/6] Running MANDATORY notarization verification..."
echo ""

if ! "$SCRIPT_DIR/verify-notarization.sh" "$DMG_PATH"; then
    echo ""
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}RELEASE BLOCKED${NC}"
    echo -e "${RED}========================================${NC}"
    echo ""
    echo "Notarization verification failed."
    echo "DO NOT manually upload this DMG."
    echo ""
    echo "Fix the issues and try again."
    exit 1
fi

echo ""
echo -e "${GREEN}Notarization verification PASSED${NC}"

# =============================================================================
# Step 3: Check release notes
# =============================================================================
echo ""
echo "[3/6] Checking release notes..."

NOTES_PATH="$PROJECT_ROOT/docs/releases/v${VERSION}.md"
if [ ! -f "$NOTES_PATH" ]; then
    echo -e "${YELLOW}WARNING: Release notes not found at $NOTES_PATH${NC}"
    echo "  Create release notes or use --notes-file with gh release"
    NOTES_FLAG=""
else
    echo "  Found: $NOTES_PATH"
    NOTES_FLAG="--notes-file $NOTES_PATH"
fi

# =============================================================================
# Step 4: Create stable DMG copy
# =============================================================================
echo ""
echo "[4/6] Creating stable DMG filename..."

STABLE_DMG="$PROJECT_ROOT/dist/Ritemark.dmg"
cp "$DMG_PATH" "$STABLE_DMG"
echo "  Created: $STABLE_DMG"

# =============================================================================
# Step 5: Generate canonical update feed
# =============================================================================
echo ""
echo "[5/6] Generating canonical update feed..."

UPDATE_FEED="$PROJECT_ROOT/dist/update-feed.json"

FEED_ARGS=(
    --mode full
    --version "$VERSION"
    --output "$UPDATE_FEED"
    --asset "$STABLE_DMG|darwin|arm64|Ritemark.dmg"
)

if [ -n "$NOTES_FLAG" ]; then
    FEED_ARGS+=(--notes-file "$NOTES_PATH")
fi

node "$SCRIPT_DIR/generate-update-feed.mjs" "${FEED_ARGS[@]}"

echo "  Created: $UPDATE_FEED"

# =============================================================================
# Step 6: Upload to GitHub
# =============================================================================
echo ""
echo "[6/6] Uploading to GitHub..."

REPO="jarmo-productory/ritemark-public"
TAG="v$VERSION"

# Check if tag already exists
if gh release view "$TAG" --repo "$REPO" > /dev/null 2>&1; then
    echo -e "${RED}ERROR: Release $TAG already exists on GitHub${NC}"
    echo "  Delete the existing release first or use a different version"
    rm -f "$STABLE_DMG"
    exit 1
fi

if [ -n "$DRY_RUN" ]; then
    echo ""
    echo -e "${YELLOW}DRY RUN - Would execute:${NC}"
    echo ""
    echo "  gh release create $TAG \\"
    echo "    --repo $REPO \\"
    echo "    --title \"Ritemark v$VERSION\" \\"
    if [ -n "$NOTES_FLAG" ]; then
        echo "    $NOTES_FLAG \\"
    fi
    echo "    $STABLE_DMG \\"
    echo "    $UPDATE_FEED"
    echo ""
    rm -f "$STABLE_DMG"
    rm -f "$UPDATE_FEED"
else
    echo ""
    echo "Creating GitHub release..."
    
    if [ -n "$NOTES_FLAG" ]; then
        gh release create "$TAG" \
            --repo "$REPO" \
            --title "Ritemark v$VERSION" \
            $NOTES_FLAG \
            "$STABLE_DMG" \
            "$UPDATE_FEED"
    else
        gh release create "$TAG" \
            --repo "$REPO" \
            --title "Ritemark v$VERSION" \
            --notes "Release v$VERSION" \
            "$STABLE_DMG" \
            "$UPDATE_FEED"
    fi
    
    # Clean up stable copy (keep versioned DMG)
    rm -f "$STABLE_DMG"
    rm -f "$UPDATE_FEED"
    
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}RELEASE SUCCESSFUL${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "Version: v$VERSION"
    echo "URL: https://github.com/$REPO/releases/tag/$TAG"
    echo ""
    echo "Stable download URL:"
    echo "  https://github.com/$REPO/releases/latest/download/Ritemark.dmg"
    echo ""
fi
