#!/bin/bash
#
# update-vscode.sh - Update VS Code submodule and re-apply RiteMark patches
#
# Usage: ./scripts/update-vscode.sh <tag>
#        ./scripts/update-vscode.sh --check <tag>
#
# Options:
#   --check   Only measure whether the patches apply to <tag>. Runs
#             check-vscode-drift.sh, which works in a temporary clone and
#             touches nothing here: no stash and no checkout in vscode/.
#   tag       The VS Code release to update to (e.g., 1.142.0). Required:
#             the vscode/ submodule is shallow and its tags stop long before
#             the newest release. Read the newest from GitHub:
#               gh api 'repos/microsoft/vscode/releases?per_page=5' --jq '.[].tag_name'
#
# This script:
#   1. Fetches exactly <tag> into vscode/
#   2. Resets vscode/ to a pristine tree at <tag>, keeping the extension link
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

if [ -z "$TARGET_TAG" ]; then
    echo "Usage: $0 [--check] <tag>" >&2
    echo "" >&2
    echo "The tag is required. The newest VS Code releases:" >&2
    echo "  gh api 'repos/microsoft/vscode/releases?per_page=5' --jq '.[].tag_name'" >&2
    exit 2
fi

# Check mode - measure the drift in a temporary clone; nothing here is touched
if [ "$CHECK_ONLY" = true ]; then
    exec "$SCRIPT_DIR/check-vscode-drift.sh" "$TARGET_TAG"
fi

echo "========================================"
echo "VS Code Submodule Updater"
echo "========================================"
echo ""

cd "$VSCODE_DIR"

# Get current state
CURRENT_COMMIT=$(git rev-parse HEAD)
CURRENT_NODE=$(tr -d '[:space:]' < "$VSCODE_DIR/.nvmrc" 2>/dev/null || echo "unknown")

echo "Current VS Code commit: $CURRENT_COMMIT (Node $CURRENT_NODE)"

# Fetch exactly the target tag from upstream
echo ""
echo -e "${CYAN}Fetching $TARGET_TAG from upstream...${NC}"
git fetch --depth 1 origin tag "$TARGET_TAG"

TARGET_COMMIT=$(git rev-parse "$TARGET_TAG^{commit}")

echo "Target VS Code version: $TARGET_TAG ($TARGET_COMMIT)"
echo ""

if [ "$CURRENT_COMMIT" = "$TARGET_COMMIT" ]; then
    echo -e "${GREEN}Already at target version.${NC}"
    echo ""
    echo "Checking patch status..."
    "$SCRIPT_DIR/apply-patches.sh" --dry-run
    exit 0
fi

# Confirm update
echo -e "${YELLOW}This will update VS Code from $CURRENT_COMMIT to $TARGET_TAG${NC}"
echo "Local changes in vscode/ (the applied patches and anything else) are discarded."
echo ""
read -p "Continue? [y/N] " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

# Step 1: Discard the applied patches and any other local changes. The clean
# removes the files patches create; -e keeps the dev extension symlink
# (vscode/extensions/ritemark -> ../../extensions/ritemark).
echo ""
echo -e "${CYAN}Step 1: Resetting vscode/ to a pristine tree...${NC}"
git reset -q --hard HEAD
git clean -fd -e extensions/ritemark

# Step 2: Check out the target
echo ""
echo -e "${CYAN}Step 2: Checking out $TARGET_TAG...${NC}"
git checkout -q --detach "$TARGET_COMMIT"
git clean -fd -e extensions/ritemark
# Stage the new gitlink now. .gitmodules sets ignore = all, so git status and git diff do not show that the pin moved,
# and git add vscode stages nothing: a branch can carry rebased patches over the old pin unnoticed (Sprint 135)
git -C "$ROOT_DIR" update-index --cacheinfo "160000,$TARGET_COMMIT,vscode"

TARGET_NODE=$(tr -d '[:space:]' < "$VSCODE_DIR/.nvmrc" 2>/dev/null || echo "unknown")
ROOT_NODE=$(tr -d '[:space:]' < "$ROOT_DIR/.nvmrc" 2>/dev/null || echo "unknown")
NODE_CHANGED=false
if [ "$TARGET_NODE" != "$ROOT_NODE" ]; then
    NODE_CHANGED=true
fi

# Step 3: Re-apply patches
echo ""
echo -e "${CYAN}Step 3: Re-applying RiteMark patches...${NC}"
if "$SCRIPT_DIR/apply-patches.sh"; then
    # Step 4: Wipe stale built-in extension out/ dirs
    # Upstream commits sometimes flip an extension to ESM (e.g. 91b02efb235 in 1.117.0
    # for HTML/CSS/JSON language servers) by changing package.json + tsconfig but leave
    # the existing tsc-compiled out/ alone. Gulp's incremental compile then sees fresh
    # mtimes and skips rebuild — Node 22 loads CJS .js as ESM and the LSP server crashes.
    # GitHub issue #41. Cheap to always wipe; the next compile recreates them.
    echo ""
    echo -e "${CYAN}Step 4: Wiping stale built-in extension compiled output...${NC}"
    WIPED=0
    # Match only first-party extension build output, e.g. extensions/<ext>/server/out
    # and extensions/<ext>/client/out. Exclude paths under node_modules.
    while IFS= read -r out_dir; do
        rm -rf "$out_dir"
        WIPED=$((WIPED + 1))
    done < <(find "$VSCODE_DIR/extensions" -path '*/node_modules' -prune -o \
        -type d \( -path '*/server/out' -o -path '*/client/out' \) -print 2>/dev/null)
    echo "  Wiped $WIPED out/ dir(s) under vscode/extensions/. Will be rebuilt by 'npm run compile'."

    # Step 5: Native module arch check (warn-only)
    # GitHub issue #39 — npm install from a non-arm64 shell rebuilds native modules as
    # x86_64, breaking dlopen at runtime. This checks the node_modules that are there
    # now; after the npm ci below, run it again.
    echo ""
    echo -e "${CYAN}Step 5: Checking VS Code native module architecture...${NC}"
    if ! "$SCRIPT_DIR/check-native-modules.sh"; then
        echo ""
        echo -e "${YELLOW}Warning: native modules need rebuilding (see command above).${NC}"
    fi

    echo ""
    echo -e "${GREEN}========================================"
    echo "Update successful!"
    echo "========================================${NC}"
    echo ""
    echo "VS Code updated: $CURRENT_COMMIT -> $TARGET_TAG ($TARGET_COMMIT)"
    echo "All patches applied successfully."
    echo ""
    echo "Next steps:"
    if [ "$NODE_CHANGED" = true ]; then
        echo -e "  ${YELLOW}0. Node changes with this release: $ROOT_NODE -> $TARGET_NODE (vscode/.nvmrc).${NC}"
        echo "     In one commit, set it in the repository root .nvmrc and in the workflows that pin Node:"
        echo "       build-windows.yml, build-macos-x64.yml, windows-canary.yml, windows-test-overlay.yml,"
        echo "       build-whisper.yml, agent-runtime-matrix.yml (then grep for $ROOT_NODE outside docs/ and vscode/)."
        echo "     Install it as arm64: arch -arm64 /bin/zsh -c 'source \"\$HOME/.nvm/nvm.sh\" && nvm install $TARGET_NODE'"
        echo "     Re-check the Windows node-gyp workarounds in build-windows.yml and windows-canary.yml for the new npm."
    fi
    echo "  1. Install and rebuild under the arm64 wrapper, then check the native modules again:"
    echo "       arch -arm64 /bin/zsh -c 'unset ELECTRON_RUN_AS_NODE; source \"\$HOME/.nvm/nvm.sh\" && nvm use && cd vscode && npm ci && npm run compile'"
    echo "       ./scripts/check-native-modules.sh"
    echo "  2. The default-drift scan: review every new or changed 'default': that touches what people see,"
    echo "       git -C vscode diff $CURRENT_COMMIT $TARGET_COMMIT -- src/vs/workbench/browser/workbench.contribution.ts"
    echo "     (and the other contribution files that register chrome settings), and pin what Ritemark's look"
    echo "     depends on in branding/product.json configurationDefaults."
    echo "  3. The product.json merge: branding/product.json replaces upstream's whole. Merge the fields upstream added:"
    echo "       git -C vscode diff $CURRENT_COMMIT $TARGET_COMMIT -- product.json src/vs/base/common/product.ts"
    echo "  4. Test the build (dev mode + production). In the production build, launched on a fresh profile:"
    echo "       - validate-build-output.sh passes (Check 5e: product.json names Ritemark's source commit);"
    echo "       - no agent host at launch: no agenthost.log and no 'agent host started' in main.log for a minute"
    echo "         (003 removes the prewarm; with a commit the agent host would start GitHub's Copilot runtime);"
    echo "       - a terminal runs a command and code is coloured (both load from node_modules.asar)."
    echo "  5. Check Ritemark's frame in a dev instance (fresh profile, the sample project; docs/development/frame-baseline/README.md):"
    echo "       node scripts/qa/frame-geometry.mjs --port <cdp-port>"
    echo "       node scripts/qa/frame-screenshots.mjs --port <cdp-port> --out <folder> --compare docs/development/frame-baseline"
    echo "     A changed scene is fixed, or shown to Jarmo for a new baseline."
    echo "  6. Re-check the upstream places the project at the centre leans on (Sprint 134), under vscode/src/vs/:"
    echo "       - workbench/contrib/splash/browser/partsSplash.ts: _savePartsSplash still saves the splash; 018 saves ritemark.ground there."
    echo "       - workbench/services/host/electron-browser/nativeHostService.ts: doOpenWindow still opens a folder in this window; 018 notes the switch target there."
    echo "       - workbench/services/lifecycle/common/lifecycle.ts: ShutdownReason.LOAD still means another folder in this window,"
    echo "         and RELOAD, QUIT and CLOSE still mean Reload Window, quitting and closing (018's ritemarkSwitchGuard.ts asks only on LOAD)."
    echo "       - workbench/contrib/quickaccess/browser/commandsQuickAccess.ts: 003's palette filter still sits where getCommandPicks returns."
    echo "         Run the palette audit's search again for new developer commands"
    echo "         (docs/development/releases/v2.0.0/sprint-134-project-at-the-centre/research/palette-audit.md)."
    echo "       - workbench/contrib/files/browser/views/explorerViewer.ts: 018's case in FilesFilter (the pointer CLAUDE.md)"
    echo "         and in getAriaLabel (About this project)."
    echo "       - workbench/contrib/browserView/common/browserView.ts: if upstream changed setSharedWithAgent, change 009's"
    echo "         shareWithAgentAnswered to match its Allow path (the network policy's notice, the stored choice, sharing)."
    echo "       - The internal command _workbench.getRecentlyOpened still exists (the project list's first fill, extensions/ritemark/src/projects/projectsHost.ts)."
    echo "     Then, in vscode/: ./scripts/test.sh --grep Ritemark (ritemarkSwitchGuard, ritemarkPalettePolicy, ritemarkTabCount)."
    echo "  7. Commit the new pin: the script staged the gitlink (git update-index). git status and git add vscode ignore the"
    echo "     submodule (.gitmodules sets ignore = all); after committing, git ls-tree HEAD vscode must print $TARGET_COMMIT"
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
    echo "  git -C vscode reset -q --hard HEAD && git -C vscode clean -fd -e extensions/ritemark"
    echo "  git -C vscode checkout -q --detach $CURRENT_COMMIT && ./scripts/apply-patches.sh"
    echo "  git update-index --cacheinfo 160000,$CURRENT_COMMIT,vscode   # the staged pin back to the old version"
    exit 1
fi
