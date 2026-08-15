import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from server import server as server_module  # noqa: F401 - CI guard via import
from server.api import auth as auth_module
from server.middleware import LocalTokenMiddleware, RateLimitMiddleware
from server.utils.local_request_token import get_request_token, set_request_token


@pytest.fixture(autouse=True)
def _reset_auth_state():
    yield
    auth_module.reset_for_tests()


def _build_app(*middleware) -> FastAPI:
    app = FastAPI()
    for mw in middleware:
        app.add_middleware(mw)
    app.include_router(auth_module.router, prefix="/api/auth")

    @app.get("/api/note/list")
    def _notes():
        return []

    return app


# --- startup guard ------------------------------------------------------------


def test_guard_exits_with_no_auth():
    with pytest.raises(SystemExit):
        server_module.validate_docker_auth(
            passphrase="",
            proxy_auth_enabled=False,
            server_host="0.0.0.0",
            allow_unauthenticated=False,
        )


def test_guard_passes_with_passphrase():
    server_module.validate_docker_auth(
        passphrase="correct horse battery staple",
        proxy_auth_enabled=False,
        server_host="0.0.0.0",
        allow_unauthenticated=False,
    )


def test_guard_passes_with_proxy_auth():
    server_module.validate_docker_auth(
        passphrase="",
        proxy_auth_enabled=True,
        server_host="0.0.0.0",
        allow_unauthenticated=False,
    )


def test_guard_passes_with_loopback_host():
    server_module.validate_docker_auth(
        passphrase="",
        proxy_auth_enabled=False,
        server_host="127.0.0.1",
        allow_unauthenticated=False,
    )


def test_guard_passes_with_explicit_override():
    server_module.validate_docker_auth(
        passphrase="",
        proxy_auth_enabled=False,
        server_host="0.0.0.0",
        allow_unauthenticated=True,
    )


def test_guard_warns_on_short_passphrase(caplog):
    server_module.validate_docker_auth(
        passphrase="short",
        proxy_auth_enabled=False,
        server_host="0.0.0.0",
        allow_unauthenticated=False,
    )
    assert any("PHLOX_PASSPHRASE" in r.message for r in caplog.records)


# --- login endpoint ------------------------------------------------------------


def test_login_success_mints_token():
    client = TestClient(_build_app())
    auth_module.init_passphrase_auth("correct horse battery staple")
    resp = client.post("/api/auth/login", json={"passphrase": "correct horse battery staple"})
    assert resp.status_code == 200
    assert resp.json()["token"] == get_request_token()


def test_login_reachable_without_token_then_notes_blocked():
    """Login must bypass the token check WITHOUT entering the shared skip list."""
    client = TestClient(_build_app(LocalTokenMiddleware))
    auth_module.init_passphrase_auth("correct horse battery staple")

    resp = client.post("/api/auth/login", json={"passphrase": "wrong"})
    assert resp.status_code == 401  # from the handler, not middleware
    assert resp.json()["detail"] == "Invalid passphrase"

    assert client.get("/api/note/list").status_code == 401  # middleware

    resp = client.post("/api/auth/login", json={"passphrase": "correct horse battery staple"})
    assert resp.status_code == 200
    token = resp.json()["token"]
    assert (
        client.get("/api/note/list", headers={"Authorization": f"Bearer {token}"}).status_code
        == 200
    )


def test_login_lockout_after_repeated_failures():
    client = TestClient(_build_app())
    auth_module.init_passphrase_auth("correct horse battery staple")
    for _ in range(auth_module.MAX_ATTEMPTS):
        assert client.post("/api/auth/login", json={"passphrase": "nope"}).status_code == 401
    locked = client.post("/api/auth/login", json={"passphrase": "nope"})
    assert locked.status_code == 423
    # Correct passphrase is also refused while locked out
    good = client.post("/api/auth/login", json={"passphrase": "correct horse battery staple"})
    assert good.status_code == 423


def test_login_not_configured_denies():
    client = TestClient(_build_app())
    resp = client.post("/api/auth/login", json={"passphrase": "x"})
    assert resp.status_code == 503


# --- LocalTokenMiddleware matrix ------------------------------------------------


def test_middleware_token_matrix(monkeypatch):
    monkeypatch.setattr("server.constants.IS_DOCKER", False)
    client = TestClient(_build_app(LocalTokenMiddleware))
    auth_module.init_passphrase_auth("correct horse battery staple")
    token = get_request_token()

    assert client.get("/api/note/list").status_code == 401  # missing header
    assert (
        client.get("/api/note/list", headers={"Authorization": "Bearer wrong"}).status_code == 403
    )
    assert (
        client.get("/api/note/list", headers={"Authorization": f"Bearer {token}"}).status_code
        == 200
    )


def test_middleware_docker_without_token_passthrough(monkeypatch):
    monkeypatch.setattr("server.constants.IS_DOCKER", True)
    set_request_token(None)
    client = TestClient(_build_app(LocalTokenMiddleware))
    assert client.get("/api/note/list").status_code == 200


# --- rate limiting still applies to login (not in shared skip list) ------------


def test_login_is_rate_limited(monkeypatch):
    monkeypatch.setattr("server.constants.RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr("server.constants.IS_DOCKER", True)
    monkeypatch.setattr(RateLimitMiddleware, "DEFAULT_LIMIT", (2, 1))
    client = TestClient(_build_app(RateLimitMiddleware))
    auth_module.init_passphrase_auth("correct horse battery staple")

    statuses = [
        client.post("/api/auth/login", json={"passphrase": "x"}).status_code for _ in range(6)
    ]
    assert 429 in statuses
    RateLimitMiddleware._request_history.clear()
