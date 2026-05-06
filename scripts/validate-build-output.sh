#!/bin/bash
# =============================================================================
# Ritemark Native - Post-Build Output Validation
# =============================================================================
# Run AFTER a production build to verify everything is correctly included.
# This catches issues that would only appear at runtime.
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse target argument
TARGET="${1:-darwin-arm64}"

case "$TARGET" in
  darwin-arm64|darwin-x64)
    ;;
  *)
    echo -e "${RED}ERROR: Invalid target '$TARGET'${NC}"
    echo "Supported targets: darwin-arm64 (default), darwin-x64"
    echo ""
    echo "Usage:"
    echo "  ./scripts/validate-build-output.sh              # Apple Silicon (default)"
    echo "  ./scripts/validate-build-output.sh darwin-x64   # Intel Mac"
    exit 1
    ;;
esac

echo "========================================"
echo "Post-Build Output Validation"
echo "========================================"
echo "Target: $TARGET"
echo ""

APP_PATH="VSCode-$TARGET/Ritemark.app"
EXT_PATH="$APP_PATH/Contents/Resources/app/extensions/ritemark"

ERRORS=0
WARNINGS=0

# -----------------------------------------------------------------------------
# Check 1: App Bundle Exists
# -----------------------------------------------------------------------------
echo -n "Checking app bundle exists... "

if [[ ! -d "$APP_PATH" ]]; then
  echo -e "${RED}FAIL${NC}"
  echo "  App not found at: $APP_PATH"
  echo "  The build may not have completed."
  exit 1
fi
echo -e "${GREEN}OK${NC}"

# -----------------------------------------------------------------------------
# Check 2: Extension Directory Exists
# -----------------------------------------------------------------------------
echo -n "Checking extension included... "

if [[ ! -d "$EXT_PATH" ]]; then
  echo -e "${RED}FAIL${NC}"
  echo "  Ritemark extension not found in production app."
  echo "  Path checked: $EXT_PATH"
  echo ""
  echo "  FIX: Copy extension to production app:"
  echo "  cp -R extensions/ritemark \"$EXT_PATH\""
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}OK${NC}"
fi

# -----------------------------------------------------------------------------
# Check 3: Critical Files with Size Validation
# -----------------------------------------------------------------------------
check_file_size() {
  local file=$1
  local min_size=$2
  local name=$3

  echo -n "Checking $name... "

  if [[ ! -f "$file" ]]; then
    echo -e "${RED}FAIL${NC}"
    echo "  File not found: $file"
    ERRORS=$((ERRORS + 1))
    return
  fi

  local size=$(stat -f%z "$file" 2>/dev/null || echo 0)

  if [[ $size -lt $min_size ]]; then
    echo -e "${RED}FAIL${NC}"
    echo "  File too small: ${size} bytes (need >$min_size)"
    echo "  This indicates the extension wasn't properly copied."
    ERRORS=$((ERRORS + 1))
  else
    echo -e "${GREEN}OK${NC} (${size} bytes)"
  fi
}

# Only check these if extension directory exists
if [[ -d "$EXT_PATH" ]]; then
  check_file_size "$EXT_PATH/media/webview.js" 500000 "webview.js"
  check_file_size "$EXT_PATH/out/extension.js" 1000 "extension.js"
  check_file_size "$EXT_PATH/out/ritemarkEditor.js" 1000 "ritemarkEditor.js"
  check_file_size "$EXT_PATH/package.json" 500 "package.json"
fi

# -----------------------------------------------------------------------------
# Check 4: Icon Theme Files
# -----------------------------------------------------------------------------
echo -n "Checking icon theme... "

if [[ -d "$EXT_PATH" ]]; then
  ICON_DIR="$EXT_PATH/fileicons/icons"
  ICON_COUNT=$(find "$ICON_DIR" -name "*.svg" -size +0 2>/dev/null | wc -l | tr -d ' ')

  if [[ $ICON_COUNT -lt 10 ]]; then
    echo -e "${RED}FAIL${NC}"
    echo "  Only $ICON_COUNT valid icon files found (expected 12+)"
    echo "  Icons may not display in Explorer."
    ERRORS=$((ERRORS + 1))
  else
    echo -e "${GREEN}OK${NC} ($ICON_COUNT icons)"
  fi

  # Check icon theme JSON
  THEME_JSON="$EXT_PATH/fileicons/ritemark-icon-theme.json"
  if [[ ! -s "$THEME_JSON" ]]; then
    echo -e "${YELLOW}WARN${NC}"
    echo "  Icon theme JSON missing or empty: $THEME_JSON"
    WARNINGS=$((WARNINGS + 1))
  fi
else
  echo -e "${YELLOW}SKIP${NC} (extension not found)"
fi

# -----------------------------------------------------------------------------
# Check 5: Bundled Agent Runtimes (manifest-driven)
# -----------------------------------------------------------------------------
echo ""
echo "Validating bundled agent runtimes..."

ARCH="${TARGET#darwin-}"
MANIFEST="$EXT_PATH/binaries/agents/manifest.json"
AGENTS_IN_APP="$EXT_PATH/binaries/agents/darwin-$ARCH"

if [[ ! -f "$MANIFEST" ]]; then
  echo -e "  ${RED}FAIL${NC}: manifest.json missing at $MANIFEST"
  ERRORS=$((ERRORS + 1))
else
  # Emit one line per matching entry: installName|expectedFileArchPattern
  # NOTE: We do NOT execute the binary from inside the .app here. The .app is
  # codesigned later in the release flow; modifying any byte under Resources
  # invalidates the embedded signature, and Gatekeeper will SIGKILL any binary
  # we try to launch from a tampered bundle. The fetch script already runs the
  # manifest validationArgs smoke test on the source binary at fetch time —
  # post-copy bytes are byte-identical, so re-running adds no value and
  # introduces signing-stage fragility.
  ENTRIES=$(python3 -c "
import json
with open('$MANIFEST') as f:
    m = json.load(f)
for r in m['runtimes']:
    if r['platform'] == 'darwin' and r['arch'] == '$ARCH':
        print(f\"{r['installName']}|{r['expectedFileArchPattern']}\")
")

  if [[ -z "$ENTRIES" ]]; then
    echo -e "  ${RED}FAIL${NC}: no manifest entries for darwin-$ARCH"
    ERRORS=$((ERRORS + 1))
  else
    while IFS='|' read -r install_name arch_pattern; do
      bin_path="$AGENTS_IN_APP/$install_name"
      echo -n "  Checking $install_name... "

      if [[ ! -f "$bin_path" ]]; then
        echo -e "${RED}FAIL${NC} (not in app bundle)"
        echo "    Expected: $bin_path"
        ERRORS=$((ERRORS + 1))
        continue
      fi

      if [[ ! -x "$bin_path" ]]; then
        echo -e "${RED}FAIL${NC} (exec bit missing)"
        ERRORS=$((ERRORS + 1))
        continue
      fi

      file_out=$(file -b "$bin_path")
      if ! echo "$file_out" | grep -qF "$arch_pattern"; then
        echo -e "${RED}FAIL${NC} (arch mismatch)"
        echo "    Expected pattern: $arch_pattern"
        echo "    Got:              $file_out"
        ERRORS=$((ERRORS + 1))
        continue
      fi

      echo -e "${GREEN}OK${NC} ($file_out)"
    done <<< "$ENTRIES"
  fi
fi
echo ""

# -----------------------------------------------------------------------------
# Check 6: App Launches (optional manual verification)
# -----------------------------------------------------------------------------
echo ""
echo "Manual verification recommended:"
echo "  open \"$APP_PATH\""
echo ""

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo "========================================"
if [[ $ERRORS -gt 0 ]]; then
  echo -e "${RED}VALIDATION FAILED${NC}"
  echo "$ERRORS error(s), $WARNINGS warning(s)"
  echo ""
  echo "The production build has issues."
  echo "Fix them before shipping."
  echo "========================================"
  exit 1
elif [[ $WARNINGS -gt 0 ]]; then
  echo -e "${YELLOW}VALIDATION PASSED WITH WARNINGS${NC}"
  echo "$WARNINGS warning(s)"
  echo ""
  echo "Build is usable but review warnings."
  echo "========================================"
  exit 0
else
  echo -e "${GREEN}VALIDATION PASSED${NC}"
  echo "Production build is ready!"
  echo "========================================"
  exit 0
fi
