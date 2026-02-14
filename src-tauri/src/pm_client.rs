use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::os::unix::net::UnixStream;
use std::path::PathBuf;
use std::time::Duration;

/// Get the socket path
pub fn socket_path() -> PathBuf {
    dirs::data_dir()
        .expect("Failed to get data directory")
        .join("phlox")
        .join("phlox_pm.sock")
}

/// Request types sent to process manager
#[derive(Debug)]
pub enum ClientRequest {
    StartLlama { model_path: Option<String> },
    StartWhisper { model_path: Option<String> },
    StartServer,
    SendPassphrase { passphrase: String },
    Stop { service: String },
    Status,
    Shutdown,
    Ping,
}

/// Wrapper for serializing requests with explicit payload field
#[derive(Debug, Serialize)]
struct RequestWrapper {
    #[serde(rename = "type")]
    request_type: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    payload: Option<serde_json::Value>,
}

impl ClientRequest {
    /// Serialize the request to JSON with explicit payload field
    fn to_json(&self) -> Result<String, serde_json::Error> {
        let wrapper = match self {
            ClientRequest::StartLlama { model_path } => RequestWrapper {
                request_type: "start_llama",
                payload: Some(serde_json::json!({ "model_path": model_path })),
            },
            ClientRequest::StartWhisper { model_path } => RequestWrapper {
                request_type: "start_whisper",
                payload: Some(serde_json::json!({ "model_path": model_path })),
            },
            ClientRequest::StartServer => RequestWrapper {
                request_type: "start_server",
                payload: None,
            },
            ClientRequest::SendPassphrase { passphrase } => RequestWrapper {
                request_type: "send_passphrase",
                payload: Some(serde_json::json!(passphrase)),
            },
            ClientRequest::Stop { service } => RequestWrapper {
                request_type: "stop",
                payload: Some(serde_json::json!({ "service": service })),
            },
            ClientRequest::Status => RequestWrapper {
                request_type: "status",
                payload: None,
            },
            ClientRequest::Shutdown => RequestWrapper {
                request_type: "shutdown",
                payload: None,
            },
            ClientRequest::Ping => RequestWrapper {
                request_type: "ping",
                payload: None,
            },
        };
        serde_json::to_string(&wrapper)
    }
}

/// Response types from process manager
#[derive(Debug, Deserialize)]
#[serde(tag = "status", content = "data")]
pub enum ClientResponse {
    #[serde(rename = "ok")]
    Ok(OkData),
    #[serde(rename = "error")]
    Error { message: String },
}

/// Success response data
#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum OkData {
    Started {
        pid: u32,
        port: u16,
        #[serde(default)]
        llama_port: u16,
        #[serde(default)]
        whisper_port: u16,
    },
    WaitingForPassphrase,
    Stopped,
    Status(ServiceStatusData),
    Pong,
    Shutdown,
}

/// Status of all services
#[derive(Debug, Deserialize, Clone, Default)]
pub struct ServiceStatusData {
    pub llama: Option<ServiceInfo>,
    pub whisper: Option<ServiceInfo>,
    pub server: Option<ServiceInfo>,
}

/// Info about a single service
#[derive(Debug, Deserialize, Clone)]
pub struct ServiceInfo {
    pub running: bool,
    pub pid: u32,
    pub port: u16,
}

/// Error type for PM client operations
#[derive(Debug)]
pub enum ClientError {
    NotConnected,
    ConnectionFailed(String),
    RequestFailed(String),
    InvalidResponse(String),
    ProcessManagerDead,
}

impl std::fmt::Display for ClientError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ClientError::NotConnected => write!(f, "Not connected to process manager"),
            ClientError::ConnectionFailed(e) => write!(f, "Failed to connect: {}", e),
            ClientError::RequestFailed(e) => write!(f, "Request failed: {}", e),
            ClientError::InvalidResponse(e) => write!(f, "Invalid response: {}", e),
            ClientError::ProcessManagerDead => write!(f, "Process manager is not responding"),
        }
    }
}

impl std::error::Error for ClientError {}

/// Process manager client
pub struct ProcessManagerClient;

impl ProcessManagerClient {
    /// Create a new client and connect to the process manager
    pub fn new() -> Result<Self, ClientError> {
        Self::connect_with_timeout(Duration::from_secs(5))
    }

    /// Connect with a timeout
    pub fn connect_with_timeout(timeout: Duration) -> Result<Self, ClientError> {
        let socket_path = socket_path();
        let start = std::time::Instant::now();

        loop {
            match UnixStream::connect(&socket_path) {
                Ok(_stream) => {
                    // Connection successful, stream will be created per-request
                    return Ok(Self);
                }
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                    // Socket doesn't exist yet
                    if start.elapsed() >= timeout {
                        return Err(ClientError::ConnectionFailed(
                            "Process manager socket not found".to_string(),
                        ));
                    }
                    std::thread::sleep(Duration::from_millis(100));
                }
                Err(e) => {
                    return Err(ClientError::ConnectionFailed(e.to_string()));
                }
            }
        }
    }

    /// Send a request and get a response
    fn send_request(&self, request: &ClientRequest) -> Result<ClientResponse, ClientError> {
        let json = request
            .to_json()
            .map_err(|e| ClientError::RequestFailed(e.to_string()))?;

        // Create a new connection for each request
        let socket_path = socket_path();
        let stream = UnixStream::connect(&socket_path)
            .map_err(|e| ClientError::RequestFailed(e.to_string()))?;

        stream
            .set_write_timeout(Some(Duration::from_secs(5)))
            .map_err(|e| ClientError::RequestFailed(e.to_string()))?;
        stream
            .set_read_timeout(Some(Duration::from_secs(30)))
            .map_err(|e| ClientError::RequestFailed(e.to_string()))?;

        // Send request
        let mut stream = stream;
        stream
            .write_all(json.as_bytes())
            .map_err(|e| ClientError::RequestFailed(e.to_string()))?;
        stream
            .write_all(b"\n")
            .map_err(|e| ClientError::RequestFailed(e.to_string()))?;

        // Read response
        let mut reader = BufReader::new(&stream);
        let mut response = String::new();
        reader
            .read_line(&mut response)
            .map_err(|e| ClientError::RequestFailed(e.to_string()))?;

        serde_json::from_str(&response).map_err(|e| ClientError::InvalidResponse(e.to_string()))
    }

    /// Start the llama server
    pub fn start_llama(&self, model_path: Option<String>) -> Result<(u32, u16), ClientError> {
        match self.send_request(&ClientRequest::StartLlama { model_path })? {
            ClientResponse::Ok(OkData::Started { pid, port, .. }) => Ok((pid, port)),
            ClientResponse::Error { message } => Err(ClientError::RequestFailed(message)),
            _ => Err(ClientError::InvalidResponse(
                "Unexpected response".to_string(),
            )),
        }
    }

    /// Start the whisper server
    pub fn start_whisper(&self, model_path: Option<String>) -> Result<(u32, u16), ClientError> {
        match self.send_request(&ClientRequest::StartWhisper { model_path })? {
            ClientResponse::Ok(OkData::Started { pid, port, .. }) => Ok((pid, port)),
            ClientResponse::Error { message } => Err(ClientError::RequestFailed(message)),
            _ => Err(ClientError::InvalidResponse(
                "Unexpected response".to_string(),
            )),
        }
    }

    /// Start the Python server (returns when server is waiting for passphrase)
    pub fn start_server(&self) -> Result<(), ClientError> {
        match self.send_request(&ClientRequest::StartServer)? {
            ClientResponse::Ok(OkData::WaitingForPassphrase) => Ok(()),
            ClientResponse::Error { message } => Err(ClientError::RequestFailed(message)),
            _ => Err(ClientError::InvalidResponse(
                "Unexpected response".to_string(),
            )),
        }
    }

    /// Send passphrase to the waiting server
    pub fn send_passphrase(&self, passphrase: String) -> Result<(u32, u16, u16, u16), ClientError> {
        match self.send_request(&ClientRequest::SendPassphrase { passphrase })? {
            ClientResponse::Ok(OkData::Started {
                pid,
                port,
                llama_port,
                whisper_port,
            }) => Ok((pid, port, llama_port, whisper_port)),
            ClientResponse::Error { message } => Err(ClientError::RequestFailed(message)),
            _ => Err(ClientError::InvalidResponse(
                "Unexpected response".to_string(),
            )),
        }
    }

    /// Stop a service
    pub fn stop(&self, service: &str) -> Result<(), ClientError> {
        match self.send_request(&ClientRequest::Stop {
            service: service.to_string(),
        })? {
            ClientResponse::Ok(OkData::Stopped) => Ok(()),
            ClientResponse::Error { message } => Err(ClientError::RequestFailed(message)),
            _ => Err(ClientError::InvalidResponse(
                "Unexpected response".to_string(),
            )),
        }
    }

    /// Get status of all services
    pub fn status(&self) -> Result<ServiceStatusData, ClientError> {
        match self.send_request(&ClientRequest::Status)? {
            ClientResponse::Ok(OkData::Status(data)) => Ok(data),
            ClientResponse::Error { message } => Err(ClientError::RequestFailed(message)),
            _ => Err(ClientError::InvalidResponse(
                "Unexpected response".to_string(),
            )),
        }
    }

    /// Shutdown the process manager
    pub fn shutdown(&self) -> Result<(), ClientError> {
        match self.send_request(&ClientRequest::Shutdown)? {
            ClientResponse::Ok(OkData::Shutdown) => Ok(()),
            ClientResponse::Error { message } => Err(ClientError::RequestFailed(message)),
            _ => Err(ClientError::InvalidResponse(
                "Unexpected response".to_string(),
            )),
        }
    }

    /// Ping the process manager
    pub fn ping(&self) -> Result<(), ClientError> {
        match self.send_request(&ClientRequest::Ping)? {
            ClientResponse::Ok(OkData::Pong) => Ok(()),
            ClientResponse::Error { message } => Err(ClientError::RequestFailed(message)),
            _ => Err(ClientError::InvalidResponse(
                "Unexpected response".to_string(),
            )),
        }
    }

    /// Check if the process manager is alive by sending a ping
    pub fn is_alive() -> bool {
        let socket_path = socket_path();

        if !socket_path.exists() {
            return false;
        }

        // Try to connect and send a ping - this is the proper way to check if PM is alive
        match UnixStream::connect(&socket_path) {
            Ok(mut stream) => {
                // Set a short timeout for the ping
                let _ = stream.set_read_timeout(Some(Duration::from_millis(500)));
                let _ = stream.set_write_timeout(Some(Duration::from_millis(500)));

                // Send ping request
                let request = ClientRequest::Ping;
                let json = match request.to_json() {
                    Ok(j) => j,
                    Err(_) => return false,
                };

                if stream.write_all(json.as_bytes()).is_err() || stream.write_all(b"\n").is_err() {
                    return false;
                }

                // Read response
                let mut reader = BufReader::new(&stream);
                let mut response = String::new();
                reader.read_line(&mut response).is_ok()
            }
            Err(_) => false,
        }
    }
}
