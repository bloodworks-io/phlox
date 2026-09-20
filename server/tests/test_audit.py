"""Tests for audit logging: middleware writes rows, retention purge honors config."""

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from server.database.core.connection import get_db
from server.database.repositories.audit import log_event, purge_old_events
from server.middleware import AuditMiddleware


def _build_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(AuditMiddleware)

    @app.get("/api/ping")
    def _ping():
        return {"ok": True}

    return app


def _count_rows() -> int:
    with get_db().read() as cursor:
        cursor.execute("SELECT COUNT(*) AS n FROM audit_log")
        return cursor.fetchone()["n"]


def test_middleware_writes_audit_row():
    before = _count_rows()
    client = TestClient(_build_app())
    resp = client.get("/api/ping")
    assert resp.status_code == 200
    after = _count_rows()
    assert after == before + 1

    with get_db().read() as cursor:
        cursor.execute("SELECT method, path, status FROM audit_log ORDER BY id DESC LIMIT 1")
        row = cursor.fetchone()
    assert row["method"] == "GET"
    assert row["path"] == "/api/ping"
    assert row["status"] == 200


def test_non_api_paths_not_audited():
    app = _build_app()

    @app.get("/healthz")
    def _health():
        return {"ok": True}

    before = _count_rows()
    TestClient(app).get("/healthz")
    assert _count_rows() == before


def test_audit_endpoints_not_self_audited():
    from server.api.audit import router as audit_router

    app = _build_app()
    app.include_router(audit_router, prefix="/api/audit")
    before = _count_rows()
    resp = TestClient(app).get("/api/audit")
    assert resp.status_code == 200
    assert _count_rows() == before


@pytest.mark.usefixtures("clinician_ctx")
def test_audit_list_requires_admin():
    from server.api.audit import list_audit

    with pytest.raises(HTTPException) as exc:
        list_audit()
    assert exc.value.status_code == 403


@pytest.mark.usefixtures("clinician_ctx")
def test_audit_export_requires_admin():
    from server.api.audit import export_audit

    with pytest.raises(HTTPException) as exc:
        export_audit()
    assert exc.value.status_code == 403


@pytest.mark.usefixtures("admin_ctx")
def test_audit_admin_can_read():
    from server.api.audit import export_audit, list_audit

    assert "events" in list_audit(limit=10, offset=0, from_date=None, to_date=None)
    response = export_audit(format="csv")
    assert response.media_type == "text/csv"


def test_purge_old_events_honors_retention():
    with get_db().transaction() as cursor:
        cursor.execute(
            "INSERT INTO audit_log (timestamp, actor, method, path, status) "
            "VALUES (datetime('now', '-1000 days'), 'test', 'GET', '/api/old', 200)"
        )

    deleted = purge_old_events()
    assert deleted >= 1

    with get_db().read() as cursor:
        cursor.execute("SELECT COUNT(*) AS n FROM audit_log WHERE path = '/api/old'")
        assert cursor.fetchone()["n"] == 0


def _clear_marker_rows(path: str):
    with get_db().transaction() as cursor:
        cursor.execute("DELETE FROM audit_log WHERE path = ?", (path,))


def test_purge_keeps_recent_events():
    _clear_marker_rows("/api/recent")
    log_event(method="GET", path="/api/recent", status=200)
    purge_old_events()
    with get_db().read() as cursor:
        cursor.execute("SELECT COUNT(*) AS n FROM audit_log WHERE path = '/api/recent'")
        assert cursor.fetchone()["n"] == 1


def test_purge_floors_retention_below_one():
    """A retention of 0 (or negative) must never mean 'purge everything'."""
    from server.database.config.manager import config_manager

    _clear_marker_rows("/api/zero-retention")
    original = config_manager.get_config().get("AUDIT_RETENTION_DAYS")
    log_event(method="GET", path="/api/zero-retention", status=200)
    try:
        config_manager.update_config({"AUDIT_RETENTION_DAYS": 0})
        deleted = purge_old_events()
        assert deleted == 0
        with get_db().read() as cursor:
            cursor.execute("SELECT COUNT(*) AS n FROM audit_log WHERE path = '/api/zero-retention'")
            assert cursor.fetchone()["n"] == 1
    finally:
        config_manager.update_config(
            {"AUDIT_RETENTION_DAYS": original if original is not None else 90}
        )
