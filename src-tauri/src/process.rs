use std::process::Child;
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::Manager;

use crate::services;

pub struct ServerProcess(pub Mutex<Option<Child>>);
pub struct LlamaProcess(pub Mutex<Option<Child>>);
pub struct WhisperProcess(pub Mutex<Option<Child>>);

pub fn kill_all_processes() {
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
    }
}

pub fn monitor_processes(app_handle: tauri::AppHandle, monitor_whisper: bool) {
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
                            match services::start_server() {
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
