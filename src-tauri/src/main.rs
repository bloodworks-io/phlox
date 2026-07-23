mod commands;
mod encryption;
mod pm;
mod process;

use log::LevelFilter;
use std::thread;
use std::time::Duration;
use tauri::{Emitter, Manager};
use tauri_plugin_log::{Target, TargetKind};

use commands::{
    change_passphrase, clear_keychain, get_encryption_status, get_service_status, get_system_specs,
    has_database, has_encryption_setup, has_keychain_entry, restart_embedding, restart_llama,
    restart_whisper, send_passphrase_command, setup_encryption, start_embedding_service,
    start_llama_service, start_server_command, start_whisper_service, unlock_with_passphrase,
    CachedServiceStatus,
};
use process::{cleanup_stale_files, kill_all_processes};

/// Position the traffic light buttons (close, minimize, maximize) with custom offset
#[cfg(target_os = "macos")]
fn position_traffic_light_buttons(ns_window: &objc2_app_kit::NSWindow) {
    use objc2_app_kit::NSWindowButton;
    use objc2_foundation::{NSPoint, NSRect};

    if let Some(close_button) = ns_window.standardWindowButton(NSWindowButton::CloseButton) {
        // superview() is unsafe (not retained internally)
        if let Some(superview) = unsafe { close_button.superview() } {
            let frame = superview.frame();
            let new_frame = NSRect::new(
                NSPoint::new(frame.origin.x + 9.0, frame.origin.y - 8.0),
                frame.size,
            );
            superview.setFrame(new_frame);
        }
    }
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
        .plugin(tauri_plugin_http::init())
        .manage(CachedServiceStatus(std::sync::Mutex::new(None)))
        .manage(pm::PmState(std::sync::Mutex::new(
            pm::ProcessManagerState::default(),
        )))
        .invoke_handler(tauri::generate_handler![
            commands::get_server_port,
            commands::get_llm_port,
            commands::get_whisper_port,
            commands::get_embedding_port,
            commands::get_request_token,
            get_service_status,
            get_system_specs,
            restart_whisper,
            restart_llama,
            restart_embedding,
            start_llama_service,
            start_whisper_service,
            start_embedding_service,
            start_server_command,
            send_passphrase_command,
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
                use objc2_app_kit::{NSColor, NSWindow, NSWindowTitleVisibility};

                if let Some(window) = app.get_webview_window("main") {
                    let theme = window.theme().unwrap_or(tauri::Theme::Light);
                    let (r, g, b) = match theme {
                        tauri::Theme::Dark => (30.0, 32.0, 48.0),
                        _ => (230.0, 233.0, 239.0),
                    };
                    let ns_window_ptr = window.ns_window().unwrap();
                    let ns_window: &NSWindow = unsafe { &*(ns_window_ptr as *mut NSWindow) };
                    let bg_color = NSColor::colorWithRed_green_blue_alpha(
                        r / 255.0,
                        g / 255.0,
                        b / 255.0,
                        1.0,
                    );
                    ns_window.setBackgroundColor(Some(&bg_color));
                    // Hide the title text while keeping the title bar buttons visible
                    ns_window.setTitleVisibility(NSWindowTitleVisibility::Hidden);

                    // Position traffic light buttons
                    position_traffic_light_buttons(ns_window);
                }
            }

            let app_handle = app.handle().clone();
            log::info!("App setup started");

            #[cfg(target_os = "linux")]
            grant_webview_permissions(&app_handle);

            // Clean up orphans from a previous crashed session
            kill_all_processes();
            cleanup_stale_files();

            // Install cleanup hooks for abnormal exits (panic, SIGTERM/SIGINT)
            install_cleanup_hooks();

            // Spawn liveness watcher for managed sidecar processes
            let app_handle_for_monitor = app_handle.clone();
            thread::spawn(move || {
                monitor_service_health(app_handle_for_monitor);
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            // Re-apply traffic light button positioning on resize
            #[cfg(target_os = "macos")]
            if let tauri::WindowEvent::Resized { .. } = event {
                if let Ok(ns_window_ptr) = window.ns_window() {
                    let ns_window: &objc2_app_kit::NSWindow =
                        unsafe { &*(ns_window_ptr as *mut objc2_app_kit::NSWindow) };
                    position_traffic_light_buttons(ns_window);
                }
            }

            if let tauri::WindowEvent::CloseRequested { .. } = event {
                log::info!("Window close requested. Shutting down managed processes.");

                // Kill all managed sidecar processes directly (no separate PM)
                let pm_state = window.app_handle().state::<pm::PmState>();
                pm_state.0.lock().unwrap().shutdown();

                // Clean up local files
                cleanup_stale_files();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| match event {
            tauri::RunEvent::ExitRequested { .. } => {
                log::info!("RunEvent::ExitRequested — graceful shutdown via PmState");
                let pm_state = app_handle.state::<pm::PmState>();
                pm_state.0.lock().unwrap().shutdown();
                cleanup_stale_files();
            }
            tauri::RunEvent::Exit => {
                log::info!("RunEvent::Exit — last-chance cleanup via PmState");
                let pm_state = app_handle.state::<pm::PmState>();
                let mut state = pm_state.0.lock().unwrap_or_else(|e| e.into_inner());
                state.shutdown();
                drop(state);
                cleanup_stale_files();
            }
            _ => {}
        });
}

/// Install cleanup hooks for abnormal process termination.
fn install_cleanup_hooks() {
    extern "C" fn on_signal(_sig: libc::c_int) {
        crate::process::kill_all_processes();
        std::process::exit(130);
    }

    #[cfg(unix)]
    unsafe {
        libc::signal(libc::SIGTERM, on_signal as *const () as libc::sighandler_t);
        libc::signal(libc::SIGINT, on_signal as *const () as libc::sighandler_t);
    }

    // Panic hook: kill children before unwinding so we don't orphan sidecars.
    let prev_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        crate::process::kill_all_processes();
        prev_hook(info);
    }));
}

fn monitor_service_health(app_handle: tauri::AppHandle) {
    loop {
        thread::sleep(Duration::from_secs(30));

        let pm_state = app_handle.state::<pm::PmState>();
        let mut state = pm_state.0.lock().unwrap();
        let died = state.check_liveness();
        drop(state);

        for service in died {
            log::warn!("Emitting service-died event for: {}", service);
            let _ = app_handle.emit("service-died", service);
        }
    }
}

#[cfg(target_os = "linux")]
fn grant_webview_permissions(app_handle: &tauri::AppHandle) {
    use tauri::Manager;

    let Some(window) = app_handle.get_webview_window("main") else {
        log::warn!("grant_webview_permissions: main webview window not found");
        return;
    };

    let result = window.with_webview(|webview| {
        use webkit2gtk::{PermissionRequestExt, WebViewExt};

        let wk = webview.inner();
        wk.connect_permission_request(|_webview, request| {
            log::info!("Granting WebKit permission request");
            request.allow();
            true
        });
    });

    if let Err(e) = result {
        log::warn!("grant_webview_permissions: with_webview failed: {}", e);
    }
}

fn main() {
    run();
}
