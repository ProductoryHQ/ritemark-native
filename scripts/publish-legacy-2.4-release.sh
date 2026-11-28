#!/bin/bash
set -euo pipefail

usage() {
    echo "Usage: $0 <2.4.x> --also-legacy-repo"
    echo "Copies the published Ritemark 2.4.x release only to move pre-2.4 installs."
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    usage
    exit 0
fi

if [[ $# -ne 2 || "${2:-}" != "--also-legacy-repo" ]]; then
    usage >&2
    exit 1
fi

VERSION="$1"
if [[ ! "$VERSION" =~ ^2\.4\.(0|[1-9][0-9]*)$ ]]; then
    echo "Only full 2.4.x releases can be copied." >&2
    exit 1
fi

SOURCE_REPO="ProductoryHQ/ritemark-native"
LEGACY_REPO="jarmo-productory/ritemark-public"
TAG="v$VERSION"

if [[ "$(gh release view "$TAG" --repo "$SOURCE_REPO" \
    --json isDraft,isPrerelease --jq '.isDraft or .isPrerelease')" != "false" ]]; then
    echo "Publish the stable $TAG release on $SOURCE_REPO first." >&2
    exit 1
fi

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT
mkdir "$WORK_DIR/assets"
gh release view "$TAG" --repo "$SOURCE_REPO" --json body --jq .body > "$WORK_DIR/notes.md"
gh release download "$TAG" --repo "$SOURCE_REPO" --dir "$WORK_DIR/assets"

for asset in Ritemark-arm64.dmg Ritemark-x64.dmg Ritemark-Setup.exe update-feed.json; do
    if [[ ! -s "$WORK_DIR/assets/$asset" ]]; then
        echo "Missing release asset: $asset" >&2
        exit 1
    fi
done

gh release create "$TAG" --repo "$LEGACY_REPO" --latest \
    --title "Ritemark $TAG" --notes-file "$WORK_DIR/notes.md" "$WORK_DIR"/assets/*
