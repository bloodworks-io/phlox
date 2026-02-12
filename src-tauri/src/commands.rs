use serde::{Deserialize, Serialize};
use std::process::Command;
use std::sync::Mutex;
use sysinfo::System;

use crate::encryption::{self, EncryptionError};
use crate::pm_client::{ProcessManagerClient, ServiceStatusData};

/// Cached service status from PM
pub struct CachedServiceStatus(pub Mutex<Option<ServiceStatusData>>);

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppleSiliconInfo {
    pub is_apple_silicon: bool,
    pub generation: Option<u8>,
    pub tier: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct SystemSpecs {
    pub total_memory_gb: f64,
    pub available_memory_gb: f64,
    pub cpu_count: usize,
    pub cpu_brand: String,
    pub os: String,
    pub arch: String,
    pub apple_silicon: Option<AppleSiliconInfo>,
}

fn parse_apple_silicon(cpu_brand: &str) -> Option<AppleSiliconInfo> {
    let brand = cpu_brand.trim();

    // Check if it's an Apple Silicon chip
    if !brand.starts_with("Apple ") || !brand.contains('M') {
        return None;
    }

    // Parse "Apple M3 Pro" -> gen=3, tier="Pro"
    // Extract the number after "M"
    let m_pos = brand.find('M')?;
    let after_m = &brand[m_pos + 1..];

    // Parse generation (1-4, potentially more in future)
    let gen_str: String = after_m.chars().take_while(|c| c.is_ascii_digit()).collect();
    let generation: u8 = gen_str.parse().ok()?;

    // Parse tier (Pro/Max/Ultra) - case insensitive
    let remaining = after_m[gen_str.len()..].trim().to_lowercase();
    let tier = match remaining.as_str() {
        "pro" => "Pro".to_string(),
        "max" => "Max".to_string(),
        "ultra" => "Ultra".to_string(),
        _ => "Base".to_string(),
    };

    Some(AppleSiliconInfo {
        is_apple_silicon: true,
        generation: Some(generation),
        tier: Some(tier),
    })
}

/// Refresh cached status from PM
fn refresh_cached_status() -> Option<ServiceStatusData> {
    match ProcessManagerClient::new() {
        Ok(client) => match client.status() {
            Ok(status) => Some(status),
            Err(e) => {
                log::warn!("Failed to get status from PM: {}", e);
                None
            }
        },
        Err(_) => None,
    }
}

/// Get a cached port value
fn get_cached_port(service: &str) -> String {
    if let Some(status) = refresh_cached_status() {
        let info = match service {
            "llama" => status.llama,
            "whisper" => status.whisper,
            "server" => status.server,
            _ => None,
        };
        if let Some(info) = info {
            return info.port.to_string();
        }
    }
    // Fallback to defaults
    match service {
        "llama" => "8082".to_string(),
        "whisper" => "8081".to_string(),
        "server" => "5000".to_string(),
        _ => "0".to_string(),
    }
}

#[tauri::command]
pub fn get_server_port() -> String {
    get_cached_port("server")
}

#[tauri::command]
pub fn get_llm_port() -> String {
    get_cached_port("llama")
}

#[tauri::command]
pub fn get_whisper_port() -> String {
    get_cached_port("whisper")
}

#[tauri::command]
pub fn get_service_status(cached_status: tauri::State<CachedServiceStatus>) -> serde_json::Value {
    // Refresh and cache the status
    if let Some(status) = refresh_cached_status() {
        *cached_status.0.lock().unwrap() = Some(status.clone());

        serde_json::json!({
            "server_running": status.server.as_ref().map(|s| s.running).unwrap_or(false),
            "llama_running": status.llama.as_ref().map(|s| s.running).unwrap_or(false),
            "whisper_running": status.whisper.as_ref().map(|s| s.running).unwrap_or(false),
            "server_port": status.server.as_ref().map(|s| s.port).unwrap_or(5000),
            "llm_port": status.llama.as_ref().map(|s| s.port).unwrap_or(8082),
            "whisper_port": status.whisper.as_ref().map(|s| s.port).unwrap_or(8081)
        })
    } else {
        // PM not available, return defaults
        serde_json::json!({
            "server_running": false,
            "llama_running": false,
            "whisper_running": false,
            "server_port": "5000",
            "llm_port": "8082",
            "whisper_port": "8081"
        })
    }
}

#[tauri::command]
pub fn restart_whisper(_app_handle: tauri::AppHandle) -> Result<String, String> {
    log::info!("Restarting whisper-server via PM...");

    let client = ProcessManagerClient::new()
        .map_err(|e| format!("Failed to connect to process manager: {}", e))?;

    // First stop if running
    let _ = client.stop("whisper");

    // Then start
    match client.start_whisper(None) {
        Ok((pid, port)) => {
            log::info!("Whisper restarted with PID: {}, port: {}", pid, port);
            Ok(format!("Whisper server restarted with PID: {}", pid))
        }
        Err(e) => {
            log::error!("Failed to restart Whisper: {}", e);
            Err(format!("Failed to restart Whisper: {}", e))
        }
    }
}

#[tauri::command]
pub fn start_llama_service() -> Result<String, String> {
    log::info!("Starting llama-server via PM...");

    let client = ProcessManagerClient::new()
        .map_err(|e| format!("Failed to connect to process manager: {}", e))?;

    match client.start_llama(None) {
        Ok((pid, port)) => {
            log::info!("Llama started with PID: {}, port: {}", pid, port);
            Ok(format!("Llama server started with PID: {}", pid))
        }
        Err(e) => {
            log::error!("Failed to start Llama: {}", e);
            Err(format!("Failed to start Llama: {}", e))
        }
    }
}

#[tauri::command]
pub fn start_whisper_service() -> Result<String, String> {
    log::info!("Starting whisper-server via PM...");

    let client = ProcessManagerClient::new()
        .map_err(|e| format!("Failed to connect to process manager: {}", e))?;

    match client.start_whisper(None) {
        Ok((pid, port)) => {
            log::info!("Whisper started with PID: {}, port: {}", pid, port);
            Ok(format!("Whisper server started with PID: {}", pid))
        }
        Err(e) => {
            log::error!("Failed to start Whisper: {}", e);
            Err(format!("Failed to start Whisper: {}", e))
        }
    }
}

#[tauri::command]
pub fn restart_llama(_app_handle: tauri::AppHandle) -> Result<String, String> {
    log::info!("Restarting llama-server via PM...");

    let client = ProcessManagerClient::new()
        .map_err(|e| format!("Failed to connect to process manager: {}", e))?;

    // First stop if running
    let _ = client.stop("llama");

    // Then start
    match client.start_llama(None) {
        Ok((pid, port)) => {
            log::info!("Llama restarted with PID: {}, port: {}", pid, port);
            Ok(format!("Llama server restarted with PID: {}", pid))
        }
        Err(e) => {
            log::error!("Failed to restart Llama: {}", e);
            Err(format!("Failed to restart Llama: {}", e))
        }
    }
}

#[tauri::command]
pub fn convert_audio_to_wav(audio_bytes: Vec<u8>) -> Result<Vec<u8>, String> {
    use std::io::Write;

    // Only implement for macOS where afconvert is available
    #[cfg(not(target_os = "macos"))]
    {
        return Err(
            "Audio conversion is only supported on macOS. For other platforms, ensure audio is already in WAV format.".to_string()
        );
    }

    #[cfg(target_os = "macos")]
    {
        log::info!(
            "Converting audio to WAV format ({} bytes)",
            audio_bytes.len()
        );

        // Create a temporary directory for audio conversion
        let temp_dir = std::env::temp_dir();
        let phlox_temp = temp_dir.join("phlox_audio");
        std::fs::create_dir_all(&phlox_temp)
            .map_err(|e| format!("Failed to create temp directory: {}", e))?;

        // Generate unique filenames using timestamp
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| format!("Failed to get timestamp: {}", e))?
            .as_micros();
        let input_path = phlox_temp.join(format!("input_{}.audio", timestamp));
        let output_path = phlox_temp.join(format!("output_{}.wav", timestamp));

        // Write input audio bytes to temp file
        let mut input_file = std::fs::File::create(&input_path)
            .map_err(|e| format!("Failed to create input file: {}", e))?;
        input_file
            .write_all(&audio_bytes)
            .map_err(|e| format!("Failed to write input file: {}", e))?;
        drop(input_file); // Ensure file is flushed and closed before afconvert

        log::debug!("Input file created: {:?}", input_path);

        // Run afconvert to convert to WAV (16kHz, mono, 16-bit PCM - whisper.cpp preferred format)
        let output = Command::new("afconvert")
            .arg("-f")
            .arg("WAVE")
            .arg("-d")
            .arg("LEI16@16000")
            .arg(&input_path)
            .arg("-o")
            .arg(&output_path)
            .output();

        // Clean up input file regardless of conversion result
        let _ = std::fs::remove_file(&input_path);

        match output {
            Ok(result) => {
                if !result.status.success() {
                    let stderr = String::from_utf8_lossy(&result.stderr);
                    log::error!("afconvert failed: {}", stderr);
                    return Err(format!("Audio conversion failed: {}", stderr));
                }
            }
            Err(e) => {
                log::error!("Failed to run afconvert: {}", e);
                return Err(format!(
                    "Failed to run afconvert: {}. Is afconvert available on this system?",
                    e
                ));
            }
        }

        // Read the converted WAV file
        let wav_bytes = std::fs::read(&output_path)
            .map_err(|e| format!("Failed to read converted WAV file: {}", e))?;

        // Clean up output file
        let _ = std::fs::remove_file(&output_path);

        log::info!(
            "Audio conversion successful: {} bytes -> {} bytes",
            audio_bytes.len(),
            wav_bytes.len()
        );

        Ok(wav_bytes)
    }
}

#[tauri::command]
pub fn get_system_specs() -> SystemSpecs {
    let mut sys = System::new_all();
    sys.refresh_all();

    let total_memory = sys.total_memory() as f64 / (1024.0 * 1024.0 * 1024.0);
    let available_memory = sys.available_memory() as f64 / (1024.0 * 1024.0 * 1024.0);

    let cpu_count = sys.cpus().len();
    let cpu_brand = sys
        .cpus()
        .first()
        .map(|cpu| cpu.brand().to_string())
        .unwrap_or_else(|| "Unknown".to_string());

    let apple_silicon = parse_apple_silicon(&cpu_brand);

    SystemSpecs {
        total_memory_gb: total_memory,
        available_memory_gb: available_memory,
        cpu_count,
        cpu_brand,
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        apple_silicon,
    }
}

// ============================================================================
// Encryption Commands
// ============================================================================

/// Check if encryption has been set up (database file exists)
#[tauri::command]
pub fn has_encryption_setup() -> bool {
    encryption::has_encryption_setup()
}

/// Check if database file exists
#[tauri::command]
pub fn has_database() -> bool {
    encryption::database_exists()
}

/// Check if passphrase is cached in keychain
/// Always returns false since we don't use keychain caching (PHI requirement)
#[tauri::command]
pub fn has_keychain_entry() -> bool {
    encryption::has_keychain_entry()
}

/// Set up encryption with a new passphrase
/// Returns hex-encoded passphrase for immediate use with start_server_command
#[tauri::command]
pub fn setup_encryption(passphrase: String) -> Result<String, String> {
    log::info!("setup_encryption called");

    encryption::setup_encryption(&passphrase).map_err(|e| match e {
        EncryptionError::PassphraseTooShort => {
            "Passphrase must be at least 12 characters".to_string()
        }
        _ => format!("Failed to set up encryption: {}", e),
    })
}

/// Unlock with passphrase
/// Returns hex-encoded passphrase for immediate use with start_server_command
/// Note: Verification happens when Python tries to open the database
#[tauri::command]
pub fn unlock_with_passphrase(passphrase: String) -> Result<String, String> {
    log::info!("unlock_with_passphrase called");

    encryption::unlock_with_passphrase(&passphrase).map_err(|e| match e {
        EncryptionError::PassphraseRequired => "Passphrase required".to_string(),
        _ => format!("Failed to unlock: {}", e),
    })
}

/// Change passphrase (future enhancement - placeholder)
#[tauri::command]
pub fn change_passphrase(_old_passphrase: String, _new_passphrase: String) -> Result<(), String> {
    log::info!("change_passphrase called - not yet implemented");
    Err("Passphrase change is not yet implemented".to_string())
}

/// Clear keychain (no-op since we don't use keychain)
#[tauri::command]
pub fn clear_keychain() -> Result<(), String> {
    log::info!("clear_keychain called - no-op (no keychain used)");
    Ok(())
}

/// Get encryption setup status for UI
#[tauri::command]
pub fn get_encryption_status() -> serde_json::Value {
    let has_setup = encryption::has_encryption_setup();
    let has_db = encryption::database_exists();
    let has_keychain = encryption::has_keychain_entry();

    serde_json::json!({
        "has_setup": has_setup,
        "has_database": has_db,
        "has_keychain": has_keychain
    })
}

/// Start the Phlox server via process manager (called from frontend after encryption setup/unlock)
#[tauri::command]
pub async fn start_server_command(
    _app_handle: tauri::AppHandle,
    passphrase_hex: String,
) -> Result<String, String> {
    log::info!("start_server_command called from frontend");

    let client = ProcessManagerClient::new()
        .map_err(|e| format!("Failed to connect to process manager: {}", e))?;

    match client.start_server(passphrase_hex) {
        Ok((pid, server_port, llama_port, whisper_port)) => {
            log::info!(
                "Server started with PID: {}, ports: server={}, llama={}, whisper={}",
                pid,
                server_port,
                llama_port,
                whisper_port
            );

            // Wait for server to be ready in background
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(2));
                log::info!("Server should be ready now");
            });

            Ok(format!("Server started with PID: {}", pid))
        }
        Err(e) => {
            log::error!("Failed to start server: {}", e);
            Err(format!("Failed to start server: {}", e))
        }
    }
}
