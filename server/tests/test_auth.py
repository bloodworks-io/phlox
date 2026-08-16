"""Auth flow tests: setup, login, lockout, sessions, user management (Docker mode)."""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.api.auth import reset_for_tests
from server.middleware import LocalTokenMiddleware
from server.utils.local_request_token import set_request_token


def _build_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(LocalTokenMiddleware)

    from server.api.auth import router as auth_router

    app.include_router(auth_router, prefix="/api/auth")

    @app.get("/api/probe")
    def _probe():
        from server.utils.current_user import get_current_user

        user = get_current_user()
        return {"user": user.username if user else None}

    return app


def _docker_client(monkeypatch) -> TestClient:
    monkeypatch.setattr("server.constants.IS_DOCKER", True)
    monkeypatch.setattr("server.constants.PHLOX_ALLOW_UNAUTHENTICATED", False)
    return TestClient(_build_app())


def test_status_needs_setup(monkeypatch):
    reset_for_tests()
    client = _docker_client(monkeypatch)
    resp = client.get("/api/auth/status")
    assert resp.status_code == 200
    assert resp.json() == {"needs_setup": True}


def test_setup_creates_admin_and_session(monkeypatch):
    reset_for_tests()
    client = _docker_client(monkeypatch)

    resp = client.post("/api/auth/setup", json={"username": "admin_a", "password": "strongpass123"})
    assert resp.status_code == 200
    token = resp.json()["token"]

    # Token authenticates; probe resolves to the admin user
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["username"] == "admin_a"
    assert me.json()["role"] == "admin"

    probe = client.get("/api/probe", headers=headers)
    assert probe.json() == {"user": "admin_a"}

    # No token -> 401
    assert client.get("/api/probe").status_code == 401
    # Bad token -> 401
    bad = client.get("/api/probe", headers={"Authorization": "Bearer deadbeef"})
    assert bad.status_code == 401


def test_setup_refuses_second_time(monkeypatch):
    reset_for_tests()
    client = _docker_client(monkeypatch)
    client.post("/api/auth/setup", json={"username": "admin_b", "password": "strongpass123"})
    resp = client.post("/api/auth/setup", json={"username": "sneaky", "password": "strongpass123"})
    assert resp.status_code == 403


def test_login_and_logout(monkeypatch):
    reset_for_tests()
    client = _docker_client(monkeypatch)
    client.post("/api/auth/setup", json={"username": "admin_c", "password": "strongpass123"})

    ok = client.post("/api/auth/login", json={"username": "admin_c", "password": "strongpass123"})
    assert ok.status_code == 200
    token = ok.json()["token"]

    bad = client.post("/api/auth/login", json={"username": "admin_c", "password": "wrong"})
    assert bad.status_code == 401

    headers = {"Authorization": f"Bearer {token}"}
    assert client.get("/api/probe", headers=headers).status_code == 200
    client.post("/api/auth/logout", headers=headers)
    assert client.get("/api/probe", headers=headers).status_code == 401


def test_lockout_after_repeated_failures(monkeypatch):
    reset_for_tests()
    client = _docker_client(monkeypatch)
    client.post("/api/auth/setup", json={"username": "admin_d", "password": "strongpass123"})

    for _ in range(5):
        r = client.post("/api/auth/login", json={"username": "admin_d", "password": "nope"})
        assert r.status_code == 401
    locked = client.post(
        "/api/auth/login", json={"username": "admin_d", "password": "strongpass123"}
    )
    assert locked.status_code == 423

    # Lockout is per-username: another user is unaffected
    other = client.post(
        "/api/auth/login", json={"username": "admin_c", "password": "strongpass123"}
    )
    assert other.status_code in (200, 401)  # admin_c may not exist if run alone


def test_expired_session_rejected(monkeypatch):
    reset_for_tests()
    client = _docker_client(monkeypatch)
    client.post("/api/auth/setup", json={"username": "admin_e", "password": "strongpass123"})
    token = client.post(
        "/api/auth/login", json={"username": "admin_e", "password": "strongpass123"}
    ).json()["token"]

    from server.database.core.connection import get_db

    with get_db().transaction() as cursor:
        cursor.execute("UPDATE sessions SET expires_at = '2000-01-01T00:00:00'")

    resp = client.get("/api/probe", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401


def test_user_management_requires_admin(monkeypatch):
    reset_for_tests()
    client = _docker_client(monkeypatch)
    client.post("/api/auth/setup", json={"username": "admin_f", "password": "strongpass123"})
    admin_token = client.post(
        "/api/auth/login", json={"username": "admin_f", "password": "strongpass123"}
    ).json()["token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    created = client.post(
        "/api/auth/users",
        json={"username": "drwho", "password": "strongpass123", "role": "clinician"},
        headers=admin_headers,
    )
    assert created.status_code == 200
    user_id = created.json()["id"]

    dr_token = client.post(
        "/api/auth/login", json={"username": "drwho", "password": "strongpass123"}
    ).json()["token"]
    dr_headers = {"Authorization": f"Bearer {dr_token}"}

    # Clinician cannot manage users
    assert client.get("/api/auth/users", headers=dr_headers).status_code == 403

    # Admin disables the clinician; their session dies and login is refused
    assert (
        client.post(
            f"/api/auth/users/{user_id}/disable", json={"disabled": True}, headers=admin_headers
        ).status_code
        == 200
    )
    assert client.get("/api/probe", headers=dr_headers).status_code == 401
    again = client.post("/api/auth/login", json={"username": "drwho", "password": "strongpass123"})
    assert again.status_code == 401


def test_desktop_token_resolves_to_implicit_admin(monkeypatch):
    monkeypatch.setattr("server.constants.IS_DOCKER", False)
    set_request_token("desktop-test-token")

    from server.database.repositories.users import (
        IMPLICIT_ADMIN_USERNAME,
        create_user,
        get_user_by_username,
    )

    if not get_user_by_username(IMPLICIT_ADMIN_USERNAME):
        create_user(IMPLICIT_ADMIN_USERNAME, role="admin")

    client = TestClient(_build_app())
    headers = {"Authorization": "Bearer desktop-test-token"}
    probe = client.get("/api/probe", headers=headers)
    assert probe.status_code == 200
    assert probe.json()["user"] == IMPLICIT_ADMIN_USERNAME

    # Wrong token is rejected
    assert client.get("/api/probe", headers={"Authorization": "Bearer wrong"}).status_code == 403
    set_request_token(None)
    reset_for_tests()


def test_global_config_writes_require_admin():
    """Clinicians must not change server-wide config/prompts/options."""
    import pytest
    from fastapi import HTTPException

    from server.api.config import global_config
    from server.api.config import models as config_models
    from server.api.config import prompts as config_prompts
    from server.utils.current_user import CurrentUser, set_current_user

    clinician = CurrentUser(999999, "plainuser", "clinician")
    admin = CurrentUser(999998, "boss", "admin")

    def writes():
        global_config.update_config({})
        config_prompts.update_prompts({})
        config_models.update_options("general", {})
        config_models.reset_options_to_defaults()

    try:
        set_current_user(clinician)
        with pytest.raises(HTTPException) as exc:
            writes()
        assert exc.value.status_code == 403

        # Admin path works (empty payloads write nothing)
        set_current_user(admin)
        assert global_config.update_config({})["message"]
        assert config_prompts.update_prompts({})["message"]
    finally:
        set_current_user(None)
