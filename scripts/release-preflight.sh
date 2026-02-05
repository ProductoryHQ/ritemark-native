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
# NOTE: This script is designed to run on macOS (arm64) for release builds.
#       Running on other platforms will show a warning.
#
# Enhanced in v1.3.0 to catch Windows build issues:
#   - Deep peer dependency validation
#   - npm ci simulation (what GitHub Actions does)
#   - TypeScript compilation check
#   - Native binary platform verification
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

# Flags
SKIP_DEPENDENCY_CHECKS=0

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
    ((ERRORS++)) || true
}

check_warn() {
    echo -e "  ${YELLOW}⚠${NC} $1"
    ((WARNINGS++)) || true
}

check_info() {
    echo -e "  ${BLUE}ℹ${NC} $1"
}

check_skip() {
    echo -e "  ${YELLOW}○${NC} $1 (skipped)"
}

# Format bytes to human readable (pure bash, no bc/awk dependency)
format_bytes() {
    local bytes=$1
    if [ "$bytes" -ge 1048576 ]; then
        # MB: use bash arithmetic with one decimal place approximation
        local mb=$((bytes / 1048576))
        local remainder=$(( (bytes % 1048576) * 10 / 1048576 ))
        echo "${mb}.${remainder}MB"
    elif [ "$bytes" -ge 1024 ]; then
        # KB
        local kb=$((bytes / 1024))
        local remainder=$(( (bytes % 1024) * 10 / 1024 ))
        echo "${kb}.${remainder}KB"
    else
        echo "${bytes}B"
    fi
}

# =============================================================================
# SECTION 0: Platform Detection
# =============================================================================
echo -e "${BOLD}[0/8] Platform Detection${NC}"
echo "----------------------------------------"

PLATFORM=$(uname -s)
ARCH=$(uname -m)

if [ "$PLATFORM" = "Darwin" ]; then
    check_pass "Platform: macOS ($PLATFORM)"
    
    if [ "$ARCH" = "arm64" ]; then
        check_pass "Architecture: Apple Silicon ($ARCH)"
    elif [ "$ARCH" = "x86_64" ]; then
        check_warn "Architecture: Intel ($ARCH) - builds will work but are not native"
        echo "       For best results, run on Apple Silicon Mac"
    else
        check_warn "Unknown architecture: $ARCH"
    fi
else
    check_warn "Platform: $PLATFORM (not macOS)"
    echo ""
    echo -e "  ${YELLOW}This script is designed for macOS release builds.${NC}"
    echo "  On $PLATFORM, macOS-specific checks (signing, DMG, etc.) will be skipped."
    echo "  You can still validate dependencies and TypeScript compilation."
    echo ""
    
    # Mark that we should skip macOS-specific checks
    SKIP_MACOS_CHECKS=1
fi

echo ""

# =============================================================================
# SECTION 1: Git State
# =============================================================================
echo -e "${BOLD}[1/8] Git State${NC}"
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

# Check if origin remote exists
if ! git remote get-url origin &>/dev/null; then
    check_fail "Remote 'origin' not configured"
    echo "       Run: git remote add origin <url>"
else
    check_pass "Remote 'origin' exists"
    
    # Try to fetch from origin
    if git fetch origin --quiet 2>/dev/null; then
        check_pass "Fetched from origin successfully"
        
        # Check if origin/main exists
        if git rev-parse origin/main &>/dev/null; then
            LOCAL=$(git rev-parse HEAD 2>/dev/null)
            REMOTE=$(git rev-parse origin/main 2>/dev/null)
            
            if [ "$LOCAL" = "$REMOTE" ]; then
                check_pass "Synced with origin/main"
            else
                AHEAD=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo "0")
                BEHIND=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo "0")
                if [ "$AHEAD" -gt 0 ]; then
                    check_warn "Local is $AHEAD commit(s) ahead of origin"
                fi
                if [ "$BEHIND" -gt 0 ]; then
                    check_fail "Local is $BEHIND commit(s) behind origin - pull first!"
                fi
            fi
        else
            check_fail "origin/main branch not found"
            echo "       Remote exists but main branch is missing"
        fi
    else
        check_fail "Cannot fetch from origin (network issue or auth required)"
        echo "       Check your network connection and git credentials"
    fi
fi

echo ""

# =============================================================================
# SECTION 2: Build Environment
# =============================================================================
echo -e "${BOLD}[2/8] Build Environment${NC}"
echo "----------------------------------------"

# Check Node version
NODE_VERSION=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" = "20" ]; then
    check_pass "Node v20.x ($(node -v))"
else
    check_fail "Node version must be v20.x (found: $(node -v 2>/dev/null || echo 'not found'))"
    echo "       Run: nvm use 20"
fi

# Check Node architecture (only relevant on macOS)
NODE_ARCH=$(node -p "process.arch" 2>/dev/null)
if [ "${SKIP_MACOS_CHECKS:-0}" = "1" ]; then
    check_info "Node architecture: $NODE_ARCH (macOS check skipped)"
elif [ "$NODE_ARCH" = "arm64" ]; then
    check_pass "Node architecture: arm64"
elif [ "$NODE_ARCH" = "x64" ] && [ "$ARCH" = "x86_64" ]; then
    # x64 Node on Intel Mac is fine
    check_pass "Node architecture: x64 (native for Intel Mac)"
elif [ "$NODE_ARCH" = "x64" ] && [ "$ARCH" = "arm64" ]; then
    # x64 Node on ARM Mac means Rosetta
    check_fail "Node architecture: x64 (running under Rosetta on ARM Mac)"
    echo "       This will cause build issues. Install native arm64 Node:"
    echo "       Run: nvm install 20 --default"
else
    check_warn "Node architecture: $NODE_ARCH (unexpected)"
fi

# macOS-specific tool checks
if [ "${SKIP_MACOS_CHECKS:-0}" != "1" ]; then
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
else
    check_skip "create-dmg (macOS only)"
    check_skip "Signing certificate (macOS only)"
    check_skip ".signing-config (macOS only)"
fi

echo ""

# =============================================================================
# SECTION 3: Extension Source Code
# =============================================================================
echo -e "${BOLD}[3/8] Extension Source Code${NC}"
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
# SECTION 4: Dependencies (Basic) - GATE CHECK
# =============================================================================
echo -e "${BOLD}[4/8] Dependencies${NC}"
echo "----------------------------------------"

# Check extension node_modules exists - THIS IS A GATE
if [ -d "$EXTENSION_DIR/node_modules" ]; then
    PKG_COUNT=$(ls "$EXTENSION_DIR/node_modules" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$PKG_COUNT" -gt 50 ]; then
        check_pass "Extension node_modules: $PKG_COUNT packages"
    else
        check_fail "Extension node_modules incomplete ($PKG_COUNT packages)"
        echo "       Run: cd extensions/ritemark && npm install"
        SKIP_DEPENDENCY_CHECKS=1
    fi
else
    check_fail "Extension node_modules missing"
    echo "       Run: cd extensions/ritemark && npm install"
    SKIP_DEPENDENCY_CHECKS=1
fi

# Check webview node_modules exists
if [ -d "$WEBVIEW_DIR/node_modules" ]; then
    check_pass "Webview node_modules exists"
else
    check_fail "Webview node_modules missing"
    echo "       Run: cd extensions/ritemark/webview && npm install"
fi

# Check package-lock.json exists
if [ -f "$EXTENSION_DIR/package-lock.json" ]; then
    check_pass "package-lock.json exists"
else
    check_fail "package-lock.json missing - run npm install"
    SKIP_DEPENDENCY_CHECKS=1
fi

# Early exit gate - skip sections 5-8 if node_modules is missing
if [ "$SKIP_DEPENDENCY_CHECKS" -eq 1 ]; then
    echo ""
    echo -e "  ${YELLOW}${BOLD}EARLY EXIT: node_modules missing${NC}"
    echo "  Sections 5-8 require node_modules to be installed."
    echo "  Fix the dependency issues above, then re-run this script."
    echo ""
    
    # Skip to summary
    echo -e "${BOLD}========================================"
    echo "SUMMARY"
    echo "========================================${NC}"
    echo ""
    echo -e "Errors:   ${RED}$ERRORS${NC}"
    echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
    echo ""
    echo -e "${RED}${BOLD}PRE-FLIGHT FAILED (early exit)${NC}"
    echo ""
    echo "Install dependencies first:"
    echo "  cd extensions/ritemark && npm install"
    echo "  cd extensions/ritemark/webview && npm install"
    echo ""
    echo "Then re-run: ./scripts/release-preflight.sh"
    echo ""
    exit 1
fi

echo ""

# =============================================================================
# SECTION 5: Deep Peer Dependency Validation (catches zod-like conflicts)
# =============================================================================
echo -e "${BOLD}[5/8] Peer Dependency Validation (Deep)${NC}"
echo "----------------------------------------"
check_info "This catches version conflicts like zod@3 vs zod@4..."

cd "$EXTENSION_DIR"

# Deep peer dependency check - this catches conflicts like zod version mismatches
PEER_ISSUES=$(npm ls --all 2>&1 | grep -E "peer dep|ERESOLVE|invalid|missing" | head -10 || true)
if [ -z "$PEER_ISSUES" ]; then
    check_pass "No peer dependency conflicts (deep check)"
else
    # Count how many issues
    ISSUE_COUNT=$(echo "$PEER_ISSUES" | wc -l | tr -d ' ')
    check_fail "Found $ISSUE_COUNT peer dependency issue(s)"
    echo ""
    echo "       Issues found:"
    echo "$PEER_ISSUES" | while read -r line; do
        echo "         $line"
    done
    echo ""
    echo "       Fix: Update conflicting packages in package.json"
    echo "       Then: rm -rf node_modules package-lock.json && npm install"
fi

# Check for known problematic version combinations using Node for reliable JSON parsing
# zod: claude-agent-sdk requires ^4.0, some packages may require ^3.x
ZOD_VERSION=$(node -e "try{console.log(require('./node_modules/zod/package.json').version)}catch(e){console.log('not found')}" 2>/dev/null)
if [ "$ZOD_VERSION" != "not found" ]; then
    ZOD_MAJOR=$(echo "$ZOD_VERSION" | cut -d. -f1)
    if [ "$ZOD_MAJOR" -ge 4 ]; then
        check_pass "zod@$ZOD_VERSION (v4+ required by claude-agent-sdk)"
    else
        check_fail "zod@$ZOD_VERSION - must be v4+ for claude-agent-sdk compatibility"
        echo "       Fix: npm install zod@^4.0.0"
    fi
else
    check_warn "zod not found - may cause issues if claude-agent-sdk is used"
fi

# Check openai version (v6+ supports zod@4)
OPENAI_VERSION=$(node -e "try{console.log(require('./node_modules/openai/package.json').version)}catch(e){console.log('not found')}" 2>/dev/null)
if [ "$OPENAI_VERSION" != "not found" ]; then
    OPENAI_MAJOR=$(echo "$OPENAI_VERSION" | cut -d. -f1)
    if [ "$OPENAI_MAJOR" -ge 6 ]; then
        check_pass "openai@$OPENAI_VERSION (v6+ supports zod@4)"
    else
        check_fail "openai@$OPENAI_VERSION - must be v6+ for zod@4 compatibility"
        echo "       Fix: npm install openai@^6.0.0"
    fi
else
    check_info "openai not installed (OK if not using OpenAI)"
fi

cd "$PROJECT_ROOT"
echo ""

# =============================================================================
# SECTION 6: CI Simulation (simulates what GitHub Actions does)
# =============================================================================
echo -e "${BOLD}[6/8] CI Build Simulation${NC}"
echo "----------------------------------------"
check_info "Simulating GitHub Actions npm install..."

cd "$EXTENSION_DIR"

# Test npm ci with --legacy-peer-deps (what GH Actions uses)
# We use --dry-run to avoid actually modifying node_modules
CI_OUTPUT=$(npm install --legacy-peer-deps --dry-run 2>&1 || true)
CI_ERRORS=$(echo "$CI_OUTPUT" | grep -E "^npm ERR\!|ERESOLVE|Could not resolve" | head -5 || true)

if [ -z "$CI_ERRORS" ]; then
    check_pass "npm install --legacy-peer-deps simulation passed"
else
    check_fail "CI simulation found errors"
    echo ""
    echo "       These errors would occur in GitHub Actions:"
    echo "$CI_ERRORS" | while read -r line; do
        echo "         $line"
    done
    echo ""
    echo "       Fix dependencies before pushing tag!"
fi

# Verify package-lock.json is in sync with package.json
LOCK_CHECK=$(npm ls 2>&1 | grep -c "ELSPROBLEMS" || true)
if [ "$LOCK_CHECK" -eq 0 ]; then
    check_pass "package-lock.json in sync with package.json"
else
    check_warn "package-lock.json may be out of sync"
    echo "       Run: rm package-lock.json && npm install"
fi

cd "$PROJECT_ROOT"
echo ""

# =============================================================================
# SECTION 7: TypeScript Compilation Check
# =============================================================================
echo -e "${BOLD}[7/8] TypeScript Compilation${NC}"
echo "----------------------------------------"
check_info "Running TypeScript compiler to catch type errors..."

cd "$EXTENSION_DIR"

# Run TypeScript compilation and capture errors
TSC_OUTPUT=$(npm run compile 2>&1 || true)
TSC_ERRORS=$(echo "$TSC_OUTPUT" | grep -E "error TS[0-9]+" | head -10 || true)

if [ -z "$TSC_ERRORS" ]; then
    check_pass "TypeScript compilation successful"
else
    ERROR_COUNT=$(echo "$TSC_ERRORS" | wc -l | tr -d ' ')
    check_fail "TypeScript compilation failed with $ERROR_COUNT error(s)"
    echo ""
    echo "       Errors:"
    echo "$TSC_ERRORS" | while read -r line; do
        echo "         $line"
    done
    echo ""
    echo "       Fix TypeScript errors before release!"
fi

# Also check if output files were generated
if [ -f "$EXTENSION_DIR/out/extension.js" ]; then
    EXT_SIZE=$(stat -f%z "$EXTENSION_DIR/out/extension.js" 2>/dev/null || stat -c%s "$EXTENSION_DIR/out/extension.js" 2>/dev/null)
    if [ "$EXT_SIZE" -gt 1000 ]; then
        check_pass "extension.js compiled ($(format_bytes $EXT_SIZE))"
    else
        check_fail "extension.js is too small after compilation"
    fi
else
    check_fail "extension.js not generated"
fi

cd "$PROJECT_ROOT"
echo ""

# =============================================================================
# SECTION 8: Windows Compatibility (Enhanced)
# =============================================================================
echo -e "${BOLD}[8/8] Windows Compatibility${NC}"
echo "----------------------------------------"
check_info "Checking for Windows build compatibility..."

cd "$EXTENSION_DIR"

# Check for native modules that might not work on Windows
NATIVE_MODULES=$(find node_modules -name "*.node" -type f 2>/dev/null | head -20 || true)
if [ -z "$NATIVE_MODULES" ]; then
    check_pass "No native .node modules detected"
else
    # Check each native module for Windows compatibility
    HAS_WIN_ISSUE=0
    CHECKED_DIRS=""
    
    while IFS= read -r module; do
        MODULE_DIR=$(dirname "$module")
        # Avoid checking same directory twice
        if echo "$CHECKED_DIRS" | grep -q "$MODULE_DIR"; then
            continue
        fi
        CHECKED_DIRS="$CHECKED_DIRS $MODULE_DIR"
        
        # Check if Windows version exists nearby
        if ls "$MODULE_DIR"/*win32* &>/dev/null 2>&1 || \
           ls "$MODULE_DIR"/../*win32* &>/dev/null 2>&1 || \
           ls "$MODULE_DIR"/../../*win32* &>/dev/null 2>&1; then
            continue
        else
            # This might be a platform-specific module without Windows support
            MODULE_NAME=$(echo "$module" | sed 's|node_modules/||' | cut -d'/' -f1-2)
            check_warn "Native module may lack Windows support: $MODULE_NAME"
            HAS_WIN_ISSUE=1
        fi
    done <<< "$NATIVE_MODULES"

    if [ "$HAS_WIN_ISSUE" -eq 0 ]; then
        check_pass "Native modules have Windows support"
    fi
fi

# Check claude-agent-sdk vendor binaries specifically
SDK_VENDOR="$EXTENSION_DIR/node_modules/@anthropic-ai/claude-agent-sdk/vendor"
if [ -d "$SDK_VENDOR" ]; then
    # Check ripgrep has Windows binaries
    if [ -d "$SDK_VENDOR/ripgrep" ]; then
        if [ -d "$SDK_VENDOR/ripgrep/x64-win32" ] || ls "$SDK_VENDOR/ripgrep/"*win* &>/dev/null 2>&1; then
            check_pass "claude-agent-sdk ripgrep has Windows binaries"
        else
            check_warn "claude-agent-sdk ripgrep may lack Windows binaries"
            echo "       This is OK - CI workflow removes non-Windows binaries"
        fi
    fi
fi

# Check fsevents using Node for reliable JSON parsing
FSEVENTS_CHECK=$(node -e "
const pkg = require('./package.json');
const deps = pkg.dependencies || {};
const optDeps = pkg.optionalDependencies || {};
if (deps.fsevents) {
    console.log('in-dependencies');
} else if (optDeps.fsevents) {
    console.log('in-optional');
} else {
    console.log('not-present');
}
" 2>/dev/null || echo "error")

case "$FSEVENTS_CHECK" in
    "in-dependencies")
        check_fail "fsevents must be in optionalDependencies, not dependencies"
        echo "       fsevents is macOS-only and will break Windows builds"
        ;;
    "in-optional")
        check_pass "fsevents is in optionalDependencies (OK)"
        ;;
    "not-present")
        check_pass "No fsevents dependency (OK for cross-platform)"
        ;;
    *)
        check_warn "Could not check fsevents location"
        ;;
esac

# Check for other macOS-only packages using Node for reliable JSON parsing
MACOS_ONLY_ISSUES=$(node -e "
const pkg = require('./package.json');
const deps = pkg.dependencies || {};
const optDeps = pkg.optionalDependencies || {};
const macosOnly = ['fsevents', 'macos-release', 'osx-temperature-sensor'];
const issues = [];
for (const p of macosOnly) {
    if (deps[p] && !optDeps[p]) {
        issues.push(p);
    }
}
if (issues.length > 0) {
    console.log(issues.join(','));
} else {
    console.log('none');
}
" 2>/dev/null || echo "error")

if [ "$MACOS_ONLY_ISSUES" != "none" ] && [ "$MACOS_ONLY_ISSUES" != "error" ]; then
    for pkg in $(echo "$MACOS_ONLY_ISSUES" | tr ',' ' '); do
        check_warn "$pkg is macOS-only - should be in optionalDependencies"
    done
fi

# Check webview.js exists (needed for both platforms)
WEBVIEW_JS="$EXTENSION_DIR/media/webview.js"
if [ -f "$WEBVIEW_JS" ]; then
    WEBVIEW_SIZE=$(stat -f%z "$WEBVIEW_JS" 2>/dev/null || stat -c%s "$WEBVIEW_JS" 2>/dev/null)
    if [ "$WEBVIEW_SIZE" -gt 500000 ]; then
        check_pass "webview.js exists ($(format_bytes $WEBVIEW_SIZE))"
    else
        check_fail "webview.js is too small ($(format_bytes $WEBVIEW_SIZE))"
        echo "       Run: cd extensions/ritemark/webview && npm run build"
    fi
else
    check_fail "webview.js not found - required for both platforms"
    echo "       Run: cd extensions/ritemark/webview && npm run build"
fi

cd "$PROJECT_ROOT"
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
    echo "Common fixes:"
    echo "  - Peer deps: Update package versions in package.json"
    echo "  - TypeScript: Fix type errors in src/"
    echo "  - Lock file: rm package-lock.json && npm install"
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
