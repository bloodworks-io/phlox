use serde::{Deserialize, Serialize};

/// Request types from Tauri app to Process Manager
#[derive(Debug, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum Request {
    #[serde(rename = "start_llama")]
    StartLlama { model_path: Option<String> },
    #[serde(rename = "start_whisper")]
    StartWhisper { model_path: Option<String> },
    #[serde(rename = "start_server")]
    StartServer { passphrase: String },
    #[serde(rename = "stop")]
    Stop { service: String },
    #[serde(rename = "status")]
    Status,
    #[serde(rename = "shutdown")]
    Shutdown,
    #[serde(rename = "ping")]
    Ping,
}

/// Response types from Process Manager to Tauri app
#[derive(Debug, Serialize)]
#[serde(tag = "status", content = "data")]
pub enum Response {
    #[serde(rename = "ok")]
    Ok(OkData),
    #[serde(rename = "error")]
    Error { message: String },
}

/// Success response data types
#[derive(Debug, Serialize)]
#[serde(untagged)]
pub enum OkData {
    Started {
        pid: u32,
        port: u16,
        llama_port: u16,
        whisper_port: u16,
    },
    Stopped,
    Status(StatusData),
    Pong,
    Shutdown,
}

/// Status information for all services
#[derive(Debug, Serialize, Clone, Default)]
pub struct StatusData {
    pub llama: Option<ServiceStatus>,
    pub whisper: Option<ServiceStatus>,
    pub server: Option<ServiceStatus>,
}

/// Status of a single service
#[derive(Debug, Serialize, Clone)]
pub struct ServiceStatus {
    pub running: bool,
    pub pid: u32,
    pub port: u16,
}

impl Request {
    pub fn from_json(json: &str) -> Result<Self, String> {
        serde_json::from_str(json).map_err(|e| format!("Invalid request: {}", e))
    }
}

impl Response {
    pub fn to_json(&self) -> String {
        serde_json::to_string(self).unwrap_or_else(|_| {
            serde_json::json!({
                "status": "error",
                "data": { "message": "Failed to serialize response" }
            })
            .to_string()
        })
    }

    pub fn ok_started(pid: u32, port: u16, llama_port: u16, whisper_port: u16) -> Self {
        Response::Ok(OkData::Started {
            pid,
            port,
            llama_port,
            whisper_port,
        })
    }

    pub fn ok_stopped() -> Self {
        Response::Ok(OkData::Stopped)
    }

    pub fn ok_status(data: StatusData) -> Self {
        Response::Ok(OkData::Status(data))
    }

    pub fn ok_pong() -> Self {
        Response::Ok(OkData::Pong)
    }

    pub fn ok_shutdown() -> Self {
        Response::Ok(OkData::Shutdown)
    }

    pub fn error(message: impl Into<String>) -> Self {
        Response::Error {
            message: message.into(),
        }
    }
}
