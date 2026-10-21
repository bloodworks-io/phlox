use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const PROTOCOL_VERSION: i64 = 1;
pub const FRAME_SIZE_LIMIT: usize = 10 * 1024 * 1024;

pub fn frame(payload: &[u8]) -> Vec<u8> {
    let mut framed = Vec::with_capacity(4 + payload.len());
    framed.extend_from_slice(&(payload.len() as u32).to_be_bytes());
    framed.extend_from_slice(payload);
    framed
}

/// Incremental decoder: feed TCP bytes, receive complete payloads.
#[derive(Default)]
pub struct FrameDecoder {
    buffer: Vec<u8>,
}

#[derive(Debug, thiserror::Error)]
#[error("frame of {0} bytes exceeds the 10 MiB limit")]
pub struct FrameTooLarge(pub usize);

impl FrameDecoder {
    pub fn feed(&mut self, data: &[u8]) -> Result<Vec<Vec<u8>>, FrameTooLarge> {
        self.buffer.extend_from_slice(data);
        let mut frames = Vec::new();
        loop {
            if self.buffer.len() < 4 {
                break;
            }
            let length = u32::from_be_bytes(self.buffer[0..4].try_into().unwrap()) as usize;
            if length > FRAME_SIZE_LIMIT {
                return Err(FrameTooLarge(length));
            }
            if self.buffer.len() < 4 + length {
                break;
            }
            frames.push(self.buffer[4..4 + length].to_vec());
            self.buffer.drain(..4 + length);
        }
        Ok(frames)
    }
}

fn skip_none<T>(v: &Option<T>) -> bool {
    v.is_none()
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum Incoming {
    #[serde(rename = "hello", rename_all = "camelCase")]
    Hello {
        device_name: String,
        #[serde(default)]
        device_id: Option<String>,
        #[serde(default)]
        credential: Option<String>,
    },
    #[serde(rename = "pair.request", rename_all = "camelCase")]
    PairRequest {
        #[serde(default)]
        correlation_id: Option<String>,
        device_id: String,
        device_name: String,
        code: String,
    },
    #[serde(rename = "patients.pull", rename_all = "camelCase")]
    PatientsPull {
        #[serde(default)]
        correlation_id: Option<String>,
    },
    #[serde(rename = "patients.push", rename_all = "camelCase")]
    PatientsPush {
        #[serde(default)]
        correlation_id: Option<String>,
        patients: Vec<PatientRecord>,
    },
    #[serde(rename = "session.upload", rename_all = "camelCase")]
    SessionUpload {
        #[serde(default)]
        correlation_id: Option<String>,
        document: SessionDocument,
    },
    // One-way pushes from newer phones and unknown future types decode to
    // Unknown; the connection stays up either way.
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatientRecord {
    #[serde(rename = "guid")]
    pub guid: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "yearOfBirth", skip_serializing_if = "skip_none", default)]
    pub year_of_birth: Option<i64>,
    #[serde(rename = "internalId", skip_serializing_if = "skip_none", default)]
    pub internal_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SessionDocument {
    #[serde(rename = "manifest")]
    pub manifest: Value,
    #[serde(rename = "utterances")]
    pub utterances: Vec<Value>,
}

pub const APPLE_REFERENCE_DATE: f64 = 978_307_200.0; // 2001-01-01T00:00:00Z

pub fn document_to_rest(document: &SessionDocument) -> Value {
    let manifest = camel_manifest_to_rest(&document.manifest);
    let utterances: Vec<Value> = document
        .utterances
        .iter()
        .map(|u| {
            let mut out = serde_json::Map::new();
            for (key, value) in u.as_object().into_iter().flatten() {
                let mapped = match key.as_str() {
                    "startMs" => "start_ms",
                    "endMs" => "end_ms",
                    other => other,
                };
                out.insert(mapped.to_string(), value.clone());
            }
            Value::Object(out)
        })
        .collect();
    let mut map = serde_json::Map::new();
    map.insert("manifest".into(), manifest);
    map.insert("utterances".into(), Value::Array(utterances));
    Value::Object(map)
}

fn camel_manifest_to_rest(manifest: &Value) -> Value {
    let mut out = serde_json::Map::new();
    for (key, value) in manifest.as_object().into_iter().flatten() {
        match key.as_str() {
            "sessionId" => {
                out.insert("session_id".into(), value.clone());
            }
            "deviceId" => {
                out.insert("device_id".into(), value.clone());
            }
            "patientGuid" => {
                out.insert("patient_guid".into(), value.clone());
            }
            "patientDisplayName" => {
                out.insert("patient_display_name".into(), value.clone());
            }
            "startedAt" | "endedAt" => {
                let rest_key = if key == "startedAt" {
                    "started_at"
                } else {
                    "ended_at"
                };
                out.insert(rest_key.into(), Value::String(apple_date_to_iso(value)));
            }
            "modelIdentity" => {
                out.insert("model_identity".into(), value.clone());
            }
            "utteranceCount" => {
                out.insert("utterance_count".into(), value.clone());
            }
            other => {
                out.insert(other.to_string(), value.clone());
            }
        }
    }
    Value::Object(out)
}

fn apple_date_to_iso(value: &Value) -> String {
    if let Some(seconds) = value.as_f64() {
        let unix = seconds + APPLE_REFERENCE_DATE;
        let whole = unix.trunc() as i64;
        let days = whole.div_euclid(86_400);
        let secs_of_day = whole.rem_euclid(86_400);
        let (year, month, day) = civil_from_days(days);
        format!(
            "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
            year,
            month,
            day,
            secs_of_day / 3600,
            (secs_of_day % 3600) / 60,
            secs_of_day % 60
        )
    } else if let Some(text) = value.as_str() {
        text.to_string()
    } else {
        String::new()
    }
}

fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 - doe / 36_524 + doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

#[derive(Debug, Serialize)]
pub struct HelloReply {
    pub version: i64,
    #[serde(rename = "type")]
    pub kind: &'static str,
    #[serde(rename = "hostName")]
    pub host_name: String,
    #[serde(rename = "protocolVersion")]
    pub protocol_version: i64,
}

#[derive(Debug, Serialize)]
pub struct PairConfirm {
    pub version: i64,
    #[serde(rename = "type")]
    pub kind: &'static str,
    #[serde(rename = "correlationId", skip_serializing_if = "skip_none")]
    pub correlation_id: Option<String>,
    pub accepted: bool,
    #[serde(rename = "hostName")]
    pub host_name: String,
    #[serde(rename = "credential", skip_serializing_if = "skip_none")]
    pub credential: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PatientsSnapshot {
    pub version: i64,
    #[serde(rename = "type")]
    pub kind: &'static str,
    #[serde(rename = "correlationId", skip_serializing_if = "skip_none")]
    pub correlation_id: Option<String>,
    pub patients: Vec<PatientRecord>,
}

#[derive(Debug, Serialize)]
pub struct PatientsPushResult {
    pub version: i64,
    #[serde(rename = "type")]
    pub kind: &'static str,
    #[serde(rename = "correlationId", skip_serializing_if = "skip_none")]
    pub correlation_id: Option<String>,
    pub accepted: Vec<String>,
    pub duplicates: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct SessionUploadResult {
    pub version: i64,
    #[serde(rename = "type")]
    pub kind: &'static str,
    #[serde(rename = "correlationId", skip_serializing_if = "skip_none")]
    pub correlation_id: Option<String>,
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub accepted: bool,
    #[serde(rename = "alreadyImported")]
    pub already_imported: bool,
    #[serde(rename = "status", skip_serializing_if = "skip_none")]
    pub status: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SessionImported {
    pub version: i64,
    #[serde(rename = "type")]
    pub kind: &'static str,
    #[serde(rename = "sessionId")]
    pub session_id: String,
}

#[derive(Debug, Serialize)]
pub struct SyncRequest {
    pub version: i64,
    #[serde(rename = "type")]
    pub kind: &'static str,
}

pub fn hello_reply(host_name: &str) -> HelloReply {
    HelloReply {
        version: PROTOCOL_VERSION,
        kind: "hello.reply",
        host_name: host_name.to_string(),
        protocol_version: PROTOCOL_VERSION,
    }
}

pub fn session_imported(session_id: &str) -> SessionImported {
    SessionImported {
        version: PROTOCOL_VERSION,
        kind: "session.imported",
        session_id: session_id.to_string(),
    }
}

pub fn sync_request() -> SyncRequest {
    SyncRequest {
        version: PROTOCOL_VERSION,
        kind: "sync.request",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frames_round_trip_incrementally() {
        let payload = br#"{"type":"hello","deviceName":"iPhone"}"#;
        let framed = frame(payload);
        let mut decoder = FrameDecoder::default();
        // Feed byte-by-byte to prove buffering: nothing until the last
        // byte of the frame lands, then exactly one payload.
        let mut early = 0;
        for byte in &framed[..framed.len() - 1] {
            early += decoder.feed(std::slice::from_ref(byte)).unwrap().len();
        }
        assert_eq!(early, 0);
        assert_eq!(
            decoder
                .feed(std::slice::from_ref(&framed[framed.len() - 1]))
                .unwrap(),
            vec![payload.to_vec()]
        );
        let second = frame(br#"{"type":"sync.request"}"#);
        let frames = decoder.feed(&second).unwrap();
        assert_eq!(frames, vec![second[4..].to_vec()]);
    }

    #[test]
    fn oversized_frames_are_rejected() {
        let mut decoder = FrameDecoder::default();
        let header = (FRAME_SIZE_LIMIT as u32 + 1).to_be_bytes();
        assert!(decoder.feed(&header).is_err());
    }

    #[test]
    fn document_converts_to_rest_form() {
        let framed = serde_json::json!({
            "manifest": {
                "sessionId": "67284C85-34F2-455E-9B59-FBBA0016A331",
                "deviceId": "test-device",
                "patientGuid": null,
                "patientDisplayName": "Doe, Jane",
                "mode": "ambient",
                "startedAt": 813993898.0,
                "endedAt": 814023898.123,
                "modelIdentity": {"asr": "omi-med"},
                "utteranceCount": 2
            },
            "utterances": [
                {"sequence": 0, "startMs": 0, "endMs": 400, "speaker": "S1", "text": "hi"},
                {"sequence": 1, "startMs": 500, "endMs": 900, "speaker": null, "text": "ho"}
            ]
        });
        let document: SessionDocument =
            serde_json::from_value(framed).expect("framed form decodes");
        let rest = document_to_rest(&document);
        let manifest = &rest["manifest"];
        assert_eq!(
            manifest["session_id"],
            "67284C85-34F2-455E-9B59-FBBA0016A331"
        );
        assert_eq!(manifest["patient_display_name"], "Doe, Jane");
        assert_eq!(manifest["started_at"], "2026-10-18T05:24:58Z");
        assert_eq!(manifest["ended_at"], "2026-10-18T13:44:58Z");
        assert_eq!(manifest["utterance_count"], 2);
        assert_eq!(rest["utterances"][0]["start_ms"], 0);
        assert_eq!(rest["utterances"][1]["speaker"], Value::Null);
    }

    #[test]
    fn unknown_types_decode_to_ignored() {
        let incoming: Incoming =
            serde_json::from_str(r#"{"version":1,"type":"future.thing"}"#).unwrap();
        assert!(matches!(incoming, Incoming::Unknown));
    }
}
