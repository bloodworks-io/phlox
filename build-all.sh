#!/bin/bash
# Combined build script for Phlox Tauri application
# This script builds all required components:
# 1. Python server (PyInstaller)
# 2. whisper.cpp server (for local transcription)
# 3. llama.cpp server (for local LLM)

set -e

echo "=========================================="
echo "Building Phlox Tauri Application"
echo "=========================================="

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Detect platform
if [[ "$OSTYPE" == "darwin"* ]]; then
    if [[ $(uname -m) == "arm64" ]]; then
        PLATFORM="darwin-arm64"
        echo "Platform: macOS Apple Silicon (ARM64)"
    else
        PLATFORM="darwin-x86_64"
        echo "Platform: macOS Intel (x86_64)"
    fi
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    PLATFORM="linux-x86_64"
    echo "Platform: Linux x86_64"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    PLATFORM="windows-x86_64"
    echo "Platform: Windows x86_64"
else
    PLATFORM="darwin-arm64"
    echo "Platform: Unknown, defaulting to macOS ARM64"
fi

# ========================================
# Step 1: Build Python Server
# ========================================
echo ""
echo "=========================================="
echo "Step 1: Building Python Server..."
echo "=========================================="

cd server
uv run pyinstaller ../pyinstaller.spec --clean --noconfirm
cd ..

# Check if the server build was successful
if [ ! -d "server/dist/server" ]; then
    echo "❌ Error: server/dist/server directory not found!"
    exit 1
fi

# Copy server to Tauri directory
echo "Copying server binary to Tauri..."
rm -rf "src-tauri/server_dist"
cp -r "server/dist/server" "src-tauri/server_dist"

# Create Tauri binaries directory
mkdir -p "src-tauri/binaries"

# Create server wrapper script
if [[ "$PLATFORM" == "windows-"* ]]; then
    SERVER_TARGET="server-x86_64-pc-windows-msvc.exe"
else
    SERVER_TARGET="server-${PLATFORM}"
fi

cat > "src-tauri/binaries/$SERVER_TARGET" << 'EOF'
#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$DIR/server_dist/server" "$@"
EOF

chmod +x "src-tauri/binaries/$SERVER_TARGET"
chmod +x "src-tauri/server_dist/server"

echo "✅ Python server built successfully"

# ========================================
# Step 2: Build whisper.cpp
# ========================================
echo ""
echo "=========================================="
echo "Step 2: Building whisper.cpp..."
echo "=========================================="

bash src-tauri/build-whisper.sh

# Check if whisper-server was built
if [[ "$PLATFORM" == "windows-"* ]]; then
    WHISPER_BIN="src-tauri/whisper-server.exe"
else
    WHISPER_BIN="src-tauri/whisper-server"
fi

if [ ! -f "$WHISPER_BIN" ]; then
    echo "❌ Error: whisper-server binary not found at $WHISPER_BIN"
    exit 1
fi

echo "✅ whisper.cpp built successfully"

# ========================================
# Step 3: Build llama.cpp
# ========================================
echo ""
echo "=========================================="
echo "Step 3: Building llama.cpp..."
echo "=========================================="

bash src-tauri/build-llama.sh

# Check if llama-server was built
if [[ "$PLATFORM" == "windows-"* ]]; then
    LLAMA_BIN="src-tauri/llama-server.exe"
else
    LLAMA_BIN="src-tauri/llama-server"
fi

if [ ! -f "$LLAMA_BIN" ]; then
    echo "❌ Error: llama-server binary not found at $LLAMA_BIN"
    exit 1
fi

echo "✅ llama.cpp built successfully"

# ========================================
# Summary
# ========================================
echo ""
echo "=========================================="
echo "✅ All components built successfully!"
echo "=========================================="
echo ""
echo "Built components:"
echo "  • Python server: src-tauri/server_dist/"
echo "  • whisper-server: $WHISPER_BIN"
echo "  • llama-server: $LLAMA_BIN"
echo ""
echo "You can now build the Tauri application with:"
echo "  cd src-tauri"
echo "  npm run tauri build"
echo ""
