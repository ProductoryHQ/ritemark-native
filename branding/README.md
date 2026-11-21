# Ritemark Native Branding

## Files

- `product.json` - App identity and configuration
- `icons/icon.png` - 512x512 PNG (source)
- `icons/icon.icns` - macOS app icon

## Usage

These files override VS Code's default branding during build.

## Placeholder Icons

Current icons are blue placeholder squares. Replace with final Ritemark icons when ready.

To regenerate .icns from a new icon.png:

```bash
cd branding/icons
mkdir -p icon.iconset
sips -z 16 16 icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32 icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32 icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64 icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128 icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256 icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256 icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512 icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512 icon.png --out icon.iconset/icon_512x512.png
cp icon.png icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset
rm -rf icon.iconset
```

## The deck badge (`.rtms` in Finder)

A deck file (`.rtms`) is drawn by macOS as its own document page with a badge and the word DECK. The release build's `Info.plist` names the badge (`UTTypeIconBadgeName` `deck-badge`), and `scripts/stamp-deck-document-type.sh` copies its asset catalog into the app as `Contents/Resources/Assets.car`. macOS finds the badge only in an asset catalog, not in an `.icns` file (Sprint 172's runner proof, `.github/workflows/deck-type-proof.yml`).

- `icons/deck-badge.svg` - the source: Phosphor's `presentation` glyph, bold, in #4338ca, on a transparent ground
- `icons/deck-badge.car` - the compiled asset catalog, with one icon set named `deck-badge`

To regenerate `deck-badge.car` from the SVG (needs `rsvg-convert` from librsvg and Xcode's `actool`):

```bash
cd branding/icons
BUILD="$(mktemp -d)"
mkdir -p "$BUILD/deck-badge.xcassets/deck-badge.iconset" "$BUILD/out"
printf '{"info":{"version":1,"author":"xcode"}}\n' > "$BUILD/deck-badge.xcassets/Contents.json"
for s in 16 32 128 256 512; do
  rsvg-convert -w $s -h $s deck-badge.svg -o "$BUILD/deck-badge.xcassets/deck-badge.iconset/icon_${s}x${s}.png"
  rsvg-convert -w $((s*2)) -h $((s*2)) deck-badge.svg -o "$BUILD/deck-badge.xcassets/deck-badge.iconset/icon_${s}x${s}@2x.png"
done
xcrun actool "$BUILD/deck-badge.xcassets" --compile "$BUILD/out" --platform macosx --minimum-deployment-target 12.0
cp "$BUILD/out/Assets.car" deck-badge.car
rm -rf "$BUILD"
```

Then run `scripts/test-stamp-deck-document-type.sh`, and dispatch the proof workflow to see the badge on a real page.
