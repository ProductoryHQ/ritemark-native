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
  darwin-arm64|darwin-x64|win32-x64)
    ;;
  *)
    echo -e "${RED}ERROR: Invalid target '$TARGET'${NC}"
    echo "Supported targets: darwin-arm64 (default), darwin-x64, win32-x64"
    echo ""
    echo "Usage:"
    echo "  ./scripts/validate-build-output.sh              # Apple Silicon (default)"
    echo "  ./scripts/validate-build-output.sh darwin-x64   # Intel Mac"
    echo "  ./scripts/validate-build-output.sh win32-x64    # Windows x64"
    exit 1
    ;;
esac

# ---------------------------------------------------------------------------
# Portable file-size + python interpreter resolution
# ---------------------------------------------------------------------------
# `validate-build-output.sh win32-x64` runs on macOS for cross-host pre-flight
# (e.g. before invoking ISCC.exe locally) AND on Windows runners reusing this
# script. macOS `stat` uses BSD flags (`-f%z`); GNU stat on Git Bash uses
# `-c%s`. Codex review on PR #57: hard-coded `stat -f%z` returned 0 on
# Windows and the size gates failed on perfectly valid build outputs. Same
# for `python3` — Windows often only has `python` on PATH.
file_size() {
  local f="$1"
  local s
  s=$(stat -f%z "$f" 2>/dev/null) || s=$(stat -c%s "$f" 2>/dev/null) || s=$(wc -c < "$f" 2>/dev/null | tr -d ' ')
  echo "${s:-0}"
}

PYTHON=""
for py in python3 python; do
  if command -v "$py" >/dev/null 2>&1; then
    PYTHON="$py"
    break
  fi
done

echo "========================================"
echo "Post-Build Output Validation"
echo "========================================"
echo "Target: $TARGET"
echo ""

# Layout differs per platform: macOS ships a .app bundle, Windows ships a flat
# directory tree from VSCode-win32-x64/.
case "$TARGET" in
  darwin-arm64|darwin-x64)
    APP_PATH="VSCode-$TARGET/Ritemark.app"
    EXT_PATH="$APP_PATH/Contents/Resources/app/extensions/ritemark"
    ;;
  win32-x64)
    APP_PATH="VSCode-win32-x64"
    EXT_PATH="$APP_PATH/resources/app/extensions/ritemark"
    ;;
esac

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

  local size
  size=$(file_size "$file")

  if [[ $size -lt $min_size ]]; then
    echo -e "${RED}FAIL${NC}"
    echo "  File too small: ${size} bytes (need >$min_size)"
    echo "  This indicates the extension wasn't properly copied."
    ERRORS=$((ERRORS + 1))
  else
    echo -e "${GREEN}OK${NC} (${size} bytes)"
  fi
}

# Sprint 92: assert a bundle actually contains expected code (not just non-empty).
# Guards the "0-byte / broken bundle passes because the file exists" class (#108-adjacent):
# a bundle can be large yet missing a module if esbuild silently dropped it.
check_content() {
  local file=$1
  local needle=$2
  local name=$3

  echo -n "Checking $name... "
  if [[ ! -f "$file" ]]; then
    echo -e "${RED}FAIL${NC}"
    echo "  File not found: $file"
    ERRORS=$((ERRORS + 1))
    return
  fi
  if grep -q -- "$needle" "$file"; then
    echo -e "${GREEN}OK${NC} (found '$needle')"
  else
    echo -e "${RED}FAIL${NC}"
    echo "  Bundle is missing '$needle' — esbuild may have dropped a module, or the bundle is broken."
    ERRORS=$((ERRORS + 1))
  fi
}

# Only check these if extension directory exists
if [[ -d "$EXT_PATH" ]]; then
  check_file_size "$EXT_PATH/media/webview.js" 500000 "webview.js"
  # Sprint 92: the extension host is now a single esbuild bundle (out/extension.js,
  # ~5MB with inlined deps) — not ~130 loose files. The floor reflects the bundled
  # size so a tiny/0-byte extension.js (the v1.7.1 0-byte-tsc-trap class) fails here.
  check_file_size "$EXT_PATH/out/extension.js" 1000000 "extension.js (bundle)"
  # browserMcpAdapter is its own small standalone bundle (spawned subprocess).
  check_file_size "$EXT_PATH/out/browser/browserMcpAdapter.js" 1000 "browserMcpAdapter.js (subprocess bundle)"
  # ritemarkEditor.js no longer exists standalone — assert its code is INSIDE the bundle
  # (esbuild does not minify/mangle, so the method name survives verbatim).
  check_content "$EXT_PATH/out/extension.js" "resolveCustomTextEditor" "extension.js contains editor code"
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

# Map target → manifest platform/arch + on-disk agent dir.
case "$TARGET" in
  darwin-arm64|darwin-x64)
    MANIFEST_PLATFORM="darwin"
    MANIFEST_ARCH="${TARGET#darwin-}"
    ;;
  win32-x64)
    MANIFEST_PLATFORM="win32"
    MANIFEST_ARCH="x64"
    ;;
esac
MANIFEST="$EXT_PATH/binaries/agents/manifest.json"
AGENTS_IN_APP="$EXT_PATH/binaries/agents/${MANIFEST_PLATFORM}-${MANIFEST_ARCH}"

if [[ ! -f "$MANIFEST" ]]; then
  echo -e "  ${RED}FAIL${NC}: manifest.json missing at $MANIFEST"
  ERRORS=$((ERRORS + 1))
else
  # Emit one line per matching entry: installName|expectedFileArchPattern
  # NOTE: We do NOT execute the binary from inside the bundle here. macOS .app
  # bundles are codesigned later in the release flow; modifying any byte under
  # Resources invalidates the embedded signature, and Gatekeeper will SIGKILL
  # any binary we try to launch from a tampered bundle. Windows installers are
  # also signed downstream. The fetch script already runs the manifest
  # validationArgs smoke test on the source binary at fetch time — post-copy
  # bytes are byte-identical, so re-running adds no value and introduces
  # signing-stage fragility.
  if [[ -z "$PYTHON" ]]; then
    echo -e "  ${RED}FAIL${NC}: neither python3 nor python found in PATH (needed to parse manifest.json)"
    ERRORS=$((ERRORS + 1))
    PYTHON_FOR_PARSE=""
  else
    PYTHON_FOR_PARSE="$PYTHON"
  fi
  if [[ -n "$PYTHON_FOR_PARSE" ]]; then
  ENTRIES=$("$PYTHON_FOR_PARSE" -c "
import json
with open('$MANIFEST') as f:
    m = json.load(f)
for r in m['runtimes']:
    if r['platform'] == '$MANIFEST_PLATFORM' and r['arch'] == '$MANIFEST_ARCH':
        print(f\"{r['installName']}|{r['expectedFileArchPattern']}\")
")

  if [[ -z "$ENTRIES" ]]; then
    echo -e "  ${RED}FAIL${NC}: no manifest entries for ${MANIFEST_PLATFORM}-${MANIFEST_ARCH}"
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

      # Exec bit only meaningful on POSIX targets. fetch-agent-runtimes.sh
      # intentionally skips chmod +x for win32 .exe (Windows ignores exec bit).
      if [[ "$MANIFEST_PLATFORM" != "win32" ]] && [[ ! -x "$bin_path" ]]; then
        echo -e "${RED}FAIL${NC} (exec bit missing)"
        ERRORS=$((ERRORS + 1))
        continue
      fi

      file_out=$(file -b "$bin_path")
      arch_ok=false

      # Layer 1: exact substring match (fast path; preserves macOS behavior).
      if echo "$file_out" | grep -qF "$arch_pattern"; then
        arch_ok=true
      fi

      # Layer 2 (win32 only): file(1) output format varies across Windows
      # toolchains (MSYS/Git Bash, libmagic versions). Manifest pattern was
      # captured on one host; runners may emit reordered tokens like
      # "PE32+ executable for MS Windows 6.00 (console), x86-64, 7 sections".
      # Mirror fetch-agent-runtimes.sh: require both "PE32+" and "x86-64",
      # then confirm via the MZ magic bytes at offset 0.
      win32_fallback_used=false
      if [[ "$arch_ok" == false ]] && [[ "$MANIFEST_PLATFORM" == "win32" ]]; then
        if echo "$file_out" | grep -qF "PE32+" && echo "$file_out" | grep -qF "x86-64"; then
          magic=$(od -An -N2 -tx1 "$bin_path" 2>/dev/null | tr -d ' \n')
          if [[ "$magic" == "4d5a" ]]; then
            arch_ok=true
            win32_fallback_used=true
          fi
        fi
      fi

      if [[ "$arch_ok" == false ]]; then
        echo -e "${RED}FAIL${NC} (arch mismatch)"
        echo "    Expected pattern: $arch_pattern"
        echo "    Got:              $file_out"
        ERRORS=$((ERRORS + 1))
        continue
      fi

      if [[ "$win32_fallback_used" == true ]]; then
        echo -e "${GREEN}OK${NC} (PE32+/x86-64 tokens + MZ magic; file output: $file_out)"
      else
        echo -e "${GREEN}OK${NC} ($file_out)"
      fi
    done <<< "$ENTRIES"
  fi
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
# Check 7: Windows Code Signing Verification (win32 only, opt-in)
# -----------------------------------------------------------------------------
if [[ "$TARGET" == "win32-x64" ]]; then
  if [[ "${RITEMARK_SKIP_SIGNING_CHECK:-1}" == "1" ]]; then
    echo "Signing check: SKIPPED (RITEMARK_SKIP_SIGNING_CHECK=1, default)"
    echo "  Set RITEMARK_SKIP_SIGNING_CHECK=0 to enforce signature verification."
    echo ""
  else
    echo "Checking Authenticode signatures..."
    SIGNTOOL=$(find "/c/Program Files (x86)/Windows Kits/10/bin" -path "*/x64/signtool.exe" 2>/dev/null | sort -V | tail -1)
    if [[ -z "$SIGNTOOL" ]]; then
      echo -e "  ${YELLOW}WARN${NC}: signtool.exe not found — cannot verify signatures"
      WARNINGS=$((WARNINGS + 1))
    else
      SIGN_TARGETS=("$BUILD_DIR/Ritemark.exe")
      AGENTS_SIGN_DIR="$EXT_PATH/binaries/agents/win32-x64"
      if [[ -d "$AGENTS_SIGN_DIR" ]]; then
        for exe in "$AGENTS_SIGN_DIR"/*.exe; do
          [[ -f "$exe" ]] && SIGN_TARGETS+=("$exe")
        done
      fi

      for stgt in "${SIGN_TARGETS[@]}"; do
        echo -n "  $(basename "$stgt")... "
        if "$SIGNTOOL" verify /pa "$stgt" > /dev/null 2>&1; then
          echo -e "${GREEN}OK${NC} (signed)"
        else
          echo -e "${RED}FAIL${NC} (not signed or invalid signature)"
          ERRORS=$((ERRORS + 1))
        fi
      done
    fi
    echo ""
  fi
fi

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
