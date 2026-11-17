use serde_json::{json, Value};

pub struct PhloxBackend {
    agent: ureq::Agent,
    base: String,
    token: String,
}

#[derive(Debug)]
#[allow(dead_code)]
pub struct UploadOutcome {
    pub accepted: bool,
    pub already_imported: bool,
    pub status: Option<String>,
    pub session_id: String,
}

#[derive(Debug, Default)]
pub struct PushOutcome {
    pub accepted: Vec<String>,
    pub duplicates: Vec<String>,
}

impl PhloxBackend {
    pub fn new(server_port: u16, token: &str) -> Self {
        Self {
            agent: ureq::Agent::new_with_config(
                // The long-poll holds ~20s; everything else is short.
                ureq::config::Config::builder()
                    .timeout_global(Some(std::time::Duration::from_secs(25)))
                    .build(),
            ),
            base: format!("http://127.0.0.1:{server_port}"),
            token: token.to_string(),
        }
    }

    fn get(&self, path: &str) -> Result<Value, String> {
        self.agent
            .get(&format!("{}{}", self.base, path))
            .header("Authorization", &format!("Bearer {}", self.token))
            .call()
            .map_err(|e| format!("GET {path}: {e}"))?
            .body_mut()
            .read_json()
            .map_err(|e| format!("GET {path}: {e}"))
    }

    fn post(&self, path: &str, body: &Value) -> Result<Value, String> {
        self.agent
            .post(&format!("{}{}", self.base, path))
            .header("Authorization", &format!("Bearer {}", self.token))
            .send_json(body.clone())
            .map_err(|e| format!("POST {path}: {e}"))?
            .body_mut()
            .read_json()
            .map_err(|e| format!("POST {path}: {e}"))
    }

    /// Snapshot patients as the phone's wire records (camelCase).
    pub fn patients(&self) -> Result<Vec<Value>, String> {
        let reply = self.get("/api/companion/patients")?;
        let mut out = Vec::new();
        for entry in reply["patients"].as_array().cloned().unwrap_or_default() {
            out.push(json!({
                "guid": entry["guid"],
                "displayName": entry["display_name"],
                "yearOfBirth": entry.get("year_of_birth").filter(|v| !v.is_null()),
                "internalId": entry.get("ur_number").filter(|v| !v.is_null()),
            }));
        }
        Ok(out)
    }

    /// Push phone-created patients (snake_case REST body).
    pub fn push_patients(&self, patients: &[Value]) -> Result<PushOutcome, String> {
        let body: Vec<Value> = patients
            .iter()
            .map(|p| {
                json!({
                    "guid": p["guid"],
                    "display_name": p["displayName"],
                    "year_of_birth": p.get("yearOfBirth").filter(|v| !v.is_null()),
                    "ur_number": p.get("internalId").filter(|v| !v.is_null()),
                })
            })
            .collect();
        let reply = self.post("/api/companion/patients", &json!({ "patients": body }))?;
        Ok(PushOutcome {
            accepted: uuid_strings(reply["accepted"].as_array()),
            duplicates: uuid_strings(reply["duplicates"].as_array()),
        })
    }

    /// Import a session; the document is already in its REST (snake_case)
    /// form and is spliced verbatim like the Swift host did.
    pub fn import_session(
        &self,
        session_id: &str,
        document: &Value,
    ) -> Result<UploadOutcome, String> {
        let reply = self.post(
            "/api/companion/sessions/import",
            &json!({ "document": document, "template_key": null }),
        )?;
        Ok(UploadOutcome {
            accepted: reply["accepted"].as_bool().unwrap_or(false),
            already_imported: reply["already_imported"].as_bool().unwrap_or(false),
            status: reply["status"].as_str().map(str::to_string),
            session_id: session_id.to_string(),
        })
    }

    /// Poll until the import resolves. "received" (hold mode) counts as
    /// delivered — the server holds the document for batch conversion.
    pub fn await_import(&self, session_id: &str, timeout_seconds: u64) -> bool {
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(timeout_seconds);
        while std::time::Instant::now() < deadline {
            if let Ok(status) = self.get(&format!("/api/companion/sessions/{session_id}")) {
                match status["status"].as_str() {
                    Some("imported") | Some("received") => return true,
                    Some("failed") => return false,
                    _ => {}
                }
            }
            std::thread::sleep(std::time::Duration::from_secs(2));
        }
        false
    }

    /// The desktop UI's command latch: long-held, returns "sync" at most
    /// once per request. Each call also refreshes presence (heartbeat).
    pub fn poll_command(&self, phones: usize, host_name: &str) -> Result<Option<String>, String> {
        let reply = self.get(&format!(
            "/api/companion/host/poll?phones={phones}&wait=20&name={}",
            urlencode(host_name)
        ))?;
        Ok(reply["command"].as_str().map(str::to_string))
    }

    /// Instant presence update on phone attach/drop.
    pub fn report_presence(&self, phones: usize, host_name: &str) {
        let _ = self.post(
            "/api/companion/host/presence",
            &json!({ "phones": phones, "name": host_name }),
        );
    }
}

fn uuid_strings(values: Option<&Vec<Value>>) -> Vec<String> {
    values
        .map(|list| {
            list.iter()
                .filter_map(|v| v.as_str().map(str::to_string))
                .collect()
        })
        .unwrap_or_default()
}

/// Live enablement check — the flag lives in the encrypted config DB, so
/// the source of truth is the server itself, not a boot-time snapshot.
pub fn companion_enabled(server_port: u16, token: &str) -> bool {
    let agent = ureq::Agent::new_with_config(
        ureq::config::Config::builder()
            .timeout_global(Some(std::time::Duration::from_secs(2)))
            .build(),
    );
    match agent
        .get(&format!(
            "http://127.0.0.1:{server_port}/api/companion/status"
        ))
        .header("Authorization", &format!("Bearer {token}"))
        .call()
    {
        Ok(mut response) => response
            .body_mut()
            .read_json::<serde_json::Value>()
            .map(|status| status["enabled"].as_bool().unwrap_or(false))
            .unwrap_or(false),
        Err(e) => {
            log::warn!("[companion] enablement check failed: {e}");
            false
        }
    }
}

fn urlencode(text: &str) -> String {
    let mut out = String::new();
    for byte in text.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(byte as char)
            }
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}
