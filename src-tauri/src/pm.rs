//! In-process process manager for phlox sidecar services.

use serde::Serialize;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;

/// Fixed fallback ports for the sidecar services.
pub const LLAMA_PORT: u16 = 8082;
pub const WHISPER_PORT: u16 = 8081;
pub const EMBEDDING_PORT: u16 = 8083;

/// Ports allocated by the Python server after passphrase unlock.
#[derive(Debug, Clone)]
pub struct AllocatedPorts {
    pub server: u16,
    pub llama: u16,
    pub whisper: u16,
    pub embedding: u16,
    pub request_token: String,
}

/// Status snapshot of a single managed service.
#[derive(Debug, Clone, Serialize)]
pub struct ServiceStatus {
    pub running: bool,
    pub pid: u32,
    pub port: u16,
}

/// Status snapshot of all managed services, returned by [`ProcessManagerState::status`].
#[derive(Debug, Clone, Default, Serialize)]
pub struct StatusData {
    pub llama: Option<ServiceStatus>,
    pub whisper: Option<ServiceStatus>,
    pub server: Option<ServiceStatus>,
    pub embedding: Option<ServiceStatus>,
    pub request_token: Option<String>,
}

/// Managed Tauri state wrapping the supervisor mutex.
pub struct PmState(pub Mutex<ProcessManagerState>);

/// A child process plus the bookkeeping needed to supervise it.
pub struct ManagedProcess {
    pub child: Child,
    pub port: u16,
    /// Handles for background threads draining stdout/stderr (server only).
    pub drain_handles: Option<(JoinHandle<()>, JoinHandle<()>)>,
    /// Flag used to signal drain threads to stop.
    pub drain_shutdown: Option<Arc<AtomicBool>>,
}

/// Signal emitted by the Python server on stdout during startup.
#[derive(Debug)]
enum ServerSignal {
    WaitingForPassphrase,
    Ports(AllocatedPorts),
}

/// All supervised sidecar processes plus derived state.
#[derive(Default)]
pub struct ProcessManagerState {
    llama: Option<ManagedProcess>,
    whisper: Option<ManagedProcess>,
    server: Option<ManagedProcess>,
    embedding: Option<ManagedProcess>,
    allocated_ports: Option<AllocatedPorts>,
    request_token: Option<String>,
}

// =========================================================================
// Directory / PID file helpers
// =========================================================================

/// Get the phlox data directory
pub fn phlox_dir() -> Option<PathBuf> {
    dirs::data_dir().map(|dir| dir.join("phlox"))
}

/// Get the PID file path for a service.
fn pid_file(service: &str) -> Option<PathBuf> {
    phlox_dir().map(|dir| dir.join(format!("{}.pid", service)))
}

/// Write a PID file.
fn write_pid_file(service: &str, pid: u32) {
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

/// Remove a PID file.
fn remove_pid_file(service: &str) {
    if let Some(pid_file) = pid_file(service) {
        let _ = fs::remove_file(&pid_file);
    }
}

// =========================================================================
// Binary / model discovery
// =========================================================================

/// Find the phlox-llama-server binary path.
fn find_llama_server() -> Option<PathBuf> {
    let exe_dir = std::env::current_exe().ok()?.parent()?.to_path_buf();

    #[cfg(target_os = "windows")]
    let path = exe_dir.join("phlox-llama-server.exe");
    #[cfg(not(target_os = "windows"))]
    let path = exe_dir.join("phlox-llama-server");

    if path.exists() {
        Some(path)
    } else {
        log::warn!("phlox-llama-server not found at {:?}", path);
        None
    }
}

/// Find the phlox-whisper-server binary path.
fn find_whisper_server() -> Option<PathBuf> {
    let exe_dir = std::env::current_exe().ok()?.parent()?.to_path_buf();

    #[cfg(target_os = "windows")]
    let path = exe_dir.join("phlox-whisper-server.exe");
    #[cfg(not(target_os = "windows"))]
    let path = exe_dir.join("phlox-whisper-server");

    if path.exists() {
        Some(path)
    } else {
        log::warn!("phlox-whisper-server not found at {:?}", path);
        None
    }
}

/// Find the server (Python) binary path.
/// The 'phlox-server' binary is a wrapper that points to ../Resources/server_dist/server.
fn find_python_server() -> Option<PathBuf> {
    let exe_dir = std::env::current_exe().ok()?.parent()?.to_path_buf();
    let path = exe_dir.join("phlox-server");

    if path.exists() {
        Some(path)
    } else {
        log::warn!("Python server not found at {:?}", path);
        None
    }
}

/// Find a llama model in the models directory.
fn find_llama_model() -> Option<PathBuf> {
    let models_dir = phlox_dir()?.join("llm_models");

    // Prefer Python's explicit selection file over a directory scan
    let model_file = phlox_dir()?.join("llm_model.txt");
    if let Ok(model_name) = fs::read_to_string(&model_file) {
        let model_path = models_dir.join(model_name.trim());
        if model_path.exists() {
            return Some(model_path);
        }
    }

    // Scan for any .gguf file that isn't a multimodal projector
    if let Ok(entries) = fs::read_dir(&models_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension()?.to_str()? == "gguf" {
                let name = path.file_name()?.to_str()?.to_lowercase();
                if !name.contains("mmproj") {
                    return Some(path);
                }
            }
        }
    }

    None
}

/// Find the companion multimodal projector (mmproj) for the loaded model.
fn find_llama_mmproj() -> Option<PathBuf> {
    let models_dir = phlox_dir()?.join("llm_models");

    if let Ok(entries) = fs::read_dir(&models_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension()?.to_str()? == "gguf"
                && path
                    .file_name()?
                    .to_str()?
                    .to_lowercase()
                    .contains("mmproj")
            {
                return Some(path);
            }
        }
    }

    None
}

/// Find the STT in the models directory.
fn find_whisper_model() -> Option<PathBuf> {
    let models_dir = phlox_dir()?.join("whisper_models");

    // Primary: the fixed Omi Med STT q8_0 GGUF.
    let primary = models_dir.join("omi-med-stt-v1-q8_0.gguf");
    if primary.exists() {
        return Some(primary);
    }

    // Fallback: any .gguf file in the models directory.
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

/// Find an embedding model in the models directory.
fn find_embedding_model() -> Option<PathBuf> {
    let models_dir = phlox_dir()?.join("embedding_models");

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

// =========================================================================
// Spawn helpers (free functions)
// =========================================================================

/// Start the llama server (returns a raw [`ManagedProcess`]).
fn start_llama(port: Option<u16>) -> Result<ManagedProcess, String> {
    let server_path = find_llama_server().ok_or("phlox-llama-server binary not found")?;
    let model_path = find_llama_model().ok_or("No LLM model found")?;

    let actual_port = port.unwrap_or(LLAMA_PORT);

    log::info!("Starting phlox-llama-server from: {:?}", server_path);
    log::info!(
        "phlox-llama-server model: {:?}, port: {}",
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
        .arg("16384")
        .arg("--n-gpu-layers")
        .arg("99")
        .arg("--jinja")
        .arg("--cache-type-k")
        .arg("q8_0")
        .arg("--cache-type-v")
        .arg("q8_0");

    // Check for Qwen3 model
    if let Some(filename) = model_path.file_name().and_then(|n| n.to_str()) {
        if filename.to_lowercase().contains("qwen3") {
            cmd.arg("--chat-template-kwargs")
                .arg(r#"{"enable_thinking": false}"#);
        }
    }

    // Load the multimodal projector (vision models) if a companion mmproj is present.
    if let Some(mmproj_path) = find_llama_mmproj() {
        log::info!("Loading multimodal projector: {:?}", mmproj_path);
        cmd.arg("--mmproj")
            .arg(mmproj_path.to_string_lossy().as_ref());
    }

    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }

    cmd.stdout(Stdio::inherit()).stderr(Stdio::inherit());

    let child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn phlox-llama-server: {}", e))?;

    let pid = child.id();
    log::info!("phlox-llama-server started with PID: {}", pid);
    write_pid_file("llama", pid);

    Ok(ManagedProcess {
        child,
        port: actual_port,
        drain_handles: None,
        drain_shutdown: None,
    })
}

/// Start the whisper server (returns a raw [`ManagedProcess`]).
fn start_whisper(port: Option<u16>) -> Result<ManagedProcess, String> {
    let server_path = find_whisper_server().ok_or("phlox-whisper-server binary not found")?;
    let model_path = find_whisper_model().ok_or("No Whisper model found")?;

    let actual_port = port.unwrap_or(WHISPER_PORT);

    log::info!("Starting phlox-whisper-server from: {:?}", server_path);
    log::info!(
        "phlox-whisper-server model: {:?}, port: {}",
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
        .arg("--max-seconds")
        .arg("240")
        .arg("--chunk-seconds")
        .arg("240")
        .arg("--overlap")
        .arg("5");

    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }

    cmd.stdout(Stdio::inherit()).stderr(Stdio::inherit());

    let child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn phlox-whisper-server: {}", e))?;

    let pid = child.id();
    log::info!("phlox-whisper-server started with PID: {}", pid);
    write_pid_file("whisper", pid);

    Ok(ManagedProcess {
        child,
        port: actual_port,
        drain_handles: None,
        drain_shutdown: None,
    })
}

/// Start the embedding server (returns a raw [`ManagedProcess`]).
fn start_embedding(port: Option<u16>) -> Result<ManagedProcess, String> {
    let server_path = find_llama_server().ok_or("phlox-llama-server binary not found")?;
    let model_path = find_embedding_model().ok_or("No embedding model found")?;

    let actual_port = port.unwrap_or(EMBEDDING_PORT);

    log::info!("Starting embedding server from: {:?}", server_path);
    log::info!("embedding model: {:?}, port: {}", model_path, actual_port);

    let mut cmd = Command::new(&server_path);
    cmd.arg("--port")
        .arg(actual_port.to_string())
        .arg("--host")
        .arg("127.0.0.1")
        .arg("--model")
        .arg(model_path.to_string_lossy().as_ref())
        .arg("--embedding")
        .arg("--n-gpu-layers")
        .arg("99")
        .arg("--ctx-size")
        .arg("1024")
        .arg("--cache-type-k")
        .arg("q8_0")
        .arg("--cache-type-v")
        .arg("q8_0");

    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }

    cmd.stdout(Stdio::inherit()).stderr(Stdio::inherit());

    let child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn embedding server: {}", e))?;

    let pid = child.id();
    log::info!("Embedding server started with PID: {}", pid);
    write_pid_file("embedding", pid);

    Ok(ManagedProcess {
        child,
        port: actual_port,
        drain_handles: None,
        drain_shutdown: None,
    })
}

// =========================================================================
// Python server stdout/stdin signal protocol
// =========================================================================

fn with_stderr(msg: &str, stderr_buffer: &[u8]) -> String {
    let stderr = String::from_utf8_lossy(stderr_buffer).trim().to_string();
    if stderr.is_empty() {
        msg.to_string()
    } else {
        format!("{}\n{}", msg, stderr)
    }
}

#[cfg(unix)]
fn set_nonblocking(fd: std::os::unix::io::RawFd, nonblocking: bool) -> std::io::Result<()> {
    unsafe {
        let flags = libc::fcntl(fd, libc::F_GETFL);
        if flags == -1 {
            return Err(std::io::Error::last_os_error());
        }
        let new_flags = if nonblocking {
            flags | libc::O_NONBLOCK
        } else {
            flags & !libc::O_NONBLOCK
        };
        if libc::fcntl(fd, libc::F_SETFL, new_flags) == -1 {
            return Err(std::io::Error::last_os_error());
        }
    }
    Ok(())
}

/// Wait for the server to output a signal via stdout.
/// Also monitors stderr for specific error messages like "wrong key".
fn wait_for_server_signal(child: &mut Child) -> Result<ServerSignal, String> {
    use std::io::Read;

    let stdout = child.stdout.as_mut().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.as_mut().ok_or("Failed to capture stderr")?;

    #[cfg(unix)]
    {
        use std::os::unix::io::AsRawFd;
        let _ = set_nonblocking(stdout.as_raw_fd(), true);
        let _ = set_nonblocking(stderr.as_raw_fd(), true);
    }

    let mut stdout_reader = std::io::BufReader::new(stdout);
    let mut stderr_reader = std::io::BufReader::new(stderr);

    log::info!("Waiting for signal from server stdout...");

    let start = std::time::Instant::now();
    let mut stdout_buffer = Vec::new();
    let mut stderr_buffer = Vec::new();
    let timeout = Duration::from_secs(10);

    loop {
        if start.elapsed() > timeout {
            log::warn!("Timeout waiting for server signal");
            log::warn!(
                "Stdout content: {}",
                String::from_utf8_lossy(&stdout_buffer)
            );
            log::warn!(
                "Stderr content: {}",
                String::from_utf8_lossy(&stderr_buffer)
            );
            return Err(with_stderr(
                "Timeout waiting for server to start",
                &stderr_buffer,
            ));
        }

        // Check stderr for "wrong key" error message
        let mut stderr_byte = [0u8; 1];
        match stderr_reader.read(&mut stderr_byte) {
            Ok(0) => {
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

                if stderr_content.contains("Wrong encryption key?")
                    || stderr_content.contains("wrong key?")
                    || stderr_content.contains("Cannot decrypt database")
                {
                    log::error!("Detected wrong encryption key in stderr");
                    return Err("Wrong encryption key".to_string());
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {}
            Err(e) => {
                log::error!("Error reading from server stderr: {}", e);
            }
        }

        // Read stdout for signals
        let mut stdout_byte = [0u8; 1];
        match stdout_reader.read(&mut stdout_byte) {
            Ok(0) => {
                log::warn!("EOF reached while waiting for server signal");
                log::warn!(
                    "Stdout content: {}",
                    String::from_utf8_lossy(&stdout_buffer)
                );
                let _ = stderr_reader.read_to_end(&mut stderr_buffer);
                log::warn!(
                    "Stderr content: {}",
                    String::from_utf8_lossy(&stderr_buffer)
                );
                return Err(with_stderr(
                    "Server exited before sending signal",
                    &stderr_buffer,
                ));
            }
            Ok(_) => {
                stdout_buffer.push(stdout_byte[0]);
                let content = String::from_utf8_lossy(&stdout_buffer);

                if let Some(newline_pos) = content.find('\n') {
                    let line = &content[..newline_pos];
                    log::debug!("Read line from stdout: {}", line);

                    if line.trim() == "WAITING_FOR_PASSPHRASE" {
                        log::info!("Server is waiting for passphrase");
                        return Ok(ServerSignal::WaitingForPassphrase);
                    }

                    if line.trim().starts_with("PORTS:") {
                        let ports = parse_ports_line(line)?;
                        return Ok(ServerSignal::Ports(ports));
                    }

                    if line.trim().starts_with("ERROR:") {
                        let error_msg = line
                            .trim()
                            .strip_prefix("ERROR:")
                            .unwrap_or("Unknown error");
                        return Err(error_msg.to_string());
                    }

                    stdout_buffer = content[newline_pos + 1..].as_bytes().to_vec();
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(50));
            }
            Err(e) => {
                log::error!("Error reading from server stdout: {}", e);
                return Err(format!("Error reading from server stdout: {}", e));
            }
        }
    }
}

/// Parse a `PORTS:s,ll,w,e|TOKEN:xyz` line into [`AllocatedPorts`].
fn parse_ports_line(line: &str) -> Result<AllocatedPorts, String> {
    let trimmed = line.trim();
    let ports_part = trimmed.strip_prefix("PORTS:").ok_or("Invalid PORTS line")?;

    let parts: Vec<&str> = ports_part.split('|').collect();
    if parts.len() < 2 {
        return Err("PORTS line missing token".to_string());
    }

    let ports: Vec<&str> = parts[0].split(',').collect();
    if ports.len() < 3 {
        return Err(format!("PORTS line has too few ports: {:?}", ports));
    }

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
    let embedding = if ports.len() >= 4 {
        ports[3]
            .trim()
            .parse::<u16>()
            .map_err(|e| format!("Failed to parse embedding port: {}", e))?
    } else {
        EMBEDDING_PORT
    };

    let token = parts[1]
        .strip_prefix("TOKEN:")
        .ok_or("Missing TOKEN prefix")?
        .trim()
        .to_string();

    if token.is_empty() {
        return Err("Empty token received".to_string());
    }

    log::info!(
        "Parsed allocated ports: server={}, llama={}, whisper={}, embedding={}, token={}...",
        server,
        llama,
        whisper,
        embedding,
        &token[..8.min(token.len())]
    );

    Ok(AllocatedPorts {
        server,
        llama,
        whisper,
        embedding,
        request_token: token,
    })
}

/// Wait for the server to output its allocated ports via stdout.
fn wait_for_allocated_ports(child: &mut Child) -> Result<AllocatedPorts, String> {
    match wait_for_server_signal(child)? {
        ServerSignal::Ports(ports) => Ok(ports),
        ServerSignal::WaitingForPassphrase => {
            Err("Unexpected WAITING_FOR_PASSPHRASE signal".to_string())
        }
    }
}

/// Spawn background threads to continuously drain stdout and stderr from the
/// server process, preventing the pipe buffer (~64KB) from filling up and
/// blocking the child.
fn spawn_drain_threads(child: &mut Child) -> (JoinHandle<()>, JoinHandle<()>, Arc<AtomicBool>) {
    let shutdown = Arc::new(AtomicBool::new(false));

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    // Restore blocking mode for line-oriented reading
    #[cfg(unix)]
    {
        use std::os::unix::io::AsRawFd;
        if let Some(s) = stdout.as_ref() {
            let _ = set_nonblocking(s.as_raw_fd(), false);
        }
        if let Some(s) = stderr.as_ref() {
            let _ = set_nonblocking(s.as_raw_fd(), false);
        }
    }

    let shutdown_stdout = Arc::clone(&shutdown);
    let stdout_handle = thread::spawn(move || {
        if let Some(stdout) = stdout {
            let reader = BufReader::new(stdout);
            for line in reader.lines().map_while(Result::ok) {
                if shutdown_stdout.load(Ordering::Relaxed) {
                    break;
                }
                log::debug!("[server stdout] {}", line);
            }
        }
        log::debug!("Stdout drain thread exiting");
    });

    let shutdown_stderr = Arc::clone(&shutdown);
    let stderr_handle = thread::spawn(move || {
        if let Some(stderr) = stderr {
            let reader = BufReader::new(stderr);
            for line in reader.lines().map_while(Result::ok) {
                if shutdown_stderr.load(Ordering::Relaxed) {
                    break;
                }
                log::warn!("[server stderr] {}", line);
            }
        }
        log::debug!("Stderr drain thread exiting");
    });

    (stdout_handle, stderr_handle, shutdown)
}

/// Stop the drain threads for a [`ManagedProcess`] (if running).
fn stop_drain_threads(process: &mut ManagedProcess) {
    if let Some(shutdown) = process.drain_shutdown.take() {
        shutdown.store(true, Ordering::Relaxed);
        log::debug!("Signaled drain threads to stop");
    }

    if let Some((stdout_handle, stderr_handle)) = process.drain_handles.take() {
        thread::sleep(Duration::from_millis(500));
        drop(stdout_handle);
        drop(stderr_handle);
        log::debug!("Drain handles dropped");
    }
}

/// Start the Python server (waits for passphrase via stdin).
/// Returns the process once it has confirmed `WAITING_FOR_PASSPHRASE`.
fn start_server() -> Result<ManagedProcess, String> {
    let server_path = find_python_server().ok_or("Server binary not found")?;

    log::info!("Starting Python server from: {:?}", server_path);

    let mut cmd = Command::new(&server_path);
    cmd.stdin(Stdio::piped());
    cmd.stdout(Stdio::piped());
    cmd.env("RATE_LIMIT_ENABLED", "true");

    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NEW_PROCESS_GROUP so we can later send CTRL_BREAK_EVENT
        // via GenerateConsoleCtrlEvent for graceful shutdown.
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;
        cmd.creation_flags(CREATE_NEW_PROCESS_GROUP);
    }

    cmd.stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn server: {}", e))?;

    let pid = child.id();
    log::info!(
        "Server started with PID: {}, verifying it's ready for passphrase",
        pid
    );
    write_pid_file("server", pid);

    match wait_for_server_signal(&mut child)? {
        ServerSignal::WaitingForPassphrase => {
            log::info!("Server confirmed ready for passphrase");
            Ok(ManagedProcess {
                child,
                port: 0,
                drain_handles: None,
                drain_shutdown: None,
            })
        }
        ServerSignal::Ports(_) => {
            Err("Unexpected PORTS signal - server initialized without passphrase".to_string())
        }
    }
}

/// Send passphrase to a waiting server and wait for it to report its ports.
fn send_passphrase_and_wait_for_ports(
    process: &mut ManagedProcess,
    passphrase: &str,
) -> Result<AllocatedPorts, String> {
    if let Some(ref mut stdin) = process.child.stdin {
        writeln!(stdin, "{}", passphrase)
            .map_err(|e| format!("Failed to write passphrase to stdin: {}", e))?;
        stdin
            .flush()
            .map_err(|e| format!("Failed to flush stdin: {}", e))?;
    } else {
        return Err("Server stdin not available".to_string());
    }

    let ports = wait_for_allocated_ports(&mut process.child)?;
    process.port = ports.server;

    let (stdout_handle, stderr_handle, shutdown) = spawn_drain_threads(&mut process.child);
    process.drain_handles = Some((stdout_handle, stderr_handle));
    process.drain_shutdown = Some(shutdown);

    log::info!(
        "Server fully initialized with ports: server={}, llama={}, whisper={}, embedding={}",
        ports.server,
        ports.llama,
        ports.whisper,
        ports.embedding
    );
    Ok(ports)
}

// =========================================================================
// Kill helpers
// =========================================================================

/// Send a graceful-shutdown signal, poll for exit up to `grace`, then force kill.
fn kill_with_grace(child: &mut Child, grace: Duration, name: &str) {
    let pid = child.id();
    let start = std::time::Instant::now();

    #[cfg(unix)]
    unsafe {
        let _ = libc::kill(pid as i32, libc::SIGTERM);
    }

    #[cfg(windows)]
    {
        use windows::Win32::System::Console::{GenerateConsoleCtrlEvent, CTRL_BREAK_EVENT};
        // CTRL_BREAK reaches Python as SIGBREAK; uvicorn handles it like SIGINT.
        // Send to the child's process group (created at spawn time via
        // CREATE_NEW_PROCESS_GROUP). Returns Ok(()) if the event was posted.
        let _ = unsafe { GenerateConsoleCtrlEvent(CTRL_BREAK_EVENT, pid) };
    }

    let deadline = start + grace;
    while std::time::Instant::now() < deadline {
        match child.try_wait() {
            Ok(Some(_status)) => {
                log::info!(
                    "{} exited gracefully in {}ms",
                    name,
                    start.elapsed().as_millis()
                );
                return;
            }
            Ok(None) => thread::sleep(Duration::from_millis(25)),
            Err(e) => {
                log::warn!("{} wait error: {}; force killing", name, e);
                break;
            }
        }
    }

    log::warn!(
        "{} didn't exit in {}ms, force killing",
        name,
        grace.as_millis()
    );
    let _ = child.kill();
    let _ = child.wait();
}

/// Kill a process by name pattern.
fn kill_process_by_name(pattern: &str, service_name: &str) {
    if kill_by_name_inner(pattern, service_name) {
        // Give the OS a moment to actually reap the signalled processes
        thread::sleep(Duration::from_millis(500));
    }
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn kill_by_name_inner(pattern: &str, service_name: &str) -> bool {
    log::info!("Killing {} processes matching: {}", service_name, pattern);
    Command::new("pkill")
        .arg("-f")
        .arg(pattern)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

#[cfg(target_os = "windows")]
fn kill_by_name_inner(pattern: &str, service_name: &str) -> bool {
    log::info!("Killing {} processes matching: {}", service_name, pattern);
    Command::new("taskkill")
        .arg("/F")
        .arg("/IM")
        .arg(pattern)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Build a [`StatusData`] snapshot from the currently-managed processes.
fn create_status_data(
    llama: Option<&ManagedProcess>,
    whisper: Option<&ManagedProcess>,
    server: Option<&ManagedProcess>,
    embedding: Option<&ManagedProcess>,
    request_token: Option<&String>,
) -> StatusData {
    fn status_for(p: &ManagedProcess) -> ServiceStatus {
        ServiceStatus {
            running: true,
            pid: p.child.id(),
            port: p.port,
        }
    }

    StatusData {
        llama: llama.map(status_for),
        whisper: whisper.map(status_for),
        server: server.map(status_for),
        embedding: embedding.map(status_for),
        request_token: request_token.cloned(),
    }
}

// =========================================================================
// ProcessManagerState — public API
// =========================================================================

impl ProcessManagerState {
    /// Spawn llama.cpp with the loaded model. Returns `(pid, port)`.
    pub fn start_llama(&mut self, port: Option<u16>) -> Result<(u32, u16), String> {
        if self.llama.is_some() {
            return Err("Llama server is already running".to_string());
        }
        let port = port.or_else(|| self.allocated_ports.as_ref().map(|p| p.llama));
        let mut proc = start_llama(port)?;
        // Give the process a moment to start, then verify it didn't exit immediately.
        thread::sleep(Duration::from_millis(500));
        match proc.child.try_wait() {
            Ok(Some(status)) => {
                log::error!("Llama process exited immediately: {:?}", status);
                remove_pid_file("llama");
                Err("Llama server failed to start".to_string())
            }
            Ok(None) => {
                let pid = proc.child.id();
                let port = proc.port;
                self.llama = Some(proc);
                Ok((pid, port))
            }
            Err(e) => {
                log::error!("Failed to check llama process: {}", e);
                Err("Failed to verify llama server status".to_string())
            }
        }
    }

    /// Spawn whisper.cpp with the loaded model. Returns `(pid, port)`.
    pub fn start_whisper(&mut self, port: Option<u16>) -> Result<(u32, u16), String> {
        if self.whisper.is_some() {
            return Err("Whisper server is already running".to_string());
        }
        let port = port.or_else(|| self.allocated_ports.as_ref().map(|p| p.whisper));
        let mut proc = start_whisper(port)?;
        thread::sleep(Duration::from_millis(500));
        match proc.child.try_wait() {
            Ok(Some(status)) => {
                log::error!("Whisper process exited immediately: {:?}", status);
                remove_pid_file("whisper");
                Err("Whisper server failed to start".to_string())
            }
            Ok(None) => {
                let pid = proc.child.id();
                let port = proc.port;
                self.whisper = Some(proc);
                Ok((pid, port))
            }
            Err(e) => {
                log::error!("Failed to check whisper process: {}", e);
                Err("Failed to verify whisper server status".to_string())
            }
        }
    }

    /// Spawn llama.cpp in embedding mode. Returns `(pid, port)`.
    pub fn start_embedding(&mut self, port: Option<u16>) -> Result<(u32, u16), String> {
        if self.embedding.is_some() {
            return Err("Embedding server is already running".to_string());
        }
        let port = port.or_else(|| self.allocated_ports.as_ref().map(|p| p.embedding));
        let mut proc = start_embedding(port)?;
        thread::sleep(Duration::from_millis(500));
        match proc.child.try_wait() {
            Ok(Some(status)) => {
                log::error!("Embedding process exited immediately: {:?}", status);
                remove_pid_file("embedding");
                Err("Embedding server failed to start".to_string())
            }
            Ok(None) => {
                let pid = proc.child.id();
                let port = proc.port;
                self.embedding = Some(proc);
                Ok((pid, port))
            }
            Err(e) => {
                log::error!("Failed to check embedding process: {}", e);
                Err("Failed to verify embedding server status".to_string())
            }
        }
    }

    /// Spawn the Python server and wait for `WAITING_FOR_PASSPHRASE` on stdout.
    pub fn start_server(&mut self) -> Result<(), String> {
        let already_alive = self
            .server
            .as_mut()
            .map(|p| matches!(p.child.try_wait(), Ok(None)))
            .unwrap_or(false);
        if already_alive {
            return Ok(());
        }
        // Drop any dead/stale handle so we can spawn a fresh one.
        if let Some(mut proc) = self.server.take() {
            let _ = proc.child.kill();
            let _ = proc.child.wait();
            remove_pid_file("server");
        }
        let mut proc = start_server()?;
        match proc.child.try_wait() {
            Ok(Some(status)) => {
                log::error!("Server process exited immediately: {:?}", status);
                remove_pid_file("server");
                Err("Server failed to start".to_string())
            }
            Ok(None) => {
                self.server = Some(proc);
                Ok(())
            }
            Err(e) => {
                log::error!("Failed to check server process: {}", e);
                Err("Failed to verify server status".to_string())
            }
        }
    }

    /// Write passphrase to the server stdin and wait for the `PORTS:` line.
    ///
    /// BLOCKING — can take up to ~30s while the Python server boots. Callers
    /// MUST wrap in `tokio::task::spawn_blocking`.
    pub fn send_passphrase(&mut self, passphrase: String) -> Result<AllocatedPorts, String> {
        match self.server.take() {
            Some(mut proc) => {
                let pid = proc.child.id();
                match send_passphrase_and_wait_for_ports(&mut proc, &passphrase) {
                    Ok(ports) => {
                        self.request_token = Some(ports.request_token.clone());
                        self.allocated_ports = Some(ports.clone());
                        self.server = Some(proc);
                        log::info!(
                            "Server PID {} unlocked; ports: server={}, llama={}, whisper={}, embedding={}",
                            pid,
                            ports.server,
                            ports.llama,
                            ports.whisper,
                            ports.embedding
                        );
                        Ok(ports)
                    }
                    Err(e) => {
                        log::error!("Failed to send passphrase: {}", e);
                        stop_drain_threads(&mut proc);
                        let _ = proc.child.kill();
                        let _ = proc.child.wait();
                        remove_pid_file("server");
                        Err(e)
                    }
                }
            }
            None => Err("Server is not running. Call start_server first.".to_string()),
        }
    }

    /// Stop a specific service.
    pub fn stop(&mut self, service: &str) -> Result<(), String> {
        match service {
            "llama" => stop_managed(&mut self.llama, "llama"),
            "whisper" => stop_managed(&mut self.whisper, "whisper"),
            "embedding" => stop_managed(&mut self.embedding, "embedding"),
            "server" => {
                if let Some(mut proc) = self.server.take() {
                    stop_drain_threads(&mut proc);
                    let _ = proc.child.kill();
                    let _ = proc.child.wait();
                    remove_pid_file("server");
                    Ok(())
                } else {
                    Err("Server is not running".to_string())
                }
            }
            _ => Err(format!("Unknown service: {}", service)),
        }
    }

    /// Snapshot of all service states. Reaps dead children first.
    pub fn status(&mut self) -> StatusData {
        self.check_liveness();
        create_status_data(
            self.llama.as_ref(),
            self.whisper.as_ref(),
            self.server.as_ref(),
            self.embedding.as_ref(),
            self.request_token.as_ref(),
        )
    }

    /// Kill every managed process. Used on window close and on shutdown.
    pub fn shutdown(&mut self) {
        // Fast path: nothing to do, and avoids the ~1.5s of no-op pkill
        // fallbacks below when called twice (X button → CloseRequested,
        // then app exit → ExitRequested).
        if self.llama.is_none()
            && self.whisper.is_none()
            && self.server.is_none()
            && self.embedding.is_none()
        {
            log::debug!("shutdown() called but no managed processes; skipping");
            return;
        }

        log::info!("Shutting down all managed processes");

        // Python server: graceful — SIGTERM / CTRL_BREAK with a 500ms grace
        // period so uvicorn can finish in-flight requests and SQLCipher can
        // flush before we fall back to SIGKILL.
        if let Some(mut proc) = self.server.take() {
            stop_drain_threads(&mut proc);
            kill_with_grace(&mut proc.child, Duration::from_millis(500), "server");
            remove_pid_file("server");
        }
        // Immediate SIGKILL: stateless inference engines with nothing to flush.
        if let Some(mut proc) = self.llama.take() {
            let _ = proc.child.kill();
            let _ = proc.child.wait();
            remove_pid_file("llama");
        }
        if let Some(mut proc) = self.whisper.take() {
            let _ = proc.child.kill();
            let _ = proc.child.wait();
            remove_pid_file("whisper");
        }
        if let Some(mut proc) = self.embedding.take() {
            let _ = proc.child.kill();
            let _ = proc.child.wait();
            remove_pid_file("embedding");
        }

        // Fallback: kill any orphans by name pattern
        kill_process_by_name("phlox-llama-server", "phlox-llama-server");
        kill_process_by_name("phlox-whisper-server", "phlox-whisper-server");
        kill_process_by_name("phlox-server", "phlox-server");
    }

    /// Reap dead children; remove their state entries and PID files.
    /// Returns the names of services that died during this reap.
    /// Called by the liveness watcher thread every 30s and by `status`.
    pub fn check_liveness(&mut self) -> Vec<&'static str> {
        let mut died = Vec::new();

        if self
            .llama
            .as_mut()
            .and_then(|p| p.child.try_wait().ok().flatten())
            .is_some()
        {
            log::warn!("Llama process died, removing from state");
            self.llama = None;
            remove_pid_file("llama");
            died.push("llama");
        }

        if self
            .whisper
            .as_mut()
            .and_then(|p| p.child.try_wait().ok().flatten())
            .is_some()
        {
            log::warn!("Whisper process died, removing from state");
            self.whisper = None;
            remove_pid_file("whisper");
            died.push("whisper");
        }

        if self
            .server
            .as_mut()
            .and_then(|p| p.child.try_wait().ok().flatten())
            .is_some()
        {
            log::warn!("Server process died, removing from state");
            if let Some(mut proc) = self.server.take() {
                stop_drain_threads(&mut proc);
            }
            remove_pid_file("server");
            died.push("server");
        }

        if self
            .embedding
            .as_mut()
            .and_then(|p| p.child.try_wait().ok().flatten())
            .is_some()
        {
            log::warn!("Embedding process died, removing from state");
            self.embedding = None;
            remove_pid_file("embedding");
            died.push("embedding");
        }

        died
    }
}

/// Kill a managed sidecar (non-server), remove its PID file, and clear state.
fn stop_managed(slot: &mut Option<ManagedProcess>, service: &str) -> Result<(), String> {
    if let Some(mut proc) = slot.take() {
        let _ = proc.child.kill();
        let _ = proc.child.wait();
        remove_pid_file(service);
        Ok(())
    } else {
        Err(format!("{} server is not running", capitalize(service)))
    }
}

fn capitalize(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
    }
}

#[cfg(test)]
mod tests;
