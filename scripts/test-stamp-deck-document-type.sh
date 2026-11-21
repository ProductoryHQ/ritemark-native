#!/bin/bash
# =============================================================================
# Test for scripts/stamp-deck-document-type.sh (Sprint 172, #940)
# =============================================================================
# Works on a bare plist inside a plain folder in $TMPDIR. The folder is never
# named *.app and holds no executable, so LaunchServices, Finder and Spotlight
# never see a bundle that claims .rtms: nothing is registered on this Mac.
# The real system's answer (kind, icon, opener, Quick Look, Spotlight) comes
# from .github/workflows/deck-type-proof.yml on a GitHub runner.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAMP="$SCRIPT_DIR/stamp-deck-document-type.sh"
PB=/usr/libexec/PlistBuddy

if ! command -v plutil >/dev/null 2>&1 || [[ ! -x "$PB" ]]; then
  echo "SKIP: stamp-deck-document-type test needs macOS (plutil, PlistBuddy)"
  exit 0
fi

WORK="$(mktemp -d "${TMPDIR:-/tmp}/deck-type-test.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

PASS=0
FAILS=0
ok() { echo "  ok - $1"; PASS=$((PASS + 1)); }
not_ok() { echo "  not ok - $1"; FAILS=$((FAILS + 1)); }

# A plist shaped like the one gulp writes: a Markdown document type and no
# exported types (the installed 2.2.0 has none).
make_bundle() { # <dir> [with-exported-type]
  local dir="$1"
  mkdir -p "$dir/Contents/Resources"
  cat > "$dir/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key><string>ai.productory.ritemark.test-fixture</string>
  <key>CFBundleShortVersionString</key><string>2.3.0</string>
  <key>CFBundleDocumentTypes</key>
  <array>
    <dict>
      <key>CFBundleTypeName</key><string>Markdown document</string>
      <key>CFBundleTypeRole</key><string>Editor</string>
      <key>CFBundleTypeExtensions</key><array><string>md</string><string>markdown</string></array>
      <key>CFBundleTypeIconFile</key><string>markdown.icns</string>
    </dict>
  </array>
</dict>
</plist>
PLIST
  if [[ "${2:-}" == "with-exported-type" ]]; then
    plutil -insert UTExportedTypeDeclarations -xml \
      '<array><dict><key>UTTypeIdentifier</key><string>com.example.other</string></dict></array>' \
      "$dir/Contents/Info.plist"
  fi
}

echo "stamp-deck-document-type.sh"

# 1. A fresh plist is stamped, and every key reads back.
B="$WORK/fixture-one"
make_bundle "$B"
if "$STAMP" "$B" >/dev/null 2>"$WORK/err1"; then ok "stamps a fresh plist"; else not_ok "stamps a fresh plist: $(cat "$WORK/err1")"; fi
P="$B/Contents/Info.plist"
[[ "$($PB -c 'Print :CFBundleDocumentTypes:1:CFBundleTypeName' "$P")" == "Ritemark Deck" ]] && ok "the document type is appended after Markdown's" || not_ok "document type name"
[[ "$($PB -c 'Print :CFBundleDocumentTypes:1:LSHandlerRank' "$P")" == "Owner" ]] && ok "Ritemark is the owner" || not_ok "LSHandlerRank"
[[ "$($PB -c 'Print :CFBundleDocumentTypes:1:LSItemContentTypes:0' "$P")" == "ai.productory.ritemark.deck" ]] && ok "the document type names the UTI" || not_ok "LSItemContentTypes"
if $PB -c 'Print :CFBundleDocumentTypes:1:CFBundleTypeIconFile' "$P" >/dev/null 2>&1; then not_ok "the deck's type has no icon file"; else ok "the deck's type has no icon file (the system draws the page)"; fi
[[ "$($PB -c 'Print :UTExportedTypeDeclarations:0:UTTypeConformsTo:0' "$P")" == "public.plain-text" ]] && ok "the type conforms to plain text" || not_ok "UTTypeConformsTo"
[[ "$($PB -c 'Print :UTExportedTypeDeclarations:0:UTTypeTagSpecification:public.filename-extension:0' "$P")" == "rtms" ]] && ok "the extension is rtms" || not_ok "filename extension"
[[ "$($PB -c 'Print :UTExportedTypeDeclarations:0:UTTypeIcons:UTTypeIconBadgeName' "$P")" == "deck-badge" ]] && ok "the badge is deck-badge" || not_ok "badge name"
[[ "$($PB -c 'Print :UTExportedTypeDeclarations:0:UTTypeIcons:UTTypeIconText' "$P")" == "DECK" ]] && ok "the page says DECK" || not_ok "icon text"
cmp -s "$B/Contents/Resources/Assets.car" "$SCRIPT_DIR/../branding/icons/deck-badge.car" && ok "the badge's asset catalog is Resources/Assets.car" || not_ok "badge catalog copy"
plutil -lint -s "$P" && ok "plutil -lint passes" || not_ok "plutil -lint"

# 2. Markdown's entry is left exactly as it was (R11).
[[ "$($PB -c 'Print :CFBundleDocumentTypes:0:CFBundleTypeName' "$P")" == "Markdown document" ]] \
  && [[ "$($PB -c 'Print :CFBundleDocumentTypes:0:CFBundleTypeIconFile' "$P")" == "markdown.icns" ]] \
  && [[ "$($PB -c 'Print :CFBundleDocumentTypes:0:CFBundleTypeExtensions:0' "$P")" == "md" ]] \
  && ok "the Markdown document type is unchanged" || not_ok "Markdown entry changed"
[[ "$($PB -c 'Print :CFBundleShortVersionString' "$P")" == "2.3.0" ]] && ok "the version stamp is untouched" || not_ok "version changed"

# 3. The check passes on the stamped plist.
"$STAMP" --check "$B" >/dev/null 2>&1 && ok "--check passes on a stamped plist" || not_ok "--check on a stamped plist"

# 4. A second stamp refuses and leaves the plist as it was.
cp "$P" "$WORK/before.plist"
if "$STAMP" "$B" >/dev/null 2>"$WORK/err2"; then
  not_ok "a second stamp refuses"
else
  grep -q "refusing to stamp it twice" "$WORK/err2" && ok "a second stamp refuses loudly" || not_ok "second stamp message: $(cat "$WORK/err2")"
fi
cmp -s "$P" "$WORK/before.plist" && ok "the refused stamp changed nothing" || not_ok "the refused stamp changed the plist"

# 4b. A plist far larger than a pipe's buffer is still recognised as stamped.
B7="$WORK/fixture-large"
make_bundle "$B7"
plutil -insert ZZLargeValue -string "$(head -c 200000 /dev/zero | tr '\0' 'x')" "$B7/Contents/Info.plist"
"$STAMP" "$B7" >/dev/null 2>&1 || not_ok "stamps a large plist"
rm "$B7/Contents/Resources/Assets.car"
if "$STAMP" "$B7" >/dev/null 2>"$WORK/err7"; then
  not_ok "a second stamp of a large plist refuses"
else
  grep -q "refusing to stamp it twice" "$WORK/err7" && ok "a second stamp of a large plist refuses for the right reason" || not_ok "large plist second stamp: $(cat "$WORK/err7")"
fi

# 5. An existing UTExportedTypeDeclarations array is appended to, not replaced.
B2="$WORK/fixture-two"
make_bundle "$B2" with-exported-type
"$STAMP" "$B2" >/dev/null 2>&1 || not_ok "stamps a plist with exported types"
[[ "$($PB -c 'Print :UTExportedTypeDeclarations:0:UTTypeIdentifier' "$B2/Contents/Info.plist")" == "com.example.other" ]] \
  && [[ "$($PB -c 'Print :UTExportedTypeDeclarations:1:UTTypeIdentifier' "$B2/Contents/Info.plist")" == "ai.productory.ritemark.deck" ]] \
  && ok "an existing exported type is kept and the deck's appended" || not_ok "exported types not appended"

# 6. The check fails on each missing or wrong piece.
check_fails() { # <description> <PlistBuddy command or "rm-badge">
  local B3="$WORK/fixture-broken"
  rm -rf "$B3"
  cp -R "$B" "$B3"
  if [[ "$2" == "rm-badge" ]]; then
    rm "$B3/Contents/Resources/Assets.car"
  elif [[ "$2" == "other-car" ]]; then
    printf 'not a catalog' > "$B3/Contents/Resources/Assets.car"
  else
    $PB -c "$2" "$B3/Contents/Info.plist"
  fi
  if "$STAMP" --check "$B3" >/dev/null 2>&1; then not_ok "--check fails when $1"; else ok "--check fails when $1"; fi
}
check_fails "the badge name is missing" "Delete :UTExportedTypeDeclarations:0:UTTypeIcons:UTTypeIconBadgeName"
check_fails "DECK is missing" "Delete :UTExportedTypeDeclarations:0:UTTypeIcons:UTTypeIconText"
check_fails "the kind is wrong" "Set :UTExportedTypeDeclarations:0:UTTypeDescription Deck"
check_fails "the type does not conform to plain text" "Set :UTExportedTypeDeclarations:0:UTTypeConformsTo:0 public.data"
check_fails "the extension is missing" "Delete :UTExportedTypeDeclarations:0:UTTypeTagSpecification"
check_fails "Ritemark is not the owner" "Set :CFBundleDocumentTypes:1:LSHandlerRank Alternate"
check_fails "the document type is missing" "Delete :CFBundleDocumentTypes:1"
check_fails "the exported type is missing" "Delete :UTExportedTypeDeclarations:0"
check_fails "an icon file would hide the system's page" "Add :CFBundleDocumentTypes:1:CFBundleTypeIconFile string deck.icns"
check_fails "the badge's asset catalog is missing" "rm-badge"
check_fails "the catalog has no deck-badge icon set" "other-car"

# 6b. An app that already has an asset catalog is refused, untouched.
B6="$WORK/fixture-has-catalog"
make_bundle "$B6"
printf 'upstream catalog' > "$B6/Contents/Resources/Assets.car"
cp "$B6/Contents/Info.plist" "$WORK/before6.plist"
if "$STAMP" "$B6" >/dev/null 2>"$WORK/err6"; then
  not_ok "an app with an Assets.car is refused"
else
  grep -q "cannot be merged" "$WORK/err6" && ok "an app with an Assets.car is refused" || not_ok "Assets.car message: $(cat "$WORK/err6")"
fi
cmp -s "$B6/Contents/Info.plist" "$WORK/before6.plist" && [[ "$(cat "$B6/Contents/Resources/Assets.car")" == "upstream catalog" ]] \
  && ok "the refused app's plist and catalog are untouched" || not_ok "the refused app was changed"

# 7. A plist that was never stamped (a dev build's) fails the check.
B4="$WORK/fixture-unstamped"
make_bundle "$B4"
if "$STAMP" --check "$B4" >/dev/null 2>&1; then not_ok "--check fails on an unstamped plist"; else ok "--check fails on an unstamped plist"; fi

# 8. A malformed plist fails the check.
B5="$WORK/fixture-malformed"
rm -rf "$B5"; cp -R "$B" "$B5"
printf '<plist><dict><key>x</key>' > "$B5/Contents/Info.plist"
if "$STAMP" --check "$B5" >/dev/null 2>&1; then not_ok "--check fails on a malformed plist"; else ok "--check fails on a malformed plist"; fi

echo "  $PASS passed, $FAILS failed"
[[ $FAILS -eq 0 ]]
