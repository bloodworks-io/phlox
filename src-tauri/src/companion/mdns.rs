use mdns_sd::{ServiceDaemon, ServiceInfo};

static ADVERTISED: std::sync::Mutex<Option<ServiceDaemon>> = std::sync::Mutex::new(None);

pub fn advertise(host_name: &str, port: u16) -> Result<(), String> {
    let daemon = ServiceDaemon::new().map_err(|e| format!("mDNS daemon: {e}"))?;
    // The instance name is the human-readable one phones see and remember;
    // the hostname must be DNS-safe and end in .local..
    let hostname = format!(
        "{}.local.",
        host_name
            .chars()
            .map(|c| if c.is_ascii_alphanumeric() {
                c.to_ascii_lowercase()
            } else {
                '-'
            })
            .collect::<String>()
            .trim_matches('-')
    );
    let info = ServiceInfo::new(
        "_phlox._tcp.local.",
        host_name,
        &hostname,
        std::net::IpAddr::from([0, 0, 0, 0]),
        port,
        None,
    )
    .map_err(|e| format!("mDNS service: {e}"))?
    .enable_addr_auto();
    daemon
        .register(info)
        .map_err(|e| format!("mDNS register: {e}"))?;
    *ADVERTISED.lock().unwrap() = Some(daemon);
    Ok(())
}

pub fn shutdown() {
    if let Some(daemon) = ADVERTISED.lock().unwrap().take() {
        let _ = daemon.shutdown();
    }
}

#[cfg(test)]
mod live_tests {
    use super::*;

    #[test]
    fn advertise_and_bind_work() {
        let listener = std::net::TcpListener::bind("0.0.0.0:0").expect("bind");
        let port = listener.local_addr().unwrap().port();
        println!("bound 0.0.0.0:{port}");
        match advertise("Phlox Diagnostics", port) {
            Ok(()) => println!("advertise ok"),
            Err(e) => println!("ADVERTISE FAILED: {e}"),
        }
        std::thread::sleep(std::time::Duration::from_secs(4));
        shutdown();
    }
}
