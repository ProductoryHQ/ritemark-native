#!/bin/bash
set -e

echo "Building RiteMark Native for macOS..."
echo ""

cd "$(dirname "$0")/.."
ROOT_DIR=$(pwd)

# =============================================================================
# PHASE 0: Pre-flight checks (fast validation before expensive build)
# =============================================================================
echo "[0/5] Running pre-flight checks..."

# Check Node.js version
NODE_VERSION=$(node -v | sed 's/v//')
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
    echo "❌ Node.js $NODE_VERSION is too old. Require >= 18"
    exit 1
fi
echo "  ✓ Node.js $NODE_VERSION"

# Check VS Code node_modules exists
if [ ! -d "$ROOT_DIR/vscode/node_modules" ]; then
    echo "❌ VS Code node_modules not found. Run: cd vscode && npm install"
    exit 1
fi
echo "  ✓ VS Code node_modules exists"

# Check esbuild is installed and working
cd "$ROOT_DIR/vscode"
if ! node -e "require('esbuild')" 2>/dev/null; then
    echo "❌ esbuild not found or broken. Run: cd vscode && npm install esbuild@0.23.0 --save-dev"
    exit 1
fi
echo "  ✓ esbuild is available"

# Check patches are applied
cd "$ROOT_DIR"
if [ -x "./scripts/apply-patches.sh" ]; then
    PATCH_STATUS=$(./scripts/apply-patches.sh --dry-run 2>&1 || true)
    if echo "$PATCH_STATUS" | grep -q "FAILED\|not applied"; then
        echo "⚠️  Some patches may not be applied. Run: ./scripts/apply-patches.sh"
    else
        echo "  ✓ Patches appear to be applied"
    fi
fi

# Check extension webview bundle exists and is valid size
WEBVIEW_SIZE=$(stat -f%z "$ROOT_DIR/extensions/ritemark/media/webview.js" 2>/dev/null || echo "0")
if [ "$WEBVIEW_SIZE" -lt 100000 ]; then
    echo "❌ Webview bundle missing or too small ($WEBVIEW_SIZE bytes). Run: cd extensions/ritemark/webview && npm run build"
    exit 1
fi
echo "  ✓ Webview bundle exists ($(($WEBVIEW_SIZE / 1024))KB)"

echo "  Pre-flight checks passed!"
echo ""

# =============================================================================
# PHASE 1: Build RiteMark extension
# =============================================================================
echo "[1/5] Building RiteMark extension..."
cd "$ROOT_DIR/extensions/ritemark"
npm run compile

echo "[2/5] Copying extension to VS Code..."
rm -rf "$ROOT_DIR/vscode/extensions/ritemark"
cp -r "$ROOT_DIR/extensions/ritemark" "$ROOT_DIR/vscode/extensions/"

# Apply branding
echo "[3/5] Applying branding..."
cp "$ROOT_DIR/branding/product.json" "$ROOT_DIR/vscode/product.json"

# Build macOS app
echo "[4/5] Building macOS app (this takes a while)..."
cd "$ROOT_DIR/vscode"
npm run gulp vscode-darwin-arm64

# Verify build output exists
echo "[5/5] Verifying build..."
if [ -d "$ROOT_DIR/VSCode-darwin-arm64" ]; then
    APP_NAME=$(ls "$ROOT_DIR/VSCode-darwin-arm64" | grep ".app" | head -1)
    if [ -n "$APP_NAME" ]; then
        echo "  ✓ Build successful: $APP_NAME"
    fi
fi

echo ""
echo "Build complete!"
echo ""
echo "Output: $ROOT_DIR/VSCode-darwin-arm64/"
echo ""
echo "To run: open $ROOT_DIR/VSCode-darwin-arm64/*.app"
