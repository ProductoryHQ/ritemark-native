#!/bin/bash
#
# build-prod-windows.sh - Build RiteMark for Windows x64
#
# This script builds a production version of RiteMark for Windows.
# Prerequisites:
#   - Node.js matching vscode/.nvmrc
#   - Python 3.11
#   - Visual Studio 2022/2026 with C++ build tools
#   - Yarn
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
VSCODE_DIR="$ROOT_DIR/vscode"
EXTENSION_DIR="$ROOT_DIR/extensions/ritemark"
BUILD_OUTPUT="$ROOT_DIR/VSCode-win32-x64"
REQUIRED_NODE_VERSION="$(tr -d '[:space:]' < "$VSCODE_DIR/.nvmrc" 2>/dev/null || true)"
WELCOME_SRC="$VSCODE_DIR/out/vs/workbench/contrib/welcomeGettingStarted/browser/media"
WELCOME_DEST="$BUILD_OUTPUT/resources/app/out/vs/workbench/contrib/welcomeGettingStarted/browser/media"

use_repo_node() {
    local nvm_sh="${NVM_DIR:-$HOME/.nvm}/nvm.sh"

    if [[ -z "$REQUIRED_NODE_VERSION" || ! -s "$nvm_sh" ]]; then
        return
    fi

    local current_version
    current_version=$(node -v 2>/dev/null || true)
    if [[ "$current_version" == "v$REQUIRED_NODE_VERSION" ]]; then
        return
    fi

    export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
    # shellcheck disable=SC1090
    source "$nvm_sh"
    nvm use "$REQUIRED_NODE_VERSION" >/dev/null
}

use_repo_node

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================"
echo "RiteMark Windows Build Script"
echo "========================================${NC}"
echo ""

# Step 1: Check prerequisites
echo -e "${YELLOW}Step 1: Checking prerequisites...${NC}"

# Check Node version
NODE_VERSION=$(node -v)
echo "  Node.js: $NODE_VERSION"
if [[ -n "$REQUIRED_NODE_VERSION" && "$NODE_VERSION" != "v$REQUIRED_NODE_VERSION" ]]; then
    echo -e "${YELLOW}  Warning: Node.js $REQUIRED_NODE_VERSION from vscode/.nvmrc is recommended${NC}"
fi

# Check yarn
if command -v yarn &> /dev/null; then
    echo "  Yarn: $(yarn -v)"
else
    echo -e "${RED}  Error: Yarn not found. Install with: npm install -g yarn${NC}"
    exit 1
fi

# Check Python
if command -v python &> /dev/null; then
    echo "  Python: $(python --version)"
else
    echo -e "${RED}  Error: Python not found${NC}"
    exit 1
fi

echo ""

# Step 2: Apply patches
echo -e "${YELLOW}Step 2: Applying patches...${NC}"
cd "$ROOT_DIR"
if [ -f "./scripts/apply-patches.sh" ]; then
    ./scripts/apply-patches.sh || true  # Continue even if some patches fail
fi
echo ""

# Step 3: Copy extension (not symlink) for Windows build
echo -e "${YELLOW}Step 3: Copying RiteMark extension...${NC}"
cd "$VSCODE_DIR"

# Remove existing extension (symlink or directory)
if [ -L "extensions/ritemark" ] || [ -d "extensions/ritemark" ]; then
    rm -rf "extensions/ritemark"
    echo "  Removed existing extension"
fi

# Copy extension source
cp -r "$EXTENSION_DIR" "extensions/ritemark"
echo "  Copied extension from $EXTENSION_DIR"
echo ""

# Step 4: Compile extension
echo -e "${YELLOW}Step 4: Compiling RiteMark extension...${NC}"
cd "$VSCODE_DIR/extensions/ritemark"
npm install
npm run compile
echo -e "${GREEN}  Extension compiled${NC}"
echo ""

# Step 5: Copy branding (product.json + Windows icons)
echo -e "${YELLOW}Step 5: Copying branding...${NC}"
cd "$ROOT_DIR"
if [ -f "branding/product.json" ]; then
    cp "branding/product.json" "$VSCODE_DIR/product.json"
    echo "  Copied product.json"
fi

# Copy Windows icon resources (taskbar, Start menu tiles)
if [ -f "branding/icons/icon.ico" ]; then
    cp "branding/icons/icon.ico" "$VSCODE_DIR/resources/win32/code.ico"
    echo "  Copied icon.ico → resources/win32/code.ico (taskbar icon)"
fi
if [ -f "branding/win32/tile_70x70.png" ]; then
    cp "branding/win32/tile_70x70.png" "$VSCODE_DIR/resources/win32/code_70x70.png"
    echo "  Copied tile_70x70.png → resources/win32/code_70x70.png"
fi
if [ -f "branding/win32/tile_150x150.png" ]; then
    cp "branding/win32/tile_150x150.png" "$VSCODE_DIR/resources/win32/code_150x150.png"
    echo "  Copied tile_150x150.png → resources/win32/code_150x150.png"
fi
echo ""

# Step 6: Install VS Code dependencies
echo -e "${YELLOW}Step 6: Installing VS Code dependencies...${NC}"
cd "$VSCODE_DIR"
yarn install
echo ""

# Step 7: Build VS Code for Windows x64
echo -e "${YELLOW}Step 7: Building VS Code for Windows x64...${NC}"
echo "  This may take 20-30 minutes..."
yarn gulp vscode-win32-x64-min
echo ""

# Step 8: Fix welcome page logo (inline SVG as data URI)
# The vscode-file:// protocol doesn't serve SVGs correctly on Windows,
# so we replace the FileAccess.asBrowserUri() call with an inline data URI.
echo -e "${YELLOW}Step 8: Fixing welcome page logo for Windows...${NC}"
mkdir -p "$WELCOME_DEST"
cp -R "$WELCOME_SRC"/. "$WELCOME_DEST"/
LOGO_SVG="$BUILD_OUTPUT/resources/app/out/vs/workbench/contrib/welcomeGettingStarted/common/media/ritemark-logo.svg"
WORKBENCH_JS="$BUILD_OUTPUT/resources/app/out/vs/workbench/workbench.desktop.main.js"
if [ -f "$LOGO_SVG" ] && [ -f "$WORKBENCH_JS" ]; then
    B64=$(base64 -w0 "$LOGO_SVG")
    DATA_URI="data:image/svg+xml;base64,${B64}"
    node -e "
        const fs = require('fs');
        let js = fs.readFileSync(process.argv[1], 'utf8');
        const search = 'Us.asBrowserUri(\"vs/workbench/contrib/welcomeGettingStarted/common/media/ritemark-logo.svg\")';
        if (js.includes(search)) {
            js = js.replace(search, '\"' + process.argv[2] + '\"');
            fs.writeFileSync(process.argv[1], js, 'utf8');
            console.log('  Logo SVG inlined as data URI');
        } else {
            console.log('  Warning: FileAccess.asBrowserUri call not found (may already be fixed)');
        }
    " "$WORKBENCH_JS" "$DATA_URI"
    echo -e "${GREEN}  Welcome page logo fixed${NC}"
else
    echo -e "${YELLOW}  Logo SVG or workbench.js not found, skipping${NC}"
fi
echo ""

# Step 9: Verify build
echo -e "${YELLOW}Step 9: Verifying build...${NC}"
cd "$ROOT_DIR"

if [ -d "$BUILD_OUTPUT" ]; then
    echo -e "${GREEN}  Build directory exists: $BUILD_OUTPUT${NC}"
else
    echo -e "${RED}  Error: Build directory not found${NC}"
    exit 1
fi

# Check for RiteMark.exe or Code - OSS.exe
if [ -f "$BUILD_OUTPUT/RiteMark.exe" ]; then
    echo -e "${GREEN}  Found: RiteMark.exe${NC}"
elif [ -f "$BUILD_OUTPUT/Code - OSS.exe" ]; then
    echo -e "${YELLOW}  Found: Code - OSS.exe (not RiteMark branded)${NC}"
else
    echo -e "${RED}  Error: No executable found${NC}"
    exit 1
fi

# Check extension in build output
if [ -d "$BUILD_OUTPUT/resources/app/extensions/ritemark" ]; then
    echo -e "${GREEN}  Extension folder exists in build${NC}"

    # Check for extension.js
    if [ -f "$BUILD_OUTPUT/resources/app/extensions/ritemark/out/extension.js" ]; then
        echo -e "${GREEN}  extension.js found${NC}"
    else
        echo -e "${RED}  extension.js missing!${NC}"
    fi

    # Check for webview bundle
    if [ -f "$BUILD_OUTPUT/resources/app/extensions/ritemark/media/webview.js" ]; then
        SIZE=$(stat -c%s "$BUILD_OUTPUT/resources/app/extensions/ritemark/media/webview.js" 2>/dev/null || stat -f%z "$BUILD_OUTPUT/resources/app/extensions/ritemark/media/webview.js" 2>/dev/null)
        if [ "$SIZE" -gt 500000 ]; then
            echo -e "${GREEN}  webview.js: ${SIZE} bytes (OK)${NC}"
        else
            echo -e "${RED}  webview.js: ${SIZE} bytes (TOO SMALL!)${NC}"
        fi
    else
        echo -e "${RED}  webview.js missing!${NC}"
    fi
else
    echo -e "${RED}  Extension folder missing in build!${NC}"
fi

if [ -f "$WELCOME_DEST/ritemark-welcome-logo-full.svg" ] && [ -f "$WELCOME_DEST/ritemark-welcome-hero-bg.png" ]; then
    echo -e "${GREEN}  Welcome assets present${NC}"
else
    echo -e "${RED}  Welcome assets missing in build!${NC}"
fi

echo ""
echo -e "${BLUE}========================================"
echo "Build Complete!"
echo "========================================${NC}"
echo ""
echo "To run: $BUILD_OUTPUT/RiteMark.exe"
echo ""
