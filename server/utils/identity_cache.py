"""Short-TTL in-memory cache for per-request identity lookups."""

import threading
import time


class _Miss:
    """Sentinel distinguishing 'no entry' from a cached None."""


_MISS = _Miss()


class IdentityCache:
    # Positive token -> user lookups (Docker session tokens).
    TOKEN_TTL = 20.0
    # Username -> user lookups (desktop implicit admin, proxy auth).
    USERNAME_TTL = 30.0

    def __init__(self) -> None:
        self._entries: dict[str, tuple[object, float]] = {}
        self._lock = threading.Lock()

    def get(self, key: str):
        """Return the cached value, or the _MISS sentinel (expired/absent)."""
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return _MISS
            value, expires_at = entry
            if time.monotonic() >= expires_at:
                self._entries.pop(key, None)
                return _MISS
            return value

    def put(self, key: str, value, ttl: float) -> None:
        with self._lock:
            self._entries[key] = (value, time.monotonic() + ttl)

    def invalidate(self, key: str | None = None) -> None:
        """Drop one key, or the whole cache when key is None."""
        with self._lock:
            if key is None:
                self._entries.clear()
            else:
                self._entries.pop(key, None)


identity_cache = IdentityCache()

# Module-level aliases for callers that import the constants directly.
TOKEN_TTL = IdentityCache.TOKEN_TTL
USERNAME_TTL = IdentityCache.USERNAME_TTL


def resolve(key: str, loader, ttl: float):
    """Cached-or-load helper for positive lookups.

    Returns the cached value when fresh; otherwise calls ``loader()`` and,
    when it yields a non-None result, caches it for ``ttl`` seconds.
    None results (failed lookups) are never cached.
    """
    value = identity_cache.get(key)
    if value is not _MISS:
        return value
    value = loader()
    if value is not None:
        identity_cache.put(key, value, ttl)
    return value
