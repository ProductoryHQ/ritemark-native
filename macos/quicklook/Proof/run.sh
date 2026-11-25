#!/bin/bash
# Runner-only entry point for LaunchServices registration.
set -euo pipefail
if [[ "${GITHUB_ACTIONS:-}" != true || "${RUNNER_ENVIRONMENT:-}" != github-hosted ]]; then
  echo 'Run this proof on a disposable GitHub-hosted runner.' >&2
  exit 2
fi
BUILD="$1"
PROOF="$2"
WORK="$3"
SOURCE="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$SOURCE/../.." && pwd)"
STAND_IN="$WORK/Ritemark.app"
APP=/Applications/Ritemark.app
LSREGISTER=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister
host_id="$(plutil -extract darwinBundleIdentifier raw -o - "$ROOT/branding/product.json")"

mkdir -p "$PROOF/registration" "$WORK/fixtures" "$STAND_IN/Contents/"{MacOS,Resources,PlugIns}
cp /usr/bin/true "$STAND_IN/Contents/MacOS/Ritemark"
cp "$ROOT/branding/icons/icon.icns" "$STAND_IN/Contents/Resources/Ritemark.icns"
cp "$SOURCE/Proof/Host.plist" "$STAND_IN/Contents/Info.plist"
"$ROOT/scripts/stamp-deck-document-type.sh" "$STAND_IN" | tee "$PROOF/deck-type.txt"

for kind in Thumbnail Preview; do
  name="RitemarkDeck$kind"
  python3 "$SOURCE/Proof/check-bundle.py" "$BUILD/$name.appex" "$kind" > "$PROOF/$name.bundle-check.txt"
  ditto "$BUILD/$name.appex" "$STAND_IN/Contents/PlugIns/$name.appex"
  bundle="$STAND_IN/Contents/PlugIns/$name.appex"
  codesign --force --sign - --options runtime --entitlements "$BUILD/$name.entitlements" "$bundle"
  codesign -dv --entitlements - --xml "$bundle" > "$PROOF/$name.entitlements.plist" 2> "$PROOF/$name.codesign.txt"
done
codesign --force --sign - --options runtime "$STAND_IN"
codesign --verify --deep --strict --verbose=2 "$STAND_IN" 2>&1 | tee "$PROOF/codesign-verify.txt"

python3 "$SOURCE/Proof/seed.py" "$HOME/Library/Caches/$host_id/quicklook/v1" "$WORK/fixtures"
xcrun swiftc -module-cache-path "$WORK/module-cache" "$SOURCE"/Shared/*.swift \
  "$SOURCE/Preview/PreviewProvider.swift" "$SOURCE/Proof/preview-payload.swift" -o "$WORK/preview-payload"
"$WORK/preview-payload" "$WORK/fixtures" "$host_id" | tee "$PROOF/preview-payload.tsv"
xcrun swiftc -module-cache-path "$WORK/module-cache" "$SOURCE/Proof/probe.swift" -o "$WORK/probe"

listing() {
  for point in thumbnail preview; do
    pluginkit -m -vv -i "$host_id.deck-$point" > "$PROOF/registration/$1.$point.txt" 2>&1 || true
  done
}

listing 01-before-install
if [[ -e "$APP" ]]; then
  echo "Destination already exists: $APP" >&2
  exit 1
fi
sudo ditto "$STAND_IN" "$APP"
open -W "$APP"
listing 02-after-launch

preview_capture() (
  local source="$1" output="$2" marker="$3"
  qlmanage -p "$source" > "$output/preview.log" 2>&1 &
  local pid=$!
  trap 'kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true' EXIT
  sleep 4
  screencapture -x "$output/preview.png" &&
    "$WORK/probe" --ocr "$output/preview.png" "$marker" > "$output/preview-ocr.txt" 2>&1
)

exercise() {
  local output="$PROOF/$1"
  mkdir -p "$output"/{png,match,stale}
  local status=0
  "$WORK/probe" "$WORK/fixtures" "$output/png" > "$output/thumbnails.txt" 2>&1 || status=1
  preview_capture "$WORK/fixtures/café.rtms" "$output/match" "PROOF SLIDE ONE" || status=1
  preview_capture "$WORK/fixtures/stale.rtms" "$output/stale" "PROOF CURRENT SOURCE" || status=1
  return "$status"
}

if exercise default; then
  printf 'Both Quick Look points passed after first launch with default election.\n' | tee "$PROOF/results.md"
else
  printf 'Default launch proof failed. Controlled discovery and election follow.\n' | tee "$PROOF/results.md"
  "$LSREGISTER" -f -R -trusted "$APP"
  listing 03-explicit-registration
  for point in thumbnail preview; do
    pluginkit -e use -i "$host_id.deck-$point"
  done
  listing 04-explicit-election
  qlmanage -r
  qlmanage -r cache
  if exercise elected; then
    printf 'Both Quick Look points passed after explicit registration and election.\n' | tee -a "$PROOF/results.md"
  else
    printf 'Quick Look proof also failed after explicit election. See per-request artifacts.\n' | tee -a "$PROOF/results.md"
    exit 1
  fi
fi
cat "$PROOF/results.md" >> "$GITHUB_STEP_SUMMARY"
