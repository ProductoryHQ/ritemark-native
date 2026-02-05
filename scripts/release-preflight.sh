#!/bin/bash
#
# release-preflight.sh - Pre-flight quality checks before release
#
# Usage: ./scripts/release-preflight.sh
#
# This script MUST pass before:
#   1. Version bump
#   2. Any build process
#   3. Tag creation
#
# If ANY check fails, DO NOT proceed with release.
# Fix the issues first, then re-run this script.
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

echo ""
echo -e "${BLUE}${BOLD}========================================"
echo "RELEASE PRE-FLIGHT CHECKS"
echo "========================================${NC}"
echo ""
echo "Project: $PROJECT_ROOT"
echo "Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# =============================================================================
# Helper functions
# =============================================================================

check_pass() {
    echo -e "  ${GREEN}✓${NC} $1"
}

check_fail() {
    echo -e "  ${RED}✗${NC} $1"
    ((ERRORS++))
}

check_warn() {
    echo -e "  ${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

# =============================================================================
# SECTION 1: Git State
# =============================================================================
echo -e "${BOLD}[1/6] Git State${NC}"
echo "----------------------------------------"

# Check for uncommitted changes
if git diff --quiet && git diff --cached --quiet; then
    check_pass "No uncommitted changes"
else
    check_fail "Uncommitted changes detected"
    echo "       Run: git status"
fi

# Check current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" = "main" ]; then
    check_pass "On main branch"
else
    check_warn "Not on main branch (current: $CURRENT_BRANCH)"
fi

# Check if ahead/behind origin
git fetch origin --quiet 2>/dev/null || true
LOCAL=$(git rev-parse HEAD 2>/dev/null)
REMOTE=$(git rev-parse origin/main 2>/dev/null || echo "")
if [ -n "$REMOTE" ] && [ "$LOCAL" != "$REMOTE" ]; then
    AHEAD=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo "0")
    BEHIND=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo "0")
    if [ "$AHEAD" -gt 0 ]; then
        check_warn "Local is $AHEAD commit(s) ahead of origin"
    fi
    if [ "$BEHIND" -gt 0 ]; then
        check_fail "Local is $BEHIND commit(s) behind origin - pull first!"
    fi
else
    check_pass "Synced with origin/main"
fi

echo ""

# =============================================================================
# SECTION 2: Build Environment
# =============================================================================
echo -e "${BOLD}[2/6] Build Environment${NC}"
echo "----------------------------------------"

# Check Node version
NODE_VERSION=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" = "20" ]; then
    check_pass "Node v20.x ($(node -v))"
else
    check_fail "Node version must be v20.x (found: $(node -v 2>/dev/null || echo 'not found'))"
    echo "       Run: nvm use 20"
fi

# Check Node architecture
NODE_ARCH=$(node -p "process.arch" 2>/dev/null)
if [ "$NODE_ARCH" = "arm64" ]; then
    check_pass "Node architecture: arm64"
else
    check_fail "Node architecture must be arm64 (found: $NODE_ARCH)"
    echo "       This means Node is running under Rosetta"
    echo "       Run: nvm install 20 --default"
fi

# Check for required tools
if command -v create-dmg &> /dev/null; then
    check_pass "create-dmg installed"
else
    check_fail "create-dmg not found"
    echo "       Run: brew install create-dmg"
fi

# Check signing certificate
if security find-identity -v -p codesigning 2>/dev/null | grep -q "Developer ID Application"; then
    CERT_NAME=$(security find-identity -v -p codesigning 2>/dev/null | grep "Developer ID Application" | head -1 | sed 's/.*"\(.*\)".*/\1/')
    check_pass "Signing certificate: $CERT_NAME"
else
    check_fail "No Developer ID signing certificate found"
    echo "       Install certificate from Apple Developer portal"
fi

# Check .signing-config exists
if [ -f "$PROJECT_ROOT/.signing-config" ]; then
    check_pass ".signing-config exists"
else
    check_warn ".signing-config missing (needed for notarization)"
fi

echo ""

# =============================================================================
# SECTION 3: Extension Source Code
# =============================================================================
echo -e "${BOLD}[3/6] Extension Source Code${NC}"
echo "----------------------------------------"

# Check for 0-byte TypeScript files (corruption)
ZERO_BYTE_TS=$(find "$EXTENSION_DIR/src" -name "*.ts" -size 0 -type f 2>/dev/null | wc -l | tr -d ' ')
if [ "$ZERO_BYTE_TS" -eq 0 ]; then
    check_pass "No corrupted .ts files (0-byte)"
else
    check_fail "Found $ZERO_BYTE_TS corrupted (0-byte) .ts files"
    echo "       Run: git checkout HEAD -- extensions/ritemark/src/"
fi

# Check for 0-byte TSX files in webview
ZERO_BYTE_TSX=$(find "$WEBVIEW_DIR/src" -name "*.tsx" -size 0 -type f 2>/dev/null | wc -l | tr -d ' ')
if [ "$ZERO_BYTE_TSX" -eq 0 ]; then
    check_pass "No corrupted .tsx files (0-byte)"
else
    check_fail "Found $ZERO_BYTE_TSX corrupted (0-byte) .tsx files"
    echo "       Run: git checkout HEAD -- extensions/ritemark/webview/src/"
fi

# Check extension package.json is valid JSON
if node -e "require('$EXTENSION_DIR/package.json')" 2>/dev/null; then
    check_pass "extension package.json is valid JSON"
else
    check_fail "extension package.json is invalid"
fi

# Check webview package.json is valid JSON
if node -e "require('$WEBVIEW_DIR/package.json')" 2>/dev/null; then
    check_pass "webview package.json is valid JSON"
else
    check_fail "webview package.json is invalid"
fi

echo ""

# =============================================================================
# SECTION 4: Dependencies
# =============================================================================
echo -e "${BOLD}[4/6] Dependencies${NC}"
echo "----------------------------------------"

# Check extension node_modules exists
if [ -d "$EXTENSION_DIR/node_modules" ]; then
    PKG_COUNT=$(ls "$EXTENSION_DIR/node_modules" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$PKG_COUNT" -gt 50 ]; then
        check_pass "Extension node_modules: $PKG_COUNT packages"
    else
        check_warn "Extension node_modules seems incomplete ($PKG_COUNT packages)"
    fi
else
    check_fail "Extension node_modules missing"
    echo "       Run: cd extensions/ritemark && npm install"
fi

# Check webview node_modules exists
if [ -d "$WEBVIEW_DIR/node_modules" ]; then
    check_pass "Webview node_modules exists"
else
    check_fail "Webview node_modules missing"
    echo "       Run: cd extensions/ritemark/webview && npm install"
fi

# Check for peer dependency issues (quick check)
cd "$EXTENSION_DIR"
if npm ls --depth=0 2>&1 | grep -q "ELSPROBLEMS\|peer dep missing\|invalid"; then
    check_warn "Potential peer dependency issues"
    echo "       Run: cd extensions/ritemark && npm ls"
else
    check_pass "No obvious peer dependency issues"
fi
cd "$PROJECT_ROOT"

echo ""

# =============================================================================
# SECTION 5: Build Artifacts
# =============================================================================
echo -e "${BOLD}[5/6] Build Artifacts${NC}"
echo "----------------------------------------"

# Check webview.js exists and has valid size
WEBVIEW_JS="$EXTENSION_DIR/media/webview.js"
if [ -f "$WEBVIEW_JS" ]; then
    WEBVIEW_SIZE=$(stat -f%z "$WEBVIEW_JS" 2>/dev/null || stat -c%s "$WEBVIEW_JS" 2>/dev/null)
    if [ "$WEBVIEW_SIZE" -gt 500000 ]; then
        check_pass "webview.js exists ($(echo "scale=1; $WEBVIEW_SIZE/1048576" | bc)MB)"
    else
        check_fail "webview.js is too small ($WEBVIEW_SIZE bytes) - rebuild needed"
        echo "       Run: cd extensions/ritemark/webview && npm run build"
    fi
else
    check_fail "webview.js not found"
    echo "       Run: cd extensions/ritemark/webview && npm run build"
fi

# Check extension.js exists
if [ -f "$EXTENSION_DIR/out/extension.js" ]; then
    EXT_SIZE=$(stat -f%z "$EXTENSION_DIR/out/extension.js" 2>/dev/null || stat -c%s "$EXTENSION_DIR/out/extension.js" 2>/dev/null)
    if [ "$EXT_SIZE" -gt 1000 ]; then
        check_pass "extension.js exists ($EXT_SIZE bytes)"
    else
        check_fail "extension.js is too small - recompile needed"
    fi
else
    check_fail "extension.js not found"
    echo "       Run: cd extensions/ritemark && npm run compile"
fi

# Check ritemarkEditor.js exists
if [ -f "$EXTENSION_DIR/out/ritemarkEditor.js" ]; then
    check_pass "ritemarkEditor.js exists"
else
    check_fail "ritemarkEditor.js not found"
fi

echo ""

# =============================================================================
# SECTION 6: Windows Compatibility
# =============================================================================
echo -e "${BOLD}[6/6] Windows Compatibility${NC}"
echo "----------------------------------------"

# Check for native modules that might not work on Windows
cd "$EXTENSION_DIR"
NATIVE_MODULES=$(find node_modules -name "*.node" -type f 2>/dev/null | grep -v "x64-win32\|win32-x64" | head -5)
if [ -z "$NATIVE_MODULES" ]; then
    check_pass "No problematic native modules detected"
else
    # Check if they have Windows versions
    HAS_WIN_ISSUE=0
    while IFS= read -r module; do
        MODULE_DIR=$(dirname "$module")
        if ! ls "$MODULE_DIR"/*win32* &>/dev/null && ! ls "$MODULE_DIR"/../*win32* &>/dev/null; then
            check_warn "Native module may not work on Windows: $module"
            HAS_WIN_ISSUE=1
        fi
    done <<< "$NATIVE_MODULES"

    if [ "$HAS_WIN_ISSUE" -eq 0 ]; then
        check_pass "Native modules have Windows support"
    fi
fi
cd "$PROJECT_ROOT"

# Check fsevents is not in regular dependencies
if grep -q '"fsevents"' "$EXTENSION_DIR/package.json" 2>/dev/null; then
    if grep -A5 '"optionalDependencies"' "$EXTENSION_DIR/package.json" | grep -q '"fsevents"'; then
        check_pass "fsevents is in optionalDependencies (OK)"
    else
        check_warn "fsevents should be in optionalDependencies, not dependencies"
    fi
else
    check_pass "No fsevents dependency (OK for cross-platform)"
fi

echo ""

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
    echo "Fix the $ERRORS error(s) above before proceeding with release."
    echo "DO NOT run version bump or builds until all errors are resolved."
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
    echo "All checks passed. You may proceed with:"
    echo "  1. Version bump"
    echo "  2. Build process"
    echo "  3. Release"
    echo ""
    exit 0
fi
