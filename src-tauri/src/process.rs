use std::path::PathBuf;
use std::thread;
use std::time::Duration;

/// Get the PID file path for a service.

fn pid_file_for_service(service: &str) -> Option<PathBuf> {
    crate::pm::phlox_dir().map(|dir| dir.join(format!("{}.pid", service)))
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

/// Kill a process by name pattern. Only sleeps when at least one process
/// was actually signalled (skips the 500ms wait in the common no-op case).
fn kill_process_by_name(pattern: &str, service_name: &str) {
    if kill_by_name_inner(pattern, service_name) {
        thread::sleep(Duration::from_millis(500));
    }
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn kill_by_name_inner(pattern: &str, service_name: &str) -> bool {
    log::info!("Killing {} processes matching: {}", service_name, pattern);
    std::process::Command::new("pkill")
        .arg("-f")
        .arg(pattern)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

#[cfg(target_os = "windows")]
fn kill_by_name_inner(pattern: &str, service_name: &str) -> bool {
    log::info!("Killing {} processes matching: {}", service_name, pattern);
    std::process::Command::new("taskkill")
        .arg("/F")
        .arg("/IM")
        .arg(pattern)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

pub fn kill_all_processes() {
    log::info!("Killing all existing processes...");

    // First, kill any processes tracked by PID files
    let services = ["llama", "whisper", "server", "embedding"];

    for service in &services {
        if let Some(pid) = is_process_running_from_pid(service) {
            kill_process_by_pid(pid, service);
        }
        // Clean up PID file even if process wasn't running
        if let Some(pid_file) = pid_file_for_service(service) {
            let _ = std::fs::remove_file(&pid_file);
        }
    }

    // Fallback: kill by name pattern for any orphaned processes.
    // The embedding server uses the same binary as the LLM server, so
    // phlox-llama-server covers both.
    kill_process_by_name("phlox-llama-server", "phlox-llama-server");
    kill_process_by_name("phlox-whisper-server", "phlox-whisper-server");
    kill_process_by_name("phlox-server", "phlox-server");

    // Final wait to ensure all processes are gone
    thread::sleep(Duration::from_millis(500));

    log::info!("All processes killed");
}

pub fn cleanup_stale_files() {
    if let Some(phlox_dir) = crate::pm::phlox_dir() {
        // Clean up PID files
        for service in ["llama", "whisper", "server", "embedding"] {
            let pid_file = phlox_dir.join(format!("{}.pid", service));
            if pid_file.exists() {
                let _ = std::fs::remove_file(&pid_file);
            }
        }
    }
}
