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
STAND_IN="$WORK/Ritemark.app"
APP=/Applications/Ritemark.app
LSREGISTER=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister
case "$VARIANT" in
  A|B|C) kind=Thumbnail; point=thumbnail ;;
  D) kind=Preview; point=preview ;;
  *) echo "Unknown variant: $VARIANT" >&2; exit 2 ;;
esac
name="RitemarkDeck$kind"
id="ai.productory.ritemark.deck-$point"
mkdir -p "$PROOF/registration" "$WORK"

# Capture command failures as evidence. Continue through registration even if a
# particular discovery or election command fails.
record() {
  printf '\n$ %s\n' "$*"
  local status=0
  "$@" || status=$?
  printf 'Exit status: %s\n' "$status"
  return "$status"
}
bundle="$BUILD/$VARIANT/$name.appex"
{
  plutil -lint "$bundle/Contents/Info.plist" "$BUILD/$VARIANT/$name.entitlements"
  python3 "$SOURCE/Proof/check-bundle.py" "$bundle" "$kind"
} > "$PROOF/$name.bundle-check.txt" 2>&1

mkdir -p "$STAND_IN/Contents/"{MacOS,Resources,PlugIns}
cp /usr/bin/true "$STAND_IN/Contents/MacOS/Ritemark"
cp "$ROOT/branding/icons/icon.icns" "$STAND_IN/Contents/Resources/Ritemark.icns"
cp "$SOURCE/Proof/Host.plist" "$STAND_IN/Contents/Info.plist"
"$ROOT/scripts/stamp-deck-document-type.sh" "$STAND_IN" | tee "$PROOF/deck-type.txt"
cp -R "$bundle" "$STAND_IN/Contents/PlugIns/"
bundle="$STAND_IN/Contents/PlugIns/$name.appex"
codesign --force --sign - --options runtime --entitlements "$BUILD/$VARIANT/$name.entitlements" "$bundle"
codesign -dv --entitlements - --xml "$bundle" > "$PROOF/$name.entitlements.plist" 2> "$PROOF/$name.codesign.txt"
codesign --verify --deep --strict --verbose=2 "$bundle" > "$PROOF/$name.codesign-verify.txt" 2>&1
codesign --force --sign - --options runtime "$STAND_IN"
codesign -dv --entitlements - --xml "$STAND_IN" > "$PROOF/Ritemark.entitlements.plist" 2> "$PROOF/Ritemark.codesign.txt"
codesign --verify --deep --strict --verbose=2 "$STAND_IN" 2>&1 | tee "$PROOF/codesign-verify.txt"
xcrun swiftc -module-cache-path "$WORK/module-cache" "$SOURCE/Proof/probe.swift" -o "$WORK/probe"

point_file="/System/Library/ExtensionKit/ExtensionPoints/com.apple.quicklook.$point.appexpt"
if [[ -f "$point_file" ]]; then cp "$point_file" "$PROOF/registration/"; fi
listing() {
  pluginkit -m -v -i "$id" > "$PROOF/registration/$1.$point.txt" 2>&1 || true
}

listing 01-preflight
if [[ -e "$APP" ]]; then
  echo "Destination already exists: $APP" >&2
  exit 1
fi
{
  record sudo ditto "$STAND_IN" "$APP"
  record "$LSREGISTER" -f -R -trusted "$APP" || true
  for attempt in {1..10}; do
    listing 02-install
    if grep -Fq "$id(" "$PROOF/registration/02-install.$point.txt"; then break; fi
    sleep 1
  done
  record pluginkit -e use -i "$id" || true
  record qlmanage -r || true
  record qlmanage -r cache || true
  listing 03-elect-and-reset
} > "$PROOF/registration/commands.log" 2>&1

cp -R "$SOURCE/fixtures" "$WORK/fixtures"
fixture="$WORK/fixtures/theme-and-picture.rtms"
mkdir -p "$PROOF/png"
since="$(date '+%Y-%m-%d %H:%M:%S')"
collect_logs() {
  /usr/bin/log show --start "$since" --end "$until" --info --debug \
    --predicate "process == \"$name\" OR process CONTAINS \"WebKit\" OR process CONTAINS \"quicklook\" OR eventMessage CONTAINS \"WebKit.WebContent\" OR subsystem BEGINSWITH \"com.apple.WebKit\" OR subsystem == \"ai.productory.ritemark.quicklook\"" \
    > "$PROOF/system-log.txt" 2>&1 || touch "$PROOF/system-log.failed"
  sudo /usr/bin/log show --start "$since" --end "$until" --info --debug \
    --predicate 'eventMessage CONTAINS "deny" OR sender == "Sandbox"' \
    > "$PROOF/sandbox-log.txt" 2>&1 || touch "$PROOF/sandbox-log.failed"
  if [[ "$VARIANT" == D ]]; then
    local snapshot_path
    snapshot_path="$(sed -n 's/^.*RitemarkDeckPreview: .*preview snapshot PNG path=\(\/.*\/quicklook-preview-snapshot\.png\)$/\1/p' \
      "$PROOF/system-log.txt" | tail -n 1)"
    if [[ -n "$snapshot_path" ]]; then
      cp "$snapshot_path" "$PROOF/png/preview-snapshot.png" 2> "$PROOF/snapshot-copy.stderr" || true
    fi
  fi
  python3 "$SOURCE/Proof/results.py" "$PROOF" "$VARIANT"
}
finish_probe() {
  # Let the log store flush the last callbacks before querying it.
  sleep 2
  until="$(date '+%Y-%m-%d %H:%M:%S')"
  collect_logs
}
trap finish_probe EXIT

if [[ "$VARIANT" == B ]]; then
  # Connection rows (without -P), sampled every second throughout the request.
  /usr/bin/nettop -n -L 14 -s 1 > "$PROOF/nettop.csv" 2> "$PROOF/nettop.stderr" &
  nettop_pid=$!
fi

if [[ "$kind" == Thumbnail ]]; then
  "$WORK/probe" "$PROOF/png" "$fixture" > "$PROOF/probe.tsv" 2> "$PROOF/probe.stderr"
else
  qlmanage -p "$fixture" > "$PROOF/preview.txt" 2>&1 &
  preview_pid=$!
  sleep 12
  screencapture -x "$PROOF/png/preview.png" > "$PROOF/screencapture.txt" 2>&1 || true
  kill "$preview_pid" 2>/dev/null || true
  wait "$preview_pid" 2>/dev/null || true
  if [[ -f "$PROOF/png/preview.png" ]]; then
    "$WORK/probe" --ocr "$PROOF/png/preview.png" > "$PROOF/preview-ocr.tsv"
  fi
fi

if [[ "$VARIANT" == B ]]; then
  wait "$nettop_pid" || touch "$PROOF/nettop.failed"
fi
