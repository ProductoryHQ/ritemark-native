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

# Every .node file under vscode/node_modules and the built-in extensions' node_modules (dev mode loads both), not
# a fixed list: a module that upstream adds after a VS Code update is checked too (Sprint 135, R4). For each file:
#   - a Mach-O file with an arm64 slice (single-arch or universal) passes;
#   - a Mach-O file without one, whose path names another platform or architecture (prebuilds/<os>-<arch>/,
#     -darwin-x64, /x64/, linux, win32), is a multi-platform payload and is skipped;
#   - any other Mach-O file fails: a build/Release build made for the wrong architecture;
#   - ELF and PE files are other systems' payloads and are skipped.
ERRORS=0
CHECKED=0
SKIPPED=0

while IFS= read -r f; do
    rel="${f#"$ROOT_DIR/vscode/"}"
    desc=$(file -b "$f" 2>/dev/null)
    case "$desc" in
        *Mach-O*)
            if echo "$desc" | grep -q "arm64"; then
                CHECKED=$((CHECKED + 1))
            elif echo "$rel" | grep -Eq '(prebuilds/[^/]*-|darwin-x64|/x64/|x86_64|linux|win32|windows)'; then
                SKIPPED=$((SKIPPED + 1))
            else
                echo -e "  ${RED}WRONG${NC} $rel"
                echo -e "        $desc"
                ERRORS=$((ERRORS + 1))
            fi
            ;;
        *)
            SKIPPED=$((SKIPPED + 1))
            ;;
    esac
done < <(find "$VSCODE_NM" "$ROOT_DIR/vscode/extensions" -path "$ROOT_DIR/vscode/extensions/ritemark" -prune -o -name '*.node' -type f -print 2>/dev/null)

if [[ $CHECKED -eq 0 && $ERRORS -eq 0 ]]; then
    echo -e "${RED}No native module found under vscode/node_modules: the install looks incomplete.${NC}"
    echo "Run: cd vscode && arch -arm64 /bin/zsh -c 'source \"\$HOME/.nvm/nvm.sh\" && nvm use && npm ci'"
    exit 1
fi

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

echo -e "${GREEN}Native modules look fine for arm64 dev mode: $CHECKED arm64, $SKIPPED other platforms' payloads skipped.${NC}"
