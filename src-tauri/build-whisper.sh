#!/bin/bash
# Build script for whisper.cpp server
# This script compiles the whisper.cpp HTTP server example as a standalone binary

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WHISPER_DIR="$SCRIPT_DIR/whisper.cpp"

echo "Building whisper.cpp server from: $WHISPER_DIR"

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
echo "Configuring whisper.cpp build with Core ML support (no ffmpeg)..."
cmake .. -DCMAKE_BUILD_TYPE=Release -DWHISPER_COREML=ON -DWHISPER_COREML_ALLOW_FALLBACK=ON -DWHISPER_FFMPEG=OFF

# Build the server binary
echo "Building whisper-server binary..."
cmake --build . --target server -j$(sysctl -n hw.ncpu)

# Copy the binary to src-tauri root
# The server binary is built at build/bin/server
if [ -f "bin/server" ]; then
    cp bin/server "$SCRIPT_DIR/whisper-server"
    chmod +x "$SCRIPT_DIR/whisper-server"
    echo "Whisper server binary built successfully at: $SCRIPT_DIR/whisper-server"
else
    echo "Error: whisper-server binary not found after build"
    echo "Looking in: $(pwd)"
    echo "Contents of bin/:"
    ls -la bin/ || echo "bin/ directory not found"
    exit 1
fi
