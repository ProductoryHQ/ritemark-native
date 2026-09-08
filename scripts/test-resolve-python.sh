#!/usr/bin/env bash
#
# Regression tests for scripts/lib/resolve-python.sh (GH: Windows Store stub).
#
# On Windows, ...\Microsoft\WindowsApps\python3 is an App Execution Alias that
# `command -v` finds (exit 0) but which only prints "Python was not found;
# install it from the Microsoft Store..." and exits 49. The old
# `for py in python3 python; do command -v ...; done` probe selected it and
# every caller aborted. These tests reproduce that shape on any platform.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib/resolve-python.sh
. "$SCRIPT_DIR/lib/resolve-python.sh"

REAL_PYTHON="$(ritemark_resolve_python)"
if [[ -z "$REAL_PYTHON" ]]; then
  echo "SKIP: no Python on this host, nothing to test against" >&2
  exit 0
fi
REAL_PYTHON_PATH="$(command -v "$REAL_PYTHON")"
# The sub-shells below run with a PATH that deliberately excludes the real
# system bin dirs, so invoke bash by absolute path.
BASH_BIN="$(command -v bash)"

TEST_ROOT="$(mktemp -d -t ritemark-resolve-python.XXXXXX)"
trap 'rm -rf "$TEST_ROOT"' EXIT

# A stub that behaves exactly like the Store alias.
make_stub() {
  local path="$1"
  mkdir -p "$(dirname "$path")"
  cat > "$path" <<'STUB'
#!/bin/sh
echo "Python was not found; run without arguments to install from the Microsoft Store, or disable this shortcut from Settings > Manage App Execution Aliases."
exit 49
STUB
  chmod +x "$path"
}

# Case 1: a WindowsApps stub shadowing python3 must be skipped by path, and a
# real interpreter further down PATH must still be found.
mkdir -p "$TEST_ROOT/AppData/Local/Microsoft/WindowsApps" "$TEST_ROOT/realbin"
make_stub "$TEST_ROOT/AppData/Local/Microsoft/WindowsApps/python3"
ln -s "$REAL_PYTHON_PATH" "$TEST_ROOT/realbin/python"

RESULT="$(PATH="$TEST_ROOT/AppData/Local/Microsoft/WindowsApps:$TEST_ROOT/realbin" \
  "$BASH_BIN" -c ". '$SCRIPT_DIR/lib/resolve-python.sh'; ritemark_resolve_python")"
if [[ "$RESULT" != "python" ]]; then
  echo "FAIL: WindowsApps stub was not skipped (got '$RESULT')" >&2
  exit 1
fi

# Case 2: a stub anywhere else is caught by the "does it actually run" probe.
mkdir -p "$TEST_ROOT/otherbin"
make_stub "$TEST_ROOT/otherbin/python3"
ln -s "$REAL_PYTHON_PATH" "$TEST_ROOT/otherbin/python"

RESULT="$(PATH="$TEST_ROOT/otherbin" \
  "$BASH_BIN" -c ". '$SCRIPT_DIR/lib/resolve-python.sh'; ritemark_resolve_python")"
if [[ "$RESULT" != "python" ]]; then
  echo "FAIL: non-running interpreter was accepted (got '$RESULT')" >&2
  exit 1
fi

# Case 3: nothing usable at all must fail, not return a stub.
mkdir -p "$TEST_ROOT/onlystub"
make_stub "$TEST_ROOT/onlystub/python3"
make_stub "$TEST_ROOT/onlystub/python"

if RESULT="$(PATH="$TEST_ROOT/onlystub" \
    "$BASH_BIN" -c ". '$SCRIPT_DIR/lib/resolve-python.sh'; ritemark_resolve_python")"; then
  echo "FAIL: resolver returned '$RESULT' when only stubs were available" >&2
  exit 1
fi

echo "Python resolution tests passed"
