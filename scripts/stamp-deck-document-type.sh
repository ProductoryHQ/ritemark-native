#!/bin/bash
# =============================================================================
# Ritemark Native - stamp the deck file type into a release build's Info.plist
# =============================================================================
# Sprint 172 (#940): a deck is a file of its own kind, `<name>.rtms`. macOS
# learns that from the app's Info.plist: an exported type
# `ai.productory.ritemark.deck` (conforms to plain text, so Quick Look shows its
# text and Spotlight reads its words), drawn by the system as its document page
# with the deck badge and the word DECK, and a document type that makes
# Ritemark its owner, so a double-click opens Ritemark.
#
# Why a stamp and not the gulp build: upstream's `build/lib/electron.ts` and
# `@vscode/gulp-electron` cannot declare an exported type or its badge, and a
# change there would make every dev build claim `.rtms` on the Mac it runs on.
# This script runs only in release builds (scripts/build-prod.sh and
# .github/workflows/build-macos-x64.yml), after the version stamp and before
# the provenance step and signing, so the signature covers the edited plist.
#
# Usage:
#   stamp-deck-document-type.sh <App.app>           stamp, then check
#   stamp-deck-document-type.sh --check <App.app>   check only (Gate 1)
#
# The argument is the bundle directory: it must hold Contents/Info.plist and
# Contents/Resources/. The stamp refuses a plist that already names the type,
# so a rerun fails loudly instead of adding a second entry. The check fails on
# any missing or wrong key, a duplicate entry, a plist `plutil -lint` rejects,
# or an asset catalog without the badge. It refuses an app that already has an
# Assets.car, since a compiled catalog cannot be merged into another.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

DECK_UTI="ai.productory.ritemark.deck"
DECK_KIND="Ritemark Deck"
DECK_EXTENSION="rtms"
DECK_BADGE_NAME="deck-badge"
DECK_ICON_TEXT="DECK"
# The badge is an icon set named deck-badge in an asset catalog: macOS finds a
# UTTypeIconBadgeName in the app's Contents/Resources/Assets.car, not in an
# .icns file (the runner proof, deck-type-proof.yml). The compiled catalog is
# committed; branding/README.md has the command that makes it from the SVG.
DECK_BADGE_SOURCE="$PROJECT_DIR/branding/icons/$DECK_BADGE_NAME.car"

PLIST_BUDDY=/usr/libexec/PlistBuddy

usage() {
  echo "Usage: $0 [--check] <App.app>" >&2
  exit 2
}

MODE=stamp
if [[ "${1:-}" == "--check" ]]; then
  MODE=check
  shift
fi
[[ $# -eq 1 ]] || usage
APP_PATH="${1%/}"
INFO_PLIST="$APP_PATH/Contents/Info.plist"
RESOURCES_DIR="$APP_PATH/Contents/Resources"

fail() {
  echo "ERROR (deck file type): $*" >&2
  exit 1
}

[[ -f "$INFO_PLIST" ]] || fail "no Info.plist at $INFO_PLIST"
[[ -d "$RESOURCES_DIR" ]] || fail "no Resources folder at $RESOURCES_DIR"
command -v plutil >/dev/null 2>&1 || fail "plutil not found (macOS only)"
command -v assetutil >/dev/null 2>&1 || fail "assetutil not found (macOS only)"
[[ -x "$PLIST_BUDDY" ]] || fail "PlistBuddy not found (macOS only)"

# Print one value, or nothing when the key path does not exist.
read_key() {
  "$PLIST_BUDDY" -c "Print :$1" "$INFO_PLIST" 2>/dev/null || true
}

# How many entries an array holds (0 when the key is absent).
count_of() {
  local n
  n=$(plutil -extract "$1" raw -o - "$INFO_PLIST" 2>/dev/null) || n=0
  [[ "$n" =~ ^[0-9]+$ ]] || n=0
  echo "$n"
}

names_deck_type() {
  # Read the whole plist first: `plutil | grep -q` under pipefail can report
  # "not found" when grep stops early and plutil dies of SIGPIPE.
  local xml
  xml="$(plutil -convert xml1 -o - "$INFO_PLIST")" || fail "plutil cannot read $INFO_PLIST"
  [[ "$xml" == *"<string>$DECK_UTI</string>"* ]]
}

# -----------------------------------------------------------------------------
# Check: every key read back from the plist itself.
# -----------------------------------------------------------------------------
check() {
  local errors=0
  local i n doc_index="" decl_index="" doc_matches=0 decl_matches=0

  expect() { # <key path> <wanted value>
    local got
    got=$(read_key "$1")
    if [[ "$got" != "$2" ]]; then
      echo "  FAIL: :$1 is '${got}', want '$2'" >&2
      errors=$((errors + 1))
    fi
  }

  if ! plutil -lint -s "$INFO_PLIST"; then
    echo "  FAIL: plutil -lint rejects $INFO_PLIST" >&2
    errors=$((errors + 1))
  fi

  n=$(count_of CFBundleDocumentTypes)
  for ((i = 0; i < n; i++)); do
    local j m
    m=$(count_of "CFBundleDocumentTypes.$i.LSItemContentTypes")
    for ((j = 0; j < m; j++)); do
      if [[ "$(read_key "CFBundleDocumentTypes:$i:LSItemContentTypes:$j")" == "$DECK_UTI" ]]; then
        doc_index=$i
        doc_matches=$((doc_matches + 1))
      fi
    done
  done

  n=$(count_of UTExportedTypeDeclarations)
  for ((i = 0; i < n; i++)); do
    if [[ "$(read_key "UTExportedTypeDeclarations:$i:UTTypeIdentifier")" == "$DECK_UTI" ]]; then
      decl_index=$i
      decl_matches=$((decl_matches + 1))
    fi
  done

  if [[ $doc_matches -ne 1 ]]; then
    echo "  FAIL: $doc_matches document types name $DECK_UTI, want exactly 1" >&2
    errors=$((errors + 1))
  else
    local d="CFBundleDocumentTypes:$doc_index"
    expect "$d:CFBundleTypeName" "$DECK_KIND"
    expect "$d:CFBundleTypeRole" "Editor"
    expect "$d:LSHandlerRank" "Owner"
    if [[ "$(count_of "CFBundleDocumentTypes.$doc_index.LSItemContentTypes")" != "1" ]]; then
      echo "  FAIL: :$d:LSItemContentTypes should hold only $DECK_UTI" >&2
      errors=$((errors + 1))
    fi
    # A CFBundleTypeIconFile would replace the page the system draws.
    if [[ -n "$(read_key "$d:CFBundleTypeIconFile")" ]]; then
      echo "  FAIL: :$d:CFBundleTypeIconFile is set; the system must draw the deck's page" >&2
      errors=$((errors + 1))
    fi
  fi

  if [[ $decl_matches -ne 1 ]]; then
    echo "  FAIL: $decl_matches exported type declarations name $DECK_UTI, want exactly 1" >&2
    errors=$((errors + 1))
  else
    local u="UTExportedTypeDeclarations:$decl_index"
    expect "$u:UTTypeDescription" "$DECK_KIND"
    expect "$u:UTTypeConformsTo:0" "public.plain-text"
    expect "$u:UTTypeTagSpecification:public.filename-extension:0" "$DECK_EXTENSION"
    expect "$u:UTTypeIcons:UTTypeIconBadgeName" "$DECK_BADGE_NAME"
    expect "$u:UTTypeIcons:UTTypeIconText" "$DECK_ICON_TEXT"
  fi

  if [[ ! -s "$RESOURCES_DIR/Assets.car" ]]; then
    echo "  FAIL: no asset catalog at $RESOURCES_DIR/Assets.car (the badge lives there)" >&2
    errors=$((errors + 1))
  elif ! assetutil --info "$RESOURCES_DIR/Assets.car" 2>/dev/null | awk -v name="\"Name\" : \"$DECK_BADGE_NAME\"" \
      'BEGIN { RS = "}" } /"AssetType" : "Icon Image"/ && index($0, name) { found = 1 } END { exit !found }'; then
    echo "  FAIL: $RESOURCES_DIR/Assets.car has no icon set named $DECK_BADGE_NAME" >&2
    errors=$((errors + 1))
  fi

  if [[ $errors -gt 0 ]]; then
    fail "$errors problem(s) in $INFO_PLIST"
  fi
  echo "Deck file type OK: $DECK_UTI \"$DECK_KIND\" (.${DECK_EXTENSION}), Ritemark its owner, badge $DECK_BADGE_NAME in Assets.car + $DECK_ICON_TEXT"
}

if [[ "$MODE" == "check" ]]; then
  check
  exit 0
fi

# -----------------------------------------------------------------------------
# Stamp
# -----------------------------------------------------------------------------
[[ -s "$DECK_BADGE_SOURCE" ]] || fail "the badge source $DECK_BADGE_SOURCE is missing"
if names_deck_type; then
  fail "$INFO_PLIST already names $DECK_UTI; refusing to stamp it twice"
fi
if [[ -e "$RESOURCES_DIR/Assets.car" ]]; then
  fail "$RESOURCES_DIR/Assets.car already exists; the deck badge's catalog cannot be merged into it"
fi

DOC_TYPE_XML="<dict>
  <key>CFBundleTypeName</key><string>$DECK_KIND</string>
  <key>CFBundleTypeRole</key><string>Editor</string>
  <key>LSHandlerRank</key><string>Owner</string>
  <key>LSItemContentTypes</key><array><string>$DECK_UTI</string></array>
</dict>"

EXPORTED_TYPE_XML="<dict>
  <key>UTTypeIdentifier</key><string>$DECK_UTI</string>
  <key>UTTypeDescription</key><string>$DECK_KIND</string>
  <key>UTTypeConformsTo</key><array><string>public.plain-text</string></array>
  <key>UTTypeTagSpecification</key><dict>
    <key>public.filename-extension</key><array><string>$DECK_EXTENSION</string></array>
  </dict>
  <key>UTTypeIcons</key><dict>
    <key>UTTypeIconBadgeName</key><string>$DECK_BADGE_NAME</string>
    <key>UTTypeIconText</key><string>$DECK_ICON_TEXT</string>
  </dict>
</dict>"

if [[ -z "$(read_key CFBundleDocumentTypes)" ]]; then
  plutil -insert CFBundleDocumentTypes -array "$INFO_PLIST"
fi
plutil -insert CFBundleDocumentTypes -xml "$DOC_TYPE_XML" -append "$INFO_PLIST"

if [[ -z "$(read_key UTExportedTypeDeclarations)" ]]; then
  plutil -insert UTExportedTypeDeclarations -array "$INFO_PLIST"
fi
plutil -insert UTExportedTypeDeclarations -xml "$EXPORTED_TYPE_XML" -append "$INFO_PLIST"

cp "$DECK_BADGE_SOURCE" "$RESOURCES_DIR/Assets.car"

echo "Stamped the deck file type into $INFO_PLIST"
check
