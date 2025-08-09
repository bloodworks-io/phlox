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
struct OllamaProcess(Mutex<Option<Child>>);

fn kill_all_processes() {
    log::info!("Killing all existing server and Ollama processes...");

    // Kill server processes
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("pkill")
            .arg("-f")
            .arg("server_dist/server")
            .output();

        let _ = std::process::Command::new("pkill")
            .arg("-f")
            .arg("ollama")
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
            .arg("ollama.exe")
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
            .arg("ollama")
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

        let ollama_port_file = phlox_dir.join("ollama_port.txt");
        if ollama_port_file.exists() {
            let _ = std::fs::remove_file(&ollama_port_file);
        }
    }
}

fn start_ollama(_app_handle: tauri::AppHandle) -> Result<Child, Box<dyn std::error::Error>> {
    let current_exe = std::env::current_exe().expect("failed to get current executable path");
    let exe_dir = current_exe
        .parent()
        .expect("failed to get executable directory");

    #[cfg(target_os = "windows")]
    let ollama_path = exe_dir.join("ollama.exe");
    #[cfg(not(target_os = "windows"))]
    let ollama_path = exe_dir.join("ollama");

    log::info!("Starting Ollama from: {:?}", ollama_path);

    if !ollama_path.exists() {
        return Err(format!("Ollama binary not found at {:?}", ollama_path).into());
    }

    // Set Ollama environment variables
    let mut cmd = Command::new(&ollama_path);
    cmd.arg("serve");

    // Set custom port for Ollama (default is 11434)
    cmd.env("OLLAMA_HOST", "127.0.0.1:11434");

    // Set Ollama models directory to our app data directory
    if let Some(data_dir) = dirs::data_dir() {
        let models_dir = data_dir.join("phlox").join("ollama_models");
        std::fs::create_dir_all(&models_dir).ok();
        cmd.env("OLLAMA_MODELS", models_dir);
    }

    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }

    cmd.stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    let child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn Ollama process: {}", e))?;

    log::info!("Ollama started with PID: {}", child.id());

    // Write Ollama port to file for the Python server to read
    if let Some(data_dir) = dirs::data_dir() {
        let phlox_dir = data_dir.join("phlox");
        std::fs::create_dir_all(&phlox_dir).ok();
        let ollama_port_file = phlox_dir.join("ollama_port.txt");
        std::fs::write(ollama_port_file, "11434").ok();
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

fn monitor_processes(app_handle: tauri::AppHandle) {
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

            // Check Ollama process
            if let Ok(mut process_guard) = app_handle.state::<OllamaProcess>().0.lock() {
                if let Some(ref mut child) = *process_guard {
                    match child.try_wait() {
                        Ok(Some(exit_status)) => {
                            log::error!("Ollama process exited with status: {:?}", exit_status);
                            *process_guard = None;

                            // Restart Ollama
                            match start_ollama(app_handle.clone()) {
                                Ok(new_child) => {
                                    log::info!("Ollama restarted with PID: {}", new_child.id());
                                    *process_guard = Some(new_child);
                                }
                                Err(e) => log::error!("Failed to restart Ollama: {}", e),
                            }
                        }
                        Ok(None) => {
                            // Process is still running
                        }
                        Err(e) => {
                            log::error!("Error checking Ollama process: {}", e);
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
fn get_ollama_port() -> String {
    if let Some(data_dir) = dirs::data_dir() {
        let port_file = data_dir.join("phlox").join("ollama_port.txt");
        if let Ok(port) = std::fs::read_to_string(&port_file) {
            return port.trim().to_string();
        }
    }
    "11434".to_string()
}

#[tauri::command]
fn get_service_status(
    server_state: tauri::State<ServerProcess>,
    ollama_state: tauri::State<OllamaProcess>,
) -> serde_json::Value {
    let server_running = server_state.0.lock().map(|g| g.is_some()).unwrap_or(false);

    let ollama_running = ollama_state.0.lock().map(|g| g.is_some()).unwrap_or(false);

    serde_json::json!({
        "server_running": server_running,
        "ollama_running": ollama_running,
        "server_port": get_server_port(),
        "ollama_port": get_ollama_port()
    })
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
        .manage(OllamaProcess(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            get_server_port,
            get_ollama_port,
            get_service_status,
            get_system_specs
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();
            log::info!("App setup started");

            // Clean up any existing processes and files
            kill_all_processes();
            cleanup_stale_files();

            // Start Ollama first
            match start_ollama(app_handle.clone()) {
                Ok(ollama_child) => {
                    let ollama_pid = ollama_child.id();
                    *app.state::<OllamaProcess>().0.lock().unwrap() = Some(ollama_child);
                    log::info!("Ollama started with PID: {}", ollama_pid);

                    // Wait for Ollama to be ready
                    thread::spawn(move || {
                        if wait_for_service("Ollama", "11434", 30) {
                            // Now start the server
                            match start_server(app_handle.clone()) {
                                Ok(server_child) => {
                                    let server_pid = server_child.id();
                                    *app_handle.state::<ServerProcess>().0.lock().unwrap() =
                                        Some(server_child);
                                    log::info!("Server started with PID: {}", server_pid);

                                    // Wait for server to be ready
                                    wait_for_server();

                                    // Start monitoring both processes
                                    monitor_processes(app_handle.clone());
                                }
                                Err(e) => {
                                    log::error!("Failed to start server: {}", e);
                                }
                            }
                        } else {
                            log::error!("Ollama failed to start, not starting server");
                        }
                    });
                }
                Err(e) => {
                    log::error!("Failed to start Ollama: {}", e);
                }
            }

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

                if let Some(ollama_state) = app_handle.try_state::<OllamaProcess>() {
                    if let Ok(mut process) = ollama_state.0.lock() {
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
