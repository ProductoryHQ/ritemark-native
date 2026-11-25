#!/bin/bash
# Build the Sprint 177 runner harness into a caller-supplied folder.
set -euo pipefail
if [[ $# != 1 || -z "$1" ]]; then
  echo "Usage: $0 <output-folder>" >&2
  exit 2
fi
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="$ROOT/macos/quicklook"
mkdir -p "$1"
OUT="$(cd "$1" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
node "$ROOT/extensions/ritemark/src/decks/quickLook/build.mjs" "$WORK/renderer.js"

for kind in Thumbnail Preview; do
  executable="RitemarkDeck$kind"
  case "$kind" in
    Thumbnail) source=ThumbnailProvider; framework=QuickLookThumbnailing ;;
    Preview) source=PreviewViewController; framework=QuickLookUI ;;
  esac
  for arch in arm64 x86_64; do
    xcrun swiftc -parse-as-library -application-extension -module-name "$executable" \
      -target "$arch-apple-macos12.0" -module-cache-path "$WORK/module-cache" -O -Xlinker -e -Xlinker _NSExtensionMain \
      -framework "$framework" -framework AppKit -framework WebKit \
      "$SOURCE/Shared/DeckRenderer.swift" "$SOURCE/$kind/$source.swift" -o "$WORK/$executable-$arch"
  done
  for variant in sandbox read-exception; do
    bundle="$OUT/$variant/$executable.appex/Contents"
    mkdir -p "$bundle/MacOS" "$bundle/Resources"
    xcrun lipo -create "$WORK/$executable-arm64" "$WORK/$executable-x86_64" -output "$bundle/MacOS/$executable"
    cp "$SOURCE/$kind/Info.plist" "$bundle/"
    cp "$SOURCE/$kind/$variant.entitlements" "$OUT/$variant/$executable.entitlements"
    cp "$WORK/renderer.js" "$ROOT/extensions/ritemark/media/fonts/OFL.txt" "$bundle/Resources/"
  done
done
