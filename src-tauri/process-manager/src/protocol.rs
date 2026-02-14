use serde::{Deserialize, Serialize};

/// Request types from Tauri app to Process Manager
#[derive(Debug, Deserialize)]
pub struct Request {
    #[serde(rename = "type")]
    pub request_type: String,
    #[serde(rename = "payload", default)]
    pub payload: Option<serde_json::Value>,
}

impl Request {
    pub fn from_json(json: &str) -> Result<Self, String> {
        serde_json::from_str(json).map_err(|e| format!("Invalid request: {}", e))
    }

    pub fn request_type(&self) -> &str {
        &self.request_type
    }

    pub fn get_payload<T: for<'de> Deserialize<'de>>(&self) -> Result<T, String> {
        match &self.payload {
            Some(value) => {
                serde_json::from_value(value.clone()).map_err(|e| format!("Invalid payload: {}", e))
            }
            None => Err("No payload".to_string()),
        }
    }
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
    WaitingForPassphrase,
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

    pub fn ok_waiting_for_passphrase() -> Self {
        Response::Ok(OkData::WaitingForPassphrase)
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
