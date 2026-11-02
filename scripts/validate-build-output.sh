#!/bin/bash
# =============================================================================
# Ritemark Native - Post-Build Output Validation
# =============================================================================
# Run AFTER a production build to verify everything is correctly included.
# This catches issues that would only appear at runtime.
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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

file_sha256() {
  local f="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$f" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$f" | awk '{print $1}'
  elif [[ -n "$PYTHON" ]]; then
    "$PYTHON" -c 'import hashlib,sys; print(hashlib.sha256(open(sys.argv[1], "rb").read()).hexdigest())' "$f"
  else
    return 1
  fi
}

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
    PROVENANCE_PATH="$APP_PATH/Contents/Resources/app/ritemark-build-provenance.json"
    ;;
  win32-x64)
    APP_PATH="VSCode-win32-x64"
    EXT_PATH="$APP_PATH/resources/app/extensions/ritemark"
    PROVENANCE_PATH="$APP_PATH/resources/app/ritemark-build-provenance.json"
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

echo -n "Checking build provenance... "
if [[ ! -s "$PROVENANCE_PATH" ]]; then
  echo -e "${RED}FAIL${NC}"
  echo "  Missing release provenance: $PROVENANCE_PATH"
  ERRORS=$((ERRORS + 1))
elif node ./scripts/build-provenance.mjs \
    --verify --target "$TARGET" --app "$APP_PATH" \
    ${RITEMARK_RELEASE_COMMIT:+--release-commit "$RITEMARK_RELEASE_COMMIT"} >/dev/null 2>&1; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${RED}FAIL${NC}"
  echo "  Embedded provenance does not match canonical source inputs."
  ERRORS=$((ERRORS + 1))
fi

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

  # Sprint 138 (#481, R13): equations. KaTeX's stylesheet and its 20 woff2 faces
  # live next to webview.js (loaded only when a document has math), and the Word
  # equation converter is an external module. All reach people only with an app
  # release; without them, equations show as their source and Word gets pictures.
  check_file_size "$EXT_PATH/media/katex/katex.min.css" 10000 "KaTeX stylesheet (media/katex)"
  check_file_size "$EXT_PATH/media/katex/LICENSE" 500 "KaTeX licence (media/katex)"
  check_file_size "$EXT_PATH/media/katex/OFL.txt" 4000 "KaTeX fonts' licence, SIL OFL 1.1 (media/katex)"
  echo -n "Checking KaTeX fonts (media/katex/fonts)... "
  KATEX_FACES=$(find "$EXT_PATH/media/katex/fonts" -name "*.woff2" -size +0 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$KATEX_FACES" -ne 20 ]]; then
    echo -e "${RED}FAIL${NC}"
    echo "  Found $KATEX_FACES woff2 faces, expected 20."
    ERRORS=$((ERRORS + 1))
  else
    echo -e "${GREEN}OK${NC} (20 faces)"
  fi
  check_content "$EXT_PATH/media/webview.js" "$(tr -d '[:space:]' < "$EXT_PATH/media/katex/VERSION" 2>/dev/null || echo katex-version-missing)" "webview.js holds the KaTeX of media/katex"
  check_file_size "$EXT_PATH/node_modules/mathml2omml/dist/index.js" 10000 "mathml2omml (Word equations)"
  check_file_size "$EXT_PATH/node_modules/mathml2omml/LICENSE" 5000 "mathml2omml licence (LGPL-3.0)"
  # The LGPL incorporates the GPL's terms; its text ships beside the extension (branding/ATTRIBUTION.md).
  check_file_size "$EXT_PATH/licenses/GPL-3.0.txt" 30000 "GPL-3.0 text, for mathml2omml's LGPL (licenses/)"
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
# Check 4b: The frame's manifest (Sprint 152, R1/R7)
# The shell draws Ritemark's frame from product.json's ritemarkFrame block at the
# first frame (patch 002's ritemarkFrame.ts); without it the frame draws as VS
# Code's and Sprint 145's fixes are undone, with nothing failing but a log line.
# -----------------------------------------------------------------------------
echo -n "Checking the frame's manifest... "
case "$TARGET" in
  darwin-arm64|darwin-x64) PRODUCT_JSON="$APP_PATH/Contents/Resources/app/product.json" ;;
  win32-x64) PRODUCT_JSON="$APP_PATH/resources/app/product.json" ;;
esac
if FRAME_SUMMARY=$(node -e '
const frame = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).ritemarkFrame;
const missing = ["places", "homePlace", "aiColumn", "permanentTabs", "deskFront", "welcome", "extension"].filter(key => !frame || frame[key] === undefined || (Array.isArray(frame[key]) && !frame[key].length));
if (missing.length) { console.log(frame ? "missing " + missing.join(", ") : "no ritemarkFrame block"); process.exit(1); }
console.log(frame.places.length + " places, " + frame.permanentTabs.length + " permanent tabs");
' "$PRODUCT_JSON" 2>&1); then
  echo -e "${GREEN}OK${NC} ($FRAME_SUMMARY)"
else
  echo -e "${RED}FAIL${NC}"
  echo "  $PRODUCT_JSON: $FRAME_SUMMARY"
  echo "  FIX: the build copies branding/product.json, which holds the ritemarkFrame block"
  ERRORS=$((ERRORS + 1))
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
  # Expand schema-v3 source rows into one line per installed package file.
  # NOTE: We do NOT execute the binary from inside the bundle here. macOS .app
  # bundles are codesigned later in the release flow; modifying any byte under
  # Resources invalidates the embedded signature, and Gatekeeper will SIGKILL
  # any binary we try to launch from a tampered bundle. Windows installers are
  # also signed downstream. The fetch script already runs the manifest
  # validationArgs smoke test on the source binary at fetch time — post-copy
  # bytes are byte-identical, so re-running adds no value and introduces
  # signing-stage fragility.
  if ! command -v node >/dev/null 2>&1; then
    echo -e "  ${RED}FAIL${NC}: node is missing from PATH (needed to parse manifest.json)"
    ERRORS=$((ERRORS + 1))
    NODE_FOR_PARSE=""
  else
    NODE_FOR_PARSE="node"
  fi
  if [[ -n "$NODE_FOR_PARSE" ]]; then
  ENTRIES=$(node "$SCRIPT_DIR/list-agent-runtime-files.mjs" "$MANIFEST" "$MANIFEST_PLATFORM" "$MANIFEST_ARCH" --records)

  if [[ -z "$ENTRIES" ]]; then
    echo -e "  ${RED}FAIL${NC}: no manifest entries for ${MANIFEST_PLATFORM}-${MANIFEST_ARCH}"
    ERRORS=$((ERRORS + 1))
  else
    while IFS='|' read -r install_path arch_pattern executable expected_sha; do
      bin_path="$AGENTS_IN_APP/$install_path"
      echo -n "  Checking $install_path... "

      if [[ ! -f "$bin_path" ]]; then
        echo -e "${RED}FAIL${NC} (not in app bundle)"
        echo "    Expected: $bin_path"
        ERRORS=$((ERRORS + 1))
        continue
      fi

      # Exec bit only meaningful on POSIX targets. fetch-agent-runtimes.sh
      # intentionally skips chmod +x for win32 .exe (Windows ignores exec bit).
      if [[ "$executable" == "1" ]] && [[ "$MANIFEST_PLATFORM" != "win32" ]] && [[ ! -x "$bin_path" ]]; then
        echo -e "${RED}FAIL${NC} (exec bit missing)"
        ERRORS=$((ERRORS + 1))
        continue
      fi

      actual_sha=$(file_sha256 "$bin_path" || true)
      signed_windows_executable=false
      if [[ "$MANIFEST_PLATFORM" == "win32" ]] && [[ "$executable" == "1" ]] && [[ "${RITEMARK_RUNTIME_FILES_SIGNED:-0}" == "1" ]]; then
        signed_windows_executable=true
      fi
      if [[ "$actual_sha" != "$expected_sha" ]] && [[ "$signed_windows_executable" == false ]]; then
        echo -e "${RED}FAIL${NC} (SHA-256 mismatch)"
        echo "    Expected: $expected_sha"
        echo "    Got:      ${actual_sha:-<unavailable>}"
        ERRORS=$((ERRORS + 1))
        continue
      fi
      if [[ ! -f "$bin_path.sha256" ]] || ! grep -qF "$expected_sha" "$bin_path.sha256"; then
        echo -e "${RED}FAIL${NC} (SHA-256 sidecar missing or stale)"
        ERRORS=$((ERRORS + 1))
        continue
      fi

      if [[ "$executable" != "1" ]]; then
        echo -e "${GREEN}OK${NC} (metadata; SHA-256 verified)"
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

      if [[ "$signed_windows_executable" == true ]]; then
        echo -e "${GREEN}OK${NC} (signed PE; unsigned SHA-256 retained in sidecar; $file_out)"
      elif [[ "$win32_fallback_used" == true ]]; then
        echo -e "${GREEN}OK${NC} (PE32+/x86-64 tokens + MZ magic; file output: $file_out)"
      else
        echo -e "${GREEN}OK${NC} ($file_out)"
      fi
    done <<< "$ENTRIES"

    expected_tree=$(node "$SCRIPT_DIR/list-agent-runtime-files.mjs" "$MANIFEST" "$MANIFEST_PLATFORM" "$MANIFEST_ARCH" --paths-with-sidecars | sort)
    actual_tree=$(cd "$AGENTS_IN_APP" && find . -type f -print | sed 's#^\./##' | sort)
    if [[ "$actual_tree" != "$expected_tree" ]]; then
      echo -e "  ${RED}FAIL${NC}: installed runtime tree differs from the approved manifest"
      diff <(printf '%s\n' "$expected_tree") <(printf '%s\n' "$actual_tree") || true
      ERRORS=$((ERRORS + 1))
    fi
  fi
  fi
fi
echo ""

# -----------------------------------------------------------------------------
# Check 5b: Whisper speech engine (Sprint 129, manifest-driven)
#
# extensions/ritemark/binaries/<target>/ is built by .github/workflows/build-whisper.yml
# and committed; binaries/whisper-manifest.json records every file's SHA-256.
# Hashes are compared only before signing (signing rewrites PE and Mach-O files);
# after it, RITEMARK_RUNTIME_FILES_SIGNED=1 leaves presence and architecture.
# -----------------------------------------------------------------------------
echo ""
echo "Validating the whisper speech engine..."

pe_machine() {
  # PE header: offset at 0x3c, machine type two bytes after the "PE\0\0" signature.
  local f="$1" off
  off=$(od -An -tu4 -j60 -N4 "$f" 2>/dev/null | tr -d ' ')
  [[ -n "$off" ]] || return 1
  od -An -tx2 -j$((off + 4)) -N2 "$f" 2>/dev/null | tr -d ' '
}

WHISPER_MANIFEST="$EXT_PATH/binaries/whisper-manifest.json"
WHISPER_DIR="$EXT_PATH/binaries/$TARGET"
if [[ ! -f "$WHISPER_MANIFEST" ]]; then
  echo -e "  ${RED}FAIL${NC}: whisper-manifest.json missing at $WHISPER_MANIFEST"
  ERRORS=$((ERRORS + 1))
elif [[ -z "$PYTHON" ]]; then
  echo -e "  ${RED}FAIL${NC}: python is needed to read $WHISPER_MANIFEST"
  ERRORS=$((ERRORS + 1))
else
  whisper_rows=$("$PYTHON" -c '
import json, sys
target = json.load(open(sys.argv[1]))["targets"].get(sys.argv[2])
if not target:
    sys.exit(3)
for f in target["files"]:
    print(f["path"] + "\t" + f["sha256"])
' "$WHISPER_MANIFEST" "$TARGET") || {
    echo -e "  ${RED}FAIL${NC}: whisper-manifest.json has no entry for $TARGET"
    ERRORS=$((ERRORS + 1))
    whisper_rows=""
  }
  while IFS=$'\t' read -r rel expected_sha; do
    # Windows Python prints CRLF and Git Bash keeps the \r on every row but the
    # last, so each hash compared unequal to an identical one (v1.14.0 CI).
    expected_sha="${expected_sha%$'\r'}"
    [[ -z "$rel" ]] && continue
    file_path="$WHISPER_DIR/$rel"
    printf "  %-40s " "$TARGET/$rel"
    if [[ ! -f "$file_path" ]]; then
      echo -e "${RED}FAIL${NC} (missing)"
      ERRORS=$((ERRORS + 1))
      continue
    fi
    if [[ "${RITEMARK_RUNTIME_FILES_SIGNED:-0}" != "1" ]]; then
      actual_sha=$(file_sha256 "$file_path" || true)
      if [[ "$actual_sha" != "$expected_sha" ]]; then
        echo -e "${RED}FAIL${NC} (SHA-256 differs from whisper-manifest.json)"
        echo "    Expected: $expected_sha"
        echo "    Got:      ${actual_sha:-<unavailable>}"
        ERRORS=$((ERRORS + 1))
        continue
      fi
    fi
    case "$TARGET" in
      win32-x64)
        machine=$(pe_machine "$file_path" || true)
        if [[ "$machine" != "8664" ]]; then
          echo -e "${RED}FAIL${NC} (not an x64 PE file: ${machine:-unreadable})"
          ERRORS=$((ERRORS + 1))
          continue
        fi
        ;;
      darwin-arm64|darwin-x64)
        want_arch="arm64"; [[ "$TARGET" == "darwin-x64" ]] && want_arch="x86_64"
        if [[ "$rel" == "whisper-cli" ]] && [[ ! -x "$file_path" ]]; then
          echo -e "${RED}FAIL${NC} (exec bit missing)"
          ERRORS=$((ERRORS + 1))
          continue
        fi
        if ! file -b "$file_path" | grep -q "$want_arch"; then
          echo -e "${RED}FAIL${NC} (not $want_arch: $(file -b "$file_path"))"
          ERRORS=$((ERRORS + 1))
          continue
        fi
        ;;
    esac
    echo -e "${GREEN}OK${NC}"
  done <<< "$whisper_rows"
fi

# Another platform's engine must never ride along (copy-extension-for-target.mjs filters it).
if [[ -d "$EXT_PATH/binaries" ]]; then
  for platform_dir in "$EXT_PATH"/binaries/*-*/; do
    [[ -d "$platform_dir" ]] || continue
    name=$(basename "$platform_dir")
    if [[ "$name" =~ ^(darwin|win32|linux)-(arm64|x64)$ ]] && [[ "$name" != "$TARGET" ]]; then
      echo -e "  ${RED}FAIL${NC}: foreign native folder binaries/$name in a $TARGET build"
      ERRORS=$((ERRORS + 1))
    fi
  done
fi

# A link to an absolute path points outside the app: it dangles on users'
# machines and fails codesign --verify --deep --strict (v1.14.0 RC).
abs_links=$(find "$EXT_PATH" -type l -lname '/*' 2>/dev/null)
if [[ -n "$abs_links" ]]; then
  first_link=${abs_links%%$'\n'*}
  echo -e "  ${RED}FAIL${NC}: $(wc -l <<< "$abs_links" | tr -d ' ') symlink(s) to absolute paths, e.g. ${first_link#"$EXT_PATH"/}"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# -----------------------------------------------------------------------------
# Check 5c: Every native module in the app has the target's architecture
#
# Sprint 135 (R4): VS Code's own .node files (node-pty, @parcel/watcher,
# @vscode/spdlog, native-keymap, the proxy resolver, ...) and every built-in
# extension's. A wrong one fails to dlopen at run time (issue #39): the
# terminal, file watching or logging die quietly. Another platform's payload
# whose path names it (prebuilds/<os>-<arch>/, darwin-x64, linux, win32) is a
# warning; any other mismatch fails.
# -----------------------------------------------------------------------------
echo ""
echo "Validating native modules in the app..."
case "$TARGET" in
  darwin-arm64|darwin-x64) APP_ROOT="$APP_PATH/Contents" ;;
  win32-x64) APP_ROOT="$APP_PATH" ;;
esac
native_ok=0
native_foreign=0
while IFS= read -r node_file; do
  rel="${node_file#"$APP_ROOT"/}"
  desc=$(file -b "$node_file" 2>/dev/null)
  matches=false
  case "$TARGET" in
    darwin-arm64) [[ "$desc" == *Mach-O* && "$desc" == *arm64* ]] && matches=true ;;
    darwin-x64) [[ "$desc" == *Mach-O* && "$desc" == *x86_64* ]] && matches=true ;;
    win32-x64) [[ "$(pe_machine "$node_file" || true)" == "8664" ]] && matches=true ;;
  esac
  if [[ "$matches" == true ]]; then
    native_ok=$((native_ok + 1))
  elif echo "$rel" | grep -Eq '(prebuilds/[^/]*-|darwin-x64|darwin-arm64|/x64/|/arm64/|x86_64|linux|win32|windows)'; then
    native_foreign=$((native_foreign + 1))
    echo -e "  ${YELLOW}WARN${NC}: another platform's native payload: $rel ($desc)"
    WARNINGS=$((WARNINGS + 1))
  else
    echo -e "  ${RED}FAIL${NC}: $rel is not a $TARGET native module ($desc)"
    ERRORS=$((ERRORS + 1))
  fi
done < <(find "$APP_ROOT" -name '*.node' -type f 2>/dev/null)
if [[ $native_ok -eq 0 ]]; then
  echo -e "  ${RED}FAIL${NC}: no $TARGET native module found in the app"
  ERRORS=$((ERRORS + 1))
else
  echo -e "  ${GREEN}OK${NC}: $native_ok native module(s) for $TARGET; $native_foreign other platforms' payload(s)"
fi
echo ""

# -----------------------------------------------------------------------------
# Check 5d: Ritemark's fonts are in the app and the workbench's CSS uses them
#
# Sprint 135: patch 001 no longer lists the fonts for packaging. From VS Code
# 1.142 the core is bundled by esbuild, which writes the fonts its CSS
# references to out/media/, and packaging takes the whole bundle output. If
# that ever stops, the icons (Phosphor) go blank and the UI font (Sofia Sans)
# falls back, and nothing else fails.
# -----------------------------------------------------------------------------
echo "Validating Ritemark's fonts in the app..."
case "$TARGET" in
  darwin-arm64|darwin-x64) APP_OUT="$APP_PATH/Contents/Resources/app/out" ;;
  win32-x64) APP_OUT="$APP_PATH/resources/app/out" ;;
esac
WORKBENCH_CSS=$(find "$APP_OUT/vs/workbench" -maxdepth 1 -name 'workbench.desktop.main.css' 2>/dev/null | head -1)
for font in phosphor.woff2 SofiaSans-latin.woff2 SofiaSans-latin-ext.woff2; do
  found=$(find "$APP_OUT" -name "$font" -type f -size +1k 2>/dev/null | head -1)
  if [[ -z "$found" ]]; then
    echo -e "  ${RED}FAIL${NC}: $font is not in the app's out/"
    ERRORS=$((ERRORS + 1))
  elif [[ -n "$WORKBENCH_CSS" ]] && ! grep -q "$font" "$WORKBENCH_CSS"; then
    echo -e "  ${RED}FAIL${NC}: the workbench's CSS does not reference $font"
    ERRORS=$((ERRORS + 1))
  else
    echo -e "  ${GREEN}OK${NC}: ${found#"$APP_OUT"/}"
  fi
done
if [[ -z "$WORKBENCH_CSS" ]]; then
  echo -e "  ${YELLOW}WARN${NC}: workbench.desktop.main.css not found; the fonts' use was not checked"
  WARNINGS=$((WARNINGS + 1))
fi
echo ""

# -----------------------------------------------------------------------------
# Check 5e: product.json names the build's commit
#
# Sprint 135 E5: from VS Code 1.142, packaging moves node modules into
# node_modules.asar, and the app reads them there only when product.json has a
# commit. Without one the window asks node_modules/ for xterm, vscode-textmate
# and vscode-oniguruma, so the terminal stays blank and code loses its colours,
# and nothing else fails. The commit is Ritemark's source commit
# (RITEMARK_SOURCE_COMMIT, set by every release build entry point; patch 004), so it
# must also be the build provenance's sourceCommit.
# -----------------------------------------------------------------------------
echo -n "Checking product.json's commit... "
case "$TARGET" in
  darwin-arm64|darwin-x64) APP_PRODUCT="$APP_PATH/Contents/Resources/app/product.json" ;;
  win32-x64) APP_PRODUCT="$APP_PATH/resources/app/product.json" ;;
esac
PRODUCT_COMMIT=$(sed -n 's/^[[:space:]]*"commit":[[:space:]]*"\([0-9a-fA-F]\{40\}\)".*/\1/p' "$APP_PRODUCT" 2>/dev/null | head -1 | tr 'A-F' 'a-f')
PROVENANCE_COMMIT=$(sed -n 's/.*"sourceCommit":[[:space:]]*"\([0-9a-fA-F]\{40\}\)".*/\1/p' "$PROVENANCE_PATH" 2>/dev/null | head -1 | tr 'A-F' 'a-f')
if [[ -z "$PRODUCT_COMMIT" ]]; then
  echo -e "${RED}FAIL${NC} (no 40-character commit in $APP_PRODUCT; set RITEMARK_SOURCE_COMMIT before gulp)"
  ERRORS=$((ERRORS + 1))
elif [[ -n "$PROVENANCE_COMMIT" && "$PRODUCT_COMMIT" != "$PROVENANCE_COMMIT" ]]; then
  echo -e "${RED}FAIL${NC} (${PRODUCT_COMMIT:0:12} is not the provenance's source commit ${PROVENANCE_COMMIT:0:12}; set RITEMARK_SOURCE_COMMIT before gulp)"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}OK${NC} (${PRODUCT_COMMIT:0:12})"
fi
echo ""

# -----------------------------------------------------------------------------
# Check 5f: the packaged Electron is the one vscode/.npmrc names
#
# Sprint 144 (R3, #515): patch 020 moves the pinned VS Code's Electron inside
# its line for security fixes. The build downloads the version in
# vscode/.npmrc's `target` and verifies it against build/checksums/electron.txt;
# this proves the app that comes out is that version, so a stale or skipped
# patch can't ship the old Electron silently. The macOS bundle names it in the
# Electron framework's Info.plist (CFBundleVersion). On Windows the Electron
# zip's `version` file is looked for at the app's root and one level down; a
# target where the app names no version says so, and About is read at Gate 2.
# -----------------------------------------------------------------------------
echo -n "Checking the packaged Electron... "
EXPECTED_ELECTRON=$(sed -n 's/^target="\(.*\)"$/\1/p' vscode/.npmrc 2>/dev/null | head -1)
PACKAGED_ELECTRON=""
ELECTRON_SOURCE=""
case "$TARGET" in
  darwin-arm64|darwin-x64)
    ELECTRON_PLIST="$APP_PATH/Contents/Frameworks/Electron Framework.framework/Versions/A/Resources/Info.plist"
    if [[ -f "$ELECTRON_PLIST" ]]; then
      PACKAGED_ELECTRON=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$ELECTRON_PLIST" 2>/dev/null || true)
      ELECTRON_SOURCE="Electron Framework's Info.plist"
    fi
    ;;
  win32-x64)
    for candidate in "$APP_PATH/version" "$APP_PATH"/*/version; do
      if [[ -f "$candidate" ]]; then
        PACKAGED_ELECTRON=$(tr -d '\r\n' < "$candidate")
        ELECTRON_SOURCE="${candidate#"$APP_PATH"/}"
        break
      fi
    done
    ;;
esac
PACKAGED_ELECTRON="${PACKAGED_ELECTRON#v}"
if [[ -z "$EXPECTED_ELECTRON" ]]; then
  echo -e "${YELLOW}WARN${NC} (vscode/.npmrc names no Electron target; not checked)"
  WARNINGS=$((WARNINGS + 1))
elif [[ -z "$PACKAGED_ELECTRON" ]]; then
  echo -e "${YELLOW}SKIPPED${NC} (the packaged app names no Electron version for $TARGET; read About at Gate 2: Electron $EXPECTED_ELECTRON)"
elif [[ "$PACKAGED_ELECTRON" != "$EXPECTED_ELECTRON" ]]; then
  echo -e "${RED}FAIL${NC} (the app carries Electron $PACKAGED_ELECTRON, from $ELECTRON_SOURCE; vscode/.npmrc names $EXPECTED_ELECTRON)"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}OK${NC} (Electron $PACKAGED_ELECTRON, from $ELECTRON_SOURCE)"
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
  if [[ "${RITEMARK_RUNTIME_FILES_SIGNED:-0}" == "1" ]] && [[ "${RITEMARK_SKIP_SIGNING_CHECK:-1}" != "0" ]]; then
    echo -e "${RED}FAIL${NC}: signed-runtime mode requires RITEMARK_SKIP_SIGNING_CHECK=0"
    ERRORS=$((ERRORS + 1))
  fi
  if [[ "${RITEMARK_SKIP_SIGNING_CHECK:-1}" == "1" ]]; then
    echo "Signing check: SKIPPED (RITEMARK_SKIP_SIGNING_CHECK=1, default)"
    echo "  Set RITEMARK_SKIP_SIGNING_CHECK=0 to enforce signature verification."
    echo ""
  else
    echo "Checking Authenticode signatures..."
    SIGNTOOL="${SIGNTOOL_PATH:-$(find "/c/Program Files (x86)/Windows Kits/10/bin" -path "*/x64/signtool.exe" 2>/dev/null | sort -V | tail -1)}"
    if [[ -z "$SIGNTOOL" ]]; then
      if [[ "${RITEMARK_RUNTIME_FILES_SIGNED:-0}" == "1" ]]; then
        echo -e "  ${RED}FAIL${NC}: signtool.exe not found — signed runtime files cannot be verified"
        ERRORS=$((ERRORS + 1))
      else
        echo -e "  ${YELLOW}WARN${NC}: signtool.exe not found — cannot verify signatures"
        WARNINGS=$((WARNINGS + 1))
      fi
    else
      SIGN_TARGETS=("$APP_PATH/Ritemark.exe")
      AGENTS_SIGN_DIR="$EXT_PATH/binaries/agents/win32-x64"
      if [[ -d "$AGENTS_SIGN_DIR" ]]; then
        while IFS= read -r -d '' exe; do SIGN_TARGETS+=("$exe"); done < <(find "$AGENTS_SIGN_DIR" -type f -name '*.exe' -print0)
      fi

      # `/all` matters and its absence cost a release: verify-windows-signatures.ps1
      # verifies the same files with `verify /pa /all` and passes, while `/pa`
      # alone reported every executable as unsigned. Two implementations of one
      # check, drifting apart — the same shape as the v1.6.3 file(1) incident.
      #
      # The output is no longer discarded either. Swallowing signtool's stderr
      # turned a specific, fixable complaint into "not signed or invalid
      # signature", which is indistinguishable from an actual unsigned binary
      # and sent the v1.11.0 Windows build round a second diagnosis cycle.
      for stgt in "${SIGN_TARGETS[@]}"; do
        echo -n "  $(basename "$stgt")... "
        # MSYS_NO_PATHCONV is not optional here. Under Git Bash the runner
        # rewrites any argument that looks like a POSIX path, so `/pa` and
        # `/all` arrived as C:/Program Files/Git/pa and .../all — signtool then
        # reported "File not found" for both and, with the policy flag eaten,
        # fell back to the stricter driver policy and rejected the Azure
        # Trusted Signing chain. Every executable therefore read as unsigned
        # while being correctly signed. The release skill's cross-platform
        # catalogue names this exact hazard; the repo had never applied it.
        if SIGN_OUTPUT="$(MSYS_NO_PATHCONV=1 "$SIGNTOOL" verify /pa /all "$stgt" 2>&1)"; then
          echo -e "${GREEN}OK${NC} (signed)"
        else
          echo -e "${RED}FAIL${NC} (not signed or invalid signature)"
          echo "$SIGN_OUTPUT" | sed 's/^/      /'
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
