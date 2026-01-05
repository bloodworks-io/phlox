#!/bin/bash
# Build script for llama.cpp server
# This script compiles the llama.cpp HTTP server as a standalone binary

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LLAMA_DIR="$SCRIPT_DIR/llama.cpp"

echo "Building llama.cpp server from: $LLAMA_DIR"

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
echo "Configuring llama.cpp build with Metal support..."
cmake .. \
  -DCMAKE_BUILD_TYPE=Release \
  -DLLAMA_METAL=ON \
  -DLLAMA_ACCELERATE=ON \
  -DLLAMA_ALL_WARNINGS=OFF

# Build the llama-server binary
echo "Building llama-server binary..."
cmake --build . --target llama-server -j$(sysctl -n hw.ncpu)

# Copy the binary to src-tauri root
# The server binary is built at build/bin/llama-server
if [ -f "bin/llama-server" ]; then
    cp bin/llama-server "$SCRIPT_DIR/llama-server"
    chmod +x "$SCRIPT_DIR/llama-server"
    echo "llama-server binary built successfully at: $SCRIPT_DIR/llama-server"
    echo "Binary size: $(du -h "$SCRIPT_DIR/llama-server" | cut -f1)"
else
    echo "Error: llama-server binary not found after build"
    echo "Looking in: $(pwd)"
    echo "Contents of bin/:"
    ls -la bin/ || echo "bin/ directory not found"
    exit 1
fi
