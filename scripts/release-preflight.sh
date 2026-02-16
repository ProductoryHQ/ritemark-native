#!/bin/bash
#
# release-preflight.sh - Pre-flight quality checks before release
#
# Usage: ./scripts/release-preflight.sh [--quick] [--ci-only]
#
#   --quick    Skip slow checks (peer deps, TS compilation) — ~1 min
#   --ci-only  Only run CI-relevant checks (patches + workflows) — ~30s
#   (default)  Full check — ~3 min
#
# This script MUST pass before:
#   1. Version bump
#   2. Any build process
#   3. Tag creation / push
#
# If ANY check fails, DO NOT proceed with release.
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Counters
ERRORS=0
WARNINGS=0

# Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
EXTENSION_DIR="$PROJECT_ROOT/extensions/ritemark"
WEBVIEW_DIR="$EXTENSION_DIR/webview"
PATCHES_DIR="$PROJECT_ROOT/patches/vscode"
VSCODE_TAG="1.94.0"

# Parse arguments
MODE="full"
SKIP_MACOS_CHECKS=0
SKIP_DEPENDENCY_CHECKS=0

for arg in "$@"; do
    case $arg in
        --quick) MODE="quick" ;;
        --ci-only) MODE="ci" ;;
        --help|-h)
            echo "Usage: $0 [--quick] [--ci-only]"
            echo ""
            echo "  --quick    Skip slow checks (~1 min)"
            echo "  --ci-only  Only CI-relevant checks (~30s)"
            echo "  (default)  Full check (~3 min)"
            exit 0
            ;;
    esac
done

# =============================================================================
# Helper functions
# =============================================================================

check_pass() { echo -e "  ${GREEN}✓${NC} $1"; }
check_fail() { echo -e "  ${RED}✗${NC} $1"; ((ERRORS++)) || true; }
check_warn() { echo -e "  ${YELLOW}⚠${NC} $1"; ((WARNINGS++)) || true; }
check_info() { echo -e "  ${BLUE}ℹ${NC} $1"; }
check_skip() { echo -e "  ${YELLOW}○${NC} $1 (skipped)"; }

format_bytes() {
    local bytes=$1
    if [ "$bytes" -ge 1048576 ]; then
        local mb=$((bytes / 1048576))
        local remainder=$(( (bytes % 1048576) * 10 / 1048576 ))
        echo "${mb}.${remainder}MB"
    elif [ "$bytes" -ge 1024 ]; then
        local kb=$((bytes / 1024))
        echo "${kb}KB"
    else
        echo "${bytes}B"
    fi
}

echo ""
echo -e "${BLUE}${BOLD}========================================"
echo "RELEASE PRE-FLIGHT CHECKS"
echo "========================================${NC}"
echo ""
echo "Project: $PROJECT_ROOT"
echo "Mode: $MODE"
echo "Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# =============================================================================
# SECTION 0: Platform Detection
# =============================================================================
echo -e "${BOLD}[0] Platform Detection${NC}"
echo "----------------------------------------"

PLATFORM=$(uname -s)
ARCH=$(uname -m)

if [ "$PLATFORM" = "Darwin" ]; then
    check_pass "Platform: macOS ($PLATFORM)"
    if [ "$ARCH" = "arm64" ]; then
        check_pass "Architecture: Apple Silicon ($ARCH)"
    elif [ "$ARCH" = "x86_64" ]; then
        check_warn "Architecture: Intel ($ARCH) - not native Apple Silicon"
    fi
else
    check_warn "Platform: $PLATFORM (not macOS - some checks skipped)"
    SKIP_MACOS_CHECKS=1
fi
echo ""

# =============================================================================
# SECTION 1: Patches vs Vanilla VS Code (CI SIMULATION)
# =============================================================================
echo -e "${BOLD}[1] Patches vs Vanilla VS Code $VSCODE_TAG${NC}"
echo "----------------------------------------"
check_info "This is what CI does — patches must apply against fresh vanilla VS Code"

VANILLA_CACHE="/tmp/vscode-vanilla-$VSCODE_TAG"

if [ -d "$VANILLA_CACHE/.git" ]; then
    check_info "Using cached vanilla clone at $VANILLA_CACHE"
    git -C "$VANILLA_CACHE" checkout . 2>/dev/null
    git -C "$VANILLA_CACHE" clean -fd 2>/dev/null
else
    check_info "Cloning vanilla VS Code $VSCODE_TAG (cached for future runs)..."
    if git clone --depth 1 --branch "$VSCODE_TAG" https://github.com/microsoft/vscode.git "$VANILLA_CACHE" 2>&1 | tail -1; then
        check_pass "Cloned vanilla VS Code $VSCODE_TAG"
    else
        check_fail "Failed to clone vanilla VS Code $VSCODE_TAG"
    fi
fi

PATCH_FILES=($(ls "$PATCHES_DIR"/*.patch 2>/dev/null | sort))
PATCH_COUNT=${#PATCH_FILES[@]}
PATCH_OK=0
PATCH_FAIL=0

for patch in "${PATCH_FILES[@]}"; do
    name=$(basename "$patch")
    if git -C "$VANILLA_CACHE" apply --check "$patch" 2>/dev/null; then
        git -C "$VANILLA_CACHE" apply "$patch" 2>/dev/null
        PATCH_OK=$((PATCH_OK + 1))
    elif git -C "$VANILLA_CACHE" apply --check --reverse "$patch" 2>/dev/null; then
        PATCH_OK=$((PATCH_OK + 1))
    else
        check_fail "PATCH FAIL: $name"
        git -C "$VANILLA_CACHE" apply --check "$patch" 2>&1 | head -3 | sed 's/^/    /'
        PATCH_FAIL=$((PATCH_FAIL + 1))
    fi
done

if [ $PATCH_FAIL -eq 0 ]; then
    check_pass "All $PATCH_OK/$PATCH_COUNT patches apply against vanilla VS Code $VSCODE_TAG"
else
    check_fail "$PATCH_FAIL/$PATCH_COUNT patches FAILED against vanilla VS Code"
    echo "       Patches must work against fresh VS Code $VSCODE_TAG (what CI clones)"
fi

# Also check patched TypeScript files for common issues
PATCHED_TS_FILES=""
for patch in "${PATCH_FILES[@]}"; do
    FILES=$(grep -E '^\+\+\+ b/' "$patch" | sed 's|^+++ b/||' | grep -E '\.(ts|tsx)$' || true)
    PATCHED_TS_FILES="$PATCHED_TS_FILES $FILES"
done
PATCHED_TS_FILES=$(echo "$PATCHED_TS_FILES" | tr ' ' '\n' | sort -u | grep -v '^$' || true)

if [ -n "$PATCHED_TS_FILES" ]; then
    # Check for unused imports in patched files (common VS Code build error)
    UNUSED_HINTS=0
    for file in $PATCHED_TS_FILES; do
        FULL_PATH="$VANILLA_CACHE/$file"
        if [ -f "$FULL_PATH" ]; then
            # Check for commented-out code that might leave unused imports
            if grep -q "^// .*MenuRegistry\.\|^// .*registerAction2\|^// .*appendMenuItem" "$FULL_PATH" 2>/dev/null; then
                IMPORTS_USED=$(grep -c "MenuRegistry\.\|registerAction2\|appendMenuItem" "$FULL_PATH" 2>/dev/null || echo 0)
                IMPORTS_COMMENTED=$(grep -c "^// .*MenuRegistry\.\|^// .*registerAction2\|^// .*appendMenuItem" "$FULL_PATH" 2>/dev/null || echo 0)
                if [ "$IMPORTS_USED" -eq "$IMPORTS_COMMENTED" ]; then
                    check_warn "HINT: $(basename $file) may have unused imports after commenting out code"
                    UNUSED_HINTS=$((UNUSED_HINTS + 1))
                fi
            fi
        fi
    done
    if [ $UNUSED_HINTS -eq 0 ]; then
        check_pass "No obvious unused import issues in patched files"
    fi
fi

echo ""

# =============================================================================
# SECTION 2: CI Workflow Configuration
# =============================================================================
echo -e "${BOLD}[2] CI Workflow Configuration${NC}"
echo "----------------------------------------"

for wf in "$PROJECT_ROOT"/.github/workflows/build-*.yml; do
    if [ ! -f "$wf" ]; then continue; fi
    name=$(basename "$wf")

    # Check GITHUB_TOKEN for npm install (ripgrep download needs it)
    if grep -q "GITHUB_TOKEN" "$wf"; then
        check_pass "$name: GITHUB_TOKEN present"
    else
        check_fail "$name: missing GITHUB_TOKEN (ripgrep download will 403 on CI)"
    fi

    # Check VS Code version matches our target
    WF_VERSION=$(grep -oE 'branch 1\.[0-9]+\.[0-9]+' "$wf" | head -1 | sed 's/branch //')
    if [ -n "$WF_VERSION" ]; then
        if [ "$WF_VERSION" = "$VSCODE_TAG" ]; then
            check_pass "$name: VS Code $WF_VERSION matches target"
        else
            check_fail "$name: VS Code $WF_VERSION doesn't match target $VSCODE_TAG"
        fi
    fi

    # Check legacy-peer-deps for extension install
    if grep -q "legacy-peer-deps" "$wf"; then
        check_pass "$name: --legacy-peer-deps for extension deps"
    else
        check_warn "$name: missing --legacy-peer-deps (may fail on peer conflicts)"
    fi
done

echo ""

# Exit early for CI-only mode
if [ "$MODE" = "ci" ]; then
    echo -e "${BOLD}========================================"
    echo "SUMMARY (ci-only mode)"
    echo "========================================${NC}"
    echo ""
    echo -e "Errors:   ${RED}$ERRORS${NC}"
    echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
    echo ""
    if [ "$ERRORS" -gt 0 ]; then
        echo -e "${RED}${BOLD}PRE-FLIGHT FAILED${NC} — fix before pushing tags"
    else
        echo -e "${GREEN}${BOLD}PRE-FLIGHT PASSED${NC} — CI should succeed"
    fi
    echo ""
    exit $ERRORS
fi

# =============================================================================
# SECTION 3: Git State
# =============================================================================
echo -e "${BOLD}[3] Git State${NC}"
echo "----------------------------------------"

if git -C "$PROJECT_ROOT" diff --quiet && git -C "$PROJECT_ROOT" diff --cached --quiet; then
    check_pass "No uncommitted changes"
else
    check_warn "Uncommitted changes detected"
fi

CURRENT_BRANCH=$(git -C "$PROJECT_ROOT" rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" = "main" ]; then
    check_pass "On main branch"
else
    check_warn "Not on main branch (current: $CURRENT_BRANCH)"
fi

if git -C "$PROJECT_ROOT" remote get-url origin &>/dev/null; then
    if git -C "$PROJECT_ROOT" fetch origin --quiet 2>/dev/null; then
        if git -C "$PROJECT_ROOT" rev-parse origin/main &>/dev/null; then
            LOCAL=$(git -C "$PROJECT_ROOT" rev-parse HEAD)
            REMOTE=$(git -C "$PROJECT_ROOT" rev-parse origin/main)
            if [ "$LOCAL" = "$REMOTE" ]; then
                check_pass "Synced with origin/main"
            else
                AHEAD=$(git -C "$PROJECT_ROOT" rev-list --count origin/main..HEAD 2>/dev/null || echo "0")
                BEHIND=$(git -C "$PROJECT_ROOT" rev-list --count HEAD..origin/main 2>/dev/null || echo "0")
                [ "$AHEAD" -gt 0 ] && check_warn "Local is $AHEAD commit(s) ahead of origin"
                [ "$BEHIND" -gt 0 ] && check_fail "Local is $BEHIND commit(s) behind origin — pull first!"
            fi
        fi
    else
        check_warn "Cannot fetch from origin"
    fi
else
    check_fail "Remote 'origin' not configured"
fi

# Check submodule state
SUBMODULE_TAG=$(git -C "$PROJECT_ROOT/vscode" describe --tags --exact-match 2>/dev/null || echo "no tag")
if [ "$SUBMODULE_TAG" = "$VSCODE_TAG" ]; then
    check_pass "Submodule at vanilla VS Code $VSCODE_TAG"
else
    SUBMODULE_COMMIT=$(git -C "$PROJECT_ROOT/vscode" rev-parse --short HEAD 2>/dev/null)
    check_warn "Submodule at $SUBMODULE_COMMIT ($SUBMODULE_TAG) — expected vanilla $VSCODE_TAG"
fi

echo ""

# =============================================================================
# SECTION 4: Build Environment
# =============================================================================
echo -e "${BOLD}[4] Build Environment${NC}"
echo "----------------------------------------"

NODE_VERSION=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" = "20" ]; then
    check_pass "Node v20.x ($(node -v))"
else
    check_fail "Node must be v20.x (found: $(node -v 2>/dev/null || echo 'not found'))"
fi

NODE_ARCH=$(node -p "process.arch" 2>/dev/null)
if [ "$SKIP_MACOS_CHECKS" != "1" ]; then
    if [ "$NODE_ARCH" = "arm64" ]; then
        check_pass "Node architecture: arm64"
    elif [ "$NODE_ARCH" = "x64" ] && [ "$ARCH" = "arm64" ]; then
        check_fail "Node architecture: x64 (Rosetta on ARM Mac — use nvm install 20)"
    else
        check_pass "Node architecture: $NODE_ARCH"
    fi
fi

if [ "$SKIP_MACOS_CHECKS" != "1" ]; then
    if command -v create-dmg &>/dev/null; then
        check_pass "create-dmg installed"
    else
        check_warn "create-dmg not found (brew install create-dmg)"
    fi

    if security find-identity -v -p codesigning 2>/dev/null | grep -q "Developer ID Application"; then
        check_pass "Signing certificate found"
    else
        check_warn "No Developer ID signing certificate"
    fi
fi

echo ""

# =============================================================================
# SECTION 5: Extension Source & Bundle
# =============================================================================
echo -e "${BOLD}[5] Extension Source & Bundle${NC}"
echo "----------------------------------------"

# 0-byte file corruption check
ZERO_TS=$(find "$EXTENSION_DIR/src" -name "*.ts" -size 0 -type f 2>/dev/null | wc -l | tr -d ' ')
ZERO_TSX=$(find "$WEBVIEW_DIR/src" -name "*.tsx" -size 0 -type f 2>/dev/null | wc -l | tr -d ' ')
if [ "$ZERO_TS" -eq 0 ] && [ "$ZERO_TSX" -eq 0 ]; then
    check_pass "No corrupted (0-byte) source files"
else
    [ "$ZERO_TS" -gt 0 ] && check_fail "Found $ZERO_TS corrupted .ts files"
    [ "$ZERO_TSX" -gt 0 ] && check_fail "Found $ZERO_TSX corrupted .tsx files"
fi

# Extension symlink
if [ -L "$PROJECT_ROOT/vscode/extensions/ritemark" ]; then
    TARGET=$(readlink "$PROJECT_ROOT/vscode/extensions/ritemark")
    if [ "$TARGET" = "../../extensions/ritemark" ]; then
        check_pass "Extension symlink OK"
    else
        check_warn "Extension symlink points to: $TARGET"
    fi
else
    check_warn "Extension symlink missing (will be created during build)"
fi

# Webview bundle
WEBVIEW_JS="$EXTENSION_DIR/media/webview.js"
if [ -f "$WEBVIEW_JS" ]; then
    WEBVIEW_SIZE=$(wc -c < "$WEBVIEW_JS" | tr -d ' ')
    if [ "$WEBVIEW_SIZE" -gt 500000 ]; then
        check_pass "webview.js: $(format_bytes $WEBVIEW_SIZE)"
    else
        check_fail "webview.js too small: $(format_bytes $WEBVIEW_SIZE) (need >500KB)"
    fi
else
    check_fail "webview.js not found"
fi

# CSS processing check
if grep -q "@tailwind base" "$WEBVIEW_JS" 2>/dev/null; then
    check_fail "webview.js has raw @tailwind directives (CSS not processed)"
else
    check_pass "CSS properly processed in webview bundle"
fi

# Package.json validity
if node -e "require('$EXTENSION_DIR/package.json')" 2>/dev/null; then
    check_pass "extension package.json valid"
else
    check_fail "extension package.json invalid"
fi

echo ""

# Exit early for quick mode
if [ "$MODE" = "quick" ]; then
    echo -e "${BOLD}========================================"
    echo "SUMMARY (quick mode)"
    echo "========================================${NC}"
    echo ""
    echo -e "Errors:   ${RED}$ERRORS${NC}"
    echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
    echo ""
    if [ "$ERRORS" -gt 0 ]; then
        echo -e "${RED}${BOLD}PRE-FLIGHT FAILED${NC}"
    else
        echo -e "${GREEN}${BOLD}PRE-FLIGHT PASSED${NC}"
    fi
    echo ""
    exit $ERRORS
fi

# =============================================================================
# SECTION 6: Dependencies
# =============================================================================
echo -e "${BOLD}[6] Dependencies${NC}"
echo "----------------------------------------"

if [ -d "$EXTENSION_DIR/node_modules" ]; then
    PKG_COUNT=$(ls "$EXTENSION_DIR/node_modules" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$PKG_COUNT" -gt 50 ]; then
        check_pass "Extension node_modules: $PKG_COUNT packages"
    else
        check_fail "Extension node_modules incomplete ($PKG_COUNT packages)"
        SKIP_DEPENDENCY_CHECKS=1
    fi
else
    check_fail "Extension node_modules missing"
    SKIP_DEPENDENCY_CHECKS=1
fi

if [ -d "$WEBVIEW_DIR/node_modules" ]; then
    check_pass "Webview node_modules exists"
else
    check_warn "Webview node_modules missing"
fi

if [ -f "$EXTENSION_DIR/package-lock.json" ]; then
    check_pass "package-lock.json exists"
else
    check_fail "package-lock.json missing"
    SKIP_DEPENDENCY_CHECKS=1
fi

if [ "$SKIP_DEPENDENCY_CHECKS" -eq 1 ]; then
    echo ""
    check_warn "Skipping deep dependency checks (node_modules missing)"
    echo ""
    # Jump to summary
else
    echo ""

    # =============================================================================
    # SECTION 7: Peer Dependencies & Known Versions
    # =============================================================================
    echo -e "${BOLD}[7] Peer Dependencies${NC}"
    echo "----------------------------------------"

    cd "$EXTENSION_DIR"

    # zod version (claude-agent-sdk requires ^4.0)
    ZOD_VERSION=$(node -e "try{console.log(require('./node_modules/zod/package.json').version)}catch(e){console.log('not found')}" 2>/dev/null)
    if [ "$ZOD_VERSION" != "not found" ]; then
        ZOD_MAJOR=$(echo "$ZOD_VERSION" | cut -d. -f1)
        if [ "$ZOD_MAJOR" -ge 4 ]; then
            check_pass "zod@$ZOD_VERSION (v4+ for claude-agent-sdk)"
        else
            check_fail "zod@$ZOD_VERSION — must be v4+ for claude-agent-sdk"
        fi
    fi

    # openai version (v6+ supports zod@4)
    OPENAI_VERSION=$(node -e "try{console.log(require('./node_modules/openai/package.json').version)}catch(e){console.log('not found')}" 2>/dev/null)
    if [ "$OPENAI_VERSION" != "not found" ]; then
        OPENAI_MAJOR=$(echo "$OPENAI_VERSION" | cut -d. -f1)
        if [ "$OPENAI_MAJOR" -ge 6 ]; then
            check_pass "openai@$OPENAI_VERSION (v6+ for zod@4)"
        else
            check_fail "openai@$OPENAI_VERSION — must be v6+ for zod@4"
        fi
    fi

    # CI simulation (dry-run npm install)
    check_info "Simulating CI npm install..."
    CI_ERRORS=$(npm install --legacy-peer-deps --dry-run 2>&1 | grep -E "^npm ERR\!|ERESOLVE|Could not resolve" | head -5 || true)
    if [ -z "$CI_ERRORS" ]; then
        check_pass "npm install --legacy-peer-deps simulation passed"
    else
        check_fail "CI npm install simulation found errors"
        echo "$CI_ERRORS" | sed 's/^/       /'
    fi

    cd "$PROJECT_ROOT"
    echo ""

    # =============================================================================
    # SECTION 8: TypeScript Compilation
    # =============================================================================
    echo -e "${BOLD}[8] TypeScript Compilation${NC}"
    echo "----------------------------------------"

    cd "$EXTENSION_DIR"

    TSC_OUTPUT=$(npm run compile 2>&1 || true)
    TSC_ERRORS=$(echo "$TSC_OUTPUT" | grep -E "error TS[0-9]+" | head -10 || true)

    if [ -z "$TSC_ERRORS" ]; then
        check_pass "TypeScript compilation successful"
    else
        ERROR_COUNT=$(echo "$TSC_ERRORS" | wc -l | tr -d ' ')
        check_fail "TypeScript compilation failed ($ERROR_COUNT errors)"
        echo "$TSC_ERRORS" | head -5 | sed 's/^/       /'
    fi

    if [ -f "$EXTENSION_DIR/out/extension.js" ]; then
        EXT_SIZE=$(stat -f%z "$EXTENSION_DIR/out/extension.js" 2>/dev/null || wc -c < "$EXTENSION_DIR/out/extension.js" | tr -d ' ')
        if [ "$EXT_SIZE" -gt 1000 ]; then
            check_pass "extension.js compiled ($(format_bytes $EXT_SIZE))"
        else
            check_fail "extension.js too small after compilation"
        fi
    fi

    cd "$PROJECT_ROOT"
    echo ""

    # =============================================================================
    # SECTION 9: Windows Compatibility
    # =============================================================================
    echo -e "${BOLD}[9] Windows Compatibility${NC}"
    echo "----------------------------------------"

    cd "$EXTENSION_DIR"

    # fsevents check
    FSEVENTS_CHECK=$(node -e "
    const pkg = require('./package.json');
    const deps = pkg.dependencies || {};
    const optDeps = pkg.optionalDependencies || {};
    if (deps.fsevents) console.log('in-dependencies');
    else if (optDeps.fsevents) console.log('in-optional');
    else console.log('not-present');
    " 2>/dev/null || echo "error")

    case "$FSEVENTS_CHECK" in
        "in-dependencies") check_fail "fsevents must be in optionalDependencies, not dependencies" ;;
        "in-optional") check_pass "fsevents in optionalDependencies (OK)" ;;
        "not-present") check_pass "No fsevents dependency (OK)" ;;
    esac

    # claude-agent-sdk vendor binaries
    SDK_VENDOR="$EXTENSION_DIR/node_modules/@anthropic-ai/claude-agent-sdk/vendor"
    if [ -d "$SDK_VENDOR/ripgrep" ]; then
        if [ -d "$SDK_VENDOR/ripgrep/x64-win32" ]; then
            check_pass "claude-agent-sdk has Windows ripgrep binaries"
        else
            check_info "claude-agent-sdk ripgrep: Windows binaries added by CI workflow"
        fi
    fi

    cd "$PROJECT_ROOT"
    echo ""
fi

# =============================================================================
# SUMMARY
# =============================================================================
echo -e "${BOLD}========================================"
echo "SUMMARY"
echo "========================================${NC}"
echo ""
echo -e "Errors:   ${RED}$ERRORS${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ "$ERRORS" -gt 0 ]; then
    echo -e "${RED}${BOLD}PRE-FLIGHT FAILED${NC}"
    echo ""
    echo "Fix the $ERRORS error(s) above before proceeding."
    echo "DO NOT push tags until all errors are resolved."
    echo ""
    exit 1
elif [ "$WARNINGS" -gt 0 ]; then
    echo -e "${YELLOW}${BOLD}PRE-FLIGHT PASSED WITH WARNINGS${NC}"
    echo ""
    echo "Review the $WARNINGS warning(s) above."
    echo "You may proceed, but consider fixing warnings first."
    echo ""
    exit 0
else
    echo -e "${GREEN}${BOLD}PRE-FLIGHT PASSED${NC}"
    echo ""
    echo "All checks passed. Safe to proceed with release."
    echo ""
    exit 0
fi
