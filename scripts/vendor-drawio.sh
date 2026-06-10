#!/usr/bin/env bash
# Sprint 82 R2: Download and vendor the draw.io editor bundle.
#
# The jgraph/drawio release ships only `draw.war` (the deployable webapp).
# This script extracts the minimal subset needed for Ritemark's offline
# embed mode (?embed=1&proto=json&offline=1) — verified by the Sprint 82
# Phase 0 audit (docs/development/sprints/sprint-82-drawio-diagrams/research/
# drawio-bundle-audit.md). Both extensions.min.js and math4/ are loaded
# eagerly by the app; omitting either prevents the editor from initializing.
#
# The resulting media/drawio/ tree (~36 MB) is COMMITTED to git; run this
# script only when bumping the pinned draw.io version.
#
# Usage: ./scripts/vendor-drawio.sh [version]

set -euo pipefail

VERSION=${1:-v30.0.4}
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$REPO_ROOT/extensions/ritemark/media/drawio"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Downloading draw.war $VERSION ..."
curl -fSL "https://github.com/jgraph/drawio/releases/download/${VERSION}/draw.war" -o "$TMP/draw.war"

echo "Extracting ..."
unzip -q "$TMP/draw.war" -d "$TMP/war"

echo "Copying offline-embed subset to $DEST ..."
rm -rf "$DEST"
mkdir -p "$DEST/js" "$DEST/resources"

cp "$TMP/war/index.html" "$TMP/war/favicon.ico" "$DEST/"
for f in bootstrap.js main.js PreConfig.js PostConfig.js app.min.js \
         stencils.min.js extensions.min.js shapes-*.min.js; do
  cp "$TMP"/war/js/$f "$DEST/js/"
done
cp -r "$TMP/war/styles" "$TMP/war/mxgraph" "$TMP/war/images" "$TMP/war/math4" "$DEST/"
cp "$TMP/war/resources/dia.txt" "$DEST/resources/"

echo "$VERSION" > "$DEST/VERSION"
echo "Vendored draw.io $VERSION ($(du -sh "$DEST" | cut -f1)) to $DEST"
