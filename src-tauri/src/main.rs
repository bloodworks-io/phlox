use log::LevelFilter;
use serde::{Deserialize, Serialize};
use std::process::{Child, Command};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use sysinfo::System;
use tauri::Manager;
use tauri_plugin_log::{Target, TargetKind};

struct ServerProcess(Mutex<Option<Child>>);
struct LlamaProcess(Mutex<Option<Child>>);
struct WhisperProcess(Mutex<Option<Child>>);

fn kill_all_processes() {
    log::info!("Killing all existing server and llama-server processes...");

    // Kill server processes
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("pkill")
            .arg("-f")
            .arg("server_dist/server")
            .output();

        let _ = std::process::Command::new("pkill")
            .arg("-f")
            .arg("llama-server")
            .output();
    }

    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("taskkill")
            .arg("/F")
            .arg("/IM")
            .arg("server.exe")
            .output();

        let _ = std::process::Command::new("taskkill")
            .arg("/F")
            .arg("/IM")
            .arg("llama-server.exe")
            .output();
    }

    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("pkill")
            .arg("-f")
            .arg("server_dist/server")
            .output();

        let _ = std::process::Command::new("pkill")
            .arg("-f")
            .arg("llama-server")
            .output();
    }

    std::thread::sleep(std::time::Duration::from_millis(1000));
}

fn cleanup_stale_files() {
    if let Some(data_dir) = dirs::data_dir() {
        let phlox_dir = data_dir.join("phlox");

        // Clean up port files
        let port_file = phlox_dir.join("server_port.txt");
        if port_file.exists() {
            let _ = std::fs::remove_file(&port_file);
        }

        let llm_port_file = phlox_dir.join("llm_port.txt");
        if llm_port_file.exists() {
            let _ = std::fs::remove_file(&llm_port_file);
        }

        let whisper_port_file = phlox_dir.join("whisper_port.txt");
        if whisper_port_file.exists() {
            let _ = std::fs::remove_file(&whisper_port_file);
        }
    }
}

fn find_llama_model(models_dir: &std::path::Path) -> Option<std::path::PathBuf> {
    // First try reading from llm_model.txt if it exists
    if let Some(data_dir) = dirs::data_dir() {
        let phlox_dir = data_dir.join("phlox");
        let model_file = phlox_dir.join("llm_model.txt");
        if let Ok(model_filename) = std::fs::read_to_string(&model_file) {
            let model_filename = model_filename.trim();
            let model_path = models_dir.join(model_filename);
            if model_path.exists() {
                log::info!("Using model from llm_model.txt: {}", model_filename);
                return Some(model_path);
            }
        }
    }

    // Scan for any .gguf file
    if let Ok(entries) = std::fs::read_dir(models_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("gguf") {
                log::info!("Found LLM model: {:?}", path);
                return Some(path);
            }
        }
    }

    None
}

fn start_llama(_app_handle: tauri::AppHandle) -> Result<Child, Box<dyn std::error::Error>> {
    let current_exe = std::env::current_exe().expect("failed to get current executable path");
    let exe_dir = current_exe
        .parent()
        .expect("failed to get executable directory");

    #[cfg(target_os = "windows")]
    let llama_path = exe_dir.join("llama-server.exe");
    #[cfg(not(target_os = "windows"))]
    let llama_path = exe_dir.join("llama-server");

    log::info!("Starting llama-server from: {:?}", llama_path);

    if !llama_path.exists() {
        return Err(format!(
            "llama-server binary not found at {:?}. Run './src-tauri/build-llama.sh' to build it.",
            llama_path
        )
        .into());
    }

    // Set up models directory in app data
    let models_dir = if let Some(data_dir) = dirs::data_dir() {
        let dir = data_dir.join("phlox").join("llm_models");
        std::fs::create_dir_all(&dir).ok();
        dir
    } else {
        return Err("Could not determine data directory".into());
    };

    // Find the model to use - either from llm_model.txt or scan for any .gguf file
    let model_path = find_llama_model(&models_dir);

    // If no model found, return an error - caller should handle this gracefully
    let model_path = match model_path {
        Some(path) => path,
        None => {
            return Err(format!(
                "No LLM model found in {:?}. Please download a model via Settings.",
                models_dir
            )
            .into());
        }
    };

    log::info!("Using LLM model: {:?}", model_path);

    let mut cmd = Command::new(&llama_path);

    // llama-server arguments
    // Use a fixed port (8082) to avoid port discovery complexity
    cmd.arg("--port")
        .arg("8082")
        .arg("--host")
        .arg("127.0.0.1")
        .arg("--model")
        .arg(&model_path.to_string_lossy().to_string())
        .arg("--ctx-size")
        .arg("8192")
        .arg("--n-gpu-layers")
        .arg("99"); // Use GPU for all layers on macOS

    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }

    cmd.stdout(std::process::Stdio::inherit())
        .stderr(std::process::Stdio::inherit());

    let child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn llama-server process: {}", e))?;

    log::info!("llama-server started with PID: {}", child.id());

    // Write the port to file immediately (we use fixed port 8082)
    if let Some(data_dir) = dirs::data_dir() {
        let phlox_dir = data_dir.join("phlox");
        std::fs::create_dir_all(&phlox_dir).ok();
        let port_file = phlox_dir.join("llm_port.txt");
        std::fs::write(&port_file, "8082").ok();
        log::info!("LLM port file written to: {:?}", port_file);
    }

    Ok(child)
}

fn find_model(models_dir: &std::path::Path) -> Option<std::path::PathBuf> {
    // First try reading from whisper_model.txt if it exists
    if let Some(data_dir) = dirs::data_dir() {
        let phlox_dir = data_dir.join("phlox");
        let model_file = phlox_dir.join("whisper_model.txt");
        if let Ok(model_id) = std::fs::read_to_string(&model_file) {
            let model_id = model_id.trim();
            let model_path = models_dir.join(format!("ggml-{}.bin", model_id));
            if model_path.exists() {
                log::info!("Using model from whisper_model.txt: {}", model_id);
                return Some(model_path);
            }
        }
    }

    // Otherwise scan for any ggml-*.bin file
    if let Ok(entries) = std::fs::read_dir(models_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("bin") {
                let file_name = path.file_name().and_then(|s| s.to_str()).unwrap_or("");
                if file_name.starts_with("ggml-") {
                    log::info!("Found Whisper model: {}", file_name);
                    return Some(path);
                }
            }
        }
    }

    None
}

fn start_whisper(_app_handle: tauri::AppHandle) -> Result<Child, Box<dyn std::error::Error>> {
    let current_exe = std::env::current_exe().expect("failed to get current executable path");
    let exe_dir = current_exe
        .parent()
        .expect("failed to get executable directory");

    #[cfg(target_os = "windows")]
    let whisper_path = exe_dir.join("whisper-server.exe");
    #[cfg(not(target_os = "windows"))]
    let whisper_path = exe_dir.join("whisper-server");

    log::info!("Starting whisper-server from: {:?}", whisper_path);

    if !whisper_path.exists() {
        return Err(format!(
            "whisper-server binary not found at {:?}. Run './src-tauri/build-whisper.sh' to build it.",
            whisper_path
        )
        .into());
    }

    // Set up models directory in app data
    let models_dir = if let Some(data_dir) = dirs::data_dir() {
        let dir = data_dir.join("phlox").join("whisper_models");
        std::fs::create_dir_all(&dir).ok();
        dir
    } else {
        return Err("Could not determine data directory".into());
    };

    // Find the model to use - either from whisper_model.txt or scan for any ggml-*.bin file
    let model_path = find_model(&models_dir);

    // If no model found, return an error - caller should handle this gracefully
    let model_path = match model_path {
        Some(path) => path,
        None => {
            return Err(format!(
                "No Whisper model found in {:?}. Please download a model via Settings.",
                models_dir
            )
            .into());
        }
    };

    log::info!("Using Whisper model: {:?}", model_path);

    let mut cmd = Command::new(&whisper_path);

    // whisper.cpp server arguments
    // Use a fixed port (8081) to avoid port discovery complexity
    cmd.arg("--port")
        .arg("8081")
        .arg("--host")
        .arg("127.0.0.1")
        .arg("--model")
        .arg(&model_path.to_string_lossy().to_string());

    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }

    cmd.stdout(std::process::Stdio::inherit())
        .stderr(std::process::Stdio::inherit());

    let child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn whisper-server process: {}", e))?;

    log::info!("Whisper server started with PID: {}", child.id());

    // Write the port to file immediately (we use fixed port 8081)
    if let Some(data_dir) = dirs::data_dir() {
        let phlox_dir = data_dir.join("phlox");
        std::fs::create_dir_all(&phlox_dir).ok();
        let port_file = phlox_dir.join("whisper_port.txt");
        std::fs::write(&port_file, "8081").ok();
        log::info!("Whisper port file written to: {:?}", port_file);
    }

    Ok(child)
}

fn start_server(_app_handle: tauri::AppHandle) -> Result<Child, Box<dyn std::error::Error>> {
    let current_exe = std::env::current_exe().expect("failed to get current executable path");
    let exe_dir = current_exe
        .parent()
        .expect("failed to get executable directory");
    let server_path = exe_dir.join("server_dist").join("server");

    log::info!("Starting server from: {:?}", server_path);

    if !server_path.exists() {
        return Err(format!(
            "Server binary not found at {:?}. Please run './build-server.sh' first.",
            server_path
        )
        .into());
    }

    let mut cmd = Command::new(&server_path);

    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }

    cmd.stdout(std::process::Stdio::inherit())
        .stderr(std::process::Stdio::inherit());

    let child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn server process: {}", e))?;

    log::info!("Server started with PID: {}", child.id());
    Ok(child)
}

fn wait_for_service(service_name: &str, port: &str, timeout_seconds: u64) -> bool {
    use std::net::{SocketAddr, TcpStream};

    for i in 0..timeout_seconds {
        let addr = format!("127.0.0.1:{}", port);
        if let Ok(socket_addr) = addr.parse::<SocketAddr>() {
            if TcpStream::connect_timeout(&socket_addr, Duration::from_secs(1)).is_ok() {
                log::info!("{} is ready on port {}", service_name, port);
                return true;
            }
        }

        if i % 10 == 0 {
            log::info!(
                "Waiting for {} to start... {}/{}",
                service_name,
                i + 1,
                timeout_seconds
            );
        }
        thread::sleep(Duration::from_secs(1));
    }

    log::warn!(
        "{} did not start within {} seconds",
        service_name,
        timeout_seconds
    );
    false
}

fn wait_for_server() {
    thread::sleep(Duration::from_secs(2));

    for i in 0..60 {
        if let Some(data_dir) = dirs::data_dir() {
            let port_file = data_dir.join("phlox").join("server_port.txt");
            if port_file.exists() {
                if let Ok(port) = std::fs::read_to_string(&port_file) {
                    log::info!("Server running on port: {}", port.trim());
                    return;
                }
            }
        }
        if i % 10 == 0 {
            log::info!("Still waiting for server port file... attempt {}/60", i + 1);
        }
        thread::sleep(Duration::from_secs(1));
    }
    log::warn!("Warning: Could not detect server port after 60 seconds");
}

fn monitor_processes(app_handle: tauri::AppHandle, monitor_whisper: bool) {
    thread::spawn(move || {
        log::info!("Starting process monitor thread");

        loop {
            thread::sleep(Duration::from_secs(10));

            // Check server process
            if let Ok(mut process_guard) = app_handle.state::<ServerProcess>().0.lock() {
                if let Some(ref mut child) = *process_guard {
                    match child.try_wait() {
                        Ok(Some(exit_status)) => {
                            log::error!("Server process exited with status: {:?}", exit_status);
                            *process_guard = None;

                            // Restart server
                            match start_server(app_handle.clone()) {
                                Ok(new_child) => {
                                    log::info!("Server restarted with PID: {}", new_child.id());
                                    *process_guard = Some(new_child);
                                }
                                Err(e) => log::error!("Failed to restart server: {}", e),
                            }
                        }
                        Ok(None) => {
                            // Process is still running
                        }
                        Err(e) => {
                            log::error!("Error checking server process: {}", e);
                        }
                    }
                }
            }

            // Check Llama process
            if let Ok(mut process_guard) = app_handle.state::<LlamaProcess>().0.lock() {
                if let Some(ref mut child) = *process_guard {
                    match child.try_wait() {
                        Ok(Some(exit_status)) => {
                            log::error!("Llama process exited with status: {:?}", exit_status);
                            *process_guard = None;

                            // Restart Llama
                            match start_llama(app_handle.clone()) {
                                Ok(new_child) => {
                                    log::info!("Llama restarted with PID: {}", new_child.id());
                                    *process_guard = Some(new_child);
                                }
                                Err(e) => {
                                    log::error!("Failed to restart Llama: {}", e);
                                    log::info!("Llama will restart after model download");
                                }
                            }
                        }
                        Ok(None) => {
                            // Process is still running
                        }
                        Err(e) => {
                            log::error!("Error checking Llama process: {}", e);
                        }
                    }
                }
            }

            // Check Whisper process (only if we started it successfully)
            if monitor_whisper {
                if let Ok(mut process_guard) = app_handle.state::<WhisperProcess>().0.lock() {
                    if let Some(ref mut child) = *process_guard {
                        match child.try_wait() {
                            Ok(Some(exit_status)) => {
                                log::error!(
                                    "Whisper process exited with status: {:?}",
                                    exit_status
                                );
                                *process_guard = None;

                                // Restart Whisper
                                match start_whisper(app_handle.clone()) {
                                    Ok(new_child) => {
                                        log::info!(
                                            "Whisper restarted with PID: {}",
                                            new_child.id()
                                        );
                                        *process_guard = Some(new_child);
                                    }
                                    Err(e) => log::error!("Failed to restart Whisper: {}", e),
                                }
                            }
                            Ok(None) => {
                                // Process is still running
                            }
                            Err(e) => {
                                log::error!("Error checking Whisper process: {}", e);
                            }
                        }
                    }
                }
            }
        }
    });
}

#[tauri::command]
fn get_server_port() -> String {
    if let Some(data_dir) = dirs::data_dir() {
        let port_file = data_dir.join("phlox").join("server_port.txt");
        if let Ok(port) = std::fs::read_to_string(&port_file) {
            return port.trim().to_string();
        }
    }
    "5000".to_string()
}

#[tauri::command]
fn get_llm_port() -> String {
    if let Some(data_dir) = dirs::data_dir() {
        let port_file = data_dir.join("phlox").join("llm_port.txt");
        if let Ok(port) = std::fs::read_to_string(&port_file) {
            return port.trim().to_string();
        }
    }
    "8082".to_string()
}

#[tauri::command]
fn get_whisper_port() -> String {
    if let Some(data_dir) = dirs::data_dir() {
        let port_file = data_dir.join("phlox").join("whisper_port.txt");
        if let Ok(port) = std::fs::read_to_string(&port_file) {
            return port.trim().to_string();
        }
    }
    "8081".to_string()
}

#[tauri::command]
fn get_service_status(
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
fn restart_whisper(app_handle: tauri::AppHandle) -> Result<String, String> {
    log::info!("Restarting whisper-server...");

    // Kill existing whisper process if running
    if let Ok(mut process_guard) = app_handle.state::<WhisperProcess>().0.lock() {
        if let Some(mut child) = process_guard.take() {
            log::info!("Killing existing whisper process PID: {}", child.id());
            let _ = child.kill();
            let _ = child.wait();
            thread::sleep(Duration::from_millis(500));
        }
    }

    // Start new whisper process
    match start_whisper(app_handle.clone()) {
        Ok(new_child) => {
            let pid = new_child.id();
            *app_handle.state::<WhisperProcess>().0.lock().unwrap() = Some(new_child);
            log::info!("Whisper restarted with PID: {}", pid);
            Ok(format!("Whisper server restarted with PID: {}", pid))
        }
        Err(e) => {
            log::error!("Failed to restart Whisper: {}", e);
            Err(format!("Failed to restart Whisper: {}", e))
        }
    }
}

#[tauri::command]
fn restart_llama(app_handle: tauri::AppHandle) -> Result<String, String> {
    log::info!("Restarting llama-server...");

    // Kill existing llama process if running
    if let Ok(mut process_guard) = app_handle.state::<LlamaProcess>().0.lock() {
        if let Some(mut child) = process_guard.take() {
            log::info!("Killing existing llama process PID: {}", child.id());
            let _ = child.kill();
            let _ = child.wait();
            thread::sleep(Duration::from_millis(500));
        }
    }

    // Start new llama process
    match start_llama(app_handle.clone()) {
        Ok(new_child) => {
            let pid = new_child.id();
            *app_handle.state::<LlamaProcess>().0.lock().unwrap() = Some(new_child);
            log::info!("Llama restarted with PID: {}", pid);
            Ok(format!("Llama server restarted with PID: {}", pid))
        }
        Err(e) => {
            log::error!("Failed to restart Llama: {}", e);
            Err(format!("Failed to restart Llama: {}", e))
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let log_plugin = tauri_plugin_log::Builder::default()
        .targets([
            Target::new(TargetKind::Stdout),
            Target::new(TargetKind::LogDir {
                file_name: Some("phlox-app.log".into()),
            }),
        ])
        .level(LevelFilter::Debug)
        .build();

    tauri::Builder::default()
        .plugin(log_plugin)
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .manage(ServerProcess(Mutex::new(None)))
        .manage(LlamaProcess(Mutex::new(None)))
        .manage(WhisperProcess(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            get_server_port,
            get_llm_port,
            get_whisper_port,
            get_service_status,
            get_system_specs,
            restart_whisper,
            restart_llama,
            convert_audio_to_wav
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();
            log::info!("App setup started");

            // Clean up any existing processes and files
            kill_all_processes();
            cleanup_stale_files();

            // Start Llama (optional - may fail if no model downloaded)
            let llama_started = start_llama(app_handle.clone()).is_ok();

            if llama_started {
                log::info!("Llama server started successfully");
            } else {
                log::warn!("Llama server did not start (no model downloaded yet - this is OK)");
            }

            // Start the rest of the app regardless of Llama status
            thread::spawn(move || {
                // If Llama started, wait for it to be ready
                if llama_started {
                    if !wait_for_service("Llama", "8082", 30) {
                        log::warn!("Llama server did not become ready, but continuing...");
                    }
                }

                // Start Whisper server (optional - may fail if no model)
                let whisper_started = start_whisper(app_handle.clone()).is_ok();

                if whisper_started {
                    log::info!("Whisper server started successfully");
                } else {
                    log::warn!(
                        "Whisper server did not start (no model downloaded yet - this is OK)"
                    );
                }

                // Now start the server (this should always work)
                match start_server(app_handle.clone()) {
                    Ok(server_child) => {
                        let server_pid = server_child.id();
                        *app_handle.state::<ServerProcess>().0.lock().unwrap() = Some(server_child);
                        log::info!("Server started with PID: {}", server_pid);

                        // Wait for server to be ready
                        wait_for_server();

                        // Start monitoring all processes
                        monitor_processes(app_handle.clone(), whisper_started);
                    }
                    Err(e) => {
                        log::error!("Failed to start server: {}", e);
                    }
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                log::info!("Window close requested. Cleaning up all processes.");

                let app_handle = window.app_handle();

                // Kill tracked processes
                if let Some(server_state) = app_handle.try_state::<ServerProcess>() {
                    if let Ok(mut process) = server_state.0.lock() {
                        if let Some(mut child) = process.take() {
                            let _ = child.kill();
                        }
                    }
                }

                if let Some(llama_state) = app_handle.try_state::<LlamaProcess>() {
                    if let Ok(mut process) = llama_state.0.lock() {
                        if let Some(mut child) = process.take() {
                            let _ = child.kill();
                        }
                    }
                }

                if let Some(whisper_state) = app_handle.try_state::<WhisperProcess>() {
                    if let Ok(mut process) = whisper_state.0.lock() {
                        if let Some(mut child) = process.take() {
                            let _ = child.kill();
                        }
                    }
                }

                // Clean up everything
                kill_all_processes();
                cleanup_stale_files();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[derive(Serialize, Deserialize)]
struct SystemSpecs {
    total_memory_gb: f64,
    available_memory_gb: f64,
    cpu_count: usize,
    cpu_brand: String,
    os: String,
    arch: String,
}

#[tauri::command]
fn convert_audio_to_wav(audio_bytes: Vec<u8>) -> Result<Vec<u8>, String> {
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
fn get_system_specs() -> SystemSpecs {
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

    SystemSpecs {
        total_memory_gb: total_memory,
        available_memory_gb: available_memory,
        cpu_count,
        cpu_brand,
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
    }
}

fn main() {
    run();
}
