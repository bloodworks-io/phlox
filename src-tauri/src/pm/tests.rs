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
