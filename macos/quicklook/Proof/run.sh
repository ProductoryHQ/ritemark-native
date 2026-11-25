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
mkdir -p "$PROOF/registration"
printf '# Quick Look runner proof\n' > "$RESULTS"
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
/usr/bin/log stream --style compact --level info \
  --predicate 'subsystem == "ai.productory.ritemark.quicklook" AND process BEGINSWITH "RitemarkDeck"' \
  > "$PROOF/provider-stream.txt" 2> "$PROOF/provider-stream.stderr" &
provider_log_pid=$!
if ! open "$APP" --args "$PROOF/host.pid" > "$PROOF/registration/launch.txt" 2>&1; then
  printf '\nHost launch failed. See [launch log](registration/launch.txt).\n' >> "$RESULTS"
  exit 1
fi
for attempt in {1..15}; do
  listing 02-after-launch
  if [[ -s "$PROOF/host.pid" ]] &&
    grep -Fq "$host_id.deck-thumbnail(" "$PROOF/registration/02-after-launch.thumbnail.txt" &&
    grep -Fq "$host_id.deck-preview(" "$PROOF/registration/02-after-launch.preview.txt"; then break; fi
  sleep 1
done
if [[ ! -s "$PROOF/host.pid" ]]; then
  printf '\nHost did not report a PID. See [launch log](registration/launch.txt).\n' >> "$RESULTS"
  exit 1
fi
printf '\nHost launched with PID %s.\n' "$(cat "$PROOF/host.pid")" >> "$RESULTS"

preview_capture() (
  local source="$1" output="$2" marker="$3" phase="$4" kind="$5"
  local started ended status=1
  started="$(date +%s)"
  qlmanage -p "$source" > "$output/preview.log" 2>&1 &
  local pid=$!
  trap 'kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true' EXIT
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
  listing 03-explicit-registration
  for point in thumbnail preview; do
    pluginkit -e use -i "$host_id.deck-$point"
  done
  listing 04-explicit-election
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
