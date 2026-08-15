import httpx
import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from server import server as server_module  # noqa: F401 - CI guard via import
from server.api import auth as auth_module
from server.middleware import (
    LocalTokenMiddleware,
    ProxyAuthMiddleware,
    RateLimitMiddleware,
    TrustedProxyMiddleware,
)
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
    def _notes(request: Request):
        return {
            "user": getattr(request.state, "user", None),
            "client_ip": getattr(request.state, "client_ip", None),
        }

    return app


async def _get(app: FastAPI, peer: str, headers: dict | None = None) -> httpx.Response:
    """GET /api/note/list with a controlled direct peer address."""
    transport = httpx.ASGITransport(app=app, client=(peer, 12345))
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.get("/api/note/list", headers=headers or {})


# --- startup guard ------------------------------------------------------------


def test_guard_exits_with_no_auth():
    with pytest.raises(SystemExit):
        server_module.validate_docker_auth(
            passphrase="",
            proxy_auth_enabled=False,
            trusted_proxy_ips=[],
            server_host="0.0.0.0",
            allow_unauthenticated=False,
        )


def test_guard_passes_with_passphrase():
    server_module.validate_docker_auth(
        passphrase="correct horse battery staple",
        proxy_auth_enabled=False,
        trusted_proxy_ips=[],
        server_host="0.0.0.0",
        allow_unauthenticated=False,
    )


def test_guard_exits_with_proxy_auth_but_no_trusted_ips():
    """F2: proxy auth without an explicit trusted-proxy list must not boot."""
    with pytest.raises(SystemExit):
        server_module.validate_docker_auth(
            passphrase="",
            proxy_auth_enabled=True,
            trusted_proxy_ips=[],
            server_host="0.0.0.0",
            allow_unauthenticated=False,
        )


def test_guard_passes_with_proxy_auth():
    server_module.validate_docker_auth(
        passphrase="",
        proxy_auth_enabled=True,
        trusted_proxy_ips=["172.16.0.2"],
        server_host="0.0.0.0",
        allow_unauthenticated=False,
    )


def test_guard_passes_with_loopback_host():
    server_module.validate_docker_auth(
        passphrase="",
        proxy_auth_enabled=False,
        trusted_proxy_ips=[],
        server_host="127.0.0.1",
        allow_unauthenticated=False,
    )


def test_guard_passes_with_explicit_override():
    server_module.validate_docker_auth(
        passphrase="",
        proxy_auth_enabled=False,
        trusted_proxy_ips=[],
        server_host="0.0.0.0",
        allow_unauthenticated=True,
    )


def test_guard_warns_on_short_passphrase(caplog):
    server_module.validate_docker_auth(
        passphrase="short",
        proxy_auth_enabled=False,
        trusted_proxy_ips=[],
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


# --- ProxyAuthMiddleware matrix (TRUSTED_PROXY_IPS) ------------------------------


@pytest.mark.asyncio
async def test_proxy_auth_rejects_forged_header_from_private_peer(monkeypatch):
    """F2 repro: private-IP (but untrusted) peer cannot forge an identity."""
    monkeypatch.setattr("server.constants.PROXY_AUTH_ENABLED", True)
    monkeypatch.setattr("server.constants.TRUSTED_PROXY_IPS", ["172.16.0.2"])
    client = _build_app(ProxyAuthMiddleware)

    resp = await _get(client, "192.168.1.50", headers={"X-Forwarded-User": "dr.alice@clinic"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_proxy_auth_accepts_trusted_proxy(monkeypatch):
    monkeypatch.setattr("server.constants.PROXY_AUTH_ENABLED", True)
    monkeypatch.setattr("server.constants.TRUSTED_PROXY_IPS", ["172.16.0.2"])
    app = _build_app(ProxyAuthMiddleware)

    resp = await _get(app, "172.16.0.2", headers={"X-Forwarded-User": "dr.alice@clinic"})
    assert resp.status_code == 200
    assert resp.json()["user"] == "dr.alice@clinic"


@pytest.mark.asyncio
async def test_proxy_auth_rejects_public_peer(monkeypatch):
    monkeypatch.setattr("server.constants.PROXY_AUTH_ENABLED", True)
    monkeypatch.setattr("server.constants.TRUSTED_PROXY_IPS", ["172.16.0.2"])
    app = _build_app(ProxyAuthMiddleware)

    resp = await _get(app, "8.8.8.8", headers={"X-Forwarded-User": "dr.alice@clinic"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_proxy_auth_fails_closed_without_trusted_ips(monkeypatch):
    monkeypatch.setattr("server.constants.PROXY_AUTH_ENABLED", True)
    monkeypatch.setattr("server.constants.TRUSTED_PROXY_IPS", [])
    app = _build_app(ProxyAuthMiddleware)

    resp = await _get(app, "172.16.0.2", headers={"X-Forwarded-User": "dr.alice@clinic"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_proxy_auth_enforces_allowed_users(monkeypatch):
    monkeypatch.setattr("server.constants.PROXY_AUTH_ENABLED", True)
    monkeypatch.setattr("server.constants.PROXY_AUTH_ALLOWED_USERS", ["dr.alice@clinic"])
    monkeypatch.setattr("server.constants.TRUSTED_PROXY_IPS", ["10.0.0.0/8"])
    app = _build_app(ProxyAuthMiddleware)

    ok = await _get(app, "10.1.2.3", headers={"X-Forwarded-User": "dr.alice@clinic"})
    denied = await _get(app, "10.1.2.3", headers={"X-Forwarded-User": "mallory"})
    assert ok.status_code == 200
    assert denied.status_code == 403


@pytest.mark.asyncio
async def test_proxy_auth_rejects_missing_header_from_trusted_proxy(monkeypatch):
    monkeypatch.setattr("server.constants.PROXY_AUTH_ENABLED", True)
    monkeypatch.setattr("server.constants.TRUSTED_PROXY_IPS", ["172.16.0.2"])
    app = _build_app(ProxyAuthMiddleware)

    resp = await _get(app, "172.16.0.2")
    assert resp.status_code == 401


# --- TrustedProxyMiddleware matrix (TRUSTED_PROXY_IPS) ---------------------------


@pytest.mark.asyncio
async def test_trusted_proxy_ignores_xff_from_untrusted_peer(monkeypatch):
    """F10 repro: XFF rotation cannot forge audit IPs / fresh rate-limit buckets."""
    monkeypatch.setattr("server.constants.TRUSTED_PROXY_IPS", ["172.16.0.2"])
    app = _build_app(TrustedProxyMiddleware)

    resp = await _get(app, "192.168.1.50", headers={"X-Forwarded-For": "10.99.1.2"})
    assert resp.status_code == 200
    assert resp.json()["client_ip"] == "192.168.1.50"


@pytest.mark.asyncio
async def test_trusted_proxy_uses_xff_from_trusted_peer(monkeypatch):
    monkeypatch.setattr("server.constants.TRUSTED_PROXY_IPS", ["172.16.0.2"])
    app = _build_app(TrustedProxyMiddleware)

    resp = await _get(app, "172.16.0.2", headers={"X-Forwarded-For": "10.99.1.2"})
    assert resp.status_code == 200
    assert resp.json()["client_ip"] == "10.99.1.2"


@pytest.mark.asyncio
async def test_trusted_proxy_rejects_garbage_xff(monkeypatch):
    monkeypatch.setattr("server.constants.TRUSTED_PROXY_IPS", ["172.16.0.2"])
    app = _build_app(TrustedProxyMiddleware)

    resp = await _get(app, "172.16.0.2", headers={"X-Forwarded-For": "not-an-ip"})
    assert resp.status_code == 200
    assert resp.json()["client_ip"] == "172.16.0.2"


@pytest.mark.asyncio
async def test_trusted_proxy_never_trusts_xff_by_default(monkeypatch):
    monkeypatch.setattr("server.constants.TRUSTED_PROXY_IPS", [])
    app = _build_app(TrustedProxyMiddleware)

    resp = await _get(app, "192.168.1.50", headers={"X-Forwarded-For": "10.99.1.2"})
    assert resp.status_code == 200
    assert resp.json()["client_ip"] == "192.168.1.50"
