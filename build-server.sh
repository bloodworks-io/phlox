#!/bin/bash
set -e

echo "Building Python server with PyInstaller..."

# Make sure we're in the right directory
cd "$(dirname "$0")"

# Build the server
cd server
pyinstaller ../pyinstaller.spec --clean --noconfirm

# Create Tauri binaries directory if it doesn't exist
mkdir -p ../src-tauri/binaries

# Copy the built server to Tauri's external bin directory
echo "Copying server binary to Tauri..."

# Determine the target architecture based on the system
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - detect architecture
    if [[ $(uname -m) == "arm64" ]]; then
        TARGET="server-aarch64-apple-darwin"
        echo "Detected Apple Silicon (ARM64)"
    else
        TARGET="server-x86_64-apple-darwin"
        echo "Detected Intel x86_64"
    fi
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    TARGET="server-x86_64-unknown-linux-gnu"
    echo "Detected Linux x86_64"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    # Windows
    TARGET="server-x86_64-pc-windows-msvc.exe"
    echo "Detected Windows x86_64"
else
    # Default to ARM64 macOS since you're on Apple Silicon
    TARGET="server-aarch64-apple-darwin"
    echo "Defaulting to Apple Silicon (ARM64)"
fi

# Copy and make executable
echo "Copying dist/server to ../src-tauri/binaries/$TARGET"
cp dist/server ../src-tauri/binaries/$TARGET
chmod +x ../src-tauri/binaries/$TARGET

echo "Server build complete! Binary: $TARGET"
echo "Binary location: $(pwd)/../src-tauri/binaries/$TARGET"
