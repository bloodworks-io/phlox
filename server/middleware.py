"""FastAPI middleware classes."""

import asyncio
import logging
import secrets
import time

from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""

    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        return response


class TrustedProxyMiddleware(BaseHTTPMiddleware):
    """Extract real client IP from X-Forwarded-For header."""

    async def dispatch(self, request, call_next):
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            request.state.client_ip = forwarded_for.split(",")[0].strip()
        else:
            request.state.client_ip = (
                request.client.host if request.client else "unknown"
            )
        return await call_next(request)


class LocalTokenMiddleware(BaseHTTPMiddleware):
    """Verify local request token on all API requests.

    This middleware protects the API from unauthorized access by other
    applications running on the same machine. Only requests with a valid
    Authorization: Bearer <token> header are allowed.
    """

    # Paths that don't require token authentication
    PUBLIC_PATHS = {"/", "/health", "/version", "/favicon.ico"}

    async def dispatch(self, request, call_next):
        from server.constants import IS_DOCKER
        from server.server import get_request_token

        path = request.url.path

        # Skip token check for public paths and static files
        if path in self.PUBLIC_PATHS:
            return await call_next(request)

        # Skip static assets
        if path.startswith("/assets/") or path.endswith(
            (".js", ".css", ".png", ".ico", ".svg", ".woff", ".woff2")
        ):
            return await call_next(request)

        # Skip React routes (these serve index.html)
        if path in (
            "/new-patient",
            "/settings",
            "/rag",
            "/clinic-summary",
            "/outstanding-tasks",
        ) or path.startswith("/patient"):
            return await call_next(request)

        # In Docker mode, skip token validation
        if IS_DOCKER:
            return await call_next(request)

        # Get expected token
        expected_token = get_request_token()
        if not expected_token:
            # Server not fully initialized yet, allow through
            return await call_next(request)

        # Verify Authorization header
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"detail": "Missing or invalid Authorization header"},
            )

        provided_token = auth_header[7:]  # Remove "Bearer " prefix
        if not secrets.compare_digest(provided_token, expected_token):
            return JSONResponse(
                status_code=403, content={"detail": "Invalid request token"}
            )

        return await call_next(request)


class ProxyAuthMiddleware(BaseHTTPMiddleware):
    """Validate requests against proxy-passed user headers.

    For use with Authelia, Traefik, Caddy, etc. that pass authenticated
    user identity via headers after performing authentication.
    """

    PUBLIC_PATHS = {"/", "/health", "/version", "/favicon.ico"}

    async def dispatch(self, request, call_next):
        from server.constants import (
            PROXY_AUTH_ALLOWED_USERS,
            PROXY_AUTH_ENABLED,
            PROXY_AUTH_USER_HEADER,
        )

        # Skip if disabled
        if not PROXY_AUTH_ENABLED:
            return await call_next(request)

        path = request.url.path

        # Skip public paths and static files
        if (
            path in self.PUBLIC_PATHS
            or path.startswith("/assets/")
            or path.endswith(
                (".js", ".css", ".png", ".ico", ".svg", ".woff", ".woff2")
            )
        ):
            return await call_next(request)

        # Skip React routes
        if path.startswith("/patient") or path in (
            "/new-patient",
            "/settings",
            "/rag",
            "/clinic-summary",
            "/outstanding-tasks",
        ):
            return await call_next(request)

        # Get user from header
        user = request.headers.get(PROXY_AUTH_USER_HEADER)

        if not user:
            return JSONResponse(
                status_code=401, content={"detail": "Authentication required"}
            )

        if PROXY_AUTH_ALLOWED_USERS and user not in PROXY_AUTH_ALLOWED_USERS:
            logger.warning(f"Access denied for user: {user}")
            return JSONResponse(
                status_code=403, content={"detail": "Access denied"}
            )

        # Store user for downstream use
        request.state.user = user
        return await call_next(request)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limit API requests to prevent abuse and data exfiltration.

    Uses a sliding window algorithm with in-memory storage.
    Different rate limits apply to different endpoint categories.
    """

    # Endpoint-specific limits: (requests_per_minute, burst_multiplier)
    # Burst multiplier allows 2x rate in first 10 seconds of window
    RATE_LIMITS = {
        "/api/transcribe": (10, 2),
        "/api/chat": (30, 2),
        "/api/rag": (20, 2),
        "/api/config": (30, 2),
        "/api/templates": (30, 2),
        "/api/letter": (30, 2),
        "/api/dashboard": (30, 2),
    }
    DEFAULT_LIMIT = (60, 2)  # requests_per_minute, burst_multiplier

    # Patient endpoints need special handling
    PATIENT_LIST_LIMIT = (10, 2)  # Prevents bulk enumeration
    PATIENT_DETAIL_LIMIT = (20, 2)  # Normal browsing allowed

    WINDOW_SECONDS = 60
    BURST_WINDOW_SECONDS = 10

    # In-memory storage with lock for thread safety
    _request_history: dict[str, dict[str, list[float]]] = {}
    _lock = asyncio.Lock()

    # Paths to skip rate limiting
    SKIP_PATHS = {"/", "/health", "/version", "/favicon.ico"}

    def _get_limit_for_path(self, path: str) -> tuple[int, int]:
        """Get rate limit for a given path."""
        # Check for patient list vs detail
        if path == "/api/patient" or path == "/api/patient/":
            return self.PATIENT_LIST_LIMIT
        if path.startswith("/api/patient/"):
            return self.PATIENT_DETAIL_LIMIT

        # Check other endpoints
        for prefix, limit in self.RATE_LIMITS.items():
            if path.startswith(prefix):
                return limit

        return self.DEFAULT_LIMIT

    def _get_endpoint_key(self, path: str) -> str:
        """Get endpoint key for rate limiting (groups related paths)."""
        if path.startswith("/api/patient/") and path != "/api/patient/":
            # Group all individual patient requests
            return "/api/patient/detail"
        for prefix in self.RATE_LIMITS:
            if path.startswith(prefix):
                return prefix
        return "/api/default"

    async def _cleanup_old_requests(
        self, client_ip: str, endpoint: str, now: float
    ):
        """Remove requests older than the window and prune empty keys."""
        if client_ip in self._request_history:
            if endpoint in self._request_history[client_ip]:
                self._request_history[client_ip][endpoint] = [
                    ts
                    for ts in self._request_history[client_ip][endpoint]
                    if now - ts < self.WINDOW_SECONDS
                ]
                # Prune empty endpoint dict
                if not self._request_history[client_ip][endpoint]:
                    del self._request_history[client_ip][endpoint]
            # Prune empty client dict
            if not self._request_history[client_ip]:
                del self._request_history[client_ip]

    @classmethod
    def cleanup_all_zombie_ips(cls):
        """Background task to clean up IPs that never returned.

        Called periodically by the scheduler to prevent memory accumulation
        from port scanners or one-off requests.
        """
        now = time.time()
        ips_to_delete = []

        for client_ip, endpoints in cls._request_history.items():
            # Check if all endpoints for this IP are stale
            all_stale = True
            for endpoint, timestamps in endpoints.items():
                # Keep if any timestamp is within window
                if any(now - ts < cls.WINDOW_SECONDS for ts in timestamps):
                    all_stale = False
                    break

            if all_stale:
                ips_to_delete.append(client_ip)

        for ip in ips_to_delete:
            del cls._request_history[ip]

        if ips_to_delete:
            logger.debug(
                f"Cleaned up {len(ips_to_delete)} stale IPs from rate limiter"
            )

    async def dispatch(self, request, call_next):
        from server.constants import RATE_LIMIT_ENABLED

        # Skip if rate limiting is disabled
        if not RATE_LIMIT_ENABLED:
            return await call_next(request)

        path = request.url.path

        # Skip public paths and static files
        if path in self.SKIP_PATHS:
            return await call_next(request)

        if path.startswith("/assets/") or path.endswith(
            (".js", ".css", ".png", ".ico", ".svg", ".woff", ".woff2")
        ):
            return await call_next(request)

        # Skip React routes
        if path in (
            "/new-patient",
            "/settings",
            "/rag",
            "/clinic-summary",
            "/outstanding-tasks",
        ) or path.startswith("/patient"):
            return await call_next(request)

        # Only rate limit API paths
        if not path.startswith("/api/"):
            return await call_next(request)

        # Get client IP (set by TrustedProxyMiddleware)
        client_ip = getattr(request.state, "client_ip", "unknown")

        # Get rate limit for this endpoint
        rate_limit, burst_multiplier = self._get_limit_for_path(path)
        endpoint = self._get_endpoint_key(path)

        now = time.time()

        async with self._lock:
            # Initialize storage for this client/endpoint if needed
            if client_ip not in self._request_history:
                self._request_history[client_ip] = {}
            if endpoint not in self._request_history[client_ip]:
                self._request_history[client_ip][endpoint] = []

            # Clean up old requests
            await self._cleanup_old_requests(client_ip, endpoint, now)

            # Count requests in window
            requests_in_window = len(self._request_history[client_ip][endpoint])

            # Count requests in burst window (last 10 seconds)
            requests_in_burst = sum(
                1
                for ts in self._request_history[client_ip][endpoint]
                if now - ts < self.BURST_WINDOW_SECONDS
            )

            # Calculate effective limit (burst allowed in first 10 seconds)
            if requests_in_burst < rate_limit * burst_multiplier:
                effective_limit = rate_limit * burst_multiplier
            else:
                effective_limit = rate_limit

            # Check if rate limit exceeded
            if requests_in_window >= effective_limit:
                retry_after = int(
                    self.WINDOW_SECONDS
                    - (now - self._request_history[client_ip][endpoint][0])
                )
                logger.warning(f"Rate limit exceeded for {client_ip} on {path}")
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": "Rate limit exceeded. Please slow down.",
                        "retry_after": retry_after,
                    },
                    headers={
                        "X-RateLimit-Limit": str(rate_limit),
                        "X-RateLimit-Remaining": "0",
                        "X-RateLimit-Reset": str(int(now + retry_after)),
                        "Retry-After": str(retry_after),
                    },
                )

            # Record this request
            self._request_history[client_ip][endpoint].append(now)

            # Calculate remaining
            remaining = max(0, rate_limit - requests_in_window - 1)

        # Process request and add rate limit headers to response
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(rate_limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(
            int(now + self.WINDOW_SECONDS)
        )

        return response
