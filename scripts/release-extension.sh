#!/bin/bash
#
# release-extension.sh - One-command extension-only release
#
# Runs release-extension-preflight.sh first (clean tree, release-tier guard,
# engines.vscode check, compile-clean, webview-bundle-freshness), then
# generates update-manifest.json and prepares files for an extension-only
# GitHub release. Does NOT modify the app bundle.
#
# Usage:
#   ./scripts/release-extension.sh <version> [--channel canary|stable] [--skip-preflight]
#
# Example:
#   ./scripts/release-extension.sh 1.8.2-ext.1
#
# Sprint 98: the default channel is `canary`. The generated feed is merged into
# the CANARY feed, and the release is published as a GitHub prerelease so the
# public `latest` feed is untouched. Promotion to the public feed is a separate,
# explicit step: ./scripts/promote-extension-release.sh <version>
#
# Prerequisites:
#   - Extension must be compiled (npm run compile in extensions/ritemark)
#   - Webview must be built (npm run build in extensions/ritemark/webview)
#

set -e

SCRIPT_DIR_EARLY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKIP_PREFLIGHT=false
# Sprint 98: ext releases go out on the CANARY ring first (GitHub prerelease +
# canary feed), then `scripts/promote-extension-release.sh` merges the entry into
# the public feed once Jarmo has verified it. `--channel stable` exists as an
# escape hatch, not as the normal path.
CHANNEL="canary"
PREV_ARG=""
for arg in "$@"; do
  if [ "$arg" == "--skip-preflight" ]; then
    SKIP_PREFLIGHT=true
  fi
  if [ "$PREV_ARG" == "--channel" ]; then
    CHANNEL="$arg"
  fi
  PREV_ARG="$arg"
done

if [ "$CHANNEL" != "canary" ] && [ "$CHANNEL" != "stable" ]; then
  echo "Error: --channel must be 'canary' or 'stable' (got '$CHANNEL')"
  exit 1
fi

if [ "$SKIP_PREFLIGHT" = false ]; then
  echo "Running preflight checks..."
  if ! "$SCRIPT_DIR_EARLY/release-extension-preflight.sh"; then
    echo "Preflight failed — aborting release. Fix the errors above, or pass --skip-preflight to bypass (not recommended)."
    exit 1
  fi
  echo ""
fi

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

# Sprint 93 pr-reviewer finding: package.json ships as part of the manifest
# (see FILES below) but nothing verified its version actually matched the CLI
# argument. Ship a mismatched package.json and getCurrentVersion()
# (versionService.ts) never matches targetVersion — pendingRestartVersion
# never reconciles, clients could re-offer the same "update" indefinitely.
PACKAGE_VERSION=$(node -pe "require('$EXTENSION_DIR/package.json').version")
if [ "$PACKAGE_VERSION" != "$VERSION" ]; then
    echo -e "${RED}Error: extensions/ritemark/package.json version ($PACKAGE_VERSION) does not match the requested release version ($VERSION)${NC}"
    echo "Bump package.json's version to $VERSION before running this script."
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

# Files to include in extension release.
#
# Sprint 93: the file list used to be hardcoded here and went stale (three
# listed paths no longer existed, ~100 real files were omitted) — a landmine
# nobody caught because this script wasn't wired into any CI/release step.
# Enumerate `out/**/*.js` dynamically instead so this can never drift from
# reality again, whether the extension host is the sprint-92 esbuild bundle
# (out/extension.js + out/browser/browserMcpAdapter.js) or, if that sprint
# were ever rolled back, the older ~130-file per-module tree — either way the
# enumeration is correct, only the resulting file COUNT differs.
#
# .js.map sourcemaps under out/ are intentionally NOT shipped (internal-dev
# artifacts, not needed by end users); media/webview.js.map is the one
# pre-existing exception, kept as-is to match today's shipped behavior.
FILES=$(find "$EXTENSION_DIR/out" -type f -name '*.js' -not -name '*.map' | sed "s|^$EXTENSION_DIR/||" | sort)
FILES="$FILES
media/webview.js
media/webview.js.map
package.json"

# Files whose absence is legitimate and must NOT abort the release. Everything
# else in FILES is required — a missing required file is fatal (Sprint 98).
# media/webview.js.map: the production webview build does not emit a sourcemap,
# so this entry has been silently skipped on every release to date. Kept listed
# so it is picked up automatically if sourcemaps are ever turned back on.
OPTIONAL_FILES="media/webview.js.map"

echo "Processing files..."

# Guard against the flatten-collision class of bug this rewrite exists to kill:
# two distinct out/ subpaths (e.g. out/browser/foo.js and out/browser-foo.js)
# can flatten to the same DOWNLOAD_NAME, silently cp over each other, and leave
# the manifest listing two entries pointing at one uploaded asset with mismatched
# checksums. Moot for today's 2-file esbuild bundle, but fail loudly if the tree
# ever grows back into the per-module shape where collisions are possible.
SEEN_DOWNLOAD_NAMES=""

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

        # Reject a flattened-name collision before it silently corrupts the release
        if echo "$SEEN_DOWNLOAD_NAMES" | grep -qxF "$DOWNLOAD_NAME"; then
            echo -e "${RED}✗ Download-name collision: '$DOWNLOAD_NAME' (from '$file') already used by another file.${NC}" >&2
            echo -e "${RED}  Two source paths flatten to the same upload asset — aborting to avoid a corrupt manifest.${NC}" >&2
            exit 1
        fi
        SEEN_DOWNLOAD_NAMES="$SEEN_DOWNLOAD_NAMES
$DOWNLOAD_NAME"

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
    elif echo "$OPTIONAL_FILES" | grep -qxF "$file"; then
        # Known-optional artifact (see OPTIONAL_FILES) — absence is expected.
        echo -e "${YELLOW}  ⚠ $file not present (optional), skipping${NC}"
    else
        # Sprint 98: this used to be a non-fatal warning for EVERY file. A
        # silently-skipped file is exactly how a release ends up shipping less
        # than it claims — and the manifest is now the delta overlaid onto a
        # clone of the bundled copy, so a missing file means the update quietly
        # ships stale code instead of the fix.
        echo -e "${RED}✗ $file is listed for release but does not exist on disk${NC}" >&2
        echo -e "${RED}  Refusing to build an incomplete manifest. Rebuild the extension and retry.${NC}" >&2
        exit 1
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

# -----------------------------------------------------------------------------
# Sprint 98: manifest-vs-staged sanity check.
#
# Every manifest entry must resolve to a real staged asset, and every staged
# asset must be referenced by the manifest. An orphan asset is dead weight; a
# dangling manifest entry is a guaranteed 404 mid-install on a user's machine.
# -----------------------------------------------------------------------------
echo "Verifying manifest against staged files..."
if ! node -e '
  const fs = require("fs");
  const path = require("path");
  const [manifestPath, uploadDir] = process.argv.slice(1);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  const errors = [];
  const referenced = new Set(["update-manifest.json", "update-feed.json"]);

  for (const file of manifest.files || []) {
    if ((file.op || "write") === "delete") { continue; }
    if (!file.url) { errors.push(`entry "${file.path}" has no url`); continue; }
    const asset = path.basename(new URL(file.url).pathname);
    referenced.add(asset);
    const staged = path.join(uploadDir, asset);
    if (!fs.existsSync(staged)) {
      errors.push(`entry "${file.path}" references asset "${asset}" which is not staged`);
      continue;
    }
    const size = fs.statSync(staged).size;
    if (typeof file.size === "number" && file.size !== size) {
      errors.push(`entry "${file.path}": manifest size ${file.size} != staged ${size}`);
    }
  }

  for (const name of fs.readdirSync(uploadDir)) {
    if (!referenced.has(name)) {
      errors.push(`orphan staged file "${name}" is not referenced by the manifest`);
    }
  }

  if (errors.length) {
    for (const error of errors) { console.error(`  ✗ ${error}`); }
    process.exit(1);
  }
' "$MANIFEST" "$OUTPUT_DIR/upload"; then
  echo -e "${RED}Manifest/staged-file mismatch — aborting release.${NC}" >&2
  exit 1
fi
echo -e "${GREEN}Manifest matches staged files${NC}"
echo ""

echo "Generating canonical update feed (channel: $CHANNEL)..."
node "$SCRIPT_DIR/generate-update-feed.mjs" \
  --mode extension \
  --channel "$CHANNEL" \
  --version "$VERSION" \
  --manifest "$MANIFEST" \
  --output "$OUTPUT_DIR/upload/update-feed.json"
echo -e "${GREEN}Update feed written to $OUTPUT_DIR/upload/update-feed.json${NC}"
echo ""

# -----------------------------------------------------------------------------
# Sprint 98: install-and-activate smoke test — the blocking pre-publish gate.
#
# Everything above proves files exist and hash correctly. Only this proves the
# extension a user would end up with actually LOADS. The 1.8.3-ext.1 incident
# passed every file-level check and still bricked the extension at module load.
# `set -e` makes this blocking by construction.
# -----------------------------------------------------------------------------
echo "Running install-and-activate smoke test..."
"$SCRIPT_DIR/ext-install-smoke-test.sh" --staged "$OUTPUT_DIR/upload"
echo ""

echo "Files ready for upload in: $OUTPUT_DIR/upload/"
ls -la "$OUTPUT_DIR/upload/" | head -20
echo ""
echo "Next steps (publication is MANUAL and gated on Jarmo's approval phrase):"
echo "  1. Create the GitHub release as a PRERELEASE — this is what keeps the public"
echo "     'latest' feed untouched (prereleases are excluded from /releases/latest)."
echo "  2. Publish the generated feed to the '$CHANNEL' ring."
if [ "$CHANNEL" == "canary" ]; then
  echo "  3. Verify on a machine with ritemark.updates.channel = canary."
  echo "  4. Promote: ./scripts/promote-extension-release.sh $VERSION"
fi
echo ""
echo "Commands:"
echo -e "${YELLOW}  gh release create v$VERSION --repo $REPO_OWNER/$REPO_NAME \\
    --title \"v$VERSION\" --notes \"Extension update\" --prerelease \\
    $OUTPUT_DIR/upload/*${NC}"
if [ "$CHANNEL" == "canary" ]; then
  echo ""
  echo "  # First canary publish only — the 'canary' tag release does not exist yet:"
  echo -e "${YELLOW}  gh release create canary --repo $REPO_OWNER/$REPO_NAME \\
    --title \"Canary update feed\" --notes \"Rolling canary update feed. Not a downloadable build.\" --prerelease${NC}"
  echo ""
  echo "  # Every canary publish — republish the feed asset onto the fixed canary tag:"
  echo -e "${YELLOW}  gh release upload canary --repo $REPO_OWNER/$REPO_NAME \\
    --clobber $OUTPUT_DIR/upload/update-feed.json${NC}"
else
  echo ""
  echo "  # Stable channel: clobber the feed onto the current 'latest' release."
  echo -e "${YELLOW}  gh release upload \"\$(gh release view --repo $REPO_OWNER/$REPO_NAME --json tagName -q .tagName)\" \\
    --repo $REPO_OWNER/$REPO_NAME --clobber $OUTPUT_DIR/upload/update-feed.json${NC}"
fi
