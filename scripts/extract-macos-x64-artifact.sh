#!/bin/bash
# Extract the CI-built macOS x64 app without losing symlinks or executable bits.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ARCHIVE_PATH="${1:-$PROJECT_ROOT/dist/x64-ci/ritemark-darwin-x64.tar.gz}"
DESTINATION="${2:-$PROJECT_ROOT/VSCode-darwin-x64}"

if [ ! -f "$ARCHIVE_PATH" ]; then
  echo "ERROR: x64 build archive not found: $ARCHIVE_PATH" >&2
  exit 1
fi
if [ -e "$DESTINATION" ]; then
  echo "ERROR: x64 extraction destination already exists: $DESTINATION" >&2
  exit 1
fi

TEMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/ritemark-x64-extract.XXXXXX")"
trap 'rm -rf "$TEMP_ROOT"' EXIT

while IFS= read -r entry; do
  case "$entry" in
    VSCode-darwin-x64|VSCode-darwin-x64/*) ;;
    *)
      echo "ERROR: unexpected path in x64 archive: $entry" >&2
      exit 1
      ;;
  esac
  case "/$entry/" in
    *"/../"*)
      echo "ERROR: unsafe parent traversal in x64 archive: $entry" >&2
      exit 1
      ;;
  esac
done < <(tar -tzf "$ARCHIVE_PATH")

tar -xzf "$ARCHIVE_PATH" -C "$TEMP_ROOT"
EXTRACTED="$TEMP_ROOT/VSCode-darwin-x64"
APP_PATH="$EXTRACTED/Ritemark.app"
EXTENSION_PATH="$APP_PATH/Contents/Resources/app/extensions/ritemark"
DIGEST_PATH="$EXTRACTED/ritemark-extension-pre-sign.sha256"

if [ ! -d "$APP_PATH" ] || [ ! -d "$EXTENSION_PATH" ]; then
  echo "ERROR: archive does not contain the expected Ritemark.app extension payload" >&2
  exit 1
fi
if [ ! -f "$DIGEST_PATH" ] || ! grep -Eq '^[a-f0-9]{64}$' "$DIGEST_PATH"; then
  echo "ERROR: archive is missing a valid pre-sign extension digest" >&2
  exit 1
fi

EXPECTED_SHA="$(cat "$DIGEST_PATH")"
ACTUAL_SHA="$(node "$SCRIPT_DIR/tree-sha256.mjs" "$EXTENSION_PATH")"
if [ "$ACTUAL_SHA" != "$EXPECTED_SHA" ]; then
  echo "ERROR: extracted extension payload does not match the CI attestation" >&2
  echo "  expected: $EXPECTED_SHA" >&2
  echo "  actual:   $ACTUAL_SHA" >&2
  exit 1
fi

mkdir -p "$(dirname "$DESTINATION")"
mv "$EXTRACTED" "$DESTINATION"
echo "Verified macOS x64 artifact extracted to: $DESTINATION"
