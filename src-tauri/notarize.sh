#!/bin/bash
# Sign and notarize scripts for macOS distribution
# Requires Apple Developer ID and app-specific password for notarization

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Configuration - set these environment variables or edit below
# SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
# NOTARY_APPLE_ID="your-apple-id@email.com"
# NOTARY_TEAM_ID="YOURTEAMID"
# NOTARY_PASSWORD="@keychain:AC_PASSWORD"  # app-specific password in keychain

SIGNING_IDENTITY="${SIGNING_IDENTITY:-$(security find-identity -v -p codesigning | grep "Developer ID Application" | head -1 | sed 's/.*"\(.*\)".*/\1/')}"
NOTARY_APPLE_ID="${NOTARY_APPLE_ID:-}"
NOTARY_TEAM_ID="${NOTARY_TEAM_ID:-}"
NOTARY_PASSWORD="${NOTARY_PASSWORD:-@keychain:AC_PASSWORD}"

if [ -z "$SIGNING_IDENTITY" ]; then
    echo "❌ Error: No Developer ID Application signing identity found"
    echo "   Set SIGNING_IDENTITY environment variable or ensure certificate is installed"
    exit 1
fi

echo "Using signing identity: $SIGNING_IDENTITY"

# ========================================
# Function to sign a single binary
# ========================================
sign_binary() {
    local binary="$1"
    if [ -f "$binary" ]; then
        echo "Signing: $binary"
        codesign --force --options runtime --timestamp \
            --sign "$SIGNING_IDENTITY" \
            "$binary"
    else
        echo "⚠️  Binary not found: $binary"
    fi
}

# ========================================
# Function to sign all binaries in server_dist
# ========================================
sign_server_dist() {
    local server_dist="$SCRIPT_DIR/server_dist"

    if [ ! -d "$server_dist" ]; then
        echo "❌ Error: $server_dist not found"
        exit 1
    fi

    echo "Signing all binaries in server_dist..."

    # Sign the main server binary
    sign_binary "$server_dist/server"

    # Sign all .so files and other executables
    find "$server_dist" -name "*.so" -exec codesign --force --options runtime --timestamp --sign "$SIGNING_IDENTITY" {} \;
    find "$server_dist" -type f -perm +111 -exec codesign --force --options runtime --timestamp --sign "$SIGNING_IDENTITY" {} \; 2>/dev/null || true
}

# ========================================
# Function to sign all external binaries
# ========================================
sign_external_binaries() {
    local binaries_dir="$SCRIPT_DIR/binaries"

    if [ ! -d "$binaries_dir" ]; then
        echo "⚠️  Binaries directory not found: $binaries_dir"
        return
    fi

    echo "Signing external binaries..."

    for binary in "$binaries_dir"/*; do
        if [ -f "$binary" ] && [ -x "$binary" ]; then
            # Skip wrapper scripts (check if it's a text file)
            if file "$binary" | grep -q "shell script"; then
                echo "Skipping wrapper script: $binary"
                continue
            fi
            sign_binary "$binary"
        fi
    done
}

# ========================================
# Function to notarize an app or DMG
# ========================================
notarize() {
    local app_path="$1"

    if [ -z "$NOTARY_APPLE_ID" ] || [ -z "$NOTARY_TEAM_ID" ]; then
        echo "⚠️  Notarization skipped: NOTARY_APPLE_ID and NOTARY_TEAM_ID not set"
        echo "   Set these environment variables to enable notarization"
        return 1
    fi

    echo "Submitting for notarization: $app_path"

    # Create a zip for notarization (required for .app bundles)
    local zip_path="${app_path}.zip"
    if [[ "$app_path" == *.app ]]; then
        ditto -c -k --keepParent "$app_path" "$zip_path"
        echo "Created zip for notarization: $zip_path"
    else
        zip_path="$app_path"
    fi

    # Submit for notarization
    local submission_id
    submission_id=$(xcrun notarytool submit "$zip_path" \
        --apple-id "$NOTARY_APPLE_ID" \
        --team-id "$NOTARY_TEAM_ID" \
        --password "$NOTARY_PASSWORD" \
        --wait \
        2>&1 | tee /dev/stderr | grep "id:" | head -1 | awk '{print $2}')

    # Check result
    if xcrun notarytool info "$submission_id" \
        --apple-id "$NOTARY_APPLE_ID" \
        --team-id "$NOTARY_TEAM_ID" \
        --password "$NOTARY_PASSWORD" | grep -q "status: Accepted"; then
        echo "✅ Notarization successful"

        # Staple the ticket
        if [[ "$app_path" == *.app ]]; then
            xcrun stapler staple "$app_path"
            echo "✅ Stapled: $app_path"
        fi

        # Clean up zip
        [ -f "${app_path}.zip" ] && rm "${app_path}.zip"
        return 0
    else
        echo "❌ Notarization failed"
        xcrun notarytool log "$submission_id" \
            --apple-id "$NOTARY_APPLE_ID" \
            --team-id "$NOTARY_TEAM_ID" \
            --password "$NOTARY_PASSWORD"
        return 1
    fi
}

# ========================================
# Main: Sign all binaries if called directly
# ========================================
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    echo "=========================================="
    echo "Signing all binaries for distribution"
    echo "=========================================="

    sign_server_dist
    sign_external_binaries

    echo ""
    echo "✅ All binaries signed"
    echo ""
    echo "To notarize the final app bundle after building:"
    echo "  ./notarize.sh notarize path/to/Phlox.app"
    echo ""
    echo "Or for a DMG:"
    echo "  ./notarize.sh notarize path/to/Phlox.dmg"
fi
