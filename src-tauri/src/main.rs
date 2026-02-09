mod commands;
mod encryption;
mod process;
mod services;

use log::LevelFilter;
use std::thread;
use tauri::Manager;
use tauri_plugin_log::{Target, TargetKind};

use commands::{
    change_passphrase, clear_keychain, convert_audio_to_wav, get_encryption_status,
    get_service_status, get_system_specs, has_database, has_encryption_setup, has_keychain_entry,
    restart_llama, restart_whisper, setup_encryption, start_server_command, unlock_with_passphrase,
};
use process::{
    cleanup_stale_files, kill_all_processes, monitor_processes, LlamaProcess, RestartCoordinator,
    ServerProcess, WhisperProcess,
};
use services::{start_llama, start_whisper, wait_for_service};

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
        .invoke_handler(tauri::generate_handler![
            commands::get_server_port,
            commands::get_llm_port,
            commands::get_whisper_port,
            get_service_status,
            get_system_specs,
            restart_whisper,
            restart_llama,
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

            // Clean up any existing processes and files
            kill_all_processes();
            cleanup_stale_files();

            // Start Llama (optional - may fail if no model downloaded)
            let llama_started = start_llama().is_ok();

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
                let whisper_started = start_whisper().is_ok();

                if whisper_started {
                    log::info!("Whisper server started successfully");
                } else {
                    log::warn!(
                        "Whisper server did not start (no model downloaded yet - this is OK)"
                    );
                }

                // Start monitoring all processes (server will be started by frontend after encryption)
                monitor_processes(app_handle.clone(), whisper_started);
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

fn main() {
    run();
}
