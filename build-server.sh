#!/bin/bash
set -e

echo "Building Python server with PyInstaller..."

# Make sure we're in the right directory
cd "$(dirname "$0")"

# Build the server from the server directory
cd server
pyinstaller ../pyinstaller.spec --clean --noconfirm

# Create Tauri binaries directory if it doesn't exist
mkdir -p ../src-tauri/binaries

echo "Copying server binary to Tauri..."

# Determine the target architecture
if [[ "$OSTYPE" == "darwin"* ]]; then
    if [[ $(uname -m) == "arm64" ]]; then
        TARGET="server-aarch64-apple-darwin"
        echo "Detected Apple Silicon (ARM64)"
    else
        TARGET="server-x86_64-apple-darwin"
        echo "Detected Intel x86_64"
    fi
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    TARGET="server-x86_64-unknown-linux-gnu"
    echo "Detected Linux x86_64"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    TARGET="server-x86_64-pc-windows-msvc.exe"
    echo "Detected Windows x86_64"
else
    TARGET="server-aarch64-apple-darwin"
    echo "Defaulting to Apple Silicon (ARM64)"
fi

# Check if the build was successful
if [ ! -d "dist/server" ]; then
    echo "Error: dist/server directory not found!"
    exit 1
fi

# For onedir build, copy the entire directory
echo "Copying dist/server directory to ../src-tauri/"
rm -rf "../src-tauri/server_dist"
cp -r "dist/server" "../src-tauri/server_dist"

# Create a wrapper script that Tauri can execute
cat > "../src-tauri/binaries/$TARGET" << 'EOF'
#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$DIR/server_dist/server" "$@"
EOF

chmod +x "../src-tauri/binaries/$TARGET"
chmod +x "../src-tauri/server_dist/server"

echo "Server build complete! Binary: $TARGET"
echo "Binary location: $(pwd)/../src-tauri/binaries/$TARGET"
echo "Server directory: $(pwd)/../src-tauri/server_dist/"
