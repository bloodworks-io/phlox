#!/bin/bash
# Build script for llama.cpp server
# This script compiles the llama.cpp HTTP server as a standalone binary
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
LLAMA_DIR="$SCRIPT_DIR/llama.cpp"

echo "Building llama.cpp server from: $LLAMA_DIR"

if [ "$DEBUG_MODE" = true ]; then
    echo "Mode: DEBUG (for tauri dev)"
else
    echo "Mode: RELEASE (for production)"
fi

# Check if llama.cpp directory exists
if [ ! -d "$LLAMA_DIR" ]; then
  echo "llama.cpp directory not found. Cloning llama.cpp repository..."
  git clone --depth 1 https://github.com/ggerganov/llama.cpp.git "$LLAMA_DIR"
  echo "llama.cpp cloned successfully"
fi

# Clean build directory to ensure fresh configuration
echo "Cleaning build directory..."
rm -rf "$LLAMA_DIR/build"

# Create build directory
mkdir -p "$LLAMA_DIR/build"
cd "$LLAMA_DIR/build"

# Configure with CMake - build llama-server
# Enable Metal support for macOS with GPU acceleration
# LLAMA_ACCELERATE: Enable Accelerate framework for CPU inference
echo "Configuring llama.cpp build with Metal support (static libs)..."
cmake .. \
  -DCMAKE_BUILD_TYPE=Release \
  -DLLAMA_METAL=ON \
  -DLLAMA_ACCELERATE=ON \
  -DLLAMA_ALL_WARNINGS=OFF \
  -DBUILD_SHARED_LIBS=OFF \
  -DLLAMA_CURL=OFF

# Build the llama-server binary
echo "Building llama-server binary..."
cmake --build . --target llama-server -j$(sysctl -n hw.ncpu)

echo "Fixing rpath in llama-server..."
if [ -f "bin/llama-server" ]; then
    cp bin/llama-server "$SCRIPT_DIR/llama-server"
    chmod +x "$SCRIPT_DIR/llama-server"
    install_name_tool -delete_rpath "$LLAMA_DIR/build/src" "$SCRIPT_DIR/llama-server" 2>/dev/null || true
    install_name_tool -delete_rpath "$LLAMA_DIR/build/ggml" "$SCRIPT_DIR/llama-server" 2>/dev/null || true
    echo "llama-server binary built successfully at: $SCRIPT_DIR/llama-server"
    echo "Checking for remaining rpath entries:"
    otool -L "$SCRIPT_DIR/llama-server" | grep "@rpath" || echo "✓ No problematic rpath entries"
else
    echo "Error: llama-server binary not found after build"
    echo "Looking in: $(pwd)"
    echo "Contents of bin/:"
    ls -la bin/ || echo "bin/ directory not found"
    exit 1
fi

# Sign binary if on macOS with signing identity (release builds only)
if [[ "$OSTYPE" == "darwin"* ]] && [ "$DEBUG_MODE" != true ]; then
    # Support both APPLE_SIGNING_IDENTITY (Tauri convention) and SIGNING_IDENTITY
    SIGNING_IDENTITY="${APPLE_SIGNING_IDENTITY:-${SIGNING_IDENTITY:-$(security find-identity -v -p codesigning 2>/dev/null | grep "Developer ID Application" | head -1 | sed 's/.*"\(.*\)".*/\1/')}}"

    if [ -n "$SIGNING_IDENTITY" ]; then
        echo "Signing llama-server with: $SIGNING_IDENTITY"
        codesign --force --options runtime --timestamp \
            --sign "$SIGNING_IDENTITY" \
            "$SCRIPT_DIR/llama-server"
        echo "✅ llama-server signed"
    fi
fi

# In debug mode, also copy to target/debug for dev mode (tauri dev)
if [ "$DEBUG_MODE" = true ]; then
    echo "Copying to target/debug for development..."
    mkdir -p "$SCRIPT_DIR/target/debug"
    cp "$SCRIPT_DIR/llama-server" "$SCRIPT_DIR/target/debug/llama-server"
    chmod +x "$SCRIPT_DIR/target/debug/llama-server"
    echo "✅ Copied to target/debug/llama-server"
fi
