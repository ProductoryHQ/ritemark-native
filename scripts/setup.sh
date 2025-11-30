#!/bin/bash
set -e

echo "Setting up RiteMark Native..."
echo ""

cd "$(dirname "$0")/.."
ROOT_DIR=$(pwd)

# Initialize submodules
echo "[1/4] Initializing submodules..."
git submodule update --init --recursive

# Install VS Code dependencies
echo "[2/4] Installing VS Code dependencies..."
cd vscode
npm install

# Build extension
echo "[3/4] Building RiteMark extension..."
cd "$ROOT_DIR/extensions/ritemark"
npm install
npm run compile

# Copy extension to VS Code
echo "[4/4] Copying extension to VS Code..."
cp -r "$ROOT_DIR/extensions/ritemark" "$ROOT_DIR/vscode/extensions/"

echo ""
echo "Setup complete!"
echo ""
echo "To build VS Code, run: npm run compile (in vscode folder)"
echo "To run VS Code, run: ./scripts/code.sh (in vscode folder)"
