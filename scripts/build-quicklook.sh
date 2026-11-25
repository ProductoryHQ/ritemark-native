#!/bin/bash
# Build a Sprint 177 runner variant into a caller-supplied folder.
set -euo pipefail
if [[ $# != 2 || -z "$1" ]]; then
  echo "Usage: $0 <output-folder> <A|B|C|D>" >&2
  exit 2
fi
VARIANT="$2"
flags=()
case "$VARIANT" in
  A|B) kind=Thumbnail ;;
  C) kind=Thumbnail; flags=(-D QUICKLOOK_MINIMAL) ;;
  D) kind=Preview ;;
  *) echo "Unknown variant: $VARIANT" >&2; exit 2 ;;
esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="$ROOT/macos/quicklook"
mkdir -p "$1/$VARIANT"
OUT="$(cd "$1/$VARIANT" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

executable="RitemarkDeck$kind"
case "$kind" in
  Thumbnail) source=ThumbnailProvider; framework=QuickLookThumbnailing ;;
  Preview) source=PreviewViewController; framework=QuickLookUI ;;
esac
bundle="$OUT/$executable.appex/Contents"
mkdir -p "$bundle/MacOS" "$bundle/Resources"
for arch in arm64 x86_64; do
  xcrun swiftc -parse-as-library -application-extension -module-name "$executable" \
    ${flags[@]+"${flags[@]}"} -target "$arch-apple-macos12.0" -module-cache-path "$WORK/module-cache" \
    -O -Xlinker -e -Xlinker _NSExtensionMain -framework "$framework" -framework AppKit -framework WebKit \
    "$SOURCE/Shared/DeckRenderer.swift" "$SOURCE/$kind/$source.swift" -o "$WORK/$executable-$arch"
done
xcrun lipo -create "$WORK/$executable-arm64" "$WORK/$executable-x86_64" -output "$bundle/MacOS/$executable"
xcrun lipo "$bundle/MacOS/$executable" -verify_arch arm64 x86_64
cp "$SOURCE/$kind/Info.plist" "$bundle/"
entitlements="$OUT/$executable.entitlements"
cp "$SOURCE/$kind/sandbox.entitlements" "$entitlements"
if [[ "$VARIANT" == B ]]; then
  /usr/libexec/PlistBuddy -c 'Add :com.apple.security.network.client bool true' "$entitlements"
fi
plutil -lint "$bundle/Info.plist" "$entitlements"
if [[ "$VARIANT" != C ]]; then
  node "$ROOT/extensions/ritemark/src/decks/quickLook/build.mjs" "$bundle/Resources/renderer.js"
  cp "$ROOT/extensions/ritemark/media/fonts/OFL.txt" "$bundle/Resources/"
fi
