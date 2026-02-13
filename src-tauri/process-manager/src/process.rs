use crate::protocol::{ServiceStatus, StatusData};
use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::time::Duration;

/// Fixed ports for LLM and Whisper services (used as fallbacks)
pub const LLAMA_PORT: u16 = 8082;
pub const WHISPER_PORT: u16 = 8081;

/// Default server port (will be overridden by server's actual port)
pub const DEFAULT_SERVER_PORT: u16 = 5000;

/// Ports allocated by the Python server
#[derive(Debug, Clone)]
pub struct AllocatedPorts {
    pub server: u16,
    pub llama: u16,
    pub whisper: u16,
}

/// Get the phlox data directory
pub fn phlox_dir() -> Option<PathBuf> {
    dirs::data_dir().map(|dir| dir.join("phlox"))
}

/// Get the PID file path for a service
pub fn pid_file(service: &str) -> Option<PathBuf> {
    phlox_dir().map(|dir| dir.join(format!("{}.pid", service)))
}

/// Check if a process is alive by PID
#[cfg(unix)]
pub fn is_process_alive(pid: u32) -> bool {
    unsafe { libc::kill(pid as i32, 0) == 0 }
}

/// Write a PID file
pub fn write_pid_file(service: &str, pid: u32) {
    if let Some(dir) = phlox_dir() {
        fs::create_dir_all(&dir).ok();
    }
    if let Some(pid_file) = pid_file(service) {
        if let Err(e) = fs::write(&pid_file, pid.to_string()) {
            log::warn!("Failed to write PID file for {}: {}", service, e);
        } else {
            log::debug!("Wrote PID file for {}: PID {}", service, pid);
        }
    }
}

/// Remove a PID file
pub fn remove_pid_file(service: &str) {
    if let Some(pid_file) = pid_file(service) {
        let _ = fs::remove_file(&pid_file);
    }
}

/// Find the llama-server binary path
pub fn find_llama_server() -> Option<PathBuf> {
    let exe_dir = env::current_exe().ok()?.parent()?.to_path_buf();

    #[cfg(target_os = "windows")]
    let path = exe_dir.join("llama-server.exe");
    #[cfg(not(target_os = "windows"))]
    let path = exe_dir.join("llama-server");

    if path.exists() {
        Some(path)
    } else {
        log::warn!("llama-server not found at {:?}", path);
        None
    }
}

/// Find the whisper-server binary path
pub fn find_whisper_server() -> Option<PathBuf> {
    let exe_dir = env::current_exe().ok()?.parent()?.to_path_buf();

    #[cfg(target_os = "windows")]
    let path = exe_dir.join("whisper-server.exe");
    #[cfg(not(target_os = "windows"))]
    let path = exe_dir.join("whisper-server");

    if path.exists() {
        Some(path)
    } else {
        log::warn!("whisper-server not found at {:?}", path);
        None
    }
}

/// Find the server (Python) binary path
/// The 'server' binary is a wrapper that points to ../Resources/server_dist/server
pub fn find_python_server() -> Option<PathBuf> {
    let exe_dir = env::current_exe().ok()?.parent()?.to_path_buf();
    let path = exe_dir.join("server");

    if path.exists() {
        Some(path)
    } else {
        log::warn!("Python server not found at {:?}", path);
        None
    }
}

/// Find a llama model in the models directory
pub fn find_llama_model() -> Option<PathBuf> {
    let models_dir = phlox_dir()?.join("llm_models");

    // First check llm_model.txt for user selection
    let model_file = phlox_dir()?.join("llm_model.txt");
    if let Ok(model_name) = fs::read_to_string(&model_file) {
        let model_path = models_dir.join(model_name.trim());
        if model_path.exists() {
            return Some(model_path);
        }
    }

    // Scan for any .gguf file
    if let Ok(entries) = fs::read_dir(&models_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension()?.to_str()? == "gguf" {
                return Some(path);
            }
        }
    }

    None
}

/// Find a whisper model in the models directory
pub fn find_whisper_model() -> Option<PathBuf> {
    let models_dir = phlox_dir()?.join("whisper_models");

    // First check whisper_model.txt for user selection
    let model_file = phlox_dir()?.join("whisper_model.txt");
    if let Ok(model_id) = fs::read_to_string(&model_file) {
        let model_path = models_dir.join(format!("ggml-{}.bin", model_id.trim()));
        if model_path.exists() {
            return Some(model_path);
        }
    }

    // Scan for any ggml-*.bin file
    if let Ok(entries) = fs::read_dir(&models_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_name()?.to_str()?;
            if name.starts_with("ggml-") && path.extension()?.to_str()? == "bin" {
                return Some(path);
            }
        }
    }

    None
}

/// Managed process state
pub struct ManagedProcess {
    pub child: Child,
    pub port: u16,
    pub service_type: ServiceType,
}

pub enum ServiceType {
    Llama,
    Whisper,
    Server,
}

/// Start the llama server
pub fn start_llama(port: Option<u16>) -> Result<ManagedProcess, String> {
    let server_path = find_llama_server().ok_or("llama-server binary not found")?;
    let model_path = find_llama_model().ok_or("No LLM model found")?;

    // Use provided port or fallback to default
    let actual_port = port.unwrap_or(LLAMA_PORT);

    log::info!(
        "Starting llama-server with model: {:?} on port {}",
        model_path,
        actual_port
    );

    let mut cmd = Command::new(&server_path);
    cmd.arg("--port")
        .arg(actual_port.to_string())
        .arg("--host")
        .arg("127.0.0.1")
        .arg("--model")
        .arg(model_path.to_string_lossy().as_ref())
        .arg("--ctx-size")
        .arg("8192")
        .arg("--n-gpu-layers")
        .arg("99")
        .arg("--jinja");

    // Check for Qwen3 model
    if let Some(filename) = model_path.file_name().and_then(|n| n.to_str()) {
        if filename.to_lowercase().contains("qwen3") {
            cmd.arg("--chat-template-kwargs")
                .arg(r#"{"enable_thinking": false}"#);
        }
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
        .map_err(|e| format!("Failed to spawn llama-server: {}", e))?;

    let pid = child.id();
    log::info!("llama-server started with PID: {}", pid);
    write_pid_file("llama", pid);

    // Write port file for Python server to read
    if let Some(dir) = phlox_dir() {
        let port_file = dir.join("llm_port.txt");
        fs::write(&port_file, actual_port.to_string()).ok();
    }

    Ok(ManagedProcess {
        child,
        port: actual_port,
        service_type: ServiceType::Llama,
    })
}

/// Start the whisper server
pub fn start_whisper(port: Option<u16>) -> Result<ManagedProcess, String> {
    let server_path = find_whisper_server().ok_or("whisper-server binary not found")?;
    let model_path = find_whisper_model().ok_or("No Whisper model found")?;

    // Use provided port or fallback to default
    let actual_port = port.unwrap_or(WHISPER_PORT);

    log::info!(
        "Starting whisper-server with model: {:?} on port {}",
        model_path,
        actual_port
    );

    let mut cmd = Command::new(&server_path);
    cmd.arg("--port")
        .arg(actual_port.to_string())
        .arg("--host")
        .arg("127.0.0.1")
        .arg("--model")
        .arg(model_path.to_string_lossy().as_ref());

    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }

    cmd.stdout(std::process::Stdio::inherit())
        .stderr(std::process::Stdio::inherit());

    let child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn whisper-server: {}", e))?;

    let pid = child.id();
    log::info!("whisper-server started with PID: {}", pid);
    write_pid_file("whisper", pid);

    // Write port file for Python server to read
    if let Some(dir) = phlox_dir() {
        let port_file = dir.join("whisper_port.txt");
        fs::write(&port_file, actual_port.to_string()).ok();
    }

    Ok(ManagedProcess {
        child,
        port: actual_port,
        service_type: ServiceType::Whisper,
    })
}

/// Wait for the server to output its allocated ports via stdout
/// Also monitors stderr for specific error messages like "wrong key"
pub fn wait_for_allocated_ports(child: &mut Child) -> Result<AllocatedPorts, String> {
    use std::io::Read;

    let stdout = child.stdout.as_mut().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.as_mut().ok_or("Failed to capture stderr")?;

    let mut stdout_reader = std::io::BufReader::new(stdout);
    let mut stderr_reader = std::io::BufReader::new(stderr);

    log::info!("Waiting for PORTS line from server stdout...");

    // Try to read for up to 10 seconds
    let start = std::time::Instant::now();
    let mut stdout_buffer = Vec::new();
    let mut stderr_buffer = Vec::new();
    let timeout = Duration::from_secs(10);

    loop {
        if start.elapsed() > timeout {
            log::warn!("Timeout waiting for PORTS line");
            log::warn!(
                "Stdout content: {}",
                String::from_utf8_lossy(&stdout_buffer)
            );
            log::warn!(
                "Stderr content: {}",
                String::from_utf8_lossy(&stderr_buffer)
            );
            return Err("Timeout waiting for server to start".to_string());
        }

        // Check stderr for "wrong key" error message
        let mut stderr_byte = [0u8; 1];
        match stderr_reader.read(&mut stderr_byte) {
            Ok(0) => {
                // EOF on stderr - process may have exited
                let stderr_content = String::from_utf8_lossy(&stderr_buffer);
                if stderr_content.contains("Wrong encryption key?")
                    || stderr_content.contains("wrong key?")
                    || stderr_content.contains("Cannot decrypt database")
                {
                    return Err("Wrong encryption key".to_string());
                }
                // If stderr ended but no error detected, continue reading stdout
            }
            Ok(_) => {
                stderr_buffer.push(stderr_byte[0]);
                let stderr_content = String::from_utf8_lossy(&stderr_buffer);

                // Check for wrong key patterns
                if stderr_content.contains("Wrong encryption key?")
                    || stderr_content.contains("wrong key?")
                    || stderr_content.contains("Cannot decrypt database")
                {
                    log::error!("Detected wrong encryption key in stderr");
                    return Err("Wrong encryption key".to_string());
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                // No data available on stderr, will try stdout
            }
            Err(e) => {
                log::error!("Error reading from server stderr: {}", e);
                // Continue anyway, might still get data on stdout
            }
        }

        // Read stdout for PORTS line
        let mut stdout_byte = [0u8; 1];
        match stdout_reader.read(&mut stdout_byte) {
            Ok(0) => {
                // EOF on stdout
                log::warn!("EOF reached while waiting for PORTS line");
                log::warn!(
                    "Stdout content: {}",
                    String::from_utf8_lossy(&stdout_buffer)
                );
                // Try to read remaining stderr
                let _ = stderr_reader.read_to_end(&mut stderr_buffer);
                log::warn!(
                    "Stderr content: {}",
                    String::from_utf8_lossy(&stderr_buffer)
                );
                return Err("Server exited before sending PORTS line".to_string());
            }
            Ok(_) => {
                stdout_buffer.push(stdout_byte[0]);
                let content = String::from_utf8_lossy(&stdout_buffer);

                // Check if we have a complete line with PORTS
                if let Some(newline_pos) = content.find('\n') {
                    let line = &content[..newline_pos];
                    log::debug!("Read line from stdout: {}", line);
                    if line.trim().starts_with("PORTS:") {
                        let trimmed = line.trim();
                        let parts = trimmed.strip_prefix("PORTS:").ok_or("Invalid PORTS line")?;
                        let ports: Vec<&str> = parts.split(',').collect();
                        if ports.len() == 3 {
                            let server = ports[0]
                                .trim()
                                .parse::<u16>()
                                .map_err(|e| format!("Failed to parse server port: {}", e))?;
                            let llama = ports[1]
                                .trim()
                                .parse::<u16>()
                                .map_err(|e| format!("Failed to parse llama port: {}", e))?;
                            let whisper = ports[2]
                                .trim()
                                .parse::<u16>()
                                .map_err(|e| format!("Failed to parse whisper port: {}", e))?;
                            log::info!(
                                "Parsed allocated ports: server={}, llama={}, whisper={}",
                                server,
                                llama,
                                whisper
                            );
                            return Ok(AllocatedPorts {
                                server,
                                llama,
                                whisper,
                            });
                        } else {
                            log::warn!("PORTS line has wrong number of parts: {:?}", ports);
                        }
                    }
                    // Remove this line from buffer and continue
                    stdout_buffer = content[newline_pos + 1..].as_bytes().to_vec();
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                // No data available yet, sleep a bit
                std::thread::sleep(Duration::from_millis(50));
            }
            Err(e) => {
                log::error!("Error reading from server stdout: {}", e);
                return Err(format!("Error reading from server stdout: {}", e));
            }
        }
    }
}

/// Start the Python server
pub fn start_server(passphrase: &str) -> Result<(ManagedProcess, AllocatedPorts), String> {
    let server_path = find_python_server().ok_or("Server binary not found")?;

    log::info!("Starting Python server");

    let mut cmd = Command::new(&server_path);
    // Pipe passphrase to stdin instead of environment variable for better security
    cmd.stdin(std::process::Stdio::piped());
    // Capture stdout to read the allocated ports
    cmd.stdout(std::process::Stdio::piped());

    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }

    cmd.stderr(std::process::Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn server: {}", e))?;

    // Write passphrase to stdin and close the pipe
    if let Some(mut stdin) = child.stdin.take() {
        use std::io::Write;
        writeln!(stdin, "{}", passphrase)
            .map_err(|e| format!("Failed to write passphrase to stdin: {}", e))?;
        // Drop stdin to signal EOF and prevent further writes
        drop(stdin);
    }

    // Wait for PORTS line from stdout (also checks stderr for wrong key error)
    let ports = wait_for_allocated_ports(&mut child)?;

    let pid = child.id();
    log::info!("Server started with PID: {}", pid);
    write_pid_file("server", pid);

    Ok((
        ManagedProcess {
            child,
            port: ports.server,
            service_type: ServiceType::Server,
        },
        ports,
    ))
}

/// Kill a process by PID
pub fn kill_process(pid: u32, service_name: &str) {
    #[cfg(unix)]
    {
        unsafe {
            log::info!("Killing {} process (PID: {})", service_name, pid);
            if libc::kill(pid as i32, libc::SIGTERM) == 0 {
                // Wait for graceful shutdown
                for _ in 0..50 {
                    std::thread::sleep(Duration::from_millis(100));
                    if !is_process_alive(pid) {
                        log::info!("{} terminated gracefully", service_name);
                        return;
                    }
                }
                // Force kill if needed
                log::warn!("Force killing {} (PID: {})", service_name, pid);
                let _ = libc::kill(pid as i32, libc::SIGKILL);
                std::thread::sleep(Duration::from_millis(500));
            }
        }
    }

    #[cfg(windows)]
    {
        use std::process::Command;
        log::info!("Killing {} process (PID: {})", service_name, pid);
        let _ = Command::new("taskkill")
            .arg("/F")
            .arg("/PID")
            .arg(pid.to_string())
            .output();
    }
}

/// Kill a process by name pattern (fallback for orphaned processes)
pub fn kill_process_by_name(pattern: &str, service_name: &str) {
    #[cfg(target_os = "macos")]
    {
        log::info!("Killing {} processes matching: {}", service_name, pattern);
        let _ = Command::new("pkill").arg("-f").arg(pattern).output();
    }

    #[cfg(target_os = "linux")]
    {
        log::info!("Killing {} processes matching: {}", service_name, pattern);
        let _ = Command::new("pkill").arg("-f").arg(pattern).output();
    }

    #[cfg(target_os = "windows")]
    {
        log::info!("Killing {} processes matching: {}", service_name, pattern);
        let _ = Command::new("taskkill")
            .arg("/F")
            .arg("/IM")
            .arg(pattern)
            .output();
    }

    std::thread::sleep(Duration::from_millis(500));
}

/// Kill all managed processes
pub fn kill_all_processes() {
    log::info!("Killing all processes...");

    // Kill by PID files first
    for service in ["llama", "whisper", "server"] {
        if let Some(pid_file) = pid_file(service) {
            if let Ok(pid_str) = fs::read_to_string(&pid_file) {
                if let Ok(pid) = pid_str.trim().parse::<u32>() {
                    if is_process_alive(pid) {
                        kill_process(pid, service);
                    }
                }
            }
            // Clean up PID file
            let _ = fs::remove_file(&pid_file);
        }
    }

    // Fallback: kill by name pattern
    kill_process_by_name("llama-server", "llama-server");
    kill_process_by_name("whisper-server", "whisper-server");
    kill_process_by_name("server", "server");

    std::thread::sleep(Duration::from_millis(500));

    log::info!("All processes killed");
}

/// Create StatusData from running processes
pub fn create_status_data(
    llama: Option<&ManagedProcess>,
    whisper: Option<&ManagedProcess>,
    server: Option<&ManagedProcess>,
) -> StatusData {
    StatusData {
        llama: llama.map(|p| ServiceStatus {
            running: true,
            pid: p.child.id(),
            port: p.port,
        }),
        whisper: whisper.map(|p| ServiceStatus {
            running: true,
            pid: p.child.id(),
            port: p.port,
        }),
        server: server.map(|p| ServiceStatus {
            running: true,
            pid: p.child.id(),
            port: p.port,
        }),
    }
}
