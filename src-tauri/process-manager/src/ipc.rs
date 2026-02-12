use crate::process::{
    create_status_data, kill_all_processes, start_llama, start_server, start_whisper,
    AllocatedPorts, ManagedProcess,
};
use crate::protocol::{Request, Response};
use log::{error, info, warn};
use std::io::{BufRead, BufReader, Write};
use std::os::unix::net::{UnixListener, UnixStream};
use std::path::PathBuf;
use std::thread;
use std::time::Duration;

/// Get the socket path
pub fn socket_path() -> PathBuf {
    crate::process::phlox_dir()
        .expect("Failed to get data directory")
        .join("phlox_pm.sock")
}

/// Handle a client connection
fn handle_client(
    mut stream: UnixStream,
    state: &mut ProcessManagerState,
) -> Result<(), Box<dyn std::error::Error>> {
    stream.set_nonblocking(false)?;
    // Use a longer read timeout for operations that may take time (e.g., starting server and waiting for port allocation)
    stream.set_read_timeout(Some(Duration::from_secs(30)))?;

    let mut reader = BufReader::new(&stream);
    let mut request = String::new();

    reader.read_line(&mut request)?;

    let request = match Request::from_json(&request) {
        Ok(req) => req,
        Err(e) => {
            warn!("Invalid request: {}", e);
            let response = Response::error(format!("Invalid request: {}", e));
            stream.write_all(response.to_json().as_bytes())?;
            stream.write_all(b"\n")?;
            stream.flush()?;
            return Ok(());
        }
    };

    let response = match request {
        Request::StartLlama { model_path: _ } => {
            if state.llama.is_some() {
                Response::error("Llama server is already running")
            } else {
                // Use allocated port if available, otherwise None (will use fallback)
                let port = state.allocated_ports.as_ref().map(|p| p.llama);
                match start_llama(port) {
                    Ok(mut proc) => {
                        // Wait a moment for the process to start
                        thread::sleep(Duration::from_millis(500));
                        // Check if still alive
                        match proc.child.try_wait() {
                            Ok(Some(status)) => {
                                error!("Llama process exited immediately: {:?}", status);
                                Response::error("Llama server failed to start")
                            }
                            Ok(None) => {
                                let pid = proc.child.id();
                                let port = proc.port;
                                state.llama = Some(proc);
                                Response::ok_started(pid, port, 0, 0)
                            }
                            Err(e) => {
                                error!("Failed to check llama process: {}", e);
                                Response::error("Failed to verify llama server status")
                            }
                        }
                    }
                    Err(e) => Response::error(e),
                }
            }
        }
        Request::StartWhisper { model_path: _ } => {
            if state.whisper.is_some() {
                Response::error("Whisper server is already running")
            } else {
                // Use allocated port if available, otherwise None (will use fallback)
                let port = state.allocated_ports.as_ref().map(|p| p.whisper);
                match start_whisper(port) {
                    Ok(mut proc) => {
                        thread::sleep(Duration::from_millis(500));
                        match proc.child.try_wait() {
                            Ok(Some(status)) => {
                                error!("Whisper process exited immediately: {:?}", status);
                                Response::error("Whisper server failed to start")
                            }
                            Ok(None) => {
                                let pid = proc.child.id();
                                let port = proc.port;
                                state.whisper = Some(proc);
                                Response::ok_started(pid, port, 0, 0)
                            }
                            Err(e) => {
                                error!("Failed to check whisper process: {}", e);
                                Response::error("Failed to verify whisper server status")
                            }
                        }
                    }
                    Err(e) => Response::error(e),
                }
            }
        }
        Request::StartServer { passphrase } => {
            if state.server.is_some() {
                Response::error("Server is already running")
            } else {
                match start_server(&passphrase) {
                    Ok((mut proc, ports)) => {
                        // Store allocated ports for later use by llama/whisper
                        state.allocated_ports = Some(ports.clone());

                        match proc.child.try_wait() {
                            Ok(Some(status)) => {
                                error!("Server process exited immediately: {:?}", status);
                                Response::error("Server failed to start")
                            }
                            Ok(None) => {
                                let pid = proc.child.id();
                                state.server = Some(proc);
                                Response::ok_started(pid, ports.server, ports.llama, ports.whisper)
                            }
                            Err(e) => {
                                error!("Failed to check server process: {}", e);
                                Response::error("Failed to verify server status")
                            }
                        }
                    }
                    Err(e) => Response::error(e),
                }
            }
        }
        Request::Stop { service } => {
            let result = match service.as_str() {
                "llama" => {
                    if let Some(mut proc) = state.llama.take() {
                        let _ = proc.child.kill();
                        let _ = proc.child.wait();
                        crate::process::remove_pid_file("llama");
                        Some(Response::ok_stopped())
                    } else {
                        Some(Response::error("Llama server is not running"))
                    }
                }
                "whisper" => {
                    if let Some(mut proc) = state.whisper.take() {
                        let _ = proc.child.kill();
                        let _ = proc.child.wait();
                        crate::process::remove_pid_file("whisper");
                        Some(Response::ok_stopped())
                    } else {
                        Some(Response::error("Whisper server is not running"))
                    }
                }
                "server" => {
                    if let Some(mut proc) = state.server.take() {
                        let _ = proc.child.kill();
                        let _ = proc.child.wait();
                        crate::process::remove_pid_file("server");
                        Some(Response::ok_stopped())
                    } else {
                        Some(Response::error("Server is not running"))
                    }
                }
                _ => Some(Response::error(format!("Unknown service: {}", service))),
            };
            result.unwrap_or_else(|| Response::error("Failed to stop service"))
        }
        Request::Status => {
            // Update process states
            update_process_states(state);
            let status = create_status_data(
                state.llama.as_ref(),
                state.whisper.as_ref(),
                state.server.as_ref(),
            );
            Response::ok_status(status)
        }
        Request::Shutdown => {
            info!("Shutdown requested");
            Response::ok_shutdown()
        }
        Request::Ping => Response::ok_pong(),
    };

    stream.write_all(response.to_json().as_bytes())?;
    stream.write_all(b"\n")?;
    stream.flush()?;
    Ok(())
}

/// Update process states by checking if they're still alive
fn update_process_states(state: &mut ProcessManagerState) {
    if let Some(ref mut proc) = state.llama {
        if let Ok(Some(_)) = proc.child.try_wait() {
            warn!("Llama process died, removing from state");
            state.llama = None;
            crate::process::remove_pid_file("llama");
        }
    }

    if let Some(ref mut proc) = state.whisper {
        if let Ok(Some(_)) = proc.child.try_wait() {
            warn!("Whisper process died, removing from state");
            state.whisper = None;
            crate::process::remove_pid_file("whisper");
        }
    }

    if let Some(ref mut proc) = state.server {
        if let Ok(Some(_)) = proc.child.try_wait() {
            warn!("Server process died, removing from state");
            state.server = None;
            crate::process::remove_pid_file("server");
        }
    }
}

pub struct ProcessManagerState {
    pub llama: Option<ManagedProcess>,
    pub whisper: Option<ManagedProcess>,
    pub server: Option<ManagedProcess>,
    pub allocated_ports: Option<AllocatedPorts>,
    pub should_shutdown: bool,
}

impl Default for ProcessManagerState {
    fn default() -> Self {
        Self {
            llama: None,
            whisper: None,
            server: None,
            allocated_ports: None,
            should_shutdown: false,
        }
    }
}

/// Run the IPC server
pub fn run_ipc_server() -> Result<(), Box<dyn std::error::Error>> {
    let socket_path = socket_path();

    // Remove existing socket if present
    if socket_path.exists() {
        std::fs::remove_file(&socket_path)?;
        info!("Removed existing socket at {:?}", socket_path);
    }

    // Ensure parent directory exists
    if let Some(parent) = socket_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let listener = UnixListener::bind(&socket_path)?;
    info!("IPC server listening on {:?}", socket_path);

    // Set socket permissions to user-only
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(&socket_path)?.permissions();
        perms.set_mode(0o600);
        std::fs::set_permissions(&socket_path, perms)?;
    }

    let mut state = ProcessManagerState::default();

    // Accept connections in a loop
    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                if let Err(e) = handle_client(stream, &mut state) {
                    // Timeout errors are expected (health checks, etc.), don't spam logs
                    let err_str = e.to_string();
                    if !err_str.contains("Resource temporarily unavailable")
                        && !err_str.contains("Invalid argument")
                        && !err_str.contains("Broken pipe")
                    {
                        error!("Error handling client: {}", e);
                    }
                }

                // Check if shutdown was requested
                if state.should_shutdown {
                    info!("Shutting down IPC server...");
                    kill_all_processes();
                    break;
                }
            }
            Err(e) => {
                error!("Failed to accept connection: {}", e);
            }
        }
    }

    // Clean up socket
    let _ = std::fs::remove_file(&socket_path);

    Ok(())
}
