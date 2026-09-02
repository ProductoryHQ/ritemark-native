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

# Link the one canonical extension source into this worktree's VS Code tree.
# A physical directory is never overwritten because it may contain unique work.
echo "[4/4] Linking RiteMark extension into VS Code..."
"$ROOT_DIR/scripts/ensure-dev-extension-link.sh" --root "$ROOT_DIR"

echo ""
echo "Setup complete!"
echo ""
echo "To build VS Code, run: npm run compile (in vscode folder)"
echo "To run VS Code, run: ./scripts/code.sh (in vscode folder)"
