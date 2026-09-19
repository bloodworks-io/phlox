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


def test_guard_passes_with_no_auth_config():
    """Sessions gate every request by construction, so bare config may boot."""
    server_module.validate_docker_auth(
        passphrase="",
        proxy_auth_enabled=False,
        trusted_proxy_ips=[],
        allow_unauthenticated=False,
    )


def test_guard_exits_with_proxy_auth_but_no_trusted_ips():
    """F2: proxy auth without an explicit trusted-proxy list must not boot."""
    with pytest.raises(SystemExit):
        server_module.validate_docker_auth(
            passphrase="",
            proxy_auth_enabled=True,
            trusted_proxy_ips=[],
            allow_unauthenticated=False,
        )


def test_guard_exits_with_invalid_trusted_ips():
    """Bad TRUSTED_PROXY_IPS entries must fail fast at startup, not per-request."""
    with pytest.raises(SystemExit):
        server_module.validate_docker_auth(
            passphrase="",
            proxy_auth_enabled=True,
            trusted_proxy_ips=["172.16.0.2", "not-a-network"],
            allow_unauthenticated=False,
        )


def test_guard_accepts_ip_and_cidr_trusted_ips():
    server_module.validate_docker_auth(
        passphrase="",
        proxy_auth_enabled=True,
        trusted_proxy_ips=["172.16.0.2", "10.0.0.0/8", "fd00::/8"],
        allow_unauthenticated=False,
    )


def test_guard_passes_with_proxy_auth():
    server_module.validate_docker_auth(
        passphrase="",
        proxy_auth_enabled=True,
        trusted_proxy_ips=["172.16.0.2"],
        allow_unauthenticated=False,
    )


def test_guard_passes_with_loopback_host():
    server_module.validate_docker_auth(
        passphrase="",
        proxy_auth_enabled=False,
        trusted_proxy_ips=[],
        allow_unauthenticated=False,
    )


def test_guard_passes_with_explicit_override():
    server_module.validate_docker_auth(
        passphrase="",
        proxy_auth_enabled=False,
        trusted_proxy_ips=[],
        allow_unauthenticated=True,
    )


def test_guard_warns_on_deprecated_passphrase(caplog):
    server_module.validate_docker_auth(
        passphrase="short",
        proxy_auth_enabled=False,
        trusted_proxy_ips=[],
        allow_unauthenticated=False,
    )
    assert any("PHLOX_PASSPHRASE" in r.message for r in caplog.records)


# --- login endpoint (session flow covered in test_auth.py) ---------------------


def test_login_reachable_without_token(monkeypatch):
    """Login must bypass the token check WITHOUT entering the shared skip list."""
    monkeypatch.setattr("server.constants.IS_DOCKER", True)
    monkeypatch.setattr("server.constants.PHLOX_ALLOW_UNAUTHENTICATED", False)
    client = TestClient(_build_app(LocalTokenMiddleware))
    resp = client.post("/api/auth/login", json={"username": "nobody", "password": "nope"})
    assert resp.status_code == 401  # from the handler, not middleware
    assert client.get("/api/note/list").status_code == 401  # middleware


# --- LocalTokenMiddleware matrix ------------------------------------------------


def test_middleware_token_matrix(monkeypatch):
    monkeypatch.setattr("server.constants.IS_DOCKER", False)
    from server.database.repositories.users import (
        IMPLICIT_ADMIN_USERNAME,
        create_user,
        get_user_by_username,
    )

    if not get_user_by_username(IMPLICIT_ADMIN_USERNAME):
        create_user(IMPLICIT_ADMIN_USERNAME, role="admin")
    set_request_token("matrix-test-token")
    client = TestClient(_build_app(LocalTokenMiddleware))
    token = get_request_token()

    assert client.get("/api/note/list").status_code == 401  # missing header
    assert (
        client.get("/api/note/list", headers={"Authorization": "Bearer wrong"}).status_code == 403
    )
    assert (
        client.get("/api/note/list", headers={"Authorization": f"Bearer {token}"}).status_code
        == 200
    )
    set_request_token(None)


def test_middleware_docker_requires_session(monkeypatch):
    """Docker mode no longer passes through without a token — 401 instead."""
    monkeypatch.setattr("server.constants.IS_DOCKER", True)
    monkeypatch.setattr("server.constants.PHLOX_ALLOW_UNAUTHENTICATED", False)
    set_request_token(None)
    client = TestClient(_build_app(LocalTokenMiddleware))
    assert client.get("/api/note/list").status_code == 401


# --- rate limiting still applies to login (not in shared skip list) ------------


def test_login_is_rate_limited(monkeypatch):
    monkeypatch.setattr("server.constants.RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr("server.constants.IS_DOCKER", True)
    monkeypatch.setattr(RateLimitMiddleware, "DEFAULT_LIMIT", (2, 1))
    client = TestClient(_build_app(RateLimitMiddleware))

    statuses = [
        client.post("/api/auth/login", json={"username": "x", "password": "y"}).status_code
        for _ in range(6)
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


# --- TrustedProxyMiddleware: right-to-left chain walk -----------------------------


@pytest.mark.asyncio
async def test_trusted_proxy_ignores_spoofed_leftmost_xff(monkeypatch):
    """Append-style proxy: client-forged leftmost entries must never win.

    Client at 198.51.100.7 sends a forged XFF; the trusted proxy appends the
    address it actually observed. The first untrusted entry from the right is
    the real client, not the forged 192.0.2.66.
    """
    monkeypatch.setattr("server.constants.TRUSTED_PROXY_IPS", ["172.16.0.2"])
    app = _build_app(TrustedProxyMiddleware)

    resp = await _get(app, "172.16.0.2", headers={"X-Forwarded-For": "192.0.2.66, 198.51.100.7"})
    assert resp.status_code == 200
    assert resp.json()["client_ip"] == "198.51.100.7"


@pytest.mark.asyncio
async def test_trusted_proxy_walks_multiple_trusted_hops(monkeypatch):
    """Every proxy hop between Phlox and the client is skipped right-to-left."""
    monkeypatch.setattr("server.constants.TRUSTED_PROXY_IPS", ["10.0.0.0/8"])
    app = _build_app(TrustedProxyMiddleware)

    resp = await _get(
        app,
        "10.0.0.5",
        headers={"X-Forwarded-For": "192.0.2.66, 198.51.100.7, 10.0.0.4"},
    )
    assert resp.status_code == 200
    assert resp.json()["client_ip"] == "198.51.100.7"


@pytest.mark.asyncio
async def test_trusted_proxy_skips_malformed_leftmost(monkeypatch):
    """A forged/garbage leftmost token must not mask valid entries to its right."""
    monkeypatch.setattr("server.constants.TRUSTED_PROXY_IPS", ["172.16.0.2"])
    app = _build_app(TrustedProxyMiddleware)

    resp = await _get(app, "172.16.0.2", headers={"X-Forwarded-For": "not-an-ip, 198.51.100.7"})
    assert resp.status_code == 200
    assert resp.json()["client_ip"] == "198.51.100.7"


@pytest.mark.asyncio
async def test_trusted_proxy_fails_closed_on_malformed_untrusted_entry(monkeypatch):
    """If the decisive (first untrusted) entry is garbage, fall back to the peer."""
    monkeypatch.setattr("server.constants.TRUSTED_PROXY_IPS", ["172.16.0.2"])
    app = _build_app(TrustedProxyMiddleware)

    resp = await _get(app, "172.16.0.2", headers={"X-Forwarded-For": "192.0.2.66, garbage"})
    assert resp.status_code == 200
    assert resp.json()["client_ip"] == "172.16.0.2"


@pytest.mark.asyncio
async def test_trusted_proxy_all_trusted_chain_uses_leftmost(monkeypatch):
    """Chain fully inside the trust boundary: leftmost (original client) wins.

    Matches uvicorn ProxyHeadersMiddleware semantics for all-trusted chains.
    """
    monkeypatch.setattr("server.constants.TRUSTED_PROXY_IPS", ["10.0.0.0/8"])
    app = _build_app(TrustedProxyMiddleware)

    resp = await _get(app, "10.0.0.5", headers={"X-Forwarded-For": "10.0.0.4, 10.0.0.9"})
    assert resp.status_code == 200
    assert resp.json()["client_ip"] == "10.0.0.4"


@pytest.mark.asyncio
async def test_trusted_proxy_canonicalizes_ipv6(monkeypatch):
    """Equivalent IPv6 spellings must map to one rate-limit/audit identity."""
    monkeypatch.setattr("server.constants.TRUSTED_PROXY_IPS", ["172.16.0.2"])
    app = _build_app(TrustedProxyMiddleware)

    resp = await _get(
        app,
        "172.16.0.2",
        headers={"X-Forwarded-For": "2001:0db8:0000:0000:0000:0000:0000:0001"},
    )
    assert resp.status_code == 200
    assert resp.json()["client_ip"] == "2001:db8::1"
