#!/bin/bash
set -e

echo "Building RiteMark Native for macOS..."
echo ""

cd "$(dirname "$0")/.."
ROOT_DIR=$(pwd)

# Ensure extension is built and copied
echo "[1/4] Building RiteMark extension..."
cd "$ROOT_DIR/extensions/ritemark"
npm run compile

echo "[2/4] Copying extension to VS Code..."
rm -rf "$ROOT_DIR/vscode/extensions/ritemark"
cp -r "$ROOT_DIR/extensions/ritemark" "$ROOT_DIR/vscode/extensions/"

# Apply branding
echo "[3/4] Applying branding..."
cp "$ROOT_DIR/branding/product.json" "$ROOT_DIR/vscode/product.json"

# Build macOS app
echo "[4/4] Building macOS app (this takes a while)..."
cd "$ROOT_DIR/vscode"
npm run gulp vscode-darwin-arm64

echo ""
echo "Build complete!"
echo ""
echo "Output: $ROOT_DIR/VSCode-darwin-arm64/"
echo ""
echo "To run: open $ROOT_DIR/VSCode-darwin-arm64/Visual\ Studio\ Code\ -\ OSS.app"
