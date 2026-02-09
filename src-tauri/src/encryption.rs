// Minimal encryption key management for Phlox
//
// SQLCipher handles all key derivation internally using PBKDF2-HMAC-SHA512.
// This module just provides hex encoding for the passphrase.

use thiserror::Error;

// =============================================================================
// Error Types
// =============================================================================
#[derive(Error, Debug)]
pub enum EncryptionError {
    #[error("Passphrase too short (min 12 characters)")]
    PassphraseTooShort,
    #[error("Passphrase required")]
    PassphraseRequired,
}

// =============================================================================
// Core Functions
// =============================================================================

/// Get the platform-specific data directory
pub fn get_data_dir() -> Option<std::path::PathBuf> {
    dirs::data_dir().map(|d| d.join("Phlox"))
}

/// Check if encryption has been set up (database file exists)
pub fn has_encryption_setup() -> bool {
    database_exists()
}

/// Check if database file exists
pub fn database_exists() -> bool {
    if let Some(data_dir) = get_data_dir() {
        let db_path = data_dir.join("phlox_database.sqlite");
        return db_path.exists();
    }
    false
}

/// Check if passphrase is cached in keychain
/// Always returns false since we don't use keychain caching
pub fn has_keychain_entry() -> bool {
    false
}

/// Convert a string passphrase to hex for SQLCipher
/// SQLCipher expects: PRAGMA key = "x'hexstring'"
pub fn passphrase_to_hex(passphrase: &str) -> String {
    hex::encode(passphrase.as_bytes())
}

/// Setup encryption with a new passphrase
/// Validates passphrase length and returns hex-encoded passphrase
pub fn setup_encryption(passphrase: &str) -> Result<String, EncryptionError> {
    log::info!("setup_encryption called");

    if passphrase.len() < 12 {
        return Err(EncryptionError::PassphraseTooShort);
    }

    let hex_passphrase = passphrase_to_hex(passphrase);
    log::info!("Encryption setup complete, returning hex passphrase");

    Ok(hex_passphrase)
}

/// Unlock with passphrase
/// Validates and returns hex-encoded passphrase
/// Verification happens when Python tries to open the database
pub fn unlock_with_passphrase(passphrase: &str) -> Result<String, EncryptionError> {
    log::info!("unlock_with_passphrase called");

    if passphrase.is_empty() {
        return Err(EncryptionError::PassphraseRequired);
    }

    let hex_passphrase = passphrase_to_hex(passphrase);
    log::info!("Unlock successful, returning hex passphrase");

    Ok(hex_passphrase)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_passphrase_to_hex() {
        let hex = passphrase_to_hex("test");
        assert_eq!(hex, "74657374");
    }

    #[test]
    fn test_passphrase_to_hex_unicode() {
        let hex = passphrase_to_hex("hello world");
        assert_eq!(hex, "68656c6c6f20776f726c64");
    }

    #[test]
    fn test_setup_encryption_too_short() {
        let result = setup_encryption("short");
        assert!(matches!(result, Err(EncryptionError::PassphraseTooShort)));
    }

    #[test]
    fn test_setup_encryption_valid() {
        let result = setup_encryption("this_is_a_valid_passphrase");
        assert!(result.is_ok());
        assert_eq!(
            result.unwrap(),
            hex::encode("this_is_a_valid_passphrase".as_bytes())
        );
    }

    #[test]
    fn test_unlock_empty() {
        let result = unlock_with_passphrase("");
        assert!(matches!(result, Err(EncryptionError::PassphraseRequired)));
    }
}
