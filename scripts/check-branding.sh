#!/bin/bash
# Check branding and version consistency across all files
# Run: ./scripts/check-branding.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Source of truth
BRANDING_FILE="$ROOT_DIR/branding/BRANDING.json"
VERSION_FILE="$ROOT_DIR/branding/VERSION"

if [ ! -f "$BRANDING_FILE" ]; then
    echo "ERROR: $BRANDING_FILE not found"
    exit 1
fi

if [ ! -f "$VERSION_FILE" ]; then
    echo "ERROR: $VERSION_FILE not found"
    exit 1
fi

# Read source of truth
VERSION=$(cat "$VERSION_FILE" | tr -d '\n')
PRODUCT_NAME=$(grep '"productName"' "$BRANDING_FILE" | sed 's/.*: *"\([^"]*\)".*/\1/')

echo "========================================"
echo "Branding & Version Check"
echo "========================================"
echo "Source of truth:"
echo "  Product: $PRODUCT_NAME"
echo "  Version: $VERSION"
echo ""

ERRORS=0

# Function to check a file
check_file() {
    local file="$1"
    local pattern="$2"
    local expected="$3"
    local description="$4"

    if [ ! -f "$file" ]; then
        echo "SKIP: $file (not found)"
        return
    fi

    local actual=$(grep -o "$pattern" "$file" 2>/dev/null | head -1)

    if [ -z "$actual" ]; then
        echo "WARN: $description - pattern not found in $file"
        return
    fi

    if [ "$actual" != "$expected" ]; then
        echo "FAIL: $description"
        echo "      File: $file"
        echo "      Expected: $expected"
        echo "      Found: $actual"
        ERRORS=$((ERRORS + 1))
    else
        echo "OK: $description"
    fi
}

echo "Checking versions..."
echo "---"

# Check extension package.json version (use node for reliable JSON parsing)
EXT_VERSION=$(node -p "require('$ROOT_DIR/extensions/ritemark/package.json').version")
if [ "$EXT_VERSION" != "$VERSION" ]; then
    echo "FAIL: extensions/ritemark/package.json version"
    echo "      Expected: $VERSION, Found: $EXT_VERSION"
    ERRORS=$((ERRORS + 1))
else
    echo "OK: extensions/ritemark/package.json version = $VERSION"
fi

# Check branding/product.json version
PRODUCT_VERSION=$(grep '"ritemarkVersion"' "$ROOT_DIR/branding/product.json" | sed 's/.*: *"\([^"]*\)".*/\1/')
if [ "$PRODUCT_VERSION" != "$VERSION" ]; then
    echo "FAIL: branding/product.json ritemarkVersion"
    echo "      Expected: $VERSION, Found: $PRODUCT_VERSION"
    ERRORS=$((ERRORS + 1))
else
    echo "OK: branding/product.json ritemarkVersion = $VERSION"
fi

# Check installer version
if [ -f "$ROOT_DIR/installer/windows/ritemark.iss" ]; then
    ISS_VERSION=$(grep '#define AppVersion' "$ROOT_DIR/installer/windows/ritemark.iss" | sed 's/.*"\([^"]*\)".*/\1/')
    if [ "$ISS_VERSION" != "$VERSION" ]; then
        echo "FAIL: installer/windows/ritemark.iss AppVersion"
        echo "      Expected: $VERSION, Found: $ISS_VERSION"
        ERRORS=$((ERRORS + 1))
    else
        echo "OK: installer/windows/ritemark.iss AppVersion = $VERSION"
    fi
fi

echo ""
echo "Checking product name..."
echo "---"

# Check for wrong capitalization "RiteMark" (should be "Ritemark")
WRONG_CAPS=$(grep -r "RiteMark" "$ROOT_DIR/branding" "$ROOT_DIR/installer" "$ROOT_DIR/extensions/ritemark/package.json" 2>/dev/null | grep -v ".git" | grep -v "node_modules" || true)
if [ -n "$WRONG_CAPS" ]; then
    echo "FAIL: Found 'RiteMark' (wrong capitalization, should be 'Ritemark'):"
    echo "$WRONG_CAPS" | head -10
    ERRORS=$((ERRORS + 1))
else
    echo "OK: No 'RiteMark' found (correct: 'Ritemark')"
fi

# Check branding/product.json names
PRODUCT_NAME_SHORT=$(grep '"nameShort"' "$ROOT_DIR/branding/product.json" | sed 's/.*: *"\([^"]*\)".*/\1/')
if [ "$PRODUCT_NAME_SHORT" != "$PRODUCT_NAME" ]; then
    echo "FAIL: branding/product.json nameShort"
    echo "      Expected: $PRODUCT_NAME, Found: $PRODUCT_NAME_SHORT"
    ERRORS=$((ERRORS + 1))
else
    echo "OK: branding/product.json nameShort = $PRODUCT_NAME"
fi

echo ""
echo "========================================"
if [ $ERRORS -gt 0 ]; then
    echo "FAILED: $ERRORS error(s) found"
    echo ""
    echo "To fix, run: ./scripts/sync-branding.sh"
    exit 1
else
    echo "PASSED: All branding checks OK"
fi
