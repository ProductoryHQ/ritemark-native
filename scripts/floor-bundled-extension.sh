#!/usr/bin/env bash
#
# floor-bundled-extension.sh - Stamp a bundled extension copy's version to the
# semver "floor" X.Y.Z-0 (GH #142).
#
# The built-in extension inside a production app bundle MUST sort strictly
# BELOW any over-the-air patch X.Y.Z-ext.N, so VS Code's extension scanner —
# which uses standard semver, where "-0" (numeric) ranks below "-ext.N"
# (alphanumeric) and below a plain release — always prefers a user-installed
# update over the built-in. Without this, X.Y.Z-ext.N is a pre-release BELOW
# the bundled X.Y.Z and never loads.
#
# The SOURCE extensions/ritemark/package.json stays at the clean X.Y.Z (it is
# the source of truth release-extension.sh validates); only the copy bundled
# into the app is floored here. Every build path that assembles a release
# bundle (build-prod.sh, build-prod-windows.sh, and the CI workflows
# build-macos-x64.yml / build-windows.yml) MUST call this so the fast lane
# works on every platform.
#
# Usage: floor-bundled-extension.sh <bundled-ext-dir> <base-version>
#   <bundled-ext-dir>  Path to the extension copy inside the app bundle
#                      (the directory containing package.json).
#   <base-version>     Clean base app version, e.g. "1.8.2". Any pre-release /
#                      build suffix is stripped before appending "-0".
set -euo pipefail

EXT_DIR="${1:?usage: floor-bundled-extension.sh <bundled-ext-dir> <base-version>}"
RAW_VERSION="${2:?usage: floor-bundled-extension.sh <bundled-ext-dir> <base-version>}"

# Strip any existing pre-release/build suffix, then floor to X.Y.Z-0.
BASE_VERSION="${RAW_VERSION%%-*}"
BASE_VERSION="${BASE_VERSION%%+*}"
FLOOR_VERSION="${BASE_VERSION}-0"

PKG="$EXT_DIR/package.json"
if [ ! -f "$PKG" ]; then
  echo "ERROR: bundled extension package.json not found at $PKG" >&2
  exit 1
fi

PY=python3
command -v "$PY" >/dev/null 2>&1 || PY=python

"$PY" - "$PKG" "$FLOOR_VERSION" <<'PYEOF'
import json, sys
path, floor = sys.argv[1], sys.argv[2]
with open(path) as f:
    data = json.load(f)
data["version"] = floor
with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
PYEOF

ACTUAL=$("$PY" -c "import json,sys; print(json.load(open(sys.argv[1]))['version'])" "$PKG")
if [ "$ACTUAL" != "$FLOOR_VERSION" ]; then
  echo "ERROR: failed to floor bundled extension version (got '$ACTUAL', want '$FLOOR_VERSION')" >&2
  exit 1
fi

echo "Floored bundled extension version to $FLOOR_VERSION"
