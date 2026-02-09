use std::path::PathBuf;
use std::process::Child;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::Manager;

use crate::services;

pub struct ServerProcess(pub Mutex<Option<Child>>);
pub struct LlamaProcess(pub Mutex<Option<Child>>);
pub struct WhisperProcess(pub Mutex<Option<Child>>);

/// Coordinates restarts to prevent conflicts between manual restarts and monitor loop
pub struct RestartCoordinator {
    #[allow(dead_code)]
    pub server_restarting: AtomicBool,
    pub llama_restarting: AtomicBool,
    pub whisper_restarting: AtomicBool,
}

impl RestartCoordinator {
    pub fn new() -> Self {
        Self {
            server_restarting: AtomicBool::new(false),
            llama_restarting: AtomicBool::new(false),
            whisper_restarting: AtomicBool::new(false),
        }
    }
}

impl Default for RestartCoordinator {
    fn default() -> Self {
        Self::new()
    }
}

/// Get the PID file path for a service
fn pid_file_for_service(service: &str) -> Option<PathBuf> {
    dirs::data_dir().map(|data_dir| data_dir.join("phlox").join(format!("{}.pid", service)))
}

/// Write a PID file after successful process spawn
pub fn write_pid_file(service: &str, pid: u32) {
    if let Some(pid_file) = pid_file_for_service(service) {
        if let Some(data_dir) = dirs::data_dir() {
            let phlox_dir = data_dir.join("phlox");
            std::fs::create_dir_all(&phlox_dir).ok();
        }
        if let Err(e) = std::fs::write(&pid_file, pid.to_string()) {
            log::warn!("Failed to write PID file for {}: {}", service, e);
        } else {
            log::debug!(
                "Wrote PID file for {}: PID {} at {:?}",
                service,
                pid,
                pid_file
            );
        }
    }
}

/// Check if a specific PID is alive
#[cfg(unix)]
fn is_process_alive(pid: u32) -> bool {
    use libc::kill;
    unsafe {
        // kill(pid, 0) doesn't actually send a signal, just checks if process exists
        // Returns 0 if process exists, -1 if not (with errno == ESRCH)
        kill(pid as i32, 0) == 0
    }
}

#[cfg(windows)]
fn is_process_alive(pid: u32) -> bool {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Threading::OpenProcess;
    use windows::Win32::System::Threading::PROCESS_QUERY_INFORMATION;

    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_INFORMATION, false, pid);
        if !handle.is_invalid() {
            CloseHandle(handle);
            true
        } else {
            false
        }
    }
}

/// Read PID from file and verify process is actually running.
/// Returns Some(pid) if running, None if not running or stale file.
pub fn is_process_running_from_pid(service: &str) -> Option<u32> {
    let pid_file = pid_file_for_service(service)?;
    let pid_str = std::fs::read_to_string(&pid_file).ok()?;
    let pid: u32 = pid_str.trim().parse().ok()?;

    if is_process_alive(pid) {
        log::debug!("Service {} is running with PID {}", service, pid);
        Some(pid)
    } else {
        // Stale PID file, clean it up
        log::debug!("Cleaning up stale PID file for {} (PID {})", service, pid);
        let _ = std::fs::remove_file(&pid_file);
        None
    }
}

/// Kill a process by PID and wait for it to exit
fn kill_process_by_pid(pid: u32, service_name: &str) {
    #[cfg(unix)]
    {
        use libc::{kill, SIGTERM};
        unsafe {
            log::info!("Killing {} process (PID: {})", service_name, pid);
            if kill(pid as i32, SIGTERM) == 0 {
                // Wait for process to exit
                for _ in 0..50 {
                    // 5 seconds max
                    thread::sleep(Duration::from_millis(100));
                    if !is_process_alive(pid) {
                        log::info!("{} process (PID: {}) terminated", service_name, pid);
                        return;
                    }
                }
                // Process didn't exit gracefully, force kill
                log::warn!("Force killing {} process (PID: {})", service_name, pid);
                let _ = kill(pid as i32, 9); // SIGKILL
                thread::sleep(Duration::from_millis(500));
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

        // Wait for process to exit
        for _ in 0..50 {
            thread::sleep(Duration::from_millis(100));
            if !is_process_alive(pid) {
                log::info!("{} process (PID: {}) terminated", service_name, pid);
                return;
            }
        }
    }
}

/// Kill a process by name pattern and wait for it to exit
fn kill_process_by_name(pattern: &str, service_name: &str) {
    #[cfg(target_os = "macos")]
    {
        log::info!("Killing {} processes matching: {}", service_name, pattern);
        let _ = std::process::Command::new("pkill")
            .arg("-f")
            .arg(pattern)
            .output();
    }

    #[cfg(target_os = "linux")]
    {
        log::info!("Killing {} processes matching: {}", service_name, pattern);
        let _ = std::process::Command::new("pkill")
            .arg("-f")
            .arg(pattern)
            .output();
    }

    #[cfg(target_os = "windows")]
    {
        log::info!("Killing {} processes matching: {}", service_name, pattern);
        let _ = std::process::Command::new("taskkill")
            .arg("/F")
            .arg("/IM")
            .arg(pattern)
            .output();
    }

    thread::sleep(Duration::from_millis(500));
}

pub fn kill_all_processes() {
    log::info!("Killing all existing processes...");

    // First, kill any processes tracked by PID files
    let services = ["llama", "whisper", "server"];

    for service in &services {
        if let Some(pid) = is_process_running_from_pid(service) {
            kill_process_by_pid(pid, service);
        }
        // Clean up PID file even if process wasn't running
        if let Some(pid_file) = pid_file_for_service(service) {
            let _ = std::fs::remove_file(&pid_file);
        }
    }

    // Fallback: kill by name pattern for any orphaned processes
    kill_process_by_name("llama-server", "llama-server");
    kill_process_by_name("whisper-server", "whisper-server");
    kill_process_by_name("server_dist/server", "server");

    // Final wait to ensure all processes are gone
    thread::sleep(Duration::from_millis(500));

    log::info!("All processes killed");
}

pub fn cleanup_stale_files() {
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

        // Clean up PID files
        for service in ["llama", "whisper", "server"] {
            let pid_file = phlox_dir.join(format!("{}.pid", service));
            if pid_file.exists() {
                let _ = std::fs::remove_file(&pid_file);
            }
        }
    }
}

pub fn monitor_processes(app_handle: tauri::AppHandle, monitor_whisper: bool) {
    thread::spawn(move || {
        log::info!("Starting process monitor thread");

        // Get coordinator once at the start
        let coordinator = match app_handle.try_state::<RestartCoordinator>() {
            Some(c) => c,
            None => {
                log::error!("Failed to get RestartCoordinator state");
                return;
            }
        };

        loop {
            thread::sleep(Duration::from_secs(10));

            // Check server process
            if let Ok(mut process_guard) = app_handle.state::<ServerProcess>().0.lock() {
                if let Some(ref mut child) = *process_guard {
                    match child.try_wait() {
                        Ok(Some(exit_status)) => {
                            log::error!("Server process exited with status: {:?}", exit_status);
                            *process_guard = None;
                            // Note: With no keychain caching, we cannot auto-restart the server
                            // User will need to unlock again on next app launch
                            log::warn!("Server cannot be auto-restarted (no cached passphrase)");
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

                            // Only restart if not already being restarted manually
                            if !coordinator.llama_restarting.load(Ordering::SeqCst) {
                                match services::start_llama() {
                                    Ok(new_child) => {
                                        log::info!("Llama restarted with PID: {}", new_child.id());
                                        *process_guard = Some(new_child);
                                    }
                                    Err(e) => {
                                        log::error!("Failed to restart Llama: {}", e);
                                        log::info!("Llama will restart after model download");
                                    }
                                }
                            } else {
                                log::debug!("Llama restart in progress, skipping monitor restart");
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

                                // Only restart if not already being restarted manually
                                if !coordinator.whisper_restarting.load(Ordering::SeqCst) {
                                    match services::start_whisper() {
                                        Ok(new_child) => {
                                            log::info!(
                                                "Whisper restarted with PID: {}",
                                                new_child.id()
                                            );
                                            *process_guard = Some(new_child);
                                        }
                                        Err(e) => log::error!("Failed to restart Whisper: {}", e),
                                    }
                                } else {
                                    log::debug!(
                                        "Whisper restart in progress, skipping monitor restart"
                                    );
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
