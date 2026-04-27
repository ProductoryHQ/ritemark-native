#!/usr/bin/env bash
#
# validate-chrome-fast.sh - Fast pre-compile guard for VS Code chrome patches.
#
# This catches the class of errors that otherwise show up late in `npm run compile`:
# - patch drift/conflicts
# - malformed product icon JSON
# - missing Phosphor icon font source
# - TypeScript errors in changed VS Code chrome code, using tsgo --noEmit
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VSCODE_DIR="$PROJECT_ROOT/vscode"

FORCE_TS=false
WITH_ASSETS=false

for arg in "$@"; do
  case "$arg" in
    --all)
      FORCE_TS=true
      WITH_ASSETS=true
      ;;
    --force-ts)
      FORCE_TS=true
      ;;
    --with-assets)
      WITH_ASSETS=true
      ;;
    -h|--help)
      cat <<'EOF'
Usage: ./scripts/validate-chrome-fast.sh [--force-ts] [--with-assets] [--all]

Runs fast validation for VS Code chrome/activity-bar work:
  - patch dry-run
  - product icon JSON parse
  - Phosphor font source check
  - tsgo noEmit check when chrome-sensitive files changed

Options:
  --force-ts     Run the VS Code native TypeScript check even if no chrome-sensitive changes are detected.
  --with-assets  Also run scripts/test-ci-asset-parity.sh.
  --all          Equivalent to --force-ts --with-assets.
EOF
      exit 0
      ;;
    *)
      echo "ERROR: Unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

cd "$PROJECT_ROOT"

echo "Running fast chrome validation..."

if [ ! -d "$VSCODE_DIR" ]; then
  echo "ERROR: Missing VS Code checkout at $VSCODE_DIR" >&2
  exit 1
fi

if [ "$(git branch --show-current)" = "main" ]; then
  echo "ERROR: Do not validate/develop sprint chrome work on main." >&2
  exit 1
fi

echo "Checking patch state..."
"$PROJECT_ROOT/scripts/apply-patches.sh" --dry-run >/dev/null

PRODUCT_ICON_THEME="$PROJECT_ROOT/extensions/ritemark/producticons/ritemark-product-icon-theme.json"
if [ -f "$PRODUCT_ICON_THEME" ]; then
  echo "Checking product icon theme JSON..."
  jq empty "$PRODUCT_ICON_THEME"
fi

PHOSPHOR_SOURCE="$VSCODE_DIR/extensions/ritemark/node_modules/@phosphor-icons/web/src/light/Phosphor-Light.woff2"
if [ ! -f "$PHOSPHOR_SOURCE" ]; then
  PHOSPHOR_SOURCE="$PROJECT_ROOT/extensions/ritemark/node_modules/@phosphor-icons/web/src/light/Phosphor-Light.woff2"
fi

if [ ! -f "$PHOSPHOR_SOURCE" ]; then
  echo "ERROR: Missing Phosphor 200 source font in either supported location:" >&2
  echo "  - $VSCODE_DIR/extensions/ritemark/node_modules/@phosphor-icons/web/src/light/Phosphor-Light.woff2" >&2
  echo "  - $PROJECT_ROOT/extensions/ritemark/node_modules/@phosphor-icons/web/src/light/Phosphor-Light.woff2" >&2
  exit 1
fi

ROOT_CHANGED="$(
  {
    git diff --name-only --cached 2>/dev/null || true
    git diff --name-only 2>/dev/null || true
    git ls-files --others --exclude-standard 2>/dev/null || true
  } | sort -u
)"

VSCODE_CHANGED="$(
  {
    git -C "$VSCODE_DIR" diff --name-only --cached 2>/dev/null || true
    git -C "$VSCODE_DIR" diff --name-only 2>/dev/null || true
    git -C "$VSCODE_DIR" ls-files --others --exclude-standard 2>/dev/null || true
  } | sort -u
)"

ROOT_CHROME_PATTERN='^(patches/vscode/|scripts/(apply-patches|test-ci-asset-parity|build-windows-local|validate-chrome-fast)\.(sh|ps1)$|extensions/ritemark/producticons/|extensions/ritemark/package(-lock)?\.json$)'
VSCODE_CHROME_PATTERN='^src/vs/(base/browser/ui/codicons/codicon/|platform/theme/common/iconRegistry\.ts|workbench/api/browser/viewsExtensionPoint\.ts|workbench/browser/actions/layoutActions\.ts|workbench/browser/parts/activitybar/|workbench/browser/parts/globalCompositeBar\.ts|workbench/services/userDataProfile/common/userDataProfileIcons\.ts)'

RUN_TS=false
if [ "$FORCE_TS" = true ]; then
  RUN_TS=true
elif printf '%s\n' "$ROOT_CHANGED" | grep -Eq "$ROOT_CHROME_PATTERN"; then
  RUN_TS=true
elif printf '%s\n' "$VSCODE_CHANGED" | grep -Eq "$VSCODE_CHROME_PATTERN"; then
  RUN_TS=true
fi

if [ "$RUN_TS" = true ]; then
  echo "Running VS Code native TypeScript check..."
  (
    if [ -s "$HOME/.nvm/nvm.sh" ]; then
      # shellcheck disable=SC1091
      source "$HOME/.nvm/nvm.sh"
      nvm use "$(cat "$PROJECT_ROOT/.nvmrc")" >/dev/null
    fi
    cd "$VSCODE_DIR"
    npm run compile-check-ts-native
  )
else
  echo "No chrome-sensitive TS changes detected; skipping VS Code TypeScript check."
fi

if [ "$WITH_ASSETS" = true ]; then
  echo "Running CI asset parity check..."
  "$PROJECT_ROOT/scripts/test-ci-asset-parity.sh"
fi

echo "Fast chrome validation passed"
