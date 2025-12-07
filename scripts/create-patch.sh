#!/bin/bash
#
# create-patch.sh - Create a new patch from changes in VS Code submodule
#
# Usage: ./scripts/create-patch.sh <patch-name> [file-path]
#
# Examples:
#   ./scripts/create-patch.sh "terminal-right-sidebar"
#   ./scripts/create-patch.sh "custom-theme" src/vs/workbench/browser/style.css
#
# The script will:
#   1. Find the next available patch number (001, 002, etc.)
#   2. Generate a diff from your changes
#   3. Save it with a descriptive header
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
PATCHES_DIR="$ROOT_DIR/patches/vscode"
VSCODE_DIR="$ROOT_DIR/vscode"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Check arguments
if [ -z "$1" ]; then
    echo -e "${RED}Error: Please provide a patch name${NC}"
    echo ""
    echo "Usage: $0 <patch-name> [file-path]"
    echo ""
    echo "Examples:"
    echo "  $0 \"terminal-right-sidebar\""
    echo "  $0 \"custom-theme\" src/vs/workbench/browser/style.css"
    exit 1
fi

PATCH_NAME="$1"
FILE_PATH="$2"

# Ensure patches directory exists
mkdir -p "$PATCHES_DIR"

# Find next patch number
LAST_NUM=$(find "$PATCHES_DIR" -name "*.patch" | sed 's/.*\/\([0-9]*\)-.*/\1/' | sort -n | tail -1)
if [ -z "$LAST_NUM" ]; then
    NEXT_NUM="001"
else
    NEXT_NUM=$(printf "%03d" $((10#$LAST_NUM + 1)))
fi

# Sanitize patch name (lowercase, hyphens)
SAFE_NAME=$(echo "$PATCH_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd '[:alnum:]-')
PATCH_FILE="$PATCHES_DIR/${NEXT_NUM}-${SAFE_NAME}.patch"

cd "$VSCODE_DIR"

# Check for changes
if [ -n "$FILE_PATH" ]; then
    DIFF=$(git diff "$FILE_PATH")
    DIFF_FILES="$FILE_PATH"
else
    DIFF=$(git diff)
    DIFF_FILES=$(git diff --name-only | tr '\n' ', ' | sed 's/,$//')
fi

if [ -z "$DIFF" ]; then
    echo -e "${YELLOW}No changes found in VS Code submodule${NC}"
    if [ -n "$FILE_PATH" ]; then
        echo "Checked file: $FILE_PATH"
    fi
    echo ""
    echo "Make your changes first, then run this script."
    exit 1
fi

# Prompt for description
echo -e "${CYAN}Creating patch: ${NEXT_NUM}-${SAFE_NAME}.patch${NC}"
echo ""
echo "Files changed:"
echo "  $DIFF_FILES"
echo ""
read -p "Brief description of this patch (one line): " DESCRIPTION
echo ""
read -p "Why is this change needed? " REASON

# Create patch with header
cat > "$PATCH_FILE" << EOF
# RiteMark Patch: $PATCH_NAME
#
# Purpose: $DESCRIPTION
#
# Why: $REASON
#
# File(s): $DIFF_FILES
# Created: $(date +%Y-%m-%d)
#
$DIFF
EOF

echo ""
echo -e "${GREEN}Patch created successfully!${NC}"
echo ""
echo "  File: $PATCH_FILE"
echo ""
echo "Next steps:"
echo "  1. Review the patch: cat $PATCH_FILE"
echo "  2. Test it: ./scripts/apply-patches.sh --dry-run"
echo "  3. Commit the patch file to git"
echo ""
echo -e "${YELLOW}Note: The changes in vscode/ are still applied.${NC}"
echo "To reset vscode/ to clean state: cd vscode && git checkout ."
echo "Then re-apply patches: ./scripts/apply-patches.sh"
