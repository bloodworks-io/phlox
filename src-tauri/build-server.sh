#!/bin/bash
# Build script for Python server
# This script compiles the Python server with Nuitka
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
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SERVER_DIR="$PROJECT_DIR/server"

echo "Building Python server with Nuitka..."
echo "Server directory: $SERVER_DIR"

if [ "$DEBUG_MODE" = true ]; then
    echo "Mode: DEBUG (for tauri dev)"
else
    echo "Mode: RELEASE (for production)"
fi

# Detect architecture
if [[ "$OSTYPE" == "darwin"* ]]; then
    if [[ $(uname -m) == "arm64" ]]; then
        ARCH="arm64"
        TARGET="server-aarch64-apple-darwin"
        echo "Detected Apple Silicon (ARM64)"
    else
        ARCH="x86_64"
        TARGET="server-x86_64-apple-darwin"
        echo "Detected Intel x86_64"
    fi
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    ARCH="x86_64"
    TARGET="server-x86_64-unknown-linux-gnu"
    echo "Detected Linux x86_64"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    ARCH="x86_64"
    TARGET="server-x86_64-pc-windows-msvc.exe"
    echo "Detected Windows x86_64"
else
    ARCH="arm64"
    TARGET="server-aarch64-apple-darwin"
    echo "Defaulting to Apple Silicon (ARM64)"
fi

# Clean previous build
echo "Cleaning previous build..."
rm -rf "$SERVER_DIR/dist"

# Build with Nuitka from project root
echo "Compiling with Nuitka (this may take a while on first run)..."

cd "$PROJECT_DIR"

# Use .venv python if available (local dev), otherwise fall back to uv run (CI)
if [ -f "$SERVER_DIR/.venv/bin/python" ]; then
    PYTHON="$SERVER_DIR/.venv/bin/python"
    NUITKA_CMD="$PYTHON -m nuitka"
else
    echo "No .venv found, using uv run for Nuitka..."
    NUITKA_CMD="uv run --directory $SERVER_DIR python -m nuitka"
fi

# Detect number of CPU cores for parallel C compilation
if [[ "$OSTYPE" == "darwin"* ]]; then
    JOBS=$(sysctl -n hw.logicalcpu)
else
    JOBS=$(nproc)
fi
echo "Using $JOBS parallel jobs for C compilation..."

$NUITKA_CMD \
    --assume-yes-for-downloads \
    --jobs=$JOBS \
    --mode=standalone \
    --output-dir=server/dist \
    --output-filename=server \
    --macos-target-arch=$ARCH \
    --follow-imports \
    --include-package=server \
    --include-module=sqlcipher3 \
    --nofollow-import-to=chromadb \
    --nofollow-import-to=onnxruntime \
    --nofollow-import-to=fitz \
    --nofollow-import-to=PyMuPDF \
    --nofollow-import-to=pytesseract \
    server/server.py

# Check if the build was successful
if [ ! -d "$SERVER_DIR/dist/server.dist" ]; then
    echo "Error: dist/server.dist directory not found!"
    exit 1
fi

echo "Copying server binary to Tauri..."

# Create Tauri binaries directory if it doesn't exist
mkdir -p "$SCRIPT_DIR/binaries"

# Copy to Tauri locations (always needed for production bundling)
rm -rf "$SCRIPT_DIR/server_dist"
cp -r "$SERVER_DIR/dist/server.dist" "$SCRIPT_DIR/server_dist"

# Copy CHANGELOG.md to server_dist for version detection
cp "$PROJECT_DIR/CHANGELOG.md" "$SCRIPT_DIR/server_dist/"

# Create a wrapper script for prod
cat > "$SCRIPT_DIR/binaries/$TARGET" << 'EOF'
#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# On macOS app bundles, resources live in Contents/Resources/ while this
# binary lives in Contents/MacOS/ — check both locations.
if [ -f "$DIR/../Resources/server_dist/server" ]; then
    exec "$DIR/../Resources/server_dist/server" "$@"
else
    exec "$DIR/server_dist/server" "$@"
fi
EOF

chmod +x "$SCRIPT_DIR/binaries/$TARGET"
chmod +x "$SCRIPT_DIR/server_dist/server"

# In debug mode, also copy to target/debug for dev mode (tauri dev)
if [ "$DEBUG_MODE" = true ]; then
    echo "Copying to target/debug for development..."
    mkdir -p "$SCRIPT_DIR/target/debug"
    rm -rf "$SCRIPT_DIR/target/debug/server_dist"
    cp -r "$SERVER_DIR/dist/server.dist" "$SCRIPT_DIR/target/debug/server_dist"
    # Copy CHANGELOG.md for version detection
    cp "$PROJECT_DIR/CHANGELOG.md" "$SCRIPT_DIR/target/debug/server_dist/"

    # Create wrapper script for dev mode
    cat > "$SCRIPT_DIR/target/debug/server" << 'EOF'
#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Python server wrapper: executing $DIR/server_dist/server" >&2
exec "$DIR/server_dist/server" "$@"
EOF
    chmod +x "$SCRIPT_DIR/target/debug/server"
fi

# Sign binaries if on macOS with signing identity (release builds only)
if [[ "$OSTYPE" == "darwin"* ]] && [ "$DEBUG_MODE" != true ]; then
    # Support both APPLE_SIGNING_IDENTITY (Tauri convention) and SIGNING_IDENTITY
    SIGNING_IDENTITY="${APPLE_SIGNING_IDENTITY:-${SIGNING_IDENTITY:-$(security find-identity -v -p codesigning 2>/dev/null | grep "Developer ID Application" | head -1 | sed 's/.*"\(.*\)".*/\1/')}}"

    if [ -n "$SIGNING_IDENTITY" ]; then
        echo ""
        echo "Signing binaries with: $SIGNING_IDENTITY"

        # Sign the main server binary
        codesign --force --options runtime --timestamp \
            --sign "$SIGNING_IDENTITY" \
            "$SCRIPT_DIR/server_dist/server"

        # Sign all .so and .dylib files
        find "$SCRIPT_DIR/server_dist" \( -name "*.so" -o -name "*.dylib" \) -exec \
            codesign --force --options runtime --timestamp \
            --sign "$SIGNING_IDENTITY" {} \;

        # Sign the Python dylib (no extension, shipped by Nuitka)
        if [ -f "$SCRIPT_DIR/server_dist/Python" ]; then
            codesign --force --options runtime --timestamp \
                --sign "$SIGNING_IDENTITY" \
                "$SCRIPT_DIR/server_dist/Python"
        fi

        echo "✅ Binaries signed"
    fi
fi

echo ""
echo "✅ Server build complete!"
echo "   Binary: $TARGET"
echo "   Location: $SCRIPT_DIR/binaries/$TARGET"
echo "   Server directory: $SCRIPT_DIR/server_dist/"
