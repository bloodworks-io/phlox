use super::*;

#[test]
fn parse_ports_line_well_formed() {
    let ports = parse_ports_line("PORTS:5000,8082,8081,8083|TOKEN:abcdef0123").unwrap();
    assert_eq!(ports.server, 5000);
    assert_eq!(ports.llama, 8082);
    assert_eq!(ports.whisper, 8081);
    assert_eq!(ports.embedding, 8083);
    assert_eq!(ports.request_token, "abcdef0123");
}

#[test]
fn parse_ports_line_three_ports_uses_embedding_fallback() {
    let ports = parse_ports_line("PORTS:5000,8082,8081|TOKEN:tok").unwrap();
    assert_eq!(ports.embedding, EMBEDDING_PORT);
}

#[test]
fn parse_ports_line_missing_token() {
    let err = parse_ports_line("PORTS:5000,8082,8081").unwrap_err();
    assert!(err.contains("missing token"));
}

#[test]
fn parse_ports_line_too_few_ports() {
    let err = parse_ports_line("PORTS:5000,8082|TOKEN:tok").unwrap_err();
    assert!(err.contains("too few ports"));
}

#[test]
fn parse_ports_line_empty_token() {
    let err = parse_ports_line("PORTS:5000,8082,8081|TOKEN:").unwrap_err();
    assert!(err.contains("Empty token"));
}

#[test]
fn parse_ports_line_bad_port() {
    let err = parse_ports_line("PORTS:foo,8082,8081|TOKEN:tok").unwrap_err();
    assert!(err.contains("Failed to parse server port"));
}

#[test]
fn parse_ports_line_no_token_prefix() {
    let err = parse_ports_line("PORTS:5000,8082,8081|NOTOKEN:tok").unwrap_err();
    assert!(err.contains("Missing TOKEN prefix"));
}

#[test]
fn default_state_is_empty() {
    let state = ProcessManagerState::default();
    assert!(state.llama.is_none());
    assert!(status_default_port_matches());
}

fn status_default_port_matches() -> bool {
    // StatusData default has no services.
    let s = StatusData::default();
    s.llama.is_none() && s.server.is_none()
}

#[test]
fn with_stderr_appends_trimmed_stderr() {
    assert_eq!(with_stderr("boom", b"line1\nline2\n"), "boom\nline1\nline2");
}

#[test]
fn with_stderr_without_content_returns_message() {
    assert_eq!(with_stderr("boom", b""), "boom");
    assert_eq!(with_stderr("boom", b"  \n "), "boom");
}

#[test]
fn capitalize_uppercases_first_char_only() {
    assert_eq!(capitalize("llama"), "Llama");
    assert_eq!(capitalize("whisper server"), "Whisper server");
    assert_eq!(capitalize("mIxEd"), "MIxEd");
    assert_eq!(capitalize(""), "");
}

#[cfg(unix)]
fn fake_child(script: &str) -> Child {
    Command::new("sh")
        .arg("-c")
        .arg(script)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("failed to spawn fake child process")
}

#[cfg(unix)]
#[test]
fn create_status_data_maps_running_processes() {
    let mut llama = ManagedProcess {
        child: fake_child("sleep 5"),
        port: 8082,
        drain_handles: None,
        drain_shutdown: None,
    };
    let mut server = ManagedProcess {
        child: fake_child("sleep 5"),
        port: 5000,
        drain_handles: None,
        drain_shutdown: None,
    };
    let token = "tok".to_string();

    let status = create_status_data(Some(&llama), None, Some(&server), None, Some(&token));

    let llama_status = status.llama.expect("llama status");
    assert!(llama_status.running);
    assert_eq!(llama_status.pid, llama.child.id());
    assert_eq!(llama_status.port, 8082);
    assert!(status.whisper.is_none());
    assert!(status.embedding.is_none());
    let server_status = status.server.expect("server status");
    assert_eq!(server_status.port, 5000);
    assert_eq!(status.request_token.as_deref(), Some("tok"));

    let _ = llama.child.kill();
    let _ = server.child.kill();
}

#[cfg(unix)]
mod signal_protocol {
    use super::*;

    #[test]
    fn waiting_for_passphrase_signal() {
        let mut child = fake_child("echo WAITING_FOR_PASSPHRASE; sleep 5");
        let signal = wait_for_server_signal(&mut child).expect("expected a signal");
        let _ = child.kill();
        assert!(matches!(signal, ServerSignal::WaitingForPassphrase));
    }

    #[test]
    fn ports_signal_parses_allocation() {
        let mut child = fake_child(r#"echo "PORTS:5000,8082,8081,8083|TOKEN:tok123"; sleep 5"#);
        let signal = wait_for_server_signal(&mut child).expect("expected a signal");
        let _ = child.kill();
        match signal {
            ServerSignal::Ports(p) => {
                assert_eq!(p.server, 5000);
                assert_eq!(p.llama, 8082);
                assert_eq!(p.whisper, 8081);
                assert_eq!(p.embedding, 8083);
                assert_eq!(p.request_token, "tok123");
            }
            other => panic!("expected Ports signal, got {:?}", other),
        }
    }

    #[test]
    fn error_line_is_returned_as_err() {
        let mut child = fake_child(r#"echo "ERROR:boom"; sleep 5"#);
        let err = wait_for_server_signal(&mut child).unwrap_err();
        let _ = child.kill();
        assert_eq!(err, "boom");
    }

    #[test]
    fn wrong_key_stderr_is_detected() {
        let mut child = fake_child(r#"echo "Cannot decrypt database" >&2; sleep 5"#);
        let err = wait_for_server_signal(&mut child).unwrap_err();
        let _ = child.kill();
        assert_eq!(err, "Wrong encryption key");
    }

    #[test]
    fn early_exit_reports_server_exited_with_stderr() {
        let mut child = fake_child("echo oops >&2; exit 3");
        let err = wait_for_server_signal(&mut child).unwrap_err();
        assert!(
            err.starts_with("Server exited before sending signal"),
            "unexpected error: {err}"
        );
        assert!(err.contains("oops"), "stderr missing from error: {err}");
    }
}
