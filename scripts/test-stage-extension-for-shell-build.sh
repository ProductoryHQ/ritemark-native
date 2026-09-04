#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAGER="$SCRIPT_DIR/stage-extension-for-shell-build.sh"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/ritemark-stage-extension.XXXXXX")"
trap 'rm -rf "$TEST_ROOT"' EXIT

make_complete_extension() {
  local target="$1"
  mkdir -p "$target/out" "$target/media" "$target/runtime data"
  printf '{"name":"ritemark"}\n' > "$target/package.json"
  printf 'compiled extension\n' > "$target/out/extension.js"
  printf 'compiled webview\n' > "$target/media/webview.js"
  printf 'preserve me\n' > "$target/runtime data/sentinel.txt"
}

SOURCE="$TEST_ROOT/source with spaces/ritemark"
DESTINATION="$TEST_ROOT/staging with spaces/ritemark"
make_complete_extension "$SOURCE"

bash "$STAGER" "$SOURCE" "$DESTINATION"

test ! -e "$SOURCE"
test -s "$DESTINATION/package.json"
test -s "$DESTINATION/out/extension.js"
test -s "$DESTINATION/media/webview.js"
test "$(cat "$DESTINATION/runtime data/sentinel.txt")" = "preserve me"

COLLISION_SOURCE="$TEST_ROOT/collision/source"
COLLISION_DESTINATION="$TEST_ROOT/collision/destination"
make_complete_extension "$COLLISION_SOURCE"
make_complete_extension "$COLLISION_DESTINATION"

if bash "$STAGER" "$COLLISION_SOURCE" "$COLLISION_DESTINATION" >/dev/null 2>&1; then
  echo "ERROR: Existing staging destination was accepted" >&2
  exit 1
fi

test -d "$COLLISION_SOURCE"
test -s "$COLLISION_DESTINATION/runtime data/sentinel.txt"

INCOMPLETE_SOURCE="$TEST_ROOT/incomplete/ritemark"
INCOMPLETE_DESTINATION="$TEST_ROOT/incomplete-stage/ritemark"
mkdir -p "$INCOMPLETE_SOURCE/out" "$INCOMPLETE_SOURCE/media"
printf '{"name":"ritemark"}\n' > "$INCOMPLETE_SOURCE/package.json"
printf 'compiled extension\n' > "$INCOMPLETE_SOURCE/out/extension.js"

if bash "$STAGER" "$INCOMPLETE_SOURCE" "$INCOMPLETE_DESTINATION" >/dev/null 2>&1; then
  echo "ERROR: Incomplete extension was staged" >&2
  exit 1
fi

test -d "$INCOMPLETE_SOURCE"
test ! -e "$INCOMPLETE_DESTINATION"

echo "Extension shell-build staging tests passed"
