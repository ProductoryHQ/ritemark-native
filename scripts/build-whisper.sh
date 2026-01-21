#!/bin/bash
set -e

# Build whisper.cpp binary for RiteMark voice dictation
# This script clones whisper.cpp, builds it with Metal support for arm64, and copies the binary
#
# IMPORTANT: This script forces arm64 architecture even when run from x86_64 tools
# This is necessary because some dev environments run CMake under Rosetta

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TEMP_DIR="/tmp/ritemark-whisper-build"
BINARY_DEST="$PROJECT_ROOT/extensions/ritemark/binaries/darwin-arm64"

echo "======================================"
echo "Building whisper.cpp for RiteMark"
echo "Target: darwin-arm64 (Apple Silicon)"
echo "======================================"
echo ""

# Check platform
if [[ "$OSTYPE" != "darwin"* ]]; then
  echo "Error: This script only supports macOS (darwin)"
  exit 1
fi

# Warn about architecture but continue (we force arm64 via cmake)
ARCH=$(uname -m)
if [[ "$ARCH" != "arm64" ]]; then
  echo "Note: Shell reports $ARCH but we'll cross-compile for arm64"
fi

# Check for cmake
if ! command -v cmake &> /dev/null; then
  echo "Error: cmake not found. Install with: brew install cmake"
  exit 1
fi

# Clean up previous build
if [ -d "$TEMP_DIR" ]; then
  echo "Cleaning up previous build..."
  rm -rf "$TEMP_DIR"
fi

# Create temp directory
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

# Clone whisper.cpp
echo ""
echo "Cloning whisper.cpp repository..."
git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp

# Build with Metal support, forcing arm64 architecture
echo ""
echo "Configuring whisper.cpp with arm64 + Metal GPU support..."
cmake -B build \
  -DCMAKE_OSX_ARCHITECTURES=arm64 \
  -DCMAKE_C_FLAGS="-mcpu=apple-m1" \
  -DCMAKE_CXX_FLAGS="-mcpu=apple-m1" \
  -DGGML_METAL=ON \
  -DGGML_NATIVE=OFF \
  -DCMAKE_BUILD_TYPE=Release

echo ""
echo "Building whisper.cpp (this may take 2-3 minutes)..."
cmake --build build --config Release -j$(sysctl -n hw.ncpu)

# Verify binary was created
WHISPER_BIN="./build/bin/whisper-cli"
if [ ! -f "$WHISPER_BIN" ]; then
  echo ""
  echo "Error: Build failed - binary not found at $WHISPER_BIN"
  exit 1
fi

# Verify architecture
BINARY_ARCH=$(file "$WHISPER_BIN" | grep -o 'arm64\|x86_64')
if [[ "$BINARY_ARCH" != "arm64" ]]; then
  echo ""
  echo "Error: Binary is $BINARY_ARCH but should be arm64"
  exit 1
fi

# Check binary size
BINARY_SIZE=$(du -h "$WHISPER_BIN" | cut -f1)
echo ""
echo "Build successful!"
echo "Binary: $WHISPER_BIN"
echo "Architecture: $BINARY_ARCH"
echo "Size: $BINARY_SIZE"

# Backup existing binaries if present
if [ -d "$BINARY_DEST" ] && [ "$(ls -A $BINARY_DEST 2>/dev/null)" ]; then
  BACKUP_DIR="${BINARY_DEST}.backup-$(date +%Y%m%d-%H%M%S)"
  echo ""
  echo "Backing up existing binaries to: $BACKUP_DIR"
  mv "$BINARY_DEST" "$BACKUP_DIR"
fi

# Create destination directory
mkdir -p "$BINARY_DEST"

# Copy binary
echo ""
echo "Installing binary to: $BINARY_DEST/"
cp "$WHISPER_BIN" "$BINARY_DEST/whisper-cli"
chmod +x "$BINARY_DEST/whisper-cli"

# Copy shared libraries with proper versioned names
echo "Copying shared libraries..."

# Find and copy libraries
copy_lib() {
  local name=$1
  local src=$(find ./build -name "lib${name}*.dylib" -type f | grep -v ".0.dylib$" | grep -v ".1.dylib$" | head -1)
  if [ -n "$src" ] && [ -f "$src" ]; then
    cp "$src" "$BINARY_DEST/lib${name}.dylib"
    # Create symlinks for versioned names
    ln -sf "lib${name}.dylib" "$BINARY_DEST/lib${name}.0.dylib"
    ln -sf "lib${name}.dylib" "$BINARY_DEST/lib${name}.1.dylib"
    echo "  - lib${name}.dylib ($(du -h "$src" | cut -f1))"
  else
    echo "  - WARNING: lib${name}.dylib not found"
  fi
}

copy_lib "whisper"
copy_lib "ggml"
copy_lib "ggml-base"
copy_lib "ggml-cpu"
copy_lib "ggml-metal"
copy_lib "ggml-blas"

# Verify installation
echo ""
echo "======================================"
echo "Installation complete!"
echo "======================================"
echo ""
echo "Contents of $BINARY_DEST:"
ls -lh "$BINARY_DEST/"
echo ""
echo "Total size: $(du -sh "$BINARY_DEST" | cut -f1)"
echo ""

# Verify binary runs
echo "Verifying binary..."
if DYLD_LIBRARY_PATH="$BINARY_DEST" "$BINARY_DEST/whisper-cli" --help > /dev/null 2>&1; then
  echo "Binary verified - runs successfully"
else
  echo "WARNING: Binary may have issues - test manually"
fi

# Clean up
echo ""
echo "Cleaning up build directory..."
rm -rf "$TEMP_DIR"

echo ""
echo "Done!"
echo ""
echo "Next steps:"
echo "1. Test: DYLD_LIBRARY_PATH='$BINARY_DEST' $BINARY_DEST/whisper-cli --help"
echo "2. Copy to production app if needed"
echo "3. Rebuild extension"
