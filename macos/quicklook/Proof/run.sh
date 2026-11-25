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
EXTENSION_PREDICATE='subsystem == "ai.productory.ritemark.quicklook-proof"'
SYSTEM_PREDICATE='subsystem == "com.apple.pluginkit" OR process == "pkd" OR process CONTAINS "quicklook" OR process CONTAINS "Ritemark"'
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
collect_logs() {
  /usr/bin/log show --last 5m --predicate "$SYSTEM_PREDICATE" --info > "$PROOF/system-log.txt" 2>&1 || true
  python3 "$SOURCE/Proof/results.py" "$PROOF" "$VARIANT"
}
trap collect_logs EXIT

checks=()
for kind in Thumbnail Preview; do
  name="RitemarkDeck$kind"
  bundle="$BUILD/$VARIANT/$name.appex"
  {
    plutil -lint "$bundle/Contents/Info.plist"
    python3 "$SOURCE/Proof/check-bundle.py" "$bundle" "$kind"
  } > "$PROOF/$name.bundle-check.txt" 2>&1 &
  checks+=("$!")
done
failed=0
for pid in "${checks[@]}"; do wait "$pid" || failed=1; done
if [[ "$failed" == 1 ]]; then exit 1; fi

mkdir -p "$STAND_IN/Contents/"{MacOS,Resources,PlugIns}
cp /usr/bin/true "$STAND_IN/Contents/MacOS/Ritemark"
cp "$ROOT/branding/icons/icon.icns" "$STAND_IN/Contents/Resources/Ritemark.icns"
cp "$SOURCE/Proof/Host.plist" "$STAND_IN/Contents/Info.plist"
"$ROOT/scripts/stamp-deck-document-type.sh" "$STAND_IN" | tee "$PROOF/deck-type.txt"
for kind in Thumbnail Preview; do
  name="RitemarkDeck$kind"
  bundle="$STAND_IN/Contents/PlugIns/$name.appex"
  cp -R "$BUILD/$VARIANT/$name.appex" "$bundle"
  codesign --force --sign - --options runtime --entitlements "$BUILD/$VARIANT/$name.entitlements" "$bundle"
  codesign -dv --entitlements - --xml "$bundle" > "$PROOF/$name.entitlements.plist" 2> "$PROOF/$name.codesign.txt"
  codesign --verify --deep --strict --verbose=2 "$bundle" > "$PROOF/$name.codesign-verify.txt" 2>&1
done
codesign --force --sign - --options runtime "$STAND_IN"
codesign -dv --entitlements - --xml "$STAND_IN" > "$PROOF/Ritemark.entitlements.plist" 2> "$PROOF/Ritemark.codesign.txt"
codesign --verify --deep --strict --verbose=2 "$STAND_IN" 2>&1 | tee "$PROOF/codesign-verify.txt"
xcrun swiftc "$SOURCE/Proof/probe.swift" -o "$WORK/probe"

for kind in thumbnail preview; do
  point="/System/Library/ExtensionKit/ExtensionPoints/com.apple.quicklook.$kind.appexpt"
  if [[ -f "$point" ]]; then cp "$point" "$PROOF/registration/$kind.appexpt"; fi
done

extension_log() {
  /usr/bin/log show --start "$1" --style compact --info --predicate "$EXTENSION_PREDICATE" > "$2" 2>&1 || true
}

run_probes() {
  local kind="$2" dir="$PROOF/$1/$2" since file index status pid
  local fixtures=(theme-and-picture.rtms skipped-first.rtms missing-theme.rtms missing-picture.rtms no-slides.rtms plain.md)
  local input="$WORK/$1/$2"
  local fixture_dir="$input/fixtures"
  mkdir -p "$dir" "$input"
  cp -R "$SOURCE/fixtures" "$fixture_dir"
  since="$(date '+%Y-%m-%d %H:%M:%S')"
  if [[ "$kind" == thumbnail ]]; then
    local requests=()
    mkdir -p "$dir/"{generator,icons,qlmanage}
    for index in {1..10}; do
      printf -v file 'timed-%02d.rtms' "$index"
      cp "$fixture_dir/theme-and-picture.rtms" "$fixture_dir/$file"
      requests+=("$fixture_dir/$file")
    done
    for file in "${fixtures[@]}"; do requests+=("$fixture_dir/$file"); done
    "$WORK/probe" "$dir/generator" "${requests[@]}" > "$dir/generator.tsv" 2> "$dir/generator-stderr.txt"
    extension_log "$since" "$dir/generator-log.txt"

    since="$(date '+%Y-%m-%d %H:%M:%S')"
    # Use fresh URLs so cached generator requests cannot hide a CLI stall.
    cp -R "$SOURCE/fixtures" "$input/cli-fixtures"
    for file in "${fixtures[@]}"; do
      status=0
      perl -e 'alarm shift; exec @ARGV or die $!' 15 qlmanage -t -s 512 -o "$dir/qlmanage" "$input/cli-fixtures/$file" \
        > "$dir/qlmanage/$file.txt" 2>&1 || status=$?
      printf '%s\t%s\n' "$file" "$status" >> "$dir/qlmanage.tsv"
    done
    extension_log "$since" "$dir/qlmanage-log.txt"
    "$WORK/probe" --ocr "$dir"/qlmanage/*.png > "$dir/qlmanage-ocr.tsv"
    "$WORK/probe" --icon "$dir/icons" "$fixture_dir/no-slides.rtms" > "$dir/icons.tsv"
  else
    mkdir -p "$dir/preview"
    cp "$fixture_dir/plain.md" "$fixture_dir/invalid-deck.rtms"
    for file in skipped-first.rtms theme-and-picture.rtms invalid-deck.rtms plain.md; do
      qlmanage -p "$fixture_dir/$file" > "$dir/preview/$file.txt" 2>&1 &
      pid=$!
      sleep 5
      screencapture -x "$dir/preview/$file.png" >> "$dir/preview/$file.txt" 2>&1 || true
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    done
    "$WORK/probe" --ocr "$dir"/preview/*.png > "$dir/preview-ocr.tsv"
    extension_log "$since" "$dir/extension-log.txt"
  fi
}

thumbnail_first=
preview_first=
snapshot() {
  local stage="$1" kind id attempt listing
  for attempt in {1..10}; do
    for kind in thumbnail preview; do
      id="ai.productory.ritemark.deck-$kind"
      listing="$PROOF/registration/$stage.$kind.txt"
      pluginkit -m -v -i "$id" > "$listing" 2>&1 || true
    done
    if [[ "$stage" == 01-preflight ]] || {
      grep -Fq 'ai.productory.ritemark.deck-thumbnail(' "$PROOF/registration/$stage.thumbnail.txt" &&
      grep -Fq 'ai.productory.ritemark.deck-preview(' "$PROOF/registration/$stage.preview.txt"
    }; then break; fi
    sleep 1
  done
  /usr/bin/log show --last 5m --predicate "$SYSTEM_PREDICATE" --info > "$PROOF/registration/$stage.system.log" 2>&1 || true
  if [[ "$stage" == 06-reset ]]; then
    run_probes "$stage" thumbnail
    run_probes "$stage" preview
    return
  fi
  if [[ -z "$thumbnail_first" ]] && grep -Fq 'ai.productory.ritemark.deck-thumbnail(' "$PROOF/registration/$stage.thumbnail.txt"; then
    thumbnail_first="$stage"
    run_probes "$stage" thumbnail
  fi
  if [[ -z "$preview_first" ]] && grep -Fq 'ai.productory.ritemark.deck-preview(' "$PROOF/registration/$stage.preview.txt"; then
    preview_first="$stage"
    run_probes "$stage" preview
  fi
}

snapshot 01-preflight
if [[ -e "$APP" ]]; then
  echo "Destination already exists: $APP" >&2
  exit 1
fi
{
  record sudo ditto "$STAND_IN" "$APP"
  record "$LSREGISTER" -f -R -trusted "$APP" || true
} > "$PROOF/registration/02-install.commands.log" 2>&1
snapshot 02-install
{
  record open -g -a "$APP" || true
  sleep 3
  # /usr/bin/true normally exits by itself. Clean up if it is still running.
  record pkill -f "^$APP/Contents/MacOS/Ritemark$" || true
} > "$PROOF/registration/03-launch.commands.log" 2>&1
snapshot 03-launch
{
  for kind in Thumbnail Preview; do
    record pluginkit -a "$APP/Contents/PlugIns/RitemarkDeck$kind.appex" || true
  done
} > "$PROOF/registration/04-add.commands.log" 2>&1
snapshot 04-add
{
  for kind in thumbnail preview; do
    record pluginkit -e use -i "ai.productory.ritemark.deck-$kind" || true
  done
} > "$PROOF/registration/05-elect.commands.log" 2>&1
snapshot 05-elect
{
  record qlmanage -r || true
  record qlmanage -r cache || true
} > "$PROOF/registration/06-reset.commands.log" 2>&1
snapshot 06-reset
