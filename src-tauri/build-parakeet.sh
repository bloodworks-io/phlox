#!/bin/bash
# Build script for parakeet.cpp server (Omi Med STT backend)
# Compiles the patched parakeet.cpp OpenAI-compatible HTTP server as phlox-whisper-server.
#
# Use --debug to copy binaries to target/debug/ for development (tauri dev)

set -e

# Parse arguments
DEBUG_MODE=false
for arg in "$@"; do
    case $arg in
        --debug)
            DEBUG_MODE=true
            shift
            ;;
    esac
done

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARAKEET_DIR="$SCRIPT_DIR/parakeet.cpp"
PATCH="$SCRIPT_DIR/parakeet-cpp-omi-adapter.patch"

echo "Building parakeet.cpp server from: $PARAKEET_DIR"

if [ "$DEBUG_MODE" = true ]; then
    echo "Mode: DEBUG (for tauri dev)"
else
    echo "Mode: RELEASE (for production)"
fi

# Check if parakeet.cpp directory exists
if [ ! -d "$PARAKEET_DIR" ]; then
  echo "Error: parakeet.cpp directory not found at $PARAKEET_DIR"
  exit 1
fi

# Apply the Omi Med STT adapter patch if not already applied (idempotent).
# The patch adds omi_med_adapter to conformer.hpp; use it as an applied marker.
if ! grep -q "omi_med_adapter" "$PARAKEET_DIR/src/conformer.hpp" 2>/dev/null; then
  echo "Applying Omi Med STT adapter patch..."
  cd "$PARAKEET_DIR"
  if [ -d .git ]; then
    git apply "$PATCH"
  else
    patch -p1 --forward --no-backup-if-mismatch < "$PATCH"
  fi
  cd "$SCRIPT_DIR"
  echo "✅ Patch applied"
else
  echo "Omi Med STT adapter patch already applied, skipping"
fi

# Clean build directory to ensure fresh configuration
echo "Cleaning build directory..."
rm -rf "$PARAKEET_DIR/build"

# Configure with CMake - build parakeet-server (OpenAI-compatible HTTP server)
# Enable Metal support for macOS with GPU acceleration.
# GGML_METAL_EMBED_LIBRARY bakes default.metallib into the binary (defaults to ${GGML_METAL}).
# BUILD_SHARED_LIBS=OFF statically links ggml for a standalone distributable binary.
echo "Configuring parakeet.cpp build with Metal support..."
cmake -S "$PARAKEET_DIR" -B "$PARAKEET_DIR/build" \
  -DCMAKE_BUILD_TYPE=Release \
  -DBUILD_SHARED_LIBS=OFF \
  -DPARAKEET_BUILD_SERVER=ON \
  -DPARAKEET_BUILD_CLI=OFF \
  -DPARAKEET_BUILD_TESTS=OFF \
  -DPARAKEET_GGML_METAL=ON

# Build the parakeet-server binary
echo "Building parakeet-server binary..."
cmake --build "$PARAKEET_DIR/build" --target parakeet-server -j$(sysctl -n hw.ncpu)

echo "Fixing rpath in parakeet-server..."
SERVER_BIN="$PARAKEET_DIR/build/examples/server/parakeet-server"
if [ -f "$SERVER_BIN" ]; then
    cp "$SERVER_BIN" "$SCRIPT_DIR/phlox-whisper-server"
    chmod +x "$SCRIPT_DIR/phlox-whisper-server"
    install_name_tool -delete_rpath "$PARAKEET_DIR/build/src" "$SCRIPT_DIR/phlox-whisper-server" 2>/dev/null || true
    install_name_tool -delete_rpath "$PARAKEET_DIR/build/ggml" "$SCRIPT_DIR/phlox-whisper-server" 2>/dev/null || true
    echo "phlox-whisper-server binary built successfully at: $SCRIPT_DIR/phlox-whisper-server"
    echo "Checking for remaining rpath entries:"
    otool -L "$SCRIPT_DIR/phlox-whisper-server" | grep "@rpath" || echo "✓ No problematic rpath entries"

    # Check for Homebrew dependencies (should not have any)
    if otool -L "$SCRIPT_DIR/phlox-whisper-server" | grep -q "/opt/homebrew\|/usr/local/opt"; then
        echo "❌ ERROR: Binary contains Homebrew dependencies!"
        otool -L "$SCRIPT_DIR/phlox-whisper-server" | grep "/opt/homebrew\|/usr/local/opt"
        exit 1
    fi
    echo "✓ No Homebrew dependencies found"
else
    echo "Error: parakeet-server binary not found after build"
    echo "Looking in: $PARAKEET_DIR/build/examples/server"
    ls -la "$PARAKEET_DIR/build/examples/server/" 2>/dev/null || echo "examples/server/ directory not found"
    exit 1
fi

# Sign binary if on macOS with signing identity (release builds only)
if [[ "$OSTYPE" == "darwin"* ]] && [ "$DEBUG_MODE" != true ]; then
    # Support both APPLE_SIGNING_IDENTITY (Tauri convention) and SIGNING_IDENTITY
    SIGNING_IDENTITY="${APPLE_SIGNING_IDENTITY:-${SIGNING_IDENTITY:-$(security find-identity -v -p codesigning 2>/dev/null | grep "Developer ID Application" | head -1 | sed 's/.*"\(.*\)".*/\1/')}}"

    if [ -n "$SIGNING_IDENTITY" ]; then
        echo "Signing phlox-whisper-server with: $SIGNING_IDENTITY"
        codesign --force --options runtime --timestamp \
            --sign "$SIGNING_IDENTITY" \
            "$SCRIPT_DIR/phlox-whisper-server"
        echo "✅ phlox-whisper-server signed"
    fi
fi

# In debug mode, also copy to target/debug for dev mode (tauri dev)
if [ "$DEBUG_MODE" = true ]; then
    echo "Copying to target/debug for development..."
    mkdir -p "$SCRIPT_DIR/target/debug"
    cp "$SCRIPT_DIR/phlox-whisper-server" "$SCRIPT_DIR/target/debug/phlox-whisper-server"
    chmod +x "$SCRIPT_DIR/target/debug/phlox-whisper-server"
    echo "✅ Copied to target/debug/phlox-whisper-server"
fi
