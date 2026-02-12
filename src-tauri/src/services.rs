use std::process::{Child, Command};
use std::thread;
use std::time::Duration;
use tauri::AppHandle;

// Import process management utilities
use crate::process::{is_process_running_from_pid, write_pid_file};

pub fn find_llama_model(models_dir: &std::path::Path) -> Option<std::path::PathBuf> {
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

pub fn start_llama() -> Result<Child, Box<dyn std::error::Error>> {
    // Check if already running via PID file
    if let Some(pid) = is_process_running_from_pid("llama") {
        return Err(format!("Llama server already running with PID {}", pid).into());
    }

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
        .arg("99") // Use GPU for all layers on macOS
        .arg("--jinja");

    // Check if model is Qwen3 - need to disable thinking in chat template
    let model_filename = model_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("");
    if model_filename.to_lowercase().contains("qwen3") {
        log::info!("Qwen3 model detected, disabling thinking in chat template");
        cmd.arg("--chat-template-kwargs")
            .arg(r#"{"enable_thinking": false}"#);
    }

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

    let pid = child.id();
    log::info!("llama-server started with PID: {}", pid);

    // Write PID file
    write_pid_file("llama", pid);

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

pub fn find_whisper_model(models_dir: &std::path::Path) -> Option<std::path::PathBuf> {
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

pub fn start_whisper() -> Result<Child, Box<dyn std::error::Error>> {
    // Check if already running via PID file
    if let Some(pid) = is_process_running_from_pid("whisper") {
        return Err(format!("Whisper server already running with PID {}", pid).into());
    }

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
    let model_path = find_whisper_model(&models_dir);

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

    let pid = child.id();
    log::info!("Whisper server started with PID: {}", pid);

    // Write PID file
    write_pid_file("whisper", pid);

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

pub fn start_server(
    _app_handle: AppHandle,
    passphrase_hex: String,
) -> Result<Child, Box<dyn std::error::Error>> {
    // Check if already running via PID file
    if let Some(pid) = is_process_running_from_pid("server") {
        return Err(format!("Server already running with PID {}", pid).into());
    }

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

    log::info!(
        "Using encryption key (length: {} chars)",
        passphrase_hex.len()
    );

    let mut cmd = Command::new(&server_path);

    // Pipe passphrase to stdin instead of environment variable for better security
    cmd.stdin(std::process::Stdio::piped());

    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }

    cmd.stdout(std::process::Stdio::inherit())
        .stderr(std::process::Stdio::inherit());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn server process: {}", e))?;

    // Write passphrase to stdin and close the pipe
    if let Some(mut stdin) = child.stdin.take() {
        use std::io::Write;
        writeln!(stdin, "{}", passphrase_hex)
            .map_err(|e| format!("Failed to write passphrase to stdin: {}", e))?;
        // Drop stdin to signal EOF and prevent further writes
        drop(stdin);
    }

    let pid = child.id();
    log::info!("Server started with PID: {}", pid);

    // Write PID file
    write_pid_file("server", pid);

    Ok(child)
}

pub fn wait_for_service(service_name: &str, port: &str, timeout_seconds: u64) -> bool {
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

pub fn wait_for_server() {
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
