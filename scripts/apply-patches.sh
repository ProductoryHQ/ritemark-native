#!/bin/bash
#
# apply-patches.sh - Apply all RiteMark patches to VS Code submodule
#
# Usage: ./scripts/apply-patches.sh [--dry-run] [--reverse]
#
# Options:
#   --dry-run   Check if patches apply cleanly without actually applying
#   --reverse   Remove patches (unapply)
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
PATCHES_DIR="$ROOT_DIR/patches/vscode"
VSCODE_DIR="$ROOT_DIR/vscode"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
DRY_RUN=false
REVERSE=false
for arg in "$@"; do
    case $arg in
        --dry-run)
            DRY_RUN=true
            ;;
        --reverse)
            REVERSE=true
            ;;
    esac
done

# Check directories exist
if [ ! -d "$PATCHES_DIR" ]; then
    echo -e "${YELLOW}No patches directory found at $PATCHES_DIR${NC}"
    exit 0
fi

if [ ! -d "$VSCODE_DIR" ]; then
    echo -e "${RED}Error: VS Code directory not found at $VSCODE_DIR${NC}"
    exit 1
fi

# Get list of patches (sorted by name for ordering)
PATCHES=($(find "$PATCHES_DIR" -name "*.patch" | sort))

if [ ${#PATCHES[@]} -eq 0 ]; then
    echo -e "${YELLOW}No patches found in $PATCHES_DIR${NC}"
    exit 0
fi

echo "========================================"
echo "RiteMark Patch Applicator"
echo "========================================"
echo ""
echo "Found ${#PATCHES[@]} patch(es):"
for patch in "${PATCHES[@]}"; do
    echo "  - $(basename "$patch")"
done
echo ""

cd "$VSCODE_DIR"

# Track results
APPLIED=0
FAILED=0
SKIPPED=0

for patch in "${PATCHES[@]}"; do
    PATCH_NAME=$(basename "$patch")

    if [ "$DRY_RUN" = true ]; then
        echo -n "Checking $PATCH_NAME... "
        if git apply --check "$patch" 2>/dev/null; then
            echo -e "${GREEN}OK (can apply)${NC}"
            APPLIED=$((APPLIED + 1))
        elif git apply --check --reverse "$patch" 2>/dev/null; then
            echo -e "${YELLOW}Already applied${NC}"
            SKIPPED=$((SKIPPED + 1))
        else
            echo -e "${RED}CONFLICT${NC}"
            FAILED=$((FAILED + 1))
        fi
    elif [ "$REVERSE" = true ]; then
        echo -n "Removing $PATCH_NAME... "
        if git apply --reverse "$patch" 2>/dev/null; then
            echo -e "${GREEN}Done${NC}"
            APPLIED=$((APPLIED + 1))
        elif git apply --check "$patch" 2>/dev/null; then
            echo -e "${YELLOW}Not applied (skipping)${NC}"
            SKIPPED=$((SKIPPED + 1))
        else
            echo -e "${RED}Failed${NC}"
            FAILED=$((FAILED + 1))
        fi
    else
        echo -n "Applying $PATCH_NAME... "
        if git apply --check --reverse "$patch" 2>/dev/null; then
            echo -e "${YELLOW}Already applied (skipping)${NC}"
            SKIPPED=$((SKIPPED + 1))
        elif git apply "$patch" 2>/dev/null; then
            echo -e "${GREEN}Done${NC}"
            APPLIED=$((APPLIED + 1))
        else
            echo -e "${RED}Failed${NC}"
            echo "  Attempting with 3-way merge..."
            if git apply --3way "$patch"; then
                echo -e "  ${GREEN}Applied with merge${NC}"
                APPLIED=$((APPLIED + 1))
            else
                echo -e "  ${RED}Could not apply. Manual intervention needed.${NC}"
                FAILED=$((FAILED + 1))
            fi
        fi
    fi
done

echo ""
echo "========================================"
echo "Summary:"
if [ "$DRY_RUN" = true ]; then
    echo -e "  Can apply: ${GREEN}$APPLIED${NC}"
    echo -e "  Already applied: ${YELLOW}$SKIPPED${NC}"
    echo -e "  Conflicts: ${RED}$FAILED${NC}"
else
    echo -e "  Applied: ${GREEN}$APPLIED${NC}"
    echo -e "  Skipped: ${YELLOW}$SKIPPED${NC}"
    echo -e "  Failed: ${RED}$FAILED${NC}"
fi
echo "========================================"

if [ $FAILED -gt 0 ]; then
    exit 1
fi

# Copy branding assets (only when applying, not reversing or dry-run)
if [ "$DRY_RUN" = false ] && [ "$REVERSE" = false ]; then
    echo ""
    echo "========================================"
    echo "Copying Branding Assets"
    echo "========================================"

    BRANDING_DIR="$ROOT_DIR/branding"

    # Copy icon if it exists
    if [ -f "$BRANDING_DIR/icons/icon.icns" ]; then
        echo -n "Copying macOS icon... "
        cp "$BRANDING_DIR/icons/icon.icns" "$VSCODE_DIR/resources/darwin/code.icns"
        echo -e "${GREEN}Done${NC}"
    fi

    # Copy product.json if it exists (for branding)
    if [ -f "$BRANDING_DIR/product.json" ]; then
        echo -n "Copying product.json... "
        cp "$BRANDING_DIR/product.json" "$VSCODE_DIR/product.json"
        echo -e "${GREEN}Done${NC}"
    fi

    echo "========================================"
fi
