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

PARAKEET_PINNED_SHA="e8acc6172a94e20a952cf1843decace5d771a94b"

if [ ! -d "$PARAKEET_DIR" ]; then
  echo "parakeet.cpp not found. Cloning at pinned SHA $PARAKEET_PINNED_SHA..."
  git clone https://github.com/mudler/parakeet.cpp.git "$PARAKEET_DIR"
  cd "$PARAKEET_DIR"
  git checkout "$PARAKEET_PINNED_SHA"
  git submodule update --init --recursive
  git apply --recount "$PATCH"
  cd "$SCRIPT_DIR"
  echo "✅ parakeet.cpp cloned and patched"
elif ! grep -q "omi_med_adapter" "$PARAKEET_DIR/src/conformer.hpp" 2>/dev/null; then
  echo "parakeet.cpp present but not patched — applying Omi Med STT adapter patch..."
  cd "$PARAKEET_DIR"
  if [ -d .git ]; then
    git apply --recount "$PATCH"
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

# Detect platform-specific build settings before configuring
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS: Metal + embed Metallib into the binary for a standalone distributable.
    JOBS=$(sysctl -n hw.ncpu)
    CMAKE_BACKEND_FLAGS=(
        -DPARAKEET_GGML_METAL=ON
    )
    BACKEND_DESC="Metal"
else
    # Linux local dev: CPU-only.
    # Production Flatpak build re-enables Vulkan via CMake flags
    JOBS=$(nproc)
    CMAKE_BACKEND_FLAGS=(
        -DGGML_NATIVE=OFF
    )
    BACKEND_DESC="CPU"
fi

# BUILD_SHARED_LIBS=OFF statically links ggml for a standalone distributable binary.
echo "Configuring parakeet.cpp build with $BACKEND_DESC support..."
cmake -S "$PARAKEET_DIR" -B "$PARAKEET_DIR/build" \
  -DCMAKE_BUILD_TYPE=Release \
  "${CMAKE_BACKEND_FLAGS[@]}" \
  -DBUILD_SHARED_LIBS=OFF \
  -DPARAKEET_BUILD_SERVER=ON \
  -DPARAKEET_BUILD_CLI=OFF \
  -DPARAKEET_BUILD_TESTS=OFF

# Build the parakeet-server binary
echo "Building parakeet-server binary..."
cmake --build "$PARAKEET_DIR/build" --target parakeet-server -j"$JOBS"

echo "Fixing rpath in parakeet-server..."
SERVER_BIN="$PARAKEET_DIR/build/examples/server/parakeet-server"
if [ -f "$SERVER_BIN" ]; then
    cp "$SERVER_BIN" "$SCRIPT_DIR/phlox-whisper-server"
    chmod +x "$SCRIPT_DIR/phlox-whisper-server"

    if [[ "$OSTYPE" == "darwin"* ]]; then
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
        # Linux: strip build-tree rpath entries so the AppImage bundles clean deps
        patchelf --remove-rpath "$SCRIPT_DIR/phlox-whisper-server" 2>/dev/null || true
        echo "phlox-whisper-server binary built successfully at: $SCRIPT_DIR/phlox-whisper-server"
        echo "Linked libraries:"
        ldd "$SCRIPT_DIR/phlox-whisper-server" || echo "(static build, no dynamic libs)"

        if ldd "$SCRIPT_DIR/phlox-whisper-server" 2>/dev/null | grep -qE "/usr/local/|/opt/"; then
            echo "❌ ERROR: Binary links against non-system paths (would break AppImage portability)!"
            ldd "$SCRIPT_DIR/phlox-whisper-server" | grep -E "/usr/local/|/opt/"
            exit 1
        fi
        echo "✓ No non-system library dependencies"
    fi
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
