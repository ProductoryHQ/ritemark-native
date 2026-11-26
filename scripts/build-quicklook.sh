#!/bin/bash
# Build unsigned universal Quick Look extensions and optionally install them.
set -euo pipefail
INSTALL=false
if [[ $# == 2 && "$1" == --install && -d "$2/Contents" ]]; then
  INSTALL=true
  OUT="$2/Contents/PlugIns"
elif [[ $# == 1 && -n "$1" && "$1" != -* ]]; then
  OUT="$1"
else
  echo "Usage: $0 <output-folder> | --install <existing-app>" >&2
  exit 2
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="$ROOT/macos/quicklook"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
host_id="$(plutil -extract darwinBundleIdentifier raw -o - "$ROOT/branding/product.json")"

version="$(plutil -extract ritemarkVersion raw -o - "$ROOT/branding/product.json")"
sdk_path="$(xcrun --sdk macosx --show-sdk-path)"

for kind in Thumbnail Preview; do
  executable="RitemarkDeck$kind"
  bundle="$WORK/$executable.appex/Contents"
  mkdir -p "$bundle/MacOS" "$bundle/Resources"
  for arch in arm64 x86_64; do
    xcrun --sdk macosx swiftc -sdk "$sdk_path" -parse-as-library -application-extension -module-name "$executable" \
      -target "$arch-apple-macos12.0" -module-cache-path "$WORK/module-cache" \
      -O -Xlinker -e -Xlinker _NSExtensionMain \
      "$SOURCE"/Shared/*.swift "$SOURCE/$kind/${kind}Provider.swift" -o "$WORK/$executable-$arch"
  done
  binary="$bundle/MacOS/$executable"
  xcrun lipo -create "$WORK/$executable-arm64" "$WORK/$executable-x86_64" -output "$binary"
  xcrun lipo "$binary" -verify_arch arm64 x86_64
  cp "$SOURCE/$kind/Info.plist" "$bundle/"
  plutil -replace RitemarkHostBundleIdentifier -string "$host_id" "$bundle/Info.plist"
  plutil -insert CFBundleShortVersionString -string "$version" "$bundle/Info.plist"
  plutil -insert CFBundleVersion -string "$version" "$bundle/Info.plist"
  cp "$SOURCE/Shared/Resources/DeckIcon.pdf" "$bundle/Resources/"
  cp "$SOURCE/Shared/Resources/DeckIconSmall.pdf" "$bundle/Resources/"
  plutil -lint "$bundle/Info.plist" "$SOURCE/$kind/sandbox.entitlements"
done

mkdir -p "$OUT"
for kind in Thumbnail Preview; do
  executable="RitemarkDeck$kind"
  rm -rf "$OUT/$executable.appex"
  ditto "$WORK/$executable.appex" "$OUT/$executable.appex"
  if [[ "$INSTALL" == false ]]; then
    cp "$SOURCE/$kind/sandbox.entitlements" "$OUT/$executable.entitlements"
  fi
done
