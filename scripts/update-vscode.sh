#!/bin/bash
#
# update-vscode.sh - Update VS Code submodule and re-apply RiteMark patches
#
# Usage: ./scripts/update-vscode.sh [--check] [tag]
#
# Options:
#   --check   Only check if patches will apply, don't actually update
#   tag       Specific VS Code tag to update to (e.g., 1.85.0)
#             If not specified, updates to latest tag
#
# This script:
#   1. Removes existing patches from vscode/
#   2. Pulls the latest (or specified) VS Code release
#   3. Re-applies all RiteMark patches
#   4. Reports any conflicts that need manual resolution
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
VSCODE_DIR="$ROOT_DIR/vscode"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Parse arguments
CHECK_ONLY=false
TARGET_TAG=""
for arg in "$@"; do
    case $arg in
        --check)
            CHECK_ONLY=true
            ;;
        *)
            TARGET_TAG="$arg"
            ;;
    esac
done

echo "========================================"
echo "VS Code Submodule Updater"
echo "========================================"
echo ""

cd "$VSCODE_DIR"

# Get current state
CURRENT_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "unknown")
CURRENT_COMMIT=$(git rev-parse --short HEAD)

echo "Current VS Code version: $CURRENT_TAG ($CURRENT_COMMIT)"

# Fetch latest from upstream
echo ""
echo -e "${CYAN}Fetching from upstream...${NC}"
git fetch --tags origin

# Determine target
if [ -z "$TARGET_TAG" ]; then
    # Get latest release tag (exclude insider builds)
    TARGET_TAG=$(git tag -l '[0-9]*.[0-9]*.[0-9]*' | sort -V | tail -1)
fi

TARGET_COMMIT=$(git rev-parse --short "$TARGET_TAG" 2>/dev/null || echo "unknown")

echo "Target VS Code version: $TARGET_TAG ($TARGET_COMMIT)"
echo ""

if [ "$CURRENT_TAG" = "$TARGET_TAG" ]; then
    echo -e "${GREEN}Already at target version.${NC}"
    echo ""
    echo "Checking patch status..."
    "$SCRIPT_DIR/apply-patches.sh" --dry-run
    exit 0
fi

# Check mode - test if patches will apply to new version
if [ "$CHECK_ONLY" = true ]; then
    echo -e "${CYAN}Check mode: Testing if patches apply to $TARGET_TAG${NC}"
    echo ""

    # Stash any current changes
    git stash -q 2>/dev/null || true

    # Checkout target
    git checkout -q "$TARGET_TAG"

    # Test patches
    "$SCRIPT_DIR/apply-patches.sh" --dry-run
    RESULT=$?

    # Return to previous state
    git checkout -q -
    git stash pop -q 2>/dev/null || true

    exit $RESULT
fi

# Confirm update
echo -e "${YELLOW}This will update VS Code from $CURRENT_TAG to $TARGET_TAG${NC}"
echo ""
read -p "Continue? [y/N] " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

# Step 1: Remove current patches
echo ""
echo -e "${CYAN}Step 1: Removing current patches...${NC}"
"$SCRIPT_DIR/apply-patches.sh" --reverse 2>/dev/null || true

# Step 2: Discard any other local changes
echo ""
echo -e "${CYAN}Step 2: Cleaning local changes...${NC}"
git checkout .
git clean -fd

# Step 3: Update to target
echo ""
echo -e "${CYAN}Step 3: Updating to $TARGET_TAG...${NC}"
git checkout "$TARGET_TAG"

# Step 4: Re-apply patches
echo ""
echo -e "${CYAN}Step 4: Re-applying RiteMark patches...${NC}"
if "$SCRIPT_DIR/apply-patches.sh"; then
    echo ""
    echo -e "${GREEN}========================================"
    echo "Update successful!"
    echo "========================================${NC}"
    echo ""
    echo "VS Code updated: $CURRENT_TAG -> $TARGET_TAG"
    echo "All patches applied successfully."
    echo ""
    echo "Next steps:"
    echo "  1. Rebuild: cd vscode && npm run compile"
    echo "  2. Test the build"
    echo "  3. Update submodule reference: git add vscode && git commit"
else
    echo ""
    echo -e "${RED}========================================"
    echo "Update completed with patch conflicts!"
    echo "========================================${NC}"
    echo ""
    echo "VS Code updated to $TARGET_TAG but some patches failed."
    echo ""
    echo "To fix:"
    echo "  1. Check which patches failed above"
    echo "  2. Manually apply changes or update patch files"
    echo "  3. Re-run: ./scripts/apply-patches.sh"
    echo ""
    echo "To rollback:"
    echo "  git -C vscode checkout $CURRENT_TAG"
    exit 1
fi
