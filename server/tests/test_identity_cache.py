"""Identity cache: TTL expiry, invalidation, positive-only resolution."""

import time

from server.utils.identity_cache import _MISS, IdentityCache, identity_cache, resolve


def test_put_get_and_ttl_expiry():
    cache = IdentityCache()
    cache.put("k", {"id": 1}, ttl=60.0)
    assert cache.get("k") == {"id": 1}

    # A zero TTL is already expired at read time; absent keys miss too.
    cache.put("old", {"id": 2}, ttl=0.0)
    assert cache.get("old") is _MISS
    assert cache.get("absent") is _MISS


def test_invalidate_single_key_and_everything():
    cache = IdentityCache()
    cache.put("a", 1, ttl=60.0)
    cache.put("b", 2, ttl=60.0)
    cache.invalidate("a")
    assert cache.get("a") is _MISS
    assert cache.get("b") == 2
    cache.invalidate()
    assert cache.get("b") is _MISS


def test_resolve_caches_positive_results_only():
    calls = {"n": 0}

    def loader():
        calls["n"] += 1
        return {"user": "ok"}

    first = resolve("key", loader, ttl=60.0)
    second = resolve("key", loader, ttl=60.0)
    assert first == second == {"user": "ok"}
    assert calls["n"] == 1  # second call served from cache

    # None results are never cached (failed lookups retry).
    misses = {"n": 0}

    def failing():
        misses["n"] += 1
        return None

    assert resolve("bad", failing, ttl=60.0) is None
    assert resolve("bad", failing, ttl=60.0) is None
    assert misses["n"] == 2


def test_expired_entry_is_dropped():
    cache = IdentityCache()
    cache.put("soon", "v", ttl=0.05)
    time.sleep(0.06)
    assert cache.get("soon") is _MISS


def test_global_cache_is_usable():
    identity_cache.put("probe", "x", ttl=60.0)
    assert identity_cache.get("probe") == "x"
    identity_cache.invalidate("probe")
    assert identity_cache.get("probe") is _MISS
