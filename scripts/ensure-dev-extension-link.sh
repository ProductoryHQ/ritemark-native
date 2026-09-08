#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

if [[ "${1:-}" == "--root" ]]; then
  if [[ -z "${2:-}" || -n "${3:-}" ]]; then
    echo "Usage: $0 [--root <project-root>]" >&2
    exit 2
  fi
  PROJECT_ROOT="$(cd "$2" && pwd -P)"
elif [[ $# -ne 0 ]]; then
  echo "Usage: $0 [--root <project-root>]" >&2
  exit 2
fi

# shellcheck source=lib/extension-link.sh
. "$SCRIPT_DIR/lib/extension-link.sh"

EXTENSION_SOURCE="$PROJECT_ROOT/extensions/ritemark"
EXTENSION_LINK="$PROJECT_ROOT/vscode/extensions/ritemark"
EXPECTED_TARGET="../../extensions/ritemark"

if [[ ! -d "$EXTENSION_SOURCE" ]]; then
  echo "ERROR: canonical extension source is missing: $EXTENSION_SOURCE" >&2
  exit 1
fi

mkdir -p "$PROJECT_ROOT/vscode/extensions"

if [[ -L "$EXTENSION_LINK" ]]; then
  # Resolved-path comparison, not raw readlink: a Windows junction reads back
  # as an absolute path and would fail a literal match on every run, deleting
  # a good link. See scripts/lib/extension-link.sh.
  if ritemark_link_points_at "$EXTENSION_LINK" "$EXTENSION_SOURCE"; then
    echo "Extension link already correct: $EXTENSION_LINK -> $EXTENSION_SOURCE"
    exit 0
  fi

  rm "$EXTENSION_LINK"
elif [[ -e "$EXTENSION_LINK" ]]; then
  echo "ERROR: refusing to replace physical extension path: $EXTENSION_LINK" >&2
  echo "Move or remove the derived copy after confirming it contains no unique work, then rerun setup." >&2
  exit 1
fi

ritemark_link_create "$EXTENSION_LINK" "$EXTENSION_SOURCE" "$EXPECTED_TARGET"
echo "Created extension link: $EXTENSION_LINK -> $EXTENSION_SOURCE"
