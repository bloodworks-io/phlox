use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;

use serde_json::Value;

use super::backend::PhloxBackend;
use super::mdns;
use super::protocol::{
    self, document_to_rest, frame, hello_reply, session_imported, sync_request, FrameDecoder,
    Incoming, PairConfirm, PatientsPushResult, PatientsSnapshot, SessionUploadResult,
};

pub struct CompanionService {
    pub shutdown: Arc<AtomicBool>,
    handles: Vec<JoinHandle<()>>,
    pub port: u16,
    connections: Arc<ConnectionRegistry>,
}

struct ConnectionRegistry {
    inner: Mutex<HashMap<u64, TcpStream>>,
    next_id: AtomicU64,
}

impl ConnectionRegistry {
    fn new() -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
            next_id: AtomicU64::new(1),
        }
    }

    fn add(&self, stream: TcpStream) -> u64 {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        self.inner.lock().unwrap().insert(id, stream);
        id
    }

    fn remove(&self, id: u64) {
        self.inner.lock().unwrap().remove(&id);
    }

    fn count(&self) -> usize {
        self.inner.lock().unwrap().len()
    }

    fn broadcast(&self, payload: &[u8]) {
        let mut senders: Vec<TcpStream> = {
            let mut guard = self.inner.lock().unwrap();
            guard
                .values_mut()
                .map(|s| s.try_clone())
                .flatten()
                .collect()
        };
        for mut stream in senders.drain(..) {
            let _ = stream.write_all(payload);
        }
    }
}

pub struct HostConfig {
    pub server_port: u16,
    pub request_token: String,
    pub host_name: String,
    pub pair_code: String,
    pub credential_path: std::path::PathBuf,
}

pub fn start(config: HostConfig) -> Result<CompanionService, String> {
    let listener = TcpListener::bind("0.0.0.0:0").map_err(|e| format!("bind: {e}"))?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();

    let shutdown = Arc::new(AtomicBool::new(false));
    let connections = Arc::new(ConnectionRegistry::new());
    let backend = Arc::new(PhloxBackend::new(config.server_port, &config.request_token));
    let credential_store = Arc::new(CredentialStore::new(config.credential_path.clone()));

    // mDNS advertisement under the machine's name.
    let service_name = mdns::advertise(&config.host_name, port)?;

    // Listener: one thread per phone connection.
    let mut handles = Vec::new();
    {
        let shutdown = shutdown.clone();
        let connections = connections.clone();
        let backend = backend.clone();
        let credential_store = credential_store.clone();
        let host_name = config.host_name.clone();
        let pair_code = config.pair_code.clone();
        let listener = listener;
        handles.push(std::thread::spawn(move || {
            for stream in listener.incoming() {
                if shutdown.load(Ordering::SeqCst) {
                    break;
                }
                let Ok(stream) = stream else { continue };
                let shutdown = shutdown.clone();
                let connections = connections.clone();
                let backend = backend.clone();
                let credential_store = credential_store.clone();
                let host_name = host_name.clone();
                let pair_code = pair_code.clone();
                std::thread::spawn(move || {
                    handle_connection(
                        stream,
                        shutdown,
                        connections,
                        backend,
                        credential_store,
                        host_name,
                        pair_code,
                    );
                });
            }
        }));
    }

    // Command poller + presence heartbeat.
    {
        let shutdown = shutdown.clone();
        let connections = connections.clone();
        let backend = backend.clone();
        let host_name = config.host_name.clone();
        handles.push(std::thread::spawn(move || loop {
            if shutdown.load(Ordering::SeqCst) {
                break;
            }
            match backend.poll_command(connections.count(), &host_name) {
                Ok(Some(command)) if command == "sync" => {
                    log::info!("[companion] sync requested by the Mac — asking the phone");
                    let payload = serde_json::to_vec(&sync_request()).unwrap();
                    connections.broadcast(&frame(&payload));
                }
                Ok(_) => {}
                Err(e) => {
                    log::warn!("[companion] command poll failed: {e}");
                    std::thread::sleep(std::time::Duration::from_secs(5));
                }
            }
        }));
    }

    let _ = service_name; // kept alive by the mdns daemon thread
    log::info!(
        "[companion] host listening on {port}, advertising _phlox._tcp as {}",
        config.host_name
    );
    Ok(CompanionService {
        shutdown,
        handles,
        port,
        connections,
    })
}

impl CompanionService {
    pub fn stop(mut self) {
        self.shutdown.store(true, Ordering::SeqCst);
        // Unblocks the accept loop with a throwaway connection.
        if let Ok(addr) = format!("127.0.0.1:{}", self.port).parse::<std::net::SocketAddr>() {
            drop(TcpStream::connect(addr));
        }
        for handle in self.handles.drain(..) {
            let _ = handle.join();
        }
        // Close every phone connection so their threads exit too.
        self.connections.broadcast(b"");
        mdns::shutdown();
    }
}

fn handle_connection(
    stream: TcpStream,
    shutdown: Arc<AtomicBool>,
    connections: Arc<ConnectionRegistry>,
    backend: Arc<PhloxBackend>,
    credential_store: Arc<CredentialStore>,
    host_name: String,
    pair_code: String,
) {
    let Ok(registry_stream) = stream.try_clone() else {
        return;
    };
    let id = connections.add(registry_stream);
    log::info!("[companion] phone connected ({id})");
    backend.report_presence(connections.count(), &host_name);

    let result = serve(
        stream,
        &shutdown,
        &connections,
        &backend,
        &credential_store,
        &host_name,
        &pair_code,
    );

    connections.remove(id);
    backend.report_presence(connections.count(), &host_name);
    log::info!(
        "[companion] phone disconnected ({id}): {}",
        result.err().unwrap_or_default()
    );
}

fn serve(
    mut stream: TcpStream,
    shutdown: &AtomicBool,
    connections: &ConnectionRegistry,
    backend: &Arc<PhloxBackend>,
    credential_store: &CredentialStore,
    host_name: &str,
    pair_code: &str,
) -> Result<(), String> {
    let _ = stream.set_read_timeout(Some(std::time::Duration::from_millis(500)));
    let mut decoder = FrameDecoder::default();
    let mut chunk = [0u8; 64 * 1024];
    // Sessions already confirmed imported on this connection (a retried
    // upload while an import is in flight must not push twice).
    let mut confirmed_imports: std::collections::HashSet<String> = Default::default();

    loop {
        if shutdown.load(Ordering::SeqCst) {
            return Ok(());
        }
        // The read timeout exists so the shutdown flag is checked while
        // idle — a lapsed poll is silence, not a dead connection.
        let read = match stream.read(&mut chunk) {
            Ok(0) => return Ok(()),
            Ok(n) => n,
            Err(e)
                if e.kind() == std::io::ErrorKind::WouldBlock
                    || e.kind() == std::io::ErrorKind::TimedOut =>
            {
                continue;
            }
            Err(e) => return Err(e.to_string()),
        };
        let frames = decoder.feed(&chunk[..read]).map_err(|e| e.to_string())?;
        for payload in frames {
            let Ok(message) = serde_json::from_slice::<Incoming>(&payload) else {
                log::warn!("[companion] undecodable frame ({}B)", payload.len());
                continue;
            };
            handle_message(
                &mut stream,
                message,
                connections,
                backend,
                credential_store,
                host_name,
                pair_code,
                &mut confirmed_imports,
            );
        }
    }
}

#[allow(clippy::too_many_arguments)]
fn handle_message(
    stream: &mut TcpStream,
    message: Incoming,
    _connections: &ConnectionRegistry,
    backend: &Arc<PhloxBackend>,
    credential_store: &CredentialStore,
    host_name: &str,
    pair_code: &str,
    confirmed_imports: &mut std::collections::HashSet<String>,
) {
    match message {
        Incoming::Hello { credential, .. } => {
            if let Some(presented) = credential {
                let recognised = credential_store.matches(&presented);
                log::info!(
                    "[companion] returning phone {}",
                    match recognised {
                        Some(true) => "recognised",
                        Some(false) => "NOT recognised (stale pairing)",
                        None => "presented a credential but none is stored",
                    }
                );
            }
            send(stream, &hello_reply(host_name));
        }
        Incoming::PairRequest {
            correlation_id,
            code,
            ..
        } => {
            let accepted = code.trim() == pair_code;
            let credential = if accepted {
                let credential = new_credential();
                credential_store.save(&credential);
                log::info!("[companion] pairing stored; this Mac now answers to one phone");
                Some(credential)
            } else {
                None
            };
            send(
                stream,
                &PairConfirm {
                    version: protocol::PROTOCOL_VERSION,
                    kind: "pair.confirm",
                    correlation_id,
                    accepted,
                    host_name: host_name.to_string(),
                    credential,
                },
            );
        }
        Incoming::PatientsPull { correlation_id } => {
            let reply = match backend.patients() {
                Ok(patients) => PatientsSnapshot {
                    version: protocol::PROTOCOL_VERSION,
                    kind: "patients.snapshot",
                    correlation_id,
                    patients: patients
                        .into_iter()
                        .filter_map(|p| serde_json::from_value(p).ok())
                        .collect(),
                },
                Err(e) => {
                    log::error!("[companion] patients pull failed: {e}");
                    PatientsSnapshot {
                        version: protocol::PROTOCOL_VERSION,
                        kind: "patients.snapshot",
                        correlation_id,
                        patients: Vec::new(),
                    }
                }
            };
            send(stream, &reply);
        }
        Incoming::PatientsPush {
            correlation_id,
            patients,
        } => {
            let wire: Vec<Value> = patients
                .iter()
                .filter_map(|p| serde_json::to_value(p).ok())
                .collect();
            let reply = match backend.push_patients(&wire) {
                Ok(outcome) => PatientsPushResult {
                    version: protocol::PROTOCOL_VERSION,
                    kind: "patients.push.result",
                    correlation_id,
                    accepted: outcome.accepted,
                    duplicates: outcome.duplicates,
                },
                Err(e) => {
                    log::error!("[companion] patients push failed: {e}");
                    PatientsPushResult {
                        version: protocol::PROTOCOL_VERSION,
                        kind: "patients.push.result",
                        correlation_id,
                        accepted: Vec::new(),
                        duplicates: Vec::new(),
                    }
                }
            };
            send(stream, &reply);
        }
        Incoming::SessionUpload {
            correlation_id,
            document,
        } => {
            let session_id = document.manifest["sessionId"]
                .as_str()
                .unwrap_or_default()
                .to_string();
            let rest_document = document_to_rest(&document);
            let outcome = match backend.import_session(&session_id, &rest_document) {
                Ok(outcome) => outcome,
                Err(e) => {
                    log::error!("[companion] import failed for {session_id}: {e}");
                    send(
                        stream,
                        &SessionUploadResult {
                            version: protocol::PROTOCOL_VERSION,
                            kind: "session.upload.result",
                            correlation_id,
                            session_id: session_id.clone(),
                            accepted: false,
                            already_imported: false,
                            status: Some("failed".into()),
                        },
                    );
                    return;
                }
            };
            let result = SessionUploadResult {
                version: protocol::PROTOCOL_VERSION,
                kind: "session.upload.result",
                correlation_id,
                session_id: session_id.clone(),
                accepted: outcome.accepted,
                already_imported: outcome.already_imported,
                status: outcome.status.clone(),
            };
            send(stream, &result);
            // A first-time import is complete the moment the result is
            // sent; backends with asynchronous filing decide when the
            // session has truly landed and the push follows.
            if outcome.accepted
                && !outcome.already_imported
                && outcome.status.as_deref() != Some("imported")
                && !confirmed_imports.contains(&session_id)
            {
                confirmed_imports.insert(session_id.clone());
                let backend = backend.clone();
                let mut push_stream = stream.try_clone().unwrap();
                std::thread::spawn(move || {
                    if backend.await_import(&session_id, 300) {
                        log::info!("[companion] import confirmed for {session_id}");
                        send(&mut push_stream, &session_imported(&session_id));
                    } else {
                        log::warn!("[companion] import wait lapsed for {session_id}");
                    }
                });
            }
        }
        Incoming::Unknown => {
            log::debug!("[companion] ignored one-way/unknown message");
        }
    }
}

fn send<T: serde::Serialize>(stream: &mut TcpStream, message: &T) {
    if let Ok(payload) = serde_json::to_vec(message) {
        let _ = stream.write_all(&frame(&payload));
    }
}

fn new_credential() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("{nanos:x}-{}-{}", std::process::id(), rand_suffix())
}

fn rand_suffix() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.subsec_nanos() as u64 ^ d.as_secs())
        .unwrap_or(0)
}

/// The remembered pairing: the latest issued credential wins, so exactly
/// one phone is paired at a time and the pairing survives restarts.
struct CredentialStore {
    path: std::path::PathBuf,
}

impl CredentialStore {
    fn new(path: std::path::PathBuf) -> Self {
        Self { path }
    }

    fn save(&self, credential: &str) {
        let _ = std::fs::create_dir_all(self.path.parent().unwrap_or(std::path::Path::new(".")));
        let body = serde_json::json!({ "credential": credential });
        let _ = std::fs::write(&self.path, body.to_string());
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&self.path, std::fs::Permissions::from_mode(0o600));
        }
    }

    fn matches(&self, presented: &str) -> Option<bool> {
        let raw = std::fs::read_to_string(&self.path).ok()?;
        let value: Value = serde_json::from_str(&raw).ok()?;
        Some(value["credential"].as_str()? == presented)
    }
}
