#!/bin/bash
#
# check-native-modules.sh - Verify VS Code native modules match the dev arch
#
# Usage: ./scripts/check-native-modules.sh
#
# Background:
#   Dev mode runs on arm64 Electron. If `npm install` ran from an x64
#   shell (default macOS shell with Node v23 x64) instead of the
#   `arch -arm64 + nvm use` wrapper, native modules under
#   `vscode/node_modules` get rebuilt for x86_64 and fail to dlopen at
#   runtime. Symptoms: ERR_DLOPEN_FAILED, blank terminal, ptyHost dead,
#   logging broken. See GitHub issue #39.
#
#   This script does NOT rebuild — only checks and reports. To fix:
#     cd vscode && arch -arm64 /bin/zsh -c \
#       'source "$HOME/.nvm/nvm.sh" && nvm use && npm rebuild'

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
VSCODE_NM="$ROOT_DIR/vscode/node_modules"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Skip if not on macOS arm64 — different platforms have different arch needs
if [[ "$(uname -s)" != "Darwin" ]] || [[ "$(uname -m)" != "arm64" ]]; then
    echo "Not on Darwin arm64 — skipping native module arch check."
    exit 0
fi

if [[ ! -d "$VSCODE_NM" ]]; then
    echo -e "${YELLOW}vscode/node_modules not found — skip (run 'cd vscode && npm install' first).${NC}"
    exit 0
fi

# Modules known to break dev mode if they're the wrong arch.
# Universal binaries (utf-8-validate, fsevents) are skipped — they work on both archs.
MODULES=(
    "@vscode/spdlog/build/Release/spdlog.node"
    "node-pty/build/Release/pty.node"
    "kerberos/build/Release/kerberos.node"
    "native-keymap/build/Release/keymapping.node"
    "@parcel/watcher/build/Release/watcher.node"
    "bufferutil/build/Release/bufferutil.node"
)

ERRORS=0
MISSING=0

for rel in "${MODULES[@]}"; do
    f="$VSCODE_NM/$rel"
    if [[ ! -f "$f" ]]; then
        MISSING=$((MISSING + 1))
        continue
    fi
    desc=$(file "$f" 2>/dev/null)
    if echo "$desc" | grep -q "arm64"; then
        echo -e "  ${GREEN}OK${NC}    $rel"
    else
        echo -e "  ${RED}WRONG${NC} $rel"
        echo -e "        $desc"
        ERRORS=$((ERRORS + 1))
    fi
done

echo ""
if [[ $ERRORS -gt 0 ]]; then
    echo -e "${RED}========================================"
    echo "$ERRORS native module(s) have the wrong architecture."
    echo "========================================${NC}"
    echo ""
    echo "To fix:"
    echo ""
    echo "  cd vscode && arch -arm64 /bin/zsh -c \\"
    echo "    'source \"\$HOME/.nvm/nvm.sh\" && nvm use && npm rebuild'"
    echo ""
    echo "Then re-run this check. See GitHub issue #39 for context."
    exit 1
fi

if [[ $MISSING -gt 0 ]]; then
    echo -e "${YELLOW}$MISSING expected native module(s) not present (likely OK if not yet installed).${NC}"
fi

echo -e "${GREEN}Native modules look fine for arm64 dev mode.${NC}"
