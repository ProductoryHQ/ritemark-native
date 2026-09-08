#!/bin/bash
set -e

echo "Setting up RiteMark Native..."
echo ""

cd "$(dirname "$0")/.."
ROOT_DIR=$(pwd)

# Initialize submodules
echo "[1/5] Initializing submodules..."
git submodule update --init --recursive

# Install VS Code dependencies
echo "[2/5] Installing VS Code dependencies..."
cd vscode
npm install

# Build extension
echo "[3/5] Building RiteMark extension..."
cd "$ROOT_DIR/extensions/ritemark"
npm install
npm run compile

# Link the one canonical extension source into this worktree's VS Code tree.
# A physical directory is never overwritten because it may contain unique work.
echo "[4/5] Linking RiteMark extension into VS Code..."
"$ROOT_DIR/scripts/ensure-dev-extension-link.sh" --root "$ROOT_DIR"

# Install the pre-commit hook. .git/hooks is not tracked, so every clone starts
# without it — and a machine that never ran this step silently skips all twelve
# commit-time invariants, including the extension symlink, webview bundle
# freshness and the Settings-stub guard. That is not hypothetical: it is how
# 7249845c landed without the runtime-matrix update Check 11 requires.
echo "[5/5] Installing pre-commit hook..."
HOOK_DIR="$(git -C "$ROOT_DIR" rev-parse --git-path hooks)"
mkdir -p "$HOOK_DIR"
cat > "$HOOK_DIR/pre-commit" <<'HOOK'
#!/bin/sh
exec "$(git rev-parse --show-toplevel)/.claude/hooks/pre-commit-validator.sh"
HOOK
chmod +x "$HOOK_DIR/pre-commit"

echo ""
echo "Setup complete!"
echo ""
echo "To build VS Code, run: npm run compile (in vscode folder)"
echo "To run VS Code, run: ./scripts/code.sh (in vscode folder)"
