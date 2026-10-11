#!/bin/bash
set -euo pipefail

# Build the whisper.cpp speech engine that ships in
# extensions/ritemark/binaries/<target>/ (voice dictation + Transcribe on-device).
#
# Sprint 129 (#133, #203):
# - pinned to one whisper.cpp commit (v1.8.3, the version Sprint 108 measured);
#   the earlier script cloned HEAD, so the shipped build's commit was unrecorded
# - one static whisper-cli per target: no dylibs beside it
# - minimum macOS 12.0, Ritemark's own floor (the 2026-01 build asked for 15.0).
#   Any call to an API newer than that fails the build, and ggml's BLAS backend is
#   off because Accelerate's new BLAS interface needs macOS 13.3. Matrix work runs
#   on Metal (Apple silicon) or ggml's own CPU kernels (Intel, as on Windows).
#
# .github/workflows/build-whisper.yml runs this on the matching runner and the
# contract test (scripts/qa/whisper-contract-test.mjs) on its output. Windows is
# scripts/build-whisper-windows.ps1. Release builds never compile whisper.
#
# Usage:
#   scripts/build-whisper.sh --target darwin-arm64|darwin-x64 [--source DIR] [--out DIR] [--info DIR]
#     --source  a whisper.cpp checkout at the pinned commit (CI); default: clone it
#     --out     where whisper-cli goes; default: extensions/ritemark/binaries/<target>
#     --info    also write build-info.json and SHA256SUMS there

WHISPER_CPP_REPO="https://github.com/ggml-org/whisper.cpp.git"
WHISPER_CPP_TAG="v1.8.3"
WHISPER_CPP_COMMIT="2eeeba56e9edd762b4b38467bab96c2517163158"
MACOS_MIN="12.0"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

TARGET=""
SOURCE=""
OUT=""
INFO=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    --source) SOURCE="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    --info) INFO="$2"; shift 2 ;;
    -h|--help) sed -n '3,24p' "$0"; exit 0 ;;
    *) echo "Error: unknown argument: $1" >&2; exit 2 ;;
  esac
done

AVAILABILITY_FLAGS="-Werror=unguarded-availability-new"

case "$TARGET" in
  darwin-arm64)
    ARCH_FLAGS=(
      -DCMAKE_OSX_ARCHITECTURES=arm64
      "-DCMAKE_C_FLAGS=-mcpu=apple-m1 $AVAILABILITY_FLAGS"
      "-DCMAKE_CXX_FLAGS=-mcpu=apple-m1 $AVAILABILITY_FLAGS"
      -DGGML_METAL=ON
      -DGGML_METAL_EMBED_LIBRARY=ON
    )
    EXPECT_ARCH="arm64"
    ;;
  darwin-x64)
    # Every Intel Mac that runs macOS 12 has AVX2. No Metal: Accelerate on the CPU.
    ARCH_FLAGS=(
      -DCMAKE_OSX_ARCHITECTURES=x86_64
      "-DCMAKE_C_FLAGS=$AVAILABILITY_FLAGS"
      "-DCMAKE_CXX_FLAGS=$AVAILABILITY_FLAGS"
      -DGGML_METAL=OFF
      -DGGML_AVX=ON -DGGML_AVX2=ON -DGGML_FMA=ON -DGGML_F16C=ON
    )
    EXPECT_ARCH="x86_64"
    ;;
  *)
    echo "Error: --target must be darwin-arm64 or darwin-x64" >&2
    exit 2
    ;;
esac

if [[ "$OSTYPE" != "darwin"* ]]; then
  echo "Error: macOS targets build on macOS (Windows: scripts/build-whisper-windows.ps1)" >&2
  exit 1
fi
command -v cmake >/dev/null || { echo "Error: cmake not found (brew install cmake)" >&2; exit 1; }

WORK="$(mktemp -d "${TMPDIR:-/tmp}/ritemark-whisper-build.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

if [[ -z "$SOURCE" ]]; then
  echo "Cloning whisper.cpp $WHISPER_CPP_TAG..."
  git clone --quiet --depth 1 --branch "$WHISPER_CPP_TAG" "$WHISPER_CPP_REPO" "$WORK/whisper.cpp"
  SOURCE="$WORK/whisper.cpp"
fi
HEAD_COMMIT="$(git -C "$SOURCE" rev-parse HEAD)"
if [[ "$HEAD_COMMIT" != "$WHISPER_CPP_COMMIT" ]]; then
  echo "Error: whisper.cpp source is at $HEAD_COMMIT, expected $WHISPER_CPP_COMMIT ($WHISPER_CPP_TAG)" >&2
  exit 1
fi

CMAKE_FLAGS=(
  -DCMAKE_BUILD_TYPE=Release
  -DCMAKE_OSX_DEPLOYMENT_TARGET="$MACOS_MIN"
  -DBUILD_SHARED_LIBS=OFF
  -DGGML_NATIVE=OFF
  -DGGML_BLAS=OFF
  -DWHISPER_BUILD_TESTS=OFF
  -DWHISPER_BUILD_SERVER=OFF
  "${ARCH_FLAGS[@]}"
)

echo "Building whisper-cli for $TARGET (whisper.cpp $WHISPER_CPP_TAG, macOS $MACOS_MIN+)..."
cmake -S "$SOURCE" -B "$WORK/build" "${CMAKE_FLAGS[@]}"
cmake --build "$WORK/build" --config Release --target whisper-cli -j "$(sysctl -n hw.ncpu)"

BIN="$WORK/build/bin/whisper-cli"
[[ -f "$BIN" ]] || { echo "Error: build produced no $BIN" >&2; exit 1; }

BINARY_ARCH="$(lipo -archs "$BIN")"
if [[ "$BINARY_ARCH" != "$EXPECT_ARCH" ]]; then
  echo "Error: whisper-cli is '$BINARY_ARCH', expected $EXPECT_ARCH" >&2
  exit 1
fi
NON_SYSTEM="$(otool -L "$BIN" | tail -n +2 | awk '{print $1}' | grep -v -E '^/usr/lib/|^/System/Library/' || true)"
if [[ -n "$NON_SYSTEM" ]]; then
  echo "Error: whisper-cli links libraries outside the OS:" >&2
  echo "$NON_SYSTEM" >&2
  exit 1
fi

if [[ -z "$OUT" ]]; then
  OUT="$PROJECT_ROOT/extensions/ritemark/binaries/$TARGET"
fi
if [[ -d "$OUT" ]] && [[ -n "$(ls -A "$OUT" 2>/dev/null)" ]]; then
  BACKUP="${TMPDIR:-/tmp}/ritemark-whisper-$TARGET.backup-$(date +%Y%m%d-%H%M%S)"
  echo "Moving the existing $OUT to $BACKUP"
  mv "$OUT" "$BACKUP"
fi
mkdir -p "$OUT"
cp "$BIN" "$OUT/whisper-cli"
chmod +x "$OUT/whisper-cli"

if [[ -n "$INFO" ]]; then
  mkdir -p "$INFO"
  (cd "$OUT" && shasum -a 256 whisper-cli) > "$INFO/SHA256SUMS"
  cat > "$INFO/build-info.json" <<EOF
{
  "target": "$TARGET",
  "whisperCpp": { "tag": "$WHISPER_CPP_TAG", "commit": "$WHISPER_CPP_COMMIT" },
  "cmakeFlags": "$(printf '%s ' "${CMAKE_FLAGS[@]}" | sed 's/ $//')",
  "cmake": "$(cmake --version | head -1)",
  "compiler": "$(cc --version | head -1)",
  "macosMin": "$MACOS_MIN",
  "runId": "${GITHUB_RUN_ID:-local}"
}
EOF
fi

echo "Done: $OUT/whisper-cli ($(du -h "$OUT/whisper-cli" | cut -f1), $BINARY_ARCH)"
