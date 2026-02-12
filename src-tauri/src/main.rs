mod commands;
mod encryption;
mod pm_client;
mod process;
mod services;

use log::LevelFilter;
use std::thread;
use std::time::Duration;
use tauri::{Emitter, Manager};
use tauri_plugin_log::{Target, TargetKind};

use commands::{
    change_passphrase, clear_keychain, convert_audio_to_wav, get_encryption_status,
    get_service_status, get_system_specs, has_database, has_encryption_setup, has_keychain_entry,
    restart_llama, restart_whisper, setup_encryption, start_llama_service, start_server_command,
    start_whisper_service, unlock_with_passphrase, CachedServiceStatus,
};
use pm_client::ProcessManagerClient;
use process::{
    cleanup_stale_files, kill_all_processes, LlamaProcess, RestartCoordinator, ServerProcess,
    WhisperProcess,
};

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
        .manage(ServerProcess(std::sync::Mutex::new(None)))
        .manage(LlamaProcess(std::sync::Mutex::new(None)))
        .manage(WhisperProcess(std::sync::Mutex::new(None)))
        .manage(RestartCoordinator::default())
        .manage(CachedServiceStatus(std::sync::Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            commands::get_server_port,
            commands::get_llm_port,
            commands::get_whisper_port,
            get_service_status,
            get_system_specs,
            restart_whisper,
            restart_llama,
            start_llama_service,
            start_whisper_service,
            convert_audio_to_wav,
            start_server_command,
            // Encryption commands
            has_encryption_setup,
            has_database,
            has_keychain_entry,
            setup_encryption,
            unlock_with_passphrase,
            change_passphrase,
            clear_keychain,
            get_encryption_status
        ])
        .setup(|app| {
            // Set transparent titlebar with custom dark background color on macOS
            #[cfg(target_os = "macos")]
            {
                use cocoa::appkit::{NSColor, NSWindow};
                use cocoa::base::{id, nil};

                if let Some(window) = app.get_webview_window("main") {
                    let ns_window = window.ns_window().unwrap() as id;
                    unsafe {
                        // Convert #1e2030 to RGB: (30, 32, 48)
                        let bg_color = NSColor::colorWithRed_green_blue_alpha_(
                            nil,
                            30.0 / 255.0,
                            32.0 / 255.0,
                            48.0 / 255.0,
                            1.0,
                        );
                        ns_window.setBackgroundColor_(bg_color);
                        // Hide the title text while keeping the title bar buttons visible
                        ns_window.setTitleVisibility_(
                            cocoa::appkit::NSWindowTitleVisibility::NSWindowTitleHidden,
                        );
                    }
                }
            }

            let app_handle = app.handle().clone();
            log::info!("App setup started");

            // Clean up any existing processes and files from previous runs
            kill_all_processes();
            cleanup_stale_files();

            // Launch the process manager
            log::info!("Launching process manager...");
            if let Err(e) = launch_process_manager() {
                log::error!("Failed to launch process manager: {}", e);
                // Continue anyway - we'll show an error to the user
            }

            // Wait for process manager socket to be ready
            let pm_ready = wait_for_process_manager(Duration::from_secs(5));

            if !pm_ready {
                log::error!("Process manager failed to start. This is a critical error.");
                // We could emit an event to the frontend here to show an error
            } else {
                log::info!("Process manager is ready");
                // Llama and whisper will be started after the Python server is up
                // and has allocated the ports (triggered by frontend)
            }

            // Spawn a thread to monitor PM health
            let app_handle_for_monitor = app_handle.clone();
            thread::spawn(move || {
                monitor_process_manager(app_handle_for_monitor);
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                log::info!("Window close requested. Shutting down process manager.");

                // Tell PM to shutdown - it will clean up all processes
                if let Ok(client) = ProcessManagerClient::new() {
                    let _ = client.shutdown();
                }

                // Clean up local files
                cleanup_stale_files();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Launch the process manager as a child process
fn launch_process_manager() -> Result<(), Box<dyn std::error::Error>> {
    use std::process::Command;

    let current_exe = std::env::current_exe()?;
    let exe_dir = current_exe
        .parent()
        .ok_or("Failed to get executable directory")?;

    // Look for phlox-pm in the same directory
    let pm_path = exe_dir.join("phlox-pm");

    #[cfg(target_os = "windows")]
    let pm_path = pm_path.with_extension("exe");

    log::info!("Launching process manager from: {:?}", pm_path);

    // Check if PM binary exists
    if !pm_path.exists() {
        // For development, try to find it in the target directory
        // Check both debug and release paths
        let dev_pm_paths = [
            exe_dir
                .parent()
                .and_then(|p| p.parent())
                .map(|p| p.join("target").join("debug").join("phlox-pm")),
            exe_dir
                .parent()
                .and_then(|p| p.parent())
                .map(|p| p.join("target").join("release").join("phlox-pm")),
        ];

        for dev_path in dev_pm_paths.iter().filter_map(|p| p.as_ref()) {
            if dev_path.exists() {
                log::info!("Using dev PM path: {:?}", dev_path);
                return spawn_pm(dev_path);
            }
        }

        return Err(format!("Process manager binary not found at {:?}", pm_path).into());
    }

    spawn_pm(&pm_path)
}

#[cfg(unix)]
fn spawn_pm(path: &std::path::Path) -> Result<(), Box<dyn std::error::Error>> {
    use std::os::unix::process::CommandExt;
    use std::process::Command;

    Command::new(path).process_group(0).spawn()?;

    Ok(())
}

#[cfg(windows)]
fn spawn_pm(path: &std::path::Path) -> Result<(), Box<dyn std::error::Error>> {
    use std::process::Command;

    Command::new(path).spawn()?;

    Ok(())
}

/// Wait for the process manager socket to be ready
fn wait_for_process_manager(timeout: Duration) -> bool {
    let start = std::time::Instant::now();
    let socket_path = pm_client::socket_path();

    while start.elapsed() < timeout {
        // Just check if the socket file exists and we can connect - don't ping yet
        // This avoids blocking the PM server with health checks during startup
        if socket_path.exists() {
            // Try to connect once to verify it's actually accepting connections
            if std::os::unix::net::UnixStream::connect(&socket_path).is_ok() {
                return true;
            }
        }
        std::thread::sleep(Duration::from_millis(100));
    }

    false
}

/// Monitor the process manager and emit an event if it dies
fn monitor_process_manager(app_handle: tauri::AppHandle) {
    let mut consecutive_failures = 0;
    const MAX_FAILURES: u32 = 3; // Allow some transient failures

    loop {
        // Check every 30 seconds instead of 10 - less aggressive
        std::thread::sleep(Duration::from_secs(30));

        if !ProcessManagerClient::is_alive() {
            consecutive_failures += 1;
            log::warn!(
                "Process manager health check failed (attempt {}/{})",
                consecutive_failures,
                MAX_FAILURES
            );

            if consecutive_failures >= MAX_FAILURES {
                log::error!("Process manager is not responding after multiple checks!");
                log::error!("Please restart the application to restore functionality.");

                // Emit an event to the frontend
                let _ = app_handle.emit("process-manager-died", ());

                // We can't recover from this, so stop monitoring
                break;
            }
        } else {
            // Reset on success
            consecutive_failures = 0;
        }
    }
}

fn main() {
    run();
}
