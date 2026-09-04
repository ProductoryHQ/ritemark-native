#!/bin/bash
#
# apply-patches.sh - Apply all RiteMark patches to VS Code submodule
#
# Usage: ./scripts/apply-patches.sh [--dry-run] [--reverse] [--extension-layout auto|absent]
#
# Options:
#   --dry-run   Check if patches apply cleanly without actually applying
#   --reverse   Remove patches (unapply)
#   --extension-layout absent
#               Keep vscode/extensions/ritemark absent and bind that exact
#               shell-build state into release provenance (Windows CI only)
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
EXTENSION_LAYOUT=auto
while [ "$#" -gt 0 ]; do
    case "$1" in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --reverse)
            REVERSE=true
            shift
            ;;
        --extension-layout)
            if [ "$#" -lt 2 ]; then
                echo -e "${RED}Error: --extension-layout requires auto or absent${NC}" >&2
                exit 2
            fi
            EXTENSION_LAYOUT="$2"
            shift 2
            ;;
        *)
            echo -e "${RED}Error: unknown argument: $1${NC}" >&2
            exit 2
            ;;
    esac
done

case "$EXTENSION_LAYOUT" in
    auto|absent) ;;
    *)
        echo -e "${RED}Error: --extension-layout must be auto or absent${NC}" >&2
        exit 2
        ;;
esac

# Check directories exist
if [ ! -d "$PATCHES_DIR" ]; then
    echo -e "${YELLOW}No patches directory found at $PATCHES_DIR${NC}"
    exit 0
fi

if [ ! -d "$VSCODE_DIR" ]; then
    echo -e "${RED}Error: VS Code directory not found at $VSCODE_DIR${NC}"
    exit 1
fi

if [ "$EXTENSION_LAYOUT" = "absent" ] && \
   { [ -e "$VSCODE_DIR/extensions/ritemark" ] || [ -L "$VSCODE_DIR/extensions/ritemark" ]; }; then
    echo -e "${RED}Error: extension must already be staged outside VS Code for absent layout${NC}" >&2
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
DRY_RUN_INDEX=""

if [ "$DRY_RUN" = true ]; then
    # Validate the canonical stack sequentially against HEAD without touching
    # the worktree. Checking every patch independently is incorrect when a
    # later patch intentionally builds on an earlier patch's hunk. A temporary
    # index also avoids Windows CRLF conversion affecting patch validation.
    DRY_RUN_INDEX="$(mktemp -t ritemark-patch-index.XXXXXX)"
    rm -f "$DRY_RUN_INDEX"
    GIT_INDEX_FILE="$DRY_RUN_INDEX" git read-tree HEAD
    trap 'rm -f "$DRY_RUN_INDEX"' EXIT
fi

patch_paths() {
    awk '
        /^(---|\+\+\+) [ab]\// {
            path = $2
            sub(/^[ab]\//, "", path)
            if (path != "/dev/null") {
                print path
            }
        }
    ' "$@" | sort -u
}

copy_patch_paths_to_temp() {
    local tmp_dir="$1"
    shift

    while IFS= read -r path; do
        if [ -f "$path" ]; then
            mkdir -p "$tmp_dir/$(dirname "$path")"
            cp "$path" "$tmp_dir/$path"
        fi
    done < <(patch_paths "$@")
}

reverse_later_patches_then_check_current() {
    local current_index="$1"
    local current_patch="$2"
    local tmp_dir
    tmp_dir="$(mktemp -d)"

    copy_patch_paths_to_temp "$tmp_dir" "${PATCHES[@]:$current_index}"

    (
        cd "$tmp_dir"
        local later_patch
        for later_patch in "${PATCHES[@]:$((current_index + 1))}"; do
            if git apply --check --reverse "$later_patch" 2>/dev/null; then
                git apply --reverse "$later_patch" 2>/dev/null
            fi
        done

        git apply --check --reverse "$current_patch" 2>/dev/null
    )
    local result=$?
    rm -rf "$tmp_dir"
    return "$result"
}

for patch_index in "${!PATCHES[@]}"; do
    patch="${PATCHES[$patch_index]}"
    PATCH_NAME=$(basename "$patch")

    if [ "$DRY_RUN" = true ]; then
        echo -n "Checking $PATCH_NAME... "
        if GIT_INDEX_FILE="$DRY_RUN_INDEX" git apply --cached "$patch" 2>/dev/null; then
            echo -e "${GREEN}OK (can apply)${NC}"
            APPLIED=$((APPLIED + 1))
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
        elif reverse_later_patches_then_check_current "$patch_index" "$patch"; then
            # Patches that create new files are not always reversible directly
            # in a dirty submodule because those files are intentionally not in
            # the Git index. Verify their exact content in an isolated tree.
            echo -e "${YELLOW}Already applied (content verified)${NC}"
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

if [ -n "$DRY_RUN_INDEX" ]; then
    rm -f "$DRY_RUN_INDEX"
    trap - EXIT
fi

# Copy branding assets (only when applying, not reversing or dry-run)
if [ "$DRY_RUN" = false ] && [ "$REVERSE" = false ]; then
    echo ""
    echo "========================================"
    echo "Copying Branding Assets"
    echo "========================================"

    BRANDING_DIR="$ROOT_DIR/branding"

    # Copy macOS icon if it exists
    if [ -f "$BRANDING_DIR/icons/icon.icns" ]; then
        echo -n "Copying macOS icon... "
        cp "$BRANDING_DIR/icons/icon.icns" "$VSCODE_DIR/resources/darwin/code.icns"
        echo -e "${GREEN}Done${NC}"
    fi

    # Copy Windows icon if it exists
    if [ -f "$BRANDING_DIR/icons/icon.ico" ]; then
        echo -n "Copying Windows icon... "
        mkdir -p "$VSCODE_DIR/resources/win32"
        cp "$BRANDING_DIR/icons/icon.ico" "$VSCODE_DIR/resources/win32/code.ico"
        echo -e "${GREEN}Done${NC}"
    fi

    # Copy Windows tile PNGs if they exist
    if [ -f "$BRANDING_DIR/win32/tile_150x150.png" ]; then
        echo -n "Copying Windows tile icons... "
        cp "$BRANDING_DIR/win32/tile_150x150.png" "$VSCODE_DIR/resources/win32/code_150x150.png"
        cp "$BRANDING_DIR/win32/tile_70x70.png" "$VSCODE_DIR/resources/win32/code_70x70.png"
        echo -e "${GREEN}Done${NC}"
    fi

    # Copy Windows VisualElementsManifest.xml if it exists (CRLF file, handled as copy)
    if [ -f "$BRANDING_DIR/win32/VisualElementsManifest.xml" ]; then
        echo -n "Copying VisualElementsManifest.xml... "
        cp "$BRANDING_DIR/win32/VisualElementsManifest.xml" "$VSCODE_DIR/resources/win32/VisualElementsManifest.xml"
        echo -e "${GREEN}Done${NC}"
    fi

    # Copy titlebar SVG icon if it exists
    if [ -f "$BRANDING_DIR/icons/icon.svg" ]; then
        echo -n "Copying titlebar icon... "
        cp "$BRANDING_DIR/icons/icon.svg" "$VSCODE_DIR/src/vs/workbench/browser/media/code-icon.svg"
        echo -e "${GREEN}Done${NC}"
    fi

    # Copy Welcome media assets if they exist
    if [ -d "$BRANDING_DIR/welcome" ]; then
        echo -n "Copying Welcome media assets... "
        mkdir -p "$VSCODE_DIR/src/vs/workbench/contrib/welcomeGettingStarted/browser/media"
        cp "$BRANDING_DIR/welcome/"* "$VSCODE_DIR/src/vs/workbench/contrib/welcomeGettingStarted/browser/media/"
        echo -e "${GREEN}Done${NC}"
    fi

    # Copy custom font assets required by patched workbench CSS
    UI_FONT_SRC_DIR="$ROOT_DIR/extensions/ritemark/webview/src/assets/fonts"
    PHOSPHOR_FONT_SRC="$VSCODE_DIR/extensions/ritemark/node_modules/@phosphor-icons/web/src/regular/Phosphor.woff2"
    if [ ! -f "$PHOSPHOR_FONT_SRC" ]; then
        PHOSPHOR_FONT_SRC="$ROOT_DIR/extensions/ritemark/node_modules/@phosphor-icons/web/src/regular/Phosphor.woff2"
    fi

    if [ -f "$UI_FONT_SRC_DIR/SofiaSans-latin.woff2" ] && [ -f "$UI_FONT_SRC_DIR/SofiaSans-latin-ext.woff2" ]; then
        echo -n "Copying Sofia Sans workbench fonts... "
        mkdir -p "$VSCODE_DIR/src/vs/workbench/browser/media/fonts"
        cp "$UI_FONT_SRC_DIR/SofiaSans-latin.woff2" "$VSCODE_DIR/src/vs/workbench/browser/media/fonts/"
        cp "$UI_FONT_SRC_DIR/SofiaSans-latin-ext.woff2" "$VSCODE_DIR/src/vs/workbench/browser/media/fonts/"
        echo -e "${GREEN}Done${NC}"
    else
        echo -e "${YELLOW}Sofia Sans font files missing; skipping font copy${NC}"
    fi

    if [ -f "$PHOSPHOR_FONT_SRC" ]; then
        echo -n "Copying Phosphor 400 (Regular) icon font... "
        mkdir -p "$VSCODE_DIR/src/vs/base/browser/ui/codicons/codicon"
        cp "$PHOSPHOR_FONT_SRC" "$VSCODE_DIR/src/vs/base/browser/ui/codicons/codicon/phosphor.woff2"
        echo -e "${GREEN}Done${NC}"
    else
        echo -e "${YELLOW}Phosphor 400 font file missing; skipping icon font copy${NC}"
    fi

    # Copy product.json if it exists (for branding)
    if [ -f "$BRANDING_DIR/product.json" ]; then
        echo -n "Copying product.json... "
        cp "$BRANDING_DIR/product.json" "$VSCODE_DIR/product.json"
        echo -e "${GREEN}Done${NC}"
    fi

    echo "========================================"

    echo ""
    echo "========================================"
    echo "Ensuring Extension Layout"
    echo "========================================"

    EXTENSION_LINK="$VSCODE_DIR/extensions/ritemark"
    EXTENSION_TARGET="../../extensions/ritemark"

    mkdir -p "$VSCODE_DIR/extensions"

    if [ "$EXTENSION_LAYOUT" = "absent" ]; then
        if [ -e "$EXTENSION_LINK" ] || [ -L "$EXTENSION_LINK" ]; then
            echo -e "${RED}Error: extension must already be staged outside VS Code for absent layout${NC}" >&2
            exit 1
        fi
        echo "Extension remains absent for the staged Windows shell build"
    elif [ ! -e "$EXTENSION_LINK" ]; then
        echo -n "Creating extension symlink... "
        ln -s "$EXTENSION_TARGET" "$EXTENSION_LINK"
        echo -e "${GREEN}Done${NC}"
    elif [ -L "$EXTENSION_LINK" ]; then
        CURRENT_TARGET=$(readlink "$EXTENSION_LINK")
        if [ "$CURRENT_TARGET" = "$EXTENSION_TARGET" ]; then
            echo "Extension symlink already correct"
        else
            echo -n "Fixing extension symlink... "
            rm "$EXTENSION_LINK"
            ln -s "$EXTENSION_TARGET" "$EXTENSION_LINK"
            echo -e "${GREEN}Done${NC}"
        fi
    else
        echo -e "${YELLOW}Extension path exists as directory; leaving in place${NC}"
    fi

    echo "========================================"

    # Record the exact derived VS Code diff in the per-worktree Git metadata.
    # Hygiene may later remove a merged worktree only while this fingerprint
    # still matches; any manual VS Code edit invalidates the marker.
    node "$ROOT_DIR/scripts/vscode-derived-state.mjs" --write --repo "$ROOT_DIR"
elif [ "$DRY_RUN" = false ] && [ "$REVERSE" = true ]; then
    node "$ROOT_DIR/scripts/vscode-derived-state.mjs" --clear --repo "$ROOT_DIR"
fi
