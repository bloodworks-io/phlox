#!/bin/bash
# Combined build script for Phlox Tauri application
# This script builds all required components:
# 1. Python server (PyInstaller)
# 2. phlox-pm (Process Manager - Rust)
# 3. whisper.cpp server (for local transcription) [SKIP with --skip-whisper]
# 4. llama.cpp server (for local LLM) [SKIP with --skip-llama]
# 5. Copies all binaries to src-tauri/binaries/ for Tauri bundling

set -e

# Parse arguments
SKIP_WHISPER=false
SKIP_LLAMA=false

for arg in "$@"; do
    case $arg in
        --skip-whisper)
            SKIP_WHISPER=true
            shift
            ;;
        --skip-llama)
            SKIP_LLAMA=true
            shift
            ;;
        --skip-cpp)
            SKIP_WHISPER=true
            SKIP_LLAMA=true
            shift
            ;;
        *)
            ;;
    esac
done

echo "=========================================="
echo "Building Phlox Tauri Application"
echo "=========================================="

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Detect platform (using Rust target triple naming for Tauri compatibility)
if [[ "$OSTYPE" == "darwin"* ]]; then
    if [[ $(uname -m) == "arm64" ]]; then
        PLATFORM="aarch64-apple-darwin"
        echo "Platform: macOS Apple Silicon (ARM64)"
    else
        PLATFORM="x86_64-apple-darwin"
        echo "Platform: macOS Intel (x86_64)"
    fi
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    PLATFORM="x86_64-unknown-linux-gnu"
    echo "Platform: Linux x86_64"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    PLATFORM="x86_64-pc-windows-msvc"
    echo "Platform: Windows x86_64"
else
    PLATFORM="aarch64-apple-darwin"
    echo "Platform: Unknown, defaulting to macOS ARM64"
fi

# ========================================
# Step 1: Build phlox-pm (Process Manager)
# ========================================
echo ""
echo "=========================================="
echo "Step 1: Building phlox-pm (Process Manager)..."
echo "=========================================="

cd src-tauri
cargo build --release -p phlox-pm
cd ..

# Verify the binary was built
if [[ "$PLATFORM" == "windows-"* ]]; then
    PM_BIN="src-tauri/target/release/phlox-pm.exe"
else
    PM_BIN="src-tauri/target/release/phlox-pm"
fi

if [ ! -f "$PM_BIN" ]; then
    echo "❌ Error: phlox-pm binary not found at $PM_BIN"
    exit 1
fi

echo "✅ phlox-pm built successfully"

# ========================================
# Step 2: Build Python Server
# ========================================
echo ""
echo "=========================================="
echo "Step 2: Building Python Server..."
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
exec "$DIR/../Resources/server_dist/server" "$@" < /dev/stdin
EOF

chmod +x "src-tauri/binaries/$SERVER_TARGET"
chmod +x "src-tauri/server_dist/server"

echo "✅ Python server built successfully"

# ========================================
# Step 3: Build whisper.cpp
# ========================================
echo ""
echo "=========================================="
echo "Step 3: Building whisper.cpp..."
echo "=========================================="

if [ "$SKIP_WHISPER" = true ]; then
    echo "⏭️  Skipping whisper.cpp build (--skip-whisper)"
    WHISPER_BIN="src-tauri/whisper-server"
    if [[ "$PLATFORM" == "windows-"* ]]; then
        WHISPER_BIN="src-tauri/whisper-server.exe"
    fi
    if [ ! -f "$WHISPER_BIN" ]; then
        echo "⚠️  Warning: whisper-server binary not found at $WHISPER_BIN"
    fi
else
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
fi

# ========================================
# Step 4: Build llama.cpp
# ========================================
echo ""
echo "=========================================="
echo "Step 4: Building llama.cpp..."
echo "=========================================="

if [ "$SKIP_LLAMA" = true ]; then
    echo "⏭️  Skipping llama.cpp build (--skip-llama)"
    LLAMA_BIN="src-tauri/llama-server"
    if [[ "$PLATFORM" == "windows-"* ]]; then
        LLAMA_BIN="src-tauri/llama-server.exe"
    fi
    if [ ! -f "$LLAMA_BIN" ]; then
        echo "⚠️  Warning: llama-server binary not found at $LLAMA_BIN"
    fi
else
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
fi

# ========================================
# Step 5: Copy binaries for Tauri bundling
# ========================================
echo ""
echo "=========================================="
echo "Step 5: Copying binaries for Tauri..."
echo "=========================================="

mkdir -p "src-tauri/binaries"

# Copy phlox-pm binary
if [ -f "$PM_BIN" ]; then
    cp "$PM_BIN" "src-tauri/binaries/phlox-pm-${PLATFORM}"
    chmod +x "src-tauri/binaries/phlox-pm-${PLATFORM}"
    echo "✅ Copied phlox-pm"
else
    echo "⚠️  Warning: phlox-pm not found, skipping"
fi

# Copy llama-server
if [ -f "$LLAMA_BIN" ]; then
    cp "$LLAMA_BIN" "src-tauri/binaries/llama-server-${PLATFORM}"
    chmod +x "src-tauri/binaries/llama-server-${PLATFORM}"
    echo "✅ Copied llama-server"
else
    echo "⚠️  Warning: llama-server not found, skipping"
fi

# Copy whisper-server
if [ -f "$WHISPER_BIN" ]; then
    cp "$WHISPER_BIN" "src-tauri/binaries/whisper-server-${PLATFORM}"
    chmod +x "src-tauri/binaries/whisper-server-${PLATFORM}"
    echo "✅ Copied whisper-server"
else
    echo "⚠️  Warning: whisper-server not found, skipping"
fi

echo "✅ All binaries copied to src-tauri/binaries/"

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
echo "  • phlox-pm: $PM_BIN"
if [ "$SKIP_WHISPER" != true ]; then
    echo "  • whisper-server: $WHISPER_BIN"
else
    echo "  • whisper-server: (skipped)"
fi
if [ "$SKIP_LLAMA" != true ]; then
    echo "  • llama-server: $LLAMA_BIN"
else
    echo "  • llama-server: (skipped)"
fi
echo ""
echo "All binaries copied to src-tauri/binaries/ with platform-specific names."
echo ""
echo "You can now build the Tauri application with:"
echo "  cd src-tauri"
echo "  npm run tauri build"
echo ""
echo "To skip C++ builds next time:"
echo "  ./build-all.sh --skip-cpp"
echo ""
