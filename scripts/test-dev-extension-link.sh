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

echo "Development extension link tests passed"
