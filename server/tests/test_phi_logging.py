"""Phase 1 (failing) tests: PHI and secrets must not leak into logs or the audit table.

These tests pin down the *secure* behaviour and are expected to FAIL against the
current code. All identifiers, tokens, names and contact details are fake.
"""

import ast
import logging
from collections.abc import Sequence
from pathlib import Path

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from server.chat.tools.sanitization import (
    sanitize_pubmed_query,
    sanitize_query_for_external_search,
)
from server.database.core.connection import get_db
from server.database.repositories.audit import flush_events_sync
from server.middleware import AuditMiddleware, LocalTokenMiddleware, RateLimitMiddleware
from server.utils.local_request_token import get_request_token, set_request_token

FAKE_PATIENT_ID = "987654"
FAKE_PATIENT_PATH = f"/api/patient/id/{FAKE_PATIENT_ID}"
FAKE_EXPECTED_TOKEN = "fake-expected-token"
FAKE_BAD_TOKEN = "Zq7xK9pWv2Rj4Tn8"
FAKE_NAME = "Quentavius Fakeperson"
FAKE_MRN = "MRN 123456"
FAKE_EMAIL = "jane.fake@example.org"
FAKE_QUERY = f"metformin dosing for {FAKE_NAME} {FAKE_MRN} contact {FAKE_EMAIL}"

SERVER_PY = Path(__file__).resolve().parents[1] / "server.py"


def _patient_app(middleware, status: int = 200) -> FastAPI:
    """Minimal app with one middleware and a patient-detail route returning `status`."""
    app = FastAPI()
    app.add_middleware(middleware)

    @app.get("/api/patient/id/{patient_id}")
    def _get_patient(patient_id: str):  # noqa: ARG001 - FastAPI needs the path param
        if status != 200:
            raise HTTPException(status_code=status, detail="fake error")
        return {"ok": True}

    return app


# Loggers of the test client's HTTP stack (TestClient -> httpx -> httpcore).
# Their request lines are a test-harness artifact, not application logging.
# Denylist (not a server.* allowlist) so leaks from any app logger are caught.
_TEST_HTTP_LOGGERS = ("httpx", "httpcore")


def _is_test_http_logger(name: str) -> bool:
    return any(name == n or name.startswith(n + ".") for n in _TEST_HTTP_LOGGERS)


def _log_messages(caplog) -> list[str]:
    return [r.getMessage() for r in caplog.records if not _is_test_http_logger(r.name)]


def _find_leaks(messages: list[str], needles: Sequence[tuple[str, str]]) -> list[str]:
    """Return one readable line per (label, needle) found in any log message."""
    return [
        f"[{label}] {needle!r} found in log: {msg!r}"
        for label, needle in needles
        for msg in messages
        if needle and needle in msg
    ]


def _format_violations(violations: list[str]) -> str:
    return f"{len(violations)} privacy violation(s) in logs:\n  " + "\n  ".join(violations)


def _max_audit_id() -> int:
    with get_db().read() as cursor:
        cursor.execute("SELECT COALESCE(MAX(id), 0) AS m FROM audit_log")
        return cursor.fetchone()["m"]


# --- 1. Audit table ------------------------------------------------------------


@pytest.mark.parametrize("status", [200, 404], ids=["success", "not_found"])
def test_audit_path_does_not_store_raw_patient_id(status):
    """Issue: AuditMiddleware stores the raw URL path, so patient identifiers
    (/api/patient/id/<id>) land in audit_log next to actor + timestamp. This
    must hold for both successful and failing requests."""
    flush_events_sync()  # drain leftovers from other tests
    before = _max_audit_id()

    client = TestClient(_patient_app(AuditMiddleware, status))
    resp = client.get(FAKE_PATIENT_PATH)
    assert resp.status_code == status
    flush_events_sync()

    with get_db().read() as cursor:
        cursor.execute(
            "SELECT method, path, status FROM audit_log WHERE id > ? ORDER BY id",
            (before,),
        )
        rows = [dict(r) for r in cursor.fetchall()]

    # The access must still be audited...
    assert len(rows) == 1
    row = rows[0]
    assert row["method"] == "GET"
    assert row["status"] == status
    assert row["path"].startswith("/api/patient")
    # ...but without the raw patient identifier.
    assert FAKE_PATIENT_ID not in row["path"]


# --- 2. Invalid desktop token --------------------------------------------------


def test_invalid_token_not_logged(monkeypatch, caplog):
    """Issue: LocalTokenMiddleware logs the first 8 characters of a rejected
    bearer token and the raw request path (desktop mode), leaking secret
    material and patient identifiers into logs."""
    monkeypatch.setattr("server.constants.IS_DOCKER", False)
    previous_token = get_request_token()
    set_request_token(FAKE_EXPECTED_TOKEN)
    try:
        caplog.set_level(logging.DEBUG)
        client = TestClient(_patient_app(LocalTokenMiddleware))
        resp = client.get(FAKE_PATIENT_PATH, headers={"Authorization": f"Bearer {FAKE_BAD_TOKEN}"})

        # The failed attempt must still be rejected and logged...
        assert resp.status_code == 403
        assert any(
            r.name == "server.middleware"
            and r.levelno >= logging.WARNING
            and "invalid" in r.getMessage().lower()
            for r in caplog.records
        )

        # ...but no 4-char fragment of the supplied token and no patient
        # identifier may appear. Collect every leak so one run shows them all.
        fragments = sorted({FAKE_BAD_TOKEN[i : i + 4] for i in range(len(FAKE_BAD_TOKEN) - 3)})
        needles = [("token fragment", f) for f in fragments]
        needles.append(("patient ID", FAKE_PATIENT_ID))
        violations = _find_leaks(_log_messages(caplog), needles)
        assert not violations, _format_violations(violations)
    finally:
        set_request_token(previous_token)


# --- 3. Rate limiter warning ---------------------------------------------------


def test_rate_limit_warning_does_not_log_patient_id(monkeypatch, caplog):
    """Issue: RateLimitMiddleware logs `Rate limit exceeded for <ip> on <path>`
    with the full path, leaking patient identifiers into logs."""
    monkeypatch.setattr("server.constants.RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr("server.constants.IS_DOCKER", True)  # no desktop multiplier
    monkeypatch.setattr(RateLimitMiddleware, "DEFAULT_LIMIT", (1, 1))
    # Fresh limiter state for this test only; monkeypatch restores the shared dict.
    monkeypatch.setattr(RateLimitMiddleware, "_request_history", {})

    caplog.set_level(logging.DEBUG)
    client = TestClient(_patient_app(RateLimitMiddleware))
    statuses = [client.get(FAKE_PATIENT_PATH).status_code for _ in range(3)]

    # Rate limiting must still trigger and be logged...
    assert 429 in statuses
    assert any(
        r.name == "server.middleware"
        and r.levelno >= logging.WARNING
        and "rate limit" in r.getMessage().lower()
        for r in caplog.records
    )
    # ...but without the patient identifier.
    violations = _find_leaks(_log_messages(caplog), [("patient ID", FAKE_PATIENT_ID)])
    assert not violations, _format_violations(violations)


# --- 4. Search-query sanitizer -------------------------------------------------


@pytest.mark.parametrize(
    "sanitizer",
    [sanitize_query_for_external_search, sanitize_pubmed_query],
    ids=["external_search", "pubmed"],
)
def test_sanitizer_does_not_log_query_text(sanitizer, caplog):
    """Issue: sanitize_query_for_external_search logs both the original and the
    sanitized query; sanitize_pubmed_query calls it and leaks the same way.
    Patient names survive the regex sanitizer, so even the sanitized text is
    PHI. Only metadata (e.g. length, which rule fired) may be logged."""
    caplog.set_level(logging.DEBUG)

    result = sanitizer(FAKE_QUERY)

    # Sanity: sanitization ran and stripped the regex-detectable PHI.
    assert result and result != FAKE_QUERY
    assert FAKE_MRN not in result, "sanitizer weakness: MRN survived sanitization"
    assert FAKE_EMAIL not in result, "sanitizer weakness: email survived sanitization"

    # Neither the original query, its PHI parts, nor the sanitized text (names
    # survive it) may be logged. Collect every leak so one run shows them all.
    needles = [
        ("original query", FAKE_QUERY),
        ("MRN", FAKE_MRN),
        ("email", FAKE_EMAIL),
        ("sanitized query", result),
        ("patient name", "Fakeperson"),
    ]
    violations = _find_leaks(_log_messages(caplog), needles)
    assert not violations, _format_violations(violations)


# --- 5. Uvicorn access log -----------------------------------------------------


def _uvicorn_config_calls(tree: ast.AST) -> list[ast.Call]:
    """All `uvicorn.Config(...)` / `uvicorn.run(...)` calls in the module."""
    calls = []
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and isinstance(node.func.value, ast.Name)
            and node.func.value.id == "uvicorn"
            and node.func.attr in {"Config", "run"}
        ):
            calls.append(node)
    return calls


_SILENCING_LEVEL_NAMES = {"WARNING", "WARN", "ERROR", "CRITICAL", "FATAL"}


def _is_get_access_logger(node: ast.AST) -> bool:
    """`logging.getLogger("uvicorn.access")` or `getLogger("uvicorn.access")`."""
    if not isinstance(node, ast.Call) or not node.args:
        return False
    func = node.func
    name = func.attr if isinstance(func, ast.Attribute) else getattr(func, "id", None)
    first = node.args[0]
    return (
        name == "getLogger" and isinstance(first, ast.Constant) and first.value == "uvicorn.access"
    )


def _access_logger_names(tree: ast.AST) -> set[str]:
    """Variable names bound via `x = logging.getLogger("uvicorn.access")`."""
    names = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and _is_get_access_logger(node.value):
            names.update(t.id for t in node.targets if isinstance(t, ast.Name))
    return names


def _refers_to_access_logger(node: ast.AST, names: set[str]) -> bool:
    return _is_get_access_logger(node) or (isinstance(node, ast.Name) and node.id in names)


def _is_silencing_level(node: ast.AST) -> bool:
    """True for logging.WARNING (or higher), "WARNING"-style strings, or ints >= 30."""
    if isinstance(node, ast.Attribute):
        return node.attr in _SILENCING_LEVEL_NAMES
    if isinstance(node, ast.Constant):
        if isinstance(node.value, str):
            return node.value.upper() in _SILENCING_LEVEL_NAMES
        if isinstance(node.value, int) and not isinstance(node.value, bool):
            return node.value >= logging.WARNING
    return False


def _access_log_filtered(tree: ast.AST) -> bool:
    """True if the module filters or silences the uvicorn.access logger, either
    directly on `logging.getLogger("uvicorn.access")` or through a variable
    bound to it: `.addFilter(...)`, `.setLevel(<WARNING or higher>)`, or
    `.disabled = True`."""
    names = _access_logger_names(tree)
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
            if not _refers_to_access_logger(node.func.value, names):
                continue
            if node.func.attr == "addFilter":
                return True
            if node.func.attr == "setLevel" and node.args and _is_silencing_level(node.args[0]):
                return True
        if isinstance(node, ast.Assign) and isinstance(node.value, ast.Constant):
            if node.value.value is not True:
                continue
            for target in node.targets:
                if (
                    isinstance(target, ast.Attribute)
                    and target.attr == "disabled"
                    and _refers_to_access_logger(target.value, names)
                ):
                    return True
    return False


def test_uvicorn_access_log_disabled_or_filtered():
    """Issue: server.py starts uvicorn with its default access log enabled, so
    every request line (e.g. `GET /api/patient/id/<id>`) is written to stdout
    logs. Each uvicorn startup must pass access_log=False, or the module must
    filter/silence the uvicorn.access logger (addFilter, setLevel >= WARNING,
    or disabled = True).

    This is a static configuration check: server.py is parsed with `ast`, not
    imported, and no server is started."""
    tree = ast.parse(SERVER_PY.read_text(), filename=str(SERVER_PY))
    calls = _uvicorn_config_calls(tree)
    assert calls, "expected uvicorn.Config/run calls in server.py"

    if _access_log_filtered(tree):
        return

    offending = []
    for call in calls:
        kw = {k.arg: k.value for k in call.keywords if k.arg}
        access_log = kw.get("access_log")
        disabled = isinstance(access_log, ast.Constant) and access_log.value is False
        if not disabled:
            offending.append(f"server.py:{call.lineno}")
    assert not offending, f"uvicorn started with access log enabled at: {offending}"


# --- 6. Central redaction filter (defence in depth, Phase 2) -------------------

from server.utils.log_redaction import RedactingFilter, redact  # noqa: E402


@pytest.mark.parametrize(
    ("raw", "secret"),
    [
        (f"Authorization: Bearer {FAKE_BAD_TOKEN}", FAKE_BAD_TOKEN),
        (f"lookup {FAKE_MRN} failed", "123456"),
        ("found UR 7654321 in list", "7654321"),
        (f"mail sent to {FAKE_EMAIL}", FAKE_EMAIL),
        (f"GET {FAKE_PATIENT_PATH} 200", FAKE_PATIENT_ID),
        (f"GET /api/note/id/{FAKE_PATIENT_ID}/history?name=Fakeperson", "Fakeperson"),
        (
            "session /api/agent-live/sessions/0f8fad5b-d9cb-469f-a165-70867728950e/end",
            "0f8fad5b-d9cb-469f-a165-70867728950e",
        ),
    ],
    ids=["bearer", "mrn", "ur", "email", "path_id", "path_query", "path_uuid"],
)
def test_redact_masks_identifiers(raw, secret):
    """Issue (defence in depth): even if a call site logs PHI or secrets, the
    central redaction must mask bearer tokens, MRN/UR numbers, emails and
    patient-ID path segments (and query strings) before output."""
    out = redact(raw)
    assert secret not in out, f"{secret!r} survived redaction: {out!r}"


def test_redact_keeps_non_phi_text():
    """Issue (defence in depth): redaction must not destroy useful,
    non-identifying log content such as route templates and plain messages."""
    for msg in [
        "Rate limit exceeded for 10.0.0.1 on endpoint group /api/default",
        "Invalid request token (method=GET, route=/api/patient/id/{patient_id})",
        "Database schema is at version 11",
    ]:
        assert redact(msg) == msg


def test_redacting_filter_returns_copy_and_formats_args():
    """Issue (defence in depth): the handler filter must redact %-style args
    and must not mutate the shared LogRecord seen by other handlers."""
    record = logging.LogRecord(
        "server.test",
        logging.WARNING,
        __file__,
        1,
        "Invalid token for %s (got %s)",
        (FAKE_PATIENT_PATH, f"Bearer {FAKE_BAD_TOKEN}"),
        None,
    )
    result = RedactingFilter().filter(record)

    assert isinstance(result, logging.LogRecord) and result is not record
    clean = result.getMessage()
    assert FAKE_PATIENT_ID not in clean and FAKE_BAD_TOKEN not in clean
    # Original record untouched.
    assert FAKE_PATIENT_ID in record.getMessage()
    assert FAKE_BAD_TOKEN in record.getMessage()


def test_redacting_filter_passes_clean_records_unchanged():
    """Issue (defence in depth): records without identifiers pass through as-is."""
    record = logging.LogRecord("server.test", logging.INFO, __file__, 1, "all good %d", (1,), None)
    assert RedactingFilter().filter(record) is True


def test_redaction_installed_on_root_handlers():
    """Issue (defence in depth): server.py must attach RedactingFilter to the
    root logging handlers at startup so every logger's output is covered."""
    from server import server  # noqa: F401 - import performs logging setup

    handlers = logging.getLogger().handlers
    assert any(isinstance(f, RedactingFilter) for h in handlers for f in h.filters), (
        "no root handler carries a RedactingFilter"
    )
