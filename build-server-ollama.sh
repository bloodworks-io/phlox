#!/bin/bash
set -e

echo "Building Python server with Ollama integration..."

# Make sure we're in the right directory
cd "$(dirname "$0")"

# Build the server from the server directory
cd server
uv run pyinstaller ../pyinstaller.spec --clean --noconfirm

# Create Tauri binaries directory if it doesn't exist
mkdir -p ../src-tauri/binaries

echo "Copying server binary to Tauri..."

# Determine the target architecture for server
if [[ "$OSTYPE" == "darwin"* ]]; then
    if [[ $(uname -m) == "arm64" ]]; then
        SERVER_TARGET="server-aarch64-apple-darwin"
        OLLAMA_TARGET="ollama-aarch64-apple-darwin"
        echo "Detected Apple Silicon (ARM64)"
    else
        SERVER_TARGET="server-x86_64-apple-darwin"
        OLLAMA_TARGET="ollama-x86_64-apple-darwin"
        echo "Detected Intel x86_64"
    fi
    OLLAMA_PLATFORM="darwin"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    SERVER_TARGET="server-x86_64-unknown-linux-gnu"
    OLLAMA_TARGET="ollama-x86_64-unknown-linux-gnu"
    OLLAMA_PLATFORM="linux"
    OLLAMA_ARCH="amd64"
    echo "Detected Linux x86_64"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    SERVER_TARGET="server-x86_64-pc-windows-msvc.exe"
    OLLAMA_TARGET="ollama-x86_64-pc-windows-msvc.exe"
    OLLAMA_PLATFORM="windows"
    OLLAMA_ARCH="amd64"
    echo "Detected Windows x86_64"
else
    SERVER_TARGET="server-aarch64-apple-darwin"
    OLLAMA_TARGET="ollama-aarch64-apple-darwin"
    OLLAMA_PLATFORM="darwin"
    echo "Defaulting to Apple Silicon (ARM64)"
fi

# Check if the server build was successful
if [ ! -d "dist/server" ]; then
    echo "Error: dist/server directory not found!"
    exit 1
fi

# Copy server directory
echo "Copying dist/server directory to ../src-tauri/"
rm -rf "../src-tauri/server_dist"
cp -r "dist/server" "../src-tauri/server_dist"

# Create server wrapper script
cat > "../src-tauri/binaries/$SERVER_TARGET" << 'EOF'
#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$DIR/server_dist/server" "$@"
EOF

chmod +x "../src-tauri/binaries/$SERVER_TARGET"
chmod +x "../src-tauri/server_dist/server"

# Download Ollama
echo "Downloading Ollama for $OLLAMA_PLATFORM..."

# Get latest Ollama version
OLLAMA_VERSION=$(curl -s https://api.github.com/repos/ollama/ollama/releases/latest | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
echo "Latest Ollama version: $OLLAMA_VERSION"

# Move to src-tauri directory for Ollama download
cd ../src-tauri

# Remove any existing ollama files
rm -f ollama ollama.exe ollama.tgz ollama.zip

if [[ "$OLLAMA_PLATFORM" == "darwin" ]]; then
    # For macOS, download the .tgz file and extract
    OLLAMA_URL="https://github.com/ollama/ollama/releases/download/${OLLAMA_VERSION}/ollama-darwin.tgz"
    echo "Downloading from: $OLLAMA_URL"

    curl -L -o ollama-darwin.tgz "$OLLAMA_URL"

    # Extract the binary
    tar -xzf ollama-darwin.tgz

    # The extracted binary should be named 'ollama'
    if [ -f "ollama" ]; then
        chmod +x ollama
        cp ollama "binaries/$OLLAMA_TARGET"
        chmod +x "binaries/$OLLAMA_TARGET"
        echo "✅ Ollama binary extracted and copied successfully"
        ls -la ollama
    else
        echo "❌ Error: ollama binary not found after extraction"
        echo "Contents of extracted files:"
        ls -la
        exit 1
    fi

    # Clean up
    rm -f ollama-darwin.tgz

elif [[ "$OLLAMA_PLATFORM" == "linux" ]]; then
    # For Linux, download the .tgz file and extract
    OLLAMA_URL="https://github.com/ollama/ollama/releases/download/${OLLAMA_VERSION}/ollama-linux-${OLLAMA_ARCH}.tgz"
    echo "Downloading from: $OLLAMA_URL"

    curl -L -o ollama-linux.tgz "$OLLAMA_URL"
    tar -xzf ollama-linux.tgz

    if [ -f "bin/ollama" ]; then
        mv bin/ollama .
        chmod +x ollama
        cp ollama "binaries/$OLLAMA_TARGET"
        chmod +x "binaries/$OLLAMA_TARGET"
        echo "✅ Ollama binary extracted and copied successfully"
    else
        echo "❌ Error: ollama binary not found after extraction"
        exit 1
    fi

    # Clean up
    rm -rf bin lib ollama-linux.tgz

elif [[ "$OLLAMA_PLATFORM" == "windows" ]]; then
    # For Windows, download the .zip file and extract
    OLLAMA_URL="https://github.com/ollama/ollama/releases/download/${OLLAMA_VERSION}/ollama-windows-${OLLAMA_ARCH}.zip"
    echo "Downloading from: $OLLAMA_URL"

    curl -L -o ollama-windows.zip "$OLLAMA_URL"
    unzip -o ollama-windows.zip

    if [ -f "ollama.exe" ]; then
        chmod +x ollama.exe
        cp ollama.exe "binaries/$OLLAMA_TARGET"
        chmod +x "binaries/$OLLAMA_TARGET"
        echo "✅ Ollama binary extracted and copied successfully"
    else
        echo "❌ Error: ollama.exe not found after extraction"
        exit 1
    fi

    # Clean up
    rm -f ollama-windows.zip
fi

echo ""
echo "✅ Build complete!"
echo "📁 Server binary: $SERVER_TARGET"
echo "🤖 Ollama binary: $OLLAMA_TARGET"
echo "📍 Server directory: $(pwd)/server_dist/"
echo "📍 Ollama binary: $(pwd)/ollama"
echo "📍 Ollama size: $(ls -lh ollama 2>/dev/null | awk '{print $5}' || echo 'File not found')"
echo ""
echo "Both binaries are ready for Tauri bundling!"

# Verify the ollama binary works
echo "🔍 Testing Ollama binary..."
if [[ "$OLLAMA_PLATFORM" == "windows" ]]; then
    ./ollama.exe --version || echo "⚠️  Ollama version check failed"
else
    ./ollama --version || echo "⚠️  Ollama version check failed"
fi
