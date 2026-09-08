#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
TEST_ROOT="$(mktemp -d -t ritemark-dev-extension-link.XXXXXX)"
trap 'rm -rf "$TEST_ROOT"' EXIT

mkdir -p "$TEST_ROOT/extensions/ritemark" "$TEST_ROOT/vscode/extensions"

"$SCRIPT_DIR/ensure-dev-extension-link.sh" --root "$TEST_ROOT"
[[ -L "$TEST_ROOT/vscode/extensions/ritemark" ]]
[[ "$(readlink "$TEST_ROOT/vscode/extensions/ritemark")" == "../../extensions/ritemark" ]]
[[ -d "$TEST_ROOT/vscode/extensions/ritemark" ]]

"$SCRIPT_DIR/ensure-dev-extension-link.sh" --root "$TEST_ROOT"

rm "$TEST_ROOT/vscode/extensions/ritemark"
mkdir "$TEST_ROOT/vscode/extensions/ritemark"
touch "$TEST_ROOT/vscode/extensions/ritemark/preserve-me"

if "$SCRIPT_DIR/ensure-dev-extension-link.sh" --root "$TEST_ROOT" >"$TEST_ROOT/refusal.log" 2>&1; then
  echo "FAIL: helper replaced a physical extension directory" >&2
  exit 1
fi
grep -q "refusing to replace physical extension path" "$TEST_ROOT/refusal.log"
[[ -f "$TEST_ROOT/vscode/extensions/ritemark/preserve-me" ]]

rm -rf "$TEST_ROOT/vscode/extensions/ritemark"
ln -s ../../extensions/not-ritemark "$TEST_ROOT/vscode/extensions/ritemark"
"$SCRIPT_DIR/ensure-dev-extension-link.sh" --root "$TEST_ROOT"
[[ "$(readlink "$TEST_ROOT/vscode/extensions/ritemark")" == "../../extensions/ritemark" ]]

# A link whose raw readlink output is absolute but which RESOLVES to the
# canonical source must be left alone. This is the shape a Windows directory
# junction takes; the old literal comparison deleted it on every run.
rm -rf "$TEST_ROOT/vscode/extensions/ritemark"
ln -s "$TEST_ROOT/extensions/ritemark" "$TEST_ROOT/vscode/extensions/ritemark"
"$SCRIPT_DIR/ensure-dev-extension-link.sh" --root "$TEST_ROOT"
[[ -L "$TEST_ROOT/vscode/extensions/ritemark" ]]
if [[ "$(readlink "$TEST_ROOT/vscode/extensions/ritemark")" != "$TEST_ROOT/extensions/ritemark" ]]; then
  echo "FAIL: helper replaced an absolute link that already resolved correctly" >&2
  exit 1
fi

# ritemark_link_create must never return having produced a physical directory
# (the Git Bash `ln -s` deep-copy trap) -- apply-patches.sh relies on this.
rm -rf "$TEST_ROOT/vscode/extensions/ritemark"
# shellcheck source=lib/extension-link.sh
. "$SCRIPT_DIR/lib/extension-link.sh"
ritemark_link_create \
  "$TEST_ROOT/vscode/extensions/ritemark" \
  "$TEST_ROOT/extensions/ritemark" \
  ../../extensions/ritemark
[[ -L "$TEST_ROOT/vscode/extensions/ritemark" ]]
ritemark_link_points_at "$TEST_ROOT/vscode/extensions/ritemark" "$TEST_ROOT/extensions/ritemark"

echo "Development extension link tests passed"
