#!/bin/bash
# Runner-only entry point for LaunchServices registration.
set -euo pipefail
: "${GITHUB_ACTIONS:?Run this proof on an ephemeral GitHub Actions runner}"
BUILD="$1"
VARIANT="$2"
PROOF="$3"
WORK="$4"
SOURCE="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$SOURCE/../.." && pwd)"
APP="$WORK/Ritemark.app"
LSREGISTER=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister
mkdir -p "$APP/Contents/"{MacOS,Resources,PlugIns} "$WORK/fixtures" "$PROOF/"{generator,icons,qlmanage,preview}
cp /usr/bin/true "$APP/Contents/MacOS/Ritemark"
cp "$ROOT/branding/icons/icon.icns" "$APP/Contents/Resources/Ritemark.icns"
cp "$SOURCE/Proof/Host.plist" "$APP/Contents/Info.plist"
"$ROOT/scripts/stamp-deck-document-type.sh" "$APP" | tee "$PROOF/deck-type.txt"
for kind in Thumbnail Preview; do
  name="RitemarkDeck$kind"
  bundle="$APP/Contents/PlugIns/$name.appex"
  cp -R "$BUILD/$VARIANT/$name.appex" "$bundle"
  codesign --force --sign - --options runtime --entitlements "$BUILD/$VARIANT/$name.entitlements" "$bundle"
  codesign -d --entitlements :- "$bundle" > "$PROOF/$name.entitlements.plist" 2> "$PROOF/$name.codesign.txt"
done
codesign --force --sign - --options runtime "$APP"
codesign --verify --deep --strict --verbose=2 "$APP" 2>&1 | tee "$PROOF/codesign-verify.txt"
xcrun swiftc "$SOURCE/Proof/probe.swift" -o "$WORK/probe"
cp -R "$SOURCE/fixtures/." "$WORK/fixtures/"
cd "$WORK/fixtures"

since="$(date '+%Y-%m-%d %H:%M:%S')"
"$LSREGISTER" -f "$APP"
# Discovery is asynchronous. Poll the listing without changing the user's election.
for _ in {1..10}; do
  pluginkit -m -v -p com.apple.quicklook.thumbnail > "$PROOF/pluginkit-thumbnail.txt" 2>&1 || true
  if grep -qF ai.productory.ritemark.deck-thumbnail "$PROOF/pluginkit-thumbnail.txt"; then break; fi
  sleep 1
done
pluginkit -m -v -p com.apple.quicklook.preview > "$PROOF/pluginkit-preview.txt" 2>&1 || true

# Fresh URLs force ten requests. The first and tenth use the same content and sidecars.
requests=()
for index in {01..10}; do
  file="timed-$index.rtms"
  cp theme-and-picture.rtms "$file"
  requests+=("$PWD/$file")
done
fixtures=(theme-and-picture.rtms skipped-first.rtms missing-theme.rtms missing-picture.rtms no-slides.rtms plain.md)
for file in "${fixtures[@]}"; do requests+=("$PWD/$file"); done
"$WORK/probe" "$PROOF/generator" "${requests[@]}" | tee "$PROOF/generator.tsv"
"$WORK/probe" --icon "$PROOF/icons" "$PWD/no-slides.rtms" > "$PROOF/icons.tsv"

/usr/bin/log show --start "$since" --style compact \
  --predicate 'subsystem == "ai.productory.ritemark.quicklook-proof"' > "$PROOF/generator-log.txt" 2>&1 || true
for file in "${fixtures[@]}"; do
  # Bound each CLI request so a stall still leaves evidence.
  perl -e 'alarm shift; exec @ARGV or die $!' 15 qlmanage -t -s 512 -o "$PROOF/qlmanage" "$PWD/$file" \
    > "$PROOF/qlmanage/$file.txt" 2>&1 || true
done

# The live panel displays the view-based extension's WKWebView.
for file in skipped-first.rtms theme-and-picture.rtms plain.md; do
  qlmanage -p "$PWD/$file" > "$PROOF/preview/$file.txt" 2>&1 &
  pid=$!
  sleep 5
  screencapture -x "$PROOF/preview/$file.png" >> "$PROOF/preview/$file.txt" 2>&1 || true
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
done
"$WORK/probe" --ocr "$PROOF"/preview/*.png > "$PROOF/preview-ocr.tsv"
"$WORK/probe" --ocr "$PROOF"/qlmanage/*.png > "$PROOF/qlmanage-ocr.tsv"
/usr/bin/log show --start "$since" --style compact \
  --predicate 'subsystem == "ai.productory.ritemark.quicklook-proof"' > "$PROOF/extension-log.txt" 2>&1 || true

python3 "$SOURCE/Proof/results.py" "$PROOF" "$VARIANT"
