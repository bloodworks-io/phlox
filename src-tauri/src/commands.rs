use serde::{Deserialize, Serialize};
use std::process::Command;
use std::sync::Mutex;
use sysinfo::System;
use tauri::Manager;

use crate::encryption::{self, EncryptionError};
use crate::pm::{PmState, StatusData};

/// Cached service status snapshot from the in-process supervisor.
pub struct CachedServiceStatus(pub Mutex<Option<StatusData>>);

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
    pub dgpu_vram_gb: Option<f64>,
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

/// Take a status snapshot from the in-process supervisor (reaps dead children).
fn snapshot_status(pm_state: &PmState) -> StatusData {
    let mut state = pm_state.0.lock().unwrap();
    state.status()
}

/// Resolve a service port from a status snapshot, falling back to defaults.
fn port_from_status(status: &StatusData, service: &str) -> String {
    let info = match service {
        "llama" => status.llama.as_ref(),
        "whisper" => status.whisper.as_ref(),
        "server" => status.server.as_ref(),
        "embedding" => status.embedding.as_ref(),
        _ => None,
    };
    if let Some(info) = info {
        return info.port.to_string();
    }
    // Fallback to defaults
    match service {
        "llama" => "8082".to_string(),
        "whisper" => "8081".to_string(),
        "server" => "5000".to_string(),
        "embedding" => "8083".to_string(),
        _ => "0".to_string(),
    }
}

#[tauri::command]
pub fn get_server_port(pm_state: tauri::State<PmState>) -> String {
    let status = snapshot_status(&pm_state);
    port_from_status(&status, "server")
}

#[tauri::command]
pub fn get_llm_port(pm_state: tauri::State<PmState>) -> String {
    let status = snapshot_status(&pm_state);
    port_from_status(&status, "llama")
}

#[tauri::command]
pub fn get_whisper_port(pm_state: tauri::State<PmState>) -> String {
    let status = snapshot_status(&pm_state);
    port_from_status(&status, "whisper")
}

#[tauri::command]
pub fn get_embedding_port(pm_state: tauri::State<PmState>) -> String {
    let status = snapshot_status(&pm_state);
    port_from_status(&status, "embedding")
}

/// Get the request token for API authentication.
#[tauri::command]
pub fn get_request_token(webview: tauri::WebviewWindow, pm_state: tauri::State<PmState>) -> String {
    // Reject calls from unexpected webviews
    if webview.label() != "main" {
        log::warn!(
            "get_request_token rejected: caller webview='{}'",
            webview.label()
        );
        return String::new();
    }

    // Reject calls from unexpected contexts.
    if let Ok(url) = webview.url() {
        let scheme = url.scheme();
        let host = url.host_str();
        let is_tauri = scheme == "tauri"
            || host.is_some_and(|h| {
                h.ends_with(".localhost") && (scheme == "http" || scheme == "https")
            });
        let is_dev = cfg!(debug_assertions) && scheme == "http" && host == Some("localhost");
        if !is_tauri && !is_dev {
            log::warn!("get_request_token rejected: url='{}'", url);
            return String::new();
        }
    }

    let status = snapshot_status(&pm_state);
    status.request_token.unwrap_or_default()
}

#[tauri::command]
pub fn get_service_status(
    pm_state: tauri::State<PmState>,
    cached_status: tauri::State<CachedServiceStatus>,
) -> serde_json::Value {
    let status = snapshot_status(&pm_state);
    *cached_status.0.lock().unwrap() = Some(status.clone());

    serde_json::json!({
        "server_running": status.server.as_ref().map(|s| s.running).unwrap_or(false),
        "llama_running": status.llama.as_ref().map(|s| s.running).unwrap_or(false),
        "whisper_running": status.whisper.as_ref().map(|s| s.running).unwrap_or(false),
        "embedding_running": status.embedding.as_ref().map(|s| s.running).unwrap_or(false),
        "server_port": status.server.as_ref().map(|s| s.port).unwrap_or(5000),
        "llm_port": status.llama.as_ref().map(|s| s.port).unwrap_or(8082),
        "whisper_port": status.whisper.as_ref().map(|s| s.port).unwrap_or(8081),
        "embedding_port": status.embedding.as_ref().map(|s| s.port).unwrap_or(8083)
    })
}

#[tauri::command]
pub fn restart_whisper(
    _app_handle: tauri::AppHandle,
    pm_state: tauri::State<PmState>,
) -> Result<String, String> {
    log::info!("Restarting whisper-server...");

    let mut state = pm_state.0.lock().unwrap();
    let _ = state.stop("whisper");

    match state.start_whisper(None) {
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
pub fn start_llama_service(pm_state: tauri::State<PmState>) -> Result<String, String> {
    log::info!("Starting llama-server...");

    let mut state = pm_state.0.lock().unwrap();
    match state.start_llama(None) {
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
pub fn start_whisper_service(pm_state: tauri::State<PmState>) -> Result<String, String> {
    log::info!("Starting whisper-server...");

    let mut state = pm_state.0.lock().unwrap();
    match state.start_whisper(None) {
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
pub fn restart_llama(
    _app_handle: tauri::AppHandle,
    pm_state: tauri::State<PmState>,
) -> Result<String, String> {
    log::info!("Restarting llama-server...");

    let mut state = pm_state.0.lock().unwrap();
    let _ = state.stop("llama");

    match state.start_llama(None) {
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
pub fn start_embedding_service(pm_state: tauri::State<PmState>) -> Result<String, String> {
    log::info!("Starting embedding server...");

    let mut state = pm_state.0.lock().unwrap();
    match state.start_embedding(None) {
        Ok((pid, port)) => {
            log::info!("Embedding started with PID: {}, port: {}", pid, port);
            Ok(format!("Embedding server started with PID: {}", pid))
        }
        Err(e) => {
            log::error!("Failed to start embedding: {}", e);
            Err(format!("Failed to start embedding: {}", e))
        }
    }
}

#[tauri::command]
pub fn restart_embedding(
    _app_handle: tauri::AppHandle,
    pm_state: tauri::State<PmState>,
) -> Result<String, String> {
    log::info!("Restarting embedding server...");

    let mut state = pm_state.0.lock().unwrap();
    let _ = state.stop("embedding");

    match state.start_embedding(None) {
        Ok((pid, port)) => {
            log::info!("Embedding restarted with PID: {}, port: {}", pid, port);
            Ok(format!("Embedding server restarted with PID: {}", pid))
        }
        Err(e) => {
            log::error!("Failed to restart embedding: {}", e);
            Err(format!("Failed to restart embedding: {}", e))
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

    let apple_silicon = parse_apple_silicon(&cpu_brand).or_else(|| synthesize_perf_class());

    #[cfg(target_os = "linux")]
    let dgpu_vram_gb = detect_dgpu_vram_mb().map(|mb| mb as f64 / 1024.0);
    #[cfg(not(target_os = "linux"))]
    let dgpu_vram_gb = None;

    SystemSpecs {
        total_memory_gb: total_memory,
        available_memory_gb: available_memory,
        cpu_count,
        cpu_brand,
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        apple_silicon,
        dgpu_vram_gb,
    }
}

fn synthesize_perf_class() -> Option<AppleSiliconInfo> {
    #[cfg(target_os = "linux")]
    {
        let (gen, tier) = match detect_dgpu_vram_mb() {
            Some(v) if v >= 16384 => (3u8, "Ultra"),
            Some(v) if v >= 8192 => (3u8, "Max"),
            Some(v) if v >= 4096 => (3u8, "Pro"),
            Some(_) => (2u8, "Base"),
            None => (1u8, "Base"),
        };
        return Some(AppleSiliconInfo {
            is_apple_silicon: false,
            generation: Some(gen),
            tier: Some(tier.to_string()),
        });
    }
    #[cfg(not(target_os = "linux"))]
    {
        None
    }
}

#[cfg(target_os = "linux")]
fn detect_dgpu_vram_mb() -> Option<u64> {
    if let Some(mb) = nvidia_vram_mb() {
        return Some(mb);
    }

    if let Ok(drm) = std::fs::read_dir("/sys/class/drm") {
        let mut max_vram: u64 = 0;
        for entry in drm.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            if !name.starts_with("card") || name.contains('-') {
                continue;
            }
            if let Ok(s) =
                std::fs::read_to_string(entry.path().join("device/mem_info_vram_total"))
            {
                if let Ok(bytes) = s.trim().parse::<u64>() {
                    let mb = bytes / (1024 * 1024);
                    if mb > max_vram {
                        max_vram = mb;
                    }
                }
            }
        }
        if max_vram >= 2048 {
            return Some(max_vram);
        }
    }

    if let Ok(pci) = std::fs::read_dir("/sys/bus/pci/devices") {
        for entry in pci.flatten() {
            let class_path = entry.path().join("class");
            let vendor_path = entry.path().join("vendor");
            let class_s = match std::fs::read_to_string(&class_path) {
                Ok(s) => s,
                Err(_) => continue,
            };
            let vendor_s = match std::fs::read_to_string(&vendor_path) {
                Ok(s) => s,
                Err(_) => continue,
            };
            let class_val = match u32::from_str_radix(
                class_s.trim().trim_start_matches("0x"),
                16,
            ) {
                Ok(v) => v,
                Err(_) => continue,
            };
            let vendor_val = match u32::from_str_radix(
                vendor_s.trim().trim_start_matches("0x"),
                16,
            ) {
                Ok(v) => v,
                Err(_) => continue,
            };

            if (class_val == 0x030000 || class_val == 0x030200) && vendor_val == 0x10de {
                return Some(8 * 1024);
            }
        }
    }

    None
}

#[cfg(target_os = "linux")]
fn nvidia_vram_mb() -> Option<u64> {
    let out = std::process::Command::new("nvidia-smi")
        .args(["--query-gpu=memory.total", "--format=csv,noheader,nounits"])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    String::from_utf8_lossy(&out.stdout).trim().parse::<u64>().ok()
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

/// Start the Phlox server (warm start - no passphrase yet).
#[tauri::command]
pub async fn start_server_command(
    _app_handle: tauri::AppHandle,
    pm_state: tauri::State<'_, PmState>,
) -> Result<String, String> {
    log::info!("start_server_command called - warming up server");

    let mut state = pm_state.0.lock().unwrap();
    match state.start_server() {
        Ok(()) => {
            log::info!("Server started and waiting for passphrase");
            Ok("Server waiting for passphrase".to_string())
        }
        Err(e) => {
            log::error!("Failed to start server: {}", e);
            Err(format!("Failed to start server: {}", e))
        }
    }
}

/// Send passphrase to the waiting server.
#[tauri::command]
pub async fn send_passphrase_command(
    app_handle: tauri::AppHandle,
    passphrase_hex: String,
) -> Result<String, String> {
    log::info!("send_passphrase_command called");

    tauri::async_runtime::spawn_blocking(move || {
        let pm_state = app_handle.state::<PmState>();
        let mut state = pm_state.0.lock().unwrap();
        match state.send_passphrase(passphrase_hex) {
            Ok(ports) => {
                log::info!(
                    "Server unlocked; ports: server={}, llama={}, whisper={}, embedding={}",
                    ports.server,
                    ports.llama,
                    ports.whisper,
                    ports.embedding
                );
                Ok("Server unlocked".to_string())
            }
            Err(e) => {
                log::error!("Failed to send passphrase: {}", e);
                Err(format!("Failed to unlock server: {}", e))
            }
        }
    })
    .await
    .map_err(|e| format!("Passphrase task panicked: {}", e))?
}
