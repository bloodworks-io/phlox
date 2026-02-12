mod ipc;
mod process;
mod protocol;

use ipc::run_ipc_server;
use log::{error, info, warn};
use std::env;
use std::thread;
use std::time::Duration;

/// Get the grace period from environment variable or default to 5 seconds
fn grace_period_seconds() -> u64 {
    env::var("PHLOX_PM_GRACE_SECONDS")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(5)
}

/// Setup parent death signal handling on macOS using kqueue
#[cfg(target_os = "macos")]
fn setup_parent_death_monitor() -> Result<kqueue::Watcher, std::io::Error> {
    use kqueue::{EventFilter, FilterFlag, Watcher};

    let parent_pid = unsafe { libc::getppid() };
    info!("Parent PID: {}", parent_pid);

    if parent_pid == 1 {
        // Already orphaned (parent is init), just exit
        warn!("Process manager is already orphaned, exiting");
        std::process::exit(0);
    }

    let mut watcher = Watcher::new()?;
    watcher
        .add_pid(
            parent_pid,
            EventFilter::EVFILT_PROC,
            FilterFlag::NOTE_EXIT | FilterFlag::NOTE_EXITSTATUS,
        )
        .map_err(|e| {
            std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("Failed to watch parent process: {}", e),
            )
        })?;

    info!("Monitoring parent process {} for exit", parent_pid);
    Ok(watcher)
}

/// Monitor parent death using kqueue watcher
#[cfg(target_os = "macos")]
fn monitor_parent_death(watcher: &mut kqueue::Watcher, grace_secs: u64) {
    loop {
        match watcher.poll(None) {
            Some(event) => {
                // The ident field contains the PID, and we know we're watching EVFILT_PROC
                warn!(
                    "Parent process died (kqueue detected, event for PID: {:?})",
                    event.ident
                );
                thread::sleep(Duration::from_secs(grace_secs));
                info!("Grace period elapsed, killing all processes");
                process::kill_all_processes();
                std::process::exit(0);
            }
            None => continue,
        }
    }
}

/// Setup parent death signal handling on Linux using prctl
#[cfg(target_os = "linux")]
fn setup_parent_death_signal() {
    use libc::{prctl, PR_SET_PDEATHSIG, SIGTERM};

    let parent_pid = unsafe { libc::getppid() };
    info!("Parent PID: {}", parent_pid);

    if parent_pid == 1 {
        warn!("Process manager is already orphaned, exiting");
        std::process::exit(0);
    }

    unsafe {
        // Request SIGTERM when parent dies
        if prctl(PR_SET_PDEATHSIG, SIGTERM) == -1 {
            error!(
                "Failed to set PDEATHSIG: {}",
                std::io::Error::last_os_error()
            );
        }
    }

    info!("Set PDEATHSIG to monitor parent process {}", parent_pid);
}

/// Run the heartbeat monitor as a fallback
fn run_heartbeat_monitor() {
    thread::spawn(|| loop {
        thread::sleep(Duration::from_secs(5));

        let parent_pid = unsafe { libc::getppid() };
        if parent_pid == 1 {
            warn!("Parent process died (heartbeat detected), initiating shutdown");
            process::kill_all_processes();
            std::process::exit(0);
        }
    });
}

fn main() {
    // Initialize logger
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    info!("Phlox Process Manager starting");

    // Get the grace period
    let grace_secs = grace_period_seconds();
    info!("Grace period: {} seconds", grace_secs);

    // Platform-specific parent death detection
    #[cfg(target_os = "macos")]
    {
        match setup_parent_death_monitor() {
            Ok(mut watcher) => {
                // Spawn a thread to monitor parent death
                thread::spawn(move || {
                    monitor_parent_death(&mut watcher, grace_secs);
                });
            }
            Err(e) => {
                warn!(
                    "Failed to setup kqueue monitoring: {}, using heartbeat only",
                    e
                );
                run_heartbeat_monitor();
            }
        }

        // Also run heartbeat as a fallback
        run_heartbeat_monitor();
    }

    #[cfg(target_os = "linux")]
    {
        setup_parent_death_signal();

        // Set up signal handler for SIGTERM (from parent death)
        // Note: The signal from prctl will kill us immediately,
        // so we mainly need heartbeat for reliability
        run_heartbeat_monitor();
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        // Windows: use heartbeat only
        info!("Using heartbeat monitor for parent detection");
        run_heartbeat_monitor();
    }

    // Run the IPC server (blocking)
    if let Err(e) = run_ipc_server() {
        error!("IPC server error: {}", e);
        process::kill_all_processes();
        std::process::exit(1);
    }

    info!("Process manager shutting down");
}
