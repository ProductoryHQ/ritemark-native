#!/bin/bash
# validate-patches.sh - Quick validation before full build
# Catches TypeScript errors in ~1-2 minutes instead of 25 minutes

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

echo "========================================"
echo "RiteMark Patch Validator"
echo "========================================"

# Step 1: Check patches are applied (check exit code, not string parsing)
echo ""
echo "[1/4] Checking patches can be applied..."

if ! "$SCRIPT_DIR/apply-patches.sh" --dry-run > /dev/null 2>&1; then
    echo "❌ Patch application failed!"
    "$SCRIPT_DIR/apply-patches.sh" --dry-run 2>&1 || true
    exit 1
fi
echo "✅ Patches OK"

cd vscode

# Step 2: Get list of files modified by patches (from actual patch files, not git diff HEAD)
echo ""
echo "[2/4] Identifying patched files..."

PATCHED_FILES=""
for patch in "$ROOT_DIR/patches/vscode"/*.patch; do
    if [ -f "$patch" ]; then
        # Extract file paths from patch (lines starting with +++ b/)
        FILES=$(grep -E '^\+\+\+ b/' "$patch" | sed 's|^+++ b/||' || true)
        PATCHED_FILES="$PATCHED_FILES $FILES"
    fi
done

# Remove duplicates and filter to .ts/.tsx files
PATCHED_FILES=$(echo "$PATCHED_FILES" | tr ' ' '\n' | sort -u | grep -E '\.(ts|tsx)$' || true)

if [ -z "$PATCHED_FILES" ]; then
    echo "⚠️  No TypeScript/TSX files found in patches"
else
    echo "Patched TypeScript files:"
    echo "$PATCHED_FILES" | sed 's/^/  - /'
fi

# Step 3: Run REAL TypeScript check (fast incremental check)
echo ""
echo "[3/4] Running TypeScript type check..."

# Use tsc with noEmit for fast type checking
# This catches unused imports, uninitialized properties, type errors, etc.
TSC_OUTPUT=$(mktemp)
TSC_EXIT=0

# Run tsc on the src tsconfig - this is the real check
if ! yarn -s tsc -p src/tsconfig.json --noEmit --pretty false 2>&1 | head -100 > "$TSC_OUTPUT"; then
    TSC_EXIT=1
fi

# Check if there were errors in patched files specifically
PATCH_ERRORS=0
for file in $PATCHED_FILES; do
    if grep -q "$file" "$TSC_OUTPUT" 2>/dev/null; then
        PATCH_ERRORS=1
        echo "❌ TypeScript errors in patched file: $file"
        grep "$file" "$TSC_OUTPUT" | head -10
        echo ""
    fi
done

if [ $PATCH_ERRORS -eq 1 ]; then
    echo "❌ TypeScript errors found in patched files!"
    rm -f "$TSC_OUTPUT"
    exit 1
fi

# If tsc failed but not in our patched files, warn but continue
if [ $TSC_EXIT -ne 0 ]; then
    echo "⚠️  TypeScript has errors (not in patched files) - may be pre-existing"
    head -20 "$TSC_OUTPUT"
fi

rm -f "$TSC_OUTPUT"
echo "✅ TypeScript check passed for patched files"

# Step 4: Lint hints (non-blocking, just warnings)
echo ""
echo "[4/4] Running lint hints (non-blocking)..."

HINTS=0
for file in $PATCHED_FILES; do
    if [ -f "$file" ]; then
        FILENAME=$(basename "$file")

        # Hint: MenuId imported but not used
        if grep -q "^import.*MenuId.*from" "$file" 2>/dev/null; then
            if ! grep -q "[^/]menuId:" "$file" 2>/dev/null && ! grep -q "MenuId\." "$file" 2>/dev/null; then
                echo "⚠️  HINT: $FILENAME may have unused MenuId import"
                HINTS=$((HINTS + 1))
            fi
        fi

        # Hint: commented constructor calls with uncommented methods
        if grep -q "// this\._viewContainer = this\.registerViewContainer" "$file" 2>/dev/null; then
            if grep -q "^[[:space:]]*private registerViewContainer" "$file" 2>/dev/null; then
                echo "⚠️  HINT: $FILENAME has registerViewContainer() that may be unused"
                HINTS=$((HINTS + 1))
            fi
        fi
    fi
done

if [ $HINTS -eq 0 ]; then
    echo "✅ No lint hints"
else
    echo "Found $HINTS hint(s) - review recommended but not blocking"
fi

# Summary
echo ""
echo "========================================"
echo "✅ All validations passed!"
echo "========================================"
echo ""
echo "Ready to build:"
echo "  cd vscode && yarn gulp vscode-darwin-arm64"
