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
RESULTS="$PROOF/results.md"
STATE_MODULE="$ROOT/extensions/ritemark/src/decks/quickLook/pluginkitState.ts"
os_version="$(sw_vers -productVersion)"
cpu="$(uname -m)"
mkdir -p "$PROOF/registration"
printf '# Quick Look runner proof\n\nmacOS %s · %s\n' "$os_version" "$cpu" > "$RESULTS"
since="$(date '+%Y-%m-%d %H:%M:%S')"
collect_logs() {
  local status=$?
  if [[ -n "${provider_log_pid:-}" ]]; then
    kill "$provider_log_pid" 2>/dev/null || true
    wait "$provider_log_pid" 2>/dev/null || true
  fi
  local until
  until="$(date '+%Y-%m-%d %H:%M:%S')"
  /usr/bin/log show --start "$since" --end "$until" --info --debug \
    --predicate 'subsystem == "ai.productory.ritemark.quicklook" OR process CONTAINS[c] "quicklook" OR process BEGINSWITH "RitemarkDeck" OR (process == "launchd" AND eventMessage CONTAINS[c] "Ritemark")' \
    > "$PROOF/system-log.txt" 2>&1 || touch "$PROOF/system-log.failed"
  sudo /usr/bin/log show --start "$since" --end "$until" --info --debug \
    --predicate '(eventMessage CONTAINS "deny" OR sender == "Sandbox") AND (eventMessage CONTAINS[c] "Ritemark" OR eventMessage CONTAINS[c] "quicklook" OR process BEGINSWITH "RitemarkDeck")' \
    > "$PROOF/sandbox-log.txt" 2>&1 || touch "$PROOF/sandbox-log.failed"
  printf '\n[System log](system-log.txt) · [Live provider log with PIDs and timings](provider-stream.txt) · [Sandbox denials](sandbox-log.txt)\n' >> "$RESULTS"
  cat "$RESULTS" >> "$GITHUB_STEP_SUMMARY"
  return "$status"
}
trap collect_logs EXIT

mkdir -p "$PROOF/registration" "$WORK/fixtures" "$STAND_IN/Contents/"{MacOS,Resources,PlugIns}
# Compile a native executable instead of re-signing Apple's arm64e platform binary.
xcrun clang -arch "$(uname -m)" -mmacosx-version-min=12.0 \
  "$SOURCE/Proof/host.c" -o "$STAND_IN/Contents/MacOS/Ritemark"
cp "$ROOT/branding/icons/icon.icns" "$STAND_IN/Contents/Resources/Ritemark.icns"
cp "$SOURCE/Proof/Host.plist" "$STAND_IN/Contents/Info.plist"
host_id="$(plutil -extract CFBundleIdentifier raw -o - "$STAND_IN/Contents/Info.plist")"
[[ "$host_id" == "$(plutil -extract darwinBundleIdentifier raw -o - "$ROOT/branding/product.json")" ]]
real_home="$(python3 -c 'import os, pwd; print(pwd.getpwuid(os.getuid()).pw_dir)')"
cache="$real_home/Library/Caches/$host_id/quicklook/v1"
private_fixtures="$(mktemp -d /private/tmp/ritemark-quicklook.XXXXXX)"
mkdir -p "$private_fixtures"/{default,elected}
printf 'Host ID: %s\nCache root: %s\n' "$host_id" "$cache" > "$PROOF/cache.txt"
"$ROOT/scripts/stamp-deck-document-type.sh" "$STAND_IN" | tee "$PROOF/deck-type.txt"

for kind in Thumbnail Preview; do
  name="RitemarkDeck$kind"
  python3 "$SOURCE/Proof/check-bundle.py" "$BUILD/$name.appex" "$kind" > "$PROOF/$name.bundle-check.txt"
  [[ "$host_id" == "$(plutil -extract RitemarkHostBundleIdentifier raw -o - "$BUILD/$name.appex/Contents/Info.plist")" ]]
  ditto "$BUILD/$name.appex" "$STAND_IN/Contents/PlugIns/$name.appex"
  bundle="$STAND_IN/Contents/PlugIns/$name.appex"
  codesign --force --sign - --options runtime --entitlements "$BUILD/$name.entitlements" "$bundle"
  codesign -dv --entitlements - --xml "$bundle" > "$PROOF/$name.entitlements.plist" 2> "$PROOF/$name.codesign.txt"
done
codesign --force --sign - "$STAND_IN"
codesign -dv "$STAND_IN" > "$PROOF/Ritemark.codesign.txt" 2>&1
codesign --verify --deep --strict --verbose=2 "$STAND_IN" 2>&1 | tee "$PROOF/codesign-verify.txt"

python3 "$SOURCE/Proof/seed.py" "$cache" "$WORK/fixtures" "$private_fixtures/default" >> "$PROOF/cache.txt"
xcrun swiftc -module-cache-path "$WORK/module-cache" "$SOURCE"/Shared/*.swift \
  "$SOURCE/Preview/PreviewProvider.swift" "$SOURCE/Proof/preview-payload.swift" -o "$WORK/preview-payload"
"$WORK/preview-payload" "$WORK/fixtures" "$host_id" | tee "$PROOF/preview-payload.tsv"
{
  printf '\n## Direct preview payload checks\n\n'
  awk -F '\t' '{printf "- %s — %s, %s\n", $1, $2, $3}' "$PROOF/preview-payload.tsv"
} >> "$RESULTS"
xcrun swiftc -module-cache-path "$WORK/module-cache" -parse-as-library "$SOURCE/Proof/probe.swift" -o "$WORK/probe"

installed_id() {
  plutil -extract CFBundleIdentifier raw -o - "$STAND_IN/Contents/PlugIns/RitemarkDeck$1.appex/Contents/Info.plist"
}

thumbnail_id="$(installed_id Thumbnail)"
preview_id="$(installed_id Preview)"

listing() {
  pluginkit -m -vv -i "$thumbnail_id" > "$PROOF/registration/$1.thumbnail.txt" 2>&1 || true
  pluginkit -m -vv -i "$preview_id" > "$PROOF/registration/$1.preview.txt" 2>&1 || true
}

election() {
  local phase="$1" kind="$2" bundle_id="$3"
  local raw="registration/$phase.$kind.election"
  local state
  state="$(node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
    "$SOURCE/Proof/read-election.mjs" "$STATE_MODULE" "$bundle_id" "$PROOF/$raw")"
  printf -- '- %s %s (`%s`) — **%s** ([stdout](%s.txt), [stderr and exit status](%s.log), [registered paths](registration/%s.%s.txt))\n' \
    "$phase" "$kind" "$bundle_id" "$state" "$raw" "$raw" "$phase" "$kind" >> "$RESULTS"
}

printf '\n## Discovery and election\n\n' >> "$RESULTS"
listing 01-before-install
if [[ -e "$APP" ]]; then
  echo "Destination already exists: $APP" >&2
  exit 1
fi
sudo ditto "$STAND_IN" "$APP"
listing 02-before-launch
election 02-before-launch thumbnail "$thumbnail_id"
election 02-before-launch preview "$preview_id"
/usr/bin/log stream --style compact --level info \
  --predicate 'subsystem == "ai.productory.ritemark.quicklook" AND process BEGINSWITH "RitemarkDeck"' \
  > "$PROOF/provider-stream.txt" 2> "$PROOF/provider-stream.stderr" &
provider_log_pid=$!
if ! open "$APP" --args "$PROOF/host.pid" > "$PROOF/registration/launch.txt" 2>&1; then
  printf '\nHost launch failed. See [launch log](registration/launch.txt).\n' >> "$RESULTS"
  exit 1
fi
for attempt in {1..15}; do
  listing 03-after-launch
  if [[ -s "$PROOF/host.pid" ]] &&
    grep -Fq "$thumbnail_id(" "$PROOF/registration/03-after-launch.thumbnail.txt" &&
    grep -Fq "$preview_id(" "$PROOF/registration/03-after-launch.preview.txt"; then break; fi
  sleep 1
done
if [[ ! -s "$PROOF/host.pid" ]]; then
  printf '\nHost did not report a PID. See [launch log](registration/launch.txt).\n' >> "$RESULTS"
  exit 1
fi
printf '\nHost launched with PID %s.\n' "$(cat "$PROOF/host.pid")" >> "$RESULTS"
printf '\n' >> "$RESULTS"
election 03-after-launch thumbnail "$thumbnail_id"
election 03-after-launch preview "$preview_id"

settings_capture() {
  local output="$PROOF/settings"
  local window_id
  local capture_available=false
  local settings_url
  mkdir -p "$output"
  settings_url="$(node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
    "$SOURCE/Proof/read-election.mjs" "$STATE_MODULE" --settings-url)"
  printf '\n## System Settings\n\nLink: `%s`.\n\n' "$settings_url" >> "$RESULTS"
  if ! open "$settings_url" > "$output/capture.log" 2>&1; then
    printf -- '- FAIL opening the link ([log](settings/capture.log)).\n' >> "$RESULTS"
    return 1
  fi
  for attempt in {1..15}; do
    sleep 1
    if window_id="$("$WORK/probe" --settings-window 2>> "$output/capture.log")" &&
       screencapture -x -o -l "$window_id" "$output/window.png" >> "$output/capture.log" 2>&1; then
      capture_available=true
      if "$WORK/probe" --ocr "$output/window.png" 'Login Items & Extensions' 'Quick Look' \
        > "$output/ocr.txt" 2>&1; then
        printf -- '- PASS both labels in System Settings ([window PNG](settings/window.png), [OCR](settings/ocr.txt)).\n' >> "$RESULTS"
        return 0
      fi
    fi
  done
  if [[ "$capture_available" == false ]] &&
     ! screencapture -x "$WORK/settings-capture-check.png" >> "$output/capture.log" 2>&1; then
    printf -- '- Coverage gap — screen capture unavailable ([log](settings/capture.log)).\n' >> "$RESULTS"
    return 2
  fi
  printf -- '- FAIL could not verify both labels in System Settings ([artifacts](settings/)).\n' >> "$RESULTS"
  return 1
}

settings_status=confirmed
settings_capture || case "$?" in
  2) settings_status=gap ;;
  *) settings_status=failed ;;
esac
printf '%s\t%s\t%s\n' "$os_version" "$cpu" "$settings_status" > "$PROOF/settings.tsv"
killall 'System Settings' 2>/dev/null || true

preview_capture() (
  local source="$1" output="$2" marker="$3" phase="$4" kind="$5"
  local started ended status=1
  started="$(date +%s)"
  qlmanage -p "$source" > "$output/preview.log" 2>&1 &
  local pid=$!
  trap 'kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true' EXIT
  if [[ "$settings_status" == gap ]]; then
    # Keep the native preview request and provider checks when screen capture is unavailable.
    sleep 5
    printf -- '- %s preview UI — coverage gap (screen capture unavailable, qlmanage PID %s).\n' \
      "$kind" "$pid" >> "$RESULTS"
    return 0
  fi
  # Poll the screenshot for the expected content rather than taking a single snapshot.
  for attempt in {1..8}; do
    sleep 1
    if screencapture -x "$output/preview.png" >> "$output/preview.log" 2>&1 &&
       "$WORK/probe" --ocr "$output/preview.png" "$marker" > "$output/preview-ocr.txt" 2>&1; then
      status=0
      break
    fi
  done
  ended="$(date +%s)"
  local result=FAIL
  if [[ "$status" == 0 ]]; then result=PASS; fi
  printf -- '- %s preview UI — %s expected %s, qlmanage PID %s, %ss ([PNG](%s/preview.png), [OCR](%s/preview-ocr.txt))\n' \
    "$kind" "$result" "$marker" "$pid" "$((ended - started))" "$phase/$kind" "$phase/$kind" >> "$RESULTS"
  return "$status"
)

exercise() {
  local phase="$1" fixtures="$2"
  local output="$PROOF/$phase"
  mkdir -p "$output"/{png,match,stale}
  local first_line status=0
  first_line="$(wc -l < "$PROOF/provider-stream.txt")"
  printf '\n## %s requests\n\n' "$phase" >> "$RESULTS"
  "$WORK/probe" "$fixtures" "$output/png" "$private_fixtures/$phase" \
    "$SOURCE/Shared/Resources/DeckIcon.pdf" "$SOURCE/Shared/Resources/DeckIconSmall.pdf" > "$output/thumbnails.txt" 2>&1 || status=1
  if ! sed -n '/^- /p' "$output/thumbnails.txt" | grep . >> "$RESULTS"; then
    printf -- '- Thumbnail probe setup failed. See [%s log](%s/thumbnails.txt).\n' "$phase" "$phase" >> "$RESULTS"
  fi
  preview_capture "$fixtures/café.rtms" "$output/match" "PROOF SLIDE ONE" "$phase" match || status=1
  preview_capture "$fixtures/stale.rtms" "$output/stale" "PROOF CURRENT SOURCE" "$phase" stale || status=1
  sleep 2
  tail -n "+$((first_line + 1))" "$PROOF/provider-stream.txt" > "$output/providers.txt"
  local description
  for description in 'Preview PDF: 2 pages' 'Preview plain text: 32 bytes' 'Thumbnail PDF page 1' 'Thumbnail deck icon'; do
    if grep -F "$description" "$output/providers.txt" > "$output/reply.txt"; then
      sed 's/^/- Provider reply — /' "$output/reply.txt" >> "$RESULTS"
    else
      printf -- '- FAIL missing provider reply evidence for %s.\n' "$description" >> "$RESULTS"
      status=1
    fi
  done
  local kind
  for kind in Thumbnail Preview; do
    if grep -F "RitemarkDeck$kind" "$output/providers.txt" | grep -F "Cache hit: $cache" > "$output/reply.txt"; then
      printf -- '- PASS sandboxed %s cache hit at `%s`.\n' "$kind" "$cache" >> "$RESULTS"
    else
      printf -- '- FAIL expected sandboxed %s cache hit at `%s`.\n' "$kind" "$cache" >> "$RESULTS"
      status=1
    fi
  done
  rm -f "$output/reply.txt"
  return "$status"
}

if exercise default "$WORK/fixtures"; then
  printf '\nBoth Quick Look points passed after first launch with default election.\n' | tee -a "$RESULTS"
else
  printf '\nDefault launch proof failed. Controlled discovery and election follow.\n' | tee -a "$RESULTS"
  "$LSREGISTER" -f -R -trusted "$APP"
  listing 04-explicit-registration
  for bundle_id in "$thumbnail_id" "$preview_id"; do
    pluginkit -e use -i "$bundle_id"
  done
  listing 05-explicit-election
  election 05-explicit-election thumbnail "$thumbnail_id"
  election 05-explicit-election preview "$preview_id"
  qlmanage -r
  qlmanage -r cache
  mkdir -p "$WORK/elected-fixtures"
  python3 "$SOURCE/Proof/seed.py" "$cache" "$WORK/elected-fixtures" "$private_fixtures/elected" >> "$PROOF/cache.txt"
  if exercise elected "$WORK/elected-fixtures"; then
    printf '\nBoth Quick Look points passed after explicit registration and election.\n' | tee -a "$RESULTS"
  else
    printf '\nQuick Look proof also failed after explicit election. See per-request artifacts.\n' | tee -a "$RESULTS"
    exit 1
  fi
fi
[[ "$settings_status" != failed ]]
