#!/bin/bash
# Combined build script for Phlox Tauri application
# This script builds all required components:
# 1. Python server (Nuitka)
# 2. phlox-pm (Process Manager - Rust)
# 3. whisper.cpp server (for local transcription) [SKIP with --skip-whisper]
# 4. llama.cpp server (for local LLM) [SKIP with --skip-llama]
# 5. Copies all binaries to src-tauri/binaries/ for Tauri bundling
#
# Use --debug for development mode (tauri dev)
# Use --skip-cpp to skip C++ builds

set -e

# Parse arguments
SKIP_WHISPER=false
SKIP_LLAMA=false
DEBUG_MODE=false

for arg in "$@"; do
    case $arg in
        --debug)
            DEBUG_MODE=true
            shift
            ;;
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

if [ "$DEBUG_MODE" = true ]; then
    echo "Mode: DEBUG (for tauri dev)"
else
    echo "Mode: RELEASE (for production)"
fi

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
# Preflight: Verify signing credentials (macOS release only)
# ========================================
if [[ "$OSTYPE" == "darwin"* ]] && [ "$DEBUG_MODE" != true ]; then
    echo ""
    echo "=========================================="
    echo "Preflight: Checking signing credentials..."
    echo "=========================================="

    SIGNING_IDENTITY="${APPLE_SIGNING_IDENTITY:-${SIGNING_IDENTITY:-}}"

    if [ -z "$SIGNING_IDENTITY" ]; then
        echo "❌ No signing identity set. Export APPLE_SIGNING_IDENTITY or SIGNING_IDENTITY before building."
        exit 1
    fi

    if ! security find-identity -v -p codesigning | grep -q "$SIGNING_IDENTITY"; then
        echo "❌ Signing identity '$SIGNING_IDENTITY' not found in keychain."
        echo "   Available identities:"
        security find-identity -v -p codesigning
        exit 1
    fi

    echo "✅ Signing identity verified: $SIGNING_IDENTITY"
fi

# ========================================
# Step 1: Build phlox-pm (Process Manager)
# ========================================
echo ""
echo "=========================================="
echo "Step 1: Building phlox-pm (Process Manager)..."
echo "=========================================="

cd src-tauri
if [ "$DEBUG_MODE" = true ]; then
    cargo build -p phlox-pm
else
    cargo build --release -p phlox-pm
fi
cd ..

# Verify the binary was built
if [ "$DEBUG_MODE" = true ]; then
    if [[ "$PLATFORM" == "windows-"* ]]; then
        PM_BIN="src-tauri/target/debug/phlox-pm.exe"
    else
        PM_BIN="src-tauri/target/debug/phlox-pm"
    fi
else
    if [[ "$PLATFORM" == "windows-"* ]]; then
        PM_BIN="src-tauri/target/release/phlox-pm.exe"
    else
        PM_BIN="src-tauri/target/release/phlox-pm"
    fi
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

if [ "$DEBUG_MODE" = true ]; then
    bash src-tauri/build-server.sh --debug
else
    bash src-tauri/build-server.sh
fi

# Check if the server build was successful
if [ ! -d "src-tauri/server_dist" ]; then
    echo "❌ Error: src-tauri/server_dist directory not found!"
    exit 1
fi

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
    if [ "$DEBUG_MODE" = true ]; then
        bash src-tauri/build-whisper.sh --debug
    else
        bash src-tauri/build-whisper.sh
    fi

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
    if [ "$DEBUG_MODE" = true ]; then
        bash src-tauri/build-llama.sh --debug
    else
        bash src-tauri/build-llama.sh
    fi

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

# In debug mode, also copy C++ servers directly to target/debug/ (not needed for phlox-pm/server - they're already there)
if [ "$DEBUG_MODE" = true ]; then
    echo ""
    echo "Copying C++ servers to target/debug for dev mode..."
    mkdir -p "src-tauri/target/debug"

    if [ -f "$LLAMA_BIN" ]; then
        cp "$LLAMA_BIN" "src-tauri/target/debug/llama-server"
        chmod +x "src-tauri/target/debug/llama-server"
        echo "✅ Copied llama-server to target/debug"
    fi

    if [ -f "$WHISPER_BIN" ]; then
        cp "$WHISPER_BIN" "src-tauri/target/debug/whisper-server"
        chmod +x "src-tauri/target/debug/whisper-server"
        echo "✅ Copied whisper-server to target/debug"
    fi
fi

# ========================================
# Step 6: Sign all binaries (macOS only, release builds)
# ========================================
if [[ "$OSTYPE" == "darwin"* ]] && [ "$DEBUG_MODE" != true ]; then
    echo ""
    echo "=========================================="
    echo "Step 6: Signing binaries..."
    echo "=========================================="

    # Auto-detect signing identity (supports Tauri convention)
    SIGNING_IDENTITY="${APPLE_SIGNING_IDENTITY:-${SIGNING_IDENTITY:-$(security find-identity -v -p codesigning 2>/dev/null | grep "Developer ID Application" | head -1 | sed 's/.*"\(.*\)".*/\1/')}}"

    if [ -n "$SIGNING_IDENTITY" ]; then
        echo "Using signing identity: $SIGNING_IDENTITY"

        # Sign external binaries
        for binary in src-tauri/binaries/phlox-pm-${PLATFORM} \
                     src-tauri/binaries/llama-server-${PLATFORM} \
                     src-tauri/binaries/whisper-server-${PLATFORM}; do
            if [ -f "$binary" ]; then
                echo "Signing: $binary"
                codesign --force --options runtime --timestamp \
                    --sign "$SIGNING_IDENTITY" "$binary"
            fi
        done

        echo "✅ All external binaries signed"
    else
        echo "⚠️  No signing identity found - skipping code signing"
        echo "   Install Developer ID certificate or set SIGNING_IDENTITY"
    fi
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
echo "Next steps:"
echo "  1. Build the Tauri application:"
echo "     npm run tauri-build"
echo ""
echo "  2. Notarize the app for distribution (macOS):"
echo "     cd src-tauri"
echo "     ./notarize.sh notarize target/release/bundle/macos/Phlox.app"
echo ""
echo "To skip C++ builds next time:"
echo "  ./build-all.sh --skip-cpp"
echo ""
