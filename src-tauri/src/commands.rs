use serde::{Deserialize, Serialize};
use std::process::Command;
use sysinfo::System;
use tauri::Manager;

use crate::process::{LlamaProcess, RestartCoordinator, ServerProcess, WhisperProcess};
use crate::services;

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

#[tauri::command]
pub fn get_server_port() -> String {
    if let Some(data_dir) = dirs::data_dir() {
        let port_file = data_dir.join("phlox").join("server_port.txt");
        if let Ok(port) = std::fs::read_to_string(&port_file) {
            return port.trim().to_string();
        }
    }
    "5000".to_string()
}

#[tauri::command]
pub fn get_llm_port() -> String {
    if let Some(data_dir) = dirs::data_dir() {
        let port_file = data_dir.join("phlox").join("llm_port.txt");
        if let Ok(port) = std::fs::read_to_string(&port_file) {
            return port.trim().to_string();
        }
    }
    "8082".to_string()
}

#[tauri::command]
pub fn get_whisper_port() -> String {
    if let Some(data_dir) = dirs::data_dir() {
        let port_file = data_dir.join("phlox").join("whisper_port.txt");
        if let Ok(port) = std::fs::read_to_string(&port_file) {
            return port.trim().to_string();
        }
    }
    "8081".to_string()
}

#[tauri::command]
pub fn get_service_status(
    server_state: tauri::State<ServerProcess>,
    llama_state: tauri::State<LlamaProcess>,
    whisper_state: tauri::State<WhisperProcess>,
) -> serde_json::Value {
    let server_running = server_state.0.lock().map(|g| g.is_some()).unwrap_or(false);
    let llama_running = llama_state.0.lock().map(|g| g.is_some()).unwrap_or(false);
    let whisper_running = whisper_state.0.lock().map(|g| g.is_some()).unwrap_or(false);

    serde_json::json!({
        "server_running": server_running,
        "llama_running": llama_running,
        "whisper_running": whisper_running,
        "server_port": get_server_port(),
        "llm_port": get_llm_port(),
        "whisper_port": get_whisper_port()
    })
}

#[tauri::command]
pub fn restart_whisper(app_handle: tauri::AppHandle) -> Result<String, String> {
    log::info!("Restarting whisper-server...");

    let coordinator = app_handle.state::<RestartCoordinator>();

    // Set restarting flag to prevent monitor loop interference
    coordinator
        .whisper_restarting
        .store(true, std::sync::atomic::Ordering::SeqCst);

    // Kill existing whisper process if running
    if let Ok(mut process_guard) = app_handle.state::<WhisperProcess>().0.lock() {
        if let Some(mut child) = process_guard.take() {
            let pid = child.id();
            log::info!("Killing existing whisper process PID: {}", pid);
            let _ = child.kill();
            let _ = child.wait(); // Wait for actual termination
        }
    }

    // Clean up PID file
    if let Some(data_dir) = dirs::data_dir() {
        let pid_file = data_dir.join("phlox").join("whisper.pid");
        if pid_file.exists() {
            let _ = std::fs::remove_file(&pid_file);
        }
    }

    // Start new whisper process
    match services::start_whisper() {
        Ok(new_child) => {
            let pid = new_child.id();
            *app_handle.state::<WhisperProcess>().0.lock().unwrap() = Some(new_child);
            log::info!("Whisper restarted with PID: {}", pid);

            // Clear restarting flag
            coordinator
                .whisper_restarting
                .store(false, std::sync::atomic::Ordering::SeqCst);

            Ok(format!("Whisper server restarted with PID: {}", pid))
        }
        Err(e) => {
            log::error!("Failed to restart Whisper: {}", e);

            // Clear restarting flag even on error
            coordinator
                .whisper_restarting
                .store(false, std::sync::atomic::Ordering::SeqCst);

            Err(format!("Failed to restart Whisper: {}", e))
        }
    }
}

#[tauri::command]
pub fn restart_llama(app_handle: tauri::AppHandle) -> Result<String, String> {
    log::info!("Restarting llama-server...");

    let coordinator = app_handle.state::<RestartCoordinator>();

    // Set restarting flag to prevent monitor loop interference
    coordinator
        .llama_restarting
        .store(true, std::sync::atomic::Ordering::SeqCst);

    // Kill existing llama process if running
    if let Ok(mut process_guard) = app_handle.state::<LlamaProcess>().0.lock() {
        if let Some(mut child) = process_guard.take() {
            let pid = child.id();
            log::info!("Killing existing llama process PID: {}", pid);
            let _ = child.kill();
            let _ = child.wait(); // Wait for actual termination
        }
    }

    // Clean up PID file
    if let Some(data_dir) = dirs::data_dir() {
        let pid_file = data_dir.join("phlox").join("llama.pid");
        if pid_file.exists() {
            let _ = std::fs::remove_file(&pid_file);
        }
    }

    // Start new llama process
    match services::start_llama() {
        Ok(new_child) => {
            let pid = new_child.id();
            *app_handle.state::<LlamaProcess>().0.lock().unwrap() = Some(new_child);
            log::info!("Llama restarted with PID: {}", pid);

            // Clear restarting flag
            coordinator
                .llama_restarting
                .store(false, std::sync::atomic::Ordering::SeqCst);

            Ok(format!("Llama server restarted with PID: {}", pid))
        }
        Err(e) => {
            log::error!("Failed to restart Llama: {}", e);

            // Clear restarting flag even on error
            coordinator
                .llama_restarting
                .store(false, std::sync::atomic::Ordering::SeqCst);

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
