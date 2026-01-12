// Encryption key management for Phlox
//
// Uses a key wrapping pattern:
// - master_key: random 256-bit key that encrypts the database
// - wrapping_key: derived from user passphrase via Argon2id
// - wrapped_key.bin: contains salt + nonce + encrypted(master_key) + hash
//
// The master_key is cached in the system keychain for fast access.

use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use argon2::{password_hash::rand_core::RngCore, Argon2, Params};
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use zeroize::Zeroize;

// File format constants
pub const WRAPPED_KEY_FILE: &str = "wrapped_key.bin";
const CURRENT_VERSION: u8 = 1;

// File format offsets
const OFFSET_VERSION: usize = 0;
const OFFSET_SALT: usize = 1;
const OFFSET_NONCE: usize = 17; // 1 + 16
const OFFSET_CIPHERTEXT: usize = 29; // 1 + 16 + 12
const OFFSET_TAG: usize = 61; // 1 + 16 + 12 + 32
const OFFSET_HASH: usize = 77; // 1 + 16 + 12 + 32 + 16
const TOTAL_FILE_SIZE: usize = 109; // 1 + 16 + 12 + 32 + 16 + 32

// Length constants
const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 12;
const MASTER_KEY_LEN: usize = 32;
const TAG_LEN: usize = 16;
const HASH_LEN: usize = 32;

// Argon2id parameters (64 MiB, 3 iterations - above OWASP minimums)
const ARGON2_MEM_COST: u32 = 65536; // 64 MB in KiB
const ARGON2_TIME_COST: u32 = 3;
const ARGON2_PARALLELISM: u32 = 1;

// Keychain identifiers
const KEYCHAIN_SERVICE: &str = "com.phlox.app";
const KEYCHAIN_ACCOUNT: &str = "database_master_key";

/// Errors for encryption operations
#[derive(Debug, thiserror::Error)]
pub enum EncryptionError {
    #[error("Data directory not found")]
    DataDirNotFound,

    #[error("Wrapped key file not found")]
    WrappedKeyNotFound,

    #[error("Invalid wrapped key file format: {0}")]
    InvalidFormat(String),

    #[error("Decryption failed: wrong passphrase?")]
    DecryptionFailed,

    #[error("Key verification failed")]
    VerificationFailed,

    #[error("Keychain error: {0}")]
    KeychainError(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Crypto error: {0}")]
    CryptoError(String),
}

/// Get the platform-specific data directory
pub fn get_data_dir() -> Result<PathBuf, EncryptionError> {
    dirs::data_dir()
        .map(|d| d.join("Phlox"))
        .ok_or(EncryptionError::DataDirNotFound)
}

/// Check if encryption has been set up (wrapped_key.bin exists)
pub fn has_encryption_setup() -> bool {
    if let Ok(data_dir) = get_data_dir() {
        let wrapped_key_path = data_dir.join(WRAPPED_KEY_FILE);
        return wrapped_key_path.exists();
    }
    false
}

/// Check if database file exists
pub fn database_exists() -> bool {
    if let Ok(data_dir) = get_data_dir() {
        let db_path = data_dir.join("phlox_database.sqlite");
        return db_path.exists();
    }
    false
}

/// Generate a random 256-bit master key
pub fn generate_master_key() -> [u8; MASTER_KEY_LEN] {
    let mut key = [0u8; MASTER_KEY_LEN];
    OsRng.fill_bytes(&mut key);
    key
}

/// Generate a random salt for Argon2id
pub fn generate_salt() -> [u8; SALT_LEN] {
    let mut salt = [0u8; SALT_LEN];
    OsRng.fill_bytes(&mut salt);
    salt
}

/// Derive a wrapping key from passphrase and salt using Argon2id
pub fn derive_wrapping_key(passphrase: &str, salt: &[u8; SALT_LEN]) -> [u8; MASTER_KEY_LEN] {
    let params = Params::new(ARGON2_MEM_COST, ARGON2_TIME_COST, ARGON2_PARALLELISM, None)
        .expect("Invalid Argon2 params");

    let mut output = [0u8; MASTER_KEY_LEN];

    // Use Argon2id with raw output
    argon2::Argon2::new(argon2::Algorithm::Argon2id, argon2::Version::V0x13, params)
        .hash_password_into(passphrase.as_bytes(), salt, &mut output)
        .expect("Argon2 hashing failed");

    output
}

/// Hash a master key for verification
pub fn hash_master_key(key: &[u8; MASTER_KEY_LEN]) -> [u8; HASH_LEN] {
    let mut hasher = Sha256::new();
    hasher.update(key);
    let mut result = [0u8; HASH_LEN];
    result.copy_from_slice(&hasher.finalize());
    result
}

/// Wrap (encrypt) the master key with the wrapping key
pub fn wrap_master_key(
    master_key: &[u8; MASTER_KEY_LEN],
    wrapping_key: &[u8; MASTER_KEY_LEN],
) -> Result<Vec<u8>, EncryptionError> {
    let cipher = Aes256Gcm::new_from_slice(wrapping_key)
        .map_err(|e| EncryptionError::CryptoError(e.to_string()))?;

    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce, master_key.as_ref())
        .map_err(|e| EncryptionError::CryptoError(e.to_string()))?;

    // ciphertext includes the tag at the end
    if ciphertext.len() != MASTER_KEY_LEN + TAG_LEN {
        return Err(EncryptionError::CryptoError(
            "Unexpected ciphertext length".to_string(),
        ));
    }

    // Build output: nonce || ciphertext (with tag)
    let mut result = Vec::with_capacity(NONCE_LEN + ciphertext.len());
    result.extend_from_slice(&nonce);
    result.extend_from_slice(&ciphertext);

    Ok(result)
}

/// Unwrap (decrypt) the master key with the wrapping key
pub fn unwrap_master_key(
    wrapped_data: &[u8],
    wrapping_key: &[u8; MASTER_KEY_LEN],
) -> Result<[u8; MASTER_KEY_LEN], EncryptionError> {
    if wrapped_data.len() != NONCE_LEN + MASTER_KEY_LEN + TAG_LEN {
        return Err(EncryptionError::InvalidFormat(
            "Invalid wrapped data length".to_string(),
        ));
    }

    let nonce = Nonce::from_slice(&wrapped_data[..NONCE_LEN]);
    let ciphertext = &wrapped_data[NONCE_LEN..];

    let cipher = Aes256Gcm::new_from_slice(wrapping_key)
        .map_err(|e| EncryptionError::CryptoError(e.to_string()))?;

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| EncryptionError::DecryptionFailed)?;

    if plaintext.len() != MASTER_KEY_LEN {
        return Err(EncryptionError::InvalidFormat(
            "Decrypted key has wrong length".to_string(),
        ));
    }

    let mut key = [0u8; MASTER_KEY_LEN];
    key.copy_from_slice(&plaintext);
    Ok(key)
}

/// Save the wrapped key file
pub fn save_wrapped_key(
    salt: &[u8; SALT_LEN],
    wrapped_data: &[u8],
    key_hash: &[u8; HASH_LEN],
) -> Result<(), EncryptionError> {
    let data_dir = get_data_dir()?;
    std::fs::create_dir_all(&data_dir)?;

    let wrapped_key_path = data_dir.join(WRAPPED_KEY_FILE);

    // Build file: version || salt || nonce || ciphertext || tag || hash
    let mut buffer = Vec::with_capacity(TOTAL_FILE_SIZE);
    buffer.push(CURRENT_VERSION);
    buffer.extend_from_slice(salt);
    buffer.extend_from_slice(wrapped_data); // includes nonce, ciphertext, tag
    buffer.extend_from_slice(key_hash);

    if buffer.len() != TOTAL_FILE_SIZE {
        return Err(EncryptionError::InvalidFormat(format!(
            "Buffer size mismatch: expected {}, got {}",
            TOTAL_FILE_SIZE,
            buffer.len()
        )));
    }

    std::fs::write(&wrapped_key_path, buffer)?;

    log::info!("Wrapped key saved to: {:?}", wrapped_key_path);
    Ok(())
}

/// Load the wrapped key file
pub fn load_wrapped_key() -> Result<([u8; SALT_LEN], Vec<u8>, [u8; HASH_LEN]), EncryptionError> {
    let data_dir = get_data_dir()?;
    let wrapped_key_path = data_dir.join(WRAPPED_KEY_FILE);

    let buffer = std::fs::read(&wrapped_key_path)?;

    if buffer.len() != TOTAL_FILE_SIZE {
        return Err(EncryptionError::InvalidFormat(format!(
            "File size mismatch: expected {}, got {}",
            TOTAL_FILE_SIZE,
            buffer.len()
        )));
    }

    let version = buffer[OFFSET_VERSION];
    if version != CURRENT_VERSION {
        return Err(EncryptionError::InvalidFormat(format!(
            "Unknown version: {}",
            version
        )));
    }

    let mut salt = [0u8; SALT_LEN];
    salt.copy_from_slice(&buffer[OFFSET_SALT..OFFSET_NONCE]);

    // wrapped_data = nonce || ciphertext || tag
    let wrapped_data = buffer[OFFSET_NONCE..OFFSET_HASH].to_vec();

    let mut key_hash = [0u8; HASH_LEN];
    key_hash.copy_from_slice(&buffer[OFFSET_HASH..]);

    Ok((salt, wrapped_data, key_hash))
}

/// Convert bytes to hex string for SQLCipher
pub fn bytes_to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

/// Get master key from keychain
pub fn get_master_key_from_keychain(
    _app: &tauri::AppHandle,
) -> Result<Option<[u8; MASTER_KEY_LEN]>, EncryptionError> {
    use keyring::Entry;

    let entry = Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT)
        .map_err(|e| EncryptionError::KeychainError(e.to_string()))?;

    match entry.get_password() {
        Ok(hex_key) => {
            // Decode hex to bytes
            if hex_key.len() != MASTER_KEY_LEN * 2 {
                return Err(EncryptionError::KeychainError(
                    "Invalid key length in keychain".to_string(),
                ));
            }

            let mut key = [0u8; MASTER_KEY_LEN];
            for i in 0..MASTER_KEY_LEN {
                key[i] = u8::from_str_radix(&hex_key[i * 2..i * 2 + 2], 16).map_err(|_| {
                    EncryptionError::KeychainError("Invalid hex in keychain".to_string())
                })?;
            }

            log::info!("Retrieved master key from keychain");
            Ok(Some(key))
        }
        Err(keyring::Error::NoEntry) => {
            log::debug!("No key in keychain");
            Ok(None)
        }
        Err(e) => {
            log::debug!("Keychain error: {}", e);
            Ok(None)
        }
    }
}

/// Save master key to keychain
pub fn save_master_key_to_keychain(
    _app: &tauri::AppHandle,
    key: &[u8; MASTER_KEY_LEN],
) -> Result<(), EncryptionError> {
    use keyring::Entry;

    let entry = Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT)
        .map_err(|e| EncryptionError::KeychainError(e.to_string()))?;

    let hex_key = bytes_to_hex(key);

    entry
        .set_password(&hex_key)
        .map_err(|e| EncryptionError::KeychainError(e.to_string()))?;

    log::info!("Master key saved to keychain");
    Ok(())
}

/// Delete master key from keychain
pub fn delete_master_key_from_keychain(_app: &tauri::AppHandle) -> Result<(), EncryptionError> {
    use keyring::Entry;

    let entry = Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT)
        .map_err(|e| EncryptionError::KeychainError(e.to_string()))?;

    entry
        .delete_credential()
        .map_err(|e| EncryptionError::KeychainError(e.to_string()))?;

    log::info!("Master key deleted from keychain");
    Ok(())
}

/// Verify a master key against the expected hash
pub fn verify_master_key(key: &[u8; MASTER_KEY_LEN], expected_hash: &[u8; HASH_LEN]) -> bool {
    let computed_hash = hash_master_key(key);
    &computed_hash == expected_hash
}

/// Setup encryption: generate master key, wrap with passphrase, save to file and keychain
pub fn setup_encryption(app: &tauri::AppHandle, passphrase: &str) -> Result<(), EncryptionError> {
    log::info!("Setting up encryption with new passphrase");

    // Validate passphrase length
    if passphrase.len() < 12 {
        return Err(EncryptionError::InvalidFormat(
            "Passphrase must be at least 12 characters".to_string(),
        ));
    }

    // Generate master key
    let master_key = generate_master_key();

    // Generate salt
    let salt = generate_salt();

    // Derive wrapping key
    let mut wrapping_key = derive_wrapping_key(passphrase, &salt);

    // Wrap master key
    let wrapped_data = wrap_master_key(&master_key, &wrapping_key)?;

    // Hash master key for verification
    let key_hash = hash_master_key(&master_key);

    // Save wrapped key file
    save_wrapped_key(&salt, &wrapped_data, &key_hash)?;

    // Save to keychain
    save_master_key_to_keychain(app, &master_key)?;

    // Zero sensitive data
    wrapping_key.zeroize();

    log::info!("Encryption setup complete");
    Ok(())
}

/// Unlock with passphrase: decrypt wrapped key, verify, save to keychain
pub fn unlock_with_passphrase(
    app: &tauri::AppHandle,
    passphrase: &str,
) -> Result<(), EncryptionError> {
    log::info!("Attempting to unlock with passphrase");

    // Load wrapped key
    let (salt, wrapped_data, expected_hash) = load_wrapped_key()?;

    // Derive wrapping key
    let mut wrapping_key = derive_wrapping_key(passphrase, &salt);

    // Unwrap master key
    let master_key = unwrap_master_key(&wrapped_data, &wrapping_key)?;

    // Verify hash
    if !verify_master_key(&master_key, &expected_hash) {
        return Err(EncryptionError::VerificationFailed);
    }

    // Save to keychain
    save_master_key_to_keychain(app, &master_key)?;

    // Zero sensitive data
    wrapping_key.zeroize();

    log::info!("Unlock successful, key cached in keychain");
    Ok(())
}

/// Get master key for database encryption (from keychain or return error)
pub fn get_master_key_for_db(app: &tauri::AppHandle) -> Result<String, EncryptionError> {
    match get_master_key_from_keychain(app)? {
        Some(key) => Ok(bytes_to_hex(&key)),
        None => Err(EncryptionError::KeychainError(
            "No key in keychain - user must unlock first".to_string(),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_key_wrapping() {
        let master_key = generate_master_key();
        let wrapping_key = generate_master_key();

        let wrapped = wrap_master_key(&master_key, &wrapping_key).unwrap();
        let unwrapped = unwrap_master_key(&wrapped, &wrapping_key).unwrap();

        assert_eq!(master_key, unwrapped);
    }

    #[test]
    fn test_key_derivation() {
        let passphrase = "test-passphrase-for-phlox-encryption";
        let salt = generate_salt();

        let key1 = derive_wrapping_key(passphrase, &salt);
        let key2 = derive_wrapping_key(passphrase, &salt);

        assert_eq!(key1, key2, "Same passphrase + salt should produce same key");
    }

    #[test]
    fn test_hash_verification() {
        let key = generate_master_key();
        let hash = hash_master_key(&key);

        assert!(verify_master_key(&key, &hash));

        let wrong_key = generate_master_key();
        assert!(!verify_master_key(&wrong_key, &hash));
    }

    #[test]
    fn test_hex_conversion() {
        let key = [0x00, 0x01, 0x02, 0xff, 0xab, 0xcd, 0xef];
        let hex = bytes_to_hex(&key);

        assert_eq!(hex, "000102ffabcdef");
    }
}
