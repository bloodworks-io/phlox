#!/bin/bash
# Build script for whisper.cpp server
# This script compiles the whisper.cpp HTTP server example as a standalone binary
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
WHISPER_DIR="$SCRIPT_DIR/whisper.cpp"

echo "Building whisper.cpp server from: $WHISPER_DIR"

if [ "$DEBUG_MODE" = true ]; then
    echo "Mode: DEBUG (for tauri dev)"
else
    echo "Mode: RELEASE (for production)"
fi

# Check if whisper.cpp directory exists
if [ ! -d "$WHISPER_DIR" ]; then
  echo "Error: whisper.cpp directory not found at $WHISPER_DIR"
  exit 1
fi

# Clean build directory to ensure fresh configuration
echo "Cleaning build directory..."
rm -rf "$WHISPER_DIR/build"

# Create build directory
mkdir -p "$WHISPER_DIR/build"
cd "$WHISPER_DIR/build"

# Configure with CMake - build all examples (including server)
# Enable Core ML support for macOS with Neural Engine acceleration
# WHISPER_COREML_ALLOW_FALLBACK allows Metal-only operation if .mlmodelc files are missing
echo "Configuring whisper.cpp build with Core ML support (no ffmpeg, static libs)..."
cmake .. -DCMAKE_BUILD_TYPE=Release -DWHISPER_COREML=ON -DWHISPER_COREML_ALLOW_FALLBACK=ON -DWHISPER_FFMPEG=OFF -DBUILD_SHARED_LIBS=OFF

# Build the server binary
echo "Building whisper-server binary..."
cmake --build . --target server -j$(sysctl -n hw.ncpu)

echo "Fixing rpath in whisper-server..."
if [ -f "bin/server" ]; then
    cp bin/server "$SCRIPT_DIR/whisper-server"
    chmod +x "$SCRIPT_DIR/whisper-server"
    install_name_tool -delete_rpath "$WHISPER_DIR/build/src" "$SCRIPT_DIR/whisper-server" 2>/dev/null || true
    install_name_tool -delete_rpath "$WHISPER_DIR/build/ggml" "$SCRIPT_DIR/whisper-server" 2>/dev/null || true
    echo "Whisper server binary built successfully at: $SCRIPT_DIR/whisper-server"
    echo "Checking for remaining rpath entries:"
    otool -L "$SCRIPT_DIR/whisper-server" | grep "@rpath" || echo "✓ No problematic rpath entries"
else
    echo "Error: whisper-server binary not found after build"
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
        echo "Signing whisper-server with: $SIGNING_IDENTITY"
        codesign --force --options runtime --timestamp \
            --sign "$SIGNING_IDENTITY" \
            "$SCRIPT_DIR/whisper-server"
        echo "✅ whisper-server signed"
    fi
fi

# In debug mode, also copy to target/debug for dev mode (tauri dev)
if [ "$DEBUG_MODE" = true ]; then
    echo "Copying to target/debug for development..."
    mkdir -p "$SCRIPT_DIR/target/debug"
    cp "$SCRIPT_DIR/whisper-server" "$SCRIPT_DIR/target/debug/whisper-server"
    chmod +x "$SCRIPT_DIR/target/debug/whisper-server"
    echo "✅ Copied to target/debug/whisper-server"
fi
