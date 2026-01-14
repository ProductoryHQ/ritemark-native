#!/bin/bash
#
# Create Extension-Only Release
#
# Generates update-manifest.json and prepares files for an extension-only
# GitHub release. Does NOT modify the app bundle.
#
# Usage:
#   ./scripts/create-extension-release.sh <version>
#
# Example:
#   ./scripts/create-extension-release.sh 1.0.1-ext.1
#
# Prerequisites:
#   - Extension must be compiled (npm run compile in extensions/ritemark)
#   - Webview must be built (npm run build in extensions/ritemark/webview)
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
EXTENSION_DIR="$PROJECT_ROOT/extensions/ritemark"
OUTPUT_DIR="$PROJECT_ROOT/release-staging"
REPO_OWNER="jarmo-productory"
REPO_NAME="ritemark-public"

# Validate arguments
if [ -z "$1" ]; then
    echo -e "${RED}Error: Version argument required${NC}"
    echo ""
    echo "Usage: $0 <version>"
    echo "Example: $0 1.0.1-ext.1"
    exit 1
fi

VERSION="$1"

# Validate version format
if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-ext\.[0-9]+)?$'; then
    echo -e "${RED}Error: Invalid version format: $VERSION${NC}"
    echo "Expected format: X.Y.Z or X.Y.Z-ext.N"
    exit 1
fi

# Extract base version
BASE_VERSION=$(echo "$VERSION" | sed 's/-ext\.[0-9]*$//')
if [ "$BASE_VERSION" == "$VERSION" ]; then
    # No -ext suffix - this is a full release
    echo -e "${YELLOW}Warning: Version has no -ext suffix. This should be a full app release.${NC}"
    echo "For extension-only releases, use version format: X.Y.Z-ext.N"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if ! echo "$REPLY" | grep -qE '^[Yy]$'; then
        exit 1
    fi
fi

echo -e "${GREEN}Creating extension release v$VERSION${NC}"
echo ""

# Check prerequisites
echo "Checking prerequisites..."

if [ ! -f "$EXTENSION_DIR/out/extension.js" ]; then
    echo -e "${RED}Error: Extension not compiled. Run 'npm run compile' in extensions/ritemark${NC}"
    exit 1
fi

if [ ! -f "$EXTENSION_DIR/media/webview.js" ]; then
    echo -e "${RED}Error: Webview not built. Run 'npm run build' in extensions/ritemark/webview${NC}"
    exit 1
fi

# Check webview size (should be ~900KB, not 64KB stub)
WEBVIEW_SIZE=$(stat -f%z "$EXTENSION_DIR/media/webview.js" 2>/dev/null || stat -c%s "$EXTENSION_DIR/media/webview.js")
if [ "$WEBVIEW_SIZE" -lt 100000 ]; then
    echo -e "${RED}Error: webview.js is only ${WEBVIEW_SIZE} bytes (expected ~900KB)${NC}"
    echo "Run 'npm run build' in extensions/ritemark/webview"
    exit 1
fi

echo -e "${GREEN}Prerequisites OK${NC}"
echo ""

# Create output directory
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR/upload"

# Start manifest
MANIFEST="$OUTPUT_DIR/upload/update-manifest.json"
RELEASE_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat > "$MANIFEST" << EOF
{
  "version": "$VERSION",
  "appVersion": "$BASE_VERSION",
  "extensionVersion": "$VERSION",
  "type": "extension",
  "installType": "user-extension",
  "extensionId": "ritemark",
  "extensionDirName": "ritemark-$VERSION",
  "releaseDate": "$RELEASE_DATE",
  "minimumAppVersion": "$BASE_VERSION",
  "files": [
EOF

# Files to include in extension release
FILES="
out/extension.js
out/ritemarkEditor.js
out/excelEditor.js
out/aiProvider.js
out/commands/index.js
out/export/htmlExporter.js
out/export/pdfExporter.js
out/export/docxExporter.js
out/update/index.js
out/update/updateService.js
out/update/updateStorage.js
out/update/updateScheduler.js
out/update/updateNotification.js
out/update/versionService.js
out/update/versionComparison.js
out/update/githubClient.js
out/update/updateManifest.js
out/update/userExtensionInstaller.js
media/webview.js
media/webview.js.map
package.json
"

echo "Processing files..."

FIRST=true
for file in $FILES; do
    src="$EXTENSION_DIR/$file"
    if [ -f "$src" ]; then
        # Calculate SHA-256 and size
        CHECKSUM=$(shasum -a 256 "$src" | cut -d' ' -f1)
        SIZE=$(stat -f%z "$src" 2>/dev/null || stat -c%s "$src")

        # Create download name (flatten path)
        DOWNLOAD_NAME=$(basename "$file")
        if echo "$file" | grep -q "^out/"; then
            # For out/ files, replace / with - to flatten
            DOWNLOAD_NAME=$(echo "$file" | sed 's|^out/||' | tr '/' '-')
        fi

        # Copy to upload directory
        cp "$src" "$OUTPUT_DIR/upload/$DOWNLOAD_NAME"

        echo "  ✓ $file → $DOWNLOAD_NAME ($SIZE bytes)"

        # Add to manifest
        if [ "$FIRST" = "true" ]; then
            FIRST=false
        else
            echo "," >> "$MANIFEST"
        fi

        cat >> "$MANIFEST" << EOF
    {
      "path": "$file",
      "url": "https://github.com/$REPO_OWNER/$REPO_NAME/releases/download/v$VERSION/$DOWNLOAD_NAME",
      "sha256": "$CHECKSUM",
      "size": $SIZE
    }
EOF
    else
        echo -e "${YELLOW}  ⚠ $file not found, skipping${NC}"
    fi
done

# Close manifest
cat >> "$MANIFEST" << EOF

  ],
  "releaseNotes": "Extension update for RiteMark v$VERSION"
}
EOF

echo ""
echo -e "${GREEN}Release staging complete!${NC}"
echo ""
echo "Files ready for upload in: $OUTPUT_DIR/upload/"
ls -la "$OUTPUT_DIR/upload/" | head -20
echo ""
echo "Next steps:"
echo "  1. Create GitHub release: v$VERSION"
echo "  2. Upload all files from $OUTPUT_DIR/upload/"
echo ""
echo "To upload with gh CLI:"
echo -e "${YELLOW}  gh release create v$VERSION --title \"v$VERSION\" --notes \"Extension update\" $OUTPUT_DIR/upload/*${NC}"
