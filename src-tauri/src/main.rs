use log::LevelFilter;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::Manager;
use tauri_plugin_log::{Target, TargetKind};

struct ServerProcess(Mutex<Option<Child>>);

fn cleanup_stale_port_file() {
    if let Some(data_dir) = dirs::data_dir() {
        let port_file = data_dir.join("phlox").join("server_port.txt");
        if port_file.exists() {
            if let Err(e) = std::fs::remove_file(&port_file) {
                log::warn!("Failed to remove stale port file: {}", e);
            } else {
                log::info!("Removed stale port file: {:?}", port_file);
            }
        }
    }
}

fn start_server(app_handle: tauri::AppHandle) -> Result<Child, Box<dyn std::error::Error>> {
    // Clean up any existing port file before starting the server
    cleanup_stale_port_file();

    // Get the directory where the current executable is located
    let current_exe = std::env::current_exe().expect("failed to get current executable path");
    let exe_dir = current_exe
        .parent()
        .expect("failed to get executable directory");
    let server_path = exe_dir.join("server");

    log::info!("Attempting to start server from: {:?}", server_path);

    let mut cmd = Command::new(&server_path);

    cmd.stdout(std::process::Stdio::inherit())
        .stderr(std::process::Stdio::inherit());

    let child = cmd.spawn()?;
    log::info!("Server started with PID: {}", child.id());

    Ok(child)
}

fn wait_for_server() {
    // Wait for server to start
    thread::sleep(Duration::from_secs(2));

    // Try to read the port file
    for _ in 0..60 {
        // Try for 60 seconds
        if let Some(data_dir) = dirs::data_dir() {
            let port_file = data_dir.join("phlox").join("server_port.txt");
            if port_file.exists() {
                if let Ok(port) = std::fs::read_to_string(&port_file) {
                    println!("Server running on port: {}", port.trim());
                    return;
                }
            }
        }
        thread::sleep(Duration::from_secs(1));
    }
    println!("Warning: Could not detect server port");
}

#[tauri::command]
fn get_server_port() -> String {
    if let Some(data_dir) = dirs::data_dir() {
        let port_file = data_dir.join("phlox").join("server_port.txt");
        if let Ok(port) = std::fs::read_to_string(&port_file) {
            return port.trim().to_string();
        }
    }
    "5000".to_string() // fallback
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let log_plugin = tauri_plugin_log::Builder::default()
        .targets([
            Target::new(TargetKind::Stdout), // Log to console
            Target::new(TargetKind::LogDir {
                file_name: Some("phlox-app.log".into()),
            }), // Log to a file in the app's log directory
                                             // Target::new(TargetKind::Webview), // Optional: Send logs to the webview console (can be noisy)
        ])
        .level(LevelFilter::Info) // Start with Info, can change to Debug for more detail
        .build();

    tauri::Builder::default()
        .plugin(log_plugin) // ADDED THE PLUGIN HERE
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .manage(ServerProcess(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![get_server_port])
        .setup(|app| {
            let app_handle = app.handle().clone();
            log::info!("App setup started"); // Example log message

            // Start the server
            match start_server(app_handle.clone()) {
                // Pass cloned app_handle
                Ok(child) => {
                    *app.state::<ServerProcess>().0.lock().unwrap() = Some(child);
                    log::info!("Server process started successfully.");

                    // Wait for server to be ready in a separate thread
                    thread::spawn(|| {
                        wait_for_server();
                    });
                }
                Err(e) => {
                    // Use the log crate for errors too
                    log::error!("Failed to start server: {}", e);
                    // Optionally, you might want to display this error to the user
                    // or prevent the app from fully starting if the server is critical.
                }
            }
            log::info!("App setup finished.");
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                log::info!("Window close requested. Cleaning up server process.");
                // Clean up server process when window closes
                let app_handle = window.app_handle();
                if let Some(server_state) = app_handle.try_state::<ServerProcess>() {
                    if let Ok(mut process) = server_state.0.lock() {
                        if let Some(mut child) = process.take() {
                            if let Err(e) = child.kill() {
                                log::error!("Failed to kill server process: {}", e);
                            } else {
                                log::info!("Server process killed successfully.");
                            }
                        }
                    }
                }

                // Also clean up the port file when the app closes
                cleanup_stale_port_file();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application"); // This expect might be too late if the panic is early
}

fn main() {
    run();
}
